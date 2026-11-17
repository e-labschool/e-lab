#!/usr/bin/env node
// Headless-Chromium verification of Mole Lab Stages 4, 5 and 6 (builds to a temp dir, serves it with vite preview on a free port).
// Usage: node scripts/verify-mole-lab-stage456.mjs [outDir] [--quick]
// Honest limits: software WebGL (SwiftShader, ~4 fps): layout, real mouse drags and conservation are checked; frame rate, GPU behaviour, touch hardware,
// Safari / Firefox and screen readers are NOT.  Screenshots are for a human (or reviewer) to LOOK at; this script checks numbers, not looks.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import { spawn, execFileSync } from "node:child_process";
import net from "node:net"; import fs from "node:fs"; import os from "node:os"; import path from "node:path";

const quick = process.argv.includes("--quick"); const out = process.argv.find((a, i) => i >= 2 && !a.startsWith("--")) || "/tmp/mole-lab-verify-456"; fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || ["/opt/pw-browsers/chromium-1243/chrome-linux64/chrome", "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"].find((p) => fs.existsSync(p));
const dist = fs.mkdtempSync(path.join(os.tmpdir(), "mole-lab-dist-"));
const freePort = () => new Promise((res) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => res(p)); }); });
const problems = []; const notes = []; const errors = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); console.log(`${ok ? "  ok  " : "  FAIL"} ${msg}`); };
console.log("building to", dist);
execFileSync("npx", ["vite", "build", "--outDir", dist, "--emptyOutDir"], { stdio: "ignore" });
const port = await freePort();
const srv = spawn("npx", ["vite", "preview", "--outDir", dist, "--port", String(port), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore" });
const base = `http://127.0.0.1:${port}`;
for (let i = 0; i < 60; i += 1) { try { if ((await fetch(base)).ok) break; } catch { /* waiting */ } await new Promise((r) => setTimeout(r, 500)); }
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });

async function open(w, h, theme = "light", touch = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, colorScheme: theme, hasTouch: touch });
  const p = await ctx.newPage(); p.setDefaultTimeout(60000);
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  p.on("console", (m) => { if (m.type() === "error" && !/Supabase|Failed to load resource|net::/.test(m.text())) errors.push(m.text().slice(0, 200)); });
  await p.addInitScript((t) => localStorage.setItem("e-lab:theme", t), theme);
  await p.goto(`${base}/simulation/mole-lab`); await p.waitForSelector('[data-testid="mole-lab"]', { timeout: 30000 }); await p.waitForTimeout(1200);
  return { ctx, p };
}
const ml = (p, fn, arg) => p.evaluate(([src, a]) => { const o = document.querySelector('[data-testid="mole-lab"]').__moleLab; return (new Function("o", "a", `return (${src})(o, a)`))(o, a); }, [fn.toString(), arg]);
const ledger = (p) => ml(p, (o) => { const s = o.getState(); const sc = s.scenes[s.stage]; const t = {}; for (const k of sc.packets) t[k.substanceId] = (t[k.substanceId] ?? 0) + k.q; for (const v of sc.vessels) for (const [id, q] of Object.entries(v.contents)) t[id] = (t[id] ?? 0) + q; return t; });
const invariants = (p) => p.evaluate(async () => { const o = document.querySelector('[data-testid="mole-lab"]').__moleLab; return o.getState().last; });
const dispatch = (p, a) => ml(p, (o, x) => o.dispatch(x).last, a);
const screen = (p, id) => ml(p, (o, a) => { const n = o.ix.bench.current.nodes.get(a); return n ? o.ix.bench.current.project(n.disp.x, 0.7, n.disp.z) : null; }, id);
const dragTo = async (p, from, to) => { await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2 - 20, { steps: 6 }); await p.mouse.move(to.x, to.y, { steps: 8 }); await p.waitForTimeout(250); await p.mouse.up(); };
const idle = (p) => p.waitForFunction(() => { const o = document.querySelector('[data-testid="mole-lab"]').__moleLab; return !o.ix.bench.current.pour; }, null, { timeout: 90000 }).then(() => p.waitForTimeout(200));
const same = (a, b) => JSON.stringify(Object.entries(a).filter(([, v]) => v).sort()) === JSON.stringify(Object.entries(b).filter(([, v]) => v).sort());

