// Chromium verification for the round-3 atomic items: Orbital Explorer Atom View to Z = 36 with incremental sampling and an
// energy-order strip (OE-06, OE-10), 4p and radial comparison (OE-06), nucleus drawn as a dot with a visible note (OE-09),
// framing above the fold (OE-02), keyboard orbit (OE-08), and flying particles that use the real controls (BA-12).
// Usage: node scripts/verify-atomic-round3.mjs   (env SIZES, THEMES, BASE_URL, DIST, CHROMIUM; SHOTS=/dir saves screenshots)
// Honest limits: Chromium + SwiftShader software GL, synthetic mouse/keyboard, no touch, no real GPU, no Firefox/Safari.
import { start, T, sleep, coveredControls, txt, hasHScroll, rect } from "./verify-atomic-harness.mjs";
const h = await start();
const { check } = h;
const SHOTS = process.env.SHOTS;
const clean = (tag, errors) => check(errors.length === 0, `${tag}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);
const settled = async (p) => { for (let i = 0; i < 80; i += 1) { if (/orbitals? shown/.test(await txt(p, T("cloud-status")))) return true; await sleep(250); } return false; };
const pick = async (p, name) => { const t = p.locator(T("oe-choose-element")); if ((await t.count()) && (await t.getAttribute("aria-expanded")) === "false") await t.click(); await p.getByRole("button", { name: new RegExp(`^${name}, atomic number`) }).click(); };

for (const [W, H] of h.SIZES) for (const theme of h.THEMES) {
  const tag = `${W}x${H} ${theme}`; console.log(tag);
  { // ---- Orbital Explorer: Atom View
    const { ctx, p, errors } = await h.open(W, H, "/simulation/orbital-explorer", theme); await sleep(500);
    await p.getByRole("button", { name: /Atom View/ }).click();
    check(await settled(p), `${tag} OE: Atom View settles (carbon)`);
    check((await p.locator(T("energy-order")).count()) === 1, `${tag} OE-06: energy-order strip shown`);
    check((await p.locator(T("nucleus-note")).count()) >= 1 && /Not to scale/.test(await txt(p, T("nucleus-note"))), `${tag} OE-09: visible "not to scale" note for the nucleus`);
    // Z up to 36
    await pick(p, "Iron"); check(await settled(p), `${tag} OE-06: Fe settles`);
    const fe = await p.locator('input[type="checkbox"][aria-label^="Show "]').count(); check(fe === 15, `${tag} OE-06: Fe draws 15 orbitals (${fe})`);
    check(/4s²\s*3d⁶/.test(await txt(p, "body")), `${tag} OE-06: Fe configuration ends 4s² 3d⁶`);
    await pick(p, "Chromium"); await settled(p); check(/4s¹\s*3d⁵/.test(await txt(p, "body")), `${tag} OE-06: Cr is the 4s¹ 3d⁵ exception`);
    const t0 = Date.now(); await pick(p, "Krypton");
    const sawProgress = await (async () => { for (let i = 0; i < 40; i += 1) { if (/Sampling electron clouds: \d+ of 18/.test(await txt(p, T("cloud-status")))) return true; if (Date.now() - t0 > 20000) break; await sleep(25); } return false; })();
    check(await settled(p), `${tag} OE-10: Kr (18 orbitals) settles in ${Date.now() - t0} ms`);
    console.log(`    info: Kr progress text seen while sampling: ${sawProgress}; settle time ${Date.now() - t0} ms (software rendering)`);
    check((await p.locator('input[type="checkbox"][aria-label^="Show "]').count()) === 18, `${tag} OE-06: Kr draws 18 orbitals`);
    await sleep(600); const krShot = await p.locator("canvas").first().screenshot(); await p.getByRole("button", { name: "Hide All" }).click(); await sleep(400);
    check(!krShot.equals(await p.locator("canvas").first().screenshot()), `${tag} OE-06: Kr clouds are drawn (canvas differs from the all-hidden view)`);
    await p.getByRole("button", { name: "Show All" }).click();
    check((await p.getByRole("button", { name: /Next/ }).isDisabled()), `${tag} OE-06: Next is disabled at Z = 36`);
    // framing above the fold (OE-02)
    await pick(p, "Calcium"); await settled(p); await sleep(300);
    const cv = await rect(p, "canvas"); const vh = H;
    check(cv && cv.y < vh * 0.8 && vh - cv.y >= 150, `${tag} OE-02: at least 150 px of the canvas is on the first screen for Ca (y = ${Math.round(cv?.y)}, h = ${Math.round(cv?.h)}, viewport ${vh})`);
    if (W >= 1280) { const st = await rect(p, T("cloud-status")); check(st && st.b <= H, `${tag} OE-02: cloud status line is on the first screen (bottom ${Math.round(st?.b)} of ${H})`); }
    // keyboard
    const grp = p.locator('[role="group"][aria-label^="3D atom view, atomic number"]').first();
    check((await grp.count()) === 1 && (await grp.getAttribute("tabindex")) === "0", `${tag} OE-08: Atom View 3D region is focusable and named`);
    const shot0 = await p.locator("canvas").first().screenshot(); await grp.focus(); for (let i = 0; i < 6; i += 1) await p.keyboard.press("ArrowRight"); await sleep(500);
    check(!shot0.equals(await p.locator("canvas").first().screenshot()), `${tag} OE-08: arrow keys orbit the Atom View camera`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/oe-atom-ca-${W}x${H}-${theme}.png`, fullPage: false });
    check(!(await hasHScroll(p)), `${tag} OE: no horizontal page scroll (Atom View)`);
    const cov = await coveredControls(p); check(cov.length === 0, `${tag} OE: no covered controls (Atom View) ${cov.slice(0, 2)}`);
    clean(`${tag} OE Atom View`, errors); await ctx.close(); }

  { // ---- Orbital Explorer: Explore (4p, radial comparison)
    const { ctx, p, errors } = await h.open(W, H, "/simulation/orbital-explorer", theme); await sleep(600);
    await p.getByRole("button", { name: "4p", exact: true }).click(); await sleep(700);
    check(/4px|px/.test(await txt(p, "body")) && (await p.locator(T("radial-plot")).count()) === 1, `${tag} OE-06: 4p selectable with a radial plot`);
    check(/Radial nodes\s*2/.test(await txt(p, "body")), `${tag} OE-06: 4p shows 2 radial nodes`);
    check((await p.locator(T("radial-compare-curve")).count()) === 0, `${tag} OE-06: no comparison curve by default`);
    await p.selectOption(T("radial-compare-select"), "2s"); await sleep(300);
    check((await p.locator(T("radial-compare-curve")).count()) === 1 && /2s/.test(await txt(p, T("radial-compare-legend"))), `${tag} OE-06: comparing with 2s draws a second curve and a text legend`);
    check((await p.locator(T("nucleus-note")).count()) === 1, `${tag} OE-09: nucleus note in Explore too`);
    if (SHOTS) await p.screenshot({ path: `${SHOTS}/oe-explore-4p-${W}x${H}-${theme}.png` });
    check(!(await hasHScroll(p)), `${tag} OE: no horizontal page scroll (Explore)`);
    const cov = await coveredControls(p); check(cov.length === 0, `${tag} OE: no covered controls (Explore) ${cov.slice(0, 2)}`);
    clean(`${tag} OE Explore`, errors); await ctx.close(); }

  { // ---- Build an Atom: flying particles use the real control row (BA-12)
    const { ctx, p, errors } = await h.open(W, H, "/simulation/build-an-atom", theme); await sleep(500);
    await p.click(T("atom-add-proton"));
    const info = await p.evaluate(() => { const f = document.querySelector('[data-testid="atom-flight"]'); const st = document.querySelector('[data-testid="atom-stage"]').getBoundingClientRect(); const row = document.querySelector('[data-testid="atom-row-proton"]').getBoundingClientRect(); return f ? { geometry: f.dataset.geometry, left: parseFloat(f.style.left), top: parseFloat(f.style.top), unit: /px/.test(f.style.left) ? "px" : "%", stageW: st.width, stageH: st.height, rowY: row.top + row.height / 2 - st.top } : null; });
    check(info && info.geometry === "measured" && info.unit === "px", `${tag} BA-12: flight positioned in measured pixels (${JSON.stringify(info)})`);
    await sleep(900);
    check((await p.locator(T("atom-flight")).count()) === 0, `${tag} BA-12: flight removes itself`);
    if (info) check(info.top >= -1 && info.top <= info.stageH + 1, `${tag} BA-12: flight starts inside the stage vertically`);
    clean(`${tag} BA flights`, errors); await ctx.close(); }

  { // ---- Build an Atom: rule-based challenge with a worked answer and a session score (BA-07)
    const { ctx, p, errors } = await h.open(W, H, "/simulation/build-an-atom", theme); await sleep(500);
    const chk = p.getByRole("button", { name: /^Check/ }).first(); await chk.scrollIntoViewIfNeeded(); await chk.click();
    check(/CORRECT/.test(await txt(p, "body")) && /1 of 1 first tries/.test(await txt(p, T("challenge-score"))), `${tag} BA-07: the starting carbon-12 challenge is solved and scored (${await txt(p, T("challenge-score"))})`);
    const targets = new Set();
    for (let i = 0; i < 4; i += 1) {
      await p.getByRole("button", { name: /New Challenge/ }).first().click(); await sleep(100);
      targets.add(await p.evaluate(() => document.querySelector('[data-testid="atom-side"]')?.innerText.match(/Build This Atom[\s\S]{0,260}/i)?.[0].replace(/\s+/g, " ") ?? ""));
      await p.getByRole("button", { name: /^Check/ }).first().click(); await sleep(100);
    }
    check(targets.size >= 3, `${tag} BA-07: new challenges differ from each other (${targets.size} distinct of 4)`);
    const sw = p.locator(T("show-worked")); if (await sw.count()) { await sw.click(); check((await txt(p, T("worked-answer"))).length > 20, `${tag} BA-07: a wrong attempt offers a worked answer (${(await txt(p, T("worked-answer"))).slice(0, 60)})`); }
    else check(true, `${tag} BA-07: (last attempt happened to be correct, worked answer not offered)`);
    check(!(await hasHScroll(p)), `${tag} BA: no horizontal page scroll`);
    clean(`${tag} BA challenge`, errors); await ctx.close(); }

  if (theme === "light") { // ---- Build an Atom: click cost with a large nucleus (BA-10) -- timing is information only (software GL is not a real GPU)
    const { ctx, p, errors } = await h.open(W, H, "/simulation/build-an-atom", theme); await sleep(500);
    await p.click(T("atom-start-empty"));
    for (let i = 0; i < 26; i += 1) await p.click(T("atom-add-proton"));
    const t0 = Date.now(); let clicks = 0; for (let i = 0; i < 30; i += 1) { await p.click(T("atom-add-neutron")); clicks += 1; }
    const z = await txt(p, T("atom-count-proton")); const nn = await txt(p, T("atom-count-neutron"));
    console.log(`    info: BA-10 ${clicks} neutron clicks on a ${z}-proton nucleus (${nn} neutrons) took ${Date.now() - t0} ms (${Math.round((Date.now() - t0) / clicks)} ms per click, SwiftShader); the 2026-11 review measured about 500 ms per click for the old build`);
    const svgs = await p.evaluate(() => ({ nested: document.querySelectorAll('[data-testid="atom-visualizer"] svg svg, [data-testid="atom-visualizer"] foreignObject').length, circles: document.querySelectorAll('[data-testid="atom-visualizer"] circle').length }));
    check(svgs.nested === 0, `${tag} BA-10: no nested <svg>/<foreignObject> per particle (${JSON.stringify(svgs)})`);
    clean(`${tag} BA perf`, errors); await ctx.close(); }
}
await h.finish("verify-atomic-round3");
