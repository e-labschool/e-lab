#!/usr/bin/env node
// Re-runnable generator for the simulation library / landing-page thumbnails (NOT part of `npm test`).
//   node scripts/capture-sim-thumbs.mjs            build the app to a temp dir, serve it, capture every live simulation
//   env: SIMS=id1,id2   only these ids          BASE_URL=http://host:port   use a server that is already running (skips the build)
//        WAIT=4500      ms to let each simulation settle (WebGL needs a few seconds under SwiftShader)
//        CHROMIUM=/path/to/chrome
// For each live simulation in src/data/simulationCatalogue.js it opens the standalone route /simulation/:id (the same
// view as "Open in New Tab") in headless Chromium, takes a 16:10 crop of the simulation area at 1120x700, downsizes it to
// 640x400 and writes public/sim-thumbs/<id>.webp (quality stepped down until the file is < 60 KB).
//   node scripts/capture-sim-thumbs.mjs --app-shots   instead capture the landing-page screenshots of the REAL app pages
//        (public/landing/{assess,progress,teacher-simulations}.webp) through the mock-Supabase harness (scripts/harness) --
//        so they show the real UI with an EMPTY account, never invented data.  env: LEARN_PATH=/student/learn/<lesson> also
//        captures learn.webp (only worth doing against real lesson content; the mock database has none worth showing).
// Needs: Playwright at /opt/node-tools, Chromium, and ImageMagick `convert` with WebP support.
// Honest limits: SwiftShader (software GL), default light theme, whatever state the simulation opens in; no real GPU.
import { spawn, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { getLiveSimulations } from "../src/data/simulationCatalogue.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "public", "sim-thumbs");
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const wait = Number(process.env.WAIT || 4500);
const MAX_BYTES = 60 * 1024;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => resolve(port)); });
    s.on("error", reject);
  });
}
function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, { cwd: root, stdio: "ignore", ...opts });
    c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`))));
  });
}

if (process.argv.includes("--app-shots")) {
  const { startServer, launch, BASE } = await import("./harness/browser.mjs");
  const stop = await startServer(); const b = await launch();
  const landing = path.join(root, "public", "landing"); fs.mkdirSync(landing, { recursive: true });
  const jobs = [["student", "/student/solve", "assess"], ["student", "/student/progress", "progress"], ["teacher", "/teacher/simulations", "teacher-simulations"]];
  if (process.env.LEARN_PATH) jobs.unshift(["student", process.env.LEARN_PATH, "learn"]);
  const c = await b.newContext({ viewport: { width: 1120, height: 764 }, colorScheme: "light" });
  for (const [role, route, name] of jobs) {
    const pg = await c.newPage();
    await pg.goto(`${BASE}/`); await pg.evaluate((r) => { localStorage.clear(); localStorage.setItem("mock-role", r); }, role);
    await pg.goto(`${BASE}${route}`); await sleep(2500);
    const png = path.join(os.tmpdir(), `landing-${name}.png`);
    await pg.screenshot({ path: png, clip: { x: 0, y: 64, width: 1120, height: 700 } }); // below the app tab bar
    const dest = path.join(landing, `${name}.webp`);
    execFileSync("convert", [png, "-resize", "800x500", "-strip", "-quality", "70", dest]);
    console.log(`ok   ${name}  ${(fs.statSync(dest).size / 1024).toFixed(1)} KB`);
    await pg.close();
  }
  await b.close(); stop(); process.exit(0);
}

let server = null; let tmp = null; let base = process.env.BASE_URL;
if (!base) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "elab-thumbs-"));
  console.log("building to", tmp);
  await run("npx", ["vite", "build", "--outDir", tmp, "--emptyOutDir"]);
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--outDir", tmp, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await sleep(200); }
}

fs.mkdirSync(outDir, { recursive: true });
const ids = process.env.SIMS ? process.env.SIMS.split(",") : getLiveSimulations().map((e) => e.id);
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1120, height: 700 }, colorScheme: "light", deviceScaleFactor: 1 });
let failed = 0;
for (const id of ids) {
  const page = await ctx.newPage();
  try {
    await page.goto(`${base}/simulation/${id}`, { waitUntil: "load" });
    await page.waitForSelector(".elab-sim, .sd-frame", { timeout: 20000 });
    await sleep(wait);
    const png = path.join(os.tmpdir(), `thumb-${id}.png`);
    // Crop below the thin standalone header so the thumbnail is the simulation itself.
    await page.screenshot({ path: png, clip: { x: 0, y: 36, width: 1120, height: 700 - 36 } });
    const dest = path.join(outDir, `${id}.webp`);
    let q = 78;
    for (;;) {
      execFileSync("convert", [png, "-resize", "640x400^", "-gravity", "north", "-extent", "640x400", "-strip", "-quality", String(q), dest]);
      if (fs.statSync(dest).size <= MAX_BYTES || q <= 30) break;
      q -= 8;
    }
    fs.unlinkSync(png);
    console.log(`ok   ${id}  ${(fs.statSync(dest).size / 1024).toFixed(1)} KB (q${q})`);
  } catch (e) {
    failed += 1; console.log(`FAIL ${id}: ${e.message.split("\n")[0]}`);
  } finally { await page.close(); }
}
await browser.close();
if (server) server.kill();
if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
process.exit(failed ? 1 : 0);
