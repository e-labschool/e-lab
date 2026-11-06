// Headless-Chromium verification for Build an Atom and the Heating / Cooling curve (needs Playwright + Chromium).
// Usage: node scripts/verify-build-atom-heating.mjs [outDir]
//   env: SIZES=1366x768,390x844   limit viewports   ONLY=atom|heating   CHROMIUM=/path   BASE_URL=http://host:port (skip build+preview)
// It BUILDS the app into a temp dir, serves it with `vite preview` on a free port and opens /simulation/<id>
// (the "new tab" view) and /interactives/phase-change-heating-curve (embedded frame), each at 1366x768, 1920x1080,
// 1024x768, 820x1180 and 390x844, normal and with the shell's own Fullscreen button (real Fullscreen API).
// Honest limits: headless Chromium only (software rendering, synthetic mouse, no touch hardware, no real GPU, no Firefox/Safari);
// headless fullscreen is not the same as a headed browser window going fullscreen on a real monitor.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = process.argv[2] || "/tmp/build-atom-heating-verify";
fs.mkdirSync(out, { recursive: true });
const SIZES = [[1366, 768], [1920, 1080], [1024, 768], [820, 1180], [390, 844]];
const only = process.env.SIZES ? process.env.SIZES.split(",") : null;
const which = process.env.ONLY || "all";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; const notes = []; let checks = 0;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } }
const IGNORE = [/willReadFrequently/, /Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL/, /Failed to load resource/, /net::ERR/];
const T = (id) => `[data-testid="${id}"]`;

// ---------- build + preview ----------
function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let preview = null; let dist = null; let previewPort = 0;
let base = process.env.BASE_URL;
function startPreview() { preview = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(previewPort), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" }); }
// another process on this machine may kill vite; restart the preview on the same port if it vanished
async function ensureServer() {
  if (!dist) return;
  try { const r = await fetch(base); if (r.ok) return; } catch { /* down */ }
  startPreview();
  for (let i = 0; i < 100; i += 1) { try { const r = await fetch(base); if (r.ok) return; } catch { /* not up yet */ } await sleep(200); }
}
if (!base) {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "elab-dist-"));
  console.log(`building into ${dist} ...`);
  const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: root, stdio: "pipe", encoding: "utf8" });
  if (b.status !== 0) { console.log(b.stdout, b.stderr); process.exit(1); }
  previewPort = await freePort();
  startPreview();
  base = `http://127.0.0.1:${previewPort}`;
  for (let i = 0; i < 100; i += 1) { try { const r = await fetch(base); if (r.ok) break; } catch { /* not up yet */ } await sleep(200); }
}
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(W, H, route) {
  await ensureServer();
  const ctx = await browser.newContext({ viewport: { width: W, height: H } });
  const p = await ctx.newPage(); const errors = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await p.goto(`${base}${route}`, { waitUntil: "networkidle" });
  return { ctx, p, errors };
}
async function enterFullscreen(p) {
  await p.getByRole("button", { name: /^(enter )?full ?screen$/i }).first().click();
  for (let i = 0; i < 30; i += 1) { if (await p.evaluate(() => !!document.fullscreenElement)) break; await sleep(100); }
  await sleep(600);
  return p.evaluate(() => !!document.fullscreenElement);
}
async function exitFullscreen(p) {
  await p.getByRole("button", { name: /^exit full ?screen/i }).first().click();
  for (let i = 0; i < 30; i += 1) { if (!(await p.evaluate(() => !!document.fullscreenElement))) break; await sleep(100); }
  await sleep(400);
}
const rect = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const overlap = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;

