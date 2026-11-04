// Headless-Chromium verification for the Bonding Visualizer (needs a running dev server + Playwright/Chromium).
// Usage: node scripts/verify-bonding-visualizer.mjs [baseUrl] [outDir]
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/bonding-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const b = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const sizes = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const only = process.env.SIZES ? process.env.SIZES.split(",") : null;
const problems = []; const notes = []; let shots = 0;
const T = (id) => `[data-testid="${id}"]`;

async function layoutCheck(p, label) {
  const r = await p.evaluate(() => {
    const d = document.documentElement; const bad = [];
    const ws = document.querySelector('[data-testid="bonding-workspace"]');
    if (ws) {
      const wr = ws.getBoundingClientRect(); const wsScrolls = /(auto|scroll)/.test(getComputedStyle(ws).overflowY) && ws.scrollHeight > ws.clientHeight + 1; // narrow layout stacks and scrolls inside the workspace
      for (const el of ws.querySelectorAll("button,[role=tab],[role=radio],input,select")) {
        const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
        // controls inside a deliberately scrollable strip are allowed to extend; only flag ones past the workspace edges unscrollable
        let sc = el.parentElement, scrollable = false;
        while (sc && sc !== ws) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowX + cs.overflowY) && sc.scrollWidth + sc.scrollHeight > sc.clientWidth + sc.clientHeight) { scrollable = true; break; } sc = sc.parentElement; }
        if (scrollable) continue;
        if (r.right > wr.right + 2 || r.left < wr.left - 2 || (!wsScrolls && (r.bottom > wr.bottom + 2 || r.top < wr.top - 2))) bad.push(`${el.tagName}[${el.dataset.testid || el.textContent.trim().slice(0, 14)}]`);
        if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== "visible") bad.push(`clipped-text:${el.textContent.trim().slice(0, 14)}`);
      }
    }
    return { vs: d.scrollHeight - innerHeight, hs: d.scrollWidth - innerWidth, bad: [...new Set(bad)].slice(0, 6) };
  });
  const narrow = innerWidthOf(label) < 900;
  if ((!narrow && r.vs > 1) || r.hs > 1 || r.bad.length) problems.push(`${label}: ${JSON.stringify(r)}`);
}
const innerWidthOf = (label) => Number(label.split("-")[0]);
async function snap(p, label) { await p.waitForTimeout(300); await layoutCheck(p, label); await p.screenshot({ path: `${out}/${label}.png` }); shots++; }
const click = async (p, id) => { const l = p.locator(T(id)); await l.scrollIntoViewIfNeeded(); await l.click(); };
const stageIs = (p, s, ms = 90000) => p.waitForFunction((s) => document.querySelector('[data-testid="canvas"]')?.getAttribute("data-stage") === s, s, { timeout: ms });
const add = async (p, sym, n = 1) => { for (let i = 0; i < n; i += 1) { await click(p, `el-${sym}`); await p.waitForTimeout(60); } };
const reset = async (p) => { await click(p, "tool-reset"); await p.waitForTimeout(250); };
const frameStats = (p, ms = 3000) => p.evaluate((ms) => new Promise((res) => {
  const d = []; let last = performance.now(); const t0 = last;
  const tick = (now) => { d.push(now - last); last = now; if (now - t0 < ms) requestAnimationFrame(tick); else { d.sort((a, b) => a - b); res({ frames: d.length, medianMs: d[d.length >> 1], p95Ms: d[Math.floor(d.length * 0.95)], maxMs: d[d.length - 1], fps: (d.length * 1000) / (now - t0) }); } };
  requestAnimationFrame(tick);
}), ms);
const num = async (p, id) => Number((await p.textContent(`${T(id)} dd`)).trim());
const tabs = (p) => p.$$eval('[role="tab"][data-testid^="tab-"]', (e) => e.map((x) => x.textContent.trim()));

async function ionic(p, tag, label, syms, extra = {}) {
  for (const [s, n] of syms) await add(p, s, n);
  if (extra.autoAdd) { await snap(p, `${tag}-${label}-incomplete`); await click(p, "tool-add-missing"); await p.waitForTimeout(250); }
  await snap(p, `${tag}-${label}-setup`);
  await click(p, "tool-ionize"); await stageIs(p, "ionized"); await snap(p, `${tag}-${label}-ionized`);
  if (extra.attract !== false) { await click(p, "tool-attraction"); await stageIs(p, "attracted"); await snap(p, `${tag}-${label}-attracted`); }
}

