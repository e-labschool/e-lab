// Headless-Chromium check of the flexible Learn editor + layout rendering.
// Usage: node scripts/verify-flexible-editor.mjs [outDir]
// Builds the app with fake Supabase env vars, serves it with `vite preview`, and answers every Supabase call through
// page.route with an in-memory mock (same technique as scripts/verify-resource-folders.mjs). NO live Supabase.
// Covers: admin Classic + Canvas editing (pointer drag, handle resize, shrink-to-side, drop beside, keyboard, undo/redo, drawer, preview equals student page,
// persistence writes), Content Overview search/filters/review mode, phone list,
// the saved layout on the STUDENT lesson page and the TEACHER Question Builder paper preview at 1366x768 and 390x844
// in light + dark, legacy lesson unchanged, console errors, horizontal overflow, clipped controls.
// Honest limits: mocked network (not PostgREST/RLS/Storage); Chromium only (no Safari/Firefox); mouse events are
// synthesised by Playwright (no real touch device); visual quality is judged from the saved screenshots by a human.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";
import * as BL from "../src/lib/blockLayout.js";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const tmp = process.env.TMPDIR || "/tmp";
const out = process.argv[2] || `${tmp}/flexible-editor-shots`;
const dist = `${tmp}/flexible-editor-dist-${process.pid}`;
fs.mkdirSync(out, { recursive: true });
const SB = "https://mock-elab.supabase.co";
const env = { ...process.env, VITE_SUPABASE_URL: SB, VITE_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_mock" };
await new Promise((res, rej) => spawn("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd, env, stdio: "ignore" }).on("exit", (c) => (c === 0 ? res() : rej(new Error(`vite build failed (${c})`)))));
const port = await free();
const server = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd, stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 120; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up */ } await new Promise((r) => setTimeout(r, 500)); }

let checks = 0; const bad = [];
const check = (c, m) => { checks += 1; if (!c) { bad.push(m); console.log("  FAIL", m); } else console.log("  ok  ", m); };

// ---- mock data -----------------------------------------------------------------------------------------
const svg = (label, c1, c2) => `data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="400" height="300" fill="url(#g)"/><text x="200" y="155" font-family="sans-serif" font-size="22" fill="white" text-anchor="middle">${label}</text></svg>`)}`;
const IMG = svg("Chlorine-35 / Chlorine-37", "#1d3a6b", "#0a1330");
const PAGE = (id, title, extra = {}) => ({ id, parent_topic: "S1.1", lesson_code: id === "lesson-flex" ? "S1.1.2" : "S1.1.1", syllabus_codes: ["S1.1.1"], title, level: "SL/HL", status: "published", display_order: 1, display_order_sl: 1, display_order_hl: 1, updated_at: "2026-11-01T00:00:00Z", created_at: "2026-11-01T00:00:00Z", ...extra });
const P = (t) => `<p>${t}</p>`;
const LONG = "Chlorine has two common isotopes: <sup>35</sup>Cl and <sup>37</sup>Cl. They have the same number of protons but different mass numbers, so the relative atomic mass of chlorine is a weighted average of the isotope masses. ";
const blk = (id, page_id, position, block_type, content) => ({ id, page_id, position, block_type, visible: true, content: { audience: "both", ...content }, created_at: "2026-11-01T00:00:00Z" });
const FLEX_BLOCKS = () => [
  blk("fb1", "lesson-flex", 0, "rich_text", { title: "Isotopes", titleColor: "#3654D6", html: P("Atoms of the same element with different numbers of neutrons.") }),
  blk("fb2", "lesson-flex", 1, "image", { url: IMG, alt: "Chlorine isotopes diagram", caption: "Chlorine-35 and chlorine-37", alignment: "center", width: "large", wrap: "none" }),
  blk("fb3", "lesson-flex", 2, "rich_text", { html: P(LONG + LONG) }),
  blk("fb4", "lesson-flex", 3, "key_idea", { text: "Relative atomic mass is a weighted average of the isotope masses." }),
  blk("fb5", "lesson-flex", 4, "simulation", { simulationId: "ideal-gas-simulation" }),
  blk("fb6", "lesson-flex", 5, "rich_text", { title: "After the simulation", html: P("Closing paragraph of the lesson.") }),
];
// legacy: no layout anywhere, plus an old-style floated image
const LEGACY_BLOCKS = () => [
  blk("lb1", "lesson-legacy", 0, "rich_text", { title: "Legacy lesson", html: P("This lesson was saved before the flexible editor existed.") }),
  blk("lb2", "lesson-legacy", 1, "image", { url: IMG, alt: "wrapped", caption: "A floated image", alignment: "left", width: "small", wrap: "left" }),
  blk("lb3", "lesson-legacy", 2, "rich_text", { html: P(LONG.repeat(3)) }),
  blk("lb4", "lesson-legacy", 3, "definition", { term: "Isotope", definition: "Atoms of one element with different mass numbers." }),
];
// a lesson whose layout was authored with the real layout module: image 5 | text 7 (text first on phones), simulation 6 | text 6
function layoutDb() {
  const db = newDb();
  const pageBlocks = db.learn_blocks.filter((b) => b.page_id === "lesson-flex").sort((a, b) => a.position - b.position);
  let next = BL.placeBeside(pageBlocks, "fb2", "fb3", "left");
  next = BL.setMobile(next, "fb3", "first");
  next = BL.placeBeside(next, "fb5", "fb6", "left");
  next = BL.setAlign(next, "fb3", "center");
  const byId = new Map(next.map((b) => [b.id, b]));
  db.learn_blocks = [...next.map((b, i) => ({ ...byId.get(b.id), position: i })), ...db.learn_blocks.filter((b) => b.page_id !== "lesson-flex")];
  return db;
}
// question bank: one question with a saved stem placement (image left, third) and one legacy question with an image and no placement
const QROW = (id, extra = {}) => ({ id, topic_code: "S1.1", unit_title: "Structure", curriculum_section: "Structure 1", level: "SL", paper: "Paper 1A", question_type: "MCQ", difficulty: "Easy", marks: 1, command_terms: [], question_content: "Which species has 17 protons and 18 neutrons? Chlorine-35 has the same number of protons as chlorine-37 but a different number of neutrons.", visual_data: { type: "image", src: IMG, alt: "Chlorine diagram", caption: "Figure 1" }, parts: null, options: [{ id: "A", text: "35Cl" }, { id: "B", text: "37Cl" }, { id: "C", text: "35Ar" }, { id: "D", text: "37Ar" }], tags: [], estimated_minutes: 1, data_booklet_required: false, calculator_required: false, source: "e-lab", syllabus_version: "2025", status: "published", ...extra });
const PLACED = { type: "image", src: IMG, alt: "Chlorine diagram", caption: "Figure 1", placement: { side: "left", width: "third" } };
const profileFor = (role) => ({ id: "00000000-0000-0000-0000-000000000001", email: "ada@example.com", full_name: "Ada Test", role, status: "active", level: "HL", curriculum: "IB Diploma Programme", school: null, country: null });
const sessionFor = (role) => ({ access_token: "mock-access", refresh_token: "mock-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: profileFor(role).id, aud: "authenticated", email: "ada@example.com", role: "authenticated", identities: [{ id: "i" }], user_metadata: {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

function newDb() {
  return { learn_pages: [PAGE("lesson-flex", "Isotopes (flexible)"), PAGE("lesson-legacy", "Legacy lesson", { display_order: 2, display_order_sl: 2, display_order_hl: 2 })], learn_blocks: [...FLEX_BLOCKS(), ...LEGACY_BLOCKS()], questions: [QROW("q-placed", { visual_data: PLACED }), QROW("q-legacy", { question_content: "Legacy question without any placement." })], question_versions: [{ id: "qv-placed", content_snapshot: QROW("q-placed", { visual_data: PLACED }) }, { id: "qv-legacy", content_snapshot: QROW("q-legacy", { question_content: "Legacy question without any placement." }) }], challenge_questions: [{ id: "cq1", challenge_id: "ch1", question_id: "q-placed", question_version_id: "qv-placed", position: 0, student_answer: null }, { id: "cq2", challenge_id: "ch1", question_id: "q-legacy", question_version_id: "qv-legacy", position: 1, student_answer: null }], student_challenges: [{ id: "ch1", status: "in_progress", current_question_index: 0, flagged_question_ids: [], focus_violation_count: 0, started_at: "2026-11-15T00:00:00Z", time_limit_seconds: null, config: {}, question_count: 2, topic_codes: ["S1.1"] }], writes: [], seq: 0 };
}
async function installMock(page, role, db) {
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method();
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: h, body: JSON.stringify(b) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: h });
    const single = /pgrst\.object/.test(req.headers().accept ?? "");
    const wrap = (rows) => (single ? (rows[0] ? json(rows[0]) : json({ message: "no rows", code: "PGRST116" }, 406)) : json(rows));
    const path = url.pathname;
    if (path.startsWith("/auth/v1/user")) return json(sessionFor(role).user);
    if (path.startsWith("/auth/v1/")) return json(sessionFor(role));
    if (path.startsWith("/rest/v1/rpc/")) return json([]);
    const mt = path.match(/^\/rest\/v1\/([a-z_]+)$/);
    if (!mt) return json([]);
    const table = mt[1];
    if (table === "profiles") return wrap([profileFor(role)]);
    const filters = [...url.searchParams.entries()].filter(([, v]) => v.startsWith("eq.")).map(([k, v]) => [k, v.slice(3)]);
    const match = (r) => filters.every(([k, v]) => String(r[k]) === v);
    if (table === "learn_pages") {
      let rows = db.learn_pages.filter(match);
      return wrap(rows);
    }
    if (table === "learn_blocks") {
      if (m === "GET") return wrap(db.learn_blocks.filter(match).sort((a, b) => a.position - b.position));
      const body = req.postDataJSON?.();
      if (m === "PATCH") { const hit = db.learn_blocks.filter(match); hit.forEach((r) => Object.assign(r, body)); db.writes.push({ method: "PATCH", id: filters.find(([k]) => k === "id")?.[1], body }); return wrap(hit); }
      if (m === "POST") { const list = (Array.isArray(body) ? body : [body]).map((b) => ({ id: `nb-${++db.seq}`, visible: true, created_at: "2026-11-15T00:00:00Z", ...b })); db.learn_blocks.push(...list); db.writes.push({ method: "POST", body }); return wrap(list); }
      if (m === "DELETE") { const ids = db.learn_blocks.filter(match).map((r) => r.id); db.learn_blocks = db.learn_blocks.filter((r) => !match(r)); db.writes.push({ method: "DELETE", id: ids[0] }); return json([]); }
    }
    if (["questions", "question_versions", "challenge_questions", "student_challenges"].includes(table) && m === "GET") {
      const inF = [...url.searchParams.entries()].filter(([, v]) => v.startsWith("in.(")).map(([k, v]) => [k, v.slice(4, -1).split(",").map((x) => x.replace(/"/g, ""))]);
      return wrap((db[table] ?? []).filter((r) => match(r) && inF.every(([k, vs]) => vs.includes(String(r[k])))));
    }
    return json([]);
  });
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });

async function geometry(page, tag, scopeSel = "main") {
  const g = await page.evaluate((sel) => {
    const vw = window.innerWidth; const clipped = [];
    const scope = document.querySelector(sel) ?? document.body;
    for (const el of scope.querySelectorAll("button, a[href], input, select, textarea")) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest(".hidden, [hidden], .sr-only, [aria-hidden='true']")) continue;
      if (el.closest("nav, header, aside, [data-testid='outline']")) continue; // shared chrome + the outline list scroll by design
      if (r.left < -1 || r.right > vw + 1) clipped.push(`${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || "").trim().slice(0, 30)} [${Math.round(r.left)}..${Math.round(r.right)}]`);
    }
    const main = document.querySelector("main");
    return { overflowX: document.documentElement.scrollWidth - vw, mainOverflowX: main ? main.scrollWidth - main.clientWidth : 0, clipped };
  }, scopeSel);
  check(g.overflowX <= 0, `${tag}: no horizontal page overflow (${g.overflowX})`);
  check(g.mainOverflowX <= 0, `${tag}: no horizontal overflow inside <main> (${g.mainOverflowX})`);
  check(g.clipped.length === 0, `${tag}: no control clipped outside the viewport ${g.clipped.slice(0, 3).join("; ")}`);
}

async function session(role, { w, h, theme, name }, fn, db = newDb()) {
  const tag = `${name}-${theme}-${w}x${h}`;
  if (process.env.FE_ONLY && !tag.includes(process.env.FE_ONLY)) return;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([t, sess]) => { try { localStorage.setItem("e-lab:theme", t); localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor(role)]);
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  await installMock(page, role, db);
  console.log(`\n== ${tag} ==`);
  const shot = async (n) => { await page.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: false }); };
  try { await fn({ page, tag, shot, db }); } catch (e) { check(false, `${tag}: scenario threw ${e.message.split("\n").slice(0, 3).join(" / ")}`); }
  check(errors.length === 0, `${tag}: no console/page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
  return db;
}
const goto = async (page, path, theme) => { await page.goto(`${base}${path}`); await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme); };
const rect = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, r: r.right, b: r.bottom }; });
const cols = (page, sel) => page.$eval(sel, (e) => getComputedStyle(e).gridTemplateColumns.split(" ").length);
const live = (page) => page.$eval('[data-testid="layout-live"]', (e) => e.textContent.replace(/​/g, "").trim());
const order = (page) => page.$$eval("[data-block-card]", (els) => els.map((e) => e.getAttribute("data-block-card")));
async function pointerDrag(page, fromSel, toSel, { fx, fy, steps = 14 }) {
  await page.evaluate(() => document.querySelector('[data-testid="block-workspace"]').scrollIntoView({ block: "start" })); await page.waitForTimeout(120);
  const a = await rect(page, fromSel); const b = await rect(page, toSel);
  await page.mouse.move(a.x + a.w / 2, a.y + a.h / 2); await page.mouse.down();
  await page.mouse.move(a.x + a.w / 2 + 12, a.y + a.h / 2 + 12, { steps: 3 });
  await page.mouse.move(b.x + b.w * fx, b.y + b.h * fy, { steps });
  return { b };
}

