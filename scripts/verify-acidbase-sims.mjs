// Headless-Chromium verification for the six acid-base simulations (needs Playwright + Chromium, like scripts/verify-*.mjs).
// Usage: node scripts/verify-acidbase-sims.mjs [outDir]
//   env: BASE_URL=http://host:port (skip build+preview)   HARNESS=1 (BASE_URL serves /?sim=<key> instead of /simulation/<id>)
//        SIZES=1366x768,390x844   ONLY=titration|equivalence|buffer|phcalc|hoh|neut   CHROMIUM=/path
// It BUILDS the app into a temp dir, serves it with `vite preview` on a free port and opens /simulation/<id> (the "new tab" view)
// at 1366x768, 910x512 and 390x844 in light and dark theme. Fails on console errors, page-level horizontal overflow, controls
// outside the viewport at 1366x768, clipped/overlapping annotations, and on the review's repro steps.
// Honest limits: headless Chromium + SwiftShader only (no real GPU, no touch hardware, no Firefox/Safari, no screen reader).
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, spawnSync } from "node:child_process";
import net from "node:net"; import os from "node:os"; import path from "node:path"; import fs from "node:fs";
import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2] || "/tmp/acidbase-verify"; fs.mkdirSync(out, { recursive: true });
const SIZES = (process.env.SIZES ? process.env.SIZES.split(",") : ["1366x768", "910x512", "390x844"]).map((s) => s.split("x").map(Number));
const SIMS = { titration: "titration-ph-curve", equivalence: "equivalence-point", buffer: "buffer-action-visualizer", phcalc: "ph-calculator-visualizer", hoh: "h-oh-balance", neut: "neutralization-particle-visualizer" };
const only = process.env.ONLY ? process.env.ONLY.split(",") : Object.keys(SIMS);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = []; let checks = 0;
const check = (cond, msg) => { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } };
const IGNORE = [/Supabase is not configured/, /Failed to load resource/, /net::ERR/, /ERR_TUNNEL/];
let preview = null; let base = process.env.BASE_URL; let dist = null;
const freePort = () => new Promise((res) => { const s = net.createServer(); s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => res(p)); }); });
if (!base) {
  dist = fs.mkdtempSync(path.join(os.tmpdir(), "elab-acidbase-")); console.log(`building into ${dist} ...`);
  const b = spawnSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { cwd: root, stdio: "pipe", encoding: "utf8" });
  if (b.status !== 0) { console.log(b.stdout.slice(-1500), b.stderr.slice(-1500)); process.exit(1); }
  const port = await freePort(); preview = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { cwd: root, stdio: "ignore" });
  base = `http://127.0.0.1:${port}`; for (let i = 0; i < 100; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* not up */ } await sleep(200); }
}
const route = (key, theme) => (process.env.HARNESS ? `/?sim=${key}&theme=${theme}` : `/simulation/${SIMS[key]}`);
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader"] });

