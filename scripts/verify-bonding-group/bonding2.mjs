// Bonding Visualizer round 2 (covalent recognition + formation) in headless Chromium.
//   node scripts/verify-bonding-group.mjs   with SIMS=bonding2   (SIZES=..., SHOTS=... as for the other modules; COMPS=H2,CO2 to pick compositions)
// Per size x light/dark: the owner's C + 2 O case with the real animation, the outer-shell checkbox, 21 compositions scrubbed to "bonded"
// (formula / pair counts compared with the pure engine, atoms inside the canvas, no overflow, no console errors), the refusals, drag-to-approach,
// keyboard, reduced motion, the 3D view and its context-lost notice, the picker.  Software WebGL only; no real GPU / touch / Safari / Firefox.
import zlib from "node:zlib";
import { recognise } from "../../src/lib/lewis/index.js";

/** Fraction of pixels that are not (near) white in an 8-bit non-interlaced PNG buffer (Playwright screenshots): a blank canvas gives ~0. */
function nonWhite(png) {
  let o = 8; let w = 0; let h = 0; let ch = 3; const idat = [];
  while (o < png.length) { const len = png.readUInt32BE(o); const type = png.toString("ascii", o + 4, o + 8); const d = png.subarray(o + 8, o + 8 + len); if (type === "IHDR") { w = d.readUInt32BE(0); h = d.readUInt32BE(4); ch = d[9] === 6 ? 4 : 3; } if (type === "IDAT") idat.push(d); o += 12 + len; }
  const raw = zlib.inflateSync(Buffer.concat(idat)); const stride = w * ch; const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y += 1) {
    const f = raw[y * (stride + 1)]; const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x += 1) {
      const a = x >= ch ? px[y * stride + x - ch] : 0; const b = y ? px[(y - 1) * stride + x] : 0; const c = x >= ch && y ? px[(y - 1) * stride + x - ch] : 0;
      const pr = f === 0 ? 0 : f === 1 ? a : f === 2 ? b : f === 3 ? (a + b) >> 1 : (() => { const pa = Math.abs(b - c); const pb = Math.abs(a - c); const pc = Math.abs(a + b - 2 * c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; })();
      px[y * stride + x] = (line[x] + pr) & 255;
    }
  }
  let n = 0; for (let i = 0; i < px.length; i += ch) if (px[i] < 235 || px[i + 1] < 235 || px[i + 2] < 235) n += 1;
  return n / (w * h);
}

const COMPS = [
  { id: "H2", atoms: ["H", "H"] }, { id: "HCl", atoms: ["H", "Cl"] }, { id: "H2O", atoms: ["H", "H", "O"] }, { id: "NH3", atoms: ["N", "H", "H", "H"] }, { id: "CH4", atoms: ["C", "H", "H", "H", "H"] },
  { id: "CO2", atoms: ["C", "O", "O"] }, { id: "N2", atoms: ["N", "N"] }, { id: "O2", atoms: ["O", "O"] }, { id: "HCN", atoms: ["H", "C", "N"] }, { id: "C2H4", atoms: ["C", "C", "H", "H", "H", "H"] },
  { id: "C2H2", atoms: ["C", "C", "H", "H"] }, { id: "CO", atoms: ["C", "O"] }, { id: "NH4+", atoms: ["N", "H", "H", "H", "H"], charge: 1 }, { id: "CO3 2-", atoms: ["C", "O", "O", "O"], charge: -2 },
  { id: "SO2", atoms: ["S", "O", "O"] }, { id: "O3", atoms: ["O", "O", "O"] }, { id: "BF3", atoms: ["B", "F", "F", "F"] }, { id: "CH3OH", atoms: ["C", "H", "H", "H", "O", "H"] },
  { id: "SF6 (HL)", atoms: ["S", "F", "F", "F", "F", "F", "F"], beyond: true }, { id: "NO3-", atoms: ["N", "O", "O", "O"], charge: -1 }, { id: "SO4 2-", atoms: ["S", "O", "O", "O", "O"], charge: -2 },
];

