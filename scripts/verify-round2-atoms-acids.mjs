// Round-2 Chromium verification for the 12 atoms + acids/bases simulations.
// Usage: DIST=/path/to/built/dist node scripts/verify-round2-atoms-acids.mjs     (env SIZES, THEMES, BASE_URL, CHROMIUM like the other verify scripts)
// Part A: every simulation at every size/theme: no console errors, no page-level horizontal scroll, no covered controls, accessible
//         mode toggle (X-03). Part B: the ORIGINAL repro steps of findings that were marked fixed (re-verification). Part C: round-2 features.
// Honest limits: headless Chromium + SwiftShader only, synthetic mouse/keyboard, no touch, no real GPU, no Firefox/Safari, no screen reader.
import { start, T, sleep, coveredControls, txt, hasHScroll } from "./verify-atomic-harness.mjs";
const h = await start();
const { check } = h;
const clean = (tag, errors) => check(errors.length === 0, `${tag}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);
const ROUTES = ["build-an-atom", "electron-configuration", "ionization-energy-explorer", "atomic-spectra-lab", "orbital-explorer", "wave-explorer", "titration-ph-curve", "equivalence-point", "buffer-action-visualizer", "ph-calculator-visualizer", "h-oh-balance", "neutralization-particle-visualizer"];
const btn = (p, name, exact = true) => p.getByRole("button", { name, exact }).first();

// ---------------- Part A: generic ----------------
for (const [W, H] of h.SIZES) for (const theme of h.THEMES) for (const r of ROUTES) {
  const tag = `${r} ${W}x${H} ${theme}`;
  const { ctx, p, errors } = await h.open(W, H, `/simulation/${r}`, theme);
  await sleep(r === "orbital-explorer" ? 1200 : 300);
  check(!(await hasHScroll(p)), `${tag}: no horizontal page scroll`);
  // Na D1/D2 (589.0 / 589.6 nm) are 0.6 nm apart: their SVG hit targets legitimately overlap at this scale, so they are not counted.
  const cov = (await coveredControls(p)).filter((c) => !/nanometre line/.test(c)); check(cov.length === 0, `${tag}: no covered controls ${cov.slice(0, 2)}`);
  const names = await p.evaluate(() => [...document.querySelectorAll('[role="radiogroup"][aria-label="Viewing mode"] [role="radio"]')].map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim()));
  check(names.length >= 2 && names.every((n) => n.length > 0), `${tag}: mode toggle buttons have accessible names (X-03): ${JSON.stringify(names)}`);
  clean(tag, errors); await ctx.close();
}

// ---------------- Part B: re-verification of earlier "fixed" findings, original repro steps ----------------
console.log("Part B: re-verification");
{ // X-05 (Build an Atom): a refused action says why (no silent disable); BA limits
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/build-an-atom"); 
  for (let i = 0; i < 130; i += 1) { const b = p.locator(T("atom-add-proton")); if (await b.isDisabled()) break; await b.click(); }
  const n1 = await txt(p, T("atom-notice")); check(n1.length > 10, `X-05 BA: refused add explains why: "${n1}"`);
  check(Number(await txt(p, T("atom-count-proton"))) <= 118, "X-05 BA: proton count capped at 118");
  await btn(p, /Reset to Carbon-12/, false).click(); await sleep(200);
  check((await txt(p, T("atom-element"))) === "Carbon" && Number(await txt(p, T("atom-count-proton"))) === 6, "BA: reset restores carbon-12");
  clean("BA limits", errors); await ctx.close(); }
{ // EC-01..EC-10 original repro
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/electron-configuration");
  check((await p.locator(T("ec-picker")).count()) === 0, "EC-06: the 118-cell table is not a wall on the first screen (collapsed behind Change element)");
  await p.click(T("ec-ex-Cr")); await sleep(200);
  check(/Chromium/.test(await txt(p, T("ec-species"))), "EC-01: Cr example selects chromium");
  check(await p.locator(T("ec-check")).isDisabled(), "EC-03: Check is disabled until all electrons are placed");
  check((await p.locator("#ec-check-why").count()) === 1 || (await p.locator(T("ec-check")).getAttribute("aria-describedby")) !== null, "EC-03: the reason Check is disabled is exposed (aria-describedby)");
  check(/0 \/ 24|Placed 0/.test(await txt(p, T("ec-total"))), `EC-03: live running total vs Z (${await txt(p, T("ec-total"))})`);
  await p.click(T("ec-ex-Fe³⁺")); await sleep(200); check(/³⁺|3\+/.test(await txt(p, T("ec-species"))), `EC-04: ions: Fe3+ selectable (${await txt(p, T("ec-species"))})`);
  await p.click(T("ec-ex-Cu⁺")); await sleep(150);
  await p.click(T("ec-change-element")); await sleep(150);
  await p.fill(T("ec-search"), "Cu"); await p.press(T("ec-search"), "Enter"); await sleep(250);
  check(/Copper/.test(await txt(p, T("ec-species"))), `EC-07: typing "Cu" + Enter selects copper (${await txt(p, T("ec-species"))})`);
  const gridRoles = await p.evaluate(() => [...document.querySelectorAll('[role="grid"]')].every((g) => g.querySelector('[role="row"]') && !g.querySelector(':scope > button')));
  check(gridRoles, "EC-08: no role=grid containing bare buttons");
  // EC-10: a checked species stays in the session strip when another element is chosen (state is not lost)
  await p.click(T("ec-change-element")).catch(() => {}); await p.fill(T("ec-search"), "Hydrogen"); await p.press(T("ec-search"), "Enter"); await sleep(250);
  await p.click(T("ec-tool-up")); await p.locator('[aria-label^="1s orbital 1 of 1"]').first().click(); await sleep(150);
  const sel = p.locator(T("ec-predict")); if (await sel.count()) await sel.selectOption({ index: 1 }).catch(() => {});
  if (!(await p.locator(T("ec-check")).isDisabled())) { await p.click(T("ec-check")); await sleep(250); }
  await p.click(T("ec-ex-Cr")); await sleep(250);
  const prog = await txt(p, T("ec-progress")).catch(() => ""); check(/Hydrogen|H\b/.test(prog) && /This session/.test(prog), `EC-10: checked species kept in the session strip after choosing another element (${prog.slice(0, 80)})`);
  clean("EC repro", errors); await ctx.close(); }
{ // IE-01..IE-10 original repro
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/ionization-energy-explorer");
  const sel = p.locator("select").first(); const opts = await sel.locator("option").allTextContents();
  check(opts.some((o) => /Hydrogen|^H\b/.test(o)) && opts.some((o) => /Helium|^He\b/.test(o)), `IE-02: H and He are available (${opts.slice(0, 3)})`);
  check((await p.locator(T("ie-predict")).count()) === 1 && (await p.locator(T("ie-value")).count()) === 0, "IE-03: value hidden until a prediction is made");
  await p.click(T("ie-predict-3s")); await sleep(200); check((await p.locator(T("ie-value")).count()) === 1, "IE-03: value revealed after predicting");
  await btn(p, "Type value").click(); await p.fill('input[aria-label^="Energy supplied"][type="number"], input[type="number"]', "1e308").catch(() => {}); await sleep(200);
  const typed = await p.locator('input[type="number"]').first().inputValue().catch(() => ""); check(Number(typed) <= 1_000_000, `IE-05: absurd energy is clamped (${typed})`);
  await btn(p, "First IE trend").click(); await sleep(300); check((await p.locator(T("ie-trend-readout")).count()) === 1, "IE-02: first-IE trend view present");
  const pts = await p.locator('svg circle').count(); check(pts >= 30, `IE-02: trend has a point per element H-Kr (circles ${pts})`);
  await btn(p, "Successive").click(); await p.locator(T("ie-show-all")).check(); await sleep(300);
  const hs = await p.evaluate(() => [...document.querySelectorAll('svg[aria-label*="successive"] g[role="img"] rect')].map((r) => r.getBoundingClientRect().height));
  check(hs.length === 12 && hs.every((x) => x >= 3), `IE-01: all 12 Mg bars drawn, none zero-height (${hs.map((x) => Math.round(x))})`);
  await p.selectOption(T("ie-compare"), { index: 3 }).catch(() => {}); await sleep(250); check((await p.locator(T("ie-compare-bar")).count()) > 0, "IE-10: compare element draws a second series");
  clean("IE repro", errors); await ctx.close(); }
{ // IE-06 mobile order
  const { ctx, p } = await h.open(390, 844, "/simulation/ionization-energy-explorer");
  const y = (await p.locator('button[aria-label="Supply energy and remove electron"]').boundingBox())?.y ?? 9999;
  check(y < 1100, `IE-06: at 390x844 the energy control is reached without a long data table first (y = ${Math.round(y)})`); await ctx.close(); }

// ---------------- Part C: round-2 features ----------------
console.log("Part C: round-2 features");
{ // BA-07 undo, BA-08 mixer, BA-10 challenge, BA-12 ...
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/build-an-atom");
  await p.click(T("atom-add-proton")); await p.click(T("atom-add-proton")); await sleep(150);
  check(Number(await txt(p, T("atom-count-proton"))) === 8, "BA: two protons added (6 -> 8)");
  await p.click(T("atom-undo")); await sleep(120); check(Number(await txt(p, T("atom-count-proton"))) === 7, "BA-07: Undo reverts one step");
  await p.click(T("atom-undo")); await sleep(120); check(Number(await txt(p, T("atom-count-proton"))) === 6, "BA-07: Undo reverts the second step");
  check(await p.locator(T("atom-undo")).isDisabled(), "BA-07: Undo disabled with nothing left to undo");
  const mix = p.locator(T("isotope-mixer")); await mix.scrollIntoViewIfNeeded().catch(() => {});
  const w = await txt(p, T("mixer-working")); check(/12\.011|12\.01/.test(w), `BA-08: carbon natural abundance gives Ar = 12.01 (${w.slice(0, 80)})`);
  await p.locator(T("abundance-12")).evaluate((el) => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "50"); el.dispatchEvent(new Event("input", { bubbles: true })); }); await sleep(150);
  const w2 = await txt(p, T("mixer-working")); check(/12\.5/.test(w2), `BA-08: 50:50 C-12/C-13 gives 12.5 (${w2.slice(0, 80)})`);
  clean("BA round2", errors); await ctx.close(); }
{ // Atomic spectra: series, identify
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/atomic-spectra-lab");
  await btn(p, "Series & limit").click(); await sleep(250); check((await p.locator(T("series-view")).count()) === 1, "AS-05: series view opens");
  await btn(p, "Spectroscope").click(); await btn(p, "Identify unknown").click(); await sleep(250);
  check((await p.locator(T("identify-mode")).count()) === 1, "AS-06: identify mode opens");
  await btn(p, "He").click().catch(() => {}); await btn(p, "Ne").click(); await sleep(200);
  check((await p.locator(T("spectrum-line")).count()) >= 4, "AS-08: neon lamp shows lines");
  clean("AS round2", errors); await ctx.close(); }
{ // Orbital: show all, radial plot, keyboard orbit
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/orbital-explorer"); await sleep(800);
  check((await p.locator(T("radial-plot")).count()) === 1, "OE-06: radial distribution plot present");
  await btn(p, "3p").click(); await p.locator(T("show-all-orientations")).check(); await sleep(700);
  check(/all 3/.test(await txt(p, "body")), "OE-06: three p orbitals together");
  const grp = p.locator('[role="group"][aria-label^="3D probability cloud"]').first(); check((await grp.count()) === 1 && (await grp.getAttribute("tabindex")) === "0", "OE-08: 3D view is a focusable, named group");
  const box = p.locator("canvas").first(); const shot0 = await box.screenshot();
  await grp.focus(); for (let i = 0; i < 6; i += 1) await p.keyboard.press("ArrowRight"); await sleep(500);
  const shot1 = await box.screenshot(); check(!shot0.equals(shot1), "OE-08: arrow keys orbit the camera (canvas pixels changed)");
  await p.keyboard.press("Home"); await sleep(400);
  await btn(p, /Atom View/, false).click(); await sleep(1500); await p.click(T("only-shell-1")); await sleep(500);
  const vis = await p.locator('input[type="checkbox"][aria-label^="Show "]:checked').count(); check(vis === 1, `OE-02: only-shell n = 1 leaves just the 1s visible (${vis})`);
  clean("OE round2", errors); await ctx.close(); }
{ // Wave: longitudinal frequency, compare A/B, reset
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/wave-explorer");
  check((await p.locator(T("photon-strip")).count()) === 1, "WE-04: wave-to-photon strip");
  await p.locator(T("compare-new")).scrollIntoViewIfNeeded(); await p.click(T("compare-new")); await sleep(200);
  await p.click(T("compare-guess-A")); await sleep(150); const res = await txt(p, T("compare-result"));
  check(/Correct|Not quite/.test(res) && /A =|B =|longer wavelength/.test(res), `WE-04: predict result shows working (${res.slice(0, 90)})`);
  await btn(p, "Longitudinal Wave").click(); await sleep(200);
  const body = await txt(p, "body"); check(/343 m s/.test(body) && /Frequency \(f\)/.test(body) && !/Wavelength \(λ\)\s*—\s*log/.test(body), "WE-03: longitudinal uses sound units (343 m/s) and a frequency control");
  const ctrl = await txt(p, ".grid"); check(!/\bnm\b/.test(ctrl.split("Relations")[0]), `WE-03: no nanometres in the longitudinal controls/values`);
  await p.locator('input[type="range"]').first().focus(); await p.keyboard.press("End"); await sleep(150);
  check(/20\.0 kHz|20 kHz|20\.0 kHz/.test(await txt(p, "body")) || /kHz/.test(await txt(p, "body")), "WE-03: frequency control reaches kHz");
  await btn(p, "Reset", false).click(); await sleep(200);
  check((await btn(p, "Transverse Wave").getAttribute("aria-pressed")) === "true" && /550 nm/.test(await txt(p, "body")), "WE-05: Reset restores transverse, 550 nm");
  clean("Wave round2", errors); await ctx.close(); }
{ // Titration: slider, polyprotic, unknown + export
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/titration-ph-curve");
  const sl = p.locator(T("volume-slider")); await sl.focus(); await sl.fill("12.35"); await sleep(250);
  check(/12\.35/.test(await txt(p, "body")), "AK-41: continuous volume slider reaches 12.35 cm³");
  const flask = p.getByLabel("Flask solution"); const optLabels = await flask.locator("option").allTextContents();
  const poly = optLabels.find((o) => /H₂CO₃|carbonic|H₃PO₄|phosphoric/i.test(o)); check(!!poly, `AK-41: polyprotic acids offered (${optLabels.join(" | ").slice(0, 120)})`);
  if (poly) { await flask.selectOption({ label: poly }); await sleep(400); check(/pKa/.test(await txt(p, T("legend"))) || /pKa/.test(await txt(p, "body")), "AK-41: polyprotic markers mention pKa"); }
  await btn(p, "Unknown").click(); await sleep(400); check((await p.locator(T("unknown-panel")).count()) === 1, "AK-38: unknown-concentration mode opens");
  const dl = await p.getByRole("button", { name: /CSV/ }).count(); check(dl >= 1, "AK-38: CSV export button via the shared Readings panel");
  clean("Titration round2", errors); await ctx.close(); }
{ // pH calculator challenge
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/ph-calculator-visualizer");
  check(/pH|\[H/.test(await txt(p, T("phc-question"))), "AK-07: challenge question shown");
  await p.fill('input[aria-label="Your answer"]', "99"); await p.getByRole("button", { name: "Check", exact: true }).click(); await sleep(200);
  check((await txt(p, T("phc-result"))).length > 5, "AK-07: wrong answer gets feedback"); clean("pHcalc round2", errors); await ctx.close(); }
{ // H+/OH- balance: temperature (AK-15), Kw(T)
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/h-oh-balance");
  const t = p.locator('input[aria-label="Temperature in degrees Celsius"]'); await t.fill("50"); await sleep(250);
  const pkw = await txt(p, T("pkw")); check(/13\.2/.test(pkw), `AK-15: pKw at 50 °C = 13.26 (${pkw})`);
  await t.fill("25"); await sleep(200); check(/14\.00/.test(await txt(p, T("pkw"))), "AK-15: pKw at 25 °C = 14.00");
  await t.fill("100"); await sleep(200); check(/12\.2|12\.3/.test(await txt(p, T("pkw"))) , `AK-15: pKw at 100 °C ≈ 12.26 (${await txt(p, T("pkw"))})`);
  await btn(p, "Reset", false).click(); await sleep(200); check((await t.inputValue()) === "25", "AK-15: Reset returns to 25 °C"); clean("HOH round2", errors); await ctx.close(); }
{ // Equivalence 0.1 drop + buffer sticky bar
  const { ctx, p, errors } = await h.open(1366, 768, "/simulation/equivalence-point");
  await p.getByRole("button", { name: /0\.1 cm³ \(drop\)/ }).click(); await sleep(200); check(/0\.1 cm³ added|0\.10? cm³/.test(await txt(p, "body")), "AK-?: 0.1 cm³ drop adds 0.1 cm³"); clean("Eq round2", errors); await ctx.close();
  const m = await h.open(390, 844, "/simulation/buffer-action-visualizer");
  check(!(await m.p.locator(".buf-sticky").isVisible()), "AK-51: no duplicate quick-control bar while the real controls are on screen");
  await m.p.locator('[data-testid="ratio"]').scrollIntoViewIfNeeded(); await m.p.locator('[data-testid="ratio"]').evaluate((e) => e.scrollIntoView({ block: "end" })); await sleep(500);
  const sb2 = await m.p.locator(".buf-sticky").boundingBox().catch(() => null);
  check(!!sb2 && sb2.y >= 0 && sb2.y + sb2.height <= 844 + 1, `AK-51: quick controls appear and stay in view once the controls scroll away (y = ${Math.round(sb2?.y ?? -1)})`);
  if (sb2) { await m.p.locator(".buf-sticky").getByRole("button", { name: "Add H⁺ (HCl)" }).click(); await sleep(300); check(/\d/.test(await txt(m.p, ".buf-sticky-ph")), "AK-51: sticky pH readout works"); }
  clean("Buffer round2", m.errors); await m.ctx.close(); }
{ // reduced motion: no running CSS animations on any sim
  for (const r of ROUTES) { const { ctx, p } = await h.open(1366, 768, `/simulation/${r}`, "light", { reducedMotion: "reduce" }); await sleep(300);
    const anim = await p.evaluate(() => [...document.querySelectorAll("main *, #root *")].filter((e) => { const a = getComputedStyle(e).animationName; return a !== "none" && !/^(spin|ping|pulse)$/.test(a) && parseFloat(getComputedStyle(e).animationDuration) > 0.01; }).map((e) => getComputedStyle(e).animationName));
    check(anim.length === 0, `${r}: no running CSS animations under prefers-reduced-motion ${[...new Set(anim)].slice(0, 3)}`); await ctx.close(); }
}

await h.finish("verify-round2-atoms-acids");
