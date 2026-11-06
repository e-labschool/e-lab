#!/usr/bin/env node
// Universal simulation audit (Task 5 of docs/UNIVERSAL_AUDIT_SPEC.md).
//
//   node scripts/audit-simulations.mjs [outDir]
//
// For EVERY id in src/data/simulationRegistry.js it opens the simulation in four presentation modes and at seven
// viewport sizes with headless Chromium (Playwright, SwiftShader GL) and records what was measured:
//
//   standalone     /simulation/:id (what "Open in New Tab" opens)
//   embedded       the real Student Learn page (/student/learn/lesson-sim) rendering the registry's simulation block,
//                  against scripts/harness/mock-supabase.js (a mocked database, so this is the REAL Learn layout, sidebar,
//                  sticky app bar and LearnBlockRenderer, but NOT live Supabase)
//   fullscreen     embedded page -> click the shell's Fullscreen control -> native Fullscreen API (headless Chromium grants it)
//   fullscreen-css the same, with the Fullscreen API disabled in the page (what an iPhone Safari does) so the shell's CSS
//                  fallback is exercised (no window resize happens there, so it also proves container-driven re-measuring)
//
//   sizes: 1366x768  1920x1080  1024x768  820x1180  390x844   and browser-zoom emulation 125% (1092x614) / 150% (910x512)
//   (zoom is emulated by the equivalent CSS-pixel viewport of a 1366x768 window; it is NOT real browser zoom)
//
// Checks per view: action controls present exactly once with accessible name + tooltip; no duplicate full-screen /
// new-tab buttons; console errors/warnings and page errors; horizontal overflow; vertical page scroll (standalone and
// fullscreen at >= 1024 px); every button/input/select/tab/slider inside the simulation is inside the viewport, not
// clipped by an overflow:hidden ancestor and not covered at its centre point (document.elementFromPoint, the technique of
// verify-simulation-button-contrast.mjs) - controls reachable only by scrolling a panel are reported as "scrolls";
// canvas CSS size vs backing size. Per simulation (standalone 1366x768): slider keyboard response, tab clicks, Reset;
// (fullscreen 1366x768 and 390x844): slider value + DOM identity survive 6 enter/exit cycles, exit by button, Escape,
// event-listener growth (addEventListener wrapper) and WebGL context growth.
//
// Outputs <outDir>/audit-results.json (machine readable), <outDir>/audit-summary.md (table) and screenshots
// <outDir>/shots/<sim>__<mode>__<size>.png (1366x768 and 390x844 only).
//
// Env: SIMS=id,id  MODES=standalone,embedded,fullscreen,fullscreen-css  SIZES=1366x768,...  CONC=4  SHOTS=0  DEV=1
//      (DEV=1 builds with NODE_ENV=development so React dev-only warnings show up in the console log)
//      BASE=http://host:port  skips the build/preview and audits that server (must use the mock-supabase harness build)
// Honest limits: headless Chromium only; real OS-level fullscreen, real touch, real browser zoom, other browsers and live
// Supabase are NOT covered. Escape from NATIVE fullscreen is handled by the browser chrome, which headless does not emulate.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import os from "node:os";
import net from "node:net";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || path.join(os.tmpdir(), "elab-audit-simulations");
fs.mkdirSync(path.join(out, "shots"), { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { SIMULATION_REGISTRY } = await import(pathToFileURL(path.join(root, "src/data/simulationRegistry.js")).href);

const ALL_SIZES = { "1366x768": [1366, 768], "1920x1080": [1920, 1080], "1024x768": [1024, 768], "820x1180": [820, 1180], "390x844": [390, 844], "z125-1092x614": [1092, 614], "z150-910x512": [910, 512] };
const ALL_MODES = ["standalone", "embedded", "fullscreen", "fullscreen-css"];
const ids = (process.env.SIMS ? process.env.SIMS.split(",") : Object.keys(SIMULATION_REGISTRY));
const modes = process.env.MODES ? process.env.MODES.split(",") : ALL_MODES;
const sizeKeys = process.env.SIZES ? process.env.SIZES.split(",") : Object.keys(ALL_SIZES);
const CONC = Number(process.env.CONC || 4);
const SHOTS = process.env.SHOTS !== "0";
// fullscreen-css is the same layout code for every size; measure it where it matters.
const CSS_SIZES = new Set(["1366x768", "820x1180", "390x844"]);
const CYCLE_SIZES = new Set(["1366x768", "390x844"]);

// ---------------------------------------------------------------- build + serve
async function freePort() { return new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); }); }
let server = null; let base = process.env.BASE;
if (!base) {
  const dist = path.join(os.tmpdir(), `elab-audit-dist-${process.pid}`);
  const env = { ...process.env, ...(process.env.DEV ? { NODE_ENV: "development" } : {}) };
  await new Promise((res, rej) => spawn("npx", ["vite", "build", "--config", "scripts/harness/vite.harness.config.js", "--outDir", dist, "--emptyOutDir", ...(process.env.DEV ? ["--minify", "false"] : [])], { cwd: root, stdio: "ignore", env }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--config", "scripts/harness/vite.harness.config.js", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up yet */ } await sleep(500); }
  process.on("exit", () => { try { server.kill(); } catch { /* gone */ } fs.rmSync(dist, { recursive: true, force: true }); });
}
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

// ---------------------------------------------------------------- page instrumentation + seeded Learn lesson
const IGNORE = [/Supabase is not configured/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/, /THREE\.Clock/, /Multiple instances of Three/, /Automatic fallback to software WebGL/, /ReadPixels/, /swiftshader/i, /Download the React DevTools/];

function seedDb(simId) {
  return {
    learn_pages: [{ id: "lesson-sim", parent_topic: "S2.1", lesson_code: "S2.1.1", syllabus_codes: ["S2.1.1"], title: "Audit lesson", level: "SL/HL", status: "published", display_order: 1, display_order_sl: 1, display_order_hl: 1, updated_at: "2026-01-01T00:00:00Z" }],
    learn_blocks: [{ id: "bsim", page_id: "lesson-sim", block_type: "simulation", position: 0, visible: true, content: { simulationId: simId, audience: "both" } }],
    profiles: [{ id: "u-student", role: "student", status: "active", level: "HL", full_name: "Test Student", email: "s@example.com" }],
  };
}

const INSTRUMENT = () => {
  // --- event-listener ledger: effective adds minus effective removes per target (once/signal listeners are not counted).
  // Listeners sitting on a DOM node that has been removed from the document die with it, so the net count only includes
  // targets that are still alive: window, document, matchMedia lists, timers' targets and connected nodes.
  const seen = new WeakMap(); const perTarget = new Map(); const L = { added: 0, removed: 0 };
  Object.defineProperty(L, "net", { get() { let n = 0; for (const [t, c] of perTarget) { if (c <= 0) continue; if (typeof Node !== "undefined" && t instanceof Node && !t.isConnected) continue; n += c; } return n; } });
  const key = (type, cap) => `${type}|${cap ? 1 : 0}`;
  const add = EventTarget.prototype.addEventListener; const rem = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (type, fn, opts) {
    try {
      if (fn && !(opts && typeof opts === "object" && (opts.once || opts.signal))) {
        const cap = typeof opts === "boolean" ? opts : !!(opts && opts.capture);
        let m = seen.get(this); if (!m) { m = new Map(); seen.set(this, m); }
        let s = m.get(key(type, cap)); if (!s) { s = new Set(); m.set(key(type, cap), s); }
        if (!s.has(fn)) { s.add(fn); perTarget.set(this, (perTarget.get(this) || 0) + 1); L.added += 1; }
      }
    } catch { /* never break the page */ }
    return add.call(this, type, fn, opts);
  };
  EventTarget.prototype.removeEventListener = function (type, fn, opts) {
    try {
      const cap = typeof opts === "boolean" ? opts : !!(opts && opts.capture);
      const s = seen.get(this)?.get(key(type, cap));
      if (s && s.delete(fn)) { perTarget.set(this, (perTarget.get(this) || 1) - 1); L.removed += 1; }
    } catch { /* ignore */ }
    return rem.call(this, type, fn, opts);
  };
  window.__listeners = L;
  // --- WebGL context ledger
  const G = { created: 0, refs: [] }; const gc = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
    const ctx = gc.call(this, type, ...rest);
    if (ctx && /webgl/i.test(String(type)) && !this.__counted) { this.__counted = true; G.created += 1; G.refs.push(new WeakRef(this)); }
    return ctx;
  };
  window.__gl = { G, live: () => G.refs.filter((r) => { const c = r.deref(); return c && c.isConnected; }).length };
};
const NO_FULLSCREEN_API = () => {
  try { Object.defineProperty(Document.prototype, "fullscreenEnabled", { configurable: true, get: () => false }); } catch { /* ignore */ }
  for (const k of ["requestFullscreen", "webkitRequestFullscreen", "mozRequestFullScreen"]) { try { Object.defineProperty(Element.prototype, k, { configurable: true, value: undefined }); } catch { /* ignore */ } }
  try { Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { configurable: true, get: () => false }); } catch { /* ignore */ }
};