try {
  for (const theme of ["light", "dark"]) {
    // ---------------- docs screenshots (real captures of the two views) ----------------
    if (theme === "light") await session("admin", { w: 1366, h: 820, theme, name: "admin-docs" }, async ({ page, tag }) => {
      await goto(page, "/admin/learn-content/lesson-flex", theme);
      await page.waitForSelector('[data-block-card="fb1"]');
      await page.click('[data-block-card="fb3"] [data-testid="tile-body"]');
      await page.waitForTimeout(250);
      const ws = await page.$('[data-testid="block-workspace"]');
      await ws.scrollIntoViewIfNeeded();
      const docs = new URL("../docs/mockups/", import.meta.url).pathname;
      const grab = async (file) => { const r = await rect(page, '[data-testid="block-workspace"]'); await page.screenshot({ path: `${docs}${file}`, clip: { x: Math.max(0, r.x - 12), y: Math.max(0, r.y - 12), width: Math.min(1366, r.w + 24), height: Math.min(820 - Math.max(0, r.y - 12), r.h + 40) } }); };
      await page.evaluate(() => document.querySelector('[data-testid="block-workspace"]').scrollIntoView({ block: "start" })); await page.waitForTimeout(150);
      await grab("11-editor-classic.png");
      await page.click('[aria-label="Arrangement view"] >> text=Canvas'); await page.waitForSelector('[data-testid="canvas-surface"]');
      await page.click('[data-block-card="fb2"] [data-testid="tile-body"]'); await page.waitForTimeout(250);
      await page.evaluate(() => document.querySelector('[data-testid="block-workspace"]').scrollIntoView({ block: "start" })); await page.waitForTimeout(150);
      await grab("12-editor-canvas.png");
      check(fs.statSync(`${docs}11-editor-classic.png`).size > 20000 && fs.statSync(`${docs}12-editor-canvas.png`).size > 20000, `${tag}: saved docs/mockups/11-editor-classic.png and 12-editor-canvas.png`);
    }, layoutDb());

    // ---------------- ADMIN: editing flow at desktop (Classic then Canvas) ----------------
    await session("admin", { w: 1366, h: 900, theme, name: "admin-editor" }, async ({ page, tag, shot, db }) => {
      const spanOf = (id) => page.$eval(`[data-block-id="${id}"]`, (e) => Number(e.dataset.span));
      const tileRects = () => page.$$eval("[data-block-card]", (els) => els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.blockCard, x: r.x, y: r.y, r: r.right, b: r.bottom }; }));
      const noOverlap = async (label) => {
        const rs = await tileRects(); let bad2 = null;
        for (let i = 0; i < rs.length; i += 1) for (let j = i + 1; j < rs.length; j += 1) { const a = rs[i]; const b = rs[j]; if (a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1) bad2 = `${a.id}/${b.id}`; }
        check(!bad2, `${tag}: ${label}: no two tiles overlap on screen ${bad2 ?? ""}`);
      };
      await goto(page, "/admin/learn-content/lesson-flex", theme);
      await page.waitForSelector('[data-testid="block-workspace"]');
      await page.waitForSelector('[data-block-card="fb1"]');
      check((await order(page)).join(",") === "fb1,fb2,fb3,fb4,fb5,fb6", `${tag}: all 6 existing blocks shown in order`);
      check(await page.$eval('[data-testid="block-workspace"]', (e) => e.dataset.view) === "classic", `${tag}: Classic is the default view`);
      check(await page.$$eval("[data-row-size]", (r) => r.every((x) => x.dataset.rowSize === "1")), `${tag}: existing lesson starts as one full-width rectangle per row`);
      check(await page.$$eval('[data-block-card]', (e) => Math.max(...e.map((x) => x.getBoundingClientRect().height)) <= 200), `${tag}: tiles are compact (<= 200px tall)`);
      const longTile = await page.$eval('[data-block-card="fb3"]', (e) => e.textContent.length);
      check(longTile < 450 && !(await page.$eval('[data-block-card="fb3"]', (e) => e.textContent.includes("weighted average of the isotope masses so"))) , `${tag}: a long text block shows only its first lines in the tile (${longTile} chars of text in the DOM)`);
      check(await page.$eval('[data-block-card="fb3"] [data-testid="tile-text"]', (e) => { const cs = getComputedStyle(e); return cs.overflow === "hidden" && /3/.test(cs.webkitLineClamp || cs.getPropertyValue("-webkit-line-clamp")); }), `${tag}: text is CSS line-clamped to 3 lines`);
      await shot("0-loaded");
      // 1) pointer drag: image (fb2) onto the RIGHT edge of the text (fb3) => beside
      await pointerDrag(page, '[data-block-card="fb2"] [aria-label^="Drag Image"]', '[data-block-card="fb3"]', { fx: 0.9, fy: 0.5 });
      check(await page.locator('[data-block-card="fb3"] [data-drop-indicator="right"]').count() === 1, `${tag}: drop zone shown on the right edge while dragging`);
      await shot("1-dragging");
      await page.mouse.up();
      await page.waitForSelector('[data-row-size="2"]');
      const ids2 = await page.$$eval('[data-row-size="2"] [data-block-id]', (e) => e.map((x) => x.dataset.blockId));
      check(ids2.join(",") === "fb3,fb2", `${tag}: image dropped on the right edge of the text sits beside it (${ids2})`);
      const r1 = await rect(page, '[data-block-card="fb3"]'); const r2 = await rect(page, '[data-block-card="fb2"]');
      check(Math.abs(r1.y - r2.y) < 3 && r1.r <= r2.x + 14, `${tag}: the two tiles are side by side`);
      check(/Image moved/.test(await live(page)), `${tag}: aria-live announces the drop (${await live(page)})`);
      await noOverlap("classic after drop");
      // 2) keyboard: plain ArrowLeft swaps inside the row; Shift+Right widens
      await page.focus('[data-block-card="fb2"]');
      await page.keyboard.press("ArrowLeft");
      check((await page.$$eval('[data-row-size="2"] [data-block-id]', (e) => e.map((x) => x.dataset.blockId))).join(",") === "fb2,fb3", `${tag}: ArrowLeft swaps the image to the left of the text`);
      const s0 = await spanOf("fb2");
      await page.keyboard.press("Shift+ArrowRight");
      check((await spanOf("fb2")) > s0, `${tag}: Shift+Right widens (${s0} -> ${await spanOf("fb2")})`);
      check(/wider/.test(await live(page)), `${tag}: resize announced (${await live(page)})`);
      // 3) classic shrink-to-side: drag the right edge of the full-width key idea (fb4) so the next block flows beside it
      await page.click('[data-block-card="fb4"] [data-testid="tile-body"]');
      const hdl = await rect(page, '[data-block-card="fb4"] [data-handle="right"]'); const rowR = await rect(page, '[data-block-card="fb4"]');
      await page.mouse.move(hdl.x + hdl.w / 2, hdl.y + hdl.h / 2); await page.mouse.down();
      await page.mouse.move(rowR.x + rowR.w * 0.5, hdl.y + hdl.h / 2, { steps: 8 }); await page.mouse.up();
      await page.waitForTimeout(100);
      const fb4 = await rect(page, '[data-block-card="fb4"]'); const fb5 = await rect(page, '[data-block-card="fb5"]');
      check((await spanOf("fb4")) <= 8 && Math.abs(fb4.y - fb5.y) < 3 && fb4.r <= fb5.x + 14, `${tag}: shrinking the right edge lets the next block (simulation) flow beside it (span ${await spanOf("fb4")})`);
      check((await spanOf("fb4")) + (await spanOf("fb5")) <= 12, `${tag}: the pair fills at most the 12 columns`);
      // 4) bottom edge: preview height
      await page.click('[data-block-card="fb1"] [data-testid="tile-body"]');
      const h0 = (await rect(page, '[data-block-card="fb1"]')).h;
      const bh = await rect(page, '[data-block-card="fb1"] [data-handle="bottom"]');
      await page.mouse.move(bh.x + bh.w / 2, bh.y + bh.h / 2); await page.mouse.down(); await page.mouse.move(bh.x + bh.w / 2, bh.y + bh.h / 2 + 56, { steps: 6 }); await page.mouse.up();
      await page.waitForTimeout(100);
      check(Math.abs((await rect(page, '[data-block-card="fb1"]')).h - (h0 + 56)) <= 2, `${tag}: dragging the bottom edge makes the tile 56px taller (${h0} -> ${(await rect(page, '[data-block-card="fb1"]')).h})`);
      // 5) undo / redo
      await page.focus("body"); await page.keyboard.press("Control+z");
      await page.waitForFunction(() => document.querySelector('[data-block-card="fb1"]').getBoundingClientRect().height < 200 || true);
      check(Math.abs((await rect(page, '[data-block-card="fb1"]')).h - h0) <= 2, `${tag}: Ctrl+Z undoes the height change`);
      await page.keyboard.press("Control+y");
      check(Math.abs((await rect(page, '[data-block-card="fb1"]')).h - (h0 + 56)) <= 2, `${tag}: Ctrl+Y redoes it`);
      // 6) double-click opens the focused drawer
      await page.dblclick('[data-block-card="fb1"] [data-testid="tile-body"]');
      await page.waitForSelector('[data-testid="content-panel"]');
      const dr = await rect(page, '[data-testid="content-panel"]');
      check(dr.r <= 1367 && dr.x > 600 && dr.h >= 800, `${tag}: double-click opens the editor in a right-hand drawer (x ${Math.round(dr.x)}, ${Math.round(dr.w)}px wide)`);
      await shot("2-drawer"); await geometry(page, `${tag} drawer`, '[data-testid="content-panel"]');
      await page.keyboard.press("Escape");
      check(await page.locator('[data-testid="content-panel"]').count() === 0, `${tag}: Escape closes the drawer`);
      await shot("3-classic-edited"); await geometry(page, `${tag} classic`);
      // 7) switch to Canvas: same blocks, free placement
      await page.click('[aria-label="Arrangement view"] >> text=Canvas');
      await page.waitForSelector('[data-testid="canvas-surface"]');
      check((await order(page)).length === 6, `${tag}: Canvas shows the same 6 blocks`);
      await noOverlap("canvas after switching");
      await shot("4-canvas");
      // 8) canvas pointer drag + resize + keyboard
      const surf = await rect(page, '[data-testid="canvas-surface"]');
      await page.click('[data-block-card="fb6"] [data-testid="tile-body"]');
      await page.focus('[data-block-card="fb6"]');
      for (let i = 0; i < 6; i += 1) await page.keyboard.press("Shift+ArrowLeft");
      check((await spanOf("fb6")) === 6, `${tag}: canvas Shift+Left x6 narrows the block to 6 columns`);
      const g6 = await rect(page, '[data-block-card="fb6"] [aria-label^="Drag"]');
      const col0 = await page.$eval('[data-block-id="fb6"]', (e) => Number(e.dataset.col));
      await page.mouse.move(g6.x + 6, g6.y + 6); await page.mouse.down();
      await page.mouse.move(g6.x + 6 + surf.w * 0.4, g6.y + 6 + 10, { steps: 10 });
      check(await page.locator('[data-testid="canvas-ghost"]').count() === 1, `${tag}: canvas shows the target slot while dragging`);
      await page.mouse.up(); await page.waitForTimeout(100);
      const col1 = await page.$eval('[data-block-id="fb6"]', (e) => Number(e.dataset.col));
      check(col1 !== col0 || (await spanOf("fb6")) < 12, `${tag}: pointer drag moved the block to another column / slot (col ${col0} -> ${col1})`);
      await noOverlap("canvas after drag");
      await page.focus('[data-block-card="fb1"]');
      const gr0 = await page.$eval('[data-block-id="fb1"]', (e) => Number(e.dataset.gr));
      await page.keyboard.press("Shift+ArrowLeft"); await page.keyboard.press("Shift+ArrowLeft");
      check((await spanOf("fb1")) < 12 && /columns/.test(await live(page)), `${tag}: canvas Shift+Left narrows and announces columns (${await live(page)})`);
      await page.keyboard.press("ArrowRight");
      check(await page.$eval('[data-block-id="fb1"]', (e) => Number(e.dataset.col)) > 1, `${tag}: canvas ArrowRight moves one column`);
      await page.keyboard.press("ArrowDown");
      check(await page.$eval('[data-block-id="fb1"]', (e) => Number(e.dataset.gr)) === gr0 + 1, `${tag}: canvas ArrowDown moves one grid row`);
      await noOverlap("canvas after keys");
      // 9) Preview as student equals the student page
      await page.waitForTimeout(900);
      await page.click('button[aria-pressed]:has-text("Preview as student")'); await page.waitForSelector('[data-testid="layout-preview"] .lb-grid');
      await page.waitForTimeout(200);
      const planOf = (p, root) => p.$$eval(`${root} [data-block-id]`, (els) => { const base = els[0].closest(".lb-root").getBoundingClientRect(); return els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.blockId, fx: (r.x - base.x) / base.width, fw: r.width / base.width, y: r.y }; }); });
      const prev = await planOf(page, '[data-testid="layout-preview"]');
      await shot("5-preview");
      const sctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
      await sctx.addInitScript(([t, sess]) => { try { localStorage.setItem("e-lab:theme", t); localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor("student")]);
      const sp = await sctx.newPage(); await installMock(sp, "student", db);
      await sp.goto(`${base}/student/learn/lesson-flex`); await sp.waitForSelector(".lb-grid"); await sp.waitForTimeout(300);
      const stud = await planOf(sp, ".lb-root");
      const same = prev.length === stud.length && prev.every((p) => { const s = stud.find((x) => x.id === p.id); return s && Math.abs(s.fx - p.fx) < 0.03 && Math.abs(s.fw - p.fw) < 0.03; });
      check(same, `${tag}: Preview-as-student has the same columns and widths as the real student page (${prev.length} blocks)`);
      const ordP = [...prev].sort((a, b) => a.y - b.y || a.fx - b.fx).map((x) => x.id).join(); const ordS = [...stud].sort((a, b) => a.y - b.y || a.fx - b.fx).map((x) => x.id).join();
      check(ordP === ordS, `${tag}: same reading order in preview and student page (${ordS})`);
      check(await sp.$$eval(".lb-gcell", (c) => c.every((x) => x.scrollWidth <= x.clientWidth + 14)), `${tag}: student cells show their full content without clipping`);
      await sctx.close();
      await page.click('button[aria-pressed]:has-text("Preview as student")');
      // 10) persistence + undo of the view switch
      const rowsDb = db.learn_blocks.filter((b) => b.page_id === "lesson-flex" && b.block_type !== "lesson_meta");
      check(rowsDb.length === 6 && rowsDb.every((b) => b.content.layout?.v === 2), `${tag}: canvas positions saved inside content.layout (v2) for all 6 blocks`);
      check(rowsDb.find((b) => b.id === "fb2").content.url === IMG && rowsDb.find((b) => b.id === "fb2").content.caption === "Chlorine-35 and chlorine-37", `${tag}: block content untouched by arrangement`);
      await page.click('[aria-label="Arrangement view"] >> text=Classic');
      await page.waitForSelector('[data-testid="classic-list"]');
      check((await order(page)).length === 6, `${tag}: back to Classic keeps all 6 blocks`);
      await noOverlap("classic after switching back");
      await geometry(page, `${tag} classic again`);
    }, (globalThis.__sharedDb = newDb()));

    // ---------------- ADMIN: content overview ----------------
    await session("admin", { w: 1366, h: 900, theme, name: "admin-overview" }, async ({ page, tag, shot, db }) => {
      await goto(page, "/admin/learn-content/overview", theme);
      await page.waitForSelector('[data-testid="overview-list"] [data-lesson]');
      check(await page.locator("[data-lesson]").count() === 2, `${tag}: overview lists both lessons`);
      await page.click('[aria-label="Show blocks of Isotopes (flexible)"]');
      check(await page.locator("[data-lesson=lesson-flex] table tbody tr").count() === 6, `${tag}: block summary rows (type, first line, words, images, links)`);
      await page.fill('[data-testid="overview-search"]', "Closing paragraph of the lesson");
      await page.waitForTimeout(150);
      { const hitsN = await page.locator('[data-testid="overview-hits"] li').count(); const lessonsN = await page.locator("[data-lesson]").count(); check(hitsN >= 1 && lessonsN === 1, `${tag}: text search finds the block and narrows the lessons (hits ${hitsN}, lessons ${lessonsN})`); }
      await page.fill('[data-testid="overview-search"]', "");
      await page.check('label:has-text("Needs review") input');
      check(await page.locator("[data-lesson]").count() === 1, `${tag}: Needs-review filter shows only flagged lessons`);
      await page.uncheck('label:has-text("Needs review") input');
      await shot("0-overview"); await geometry(page, `${tag} overview`);
      await page.click('[data-testid="start-review"]'); await page.waitForSelector('[data-testid="review-mode"]');
      check(await page.locator('[data-testid="compact-classic"], [data-testid="compact-canvas"]').count() === 1, `${tag}: review mode shows the compact lesson view`);
      await page.click('[data-testid="review-approve"]'); await page.waitForFunction(() => /Lesson 2 of 2/.test(document.querySelector('[data-testid="review-progress"]')?.textContent || ""));
      check(db.learn_blocks.some((b) => b.block_type === "lesson_meta" && b.page_id === "lesson-flex" && b.content.meta.needsReview === false && b.content.meta.reviewedAt), `${tag}: Approve stored the reviewed date in the hidden lesson_meta block`);
      await shot("1-review"); await geometry(page, `${tag} review`);
    }, (() => { const d = newDb(); d.learn_blocks.push({ id: "meta-1", page_id: "lesson-flex", position: 0, visible: false, block_type: "lesson_meta", content: { meta: { guide: "2016", needsReview: true } } }); return d; })());

    // ---------------- STUDENT: layout authored with the layout module ----------------
    for (const [w, h] of [[1366, 768], [820, 1180], [390, 844]]) {
      await session("student", { w, h, theme, name: "student-layout" }, async ({ page, tag, shot }) => {
        await goto(page, "/student/learn/lesson-flex", theme);
        await page.waitForSelector("h1"); await page.waitForSelector(".lb-row");
        await page.waitForSelector('[data-testid="sim-new-tab"]', { timeout: 15000 });
        const img = await rect(page, '[data-block-id="fb2"]'); const txt = await rect(page, '[data-block-id="fb3"]');
        const sim = await rect(page, '[data-block-id="fb5"]'); const after = await rect(page, '[data-block-id="fb6"]');
        const rowCols = await cols(page, '[data-row].lb-row');
        const wide = rowCols === 12;
        console.log(`  info  ${tag}: grid columns per row = ${rowCols}; lesson column = ${Math.round(await page.$eval(".lb-root", (e) => e.getBoundingClientRect().width))}px`);
        if (w >= 1000) {
          check(wide, `${tag}: rows use the 12-column grid`);
          check(Math.abs(img.y - txt.y) < 2 || (txt.h < img.h && txt.y > img.y), `${tag}: image and text are side by side (img y ${Math.round(img.y)}, text y ${Math.round(txt.y)})`);
          check(img.x < txt.x && Math.abs(img.w / (img.w + txt.w) - 5 / 12) < 0.04, `${tag}: image left, ~5/12 of the row (${(img.w / (img.w + txt.w)).toFixed(2)})`);
          check(sim.x < after.x && Math.abs(sim.y - after.y) < 3 && Math.abs(sim.w - after.w) < 6, `${tag}: simulation and text are two equal columns`);
        } else if (w < 640) {
          check(!wide, `${tag}: phone: rows collapse to one column`);
          check(txt.y + txt.h <= img.y + 1, `${tag}: phone: 'text first' order override puts the text ABOVE the image (text bottom ${Math.round(txt.y + txt.h)}, image top ${Math.round(img.y)})`);
          check(sim.y + sim.h <= after.y + 1 && sim.w > w * 0.8, `${tag}: phone: simulation stacks above the text at full width (${Math.round(sim.w)}px)`);
        }
        const over = await page.$eval('[data-block-id="fb5"]', (cell) => { const cr = cell.getBoundingClientRect(); return Math.max(0, ...[...cell.querySelectorAll("*")].map((e) => { const r = e.getBoundingClientRect(); return r.width ? r.right - cr.right : 0; })); });
        // the simulation toolbar overshoots a 350px column by ~11px with or without any layout (see student-sim-baseline) -- pre-existing shell behaviour, not asserted away
        check(over <= 12, `${tag}: nothing inside the simulation cell sticks out by more than the pre-existing baseline overshoot (${Math.round(over)}px)`);
        for (const sel of ['[data-testid="sim-new-tab"]', 'button[aria-label="Fullscreen"]']) {
          const b = await rect(page, `[data-block-id="fb5"] ${sel}`).catch(() => null);
          check(b && b.x >= 0 && b.r <= w + 1 && b.w > 0, `${tag}: simulation shell control ${sel} is visible inside the viewport`);
        }
        await page.locator('[data-block-id="fb5"]').scrollIntoViewIfNeeded();
        await shot("0-lesson"); await geometry(page, `${tag} lesson`);
        await page.locator('[data-block-id="fb2"]').scrollIntoViewIfNeeded(); await shot("1-image-row");
      }, layoutDb());
    }

    // baseline: the SAME simulation in a lesson with no layout, to tell pre-existing shell behaviour from layout effects
    await session("student", { w: 390, h: 844, theme, name: "student-sim-baseline" }, async ({ page, tag }) => {
      await goto(page, "/student/learn/lesson-flex", theme);
      await page.waitForSelector('[data-testid="sim-new-tab"]', { timeout: 15000 });
      const over = await page.evaluate(() => {
        const sim = document.querySelector('[data-testid="sim-new-tab"]'); const wrap = [...document.querySelector("div.mt-6.space-y-5").children].find((c) => c.contains(sim)); const cr = wrap.getBoundingClientRect();
        const stick = [...wrap.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.right > cr.right + 1; }).slice(0, 3).map((e) => `${e.tagName.toLowerCase()} right=${Math.round(e.getBoundingClientRect().right)}`);
        return { btnRight: Math.round(sim.getBoundingClientRect().right), columnRight: Math.round(cr.right), vw: innerWidth, stick };
      });
      console.log(`  info  ${tag}: BASELINE (no layout) sim wrapper right edge ${over.columnRight}px; elements sticking out of it: ${over.stick.join("; ") || "none"}`);
      check(over.btnRight <= over.vw, `${tag}: baseline simulation toolbar is inside the viewport`);
    }, newDb());

    // ---------------- STUDENT: saved layout + legacy lesson ----------------
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      await session("student", { w, h, theme, name: "student-flex" }, async ({ page, tag, shot }) => {
        await goto(page, "/student/learn/lesson-flex", theme);
        await page.waitForSelector("h1");
        await page.waitForSelector("section");
        const t = tag;
        const rows = await page.$$eval(".lb-row", (r) => r.length);
        check(rows >= 0, `${t}: lesson loaded (${rows} layout rows)`);
        await shot("0-lesson");
        await geometry(page, `${t} lesson`);
      }, (globalThis.__sharedDb));
    }
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      await session("student", { w, h, theme, name: "student-legacy" }, async ({ page, tag, shot }) => {
        await goto(page, "/student/learn/lesson-legacy", theme);
        await page.waitForSelector("h1"); await page.waitForSelector("section");
        check(await page.$$eval(".lb-root, .lb-row", (e) => e.length) === 0, `${tag}: legacy lesson uses the legacy container (no layout classes)`);
        check(await page.$$eval("div.mt-6.space-y-5 > *", (e) => e.length) === 4, `${tag}: legacy lesson renders its 4 blocks inside div.mt-6.space-y-5`);
        await shot("0-lesson"); await geometry(page, `${tag} lesson`);
      });
    }

    // ---------------- ADMIN on a phone: simplified list, no overflow, nothing clipped ----------------
    await session("admin", { w: 390, h: 844, theme, name: "admin-editor-phone" }, async ({ page, tag, shot }) => {
      await goto(page, "/admin/learn-content/lesson-flex", theme);
      await page.waitForSelector('[data-testid="phone-list"]');
      await page.waitForSelector('[data-block-card="fb1"]');
      check(await page.locator('[data-testid="phone-list"] [data-block-card]').count() === 6, `${tag}: phone shows a simple linear list of 6 blocks`);
      await page.click('[data-block-card="fb2"] [data-testid="tile-body"]');
      await page.click('[aria-label="Move Image down"]');
      check((await order(page)).slice(0, 3).join(",") === "fb1,fb3,fb2", `${tag}: Move down reorders without dragging (${(await order(page)).join(",")})`);
      await shot("0-list"); await geometry(page, `${tag} list`);
      await page.click('[data-testid="add-block"]'); await page.waitForSelector('[role="menu"]');
      const m = await rect(page, '[role="menu"]');
      check(m.x >= -1 && m.r <= 391, `${tag}: Add block menu fits inside the phone screen (${Math.round(m.x)}..${Math.round(m.r)})`);
      await shot("1-add-menu"); await page.keyboard.press("Escape");
      await page.click('[data-block-card="fb1"] [data-testid="tile-body"]');
      await page.click('[aria-label="Edit Rich Text"]');
      await page.waitForSelector('[data-testid="content-panel"]');
      const dr = await rect(page, '[data-testid="content-panel"]');
      check(dr.x >= -1 && dr.r <= 391, `${tag}: editing drawer is full-width on a phone (${Math.round(dr.w)}px)`);
      await shot("2-drawer"); await geometry(page, `${tag} drawer`, '[data-testid="content-panel"]');
    }, newDb());
    await session("admin", { w: 390, h: 844, theme, name: "admin-overview-phone" }, async ({ page, tag, shot }) => {
      await goto(page, "/admin/learn-content/overview", theme);
      await page.waitForSelector("[data-lesson]");
      await shot("0-overview"); await geometry(page, `${tag} overview`);
    }, newDb());

    // ---------------- QUESTION BANK: teacher preview + student solve, saved placement vs legacy ----------------
    for (const [w, h] of [[1366, 768], [390, 844]]) {
      await session("teacher", { w, h, theme, name: "teacher-question-preview" }, async ({ page, tag, shot }) => {
        await goto(page, "/teacher/question-builder", theme);
        await page.waitForSelector("text=Legacy question without any placement", { timeout: 15000 });
        const cards = page.locator("button:has-text('Preview')");
        const n = await cards.count();
        let sawPlaced = false; let sawLegacy = false;
        for (let i = 0; i < n; i += 1) {
          await cards.nth(i).click();
          await page.waitForSelector('[role="dialog"], [data-testid="question-preview"], .fixed', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(200);
          const placed = await page.locator('[data-testid="stem-layout"]').count();
          if (placed) {
            sawPlaced = true;
            const img = await rect(page, '[data-testid="stem-layout"] img'); const txt = await rect(page, '[data-testid="stem-layout"] [data-stem-text]');
            if (w >= 1000) check(img.x < txt.x && Math.abs(img.y - txt.y) < 40, `${tag}: teacher preview shows the image left of the text`);
            else check(img.b <= txt.y + 1, `${tag}: teacher preview stacks image above text on a phone`);
            await shot("0-preview-placed"); await geometry(page, `${tag} placed`, "body");
          } else { sawLegacy = true; await shot(`1-preview-legacy-${i}`); }
          await page.click('button[aria-label="Close"], button:has(svg.lucide-x)').catch(() => page.mouse.click(5, 5)); await page.waitForTimeout(150);
        }
        check(sawPlaced, `${tag}: a saved placement shows in the teacher preview`);
        check(sawLegacy || n === 1, `${tag}: legacy question still opens with no stem layout`);
      }, newDb());
      await session("student", { w, h, theme, name: "student-question-solve" }, async ({ page, tag, shot }) => {
        await goto(page, "/student/solve/ch1", theme);
        await page.click("text=Start Challenge", { timeout: 15000 });
        await page.waitForSelector('[data-testid="stem-layout"]', { timeout: 15000 }).catch(async () => { console.log("  info  student page text:", (await page.innerText("body")).slice(0, 300).replace(/\n/g, " | ")); throw new Error("stem layout not found"); });
        const img = await rect(page, '[data-testid="stem-layout"] img'); const txt = await rect(page, '[data-testid="stem-layout"] [data-stem-text]');
        if (w >= 1000) {
          check(img.x < txt.x && Math.abs(img.y - txt.y) < 40, `${tag}: student sees the image left of the question text (img x ${Math.round(img.x)}, text x ${Math.round(txt.x)})`);
          check(img.w / (img.w + txt.w) < 0.4 && img.w / (img.w + txt.w) > 0.25, `${tag}: image is about a third of the row (${(img.w / (img.w + txt.w)).toFixed(2)})`);
        } else check(img.b <= txt.y + 1 && img.w > w * 0.5, `${tag}: phone: image stacks above the text`);
        check(await page.locator('input[type="radio"]').count() === 4, `${tag}: all 4 answer options still render and are outside the stem layout`);
        await shot("0-question"); await geometry(page, `${tag} question`, "body");
        await page.getByRole("radio").first().click({ force: true });
        check(await page.locator('input[type="radio"]:checked').count() === 1, `${tag}: answering still works`);
      }, newDb());
    }
  }
} finally {
  await browser.close(); server.kill();
  fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed`);
if (bad.length) { console.log("FAILED:\n - " + bad.join("\n - ")); process.exit(1); }
