// Chromium verification: Electron Configuration, Ionization Energy, Atomic Spectra Lab, Orbital Explorer, Wave Explorer.
// Usage: DIST=/path/to/built/dist node scripts/verify-atomic-sims.mjs   (env SIZES, THEMES, BASE_URL, CHROMIUM)
// Honest limits: Chromium + software GL only, synthetic mouse/keyboard, no touch, no real GPU, no Firefox/Safari.
import { start, T, sleep, coveredControls, txt, hasHScroll } from "./verify-atomic-harness.mjs";
const h = await start();
const { check } = h;
const clean = (tag, errors) => check(errors.length === 0, `${tag}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);

for (const [W, H] of h.SIZES) for (const theme of h.THEMES) {
  const tag = `${W}x${H} ${theme}`;
  console.log(tag);

  // ---- Electron Configuration
  { const { ctx, p, errors } = await h.open(W, H, "/simulation/electron-configuration", theme);
    check(!(await hasHScroll(p)), `${tag} EC: no horizontal page scroll`);
    check((await p.locator(T("ec-root")).count()) === 1, `${tag} EC: root renders`);
    // first screen must not leak the answer: no configuration string until Check
    const body = await txt(p, "body");
    check(!/1s²\s*2s²/.test(body) || (await p.locator(T("ec-answer")).count()) === 0, `${tag} EC: answer not shown on first screen`);
    check((await coveredControls(p, T("ec-root"))).length === 0, `${tag} EC: no covered controls: ${(await coveredControls(p, T("ec-root"))).slice(0, 2)}`);
    // Enter in search works
    await p.click(T("ec-change-element")); await sleep(150);
    await p.fill(T("ec-search"), "iron"); await p.press(T("ec-search"), "Enter"); await sleep(250);
    check(/Iron/.test(await txt(p, T("ec-species"))), `${tag} EC: search + Enter selects iron (${await txt(p, T("ec-species"))})`);
    // charge refusal explained
    for (let i = 0; i < 12; i += 1) await p.click(T("ec-charge-plus"));
    await sleep(150);
    check((await txt(p, T("ec-notice"))).length > 10, `${tag} EC: max charge refusal explained: ${await txt(p, T("ec-notice"))}`);
    // keyboard: grid focusable, Enter places an electron
    await p.locator(`${T("ec-grid")} [role="button"], ${T("ec-grid")} button`).first().focus().catch(() => {});
    await p.keyboard.press("Enter"); await sleep(150);
    const total = await txt(p, T("ec-total"));
    check(/Placed 1 \//.test(total), `${tag} EC: keyboard Enter places an electron (${total})`);
    clean(`${tag} EC`, errors); await ctx.close(); }

  // reduced motion
  if (theme === "light") { const { ctx, p, errors } = await h.open(W, H, "/simulation/electron-configuration", theme, { reducedMotion: "reduce" });
    const anim = await p.evaluate(() => [...document.querySelectorAll('[data-testid="ec-root"] *')].filter((e) => getComputedStyle(e).animationName !== "none").length);
    check(anim === 0, `${tag} EC: no running animations under prefers-reduced-motion (${anim})`);
    await ctx.close(); }

  // ---- Ionization Energy
  { const { ctx, p, errors } = await h.open(W, H, "/simulation/ionization-energy-explorer", theme);
    check(!(await hasHScroll(p)), `${tag} IE: no horizontal page scroll`);
    check((await coveredControls(p)).length === 0, `${tag} IE: no covered controls: ${(await coveredControls(p)).slice(0, 2)}`);
    clean(`${tag} IE`, errors); await ctx.close(); }

  // ---- Atomic Spectra Lab: cold hydrogen absorption has no Balmer dark lines
  { const { ctx, p, errors } = await h.open(W, H, "/simulation/atomic-spectra-lab", theme);
    check(!(await hasHScroll(p)), `${tag} AS: no horizontal page scroll`);
    await p.getByRole("button", { name: "H", exact: true }).first().click();
    await p.getByRole("button", { name: "Absorption", exact: true }).first().click(); await sleep(200);
    let body = await txt(p, "body");
    check(/Lyman/.test(body) && /no Balmer dark lines/.test(body), `${tag} AS: cold H explains Lyman, no Balmer`);
    const visLines = await p.locator('svg[aria-label*="absorption spectrum, wavelength axis 380"] [data-testid="spectrum-line"]').count();
    check(visLines === 0, `${tag} AS: no dark lines in the visible strip for cold H (${visLines})`);
    await p.getByRole("button", { name: /Hot excited gas/ }).click(); await sleep(200);
    const hot = await p.locator('svg[aria-label*="absorption spectrum, wavelength axis 380"] [data-testid="spectrum-line"]').count();
    check(hot === 4, `${tag} AS: hot H shows 4 Balmer dark lines (${hot})`);
    // Energy levels: reset after ionisation
    await p.getByRole("button", { name: "Energy Levels" }).click(); await sleep(200);
    await p.getByRole("button", { name: /n1→∞/ }).click(); await sleep(100);
    await p.getByRole("button", { name: "Send Photon" }).click(); await sleep(200);
    body = await txt(p, "body");
    check(/IONIZED/.test(body) && /New hydrogen atom/.test(body), `${tag} AS: ionisation state offers a new atom`);
    await p.getByRole("button", { name: /New hydrogen atom/ }).click(); await sleep(150);
    check(/n = 1/.test(await txt(p, "body")) && !/IONIZED/.test(await txt(p, "body")), `${tag} AS: reset after ionisation`);
    check((await coveredControls(p)).length === 0, `${tag} AS: no covered controls`);
    clean(`${tag} AS`, errors); await ctx.close(); }

  // ---- Orbital Explorer
  { const { ctx, p, errors } = await h.open(W, H, "/simulation/orbital-explorer", theme);
    check(!(await hasHScroll(p)), `${tag} OE: no horizontal page scroll`);
    let body = await txt(p, "body");
    check(!/not yet available/i.test(body), `${tag} OE: no "not yet available" text`);
    check(/Hydrogen-like orbitals/.test(body), `${tag} OE: hydrogenic disclosure visible`);
    check(await p.getByRole("button", { name: /Atom View/ }).count() === 1 && (await p.getByRole("button", { name: "Build an Atom" }).count()) === 0, `${tag} OE: mode renamed`);
    check((await p.locator('[role="group"][aria-label^="3D view"]').count()) === 1, `${tag} OE: canvas group has an accessible description`);
    // cap
    for (let i = 0; i < 45; i += 1) await p.getByRole("button", { name: "+1000", exact: true }).click({ timeout: 1500 }).catch(() => {});
    await sleep(300);
    body = await txt(p, "body");
    check(/40,000 detections/.test(body) && /Maximum of 40,000/.test(body), `${tag} OE: detections capped at 40,000 with a message`);
    check(await p.getByRole("button", { name: "+1000", exact: true }).isDisabled(), `${tag} OE: +1000 disabled at the cap`);
    await p.getByRole("button", { name: "Clear" }).click(); await sleep(150);
    check(/0 detections/.test(await txt(p, "body")), `${tag} OE: Clear resets count`);
    await p.getByRole("button", { name: "3d", exact: true }).click(); await sleep(300);
    check(/8,000 detections/.test(await txt(p, "body")), `${tag} OE: d orbital opens with 8,000 detections`);
    clean(`${tag} OE`, errors); await ctx.close(); }

  // ---- Wave Explorer
  { const { ctx, p, errors } = await h.open(W, H, "/simulation/wave-explorer", theme);
    check(!(await hasHScroll(p)), `${tag} WE: no horizontal page scroll`);
    const amp = p.getByLabel("Amplitude, relative");
    await amp.fill("0"); await sleep(150);
    check(/Amplitude = 0/.test(await txt(p, "body")), `${tag} WE: amplitude 0 shows a flat wave and says so`);
    await p.getByRole("button", { name: "Whole EM spectrum" }).click(); await sleep(150);
    const wl = p.getByLabel(/Wavelength, logarithmic/);
    await wl.fill("0"); await sleep(100);
    check(/Gamma rays/.test(await txt(p, "body")) && /pm/.test(await txt(p, "body")), `${tag} WE: slider min reaches gamma rays (picometres)`);
    await wl.fill("1"); await sleep(100);
    check(/Radio waves/.test(await txt(p, "body")) && /km/.test(await txt(p, "body")), `${tag} WE: slider max reaches radio (km)`);
    await p.getByRole("button", { name: "Longitudinal Wave" }).click();
    await p.getByRole("button", { name: /Pause animation/ }).click(); await sleep(100);
    check((await p.getByRole("button", { name: /Play animation/ }).getAttribute("aria-pressed")) === "true", `${tag} WE: pause button has aria-pressed`);
    await p.getByRole("button", { name: "Reset", exact: true }).click(); await sleep(150);
    check((await p.getByRole("button", { name: "Transverse Wave" }).getAttribute("aria-pressed")) === "true" && (await p.getByRole("button", { name: /Pause animation/ }).count()) === 1, `${tag} WE: Reset restores wave type and playback`);
    check(/550 nm/.test(await txt(p, "body")), `${tag} WE: Reset restores 550 nm`);
    check((await coveredControls(p)).length === 0, `${tag} WE: no covered controls`);
    clean(`${tag} WE`, errors); await ctx.close(); }
}
await h.finish("verify-atomic-sims");