// ---------------------------------------------------------------- in-page inspector (serialised into the page)
const INSPECT = (cfg) => {
  const { scopeSel, mode } = cfg;
  const fsEl = document.fullscreenElement || document.querySelector('[data-elab-fullscreen="css"]');
  const scope = mode.startsWith("fullscreen") ? fsEl : document.querySelector(scopeSel);
  if (!scope) return { error: `scope not found (${mode.startsWith("fullscreen") ? "fullscreen element" : scopeSel})` };
  const nameOf = (el) => (el.getAttribute("aria-label") || el.getAttribute("title") || el.textContent || "").replace(/\s+/g, " ").trim();
  const visible = (el) => {
    const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    const cs = getComputedStyle(el); if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity) === 0) return false;
    if (el.closest('[aria-hidden="true"], [inert]')) return false;
    return true;
  };
  // ---- action controls
  const all = Array.from(scope.querySelectorAll("button, a, [role=button]")).concat(scope.matches?.("button") ? [scope] : []);
  const FS_RE = /full\s?-?\s?screen/i; const NT_RE = /new\s?tab/i;
  const isShellFs = (b) => b.getAttribute("data-testid") === "sim-fullscreen" || /^(enter |exit )?full\s?-?\s?screen$/i.test(nameOf(b));
  const isShellNt = (b) => b.getAttribute("data-testid") === "sim-new-tab" || /^open (simulation )?in (a )?new tab$/i.test(nameOf(b));
  const fsBtns = all.filter((b) => isShellFs(b));
  const tabBtns = all.filter((b) => isShellNt(b));
  // controls that merely mention full screen / new tab (e.g. the spectrum "Present" toggle) are reported, not counted as the shell pair
  const nested = all.filter((b) => !isShellFs(b) && !isShellNt(b) && (FS_RE.test(nameOf(b)) || NT_RE.test(nameOf(b))) && visible(b)).map((b) => nameOf(b).slice(0, 50));
  const describeBtn = (b) => ({ label: b.getAttribute("aria-label"), title: b.getAttribute("title"), text: (b.textContent || "").replace(/\s+/g, " ").trim().slice(0, 30), visible: visible(b) });
  const actions = { fullscreen: fsBtns.map(describeBtn), newTab: tabBtns.map(describeBtn), nested };
  // ---- document-level overflow
  const de = document.documentElement;
  const hscroll = de.scrollWidth > innerWidth + 1;
  const vscroll = de.scrollHeight > innerHeight + 1;
  // ---- frame geometry
  const sr = scope.getBoundingClientRect();
  const frame = { x: Math.round(sr.left), y: Math.round(sr.top), w: Math.round(sr.width), h: Math.round(sr.height), fitsViewport: sr.right <= innerWidth + 1 && sr.bottom <= innerHeight + 1 && sr.left >= -1 && sr.top >= -1 };
  // ---- controls
  const SEL = 'button, input:not([type=hidden]), select, textarea, [role=tab], [role=slider], [role=button], [role=switch], [role=checkbox], [role=menuitem], summary, a[href]';
  const controls = Array.from(scope.querySelectorAll(SEL)).filter(visible);
  const pageScrollable = (de.scrollHeight > innerHeight + 1 || de.scrollWidth > innerWidth + 1) && !/hidden|clip/.test(getComputedStyle(de).overflowY + getComputedStyle(document.body).overflowY);
  const test = (el, strictViewport) => {
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    if (cx < 0 || cy < 0 || cx >= innerWidth || cy >= innerHeight) return strictViewport ? "outside the viewport" : "ok-offscreen";
    const top = document.elementFromPoint(cx, cy);
    const labelOk = top && (top.closest("label") && (top.closest("label") === el.closest("label") || (el.labels && Array.from(el.labels).includes(top.closest("label")))));
    if (!(top && (el.contains(top) || labelOk))) return `covered by ${top ? (top.tagName.toLowerCase() + (top.className && typeof top.className === "string" ? "." + top.className.split(" ")[0].slice(0, 30) : "")) : "nothing"}`;
    return null;
  };
  const clipOf = (el) => {
    // an ancestor with overflow other than visible whose box does not contain the control's centre
    const r = el.getBoundingClientRect(); const cx = r.left + r.width / 2; const cy = r.top + r.height / 2;
    for (let a = el.parentElement; a && a !== document.body && a !== de; a = a.parentElement) {
      const o = getComputedStyle(a); const ox = o.overflowX; const oy = o.overflowY;
      if (ox === "visible" && oy === "visible") continue;
      const ar = a.getBoundingClientRect();
      if (cx < ar.left - 1 || cx > ar.right + 1 || cy < ar.top - 1 || cy > ar.bottom + 1) {
        const canScroll = (oy === "auto" || oy === "scroll") && a.scrollHeight > a.clientHeight + 1 || (ox === "auto" || ox === "scroll") && a.scrollWidth > a.clientWidth + 1;
        return canScroll ? "scrolls" : "clipped";
      }
    }
    return null;
  };
  const bad = []; let scrolls = 0; let n = 0; const edge = [];
  const sx = scrollX; const sy = scrollY;
  const savedScroll = [];
  for (const el of [scope, ...scope.querySelectorAll("*")]) { if (el.scrollTop || el.scrollLeft || ((el.scrollHeight > el.clientHeight + 1 || el.scrollWidth > el.clientWidth + 1) && /auto|scroll|hidden/.test(getComputedStyle(el).overflow))) savedScroll.push([el, el.scrollTop, el.scrollLeft]); }
  for (const el of controls) {
    n += 1;
    const label = (el.getAttribute("data-testid") ? `[${el.getAttribute("data-testid")}] ` : "") + (nameOf(el) || el.className.toString()).slice(0, 40) + ` <${el.tagName.toLowerCase()}${el.type ? ":" + el.type : ""}>`;
    const clip = clipOf(el);
    let why = test(el, true);
    if (clip === "clipped") { bad.push(`${label}: clipped by an overflow:hidden ancestor`); continue; }
    if (why || clip === "scrolls") {
      // reachable by scrolling the panel (or, embedded, the page)? scrollIntoView, then test again.
      // try the alignments a user can reach by scrolling: centre, bottom, top (a sticky header can hide the centre position)
      let again = why; let clip2 = clip;
      for (const block of ["center", "end", "start"]) {
        el.scrollIntoView({ block, inline: "center" });
        again = test(el, true); clip2 = clipOf(el);
        if (!again && clip2 !== "clipped") break;
      }
      if (!again && clip2 !== "clipped") { scrolls += 1; continue; }
      bad.push(`${label}: ${again || why || "clipped"}${mode === "standalone" || mode.startsWith("fullscreen") ? "" : ""}`);
      continue;
    }
    const r = el.getBoundingClientRect();
    if (r.right > innerWidth + 2 || r.left < -2 || r.bottom > innerHeight + 2 || r.top < -2) edge.push(label);
  }
  for (const [el, t, l] of savedScroll) { el.scrollTop = t; el.scrollLeft = l; }
  scrollTo(sx, sy);
  // ---- canvases
  const scrolledByPanel = (el) => { for (let a = el.parentElement; a && a !== scope.parentElement; a = a.parentElement) { const o = getComputedStyle(a); if (/auto|scroll/.test(o.overflowY) && a.scrollHeight > a.clientHeight + 1) return true; if (/auto|scroll/.test(o.overflowX) && a.scrollWidth > a.clientWidth + 1) return true; } return false; };
  const canvases = Array.from(scope.querySelectorAll("canvas")).filter(visible).map((c) => { const r = c.getBoundingClientRect(); return { cssW: Math.round(r.width), cssH: Math.round(r.height), w: c.width, h: c.height, gl: !!c.__counted, offscreenOfFrame: (r.right > sr.right + 2 || r.bottom > sr.bottom + 2) && !scrolledByPanel(c) }; });
  // ---- svg roots
  const svgs = Array.from(scope.querySelectorAll("svg")).filter((s) => visible(s) && s.getBoundingClientRect().width > 120).map((s) => { const r = s.getBoundingClientRect(); return { cssW: Math.round(r.width), cssH: Math.round(r.height) }; });
  // ---- clipped (overflow:hidden) text candidates inside the scope
  const clippedText = [];
  for (const el of scope.querySelectorAll("*")) {
    if (clippedText.length >= 5) break;
    const cs = getComputedStyle(el); if (cs.overflowX !== "hidden" && cs.overflowX !== "clip") continue;
    if (el.tagName === "CANVAS" || el.tagName === "svg" || el.closest("svg") || !visible(el)) continue;
    if (el.scrollWidth > el.clientWidth + 3 && cs.textOverflow !== "ellipsis" && (el.textContent || "").trim() && el.children.length < 6) clippedText.push((el.textContent || "").trim().slice(0, 30) + ` (${el.scrollWidth}>${el.clientWidth})`);
  }
  // visible content cut off at the left/right edge of its nearest overflow:hidden/clip ancestor (e.g. a fixed-width artwork in a narrow panel)
  const clippedBox = [];
  for (const el of scope.querySelectorAll("*")) {
    if (clippedBox.length >= 4) break;
    if (el.closest("svg") && el.tagName !== "svg") continue;
    if (el.tagName === "CANVAS" || !visible(el)) continue;
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.height < 12) continue;
    if (/absolute|fixed/.test(getComputedStyle(el).position) && getComputedStyle(el).pointerEvents === "none") continue;
    let a = el.parentElement;
    let scroller = false;
    while (a && a !== de) { const o = getComputedStyle(a); if (/auto|scroll/.test(o.overflowX) && a.scrollWidth > a.clientWidth + 1) { scroller = true; break; } if (/hidden|clip/.test(o.overflowX)) break; a = a.parentElement; }
    if (scroller) continue; // inside a horizontal scroller: reachable by scrolling it
    if (!a || a === de || a === document.body) continue;
    const ar = a.getBoundingClientRect();
    if ((r.left < ar.left - 6 || r.right > ar.right + 6) && r.width < ar.width * 0.98 && ar.width > 80) clippedBox.push(`${el.tagName.toLowerCase()}.${String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className).split(" ")[0].slice(0, 28)} ${Math.round(r.left - ar.left)}..${Math.round(r.right - ar.left)} of ${Math.round(ar.width)}`);
  }
  const literalEscape = (scope.innerText || "").match(/\\u[0-9a-fA-F]{4}/);
  // inner horizontal overflow of the frame itself
  const innerHScroll = scope.scrollWidth > scope.clientWidth + 2 && getComputedStyle(scope).overflowX !== "visible";
  return {
    actions, hscroll, vscroll, docSize: [de.scrollWidth, de.scrollHeight], pageScrollable, frame, controls: { total: n, scrolls, bad: bad.slice(0, 8), badCount: bad.length, edge: edge.slice(0, 5) },
    canvases, svgs, clippedText, clippedBox, literalEscape: literalEscape ? literalEscape[0] : null, innerHScroll, isFullscreen: !!document.fullscreenElement, cssFs: !!document.querySelector('[data-elab-fullscreen="css"]'),
    listeners: window.__listeners ? window.__listeners.net : null, gl: window.__gl ? { created: window.__gl.G.created, live: window.__gl.live() } : null,
  };
};