export default async function ({ browser, base, open, health, check, sleep, T, shot, SIZES, errorsCheck }) {
  const URL = "/simulation/bonding-visualizer";
  const only = process.env.COMPS ? process.env.COMPS.split(",") : null;
  const attr = (p, a) => p.locator(T("canvas")).getAttribute(a);
  const waitStatus = async (p) => { for (let i = 0; i < 60; i += 1) { if ((await attr(p, "data-status")) !== "pending") return; await sleep(100); } };
  const scrub = (p, v) => p.evaluate((v) => { const el = document.querySelector('[data-testid="tool-bring"]'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(el, String(v)); el.dispatchEvent(new Event("input", { bubbles: true })); }, v);
  const setSwitch = async (p, id, want) => { const b = p.locator(T(id)); if ((await b.isChecked()) !== want) await b.click(); };
  const build = async (p, c) => {
    await p.locator(T("tool-clear")).click();
    const cur = await p.locator(T("charge-value")).innerText(); const have = /\d/.test(cur) ? (/[−-]/.test(cur) ? -1 : 1) * Number(cur.replace(/\D/g, "")) : 0;
    for (let i = have; i < (c.charge ?? 0); i += 1) await p.locator(T("charge-plus")).click();
    for (let i = have; i > (c.charge ?? 0); i -= 1) await p.locator(T("charge-minus")).click();
    await setSwitch(p, "beyond-toggle", !!c.beyond);
    for (const s of c.atoms) await p.locator(T(`el-${s}`)).click();
    await sleep(250); await waitStatus(p);
  };
  /** every valence ring inside the canvas box (tolerance 2 px) */
  const inside = (p) => p.evaluate(() => {
    const box = document.querySelector('[data-testid="canvas"] svg.bv-svg')?.getBoundingClientRect(); if (!box) return null; let worst = 0;
    for (const c of document.querySelectorAll('[data-valence-ring="1"]')) { const b = c.getBoundingClientRect(); worst = Math.max(worst, box.top - b.top, b.bottom - box.bottom, box.left - b.left, b.right - box.right); }
    return Math.round(worst);
  });
  const slug = (s) => s.replace(/[^A-Za-z0-9]+/g, "_");

  for (const [w, h] of SIZES) for (const scheme of ["light", "dark"]) {
    const label = `bonding2 ${w}x${h} ${scheme}`; console.log(" ", label);
    const S = await open(URL, { w, h, scheme, touch: w < 600 }); const p = S.page;
    check(await p.evaluate(() => document.documentElement.classList.contains("dark")) === (scheme === "dark"), `${label}: app theme is ${scheme}`);
    await p.locator(T("tab-covalent")).click(); await sleep(600);
    await health(S, `${label} covalent`, T("bonding-workspace"));

    // ---- the owner's scenario, with the real animation ----
    await build(p, COMPS[5]);
    check(await attr(p, "data-status") === "ok" && await attr(p, "data-formula") === "CO₂", `${label}: C + O + O recognised as CO2 straight away`);
    check(await p.locator(T("tool-form-bond")).isEnabled(), `${label}: Form molecule is enabled although the atoms are far apart`);
    check(await attr(p, "data-stage") === "setup", `${label}: starts far apart`);
    check((await p.locator('[data-ring]').count()) === 0 && (await p.locator('[data-core="1"]').count()) === 0, `${label}: outer-shell box ON: no inner shells, no inner electrons`);
    check((await p.locator('[data-valence-ring="1"]').count()) === 3 && (await p.locator(T("core")).count()) === 3, `${label}: three valence shells and three labelled cores`);
    await p.locator(T("canvas")).scrollIntoViewIfNeeded(); await shot(S, `b2-owner-${w}-${scheme}-0-apart`);
    await p.locator(T("tool-form-bond")).click(); await sleep(2400);
    const mid = await attr(p, "data-stage"); check(mid === "forming", `${label}: animation in progress (stage ${mid})`);
    check((await p.locator(T("overlap")).count()) >= 1, `${label}: overlap of valence shells drawn while approaching`);
    await shot(S, `b2-owner-${w}-${scheme}-1-mid`);
    for (let i = 0; i < 40 && (await attr(p, "data-stage")) !== "bonded"; i += 1) await sleep(250);
    check(await attr(p, "data-stage") === "bonded", `${label}: bonded after the animation`);
    check(JSON.stringify(await p.locator(T("bond-line")).evaluateAll((l) => l.map((x) => x.dataset.order))) === '["2","2"]', `${label}: CO2 has two double bonds`);
    check((await p.locator('circle[data-state="shared"]').count()) === 8 && (await p.locator('circle[data-state="lone"]').count()) === 8, `${label}: 8 shared + 8 lone-pair electrons`);
    check(await p.locator(T("live-shared")).locator("dd").innerText() === "4" && await p.locator(T("live-lone")).locator("dd").innerText() === "4", `${label}: 4 bonding pairs, 4 lone pairs`);
    await shot(S, `b2-owner-${w}-${scheme}-2-bonded`);
    await p.locator(T("canvas")).screenshot({ path: `${process.env.SHOTS || "/tmp/bonding-group-shots"}/b2-owner-${w}-${scheme}-2-bonded-canvas.png` }).catch(() => {});
    // the checkbox: label, off shows inner shells, remembered across a reload (session storage)
    check(/Only outer-shell electrons/.test(await p.locator(T("outer-only-label")).innerText()), `${label}: checkbox label`);
    await p.locator(T("outer-only")).click(); await sleep(200);
    check((await p.locator('[data-ring]').count()) >= 3 && (await p.locator('[data-core="1"]').count()) > 0, `${label}: box OFF: inner shells and inner electrons appear`);
    check((await inside(p)) <= 2, `${label}: all-shells view fits in the canvas (overflow ${await inside(p)}px)`);
    await shot(S, `b2-owner-${w}-${scheme}-3-allshells`);
    await p.reload({ waitUntil: "load" }); await sleep(1200); await p.locator(T("tab-covalent")).click(); await sleep(500);
    check(await p.locator(T("outer-only")).isChecked() === false, `${label}: the choice survives a reload (session)`);
    await p.locator(T("outer-only")).click();
    // slider scrub far apart -> bonded and back
    await build(p, COMPS[5]); await scrub(p, 300); await sleep(150); check(await attr(p, "data-stage") === "forming", `${label}: slider mid position is 'forming'`);
    await scrub(p, 1000); await sleep(150); check(await attr(p, "data-stage") === "bonded", `${label}: slider end is bonded`); await scrub(p, 0); await sleep(150); check(await attr(p, "data-stage") === "setup", `${label}: slider start is apart`);
    errorsCheck(S, `${label} owner case`);

    // ---- 21 compositions ----
    for (const c of COMPS) {
      if (only && !only.includes(c.id)) continue;
      const exp = recognise(c.atoms, { charge: c.charge ?? 0, beyond: !!c.beyond });
      await build(p, c);
      const st = await attr(p, "data-status"); const f = await attr(p, "data-formula");
      check(st === "ok" && f === exp.info.formula, `${label} ${c.id}: recognised as ${exp.info.formula} (got ${st} ${f})`);
      await scrub(p, 1000); await sleep(250);
      check(await attr(p, "data-stage") === "bonded", `${label} ${c.id}: bonded`);
      check(await p.locator(T("live-shared")).locator("dd").innerText() === String(exp.info.bondingPairs) && await p.locator(T("live-lone")).locator("dd").innerText() === String(exp.info.lonePairs), `${label} ${c.id}: ${exp.info.bondingPairs} bonding / ${exp.info.lonePairs} lone pairs shown`);
      const o = await inside(p); check(o !== null && o <= 2, `${label} ${c.id}: shells inside the canvas (overflow ${o}px)`);
      check((await p.locator(T("card-shape")).innerText()).length > 3 && (await p.locator(T("card-polarity")).innerText()).length > 10, `${label} ${c.id}: shape and polarity text`);
      await p.locator(T("canvas")).scrollIntoViewIfNeeded(); await shot(S, `b2-${slug(c.id)}-${w}-${scheme}`);
      await p.locator(T("canvas")).screenshot({ path: `${process.env.SHOTS || "/tmp/bonding-group-shots"}/b2c-${slug(c.id)}-${w}-${scheme}.png` }).catch(() => {});
    }
    await health(S, `${label} after compositions`, T("bonding-workspace"));
    errorsCheck(S, `${label} compositions`);

    // ---- refusals explain themselves ----
    await build(p, { atoms: ["C", "O", "O", "O"] });
    check(await attr(p, "data-status") === "needs-charge" && /carbonate/i.test(await p.locator(T("card-message")).innerText()), `${label}: C + 3 O says it needs a charge (carbonate)`);
    await p.locator(T("tool-form-bond")).click(); await sleep(200);
    check(/carbonate/i.test(await p.locator(T("bv-explain")).innerText()) && await attr(p, "data-stage") === "setup", `${label}: Form molecule repeats the reason instead of failing silently`);
    await p.locator(T("apply-charge--2")).click(); await sleep(300); check(await attr(p, "data-status") === "ok", `${label}: one click applies 2- and resolves it`);
    await build(p, { atoms: ["S", "F", "F", "F", "F", "F", "F"] });
    check(await attr(p, "data-status") === "needs-beyond", `${label}: SF6 is refused until the HL switch is on`);

    // ---- keyboard: focus the canvas, N selects, arrows move, Enter forms ----
    await build(p, { atoms: ["C", "O", "O"] });
    await p.locator(T("canvas")).focus(); await p.keyboard.press("n"); await sleep(100);
    const xs = () => p.locator(`${T("canvas")} g.bv-atom`).evaluateAll((g) => g.map((e) => Number(e.querySelectorAll("circle")[1]?.getAttribute("cx"))).reduce((x, y) => x + y, 0));
    const x0 = await xs();
    await p.keyboard.press("ArrowRight"); await p.keyboard.press("ArrowRight"); await sleep(100);
    const x1 = await xs();
    check(x1 > x0, `${label}: keyboard N + arrows move an atom (${x0} -> ${x1})`);
    await p.keyboard.press("Enter"); await sleep(1200); check(["forming", "bonded"].includes(await attr(p, "data-stage")), `${label}: Enter forms the molecule`);
    const focusStyle = await p.locator(T("tool-form-bond")).focus().then(() => p.evaluate(() => { const cs = getComputedStyle(document.activeElement); return `${cs.outlineStyle} ${cs.outlineWidth}`; }));
    check(!/^none/.test(focusStyle), `${label}: focus ring visible on Form molecule (${focusStyle})`);

    // ---- drag-to-approach (mouse; the same pointer path touch uses) ----
    if (w >= 900) {
      await build(p, { atoms: ["C", "O", "O"] });
      const box = async (sym, k) => p.locator(`${T("canvas")} g.bv-atom[data-symbol="${sym}"]`).nth(k).boundingBox();
      const move = async (from, to) => { const a = await box(...from); const b = await box(...to); await p.mouse.move(a.x + a.width / 2, a.y + a.height / 2); await p.mouse.down(); await p.mouse.move((a.x + b.x) / 2 + a.width / 2, (a.y + b.y) / 2 + a.height / 2, { steps: 6 }); await p.mouse.move(b.x + b.width / 2 + 6, b.y + b.height / 2, { steps: 6 }); await p.mouse.up(); await sleep(200); };
      await move(["O", 0], ["C", 0]); const expl1 = await p.locator(T("bv-explain")).innerText();
      check(/more atom/.test(expl1) || await attr(p, "data-stage") !== "setup", `${label}: dragging one O onto C says one more atom is still apart ("${expl1.slice(0, 70)}")`);
      await move(["O", 1], ["C", 0]); await sleep(600);
      check(await attr(p, "data-stage") !== "setup", `${label}: both O next to C: the bond forms by itself`);
      await sleep(5800);
      await build(p, { atoms: ["O", "O", "C"] }); // bad pair: the two O dropped on each other
      await move(["O", 0], ["O", 1]); const expl2 = await p.locator(T("bv-explain")).innerText();
      check(/not bonded to each other/.test(expl2), `${label}: dropping O on O explains that they are not bonded ("${expl2.slice(0, 80)}")`);
    }
    errorsCheck(S, `${label} refusals/keyboard/drag`);

    // ---- 3D view, context lost ----
    if (scheme === "light") {
      await build(p, { atoms: ["C", "O", "O"] }); await scrub(p, 1000); await sleep(200);
      await p.locator(`${T("view-tabs")} [role="radio"]`).nth(1).click(); await sleep(2500);
      check(await p.locator(T("structure")).getAttribute("data-renderer") === "webgl", `${label}: 3D view uses WebGL`);
      await shot(S, `b2-3d-${w}`);
      const ink = nonWhite(await p.locator(T("structure-layer")).screenshot());
      check(ink > 0.02, `${label}: the 3D view is not blank (${(ink * 100).toFixed(1)}% of its pixels are drawn)`);
      check(await p.locator(T("structure-layer")).evaluate((e) => getComputedStyle(e).opacity) === "1", `${label}: the 3D layer is visible (opacity 1)`);
      check(await p.locator(T("polarity-panel")).isVisible(), `${label}: polarity panel visible in 3D`);
      await p.evaluate(() => { const c = document.querySelector('[data-testid="structure"] canvas'); const gl = c.getContext("webgl2") || c.getContext("webgl"); window.__lose = gl.getExtension("WEBGL_lose_context"); window.__lose.loseContext(); });
      await sleep(700); check(await p.locator(T("webgl-context-lost")).count() === 1, `${label}: 3D context-lost notice shown`);
      await p.evaluate(() => window.__lose.restoreContext()); await sleep(1800);
      check(await p.locator(T("webgl-context-lost")).count() === 0, `${label}: 3D canvas restored`);
      await p.locator(`${T("view-tabs")} [role="radio"]`).nth(0).click(); await sleep(300);
      // picker
      await p.locator(T("picker-button")).click(); await sleep(200);
      check(Number((await p.locator(".bv-picker-count").innerText()).trim()) >= 80, `${label}: picker lists 80+ molecules`);
      await p.locator(T("picker-search")).fill("ammon"); await sleep(150);
      check(await p.locator('[data-testid="picker-list"] [role="option"]').count() <= 3, `${label}: picker search narrows the list`);
      await shot(S, `b2-picker-${w}`);
      await p.locator(T("pick-NH4+")).click(); await sleep(6500);
      check(await attr(p, "data-formula") === "NH₄⁺" && await attr(p, "data-stage") === "bonded", `${label}: picking NH4+ sets the charge and bonds by itself`);
      // ionic still works
      await p.locator(T("tab-ionic")).click(); await sleep(400); await p.locator(T("el-Na")).click(); await p.locator(T("el-Cl")).click(); await sleep(200);
      check(await p.locator(T("tool-ionize")).isEnabled(), `${label}: ionic mode still works (Na + Cl)`);
    }
    errorsCheck(S, `${label} 3D/picker/ionic`); await S.ctx.close();
  }

  // ---- reduced motion: the formation is a short plain move, nothing spins ----
  {
    const label = "bonding2 reduced-motion"; const S = await open(URL, { w: 1366, h: 768, reduced: true }); const p = S.page;
    await p.locator(T("tab-covalent")).click(); await sleep(500); await build(p, COMPS[5]);
    await p.locator(T("tool-form-bond")).click(); await sleep(1500);
    check(await attr(p, "data-stage") === "bonded", `${label}: bonded within 1.5 s (full motion takes ~5 s)`);
    errorsCheck(S, label); await S.ctx.close();
  }
}
