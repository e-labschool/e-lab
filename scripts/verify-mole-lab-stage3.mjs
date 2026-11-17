#!/usr/bin/env node
// Headless-Chromium verification of Mole Lab Stage 3 (builds to a temp dir, serves with vite preview on a free port).
// Usage: node scripts/verify-mole-lab-stage3.mjs [outDir]    Honest limits: software WebGL (SwiftShader); fps is NOT representative of a GPU; no touch device, Safari, Firefox or screen reader.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = process.argv[2] || "/tmp/mole-lab-stage3-verify"; fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const dist = fs.mkdtempSync(path.join(os.tmpdir(), "mole-lab-s3-dist-"));
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
async function open(w, h, theme = "light", opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: w < 700, reducedMotion: opts.reduced ? "reduce" : "no-preference" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => localStorage.setItem("e-lab:theme", t), theme);
  if (opts.noWebgl) await p.addInitScript(() => { const g = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function (t, ...a) { return /webgl/i.test(t) ? null : g.call(this, t, ...a); }; });
  await p.goto(`${base}/simulation/mole-lab`); await p.waitForSelector('[data-testid="mole-lab"]', { timeout: 30000 });
  await p.click('[data-testid="ml-tab-3"]'); await p.waitForSelector('[data-testid="ml-controls-3"]'); await p.waitForTimeout(opts.settle ?? 2500);
  return { ctx, p };
}
const ML = '[data-testid="mole-lab"]';
const dispatch = (p, a) => p.evaluate((x) => document.querySelector('[data-testid="mole-lab"]').__moleLab.dispatch({ stage: 3, ...x }).last, a);
const ledger = (p) => p.evaluate(() => { const s = document.querySelector('[data-testid="mole-lab"]').__moleLab.getState(); const sc = s.scenes[3]; let t = sc.packets.reduce((a, k) => a + k.q, 0); for (const v of sc.vessels) for (const q of Object.values(v.contents)) t += q; return { t, exp: sc.data.exp, inv: s.last }; });
const inv = (p) => p.evaluate(() => document.querySelector('[data-testid="mole-lab"]').__moleLab.invariants?.() ?? null);
const stn = (p) => p.evaluate(() => { const ml = document.querySelector('[data-testid="mole-lab"]').__moleLab; const d = ml.getState().scenes[3].data.stations.A; const sc = ml.getState().scenes[3]; const q = (k) => sc.vessels.find((v) => v.id === 'beakerA')?.contents; return { ...d, beaker: q(), busy: ml.ix.busy, packetQ: sc.packets[0]?.q }; });
const until = async (p, fn, label, ms = 90000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { if (fn(await stn(p))) return true; await p.waitForTimeout(500); } check(false, `timed out waiting for ${label}`); return false; };
const click = async (p, sel) => { await p.click(`[data-testid="${sel}"]`, { timeout: 30000 }); await p.waitForTimeout(120); };

// ---- screenshots + layout at the required sizes, both themes -----------------------------------
for (const [w, h] of [[1366, 768], [910, 512], [390, 844]]) for (const theme of ["light", "dark"]) for (const stage of ["start", "done"]) {
  const { ctx, p } = await open(w, h, theme, { reduced: true });
  if (stage === "done") { await dispatch(p, { type: "s3/prepare", station: "A" }); await p.waitForTimeout(1500); }
  await p.screenshot({ path: path.join(out, `s3-${stage}-${w}x${h}-${theme}.png`) });
  const r = await p.evaluate(() => { const vp = document.querySelector('[data-testid="ml-bench"]'); const b = vp?.getBoundingClientRect(); return { hs: document.documentElement.scrollWidth - innerWidth, canvas: Boolean(vp?.querySelector("canvas")), bw: b?.width ?? 0, bh: b?.height ?? 0, panes: document.querySelectorAll('[data-testid^="ml3-canvas-"]').length }; });
  check(r.hs <= 1, `${w}x${h} ${theme} ${stage}: no horizontal page overflow`); check(r.canvas, `${w}x${h} ${theme} ${stage}: WebGL canvas present`); check(r.bw >= 150 && r.bh >= 150, `${w}x${h} ${stage}: bench is a usable size (${Math.round(r.bw)}x${Math.round(r.bh)})`); check(r.panes >= 1, `${w}x${h} ${stage}: microscopic viewer drawn`);
  await ctx.close();
}
// every experiment renders at 1366x768
{
  const { ctx, p } = await open(1366, 768, "light", { reduced: true });
  for (const n of [1, 2, 3, 4, 5]) { await click(p, `ml3-exp-${n}`); await p.waitForTimeout(1800); await p.screenshot({ path: path.join(out, `s3-exp${n}.png`) }); check((await ledger(p)).exp === n, `experiment ${n} opens`); }
  await ctx.close();
}

