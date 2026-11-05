// Headless-Chromium verification of the IR Spectroscopy workspace (the IR tab of the Spectroscopy Simulation Lab).
// Usage: node scripts/verify-ir-spectroscopy.mjs [baseUrl] [outDir]      Route: /simulation/spectroscopy-studio  (IR tab)
// Without a baseUrl the app is built into a temp directory and served by `vite preview` on a free port (stopped at the end).
// Environment: SIZES=1366x768,390x844 limits the viewports; CHROMIUM overrides the browser path.
//
// It walks ALL nine stages at the five reference viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844) with real interactions
// (molecule / mode choices, the wavenumber slider incl. the CO2 symmetric stretch case, every FTIR part, the spectrum build-up and band clicks,
// every functional-group row, band picking and feedback, the unknown-compound clues), and checks: no horizontal overflow, one screen on desktop sizes,
// no clipped controls or SVG text, the molecule really animates (pixel difference between frames) and Pause freezes it, the spectrum really changes,
// no leaked WebGL contexts over repeated stage changes, reduced motion, NMR still reachable, and no console errors. Screenshots go to outDir.
// Honest limits: software GL (SwiftShader), synthetic mouse and keyboard events only; no real GPU, no real touch hardware, Chromium only, no assistive technology.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { COMPOUNDS } from "../src/engines/spectroscopy-studio/ir/data/compounds.js";
import { SPEC_GROUPS } from "../src/engines/spectroscopy-studio/ir/physics/functionalGroups.js";
import { makeRound, evaluateRound } from "../src/engines/spectroscopy-studio/ir/physics/challenge.js";

