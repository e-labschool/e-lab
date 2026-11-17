#!/usr/bin/env node
// Headless-Chromium verification for the bonding group (VSEPR, Bonding, Hybridisation, Intermolecular Forces) + landing hero.
//   node scripts/verify-bonding-group.mjs            builds to a temp dir, serves it with `vite preview` on a free port, runs everything
//   env: BASE_URL=http://host:port (skip build)  SIMS=vsepr,bonding,hyb,imf,landing  SIZES=1366x768,910x512,390x844  SHOTS=/tmp/dir
// Software WebGL (SwiftShader), synthetic mouse / keyboard.  NOT covered: real GPU speed, real touch hardware, Safari / Firefox.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const shots = process.env.SHOTS || "/tmp/bonding-group-shots"; fs.mkdirSync(shots, { recursive: true });
const SIMS = (process.env.SIMS || "vsepr,bonding,bonding2,hyb,imf,landing").split(",");
const ALL_SIZES = [[1366, 768], [910, 512], [390, 844]];
const SIZES = process.env.SIZES ? process.env.SIZES.split(",").map((s) => s.split("x").map(Number)) : ALL_SIZES;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const T = (id) => `[data-testid="${id}"]`;
const problems = []; let checks = 0;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } }
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /fonts\.g/, /THREE\.WARNING: Multiple/, /WebGL context was lost/i, /CONTEXT_LOST/i, /ReadPixels/];
const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const run = (cmd, args) => new Promise((res, rej) => { const c = spawn(cmd, args, { cwd: root, stdio: "ignore" }); c.on("exit", (code) => (code === 0 ? res() : rej(new Error(`${cmd} ${args.join(" ")} exited ${code}`)))); });

let server = null; let tmp = null; let base = process.env.BASE_URL;
if (!base) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "elab-bgv-")); console.log("building to", tmp);
  await run("npx", ["vite", "build", "--outDir", tmp, "--emptyOutDir"]);
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--outDir", tmp, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 300; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await sleep(200); }
}
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(url, { w, h, scheme = "light", nowebgl = false, touch = false, reduced = false }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: scheme, hasTouch: touch, reducedMotion: reduced ? "reduce" : "no-preference" });
  const page = await ctx.newPage(); const errors = [];
  page.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((r) => r.test(m.text()))) errors.push(m.text().slice(0, 200)); });
  page.on("pageerror", (e) => { if (!IGNORE.some((r) => r.test(e.message))) errors.push(`pageerror: ${e.message.slice(0, 200)}`); });
  if (nowebgl) await page.addInitScript(() => { const orig = HTMLCanvasElement.prototype.getContext; HTMLCanvasElement.prototype.getContext = function g(t, ...a) { if (/webgl/i.test(t)) return null; return orig.call(this, t, ...a); }; });
  await page.goto(`${base}${url}`, { waitUntil: "load" }); await sleep(1500);
  return { ctx, page, errors };
}
/** Page-level health: no horizontal overflow, no control clipped horizontally outside its simulation root, no errors. */
async function health(S, label, rootSel) {
  const r = await S.page.evaluate((rootSel) => {
    const d = document.documentElement; const ws = document.querySelector(rootSel); const bad = [];
    if (ws) { const wr = ws.getBoundingClientRect(); for (const el of ws.querySelectorAll("button, select, input[type=search], [role=tab], [role=radio]")) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue;
      let sc = el.parentElement; let scroll = false; while (sc && sc !== ws) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowX) && sc.scrollWidth > sc.clientWidth + 1) { scroll = true; break; } sc = sc.parentElement; }
      if (!scroll && (r.left < wr.left - 1 || r.right > wr.right + 1)) bad.push(`${el.getAttribute("data-testid") || el.textContent.trim().slice(0, 18)} ${Math.round(r.left)}-${Math.round(r.right)}`);
    } }
    return { docX: d.scrollWidth - d.clientWidth, bad: bad.slice(0, 5), found: !!ws };
  }, rootSel);
  check(r.found, `${label}: simulation root present`); check(r.docX <= 1, `${label}: horizontal page overflow ${r.docX}px`); check(r.bad.length === 0, `${label}: clipped controls ${r.bad.join("; ")}`);
  return r;
}
const shot = (S, name) => S.page.screenshot({ path: path.join(shots, `${name}.png`) }).catch(() => {});
const stageBox = async (page, sel) => page.locator(sel).first().boundingBox();

// ---------------------------------------------------------------------------------------------------------------
const MODULES = { vsepr: "./verify-bonding-group/vsepr.mjs", bonding: "./verify-bonding-group/bonding.mjs", bonding2: "./verify-bonding-group/bonding2.mjs", hyb: "./verify-bonding-group/hyb.mjs", imf: "./verify-bonding-group/imf.mjs", landing: "./verify-bonding-group/landing.mjs" };
const ctx = { browser, base, open, health, check, sleep, T, shot, stageBox, SIZES, errorsCheck: (S, label) => check(S.errors.length === 0, `${label}: console errors ${S.errors.slice(0, 2).join(" | ")}`) };
for (const id of SIMS) {
  const file = path.join(path.dirname(fileURLToPath(import.meta.url)), "verify-bonding-group", `${id}.mjs`);
  if (!fs.existsSync(file)) { console.log(`(no verify module for ${id})`); continue; }
  console.log(`\n=== ${id}`); await (await import(MODULES[id])).default(ctx);
}
await browser.close(); if (server) server.kill(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${checks} checks, ${problems.length} problems${problems.length ? ":\n - " + problems.join("\n - ") : ""}`);
process.exit(problems.length ? 1 : 0);