// ---- layout + screenshots ------------------------------------------------------------------------
const sizes = quick ? [[1366, 768, "light"]] : [[1366, 768, "light"], [1366, 768, "dark"], [910, 512, "light"], [390, 844, "dark"]];
for (const [w, h, theme] of sizes) {
  const { ctx, p } = await open(w, h, theme, w < 700);
  for (const stage of [4, 5, 6]) {
    await p.click(`[data-testid="ml-tab-${stage}"]`); await p.waitForTimeout(2500);
    const r = await p.evaluate(() => ({ hs: document.documentElement.scrollWidth - innerWidth, canvas: Boolean(document.querySelector('[data-testid="ml-bench"] canvas')), vp: document.querySelector('[data-testid="ml-viewport"]')?.getBoundingClientRect().height ?? 0 }));
    check(r.hs <= 1, `${w}x${h} ${theme} stage ${stage}: no horizontal page overflow`); check(r.canvas, `${w}x${h} ${theme} stage ${stage}: WebGL canvas present`); check(r.vp >= 180, `${w}x${h} ${theme} stage ${stage}: viewport at least 180px tall (${Math.round(r.vp)}px)`);
    await p.screenshot({ path: path.join(out, `s${stage}-${w}x${h}-${theme}.png`), timeout: 90000 });
  }
  await ctx.close();
}

// ---- stage 4: real mouse drags, hostile input, conservation ----------------------------------------
{
  const { ctx, p } = await open(1366, 768);
  await p.click('[data-testid="ml-tab-4"]'); await p.waitForTimeout(1500); await p.click("text=Free"); await p.waitForTimeout(500);
  let l0 = await ledger(p); const ok = async (label) => { check(same(await ledger(p), l0), `stage 4 conserved after: ${label}`); const inv = await invariants(p); void inv; };
  const id = await ml(p, (o) => o.getState().scenes[4].packets[0].id);
  const a = await screen(p, id); const chamber = await ml(p, (o) => { const n = o.ix.bench.current.nodes.get("chamber"); return n ? o.ix.bench.current.project(n.disp.x + 1.1, 0.7, n.disp.z) : null; });
  check(Boolean(a && chamber), "packet and chamber have screen positions");
  await dragTo(p, a, { x: 40, y: 40 }); await ok("drag a packet outside the viewport");
  await dragTo(p, a, chamber); await p.waitForTimeout(800); await ok("drop a CLOSED packet on the chamber (refused: zipper)");
  check(((await ledger(p)).O2 ?? 0) === 1e9, "closed packet: gas stays in the packet");
  await dispatch(p, { type: "packet/open", stage: 4, id });
  const a2 = await screen(p, id); await dragTo(p, a2, chamber); await idle(p); await ok("drag the open packet into the chamber");
  const inCh = await ml(p, (o) => o.getState().scenes[4].vessels[0].contents.O2 ?? 0); check(inCh === 1e9, `the dropped packet released 1 mol into the chamber (${inCh})`);
  for (let i = 0; i < 10; i += 1) await ml(p, (o, x) => o.ix.pour(x), id); await p.waitForTimeout(300); await ok("10x rapid release requests");
  await idle(p); await dispatch(p, { type: "s4/setAmount", stage: 4, value: "2" }); l0 = await ledger(p); const q = await ml(p, (o) => o.getState().scenes[4].packets.map((k) => k.id)); await dispatch(p, { type: "packet/open", stage: 4, id: q[0] });
  await ml(p, (o, x) => o.ix.pour(x), q[0]); await p.waitForTimeout(300); await p.keyboard.press("Escape"); await p.waitForTimeout(1500); await idle(p); await ok("release interrupted with Escape");
  for (const s of [5, 6, 1, 4]) { await p.click(`[data-testid="ml-tab-${s}"]`); await p.waitForTimeout(80); } await p.waitForTimeout(800); await ok("rapid stage switching (stage 4 amounts)");
  await dispatch(p, { type: "s4/setModel", stage: 4, model: "ideal" }); for (const t of ["abc", "-3", "0", "10", "1e9"]) await dispatch(p, { type: "s4/setTemperature", stage: 4, kelvin: t }); await ok("hostile temperature values");
  const vol = await ml(p, (o) => { const s = o.getState().scenes[4]; return s.data.tempK; }); check(vol >= 220 && vol <= 500, `temperature stays in range (${vol} K)`);
  await ctx.close();
}

