// Headless-Chromium verification of the Mass Spectrometry workspace (the MS tab of the Spectroscopy Simulation Lab).
// Usage: node scripts/verify-ms-spectrometry.mjs [baseUrl] [outDir]      Route: /simulation/spectroscopy-studio  (MS tab)
// Without a baseUrl the app is built into a temp directory and served by `vite preview` on a free port (stopped at the end).
// Environment: SIZES=1366x768,390x844 limits the viewports; CHROMIUM overrides the browser path.
//
// It walks ALL thirteen stages at the five reference viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844) with real interactions
// (Begin, Introduce Sample, Ionize, Replay, every fragmentation pathway, the voltage slider, m/z selector and B slider of the magnetic sector, Start Flight and the ion-X slider,
// Detect ions, peak clicks, the abundance slider, every compound of the isotope-pattern stage, the whole unknown-compound flow, the evidence combiner),
// and checks: no horizontal overflow, one screen on desktop sizes, no clipped controls or SVG text, the animations really move (pixel difference between frames) and Pause freezes them,
// the pictures really change when sliders / choices change, the 3D methane renders (WebGL) and no WebGL context leaks over repeated stage changes, reduced motion, IR and NMR still reachable, no console errors.
// Screenshots go to outDir. Honest limits: software GL (SwiftShader), synthetic mouse and keyboard events only; no real GPU, no real touch hardware, Chromium only, no assistive technology.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { SPECTRA } from "../src/engines/spectroscopy-studio/ms/data/spectra.js";
import { radiusFromMz } from "../src/engines/spectroscopy-studio/ms/physics/kinematics.js";

