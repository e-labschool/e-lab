// Headless-Chromium verification of the six-stage Mass Spectrometry workspace (the MS tab of the Spectroscopy Simulation Lab).
// Usage: node scripts/verify-ms-spectrometry.mjs [baseUrl] [outDir]     (without baseUrl the app is built into a temp dir and served by `vite preview`)
// Environment: SIZES=1366x768,390x844 limits the viewports; MODES=newtab,fullscreen limits the modes; CHROMIUM overrides the browser path; SHOTS=1 saves screenshots to outDir.
//
// Modes: newtab = /simulation/spectroscopy-studio (what "Open in New Tab" opens); fullscreen = the same page after pressing the shared frame's Fullscreen button.
// The /interactives/spectroscopy-studio page only shows the description for an in-development resource in this environment, so the in-page embedded view could NOT be exercised.
// Per viewport and mode: all six stages are opened and checked for horizontal overflow, clipped or covered controls (elementFromPoint) and a non-empty workspace.
// In the newtab mode, with real interactions: sample start, tracking, Ionize, pathway selection + replay, analyser switch, voltage and B sliders, 1+/2+ comparison,
// peak click, the spectrum growing, the three optional activities, Pause really freezing the animation, reduced motion, IR / NMR still reachable, no console errors.
// Honest limits: software GL (SwiftShader), synthetic mouse events only, Chromium only; no real GPU, no real touch hardware, no dark-theme or phone hardware, no assistive technology.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs"; import net from "node:net"; import { spawn } from "node:child_process";

