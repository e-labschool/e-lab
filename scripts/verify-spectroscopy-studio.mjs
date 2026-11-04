// Headless-Chromium verification of the single-workspace Spectroscopy Simulation Lab.
// Usage: node scripts/verify-spectroscopy-studio.mjs [baseUrl] [outDir]      Route: /simulation/spectroscopy-studio
// Without a baseUrl the app is built into a temp directory and served by `vite preview` on a free port (stopped at the end); a build is used
// instead of the dev server so that concurrent source edits (HMR full reloads) cannot reset the page mid-run.
// Environment: SIZES=1366x768,390x844 limits the viewports; CHROMIUM overrides the browser path.
//
// It walks ALL six steps at the five reference viewports (1366x768, 1440x900, 1920x1080, 820x1180, 390x844) and checks the behaviours the
// refactor promises: the proton sample, Apply B0 and the field slider, the RF slider through resonance, every Next Stage of the instrument,
// Transform to Spectrum and back, molecule selection, clicking an H, environments / chemical shift / integration / coupling for two
// molecules, direct step jumps that keep the molecule and B0, Previous / Next, hide / show of the tab, reduced motion, and the absence
// of overflow and console errors. Screenshots go to outDir and are meant to be LOOKED at.
// Honest limits: software GL (SwiftShader), synthetic mouse and keyboard events only; no real GPU, no real touch hardware, Chromium only,
// no assistive technology.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { getMolecule } from "../src/engines/spectroscopy-studio/nmr/molecular/model/molecules.js";
import { buildSignals, pascalText, simplestRatio } from "../src/engines/spectroscopy-studio/nmr/molecular/model/spectrum.js";
import { larmorMHz } from "../src/engines/spectroscopy-studio/nmr/physics/constants.js";

