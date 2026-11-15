// Headless-Chromium check of (1) the curriculum control on sign-up (student + teacher), (2) curriculum chips + edit on the
// profile pages, (3) the padlock lock toggle on /admin/simulations and /admin/folders.
// Usage: node scripts/verify-curricula-and-locks.mjs [outDir]
// Same technique as scripts/verify-auth-signup-confirmation.mjs / verify-resource-folders.mjs: builds the app into a temp
// dir WITH fake Supabase env vars, serves it with `vite preview`, answers every Supabase call via page.route from an
// in-memory mock (NO live Supabase).  1366x768 and 390x844, light and dark.  Screenshots are written for human review.
// Honest limits: mocked network (not PostgREST/RLS/Auth); Chromium only; visual quality is judged from the screenshots,
// only geometry / console / behaviour are asserted; the real signUp -> trigger -> profiles path is NOT exercised.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import net from "node:net";
import { spawn } from "node:child_process";

const free = () => new Promise((res, rej) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const { port } = s.address(); s.close(() => res(port)); }); s.on("error", rej); });
const cwd = new URL("..", import.meta.url).pathname;
const tmp = process.env.TMPDIR || "/tmp";
const out = process.argv[2] || `${tmp}/curricula-locks-shots`;
const dist = `${tmp}/curricula-locks-dist-${process.pid}`;
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const UID = "00000000-0000-0000-0000-000000000001";
const folder = (id, parent_id, name, extra = {}) => ({ id, parent_id, audience: "student", name, slug: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"), sort_order: 10, access_tier: "free", created_at: "2026-11-01T00:00:00Z", updated_at: "2026-11-01T00:00:00Z", created_by: null, ...extra });
const FOLDERS = () => [
  folder("f-ibd", null, "IB Documents", { slug: "ib-documents", sort_order: 10 }),
  folder("f-sm", null, "Study Materials", { slug: "study-materials", sort_order: 20, access_tier: "premium" }),
  folder("f-chem", "f-sm", "Chemistry"),
  folder("f-react", "f-chem", "Reactivity", { sort_order: 10 }),
];
const profileFor = (role, curriculum) => ({ id: UID, email: "ada@example.com", full_name: "Ada Test", role, status: "active", level: "HL", curriculum, school: null, country: null, grade_or_class: "DP1" });
const sessionFor = (role, meta) => ({ access_token: "mock-access", refresh_token: "mock-refresh", token_type: "bearer", expires_in: 36000, expires_at: Math.floor(Date.now() / 1000) + 36000, user: { id: UID, aud: "authenticated", email: "ada@example.com", role: "authenticated", identities: [{ id: "i" }], user_metadata: meta, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" } });

async function installMock(page, role, meta) {
  const db = { folders: FOLDERS(), simAccess: [], signUps: [], userUpdates: [], profilePatches: [], simWrites: [], folderPatches: [] };
  await page.route(`${SB}/**`, async (route) => {
    const req = route.request(); const url = new URL(req.url()); const m = req.method();
    const h = { "access-control-allow-origin": "*", "access-control-allow-headers": "*", "access-control-allow-methods": "*", "access-control-expose-headers": "*" };
    const json = (b, status = 200) => route.fulfill({ status, contentType: "application/json", headers: h, body: JSON.stringify(b) });
    if (m === "OPTIONS") return route.fulfill({ status: 204, headers: h });
    const single = /pgrst\.object/.test(req.headers().accept ?? "");
    const wrap = (rows) => (single ? (rows[0] ? json(rows[0]) : json({ message: "no rows", code: "PGRST116" }, 406)) : json(rows));
    const path = url.pathname; const body = () => { try { return req.postDataJSON(); } catch { return null; } };
    if (path.startsWith("/auth/v1/signup")) { db.signUps.push(body()); return json({ id: UID, aud: "authenticated", email: "ada@example.com", identities: [{ id: "i" }], user_metadata: body()?.data ?? {}, app_metadata: {}, created_at: "2026-01-01T00:00:00Z" }); }
    if (path.startsWith("/auth/v1/user")) { if (m === "PUT") { db.userUpdates.push(body()); return json({ ...sessionFor(role, { ...meta, ...(body()?.data ?? {}) }).user }); } return json(sessionFor(role, meta).user); }
    if (path.startsWith("/auth/v1/")) return json(sessionFor(role, meta));
    const mt = path.match(/^\/rest\/v1\/([a-z_]+)$/); if (!mt) return json([]);
    const table = mt[1];
    const filters = [...url.searchParams.entries()].filter(([, v]) => v.startsWith("eq.")).map(([k, v]) => [k, v.slice(3)]);
    const match = (r) => filters.every(([k, v]) => String(r[k]) === v);
    if (table === "profiles") {
      if (m === "PATCH") { db.profilePatches.push(body()); return wrap([{ ...profileFor(role, "IB Diploma Programme"), ...body() }]); }
      return wrap([profileFor(role, meta?.curriculum ?? "IB Diploma Programme")]);
    }
    if (table === "platform_settings" || table === "platform_settings_public") return wrap([{ id: 1, premium_enabled: false, require_login_for_simulations: false, allow_student_registration: true, allow_teacher_registration: true }]);
    if (table === "simulation_access") {
      if (m === "GET") return json(db.simAccess);
      const b = body(); db.simWrites.push(b);
      const row = { featured: false, tier: "free", ...b }; const i = db.simAccess.findIndex((r) => r.sim_id === b.sim_id);
      if (i >= 0) Object.assign(db.simAccess[i], b); else db.simAccess.push(row);
      return json([row], 201);
    }
    if (table === "resource_folders") {
      if (m === "GET") return wrap(db.folders.filter(match));
      if (m === "PATCH") { const hit = db.folders.filter(match); hit.forEach((r) => Object.assign(r, body())); db.folderPatches.push(body()); return wrap(hit); }
    }
    return json([]);
  });
  return db;
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox"] });
const goto = async (page, path, theme) => { await page.goto(`${base}${path}`); await page.evaluate((t) => document.documentElement.classList.toggle("dark", t === "dark"), theme); };
async function geometry(page, tag) {
  const g = await page.evaluate(() => {
    const vw = window.innerWidth; const clipped = [];
    const scope = document.querySelector("main") ?? document.body;
    for (const el of scope.querySelectorAll("button, a[href], input, select, textarea, label")) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === "hidden" || cs.display === "none" || el.closest(".hidden, [hidden], .sr-only, table")) continue;
      if (r.left < -1 || r.right > vw + 1) clipped.push(`${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.textContent || el.id || "").trim().slice(0, 28)}`);
    }
    return { overflowX: document.documentElement.scrollWidth - vw, clipped };
  });
  check(g.overflowX <= 0, `${tag}: no horizontal page overflow (${g.overflowX})`);
  check(g.clipped.length === 0, `${tag}: no control clipped outside the viewport ${g.clipped.slice(0, 3).join("; ")}`);
}
async function session({ role, meta = {}, w, h, theme, name }, fn) {
  const tag = `${name}-${theme}-${w}x${h}`;
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  await ctx.addInitScript(([t, sess, signedIn]) => { try { localStorage.setItem("e-lab:theme", t); if (signedIn) localStorage.setItem("sb-mock-elab-auth-token", JSON.stringify(sess)); } catch { /* ignore */ } }, [theme, sessionFor(role, meta), name !== "signup"]);
  const page = await ctx.newPage(); const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error" && !/Failed to load resource/.test(m.text())) errors.push(`console: ${m.text()}`); });
  const db = await installMock(page, role, meta);
  console.log(`\n== ${tag} ==`);
  const shot = (n) => page.screenshot({ path: `${out}/${tag}-${n}.png`, fullPage: true });
  try { await fn({ page, db, tag, shot }); } catch (e) { check(false, `${tag}: scenario threw ${e.message.split("\n")[0]}`); }
  check(errors.length === 0, `${tag}: no console/page errors ${errors.slice(0, 3).join(" | ")}`);
  await ctx.close();
}

try {
  for (const theme of ["light", "dark"]) for (const [w, h] of [[1366, 768], [390, 844]]) {
    // ---------------------------------------------------------------- sign-up
    for (const role of ["student", "teacher"]) {
      await session({ role, w, h, theme, name: `signup-${role}` }, async ({ page, db, tag, shot }) => {
        await goto(page, `/auth?tab=create-account&role=${role}`, theme);
        await page.waitForSelector('[data-testid="curriculum-field"]');
        const kind = role === "teacher" ? "checkbox" : "radio";
        check((await page.locator(`[data-testid="curriculum-field"] input[type=${kind}]`).count()) === 4, `${tag}: four ${kind}s (one per curriculum)`);
        check((await page.locator('[data-testid="curriculum-field"] input:checked').evaluateAll((l) => l.map((i) => i.dataset.curriculum))).join() === "ib-dp", `${tag}: IB Diploma preselected`);
        check(/Required\. IB Diploma \(DP\) is preselected so nobody is blocked/.test(await page.textContent('[data-testid="curriculum-help"]')), `${tag}: help text says required + preselected`);
        check(/Content planned/.test(await page.textContent('[data-testid="curriculum-field"]')), `${tag}: planned curricula are labelled honestly`);
        await geometry(page, `${tag} form`);
        const box = await page.locator("#su-curriculum-ib-dp").boundingBox(); check(box && box.width >= 14 && box.height >= 14, `${tag}: option controls are visible`);
        if (role === "teacher") await page.locator("label[for=su-curriculum-cambridge-igcse]").click();
        else await page.locator("label[for=su-curriculum-cambridge-as-a-level]").click();
        await page.locator("label[for=su-curriculum-other]").click();
        await page.fill("#su-curriculum-other-name", "Swiss Matura");
        await page.fill("#su-name", "Ada Lovelace"); await page.fill("#su-email", "ada@example.com");
        await page.fill("#su-password", "longenough1"); await page.fill("#su-confirm", "longenough1");
        await shot("0-filled"); await geometry(page, `${tag} filled`);
        await page.click('button[type="submit"]');
        await page.waitForSelector('[data-testid="signup-confirmation"]');
        const d = db.signUps[0]?.data ?? {};
        const want = role === "teacher" ? ["ib-dp", "cambridge-igcse", "other"] : ["other"];
        check(JSON.stringify(d.curricula) === JSON.stringify(want), `${tag}: signUp metadata curricula = ${JSON.stringify(d.curricula)}`);
        check(d.curriculum_other === "Swiss Matura" && /Other \(Swiss Matura\)/.test(d.curriculum), `${tag}: free-text name + readable curriculum text sent (${d.curriculum})`);
        check(d.role === role && d.full_name === "Ada Lovelace", `${tag}: role and name metadata unchanged`);
        check(await page.textContent("h1") === "Check your email", `${tag}: 'Check your email' flow intact`);
        await shot("1-confirmation");
      });
    }
    // ---------------------------------------------------------------- profiles
    for (const role of ["student", "teacher"]) {
      const meta = { curricula: ["ib-dp", "cambridge-igcse"], curriculum: "IB Diploma Programme, Cambridge IGCSE" };
      const m1 = role === "student" ? { curricula: ["cambridge-igcse"], curriculum: "Cambridge IGCSE" } : meta;
      await session({ role, meta: m1, w, h, theme, name: `profile-${role}` }, async ({ page, db, tag, shot }) => {
        await goto(page, `/${role}/profile`, theme);
        await page.waitForSelector('[data-testid="curriculum-chips"]');
        const chips = await page.$$eval('[data-testid="curriculum-chips"] li', (l) => l.map((e) => e.textContent.replace(/\s*\(content planned\)/, "").trim()));
        check(chips.join("|") === (role === "student" ? "IGCSE" : "IB DP|IGCSE"), `${tag}: chips ${chips.join("|")}`);
        await shot("0-view"); await geometry(page, `${tag} view`);
        await page.click('button:has-text("Edit Profile")'); await page.waitForSelector('[data-testid="curriculum-field"]');
        check((await page.locator(`[data-testid="curriculum-field"] input[type=${role === "teacher" ? "checkbox" : "radio"}]`).count()) === 4, `${tag}: editable control matches the role`);
        await shot("1-edit"); await geometry(page, `${tag} edit`);
        await page.locator("label[for=pc-curriculum-ib-dp]").click();
        await page.click('button:has-text("Save changes")'); await sleep(500);
        const upd = db.userUpdates.at(-1)?.data;
        check(upd && Array.isArray(upd.curricula) && upd.curricula.length >= 1, `${tag}: saved curricula to user metadata (${JSON.stringify(upd)})`);
        check(typeof db.profilePatches.at(-1)?.curriculum === "string", `${tag}: and the readable text to profiles.curriculum (${db.profilePatches.at(-1)?.curriculum})`);
      });
    }
    // ---------------------------------------------------------------- admin lock UI
    await session({ role: "admin", w, h, theme, name: "admin-simulations" }, async ({ page, db, tag, shot }) => {
      await goto(page, "/admin/simulations", theme);
      await page.waitForSelector("[data-sim-table]"); await sleep(500);
      check(await page.locator("select[id^=tier-]").count() === 0, `${tag}: Access-level dropdowns are gone`);
      const lock = page.locator("#lock-build-an-atom");
      check(await lock.getAttribute("aria-pressed") === "false" && await lock.getAttribute("title") === "Lock for Premium", `${tag}: unlocked by default, tooltip 'Lock for Premium'`);
      check(/Locks only take effect when Premium is switched on/.test(await page.textContent('[data-testid="lock-help"]')), `${tag}: helper text`);
      await lock.scrollIntoViewIfNeeded(); const b = await lock.boundingBox(); check(b && b.width >= 32 && b.height >= 32 && b.x >= 0 && b.x + b.width <= w, `${tag}: lock button >= 32px and inside the viewport`);
      await geometry(page, `${tag} list`); await shot("0-unlocked");
      await lock.click(); await sleep(500);
      check(db.simWrites.at(-1)?.tier === "premium" && db.simWrites.at(-1)?.sim_id === "build-an-atom", `${tag}: lock writes tier 'premium' (${JSON.stringify(db.simWrites.at(-1))})`);
      check(await lock.getAttribute("aria-pressed") === "true" && await lock.getAttribute("title") === "Unlock (free)", `${tag}: pressed + tooltip flips`);
      const colours = await lock.evaluate((el) => { const c = getComputedStyle(el); return [c.color, c.backgroundColor]; }); check(colours[0] !== colours[1], `${tag}: locked state is visually distinct (${colours.join(" on ")})`);
      await lock.focus(); await page.keyboard.press("Enter"); await sleep(400);
      check(await lock.getAttribute("aria-pressed") === "false" && db.simWrites.at(-1)?.tier === "free", `${tag}: keyboard (Enter) toggles it back to free`);
      await lock.click(); await sleep(400); await shot("1-locked");
    });
    await session({ role: "admin", w, h, theme, name: "admin-folders" }, async ({ page, db, tag, shot }) => {
      await goto(page, "/admin/folders", theme);
      await page.waitForSelector('[role=treeitem]'); await page.waitForFunction(() => !document.querySelector(".animate-spin"));
      await page.click('[role=treeitem][data-key="f-sm"] > div');
      await page.waitForSelector("#fd-lock");
      check(await page.locator("#fd-tier").count() === 0, `${tag}: Access dropdown is gone`);
      check(await page.getAttribute("#fd-lock", "aria-pressed") === "true", `${tag}: locked folder shows pressed`);
      check(/Everything inside/.test(await page.textContent('[data-testid="lock-inherit"]')), `${tag}: says contents inherit the lock`);
      await page.click('[role=treeitem][data-key="f-chem"] > div');
      check(await page.getAttribute("#fd-lock", "aria-pressed") === "false", `${tag}: sub-folder's own toggle is unlocked`);
      check(await page.locator('[data-testid="locked-via-folder"]').count() >= 1, `${tag}: tree shows 'via folder' indicator on inherited sub-folders`);
      check(/Locked via folder "Study Materials"/.test(await page.textContent('[data-testid="lock-inherit"]')), `${tag}: details say 'Locked via folder "Study Materials"'`);
      const lb = await page.locator("#fd-lock").boundingBox(); check(lb && lb.width >= 32 && lb.height >= 32 && lb.x >= 0 && lb.x + lb.width <= w, `${tag}: lock button >= 32px and inside the viewport`);
      await geometry(page, `${tag} details`); await shot("0-inherited");
      await page.click("#fd-lock"); await sleep(400);
      check(db.folderPatches.at(-1)?.access_tier === "premium", `${tag}: lock writes access_tier 'premium' (${JSON.stringify(db.folderPatches.at(-1))})`);
      await shot("1-locked-child");
    });
  }
} finally {
  await browser.close(); server.kill(); fs.rmSync(dist, { recursive: true, force: true });
}
console.log(`\n${checks - bad.length}/${checks} checks passed. Screenshots: ${out}`);
if (bad.length) { console.log("FAILURES:\n - " + bad.join("\n - ")); process.exitCode = 1; }
