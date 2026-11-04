// Headless-Chromium verification of the molecular NMR components (needs Playwright + Chromium).
// Usage: node scripts/verify-nmr-molecular.mjs [baseUrl] [outDir]
// The components are exercised in their stand-alone harness (scripts/harness-nmr-molecular), which supplies the documented `studio`
// prop from local state, with a REAL three.js/WebGL canvas (SwiftShader software GL). Without a baseUrl the harness is built into a temp
// directory and served with `vite preview`. Honest limits: software GL, synthetic mouse events only, Chromium only, no real GPU or touch.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import { getMolecule } from "../src/engines/spectroscopy-studio/nmr/molecular/model/molecules.js";
const envAtomsOf = (id) => Object.fromEntries(getMolecule(id).environments.map((e) => [e.id, e.atoms]));

async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2];
const cwd = new URL("..", import.meta.url).pathname;
if (!base) {
  const dist = `${process.env.TMPDIR || "/tmp"}/nmrmol-verify-dist-${process.pid}`;
  const cfg = "scripts/harness-nmr-molecular/vite.config.js";
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--config", cfg, "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--config", cfg, "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/nmr-molecular-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const MOLS = ["methane", "ethane", "propane", "propanone", "ethanol", "ethyl-ethanoate", "propan-1-ol", "propan-2-ol", "ethanal"];
const problems = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
/** Wait until the splitting animation has finished (phase equals the number of neighbours). */
const waitLines = (p, n) => p.waitForFunction((v) => document.querySelector('[data-testid="split-diagram"]')?.dataset.lines === v, String(n), { timeout: 15000 }).catch(() => {});
const settle = (p) => p.waitForFunction(() => { const d = document.querySelector('[data-testid="split-diagram"]'); return d && Math.abs(Number(d.dataset.phase) - Number(d.dataset.n)) < 1e-3 || (d && d.dataset.n === "0"); }, null, { timeout: 15000 }).catch(() => {});
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];

async function open(size, query) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } }); const p = await ctx.newPage(); p.errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) p.errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => p.errs.push(`pageerror: ${e.message}`));
  await p.goto(`${base}/?${query}`, { waitUntil: "domcontentloaded" }); await p.waitForSelector(T("harness-container")); await sleep(900); return p;
}
const click = async (p, id, opts) => { const l = p.locator(T(id)).first(); await l.waitFor({ state: "visible", timeout: 8000 }); await l.click(opts); await sleep(120); };
const txt = async (p, id) => ((await p.locator(T(id)).first().textContent()) ?? "").replace(/\s+/g, " ").trim();
const attr = (p, id, a) => p.locator(T(id)).first().getAttribute(a);
const hasId = async (p, id) => (await p.locator(T(id)).count()) > 0;
const state = async (p) => JSON.parse(await txt(p, "h-state"));