async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2]; let dist = null;
if (!base) {
  const cwd = new URL("..", import.meta.url).pathname; dist = `${process.env.TMPDIR || "/tmp"}/ss-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/spectroscopy-verify";
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
  await p.waitForSelector(T("spectroscopy-workspace"), { timeout: 30000 }); await sleep(2000);
  return { ctx, p, errs };
}

for (const [w, h] of SIZES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  const tag = `${w}x${h}`; console.log(tag);
  const { ctx, p, errs } = await open(w, h);
  const shot = (name) => p.screenshot({ path: `${out}/${tag}-${name}.png` });
  const text = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
  const attr = async (sel, a) => p.locator(sel).first().getAttribute(a);
  const setRange = (sel, v) => p.locator(sel).first().evaluate((el, val) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); d.set.call(el, String(val)); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); }, v);
  const goStep = async (n) => { await p.click(T(`step-${n}`)); await sleep(500); };
  const waitFor = async (fn, ms = 7000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { try { if (await fn()) return true; } catch { /* retry */ } await sleep(150); } return false; };
  const geom = async (label) => {
    const m = await p.evaluate(() => {
      const de = document.documentElement; const ws = document.querySelector('[data-testid="spectroscopy-workspace"]'); const r = ws.getBoundingClientRect();
      const clipped = [...ws.querySelectorAll("button, [role=tab], [role=radio]")].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 1 || q.left < r.left - 1); }).length;
      const panel = document.querySelector('[data-testid="step-panel"]');
      return { hx: de.scrollWidth - innerWidth, vy: de.scrollHeight - innerHeight, wsw: ws.scrollWidth - ws.clientWidth, wsy: ws.scrollHeight - ws.clientHeight, clipped, panelScroll: panel ? panel.scrollHeight - panel.clientHeight : 0, layout: ws.getAttribute("data-layout") };
    });
    check(m.hx <= 1, `${tag} ${label}: horizontal page overflow ${m.hx}px`);
    check(m.wsw <= 1, `${tag} ${label}: horizontal overflow inside the workspace ${m.wsw}px`);
    check(m.clipped === 0, `${tag} ${label}: ${m.clipped} controls clipped outside the workspace`);
    if (w >= 1280) {
      check(m.vy <= 1, `${tag} ${label}: vertical page scroll ${m.vy}px on a desktop size`);
      check(m.wsy <= 2, `${tag} ${label}: the workspace scrolls inside itself by ${m.wsy}px on a desktop size (should fit one screen)`);
      if (m.panelScroll > 2) console.log(`  note: ${label}: explanation panel scrolls by ${m.panelScroll}px at ${tag}`);
    } else check(m.layout === "stacked", `${tag} ${label}: expected the stacked layout, got ${m.layout}`);
    return m;
  };

  // ---------- structure: technique tabs, stepper, one workspace (no Splitting Patterns tab) ----------
  check((await p.locator(T("technique-tabs")).locator("button").allInnerTexts()).map((s) => s.trim()).join("|").replace(/\s+/g, " ").match(/Mass.*IR.*NMR.*Structure/) !== null, `${tag}: technique tabs are not Mass Spec | IR | NMR | Structure Investigation`);
  check((await p.locator(T("tech-splitting")).count()) === 0, `${tag}: the Splitting Patterns tab still exists`);
  check((await p.locator(`${T("stage-stepper")} li`).count()) === 6, `${tag}: the stepper does not have six steps`);
  check((await attr(T("step-1"), "aria-current")) === "step", `${tag}: step 1 is not the initial step`);

  // ---------- step 1: the nucleus and the sample ----------
  await goStep(1); await geom("step 1");
  check((await p.locator(T("step-title")).innerText()).includes("Hydrogen Nucleus"), `${tag}: step 1 title`);
  await sleep(1200); await shot("s1-nucleus");
  await p.click(T("show-sample"));
  check(await waitFor(async () => Number(await attr(T("sample-state"), "data-progress")) > 0.97, 8000), `${tag}: the proton-sample transition did not complete`);
  check((await text(T("concept-badge"))).toLowerCase().includes("conceptual"), `${tag}: step 1 sample is not labelled conceptual`);
  check(/no preferred orientation/i.test(await text(T("step-panel"))), `${tag}: step 1 does not say there is no preferred orientation`);
  await shot("s1-sample");
  await p.click(T("show-single")); check(await waitFor(async () => Number(await attr(T("sample-state"), "data-progress")) < 0.05, 8000), `${tag}: could not go back to a single nucleus`);

  // ---------- step 2: split view, Apply B0, ONE slider ----------
  await goStep(2); await geom("step 2");
  check((await attr(T("levels-diagram"), "data-p")) === "0.00" || Number(await attr(T("levels-diagram"), "data-p")) < 0.05, `${tag}: step 2 should start with degenerate levels`);
  check((await p.locator(T("level-degenerate")).count()) === 1, `${tag}: zero-field levels are not drawn degenerate`);
  await shot("s2-before");
  await p.click(T("apply-field"));
  check(await waitFor(async () => Number(await attr(T("levels-diagram"), "data-p")) > 0.97, 9000), `${tag}: Apply B0 animation did not complete`);
  const gap94 = Number(await attr(T("levels-diagram"), "data-gap"));
  check(gap94 > 20 && (await p.locator(T("level-alpha")).count()) === 1 && (await p.locator(T("level-beta")).count()) === 1, `${tag}: levels did not split (gap ${gap94})`);
  const lvText = await p.locator(T("levels-diagram")).evaluate((el) => el.textContent);
  check(/α/.test(lvText) && /β/.test(lvText) && /ΔE/.test(lvText) && /B₀/.test(lvText), `${tag}: level labels (alpha, beta, dE, B0) are missing`);
  await sleep(500); await shot("s2-applied");
  const dd = (id) => text(`${T(`readout-${id}`)} dd`);
  const dEBefore = await dd("dE"); const nuBefore = await dd("nu0"); const exBefore = await dd("excess");
  check(/400\.2 MHz/.test(nuBefore), `${tag}: nu0 at 9.4 T should read 400.2 MHz, got ${nuBefore}`);
  check(/^\s*32 per million|32 per million/.test(exBefore), `${tag}: excess at 9.4 T should be 32 per million, got ${exBefore}`);
  await setRange(T("b0-slider"), 12); await sleep(500);
  const nu12 = await dd("nu0"); const dE12 = await dd("dE"); const b012 = await dd("b0");
  check(/510\.9 MHz/.test(nu12), `${tag}: nu0 at 12 T should read 510.9 MHz, got ${nu12}`);
  check(dE12 !== dEBefore && /12\.0 T/.test(b012), `${tag}: dE / B0 readouts did not follow the slider (${dEBefore} -> ${dE12}, ${b012})`);
  check((await text(T("what-is-happening"))).includes("510.9 MHz") && (await text(T("what-is-happening"))).includes(dE12.replace(/\s+/g, " ").replace(/ J$/, "")), `${tag}: the explanation text does not agree with the slider readouts`);
  check(Number(await attr(T("levels-diagram"), "data-gap")) > gap94, `${tag}: the level gap did not grow with B0 (${gap94} -> ${await attr(T("levels-diagram"), "data-gap")})`);
  check((await text(T("b0-slider-value"))).includes("12.0 T"), `${tag}: slider badge`);
  await shot("s2-12T");
  await p.click(T("pop-toggle")); await sleep(500);
  check((await text(T("teaching-badge"))).toLowerCase().includes("exaggerated") && /real excess/i.test(await text(T("teaching-badge"))), `${tag}: the exaggeration is not labelled`);
  await shot("s2-exaggerated"); await p.click(T("pop-toggle")); await sleep(300);

  // ---------- step 3: RF slider through resonance (B0 = 12 T carried over from step 2) ----------
  await goStep(3); await geom("step 3");
  check((await text(`${T("readout-nu0")} dd`)).includes("510.9"), `${tag}: B0 / nu0 from step 2 did not carry into step 3 (${await text(`${T("readout-nu0")} dd`)})`);
  check((await text(T("cw-label"))).includes("Simplified continuous-wave model (introductory)"), `${tag}: CW model label missing`);
  check(/pulses? plus a\s+Fourier transform|pulses.*Fourier transform/i.test(await text(T("pulse-note"))), `${tag}: the pulse + Fourier transform note is missing`);
  const rf = p.locator(T("rf-slider")); const rmin = Number(await rf.getAttribute("min")); const rmax = Number(await rf.getAttribute("max"));
  check(rmin === -100 && rmax === 100 && Number(await rf.inputValue()) === 40, `${tag}: RF slider should span nu0 +-100 Hz starting at +40 (got ${rmin}..${rmax}, ${await rf.inputValue()})`);
  await sleep(600); await shot("s3-off");
  check((await attr(T("cw-overlay"), "data-on-resonance")) === "0", `${tag}: +40 Hz should be off resonance`);
  const ys = []; const dots = [];
  for (const off of [-100, -60, -30, -10, 0, 10, 30, 60, 100]) {
    await setRange(T("rf-slider"), off); await sleep(120);
    ys.push(Number(await attr(T("cw-dot"), "data-y"))); dots.push([off, Number((await p.locator(T("cw-dot")).evaluate((el) => el.getAttribute("cy"))))]);
  }
  check(Math.abs(ys[4] - 1) < 1e-3 && ys.every((y, i) => i === 4 || y < ys[4]), `${tag}: the response does not peak at resonance (${ys.map((y) => y.toFixed(2)).join(",")})`);
  check(ys[0] < ys[1] && ys[1] < ys[2] && ys[2] < ys[3] && ys[3] < ys[4] && ys[4] > ys[5] && ys[5] > ys[6] && ys[6] > ys[7] && ys[7] > ys[8], `${tag}: the response is not monotonic towards resonance`);
  const cyPeak = dots[4][1]; check(dots.every(([o, cy]) => o === 0 || cy > cyPeak), `${tag}: the dot is not highest at resonance`);
  await setRange(T("rf-slider"), 0); await sleep(700);
  check((await attr(T("cw-overlay"), "data-on-resonance")) === "1" && (await attr(T("rf-view"), "data-on-resonance")) === "1", `${tag}: resonance not highlighted at offset 0`);
  check(/hν_rf = ΔE/.test(await text(T("what-is-happening"))) && /in step/.test(await text(T("what-is-happening"))), `${tag}: on-resonance text does not show h nu = dE`);
  check((await p.locator(T("cw-resonance-band")).count()) === 1, `${tag}: the resonance band is missing`);
  await shot("s3-resonance");
  await setRange(T("rf-slider"), 70); await sleep(400); check((await attr(T("cw-overlay"), "data-on-resonance")) === "0", `${tag}: +70 Hz should be off resonance`);
  await setRange(T("rf-slider"), 0);

  // ---------- step 4: the instrument, Next Stage through every operation ----------
  await goStep(4); await geom("step 4");
  check((await text(T("instrument-label"))).toLowerCase().includes("illustrative instrument model"), `${tag}: instrument label missing`);
  const wantParts = ["Sample tube", "Superconducting magnet", "Probe with RF coil", "RF receiver", "Signal processing", "Signal processing"];
  for (let i = 0; i < 6; i += 1) {
    check((await attr(T("instrument-view"), "data-op")) === String(i), `${tag}: instrument operation ${i + 1} is not active`);
    check((await text(T("instrument-part"))).includes(wantParts[i]), `${tag}: operation ${i + 1} shows "${await text(T("instrument-part"))}", expected ${wantParts[i]}`);
    await sleep(2600); check(Number(await attr(T("instrument-view"), "data-progress")) > 0.5, `${tag}: operation ${i + 1} is not animating`);
    await shot(`s4-op${i + 1}`);
    if (i === 2) check((await p.locator(T("comp-probe")).getAttribute("data-active")) === "1", `${tag}: probe not highlighted during the pulse`);
    if (i === 4) check((await p.locator(T("mini-fid")).count()) === 1, `${tag}: the FID is not drawn in the processing display`);
    if (i === 5) check((await p.locator(T("mini-spec")).count()) === 1, `${tag}: the spectrum is not drawn in the processing display`);
    if (i < 5) await p.click(T("next-stage"));
  }
  check(/Start again/.test(await text(T("next-stage"))), `${tag}: Next Stage does not offer a restart at the end`);
  await p.click(T("next-stage")); await sleep(600); check((await attr(T("instrument-view"), "data-op")) === "0", `${tag}: Start again did not return to the first operation`);
  await p.click(T("op-dot-3")); await sleep(500); check((await attr(T("instrument-view"), "data-op")) === "3", `${tag}: direct operation jump`);

  // ---------- step 5: FID of the current molecule, transform and back ----------
  await goStep(5); await geom("step 5");
  check((await text(T("default-note"))).includes("No molecule is chosen"), `${tag}: the default FID fallback is not stated`);
  await shot("s5-default");
  const pick5 = async (id) => { await p.locator(`${T("molecule-picker-5")} input`).click(); await p.click(T(`molecule-option-${id}`)); await sleep(500); };
  await pick5("ethanol");
  check((await text(T("graph-caption"))).includes("Ethanol") && (await text(T("graph-caption"))).includes("510.9"), `${tag}: the FID is not that of ethanol at the current operating frequency (${await text(T("graph-caption"))})`);
  check((await text(`${T("readout-freqs")} dd`)).trim() === "8", `${tag}: ethanol FID should contain 8 frequencies`);
  await sleep(500); await shot("s5-fid");
  await p.click(T("transform-btn"));
  await sleep(1500); check((await attr(T("signal-graph"), "data-mode")) === "transforming", `${tag}: the transform is not animated (mode ${await attr(T("signal-graph"), "data-mode")})`); await shot("s5-transforming");
  check(await waitFor(async () => (await attr(T("signal-graph"), "data-mode")) === "freq", 9000), `${tag}: Transform to Spectrum did not complete`);
  check((await p.locator("[data-testid^=peak-mark-]").count()) === 3, `${tag}: spectrum should mark 3 environments for ethanol`);
  await sleep(400); await shot("s5-spectrum");
  await p.click(T("back-btn")); check(await waitFor(async () => (await attr(T("signal-graph"), "data-mode")) === "time", 9000), `${tag}: could not go back to the FID`);

  // ---------- step 6: molecules (ethanol, then propan-2-ol) ----------
  await goStep(6); await geom("step 6");
  const mol6 = async (id) => { await p.locator(`${T("molecule-picker")} input`).click(); await p.click(T(`molecule-option-${id}`)); await sleep(900); };
  check((await p.locator(`${T("molecule-picker")} input`).inputValue()).includes("Ethanol"), `${tag}: the molecule chosen in step 5 was lost in step 6`);
  await shot("s6-a-empty");
  const checkMolecule = async (id, clickEnv, multName, nNeighb) => {
    const mol = getMolecule(id); const env = mol.environments.find((e) => e.id === clickEnv); const freq = larmorMHz(12);
    await goStep(6); await p.click(T("sub-environments")); await sleep(400);
    await p.locator(T("mol-stage")).waitFor(); await waitFor(async () => (await attr(T("mol-stage"), "data-webgl")) !== null, 8000);
    // click an H in the 3D model (or the SVG fallback)
    const idx = env.atoms[0];
    await sleep(1200);
    const pos = await p.locator(T("mol-stage")).evaluate((el, i) => el.__nmrMol?.project(i) ?? null, idx);
    check(Array.isArray(pos), `${tag} ${id}: could not locate H atom ${idx} on screen`);
    if (Array.isArray(pos)) await p.mouse.click(pos[0], pos[1]);
    await sleep(500);
    const picked = await attr(T("mol-stage"), "data-selected-env");
    check(picked === clickEnv, `${tag} ${id}: clicking H atom ${idx} selected "${picked}", expected ${clickEnv}`);
    check((await attr(T("mol-stage"), "data-highlighted")) === env.atoms.join(","), `${tag} ${id}: the equivalent hydrogens are not highlighted (${await attr(T("mol-stage"), "data-highlighted")} vs ${env.atoms.join(",")})`);
    check((await attr(T("spectrum"), "data-selected-env")) === clickEnv && (await p.locator(T(`trace-${clickEnv}`)).count()) === 1, `${tag} ${id}: the corresponding resonance is not highlighted in the spectrum`);
    check((await p.locator("[data-testid^=trace-]").count()) === 1, `${tag} ${id}: only the clicked environment's resonance should be shown at first (${await p.locator("[data-testid^=trace-]").count()})`);
    await shot(`s6-${id}-a`);
    // (b) chemical shift: build the spectrum
    await p.click(T("sub-shift")); await sleep(400); await shot(`s6-${id}-b-before`);
    await p.click(T("build-spectrum"));
    check(await waitFor(async () => (await p.locator("[data-testid^=trace-]").count()) === mol.environments.length, 9000), `${tag} ${id}: Build the spectrum did not add every environment`);
    check((await text(T("step-panel"))).includes(env.delta.toFixed(1)), `${tag} ${id}: the chemical shift of the selected environment is not shown`);
    check((await p.locator(T("shield-diagram")).count()) === 1, `${tag} ${id}: the shielding explanation is missing`);
    await shot(`s6-${id}-b`);
    // (c) integration
    await p.click(T("sub-integration")); await sleep(400); await p.click(T("show-integration")); await sleep(1400);
    check((await p.locator(T("integration-trace")).count()) === 1 && (await p.locator("[data-testid^=integral-]").count()) === mol.environments.length, `${tag} ${id}: the integration trace / labels are missing`);
    check((await text(T("area-ratio"))) === simplestRatio(mol.environments.map((e) => e.count)).join(" : "), `${tag} ${id}: area ratio text ${await text(T("area-ratio"))}`);
    await shot(`s6-${id}-c`);
    // (d) coupling
    await p.click(T("sub-coupling")); await sleep(500); await shot(`s6-${id}-d-before`);
    await p.click(T("apply-coupling"));
    await sleep(900); const mid = Number(await attr(T("spec-box"), "data-coupling-progress")); check(mid > 0 && mid < 1, `${tag} ${id}: the splitting is not animated (progress ${mid})`);
    check(await waitFor(async () => Number(await attr(T("spec-box"), "data-coupling-progress")) >= 0.99, 9000), `${tag} ${id}: Apply Coupling did not complete`);
    await sleep(500);
    check((await attr(T("spectrum"), "data-selected-env")) === clickEnv, `${tag} ${id}: the signal selection was lost when coupling was applied`);
    check((await text(T("multiplicity-name"))) === multName, `${tag} ${id}: ${env.label} should be a ${multName}, got ${await text(T("multiplicity-name"))}`);
    const sig = buildSignals(mol, { freqMHz: freq }).find((s) => s.envId === clickEnv);
    check((await text(T("what-is-happening"))).includes(pascalText(nNeighb)) && sig.multiplicity.nNeighbours === nNeighb, `${tag} ${id}: Pascal ratio ${pascalText(nNeighb)} not stated`);
    check(/total area is unchanged/.test(await text(T("what-is-happening"))) && /First-order assumptions/.test(await text(T("first-order-note"))), `${tag} ${id}: area / first-order statements missing`);
    const hi = await p.evaluate(() => [...document.querySelectorAll('[data-testid^="band-coupled-"]')].length);
    check(hi >= 1, `${tag} ${id}: no neighbouring environment is highlighted in the spectrum`);
    const molHi = await attr(T("mol-stage"), "data-selected-env"); check(molHi === clickEnv, `${tag} ${id}: molecule selection changed`);
    await p.click(T("spin-states-toggle")); await sleep(500);
    check((await attr(T("spin-states"), "data-n")) === String(nNeighb) && (await attr(T("spin-states"), "data-ratio")) === pascalText(nNeighb).split(":").join(" : "), `${tag} ${id}: spin-state counting ${await attr(T("spin-states"), "data-ratio")}`);
    await shot(`s6-${id}-d`);
  };
  await checkMolecule("ethanol", "a", "quartet", 3);
  await shot("s6-ethanol-spinstates");
  await mol6("propan-2-ol");
  await checkMolecule("propan-2-ol", "c", "doublet", 1);
  // every molecule is selectable
  const ids = ["methane", "ethane", "propane", "propanone", "ethanol", "ethyl-ethanoate", "propan-1-ol", "propan-2-ol", "ethanal"];
  for (const id of ids) { await mol6(id); check((await attr(T("molecule-view"), "data-molecule")) === id, `${tag}: could not select ${id}`); }
  await shot("s6-last-molecule");
  check(((await p.locator(`${T("step-panel")} button`).evaluateAll((bs) => bs.filter((b) => !(b.innerText || "").trim() && !b.getAttribute("aria-label") && !b.getAttribute("title")).length)) === 0), `${tag}: buttons without an accessible name`);

  // ---------- carry-over: direct jumps, Previous / Next ----------
  await mol6("ethanol"); await goStep(2); await setRange(T("b0-slider"), 7.3); await sleep(400);
  const probe = async (label) => {
    const out2 = {};
    out2.b0 = await p.evaluate(() => document.querySelector('[data-testid="spectroscopy-workspace"]').innerText.match(/(\d+\.\d) MHz/)?.[1]);
    return { label, ...out2 };
  };
  for (const n of [6, 1, 4, 3, 5, 2, 6]) {
    await goStep(n); check((await attr(T(`step-${n}`), "aria-current")) === "step" && (await attr(T(`step-view-${n}`), "data-step")) === String(n), `${tag}: direct jump to step ${n}`);
    if (n === 3 || n === 5) check(await p.evaluate(() => /310\.8\d* MHz/.test(document.querySelector('[data-testid="spectroscopy-workspace"]').innerText)), `${tag}: operating frequency 310.8 MHz (7.3 T) lost at step ${n}`);
    if (n === 5) check((await text(T("graph-caption"))).includes("Ethanol"), `${tag}: molecule lost at step 5`);
    if (n === 6) check((await attr(T("molecule-view"), "data-molecule")) === "ethanol", `${tag}: molecule lost at step 6`);
  }
  await goStep(2); check(Math.abs(Number(await p.locator(T("b0-slider")).inputValue()) - 7.3) < 1e-9, `${tag}: B0 lost after the jumps`);
  await goStep(1); check(await p.locator(T("step-prev")).isDisabled(), `${tag}: Previous should be disabled on step 1`);
  for (let i = 2; i <= 6; i += 1) { await p.click(T("step-next")); await sleep(250); check((await attr(T(`step-${i}`), "aria-current")) === "step", `${tag}: Next did not reach step ${i}`); }
  check(await p.locator(T("step-next")).isDisabled(), `${tag}: Next should be disabled on step 6`);
  for (let i = 5; i >= 1; i -= 1) { await p.click(T("step-prev")); await sleep(250); check((await attr(T(`step-${i}`), "aria-current")) === "step", `${tag}: Previous did not reach step ${i}`); }

  // ---------- transport, mode, keyboard ----------
  await goStep(3); await p.click(T("btn-play-pause")); check((await attr(T("playback-bar"), "data-paused")) === "1", `${tag}: Pause did not pause`);
  await p.click(T("btn-play-pause")); check((await attr(T("playback-bar"), "data-paused")) === "0", `${tag}: Play did not resume`);
  await p.locator(`${T("speed-switch")} button`, { hasText: "2×" }).click(); check((await p.locator(`${T("speed-switch")} button[aria-checked="true"]`).innerText()).includes("2"), `${tag}: speed switch`);
  await p.locator(`${T("speed-switch")} button`, { hasText: "1×" }).click();
  await goStep(1); check((await p.locator(T("btn-play-pause")).count()) === 0, `${tag}: step 1 should not offer Play / Pause`);
  await goStep(2);
  check((await p.locator(`${T("teacher-details")}[open]`).count()) === 0, `${tag}: the teacher disclosure should be closed in Student mode`);
  await p.locator(`${T("mode-switch")} button`, { hasText: "Teacher" }).click(); await sleep(400);
  check((await p.locator(`${T("teacher-details")}[open]`).count()) === 1, `${tag}: the teacher disclosure should be open in Teacher mode`);
  await shot("s2-teacher");
  await p.locator(`${T("mode-switch")} button`, { hasText: "Student" }).click();
  await p.locator(T("step-4")).focus(); await p.keyboard.press("Enter"); await sleep(400);
  check((await attr(T("step-4"), "aria-current")) === "step", `${tag}: keyboard activation of a step button`);
  await p.keyboard.press("Tab"); check(await p.evaluate(() => document.activeElement?.getAttribute("data-testid") === "step-5"), `${tag}: Tab order of the stepper`);

  // ---------- technique tabs, hide / show, persistence ----------
  for (const t of ["ms", "ir", "structure"]) { await p.click(T(`tech-${t}`)); await sleep(500); await geom(`placeholder ${t}`); check((await p.locator(T(`dev-${t}`)).count()) === 1, `${tag}: ${t} placeholder`); }
  await shot("tech-structure"); await p.click(T("tech-nmr")); await sleep(800);
  check((await attr(T("stage-box"), "data-stage")) === "step-4", `${tag}: step lost after switching technique tabs`);
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(600);
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(800);
  check((await attr(T("stage-box"), "data-stage")) === "step-4", `${tag}: step lost after hide/show`);
  if (w === 1366) {
    await sleep(600); await p.reload({ waitUntil: "domcontentloaded" }); await p.waitForSelector(T("spectroscopy-workspace")); await sleep(1800);
    check((await attr(T("stage-box"), "data-stage")) === "step-4", `${tag}: the step was not restored after a reload (${await attr(T("stage-box"), "data-stage")})`);
    await goStep(2); check(Math.abs(Number(await p.locator(T("b0-slider")).inputValue()) - 7.3) < 1e-9, `${tag}: B0 was not restored after a reload`);
  }
  // header Reset returns the defaults
  await p.click(T("reset")); await sleep(700); await goStep(2); check(Math.abs(Number(await p.locator(T("b0-slider")).inputValue()) - 9.4) < 1e-9, `${tag}: Reset did not restore B0 = 9.4 T`);
  check(errs.length === 0, `${tag}: console errors: ${errs.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

// ---------- reduced motion: no animation, same end states ----------
if (!ONLY || ONLY.includes("1366x768")) {
  console.log("reduced motion 1366x768");
  const { ctx, p, errs } = await open(1366, 768, { reducedMotion: "reduce" });
  const attr = async (sel, a) => p.locator(sel).first().getAttribute(a);
  await p.click(T("step-1")); await p.click(T("show-sample")); await sleep(300);
  check(Number(await attr(T("sample-state"), "data-progress")) >= 0.99, "reduced motion: the sample transition should jump to its end");
  await p.click(T("step-2")); await p.click(T("apply-field")); await sleep(300);
  check(Number(await attr(T("levels-diagram"), "data-p")) >= 0.99, "reduced motion: Apply B0 should jump to its end");
  await p.click(T("step-5")); await p.click(T("transform-btn")); await sleep(300);
  check((await attr(T("signal-graph"), "data-mode")) === "freq", "reduced motion: the transform should jump to the spectrum");
  await p.click(T("step-4")); await p.click(T("next-stage")); await sleep(300);
  check(Number(await attr(T("instrument-view"), "data-progress")) >= 0.99, "reduced motion: the instrument operation should jump to its end");
  check(errs.length === 0, `reduced motion: console errors: ${errs.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

await browser.close(); if (server) server.kill(); if (dist) { try { fs.rmSync(dist, { recursive: true, force: true }); } catch { /* ignore */ } }
console.log(`\n${checks} checks, ${problems.length} problem(s). Screenshots: ${out}`);
if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