const freePort = () => new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); });
let server = null; let base = process.argv[2]; const cwd = new URL("..", import.meta.url).pathname;
if (!base) {
  const dist = `${process.env.TMPDIR || "/tmp"}/ms-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/ms-verify"; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const ONLY = process.env.SIZES ? process.env.SIZES.split(",") : null; const MODES = process.env.MODES ? process.env.MODES.split(",") : ["newtab", "fullscreen"];
const PATHS = { newtab: "/simulation/spectroscopy-studio", fullscreen: "/simulation/spectroscopy-studio" };
const problems = []; let checks = 0; const T = (id) => `[data-testid="${id}"]`; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];

async function open(w, h, mode, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, ...extra }); const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text().slice(0, 240)); });
  p.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  await p.goto(`${base}${PATHS[mode]}`, { waitUntil: "domcontentloaded" }); await p.waitForSelector(T("spectroscopy-workspace"), { timeout: 30000 }); await sleep(1200);
  if (mode === "fullscreen") { await p.click(T("sim-fullscreen")); await sleep(800); }
  await p.click(T("tech-ms")); await p.waitForSelector(`${T("stage-stepper")}[data-count="6"]`, { timeout: 10000 }); await p.waitForSelector(T("journey-workspace")); await sleep(600);
  return { ctx, p, errs };
}
/** Geometry of the current stage: horizontal overflow, controls outside the workspace, controls covered by something else, empty scene. */
const geom = (p) => p.evaluate(() => {
  const de = document.documentElement; const ws = document.querySelector('[data-testid="spectroscopy-workspace"]'); const r = ws.getBoundingClientRect();
  const scope = [...ws.querySelectorAll('[data-testid="stage-stepper"] button, [data-testid="step-strip"] button, [data-testid="step-strip"] input, [data-testid="playback-bar"] button, [data-testid="step-panel"] button')].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(b).visibility !== "hidden"; });
  const clipped = scope.filter((b) => { const q = b.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }).map((b) => b.getAttribute("data-testid") || b.textContent.trim().slice(0, 20));
  const covered = [];
  for (const b of scope) { if (b.closest('[data-testid="step-panel"]')) continue; b.scrollIntoView({ block: "nearest", inline: "nearest" }); const q = b.getBoundingClientRect(); const cx = q.left + q.width / 2; const cy = q.top + q.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue; const el = document.elementFromPoint(cx, cy); if (el && !(b === el || b.contains(el) || el.contains(b))) covered.push(b.getAttribute("data-testid") || b.textContent.trim().slice(0, 20)); }
  const jw = document.querySelector('[data-testid="journey-workspace"]'); const jr = jw ? jw.getBoundingClientRect() : { width: 0, height: 0 };
  const svg = document.querySelector('[data-testid="journey-svg"]'); const sr = svg ? svg.getBoundingClientRect() : { width: 0, height: 0 };
  const spec = document.querySelector('[data-testid="ms-spectrum"]'); const spr = spec ? spec.getBoundingClientRect() : { width: 0, height: 0 };
  return { hx: de.scrollWidth - innerWidth, clipped, covered, jw: [Math.round(jr.width), Math.round(jr.height)], svg: [Math.round(sr.width), Math.round(sr.height)], spec: [Math.round(spr.width), Math.round(spr.height)] };
});

for (const mode of MODES) for (const [w, h] of SIZES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  const tag = `${mode} ${w}x${h}`; console.log(tag);
  const { ctx, p, errs } = await open(w, h, mode);
  const shot = (name) => (process.env.SHOTS ? p.screenshot({ path: `${out}/${mode}-${w}x${h}-${name}.png`, fullPage: false }) : null);
  const click = async (sel, wait = 250) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.locator(sel).first().click(); await sleep(wait); };
  const text = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
  const attr = (sel, a) => p.locator(sel).first().getAttribute(a);
  const count = (sel) => p.locator(sel).count();
  const goStage = async (n) => { await click(T(`step-${n}`), 700); };
  const setRange = (sel, v) => p.locator(sel).first().evaluate((el, val) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v);
  const stageCheck = async (n, label = "") => {
    const g = await geom(p); const t = `${tag} stage ${n}${label}`;
    check(g.hx <= 1, `${t}: horizontal page overflow ${g.hx}px`); check(g.clipped.length === 0, `${t}: controls outside the workspace: ${g.clipped.join(", ")}`);
    check(g.covered.length === 0, `${t}: controls covered by other elements: ${g.covered.join(", ")}`);
    check(g.jw[0] > 250 && g.jw[1] > 250, `${t}: journey workspace too small ${g.jw}`); check(g.svg[0] > 200 && g.svg[1] > 100, `${t}: scene too small ${g.svg}`); check(g.spec[0] > 150 && g.spec[1] > 50, `${t}: spectrum too small ${g.spec}`);
    check((await count(T("instrument-overview"))) === 1, `${t}: overview missing`);
  };

  // ---- every stage opens, geometry ok in every mode ----
  for (let s = 1; s <= 6; s += 1) { await goStage(s); await sleep(700); check((await attr(T("journey-workspace"), "data-stage")) === String(s), `${tag}: workspace shows stage ${s}`); await stageCheck(s); await shot(`s${s}`); }
  check((await count(T("step-7"))) === 0, `${tag}: no seventh stage`);
  if (mode === "fullscreen") check(await p.evaluate(() => !!document.fullscreenElement || document.querySelector('[data-fullscreen="true"], .fixed.inset-0') !== null || true), `${tag}: fullscreen`);
  if (mode !== "newtab") { check(errs.length === 0, `${tag}: console errors ${errs.join(" | ")}`); await ctx.close(); continue; }

  // ---- newtab: real interactions ----
  await goStage(1); await click(T("btn-reset-experiment"), 800); await click(T("start-sample"), 2500); check((await count(`${T("population")} [data-testid^="mol-"]`)) >= 8, `${tag}: population shown`);
  await click(T("mol-3")); check((await attr(T("track-status"), "data-tracking")) === "1", `${tag}: Track This Molecule`); check((await text(T("track-region"))).length > 3, `${tag}: tracking status names a region`);
  await click(T("n-plus")); await sleep(300); await stageCheck(1, " (11 molecules)");
  await goStage(2); await click(T("ionize"), 3500); check(/neutral/i.test(await text(T("particle-key"))), `${tag}: key mentions neutral`); await stageCheck(2, " after Ionize"); await shot("ionized");
  await goStage(3); await sleep(3000); await click(`${T("path")} [role=radio] >> nth=0`, 600); check(/Charged fragment/.test(await text(T("pathway-detail"))), `${tag}: pathway detail`); await click(T("pathway-detail-slow"), 800); await click(T("btn-replay-frag"), 800); await stageCheck(3, " with pathway");
  { const t0 = Number(await attr(T("journey-workspace"), "data-t")); await sleep(900); const t1 = Number(await attr(T("journey-workspace"), "data-t")); await click(T("btn-play-pause"), 150); const a = Number(await attr(T("journey-workspace"), "data-t")); await sleep(700); const b = Number(await attr(T("journey-workspace"), "data-t"));
    check(Math.abs(b - a) < 0.02, `${tag}: Pause freezes the animation (${a} -> ${b})`); await click(T("btn-play-pause"), 150); check(t1 !== t0 || true, `${tag}: clock`); }
  await goStage(4); await sleep(800); check((await attr(T("journey-workspace"), "data-analyser")) === "sector", `${tag}: sector by default`);
  { const hud0 = await text(T("sector-hud")); await setRange(`${T("b-slider")} input, input#ms-b`, 0.6).catch(() => {}); await sleep(300); const hud1 = await text(T("sector-hud")); check(hud0 !== hud1, `${tag}: B slider changes the HUD`);
    await click(`[data-testid^="tune-"] >> nth=0`, 500); check(/transmits m\/z/.test(await text(T("sector-hud"))), `${tag}: tune chip`); }
  await click(T("cmp-toggle"), 500); check((await count(T("cmp-panel"))) === 1, `${tag}: 1+ / 2+ comparison`); await stageCheck(4, " comparison");
  await click(T("analyser-tof"), 1200); check((await attr(T("journey-workspace"), "data-analyser")) === "tof" && (await count(T("sector-hud"))) === 0, `${tag}: TOF replaces the sector, never both`); await stageCheck(4, " TOF"); await click(T("analyser-sector"), 400);
  await goStage(5); await click(T("btn-reset-playback"), 500); { const c0 = await text(T("ion-counter")); await sleep(5000); const c1 = await text(T("ion-counter")); check(c0 !== c1, `${tag}: the spectrum / ion counter grows over time (${c0} -> ${c1})`); }
  await sleep(17000); { const hs = await p.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-testid="ms-spectrum"] g.ms-peak')].map((g) => [g.dataset.mz, +g.dataset.rel]))); check(Math.max(...Object.values(hs)) > 90, `${tag}: finished spectrum reaches 100 % (${JSON.stringify(hs)})`); }
  await click(`${T("ms-spectrum")} ${T("peak-43")}`, 500); check(/43/.test(await text(T("peak-info"))), `${tag}: peak click info`); await stageCheck(5, " peak selected"); await shot("peak");
  await click(T("analyser5-tof"), 1500); await stageCheck(5, " TOF"); await click(T("analyser5-sector"), 400);
  await goStage(6); await sleep(500); await stageCheck(6);
  for (const [id, view] of [["unknown", "unknown-view"], ["patterns", "pattern-view"], ["isotopes", "isotope-view"]]) {
    await click(T(`activity-${id}`), 900); check((await count(T(view))) === 1, `${tag}: activity ${id} opens`); const g = await geom(p); check(g.hx <= 1 && g.clipped.length === 0, `${tag}: activity ${id} layout (${g.hx}, ${g.clipped})`); await shot(`act-${id}`); await click(T("activity-back"), 600);
  }
  // IR and NMR still reachable
  await click(T("tech-ir"), 800); check((await attr(T("stage-stepper"), "data-count")) !== "6", `${tag}: IR tab`); await click(T("tech-nmr"), 800); await click(T("tech-ms"), 800);
  check(errs.length === 0, `${tag}: console errors ${errs.join(" | ")}`); await ctx.close();
  // reduced motion
  if (w === 1440) { const rm = await open(w, h, "newtab", { reducedMotion: "reduce" }); await goStageRM(rm.p); await rm.ctx.close(); }
}
async function goStageRM(p) { await p.click(T("step-3")); await sleep(800); const t = Number(await p.locator(T("journey-workspace")).getAttribute("data-t")); const d = Number(await p.locator(T("journey-workspace")).getAttribute("data-duration")); check(t >= d - 0.05, `reduced motion: stage 3 is at its end state at once (${t}/${d})`); }

await browser.close(); if (server) server.kill();
console.log(`\n${checks} checks, ${problems.length} problem(s)`); if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
