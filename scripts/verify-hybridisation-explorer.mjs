// Headless-Chromium verification for the 3D Hybridisation Explorer (needs a running dev server + Playwright/Chromium).
// Usage: node scripts/verify-hybridisation-explorer.mjs [baseUrl] [outDir]     Route: /simulation/hybridisation-explorer
// Honest limits: software GL (SwiftShader), synthetic mouse events only; no real GPU, no real touch hardware, Chromium only.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/hybridisation-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const problems = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];
const stage = (p, a) => p.locator(T("hy-stage")).first().getAttribute(a);

async function open(size) {
  const ctx = await browser.newContext({ viewport: { width: size[0], height: size[1] } }); const p = await ctx.newPage(); p.errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) p.errs.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => p.errs.push(`pageerror: ${e.message}`));
  await p.goto(`${base}/simulation/hybridisation-explorer`, { waitUntil: "networkidle" }); await p.waitForSelector(T("hybridisation-workspace")); await sleep(1200); return p;
}
async function layout(p, label, size) {
  const r = await p.evaluate(() => {
    const d = document.documentElement; const vw = innerWidth; const bad = [];
    for (const el of document.querySelectorAll("button, select, [role=tab], [data-testid^=box-]")) {
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue; if (el.closest("[aria-hidden=true]")) continue;
      // clipped by its scroll parent or the page edge
      if (b.right > vw + 1 || b.left < -1) bad.push(`${el.dataset.testid || el.textContent.slice(0, 20)} off-screen x`);
    }
    return { hscroll: d.scrollWidth > innerWidth + 1, vscroll: d.scrollHeight > innerHeight + 1, sh: d.scrollHeight, ih: innerHeight, bad: bad.slice(0, 6) };
  });
  check(!r.hscroll, `${label}: horizontal overflow`); check(r.bad.length === 0, `${label}: ${r.bad.join("; ")}`);
  if (size[0] >= 1366) check(!r.vscroll, `${label}: page scrolls vertically (${r.sh} > ${r.ih})`);
  const sb = await p.locator(T("hy-stage")).boundingBox(); check(sb && sb.width > 200 && sb.height > 200, `${label}: stage too small ${JSON.stringify(sb)}`);
}