// ---------------------------------------------------------------- view helpers
async function openView(simId, mode, sizeKey) {
  const [w, h] = ALL_SIZES[sizeKey];
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(INSTRUMENT);
  if (mode === "fullscreen-css") await ctx.addInitScript(NO_FULLSCREEN_API);
  if (mode !== "standalone") {
    await ctx.addInitScript(([db]) => { try { localStorage.setItem("mock-supabase-db-v1", JSON.stringify(db)); localStorage.setItem("mock-role", "student"); localStorage.setItem("e-lab:display-settings", "{}"); } catch { /* ignore */ } }, [seedDb(simId)]);
  }
  const page = await ctx.newPage(); page.errs = []; page.warns = [];
  page.on("console", (m) => { const t = m.text(); if (IGNORE.some((r) => r.test(t))) return; if (m.type() === "error") page.errs.push(t.slice(0, 220)); else if (m.type() === "warning") page.warns.push(t.slice(0, 220)); });
  page.on("pageerror", (e) => page.errs.push(`pageerror: ${e.message.slice(0, 200)}`));
  const url = mode === "standalone" ? `${base}/simulation/${simId}` : `${base}/student/learn/lesson-sim`;
  await page.goto(url, { waitUntil: "domcontentloaded" });
  const scopeSel = mode === "standalone" ? "main" : "div.mt-6.space-y-5";
  try { await page.waitForSelector(scopeSel, { timeout: 15000 }); } catch { /* reported by inspector */ }
  // wait until the lazy simulation chunk rendered something interactive
  try { await page.waitForFunction((s) => { const r = document.querySelector(s); return r && r.querySelectorAll("button, canvas, svg, input").length > 3; }, scopeSel, { timeout: 15000 }); } catch { /* reported */ }
  await sleep(/vsepr|bonding|hybrid|intermolecular|orbital|explore-matter|particle-model/.test(simId) ? 2200 : 1200);
  return { page, ctx, scopeSel, mode, sizeKey };
}

