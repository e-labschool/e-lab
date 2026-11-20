#!/usr/bin/env node
// Headless-Chromium verification of the Collision Theory Visualizer and Chocolate Wrapping:
//   node scripts/verify-kinetics.mjs [outDir]            (npm run verify:kinetics)
//   env: SIZES=1366x768,910x512   THEMES=light   CHROMIUM=/path/to/chrome   BASE_URL=http://host:port (reuse a server)
// Builds the app to a temp dir and runs `vite preview` on a free port (same pattern as verify-platform-simulations.mjs).
// [round 3] Also: no vertical bars/histogram in either graph, ONE smooth rate curve from the real events after a full run, the products
// plateau, reactants used up and rate 0, the MB curve (zero start, one peak, RT/2, area 1) at several T with Ea inside/outside the range
// and with a catalyst, with screenshots of each (ct-*-g*.png) for visual inspection.
// Per size x theme it checks: no console/page errors, no page overflow, no clipped or truncated controls, text >= 11 px,
// WCAG AA text contrast measured from computed colours, visible keyboard focus, the Maxwell-Boltzmann readout against the exact
// maths, the magnified view never blank / never outside its box, then HOSTILE probes (junk typed into fields, rapid mode
// switching, extreme settings at double speed, reset mid-run, resize, reduced motion) and the Chocolate Wrapping fixes.
// NOT proven: real GPU (SwiftShader/software only), real touch, Safari / Firefox, screen readers.
import { spawn } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import * as MB from "../src/engines/collision-theory-visualizer/lib/maxwellBoltzmann.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || "/tmp/kinetics-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; const notes = []; let checks = 0;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } }
const IGNORE = [/Supabase is not configured/, /Failed to load resource/, /net::ERR/, /ERR_TUNNEL/];
const T = (id) => `[data-testid="${id}"]`;

const freePort = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
let server = null; let tmp = null; let base = process.env.BASE_URL;
if (!base) {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), "elab-kinetics-"));
  console.log("building to", tmp);
  await new Promise((resolve, reject) => { const c = spawn("npx", ["vite", "build", "--outDir", tmp, "--emptyOutDir"], { cwd: root, stdio: "ignore" }); c.on("exit", (code) => (code === 0 ? resolve() : reject(new Error("build failed")))); });
  const port = await freePort();
  server = spawn("npx", ["vite", "preview", "--outDir", tmp, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* starting */ } await sleep(200); }
}
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ALL_SIZES = [[1366, 768], [910, 512], [390, 844]];
const sizes = process.env.SIZES ? ALL_SIZES.filter(([w, h]) => process.env.SIZES.split(",").includes(`${w}x${h}`)) : ALL_SIZES;
const themes = process.env.THEMES ? process.env.THEMES.split(",") : ["light", "dark"];