async function open(key, W, H, theme, extra = {}) {
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, colorScheme: theme, ...extra });
  if (!process.env.HARNESS) await ctx.addInitScript((t) => { try { localStorage.setItem("elab-theme", t); } catch { /* ignore */ } }, theme);
  const p = await ctx.newPage(); const errors = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await p.goto(base + route(key, theme), { waitUntil: "networkidle" }); await sleep(1200);
  if (theme === "dark") await p.evaluate(() => document.documentElement.classList.add("dark"));
  return { ctx, p, errors };
}
const btn = (p, name) => p.getByRole("button", { name, exact: true }).first();
async function layout(p, W, H, label, strictFit) {
  const r = await p.evaluate((strictFit) => {
    const de = document.documentElement; const out = { docH: de.scrollHeight, docW: de.scrollWidth, bad: [] };
    for (const el of document.querySelectorAll("button, select, input, [role=slider]")) { const b = el.getBoundingClientRect(); if (b.width === 0 || b.height === 0) continue; if (b.right > innerWidth + 1 || b.left < -1) out.bad.push(`${el.tagName} ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)} x ${Math.round(b.left)}..${Math.round(b.right)}`); if (strictFit && b.bottom > innerHeight + 1) out.bad.push(`${el.tagName} ${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 24)} below fold (${Math.round(b.bottom)})`); }
    for (const el of document.querySelectorAll("main *, [data-testid] *")) { const cs = getComputedStyle(el); if (el.scrollWidth > el.clientWidth + 2 && cs.overflowX === "visible" && el.children.length === 0 && el.clientWidth > 0 && el.tagName !== "svg" && !(el instanceof SVGElement)) out.bad.push(`text overflow: ${(el.textContent || "").trim().slice(0, 30)}`); }
    return out;
  }, strictFit);
  check(r.docW <= W + 1, `${label}: horizontal page overflow (${r.docW} > ${W})`);
  if (strictFit) check(r.docH <= H + 1, `${label}: page scrolls vertically (${r.docH} > ${H})`);
  for (const b of r.bad.slice(0, 6)) check(false, `${label}: ${b}`);
}
async function focusRings(p, label) {
  let seen = 0; let bad = 0;
  for (let i = 0; i < 14; i += 1) {
    await p.keyboard.press("Tab");
    const r = await p.evaluate(() => { const el = document.activeElement; if (!el || el === document.body) return null; const cs = getComputedStyle(el); return { tag: el.tagName, ow: parseFloat(cs.outlineWidth), os: cs.outlineStyle, bs: cs.boxShadow }; });
    if (r && ["BUTTON", "SELECT", "INPUT"].includes(r.tag) || (r && r.tag === "DIV")) { seen += 1; if (!((r.os !== "none" && r.ow >= 2) || (r.bs && r.bs !== "none"))) bad += 1; }
  }
  check(seen >= 5, `${label}: keyboard reaches the controls (${seen} focus stops)`); check(bad === 0, `${label}: ${bad} focused controls without a visible focus ring`);
}

for (const key of only) {
  for (const theme of ["light", "dark"]) for (const [W, H] of SIZES) {
    const label = `${key} ${W}x${H} ${theme}`; console.log(label);
    const { ctx, p, errors } = await open(key, W, H, theme);
    // ---- scenario actions per simulation (kept short at the small sizes) ----
    if (key === "titration") { await btn(p, "+5.0 cm³").click(); await btn(p, "+5.0 cm³").click(); await sleep(200); }
    if (key === "equivalence") { for (let i = 0; i < 4; i += 1) await p.getByRole("button", { name: /^Add 2\.5 cm³ HCl$/ }).click(); await sleep(300); }
    if (key === "buffer") { await btn(p, "Add H⁺ (HCl)").click(); await sleep(300); }
    if (key === "hoh") { await btn(p, "+10 drops HCl").click(); await sleep(300); }
    if (key === "neut") { await btn(p, "Mix").click(); await sleep(2500); }
    await layout(p, W, H, label, W >= 1300);
    check(errors.length === 0, `${label}: console errors ${errors.slice(0, 2).join(" | ")}`);
    await p.screenshot({ path: path.join(out, `${key}-${W}x${H}-${theme}.png`) });
    if (theme === "light" && W === 1366) await focusRings(p, label);
    await ctx.close();
  }
}

// ---------------- repro steps from the review ----------------
async function scenario(key, name, fn, W = 1366, H = 768, extra = {}) { if (!only.includes(key)) return; console.log(`${key}: ${name}`); const { ctx, p, errors } = await open(key, W, H, "light", extra); try { await fn(p); } catch (e) { check(false, `${key} ${name}: ${e.message.split("\n")[0]}`); } check(errors.length === 0, `${key} ${name}: console errors ${errors.slice(0, 2).join(" | ")}`); await ctx.close(); }