const SHELL_FS = 'button[data-testid="sim-fullscreen"], button[aria-label="Enter full screen"], button[aria-label="Exit full screen"], button[aria-label="Fullscreen"], button[aria-label="Exit fullscreen"]';
async function fsButton(page, scopeSel) {
  const cands = page.locator(scopeSel).first().locator(SHELL_FS);
  const n = await cands.count();
  for (let i = 0; i < n; i += 1) { const b = cands.nth(i); if (await b.isVisible()) return b; }
  return null;
}
async function enterFullscreen(view) {
  const b = await fsButton(view.page, view.scopeSel);
  if (!b) return false;
  await b.click(); await sleep(700);
  return await view.page.evaluate(() => !!document.fullscreenElement || !!document.querySelector('[data-elab-fullscreen="css"]'));
}
async function exitFullscreenByButton(view) {
  const b = view.page.locator(SHELL_FS).filter({ visible: true }).first();
  if (await b.count()) { await b.click(); await sleep(600); }
  return await view.page.evaluate(() => !document.fullscreenElement && !document.querySelector('[data-elab-fullscreen="css"]'));
}

// ---------------------------------------------------------------- per-view audit
function evaluateView(r, mode, sizeKey, view) {
  const [w] = ALL_SIZES[sizeKey]; const issues = []; const warnings = []; const info = {};
  if (r.error) { issues.push(r.error); return { issues, warnings, info }; }
  const fs = r.actions.fullscreen; const nt = r.actions.newTab;
  info.actions = { fullscreen: fs.length, newTab: nt.length };
  if (r.actions.nested.length) info.nestedControls = r.actions.nested;
  if (fs.length === 0) issues.push("no Fullscreen control");
  if (nt.length === 0 && mode !== "fullscreen" && mode !== "fullscreen-css") issues.push("no Open-in-New-Tab control");
  if (nt.length === 0 && (mode === "fullscreen" || mode === "fullscreen-css")) warnings.push("no Open-in-New-Tab control while fullscreen");
  const vis = (a) => a.filter((x) => x.visible);
  if (vis(fs).length > 1) issues.push(`${vis(fs).length} Fullscreen buttons visible at once (${vis(fs).map((x) => x.label || x.text).join(" | ")})`);
  if (vis(nt).length > 1) issues.push(`${vis(nt).length} Open-in-New-Tab buttons visible at once (${vis(nt).map((x) => x.label || x.text).join(" | ")})`);
  for (const a of [...vis(fs), ...vis(nt)]) { if (!(a.label || a.text)) issues.push("action control without accessible name"); if (!a.title) warnings.push(`action control "${a.label || a.text}" has no tooltip (title)`); }
  if (mode !== "fullscreen" && mode !== "fullscreen-css") {
    if (r.hscroll) issues.push(`horizontal page overflow (doc ${r.docSize[0]}px > viewport)`);
    if (mode === "standalone" && w >= 1024 && r.vscroll) issues.push(`page scrolls vertically (${r.docSize[1]}px)`);
    if (mode === "standalone" && w < 1024 && r.vscroll) warnings.push(`page scrolls vertically at ${w}px (${r.docSize[1]}px)`);
    if (mode === "standalone" && !r.frame.fitsViewport) issues.push(`simulation frame exceeds the viewport (${r.frame.w}x${r.frame.h} at ${r.frame.x},${r.frame.y})`);
  } else {
    if (r.hscroll) issues.push("horizontal page overflow while fullscreen");
    if (!r.frame.fitsViewport) issues.push(`fullscreen element exceeds the viewport (${r.frame.w}x${r.frame.h})`);
  }
  if (r.innerHScroll) warnings.push("simulation root has inner horizontal overflow");
  if (r.controls.badCount) issues.push(`${r.controls.badCount} control(s) not reachable: ${r.controls.bad.slice(0, 4).join("; ")}`);
  if (r.controls.edge.length) warnings.push(`controls touching the viewport edge: ${r.controls.edge.slice(0, 3).join("; ")}`);
  if (r.controls.scrolls) info.scrollsControls = r.controls.scrolls;
  for (const c of r.canvases) { if (c.offscreenOfFrame) issues.push(`canvas ${c.cssW}x${c.cssH} extends past the simulation frame`); if (c.cssW < 40 || c.cssH < 40) warnings.push(`tiny canvas ${c.cssW}x${c.cssH}`); }
  if (r.literalEscape) issues.push(`literal unicode escape ${r.literalEscape} rendered as text (a JSX attribute/text does not process \\u escapes)`);
  if (r.clippedBox.length) issues.push(`content cut off at an overflow:hidden edge: ${r.clippedBox.slice(0, 3).join("; ")}`);
  if (r.clippedText.length) warnings.push(`possible clipped text: ${r.clippedText.slice(0, 3).join("; ")}`);
  if (view.page.errs.length) issues.push(`console/page errors: ${[...new Set(view.page.errs)].slice(0, 3).join(" || ")}`);
  if (view.page.warns.length) warnings.push(`console warnings: ${[...new Set(view.page.warns)].slice(0, 3).join(" || ")}`);
  info.controls = r.controls.total; info.frame = r.frame; info.canvases = r.canvases.length;
  return { issues, warnings, info };
}