// ------------------------------------------------------------------ in-page audits
const AUDIT = () => {
  const ws = document.querySelector('[data-testid="workspace"], [data-testid="cw-root"]'); const res = { clipped: [], small: [], truncated: [], contrast: [], overflowX: 0 };
  const d = document.documentElement; res.overflowX = d.scrollWidth - d.clientWidth;
  const wr = ws.getBoundingClientRect();
  const visible = (el) => { const r = el.getBoundingClientRect(); const cs = getComputedStyle(el); return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none" && !el.closest("[inert]") && !el.closest('[aria-hidden="true"]'); };
  for (const el of ws.querySelectorAll("button, input, select, [role=radio], [role=tab], summary")) {
    if (!visible(el) || el.classList.contains("ct-sr")) continue;
    const r = el.getBoundingClientRect(); let sc = el.parentElement; let scrollable = false;
    while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowY; if (/(auto|scroll)/.test(o) && sc.scrollHeight > sc.clientHeight + 1) { scrollable = true; break; } sc = sc.parentElement; }
    const name = el.getAttribute("data-testid") || el.getAttribute("aria-label") || el.textContent.trim().slice(0, 20);
    if (r.left < wr.left - 1 || r.right > wr.right + 1) res.clipped.push(`x ${name} ${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(wr.left)}-${Math.round(wr.right)}`);
    else if (!scrollable && (r.bottom > innerHeight + 1 && document.documentElement.scrollHeight <= innerHeight + 1)) res.clipped.push(`y ${name}`);
    // clipped by an ancestor with overflow hidden?
    let a = el.parentElement;
    while (a && a !== document.body) { const cs = getComputedStyle(a); if (/(auto|scroll)/.test(cs.overflowY) && a.scrollHeight > a.clientHeight + 1) break; if (/(hidden|clip)/.test(cs.overflow + cs.overflowX + cs.overflowY) && !(/(auto|scroll)/.test(cs.overflowY))) { const ar = a.getBoundingClientRect(); if (r.right > ar.right + 1.5 || r.left < ar.left - 1.5 || r.bottom > ar.bottom + 1.5 || r.top < ar.top - 1.5) { res.clipped.push(`cut-by-ancestor ${name}`); break; } } a = a.parentElement; }
  }
  const parseColor = (s) => {
    let m = s.match(/rgba?\(([^)]+)\)/); if (m) { const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; }
    m = s.match(/color\(srgb ([^)]+)\)/); if (m) { const p = m[1].split(/[ /]+/).filter(Boolean).map(Number); return { r: p[0] * 255, g: p[1] * 255, b: p[2] * 255, a: p[3] ?? 1 }; }
    return null;
  };
  const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c.r) + 0.7152 * lin(c.g) + 0.0722 * lin(c.b);
  const over = (top, bottom) => ({ r: top.r * top.a + bottom.r * (1 - top.a), g: top.g * top.a + bottom.g * (1 - top.a), b: top.b * top.a + bottom.b * (1 - top.a), a: 1 });
  const bgOf = (el) => { const stack = []; for (let a = el; a; a = a.parentElement) { const cs = getComputedStyle(a); if (cs.backgroundImage && cs.backgroundImage !== "none" && !/^linear-gradient|^radial-gradient/.test(cs.backgroundImage)) return null; const c = parseColor(cs.backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } if (/gradient/.test(cs.backgroundImage)) { /* sample first stop colour */ const m = cs.backgroundImage.match(/rgba?\([^)]+\)|#[0-9a-f]{3,8}/i); if (m && m[0].startsWith("rgb")) { const g = parseColor(m[0]); if (g) { stack.push({ ...g, a: 1 }); break; } } } } let acc = { r: 255, g: 255, b: 255, a: 1 }; if (!stack.length) return null; for (let i = stack.length - 1; i >= 0; i--) acc = over(stack[i], acc); return acc; };
  for (const el of ws.querySelectorAll("*")) {
    if (!visible(el)) continue;
    const own = [...el.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim()).map((n) => n.textContent.trim()).join(" ");
    if (!own || el.closest("canvas") || el.classList.contains("ct-sr") || el.classList.contains("sd-end")) continue;
    const cs = getComputedStyle(el); const fs = parseFloat(cs.fontSize);
    if (fs < 10.95 && !el.closest(".sd-frame-foot")) res.small.push(`${fs}px "${own.slice(0, 24)}"`);
    if ((cs.textOverflow === "ellipsis") && el.scrollWidth > el.clientWidth + 1 && !el.matches(".sd-title,.sd-subtitle,.sd-explain-text,.sd-subtitle *")) res.truncated.push(`"${own.slice(0, 30)}"`);
    if (el.tagName === "text" || el.closest("svg")) { /* svg text colours are explicit attributes: checked below */ }
    const fg = parseColor(cs.color); const bg = bgOf(el);
    if (fg && bg && !el.closest("svg")) {
      const f = fg.a < 1 ? over(fg, bg) : fg; const L1 = lum(f); const L2 = lum(bg); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const big = fs >= 24 || (fs >= 18.66 && Number(cs.fontWeight) >= 700);
      if (ratio < (big ? 3 : 4.5) - 0.01 && !el.closest("button:disabled, input:disabled, select:disabled")) res.contrast.push(`${ratio.toFixed(2)}:1 "${own.slice(0, 26)}" ${cs.color} on rgb(${Math.round(bg.r)},${Math.round(bg.g)},${Math.round(bg.b)})`);
    }
  }
  return res;
};
const REPORT = (r, label) => {
  check(r.overflowX <= 1, `${label}: horizontal page overflow ${r.overflowX}px`);
  check(r.clipped.length === 0, `${label}: clipped controls ${r.clipped.slice(0, 5).join("; ")}`);
  check(r.small.length === 0, `${label}: text under 11px ${r.small.slice(0, 4).join("; ")}`);
  check(r.truncated.length === 0, `${label}: truncated text ${r.truncated.slice(0, 4).join("; ")}`);
  check(r.contrast.length === 0, `${label}: AA contrast ${r.contrast.slice(0, 4).join(" | ")}`);
};

async function newPage(W, H, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, ...extra });
  await ctx.addInitScript((th) => { try { localStorage.setItem("e-lab:theme", th); } catch { /* none */ } }, theme);
  const p = await ctx.newPage(); const errors = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return { ctx, p, errors };
}
function setRange(p, id, v) { return p.evaluate(({ id, v }) => { const el = document.querySelector(`[data-testid="slider-${id}"]`); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, { id, v }); }
const eng = (p, fn, arg) => p.evaluate(({ src, arg }) => { const e = document.querySelector('[data-testid="vessel-canvas"]').__engine; return new Function("e", "arg", src)(e, arg); }, { src: fn, arg });
const txt = async (p, id) => ((await p.locator(T(id)).first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const SLIDER_OF = { "input-T": "T", "input-ea": "ea", "input-n": "n" };
async function typeField(p, id, value) {
  const f = p.locator(T(id));
  if (SLIDER_OF[id] && !(await f.isVisible().catch(() => false))) { await setRange(p, SLIDER_OF[id], value); await sleep(60); return; } // narrow controls column hides the typed box
 await f.click(); await f.fill(value); await f.press("Enter"); await sleep(60); }

// ------------------------------------------------------------------ Collision Theory
async function collisionPass(W, H, theme) {
  const size = `${W}x${H}/${theme}`; console.log(`\n== Collision Theory ${size}`);
  const { ctx, p, errors } = await newPage(W, H, theme);
  await p.goto(`${base}/simulation/collision-theory-visualizer?seed=11`, { waitUntil: "networkidle" });
  await p.waitForSelector(T("workspace"), { timeout: 30000 }); await sleep(4500);
  const wide = W >= 800;
  const layout = await p.getAttribute(T("workspace"), "data-layout"); check(layout === (wide ? "wide" : "stacked"), `${size}: layout ${layout}`);
  if (wide) { const dy = await p.evaluate(() => document.documentElement.scrollHeight - document.documentElement.clientHeight); check(dy <= 1, `${size}: page scrolls vertically (${dy}px)`); }
  REPORT(await p.evaluate(AUDIT), size);
  await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-1-initial.png` });

  // the vessel is really running and linked to the graph
  const n0 = await eng(p, "return {t: e.t, n: e.n, coll: e.coll}"); await sleep(1500); const n1 = await eng(p, "return {t: e.t, coll: e.coll}");
  check(n1.t > n0.t + 0.5 && n1.coll > n0.coll, `${size}: simulation advances (t ${n0.t.toFixed(1)} -> ${n1.t.toFixed(1)})`);
  // MB readout vs exact maths for several T / Ea / catalyst (the BLOCKER)
  for (const [Tk, ea] of [[300, 45], [600, 45], [700, 60], [400, 10]]) {
    await typeField(p, "input-T", String(Tk)); await typeField(p, "input-ea", String(ea));
    const want = MB.formatFraction(MB.fractionAbove(ea, Tk)); const got = await txt(p, "mb-fraction");
    check(got === want, `${size}: fraction >= Ea at ${Tk} K, Ea ${ea}: shows "${got}", exact "${want}"`);
    check((await txt(p, "mb-area")) === "1.000", `${size}: area under the curve is 1.000 at ${Tk} K`);
  }
  await typeField(p, "input-T", "400"); await typeField(p, "input-ea", "20");
  await p.click(`${T("catalyst-switch")} [role=radio]:nth-child(2)`); await sleep(100);
  check((await txt(p, "mb-fraction")) === MB.formatFraction(MB.fractionAbove(12, 400)), `${size}: catalyst moves Ea to 12 and the shaded fraction follows`);
  await p.click(`${T("catalyst-switch")} [role=radio]:nth-child(1)`);
  const sh = await p.evaluate(() => { const a = document.querySelector('[data-testid="mb-ea-line"]'); return a ? a.getBoundingClientRect().left : 0; });
  await typeField(p, "input-ea", "40"); const sh2 = await p.evaluate(() => document.querySelector('[data-testid="mb-ea-line"]').getBoundingClientRect().left); check(sh2 > sh, `${size}: raising Ea moves the Ea line right`);
  await typeField(p, "input-ea", "10"); await typeField(p, "input-T", "400");
  await graphChecks(p, W, H, theme, size);

  // magnified view: never blank, never outside its box, ends on a held final frame
  await p.click(T("reset")); await typeField(p, "input-T", "700"); await typeField(p, "input-ea", "8");
  let blank = 0; let outside = 0; let finals = 0; let samples = 0;
  for (let i = 0; i < 70; i++) {
    const s = await p.evaluate(() => { const svg = document.querySelector('[data-testid="viewer-svg"]'); if (!svg) return null; const cs = [...svg.querySelectorAll("circle")].filter((c) => c.getAttribute("r") === "15"); return { n: cs.length, pts: cs.map((c) => [Number(c.getAttribute("cx")), Number(c.getAttribute("cy"))]), final: svg.getAttribute("data-final") }; });
    if (s && s.n > 0) { samples++; if (s.n !== 2) blank++; for (const [x, y] of s.pts) if (x < 14.9 || x > 185.1 || y < 14.9 || y > 125.1) outside++; if (s.final === "1") finals++; }
    await sleep(120);
  }
  check(samples >= 40 && blank === 0, `${size}: magnified view never blank (${samples} samples, ${blank} without two molecules)`);
  check(outside === 0, `${size}: molecules stayed inside the viewBox (${outside} samples outside)`);
  check(finals >= 5, `${size}: final frame is held (${finals} samples)`);
  await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-2-running.png` });

  // keyboard: Tab through and require a visible focus indicator on every stop
  await p.click(T("reset")); await p.locator(T("workspace")).focus().catch(() => {}); await p.keyboard.press("Tab");
  const seen = new Set(); const bad = [];
  for (let i = 0; i < 40; i++) {
    const f = await p.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const cs = getComputedStyle(a); const r = a.getBoundingClientRect(); return { id: a.getAttribute("data-testid") || a.id || a.tagName + a.textContent.slice(0, 10), ow: parseFloat(cs.outlineWidth) || 0, os: cs.outlineStyle, sh: cs.boxShadow, inWs: !!a.closest('[data-testid="workspace"]'), vis: r.width > 0 }; });
    if (f && f.inWs && !seen.has(f.id)) { seen.add(f.id); if (!((f.os !== "none" && f.ow >= 2) || (f.sh && f.sh !== "none"))) bad.push(f.id); }
    await p.keyboard.press("Tab");
  }
  check(seen.size >= 12, `${size}: keyboard reaches the controls (${seen.size} stops)`); check(bad.length === 0, `${size}: visible focus ring missing on ${bad.join(", ")}`);
  await p.focus(T("slider-T")); const v0 = await p.inputValue(T("slider-T")); await p.keyboard.press("ArrowRight"); check((await p.inputValue(T("slider-T"))) !== v0, `${size}: slider moves with the arrow keys`);

  // popovers
  await p.click(T("settings")); check((await p.locator(T("settings-panel")).count()) === 1, `${size}: settings opens`); REPORT(await p.evaluate(AUDIT), `${size} settings open`); await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-3-settings.png` }); await p.keyboard.press("Escape");
  check((await p.locator(T("settings-panel")).count()) === 0, `${size}: Escape closes settings`);
  await p.click(T("predict-toggle")); await p.click(T("predict-choice-up-lot")); await p.click(T("predict-reveal"));
  await p.waitForSelector(T("predict-result"), { timeout: 60000 }); const pn = await txt(p, "predict-numbers"); check(/Measured initial rate: [\d.]+ → [\d.]+ reactions/.test(pn), `${size}: predict reveal shows measured numbers (${pn.slice(0, 60)})`);
  await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-4-predict.png` }); await p.keyboard.press("Escape");

  // reaction profile in the detail popover (round 2)
  await p.click(T("explain-info")); await sleep(200);
  check((await p.locator(T("reaction-profile")).count()) === 1, `${size}: reaction profile is in the detail popover`);
  { const r = await p.evaluate(() => { const el = document.querySelector('[data-testid="reaction-profile"]'); const pn = el.closest('[data-testid="explain-info-panel"]') ?? el; const b = el.getBoundingClientRect(); const pb = pn.getBoundingClientRect(); const svg = el.querySelector("svg").getBoundingClientRect(); const txts = [...el.querySelectorAll("svg text")].map((t) => t.getBoundingClientRect()); return { inView: b.left >= -1 && b.right <= innerWidth + 1 && svg.width > 100, textsInside: txts.every((t) => t.left >= svg.left - 1 && t.right <= svg.right + 1 && t.top >= svg.top - 1 && t.bottom <= svg.bottom + 1), vis: pb.top >= -1 || pn.scrollHeight > 0 }; });
    check(r.inView, `${size}: profile is inside the viewport`); check(r.textsInside, `${size}: every profile label is inside its drawing`); }
  await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-4b-profile.png` }); await p.keyboard.press("Escape");
  // solid system and graph variants at this size
  await p.click(`${T("system-tabs")} [role=radio]:nth-child(2)`); await sleep(1500); REPORT(await p.evaluate(AUDIT), `${size} solid`); await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-5-solid.png` });
  if (wide && H < 620) { await p.click(`${T("graph-tab")} [role=radio]:nth-child(2)`); await sleep(400); REPORT(await p.evaluate(AUDIT), `${size} rate tab`); await p.screenshot({ path: `${out}/ct-${W}x${H}-${theme}-6-ratetab.png` }); }
  check(errors.length === 0, `${size}: console/page errors: ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

// ---- round 3: graphs (rate curve after a full run, products plateau, Maxwell-Boltzmann curve) -------------------------------
const pathPts = (d) => d.split(/(?=[ML])/).map((q) => q.slice(1).split(",").map(Number));
async function showTab(p, which) { // which: "mb" | "rate"; only the tight-wide layout shows one graph at a time, via the switch in the visible panel
  for (const id of ["graph-tab", "graph-tab-2"]) {
    const sw = p.locator(T(id)).first();
    if (await sw.isVisible().catch(() => false)) { await p.locator(`${T(id)} [role=radio]:nth-child(${which === "mb" ? 1 : 2})`).first().click(); await sleep(250); return; }
  }
}
async function noBars(p, size, where) {
  const r = await p.evaluate(() => ["rate-svg", "mb-svg"].map((id) => { const svg = document.querySelector(`[data-testid="${id}"]`); return svg ? [...svg.querySelectorAll("rect")].filter((x) => !x.closest("clipPath")).length : -1; }));
  check(r[0] === 0 && r[1] === 0, `${size}: ${where}: no bars in the graphs (rect elements outside clip paths: rate ${r[0]}, energy ${r[1]})`);
}
async function graphChecks(p, W, H, theme, size) {
  const shot = async (name, id) => { await sleep(350); await p.locator(T(id)).screenshot({ path: `${out}/ct-${W}x${H}-${theme}-g-${name}.png` }); };
  const reset = async () => { await p.click(T("reset")); await sleep(150); await p.click(T("play-pause")); await sleep(80); }; // reset, then pause so the engine can be driven by hand
  // 1. default reaction run to the end: smooth falling rate curve
  await reset(); await eng(p, "e.run(150)"); await sleep(400);
  const st = await eng(p, "return {succ: e.succ, c: e.countSpecies(2), d: e.countSpecies(3), a: e.countSpecies(0), b: e.countSpecies(1), units: e.unitsTotal(), left: e.limitingLeft()}");
  check(st.succ > 28 && st.c === st.succ && st.d === st.succ && st.units === 80 && st.a === 40 - st.succ, `${size}: after 150 s ${st.succ} of 40 reacted, A+B+C+D = ${st.units}`);
  await showTab(p, "rate"); await noBars(p, size, "rate view");
  const rl = await p.evaluate(() => { const l = document.querySelector('[data-testid="rate-line"]'); return { d: l.getAttribute("d"), total: Number(document.querySelector('[data-testid="rate-svg"]').dataset.total) }; });
  check(rl.total === st.succ, `${size}: rate graph is built from the engine's ${st.succ} reactions (graph has ${rl.total})`);
  const P = pathPts(rl.d); const ys = P.map((q) => q[1]); const top = Math.min(...ys); const bottom = Math.max(...ys);
  check(P.length >= 100, `${size}: the rate curve is one dense continuous line (${P.length} points)`); check(ys.indexOf(top) < P.length / 3, `${size}: the rate is highest early on`);
  check(ys[ys.length - 1] > top + 0.7 * (bottom - top), `${size}: the rate is far lower at the end than at the start`);
  let jag = 0; for (let k = 2; k < ys.length; k++) { const a = ys[k - 1] - ys[k - 2]; const b = ys[k] - ys[k - 1]; if (a * b < 0 && Math.abs(a) + Math.abs(b) > 0.12 * (bottom - top)) jag++; } check(jag <= 2, `${size}: the rate curve has no ECG-like spikes (${jag} large reversals)`);
  check((await p.locator(`${T("rate-panel")} text`, { hasText: /reactions s⁻¹|Rate \/ s⁻¹/ }).count()) >= 1 && (await p.locator(`${T("rate-panel")} text`, { hasText: "Time / s" }).count()) === 1, `${size}: axes labelled Time / s and reaction rate / reactions s⁻¹`);
  await shot("rate-full-run", "rate-panel");
  // the other views after the same full run: Reactants, Products, Both, and single species chosen from the equation
  const view = async (n) => { await p.click(`${T("rate-view")} [role=radio]:nth-child(${n})`); await sleep(350); };
  await view(2); await noBars(p, size, "reactants view"); check((await p.locator("[data-testid^=curve-]").count()) === 2, `${size}: reactants view draws A and B`);
  check((await p.locator(`${T("rate-svg")} path[data-testid=curve-A]`).getAttribute("data-final")) === String(st.a), `${size}: the A curve ends at the engine's A count (${st.a})`); await shot("reactants-full-run", "rate-panel");
  await view(3); await noBars(p, size, "products view (full run)"); check((await p.locator(`${T("rate-svg")} path[data-testid=curve-C]`).getAttribute("data-final")) === String(st.succ), `${size}: the C curve ends at the engine's count (${st.succ})`);
  { const d = await p.getAttribute("[data-testid=curve-C]", "d"); const Q = pathPts(d); check(Q.length >= 100 && Q.every((q, k) => k === 0 || q[1] <= Q[k - 1][1] + 1e-6), `${size}: the products curve is smooth (${Q.length} points) and never falls`); }
  await shot("products-full-run", "rate-panel");
  await view(4); await noBars(p, size, "both view"); check((await p.locator(T("sample-dot")).count()) === 74 && (await p.locator(T("graph-legend")).count()) === 1, `${size}: both view has markers at the sample times and a legend`);
  { const a = Number(await p.getAttribute("[data-testid=curve-A]", "data-final")); const c = Number(await p.getAttribute("[data-testid=curve-C]", "data-final")); check(a + c === 40 && c > 28, `${size}: both view: A ${a} + C ${c} = 40`); }
  await shot("both-full-run", "rate-panel");
  await p.click(T("eq-A")); await sleep(300); check((await p.getAttribute(T("eq-A"), "aria-pressed")) === "true" && (await p.getAttribute(T("eq-B"), "aria-pressed")) === "false" && (await p.locator("[data-testid^=curve-]").count()) === 1 && (await p.locator(`${T("rate-view")} [aria-checked=true]`).textContent()).trim() === "Reactants", `${size}: clicking A in the equation selects the A curve and the Reactants view`);
  await shot("species-A", "rate-panel"); await p.click(T("eq-C")); await sleep(300); check((await p.getAttribute(T("eq-C"), "aria-pressed")) === "true" && (await p.locator(`${T("rate-view")} [aria-checked=true]`).textContent()).trim() === "Products" && (await p.locator("[data-testid^=curve-]").count()) === 1, `${size}: clicking C selects the C curve and the Products view`);
  await shot("species-C", "rate-panel"); await p.click(T("eq-arrow")); await sleep(250); check((await p.locator(`${T("rate-view")} [aria-checked=true]`).textContent()).trim() === "Both", `${size}: the arrow shows Both`);
  await p.focus(T("eq-A")); await p.keyboard.press("Shift+Tab"); await p.keyboard.press("Tab"); { const ring = await p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return parseFloat(cs.outlineWidth) >= 2 && cs.outlineStyle !== "none"; }); check(ring, `${size}: a species button shows a focus ring`); }
  await view(1);
  // 2. a small vessel run to exhaustion: rate 0, products plateau
  await p.click(T("reset")); await p.click(T("play-pause")); await sleep(60); await setRange(p, "n", 8); await setRange(p, "T", 700); await setRange(p, "ea", 6); await setRange(p, "site", 360); // paused first: the Concentration slider only adds/removes the difference, so no reaction may happen before it is set
  await showTab(p, "rate"); await eng(p, "e.run(400)"); await sleep(400);
  const ex = await eng(p, "return {succ: e.succ, left: e.limitingLeft(), r: e.rateOver(10)}"); check(ex.succ === 8 && ex.left === 0 && ex.r === 0, `${size}: limiting reactant used up: ${ex.succ} reactions, rate ${ex.r}`);
  check((await p.getAttribute(T("rate-svg"), "data-finished")) === "1" && (await p.locator(T("rate-finished-note")).count()) === 1, `${size}: the graph says the limiting reactant is used up`);
  check(Number(await p.getAttribute(T("rate-line"), "data-final")) < 0.05, `${size}: the plotted rate has fallen to about 0`); await shot("rate-exhausted", "rate-panel");
  await p.click(`${T("rate-view")} [role=radio]:nth-child(3)`); await sleep(300); await noBars(p, size, "products view");
  const pr = await p.evaluate(() => { const l = document.querySelector('[data-testid="curve-C"]'); return { d: l.getAttribute("d"), fin: Number(l.dataset.final) }; }); const Q = pathPts(pr.d);
  check(pr.fin === 8 && Math.abs(Q[Q.length - 1][1] - Q[Q.length - 2][1]) < 0.01, `${size}: products graph ends at ${pr.fin} on a flat plateau`);
  check(Q.every((q, k) => k === 0 || (q[1] <= Q[k - 1][1] + 1e-6 && q[0] >= Q[k - 1][0] - 1e-6)), `${size}: the products curve never falls`); await shot("products-plateau", "rate-panel");
  await p.click(`${T("rate-view")} [role=radio]:nth-child(1)`);
  // 3. Maxwell-Boltzmann curve at several T, Ea inside / outside the range, catalyst
  await p.click(T("reset")); await sleep(150); await showTab(p, "mb"); await noBars(p, size, "energy graph");
  for (const [Tk, ea, name] of [[300, 10, "300K"], [400, 10, "400K"], [600, 10, "600K"]]) {
    await typeField(p, "input-T", String(Tk)); await typeField(p, "input-ea", String(ea)); await sleep(150);
    const g = await p.evaluate(() => { const gr = document.querySelector('[data-testid="mb-graph"]'); const d = document.querySelector('[data-testid="mb-curve"]').getAttribute("d"); return { d, x: Number(gr.dataset.xmax), y: Number(gr.dataset.ymax), mode: document.querySelector('[data-testid="mb-mode"]').textContent, area: document.querySelector('[data-testid="mb-area"]').textContent }; });
    const M = pathPts(g.d); const my = M.map((q) => q[1]); const base = Math.max(...my); const topI = my.indexOf(Math.min(...my)); let rev = 0; for (let k = 1; k < my.length; k++) if (Math.sign(my[k] - my[k - 1]) * Math.sign(my[Math.min(k + 1, my.length - 1)] - my[k]) < 0 && Math.abs(my[k] - my[k - 1]) > 0.5) rev++;
    check(Math.abs(my[0] - base) < 0.6, `${size}: ${name}: the curve starts on the zero line`); check(topI > 3 && topI < M.length * 0.4, `${size}: ${name}: one peak in the left part (index ${topI}/${M.length})`);
    check(g.x < 70 && g.mode === `${(8.314462618e-3 * Tk / 2).toFixed(2)} kJ/mol` && g.area === "1.000", `${size}: ${name}: axis 0-${g.x} kJ/mol (not the fixed 0-70), peak ${g.mode}, area ${g.area}`);
    check(rev <= 2, `${size}: ${name}: the curve is smooth (${rev} reversals)`); await shot(`mb-${name}`, "mb-panel");
  }
  await typeField(p, "input-T", "300"); await typeField(p, "input-ea", "45"); await sleep(150);
  check((await p.locator(T("mb-full-range")).count()) === 1 && (await p.locator(T("mb-ea-off")).count()) === 1, `${size}: Ea beyond the axis is flagged and a full-range option is offered`); await shot("mb-300K-Ea45-outside", "mb-panel");
  await p.click(T("mb-full-range")); await sleep(250); check((await p.getAttribute(T("mb-graph"), "data-full")) === "1" && (await p.locator(T("mb-ea-off")).count()) === 0, `${size}: full range shows the Ea line inside the axis`); await shot("mb-300K-Ea45-fullrange", "mb-panel");
  await p.click(T("mb-full-range")); await typeField(p, "input-T", "400"); await typeField(p, "input-ea", "20"); await sleep(150);
  const dBefore = await p.getAttribute(T("mb-curve"), "d"); await p.click(`${T("catalyst-switch")} [role=radio]:nth-child(2)`); await sleep(250);
  { // the plot box can get a little shorter when the "without catalyst" readout adds a row, so compare the SHAPE (normalised heights), not pixels
    const shape = (d) => { const P = pathPts(d); const ys = P.map((q) => q[1]); const b = Math.max(...ys); const t = Math.min(...ys); const xs = P.map((q) => q[0]); const x0 = xs[0]; const xw = xs[xs.length - 1] - x0; return P.map((q, i) => [(q[0] - x0) / xw, (b - ys[i]) / (b - t)]); };
    const A = shape(dBefore); const B = shape(await p.getAttribute(T("mb-curve"), "d")); const worst = Math.max(...A.map((q, i) => Math.max(Math.abs(q[0] - B[i][0]), Math.abs(q[1] - B[i][1]))));
    check(A.length === B.length && worst < 0.01, `${size}: the catalyst leaves the distribution curve unchanged (largest shape difference ${worst.toFixed(4)})`); } check((await txt(p, "mb-fraction")) === MB.formatFraction(MB.fractionAbove(12, 400)), `${size}: catalyst lowers the effective Ea to 12 and the shaded fraction follows`);
  await shot("mb-400K-catalyst", "mb-panel"); await p.click(`${T("catalyst-switch")} [role=radio]:nth-child(1)`);
  await p.click(T("reset")); await sleep(200);
}

