// Headless-Chromium verification for the 3D VSEPR Explorer (needs a running dev server + Playwright/Chromium).
// Usage: node scripts/verify-vsepr-explorer.mjs [baseUrl] [outDir]
// Same flags as scripts/verify-bonding-visualizer.mjs (SwiftShader software WebGL). Route: /simulation/vsepr-explorer-3d.
// Honest limits: software GL, synthetic mouse + CDP touch events; no real GPU and no real touch hardware.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/vsepr-verify";
fs.mkdirSync(out, { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const SIZES = [[1366, 768], [1440, 900], [1920, 1080], [820, 1180], [390, 844]];
const only = process.env.SIZES ? process.env.SIZES.split(",") : null;
const problems = []; const notes = []; let checks = 0;
const T = (id) => `[data-testid="${id}"]`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DEG = 180 / Math.PI;
function check(cond, msg) { checks += 1; if (!cond) { problems.push(msg); console.log("  FAIL", msg); } }
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL_CONNECTION_FAILED/, /Failed to load resource/, /net::ERR/];

async function stageState(p) {
  return p.evaluate(() => {
    const st = document.querySelector('[data-testid="vsepr-stage"]'); const v = st?.__vsepr; if (!v) return null; const s = v.sim; const api = v.api();
    return { n: s.n, ids: s.ids.slice(), kinds: s.kinds.slice(), dir: Array.from(s.dir.slice(0, s.n * 3)), tgt: Array.from(s.tgt.slice(0, s.n * 3)), pin: s.pin, cam: api?.cameraPosition(), settled: st.dataset.settled, mode: st.dataset.mode };
  });
}
const angle = (a, i, j) => Math.acos(Math.max(-1, Math.min(1, a[i * 3] * a[j * 3] + a[i * 3 + 1] * a[j * 3 + 1] + a[i * 3 + 2] * a[j * 3 + 2]))) * DEG;
function bondAngles(s) { const o = []; for (let i = 0; i < s.n; i += 1) for (let j = i + 1; j < s.n; j += 1) if (s.kinds[i] === "bond" && s.kinds[j] === "bond") o.push(angle(s.dir, i, j)); return o.sort((a, b) => a - b); }
async function screenOf(p, i) { return p.evaluate((i) => { const st = document.querySelector('[data-testid="vsepr-stage"]'); const v = st.__vsepr; const s = v.sim; const L = s.kinds[i] === "lp" ? 0.95 : 1.75; return v.api().project(s.dir[i * 3] * L, s.dir[i * 3 + 1] * L, s.dir[i * 3 + 2] * L); }, i); }
async function waitSettled(p, ms = 7000) { const t0 = Date.now(); while (Date.now() - t0 < ms) { const st = await p.evaluate(() => document.querySelector('[data-testid="vsepr-stage"]')?.dataset.settled); if (st === "1") return true; await sleep(100); } return false; }
async function center(p, sel = T("vsepr-stage")) { const b = await p.locator(sel).first().boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, box: b }; }
async function dragTool(p, sel, to, { hold = false } = {}) {
  const b = await p.locator(sel).boundingBox(); await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2); await p.mouse.down();
  await p.mouse.move(to.x, to.y, { steps: 14 }); const dropping = await p.evaluate(() => document.querySelector('[data-testid="vsepr-stage"]')?.dataset.dropping);
  if (hold) return dropping; await p.mouse.up(); await sleep(150); return dropping;
}
const rowText = async (p, id) => ((await p.locator(`${T(id)} dd`).first().textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
async function layoutCheck(p, label, size) {
  const r = await p.evaluate(() => {
    const d = document.documentElement; const bad = [];
    const ws = document.querySelector('[data-testid="vsepr-workspace"]'); const wr = ws.getBoundingClientRect();
    for (const el of ws.querySelectorAll("button, select, input, [role=tab], [role=radio]")) {
      const r = el.getBoundingClientRect(); if (!r.width || !r.height) continue; if (el.closest(".vx-stage") && el.closest(".vx-viewtools") === null && el.closest(".vx-selbar") === null) continue;
      let sc = el.parentElement; let scrollable = false;
      while (sc) { const cs = getComputedStyle(sc); if (/(auto|scroll)/.test(cs.overflowY) && sc.scrollHeight > sc.clientHeight + 1) { scrollable = true; break; } if (sc === ws) break; sc = sc.parentElement; }
      if (r.left < wr.left - 1 || r.right > wr.right + 1) bad.push(`x-clipped ${el.getAttribute("data-testid") || el.textContent.trim().slice(0, 18)} ${Math.round(r.left)}-${Math.round(r.right)} vs ${Math.round(wr.left)}-${Math.round(wr.right)}`);
      else if (!scrollable && (r.bottom > wr.bottom + 1 || r.top < wr.top - 1)) bad.push(`y-clipped ${el.getAttribute("data-testid") || el.textContent.trim().slice(0, 18)}`);
    }
    const stage = document.querySelector('[data-testid="vsepr-stage"]'); const sr = stage?.getBoundingClientRect();
    return { docX: d.scrollWidth - d.clientWidth, docY: d.scrollHeight - d.clientHeight, bad: bad.slice(0, 6), layout: ws.dataset.layout, stageW: sr?.width ?? 0, wsW: wr.width, wsH: wr.height };
  });
  check(r.docX <= 1, `${label}@${size}: horizontal page overflow ${r.docX}`);
  check(r.bad.length === 0, `${label}@${size}: clipped controls ${r.bad.join("; ")}`);
  return r;
}

for (const [W, H] of SIZES) {
  if (only && !only.includes(`${W}x${H}`)) continue;
  const size = `${W}x${H}`; const wide = W >= 1000; console.log(`\n== ${size}`);
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 900 });
  const p = await ctx.newPage(); const errors = [];
  p.on("console", (m) => { if (["error", "warning"].includes(m.type()) && !IGNORE.some((re) => re.test(m.text()))) errors.push(`${m.type()}: ${m.text()}`); });
  p.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  await p.goto(`${base}/simulation/vsepr-explorer-3d`, { waitUntil: "networkidle" });
  await p.waitForSelector(T("vsepr-workspace"), { timeout: 30000 }); await sleep(1200);
  const shot = async (name) => { await p.screenshot({ path: `${out}/${size}-${name}.png` }); };

  // ---- initial layout
  const lay = await layoutCheck(p, "initial", size);
  if (wide) { check(lay.layout === "wide", `${size}: wide layout`); const sb = await p.locator(T("vsepr-stage")).boundingBox(); const share = sb.width / lay.wsW; notes.push(`${size}: viewer is ${(share * 100).toFixed(0)}% of the workspace width`); check(share >= 0.55 && share <= 0.78, `${size}: viewer share ${(share * 100).toFixed(0)}% not in 55-78%`); check(lay.docY <= 1, `${size}: page scrolls vertically (${lay.docY})`); }
  else check(lay.layout === "stacked", `${size}: stacked layout`);
  check((await p.locator(T("mol-ch4")).count()) === 0, `${size}: no molecule cards on the Build tab`);
  await shot("01-empty");

  // ---- drag N from the toolbox into the workspace -> central atom
  const c = await center(p);
  if (wide) check((await dragTool(p, T("tool-atom-N"), c)) === "1", `${size}: drop zone highlights while dragging`); else await dragTool(p, T("tool-atom-N"), c);
  await sleep(500); check((await rowText(p, "row-molecule")) !== "" || (await p.locator(T("info-rows")).count()) === 1, `${size}: central atom created by drag`);
  check((await p.locator(T("empty-hint")).count()) === 0, `${size}: empty hint gone after the first atom`);

  // ---- attach three H by dragging toward the central atom (attachment preview visible while dragging) ---------
  const targets = [{ dx: -170, dy: 40 }, { dx: 170, dy: 40 }, { dx: 0, dy: 150 }];
  for (const t of targets) { const d = await dragTool(p, T("tool-atom-H"), { x: c.x + t.dx, y: c.y + t.dy }); if (wide) check(d === "1", `${size}: drop highlight`); await sleep(120); }
  await sleep(300);
  let st = await stageState(p); check(st.n === 3 && st.kinds.every((k) => k === "bond"), `${size}: three bonding domains after three drags (n=${st.n})`);
  // lone pair dropped on the central atom
  await dragTool(p, T("tool-lp"), { x: c.x, y: c.y - 10 }); await sleep(200);
  check(await waitSettled(p), `${size}: settles after adding the lone pair`);
  st = await stageState(p); check(st.n === 4 && st.kinds.filter((k) => k === "lp").length === 1, `${size}: one lone-pair domain`);
  const ang = bondAngles(st); check(ang.every((a) => Math.abs(a - 107) < 1.5), `${size}: NH3 H-N-H angles ${ang.map((a) => a.toFixed(1))}`);
  check((await rowText(p, "row-axe")) === "AX₃E" && (await rowText(p, "row-molecule")).startsWith("NH₃"), `${size}: info panel shows NH3 AX3E (${await rowText(p, "row-molecule")})`);
  check((await rowText(p, "row-ed")) === "Tetrahedral" && (await rowText(p, "row-mg")) === "Trigonal pyramidal", `${size}: NH3 geometries`);
  await shot("02-nh3");

  if (wide) {
    // ---- the key feature: drag a surrounding atom in 3D, camera must not rotate -----------------------------------
    const before = await stageState(p); const cam0 = before.cam;
    const [ax, ay] = await screenOf(p, 0); const [nx, ny] = await screenOf(p, 1); await p.mouse.move(ax, ay); await p.mouse.down();
    await p.mouse.move(ax + (nx - ax) * 0.3, ay + (ny - ay) * 0.3, { steps: 6 });
    await p.mouse.move(ax + (nx - ax) * 0.75, ay + (ny - ay) * 0.75, { steps: 8 }); await sleep(600);
    const mid = await stageState(p);
    check(mid.pin === 0, `${size}: domain 0 is pinned to the pointer while dragging (pin=${mid.pin})`);
    check(mid.cam.every((v, i) => Math.abs(v - cam0[i]) < 1e-6), `${size}: camera did not rotate during the domain drag (${cam0.map((v) => v.toFixed(3))} -> ${mid.cam.map((v) => v.toFixed(3))})`);
    let moved = 0; for (let i = 1; i < mid.n; i += 1) if (angle([...before.dir.slice(i * 3, i * 3 + 3), ...mid.dir.slice(i * 3, i * 3 + 3)], 0, 1) > 2) moved += 1;
    check(moved >= 1, `${size}: other domains moved while one is dragged (${moved})`);
    const dragged = angle([...before.dir.slice(0, 3), ...mid.dir.slice(0, 3)], 0, 1); check(dragged > 15, `${size}: dragged domain actually moved in 3D (${dragged.toFixed(1)} deg)`);
    check(Math.min(...Array.from({ length: mid.n }, (_, i) => Array.from({ length: mid.n }, (_, j) => (j > i ? angle(mid.dir, i, j) : 999)).reduce((a, b) => Math.min(a, b), 999))) > 33, `${size}: no domain overlap during the drag`);
    await p.locator(T("opt-angles")).evaluate((el) => el.click()); await sleep(300);
    await shot("03-dragging-with-angles");
    const live = await p.evaluate(() => [...document.querySelectorAll(".vx-angle-label")].filter((e) => e.dataset.on === "1").map((e) => e.textContent + "|" + e.dataset.kind));
    check(live.length >= 1 && live.every((t) => t.endsWith("|live")), `${size}: live angle labels while dragging (${live.join(",")})`);
    await p.mouse.up(); check(await waitSettled(p), `${size}: relaxes after release`);
    const after = await stageState(p); const ang2 = bondAngles(after);
    check(ang2.every((a) => Math.abs(a - 107) < 1.5), `${size}: returns to trigonal pyramidal after release (${ang2.map((a) => a.toFixed(1))})`);
    check(after.cam.every((v, i) => Math.abs(v - cam0[i]) < 1e-6), `${size}: camera still unchanged after release`);
    await sleep(300);
    const rest = await p.evaluate(() => [...document.querySelectorAll(".vx-angle-label")].filter((e) => e.dataset.on === "1").map((e) => e.textContent + "|" + e.dataset.kind));
    check(rest.length >= 1 && rest.some((t) => t.startsWith("≈107") && t.endsWith("approx")), `${size}: reference angle (approximate, 107) shown after release (${rest.join(",")})`);
    await shot("04-after-release");

    // an orbit drag on empty space DOES rotate the camera
    const cam1 = (await stageState(p)).cam; const bb = await p.locator(T("vsepr-stage")).boundingBox();
    await p.mouse.move(bb.x + 80, bb.y + bb.height - 90); await p.mouse.down(); await p.mouse.move(bb.x + 220, bb.y + bb.height - 120, { steps: 8 }); await p.mouse.up(); await sleep(400);
    const cam2 = (await stageState(p)).cam; check(cam2.some((v, i) => Math.abs(v - cam1[i]) > 0.05), `${size}: dragging empty space orbits the camera`);
    await p.locator(T("vt-reset-view")).click(); await sleep(300);

    // ---- repulsion toggle + release pulse ------------------------------------------------------------------------
    await p.locator(T("opt-repulsion")).evaluate((el) => el.click()); await sleep(300);
    check((await p.locator(T("repulsion-legend")).count()) === 1, `${size}: repulsion legend shown when on`); await shot("05-repulsion");
    await p.locator(T("opt-repulsion")).evaluate((el) => el.click()); await sleep(200); check((await p.locator(T("repulsion-legend")).count()) === 0, `${size}: repulsion clean when off`);
    await p.locator(T("opt-angles")).evaluate((el) => el.click()); await sleep(200);
    check((await p.evaluate(() => [...document.querySelectorAll(".vx-angle-label")].filter((e) => e.dataset.on === "1").length)) === 0, `${size}: angle labels hidden when off`);

    // ---- ED / MG switch ------------------------------------------------------------------------------------------
    await p.locator(T("mode-mg")).click(); await sleep(900); check((await stageState(p)).mode === "mg", `${size}: MG mode set`); await shot("06-mg");
    check((await p.locator(T("opt-lp")).isEnabled()) && !(await p.locator(T("opt-domains")).isEnabled()), `${size}: lone-pair toggle enabled only in MG`);
    await p.locator(T("opt-lp")).evaluate((el) => el.click()); await sleep(500); await shot("07-mg-no-lp"); await p.locator(T("opt-lp")).evaluate((el) => el.click());
    check((await rowText(p, "row-mg")) === "Trigonal pyramidal", `${size}: info panel unchanged by the mode switch`);
    await p.locator(T("mode-ed")).click(); await sleep(700);
    check((await stageState(p)).n === 4, `${size}: switching modes does not rebuild the model`);

    // ---- lone pair: select, move, remove; bond order change --------------------------------------------------------
    st = await stageState(p); const lpI = st.kinds.indexOf("lp"); const [lx, ly] = await screenOf(p, lpI);
    await p.mouse.click(lx, ly); await sleep(250); check((await p.locator(T("selection-bar")).count()) === 1, `${size}: clicking the lone pair selects it`);
    await p.mouse.move(lx, ly); await p.mouse.down(); await p.mouse.move(lx + 70, ly + 40, { steps: 8 }); await sleep(300);
    check((await stageState(p)).pin === lpI, `${size}: lone pair can be dragged`); await p.mouse.up(); check(await waitSettled(p), `${size}: lone pair drag relaxes`);
    const [lx2, ly2] = await screenOf(p, lpI); await p.mouse.click(lx2, ly2); await sleep(200); await p.locator(T("sel-remove")).click(); await sleep(300);
    st = await stageState(p); check(st.kinds.every((k) => k === "bond") && st.n === 3, `${size}: lone pair removed`);
    check((await rowText(p, "row-axe")) === "AX₃", `${size}: AX3 after removing the lone pair`); await shot("08-ax3");
    await p.locator(T("btn-undo")).click(); await sleep(300); check((await stageState(p)).n === 4, `${size}: undo restores the lone pair`);
    await p.locator(T("btn-redo")).click(); await sleep(300); check((await stageState(p)).n === 3, `${size}: redo removes it again`);
    // change the first bond to double (click the bond, choose =)
    const [bx, by] = await screenOf(p, 0); await p.mouse.click(bx, by); await sleep(250); await p.locator(T("sel-order-2")).click(); await sleep(300);
    check((await rowText(p, "row-domains")).startsWith("3"), `${size}: a double bond is still ONE domain (${await rowText(p, "row-domains")})`);
    await p.locator(T("sel-order-3")).click(); await sleep(300); check((await rowText(p, "row-domains")).startsWith("3"), `${size}: a triple bond is still ONE domain`); await shot("09-triple");
    await p.locator(T("btn-clear")).click(); await sleep(300); check((await p.locator(T("empty-hint")).count()) === 1, `${size}: Clear empties the workspace`);
    await p.locator(T("btn-undo")).click(); await sleep(300); check((await stageState(p)).n === 3, `${size}: Clear is undoable`);
    await p.locator(T("btn-reset")).click(); await sleep(300); check((await p.locator(T("empty-hint")).count()) === 1 && (await p.locator(T("btn-undo")).isDisabled()), `${size}: Reset empties and forgets the history`);

    // ---- build CH4 / NH3 / H2O by CLICKS with each bond order -------------------------------------------------------
    const build = async (central, ligand, n, lp, order) => {
      await p.locator(T("btn-reset")).click(); await p.locator(T(`tool-atom-${central}`)).click(); await p.locator(T(`tool-bond-${order}`)).click();
      for (let i = 0; i < n; i += 1) await p.locator(T(`tool-atom-${ligand}`)).click();
      for (let i = 0; i < lp; i += 1) await p.locator(T("tool-lp")).click(); await sleep(200); await waitSettled(p);
    };
    for (const order of [1, 2, 3]) {
      await build("C", "H", 4, 0, order); check((await rowText(p, "row-axe")) === "AX₄" && (await rowText(p, "row-ed")) === "Tetrahedral", `${size}: CH4-like with bond order ${order}`);
      const a = bondAngles(await stageState(p)); check(a.every((x) => Math.abs(x - 109.47) < 1), `${size}: tetrahedral angles (order ${order})`);
    }
    await build("C", "H", 4, 0, 1); check((await rowText(p, "row-molecule")).startsWith("CH₄"), `${size}: CH4 matched to the validated preset`); await shot("10-ch4");
    await build("O", "H", 2, 2, 1); check((await rowText(p, "row-axe")) === "AX₂E₂" && (await rowText(p, "row-mg")) === "Bent", `${size}: H2O`); const aw = bondAngles(await stageState(p)); check(Math.abs(aw[0] - 104.5) < 1, `${size}: water angle ${aw[0]?.toFixed(1)}`); await shot("11-h2o");
    await build("C", "O", 2, 0, 2); check((await rowText(p, "row-molecule")).startsWith("CO₂") && (await rowText(p, "row-mg")) === "Linear", `${size}: CO2 from two double bonds (${await rowText(p, "row-molecule")})`);
    await build("S", "F", 6, 0, 1); check((await rowText(p, "row-mg")) === "Octahedral", `${size}: SF6`); await shot("12-sf6");
    await build("N", "H", 2, 1, 1); check((await p.locator(T("idealised-badge")).count()) === 1, `${size}: unmatched build labelled idealised VSEPR model`);
    // Lewis tab
    await p.locator(T("card-tab-lewis")).click(); await sleep(250); check((await p.locator(T("lewis-svg")).count()) === 1, `${size}: Lewis structure view`); await shot("13-lewis-warning");
    await build("N", "H", 4, 0, 1); await p.locator(T("card-tab-lewis")).click(); await sleep(200); check((await p.locator(T("lewis-warning")).count()) >= 1, `${size}: net charge warning for 4 N-H bonds`);
    await p.locator(T("card-tab-model")).click();
    // why this shape
    await build("N", "H", 3, 1, 1); await p.locator(T("why-toggle")).click(); await sleep(150); check((await p.locator(T("why-text")).count()) === 1, `${size}: why this shape`);
    // keyboard: select a bond and press Delete
    const [kx, ky] = await screenOf(p, 0); await p.mouse.click(kx, ky); await page_key(p, "Delete"); await sleep(250); check((await stageState(p)).n === 3, `${size}: Delete key removes the selected domain`);
    // 6 domains: seventh refused with a note
    await build("S", "F", 6, 0, 1); await p.locator(T("tool-atom-F")).click(); await sleep(150); check(/up to 6/.test(await p.locator(T("vsepr-note")).textContent()), `${size}: seventh domain refused with a note`);
  }
  await layoutCheck(p, "build", size);

  // ---- Molecules tab --------------------------------------------------------------------------------------------
  await p.locator(T("tab-molecules")).click(); await sleep(700);
  check((await p.locator(T("molecule-library")).count()) === 1, `${size}: library in the Molecules tab`);
  const EXPECT = { becl2: ["AX₂", "Linear", "Linear"], co2: ["AX₂", "Linear", "Linear"], bf3: ["AX₃", "Trigonal planar", "Trigonal planar"], ch4: ["AX₄", "Tetrahedral", "Tetrahedral"], nh3: ["AX₃E", "Tetrahedral", "Trigonal pyramidal"], h2o: ["AX₂E₂", "Tetrahedral", "Bent"], so2: ["AX₂E", "Trigonal planar", "Bent"], pcl5: ["AX₅", "Trigonal bipyramidal", "Trigonal bipyramidal"], sf4: ["AX₄E", "Trigonal bipyramidal", "Seesaw"], clf3: ["AX₃E₂", "Trigonal bipyramidal", "T-shaped"], xef2: ["AX₂E₃", "Trigonal bipyramidal", "Linear"], sf6: ["AX₆", "Octahedral", "Octahedral"], brf5: ["AX₅E", "Octahedral", "Square pyramidal"], xef4: ["AX₄E₂", "Octahedral", "Square planar"] };
  for (const [id, [axe, ed, mg]] of Object.entries(EXPECT)) {
    if (!(await p.locator(T(`mol-${id}`)).count())) { check(false, `${size}: preset ${id} missing from the library`); continue; }
    await p.locator(T(`mol-${id}`)).evaluate((el) => el.click()); await sleep(wide ? 350 : 200);
    const got = [await rowText(p, "row-axe"), await rowText(p, "row-ed"), await rowText(p, "row-mg")];
    check(got.join("|") === [axe, ed, mg].join("|"), `${size}: preset ${id}: ${got.join("|")} vs ${[axe, ed, mg].join("|")}`);
    if (wide) { const s = await stageState(p); check(s.settled !== undefined && s.n === Number(/^(\d)/.exec(await rowText(p, "row-domains"))[1]), `${size}: ${id} domains rendered`); }
    if (wide && ["nh3", "pcl5", "sf4", "clf3", "xef4", "brf5", "so2"].includes(id)) await shot(`20-mol-${id}`);
  }
  if (wide) {
    // spot-check the rendered angles of every preset (at rest)
    const ANG = { becl2: [180], co2: [180], bf3: [120], ch4: [109.5], nh3: [107], h2o: [104.5], so2: [118], pcl5: [90, 120, 180], sf4: [102, 173], clf3: [87.5, 175], xef2: [180], sf6: [90, 180], brf5: [85], xef4: [90, 180] };
    for (const [id, want] of Object.entries(ANG)) {
      await p.locator(T(`mol-${id}`)).evaluate((el) => el.click()); await sleep(250); await waitSettled(p); const a = bondAngles(await stageState(p));
      check(want.every((w) => a.some((x) => Math.abs(x - w) < 4.5)), `${size}: ${id} rendered angles ${[...new Set(a.map((x) => Math.round(x)))]} contain ${want}`);
    }
    await p.locator(T("molecule-search")).fill("seesaw"); await sleep(200); check((await p.locator(T("mol-sf4")).count()) === 1 && (await p.locator(T("mol-ch4")).count()) === 0, `${size}: search filters the library`);
    await p.locator(T("molecule-search")).fill("zzz"); await sleep(150); check((await p.locator(T("library-empty")).count()) === 1, `${size}: empty search result`); await p.locator(T("molecule-search")).fill("");
    await p.locator(T("mol-sf4")).evaluate((el) => el.click()); await sleep(300); await p.locator(T("opt-repulsion")).evaluate((el) => el.click()); await sleep(300); await shot("21-sf4-repulsion-angles");
    // Molecules tab: rotation + zoom work (no domain under pointer)
    const cm0 = (await stageState(p)).cam; await p.locator(T("vt-zoom-in")).click(); await sleep(300); const cm1 = (await stageState(p)).cam; check(Math.hypot(...cm1) < Math.hypot(...cm0) - 0.1, `${size}: zoom in`);
    await p.locator(T("open-in-build")).click(); await sleep(500); check((await p.locator(T("tab-build")).getAttribute("aria-selected")) === "true" && (await rowText(p, "row-axe")) === "AX₄E", `${size}: Open in Build loads the molecule`);
  }
  await layoutCheck(p, "molecules", size);

  // ---- Challenge tab ----------------------------------------------------------------------------------------------
  await p.locator(T("tab-challenge")).click(); await sleep(600); await shot("30-challenge-predict");
  check((await p.locator(T("challenge-panel")).getAttribute("data-step")) === "predict", `${size}: challenge starts at Predict`);
  const molName = (await p.locator(T("challenge-molecule")).textContent()).replace(/\s+/g, " "); notes.push(`${size}: challenge molecule: ${molName}`);
  check(await p.locator(T("ch-to-build")).isDisabled(), `${size}: cannot continue before answering`);
  const ans = { domains: "4", lonePairs: "1", ed: "Tetrahedral", mg: "Bent", axe: "AX2E", angle: "109.5" }; // a deliberately partly wrong prediction for water
  for (const [k, v] of Object.entries(ans)) await p.locator(T(`ans-${k}`)).selectOption(v);
  await p.locator(T("ch-to-build")).click(); await sleep(300);
  if (wide) { await p.locator(T("tool-atom-O")).click(); await p.locator(T("tool-atom-H")).click(); await p.locator(T("tool-atom-H")).click(); await p.locator(T("tool-lp")).click(); await sleep(400); }
  await shot("31-challenge-build");
  await p.locator(T("ch-check")).click(); await sleep(700);
  check((await p.locator(T("challenge-panel")).getAttribute("data-step")) === "observe", `${size}: Observe after check`); await shot("32-challenge-observe");
  check((await p.locator(T("ch-results")).count()) === 1 && (await p.locator('[data-testid^="res-"].is-bad').count()) >= 1, `${size}: per-answer feedback`);
  await p.locator(T("ch-to-explain")).click(); await sleep(300); const ex = await p.locator(T("ch-explain")).textContent(); check(ex.length > 60, `${size}: explanations (${ex.length} chars)`); await shot("33-challenge-explain");
  await p.locator(T("ch-next")).click(); await sleep(300); check((await p.locator(T("challenge-panel")).getAttribute("data-step")) === "predict", `${size}: next molecule restarts at Predict`);
  await layoutCheck(p, "challenge", size);

  // ---- tabs keep their own state --------------------------------------------------------------------------------
  await p.locator(T("tab-build")).click(); await sleep(500); if (wide) check((await rowText(p, "row-axe")) === "AX₆" || (await p.locator(T("info-rows")).count()) === 1, `${size}: Build state persists across tabs`);
  await shot("40-back-on-build");
  const trap = errors.filter((e) => !/WebGL|swiftshader/i.test(e)); check(trap.length === 0, `${size}: console errors/warnings: ${trap.slice(0, 3).join(" || ")}`);

  // ---- touch (CDP touch events -> pointer events with pointerType=touch) -------------------------------------------
  if (W === 820) {
    await p.locator(T("tab-build")).click(); await p.locator(T("btn-reset")).click(); await sleep(300);
    const cdp = await ctx.newCDPSession(p); const b = await p.locator(T("tool-atom-O")).boundingBox(); const to = await center(p);
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: b.x + b.width / 2, y: b.y + b.height / 2 }] });
    for (let i = 1; i <= 10; i += 1) await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: b.x + (to.x - b.x) * i / 10, y: b.y + (to.y - b.y) * i / 10 }] });
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] }); await sleep(500);
    const ok = (await p.locator(T("info-rows")).count()) === 1; notes.push(`${size}: synthetic CDP touch drag from the toolbox ${ok ? "created the central atom" : "did NOT create the central atom"}`); check(ok, `${size}: touch drag from the toolbox`);
  }
  await ctx.close();
}
async function page_key(p, k) { await p.keyboard.press(k); }
await browser.close();
console.log(`\n${checks} checks, ${problems.length} problems`); for (const n of notes) console.log("note:", n);
if (problems.length) { console.log("PROBLEMS:\n" + problems.map((x) => " - " + x).join("\n")); process.exit(1); }