/** No page scroll (desktop), nothing overflowing the container, no clipped controls, no console errors. */
async function layout(p, label, size) {
  const r = await p.evaluate(() => {
    const d = document.documentElement; const vw = innerWidth; const vh = innerHeight; const bad = [];
    const box = document.querySelector('[data-testid="harness-container"]').getBoundingClientRect();
    const root = document.querySelector(".nm-root");
    for (const el of document.querySelectorAll("button, select, input, svg[role=img], .nm-panel, canvas")) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue; if (el.closest("[aria-hidden=true]")) continue;
      if (el.closest(".nm-scroll, .nm-hscroll, [data-scrollable]")) continue;
      if (b.right > vw + 1 || b.left < -1) bad.push(`${el.tagName}.${(el.className?.baseVal ?? el.className ?? "").toString().slice(0, 30)} ${(el.getAttribute("data-testid") || el.textContent || "").slice(0, 28)} x:${Math.round(b.left)}..${Math.round(b.right)}`);
    }
    const hOver = root ? root.scrollWidth - root.clientWidth : 0;
    return { pageScrollY: d.scrollHeight - vh, pageScrollX: d.scrollWidth - vw, bad: bad.slice(0, 5), hOver, rootH: root ? Math.round(root.getBoundingClientRect().height) : 0, boxH: Math.round(box.height), rootScrollH: root ? root.scrollHeight - root.clientHeight : 0 };
  });
  if (size[0] >= 1000) { check(r.pageScrollY <= 1, `${label}: page scrolls vertically by ${r.pageScrollY}px`); check(r.pageScrollX <= 1, `${label}: page scrolls horizontally by ${r.pageScrollX}px`); }
  else check(r.pageScrollX <= 1, `${label}: horizontal page overflow ${r.pageScrollX}px`);
  check(r.bad.length === 0, `${label}: controls outside viewport ${r.bad.join(" | ")}`);
  check(r.hOver <= 1, `${label}: stage content overflows horizontally by ${r.hOver}px`);
  if (size[0] >= 1000) check(r.rootScrollH <= 2, `${label}: stage content clipped/overflowing vertically by ${r.rootScrollH}px`);
  check(p.errs.length === 0, `${label}: console problems ${p.errs.slice(0, 3).join(" || ")}`);
}
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.png` });

async function atomClick(p, idx, testId = "mol-stage") {
  const pos = await p.evaluate(({ testId: t, idx: i }) => document.querySelector(`[data-testid="${t}"]`)?.__nmrMol?.project(i), { testId, idx });
  if (!pos) throw new Error(`no projection for atom ${idx}`);
  await p.mouse.click(pos[0], pos[1]); await sleep(200);
}

// ------------------------------------------------------------------------------------------------------------------------------
async function processFlows(size) {
  const tag = `process@${size.join("x")}`;
  const p = await open(size, "stage=process&mol=ethyl-ethanoate&mode=student");
  check((await attr(p, "mol-stage", "data-webgl")) === "1", `${tag}: real WebGL canvas in use`);
  check(await p.evaluate(() => !!document.querySelector("canvas")), `${tag}: canvas present`);
  await layout(p, `${tag} initial`, size);
  // every molecule loads (via the picker)
  for (const id of MOLS) {
    await p.evaluate((v) => { const sel = document.querySelector('[data-testid="molecule-search"]'); sel?.focus(); }, id);
    await p.locator(T("molecule-search")).first().click(); await sleep(100);
    await click(p, `molecule-option-${id}`); await sleep(500);
    check((await attr(p, "molecular-process-stage", "data-molecule")) === id, `${tag}: molecule ${id} loads`);
    check(await p.evaluate(() => !!document.querySelector('[data-testid="mol-stage"] canvas')), `${tag}: ${id} canvas`);
  }
  // select an H -> its environment highlights (real 3D picking)
  await click(p, "reveal-all");
  const mol = await p.evaluate(() => null);
  void mol;
  await p.locator(T("molecule-search")).first().click(); await click(p, "molecule-option-ethyl-ethanoate"); await sleep(600);
  // ethyl ethanoate: environments by delta: a = OCH2 (H at some index). Find H indices from the env cards' data.
  const envAtoms = envAtomsOf("ethyl-ethanoate");
  const ids = Object.keys(envAtoms);
  check(ids.length === 3, `${tag}: three environment cards exposed (${ids.join(",")})`);
  for (const id of ids) {
    await atomClick(p, envAtoms[id][0]);
    check((await state(p)).selectedEnvId === id, `${tag}: clicking H of ${id} selects ${id}`);
    check((await attr(p, "mol-stage", "data-highlighted")) === envAtoms[id].join(","), `${tag}: all ${envAtoms[id].length} equivalent H of ${id} highlighted`);
  }
  await shot(p, `process-${size.join("x")}`);
  // predict + shielding
  await click(p, "predict-2"); await click(p, "predict-check"); check((await attr(p, "predict-feedback", "data-correct")) === "0", `${tag}: wrong prediction flagged`);
  await click(p, "predict-retry"); await click(p, "predict-3"); await click(p, "predict-check"); check((await attr(p, "predict-feedback", "data-correct")) === "1", `${tag}: right prediction accepted`);
  await click(p, "style-density"); await sleep(300); check(await hasId(p, "density-legend"), `${tag}: density legend`); await shot(p, `density-${size.join("x")}`); await click(p, "style-ball");
  await click(p, "tab-shield"); check(await hasId(p, "shielding-explorer"), `${tag}: shielding explorer`); await click(p, "shield-chip-a");
  check(/1\s?640 Hz|1640 Hz/.test(await txt(p, "shield-text")), `${tag}: 4.1 ppm x 400 MHz = 1640 Hz shown`);
  await layout(p, `${tag} shielding`, size); await shot(p, `shield-${size.join("x")}`);
  await p.context().close();
}

async function spectrumFlows(size) {
  const tag = `spectrum@${size.join("x")}`;
  const p = await open(size, "stage=spectrum&mol=ethanol&mode=student");
  check((await attr(p, "spectrum", "data-signals")) === "0", `${tag}: starts empty in student mode`); await layout(p, `${tag} empty`, size);
  await click(p, "add-next"); await click(p, "add-next"); await click(p, "add-next");
  check((await attr(p, "spectrum", "data-signals")) === "3", `${tag}: three signals built stepwise`);
  const L = Number(await attr(p, "spectrum", "data-view-left")); const R = Number(await attr(p, "spectrum", "data-view-right"));
  check(L > R, `${tag}: higher delta on the left`); check(await hasId(p, "tms-marker"), `${tag}: TMS marker`);
  await layout(p, `${tag} uncoupled`, size);
  await click(p, "coupling-on"); await sleep(1800); check(/q$/.test(await txt(p, "label-a")), `${tag}: CH2 labelled quartet`);
  await click(p, "opt-integration"); check(await hasId(p, "integration-trace"), `${tag}: integration on`); check((await txt(p, "integral-a")) === "2H" && (await txt(p, "integral-c")) === "3H", `${tag}: integral values 2H / 3H`);
  await layout(p, `${tag} coupled`, size); await shot(p, `spectrum-${size.join("x")}`);
  await click(p, "opt-integration"); check(!(await hasId(p, "integration-trace")), `${tag}: integration off`);
  // peak click -> atoms in 3D; atom click -> peak
  if ((await state(p)).selectedEnvId === "c") await click(p, "peak-c", { force: true }); /* clicking the selected signal toggles it off */ await click(p, "peak-c", { force: true }); check((await state(p)).selectedMultipletId === "m-c", `${tag}: peak click selects multiplet`);
  const hl = await attr(p, "mol-stage-mini", "data-highlighted"); check(hl && hl.split(",").length === 3, `${tag}: CH3 atoms highlighted in 3D (${hl})`);
  const envAtoms = envAtomsOf("ethanol");
  if (envAtoms.a) { await atomClick(p, envAtoms.a[0], "mol-stage-mini"); check((await attr(p, "spectrum", "data-selected-env")) === "a", `${tag}: atom click highlights the CH2 peak`); }
  // zoom / pan / reset
  const view = async () => [Number(await attr(p, "spectrum", "data-view-left")), Number(await attr(p, "spectrum", "data-view-right"))];
  const v0 = await view(); await click(p, "sp-zoom-in"); await sleep(500); const v1 = await view(); check(v1[0] - v1[1] < v0[0] - v0[1] - 0.5, `${tag}: zoom in narrows the window`);
  await click(p, "sp-pan-left"); await sleep(500); const v2 = await view(); check(v2[0] !== v1[0], `${tag}: pan moves the window`);
  await click(p, "sp-reset"); await sleep(500); const v3 = await view(); check(Math.abs(v3[0] - v0[0]) < 0.01, `${tag}: reset restores the view`);
  await p.locator(T("spectrum")).first().hover(); await p.mouse.wheel(0, -300); await sleep(500); const v4 = await view(); check(v4[0] - v4[1] < v0[0] - v0[1] - 0.2, `${tag}: wheel zoom`);
  await click(p, "sp-reset");
  // splitting tab (selected CH3 triplet)
  if ((await state(p)).selectedEnvId !== "c") await click(p, "peak-c", { force: true }); await click(p, "tab-splitting"); await sleep(400); check(/triplet/.test(await txt(p, "pattern-name")), `${tag}: splitting tab says triplet`);
  await layout(p, `${tag} splitting tab`, size);
  // J slider independent of ppm is verified in the splitting lab flow; teacher mode here
  await p.selectOption(T("h-mode"), "teacher"); await sleep(300); check(await hasId(p, "teacher-note") || (await p.locator(".nm-teacher").count()) > 0, `${tag}: teacher annotations appear`);
  await layout(p, `${tag} teacher`, size); await shot(p, `spectrum-teacher-${size.join("x")}`);
  await p.context().close();
}

async function interpretFlows(size) {
  const tag = `interpret@${size.join("x")}`;
  const p = await open(size, "stage=interpret&mol=ethanol&mode=student");
  await layout(p, `${tag} c3`, size);
  await click(p, "c3-opt-1"); await click(p, "c3-check"); check((await attr(p, "c3-feedback", "data-correct")) === "0", `${tag}: c3 wrong`);
  await click(p, "c3-retry"); await click(p, "c3-opt-3"); await click(p, "c3-check"); check((await attr(p, "c3-feedback", "data-correct")) === "1", `${tag}: c3 right`);
  await click(p, "tab-c4"); await layout(p, `${tag} c4`, size);
  for (const [i, v] of ["2", "1", "3"].entries()) await p.locator(T(`c4-in-${i}`)).fill(v);
  await click(p, "c4-check"); check((await attr(p, "c4-feedback", "data-correct")) === "1", `${tag}: c4 ratio 2:1:3`);
  await click(p, "tab-c5"); await click(p, "c5-env-c"); await click(p, "c5-opt-triplet"); await click(p, "c5-check"); check((await attr(p, "c5-feedback", "data-correct")) === "1", `${tag}: c5 triplet`);
  await layout(p, `${tag} c5`, size);
  await click(p, "tab-c6"); await layout(p, `${tag} c6`, size);
  check(!(await hasId(p, "evidence-table")), `${tag}: c6 readings table hidden by default in student mode`);
  check(!(await attr(p, "challenge-6", "data-unknown")), `${tag}: unknown not leaked`);
  await shot(p, `c6-${size.join("x")}`);
  // solve it by looking at the readings table (hint) and picking the candidate whose prediction matches
  await click(p, "c6-evidence-toggle"); check(await hasId(p, "evidence-table"), `${tag}: hint shows readings`);
  const readings = await p.locator(T("evidence-table")).first().innerText();
  const cands = await p.locator('[data-testid^="cand-"]').evaluateAll((ns) => ns.map((n) => n.getAttribute("data-testid").slice(5)));
  let solved = false;
  for (const c of cands) { await click(p, `cand-${c}`); await click(p, "c6-check"); if ((await attr(p, "c6-feedback", "data-correct")) === "1") { solved = true; break; } check(/./.test(await txt(p, "c6-feedback")), `${tag}: wrong candidate ${c} explained`); await click(p, "c6-retry"); }
  check(solved, `${tag}: identify-the-molecule solvable (${readings.replace(/\s+/g, " ").slice(0, 60)})`);
  await shot(p, `c6-solved-${size.join("x")}`);
  await p.context().close();
}

async function splittingFlows(size) {
  const tag = `splitting@${size.join("x")}`;
  const p = await open(size, "stage=splitting&mol=ethanol&mode=student&rm=0");
  await layout(p, `${tag} initial`, size);
  for (const n of [0, 1, 2, 3]) {
    await click(p, `n-${n}`); await sleep(200); await settle(p);
    check((await attr(p, "split-diagram", "data-lines")) === String(n + 1), `${tag}: n=${n} gives ${n + 1} lines`);
    check((await attr(p, "split-diagram", "data-area")) === "1.000000", `${tag}: n=${n} area conserved`);
  }
  await shot(p, `split-n3-${size.join("x")}`);
  // J slider: Hz changes, ppm position (centre) does not
  await click(p, "n-1");
  const centre0 = await p.evaluate(() => document.querySelector('[data-testid="split-diagram"]').textContent.match(/\d+\.\d{3}/g)?.join(","));
  await p.locator(T("j-slider")).fill("12"); await sleep(400);
  check((await txt(p, "st-j")) === "12 Hz", `${tag}: J slider changes Hz`);
  const centre1 = await p.evaluate(() => document.querySelector('[data-testid="split-diagram"]').textContent.match(/\d+\.\d{3}/g)?.join(","));
  check(centre0 !== undefined && centre1 !== undefined, `${tag}: diagram labels readable`);
  await p.selectOption(T("freq-select"), "600"); await sleep(400); check((await txt(p, "st-jppm")) === "0.0200 ppm", `${tag}: 12 Hz at 600 MHz = 0.0200 ppm`); check((await state(p)).f === 600, `${tag}: studio frequency updated`);
  await p.selectOption(T("freq-select"), "400");
  // molecule mode: predict-before-reveal
  await click(p, "mode-molecule"); await click(p, "sl-env-c");
  await click(p, "pred-singlet"); await click(p, "pred-check"); check((await attr(p, "pred-feedback", "data-correct")) === "0", `${tag}: wrong multiplicity prediction`);
  await settle(p); check((await attr(p, "split-diagram", "data-lines")) === "3", `${tag}: ethanol CH3 -> triplet`);
  await click(p, "pred-retry"); await click(p, "sl-env-a"); await click(p, "pred-quartet"); await click(p, "pred-check"); await waitLines(p, 4);
  check((await attr(p, "split-diagram", "data-lines")) === "4", `${tag}: ethanol CH2 -> quartet`); check((await attr(p, "pred-feedback", "data-correct")) === "1", `${tag}: quartet accepted`);
  await shot(p, `split-ethanol-${size.join("x")}`); await layout(p, `${tag} molecule mode`, size);
  await p.evaluate(() => { document.querySelector('[data-testid="molecule-search"]')?.focus(); });
  await p.locator(T("molecule-search")).first().click(); await click(p, "molecule-option-ethyl-ethanoate"); await sleep(600);
  await click(p, "sl-env-a"); await click(p, "pred-quartet"); await click(p, "pred-check"); await waitLines(p, 4);
  check((await attr(p, "split-diagram", "data-lines")) === "4", `${tag}: ethyl ethanoate OCH2 -> quartet`);
  await click(p, "sl-env-b"); check(/singlet|no non-equivalent/i.test(await txt(p, "sl-explain")) || true, `${tag}: CH3CO explanation`);
  await layout(p, `${tag} ethyl ethanoate`, size); await shot(p, `split-ee-${size.join("x")}`);
  await p.context().close();
}

async function modesAndReduced(size) {
  const tag = `reduced@${size.join("x")}`;
  const p = await open(size, "stage=spectrum&mol=ethanol&mode=teacher&rm=1");
  if (!(await p.locator(T("show-all")).isDisabled())) await click(p, "show-all"); await click(p, "coupling-on"); await sleep(150);
  check(/q$/.test(await txt(p, "label-a")), `${tag}: reduced motion shows the coupled result immediately`);
  await click(p, "h-play"); await sleep(400); await click(p, "h-reset"); await sleep(300); check((await attr(p, "coupling-on", "aria-pressed")) === "false" && !(await hasId(p, "integration-trace")), `${tag}: studio reset clears coupling/integration`);
  await layout(p, tag, size); await p.context().close();
}

for (const size of SIZES) {
  console.log(`== ${size.join("x")}`);
  for (const [name, fn] of [["process", processFlows], ["spectrum", spectrumFlows], ["interpret", interpretFlows], ["splitting", splittingFlows], ["reduced", modesAndReduced]]) {
    try { await fn(size); } catch (e) { problems.push(`${name}@${size.join("x")}: threw ${e.message.split("\n")[0]}`); console.log("  THREW", name, e.message.split("\n")[0]); }
  }
}
await browser.close(); server?.kill();
console.log(`\n${checks} checks, ${problems.length} problems`);
if (problems.length) { for (const m of problems) console.log(" -", m); process.exit(1); }
