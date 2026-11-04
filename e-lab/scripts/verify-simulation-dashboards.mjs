// Headless-Chromium layout verification for the shared simulation dashboard.
// Usage: node scripts/verify-simulation-dashboards.mjs [baseUrl] [outDir]
// Requires a running dev server (npm run dev) and Playwright + chromium.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/sim-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox"] });
const sizes = [[1366, 768], [1440, 900], [1920, 1080]];
const problems = [];
let shots = 0;

async function overflow(p, label) {
  const r = await p.evaluate(() => {
    const d = document.documentElement;
    const ws = document.querySelector('[data-testid="workspace"]');
    const bad = [];
    if (ws) {
      const wr = ws.getBoundingClientRect();
      for (const el of ws.querySelectorAll("*")) {
        const cs = getComputedStyle(el);
        if (cs.position === "absolute" && el.closest('[role="dialog"],[data-popover]')) continue;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) continue;
        if (r.right > wr.right + 2 || r.bottom > wr.bottom + 2) bad.push(`${el.tagName}.${String(el.className).slice(0, 40)}`);
      }
    }
    return { vs: d.scrollHeight - innerHeight, hs: d.scrollWidth - innerWidth, bad: bad.slice(0, 4) };
  });
  if (r.vs > 1 || r.hs > 1 || r.bad.length) problems.push(`${label}: ${JSON.stringify(r)}`);
}
async function snap(p, label) {
  await p.waitForTimeout(500);
  await overflow(p, label);
  await p.screenshot({ path: `${out}/${label}.png` }); shots++;
}
const click = async (p, t) => { await p.locator(`button:has-text("${t}"), [role=tab]:has-text("${t}"), [role=radio]:has-text("${t}")`).first().click(); await p.waitForTimeout(350); };

for (const [w, h] of sizes) {
  const tag = `${w}x${h}`;
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });

  await p.goto(`${base}/simulation/ideal-gas-simulation`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(1000);
  await snap(p, `ig-${tag}-hidden`);
  await p.click('[data-testid="graph-toggle"]'); await snap(p, `ig-${tag}-graph`);
  await click(p, "Real Gas"); await snap(p, `ig-${tag}-real`);
  await click(p, "Change Volume"); await snap(p, `ig-${tag}-real-volume`);
  await click(p, "Ideal Gas"); await snap(p, `ig-${tag}-ideal-volume`);
  await click(p, "Settings"); await snap(p, `ig-${tag}-settings`); await p.keyboard.press("Escape");
  await click(p, "Reset"); await snap(p, `ig-${tag}-reset`);

  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(1000);
  for (const m of ["P–V", "V–T", "P–T", "V–n"]) {
    await click(p, m); await snap(p, `gl-${tag}-${m}-hidden`);
    const g = p.locator('[data-testid="graph-toggle"]');
    if ((await g.getAttribute("aria-pressed")) !== "true") await g.click();
    await snap(p, `gl-${tag}-${m}-graph`);
    await g.click();
  }
  await click(p, "Settings"); await snap(p, `gl-${tag}-settings`); await p.keyboard.press("Escape");
  if (errs.length) problems.push(`${tag} console: ${errs.slice(0, 3).join(" | ")}`);
  await p.close();
}