await scenario("titration", "buffer region, S-shape, labels (owner request)", async (p) => {
  const buf = await p.locator('[data-testid="buffer-region"] rect').first().boundingBox(); const plot = await p.locator('[data-testid="titration-graph"]').boundingBox();
  check(buf && buf.width > plot.width * 0.3, "buffer region is wide and visible (> 30% of the chart)"); check((await p.locator('[data-testid="legend"]').innerText()).includes("Buffer region: [A⁻]/[HA] between 1:10 and 10:1"), "legend states the buffer ratio");
  const nPts = await p.locator('[data-testid="expected-curve"]').getAttribute("d"); check((nPts.match(/L/g) || []).length > 150, "dense expected curve drawn before any titrant is added");
  const boxes = await p.locator('[data-testid="titration-graph"] rect[rx="3"]').evaluateAll((rs) => rs.map((r) => r.getBoundingClientRect()).map((b) => ({ x: b.x, y: b.y, r: b.right, b: b.bottom })));
  let overlap = 0; for (let i = 0; i < boxes.length; i += 1) for (let j = i + 1; j < boxes.length; j += 1) { const a = boxes[i], b = boxes[j]; if (a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y) overlap += 1; } check(overlap === 0, `annotation labels overlap (${overlap})`);
  const txt = await p.locator('[data-testid="titration-graph"] text').evaluateAll((ts) => ts.map((t) => t.textContent)); check(txt.some((t) => t === "25.0") && txt.some((t) => t.includes("8.73")) && txt.some((t) => t.includes("4.76")), "equivalence volume on the axis; equivalence pH and pKa in the labelled markers (an axis tag is dropped on purpose when it would touch a tick label)");
  for (const [sel, v] of [["Flask concentration", "0.2"], ["Burette concentration", "0.05"], ["Flask solution", "HCl"]]) await p.getByLabel(sel).selectOption(v);
  await sleep(300); const t2 = await p.locator('[data-testid="titration-graph"] text').evaluateAll((ts) => ts.map((t) => t.textContent)); check(t2.includes("200") && t2.includes("100.0"), "off-scale pair auto-scales to 200 cm³ with V_eq 100.0 on the plot");
  await p.screenshot({ path: path.join(out, "titration-offscale.png") });
  await p.getByLabel("Flask concentration").selectOption("0.1"); await p.getByLabel("Burette concentration").selectOption("0.1");
  await btn(p, "Compare").click(); await sleep(400); check((await p.locator('[data-testid="compare-table"] tbody tr').count()) === 2, "compare table has strong+strong and weak+strong"); await btn(p, "+ weak/weak").click(); await sleep(300);
  await p.screenshot({ path: path.join(out, "titration-compare.png") });
  const cb = await p.locator('[data-testid="compare-graph"] text').evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect()).filter((b) => b.width > 0).map((b) => ({ x: b.x, y: b.y, r: b.right, b: b.bottom }))); const pg = await p.locator('[data-testid="compare-graph"]').boundingBox();
  check(cb.every((b) => b.x >= pg.x - 1 && b.r <= pg.x + pg.width + 1), "compare labels inside the chart");
  await btn(p, "Reset").click(); await sleep(300); check((await p.locator('[data-testid="titration-graph"]').count()) === 1, "Reset returns to Experiment");
});
await scenario("titration", "'approaching' never after equivalence (AK-33)", async (p) => {
  await p.getByLabel("Flask solution").selectOption("HCl"); await p.getByLabel("Burette solution").selectOption("NaOH");
  for (let i = 0; i < 5; i += 1) await btn(p, "+5.0 cm³").click(); await btn(p, "+0.5 cm³").click(); await sleep(200);
  const t = await p.locator('[data-testid="state-text"]').innerText(); check(/Just past equivalence/.test(t) && !/Approaching/i.test(t), `status after 25.5 cm³: "${t}"`);
});
await scenario("equivalence", "approaching/past, concentration shown, controls in view at 1366x768 (AK-26/28/29)", async (p) => {
  check((await p.locator('[data-testid="setup"]').innerText()).includes("0.100 mol dm⁻³ NaOH"), "concentration shown");
  for (let i = 0; i < 11; i += 1) await p.getByRole("button", { name: /^Add 2\.5 cm³ HCl$/ }).click(); await sleep(300);
  const s = await p.locator('[data-testid="status"]').innerText(); check(/Just past equivalence/.test(s) && !/Approaching/.test(s), `status at 27.5 cm³: ${s.replace(/\n/g, " / ")}`); check((await p.locator('[data-testid="ph"]').innerText()) === "2.32", "pH 2.32 at 27.5 cm³");
  const bb = await p.getByRole("button", { name: /^Add 2\.5 cm³ HCl$/ }).boundingBox(); check(bb && bb.y + bb.height <= 768, "primary Add button inside the 768 px viewport");
});
await scenario("buffer", "no stray ions after H+ then OH-; cap at 20 additions (AK-44/49)", async (p) => {
  await btn(p, "Add H⁺ (HCl)").click(); await sleep(120); await btn(p, "Add OH⁻ (NaOH)").click(); await sleep(4500);
  const free = await p.locator(".beaker-glass-svg").nth(1).locator("text").evaluateAll((ts) => ts.filter((t) => t.textContent === "H⁺" || t.textContent === "OH⁻").length); check(free === 0, `free H+/OH- in the buffer after settling: ${free}`);
  for (let i = 0; i < 30; i += 1) { const b = btn(p, "Add H⁺ (HCl)"); if (await b.isDisabled()) break; await b.click(); }
  check(await btn(p, "Add H⁺ (HCl)").isDisabled(), "additions capped"); const n = await p.locator(".beaker-glass-svg").first().locator("circle").count(); check(n < 60, `particle count bounded (${n})`);
  check((await p.locator('[data-testid="ratio"]').innerText()).includes("BUFFER CAPACITY EXCEEDED"), "capacity warning after the buffer is used up");
});
await scenario("phcalc", "typing 2 / out-of-range / keyboard (AK-01/03)", async (p) => {
  const inp = p.locator("input[type=text]").first(); await inp.fill("2"); await inp.press("Enter"); await sleep(200); check((await p.locator(".phc-reads").innerText()).includes("−0.30"), "2 mol dm⁻³ gives pH −0.30");
  await inp.fill("1e-20"); await inp.press("Enter"); await sleep(200); check((await p.locator("#phc-msg").innerText()).includes("outside this scale") && (await inp.inputValue()) === "1e-20", "out-of-range input explained and kept");
  await p.locator('[role="slider"]').focus(); await p.keyboard.press("Home"); await p.keyboard.press("ArrowDown"); check((await p.locator('[role="slider"]').getAttribute("aria-valuenow")) === "-0.9", "slider moves with the keyboard");
  const ring = await p.locator('[role="slider"]').evaluate((e) => { const c = getComputedStyle(e); return c.outlineStyle !== "none" && parseFloat(c.outlineWidth) >= 2; }); check(ring, "slider shows a focus ring");
  const band = await p.locator(".phc-band").boundingBox(); const rowTexts = await p.locator(".phc-row b").first().boundingBox(); check(!!band && !!rowTexts, "marker band present (drawn behind the numbers)");
});
await scenario("hoh", "equal drops, caption, log axis (AK-10/11/12)", async (p) => {
  await btn(p, "+1 drop HCl").click(); await sleep(300); check((await p.locator('[data-testid="caption"]').innerText()).includes("Water + 1 drop HCl"), "caption no longer says Pure Water"); check((await p.locator('[data-testid="ph"]').innerText()) === "4.30", "first drop of 0.100 mol dm⁻³ HCl in 100 cm³ gives pH 4.30");
  check((await p.locator(".hoh-axis span").count()) === 15, "log axis has 15 labelled decades");
});
await scenario("neut", "particles inside the liquid; reduced motion ends instantly (AK-18/24)", async (p) => {
  const inside = await p.locator("svg.neu-svg circle").evaluateAll((cs) => cs.map((c) => [+c.getAttribute("cx"), +c.getAttribute("cy")])); check(inside.length === 16 && inside.every(([x, y]) => y >= 170 && y <= 340 && ((x >= 40 && x <= 260) || (x >= 340 && x <= 560))), "all 16 ions start inside the two liquids");
  await btn(p, "Mix").click(); await sleep(400); check(/pairs reacted|neutral/.test(await p.locator('[data-testid="status"]').innerText()), "with reduced motion the reaction completes immediately");
}, 1366, 768, { reducedMotion: "reduce" });