const results = []; const sims = {};
const st = (issues, warnings) => (issues.length ? "fail" : warnings.length ? "warn" : "pass");

async function auditView(simId, mode, sizeKey) {
  const rec = { sim: simId, mode, size: sizeKey, status: "fail", issues: [], warnings: [], info: {} };
  let view;
  try {
    view = await openView(simId, mode, sizeKey);
    if (mode === "fullscreen" || mode === "fullscreen-css") {
      const before = await view.page.evaluate(INSPECT, { scopeSel: view.scopeSel, mode: "embedded" }).catch(() => null);
      if (before && !before.error) rec.info.embeddedCanvases = before.canvases;
      const ok = await enterFullscreen(view);
      if (!ok) { rec.issues.push(`could not enter fullscreen (${mode === "fullscreen" ? "no Fullscreen control or the API call failed" : "no control / CSS fallback missing"})`); }
      else {
        await sleep(900);
        const r = await view.page.evaluate(INSPECT, { scopeSel: view.scopeSel, mode });
        const e = evaluateView(r, mode, sizeKey, view); rec.issues.push(...e.issues); rec.warnings.push(...e.warnings); Object.assign(rec.info, e.info);
        rec.info.fullscreenKind = r.isFullscreen ? "native" : r.cssFs ? "css" : "none";
        if (mode === "fullscreen" && !r.isFullscreen) rec.issues.push("native Fullscreen API not active after clicking the control");
        if (mode === "fullscreen-css" && !r.cssFs) rec.issues.push("CSS fullscreen fallback not active when the Fullscreen API is unavailable");
        // canvas re-measure: a canvas must follow its container when the frame goes fullscreen
        if (before && !before.error) {
          const pairs = Math.min(before.canvases.length, r.canvases.length);
          for (let i = 0; i < pairs; i += 1) {
            const a = before.canvases[i]; const b = r.canvases[i];
            const cssChanged = Math.abs(a.cssW - b.cssW) > 8 || Math.abs(a.cssH - b.cssH) > 8;
            const backChanged = a.w !== b.w || a.h !== b.h;
            if (cssChanged && !backChanged && b.w < b.cssW * 0.8) rec.warnings.push(`canvas #${i} CSS size ${a.cssW}x${a.cssH} -> ${b.cssW}x${b.cssH} but backing store stayed ${b.w}x${b.h} (stretched, blurry)`);
            if (b.w > 0 && b.cssW > 0 && b.w < b.cssW * 0.6 && !cssChanged) rec.warnings.push(`canvas #${i} backing ${b.w}px for ${b.cssW}px CSS (upscaled)`);
          }
        }
        if (SHOTS && (process.env.SHOT_ALL || sizeKey === "1366x768" || sizeKey === "390x844")) await view.page.screenshot({ path: path.join(out, "shots", `${simId}__${mode}__${sizeKey}.png`) });
        // state survival + exit
        const mark = await view.page.evaluate(() => {
          const s = document.fullscreenElement || document.querySelector('[data-elab-fullscreen="css"]');
          const ranges = Array.from(s?.querySelectorAll("input[type=range]:not([disabled])") ?? []);
          const rng = ranges[0];
          if (rng) { // move it off its default so a reset-to-default would be visible
            const mn = Number(rng.min || 0); const mx = Number(rng.max || 100); const target = String(Math.round((mn + (mx - mn) * 0.37) / Number(rng.step || 1)) * Number(rng.step || 1));
            const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set; set.call(rng, target); rng.dispatchEvent(new Event("input", { bubbles: true })); rng.dispatchEvent(new Event("change", { bubbles: true }));
          }
          const notChrome = (e) => !e.closest('[data-testid="sim-fullscreen"], [data-testid="sim-new-tab"], button[aria-label*="creen" i], button[aria-label*="new tab" i], [role=radiogroup]');
          const node = rng || s?.querySelector("canvas") || Array.from(s?.querySelectorAll("svg") ?? []).find(notChrome) || Array.from(s?.querySelectorAll("button, select, input") ?? []).find(notChrome);
          if (node) { node.__auditMark = true; window.__auditNode = node; }
          return { hasSlider: !!rng, value: rng ? rng.value : null, nRanges: ranges.length };
        });
        await sleep(200);
        const valBefore = await view.page.evaluate(() => { const s = document.fullscreenElement || document.querySelector('[data-elab-fullscreen="css"]'); const r = s?.querySelector("input[type=range]:not([disabled])"); return r ? r.value : null; });
        const exited = await exitFullscreenByButton(view);
        if (!exited) rec.issues.push("exiting fullscreen with the shell control did not leave fullscreen");
        await sleep(500);
        const after = await view.page.evaluate(() => { const r = document.querySelector("main input[type=range]:not([disabled]), div.mt-6 input[type=range]:not([disabled])"); return { same: !!window.__auditNode && window.__auditNode.isConnected && window.__auditNode.__auditMark === true, value: r ? r.value : null }; });
        if (!after.same) rec.warnings.push("a DOM subtree of the simulation was re-created by entering/exiting fullscreen (the engine renders a different tree per presentation); state is judged by the slider value below");
        else rec.info.stateSurvived = true;
        if (mark.hasSlider) { rec.info.sliderThroughFullscreen = `${mark.value} -> (fullscreen ${valBefore}) -> ${after.value}`; if (valBefore !== mark.value || after.value !== mark.value) rec.issues.push(`slider value changed across fullscreen (${mark.value} -> ${valBefore} -> ${after.value})`); }
        // Escape: CSS fallback must exit; native is browser-level (cannot be sent by headless)
        const ok2 = await enterFullscreen(view); await sleep(300);
        if (ok2) {
          await view.page.keyboard.press("Escape"); await sleep(500);
          const still = await view.page.evaluate(() => ({ native: !!document.fullscreenElement, css: !!document.querySelector('[data-elab-fullscreen="css"]') }));
          if (mode === "fullscreen-css") { if (still.css) rec.issues.push("Escape did not exit the CSS fullscreen fallback"); else rec.info.escapeExit = "css-fallback handled"; }
          else if (still.native) { rec.info.escapeExit = "native: headless does not deliver browser-level Escape; exited via API"; await view.page.evaluate(() => document.exitFullscreen()); await sleep(400); }
          else rec.info.escapeExit = "native: exited on Escape";
        }
        // listener / WebGL growth across 6 cycles
        if (CYCLE_SIZES.has(sizeKey) && (mode === "fullscreen" || CSS_SIZES.has(sizeKey))) {
          const snap = () => view.page.evaluate(() => ({ l: window.__listeners.net, gl: window.__gl.G.created, live: window.__gl.live() }));
          // warm-up cycle, then measure
          await enterFullscreen(view); await sleep(250); await exitFullscreenByButton(view); await sleep(250);
          const s0 = await snap();
          for (let i = 0; i < 6; i += 1) { const okc = await enterFullscreen(view); await sleep(250); if (!okc) break; await exitFullscreenByButton(view); await sleep(250); }
          const s1 = await snap();
          rec.info.cycles = { listenersBefore: s0.l, listenersAfter: s1.l, delta: s1.l - s0.l, glCreatedDelta: s1.gl - s0.gl, glLive: s1.live };
          if (s1.l - s0.l >= 6) rec.issues.push(`event-listener growth: +${s1.l - s0.l} after 6 fullscreen cycles`);
          else if (s1.l - s0.l > 0) rec.warnings.push(`listener ledger +${s1.l - s0.l} after 6 cycles (below the one-per-toggle leak signature)`);
          if (s1.gl - s0.gl > 0) rec.issues.push(`${s1.gl - s0.gl} WebGL context(s) created during 6 fullscreen cycles (canvas remounted: state/context churn)`);
          if (s1.live > Math.max(1, s0.live)) rec.issues.push(`live WebGL contexts grew ${s0.live} -> ${s1.live}`);
        }
      }
    } else {
      const r = await view.page.evaluate(INSPECT, { scopeSel: view.scopeSel, mode });
      const e = evaluateView(r, mode, sizeKey, view); rec.issues.push(...e.issues); rec.warnings.push(...e.warnings); Object.assign(rec.info, e.info);
      if (SHOTS && (process.env.SHOT_ALL || sizeKey === "1366x768" || sizeKey === "390x844")) await view.page.screenshot({ path: path.join(out, "shots", `${simId}__${mode}__${sizeKey}.png`) });
      // per-simulation functional interactions, once (standalone 1366x768)
      if (mode === "standalone" && sizeKey === "1366x768") sims[simId] = await interact(view);
    }
  } catch (e) {
    rec.issues.push(`audit exception: ${String(e.message).split("\n")[0].slice(0, 200)}`);
  } finally { try { await view?.ctx.close(); } catch { /* closed */ } }
  rec.status = st(rec.issues, rec.warnings); results.push(rec);
  return rec;
}

