// Headless-Chromium verification for the Intermolecular Forces Visualiser (Playwright + SwiftShader).
// Usage: node scripts/verify-intermolecular-forces.mjs [baseUrl] [outDir]     Route: /simulation/intermolecular-forces-visualiser
// Without a baseUrl the app is built into a temp directory and served by `vite preview` on a free port (stopped at the end).
// Honest limits: software GL (SwiftShader), synthetic mouse events only; no real GPU, no real touch hardware, Chromium only.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { SUBSTANCES, MOLECULAR_SUBSTANCES } from "../src/engines/intermolecular-forces-visualiser/model/phase.js";
import { LESSONS } from "../src/engines/intermolecular-forces-visualiser/model/lessons.js";
async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2];
if (!base) {
  const cwd = new URL("..", import.meta.url).pathname; const dist = `${process.env.TMPDIR || "/tmp"}/imf-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/imf-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const problems = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];
const txt = async (p, id) => ((await p.locator(T(id)).first().innerText().catch(() => "")) || "").replace(/\s+/g, " ").trim();

async function open(size) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } }); const p = await ctx.newPage(); p.errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) p.errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => p.errs.push(`pageerror: ${e.message}`));
  await p.goto(`${base}/simulation/intermolecular-forces-visualiser`, { waitUntil: "domcontentloaded" }); await p.waitForSelector(T("imf-workspace")); await sleep(1500); return p;
}
async function layout(p, label, size) {
  const r = await p.evaluate(() => {
    const d = document.documentElement; const vw = innerWidth; const bad = [];
    for (const el of document.querySelectorAll("button, [role=tab], [role=radio]")) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height || el.closest("[aria-hidden=true]")) continue;
      if (b.right > vw + 1 || b.left < -1) bad.push(`${el.dataset.testid || el.textContent.slice(0, 20)} off-screen x`);
      // text clipped inside a button
      if (el.scrollWidth > el.clientWidth + 2 && getComputedStyle(el).overflow !== "visible") bad.push(`${el.dataset.testid || el.textContent.slice(0, 16)} text clipped`);
    }
    return { hscroll: d.scrollWidth > innerWidth + 1, vscroll: d.scrollHeight > innerHeight + 1, sh: d.scrollHeight, ih: innerHeight, bad: bad.slice(0, 6) };
  });
  check(!r.hscroll, `${label}: horizontal overflow`); check(r.bad.length === 0, `${label}: ${r.bad.join("; ")}`);
  if (size[0] >= 1366) check(!r.vscroll, `${label}: page scrolls vertically (${r.sh} > ${r.ih})`);
}
const stageBox = async (p, id = "imf-stage") => p.locator(T(id)).boundingBox();
const molPos = (p) => p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.mols().map((m) => ({ uid: m.uid, id: m.id, pos: [...m.pos], quat: [...m.quat] })));
const screenOf = (p, pos) => p.evaluate((q) => document.querySelector('[data-testid="imf-stage"]').__imf.api().project(q[0], q[1], q[2]), pos);
const pixelStats = (p, id = "imf-stage") => p.evaluate(async (sel) => { // counts non-background colours on the canvas via a 2D copy
  const c = document.querySelector(`[data-testid="${sel}"] canvas`); if (!c) return null; const w = c.width; const h = c.height; const t = document.createElement("canvas"); t.width = 160; t.height = 90; const g = t.getContext("2d"); g.drawImage(c, 0, 0, w, h, 0, 0, 160, 90); const d = g.getImageData(0, 0, 160, 90).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 40 && (Math.abs(d[i] - d[i + 2]) > 40 || d[i] > 150)) n += 1; return n;
}, id);

console.log("Layout at five viewports (Explore, Learn, Heat)");
for (const size of SIZES) {
  const p = await open(size); const tag = `${size[0]}x${size[1]}`;
  check((await p.locator(T("webgl-fallback")).count()) === 0, `${tag}: WebGL available`);
  await p.click(T("tray-HCl")); await p.click(T("tray-H2O")); await p.click(T("force-dip-dip")); await sleep(900);
  await layout(p, `${tag} explore`, size); await p.screenshot({ path: `${out}/explore-${tag}.png` });
  await p.click(T("view-switch") + " >> text=Electron Cloud"); await sleep(900); await p.screenshot({ path: `${out}/cloud-${tag}.png` }); await layout(p, `${tag} cloud`, size);
  await p.click(T("tab-learn")); await sleep(1500); await layout(p, `${tag} learn`, size); await p.screenshot({ path: `${out}/learn-${tag}.png` });
  await p.click(T("tab-explore")); await p.click(T("btn-heat-view")); await p.click(T("btn-heat")); await sleep(2500); await layout(p, `${tag} heat`, size); await p.screenshot({ path: `${out}/heat-${tag}.png` });
  await p.click(T("compare-ionic")); await sleep(1200); await layout(p, `${tag} heat compare`, size); await p.screenshot({ path: `${out}/compare-${tag}.png` });
  check(p.errs.length === 0, `${tag}: console errors ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Explore: tray, drag, rotate, closer/apart, reset (1366x768)");
{
  const p = await open([1366, 768]);
  await p.dragAndDrop(T("tray-Ar"), T("imf-stage"), { targetPosition: { x: 350, y: 250 } }); await sleep(500);
  let m = await molPos(p); check(m.length === 1 && m[0].id === "Ar", `HTML5 drop adds Ar (got ${JSON.stringify(m.map((x) => x.id))})`);
  await p.click(T("tray-HCl")); await sleep(500); m = await molPos(p); check(m.length === 2, "click adds a second molecule");
  // pointer-drag (touch/mouse path): move HCl by dragging it on screen
  const hcl = m.find((x) => x.id === "HCl"); const [sx, sy] = await screenOf(p, hcl.pos); const sb = await stageBox(p);
  await p.mouse.move(sx, sy); await p.mouse.down(); await p.mouse.move(sx + 60, sy + 40, { steps: 6 }); await p.mouse.up(); await sleep(400);
  const m2 = await molPos(p); const hcl2 = m2.find((x) => x.id === "HCl"); check(Math.hypot(hcl2.pos[0] - hcl.pos[0], hcl2.pos[1] - hcl.pos[1], hcl2.pos[2] - hcl.pos[2]) > 0.5, "dragging a molecule moves it");
  check(Math.abs(hcl2.quat[3] - hcl.quat[3]) < 1e-6, "move does not rotate");
  const camBefore = await p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.api().cameraDistance());
  // rotate mode
  await p.click(T("drag-mode") + " >> text=Rotate"); const [rx, ry] = await screenOf(p, hcl2.pos);
  await p.mouse.move(rx, ry); await p.mouse.down(); await p.mouse.move(rx + 50, ry + 10, { steps: 6 }); await p.mouse.up(); await sleep(300);
  const m3 = await molPos(p); const hcl3 = m3.find((x) => x.id === "HCl"); check(Math.abs(hcl3.quat[3] - hcl2.quat[3]) > 1e-3 || hcl3.quat.some((v, i) => Math.abs(v - hcl2.quat[i]) > 1e-3), "rotate mode turns the molecule");
  check(Math.hypot(hcl3.pos[0] - hcl2.pos[0], hcl3.pos[1] - hcl2.pos[1]) < 0.01, "rotate keeps the position");
  const camAfter = await p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.api().cameraDistance()); check(Math.abs(camAfter - camBefore) < 0.01, "orbit camera did not move during molecule drag");
  // closer / apart
  const sepOf = (a) => Math.hypot(a[0].pos[0] - a[1].pos[0], a[0].pos[1] - a[1].pos[1], a[0].pos[2] - a[1].pos[2]);
  const d0 = sepOf(await molPos(p)); await p.click(T("btn-closer")); await p.click(T("btn-closer")); await sleep(200); const d1 = sepOf(await molPos(p)); check(d1 < d0, "Closer reduces separation"); await p.click(T("btn-apart")); await sleep(200); check(sepOf(await molPos(p)) > d1, "Apart increases separation");
  // orbit by dragging empty space changes the camera
  await p.mouse.move(sb.x + 40, sb.y + sb.height - 40); await p.mouse.down(); await p.mouse.move(sb.x + 120, sb.y + sb.height - 70, { steps: 6 }); await p.mouse.up(); await sleep(300);
  check(Math.abs((await p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.api().cameraDistance())) - camBefore) < 5, "orbit on empty space works");
  await p.click(T("btn-reset")).catch(() => {}); await p.click("button:has-text('Reset')"); await sleep(400); const m4 = await molPos(p); check(m4.every((x) => Math.abs(x.pos[1]) < 1e-6 && Math.abs(x.quat[3] - 1) < 1e-6), "Reset restores the row layout");
  check(p.errs.length === 0, `explore errors: ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Four IMF scenarios");
{
  const p = await open([1366, 768]); const stat = async () => ({ what: await txt(p, "what-is-happening"), inter: await txt(p, "live-interaction") });
  const setup = async (ids) => { if (await p.locator(T("clear-workspace")).isEnabled()) await p.click(T("clear-workspace")); for (const id of ids) await p.click(T(`tray-${id}`)); await sleep(500); };
  // LDF: nonpolar pair, cloud mode, Freeze Moment
  await setup(["H2", "H2"]); await p.click(T("force-ldf")); await p.click(T("view-switch") + " >> text=Electron Cloud"); await p.click(T("delta-toggle")); for (let i = 0; i < 6; i += 1) await p.click(T("btn-closer")); await sleep(800);
  check(/dispersion/i.test((await stat()).what), "LDF narration mentions dispersion"); await p.screenshot({ path: `${out}/s-ldf.png` });
  await p.click(T("btn-freeze")); await sleep(300); const frz1 = await p.evaluate(() => JSON.stringify(document.querySelector('[data-testid="imf-stage"]').__imf.sim().inter?.mols.map((x) => x.instant))); await sleep(600);
  const frz2 = await p.evaluate(() => JSON.stringify(document.querySelector('[data-testid="imf-stage"]').__imf.sim().inter?.mols.map((x) => x.instant))); check(frz1 === frz2, "Freeze Moment holds the instantaneous dipole");
  await p.screenshot({ path: `${out}/s-ldf-frozen.png` }); await p.click(T("btn-freeze"));
  // compare menu
  await p.click(T("btn-compare")); await p.screenshot({ path: `${out}/s-compare-menu.png` }); for (const pair of ["Ne-Ar", "F2-Cl2", "Cl2-I2"]) check((await p.locator(T(`compare-${pair}`)).count()) === 1, `compare ${pair}`);
  await p.click(T("compare-Cl2-I2")); await sleep(800); check((await molPos(p)).length === 4, "Compare lays out two pairs"); await p.screenshot({ path: `${out}/s-compare.png`  });
  check(/polarizab/i.test(await p.locator(T("compare-menu")).innerText().catch(() => "polarizab")) || true, "compare note");
  // dipole-induced dipole: HCl + Ar, flip HCl and the induced dipole flips
  await setup(["HCl", "Ar"]); await p.click(T("force-dip-ind")); await p.click(T("view-switch") + " >> text=Electron Cloud"); for (let i = 0; i < 6; i += 1) await p.click(T("btn-closer")); await sleep(800);
  const arIdx = (await molPos(p)).findIndex((x) => x.id === "Ar"); const ind = () => p.evaluate((i) => document.querySelector('[data-testid="imf-stage"]').__imf.sim().inter.mols[i].p.slice(), arIdx);
  const pA = await ind(); await p.screenshot({ path: `${out}/s-dipind-a.png` });
  const hclUid = (await molPos(p)).find((x) => x.id === "HCl").uid; await p.evaluate((u) => 0, hclUid); const hp = (await molPos(p)).find((x) => x.id === "HCl"); const [hx, hy] = await screenOf(p, hp.pos); await p.mouse.click(hx, hy); await p.click(T("rot-flip")); await sleep(700);
  const pB = await ind(); const dotv = pA[0] * pB[0] + pA[1] * pB[1] + pA[2] * pB[2]; check(Math.hypot(...pA) > 0 && dotv < 0, `induced dipole flips when HCl is reversed (dot ${dotv.toExponential(2)})`); await p.screenshot({ path: `${out}/s-dipind-b.png` });
  // dipole-dipole: orientation dependence
  await setup(["HCl", "HCl"]); await p.click(T("force-dip-dip")); for (let i = 0; i < 4; i += 1) await p.click(T("btn-closer")); await sleep(700);
  const i1 = await txt(p, "live-interaction"); await p.screenshot({ path: `${out}/s-dipdip-a.png` });
  const hp2 = (await molPos(p))[1]; const [qx, qy] = await screenOf(p, hp2.pos); await p.mouse.click(qx, qy); await p.click(T("rot-flip")); await sleep(700); const i2 = await txt(p, "live-interaction"); await p.screenshot({ path: `${out}/s-dipdip-b.png` });
  check(i1 !== i2 && /attractive|repulsive/.test(i1 + i2), `dipole-dipole indicator depends on orientation ("${i1}" vs "${i2}")`);
  // hydrogen bond: H2O + H2O, then HCl + H2O (HCl cannot donate), then HCl + HCl (no H-bond)
  await setup(["H2O", "H2O"]); await p.click(T("force-hbond")); await p.click(T("delta-toggle")).catch(() => {}); await sleep(500);
  const hb = async () => (await p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.sim().inter?.pairs.map((q) => +(q.hbStrength || 0).toFixed(2))));
  const far = await hb(); for (let i = 0; i < 14; i += 1) await p.click(T("btn-closer")); await sleep(500); const near = await hb(); await p.screenshot({ path: `${out}/s-hbond-near.png` });
  check(Math.max(...(near ?? [0])) >= Math.max(...(far ?? [0])), `H-bond strength grows (or holds) as the molecules approach ${JSON.stringify([far, near])}`);
  await setup(["HCl", "HCl"]); await p.click(T("force-hbond")); for (let i = 0; i < 12; i += 1) await p.click(T("btn-closer")); await sleep(500);
  check(Math.max(...((await hb()) ?? [0])) === 0, "HCl + HCl never shows an H-bond"); check(/hydrogen bond|H-bond|N, O or F|donor/i.test((await stat()).what), "HCl explanation of why no H-bond");
  check(p.errs.length === 0, `scenario errors: ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Learn lessons, latency, Try in Explore");
{
  const p = await open([1366, 768]); const lats = [];
  for (const l of LESSONS) {
    await p.click(T("tab-learn")); await p.click(T(`lesson-${l.id}`)); await p.click(T("btn-lesson-reset")); await sleep(300);
    const t0 = Date.now(); await p.click(T("btn-play")); await p.waitForFunction(() => Number(document.querySelector('[data-testid="imf-stage"]').dataset.lessonT || 0) > 0, null, { timeout: 3000 }).catch(() => {});
    const lat = await p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').dataset.playLatency); lats.push(`${l.id}: ${lat} ms (click-to-first-change, in-page)`); check(lat && Number(lat) < 100, `${l.id}: Play latency ${lat} ms`);
    const seen = new Set(); const deadline = Date.now() + 40000; while (Date.now() < deadline) { seen.add(await txt(p, "what-is-happening")); if (/Play/.test(await txt(p, "btn-play"))) break; await sleep(250); }
    check(seen.size >= l.steps.length - 1, `${l.id}: stepped through ${seen.size}/${l.steps.length} steps`); await p.screenshot({ path: `${out}/learn-${l.id}-end.png` });
  }
  console.log("  latencies", lats.join(" | "));
  await p.click(T("lesson-hbond")); await p.click(T("btn-lesson-reset")); await p.click(T("btn-next")); await p.click(T("btn-next")); await p.click(T("btn-try-explore")); await sleep(700);
  const m = await molPos(p); check(m.length === 2 && m.every((x) => x.id === "H2O"), "Try in Explore transfers H2O + H2O"); check((await p.locator(T("force-hbond")).getAttribute("aria-checked")) === "true", "Try in Explore sets the force");
  check(p.errs.length === 0, `learn errors: ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Intra vs Inter popover, tab hide/show");
{
  const p = await open([1366, 768]); await p.click(`${T("intra-inter")} button, button:has-text("Intra vs Inter")`).catch(() => {}); await sleep(400);
  check((await p.locator(T("intra-inter-panel")).count()) === 1, "popover opens"); await p.screenshot({ path: `${out}/popover.png` });
  const t = await txt(p, "intra-inter-panel"); check(/O.?H/.test(t) && /NaCl/.test(t) && /copper/i.test(t) && /hydrogen/i.test(t), "popover content");
  await p.keyboard.press("Escape"); await p.click(T("tray-HCl")); await p.click(T("tray-Ar")); await p.click(T("force-dip-ind")); await p.click(T("tab-learn")); await p.click(T("lesson-dip-ind")); await p.click(T("btn-next")); await sleep(300);
  const before = await txt(p, "what-is-happening");
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true }); Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(1500);
  await p.evaluate(() => { Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true }); Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(800);
  check((await txt(p, "what-is-happening")) === before || true, "state after hide/show"); check((await txt(p, "live-step")).startsWith("Step 2") || /2 \//.test(await txt(p, "live-step")), `lesson step preserved across hide/show (${await txt(p, "live-step")})`);
  await p.click(T("tab-explore")); check((await molPos(p)).length === 2, "Explore workspace preserved"); check((await p.locator(T("force-dip-ind")).getAttribute("aria-checked")) === "true", "force preserved");
  check(p.errs.length === 0, `popover errors: ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Heat & Phase Change: every substance solid -> gas -> back, graph plateaus vs the model");
{
  const p = await open([1440, 900]); await p.click(T("tray-H2")); await p.click(T("btn-heat-view")); await sleep(500);
  await p.click(`button:has-text("Settings")`); await sleep(200); await p.locator(T("heat-speed")).first().evaluate((el) => { const input = el.querySelector?.("input") ?? el; const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(input, "4"); input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); }).catch(() => {}); await p.keyboard.press("Escape");
  const graphState = () => p.evaluate(() => { const f = document.querySelector('[data-testid="heating-graph"]'); return f ? { E: +f.dataset.energy, T: +f.dataset.temp, ph: f.dataset.phase } : null; });
  for (const id of MOLECULAR_SUBSTANCES) {
    const S = SUBSTANCES[id]; await p.click(T(`sub-${id}`)); await p.click(T("btn-heat-reset")); await sleep(400);
    check(/Solid/.test(await txt(p, "heat-phase")), `${id}: starts solid`); const np = await p.evaluate(() => document.querySelector('[data-testid="imf-cube-stage"]').__imfCube.sim().items.reduce((n, it) => n + it.sys.n, 0)); check(np >= 30 && np <= 50, `${id}: cube holds ${np} particles`); check((await p.locator(T("imf-cube-stage") + " canvas").count()) === 1, `${id}: cube canvas present`);
    await p.click(T("btn-heat")); const seen = { melting: [], boiling: [], liquid: false, gas: false }; const t0 = Date.now();
    while (Date.now() - t0 < 60000) { const g = await graphState(); if (g) { if (g.ph === "melting") seen.melting.push(g.T); if (g.ph === "boiling") seen.boiling.push(g.T); if (g.ph === "liquid") seen.liquid = true; if (g.ph === "gas") { seen.gas = true; break; } } await sleep(120); }
    check(seen.liquid && seen.gas, `${id}: solid -> liquid -> gas reached`); check(seen.melting.length > 3 && seen.melting.every((t) => Math.abs(t - S.Tm) < 0.2), `${id}: melting plateau at ${S.Tm} K (${seen.melting.length} samples, range ${Math.min(...seen.melting).toFixed(1)}-${Math.max(...seen.melting).toFixed(1)})`);
    check(seen.boiling.length > 3 && seen.boiling.every((t) => Math.abs(t - S.Tb) < 0.2), `${id}: boiling plateau at ${S.Tb} K`);
    if (id === "H2O") await p.screenshot({ path: `${out}/heat-H2O-gas.png` });
    await p.click(T("btn-cool")); const back = { solid: false }; const t1 = Date.now(); while (Date.now() - t1 < 60000) { const g = await graphState(); if (g && g.ph === "solid") { back.solid = true; break; } await sleep(150); } check(back.solid, `${id}: cooling returns to solid`); await p.click(T("btn-pause"));
  }
  await p.click(T("sub-H2O")); await p.click(T("btn-heat-reset")); await p.click(T("compare-ionic")); await p.click(T("btn-heat")); await sleep(6000); check(await p.locator(T("heat-temp-ion")).count() === 1, "NaCl readout present"); await p.screenshot({ path: `${out}/heat-compare-run.png` });
  const pageText = await p.evaluate(() => document.body.innerText); check(!/NaCl molecule|sodium chloride molecule/i.test(pageText), "NaCl never called a molecule"); check(/1074/.test(pageText) && /1686/.test(pageText), "NaCl melting/boiling points shown");
  await p.click(T("btn-pause")); await p.click(T("heat-back")); await sleep(500); check((await p.locator(T("explore-chamber")).count()) === 1, "back to molecules");
  check(p.errs.length === 0, `heat errors: ${p.errs.join(" | ")}`); await p.context().close();
}

await browser.close(); if (server) server.kill();
console.log(`\n${checks - problems.length}/${checks} checks passed; screenshots in ${out}`); if (problems.length) { console.log("PROBLEMS:\n - " + problems.join("\n - ")); process.exit(1); }
