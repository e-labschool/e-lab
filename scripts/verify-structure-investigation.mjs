// Headless-Chromium verification of the Structure Investigation tab of the Spectroscopy Simulation Lab.
// Usage: node scripts/verify-structure-investigation.mjs [baseUrl] [outDir]    (without baseUrl the app is built into a temp dir and served by `vite preview` on a free port)
// Environment: SIZES=1366x768,390x844 limits the viewports; MODES=newtab,fullscreen limits the modes; THEMES=light,dark; CHROMIUM overrides the browser; SHOTS=1 saves screenshots to outDir.
//
// Per viewport (1366x768, 1440x900, 1920x1080, 820x1180, 390x844), per mode (newtab, fullscreen via the shared frame's button) and per theme (light, dark at 1366 and 390):
//   all five stages are opened; checked: no horizontal overflow, no control outside the workspace, no control covered by another element, spectra and plots a sensible size.
// In newtab mode at 1366x768: ONE COMPLETE INVESTIGATION AT EACH LEVEL (Foundation, Intermediate, Advanced) through the real UI (peak click, estimate, reference table, IR band,
// NMR signal, integration, multiplet, tables, notebook, hints, wrong answer feedback, correct answer, explanation; Advanced with a written justification), then at 390x844 one
// complete Foundation investigation. Plot alignment: MS bar heights = data-rel and the compound's relative abundance; IR curve minima at the band wavenumbers; NMR trace centres at the
// shifts and TMS at 0 ppm (all measured from the rendered geometry). MS / IR / NMR tabs still open and work. No console errors.
// Honest limits: software GL (SwiftShader), synthetic mouse events only, Chromium only; no real GPU, no real touch hardware, no assistive technology, no embedded lesson page.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs"; import net from "node:net"; import { spawn } from "node:child_process"; import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);
const { COMPOUNDS } = await import("../src/engines/spectroscopy-studio/structure/data/compounds.js");
const { compoundsOfLevel } = await import("../src/engines/spectroscopy-studio/structure/model/levels.js");

