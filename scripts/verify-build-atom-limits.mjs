// Chromium verification for Build an Atom's physical limits, explained refusals, dialog, reset and layout.
// Usage: node scripts/verify-build-atom-limits.mjs [outDir]   (env SIZES, THEMES, BASE_URL, CHROMIUM)
import { start, T, sleep, coveredControls, txt, hasHScroll } from "./verify-atomic-harness.mjs";
import fs from "node:fs";
const out = process.argv[2] || "/tmp/build-atom-limits-verify"; fs.mkdirSync(out, { recursive: true });
const h = await start();
const { check } = h;
// each press is a separate discrete React event, with a macrotask between so React re-renders (closure state is fresh)
const press = (p, id, n = 1) => p.evaluate(async ({ sel, n }) => { for (let i = 0; i < n; i += 1) { document.querySelector(sel).dispatchEvent(new MouseEvent("click", { bubbles: true })); await new Promise((r) => setTimeout(r, 0)); } }, { sel: T(id), n });
const counts = async (p) => `${await txt(p, T("atom-count-proton"))}/${await txt(p, T("atom-count-neutron"))}/${await txt(p, T("atom-count-electron"))}`;

for (const [W, H] of h.SIZES) for (const theme of h.THEMES) {
  const tag = `${W}x${H} ${theme}`;
  const { ctx, p, errors } = await h.open(W, H, "/simulation/build-an-atom", theme);
  console.log(tag);
  check(!(await hasHScroll(p)), `${tag}: no horizontal page scroll`);
  // BA-01: hydrogen neutron cap
  await p.click(T("atom-start-empty")); await p.click(T("atom-add-proton"));
  await sleep(100);
  await press(p, "atom-add-neutron", 80); await sleep(300);
  check((await counts(p)) === "1/6/0", `${tag}: H stops at 6 neutrons (hydrogen-7), got ${await counts(p)}`);
  check(/hydrogen-7/.test(await txt(p, T("atom-notice"))), `${tag}: refusal names hydrogen-7: ${await txt(p, T("atom-notice"))}`);
  check(/Hydrogen-7/.test(await txt(p, T("atom-isotope-name"))), `${tag}: isotope label Hydrogen-7`);
  // BA-02 Kr cannot gain electrons, no 4- charge
  await p.click(T("atom-reset-carbon")); await p.click(T("atom-auto-balance"));
  await press(p, "atom-add-proton", 30); await sleep(300);
  await p.click(T("atom-auto-balance"));
  await press(p, "atom-add-electron", 5); await sleep(200);
  check((await counts(p)).endsWith("/36"), `${tag}: Kr keeps 36 electrons (${await counts(p)})`);
  check(/full outer shell/.test(await txt(p, T("atom-notice"))), `${tag}: Kr refusal explained`);
  // BA-03 Fe2+ configuration
  await p.click(T("atom-reset-carbon")); await p.click(T("atom-auto-balance"));
  await press(p, "atom-add-proton", 20); await p.click(T("atom-auto-balance")); await sleep(200);
  await press(p, "atom-remove-electron", 2); await sleep(200);
  check((await txt(p, T("atom-shells-arrangement"))) === "2,8,14", `${tag}: Fe2+ arrangement 2,8,14 got ${await txt(p, T("atom-shells-arrangement"))}`);
  // BA-04 neutron without proton
  await p.click(T("atom-start-empty")); await press(p, "atom-add-neutron", 1); await sleep(100);
  check((await counts(p)) === "0/0/0" && /Add a proton first/.test(await txt(p, T("atom-notice"))), `${tag}: no neutron without proton, explained`);
  // reset restores everything
  await p.click(T("atom-reset-carbon")); await sleep(150);
  check((await counts(p)) === "6/6/6" && !(await p.locator(T("atom-auto-balance")).isChecked()) && (await txt(p, T("atom-notice"))) === "", `${tag}: reset restores carbon-12, auto-balance off, notice cleared`);
  // BA-05 dialog
  await p.getByRole("button", { name: "Compare Isotopes" }).scrollIntoViewIfNeeded().catch(() => {});
  await p.getByRole("button", { name: "Compare Isotopes" }).click(); await sleep(200);
  check(await p.getByRole("dialog").isVisible(), `${tag}: isotope dialog has role=dialog`);
  check(await p.evaluate(() => document.activeElement?.getAttribute("aria-label") === "Close"), `${tag}: focus moves into the dialog`);
  await p.keyboard.press("Escape"); await sleep(200);
  check(!(await p.getByRole("dialog").isVisible().catch(() => false)), `${tag}: Escape closes the dialog`);
  check(await p.evaluate(() => document.activeElement?.textContent?.trim() === "Compare Isotopes"), `${tag}: focus returns to the opener`);
  // BA-06 covered controls: scroll the side panel in steps and test every control
  const side = T("atom-side");
  const total = await p.evaluate((s) => { const e = document.querySelector(s); return e ? e.scrollHeight : 0; }, side);
  const covered = new Set();
  for (let y = 0; y <= total; y += 120) {
    await p.evaluate(({ s, y }) => { const e = document.querySelector(s); if (e) e.scrollTop = y; window.scrollTo(0, y > 0 ? 0 : 0); }, { s: side, y });
    await sleep(60);
    for (const c of await coveredControls(p, T("atom-workspace"))) covered.add(c);
  }
  check(covered.size === 0, `${tag}: no covered controls (${[...covered].join("; ")})`);
  await p.screenshot({ path: `${out}/atom-${W}x${H}-${theme}.png` });
  check(errors.length === 0, `${tag}: no console errors (${errors.slice(0, 3).join(" | ")})`);
  await ctx.close();
}
await h.finish("build-an-atom limits");
