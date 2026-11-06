// Headless-Chromium verification for Build an Atom: identity card layout (notation block vs table) and the
// electron shell / arrangement / configuration panel under the atom.
// Usage: node scripts/verify-build-atom-shells.mjs [outDir]
//   env: SIZES=1366x768,390x844   THEMES=light,dark   CHROMIUM=/path   BASE_URL=http://host:port (skip build+preview)
// Builds the app into a temp dir, serves it with `vite preview` on a free port, opens /simulation/build-an-atom
// (the "new tab" view), the shell's real Fullscreen, and /interactives/build-an-atom when such a page exists.
// Honest limits: headless Chromium only (software rendering, synthetic mouse, no touch, no real GPU, no Firefox/Safari).
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");
const out = process.argv[2] || "/tmp/build-atom-shells-verify";
fs.mkdirSync(out, { recursive: true });
const SIZES = (process.env.SIZES ? process.env.SIZES.split(",") : ["1366x768", "1920x1080", "820x1180", "390x844", "320x640", "900x700", "1000x720"]).map((s) => s.split("x").map(Number));
const THEMES = process.env.THEMES ? process.env.THEMES.split(",") : ["light", "dark"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; const notes = []; let checks = 0;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } }
const IGNORE = [/willReadFrequently/, /Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL/, /Failed to load resource/, /net::ERR/];
const T = (id) => `[data-testid="${id}"]`;