async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2]; let dist = null;
if (!base) {
  const cwd = new URL("..", import.meta.url).pathname; dist = `${process.env.TMPDIR || "/tmp"}/ir-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/ir-verify";
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
  await p.click(T("tech-ir")); await p.waitForSelector(`${T("stage-stepper")}[data-count="9"]`, { timeout: 10000 }); await sleep(800);
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
      const vr = viz.getBoundingClientRect(); const out = [...viz.querySelectorAll("[data-testid='mol-stage'], .ir-plotbox, .ir-ftirwrap")].filter((e) => { const q = e.getBoundingClientRect(); return q.right > vr.right + 2 || q.bottom > vr.bottom + 2; }).length;
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
    if (expectMove) check(d > minMove, `${tag} ${label}: the animation does not move (pixel change ${(d * 100).toFixed(3)}%)`); else check(d < 0.0001, `${tag} ${label}: should be static (pixel change ${(d * 100).toFixed(3)}%)`);
    return d;
  };
  const fr = (o, k) => o[k] / o.total;

  // ---------- structure ----------
  check((await count(`${T("stage-stepper")} li`)) === 9, `${tag}: the IR stepper does not have nine stages`);
  check((await attr(T("step-1"), "aria-current")) === "step" && (await p.locator(T("step-prev")).isDisabled()), `${tag}: stage 1 is not the initial stage with Previous disabled`);
  check(/IR Spectroscopy · stage 1 of 9/.test(await text(".sd-subtitle")), `${tag}: header subtitle`);
  check((await count(T("dev-ir"))) === 0, `${tag}: the IR tab still shows the placeholder`);

  // ---------- stage 1: HCl, H2O, CO2 ----------
  await geom("stage 1");
  check((await canvases()) === 1, `${tag}: stage 1 should have exactly one WebGL canvas (has ${await canvases()})`);
  check((await attr(T("mol-stage"), "data-mol")) === "hcl" && (await attr(T("mol-stage"), "data-webgl")) === "1", `${tag}: stage 1 starts with HCl in 3D`);
  await sleep(900); await shot("s1-hcl");
  const c1 = await census(T("mol-stage")); check(fr(c1, "bright") > 0.004 && fr(c1, "green") > 0.003, `${tag}: HCl spheres not rendered (bright ${c1.bright}, green ${c1.green})`);
  await motion(T("mol-stage"), "stage 1 HCl vibration");
  await p.click(T("btn-play-pause")); await sleep(500); await motion(T("mol-stage"), "stage 1 paused", false); await p.click(T("btn-play-pause")); await sleep(300);
  await click(T("s1-mol-h2o"), 600); await shot("s1-h2o"); check((await attr(T("mol-stage"), "data-mol")) === "h2o", `${tag}: H2O not shown`); await motion(T("mol-stage"), "stage 1 H2O vibration");
  await click(T("s1-mol-co2"), 600); check((await attr(T("mol-stage"), "data-mol")) === "co2", `${tag}: CO2 not shown`); await motion(T("mol-stage"), "stage 1 CO2 vibration"); await shot("s1-co2");
  check((await canvases()) === 1, `${tag}: stage 1 canvases after molecule switches: ${await canvases()}`);
  { const cl = await clippedText(T("levels-inset")); check(cl.length === 0, `${tag}: stage 1 level-diagram text clipped: ${cl.join(" | ")}`); }
  await click(T("s1-mol-hcl"));

  // ---------- stage 2: types of vibration ----------
  await goStage(2); await geom("stage 2"); check((await canvases()) === 1, `${tag}: stage 2 canvases ${await canvases()}`);
  const types = {};
  for (const type of ["sym", "asym", "bend"]) { await click(T(`s2-type-${type}`), 600); types[type] = await grab(T("mol-stage")); await motion(T("mol-stage"), `stage 2 H2O ${type}`); }
  await shot("s2-h2o-bend");
  await click(T("s2-mol-co2"), 600); await click(T("s2-type-sym"), 500); await motion(T("mol-stage"), "stage 2 CO2 sym"); await click(T("s2-type-bend"), 500); await shot("s2-co2-bend");
  check(/667/.test(await text(T("vib-caption"))), `${tag}: CO2 bend wavenumber missing`);

  // ---------- stage 3: IR radiation ----------
  await goStage(3); await geom("stage 3"); check((await canvases()) === 1, `${tag}: stage 3 canvases ${await canvases()}`);
  await click(T("s3-mol-hcl"), 400);
  await setRange("input[type=range]", 4400 - 3400); await sleep(500); check((await attr(T("absorb-view"), "data-state")) === "off", `${tag}: stage 3 off-resonance state`);
  await motion(`${T("absorb-view")} .ir-wavepane`, "stage 3 IR wave"); await shot("s3-off");
  await setRange("input[type=range]", 4400 - 2886); await sleep(600); check((await attr(T("absorb-view"), "data-state")) === "absorbed" && /absorbed/i.test(await text(T("absorb-head"))), `${tag}: stage 3 resonance state`); await shot("s3-on");
  check((await count(T("level-v1"))) === 1, `${tag}: levels missing`);
  { const cl = await clippedText(T("levels-pane")); check(cl.length === 0, `${tag}: stage 3 ladder text clipped: ${cl.join(" | ")}`); }
  await motion(T("levels-pane"), "stage 3 level transition", true);
  await click(T("s3-mol-co2"), 400); await click(T("s3-mode-sym"), 400); await setRange("input[type=range]", 4400 - 1388); await sleep(600);
  check((await attr(T("absorb-view"), "data-state")) === "match-inactive" && /no dipole change/i.test(await text(T("absorb-head"))), `${tag}: stage 3 CO2 symmetric stretch must say frequency matches but no dipole change`); await shot("s3-co2-sym");
  check(/inactive/i.test(await text(T("s3-activity"))), `${tag}: CO2 sym activity pill`);
  await click(T("s3-mode-asym"), 300); await setRange("input[type=range]", 4400 - 2349); await sleep(500); check((await attr(T("absorb-view"), "data-state")) === "absorbed", `${tag}: CO2 asymmetric stretch should absorb`);

  // ---------- stage 4: explorer ----------
  await goStage(4); await geom("stage 4"); check((await canvases()) === 1, `${tag}: stage 4 canvases ${await canvases()}`);
  for (const mol of ["h2o", "co2", "hcl", "ch4", "ethanol"]) {
    await click(T(`s4-mol-${mol}`), 700); check((await attr(T("mol-stage"), "data-mol")) === mol, `${tag}: stage 4 ${mol} not shown`);
    const modes = p.locator(`${T("s4-mode")} button`); const n = await modes.count();
    for (let i = 0; i < n; i += 1) { await modes.nth(i).click(); await sleep(250); check(/IR (in)?active/.test(await text(T("activity-pill"))), `${tag}: ${mol} mode ${i} has no IR active/inactive label`); }
    await click(`${T("s4-mode")} button >> nth=0`, 500); await motion(T("mol-stage"), `stage 4 ${mol}`); await shot(`s4-${mol}`);
    if (mol === "ethanol") check(/simplified normal-mode representation/i.test(await text(T("simplified-note"))), `${tag}: ethanol is not labelled simplified`);
  }
  await click(T("s4-mol-co2"), 500); await click(T("s4-mode-sym"), 600); check((await attr(T("activity-pill"), "data-active")) === "0", `${tag}: CO2 sym stretch must be IR inactive`); await shot("s4-co2-sym");
  check((await canvases()) === 1, `${tag}: stage 4 canvases after many switches: ${await canvases()}`);
  for (let i = 0; i < 6; i += 1) { await goStage(1); await goStage(4); }
  check((await canvases()) === 1, `${tag}: WebGL canvases after 6 round trips between stages 1 and 4: ${await canvases()}`);

  // ---------- stage 5: FTIR ----------
  await goStage(5); await geom("stage 5"); check((await canvases()) === 0, `${tag}: stage 5 should have no WebGL canvas (has ${await canvases()})`);
  check(/does not scan one frequency at a time/i.test(await text(T("ftir-statement"))), `${tag}: FTIR statement missing`);
  for (let i = 0; i < 6; i += 1) {
    await click(T(`op-dot-${i}`), i === 3 ? 2500 : 900); check((await attr(T("ftir-view"), "data-op")) === String(i), `${tag}: FTIR part ${i}`);
    { const cl = await clippedText(T("ftir-view")); check(cl.length === 0 || w < 700, `${tag}: FTIR part ${i} text clipped: ${cl.join(" | ")}`); }
    if (i <= 3) await motion(T("ftir-view"), `FTIR part ${i}`, true, 0.0003); await shot(`s5-op${i}`);
  }
  check(await waitFor(async () => (await count(T("spectrum-trace"))) === 1, 8000), `${tag}: the final IR spectrum is not drawn in part 6`);
  await click(T("op-dot-3"), 3500); check((await count(T("interferogram-trace"))) === 1, `${tag}: no interferogram trace`);
  await click(T("op-dot-0"), 300); await click(T("next-stage"), 400); check((await attr(T("ftir-view"), "data-op")) === "1", `${tag}: Next Stage`);

  // ---------- stage 6: building a spectrum ----------
  await goStage(6); await geom("stage 6"); check((await canvases()) === 1, `${tag}: stage 6 canvases ${await canvases()}`);
  check((await attr(T("ir-spectrum"), "data-xleft")) === "4000" && (await attr(T("ir-spectrum"), "data-xright")) === "400" && (await attr(T("ir-spectrum"), "data-ytop")) === "100", `${tag}: stage 6 axis orientation`);
  { const b0 = await grab(`${T("ir-spectrum-box")}`); await sleep(2600); const b1 = await grab(`${T("ir-spectrum-box")}`); check((await diff(b0, b1)) > 0.0008, `${tag}: stage 6 spectrum does not change while the bands build up`); }
  await shot("s6-building");
  check(await waitFor(async () => (await attr(T("build-view"), "data-finished")) === "1", 14000), `${tag}: stage 6 did not finish building`); await sleep(300);
  check((await attr(T("build-view"), "data-bands")) === "3", `${tag}: H2O should end with 3 bands`); await shot("s6-water");
  { const cl = await clippedText(T("ir-spectrum")); check(cl.length === 0, `${tag}: stage 6 spectrum text clipped: ${cl.join(" | ")}`); }
  await click(`${T("ir-spectrum")} [data-testid='band-1']`, 500); await motion(T("mol-stage"), "stage 6 selected band vibration");
  await click(T("s6-mol-co2"), 800); await click(T("s6-mode-sym"), 700);
  check(/none \(IR inactive\)/.test(await text(T("sync-abs"))) && /no band/.test(await text(T("sync-band"))), `${tag}: stage 6 CO2 sym must show no absorption and no band`); await shot("s6-co2-sym");
  await click(T("s6-mode-asym"), 700); check(/band appears/.test(await text(T("sync-band"))), `${tag}: stage 6 CO2 asym must show a band`);
  await p.focus(`${T("ir-spectrum")} [data-testid='band-0']`).catch(() => {});

  // ---------- stage 7: functional groups ----------
  await goStage(7); await geom("stage 7"); check((await canvases()) === 1, `${tag}: stage 7 canvases ${await canvases()}`);
  const spec = { "oh-alc": "3200–3600, broad", "oh-acid": "2500–3300, very broad", nh: "3300–3500", ch: "2850–3000", cn: "2210–2260", cdo: "1650–1750", cdc: "1620–1680" };
  for (const [id, r] of Object.entries(spec)) check((await text(T(`range-${id}`))) === r, `${tag}: stage 7 table row ${id} is "${await text(T(`range-${id}`))}", expected "${r}"`);
  check(/representative/i.test(await text(T("range-caveat"))), `${tag}: stage 7 caveat`);
  let prev = await grab(T("ir-spectrum-box"));
  for (const g of SPEC_GROUPS) {
    await click(T(`row-${g.id}`), 700); check((await attr(T("groups-view"), "data-group")) === g.id, `${tag}: stage 7 ${g.id} selection`);
    check((await attr(T("mol-stage"), "data-highlight")).length > 0, `${tag}: stage 7 ${g.id}: no group highlighted`); await motion(T("mol-stage"), `stage 7 ${g.id} vibration`);
    const now = await grab(T("ir-spectrum-box")); check((await diff(prev, now)) > 0.0005, `${tag}: stage 7 ${g.id}: the spectrum map does not highlight the range`); prev = now;
    if (["oh-alc", "cdo", "oh-acid"].includes(g.id)) await shot(`s7-${g.id}`);
  }
  { const cl = await clippedText(T("ir-spectrum")); check(cl.length === 0, `${tag}: stage 7 map text clipped: ${cl.join(" | ")}`); }
  await click(`${T("ir-spectrum")} [data-testid='curve-hit-cdc']`, 600); check((await attr(T("groups-view"), "data-group")) === "cdc", `${tag}: stage 7 clicking a band in the map selects the group`);

  // ---------- stage 8: guided interpretation ----------
  await goStage(8); await geom("stage 8"); check((await canvases()) === 1, `${tag}: stage 8 canvases ${await canvases()}`);
  for (const id of ["ethanol", "ethanal", "propanone", "ethanoic-acid", "ethyl-ethanoate"]) {
    await click(T(`s8-compound-${id}`), 700); check((await attr(T("interp-view"), "data-compound")) === id, `${tag}: stage 8 ${id}`);
    check((await count(`${T("ir-spectrum")} [role=button]`)) === COMPOUNDS[id].bands.length, `${tag}: stage 8 ${id}: clickable bands`);
    const cl = await clippedText(T("ir-spectrum")); check(cl.length === 0, `${tag}: stage 8 ${id} text clipped: ${cl.join(" | ")}`);
  }
  check(/not an experimental spectrum/i.test(await text(T("interp-caption"))), `${tag}: stage 8 representative label`);
  await click(T("s8-compound-propanone"), 700); const bi = COMPOUNDS.propanone.bands.findIndex((b) => b.group === "cdo");
  await p.locator(`${T("ir-spectrum")} [data-testid='band-${bi}']`).focus(); await p.keyboard.press("Enter"); await sleep(500);
  check((await count(T("s8-picks"))) === 1, `${tag}: stage 8 keyboard activation of a band shows the group choices`); await shot("s8-band");
  await click(T("pick-cdo"), 800); check((await attr(T("s8-feedback"), "data-correct")) === "1", `${tag}: stage 8 correct pick`); check((await attr(T("mol-stage"), "data-highlight")).length > 0, `${tag}: stage 8 no group highlight after answering`); await motion(T("mol-stage"), "stage 8 group vibration"); await shot("s8-answered");
  { const a = await grab(T("ir-spectrum-box")); await click(T("fingerprint-toggle"), 500); check((await count(T("fingerprint-shade"))) === 1 && (await diff(a, await grab(T("ir-spectrum-box")))) > 0.002, `${tag}: stage 8 fingerprint region not shaded`); await shot("s8-fingerprint"); await click(T("fingerprint-toggle")); }
  await click(T("s8-compound-ethanol"), 600); await click(`${T("ir-spectrum")} [data-testid='band-0']`, 400); await click(T("pick-nh"), 400); check((await attr(T("s8-feedback"), "data-correct")) === "0", `${tag}: stage 8 wrong pick feedback`);

  // ---------- stage 9: unknown compound ----------
  await goStage(9); await geom("stage 9"); check((await canvases()) === 1, `${tag}: stage 9 canvases ${await canvases()}`);
  const rd = makeRound(1, 0); const ev = evaluateRound(rd); const n9 = await count(`${T("candidates")} [role=radio]`); check(n9 >= 3 && n9 <= 4, `${tag}: stage 9 candidates ${n9}`);
  { const html = await p.evaluate(() => document.querySelector('[data-testid="step-panel"]').innerText + document.querySelector('[data-testid="step-viz"]').innerHTML); check(!/Most consistent|less suitable|data-correct/.test(html), `${tag}: stage 9 leaks the verdict before the clues`); }
  await p.locator(T("ir-spectrum")).hover({ position: { x: 200, y: 80 } }); await sleep(200); check(/cm⁻¹ · T ≈/.test(await text(`${T("ir-spectrum-box")} .ir-plothint`)), `${tag}: stage 9 cursor readout`);
  await shot("s9-start");
  const wrong = rd.candidates.find((c) => c !== ev.best); await click(T(`cand-${wrong}`), 500);
  for (let k = 1; k <= 3; k += 1) { await click(T("reveal-next"), 500); check((await count(T(`clue-${k}`))) === 1 && (await count(T(`clue-${k + 1}`))) === 0, `${tag}: stage 9 clue ${k} progression`); }
  check(new RegExp(`Most consistent: ${COMPOUNDS[ev.best].name}`).test(await text(T("clue-3"))) && (await attr(T("clue-3"), "data-correct")) === "0", `${tag}: stage 9 verdict`);
  await geom("stage 9 clues", true); await shot("s9-clues");
  await click(T("next-unknown"), 500); check((await attr(T("unknown-view"), "data-round")) === "1" && (await count(T("clue-1"))) === 0, `${tag}: stage 9 next unknown`);

  // ---------- keeping state, NMR still there, leak check, reduced motion ----------
  await goStage(7); await click(T("row-nh"), 300); await p.click(T("tech-nmr")); await p.waitForSelector(`${T("stage-stepper")}[data-count="6"]`, { timeout: 8000 }); await sleep(900);
  check((await count(`${T("stage-stepper")} li`)) === 6 && /¹H NMR · step/.test(await text(".sd-subtitle")), `${tag}: NMR tab broken after IR`); await shot("nmr-after-ir");
  await p.click(T("tech-ir")); await p.waitForSelector(`${T("stage-stepper")}[data-count="9"]`); await sleep(600);
  check((await attr(T("step-7"), "aria-current")) === "step" && (await attr(T("groups-view"), "data-group")) === "nh", `${tag}: IR experiment not restored after visiting NMR`);
  for (let i = 0; i < 5; i += 1) { await goStage(6); await goStage(8); await goStage(9); }
  check((await canvases()) === 1, `${tag}: WebGL canvases after many stage changes: ${await canvases()}`);
  await goStage(1); await p.click(T("btn-reset-playback")); await sleep(300);
  await p.click(".sd-btn:has-text('Reset')"); await sleep(400); check((await attr(T("step-1"), "aria-current")) === "step", `${tag}: Reset kept the stage`);

  check(errs.length === 0, `${tag}: console errors: ${[...new Set(errs)].join(" | ")}`);
  await ctx.close();

  if (w === 1366 || w === 390) {
    const rm = await open(w, h, { reducedMotion: "reduce" });
    const mot = async (sel) => { const a = await rm.p.locator(sel).first().screenshot(); await sleep(400); const b = await rm.p.locator(sel).first().screenshot(); return a.equals(b); };
    await rm.p.click(T("step-1")); await sleep(900);
    check(await mot(T("mol-stage")), `${tag}: reduced motion: stage 1 molecule should be a static pose`); check(/2\s?886/.test((await rm.p.locator(T("vib-caption")).innerText()).replace(/\s+/g, " ")), `${tag}: reduced motion: stage 1 keeps its caption`);
    check((await rm.p.locator("canvas").count()) === 1, `${tag}: reduced motion keeps the 3D molecule`); await rm.p.screenshot({ path: `${out}/${tag}-reduced-s1.png` });
    check(rm.errs.length === 0, `${tag}: reduced-motion console errors: ${rm.errs.join(" | ")}`);
    await rm.ctx.close();
  }
}

await browser.close();
if (server) server.kill();
if (dist) fs.rmSync(dist, { recursive: true, force: true });
console.log(`\n${checks} checks, ${problems.length} problem(s)`);
if (problems.length) { console.log(problems.map((x) => `  - ${x}`).join("\n")); process.exit(1); }
