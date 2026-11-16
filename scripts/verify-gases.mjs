#!/usr/bin/env node
// Headless-Chromium (SwiftShader) verification of the gases / states-of-matter simulations against the hostile probes of
// docs/sim-review/gases-states.md. Builds a TEMP production bundle and serves it with `vite preview` on a free port.
//   node scripts/verify-gases.mjs [outDir]        (set PREVIEW_DIST=/path/to/dist to skip the build)
// Honest limits: SwiftShader (no real GPU), Chromium only, no screen reader, no real touch, no real browser zoom (910x512 is a viewport size).
import fs from "node:fs";
import { launch, reporter, sleep } from "./harness/browser.mjs";
import { startPreview } from "./harness/preview.mjs";

const out = process.argv[2] || "/tmp/gases-verify";
fs.mkdirSync(out, { recursive: true });
const { base, stop } = await startPreview();
const browser = await launch();
const R = reporter();
const { check } = R;
const SIZES = [[1366, 768], [910, 512], [390, 844]];
const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
const want = (name) => !only || only.includes(name);

async function open(id, [w, h], { dark = false, reduced = false, dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, colorScheme: dark ? "dark" : "light", reducedMotion: reduced ? "reduce" : "no-preference", acceptDownloads: true });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await page.goto(`${base}/simulation/${id}`, { waitUntil: "networkidle" });
  await sleep(500);
  return { page, ctx, errors };
}
const noOverflow = (page) => page.evaluate(() => {
  const d = document.documentElement; const bad = [];
  for (const el of document.querySelectorAll(".sd-root *")) {
    const cs = getComputedStyle(el); if (cs.position === "fixed" || el.closest("[role=dialog],.sd-popover,[data-testid=settings-panel]")) continue;
    const r = el.getBoundingClientRect(); if (r.width === 0 || r.height === 0) continue;
    const root = document.querySelector(".sd-root").getBoundingClientRect();
    if (r.right > root.right + 2 && !el.closest("[aria-hidden=true],[inert]") && !el.closest(".rd-tablewrap,.sd-graph-plot,svg,canvas")) bad.push(`${el.tagName}.${String(el.className).slice(0, 30)} right ${Math.round(r.right)} > ${Math.round(root.right)}`);
  }
  return { docScrollX: d.scrollWidth > d.clientWidth + 1, bad: bad.slice(0, 5) };
});
const setRange = (page, testid, v) => page.evaluate(([t, x]) => { const el = document.querySelector(`[data-testid="${t}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(x)); el.dispatchEvent(new Event("input", { bubbles: true })); }, [testid, v]);
const txt = (page, sel) => page.locator(sel).first().innerText();
const focusRing = async (page, sel) => { await page.keyboard.press("Shift"); await page.locator(sel).first().focus(); return page.evaluate((s) => { const el = document.querySelector(s); const cs = getComputedStyle(el); return cs.outlineStyle !== "none" && parseFloat(cs.outlineWidth) >= 2 || /rgb/.test(cs.boxShadow); }, sel); };

// ============================================================== GAS LAWS
if (want("gl")) {
  console.log("\n== Gas Laws Explorer");
  const { page, ctx, errors } = await open("gas-laws-explorer", [1366, 768]);
  // opening state is an everyday gas
  check((await txt(page, '[data-testid="gauge-P-value"]')).includes("kPa"), "GL: pressure gauge reads kPa");
  check(/^9\d\.\d kPa$|^10\d\.\d kPa$/.test((await txt(page, '[data-testid="gauge-P-value"]')).replace(/\s+/g, " ").trim()), "GL: opening pressure is ~100 kPa");
  // GS-14: 273 K and 298 K exactly by typing; 273.15 K too
  await page.getByRole("radio", { name: /V.?T/ }).first().click().catch(() => {});
  await page.locator('[data-testid="tab-vt"]').click(); await sleep(150);
  const T = page.locator('[data-testid="input-gl-T"]');
  for (const v of ["273", "298", "273.15"]) { await T.fill(v); await T.press("Enter"); await sleep(120); check((await txt(page, '[data-testid="live-T"]')).replace(/\s+/g, " ").includes(`${v} K`), `GL: T set exactly to ${v} K`); }
  // GS-13: End on the slider gives a TRUE limit message naming the volume; Home does not claim a limit
  await page.locator('[data-testid="slider-T"]').focus(); await page.keyboard.press("End"); await sleep(400);
  const limit = await page.locator('[data-testid="limit-T"]').innerText().catch(() => "");
  check(/volume would go above 50/.test(limit), `GL: false "Limit reached" fixed: at the real end the note names the volume bound (${limit.slice(0, 70)})`);
  await page.keyboard.press("Home"); await sleep(150);
  check(!(await page.locator('[data-testid="limit-T"]').count()) || !/Limit reached/.test(await page.locator('[data-testid="limit-T"]').innerText()), "GL: no false limit note at the 100 K end");
  check((await page.locator('[data-testid="slider-T"]').getAttribute("min")) === "100", "GL: slider minimum label matches the real reachable minimum (100 K)");
  // typed out-of-range value: explicit message, not silent
  await T.fill("5000"); await T.press("Enter"); await sleep(120);
  check(/outside the range/.test(await page.locator('[data-testid="limit-T"]').innerText()), "GL: out-of-range typed value is reported, not silently clamped");
  // STP preset
  await page.locator('[data-testid="settings"]').click(); await sleep(150);
  await page.locator('[data-testid="preset-stp"]').click(); await sleep(150);
  check((await txt(page, '[data-testid="live-V"]')).replace(/\s+/g, " ").includes("22.7 dm"), "GL: STP preset gives V = 22.7 dm³");
  check((await txt(page, '[data-testid="live-P"]')).replace(/\s+/g, " ").includes("100.0 kPa"), "GL: STP preset gives 100.0 kPa");
  await page.locator('[data-testid="unit-system"] [role=radio]').nth(1).click(); await sleep(150);
  check((await txt(page, '[data-testid="live-P"]')).includes("atm"), "GL: switching to atm/L relabels the live strip");
  await page.locator('[data-testid="unit-system"] [role=radio]').nth(0).click(); await sleep(100);
  await page.keyboard.press("Escape");
  // readings: Boyle
  await page.locator('[data-testid="tab-pv"]').click(); await sleep(150);
  await page.locator('[data-testid="graph-toggle"]').click(); await sleep(500);
  await page.locator('[data-testid="view-switch"] [role=radio]').nth(1).click(); await sleep(200);
  for (const V of [10, 15, 20, 30, 40]) { await setRange(page, "slider-V", V); await sleep(80); await page.locator('[data-testid="record-reading"]').click(); await sleep(60); }
  check((await page.locator('[data-testid="reading-row"]').count()) === 5, "GL: 5 readings recorded into the table");
  await page.locator('[data-testid="record-reading"]').click(); await sleep(100);
  check(/same as the last reading/.test(await txt(page, '[data-testid="readings-status"]')), "GL: duplicate record is refused with a reason");
  check((await page.locator('[data-testid="reading-point"]').count()) === 5, "GL: graph plots the student's own 5 points (no pre-drawn theory)");
  await page.locator('[data-testid="axis-x"]').selectOption("invV"); await page.locator('[data-testid="axis-y"]').selectOption("P");
  await page.locator('[data-testid="show-fit"]').check(); await sleep(150);
  const fit = await txt(page, '[data-testid="fit-text"]');
  const slope = Number((/gradient ([0-9.]+)/.exec(fit) || [])[1]);
  check(Math.abs(slope - 8.31 * 273.15) / (8.31 * 273.15) < 0.002 && /R² = 1\.0000/.test(fit), `GL: P vs 1/V is straight with gradient nRT = ${(8.31 * 273.15).toFixed(0)} (${fit})`);
  await page.locator('[data-testid="show-theory"]').check(); await sleep(100);
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('[data-testid="export-csv"]').click()]);
  const csv = fs.readFileSync(await dl.path(), "utf8");
  check(/Reading,P \(kPa\)/.test(csv) && csv.split("\r\n").filter((l) => /^\d+,/.test(l)).length === 5, "GL: CSV has unit headers and 5 rows");
  const [dp] = await Promise.all([page.waitForEvent("download"), page.locator('[data-testid="export-png"]').click()]);
  const pngPath = await dp.path(); const png = fs.readFileSync(pngPath);
  check(png.slice(0, 8).toString("hex") === "89504e470d0a1a0a" && png.length > 3000, `GL: PNG export is a real PNG (${png.length} bytes)`);
  fs.copyFileSync(pngPath, `${out}/gl-readings-export.png`);
  await page.locator('[data-testid="delete-reading"]').first().click(); await sleep(80);
  check((await page.locator('[data-testid="reading-row"]').count()) === 4, "GL: delete removes one row");
  await page.locator('[data-testid="clear-readings"]').click(); await sleep(80); await page.locator('[data-testid="clear-readings"]').click(); await sleep(80); // two-step confirm
  check((await page.locator('[data-testid="reading-row"]').count()) === 0, "GL: clear empties the table");
  // combined mode
  await page.locator('[data-testid="tab-comb"]').click(); await sleep(200);
  check(await page.locator('[data-testid="calc-toggle"]').count() === 1, "GL: combined PV = nRT mode has a Calculate picker");
  await page.locator('[data-testid="calc-toggle"] [role=radio]').nth(2).click(); await sleep(150); // calculate T
  check((await page.locator('[data-testid="slider-T"]').count()) === 0 && (await page.locator('[data-testid="slider-P"]').count()) === 1, "GL: calculating T hides the T slider and frees P");
  await page.screenshot({ path: `${out}/gl-1366.png` });
  // keyboard focus visible
  check(await focusRing(page, '[data-testid="slider-V"]'), "GL: slider focus ring visible");
  check(errors.length === 0, `GL: no console errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  for (const sz of SIZES) for (const dark of [false, true]) {
    const o = await open("gas-laws-explorer", sz, { dark });
    await o.page.locator('[data-testid="graph-toggle"]').click().catch(() => {}); await sleep(400);
    const ov = await noOverflow(o.page);
    check(!ov.docScrollX && ov.bad.length === 0, `GL ${sz.join("x")} ${dark ? "dark" : "light"}: nothing clipped / no horizontal scroll ${ov.bad.join("; ")}`);
    await o.page.screenshot({ path: `${out}/gl-${sz.join("x")}-${dark ? "dark" : "light"}.png` });
    check(o.errors.length === 0, `GL ${sz.join("x")}: no console errors`);
    await o.ctx.close();
  }
  const rm = await open("gas-laws-explorer", [1366, 768], { reduced: true });
  check(rm.errors.length === 0, "GL: reduced motion loads without errors"); await rm.ctx.close();
}

// ============================================================== IDEAL GAS
if (want("ig")) {
  console.log("\n== Ideal Gas Simulation");
  const { page, ctx, errors } = await open("ideal-gas-simulation", [1366, 768]);
  check((await txt(page, '[data-testid="live-P"]')).replace(/\s+/g, " ").includes("100.0 kPa"), "IG: opening state is 100 kPa (not 30 atm)");
  check(!/strong/i.test(await txt(page, '[data-testid="deviation"]')), `IG: opening badge does not say 'strong deviation' (${(await txt(page, '[data-testid="deviation"]')).replace(/\s+/g, " ")})`);
  check((await txt(page, '[data-testid="live-V"]')).includes("dm"), "IG: volume in dm³");
  // typed STP-like values
  await page.locator('[data-testid="input-ig-T"]').fill("273.15"); await page.locator('[data-testid="input-ig-T"]').press("Enter"); await sleep(200);
  check((await txt(page, '[data-testid="live-T"]')).includes("273.15 K"), "IG: 273.15 K can be typed");
  // pressure from collisions gauge
  for (let i = 0; i < 20 && /moving/.test(await txt(page, '[data-testid="wall-gauge"]')); i++) await sleep(500);
  const samples = [];
  for (let i = 0; i < 8; i++) { await sleep(500); samples.push(Number((/(\d+) %/.exec(await txt(page, '[data-testid="wall-ratio"]')) || [])[1])); }
  const ratio = Math.round(samples.reduce((a, b) => a + b, 0) / samples.length);
  check(ratio > 70 && ratio < 140, `IG: collision-pressure gauge reads ~100 % of the kinetic value (${ratio} %)`);
  check(Number(await txt(page, '[data-testid="wall-hits"]')) > 3, "IG: piston hits per second are counted");
  // scale ticks drawn: canvas has labels? check piston scale controls and linear height proportion via model hook is not exposed; check settings
  await page.locator('[data-testid="settings"]').click(); await sleep(150);
  check(await page.locator('[data-testid="scale-switch"]').count() === 1, "IG: piston scale selector present (0-25, 0-100, log)");
  await page.locator('[data-testid="preset-stp"]').click(); await sleep(250);
  check((await txt(page, '[data-testid="live-V"]')).replace(/\s+/g, " ").includes("22.7 dm"), `IG: STP preset gives 22.7 dm³ (${await txt(page, '[data-testid="live-V"]')})`);
  await page.keyboard.press("Escape");
  // vapour-pressure limit is labelled
  await page.locator('[data-testid="gas-switch"] [role=radio]').nth(1).click(); await sleep(150);
  await page.locator('[data-testid="input-ig-T"]').fill("250"); await page.locator('[data-testid="input-ig-T"]').press("Enter");
  await page.locator('[data-testid="input-ig-P"]').fill("4000"); await page.locator('[data-testid="input-ig-P"]').press("Enter"); await sleep(300);
  const body = await txt(page, '[data-testid="control-panel"]');
  check(/qualitative|limit|outside/i.test(body), `IG: condensation / limit message is shown and labelled (${body.replace(/\s+/g, " ").slice(-160)})`);
  // readings
  await page.locator('[data-testid="graph-toggle"]').click(); await sleep(400);
  await page.locator('[data-testid="view-switch"] [role=radio]').nth(1).click(); await sleep(200);
  for (const P of [200, 500, 1000, 2000]) { await page.locator('[data-testid="input-ig-P"]').fill(String(P)); await page.locator('[data-testid="input-ig-P"]').press("Enter"); await sleep(150); await page.locator('[data-testid="record-reading"]').click(); await sleep(60); }
  check((await page.locator('[data-testid="reading-row"]').count()) >= 3, "IG: readings recorded");
  const [dl] = await Promise.all([page.waitForEvent("download"), page.locator('[data-testid="export-csv"]').click()]);
  check(/P \(kPa\)/.test(fs.readFileSync(await dl.path(), "utf8")), "IG: CSV exported with kPa units");
  await page.screenshot({ path: `${out}/ig-1366.png` });
  // reset restores everything
  await page.locator('[data-testid="reset"]').click(); await sleep(400);
  check((await txt(page, '[data-testid="live-P"]')).replace(/\s+/g, " ").includes("100.0 kPa") && (await page.locator('[data-testid="reading-row"]').count()) === 0, "IG: Reset restores the opening state and clears readings");
  check(errors.length === 0, `IG: no console errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  for (const sz of SIZES) for (const dark of [false, true]) {
    const o = await open("ideal-gas-simulation", sz, { dark });
    await o.page.locator('[data-testid="graph-toggle"]').click().catch(() => {}); await sleep(400);
    const ov = await noOverflow(o.page);
    check(!ov.docScrollX && ov.bad.length === 0, `IG ${sz.join("x")} ${dark ? "dark" : "light"}: nothing clipped ${ov.bad.join("; ")}`);
    await o.page.screenshot({ path: `${out}/ig-${sz.join("x")}-${dark ? "dark" : "light"}.png` });
    check(o.errors.length === 0, `IG ${sz.join("x")}: no console errors`);
    await o.ctx.close();
  }
}

// ============================================================== PARTICLE MODEL
if (want("pm")) {
  console.log("\n== Particle Model Visualizer");
  const { page, ctx, errors } = await open("particle-model-visualizer", [1366, 768]);
  await sleep(1500);
  const chamberLabel = await page.locator('[data-testid="particle-chamber"]').first().getAttribute("aria-label").catch(() => null);
  check(!!chamberLabel && /particles/.test(chamberLabel), `PM: chamber has an accessible description (${(chamberLabel || "").slice(0, 70)})`);
  const core = (fn) => page.evaluate(fn);
  const hasCore = await core(() => !!window.__particleCore);
  check(hasCore, "PM: shared particle core is running");
  if (hasCore) {
    const n0 = await core(() => window.__particleCore.particles.length);
    const floorGap = await core(() => Math.min(...window.__particleCore.particles.map((p) => p.y)));
    check(floorGap < 0.7, `PM: solid block sits on the floor (lowest particle centre ${floorGap.toFixed(2)} radii-units)`);
    for (const st of ["Liquid", "Gas", "Solid"]) {
      await page.getByRole("button", { name: new RegExp(`^${st}$`, "i") }).first().click();
      await sleep(1800);
      check((await core(() => window.__particleCore.particles.length)) === n0, `PM: particle count stays ${n0} in the ${st} state`);
    }
    await page.getByRole("button", { name: /^Gas$/i }).first().click().catch(() => {}); await sleep(3000);
    const pc = await core(() => window.__particleCore.pairCollisions);
    const wh = await core(() => window.__particleCore.wallHits);
    check(pc > 0 && wh > 0, `PM: gas particles collide with each other (${pc}) and the walls (${wh})`);
    // temperature changes mean KE in every state
    for (const st of ["Solid", "Liquid", "Gas"]) {
      await page.getByRole("button", { name: new RegExp(`^${st}$`, "i") }).first().click().catch(() => {}); await sleep(300);
      const settle = async () => { const t0 = await core(() => window.__particleCore.time); for (let i = 0; i < 80 && (await core(() => window.__particleCore.time)) - t0 < 3; i++) await sleep(500); };
      await setRange(page, "temperature-slider", 120); await settle();
      const lo = await core(() => window.__particleCore.getStats().meanKE);
      await setRange(page, "temperature-slider", 480); await settle();
      const hi = await core(() => window.__particleCore.getStats().meanKE);
      check(hi / lo > 2.8 && hi / lo < 5.5, `PM: mean KE rises with T in the ${st} state (x${(hi / lo).toFixed(2)}, ideal 4.0)`);
    }
  }
  check((await txt(page, '[data-testid="ke-readout"]')).includes("kinetic energy"), "PM: kinetic-energy readout is shown");
  await page.locator('[data-testid="rot-left"]').click(); await page.locator('[data-testid="zoom-in"]').click();
  check(await focusRing(page, '[data-testid="temperature-slider"]'), "PM: temperature slider focus ring visible");
  check(errors.length === 0, `PM: no console errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  for (const sz of SIZES) for (const dark of [false, true]) {
    const o = await open("particle-model-visualizer", sz, { dark });
    await sleep(800);
    const bad = await o.page.evaluate(() => { const d = document.documentElement; return d.scrollWidth > d.clientWidth + 1; });
    check(!bad, `PM ${sz.join("x")} ${dark ? "dark" : "light"}: no horizontal overflow`);
    await o.page.screenshot({ path: `${out}/pm-${sz.join("x")}-${dark ? "dark" : "light"}.png` });
    check(o.errors.length === 0, `PM ${sz.join("x")}: no console errors (${o.errors[0] || ""})`);
    await o.ctx.close();
  }
  const rm = await open("particle-model-visualizer", [1366, 768], { reduced: true });
  check(rm.errors.length === 0, "PM: reduced motion loads without errors"); await rm.ctx.close();
}

// ============================================================== EXPLORE MATTER
if (want("em")) {
  console.log("\n== Explore Matter & States");
  const { page, ctx, errors } = await open("explore-matter-and-states", [1366, 768], { dpr: 2 });
  const click = (name) => page.getByRole("button", { name }).first().click();
  check((await page.getByRole("button", { name: /Reveal next/ }).count()) === 0 && (await page.getByRole("button", { name: /^Next/ }).count()) === 1, "EM: 'Reveal next' renamed to 'Next'");
  await click(/^Next/); await sleep(200);
  check((await page.locator('[data-testid="need-sample"]').count()) === 1, "EM: first flow no longer dead-ends (the mass test offers to pick a sample)");
  await page.locator('[data-testid="pick-for-me"]').click(); await sleep(200);
  check((await page.getByRole("button", { name: /Test mass/ }).count()) === 1, "EM: picking a sample enables the mass test");
  await click(/Test mass/); await sleep(200);
  const body = await page.locator("main, body").first().innerText();
  check(/HAS MASS/.test(body), "EM: mass test concludes");
  await click(/^Next/); await sleep(200); await click(/Test volume/); await sleep(300);
  check(/OCCUPIES SPACE/.test(await page.locator("body").innerText()), "EM: volume test concludes");
  // go to the compare scene: canvases must be crisp at DPR 2 and the same N in every state
  await click(/Compare/); await sleep(1200);
  const info = await page.evaluate(() => [...document.querySelectorAll('[data-testid="particle-field"]')].map((c) => ({ mode: c.dataset.mode, n: c.dataset.count, ratio: c.width / c.clientWidth, label: c.getAttribute("aria-label") })));
  check(info.length === 3 && new Set(info.map((i) => i.n)).size === 1, `EM: three states drawn with the same number of particles (${info.map((i) => i.n).join(",")})`);
  check(info.every((i) => i.ratio > 1.9), `EM: canvases drawn at the device pixel ratio (backing/css = ${info.map((i) => i.ratio.toFixed(2)).join(",")})`);
  check(info.every((i) => /particles/.test(i.label)), "EM: canvases have a descriptive accessible name");
  await page.screenshot({ path: `${out}/em-compare-1366.png` });
  check(errors.length === 0, `EM: no console errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  for (const sz of SIZES) for (const dark of [false, true]) {
    const o = await open("explore-matter-and-states", sz, { dark, dpr: 1 });
    await o.page.getByRole("button", { name: /Compare/ }).first().click(); await sleep(900);
    const r = await o.page.evaluate(() => { const d = document.documentElement; const cs = [...document.querySelectorAll('[data-testid="particle-field"]')]; return { x: d.scrollWidth > d.clientWidth + 1, clipped: cs.some((c) => c.getBoundingClientRect().right > innerWidth + 1) }; });
    check(!r.x && !r.clipped, `EM ${sz.join("x")} ${dark ? "dark" : "light"}: nothing clipped / no horizontal scroll`);
    await o.page.screenshot({ path: `${out}/em-${sz.join("x")}-${dark ? "dark" : "light"}.png` });
    check(o.errors.length === 0, `EM ${sz.join("x")}: no console errors (${o.errors[0] || ""})`);
    await o.ctx.close();
  }
  const rm = await open("explore-matter-and-states", [1366, 768], { reduced: true });
  await rm.page.getByRole("button", { name: /Compare/ }).first().click(); await sleep(800);
  check(rm.errors.length === 0, "EM: reduced motion loads without errors"); await rm.ctx.close();
}

// ============================================================== HEATING CURVE
if (want("hc")) {
  console.log("\n== Phase Change & Heating Curve");
  for (const sz of SIZES) for (const dark of [false, true]) {
    const o = await open("phase-change-heating-curve", sz, { dark }); const p = o.page; await sleep(600);
    const g = await p.evaluate(() => {
      const r = (t) => document.querySelector(`[data-testid="${t}"]`).getBoundingClientRect();
      const pp = r("hc-particle-panel"); const cv = r("hc-particle-wrap"); const gp = r("hc-graph-panel"); const gw = r("hc-graph-wrap"); const ctl = r("hc-controls");
      const d = document.documentElement;
      return { canvasInPanel: cv.bottom <= pp.bottom + 1 && cv.right <= pp.right + 1, graphInPanel: gw.bottom <= gp.bottom + 1, noHScroll: d.scrollWidth <= d.clientWidth + 1, controlsBelow: ctl.top >= Math.max(pp.bottom, gp.bottom) - 1, canvasH: Math.round(cv.height), graphH: Math.round(gw.height) };
    });
    const tag = `HC ${sz.join("x")} ${dark ? "dark" : "light"}`;
    check(g.canvasInPanel && g.graphInPanel, `${tag}: canvas and graph stay inside their panels (canvas ${g.canvasH}px, graph ${g.graphH}px)`);
    check(g.noHScroll && g.controlsBelow, `${tag}: no horizontal scroll, controls do not overlap the panels`);
    check((await p.locator('[data-testid="hc-x-label"]').textContent()).includes("schematic"), `${tag}: time axis is labelled schematic`);
    await p.screenshot({ path: `${out}/hc-${sz.join("x")}-${dark ? "dark" : "light"}.png` });
    check(o.errors.length === 0, `${tag}: no console errors (${o.errors[0] || ""})`);
    await o.ctx.close();
  }
  const { page, ctx, errors } = await open("phase-change-heating-curve", [1366, 768]);
  await page.locator('[data-testid="hc-to-scale"]').check(); await sleep(300);
  check(/to scale/.test(await page.locator('[data-testid="hc-x-label"]').textContent()) && (await page.locator('[data-testid="hc-x-tick"]').count()) === 5, "HC: to-scale axis shows real seconds");
  await setRange(page, "hc-slider", 450); await sleep(250);
  const w = await txt(page, '[data-testid="hc-working"]');
  check(/Q = m/.test(w) && /J/.test(w), `HC: worked energy calculation is shown (${w.slice(0, 80)})`);
  await page.locator('[data-testid="hc-mass"]').fill("5000"); await sleep(200);
  check(/limited to 1/.test(await txt(page, '[data-testid="hc-limit-note"]')), "HC: out-of-range mass is explained, not silently clamped");
  check((await txt(page, '[data-testid="hc-names"]')).includes("Names"), "HC: names of the changes of state (incl. sublimation) available");
  await page.locator('[data-testid="hc-names"] summary').click(); await sleep(100);
  check(/sublimation/i.test(await txt(page, '[data-testid="hc-names"]')), "HC: sublimation and deposition are named");
  check(await focusRing(page, '[data-testid="hc-play"]'), "HC: play button focus ring visible");
  check(errors.length === 0, `HC: no console errors (${errors.slice(0, 2).join(" | ")})`);
  await ctx.close();
  const rm = await open("phase-change-heating-curve", [1366, 768], { reduced: true });
  check(rm.errors.length === 0, "HC: reduced motion loads without errors"); await rm.ctx.close();
}

await browser.close();
stop();
R.done();