console.log("Layout at five viewports (both tabs)");
for (const size of SIZES) {
  const p = await open(size); const tag = `${size[0]}x${size[1]}`;
  await layout(p, `${tag} lab`, size); await p.screenshot({ path: `${out}/lab-${tag}.png` });
  await p.click(T("tab-molecules")); await sleep(500); await p.selectOption(T("select-molecule"), "C2H4"); for (let i = 0; i < 5; i += 1) await p.click(T("btn-next")); await sleep(2200);
  await layout(p, `${tag} molecules`, size); await p.screenshot({ path: `${out}/mol-${tag}.png` });
  check(p.errs.length === 0, `${tag}: console errors ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Orbital Lab flows (1366x768)");
{
  const p = await open([1366, 768]);
  check((await p.locator(T("webgl-fallback")).count()) === 0, "WebGL canvas available (no fallback)");
  check((await p.locator("canvas").count()) >= 1, "canvas present");
  await p.click(T("state-excited")); await sleep(300); check(/conventional/i.test(await p.locator(T("promotion-note")).innerText()), "carbon excited labelled conventional");
  // two-way sync: box -> 3D, 3D pick -> box
  await p.click(T("box-2px")); await sleep(300); check((await p.locator(T("box-2px")).getAttribute("aria-pressed")) === "true", "box click selects");
  await p.click(T("box-2px")); await sleep(200);
  const pick = await p.evaluate(() => { const st = document.querySelector('[data-testid="hy-stage"]'); const h = st.__hy; const api = h.api(); return { has: !!api, keys: Object.keys(api ?? {}) }; });
  check(pick.has, "3D test hook present");
  for (const [ids, recipe, n] of [[["2s", "2px"], "sp", 2], [["2s", "2px", "2py"], "sp2", 3], [["2s", "2px", "2py", "2pz"], "sp3", 4]]) {
    await p.click(T("btn-reset")); await sleep(300); await p.click(T("state-excited")); for (const id of ids) await p.click(T(`box-${id}`));
    check(!(await p.locator(T("btn-mix")).isDisabled()), `${recipe}: Mix enabled`);
    await p.click(T("btn-mix")); const t0 = Date.now(); await sleep(250); const mixingSeen = (await stage(p, "data-mixing")) !== "0" && (await stage(p, "data-mixing")) !== null;
    await sleep(2400);
    const nb = await p.locator('[data-testid^="box-hybrid-"]').count(); check(nb === n, `${recipe}: ${n} hybrid boxes (got ${nb})`);
    await p.screenshot({ path: `${out}/mix-${recipe}.png` }); console.log(`  ${recipe}: ${nb} hybrids, mixing flag seen=${mixingSeen}, ${Date.now() - t0}ms`);
  }
  // unsupported combination
  await p.click(T("btn-reset")); await sleep(300); await p.click(T("box-2px")); await p.click(T("box-2py")); check(await p.locator(T("btn-mix")).isDisabled(), "p+p only: Mix disabled");
  // advanced sets
  for (const [sym, promo, ids, recipe, n] of [["P", "3s1-3p3-3d1", ["3s", "3px", "3py", "3pz", "3dz2"], "sp3d", 5], ["S", "3s1-3p3-3d2", ["3s", "3px", "3py", "3pz", "3dz2", "3dx2-y2"], "sp3d2", 6]]) {
    await p.click(T("btn-reset")); await p.selectOption(T("select-element"), sym); await p.click(T("state-excited")); if (promo) { try { await p.selectOption(T("select-promotion"), promo); } catch { /* single promotion */ } }
    for (const id of ids) await p.click(T(`box-${id}`)); await p.click(T("btn-mix")); await sleep(2600);
    const nb = await p.locator('[data-testid^="box-hybrid-"]').count(); check(nb === n, `${recipe}: ${n} hybrid boxes (got ${nb})`); await p.screenshot({ path: `${out}/mix-${recipe}.png` });
  }
  // N / O / F / H disabled with explanation
  for (const s of ["H", "N", "O", "F"]) { await p.selectOption(T("select-element"), s); check(await p.locator(T("state-excited")).isDisabled(), `${s}: excited disabled`); check((await p.locator(T("excited-note")).innerText()).length > 20, `${s}: explanation shown`); }
  // bonding: sp2 carbon + duplicate + snap
  await p.click(T("btn-reset")); await p.click(T("state-excited")); for (const id of ["2s", "2px", "2py"]) await p.click(T(`box-${id}`)); await p.click(T("btn-mix")); await sleep(2400);
  await p.click(T("btn-duplicate")); await sleep(500); check((await stage(p, "data-atoms")) === "2", "duplicate adds an atom");
  await p.screenshot({ path: `${out}/bond-before-snap.png` });
  await p.click(T("btn-snap-now")); await sleep(1800); const s1 = await stage(p, "data-sigma"); const pi1 = await stage(p, "data-pi");
  console.log(`  snap: ${s1} sigma, ${pi1} pi`); check(Number(s1) >= 1, "snap produced a sigma bond"); await p.screenshot({ path: `${out}/bond-after-snap.png` });
  await p.locator(T("opt-sigma")).evaluate((e) => e.click()); await sleep(300); await p.screenshot({ path: `${out}/bond-sigma-hidden.png` }); await p.locator(T("opt-sigma")).evaluate((e) => e.click());
  await p.click(T("btn-undo")); await sleep(500); check((await stage(p, "data-sigma")) === "0", "undo of snap removes the bond");
  await p.click(T("btn-reset")); await sleep(300); check((await stage(p, "data-atoms")) === "1", "reset returns to one atom");
  check(p.errs.length === 0, `lab flows: console errors ${p.errs.join(" | ")}`); await p.context().close();
}

console.log("Molecule Explorer flows (1366x768)");
{
  const p = await open([1366, 768]); await p.click(T("tab-molecules")); await sleep(500);
  const ids = await p.locator(`${T("select-molecule")} option`).evaluateAll((o) => o.map((x) => x.value)); check(ids.length === 11, `11 molecules (got ${ids.length})`);
  const EXP = { H2: [1, 0], C2H4: [5, 1], C2H2: [3, 2], C2H6: [7, 0], C6H6: [12, 0] };
  for (const id of ids) {
    await p.selectOption(T("select-molecule"), id); await sleep(300);
    for (let g = 0; g < 30 && !(await p.locator(T("btn-next")).isDisabled()); g += 1) await p.click(T("btn-next"));
    await sleep(2200); const s = Number(await stage(p, "data-sigma")); const pi = Number(await stage(p, "data-pi"));
    console.log(`  ${id}: ${s} sigma + ${pi} pi`); if (EXP[id]) check(s === EXP[id][0] && pi === EXP[id][1], `${id}: expected ${EXP[id]} got ${s},${pi}`);
    await p.screenshot({ path: `${out}/molecule-${id}.png` });
  }
  await p.selectOption(T("select-molecule"), "C2H4"); await p.click(T("btn-mol-reset")); await sleep(300);
  await p.click(T("btn-play")); await sleep(9000); const step = await p.locator(T("step-count")).innerText(); console.log(`  Play advanced to: ${step}`); check(!/Step 1 \//.test(step), "Play advances the steps");
  await p.click(T("btn-play")); await p.click(T("tab-lab")); await sleep(500); await p.click(T("tab-molecules")); await sleep(300);
  check(p.errs.length === 0, `molecule flows: console errors ${p.errs.join(" | ")}`); await p.context().close();
}

await browser.close();
console.log(`\n${checks} checks, ${problems.length} problems. Screenshots: ${out}`);
if (problems.length) { console.log(problems.map((x) => ` - ${x}`).join("\n")); process.exit(1); }