async function interact(view) {
  const { page } = view; const res = { slider: "none", tabs: "none", reset: "none", errors: [] };
  const e0 = page.errs.length;
  try {
    // slider keyboard response
    const sl = page.locator('main input[type=range]:not([disabled])').first();
    if (await sl.count()) {
      await sl.scrollIntoViewIfNeeded(); const v0 = await sl.inputValue(); await sl.focus();
      const mx = Number(await sl.getAttribute("max") || 100); await page.keyboard.press(Number(v0) >= mx ? "ArrowLeft" : "ArrowRight"); await sleep(150);
      const v1 = await sl.inputValue(); res.slider = v1 !== v0 ? `responds (${v0} -> ${v1})` : `no change on keyboard (${v0})`;
    }
    // tabs
    const tabs = page.locator('main [role=tab]'); const nt = await tabs.count();
    if (nt) {
      let clicked = 0;
      for (let i = 0; i < Math.min(nt, 8); i += 1) { const t = tabs.nth(i); if (await t.isVisible() && await t.isEnabled()) { try { await t.click({ timeout: 2000 }); clicked += 1; await sleep(250); } catch { res.errors.push(`tab ${i} not clickable`); } } }
      res.tabs = `${clicked}/${Math.min(nt, 8)} tabs clicked`;
      await tabs.first().click({ timeout: 2000 }).catch(() => {});
    }
    // reset
    const rb = page.locator('main button').filter({ hasText: /^\s*(reset|replay|start over|new challenge)\b/i }).or(page.locator('main [data-testid="reset"], main [data-testid="btn-reset"], main button[aria-label^="Reset" i]')).first();
    if (await rb.count()) {
      try { await rb.click({ timeout: 3000 }); res.reset = "clicked without error"; }
      catch { await rb.evaluate((el) => el.click()); res.reset = "clicked without error (DOM click: Playwright's actionability wait timed out while software GL kept the main thread busy)"; }
      await sleep(400);
    }
    else res.reset = "no Reset control present";
  } catch (e) { res.errors.push(String(e.message).split("\n")[0].slice(0, 150)); }
  const newErrs = page.errs.slice(e0); if (newErrs.length) res.errors.push(...newErrs.slice(0, 3));
  return res;
}