// ---- stage 5: drag reactant packets into the zone, run, hostile clicks -------------------------------
{
  const { ctx, p } = await open(1366, 768);
  await p.click('[data-testid="ml-tab-5"]'); await p.waitForTimeout(1500); await p.click("text=Free"); await p.waitForTimeout(500);
  const l0 = await ledger(p); const atoms = async () => ml(p, (o) => { const s = o.getState(); return { inv: s.scenes[5].data.baseline }; });
  void atoms; const ok = async (label) => { const l = await ledger(p); const hasH2O = l.H2O ?? 0; const eq = (l.H2 ?? 0) * 2 + hasH2O * 2; const eq0 = (l0.H2 ?? 0) * 2; check(eq === eq0, `stage 5 hydrogen atoms conserved after: ${label}`); };
  const ids = await ml(p, (o) => o.getState().scenes[5].packets.map((k) => k.id)); const zonePt = () => ml(p, (o) => { const n = o.ix.bench.current.nodes.get("zone"); return o.ix.bench.current.project(n.disp.x + 2.0, 0.9, n.disp.z); }); // the camera re-frames when packets leave the bench, so re-project each time
  for (const id of ids) { await dispatch(p, { type: "packet/open", stage: 5, id }); const a = await screen(p, id); await p.waitForTimeout(1500); const a3 = await screen(p, id); await dragTo(p, a3, await zonePt()); await idle(p); await ok(`drag packet ${id} into the zone`); }
  const zq = await ml(p, (o) => o.getState().scenes[5].vessels[0].contents); check(zq.H2 === 2e9 && zq.O2 === 1e9, `all reactant packets are in the zone (${JSON.stringify(zq)})`);
  await idle(p); await dispatch(p, { type: "s5/run", stage: 5 }); for (let i = 0; i < 6; i += 1) await p.click('[data-testid="ml-run"]', { force: true }).catch(() => {}); await p.waitForTimeout(800); await ok("run + 6 repeated Run clicks");
  const run = await ml(p, (o) => o.getState().scenes[5].data.lastRun); check(run && run.afterQ.H2O === 2e9, "exactly 2 mol H2O formed (not duplicated by repeated clicks)");
  await p.click('[data-testid="ml-skip"]').catch(() => {}); await p.click('[data-testid="ml-replay"]').catch(() => {}); await p.waitForTimeout(600); await p.click('[data-testid="ml-tab-3"]'); await p.waitForTimeout(300); await p.click('[data-testid="ml-tab-5"]'); await p.waitForTimeout(1500); await ok("replay interrupted by switching tabs");
  await p.screenshot({ path: path.join(out, "s5-after-run.png"), timeout: 90000 });
  await ctx.close();
}

// ---- stage 6: examples, edge cases, mass inputs --------------------------------------------------
{
  const { ctx, p } = await open(1366, 768);
  await p.click('[data-testid="ml-tab-6"]'); await p.waitForTimeout(1500); await p.click("text=Free"); await p.waitForTimeout(500);
  const runOf = () => ml(p, (o) => o.getState().scenes[6].data.lastRun);
  const cases = [["water-synthesis", { H2: "3", O2: "1" }, { H2: 1e9, O2: 0, H2O: 2e9 }, "3 H2 + 1 O2"], ["water-synthesis", { H2: "4", O2: "2" }, { H2: 0, O2: 0, H2O: 4e9 }, "tied 4 H2 + 2 O2"],
    ["sodium-water", { Na: "3", H2O: "2" }, { Na: 1e9, H2O: 0, NaOH_aq: 2e9, H2: 1e9 }, "3 Na + 2 H2O"], ["water-synthesis", { H2: "0.25", O2: "100" }, { H2: 0, O2: 99875000000, H2O: 250000000 }, "fractional 0.25 H2 + 100 O2"]];
  for (const [rx, amts, want, label] of cases) {
    await dispatch(p, { type: "s6/selectReaction", stage: 6, reactionId: rx }); for (const [k, v] of Object.entries(amts)) await dispatch(p, { type: "s6/setAmount", stage: 6, substanceId: k, value: v });
    await dispatch(p, { type: "s6/run", stage: 6 }); await p.waitForTimeout(300); const r = await runOf(); const got = r?.afterQ ?? {};
    check(Object.entries(want).every(([k, v]) => (got[k] ?? 0) === v), `${label} -> ${JSON.stringify(got)}`);
    check(Object.values(got).every((v) => v >= 0 && Number.isInteger(v)), `${label}: no negative or fractional-quanta amounts`);
  }
  const l = await dispatch(p, { type: "s6/setAmount", stage: 6, substanceId: "H2", value: "0" }); await dispatch(p, { type: "s6/setAmount", stage: 6, substanceId: "O2", value: "0" }); const r0 = await dispatch(p, { type: "s6/run", stage: 6 }); check(r0.ok === false, "zero reactants: refused"); void l;
  await p.screenshot({ path: path.join(out, "s6-after.png"), timeout: 90000 });
  await ctx.close();
}

check(errors.length === 0, `no console/page errors (${errors.length}${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""})`);
await browser.close(); srv.kill(); fs.rmSync(dist, { recursive: true, force: true });
console.log("\nnotes:\n  " + notes.join("\n  ")); console.log(`screenshots: ${out}`);
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed"); process.exit(problems.length ? 1 : 0);