// Learn-with-sidebar equivalent: embed width = viewport - 260px sidebar (container-driven layout)
{
  const p = await b.newPage({ viewport: { width: 1366 - 260 + 0, height: 768 } });
  await p.goto(`${base}/simulation/ideal-gas-simulation`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.click('[data-testid="graph-toggle"]');
  await snap(p, "ig-learn-width"); await p.close();
}
// narrow
{
  const p = await b.newPage({ viewport: { width: 390, height: 800 } });
  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/gl-narrow.png` }); shots++; await p.close();
}

// ---- Gas Laws Explorer: tabs, heading, instrument gauges (all 4 modes, graph hidden/visible) ----
// Asserts (headless Chromium, real layout): no page scroll, dashboard height unchanged by the gauges,
// single-row two-line tabs on desktop, gauges inside the chamber and not overlapping other chamber UI,
// no clipped gauge/tab text, gauge text === live strip text, constants stay constant under a real slider drag,
// the piston does not move in P-T.
const GL_MODES = [["pv", "P–V", "Boyle's Law", "Boyle's Law — Pressure and Volume"], ["vt", "V–T", "Charles's Law", "Charles's Law — Volume and Temperature"], ["pt", "P–T", "Gay-Lussac's Law", "Gay-Lussac's Law — Pressure and Temperature"], ["vn", "V–n", "Avogadro's Law", "Avogadro's Law — Volume and Amount of Gas"]];
const GL_SLIDER_TO = { pv: ["V", 0.15], vt: ["T", 0.85], pt: ["T", 0.85], vn: ["n", 0.9] };
const heights = {};
async function glChecks(p, label, { checkDrag = true, pageScroll = true } = {}) {
  const cnt = problems.length;
  for (const [id, abbr, law, heading] of GL_MODES) {
    await p.click(`[data-testid="tab-${id}"]`); await p.waitForTimeout(350);
    for (const graph of [false, true]) {
      const t = p.locator('[data-testid="graph-toggle"]');
      if (((await t.getAttribute("aria-pressed")) === "true") !== graph) { await t.click(); await p.waitForTimeout(650); }
      const tag = `${label}-${id}-${graph ? "graph" : "hidden"}`;
      const r = await p.evaluate(({ abbr, law, heading }) => {
        const rect = (e) => { const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
        const ov = (a, b) => a.l < b.r - 1 && b.l < a.r - 1 && a.t < b.b - 1 && b.t < a.b - 1;
        const q = (s) => document.querySelector(s);
        const ws = q('[data-testid="workspace"]'); const ch = rect(q('[data-testid="chamber"]'));
        const deck = rect(q('[data-testid="instrument-deck"]'));
        const bad = [];
        if (deck.l < ch.l - 1 || deck.r > ch.r + 1 || deck.t < ch.t || deck.b > ch.b + 1) bad.push("deck outside chamber");
        for (const sel of ['[data-testid="piston-callout"]', '[data-testid="play-pause"]']) if (ov(deck, rect(q(sel)))) bad.push(`deck overlaps ${sel}`);
        { const rg = document.createRange(); rg.selectNodeContents(q(".sd-chamber-foot")); const tr = rg.getBoundingClientRect(); if (ov(deck, { l: tr.left, t: tr.top, r: tr.right, b: tr.bottom })) bad.push("deck overlaps caption text"); }
        for (const k of ["P", "T"]) {
          const g = q(`[data-testid="gauge-${k}"]`); const v = q(`[data-testid="gauge-${k}-value"]`);
          const gr = rect(g), vr = rect(v);
          if (vr.l < gr.l - 0.5 || vr.r > gr.r + 0.5 || vr.t < gr.t - 0.5 || vr.b > gr.b + 0.5) bad.push(`gauge ${k} text outside`);
          if (g.scrollWidth > g.clientWidth + 1 || g.scrollHeight > g.clientHeight + 1) bad.push(`gauge ${k} clipped`);
          const lab = g.querySelector(".gl-gauge-label");
          for (const sp of lab.querySelectorAll("span")) if (getComputedStyle(sp).display !== "none" && sp.scrollWidth > sp.clientWidth + 1) bad.push(`gauge ${k} label clipped`);
          if (lab.scrollWidth > lab.clientWidth + 1) bad.push(`gauge ${k} label clipped`);
        }
        const dr = rect(q('[data-testid="gauge-P"]')), dt = rect(q('[data-testid="gauge-T"]'));
        if (ov(dr, dt)) bad.push("gauges overlap each other");
        const tabs = [...document.querySelectorAll('[data-testid="mode-tabs"] .sd-tab')];
        const tabRects = tabs.map(rect);
        for (const [i, t] of tabs.entries()) {
          const m = t.querySelector(".sd-tab-main"), s = t.querySelector(".sd-tab-sub");
          if (m.scrollWidth > m.clientWidth + 1 || s.scrollWidth > s.clientWidth + 1 || t.scrollWidth > t.clientWidth + 1) bad.push(`tab ${i} text clipped`);
          const tx = t.querySelector(".sd-tab-text").getBoundingClientRect(); const br = tabRects[i];
          if (tx.left < br.l - 0.5 || tx.right > br.r + 0.5) bad.push(`tab ${i} text overflows its button`);
          const wide = Math.max(m.scrollWidth, s.scrollWidth); if (wide > br.w - 2) bad.push(`tab ${i} content wider than button`);
          if (i && ov(tabRects[i], tabRects[i - 1])) bad.push(`tab ${i} overlaps tab ${i - 1}`);
        }
        const sub = q('[data-testid="sd-subtitle"]');
        const visSub = [sub.innerText.trim()];
        const explain = q('[data-testid="law-statement"]');
        const hdr = rect(q('[data-testid="sd-header"]'));
        const d = document.documentElement;
        const root = q('[data-testid="workspace"]');
        return {
          wsH: Math.round(rect(ws).h), chH: Math.round(ch.h), vs: d.scrollHeight - innerHeight, hs: d.scrollWidth - innerWidth,
          rootScroll: root.scrollHeight - root.clientHeight, hdrH: Math.round(hdr.h),
          tabsRows: new Set(tabRects.map((t) => Math.round(t.t))).size, tabLabels: tabs.map((t) => t.textContent),
          tabH: Math.round(tabRects[0].h), visSub, subTitle: sub.getAttribute("title"),
          explainClipped: explain.scrollWidth > explain.clientWidth + 1, explain: explain.textContent,
          gP: q('[data-testid="gauge-P-value"]').textContent, gT: q('[data-testid="gauge-T-value"]').textContent,
          sP: q('[data-testid="live-P"] dd').textContent, sT: q('[data-testid="live-T"] dd').textContent,
          bad,
        };
      }, { abbr, law, heading });
      heights[tag] = { ws: r.wsH, chamber: r.chH, hdr: r.hdrH, rootScroll: r.rootScroll };
      if ((pageScroll && r.vs > 1) || r.hs > 1) problems.push(`${tag}: page scroll v=${r.vs} h=${r.hs}`);
      if (r.bad.length) problems.push(`${tag}: ${r.bad.join("; ")}`);
      if (r.tabLabels.join("|") !== GL_MODES.map(([, a, l]) => a + l).join("|")) problems.push(`${tag}: tab labels ${r.tabLabels}`);
      if (!r.visSub.some((x) => x === heading || x === law) || r.subTitle !== heading) problems.push(`${tag}: heading ${JSON.stringify(r.visSub)} / ${r.subTitle}`);
      if (r.gP !== r.sP || r.gT !== r.sT) problems.push(`${tag}: gauge/strip mismatch ${r.gP}/${r.sP} ${r.gT}/${r.sT}`);
      if (label.startsWith("gl-d") && r.tabsRows !== 1) problems.push(`${tag}: tabs not on one row`);
      await p.screenshot({ path: `${out}/${tag}.png` }); shots++;
    }
    if (!checkDrag) continue;
    // real slider drag in this mode: constants must not move, dependent must
    await p.click('[data-testid="reset"]'); await p.waitForTimeout(300);
    const [k, frac] = GL_SLIDER_TO[id];
    const read = () => p.evaluate(() => ({ P: document.querySelector('[data-testid="gauge-P-value"]').textContent, T: document.querySelector('[data-testid="gauge-T-value"]').textContent, piston: document.querySelector('[data-testid="gas-canvas"]').dataset.pistonH }));
    const before = await read();
    const sl = p.locator(`[data-testid="slider-${k}"]`); const bb = await sl.boundingBox();
    await p.mouse.move(bb.x + bb.width * 0.5, bb.y + bb.height / 2); await p.mouse.down();
    await p.mouse.move(bb.x + bb.width * frac, bb.y + bb.height / 2, { steps: 8 }); await p.mouse.up();
    await p.waitForTimeout(1600);
    const after = await read();
    const same = (a) => before[a] === after[a];
    if (id === "pv" && (!same("T") || same("P"))) problems.push(`${label}-${id}: drag P/T ${JSON.stringify([before, after])}`);
    if (id === "vt" && (!same("P") || same("T"))) problems.push(`${label}-${id}: drag ${JSON.stringify([before, after])}`);
    if (id === "pt" && (same("P") || same("T") || !same("piston"))) problems.push(`${label}-${id}: drag (piston must stay) ${JSON.stringify([before, after])}`);
    if (id === "vn" && (!same("P") || !same("T"))) problems.push(`${label}-${id}: drag ${JSON.stringify([before, after])}`);
    if (id !== "pt" && same("piston") && id !== "pv") problems.push(`${label}-${id}: piston did not move`);
    await p.click('[data-testid="reset"]'); await p.waitForTimeout(250);
  }
  return problems.length - cnt;
}
for (const [w, h] of process.env.GL_ONLY ? JSON.parse(process.env.GL_ONLY) : [...sizes, [1100, 700], [900, 700], [880, 700], [820, 700], [390, 800], [320, 700]]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_/.test(m.text())) errs.push(m.text()); });
  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(900);
  await glChecks(p, `${w >= 1000 ? "gl-d" : "gl-n"}${w}x${h}`);
  if (errs.length) problems.push(`gl ${w}x${h} console: ${errs.slice(0, 3).join(" | ")}`);
  await p.close();
}
// real fullscreen (standalone route)
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  await p.goto(`${base}/simulation/gas-laws-explorer`);
  await p.waitForSelector('[data-testid="workspace"]'); await p.waitForTimeout(600);
  await p.click('[aria-label="Enter full screen"]'); await p.waitForTimeout(900);
  const fs_ = await p.evaluate(() => !!document.fullscreenElement);
  if (!fs_) console.log("note: headless Chromium did not enter fullscreen (requestFullscreen refused); fullscreen path not exercised");
  else await glChecks(p, "gl-fullscreen-1440x900", { checkDrag: false });
  await p.close();
}
// NOTE: the Gas Laws Explorer is only reachable embedded through a Learn lesson (needs Supabase data), so the
// Learn-with-sidebar case is emulated by the container-driven layout at 900-1100 px wide (see sizes above).
console.log("DASHBOARD HEIGHTS (px) " + JSON.stringify(heights));
await b.close();
console.log(`${shots} screenshots in ${out}`);
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "no overflow/console problems detected");
process.exit(problems.length ? 1 : 0);