function freePort() { return new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); }); }
let preview = null; let dist = null; let base = process.env.BASE_URL; let previewPort = 0;
function startPreview() { preview = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(previewPort), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" }); }
async function ensureServer() {
  if (!dist) return;
  try { const r = await fetch(base); if (r.ok) return; } catch { /* down */ }
  startPreview();
  for (let i = 0; i < 100; i += 1) { try { const r = await fetch(base); if (r.ok) return; } catch { /* not yet */ } await sleep(200); }
}
if (!base) {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "elab-dist-"));
  console.log(`building into ${dist} ...`);
  const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: root, stdio: "pipe", encoding: "utf8" });
  if (b.status !== 0) { console.log(b.stdout, b.stderr); process.exit(1); }
  previewPort = await freePort();
  startPreview();
  base = `http://127.0.0.1:${previewPort}`;
  for (let i = 0; i < 100; i += 1) { try { const r = await fetch(base); if (r.ok) break; } catch { /* not yet */ } await sleep(200); }
}
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(W, H, route, theme) {
  await ensureServer();
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme });
  await ctx.addInitScript((t) => { try { localStorage.setItem("e-lab:theme", t); } catch { /* ignore */ } }, theme);
  const p = await ctx.newPage(); const errors = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await p.goto(`${base}${route}`, { waitUntil: "networkidle" });
  return { ctx, p, errors };
}
async function enterFullscreen(p) {
  await p.getByRole("button", { name: /^(enter )?full ?screen$/i }).first().click();
  for (let i = 0; i < 30; i += 1) { if (await p.evaluate(() => !!document.fullscreenElement)) break; await sleep(100); }
  await sleep(600);
  return p.evaluate(() => !!document.fullscreenElement);
}
const rect = (p, sel) => p.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; }, sel);
const overlap = (a, b) => a && b && a.x < b.r - 0.5 && b.x < a.r - 0.5 && a.y < b.b - 0.5 && b.y < a.b - 0.5;
const inside = (a, box, tol = 1) => a && box && a.x >= box.x - tol && a.r <= box.r + tol && a.y >= box.y - tol && a.b <= box.b + tol;
const txt = async (p, sel) => ((await p.locator(sel).first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
// many presses: dispatch real click events from the page (each is a separate discrete React event); a single press uses a real mouse click
const click = async (p, id, times = 1) => {
  if (times === 1) { await p.locator(T(id)).scrollIntoViewIfNeeded(); await p.locator(T(id)).click(); }
  else await p.evaluate(async ([sel, n]) => { const el = document.querySelector(sel); for (let i = 0; i < n; i += 1) { el.click(); await new Promise((r) => setTimeout(r, 8)); } }, [T(id), times]);
  await sleep(80);
};
const cnt = async (p) => ({ p: Number(await txt(p, T("atom-count-proton"))), n: Number(await txt(p, T("atom-count-neutron"))), e: Number(await txt(p, T("atom-count-electron"))) });
const docOverflow = (p) => p.evaluate(() => ({ x: document.documentElement.scrollWidth - document.documentElement.clientWidth }));

// ---- hand-written expectations (independent of the code under test) ----
const ARR = { H: "1", C: "2,4", Na: "2,8,1", Mn: "2,8,13,2", Cu: "2,8,18,1", Kr: "2,8,18,8", Cr: "2,8,13,1" };
const CFG = { Mn: "1s2 2s2 2p6 3s2 3p6 3d5 4s2", Cu: "1s2 2s2 2p6 3s2 3p6 3d10 4s1", H: "1s1", C: "1s2 2s2 2p2" };
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
const ascii = (s) => s.replace(/[⁰¹²³⁴-⁹]/g, (c) => SUP[c]);
const NAMES = { H: ["Hydrogen", 1], C: ["Carbon", 6], Na: ["Sodium", 11], Mn: ["Manganese", 25], Cu: ["Copper", 29], Kr: ["Krypton", 36], Cr: ["Chromium", 24] };

// ---- identity card geometry ----
async function identityChecks(p, label) {
  const g = await p.evaluate(() => {
    const R = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
    const table = document.querySelector('[data-testid="atom-identity-table"]');
    const cells = [...table.children].map((c) => { const r = c.getBoundingClientRect(); return { x: r.x, y: r.y, r: r.right, b: r.bottom, w: r.width, h: r.height, sw: c.scrollWidth, cw: c.clientWidth }; });
    return { card: R('[data-testid="atom-identity"]'), top: R('[data-testid="atom-identity-top"]'), notation: R('[data-testid="atom-notation"]'), table: R('[data-testid="atom-identity-table"]'), A: R('[data-testid="atom-notation-A"]'), Z: R('[data-testid="atom-notation-Z"]'), sym: R('[data-testid="atom-notation-symbol"]'), charge: R('[data-testid="atom-notation-charge"]'), cells };
  });
  check(!!g.card && !!g.notation && !!g.table, `${label}: identity pieces exist`);
  if (!g.card) return;
  check(!overlap(g.notation, g.table), `${label}: notation block does not overlap the table (notation ${Math.round(g.notation.x)}-${Math.round(g.notation.r)} x ${Math.round(g.notation.y)}-${Math.round(g.notation.b)}, table ${Math.round(g.table.x)}-${Math.round(g.table.r)} x ${Math.round(g.table.y)}-${Math.round(g.table.b)})`);
  check(inside(g.notation, g.card) && inside(g.table, g.card), `${label}: notation and table inside the card (card ${Math.round(g.card.x)}-${Math.round(g.card.r)}, notation ${Math.round(g.notation.x)}-${Math.round(g.notation.r)}, table ${Math.round(g.table.x)}-${Math.round(g.table.r)})`);
  for (const k of ["A", "Z", "sym", "charge"]) if (g[k]) check(inside(g[k], g.notation), `${label}: notation ${k} label inside the notation block`);
  check(!overlap(g.A, g.sym) && !overlap(g.Z, g.sym) && (!g.charge || !overlap(g.charge, g.sym)), `${label}: A, Z and charge labels do not overlap the symbol`);
  if (g.charge) check(!overlap(g.charge, g.table), `${label}: charge label does not overlap the table`);
  check(g.cells.every((c) => c.sw <= c.cw + 1), `${label}: no table text clipped`);
  const wrapped = g.table.y >= g.notation.b - 1;
  return { cardW: Math.round(g.card.w), wrapped };
}

// ---- shell panel geometry ----
async function shellGeometry(p, label, W) {
  const panel = await rect(p, T("atom-shells")); const stage = await rect(p, T("atom-stage")); const controls = await rect(p, T("atom-build-controls"));
  const side = await rect(p, T("atom-side")); const col = await rect(p, T("atom-column"));
  check(!!panel && panel.w > 100, `${label}: shell panel present`);
  if (!panel) return;
  check(panel.y >= stage.b - 1, `${label}: shell panel is directly below the atom stage (panel top ${Math.round(panel.y)} >= stage bottom ${Math.round(stage.b)})`);
  // the controls live inside the scrolling side panel: only their VISIBLE part (clipped to the side panel) can cover anything
  const vis = controls && side ? { x: Math.max(controls.x, side.x), y: Math.max(controls.y, side.y), r: Math.min(controls.r, side.r), b: Math.min(controls.b, side.b) } : null;
  const visOk = !vis || vis.r <= vis.x || vis.b <= vis.y || !overlap(panel, vis);
  check(!overlap(panel, stage), `${label}: shell panel does not overlap the stage`);
  check(!overlap(panel, side), `${label}: shell panel does not overlap the side panel (panel ${Math.round(panel.y)}-${Math.round(panel.b)}, side ${Math.round(side.y)}-${Math.round(side.b)})`);
  check(visOk, `${label}: shell panel does not overlap the (visible part of the) controls`);
  check(panel.x >= -1 && panel.r <= W + 1, `${label}: shell panel inside the viewport width`);
  if (col) check(inside(panel, col), `${label}: shell panel inside the atom column`);
  const m = await p.evaluate(() => {
    const pr = document.querySelector('[data-testid="atom-shells"]').getBoundingClientRect();
    const lis = [...document.querySelectorAll('[data-testid="atom-shells-list"] li')].map((e) => e.getBoundingClientRect());
    const lisOver = lis.some((r) => r.x < pr.x - 1 || r.right > pr.right + 1);
    let lisOverlap = false; for (let i = 0; i < lis.length; i += 1) for (let j = i + 1; j < lis.length; j += 1) { const a = lis[i]; const b = lis[j]; if (a.x < b.right - 0.5 && b.x < a.right - 0.5 && a.y < b.bottom - 0.5 && b.y < a.bottom - 0.5) lisOverlap = true; }
    const dds = [...document.querySelectorAll('[data-testid="atom-shells"] dd')].map((e) => e.scrollWidth <= e.clientWidth + 1 && e.getBoundingClientRect().right <= pr.right + 1);
    const sec = document.querySelector('[data-testid="atom-shells"]');
    return { lisOver, lisOverlap, ddsOk: dds.every(Boolean), secClip: sec.scrollWidth <= sec.clientWidth + 1 };
  });
  check(!m.lisOver && !m.lisOverlap, `${label}: shell chips inside the panel and not overlapping each other`);
  check(m.ddsOk && m.secClip, `${label}: arrangement / configuration text fits inside the panel`);
}

// ---- the drawing follows the arrangement: markers per ring, ring radius, spacing ----
async function ringChecks(p, label, expected) {
  const rings = await p.evaluate(() => {
    const svg = document.querySelector('[data-testid="atom-svg"]');
    const out = [];
    for (const g of svg.children) {
      if (g.tagName !== "g") continue;
      const els = [...g.children].filter((c) => c.tagName === "g" && (c.getAttribute("transform") || "").startsWith("translate(") && c.querySelector("foreignObject"));
      if (!els.length) continue;
      const pts = els.map((e) => { const m = e.getAttribute("transform").match(/translate\(([-\d.e]+)[ ,]+([-\d.e]+)\)/); return [Number(m[1]), Number(m[2])]; });
      const radius = Math.hypot(pts[0][0], pts[0][1]);
      let minD = Infinity; for (let i = 0; i < pts.length; i += 1) for (let j = i + 1; j < pts.length; j += 1) minD = Math.min(minD, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
      out.push({ count: pts.length, radius: Math.round(radius), minD: pts.length > 1 ? Math.round(minD) : null });
    }
    const guides = svg.querySelectorAll("circle[stroke-dasharray='2 4']").length;
    return { out, guides };
  });
  const got = rings.out.map((r) => r.count).join(",");
  check(got === expected, `${label}: drawn electrons per ring ${got || "(none)"} == expected arrangement ${expected || "(none)"}`);
  check(rings.guides === rings.out.length, `${label}: one guide circle per ring (${rings.guides} vs ${rings.out.length})`);
  check(rings.out.every((r, i) => i === 0 || r.radius > rings.out[i - 1].radius), `${label}: ring radii increase outwards (${rings.out.map((r) => r.radius).join("/")})`);
  check(rings.out.every((r) => r.minD === null || r.minD >= 24), `${label}: electron markers on a ring do not touch (min spacing ${Math.min(...rings.out.map((r) => r.minD ?? 999))}px in drawing units, marker 19+spin ring)`);
  check(rings.out.length <= 5 && (rings.out.length <= 4 || expected.split(",").length === 5), `${label}: at most 4 rings unless a real 5th shell`);
}

async function panelRead(p) {
  return { arr: await txt(p, T("atom-shells-arrangement")), cfg: await txt(p, T("atom-shells-config")), short: await txt(p, T("atom-shells-shorthand")), ion: await txt(p, T("atom-shells-ion")), list: await p.evaluate(() => [...document.querySelectorAll('[data-testid="atom-shells-list"] li')].map((li) => `${li.dataset.count}/${li.dataset.max}:${li.dataset.state}`)), none: await p.locator(T("atom-shells-none")).count() };
}

async function pickElement(p, sym) {
  const [name, z] = NAMES[sym];
  const btn = p.getByRole("button", { name: `${name}, atomic number ${z}` });
  if (!(await btn.count())) { await p.getByRole("button", { name: /Explore Periodic Table/ }).click(); await sleep(150); }
  await btn.scrollIntoViewIfNeeded(); await btn.click(); await sleep(150);
}

async function scenarios(p, label, W, theme, snapBase) {
  // 1) neutral atoms from the periodic table with Auto-balance on
  await p.locator(T("atom-reset-carbon")).click(); await sleep(100);
  await p.locator(T("atom-auto-balance")).check(); await sleep(100);
  for (const sym of ["H", "C", "Na", "Mn", "Cr", "Cu", "Kr"]) {
    await pickElement(p, sym);
    const c = await cnt(p); const r = await panelRead(p);
    check(c.p === NAMES[sym][1] && c.e === NAMES[sym][1], `${label}: ${sym} picked, p=e=${NAMES[sym][1]} (${JSON.stringify(c)})`);
    check(r.arr === ARR[sym], `${label}: ${sym} arrangement ${r.arr} == ${ARR[sym]}`);
    if (CFG[sym]) check(ascii(r.cfg) === CFG[sym], `${label}: ${sym} configuration ${r.cfg}`);
    check(r.ion === "", `${label}: ${sym} neutral -> no ion label`);
    if (sym === "Mn") check(r.list.join(" ") === "2/2:full 8/8:full 13/18:partial 2/32:partial", `${label}: Mn shells ${r.list.join(" ")}`);
    if (sym === "Kr") check(r.list.join(" ") === "2/2:full 8/8:full 18/18:full 8/32:partial", `${label}: Kr shells ${r.list.join(" ")}`);
    await ringChecks(p, `${label} ${sym}`, ARR[sym]);
    await shellGeometry(p, `${label} ${sym}`, W);
    if (sym === "Mn") await p.screenshot({ path: `${snapBase}-Mn.png` });
  }
  // 2) manual electron add / remove (Auto-balance off): Mn 25 -> 26 -> 24
  await pickElement(p, "Mn"); // Auto-balance still on: 25/25
  await p.locator(T("atom-auto-balance")).uncheck(); await sleep(100);
  check((await cnt(p)).e === 25, `${label}: Mn 25 electrons before manual changes`);
  await click(p, "atom-add-electron");
  let r = await panelRead(p);
  check(r.arr === "2,8,14,2" && /−1/.test(r.ion), `${label}: Mn + electron -> ${r.arr}, ${r.ion}`);
  await click(p, "atom-remove-electron", 2);
  r = await panelRead(p);
  check(r.arr === "2,8,13,1" && /\+1/.test(r.ion), `${label}: Mn - 2 electrons -> ${r.arr} (24 electrons), ${r.ion}`);
  check((await p.locator(T("atom-shells-ion-note")).count()) === 1, `${label}: transition-metal ion shows the small note`);
  await shellGeometry(p, `${label} Mn+ ion`, W);
  await click(p, "atom-remove-electron", 24);
  r = await panelRead(p);
  check(r.none === 1 && (await txt(p, T("atom-shells"))).includes("No electrons"), `${label}: 0 electrons -> "No electrons"`);
  await ringChecks(p, `${label} 0e`, "");
  await shellGeometry(p, `${label} 0e`, W);
  // 3) 37-40 electrons: real 5th shell, still inside the stage
  await click(p, "atom-add-electron", 40);
  r = await panelRead(p);
  check(r.arr === "2,8,18,10,2", `${label}: 40 electrons -> ${r.arr}`);
  await ringChecks(p, `${label} 40e`, "2,8,18,10,2");
  await shellGeometry(p, `${label} 40e`, W);
  const stage = await rect(p, T("atom-stage")); const svg = await rect(p, T("atom-svg"));
  check(svg.w <= stage.w + 1 && svg.h <= stage.h + 1, `${label}: drawing inside its stage with 5 rings`);
  await p.screenshot({ path: `${snapBase}-40e.png` });
  // 4) identity card with big charges: +2, -3, +10 (and neutral)
  const cases = [["+2", { p: 6, e: 4 }], ["-3", { p: 6, e: 9 }], ["+10", { p: 16, e: 6 }], ["-10", { p: 6, e: 16 }], ["0", { p: 6, e: 6 }], ["+1 Fe-like 3-digit sym", { p: 26, e: 25 }]];
  for (const [name, t] of cases) {
    await p.locator(T("atom-start-empty")).click(); await sleep(80);
    await click(p, "atom-add-proton", t.p); await click(p, "atom-add-electron", t.e);
    const c = await cnt(p);
    check(c.p === t.p && c.e === t.e, `${label}: built ${name} (${JSON.stringify(c)})`);
    const id = await identityChecks(p, `${label} identity charge ${name}`);
    if (id) notes.push(`${label} charge ${name}: identity card ${id.cardW}px wide, table ${id.wrapped ? "wrapped under" : "beside"} the notation`);
    await shellGeometry(p, `${label} charge ${name}`, W);
    if (name === "+10") { await p.locator(T("atom-identity")).scrollIntoViewIfNeeded(); await p.screenshot({ path: `${snapBase}-charge10.png` }); }
  }
  await p.locator(T("atom-reset-carbon")).click(); await sleep(100);
}

async function controlsUsable(p, label) {
  for (const id of ["atom-add-proton", "atom-remove-proton", "atom-add-neutron", "atom-remove-neutron", "atom-add-electron", "atom-remove-electron", "atom-auto-balance", "atom-start-empty", "atom-reset-carbon"]) {
    const u = await p.evaluate((sel) => {
      const el = document.querySelector(sel); if (!el) return false; el.scrollIntoView({ block: "nearest" });
      const r = el.getBoundingClientRect(); if (r.width < 8 || r.height < 8) return false;
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return !!hit && (el === hit || el.contains(hit) || hit.contains(el) || !!el.closest("label")?.contains(hit));
    }, T(id));
    check(u, `${label}: ${id} visible and not covered`);
  }
}

for (const theme of THEMES) {
  for (const [W, H] of SIZES) {
    const size = `${W}x${H}`; const tag = `${theme}@${size}`;
    console.log(`\n== ${tag} (new tab view)`);
    const { ctx, p, errors } = await open(W, H, "/simulation/build-an-atom", theme);
    await p.waitForSelector(T("atom-workspace")); await sleep(700);
    const isDark = await p.evaluate(() => document.documentElement.classList.contains("dark"));
    check(isDark === (theme === "dark"), `${tag}: theme applied (dark class ${isDark})`);
    const layout = await p.locator(T("atom-workspace")).getAttribute("data-layout");
    const side = await rect(p, T("atom-side"));
    notes.push(`${tag}: layout ${layout}, side panel ${Math.round(side.w)}px wide`);
    check((await docOverflow(p)).x <= 1, `${tag}: no horizontal page overflow`);
    await identityChecks(p, `${tag} carbon identity`);
    await shellGeometry(p, `${tag} carbon`, W);
    await controlsUsable(p, tag);
    await p.screenshot({ path: `${out}/${theme}-${size}-newtab.png` });
    await scenarios(p, `${tag} newtab`, W, theme, `${out}/${theme}-${size}-newtab`);
    check((await docOverflow(p)).x <= 1, `${tag}: no horizontal page overflow after scenarios`);
    if (W >= 800 || theme === "light") {
      const fs1 = await enterFullscreen(p);
      check(fs1, `${tag}: shell Fullscreen button enters fullscreen`);
      if (fs1) {
        await sleep(300);
        const fside = await rect(p, T("atom-side"));
        notes.push(`${tag} fullscreen: side panel ${Math.round(fside.w)}px`);
        await identityChecks(p, `${tag} fullscreen carbon identity`);
        await shellGeometry(p, `${tag} fullscreen carbon`, W);
        await controlsUsable(p, `${tag} fullscreen`);
        await p.screenshot({ path: `${out}/${theme}-${size}-fullscreen.png` });
        await scenarios(p, `${tag} fullscreen`, W, theme, `${out}/${theme}-${size}-fullscreen`);
        await p.getByRole("button", { name: /^exit full ?screen/i }).first().click(); await sleep(500);
      }
    }
    check(errors.length === 0, `${tag}: no console errors/warnings ${errors.slice(0, 2).join(" | ")}`);
    await ctx.close();
  }
}

// embedded (interactives page) if such a page exists for this engine
{
  const [W, H] = [1366, 768];
  const { ctx, p, errors } = await open(W, H, "/interactives/build-an-atom", "light");
  await sleep(1200);
  if (await p.locator(T("atom-workspace")).count()) {
    console.log("\n== embedded /interactives/build-an-atom");
    const layout = await p.locator(T("atom-workspace")).getAttribute("data-layout");
    notes.push(`embedded page exists: layout ${layout}`);
    await identityChecks(p, "embedded carbon identity"); await shellGeometry(p, "embedded carbon", W);
    await scenarios(p, "embedded", W, "light", `${out}/embedded`);
    check(errors.length === 0, `embedded: no console errors ${errors.slice(0, 2).join(" | ")}`);
  } else notes.push("NO embedded page for build-an-atom at /interactives/build-an-atom (not verified)");
  await ctx.close();
}

await browser.close();
preview?.kill();
if (dist) fs.rmSync(dist, { recursive: true, force: true });
console.log("\n--- notes ---"); for (const n of notes) console.log(" ", n);
console.log(`\n${checks} checks, ${problems.length} problems`);
for (const x of problems) console.log("  PROBLEM", x);
process.exit(problems.length ? 1 : 0);
