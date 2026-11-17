#!/usr/bin/env node
// Headless-Chromium verification of Mole Lab (builds to a temp dir, serves it with vite preview on a free port).
// Usage: node scripts/verify-mole-lab.mjs [outDir]       Honest limits: software WebGL (SwiftShader); fps is NOT representative of a GPU.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const out = process.argv[2] || "/tmp/mole-lab-verify"; fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const dist = fs.mkdtempSync(path.join(os.tmpdir(), "mole-lab-dist-"));
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const problems = []; const notes = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? "  ok  " : "  FAIL"} ${msg}`); };

console.log("building to", dist);
execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { stdio: "ignore" });
const port = await freePort();
const srv = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* waiting */ } await new Promise((r) => setTimeout(r, 500)); }

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const errors = [];
async function open(w, h, theme = "light", touch = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: touch });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => localStorage.setItem("e-lab:theme", t), theme);
  await p.goto(`${base}/simulation/mole-lab`); await p.waitForSelector('[data-testid="mole-lab"]', { timeout: 30000 }); await p.waitForTimeout(2500);
  return { ctx, p };
}
const totals = (p) => p.evaluate(() => { const s = document.querySelector('[data-testid="mole-lab"]').__moleLab.getState(); const sc = s.scenes[s.stage]; const t = {}; for (const k of sc.packets) t[k.substanceId] = (t[k.substanceId] ?? 0) + k.q; return { stage: s.stage, t, n: sc.packets.length, qs: sc.packets.map((k) => k.q) }; });
const dispatch = (p, a) => p.evaluate((x) => document.querySelector('[data-testid="mole-lab"]').__moleLab.dispatch(x).last, a);
const sameTotals = (a, b) => JSON.stringify(a.t) === JSON.stringify(b.t);

// ---- screenshots + layout at the required sizes -------------------------------------------------
for (const [w, h] of [[1366, 768], [910, 512], [390, 844]]) for (const theme of ["light", "dark"]) for (const stage of [1, 2]) {
  const { ctx, p } = await open(w, h, theme, w < 700);
  if (stage === 2) { await p.click('[data-testid="ml-tab-2"]'); await p.waitForTimeout(2500); }
  await p.screenshot({ path: path.join(out, `s${stage}-${w}x${h}-${theme}.png`) });
  const r = await p.evaluate(() => ({ hs: document.documentElement.scrollWidth - innerWidth, canvas: Boolean(document.querySelector('[data-testid="ml-bench"] canvas')), vp: document.querySelector('[data-testid="ml-viewport"]')?.getBoundingClientRect().height ?? 0 }));
  check(r.hs <= 1, `${w}x${h} ${theme} stage ${stage}: no horizontal page overflow`); check(r.canvas, `${w}x${h} ${theme} stage ${stage}: WebGL canvas present`); check(r.vp >= 200, `${w}x${h} stage ${stage}: viewport at least 200px tall (${Math.round(r.vp)}px)`);
  await ctx.close();
}

// ---- hostile interactions, conservation checked after each --------------------------------------
{
  const { ctx, p } = await open(1366, 768);
  await p.click('[data-testid="ml-tab-2"]'); await p.waitForTimeout(500);
  await dispatch(p, { type: "s2/setMass", value: "60" }); await p.waitForTimeout(800); // 2.5 mol of Mg: 3 packets
  const base0 = await totals(p); check(base0.n >= 3, `stage 2 has several packets for 60 g Mg (n=${base0.n})`);
  const box = await p.locator('[data-testid="ml-viewport"]').boundingBox();
  const mid = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const ok = async (label) => { const t = await totals(p); check(sameTotals(t, base0), `conserved after: ${label}`); };

  await p.mouse.move(mid.x, mid.y); await p.mouse.down(); await p.mouse.move(box.x - 60, box.y - 60, { steps: 8 }); await p.mouse.move(box.x + box.width + 80, box.y + box.height + 80, { steps: 8 }); await p.mouse.up(); await ok("drag far outside the viewport");
  await p.mouse.dblclick(mid.x, mid.y); await p.mouse.dblclick(mid.x - 90, mid.y); await ok("double-clicking bags");
  await p.mouse.move(mid.x - 150, mid.y + 40); await p.mouse.down(); await p.mouse.move(mid.x + 150, mid.y + 40, { steps: 12 }); await p.mouse.up(); await ok("drag a bag across the bench");
  const ids = await p.evaluate(() => { const s = document.querySelector('[data-testid="mole-lab"]').__moleLab.getState(); return s.scenes[s.stage].packets.map((k) => k.id); });
  for (let i = 0; i < 12; i += 1) await p.evaluate(([a, b]) => { const ml = document.querySelector('[data-testid="mole-lab"]').__moleLab; ml.ix.pour(a, b); ml.ix.pour(b, a); }, [ids[0], ids[1]]);
  await p.waitForTimeout(150); await ok("12x rapid pour requests while one is in flight");
  await p.evaluate(([a, b]) => { const ml = document.querySelector('[data-testid="mole-lab"]').__moleLab; ml.ix.pour(a, b); }, [ids[1], ids[2]]);
  await p.waitForTimeout(250); await p.keyboard.press("Escape"); await p.waitForTimeout(1500); await ok("pour interrupted with Escape");
  await p.setViewportSize({ width: 600, height: 700 }); await p.waitForTimeout(300); await p.setViewportSize({ width: 1366, height: 768 }); await p.waitForTimeout(500); await ok("resize during use");
  for (const s of [1, 3, 2, 6, 1, 2]) { await p.click(`[data-testid="ml-tab-${s}"]`); await p.waitForTimeout(80); }
  await p.waitForTimeout(500); const afterTabs = await totals(p); check(afterTabs.stage === 2, "rapid stage switching ends on the last tab"); const st2 = await totals(p); check(sameTotals(st2, base0), "stage 2 amounts unchanged by switching tabs");
  await p.evaluate(([a, b]) => { document.querySelector('[data-testid="mole-lab"]').__moleLab.ix.pour(a, b); }, [ids[0], ids[2]]); await p.waitForTimeout(200); await p.click('[data-testid="ml-reset"]'); await p.waitForTimeout(1500);
  const rs = await totals(p); check(rs.n >= 1 && Object.values(rs.t).every((v) => Number.isInteger(v) && v >= 0), "reset mid-animation leaves a valid integer-quanta state");
  const inv = await p.evaluate(() => { const ml = document.querySelector('[data-testid="mole-lab"]').__moleLab; return ml.getState().last; }); notes.push(`last notice after reset: ${JSON.stringify(inv).slice(0, 80)}`);
  await ctx.close();
}

// ---- stage 1: count / separate / recombine keep the amount ---------------------------------------
{
  const { ctx, p } = await open(1366, 768);
  const t0 = await totals(p);
  await dispatch(p, { type: "s1/count" }); await dispatch(p, { type: "s1/separate" }); await dispatch(p, { type: "s1/recombine", stage: 1 });
  check(sameTotals(await totals(p), t0), "stage 1 count/separate/recombine conserve the amount");
  await ctx.close();
}

// ---- performance (software GL: indicative only) -------------------------------------------------
{
  const { ctx, p } = await open(1366, 768);
  const fps = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n += 1; if (performance.now() - t0 > 3000) res(n / ((performance.now() - t0) / 1000)); else requestAnimationFrame(f); }; requestAnimationFrame(f); }));
  notes.push(`SwiftShader (software) rAF rate at 1366x768 stage 1: ${fps.toFixed(1)} fps -- NOT representative of a real GPU`);
  const detail = await p.evaluate(() => document.querySelector('[data-testid="mole-lab"]').__moleLab.detail); notes.push(`detail level chosen after adaptive step-down: ${detail}`);
  await ctx.close();
}

check(errors.length === 0, `no console/page errors (${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""})`);
await browser.close(); srv.kill(); fs.rmSync(dist, { recursive: true, force: true });
console.log("\nnotes:\n  " + notes.join("\n  ")); console.log(`screenshots: ${out}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed"); process.exit(problems.length ? 1 : 0);