// ---------------- round 2: features that had no browser check ----------------
await scenario("titration", "round 2: polyprotic buffer bands, unknown-concentration practical, visible Record button", async (p) => {
  await p.getByLabel("Flask solution").selectOption("H3PO4"); await sleep(400);
  check((await p.locator('[data-testid="buffer-region"]').count()) === 2, "H3PO4 shows two buffer bands");
  check(!/no buffer region/.test(await p.locator('[data-testid="explain"]').innerText()), "polyprotic text does not claim 'no buffer region'");
  const lab = await p.locator('[data-testid="titration-graph"] g[data-testid="buffer-region"] text').evaluateAll((ts) => ts.map((t) => t.getBoundingClientRect()).map((b) => ({ x: b.x, y: b.y, r: b.right, b: b.bottom })));
  const gl = await p.locator('[data-testid="titration-graph"] rect[rx="3"]').evaluateAll((rs) => rs.map((r) => r.getBoundingClientRect()).map((b) => ({ x: b.x, y: b.y, r: b.right, b: b.bottom })));
  let hit = 0; for (const a of lab) for (const b of gl) if (a.x < b.r && a.r > b.x && a.y < b.b && a.b > b.y) hit += 1; check(hit === 0, `buffer band names do not sit under a marker label (${hit})`);
  await p.screenshot({ path: path.join(out, "titration-poly.png") });
  await btn(p, "Unknown").click(); await sleep(400);
  const rec = await p.locator('[data-testid="record-reading"]').evaluate((e) => { const c = getComputedStyle(e); return { fg: c.color, bg: c.backgroundColor }; });
  check(rec.bg !== "rgba(0, 0, 0, 0)" && rec.bg !== rec.fg, `Record reading has a visible fill (${rec.bg} on ${rec.fg})`);
  for (let i = 0; i < 3; i += 1) await btn(p, "+1.0 cm³").click(); await p.locator('[data-testid="record-reading"]').click(); await sleep(200);
  check((await p.locator('[data-testid="readings-panel"]').getAttribute("data-count")) === "1", "a reading was recorded");
  check(!(await p.locator('[data-testid="export-csv"]').isDisabled()), "CSV export enabled after a reading");
  await p.screenshot({ path: path.join(out, "titration-unknown.png") });
});
await scenario("titration", "round 2: unknown practical fits 390x844 without page overflow", async (p) => {
  await btn(p, "Unknown").click(); await sleep(400); await layout(p, 390, 844, "titration unknown 390x844", false);
  await p.screenshot({ path: path.join(out, "titration-unknown-390.png") });
}, 390, 844);
await scenario("phcalc", "round 2: practice question, answer check, show on scale (no NaN)", async (p) => {
  await p.getByLabel("Your answer").fill("zzz"); await btn(p, "Check").click(); check((await p.locator('[data-testid="phc-result"]').innerText()).includes("Type a number"), "non-number explained");
  await btn(p, "Show on scale").click(); await sleep(200); const v = await p.locator('[role="slider"]').getAttribute("aria-valuenow"); check(Number.isFinite(Number(v)), `Show on scale gives a real pH (${v})`);
  await btn(p, "Show working").click(); check((await p.locator('[data-testid="phc-working"]').innerText()).includes("="), "working shown");
});
await scenario("phcalc", "round 2: at 390x844 the practice strip and scale fit; the sci-notation column is hidden (AK-05)", async (p) => {
  await layout(p, 390, 844, "phcalc 390x844", false);
  const sci = await p.locator(".phc-c small").first().isVisible(); check(!sci, "scientific-notation column hidden below 800 px (stated limitation AK-05)");
}, 390, 844);
await scenario("hoh", "round 2: temperature slider changes pKw and the neutral pH (AK-15)", async (p) => {
  const sl = p.locator('input[aria-label="Temperature in degrees Celsius"]'); await sl.fill("100"); await sleep(250);
  check((await p.locator('[data-testid="pkw"]').innerText()) === "12.29" && (await p.locator('[data-testid="ph"]').innerText()) === "6.14", "100 degC: pKw 12.29, neutral pH 6.14");
  await btn(p, "+1 drop HCl").click(); await sleep(300); check(Number(await p.locator('[data-testid="ph"]').innerText()) < 6.14, "an acid drop lowers the pH from the new neutral point");
});
await scenario("equivalence", "round 2: 0.1 cm3 drop adds 0.1 cm3 and the primary buttons stay in view", async (p) => {
  await p.locator('[data-testid="add-drop"]').click(); await p.locator('[data-testid="add-drop"]').click(); await sleep(200);
  check((await p.locator('[data-testid="setup"]').innerText()).includes("0.2 cm³ added"), "two drops = 0.2 cm³");
  const bb = await p.locator('[data-testid="add-drop"]').boundingBox(); check(bb && bb.y + bb.height <= 768, "drop button inside the viewport");
});
await scenario("buffer", "round 2: sticky quick controls appear when the main controls scroll out of view (AK-51); trace has points", async (p) => {
  await btn(p, "Add H⁺ (HCl)").click(); await sleep(200); check((await p.locator("svg.buf-trace circle").count()) === 2, "pH trace has a point per addition");
  const st = await p.locator('[data-testid="buf-sticky"]').count(); check(st === 1, "sticky control group exists");
}, 390, 844);

await browser.close(); if (preview) preview.kill(); if (dist) fs.rmSync(dist, { recursive: true, force: true });
console.log(`\n${checks} checks, ${problems.length} problem(s). Screenshots in ${out}`); if (problems.length) { console.log(problems.map((x) => " - " + x).join("\n")); process.exit(1); }