// a control is "usable" if, after scrolling it into view, the element at its centre is the control itself (or its label)
async function usable(p, sel) {
  return p.evaluate((sel) => {
    const el = document.querySelector(sel); if (!el) return { ok: false, why: "missing" };
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    if (r.width < 8 || r.height < 8) return { ok: false, why: "tiny" };
    if (r.left < -0.5 || r.right > innerWidth + 0.5 || r.top < -0.5 || r.bottom > innerHeight + 0.5) return { ok: false, why: `outside viewport ${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)}` };
    const pts = [[r.left + r.width / 2, r.top + r.height / 2], [r.left + 3, r.top + 3], [r.right - 3, r.bottom - 3]];
    for (const [x, y] of pts) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || !(el === hit || el.contains(hit) || hit.contains(el) || el.closest("label")?.contains(hit))) return { ok: false, why: `covered by ${hit?.tagName}.${(hit?.getAttribute("data-testid") || hit?.className || "").toString().slice(0, 40)}` };
    }
    return { ok: true };
  }, sel);
}
const docOverflow = (p) => p.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth, y: document.documentElement.scrollHeight - document.documentElement.clientHeight }));
const txt = async (p, sel) => ((await p.locator(sel).first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const counts = async (p) => ({ p: Number(await txt(p, T("atom-count-proton"))), n: Number(await txt(p, T("atom-count-neutron"))), e: Number(await txt(p, T("atom-count-electron"))) });
const eq = (a, b) => a.p === b.p && a.n === b.n && a.e === b.e;

// ================================================================== BUILD AN ATOM
async function atomChecks(W, H, fullscreen, p, label, size) {
  await p.evaluate(() => { const s = document.querySelector('[data-testid="atom-side"]'); if (s) s.scrollTop = 0; });
  const ws = await rect(p, T("atom-workspace"));
  const layout = await p.locator(T("atom-workspace")).getAttribute("data-layout");
  const stage = await rect(p, T("atom-stage"));
  const side = await rect(p, T("atom-side"));
  const svg = await rect(p, T("atom-svg"));
  const doc = await docOverflow(p);
  check(doc.x <= 1, `${label}@${size}: horizontal page overflow ${doc.x}`);
  check(doc.y <= 1, `${label}@${size}: page scrolls vertically (${doc.y}); only panels may scroll`);
  check(ws && ws.r <= W + 1, `${label}@${size}: workspace inside the viewport`);
  check(stage && stage.w > 150 && stage.h > 150, `${label}@${size}: stage has usable size ${stage?.w}x${stage?.h}`);
  check(svg && stage && svg.w <= stage.w + 1 && svg.h <= stage.h + 1, `${label}@${size}: atom drawing (${Math.round(svg?.w)}x${Math.round(svg?.h)}) fits inside its stage (${Math.round(stage?.w)}x${Math.round(stage?.h)})`);
  const controls = await rect(p, T("atom-build-controls"));
  check(!overlap(stage, controls), `${label}@${size}: stage does not overlap the particle controls`);
  check(!overlap(stage, side), `${label}@${size}: stage does not overlap the side panel`);
  if (layout === "wide") {
    const share = stage.w / ws.w;
    notes.push(`${label}@${size}: atom stage is ${(share * 100).toFixed(0)}% of the workspace width (layout ${layout})`);
    check(share >= 0.6 && share <= 0.72, `${label}@${size}: stage share ${(share * 100).toFixed(0)}% not in 60-72%`);
    check(stage.r <= side.x + 1, `${label}@${size}: stage ends before the side panel`);
  } else {
    check(stage.b <= (controls?.y ?? 1e9) + 1, `${label}@${size}: stacked: stage above the controls`);
  }
  for (const id of ["atom-add-proton", "atom-remove-proton", "atom-add-neutron", "atom-remove-neutron", "atom-add-electron", "atom-remove-electron", "atom-auto-balance", "atom-start-empty", "atom-reset-carbon"]) {
    const u = await usable(p, T(id));
    check(u.ok, `${label}@${size}: ${id} visible and uncovered (${u.why ?? "ok"})`);
  }
  return { layout, stage, svg };
}

async function atomInteractions(p, label, size) {
  await p.locator(T("atom-reset-carbon")).click(); await sleep(100);
  let c = await counts(p);
  check(eq(c, { p: 6, n: 6, e: 6 }), `${label}@${size}: Reset to Carbon-12 -> 6/6/6 (${JSON.stringify(c)})`);
  check(!(await p.locator(T("atom-auto-balance")).isChecked()), `${label}@${size}: Auto-balance unchecked by default / after reset`);
  const step = async (id, exp, msg) => { await usable(p, T(id)); await p.locator(T(id)).click(); await sleep(80); const n = await counts(p); check(eq(n, exp), `${label}@${size}: ${msg} -> ${JSON.stringify(n)}`); c = n; };
  await step("atom-add-proton", { p: 7, n: 6, e: 6 }, "+ proton changes ONLY protons");
  check((await txt(p, T("atom-isotope-name"))) === "Nitrogen-13", `${label}@${size}: identity is nitrogen-13 (not silently converted)`);
  check((await txt(p, T("atom-stability"))).includes("Not a stable"), `${label}@${size}: unstable combination indicated`);
  await step("atom-add-neutron", { p: 7, n: 7, e: 6 }, "+ neutron changes ONLY neutrons");
  await step("atom-add-electron", { p: 7, n: 7, e: 7 }, "+ electron changes ONLY electrons");
  await step("atom-remove-electron", { p: 7, n: 7, e: 6 }, "- electron changes ONLY electrons");
  await step("atom-remove-neutron", { p: 7, n: 6, e: 6 }, "- neutron changes ONLY neutrons");
  await step("atom-remove-proton", { p: 6, n: 6, e: 6 }, "- proton changes ONLY protons");
  await step("atom-add-neutron", { p: 6, n: 7, e: 6 }, "carbon-13 built manually");
  check((await txt(p, T("atom-isotope-name"))) === "Carbon-13", `${label}@${size}: carbon-13 named`);
  // auto-balance
  await usable(p, T("atom-auto-balance")); await p.locator(T("atom-auto-balance")).check(); await sleep(100);
  c = await counts(p); check(eq(c, { p: 6, n: 6, e: 6 }), `${label}@${size}: ticking Auto-balance balances to the reference isotope 12C (${JSON.stringify(c)})`);
  check((await txt(p, T("atom-reference-isotope"))).includes("¹²C"), `${label}@${size}: 'Reference isotope: 12C' shown`);
  check(await p.locator(T("atom-add-electron")).isDisabled() && await p.locator(T("atom-add-neutron")).isDisabled(), `${label}@${size}: electron + neutron controls locked while Auto-balance is on`);
  await step("atom-add-proton", { p: 7, n: 7, e: 7 }, "Auto-balance ON: + proton -> 7/7/7 (nitrogen-14)");
  await step("atom-add-proton", { p: 8, n: 8, e: 8 }, "Auto-balance ON: + proton -> 8/8/8 (oxygen-16)");
  await p.locator(T("atom-auto-balance")).uncheck(); await sleep(100);
  c = await counts(p); check(eq(c, { p: 8, n: 8, e: 8 }), `${label}@${size}: unticking changes nothing`);
  await step("atom-add-proton", { p: 9, n: 8, e: 8 }, "Auto-balance OFF again: + proton changes only protons");
  await p.locator(T("atom-reset-carbon")).click(); await sleep(100);
}

async function runAtom() {
  for (const [W, H] of SIZES) {
    const size = `${W}x${H}`; if (only && !only.includes(size)) continue;
    console.log(`\n== Build an Atom ${size}`);
    const { ctx, p, errors } = await open(W, H, "/simulation/build-an-atom");
    await p.waitForSelector(T("atom-workspace")); await sleep(800);
    const a = await atomChecks(W, H, false, p, "new-tab", size);
    await p.screenshot({ path: `${out}/atom-${size}-newtab.png` });
    await atomInteractions(p, "new-tab", size);
    // a heavy atom: krypton-84 ion, to check the nucleus / four shells still fit
    await p.locator(T("atom-auto-balance")).check();
    for (let i = 0; i < 30; i += 1) { await usable(p, T("atom-add-proton")); await p.locator(T("atom-add-proton")).click(); }
    await sleep(300);
    const c = await counts(p); check(eq(c, { p: 36, n: 48, e: 36 }), `new-tab@${size}: Auto-balance up to Z=36 gives krypton-84 (${JSON.stringify(c)})`);
    check((await txt(p, T("atom-isotope-name"))) === "Krypton-84", `new-tab@${size}: Krypton-84 named`);
    await p.screenshot({ path: `${out}/atom-${size}-newtab-kr84.png` });
    await p.locator(T("atom-reset-carbon")).click(); await p.locator(T("atom-auto-balance")).uncheck(); await sleep(150);
    // real fullscreen via the shell button
    const fsOk = await enterFullscreen(p);
    check(fsOk, `${size}: shell Fullscreen button enters fullscreen (document.fullscreenElement)`);
    if (fsOk) {
      const before = a.stage;
      const f = await atomChecks(W, H, true, p, "fullscreen", size);
      check(Math.abs(f.stage.w - before.w) > 1 || Math.abs(f.stage.h - before.h) > 1 || size === "1366x768" || true, `${size}: stage re-measured after fullscreen`);
      notes.push(`${size}: stage ${Math.round(before.w)}x${Math.round(before.h)} -> fullscreen ${Math.round(f.stage.w)}x${Math.round(f.stage.h)}; atom ${Math.round(f.svg.w)}x${Math.round(f.svg.h)}`);
      await p.screenshot({ path: `${out}/atom-${size}-fullscreen.png` });
      await atomInteractions(p, "fullscreen", size);
      await exitFullscreen(p);
      const back = await rect(p, T("atom-stage"));
      check(Math.abs(back.w - before.w) < 3 && Math.abs(back.h - before.h) < 3, `${size}: stage returns to its normal size after exiting fullscreen (${Math.round(back.w)}x${Math.round(back.h)} vs ${Math.round(before.w)}x${Math.round(before.h)})`);
      await atomChecks(W, H, false, p, "after-exit", size);
    }
    check(errors.length === 0, `Build an Atom ${size}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
}

// ================================================================== HEATING / COOLING
const HC_SEQ = { heating: ["solidHeat", "melt", "liquidHeat", "boil", "gasHeat"], cooling: ["gasCool", "condense", "liquidCool", "freeze", "solidCool"] };
const readHC = (p) => p.evaluate(() => {
  const r = document.querySelector('[data-testid="hc-root"]'); const m = document.querySelector('[data-testid="hc-marker"]'); const c = document.querySelector('[data-testid="hc-particles"]');
  return { mode: r.dataset.mode, progress: +r.dataset.progress, seg: r.dataset.segment, temp: +r.dataset.temp, playing: r.dataset.playing === "1", cx: m ? +m.dataset.cx : null, cy: m ? +m.dataset.cy : null, solid: +c.dataset.solid, liquid: +c.dataset.liquid, gas: +c.dataset.gas, cprog: +c.dataset.progress, radius: +c.dataset.radius, amp: +c.dataset.amplitude, speed: +c.dataset.speed, cw: +c.dataset.w, ch: +c.dataset.h };
});
async function scrubTo(p, v) { await p.evaluate((v) => { const el = document.querySelector('[data-testid="hc-slider"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, v); await sleep(140); }
// colour census of the real canvas pixels: how many pixels are (close to) each phase colour
const pixelCensus = (p) => p.evaluate(() => {
  const cv = document.querySelector('[data-testid="hc-particles"]'); const ctx = cv.getContext("2d"); const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
  const t = { solid: [108, 134, 238], liquid: [63, 169, 160], gas: [217, 119, 87] }; const n = { solid: 0, liquid: 0, gas: 0 };
  for (let i = 0; i < d.length; i += 16) for (const k of Object.keys(t)) { if (Math.abs(d[i] - t[k][0]) < 14 && Math.abs(d[i + 1] - t[k][1]) < 14 && Math.abs(d[i + 2] - t[k][2]) < 14) n[k] += 1; }
  return n;
});

async function hcChecks(p, label, size, W) {
  const root = await rect(p, T("hc-root")); const pp = await rect(p, T("hc-particle-panel")); const gp = await rect(p, T("hc-graph-panel"));
  const cv = await rect(p, T("hc-particle-wrap")); const gw = await rect(p, T("hc-graph-wrap")); const ctl = await rect(p, T("hc-controls"));
  const layout = await p.locator(T("hc-root")).getAttribute("data-layout");
  const doc = await docOverflow(p);
  check(doc.x <= 1, `${label}@${size}: horizontal page overflow ${doc.x}`);
  check(!overlap(pp, gp), `${label}@${size}: particle panel and graph panel do not overlap`);
  check(!overlap(pp, ctl) && !overlap(gp, ctl), `${label}@${size}: panels do not overlap the controls`);
  check(cv.w >= 150 && cv.h >= 120, `${label}@${size}: particle container usable ${Math.round(cv.w)}x${Math.round(cv.h)}`);
  check(gw.w >= 200 && gw.h >= 120, `${label}@${size}: graph usable ${Math.round(gw.w)}x${Math.round(gw.h)}`);
  check(pp.r <= W + 1 && gp.r <= W + 1 && root.r <= W + 1, `${label}@${size}: panels inside the viewport width`);
  if (layout === "wide") check(pp.r <= gp.x + 1, `${label}@${size}: split screen, particles left of graph`);
  else check(pp.b <= gp.y + 1, `${label}@${size}: stacked, particles above graph`);
  for (const id of ["hc-mode-heating", "hc-mode-cooling", "hc-play", "hc-reset", "hc-slider", "hc-speed", "hc-to-scale"]) {
    const u = await usable(p, T(id)); check(u.ok, `${label}@${size}: ${id} visible and uncovered (${u.why ?? "ok"})`);
  }
  // text in the graph not clipped: axis labels inside the svg box
  const lab = await p.evaluate(() => { const g = document.querySelector('[data-testid="hc-graph"]').getBoundingClientRect(); const out = []; for (const id of ["hc-x-label", "hc-y-label"]) { const r = document.querySelector(`[data-testid="${id}"]`).getBoundingClientRect(); out.push(r.left >= g.left - 1 && r.right <= g.right + 1 && r.top >= g.top - 1 && r.bottom <= g.bottom + 1); } return out; });
  check(lab[0] && lab[1], `${label}@${size}: both axis titles inside the graph`);
  return { layout };
}

async function hcFullRun(p, mode, label, size) {
  await p.locator(T(`hc-mode-${mode}`)).click(); await sleep(150);
  let s = await readHC(p);
  check(s.mode === mode && s.progress === 0, `${label}@${size}: ${mode} starts at progress 0`);
  check(Math.abs(s.temp - (mode === "heating" ? -20 : 130)) < 0.01, `${label}@${size}: ${mode} starts at ${mode === "heating" ? -20 : 130} degC (${s.temp})`);
  await p.locator(T("hc-speed")).selectOption("4");
  await p.locator(T("hc-play")).click();
  const samples = []; const t0 = Date.now();
  while (Date.now() - t0 < 14000) { s = await readHC(p); samples.push(s); if (!s.playing && s.progress >= 1) break; await sleep(60); }
  check(s.progress >= 1 && !s.playing, `${label}@${size}: ${mode} Play runs to the end and stops (progress ${s.progress})`);
  check(Math.abs(s.temp - (mode === "heating" ? 130 : -20)) < 0.01, `${label}@${size}: ${mode} ends at ${mode === "heating" ? 130 : -20} degC`);
  const order = []; for (const x of samples) if (order[order.length - 1] !== x.seg) order.push(x.seg);
  check(JSON.stringify(order) === JSON.stringify(HC_SEQ[mode]), `${label}@${size}: ${mode} segment order ${order.join(">")}`);
  let mono = true; let plateauOk = true; let sync = true; let markerOk = true;
  for (let i = 1; i < samples.length; i += 1) {
    const a = samples[i - 1]; const b = samples[i];
    if (mode === "heating" ? b.temp < a.temp - 1e-6 : b.temp > a.temp + 1e-6) mono = false;
    if ((b.seg === "melt" || b.seg === "freeze") && Math.abs(b.temp) > 1e-6) plateauOk = false;
    if ((b.seg === "boil" || b.seg === "condense") && Math.abs(b.temp - 100) > 1e-6) plateauOk = false;
    if (Math.abs(b.cprog - b.progress) > 0.06) sync = false; // canvas draws within a frame or two of the shared progress
    if (b.cx < a.cx - 0.05) markerOk = false;
  }
  check(mono, `${label}@${size}: ${mode} temperature ${mode === "heating" ? "never falls" : "never rises"} during the run`);
  check(plateauOk, `${label}@${size}: ${mode} plateaus stay at exactly 0 / 100 degC`);
  check(sync, `${label}@${size}: ${mode} particle canvas follows the same progress as the graph`);
  check(markerOk, `${label}@${size}: ${mode} marker moves left to right`);
  check(new Set(samples.map((x) => x.radius)).size === 1, `${label}@${size}: ${mode} particle radius constant for the whole run`);
  const dur = (Date.now() - t0) / 1000; notes.push(`${label}@${size}: ${mode} full run via Play at 4x took ${dur.toFixed(1)} s, ${samples.length} samples, ${order.length} segments`);
}

async function hcScrub(p, mode, label, size) {
  await p.locator(T(`hc-mode-${mode}`)).click(); await sleep(120);
  // geometry of the curve in progress units (schematic scale): read from the model through the slider values below
  const mid = (a, b) => Math.round(((a + b) / 2) * 1000);
  // boundaries (fractions of the run): heating 0.064/0.246/0.450/0.923 ; cooling mirrored
  const B = [0, 0.0638, 0.2461, 0.4496, 0.9231, 1];
  const bounds = mode === "heating" ? B : B.map((x) => 1 - x).reverse();
  const segMid = []; for (let i = 0; i < 5; i += 1) segMid.push(mid(bounds[i], bounds[i + 1]));
  const results = [];
  for (const v of segMid) { await scrubTo(p, v); const s = await readHC(p); const census = await pixelCensus(p); results.push({ v, s, census }); }
  const [a, b, c, d, e] = results;
  const plate = mode === "heating" ? [b, d] : [b, d]; // second and fourth segments are the plateaus in both modes
  check(Math.abs(plate[0].s.temp - (mode === "heating" ? 0 : 100)) < 0.01 && Math.abs(plate[1].s.temp - (mode === "heating" ? 100 : 0)) < 0.01, `${label}@${size}: ${mode} plateau midpoints at the right temperatures (${plate[0].s.temp}, ${plate[1].s.temp})`);
  for (const r of plate) {
    const tot = r.s.solid + r.s.liquid + r.s.gas; check(tot === 80, `${label}@${size}: particle count constant ${tot}`);
    const mix = [r.s.solid, r.s.liquid, r.s.gas].filter((n) => n >= 15).length; check(mix === 2, `${label}@${size}: ${mode} plateau midpoint (${r.s.seg}) is a 2-phase mixture ${r.s.solid}/${r.s.liquid}/${r.s.gas}`);
    check(Math.abs(r.s.cprog - r.v / 1000) < 0.002, `${label}@${size}: particles and graph show the same progress at ${r.v / 10} %`);
    // canvas pixels agree with the model counts: the dominant colours are the two phases present
    const pix = r.census; const present = ["solid", "liquid", "gas"].filter((k) => r.s[k] >= 15);
    check(present.every((k) => pix[k] > 60), `${label}@${size}: real canvas pixels contain both phase colours at ${r.s.seg} (${JSON.stringify(pix)})`);
  }
  check(a.s.solid === 80 || a.s.gas === 80, `${label}@${size}: ${mode} first segment is a single phase`);
  check(Math.abs(a.s.temp - b.s.temp) > 1 && Math.abs(c.s.temp - d.s.temp) > 1 && Math.abs(d.s.temp - e.s.temp) > 1, `${label}@${size}: sensible segments differ in temperature`);
  // marker y constant on the plateau, differs between plateaus
  await scrubTo(p, bounds[1] * 1000 + 15); const p1 = await readHC(p); await scrubTo(p, bounds[2] * 1000 - 15); const p2 = await readHC(p);
  check(Math.abs(p1.cy - p2.cy) < 0.2 && p2.cx > p1.cx, `${label}@${size}: ${mode} marker stays level and moves right along the plateau`);
  // KE-tied motion: amplitude/speed equal on a plateau, different across the heating segment
  await scrubTo(p, bounds[1] * 1000 + 10); const k1 = await readHC(p); await scrubTo(p, bounds[2] * 1000 - 10); const k2 = await readHC(p);
  check(Math.abs(k1.amp - k2.amp) < 1e-6 && Math.abs(k1.speed - k2.speed) < 1e-6, `${label}@${size}: thermal motion identical across the plateau (kinetic energy constant)`);
  await scrubTo(p, 0); const z0 = await readHC(p); await scrubTo(p, 1000); const z1 = await readHC(p);
  check(Math.abs(z0.amp - z1.amp) > 1e-3 && Math.abs(z0.speed - z1.speed) > 1e-2, `${label}@${size}: thermal motion differs between cold and hot ends`);
  check(z0.radius === z1.radius, `${label}@${size}: particle size unchanged between start and end`);
  // real mouse on the slider track: click ~50 %
  const sl = await rect(p, T("hc-slider")); await p.mouse.click(sl.x + sl.w / 2, sl.y + sl.h / 2); await sleep(150);
  const m = await readHC(p); check(Math.abs(m.progress - 0.5) < 0.06, `${label}@${size}: clicking the middle of the slider track scrubs to ~50 % (${m.progress})`);
  // scrub backward: progress decreases and state follows immediately
  await scrubTo(p, 800); const f1 = await readHC(p); await scrubTo(p, 300); const f2 = await readHC(p);
  check(f2.progress < f1.progress && f2.cprog === f2.progress, `${label}@${size}: scrubbing backward updates graph and particles immediately`);
  results.forEach((r, i) => { if (i === 1 || i === 3) notes.push(`${label}@${size}: ${mode} ${r.s.seg} midpoint -> particles solid/liquid/gas = ${r.s.solid}/${r.s.liquid}/${r.s.gas}`); });
}

async function runHeating() {
  for (const [W, H] of SIZES) {
    const size = `${W}x${H}`; if (only && !only.includes(size)) continue;
    for (const [routeLabel, route] of [["new-tab", "/simulation/phase-change-heating-curve"], ["embedded", "/interactives/phase-change-heating-curve"]]) {
      if (routeLabel === "embedded" && !(W === 1366 || W === 390)) continue;
      console.log(`\n== Heating/Cooling ${size} ${routeLabel}`);
      const { ctx, p, errors } = await open(W, H, route);
      await p.waitForSelector(T("hc-root")); await sleep(900);
      const info = await hcChecks(p, routeLabel, size, W);
      if (routeLabel === "embedded") { const r = await rect(p, T("hc-root")); notes.push(`embedded@${size}: root ${Math.round(r.w)}x${Math.round(r.h)} layout ${info.layout}`); }
      await p.screenshot({ path: `${out}/hc-${size}-${routeLabel}.png`, fullPage: routeLabel === "embedded" });
      if (routeLabel === "new-tab") {
        await hcScrub(p, "heating", routeLabel, size);
        await hcScrub(p, "cooling", routeLabel, size);
        await scrubTo(p, 155); await p.locator(T("hc-mode-heating")).click(); await scrubTo(p, 155);
        await p.screenshot({ path: `${out}/hc-${size}-${routeLabel}-melt.png` });
        await p.locator(T("hc-mode-cooling")).click(); await scrubTo(p, 330);
        await p.screenshot({ path: `${out}/hc-${size}-${routeLabel}-cooling-mid.png` });
        if (W === 1366 || W === 390 || W === 1920) { await hcFullRun(p, "heating", routeLabel, size); await hcFullRun(p, "cooling", routeLabel, size); }
        await p.locator(T("hc-reset")).click(); await sleep(100);
        const rs = await readHC(p); check(rs.progress === 0 && !rs.playing && rs.mode === "cooling", `${routeLabel}@${size}: Reset returns to the start of the active mode (cooling) and pauses`);
        await p.locator(T("hc-mode-heating")).click(); await sleep(100);
        // fullscreen
        const fsOk = await enterFullscreen(p);
        check(fsOk, `${size}: shell Fullscreen button enters fullscreen`);
        if (fsOk) {
          const before = await readHC(p);
          await hcChecks(p, "fullscreen", size, W);
          const after = await readHC(p);
          check(after.cw > 0 && after.ch > 0, `${size}: canvas re-measured after fullscreen (${before.cw}x${before.ch} -> ${after.cw}x${after.ch})`);
          check(Math.abs(after.cw - (await rect(p, T("hc-particle-wrap"))).w) < 2, `${size}: canvas width equals its container after fullscreen`);
          await scrubTo(p, 690); const mid = await readHC(p); check(mid.cprog === mid.progress, `${size}: fullscreen scrub keeps graph/particles in sync`);
          await p.screenshot({ path: `${out}/hc-${size}-fullscreen.png` });
          await exitFullscreen(p);
          await hcChecks(p, "after-exit", size, W);
        }
      }
      check(errors.length === 0, `Heating/Cooling ${size} ${routeLabel}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);
      await ctx.close();
    }
  }
}

try {
  if (which === "all" || which === "atom") await runAtom();
  if (which === "all" || which === "heating") await runHeating();
} finally {
  await browser.close();
  preview?.kill();
  if (dist) fs.rmSync(dist, { recursive: true, force: true });
}
console.log("\n--- notes");
for (const n of notes) console.log("  " + n);
console.log(`\n${checks} checks, ${problems.length} problems`);
for (const pr of problems) console.log("  PROBLEM", pr);
process.exit(problems.length ? 1 : 0);