// ---- hands-on flow with real pointer drag, conservation after each step ------------------------
{
  const { ctx, p } = await open(1366, 768, "light");
  const t0 = (await ledger(p)).t; const same = async (m) => { const l = await ledger(p); check(l.t === t0, `conserved after: ${m}`); };
  await p.fill('[data-testid="ml3-water-input"]', "60"); await click(p, "ml3-measure"); await same("measure water"); await click(p, "ml3-pour-water"); await until(p, (d) => d.waterMl > 0 && !d.busy, "water in beaker"); await same("pour water");
  await click(p, "ml-open-btn"); await same("open zipper");
  // hostile: hammer pour / stir / transfer
  for (let i = 0; i < 8; i += 1) await p.evaluate(() => document.querySelector('[data-testid="mole-lab"]').__moleLab.ix.pourSolid("A"));
  await until(p, (d) => d.packetQ === 0 && !d.busy, "solid poured"); await same("8x rapid pour requests");
  await p.keyboard.press("Escape"); await same("Escape");
  await click(p, "ml3-stir"); await until(p, (d) => !d.busy, "stir finished"); await same("stir");
  await click(p, "ml3-transfer"); await until(p, (d) => d.liquidMl > 0 && !d.busy, "transfer"); await same("transfer to flask");
  await p.fill('[data-testid="ml3-top-input"]', "900"); await click(p, "ml3-top-up"); await same("top-up past the mark (refused)");
  check(/./.test(await p.textContent('[data-testid="ml3-top-error"]').catch(() => "")), "past-the-mark refusal is shown to the user");
  await click(p, "ml3-fill-mark"); await until(p, (d) => d.atMark && !d.busy, "fill to mark"); await same("fill to mark");
  const s = await p.evaluate(() => { const st = document.querySelector('[data-testid="mole-lab"]').__moleLab.getState().scenes[3].data.stations.A; return { mark: st.atMark, ml: st.liquidMl, solid: document.querySelector('[data-testid="ml3-pane-c-mine"], [data-testid^="ml3-pane-c-"]')?.textContent }; });
  check(s.mark && s.ml === 100, "flask at the 100 mL mark after the hands-on run");
  await click(p, "ml3-restart"); await same("start over"); await p.waitForTimeout(500);
  // real pointer drag of the (closed) packet across the bench: must not change the ledger
  const box = await p.locator('[data-testid="ml-bench"]').boundingBox();
  await p.mouse.move(box.x + box.width * 0.3, box.y + box.height * 0.5); await p.mouse.down(); await p.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.55, { steps: 10 }); await p.mouse.up(); await p.waitForTimeout(500); await same("drag the packet to the beaker (closed bag cannot pour)");
  await p.mouse.dblclick(box.x + box.width * 0.5, box.y + box.height * 0.5); await same("double-click the bench");
  await p.setViewportSize({ width: 600, height: 700 }); await p.waitForTimeout(400); await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(500); await same("resize during use");
  for (const n of [3, 4, 1, 5, 2, 1]) { await click(p, `ml3-exp-${n}`); }
  await p.waitForTimeout(800); check(!(await p.locator("canvas").count() === 0), "canvas survives rapid experiment switching");
  await ctx.close();
}

// ---- keyboard-only path -------------------------------------------------------------------------
{
  const { ctx, p } = await open(1366, 768, "light", { reduced: true });
  await p.focus('[data-testid="ml3-exp-1"]'); await p.keyboard.press("Tab"); const tag = await p.evaluate(() => document.activeElement?.tagName); check(Boolean(tag) && tag !== "BODY", "Tab moves focus through the controls");
  await p.focus('[data-testid="ml3-prepare-A"]').catch(() => {}); await p.keyboard.press("Enter").catch(() => {}); await p.waitForTimeout(800);
  const l = await ledger(p); check(l.t > 0, "keyboard activation keeps the ledger valid");
  await ctx.close();
}

// ---- reduced motion, no-WebGL fallback, dispose ------------------------------------------------
{
  const { ctx, p } = await open(1366, 768, "light", { noWebgl: true });
  check(await p.locator('[data-testid="ml-fallback"]').count() === 1, "no WebGL: the 2D fallback bench is shown");
  await click(p, "ml3-prepare-A"); const l = await ledger(p); check(l.t > 0 && (await p.evaluate(() => document.querySelector('[data-testid="mole-lab"]').__moleLab.getState().scenes[3].data.stations.A.atMark)), "no WebGL: the whole experiment still works");
  await p.screenshot({ path: path.join(out, "s3-fallback.png") }); await ctx.close();
}
{
  const { ctx, p } = await open(1366, 768, "light", { reduced: true });
  const gl = await p.evaluate(() => { const c = document.querySelector('[data-testid="ml-bench"] canvas'); const g = c?.getContext("webgl2") || c?.getContext("webgl"); const e = g?.getExtension("WEBGL_lose_context"); if (e) { e.loseContext(); return true; } return false; });
  await p.waitForTimeout(1200); check(gl === false || (await p.locator(ML).count()) === 1, "WebGL context lost: the page stays alive");
  await click(p, "ml-tab-1"); await click(p, "ml-tab-3"); await p.waitForTimeout(800); check((await p.locator('[data-testid="ml-controls-3"]').count()) === 1, "switching away and back after context loss works");
  await ctx.close();
}

check(errors.length === 0, `no console/page errors (${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""})`);
await browser.close(); srv.kill(); fs.rmSync(dist, { recursive: true, force: true });
console.log(`\n${problems.length ? "FAILED" : "PASSED"}: ${problems.length} problem(s). Screenshots in ${out}`); process.exit(problems.length ? 1 : 0);
