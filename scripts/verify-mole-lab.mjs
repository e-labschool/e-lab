#!/usr/bin/env node
// CHANGED (redesign): headless-Chromium verification of the redesigned Mole Lab (all six stages) (builds to a temp dir, serves it with vite preview on a free port).
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
async function open(w, h, theme) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: w < 700 });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::|WebGL|GPU stall/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => localStorage.setItem("e-lab:theme", t), theme);
  await p.goto(`${base}/simulation/mole-lab`); await p.waitForSelector('[data-testid="mole-lab"]', { timeout: 30000 }); await p.waitForTimeout(2500);
  return { ctx, p };
}
for (const [w, h] of [[1366, 768], [910, 512], [390, 844]]) for (const theme of ["light", "dark"]) {
  const { ctx, p } = await open(w, h, theme);
  for (let stage = 1; stage <= 6; stage += 1) {
    await p.evaluate((n) => document.querySelector(`[data-testid="ml-tab-${n}"]`).click(), stage); await p.waitForTimeout(2500);
    await p.screenshot({ path: path.join(out, `s${stage}-${w}x${h}-${theme}.png`), timeout: 60000 });
    const r = await p.evaluate(() => ({ hs: document.documentElement.scrollWidth - innerWidth, canvas: Boolean(document.querySelector('[data-testid="mole-lab"] canvas')), exp: document.querySelector('[data-testid="ml-experiment"]')?.getBoundingClientRect().height ?? 0, root: document.querySelector('[data-testid="mole-lab"]').getBoundingClientRect().height }));
    check(r.hs <= 1, `${w}x${h} ${theme} stage ${stage}: no horizontal page overflow`);
    check(r.canvas, `${w}x${h} ${theme} stage ${stage}: WebGL canvas present`);
    check(r.exp >= 0.5 * r.root || r.exp >= 200, `${w}x${h} stage ${stage}: experiment area large (${Math.round(r.exp)}px of ${Math.round(r.root)}px)`);
  }
  await ctx.close();
}
check(errors.length === 0, `no page errors (${errors.slice(0, 3).join(" | ")})`);
await browser.close(); srv.kill(); fs.rmSync(dist, { recursive: true, force: true });
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed (software WebGL only; no GPU, touch, Safari, Firefox or screen reader)");
process.exit(problems.length ? 1 : 0);
