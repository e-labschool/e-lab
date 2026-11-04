// Headless-Chromium verification for the Spectroscopy Simulation Lab (needs a running dev server + Playwright/Chromium).
// Usage: node scripts/verify-spectroscopy-studio.mjs [baseUrl] [outDir]     Route: /simulation/spectroscopy-studio
// Without a baseUrl the app is built into a temp directory and served by `vite preview` on a free port (stopped at the end); a build is used
// instead of the dev server so that concurrent source edits (HMR full reloads) cannot reset the page mid-run.
// Honest limits: software GL (SwiftShader), synthetic mouse events only; no real GPU, no real touch hardware, Chromium only.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
async function freePort() { return new Promise((res, rej) => { const srv = net.createServer(); srv.listen(0, "127.0.0.1", () => { const { port } = srv.address(); srv.close(() => res(port)); }); srv.on("error", rej); }); }
let server = null; let base = process.argv[2];
if (!base) {
  const cwd = new URL("..", import.meta.url).pathname; const dist = `${process.env.TMPDIR || "/tmp"}/ss-verify-dist-${process.pid}`;
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort(); server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" }); base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await new Promise((r) => setTimeout(r, 500)); }
}
const out = process.argv[3] || "/tmp/spectroscopy-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const problems = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /Multiple instances of Three/];
const STAGES = ["principle", "instrument", "molecular", "spectrum", "interpretation"];
const ONLY = process.env.SIZES ? process.env.SIZES.split(",") : null;

for (const [w, h] of SIZES) {
  if (ONLY && !ONLY.includes(`${w}x${h}`)) continue;
  const tag = `${w}x${h}`; console.log(tag);
  const ctx = await browser.newContext({ viewport: { width: w, height: h } }); const p = await ctx.newPage(); const errs = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((r) => r.test(m.text()))) errs.push(m.text().slice(0, 240)); });
  p.on("pageerror", (e) => errs.push(`pageerror ${e.message}`));
  await p.goto(`${base}/simulation/spectroscopy-studio`, { waitUntil: "domcontentloaded" });
  await p.waitForSelector(T("spectroscopy-workspace"), { timeout: 30000 }); await sleep(2500);
  const geom = async (label) => {
    const m = await p.evaluate(() => {
      const de = document.documentElement; const ws = document.querySelector('[data-testid="spectroscopy-workspace"]'); const r = ws.getBoundingClientRect();
      const clipped = [...ws.querySelectorAll("button, [role=tab]")].filter((b) => { const q = b.getBoundingClientRect(); return q.width > 0 && (q.right > r.right + 1 || q.left < r.left - 1); }).length;
      return { hx: de.scrollWidth - innerWidth, vy: de.scrollHeight - innerHeight, wsw: ws.scrollWidth - ws.clientWidth, clipped };
    });
    check(m.hx <= 1, `${tag} ${label}: horizontal page overflow ${m.hx}px`);
    if (w >= 1280) check(m.vy <= 1, `${tag} ${label}: vertical page scroll ${m.vy}px on a desktop size`);
    check(m.clipped === 0, `${tag} ${label}: ${m.clipped} controls clipped outside the workspace`);
  };
  for (const s of STAGES) {
    await p.click(T(`stage-${s}`)); await sleep(1800); await geom(`stage ${s}`);
    await p.screenshot({ path: `${out}/${tag}-${s}.png` });
  }
  // Stage 1 / 2 interaction and state kept across stage switches
  await p.click(T("stage-principle")); await sleep(600); await p.click(T("act-p-field")); await sleep(1200);
  const b0 = p.locator("input[type=range]").first();
  await b0.evaluate((el) => { const d = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value"); d.set.call(el, "12"); el.dispatchEvent(new Event("input", { bubbles: true })); el.dispatchEvent(new Event("change", { bubbles: true })); });
  await sleep(600);
  const nu = async () => (await p.locator(T("spectroscopy-workspace")).innerText()).match(/(\d+(?:\.\d+)?)\s*MHz/)?.[1];
  const nu12 = await nu(); check(nu12 && Math.abs(Number(nu12) - 510.9) < 1.5, `${tag}: nu0 at 12 T expected ~510.9 MHz, got ${nu12}`);
  await p.screenshot({ path: `${out}/${tag}-field12T.png` });
  for (const s of ["instrument", "molecular", "spectrum", "principle"]) { await p.click(T(`stage-${s}`)); await sleep(500); }
  await sleep(800); check((await nu()) === nu12, `${tag}: B0 state lost after switching stages (${await nu()} vs ${nu12})`);
  await p.click(T("act-p-rf")); await sleep(1500); await p.screenshot({ path: `${out}/${tag}-rf.png` });
  await p.click(T("stage-instrument")); await sleep(800); await p.click(T("start-guided")); await sleep(1200);
  for (let i = 1; i <= 6; i += 1) { await p.click(T(`step-${i}`)); await sleep(700); check((await p.locator(T("spectrometer-view")).getAttribute("data-step")) === String(i - 1), `${tag}: guided step ${i} not active`); }
  await p.screenshot({ path: `${out}/${tag}-guided6.png` });
  await p.click(T("list-probe")); await sleep(900); await p.screenshot({ path: `${out}/${tag}-probe.png` });
  await p.click(T("act-i-signal")); await sleep(1000); await geom("signal"); await p.screenshot({ path: `${out}/${tag}-fid.png` });
  // Technique tabs and splitting
  await p.click(T("tech-splitting")); await sleep(1500); await geom("splitting"); await p.screenshot({ path: `${out}/${tag}-splitting.png` });
  await p.click(T("tech-ms")); await sleep(500); await geom("ms placeholder"); await p.screenshot({ path: `${out}/${tag}-ms.png` });
  await p.click(T("tech-nmr")); await sleep(800);
  // Tab hide / show
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: true, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(600);
  await p.evaluate(() => { Object.defineProperty(document, "hidden", { value: false, configurable: true }); document.dispatchEvent(new Event("visibilitychange")); }); await sleep(800);
  check((await p.locator(T("stage-box")).getAttribute("data-stage")) === "instrument", `${tag}: stage lost after hide/show`);
  check(errs.length === 0, `${tag}: console errors: ${errs.slice(0, 3).join(" | ")}`);
  await ctx.close();
}
await browser.close(); if (server) server.kill();
console.log(`\n${checks} checks, ${problems.length} problem(s)`); process.exit(problems.length ? 1 : 0);
