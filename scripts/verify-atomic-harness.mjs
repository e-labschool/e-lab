// Shared helper for the atomic-structure verify scripts: builds the app into a temp dir, serves it with
// `vite preview` on a free port, launches headless Chromium (SwiftShader). Honest limits: Chromium only, software GL,
// synthetic mouse, no touch, no real GPU, no Firefox/Safari.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const IGNORE = [/willReadFrequently/, /Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL/, /Failed to load resource/, /net::ERR/, /GroupMarkerNotSet/];
export const T = (id) => `[data-testid="${id}"]`;
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });

export async function start({ sizes = ["1366x768", "910x512", "390x844"], themes = ["light", "dark"] } = {}) {
  const problems = []; let checks = 0;
  const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
  let base = process.env.BASE_URL; let dist = null; let preview = null; let port = 0;
  const startPreview = () => { preview = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" }); };
  if (!base && process.env.DIST) {
    dist = process.env.DIST; port = await freePort(); startPreview(); base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* wait */ } await sleep(200); }
  }
  if (!base) {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), "elab-dist-"));
    console.log(`building into ${dist} ...`);
    const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: root, stdio: "pipe", encoding: "utf8" });
    if (b.status !== 0) { console.log(b.stdout, b.stderr); process.exit(1); }
    port = await freePort(); startPreview(); base = `http://127.0.0.1:${port}`;
    for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* wait */ } await sleep(200); }
  }
  const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
  const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  async function open(W, H, route, theme = "light", { reducedMotion = "no-preference" } = {}) {
    try { if (!(await fetch(base)).ok) throw new Error("down"); } catch { if (dist) { startPreview(); await sleep(2500); } }
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, reducedMotion });
    await ctx.addInitScript((t) => { try { localStorage.setItem("e-lab:theme", t); } catch { /* ignore */ } }, theme);
    const p = await ctx.newPage(); const errors = [];
    p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
    p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    await p.goto(`${base}${route}`, { waitUntil: "networkidle" });
    await sleep(500);
    return { ctx, p, errors };
  }
  const SIZES = (process.env.SIZES ? process.env.SIZES.split(",") : sizes).map((s) => s.split("x").map(Number));
  const THEMES = process.env.THEMES ? process.env.THEMES.split(",") : themes;
  async function finish(name) {
    await browser.close(); preview?.kill();
    console.log(`\n${name}: ${checks} checks, ${problems.length} problems`);
    for (const p of problems) console.log("  -", p);
    process.exit(problems.length ? 1 : 0);
  }
  return { open, check, SIZES, THEMES, finish, problems, base };
}

/** Controls (buttons, inputs, [role=button/tab/radio], summary) whose visible centre point is covered by a DIFFERENT element. */
export function coveredControls(p, scopeSel = "body") {
  return p.evaluate((scopeSel) => {
    const out = [];
    const scope = document.querySelector(scopeSel) || document.body;
    for (const el of scope.querySelectorAll('button, input, select, textarea, a[href], [role="button"], [role="tab"], [role="radio"], [role="option"]')) {
      const cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.display === "none") continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      // only controls actually inside the viewport (scrolled-away ones are checked after scrolling)
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) continue;
      // intersect with every clipping ancestor: a control scrolled partly out of its container is CLIPPED, not covered
      let L = r.left, R = r.right, Tp = r.top, B = r.bottom;
      for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
        const o = getComputedStyle(a);
        if (/(auto|scroll|hidden|clip)/.test(o.overflowY + o.overflowX)) { const ar = a.getBoundingClientRect(); L = Math.max(L, ar.left); R = Math.min(R, ar.right); Tp = Math.max(Tp, ar.top); B = Math.min(B, ar.bottom); }
      }
      L = Math.max(L, 0); Tp = Math.max(Tp, 0); R = Math.min(R, innerWidth); B = Math.min(B, innerHeight);
      if (R - L < 4 || B - Tp < 4) continue;
      const cx = (L + R) / 2; const cy = (Tp + B) / 2;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== el && !el.contains(top) && !top.contains(el)) out.push(`${el.tagName.toLowerCase()}[${(el.getAttribute("aria-label") || el.textContent || el.getAttribute("data-testid") || "").trim().slice(0, 30)}] covered by ${top.tagName.toLowerCase()}.${String(top.className).slice(0, 40)}`);
    }
    return out;
  }, scopeSel);
}
export const rect = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
export const txt = async (p, sel) => ((await p.locator(sel).first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
export const hasHScroll = (p) => p.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