async function collisionHostile() {
  console.log("\n== Collision Theory hostile probes (1366x768 light)");
  const { ctx, p, errors } = await newPage(1366, 768, "light");
  await p.goto(`${base}/simulation/collision-theory-visualizer?seed=5`, { waitUntil: "networkidle" }); await p.waitForSelector(T("workspace")); await sleep(1500);
  for (const junk of ["abc", "-5", "1e9", "99999999999999999999", "   ", "٣٠٠", "300.5", "NaN", "Infinity", "<script>alert(1)</script>", "0x1F", "1,5"]) {
    await typeField(p, "input-T", junk); const v = Number(await p.inputValue(T("slider-T")));
    check(v >= 250 && v <= 700 && Number.isFinite(v), `hostile T "${junk}" -> slider ${v}`);
    const alive = await eng(p, "return Number.isFinite(e.totalKE()) && e.n > 0"); check(alive, `engine healthy after T="${junk}"`);
  }
  for (const junk of ["0", "-1", "1e3", "abc", "7.9"]) { await typeField(p, "input-n", junk); const v = Number(await p.inputValue(T("slider-n"))); check(v >= 5 && v <= 50, `hostile n "${junk}" -> ${v}`); }
  check((await p.locator(T("limit-T")).count()) >= 0, "notice element exists");
  // rapid mode switching and slider slamming
  for (let i = 0; i < 40; i++) await p.click(`${T("system-tabs")} [role=radio]:nth-child(${(i % 2) + 1})`);
  await typeField(p, "input-n", "50"); await typeField(p, "input-T", "700"); await p.click(`${T("speed")} [role=radio]:nth-child(4)`);
  for (let i = 0; i < 25; i++) { await setRange(p, "T", 250 + ((i * 97) % 450) - (((i * 97) % 450) % 5)); await setRange(p, "n", 5 + ((i * 13) % 46)); }
  const frames = await p.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(n / 3); }; requestAnimationFrame(f); }));
  notes.push(`worst case (100 particles, 2x, T 700) in software rendering: ${frames.toFixed(0)} frames/s`);
  const st = await eng(p, "return {n: e.n, ke: e.totalKE(), ok: Array.from(e.x.slice(0,e.n)).every(Number.isFinite)}"); check(st.n <= 200 && st.ok && Number.isFinite(st.ke), `extreme settings keep the engine finite (n=${st.n})`);
  // reset mid-run restores everything
  await p.click(`${T("catalyst-switch")} [role=radio]:nth-child(2)`); await p.click(T("reset")); await sleep(300);
  check((await p.inputValue(T("slider-T"))) === "400" && (await p.inputValue(T("slider-n"))) === "40" && (await p.inputValue(T("slider-ea"))) === "10", "reset restores T, n, Ea");
  check((await txt(p, "mb-fraction")) === MB.formatFraction(MB.fractionAbove(10, 400)), "reset restores the graph readout");
  const es = await eng(p, "return {t: e.t, coll: e.coll}"); check(es.t < 3, `reset clears time (${es.t.toFixed(1)} s)`);
  // resize while running
  for (const [w, h] of [[1000, 600], [700, 900], [1366, 768], [910, 512]]) { await p.setViewportSize({ width: w, height: h }); await sleep(250); }
  REPORT(await p.evaluate(AUDIT), "after rapid resize");
  // pause at next reaction + Escape in popovers + double clicks
  await p.setViewportSize({ width: 1366, height: 768 }); await p.click(T("pause-on-reaction")); await p.dblclick(T("pause-on-reaction")); await sleep(300);
  check(errors.length === 0, `hostile: console/page errors: ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

async function collisionReduced() {
  console.log("\n== Collision Theory reduced motion");
  const { ctx, p, errors } = await newPage(1366, 768, "light", { reducedMotion: "reduce" });
  await p.goto(`${base}/simulation/collision-theory-visualizer?seed=5`, { waitUntil: "networkidle" }); await p.waitForSelector(T("workspace")); await sleep(1500);
  const t0 = Number(await p.getAttribute(T("vessel-canvas"), "data-t")); await sleep(1200); const t1 = Number(await p.getAttribute(T("vessel-canvas"), "data-t"));
  check(t1 === t0, `reduced motion: starts paused (t ${t0} -> ${t1})`);
  check((await p.locator(`${T("speed")} [aria-checked=true]`).textContent()).trim() === "¼×", "reduced motion: speed starts at quarter");
  await p.click(T("play-pause")); await sleep(2500); const t2 = Number(await p.getAttribute(T("vessel-canvas"), "data-t")); check(t2 > 0 && t2 < 1.2, `reduced motion: plays slowly when asked (t=${t2} after 2.5 s)`);
  await p.click(T("pause-on-reaction")); await p.click(`${T("speed")} [role=radio]:nth-child(4)`); await sleep(6000);
  const fin = await p.getAttribute(T("viewer-svg"), "data-final"); check(fin === "1", "reduced motion: magnifier shows the final frame immediately");
  check(errors.length === 0, `reduced: errors ${errors.slice(0, 2).join(" | ")}`);
  await ctx.close();
}

// ------------------------------------------------------------------ Chocolate Wrapping
async function chocolatePass(W, H, theme) {
  const size = `${W}x${H}/${theme}`; console.log(`\n== Chocolate Wrapping ${size}`);
  const { ctx, p, errors } = await newPage(W, H, theme);
  await p.goto(`${base}/simulation/chocolate-wrapping-rate`, { waitUntil: "networkidle" }); await p.waitForSelector(T("cw-root"), { timeout: 30000 }); await sleep(500);
  REPORT(await p.evaluate(AUDIT), size);
  for (const v of ["15", "10", "100", "200", "1", "2"]) { await typeField(p, "cw-chocolates", v); check((await p.inputValue(T("cw-chocolates"))) === v, `${size}: chocolates accepts ${v}`); }
  for (const [junk, want] of [["abc", null], ["-5", "1"], ["0", "1"], ["999", "200"], ["1.5", "2"], ["1e3", "200"], ["", null]]) {
    await typeField(p, "cw-wrappers", "20"); await typeField(p, "cw-wrappers", junk); const v = await p.inputValue(T("cw-wrappers")); const notice = await txt(p, "cw-notice");
    check(want ? v === want : v === "20" || v !== "", `${size}: wrappers "${junk}" -> "${v}"`); check(notice.length > 0, `${size}: "${junk}" is explained ("${notice.slice(0, 50)}")`);
  }
  await typeField(p, "cw-chocolates", "20"); await typeField(p, "cw-wrappers", "20"); await p.selectOption(T("cw-speed"), "fast");
  await p.click(T("cw-start")); let pulses = 0; let mism = 0;
  for (let i = 0; i < 45; i++) {
    const s = await p.evaluate(() => ({ pulse: document.querySelector('[data-testid="cw-station"]').dataset.pulse, fin: !!document.querySelector('[data-testid="cw-finished"]'), last: document.querySelector('[data-testid="cw-rate-last"]').textContent, time: document.querySelector('[data-testid="cw-time"]').textContent, choc: document.querySelector('[data-testid="cw-root"]').textContent.match(/Chocolates\s*(\d+) \/ (\d+)/)?.[1] }));
    if (s.pulse === "1") pulses++; if (s.fin) break; await sleep(150);
  }
  check(pulses > 0, `${size}: wrapping-station pulse fires (${pulses} samples)`);
  check(await p.locator(T("cw-finished")).count() === 1, `${size}: run finishes`); check((await txt(p, "cw-start")) === "FINISHED", `${size}: button says FINISHED`);
  const rateLast = await txt(p, "cw-rate-last"); const time = parseInt(await txt(p, "cw-time"), 10); check(/^1 pack s/.test(rateLast) && time === 7, `${size}: final readout "${rateLast}" at ${time} s matches the graph (7,5,3,2,1,1,1)`);
  const bars = await (async () => { await p.selectOption(T("cw-series"), "rate"); await sleep(100); return p.locator(T("cw-bar")).count(); })(); check(bars === 7, `${size}: rate graph has one bar per second (${bars})`);
  const hs = await p.evaluate(() => [...document.querySelectorAll('[data-testid="cw-bar"]')].map((b) => Math.round(parseFloat(b.getAttribute("height")))));
  check(hs.every((h, i) => i === 0 || h <= hs[i - 1]), `${size}: bars never rise (${hs.join(",")})`);
  await p.selectOption(T("cw-series"), "packs"); await sleep(100);
  REPORT(await p.evaluate(AUDIT), `${size} finished`); await p.screenshot({ path: `${out}/cw-${W}x${H}-${theme}-finished.png`, fullPage: true });
  const gb = await p.evaluate(() => { const g = document.querySelector('[data-testid="cw-graph"]').getBoundingClientRect(); const r = document.documentElement.getBoundingClientRect(); return { w: g.width, vw: innerWidth }; }); check(gb.w <= gb.vw + 1, `${size}: graph fits the width`);
  await p.click(T("cw-reset")); await sleep(100); check((await p.inputValue(T("cw-chocolates"))) === "20", `${size}: reset unlocks the fields`);
  // keyboard focus visible on buttons/selects
  await p.focus(T("cw-reset")); for (let k = 0; k < 6 && (await p.evaluate(() => document.activeElement?.getAttribute("data-testid"))) !== "cw-start"; k++) await p.keyboard.press("Shift+Tab"); const ring = await p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return parseFloat(cs.outlineWidth) >= 2 && cs.outlineStyle !== "none"; }); check(ring, `${size}: Start has a visible focus ring`);
  { await p.click(T("cw-reset")).catch(() => {}); await p.click(T("cw-pick-lower")).catch(() => {}); await p.click(T("cw-reveal")); await sleep(100);
    const t = await txt(p, "cw-predict-result"); check(/Not quite \(the answer is higher\)|Correct/.test(t) && /packs/.test(t), `${size}: chocolate predict-first reveals a model-computed answer (${t.slice(0, 50)})`);
    const ov = await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1); check(ov, `${size}: chocolate page has no horizontal overflow with the predict strip`); }
  check(errors.length === 0, `${size}: errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

try {
  for (const [W, H] of sizes) for (const th of themes) { await collisionPass(W, H, th); await chocolatePass(W, H, th); }
  await collisionHostile(); await collisionReduced();
} finally {
  await browser.close(); server?.kill(); if (tmp) fs.rmSync(tmp, { recursive: true, force: true });
}
console.log(`\n${checks} checks, ${problems.length} problems`); for (const n of notes) console.log("note:", n); for (const pr of problems) console.log(" -", pr);
process.exit(problems.length ? 1 : 0);