for (const [w, h] of sizes) {
  const tag = `${w}x${h}`; if (only && !only.includes(String(w))) continue;
  const ctx = await b.newContext({ viewport: { width: w, height: h }, hasTouch: w < 900 });
  const p = await ctx.newPage(); const errs = [];
  p.on("pageerror", (e) => errs.push(e.message));
  p.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource|ERR_TUNNEL|ERR_|supabase/i.test(m.text())) errs.push(m.text()); });
  const open = async (q = "") => { await p.goto(`${base}/simulation/bonding-visualizer${q}`); await p.waitForSelector(T("bonding-workspace")); await p.waitForTimeout(700); };
  try {
    await open(); await snap(p, `${tag}-00-initial`);
    // Ionic
    await ionic(p, tag, "LiCl", [["Li", 1], ["Cl", 1]]);
    const lf = await p.getAttribute(T("canvas"), "data-formula"); if (lf !== "LiCl") problems.push(`${tag}: LiCl formula ${lf}`);
    await reset(p);
    await ionic(p, tag, "NaCl", [["Na", 1], ["Cl", 1]]);
    await click(p, "tool-lattice");
    try {
      await p.waitForSelector(T("lattice-stage"), { timeout: 15000 }); await p.waitForTimeout(2500); await snap(p, `${tag}-NaCl-lattice-growing`);
      await p.waitForTimeout(6000); await snap(p, `${tag}-NaCl-lattice-full`);
      const box = await p.locator(`${T("lattice-stage")} canvas`).first().boundingBox();
      if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 120, box.y + box.height / 2 + 40, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(400); await snap(p, `${tag}-NaCl-lattice-rotated`); }
      else notes.push(`${tag}: lattice canvas not found (3D did not render?)`);
      await p.mouse.wheel(0, -300); await p.waitForTimeout(300);
      await click(p, "tool-pause"); await click(p, "tool-pause"); await click(p, "tool-replay"); await p.waitForTimeout(800); await click(p, "tool-back");
      await p.waitForSelector(T("tool-ionize"), { timeout: 5000 });
    } catch (e) { problems.push(`${tag}: NaCl lattice failed: ${e.message.split("\n")[0]}`); }
    await reset(p);
    await ionic(p, tag, "MgCl2", [["Mg", 1], ["Cl", 1]], { autoAdd: true, attract: true });
    const mf = await p.getAttribute(T("canvas"), "data-formula"); if (mf !== "MgCl₂") problems.push(`${tag}: MgCl2 formula ${mf}`);
    await reset(p);
    await ionic(p, tag, "Na2O", [["Na", 1], ["O", 1]], { autoAdd: true });
    await reset(p);
    // Covalent
    await click(p, "tab-covalent"); await p.waitForTimeout(500); await snap(p, `${tag}-cov-H2-initial`);
    await click(p, "tool-bring"); await p.waitForFunction(() => document.querySelector('[data-testid="canvas"]')?.getAttribute("data-close") === "1"); 
    await click(p, "tool-form-bond"); await stageIs(p, "bonded"); await snap(p, `${tag}-cov-H2-bonded`);
    const group = async (name) => p.locator(`[role=radio]:has-text("${name}")`).first().click();
    const view = (p2, v, ms = 90000) => p2.waitForFunction((v) => document.querySelector('[data-testid="canvas"]')?.getAttribute("data-view") === v, v, { timeout: ms });
    const molecule = async (id, label) => {
      await click(p, `example-${id}`); await p.waitForTimeout(250); await click(p, "tool-bring"); await p.waitForTimeout(900); await click(p, "tool-form-bond");
      if (["SF6", "PCl5"].includes(id)) { await p.waitForTimeout(1800); await snap(p, `${tag}-cov-${id}-sharing`); }
      await stageIs(p, "bonded"); await snap(p, `${tag}-cov-${label || id}-lewis`);
      await view(p, "structure"); await p.waitForTimeout(1300); await snap(p, `${tag}-cov-${label || id}-structure`);
      const info = await p.evaluate(() => { const s = document.querySelector('[data-testid="structure"]'); return { atoms: s?.dataset.atoms, bonds: s?.dataset.bonds, rings: document.querySelectorAll('[data-ring]').length, r: s?.dataset.renderer }; });
      const want = { H2: [2, 1], Cl2: [2, 1], HCl: [2, 1], O2: [2, 1], N2: [2, 1], H2O: [3, 2], NH3: [4, 3], CH4: [5, 4], BF3: [4, 3], BeCl2: [3, 2], PCl5: [6, 5], SF6: [7, 6] }[id];
      if (!info.atoms || Number(info.atoms) !== want[0] || Number(info.bonds) !== want[1] || info.rings) problems.push(`${tag}: ${id} structure ${JSON.stringify(info)}`);
      if (info.r !== "webgl") notes.push(`${tag}: ${id} structure rendered as ${info.r}`);
      if (id === "SF6") {
        const box = await p.locator(`${T("structure")} canvas`).first().boundingBox();
        if (box) { await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.down(); await p.mouse.move(box.x + box.width / 2 + 150, box.y + box.height / 2 - 70, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(500); await snap(p, `${tag}-cov-SF6-rotated`); await p.mouse.wheel(0, -250); await p.waitForTimeout(400); await snap(p, `${tag}-cov-SF6-zoomed`); }
        else problems.push(`${tag}: SF6 3D canvas missing`);
      }
    };
    for (const id of ["Cl2", "HCl", "H2O", "NH3", "CH4"]) { await p.locator(T(`example-${id}`)).scrollIntoViewIfNeeded().catch(() => {}); await molecule(id); }
    await group("Double Bond"); await p.waitForTimeout(250); await molecule("O2");
    await group("Triple Bond"); await p.waitForTimeout(250); await molecule("N2");
    await p.locator('[role=tab]:has-text("Incomplete"), [role=radio]:has-text("Incomplete")').first().click(); await p.waitForTimeout(250);
    await molecule("BF3"); await molecule("BeCl2");
    await p.locator('[role=tab]:has-text("Expanded"), [role=radio]:has-text("Expanded")').first().click(); await p.waitForTimeout(250);
    await molecule("PCl5"); await molecule("SF6");
    const cc = await p.textContent(T("central-count")); if (!/12/.test(cc)) problems.push(`${tag}: SF6 central count text: ${cc}`);
    if ((await num(p, "live-shared")) !== 6 || (await num(p, "live-lone")) !== 18 || (await num(p, "live-central")) !== 12) problems.push(`${tag}: SF6 Lewis counts wrong`);
    await click(p, "tool-replay"); await p.waitForTimeout(500); await stageIs(p, "bonded"); await click(p, "tool-pause"); await click(p, "tool-pause"); await reset(p); await snap(p, `${tag}-cov-reset`);
    // Metallic
    await click(p, "tab-metallic"); await p.waitForSelector(T("tool-release"), { timeout: 15000 }); await p.waitForTimeout(1200);
    const gl = await p.locator(`${T("bonding-workspace")} canvas`).count(); if (!gl) notes.push(`${tag}: metallic 3D canvas absent (WebGL unavailable?)`);
    const atomsN = async () => Number(await p.getAttribute(T("canvas"), "data-atoms"));
    await click(p, "add-1"); await click(p, "add-5"); await p.waitForTimeout(800); await snap(p, `${tag}-met-6`);
    if ((await atomsN()) !== 6) problems.push(`${tag}: +1 then +5 gave ${await atomsN()}`);
    await click(p, "add-20"); await click(p, "add-50"); await p.waitForTimeout(1500); await snap(p, `${tag}-met-76`);
    if ((await atomsN()) !== 76) problems.push(`${tag}: 76 expected, got ${await atomsN()}`);
    await click(p, "add-50"); await click(p, "add-50"); await click(p, "add-20"); await click(p, "add-20"); await p.waitForTimeout(1500);
    if ((await atomsN()) !== 200) problems.push(`${tag}: 200 expected, got ${await atomsN()}`);
    const dis = await p.$$eval(".bv-addbtn", (b) => b.map((x) => x.disabled)); if (!dis.every(Boolean)) problems.push(`${tag}: add buttons not disabled at the cap`);
    await snap(p, `${tag}-met-200`);
    if (w === 1366) { const f = await frameStats(p); notes.push(`PERF ${tag} Na 200 atoms, placed: ${JSON.stringify(f)}`); }
    await click(p, "tool-release"); await stageIs(p, "released"); await p.waitForTimeout(600); await snap(p, `${tag}-met-released`);
    if ((await num(p, "live-cores")) !== 200 || (await num(p, "live-electrons")) !== 200) problems.push(`${tag}: released counters`);
    if (w === 1366) { const f = await frameStats(p); notes.push(`PERF ${tag} Na 200 released: ${JSON.stringify(f)}`); }
    await click(p, "tool-form-lattice"); await stageIs(p, "lattice", 90000); await p.waitForTimeout(1800); await snap(p, `${tag}-met-lattice`);
    if ((await num(p, "live-cores")) !== 200 || !/BCC · 8 neighbours/.test(await p.textContent(T("live-lattice")))) problems.push(`${tag}: lattice counters ${await p.textContent(T("live-lattice"))}`);
    if (w === 1366) { const f = await frameStats(p); notes.push(`PERF ${tag} Na 200 lattice (auto-rotating): ${JSON.stringify(f)}`); }
    const mbox = await p.locator(`${T("metallic-stage")} canvas`).first().boundingBox();
    if (mbox) {
      await click(p, "tool-pause");
      await p.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2); await p.mouse.down(); await p.mouse.move(mbox.x + mbox.width / 2 + 200, mbox.y + mbox.height / 2 - 20, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(600); await snap(p, `${tag}-met-lattice-rotated`);
      await p.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2); await p.mouse.down(); await p.mouse.move(mbox.x + mbox.width / 2, mbox.y + mbox.height / 2 - 200, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(600); await snap(p, `${tag}-met-lattice-top`);
      await p.mouse.wheel(0, -500); await p.waitForTimeout(600); await snap(p, `${tag}-met-lattice-zoomed`);
      await click(p, "tool-pause"); await click(p, "tool-replay"); await p.waitForTimeout(1500); await stageIs(p, "lattice", 90000);
    } else notes.push(`${tag}: metallic canvas missing`);
    const ki = await p.textContent(T("key-idea")); if (!/electrostatic attraction between positive metal ions and delocalized electrons/i.test(ki)) problems.push(`${tag}: key idea text missing`);
    const sn = await p.textContent(T("simplified-note")); if (!/simplified/i.test(sn)) problems.push(`${tag}: simplified note missing`);
    await reset(p); if ((await atomsN()) !== 0) problems.push(`${tag}: reset did not clear atoms`);
    // other metals: FCC (Al, 3 e-) and HCP (Mg, 2 e-) at 200 atoms
    for (const [sym, per, lat] of [["Al", 3, "FCC"], ["Mg", 2, "HCP"]]) {
      await click(p, `el-${sym}`); for (const k of [50, 50, 50, 20, 20, 5, 1, 1, 1, 1]) await click(p, `add-${k}`); await p.waitForTimeout(800);
      if ((await atomsN()) !== 200) problems.push(`${tag}: ${sym} count ${await atomsN()}`);
      await click(p, "tool-release"); await stageIs(p, "released"); if ((await num(p, "live-electrons")) !== 200 * per) problems.push(`${tag}: ${sym} electrons`);
      if (w === 1366 && sym === "Al") { const f = await frameStats(p); notes.push(`PERF ${tag} Al 200 atoms / 600 electrons released: ${JSON.stringify(f)}`); }
      await click(p, "tool-form-lattice"); await stageIs(p, "lattice", 90000); await p.waitForTimeout(1500);
      if (!new RegExp(`${lat} · 12 neighbours`).test(await p.textContent(T("live-lattice")))) problems.push(`${tag}: ${sym} lattice text ${await p.textContent(T("live-lattice"))}`);
      await snap(p, `${tag}-met-${sym}-lattice`); await reset(p);
    }
    // small counts: the lattice inside its (smaller) cube
    await click(p, "el-Na"); await click(p, "add-5"); await click(p, "tool-release"); await stageIs(p, "released"); await click(p, "tool-form-lattice"); await stageIs(p, "lattice", 90000); await p.waitForTimeout(1500); await snap(p, `${tag}-met-6-lattice`);
    await reset(p);
    // tab switching resets
    await click(p, "tab-ionic"); await p.waitForTimeout(400);
    const at = await p.getAttribute(T("canvas"), "data-atoms"); if (at !== "0") problems.push(`${tag}: ionic not empty after tab switch (${at})`);
    await snap(p, `${tag}-tab-back-ionic`);
    // restricted-mode configs
    await open("?mode=covalent&modes=covalent"); const t1 = await tabs(p); if (t1.length !== 1 || !/Covalent/.test(t1[0])) problems.push(`${tag}: restricted covalent tabs ${t1}`); await snap(p, `${tag}-cfg-covalent-only`);
    await open("?mode=ionic&modes=ionic,metallic"); const t2 = await tabs(p); if (t2.length !== 2) problems.push(`${tag}: restricted ionic+metallic tabs ${t2}`);
    await open("?mode=metallic&modes=metallic"); await p.waitForSelector(T("tool-release"), { timeout: 15000 }); await snap(p, `${tag}-cfg-metallic-only`);
    if (!errs.length) { /* ok */ } else problems.push(`${tag}: console errors: ${[...new Set(errs)].slice(0, 4).join(" | ")}`);
  } catch (e) { problems.push(`${tag}: flow aborted: ${e.message.split("\n")[0]}`); try { await p.screenshot({ path: `${out}/${tag}-ABORT.png` }); } catch {} }
  await ctx.close();
}
await b.close();
console.log(`screenshots: ${shots} in ${out}`);
for (const n of notes) console.log("NOTE", n);
if (problems.length) { console.log("PROBLEMS:"); for (const x of problems) console.log(" -", x); process.exit(1); }
console.log("no layout, overflow or console problems");