// ---------------------------------------------------------------- run
const jobs = [];
for (const id of ids) for (const mode of modes) for (const sk of sizeKeys) {
  if (mode === "fullscreen-css" && !CSS_SIZES.has(sk)) continue;
  jobs.push([id, mode, sk]);
}
console.log(`Auditing ${ids.length} simulation(s), ${jobs.length} page views, concurrency ${CONC}, base ${base}`);
let next = 0; let done = 0;
async function worker() {
  while (next < jobs.length) {
    const j = jobs[next++]; const rec = await auditView(...j); done += 1;
    if (done % 20 === 0 || rec.status === "fail") console.log(`[${done}/${jobs.length}] ${rec.status.toUpperCase().padEnd(4)} ${j.join(" ")}${rec.issues.length ? "  -> " + rec.issues[0].slice(0, 110) : ""}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
await browser.close(); try { server?.kill(); } catch { /* gone */ }

// ---------------------------------------------------------------- summary
results.sort((a, b) => a.sim.localeCompare(b.sim) || a.mode.localeCompare(b.mode) || a.size.localeCompare(b.size));
const rank = { pass: 0, warn: 1, fail: 2 };
const worst = (rows) => rows.reduce((w, r) => (rank[r.status] > rank[w] ? r.status : w), "pass");
const lines = [];
lines.push(`# Simulation audit summary (${new Date().toISOString()})`, "", `Simulations: ${ids.length}; page views opened: ${results.length}; base: ${base}`, "");
lines.push("| Simulation | " + modes.join(" | ") + " | open-in-tab | fullscreen | notes |", "|---|" + modes.map(() => "---").join("|") + "|---|---|---|");
const jsonSims = [];
for (const id of ids) {
  const rows = results.filter((r) => r.sim === id);
  const cells = modes.map((m) => { const rr = rows.filter((r) => r.mode === m); if (!rr.length) return "-"; const bad = rr.filter((r) => r.status === "fail").length; const w = worst(rr); return `${w.toUpperCase()} (${rr.length - bad}/${rr.length})`; });
  const a = rows.find((r) => r.mode === "standalone" && r.size === "1366x768");
  const nt = a?.info.actions ? a.info.actions.newTab : "?"; const fs = a?.info.actions ? a.info.actions.fullscreen : "?";
  const notes = [...new Set(rows.flatMap((r) => r.issues).map((s) => s.replace(/\d+/g, "N").slice(0, 70)))].slice(0, 2).join("; ");
  lines.push(`| ${id} | ${cells.join(" | ")} | ${nt} | ${fs} | ${notes} |`);
  jsonSims.push({ id, label: SIMULATION_REGISTRY[id].label, interaction: sims[id] ?? null, byMode: Object.fromEntries(modes.map((m) => [m, worst(rows.filter((r) => r.mode === m) .concat(rows.length ? [] : []))])) });
}
const totals = { views: results.length, pass: results.filter((r) => r.status === "pass").length, warn: results.filter((r) => r.status === "warn").length, fail: results.filter((r) => r.status === "fail").length };
lines.push("", `Totals: ${totals.pass} pass, ${totals.warn} warn, ${totals.fail} fail of ${totals.views} views.`, "", "## Per-simulation interactions (standalone 1366x768)", "");
for (const s of jsonSims) if (s.interaction) lines.push(`- ${s.id}: slider ${s.interaction.slider}; tabs ${s.interaction.tabs}; reset ${s.interaction.reset}${s.interaction.errors.length ? "; ERRORS " + s.interaction.errors.join(" | ") : ""}`);
lines.push("", "## Failures", "");
for (const r of results.filter((x) => x.status === "fail")) lines.push(`- ${r.sim} / ${r.mode} / ${r.size}: ${r.issues.join(" ;; ")}`);
fs.writeFileSync(path.join(out, "audit-results.json"), JSON.stringify({ generated: new Date().toISOString(), base, sizes: ALL_SIZES, modes, totals, simulations: jsonSims, views: results }, null, 1));
fs.writeFileSync(path.join(out, "audit-summary.md"), lines.join("\n"));
console.log("\n" + lines.slice(0, 5 + ids.length + 4).join("\n"));
console.log(`\nWrote ${path.join(out, "audit-results.json")} and audit-summary.md`);
process.exitCode = totals.fail ? 1 : 0;