const freePort = () => new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); });
let server = null; let base = process.argv[2]; const cwd = new URL("..", import.meta.url).pathname;
if (!base) {
  const dist = `${process.env.TMPDIR || "/tmp"}/structure-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/structure-verify"; fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const ONLY = process.env.SIZES ? process.env.SIZES.split(",") : null; const MODES = process.env.MODES ? process.env.MODES.split(",") : ["newtab", "fullscreen"];
const THEMES = process.env.THEMES ? process.env.THEMES.split(",") : ["light", "dark"];
const problems = []; let checks = 0; const T = (id) => `[data-testid="${id}"]`; const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];

async function open(w, h, mode, theme) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); await ctx.addInitScript((t) => { try { localStorage.setItem("e-lab:theme", t); } catch { /* ignore */ } }, theme);
  const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text().slice(0, 240)); });
  p.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  await p.goto(`${base}/simulation/spectroscopy-studio`, { waitUntil: "domcontentloaded" }); await p.waitForSelector(T("spectroscopy-workspace"), { timeout: 30000 }); await sleep(1000);
  if (mode === "fullscreen") { await p.click(T("sim-fullscreen")); await sleep(800); }
  await p.click(T("tech-structure")); await p.waitForSelector(`${T("stage-stepper")}[data-count="5"]`, { timeout: 10000 }); await sleep(500);
  return { ctx, p, errs };
}
/** Geometry of the current stage. */
const geom = (p) => p.evaluate(() => {
  const de = document.documentElement; const ws = document.querySelector('[data-testid="stage-box"]'); const r = ws.getBoundingClientRect();
  const scope = [...ws.querySelectorAll("button, input, textarea, select, [role='radio']")].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && q.height > 0 && getComputedStyle(b).visibility !== "hidden"; });
  const name = (b) => b.getAttribute("data-testid") || b.getAttribute("aria-label") || b.textContent.trim().slice(0, 24);
  const clipped = scope.filter((b) => { const q = b.getBoundingClientRect(); return q.right > r.right + 1 || q.left < r.left - 1; }).map(name);
  const covered = [];
  for (const b of scope) {
    if (b.closest("svg")) continue; b.scrollIntoView({ block: "nearest", inline: "nearest" }); const q = b.getBoundingClientRect(); const cx = q.left + q.width / 2; const cy = q.top + q.height / 2;
    if (cx < 0 || cy < 0 || cx > innerWidth || cy > innerHeight) continue; const el = document.elementFromPoint(cx, cy); if (el && !(b === el || b.contains(el) || el.contains(b))) covered.push(name(b));
  }
  const plot = document.querySelector('[data-testid="ms-plot"], [data-testid="ir-plot"], [data-testid="nmr-plot"]'); const pr = plot ? plot.getBoundingClientRect() : { width: 0, height: 0 };
  return { hx: de.scrollWidth - innerWidth, clipped, covered, plot: [Math.round(pr.width), Math.round(pr.height)] };
});

async function suite(p, errs, tag, { w, shot }) {
  const click = async (sel, wait = 250) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.locator(sel).first().click(); await sleep(wait); };
  const count = (sel) => p.locator(sel).count();
  const text = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
  const go = async (n) => { await click(T(`step-${n}`), 500); };
  const stageCheck = async (label) => {
    const g = await geom(p);
    check(g.hx <= 1, `${tag} ${label}: horizontal page overflow ${g.hx}px`); check(g.clipped.length === 0, `${tag} ${label}: controls outside the workspace: ${g.clipped.join(", ")}`);
    check(g.covered.length === 0, `${tag} ${label}: controls covered: ${g.covered.join(", ")}`);
    if (/MS|IR|NMR/.test(label)) check(g.plot[0] > 200 && g.plot[1] > 100, `${tag} ${label}: plot too small ${g.plot}`);
  };
  await stageCheck("sample"); await shot("1-sample");
  await click(T("start-investigation"), 600);
  for (const [n, label, view] of [[2, "MS", "ms-view"], [3, "IR", "ir-view"], [4, "NMR", "nmr-view"], [5, "identify", "identify-view"]]) {
    await go(n); check((await count(T(view))) === 1, `${tag}: stage ${n} (${view}) opens`); await stageCheck(label); await shot(`${n}-${label}`);
  }
  check((await count(T("step-6"))) === 0, `${tag}: no sixth stage`);
  await go(1);
}

/** MS bars against data-rel and the compound's data; IR minima against the bands; NMR traces against the shifts. */
async function alignment(p, tag, compound, d2o = false) {
  const click = async (sel, wait = 400) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.locator(sel).first().click(); await sleep(wait); };
  await click(T("step-2"), 700);
  const ms = await p.evaluate(() => { const svg = document.querySelector('[data-testid="ms-spectrum"]'); const bg = svg.querySelector("rect.ss-plot-bg").getBoundingClientRect();
    return [...svg.querySelectorAll("g.ms-peak")].map((g) => ({ mz: +g.dataset.mz, rel: +g.dataset.rel, px: (g.querySelector("rect.ms-bar").getBoundingClientRect().height / bg.height) * 100 })); });
  check(ms.length >= compound.ms.peaks.length - 1, `${tag}: ${ms.length} MS bars for ${compound.ms.peaks.length} peaks`);
  for (const b of ms) { const ref = compound.ms.byMz[b.mz]; check(Boolean(ref), `${tag}: bar at m/z ${b.mz} has no data`); if (ref) check(Math.abs(b.rel - ref.rel) < 0.06 && Math.abs(b.px - ref.rel) < 1.2, `${tag}: m/z ${b.mz} bar ${b.px.toFixed(1)} % vs data ${ref.rel}`); }
  check(ms.some((b) => b.mz === compound.ms.mMz), `${tag}: molecular-ion bar drawn`);
  await click(T("step-3"), 700);
  const ir = await p.evaluate(() => { const svg = document.querySelector('[data-testid="ir-plot"] svg'); const bg = svg.querySelector("rect.ss-plot-bg"); const x0 = +bg.getAttribute("x"); const w = +bg.getAttribute("width"); const hi = +svg.dataset.xleft; const lo = +svg.dataset.xright;
    const nums = svg.querySelector('[data-testid="ir-curve"]').getAttribute("d").match(/-?\d+(\.\d+)?/g).map(Number); const pts = []; for (let i = 0; i + 1 < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    const mins = []; const yMax = Math.max(...pts.map((q) => q[1])); const yMin = Math.min(...pts.map((q) => q[1]));
    for (let i = 2; i < pts.length - 2; i += 1) if (pts[i][1] >= pts[i - 1][1] && pts[i][1] > pts[i + 1][1] && pts[i][1] - yMin > 0.12 * (yMax - yMin)) mins.push(hi - ((pts[i][0] - x0) / w) * (hi - lo));
    return { mins, hi, lo, n: pts.length, tm: pts.map((q) => q[0]) }; });
  check(ir.hi === 4000 && ir.lo === 400, `${tag}: IR axis runs 4000 -> 400 (${ir.hi} -> ${ir.lo})`);
  check(ir.tm[0] < ir.tm[ir.tm.length - 1], `${tag}: IR curve is drawn left to right`);
  for (const b of compound.ir.bands.filter((q) => q.A >= 0.6 && q.fwhm <= 80)) check(ir.mins.some((m) => Math.abs(m - b.nu) <= 14), `${tag}: no IR minimum within 14 cm-1 of the ${b.nu} cm-1 band (minima: ${ir.mins.map(Math.round).join(", ")})`);
  await click(T("step-4"), 700);
  if (d2o) { await click(T("toggle-d2o"), 500); }
  const nmr = await p.evaluate(() => { const svg = document.querySelector('[data-testid="nmr-plot"] svg'); const bg = svg.querySelector("rect.ss-plot-bg"); const x0 = +bg.getAttribute("x"); const w = +bg.getAttribute("width"); const left = +svg.dataset.left; const right = +svg.dataset.right;
    const ppm = (x) => left - ((x - x0) / w) * (left - right); const traces = [...svg.querySelectorAll("path.st-trace")].map((t) => { const L = t.getTotalLength(); let best = null; for (let i = 0; i <= 1500; i += 1) { const q = t.getPointAtLength((L * i) / 1500); if (!best || q.y < best.y - 1e-6) best = q; } return { c: ppm(best.x) }; });
    const tms = svg.querySelector('[data-testid="tms-peak"]').getBBox(); return { left, right, traces: traces.map((t) => t.c), tms: ppm(tms.x + tms.width / 2) }; });
  check(nmr.left > nmr.right, `${tag}: NMR axis decreases to the right (${nmr.left} -> ${nmr.right})`); check(Math.abs(nmr.tms) < 0.08, `${tag}: TMS drawn at ${nmr.tms.toFixed(3)} ppm`);
  const want = compound.nmr.signals.filter((s) => !(d2o && s.exchangeable)).map((s) => s.shift).sort((a, b) => a - b); const got = [...nmr.traces].sort((a, b) => a - b);
  check(got.length === want.length, `${tag}: ${got.length} NMR traces for ${want.length} signals`);
  if (d2o) await click(T("toggle-d2o"), 400);
  want.forEach((s, i) => check(got[i] !== undefined && Math.abs(got[i] - s) < 0.1, `${tag}: NMR trace ${i} at ${got[i]?.toFixed(2)} ppm, data ${s}`));
}

/** One complete investigation of the current unknown through the real UI. */
async function investigate(p, errs, tag, level) {
  const click = async (sel, wait = 250) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.locator(sel).first().click(); await sleep(wait); };
  const count = (sel) => p.locator(sel).count(); const text = async (sel) => (await p.locator(sel).first().innerText()).replace(/\s+/g, " ").trim();
  const fill = async (sel, v) => { await p.locator(sel).first().scrollIntoViewIfNeeded().catch(() => {}); await p.locator(sel).first().fill(v); await sleep(120); };
  const id = compoundsOfLevel(level)[0]; const c = COMPOUNDS[id];
  await click(T(`level-${level}`), 500); check((await text(T("sample-id"))).startsWith(`Unknown ${{ foundation: "A", intermediate: "B", advanced: "C" }[level]}01`), `${tag}: first unknown of ${level}`);
  check(/Can you identify the unknown molecule using spectroscopic evidence\?/.test(await text(T("sample-question"))), `${tag}: sample question`);
  await click(T("start-investigation"), 700);
  // MS
  check((await count(T("ms-view"))) === 1, `${tag}: MS opens after Start`);
  await p.locator(`${T(`peak-${c.ms.mMz}`)} rect.ms-hit`).first().click({ position: { x: 3, y: 120 } }); await sleep(300); // left edge: on a phone the M+1 satellite 1 u away overlaps the right half of the hit area check(new RegExp(`${c.ms.mMz}`).test(await text(T("peak-inspector"))), `${tag}: peak inspector shows m/z ${c.ms.mMz}`);
  await click(T("add-peak-note"), 300); await fill(T("m-estimate"), String(c.ms.mMz));
  await click(T("zoom-in"), 300); await click(T("zoom-reset"), 300); await click(T("toggle-markers"), 300);
  // IR
  await click(T("step-3"), 600); await click(T("reference-toggle"), 400); check((await count(T("reference-table"))) === 1, `${tag}: reference table opens`); await click(T("reference-toggle"), 300);
  const strong = [...c.ir.bands].sort((a, b) => b.A - a.A)[0]; await click(T("ir-band-0"), 300).catch(() => {});
  await fill(T("ir-table-nu-0"), String(strong.nu)); await fill(T("ir-table-group-0"), "see reference table"); await fill(T("ir-table-evidence-0"), "strong absorption");
  await click(T("zoom-in"), 300); await click(T("zoom-reset"), 300);
  // NMR
  await click(T("step-4"), 600); await click(T("signal-r1"), 300); check((await count(T("nmr-inspector"))) === 1, `${tag}: NMR inspector`);
  await click(T("toggle-integration"), 300); await click(T("expand-multiplet"), 300); await click(T("toggle-d2o"), 300); await click(T("toggle-d2o"), 300);
  await fill(T("nmr-table-shift-0"), String(c.nmr.signals[0].shift)); await fill(T("nmr-table-integ-0"), "1"); await fill(T("nmr-table-split-0"), "s");
  // notebook
  const nbOpen = (await count(T("notebook-mass"))) > 0; if (!nbOpen) await click(T("notebook-toggle"), 300);
  await fill(T("notebook-mass"), `M+ at ${c.ms.mMz}`); await fill(T("notebook-protons"), `${c.nmr.signals.length} signals`);
  // identify
  await click(T("step-5"), 600);
  const wrongId = c.choices.find((x) => x !== c.id);
  await click(`[data-structure="${wrongId}"]`, 200);
  if (level === "advanced") { check(await p.locator(T("submit-answer")).isDisabled(), `${tag}: Advanced Submit disabled without justification`); await fill(T("justification"), "The molecular ion, the infrared absorptions and the proton splitting with integration are all consistent with this structure."); }
  await click(T("hint-button"), 300); check((await count(T("hints"))) === 1, `${tag}: hint shown`);
  const hintTxt = (await text(T("hints"))).toLowerCase(); for (const n of [c.name, ...c.aliases]) check(!hintTxt.includes(n.toLowerCase()), `${tag}: hint names the answer (${n})`);
  await click(T("submit-answer"), 400); check((await count(T("feedback"))) === 1, `${tag}: wrong-answer feedback`);
  const fb = (await text(T("feedback"))).toLowerCase(); for (const n of [c.name, ...c.aliases]) check(!fb.includes(n.toLowerCase()), `${tag}: feedback names the answer (${n})`);
  check((await count(`${T("feedback")} li`)) >= 1, `${tag}: feedback names conflicting evidence`);
  check((await count(T("explanation"))) === 0, `${tag}: no explanation after a wrong answer`);
  await click(T("back-nmr"), 500); check((await count(T("nmr-view"))) === 1, `${tag}: back to the spectra`); await click(T("step-5"), 500);
  await click(`[data-structure="${c.id}"]`, 200); await click(T("submit-answer"), 500);
  check((await count(T("feedback-correct"))) === 1, `${tag}: correct answer accepted`);
  for (const s of ["ms", "ir", "nmr"]) check((await text(T(`explain-${s}`))).length > 40, `${tag}: explanation has the ${s} part`);
  const g = await geom(p); check(g.hx <= 1 && g.clipped.length === 0 && g.covered.length === 0, `${tag}: explanation view geometry (${g.hx}, ${g.clipped}, ${g.covered})`);
  // the notebook text was kept through all of this
  await click(T("step-2"), 400); check((await p.locator(T("notebook-mass")).first().inputValue()) === `M+ at ${c.ms.mMz}`, `${tag}: notebook kept`);
  check(errs.length === 0, `${tag}: console errors ${errs.join(" | ")}`);
}

for (const mode of MODES) for (const [w, h] of SIZES) for (const theme of THEMES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  if (theme === "dark" && ![1366, 390].includes(w)) continue; if (theme === "dark" && mode === "fullscreen") continue;
  const tag = `${mode} ${w}x${h} ${theme}`; console.log(tag);
  const { ctx, p, errs } = await open(w, h, mode, theme);
  const shot = (name) => (process.env.SHOTS ? p.screenshot({ path: `${out}/${mode}-${w}x${h}-${theme}-${name}.png` }) : null);
  await suite(p, errs, tag, { w, shot });
  if (mode === "newtab" && theme === "light") {
    await alignment(p, `${tag} alignment ${compoundsOfLevel("foundation")[0]}`, COMPOUNDS[compoundsOfLevel("foundation")[0]]);
    if (w === 1366) {
      await alignment(p, `${tag} alignment D2O`, COMPOUNDS.ethanol, true);
      for (const lv of ["foundation", "intermediate", "advanced"]) {
        // every unknown of the level: alignment against ITS data, then the full investigation of the first one
        await p.locator(T("step-1")).click(); await sleep(300); await p.locator(T(`level-${lv}`)).click(); await sleep(300);
        for (let i = 0; i < compoundsOfLevel(lv).length; i += 1) {
          const c = COMPOUNDS[compoundsOfLevel(lv)[i]]; await p.locator(T("start-investigation")).click(); await sleep(400);
          await alignment(p, `${tag} ${lv}/${c.id} alignment`, c); await p.locator(T("step-1")).click(); await sleep(300);
          await p.locator(T("next-unknown-sample")).click(); await sleep(400);
        }
        await investigate(p, errs, `${tag} ${lv} investigation`, lv);
        await p.locator(T("step-1")).click(); await sleep(300);
      }
    }
    if (w === 390) { await p.locator(T("step-1")).click(); await sleep(300); await p.locator(T("level-foundation")).click(); await investigate(p, errs, `${tag} foundation investigation`, "foundation"); }
    // the other tabs still open and work
    await p.click(T("tech-ms")); await sleep(600); check((await p.locator(T("stage-stepper")).getAttribute("data-count")) === "6", `${tag}: MS tab still opens`);
    await p.click(T("tech-ir")); await sleep(600); check((await p.locator(T("stage-stepper")).getAttribute("data-count")) === "9", `${tag}: IR tab still opens`);
    await p.click(T("tech-nmr")); await sleep(600); check((await p.locator(T("stage-stepper")).getAttribute("data-count")) === "6", `${tag}: NMR tab still opens`);
    await p.click(T("tech-structure")); await sleep(600); check((await p.locator(T("stage-stepper")).getAttribute("data-count")) === "5", `${tag}: back to the Structure Investigation tab (state kept)`);
  }
  check(errs.length === 0, `${tag}: console errors ${errs.join(" | ")}`);
  await ctx.close();
}
await browser.close(); if (server) server.kill();
console.log(`\n${checks} checks, ${problems.length} problem(s)`); if (problems.length) { console.log(problems.join("\n")); process.exit(1); }
