#!/usr/bin/env node
// Headless-Chromium verification of the Equilibrium Lab (builds to a temp dir, serves it with vite preview on a free port).
// Usage: node scripts/verify-equilibrium.mjs [outDir]     Screenshots are written to outDir (default /tmp/equilibrium-verify) so they can be LOOKED at.
// Honest limits: software rendering (SwiftShader); no real GPU, touch hardware, Safari, Firefox or screen reader.
// Simulation time is stepped through the test hook (window.__EQ, run/advance) so results do not depend on machine speed.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = process.argv[2] || "/tmp/equilibrium-verify"; fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const dist = fs.mkdtempSync(path.join(os.tmpdir(), "equilibrium-dist-"));
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? "  ok  " : "  FAIL"} ${msg}`); };

console.log("building to", dist);
execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { stdio: "ignore" });
const port = await freePort();
const srv = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* waiting */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
async function open(w, h, theme, query = "", reduced = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: w < 700, reducedMotion: reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::|WebGL|GPU stall|ERR_TUNNEL/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => { localStorage.setItem("e-lab:theme", t); globalThis.__EQ_DT_MAX = 0.03; }, theme);
  await p.goto(`${base}/simulation/equilibrium-lab${query}`); await p.waitForSelector('[data-testid="equilibrium-lab"]', { timeout: 30000 }); await p.waitForTimeout(1200);
  return { ctx, p };
}
const T = (id) => `[data-testid="${id}"]`;
const dispatch = (p, a) => p.evaluate((x) => globalThis.__EQ.dispatch(x), a);
const state = (p) => p.evaluate(() => { const s = globalThis.__EQ.getState(); const sc = s.scenes[s.mode]; return { mode: s.mode, status: sc.status, t: sc.t, A: sc.ev?.s.A, B: sc.ev?.s.B, c: sc.ch?.s.c, V: sc.ch?.s.V, T: sc.ch?.s.T }; });
const layoutCheck = async (p, label) => {
  const r = await p.evaluate(() => {
    const doc = document.documentElement; const vw = window.innerWidth; const root = document.querySelector(".eq-root");
    const bad = []; for (const el of document.querySelectorAll(".eq-root button, .eq-root select, .eq-root input")) { const b = el.getBoundingClientRect(); if (b.width && (b.right > vw + 1 || b.left < -1)) bad.push((el.getAttribute("data-testid") || el.textContent || el.tagName).slice(0, 30)); }
    const tiny = [...document.querySelectorAll(".eq-root button")].filter((el) => { const b = el.getBoundingClientRect(); return b.width && (b.height < 24 || b.width < 24); }).map((el) => (el.getAttribute("data-testid") || el.textContent).slice(0, 24));
    return { overflowX: doc.scrollWidth - vw, clipped: bad.slice(0, 5), tiny: tiny.slice(0, 5), hasRoot: !!root };
  });
  check(r.overflowX <= 1, `${label}: no horizontal page overflow (${r.overflowX}px)`);
  check(r.clipped.length === 0, `${label}: no controls clipped at the viewport edge ${r.clipped.join(",")}`);
  check(r.tiny.length === 0, `${label}: every button at least 24px each way ${r.tiny.join(",")}`);
};
const shot = (p, name) => p.screenshot({ path: path.join(out, `${name}.png`), timeout: 60000 });
const settle = async (p, dT) => { await dispatch(p, { type: "run/advance", dT }); await p.waitForTimeout(500); };

// ---- 1366x768 light: the required screenshot set ----
{
  const { ctx, p } = await open(1366, 768, "light");
  check((await p.title()).length > 0, "page loads and the simulation mounts"); await layoutCheck(p, "1366x768 light start");
  for (const [preset, label] of [["towardsA", "A"], ["center", "C"], ["towardsB", "B"]]) {
    await dispatch(p, { type: "run/reset" }); await dispatch(p, { type: "setup/preset", preset }); await p.waitForTimeout(300);
    await shot(p, `everyday-${preset}-1-start`);
    await dispatch(p, { type: "run/start" }); await dispatch(p, { type: "run/advance", dT: 2.5 }); await p.waitForTimeout(400); await shot(p, `everyday-${preset}-2-mid`);
    await settle(p, 40); await shot(p, `everyday-${preset}-3-equilibrium`);
    const s = await state(p); const want = { towardsA: 80, center: 50, towardsB: 20 }[preset]; check(Math.abs(s.A - want) <= 12 && s.A + s.B === 100, `everyday ${preset}: ${s.A}/${s.B} near ${want}/${100 - want} and 100 people conserved`);
    const lab = await p.textContent(T("eq-indicator")); check(/equilibrium/i.test(lab), `everyday ${preset}: indicator says equilibrium ("${lab.replace(/\s+/g, " ").slice(0, 60)}")`);
    const dom = await p.evaluate(() => ({ a: Number(document.querySelector('[data-testid="count-a"]').textContent), b: Number(document.querySelector('[data-testid="count-b"]').textContent), st: globalThis.__EQ.getState().scenes.everyday.ev.s }));
    check(dom.a === dom.st.A && dom.b === dom.st.B, `everyday ${preset}: scene counters match the model exactly (${dom.a}/${dom.b})`);
    if (preset === "towardsA") {
      await p.click(`${T("everyday-disturb")} button:nth-of-type(1)`); await p.waitForTimeout(500); await shot(p, "everyday-after-add-A");
      const n = await state(p); check(n.A + n.B === 120, "adding people to A: 120 people in total"); check(/disturbed|readjust/i.test(await p.textContent(T("notice"))), "status message after the disturbance");
    }
  }
  // chemical
  await p.click(T("mode-chemical")); await p.waitForTimeout(500);
  for (const id of ["ab", "n2o4", "haber", "hi", "fescn"]) {
    await p.selectOption(T("reaction-select"), id); await p.waitForTimeout(300); await dispatch(p, { type: "run/start" });
    await dispatch(p, { type: "run/advance", dT: id === "fescn" ? 10 : id === "ab" ? 3 : 15 }); await p.waitForTimeout(400); await shot(p, `chem-${id}-1-mid`);
    await settle(p, id === "fescn" ? 120 : 600); await shot(p, `chem-${id}-2-equilibrium`);
    const lab = await p.textContent(T("eq-indicator")); check(/equilibrium/i.test(lab), `chemical ${id}: indicator says equilibrium`);
    const canvas = await p.evaluate(() => { const c = document.querySelector('[data-testid="vessel"] canvas'); if (!c || !c.getContext) return { ok: false }; const x = c.getContext("2d"); const d = x.getImageData(0, 0, c.width, c.height).data; let ink = 0; for (let i = 3; i < d.length; i += 4 * 17) if (d[i] > 0) ink += 1; return { ok: true, ink }; });
    check(canvas.ok && canvas.ink > 200, `chemical ${id}: the vessel canvas is painted (${canvas.ink})`);
  }
  await p.selectOption(T("reaction-select"), "n2o4"); await p.waitForTimeout(300); await dispatch(p, { type: "run/start" }); await settle(p, 600);
  const K0 = await p.textContent(T("kc-value")); await p.click(T("vol-down")); await p.waitForTimeout(600); await shot(p, "chem-n2o4-volume-decrease");
  check((await p.textContent(T("kc-value"))) === K0, "N2O4 volume decrease: K unchanged"); check((await state(p)).V < 1, "N2O4 volume decrease: volume reduced");
  await settle(p, 600); await p.click(T("temp-up")); await p.waitForTimeout(600); await shot(p, "chem-n2o4-temperature-up");
  check((await p.textContent(T("kc-value"))) !== K0, "N2O4 temperature increase: K changes");
  await p.selectOption(T("reaction-select"), "haber"); await p.waitForTimeout(300); await dispatch(p, { type: "run/start" }); await dispatch(p, { type: "run/advance", dT: 8 });
  await p.click(T("cat-add")); await dispatch(p, { type: "run/advance", dT: 3 }); await p.waitForTimeout(500); await shot(p, "chem-haber-catalyst");
  // compare
  await p.click(T("mode-compare")); await p.waitForTimeout(500); await dispatch(p, { type: "run/start" }); await dispatch(p, { type: "run/advance", dT: 30 }); await p.waitForTimeout(500);
  await p.click(`${T("everyday-disturb")} button:nth-of-type(1)`); await dispatch(p, { type: "run/advance", dT: 3 }); await p.waitForTimeout(500); await shot(p, "compare-after-add-A"); await layoutCheck(p, "1366x768 compare");
  await ctx.close();
}
// ---- other sizes, light and dark ----
for (const [w, h] of [[1366, 768], [910, 512], [390, 844]]) for (const theme of ["light", "dark"]) {
  const { ctx, p } = await open(w, h, theme); const tag = `${w}x${h}-${theme}`;
  for (const m of ["everyday", "chemical", "compare"]) {
    await p.click(T(`mode-${m}`)); await p.waitForTimeout(400); await dispatch(p, { type: "run/start" }); await dispatch(p, { type: "run/advance", dT: 6 }); await p.waitForTimeout(600);
    await shot(p, `size-${m}-${tag}`); await layoutCheck(p, `${tag} ${m}`);
  }
  await ctx.close();
}
// ---- reduced motion, teacher initial mode, keyboard ----
{
  const { ctx, p } = await open(1366, 768, "light", "?mode=chemical", true); check((await state(p)).mode === "chemical", "?mode=chemical opens the Chemical Model"); await dispatch(p, { type: "run/start" }); await settle(p, 20); await shot(p, "reduced-motion-chemical");
  const anim = await p.evaluate(() => [...document.querySelectorAll(".eq-root *")].filter((e) => { const s = getComputedStyle(e); return s.animationName !== "none" && parseFloat(s.animationDuration) > 0.05 && s.animationIterationCount === "infinite"; }).length);
  check(anim === 0, `reduced motion: no infinite CSS animations (${anim})`);
  await p.focus(T("mode-chemical")); await p.keyboard.press("ArrowRight"); await p.waitForTimeout(300); check((await state(p)).mode === "compare", "keyboard: ArrowRight moves to Compare Both");
  await p.keyboard.press("Tab"); const active = await p.evaluate(() => document.activeElement?.tagName); check(["BUTTON", "INPUT", "SELECT", "A"].includes(active), `keyboard: Tab reaches a control (${active})`);
  await ctx.close();
}
check(errors.length === 0, `no console / page errors ${errors.slice(0, 3).join(" | ")}`);
await browser.close(); srv.kill();
console.log(`\nscreenshots: ${out}`); console.log(problems.length ? `${problems.length} problem(s)` : "all checks passed"); process.exit(problems.length ? 1 : 0);