async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2]; let dist = null;
if (!base) {
  const cwd = new URL("..", import.meta.url).pathname; dist = `${process.env.TMPDIR || "/tmp"}/ms-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/ms-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const problems = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];
const ONLY = process.env.SIZES ? process.env.SIZES.split(",") : null;
const URL_PATH = "/simulation/spectroscopy-studio";

async function open(w, h, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra }); const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text().slice(0, 240)); });
  p.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  await p.goto(`${base}${URL_PATH}`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(T("spectroscopy-workspace"), { timeout: 30000 }); await sleep(1500);
  await p.click(T("tech-ms")); await p.waitForSelector(`${T("stage-stepper")}[data-count="13"]`, { timeout: 10000 }); await sleep(800);
  return { ctx, p, errs };
}

for (const [w, h] of SIZES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  const tag = `${w}x${h}`; console.log(tag);
  const { ctx, p, errs } = await open(w, h);
  const shot = (name) => p.screenshot({ path: `${out}/${tag}-${name}.png` });
  const text = async (sel) => (await p.locator(sel).first().evaluate((el) => el.innerText ?? el.textContent)).replace(/\s+/g, " ").trim();
  const attr = async (sel, a) => p.locator(sel).first().getAttribute(a);
  const count = (sel) => p.locator(sel).count();
  const click = async (sel, wait = 250) => { await p.locator(sel).first().click(); await sleep(wait); };
  const setRange = (sel, v) => p.locator(sel).first().evaluate((el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v);
  const goStage = async (n) => { await p.click(T(`step-${n}`)); await sleep(700); };
  const waitFor = async (fn, ms = 9000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(150); } return false; };
  const canvases = () => count("canvas");
  const geom = async (label, panelMayScroll = false) => {
    const m = await p.evaluate(() => {
      const de = document.documentElement; const ws = document.querySelector('[data-testid="spectroscopy-workspace"]'); const r = ws.getBoundingClientRect();
      const clipped = [...ws.querySelectorAll("button, [role=tab], [role=radio]")].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 1 || q.left < r.left - 1); }).length;
      const panel = document.querySelector('[data-testid="step-panel"]'); const viz = document.querySelector('[data-testid="step-viz"]');
      const vr = viz.getBoundingClientRect(); const out = [...viz.querySelectorAll(".ms-scene, .ms-boxfill, .ms-methane, .ms-split, .ms-evidence")].filter((e) => { const q = e.getBoundingClientRect(); return q.right > vr.right + 2 || q.bottom > vr.bottom + 2; }).length;
      return { hx: de.scrollWidth - innerWidth, vy: de.scrollHeight - innerHeight, wsw: ws.scrollWidth - ws.clientWidth, wsy: ws.scrollHeight - ws.clientHeight, clipped, outside: out, panelScroll: panel ? panel.scrollHeight - panel.clientHeight : 0, layout: ws.getAttribute("data-layout"), vizH: vr.height, vizW: vr.width };
    });
    check(m.hx <= 1, `${tag} ${label}: horizontal page overflow ${m.hx}px`);
    check(m.wsw <= 1, `${tag} ${label}: horizontal overflow inside the workspace ${m.wsw}px`);
    check(m.clipped === 0, `${tag} ${label}: ${m.clipped} controls clipped outside the workspace`);
    check(m.outside === 0, `${tag} ${label}: a visual escapes the animation area`);
    check(m.vizH > 150 && m.vizW > 200, `${tag} ${label}: the animation area is too small (${Math.round(m.vizW)}x${Math.round(m.vizH)})`);
    if (w >= 1280) {
      check(m.vy <= 1, `${tag} ${label}: vertical page scroll ${m.vy}px on a desktop size`);
      check(m.wsy <= 2, `${tag} ${label}: the workspace scrolls inside itself by ${m.wsy}px on a desktop size (should fit one screen)`);
      check(panelMayScroll || m.panelScroll <= 2, `${tag} ${label}: the explanation panel scrolls by ${m.panelScroll}px on a desktop size`);
    } else check(m.layout === "stacked", `${tag} ${label}: expected the stacked layout, got ${m.layout}`);
    return m;
  };
  // pixel statistics of an element: fraction of pixels that differ from a previous capture of it, and a coarse colour census
  const grab = async (sel) => (await p.locator(sel).first().screenshot()).toString("base64");
  const diff = (a, b) => p.evaluate(async ([x, y]) => {
    const load = async (b64) => { const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0); return g.getImageData(0, 0, c.width, c.height).data; };
    const A = await load(x); const B = await load(y); if (A.length !== B.length) return 1; let n = 0;
    for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) + Math.abs(A[i + 1] - B[i + 1]) + Math.abs(A[i + 2] - B[i + 2]) > 60) n += 1;
    return n / (A.length / 4);
  }, [a, b]);
  const census = (sel) => p.locator(sel).first().screenshot().then((buf) => p.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; const o = { bright: 0, amber: 0, red: 0, green: 0, total: c.width * c.height };
    for (let i = 0; i < d.length; i += 4) { const r = d[i]; const gg = d[i + 1]; const b = d[i + 2]; if (r + gg + b > 420) o.bright += 1; if (r > 225 && gg > 170 && gg < 235 && b < 130) o.amber += 1; if (r > 170 && gg < 110 && b < 110) o.red += 1; if (gg > 160 && r < 120 && b < 150) o.green += 1; }
    return o;
  }, buf.toString("base64")));
  const clippedText = (sel) => p.evaluate((q) => { const root = document.querySelector(q); if (!root) return ["(missing)"]; const r = root.getBoundingClientRect(); return [...root.querySelectorAll("text")].filter((t) => { const b = t.getBoundingClientRect(); return b.width > 0 && (b.left < r.left - 1 || b.right > r.right + 1 || b.top < r.top - 1 || b.bottom > r.bottom + 1); }).map((t) => t.textContent.slice(0, 24)); }, sel);
  // largest pixel change between the first frame and three later ones (a localised O-H or N-H motion moves only a small sphere)
  const motion = async (sel, label, expectMove = true, minMove = 0.0004) => {
    const first = await grab(sel); let d = 0;
    for (let k = 0; k < 3; k += 1) { await sleep(170); d = Math.max(d, await diff(first, await grab(sel))); }
    if (expectMove) check(d > minMove, `${tag} ${label}: the animation does not move (pixel change ${(d * 100).toFixed(3)}%)`); else check(d < Math.max(0.0001, minMove), `${tag} ${label}: should be static (pixel change ${(d * 100).toFixed(3)}%)`);
    return d;
  };
  const fr = (o, k) => o[k] / o.total;

  const stageBox = (n) => `${T("step-viz")}`;
  const VIZ = T("step-viz");
  const orange = async (sel) => p.locator(sel).first().screenshot().then((buf) => p.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode(); const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const g = c.getContext("2d"); g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) { if (d[i] > 215 && d[i + 1] > 100 && d[i + 1] < 175 && d[i + 2] < 100) n += 1; } return n / (c.width * c.height);
  }, buf.toString("base64")));
  const ensureStage = async (n) => { await goStage(n); await sleep(300); };

  // ---------- structure ----------
  check((await count(`${T("stage-stepper")} li`)) === 13, `${tag}: the MS stepper does not have thirteen stages`);
  check((await attr(T("step-1"), "aria-current")) === "step" && (await p.locator(T("step-prev")).isDisabled()), `${tag}: stage 1 is not the initial stage with Previous disabled`);
  check(/Mass Spec · stage 1 of 13/.test(await text(".sd-subtitle")), `${tag}: header subtitle`);
  check((await count(T("dev-ms"))) === 0, `${tag}: the MS tab still shows the placeholder`);
  // the current stage pill stays visible and the stepper does not overflow
  { const ov = await p.evaluate(() => { const n = document.querySelector('[data-testid="stage-stepper"]'); return n.scrollWidth - n.clientWidth; }); check(ov <= 1, `${tag}: the 13-stage stepper overflows by ${ov}px`); }

  // ---------- stage 1: rotating methane ----------
  await geom("stage 1"); check((await canvases()) === 1, `${tag}: stage 1 should have exactly one WebGL canvas (has ${await canvases()})`);
  check((await attr(T("methane-stage"), "data-webgl")) === "1", `${tag}: stage 1 methane is not rendered in WebGL`);
  await sleep(900); await shot("s1");
  { const c = await census(T("methane-stage")); check(fr(c, "bright") > 0.004, `${tag}: the methane spheres are not rendered (bright ${c.bright})`); }
  await motion(T("methane-stage"), "stage 1 rotation");
  await p.click(T("btn-play-pause")); await sleep(500); await motion(T("methane-stage"), "stage 1 paused", false, 0.0004); await p.click(T("btn-play-pause")); await sleep(300);
  check(/How can we determine the masses of atoms and molecules\?/.test(await text(T("intro-question"))), `${tag}: stage 1 question`);
  await click(T("begin"), 700); check((await attr(T("step-2"), "aria-current")) === "step", `${tag}: Begin did not go to stage 2`);

  // ---------- stage 2: sample introduction ----------
  await geom("stage 2"); check((await canvases()) === 0, `${tag}: stage 2 canvases ${await canvases()}`);
  { const a = await grab(VIZ); await click(T("introduce-sample"), 1500); check((await diff(a, await grab(VIZ))) > 0.002, `${tag}: Introduce Sample changed nothing in the picture`); }
  await motion(VIZ, "stage 2 molecules flowing");
  check(await waitFor(async () => Number(await attr(T("instrument-svg"), "data-in-chamber")) >= 1, 12000), `${tag}: no molecule reached the ionisation chamber`); await sleep(2500); await shot("s2");
  { const cl = await clippedText(T("instrument-svg")); check(cl.length === 0, `${tag}: stage 2 text clipped: ${cl.join(" | ")}`); }

  // ---------- stage 3: ionisation ----------
  await ensureStage(3); await geom("stage 3"); await shot("s3-before");
  const o0 = await orange(VIZ); const a3 = await grab(VIZ);
  await click(T("ionize"), 500); await motion(VIZ, "stage 3 electron approaching");
  check(await waitFor(async () => Number(await attr(T("ionise-view"), "data-progress")) >= 0.99, 26000), `${tag}: ionisation did not finish`); await sleep(600); await shot("s3-after");
  check((await diff(a3, await grab(VIZ))) > 0.004, `${tag}: Ionize changed nothing visible`); const o1 = await orange(VIZ); check(o1 > o0 + 0.0008, `${tag}: no distinct orange molecular ion after ionisation (${(o0 * 100).toFixed(2)}% -> ${(o1 * 100).toFixed(2)}%)`);
  check((await count(T("molecular-ion"))) === 1 && (await count(T("electron-ejected"))) >= 1, `${tag}: stage 3 ion / ejected electron missing`);
  { const cl = await clippedText(T("ionisation-svg")); check(cl.length === 0, `${tag}: stage 3 text clipped: ${cl.join(" | ")}`); }
  await click(T("btn-reset-playback"), 500); check(Number(await attr(T("ionise-view"), "data-progress")) < 0.6, `${tag}: Replay did not restart the ionisation`); await motion(VIZ, "stage 3 Replay");
  check(await waitFor(async () => Number(await attr(T("ionise-view"), "data-progress")) >= 0.99, 26000), `${tag}: ionisation after Replay did not finish`);

  // ---------- stage 4: fragmentation ----------
  await ensureStage(4); await geom("stage 4"); const shots4 = [];
  for (const id of ["ch3", "ch2", "ch", "c"]) { await click(T(`path-${id}`), 300); await sleep(6000); shots4.push(await grab(VIZ)); await shot(`s4-${id}`); check((await attr(T("fragment-view"), "data-path")) === id, `${tag}: pathway ${id} not selected`); check((await count(T("charged-label"))) >= 1 && (await count(T("neutral-label"))) >= 1, `${tag}: pathway ${id}: labels for charged and neutral products`); }
  check((await diff(shots4[0], shots4[1])) > 0.002 && (await diff(shots4[1], shots4[2])) > 0.002, `${tag}: pathway pictures do not differ`);
  { const cl = await clippedText(T("fragment-svg")); check(cl.length === 0, `${tag}: stage 4 text clipped: ${cl.join(" | ")}`); }
  await click(T("path-ch3"), 400); await motion(VIZ, "stage 4 fragmentation");

  // ---------- stage 5: acceleration ----------
  await ensureStage(5); await geom("stage 5"); await motion(VIZ, "stage 5 ions accelerating"); { const cl = await clippedText(T("accel-svg")); check(cl.length === 0, `${tag}: stage 5 text clipped: ${cl.join(" | ")}`); }
  { const a = await grab(VIZ); await p.locator(T("v-slider")).evaluate((el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "4500"); el.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(900); check((await attr(T("accel-view"), "data-v")) === "4500" && (await diff(a, await grab(VIZ))) > 0.002, `${tag}: the voltage slider changes nothing`); }
  check(/4,500 eV/.test(await text(T("readout-ek"))), `${tag}: Ek readout`); await shot("s5"); await setRange(T("v-slider"), 2000); await sleep(300);

  // ---------- stage 6: magnetic sector ----------
  await ensureStage(6); await geom("stage 6"); await sleep(600); await motion(VIZ, "stage 6 ion on its circular path"); await shot("s6-16");
  { const cl = await clippedText(T("sector-svg")); check(cl.length === 0, `${tag}: stage 6 text clipped: ${cl.join(" | ")}`); }
  check((await attr(T("sector-svg"), "data-outcome")) === "detector", `${tag}: m/z 16 at the tuned B should reach the detector`);
  const r16 = Number(await attr(T("sector-svg"), "data-radius")); const B6 = Number(await attr(T("sector-svg"), "data-b")); check(Math.abs(r16 - radiusFromMz(16, 2000, B6)) < 1e-5, `${tag}: radius shown does not match r = mv/(zeB)`);
  const s6 = {}; for (const mz of [12, 31, 43, 58]) { await click(T(`mz-${mz}`), 700); s6[mz] = { r: Number(await attr(T("sector-svg"), "data-radius")), out: await attr(T("sector-svg"), "data-outcome"), img: await grab(VIZ) }; await shot(`s6-${mz}`); }
  check(s6[12].r < r16 && r16 < s6[31].r && s6[31].r < s6[43].r && s6[43].r < s6[58].r, `${tag}: radius must grow with m/z`);
  check(s6[58].out !== "detector" && s6[12].out !== "detector", `${tag}: neighbouring m/z should miss the detector`); check((await diff(s6[12].img, s6[58].img)) > 0.003, `${tag}: the selected path does not change the picture`);
  check(/Not detected/.test(await text(T("sector-outcome"))), `${tag}: a miss is not explained`);
  await click(T("tune-b"), 700); check((await attr(T("sector-svg"), "data-outcome")) === "detector", `${tag}: Tune B did not bring m/z 58 to the detector`);
  { const a = await grab(VIZ); await setRange(T("b-slider"), 0.7); await sleep(600); check((await diff(a, await grab(VIZ))) > 0.003 && (await attr(T("sector-svg"), "data-outcome")) !== "detector", `${tag}: the B slider changes nothing / still detected`); await shot("s6-b-high"); }
  await click(T("mz-16"), 300); await click(T("tune-b"), 300);

  // ---------- stage 7: time of flight ----------
  await ensureStage(7); await geom("stage 7"); { const a = await grab(VIZ); await click(T("start-flight"), 600); await motion(VIZ, "stage 7 ion race"); check((await diff(a, await grab(VIZ))) > 0.0003, `${tag}: Start Flight changed nothing`); }
  check(await waitFor(async () => Number(await attr(T("tof-view"), "data-done")) >= 4, 20000), `${tag}: the race did not finish`); await sleep(400); await shot("s7-done");
  { const cl = await clippedText(T("tof-svg")); check(cl.length === 0, `${tag}: stage 7 text clipped: ${cl.join(" | ")}`); }
  { const order = await p.evaluate(() => ["m16", "m31", "m43", "x"].map((id) => Number(document.querySelector(`[data-testid="arrival-${id}"]`).dataset.rank))); check(order.join() === "1,2,3,4", `${tag}: arrival order ${order}`); }
  { const t0 = await text(T("readout-tx")); await setRange(T("massx-slider"), 20); await sleep(500); check((await text(T("readout-tx"))) !== t0, `${tag}: ion-X slider does not change the flight time`); const order = await p.evaluate(() => ["m16", "m31", "m43", "x"].map((id) => Number(document.querySelector(`[data-testid="arrival-${id}"]`).dataset.rank))); check(order.join() === "1,3,4,2", `${tag}: X = 20 arrival order ${order}`); await setRange(T("massx-slider"), 58); }
  await click(T("btn-reset-playback"), 500); check(Number(await attr(T("tof-svg"), "data-progress")) < 0.3, `${tag}: Replay did not restart the race`);

  // ---------- stage 8: detection ----------
  await ensureStage(8); await geom("stage 8"); await p.click(`${T("speed-switch")} >> text=2×`); await sleep(200);
  { const a = await grab(VIZ); await click(T("detect-ions"), 1500); await motion(VIZ, "stage 8 ions arriving"); check((await diff(a, await grab(VIZ))) > 0.01, `${tag}: Detect ions changed nothing`); }
  await sleep(2500); await shot("s8-mid"); const mid = Number(await attr(T("detect-view"), "data-k")); check(mid > 5 && mid < 213, `${tag}: detection progress ${mid}`);
  check(await waitFor(async () => (await attr(T("detect-view"), "data-k")) === (await attr(T("detect-view"), "data-total")), 30000), `${tag}: not all ions detected`); await sleep(400); await shot("s8-end");
  { const rel = await p.evaluate(() => Object.fromEntries([12, 13, 14, 15, 16, 17].map((m) => [m, Number(document.querySelector(`[data-testid="detect-spectrum"] [data-testid="peak-${m}"]`).dataset.rel)]))); check(Math.abs(rel[16] - 100) < 0.5 && Math.abs(rel[15] - 85) < 1.5, `${tag}: final peak heights ${JSON.stringify(rel)}`); }
  { const cl = await clippedText(T("detect-svg")); check(cl.length === 0, `${tag}: stage 8 text clipped: ${cl.join(" | ")}`); }
  await p.click(`${T("speed-switch")} >> text=1×`); await sleep(200);

  // ---------- stage 9: spectrum ----------
  await ensureStage(9); await geom("stage 9", true); await sleep(6500); await shot("s9");
  { const cl = await clippedText(T("methane-spectrum")); check(cl.length === 0, `${tag}: stage 9 spectrum text clipped: ${cl.join(" | ")}`); }
  check(/M⁺• = base peak/.test(await p.locator(T("methane-spectrum")).evaluate((e) => e.textContent)), `${tag}: stage 9 M / base-peak tag`);
  { const a = await grab(VIZ); await click(`${T("methane-spectrum")} ${T("peak-15")}`, 400); check((await diff(a, await grab(VIZ))) > 0.0008, `${tag}: a clicked peak is not highlighted`); }
  check(/CH₃⁺/.test(await text(T("info-formula"))) && /m\/z 15/.test(await text(T("peak-info"))) && (await text(T("info-origin"))).length > 20, `${tag}: stage 9 peak info`); await shot("s9-peak15");
  await p.locator(`${T("methane-spectrum")} ${T("peak-16")}`).focus(); await p.keyboard.press("Enter"); await sleep(300); check(/CH₄⁺•/.test(await text(T("info-formula"))), `${tag}: peaks are not keyboard-operable`);
  { const a = await grab(VIZ); await click(T("btn-reset-playback"), 600); check((await diff(a, await grab(VIZ))) > 0.004, `${tag}: Replay did not rebuild the spectrum`); await sleep(6000); }

  // ---------- stage 10: isotopes ----------
  await ensureStage(10); await geom("stage 10"); await sleep(3500); await shot("s10-75");
  { const cl = await clippedText(VIZ); check(cl.length === 0, `${tag}: stage 10 text clipped: ${cl.join(" | ")}`); }
  check(/35\.50/.test(await text(T("readout-ar"))), `${tag}: Ar at 75:25`);
  { const a = await grab(VIZ); await setRange(T("abundance-slider"), 40); await sleep(500); check((await diff(a, await grab(VIZ))) > 0.003, `${tag}: the abundance slider changes nothing`); }
  check(/36\.20/.test(await text(T("readout-ar"))), `${tag}: Ar at 40:60 should be 36.20 (${await text(T("readout-ar"))})`);
  { const r = await p.evaluate(() => ["35", "37"].map((m) => Number(document.querySelector(`[data-testid="isotope-spectrum"] [data-testid="peak-${m}"]`).dataset.rel))); check(Math.abs(r[0] - 40) < 0.2 && Math.abs(r[1] - 60) < 0.2, `${tag}: peaks at 40:60 ${r}`); }
  await shot("s10-40"); await click(T("preset-natural"), 400); check(/35\.48/.test(await text(T("readout-ar"))), `${tag}: Ar natural`); await click(T("preset-teaching"), 300);

  // ---------- stage 11: patterns ----------
  await ensureStage(11); await geom("stage 11"); await sleep(3800); await shot("s11-cl2");
  check((await attr(T("pattern-view"), "data-ratio")) === "9:6:1", `${tag}: Cl2 pattern`);
  { const cl = await clippedText(T("pattern-spectrum")); check(cl.length === 0, `${tag}: stage 11 spectrum text clipped: ${cl.join(" | ")}`); }
  const pats = {}; for (const [id, ratio] of [["ch3cl", "3:1"], ["ch2cl2", "9:6:1"], ["ch3br", "1:1"], ["br2", "1:2:1"], ["chcl3", "27:27:9:1"]]) { const a = await grab(VIZ); await click(T(`compound-${id}`), 500); await sleep(3600); pats[id] = await grab(VIZ); check((await attr(T("pattern-view"), "data-ratio")) === ratio, `${tag}: ${id} ratio ${await attr(T("pattern-view"), "data-ratio")} (expected ${ratio})`); check((await diff(a, pats[id])) > 0.002, `${tag}: ${id}: picture did not change`); if (id === "ch3br") await shot("s11-ch3br"); }
  await click(T("compound-cl2"), 400); await click(T("model-natural"), 400); check((await attr(T("pattern-view"), "data-ratio")) === "100.0:64.0:10.2", `${tag}: natural Cl2`); await click(T("model-teaching"), 300);
  await click(`${T("pattern-spectrum")} ${T("peak-72")}`, 400); check(/³⁵Cl–³⁷Cl/.test(await text(T("pattern-ratio"))), `${tag}: peak click shows the combination`);

  // ---------- stage 12: unknown ----------
  await ensureStage(12); await geom("stage 12", true); await shot("s12-start");
  { const html = await p.evaluate(() => document.querySelector('[data-testid="step-panel"]').innerText + document.querySelector('[data-testid="step-viz"]').innerHTML); check(!/Methane|CH₄|reveal/.test(html.replace(/Unknown 1 of 5/, "")), `${tag}: stage 12 leaks the compound before submission`); }
  { const a = await grab(VIZ); await click(`${T("unknown-spectrum")} ${T("peak-15")}`, 400); check(/Hint for m\/z 15/.test(await text(T("hint"))) && (await diff(a, await grab(VIZ))) > 0.0008, `${tag}: peak hint / highlight`); }
  const pk = (m) => `${T("unknown-spectrum")} ${T("peak-" + m)}`;
  await click(T("task-1"), 200); await click(pk(16), 200); await click(T("use-peak"), 200); await click(T("task-2"), 200); await click(pk(16), 200); await click(T("use-peak"), 200);
  await click(T("task-3"), 200); for (const m of [14, 15]) { await click(pk(m), 200); await click(T("use-peak"), 200); } await shot("s12-picked");
  check((await count(`${T("unknown-spectrum")} .ms-picked`)) >= 2, `${tag}: picked peaks are not outlined`);
  await click(T("task-4"), 200); await click(T("iso-none"), 200); await click(T("task-5"), 300); check((await p.locator(T("submit")).isDisabled()), `${tag}: Submit enabled before all tasks`); await click(T("cand-methane"), 300);
  await shot("s12-task5"); await click(T("submit"), 700); await geom("stage 12 reveal", true); await shot("s12-reveal");
  check(/All five correct/.test(await text(T("reveal-score"))) && (await text(T("explanation"))).length > 60, `${tag}: stage 12 reveal`);
  await click(T("next-unknown"), 500); check(/Unknown 2 of 5/.test(await text(T("unknown-title"))), `${tag}: next unknown`);
  { const html = await p.evaluate(() => document.querySelector('[data-testid="step-panel"]').innerText + document.querySelector('[data-testid="step-viz"]').innerHTML); check(!/Ethanol|C₂H₆O/.test(html), `${tag}: round 2 leaks the compound`); } await shot("s12-round2");
  check(await p.locator(`${T("unknown-spectrum")} ${T("peak-31")}`).count() === 1, `${tag}: round 2 spectrum`);

  // ---------- stage 13: comparison ----------
  await ensureStage(13); await geom("stage 13", true); await shot("s13-start");
  check((await count(`${T("technique-table")} tbody tr`)) === 3, `${tag}: stage 13 table`);
  for (const t of ["ms", "ir", "nmr"]) { const a = await grab(VIZ); await click(T(`reveal-${t}`), 500); check((await diff(a, await grab(VIZ))) > 0.004, `${tag}: showing ${t} evidence changed nothing`); }
  await geom("stage 13 evidence", true); await shot("s13-ethanol"); check((await count(`${T("candidates")} li[data-in="1"]`)) === 1 && /Only Ethanol/.test(await text(T("verdict"))), `${tag}: ethanol narrowing`);
  { const cl = await clippedText(T("ev-ms")); check(cl.length === 0, `${tag}: stage 13 MS card text clipped: ${cl.join(" | ")}`); }
  await click(T("example-chloromethane"), 400); await click(T("reveal-ms"), 500); check((await count(`${T("candidates")} li[data-in="1"]`)) === 1, `${tag}: chloromethane is decided by MS`); await shot("s13-chloromethane");
  check(/No single technique is universally sufficient/.test(await text(T("no-single"))), `${tag}: the no-single-technique statement`);

  // ---------- keeping state, other tabs, leak check, reduced motion ----------
  await goStage(6); await click(T("mz-43"), 300); await setRange(T("b-slider"), 0.33); await sleep(200);
  await p.click(T("tech-nmr")); await p.waitForSelector(`${T("stage-stepper")}[data-count="6"]`, { timeout: 8000 }); await sleep(900);
  check((await count(`${T("stage-stepper")} li`)) === 6 && /¹H NMR · step/.test(await text(".sd-subtitle")), `${tag}: NMR tab broken after MS`); await shot("nmr-after-ms");
  await p.click(T("tech-ir")); await p.waitForSelector(`${T("stage-stepper")}[data-count="9"]`, { timeout: 8000 }); await sleep(900);
  check((await count(`${T("stage-stepper")} li`)) === 9 && /IR Spectroscopy · stage/.test(await text(".sd-subtitle")), `${tag}: IR tab broken after MS`); await shot("ir-after-ms");
  await p.click(T("tech-ms")); await p.waitForSelector(`${T("stage-stepper")}[data-count="13"]`); await sleep(700);
  check((await attr(T("step-6"), "aria-current")) === "step" && (await attr(T("sector-svg"), "data-mz")) === "43" && (await attr(T("sector-svg"), "data-b")) === "0.33", `${tag}: MS experiment not restored after visiting IR and NMR`);
  for (let i = 0; i < 5; i += 1) { await goStage(1); await goStage(3); await goStage(9); await goStage(1); }
  check((await canvases()) === 1, `${tag}: WebGL canvases after many stage changes: ${await canvases()}`); await goStage(7); check((await canvases()) === 0, `${tag}: a canvas is left behind after leaving stage 1`);
  await p.click(".sd-btn:has-text('Reset')"); await sleep(400); check((await attr(T("step-7"), "aria-current")) === "step" && (await attr(T("tof-view"), "data-started")) === "0", `${tag}: Reset kept the stage and cleared the experiment`);

  check(errs.length === 0, `${tag}: console errors: ${[...new Set(errs)].join(" | ")}`);
  await ctx.close();

  if (w === 1366 || w === 390) {
    const rm = await open(w, h, { reducedMotion: "reduce" });
    const mot = async (sel) => { const a = await rm.p.locator(sel).first().screenshot(); await sleep(500); const b = await rm.p.locator(sel).first().screenshot(); return a.equals(b); };
    await rm.p.click(T("step-1")); await sleep(1000); check(await mot(T("methane-stage")), `${tag}: reduced motion: the methane model should be a static pose`); check((await rm.p.locator("canvas").count()) === 1, `${tag}: reduced motion keeps the 3D methane`);
    await rm.p.click(T("step-3")); await sleep(500); await rm.p.click(T("ionize")); await sleep(500); check(Number(await rm.p.locator(T("ionise-view")).getAttribute("data-progress")) >= 0.99, `${tag}: reduced motion: ionisation should show its end state at once`); check(await mot(T("step-viz")), `${tag}: reduced motion: stage 3 should be still`);
    await rm.p.click(T("step-7")); await sleep(500); await rm.p.click(T("start-flight")); await sleep(500); check((await rm.p.locator(T("tof-view")).getAttribute("data-done")) === "4", `${tag}: reduced motion: the race should show its result`); await rm.p.screenshot({ path: `${out}/${tag}-reduced-s7.png` });
    check(rm.errs.length === 0, `${tag}: reduced-motion console errors: ${rm.errs.join(" | ")}`);
    await rm.ctx.close();
  }
}

await browser.close();
if (server) server.kill();
if (dist) fs.rmSync(dist, { recursive: true, force: true });
console.log(`\n${checks} checks, ${problems.length} problem(s)`);
if (problems.length) { console.log(problems.map((x) => `  - ${x}`).join("\n")); process.exit(1); }
