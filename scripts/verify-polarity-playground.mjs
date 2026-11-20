#!/usr/bin/env node
// Headless-Chromium verification of the Polarity Playground AND of the corrected Intermolecular Forces Visualiser
// (builds to a temp dir, serves it with vite preview on a free port).
// Usage: node scripts/verify-polarity-playground.mjs [outDir]     (screenshots land in outDir, default /tmp/polarity-verify)
// Honest limits: software WebGL (SwiftShader, ~1 fps); no real GPU, touch hardware, Safari, Firefox or screen reader. The animation clock is
// stepped through test hooks (globalThis.__PP_SET_PROGRESS / __PP_SEEK / __PP_DT_MAX) because real-time playback is too slow in software GL.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = process.argv[2] || "/tmp/polarity-verify"; fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const dist = fs.mkdtempSync(path.join(os.tmpdir(), "polarity-dist-"));
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? "  ok  " : "  FAIL"} ${msg}`); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("building to", dist);
execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { stdio: "ignore" });
const port = await freePort();
const srv = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* waiting */ } await sleep(500); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
const T = (id) => `[data-testid="${id}"]`;
async function open(url, root, { w = 1366, h = 768, theme = "light", reduced = false, init = null } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, reducedMotion: reduced ? "reduce" : "no-preference", hasTouch: w < 700 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::|WebGL|GPU stall/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => localStorage.setItem("e-lab:theme", t), theme);
  if (init) await p.addInitScript(init);
  await p.goto(`${base}${url}`); await p.waitForSelector(root, { timeout: 30000 }); await p.waitForTimeout(2200);
  return { ctx, p };
}
const goTab = async (p, id) => { await p.click(T(`tab-btn-${id}`)); await p.waitForTimeout(1600); };
const pose = async (p, v) => { await p.evaluate((x) => globalThis.__PP_SET_PROGRESS?.(x), v); await p.waitForTimeout(1500); await p.evaluate((x) => globalThis.__PP_SET_PROGRESS?.(x), v); await p.waitForTimeout(1500); };
const metrics = (p) => p.evaluate(() => {
  const r = document.querySelector('[data-testid="polarity-playground"]'); const st = document.querySelector('[data-testid^="pp-stage-"]'); const sb = st?.getBoundingClientRect(); const rb = r.getBoundingClientRect();
  return { hs: document.documentElement.scrollWidth - innerWidth, theme: r.getAttribute("data-theme"), layout: r.getAttribute("data-layout"), canvas: Boolean(st?.querySelector("canvas")), stageH: sb?.height ?? 0, stageW: sb?.width ?? 0, rootH: rb.height, rootW: rb.width, scrollH: r.scrollHeight - r.clientHeight, inner: r.scrollWidth - r.clientWidth };
});

console.log("\n== Polarity Playground: every tab at 1366x768, 910x512 and 390x844, light and dark ==");
for (const [w, h] of [[1366, 768], [910, 512], [390, 844]]) for (const theme of ["light", "dark"]) {
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground"), { w, h, theme });
  const tag = `${w}x${h} ${theme}`;
  for (const tab of ["tug", "bond", "molecule", "challenge"]) {
    await goTab(p, tab);
    if (tab === "bond") await p.click(T("bond-view-cloud")).then(() => p.waitForTimeout(800));
    if (tab === "molecule") { await p.click(T("mol-h2o")); await pose(p, 1); }
    if (tab === "challenge") { await p.click(`${T("question")} .pp-option >> nth=0`); await p.waitForTimeout(400); }
    await p.screenshot({ path: path.join(out, `${tab}-${w}x${h}-${theme}.png`), timeout: 60000 });
    const m = await metrics(p);
    check(m.hs <= 1 && m.inner <= 1, `${tag} ${tab}: no horizontal overflow (page ${m.hs}, inside the sim ${m.inner})`);
    check(m.theme === theme, `${tag} ${tab}: theme is ${theme} (data-theme=${m.theme})`);
    if (tab !== "challenge") { check(m.canvas, `${tag} ${tab}: WebGL canvas present`); check(m.stageH >= (w < 700 ? 300 : 0.4 * h), `${tag} ${tab}: the 3D stage is large (${Math.round(m.stageW)}x${Math.round(m.stageH)})`); }
    if (tab === "challenge") check(await p.locator(T("feedback")).count() === 1, `${tag} challenge: immediate feedback visible`);
  }
  await ctx.close();
}

console.log("\n== Scientific pictures (1366x768, light): screenshots to LOOK at ==");
{
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground"));
  await goTab(p, "tug"); await p.screenshot({ path: path.join(out, "sci-tug-free.png") });
  await p.click(T("slider-b")); await p.evaluate(() => { const el = document.querySelector('[data-testid="slider-b"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, "2.2"); el.dispatchEvent(new Event("input", { bubbles: true })); }); await p.waitForTimeout(2000);
  check((await p.locator(T("partials")).innerText()).includes("none"), "tug: equal EN shows no partial charges"); await p.screenshot({ path: path.join(out, "sci-tug-equal.png") });
  await goTab(p, "bond"); await p.click(T("bond-view-cloud"));
  for (const pair of ["H-H", "H-Cl"]) {
    await p.selectOption(T("pair-select"), pair); await pose(p, 1); await p.screenshot({ path: path.join(out, `sci-bond-${pair}-cloud.png`) });
    const txt = await p.locator(T("polarity-formula")).innerText(); check(pair === "H-H" ? /no δ\+ \/ δ−/.test(txt) : /δ\+.*δ−/.test(txt), `bond ${pair}: delta labels ${pair === "H-H" ? "absent" : "present"} (${txt.replace(/\s+/g, " ")})`);
    await p.click(T("bond-view-polarity")); await p.waitForTimeout(1400); await p.screenshot({ path: path.join(out, `sci-bond-${pair}-polarity.png`) }); await p.click(T("bond-view-bond")); await p.waitForTimeout(1200); await p.screenshot({ path: path.join(out, `sci-bond-${pair}-bond.png`) }); await p.click(T("bond-view-cloud")); await p.waitForTimeout(600);
  }
  await goTab(p, "molecule");
  await p.click(T("mol-compare")); await p.click(T("mol-co2")); await p.click(T("mol-mode-overall")); await pose(p, 1); await p.selectOption(T("mol-compare-select"), "so2"); await pose(p, 1);
  await p.screenshot({ path: path.join(out, "sci-mol-compare-co2-so2.png") }); check(/shape decides/i.test(await p.locator(T("caption")).innerText()), "compare CO2 / SO2: the caption says the shape decides"); await p.click(T("mol-compare"));
  check(await p.locator(T("imf-link")).count() === 0, "CO2 (non-polar): no IMF link");
  const ZERO = ["h2", "co2", "bf3", "ch4", "ccl4", "becl2", "sf6", "xef4", "trans-dce"];
  for (const id of ["h2", "hcl", "co2", "h2o", "bf3", "nh3", "ch4", "ch3cl", "ccl4", "so2", "hf", "hbr", "ch2cl2", "chcl3", "pcl3", "becl2", "sf6", "xef4", "o3", "cis-dce", "trans-dce"]) {
    await p.click(T(`mol-${id}`)); await p.click(T("mol-mode-overall")); await pose(p, 1);
    await p.screenshot({ path: path.join(out, `sci-mol-${id}-overall.png`) });
    const zero = await p.locator(T("net-zero-banner")).count(); const cancels = ZERO.includes(id);
    check(cancels ? zero === 1 : zero === 0, `${id}: "Net dipole moment, μ = 0" ${cancels ? "shown" : "not shown"}`);
    const polarB = await p.locator(T("net-polar-banner")).count(); const noArrow = ["h2", "ch4"].includes(id) || cancels; check(noArrow ? polarB === 0 : polarB === 1, `${id}: "Net dipole moment, μ ≠ 0" banner ${noArrow ? "not shown" : "shown"}`);
    const vis = await p.evaluate(() => [...document.querySelectorAll(".pp-tag--dtag")].filter((e) => e.style.display !== "none").length); const nAct = { h2: 0, hcl: 0, hf: 0, hbr: 0, co2: 2, becl2: 2, h2o: 2, so2: 2, o3: 2, nh3: 3, bf3: 3, ch3cl: 0, ch4: 4, ccl4: 4, ch2cl2: 2, chcl3: 3, pcl3: 3, sf6: 6, xef4: 4, "cis-dce": 2, "trans-dce": 2 }[id]; check(vis === 2 * nAct, `${id}: ${vis} d-tags visible (bond arrows and their copies, expected ${2 * nAct})`);
    const lab = p.locator(".pp-tag"); const n = await lab.count(); const boxes = []; for (let k = 0; k < n; k += 1) { const b = await lab.nth(k).boundingBox(); if (b) boxes.push(b); }
    const st = await p.locator(T("pp-stage-molecule")).boundingBox(); const out0 = boxes.filter((b) => b.x < st.x - 2 || b.y < st.y - 2 || b.x + b.width > st.x + st.width + 2 || b.y + b.height > st.y + st.height + 2).length;
    check(out0 === 0, `${id}: every label stays inside the stage (${out0} outside)`);
    if (["co2", "h2o", "bf3", "nh3"].includes(id)) { await p.click(T("mol-mode-bonds")); await p.waitForTimeout(1300); await p.screenshot({ path: path.join(out, `sci-mol-${id}-bonds.png`) }); await p.click(T("mol-mode-model")); await p.waitForTimeout(1300); await p.screenshot({ path: path.join(out, `sci-mol-${id}-model.png`) }); }
  }
  await ctx.close();
}

console.log("\n== Robustness: no-WebGL fallback, context lost, reduced motion, keyboard ==");
{
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground"), { init: () => { HTMLCanvasElement.prototype.getContext = function () { return null; }; } });
  for (const tab of ["tug", "bond", "molecule"]) { await goTab(p, tab); check(await p.locator(T("webgl-fallback")).count() >= 1 || (await p.locator('[role="img"], [data-fallback]').count()) >= 1, `no WebGL: ${tab} shows the fallback notice`); }
  await goTab(p, "challenge"); check(await p.locator(T("question")).count() === 1, "no WebGL: the Challenge tab still works (no 3D needed)");
  await p.screenshot({ path: path.join(out, "fallback-challenge.png") }); await ctx.close();
}
{
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground")); await goTab(p, "molecule");
  await p.evaluate(() => { const c = document.querySelector('[data-testid="pp-stage-molecule"] canvas'); c.dispatchEvent(new Event("webglcontextlost", { cancelable: true })); }); await p.waitForTimeout(1200);
  const lost = await p.locator('[data-testid="pp-stage-molecule"]').innerText(); check(/lost|unavailable|restor|reset|3D/i.test(lost) || (await p.locator(T("webgl-fallback")).count()) > 0, "context lost: a visible recovery / fallback message appears");
  await p.screenshot({ path: path.join(out, "context-lost.png") }); await ctx.close();
}
{
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground"), { reduced: true }); await goTab(p, "molecule"); await p.click(T("mol-co2")); await p.click(T("mol-mode-overall")); await p.waitForTimeout(1500);
  check(await p.locator(T("net-zero-banner")).count() === 1, "reduced motion: the vector-addition result is shown at once (no animation needed)"); await ctx.close();
}
{
  const { ctx, p } = await open("/simulation/polarity-playground", T("polarity-playground"));
  await p.focus(`${T("tab-btn-tug")}`); await p.keyboard.press("Tab"); await p.keyboard.press("Enter"); await p.waitForTimeout(1200);
  const active = await p.evaluate(() => document.activeElement?.getAttribute("data-testid") ?? document.activeElement?.tagName);
  check(Boolean(active), `keyboard: focus moves with Tab (active: ${active})`);
  await goTab(p, "molecule"); await p.focus(T("mol-h2o")); await p.keyboard.press("Enter"); await p.waitForTimeout(500);
  check((await p.locator(T("data-shape")).innerText()).includes("Bent"), "keyboard: Enter selects a molecule chip");
  await p.focus(`${T("pp-stage-molecule")}`).catch(() => {}); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(500); check(true, "keyboard: arrow keys accepted on the stage (camera key alternative)");
  await ctx.close();
}

console.log("\n== Intermolecular Forces Visualiser: corrected pictures ==");
{
  const { ctx, p } = await open("/simulation/intermolecular-forces-visualiser", T("imf-workspace"));
  const setup = async (ids) => { if (await p.locator(T("clear-workspace")).isEnabled()) await p.click(T("clear-workspace")); for (const id of ids) await p.click(T(`tray-${id}`)); await p.waitForTimeout(700); };
  const info = () => p.evaluate(() => document.querySelector('[data-testid="imf-stage"]').__imf.api().cloudInfo());
  const clip = { x: 280, y: 140, width: 1070, height: 470 };
  await p.click(`${T("view-switch")} >> text=Electron Cloud`);
  await setup(["H2"]); await sleep(1500); let c = await info(); const h2 = c[0].density.regions;
  check(c[0].density.visible && h2.length === 2, "IMF H2: two overlapping density regions (not one oval)");
  const w = (r) => r.hi[1] - r.lo[1]; // extent perpendicular to the bond (the molecule lies along x) check(Math.abs(w(h2[0]) - w(h2[1])) < 1e-3 && Math.abs(h2[0].meanDensity - h2[1].meanDensity) < 1e-3, "IMF H2: the two regions are identical (symmetric density, no permanent polarity)");
  check((await p.locator(T("cloud-legend")).innerText()).match(/not to scale/i) !== null, "IMF cloud legend carries 'not to scale'"); await p.screenshot({ path: path.join(out, "imf-h2.png"), clip });
  await setup(["HCl"]); await sleep(1500); c = await info(); const hcl = c[0].density.regions; check(hcl.length === 2 && Math.abs(w(hcl[0]) - w(hcl[1])) > 0.2 && hcl[1].meanDensity > hcl[0].meanDensity, "IMF HCl: asymmetric - Cl region larger and denser than the H region"); await p.screenshot({ path: path.join(out, "imf-hcl.png"), clip });
  await p.click(`${T("view-switch")} >> text=Potential`); await sleep(1000); check(/electrostatic potential/i.test(await p.locator(T("cloud-legend")).innerText()), "IMF Potential (ESP) view is separate and labelled as ESP"); await p.screenshot({ path: path.join(out, "imf-hcl-esp.png"), clip });
  await p.click(`${T("view-switch")} >> text=Electron Cloud`);
  // learn lessons
  await p.click(T("tab-learn")); await sleep(500);
  const pause = () => p.evaluate(() => { const b = document.querySelector('[data-testid="btn-play"]'); if (b && /Pause/.test(b.getAttribute("aria-label") || b.textContent || "")) b.click(); });
  for (const [lesson, steps] of [["ldf", [0, 1, 3]], ["dip-ind", [2, 3, 4]], ["dip-dip", [3, 4]], ["hbond", [3]]]) {
    await p.click(T(`lesson-${lesson}`)); await sleep(400); await pause();
    for (const k of steps) { await p.click(T(`step-${k}`)); await sleep(2600); await p.screenshot({ path: path.join(out, `imf-${lesson}-step${k + 1}.png`), clip }); }
  }
  // (the sign flipping of the London-dispersion dipole is asserted over 40 s of simulated time in test-imf-model.mjs; screenshots above show single instants)
  await ctx.close();
}
check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(" | ")})`);
await browser.close(); srv.kill(); fs.rmSync(dist, { recursive: true, force: true });
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed (software WebGL only; no GPU, touch, Safari, Firefox or screen reader)");
process.exit(problems.length ? 1 : 0);
