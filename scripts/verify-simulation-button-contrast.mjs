// Reusable button-contrast audit for EVERY e-Lab simulation interface (needs a running dev server + Playwright/Chromium).
// Usage: node scripts/verify-simulation-button-contrast.mjs [baseUrl] [outDir]
//   env: SIMS=id1,id2   limit to some simulation ids (default: every id in src/data/simulationRegistry.js)
//        SIZES=1366x768,390x844   viewports (default both)
//        THEMES=light,dark        app themes (default both; the app toggles a `.dark` class on <html>)
//        VARIANTS=standalone,fullscreen,embedded   (default all; embedded = /interactives/<id>, only for engines that have a page there)
//        STATES=0   audit the default state only (default: also hover / focus-visible / active, forced through CDP CSS.forcePseudoState)
//        SHOTS=1    save a screenshot of each page/variant into <outDir>/shots (used for contact sheets)
//        CHROMIUM=/path/to/chrome
// For every visible control (button, [role=button|tab|radio|switch|menuitem], select, summary) it computes WCAG ratios
//   text   : label colour vs the control's effective fill (opacity + alpha composited, ancestors walked)        >= 4.5
//   icon   : svg stroke/fill vs the effective fill                                                              >= 3
//   bound  : max(fill vs surrounding background, border vs surrounding background) for controls that have a
//            fill or a border (pale-on-pale controls fail here)                                                  >= 3
//   focus  : :focus-visible outline/ring vs the surrounding background, >= 2px wide                              >= 3
//   state  : hover and active must visibly differ from default; a selected/pressed control must differ from an
//            unselected sibling of the same group
// Disabled controls are measured and listed as warnings only (WCAG exempts them) -- they must still read as controls (>= 3 for text).
// Surroundings painted by a canvas / gradient / image are sampled from real screenshot pixels instead of CSS.
// Exit code 1 when any violation is found. Honest limits: headless Chromium + SwiftShader only; no real GPU, no assistive tech;
// only controls reachable from the default view and from each tab / segmented option (one level) are audited.
import { chromium } from "/opt/node-tools/node_modules/playwright/index.mjs";
import fs from "node:fs";
import path from "node:path";
import { SIMULATION_REGISTRY } from "../src/data/simulationRegistry.js";

const base = process.argv[2] || "http://127.0.0.1:5199";
const out = process.argv[3] || "/tmp/button-contrast";
fs.mkdirSync(out, { recursive: true });
if (process.env.SHOTS) fs.mkdirSync(path.join(out, "shots"), { recursive: true });
const exe = process.env.CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome";
const env = (k, d) => (process.env[k] ? process.env[k].split(",") : d);
const ids = env("SIMS", Object.keys(SIMULATION_REGISTRY));
const sizes = env("SIZES", ["1366x768", "390x844"]).map((s) => s.split("x").map(Number));
const themes = env("THEMES", ["light", "dark"]);
const variants = env("VARIANTS", ["standalone", "fullscreen", "embedded"]);
const withStates = process.env.STATES !== "0";
// /interactives/<resource id> renders the engine inside the embedded InteractiveFrame (the Learn-page look, minus the lesson).
const EMBEDDED = {
  "electron-configuration": "electron-configuration-explorer", "particle-model-visualizer": "particle-model-visualizer",
  "phase-change-heating-curve": "phase-change-heating-curve", "ph-calculator-visualizer": "ph-calculator-visualizer",
  "h-oh-balance": "h-oh-balance", "explore-matter-and-states": "explore-matter-and-states", "vsepr-explorer-3d": "vsepr-explorer-3d",
};
const T_TEXT = 4.5, T_NONTEXT = 3, MAX_PER_PAGE = 70;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const IGNORE = [/Supabase is not configured/, /THREE\.Clock/, /GL Driver Message/, /GPU stall/, /ERR_TUNNEL/, /Failed to load resource/, /net::ERR/];

// ---------- in-page helpers (serialised into the page) ----------
const PAGE_LIB = `(() => {
  if (window.__bc) return;
  const cv = document.createElement("canvas"); cv.width = cv.height = 1; const cx = cv.getContext("2d", { willReadFrequently: true });
  const parse = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = "#000"; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const over = (t, b) => { const a = t[3] + b[3] * (1 - t[3]); if (a === 0) return [0, 0, 0, 0]; return [0, 1, 2].map((i) => (t[i] * t[3] + b[i] * b[3] * (1 - t[3])) / a).concat([a]); };
  const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  function opacityOf(el) { let o = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) o *= parseFloat(getComputedStyle(n).opacity); return o; }
  function surround(el) {
    const layers = []; let approx = false;
    for (let n = el.parentElement; n; n = n.parentElement) {
      const cs = getComputedStyle(n); const bg = parse(cs.backgroundColor); if (bg[3] > 0) layers.push(bg);
      if (cs.backgroundImage !== "none") approx = true;
      if (bg[3] >= 1 && cs.backgroundImage === "none") break;
    }
    let acc = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) acc = over(layers[i], acc);
    const r = el.getBoundingClientRect();
    for (const [x, y] of [[r.left - 3, r.top + r.height / 2], [r.right + 3, r.top + r.height / 2], [r.left + r.width / 2, r.top - 3], [r.left + r.width / 2, r.bottom + 3]]) {
      const e = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, x)), Math.max(0, Math.min(innerHeight - 1, y)));
      if (e && (e.tagName === "CANVAS" || (e !== el && !el.contains(e) && getComputedStyle(e).backgroundImage !== "none"))) approx = true;
    }
    return { color: acc, approx };
  }
  function describe(el) { const t = (el.getAttribute("aria-label") || el.textContent || el.title || "").replace(/\\s+/g, " ").trim().slice(0, 40); return (el.getAttribute("data-testid") ? "[" + el.getAttribute("data-testid") + "] " : "") + (t || el.className.toString().slice(0, 30)); }
  function measure(el) {
    const cs = getComputedStyle(el); const op = opacityOf(el); const sv = surround(el);
    const bgRaw = parse(cs.backgroundColor); const fill = bgRaw[3] > 0 ? over(bgRaw, sv.color) : sv.color;
    const hasFill = bgRaw[3] > 0.05;
    const bw = Math.min(parseFloat(cs.borderTopWidth) || 0, parseFloat(cs.borderBottomWidth) || 0, parseFloat(cs.borderLeftWidth) || 0, parseFloat(cs.borderRightWidth) || 0);
    const bc0 = parse(cs.borderTopColor); const hasBorder = bw > 0 && cs.borderTopStyle !== "none" && bc0[3] > 0.05;
    const bcol = hasBorder ? over(bc0, sv.color) : null;
    const fade = (c) => op < 1 ? over([c[0], c[1], c[2], op], sv.color) : c;
    const tc = over(parse(cs.color), fill); const textCol = fade(tc), fillF = fade(fill), borderF = bcol && fade(bcol);
    const textual = Array.from(el.querySelectorAll("*")).concat([el]).some((n) => n.tagName !== "svg" && !n.closest("svg") && Array.from(n.childNodes).some((m) => m.nodeType === 3 && m.textContent.trim()));
    let icon = null, iconCol = null; const svg = el.querySelector("svg");
    if (svg) { const sc = getComputedStyle(svg); const s = sc.stroke !== "none" ? sc.stroke : (svg.getAttribute("fill") && svg.getAttribute("fill") !== "none" ? sc.fill : "none"); if (s && s !== "none") { iconCol = fade(over(parse(s), fill)); icon = ratio(iconCol, fillF); } }
    const fs = parseFloat(cs.fontSize), fw = parseInt(cs.fontWeight, 10) || 400; const large = fs >= 24 || (fs >= 18.66 && fw >= 700);
    const boundary = (hasFill || hasBorder) ? Math.max(ratio(fillF, sv.color), borderF ? ratio(borderF, sv.color) : 0) : null;
    // focus ring candidates: the outline and a non-blurred box-shadow ring (the shell's halo). Either one reading >= 3:1 on the surface counts.
    const inset = (parseFloat(cs.outlineOffset) || 0) < 0; const ringBg = inset ? fillF : sv.color;
    const rings = []; const ow = cs.outlineStyle !== "none" ? parseFloat(cs.outlineWidth) || 0 : 0;
    if (ow) rings.push({ w: ow, c: over(parse(cs.outlineColor), ringBg) });
    for (const m of cs.boxShadow.matchAll(/(rgba?\\([^)]*\\)|color\\([^)]*\\))\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px\\s+(-?[\\d.]+)px(?!\\s+inset)/g)) {
      if (parseFloat(m[4]) <= 1 && parseFloat(m[5]) >= 2 && parseFloat(m[2]) === 0 && parseFloat(m[3]) === 0) rings.push({ w: parseFloat(m[5]), c: over(parse(m[1]), ringBg) });
    }
    const ringBest = rings.length ? rings.map((r) => ({ w: r.w, ratio: ratio(r.c, ringBg), c: r.c })).sort((x, y) => y.ratio - x.ratio)[0] : null;
    const selected = ["aria-pressed", "aria-selected", "aria-checked", "aria-current"].some((a) => el.getAttribute(a) === "true");
    const r = el.getBoundingClientRect();
    let textRect = null;
    if (textual) { const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let tn; const rg = document.createRange(); let u = null; while ((tn = w.nextNode())) { if (!tn.textContent.trim() || tn.parentElement.closest("svg")) continue; rg.selectNodeContents(tn); const q = rg.getBoundingClientRect(); if (!q.width) continue; u = u ? { l: Math.min(u.l, q.left), t: Math.min(u.t, q.top), r: Math.max(u.r, q.right), b: Math.max(u.b, q.bottom) } : { l: q.left, t: q.top, r: q.right, b: q.bottom }; } if (u) textRect = { x: u.l, y: u.t, w: u.r - u.l, h: u.b - u.t }; }
    const topEl = document.elementFromPoint(Math.max(0, Math.min(innerWidth - 1, r.left + r.width / 2)), Math.max(0, Math.min(innerHeight - 1, r.top + r.height / 2)));
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const inView = cx >= 0 && cy >= 0 && cx < innerWidth && cy < innerHeight;
    let clippedByAncestor = false;
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const o = getComputedStyle(a); if (o.overflowX === "visible" && o.overflowY === "visible") continue;
      const ar = a.getBoundingClientRect(); if (cx < ar.left || cx > ar.right || cy < ar.top || cy > ar.bottom || r.bottom > ar.bottom + 1 || r.right > ar.right + 1) { clippedByAncestor = true; break; }
    }
    const covered = clippedByAncestor || (inView ? !(topEl && el.contains(topEl)) : !(topEl && (el.contains(topEl) || topEl.contains(el))));
    return {
      covered, textRect, name: describe(el), tag: el.tagName.toLowerCase(), disabled: el.disabled === true || el.getAttribute("aria-disabled") === "true", selected, textual, large,
      text: textual ? ratio(textCol, fillF) : null, icon, boundary,
      ring: ringBest ? { w: ringBest.w, ratio: ringBest.ratio, inset } : null, approx: sv.approx,
      sig: [fillF, borderF || [0, 0, 0, 0], textCol].map((v) => v.slice(0, 3).map(Math.round).join(",")).concat([cs.boxShadow, cs.transform, cs.fontWeight, cs.textDecorationLine, cs.outlineStyle]).join("|"),
      vec: { fill: fillF, border: borderF, text: textCol, icon: iconCol, rings: rings.map((r) => r.c) }, hasFill, hasBorder, textualFlag: textual,
      hex: { fill: fillF.slice(0, 3).map(Math.round), surround: sv.color.slice(0, 3).map(Math.round), border: borderF ? borderF.slice(0, 3).map(Math.round) : null, text: textCol.slice(0, 3).map(Math.round) },
      rounded: (parseFloat(cs.borderTopLeftRadius) || 0) > 0.3 * Math.min(r.width, r.height), rect: { x: r.left, y: r.top, w: r.width, h: r.height }, cls: el.className.toString().slice(0, 60),
    };
  }
  const SEL = 'button, [role="button"], [role="tab"], [role="radio"], [role="switch"], [role="menuitem"], select, summary';
  function collect() {
    const els = [];
    for (const el of document.querySelectorAll(SEL)) {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (r.width < 4 || r.height < 4 || cs.visibility === "hidden" || cs.display === "none" || r.bottom < 0 || r.right < 0 || r.top > innerHeight || r.left > innerWidth) continue;
      if (el.closest("[aria-hidden=true]") || el.closest("[data-bc-ignore]")) continue;
      if (!el.closest(".elab-sim, .sim-surface-dark") && el.closest("header, nav, footer")) continue;   // site chrome (theme toggle, menus) is not part of the simulation
      els.push(el);
    }
    return els;
  }
  window.__bc = { parse, over, ratio, measure, collect, SEL };
})();`;

const problems = []; const warnings = []; const rows = []; let controls = 0;
const fmt = (n) => (n == null ? "-" : n.toFixed(2));

function evaluateRecord(row, ctx) {
  const where = `${ctx.sim} ${ctx.variant}/${ctx.theme}@${ctx.size}${ctx.tab ? ` {${ctx.tab}}` : ""}`;
  const d = row.default; const label = `${row.name} <${row.tag}.${row.cls.split(" ")[0] || ""}>`;
  const fail = (what) => problems.push({ where, control: label, what });
  const warn = (what) => warnings.push({ where, control: label, what });
  const need = d.large ? T_NONTEXT : T_TEXT;
  if (d.disabled) { if (d.textual && d.text < T_NONTEXT) warn(`disabled label ${fmt(d.text)}:1 (<3, WCAG-exempt)`); return; }
  if (d.textual && d.text < need) fail(`text ${fmt(d.text)}:1 < ${need} (text rgb(${d.hex.text}) on rgb(${d.hex.fill}))`);
  if (d.icon != null && d.icon < T_NONTEXT) fail(`icon ${fmt(d.icon)}:1 < 3`);
  if (d.boundary != null && d.boundary < T_NONTEXT) fail(`boundary ${fmt(d.boundary)}:1 < 3 (fill rgb(${d.hex.fill}) border ${d.hex.border ? `rgb(${d.hex.border})` : "none"} vs surround rgb(${d.hex.surround}))`);
  if (row.hover) {
    if (row.hover.sig === d.sig && !d.selected) fail("hover state identical to default");
    else {
      const h = row.hover; if (h.textual && h.text < need) fail(`hover text ${fmt(h.text)}:1 < ${need}`);
      if (d.boundary != null && h.boundary != null && h.boundary < T_NONTEXT && (d.boundary >= T_NONTEXT || h.boundary < d.boundary)) fail(`hover boundary ${fmt(h.boundary)}:1 < 3`);
    }
  }
  if (row.active && d.tag !== "select") { if (row.active.sig === d.sig && !d.selected) fail("active state identical to default"); else if (row.active.textual && row.active.text < need) fail(`active text ${fmt(row.active.text)}:1 < ${need}`); }
  if (row.focus) {
    const f = row.focus; if (!f.ring) fail("no visible focus-visible ring"); else if (f.ring.w < 2 || f.ring.ratio < T_NONTEXT) fail(`focus ring ${f.ring.w}px / ${fmt(f.ring.ratio)}:1 (need >=2px, >=3:1)`);
  }
  if (d.selected && row.siblingSig && row.siblingSig === d.sig) fail("selected state identical to unselected sibling");
}

async function pixelSample(p, rec, id) {
  if (id != null) { const fresh = await p.evaluate((i) => { const e = document.querySelector(`[data-bc-id="${i}"]`); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, id); if (fresh) rec.rect = fresh; }
  // Surroundings / fills painted by canvases, gradients or translucent layers cannot be resolved from CSS alone:
  // sample real pixels just OUTSIDE the control (surround) and just INSIDE its edges (effective fill).
  const r = rec.rect; const pad = 6;
  const vp = p.viewportSize();
  const x0 = Math.max(0, r.x - pad), y0 = Math.max(0, r.y - pad);
  const clip = { x: x0, y: y0, width: Math.min(r.x + r.w + pad - x0, vp.width - x0, 1400), height: Math.min(r.y + r.h + pad - y0, vp.height - y0, 400) };
  if (!(clip.width > 0 && clip.height > 0)) return;
  const buf = await p.screenshot({ clip });
  const res = await p.evaluate(async ({ b64, r, clip, vec, hasFill, hasBorder, textual, rounded, textRect }) => {
    const B = window.__bc;
    const img = new Image(); img.src = "data:image/png;base64," + b64; await img.decode();
    const c = document.createElement("canvas"); c.width = img.width; c.height = img.height; const x = c.getContext("2d", { willReadFrequently: true }); x.drawImage(img, 0, 0);
    const k = img.width / clip.width; const ox = (r.x - clip.x) * k, oy = (r.y - clip.y) * k, w = r.w * k, h = r.h * k;
    const get = (u, v) => { const d = x.getImageData(Math.max(0, Math.min(img.width - 1, Math.round(u))), Math.max(0, Math.min(img.height - 1, Math.round(v))), 1, 1).data; return [d[0], d[1], d[2], 1]; };
    const outside = [], inside = [];
    for (let t = 0.15; t <= 0.85; t += 0.175) { outside.push(get(ox + w * t, oy - 3), get(ox + w * t, oy + h + 3), get(ox - 3, oy + h * t), get(ox + w + 3, oy + h * t)); }
    const inset = Math.min(3 * k, w / 4, h / 4);
    // round controls (pills / circles): only the mid-height left/right edge points are certainly inside the shape
    for (const t of rounded ? [0.5] : [0.2, 0.5, 0.8]) { inside.push(get(ox + inset, oy + h * t), get(ox + w - inset, oy + h * t)); }
    if (!rounded) for (const t of [0.3, 0.7]) { inside.push(get(ox + w * t, oy + inset), get(ox + w * t, oy + h - inset)); }
    const med = (arr) => [0, 1, 2].map((i) => arr.map((a) => a[i]).sort((m, n) => m - n)[Math.floor(arr.length / 2)]).concat([1]);
    let fills = inside;
    if (textRect) {   // sample the paint right beside the glyphs (gradient discs, translucent layers) instead of the control's edges
      const tx = (textRect.x - clip.x) * k, ty = (textRect.y - clip.y) * k, tw = textRect.w * k, th = textRect.h * k;
      const lo = (v, min, max) => Math.max(min, Math.min(max, v));
      const x1 = ox + 4 * k, x2 = ox + w - 4 * k, y1 = oy + 4 * k, y2 = oy + h - 4 * k;   // stay clear of the control's own border
      const cy = lo(ty + th / 2, y1, y2), cx = lo(tx + tw / 2, x1, x2);
      fills = [get(lo(tx - 2, x1, x2), cy), get(lo(tx + tw + 2, x1, x2), cy), get(cx, lo(ty - 1, y1, y2)), get(cx, lo(ty + th + 1, y1, y2))];
    }                                              // what is actually painted under the label (a ghost control shows the surface through itself)
    const edgeFill = med(inside);
    const res = { fillPx: med(fills), edgePx: edgeFill, surPx: med(outside), outs: outside };
    res.text = textual ? B.ratio(vec.text, res.fillPx) : null;
    res.icon = vec.icon ? B.ratio(vec.icon, res.fillPx) : null;
    
    if (hasFill || hasBorder) {
      const per = outside.map((o) => Math.max(B.ratio(edgeFill, o), vec.border ? B.ratio(vec.border, o) : 0)).sort((m, n) => m - n); res.boundary = per[Math.floor(per.length / 2)];   // median: a neighbouring control touching one side must not decide it
    }
    return res;
  }, { b64: buf.toString("base64"), r, clip, vec: rec.vec, hasFill: rec.hasFill, hasBorder: rec.hasBorder, textual: rec.textualFlag, rounded: rec.rounded, textRect: rec.textRect });
  if (res.text != null) rec.text = res.text;
  if (res.icon != null) rec.icon = res.icon;
  if (res.boundary != null) rec.boundary = res.boundary;
    rec.hex.fill = (res.edgePx || res.fillPx).slice(0, 3); rec.hex.surround = res.surPx.slice(0, 3);
  rec.outs = res.outs; rec.pixelSampled = true;
}

async function auditPage(p, cdp, ctx, seen) {
  await p.evaluate(PAGE_LIB);
  const keys = await p.evaluate(() => window.__bc.collect().map((e, i) => { e.setAttribute("data-bc-id", String(i)); return [e.tagName, e.className.toString(), e.getAttribute("style") || "", e.disabled ? "d" : "", ["aria-pressed", "aria-selected", "aria-checked"].map((a) => e.getAttribute(a) || "").join(""), (e.getAttribute("role") ? (e.textContent || "").trim().slice(0, 24) : "")].join("|"); }));
  let count = 0;
  for (let i = 0; i < keys.length && count < MAX_PER_PAGE; i += 1) {
    const sigKey = `${ctx.sim}|${ctx.variant}|${ctx.theme}|${ctx.size}|${keys[i]}`;
    if (seen.has(sigKey)) continue; seen.add(sigKey);
    const sel = `[data-bc-id="${i}"]`;
    await p.locator(sel).first().scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    const rec = await p.evaluate((i) => { const e = document.querySelector(`[data-bc-id="${i}"]`); return e ? window.__bc.measure(e) : null; }, i);
    if (!rec) continue;
    if (rec.covered) { warnings.push({ where: `${ctx.sim} ${ctx.variant}/${ctx.theme}@${ctx.size}${ctx.tab ? ` {${ctx.tab}}` : ""}`, control: rec.name, what: "control is covered or clipped by another element at its centre point (not audited; a layout issue, not a colour one)" }); continue; }
    if (rec.approx) await pixelSample(p, rec, i);
    const row = { name: rec.name, tag: rec.tag, cls: rec.cls, default: rec };
    if (withStates && !rec.disabled) {
      const doc = await cdp.send("DOM.getDocument", { depth: 0 });
      const q = await cdp.send("DOM.querySelector", { nodeId: doc.root.nodeId, selector: sel }).catch(() => null);
      if (q?.nodeId) {
        for (const [state, forced] of [["hover", ["hover"]], ["focus", ["focus", "focus-visible"]], ["active", ["active", "hover"]]]) {
          await cdp.send("CSS.forcePseudoState", { nodeId: q.nodeId, forcedPseudoClasses: forced }).catch(() => {});
          row[state] = await p.evaluate((i) => { const e = document.querySelector(`[data-bc-id="${i}"]`); return e ? window.__bc.measure(e) : null; }, i);
          if (state !== "focus" && row[state]?.approx) await pixelSample(p, row[state], i);
          if (state === "focus" && row.focus?.ring && row.focus.approx && !row.focus.ring.inset && rec.outs) {      // the ring paints over the 3px-outside samples, so reuse the default state's surround pixels
            row.focus.ring.ratio = await p.evaluate(({ outs, rings }) => Math.min(...outs.map((o) => Math.max(...rings.map((r) => window.__bc.ratio(r, o))))), { outs: rec.outs, rings: row.focus.vec.rings });
          }
          await cdp.send("CSS.forcePseudoState", { nodeId: q.nodeId, forcedPseudoClasses: [] }).catch(() => {});
        }
      }
    }
    if (rec.selected) {
      row.siblingSig = await p.evaluate((i) => {
        const e = document.querySelector(`[data-bc-id="${i}"]`); if (!e) return null;
        const sibs = Array.from(e.parentElement?.children ?? []).filter((s) => s !== e && s.matches(window.__bc.SEL) && !["aria-pressed", "aria-selected", "aria-checked"].some((a) => s.getAttribute(a) === "true") && !s.disabled);
        return sibs.length ? window.__bc.measure(sibs[0]).sig : null;
      }, i);
    }
    count += 1; controls += 1;
    evaluateRecord(row, ctx);
    rows.push({ where: `${ctx.sim} ${ctx.variant}/${ctx.theme}@${ctx.size}${ctx.tab ? ` {${ctx.tab}}` : ""}`, name: rec.name, tag: rec.tag, cls: rec.cls, state: rec.disabled ? "disabled" : rec.selected ? "selected" : "default", text: rec.text, icon: rec.icon, boundary: rec.boundary, hoverChanges: row.hover ? row.hover.sig !== rec.sig : null, activeChanges: row.active ? row.active.sig !== rec.sig : null, focusRing: row.focus?.ring ?? null, fill: rec.hex.fill, textRgb: rec.hex.text, surround: rec.hex.surround, pixelSampled: !!rec.pixelSampled });
  }
  await p.evaluate(() => document.querySelectorAll("[data-bc-id]").forEach((e) => e.removeAttribute("data-bc-id")));
}

async function runPage(browser, { sim, variant, theme, size: [W, H] }) {
  const size = `${W}x${H}`; const ctx = { sim, variant, theme, size };
  const context = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: W < 700 });
  await context.addInitScript((t) => { try { localStorage.setItem("e-lab:theme", t); } catch { /* ignore */ } }, theme);
  const p = await context.newPage(); const errs = [];
  p.on("console", (m) => { if (m.type() === "error" && !IGNORE.some((re) => re.test(m.text()))) errs.push(m.text()); });
  p.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
  const cdp = await context.newCDPSession(p);
  await cdp.send("DOM.enable"); await cdp.send("CSS.enable");
  const tag = `${sim} ${variant}/${theme}@${size}`;
  try {
    const url = variant === "embedded" ? `${base}/interactives/${EMBEDDED[sim]}` : `${base}/simulation/${sim}`;
    await p.goto(url, { waitUntil: "load" });
    await p.waitForSelector("button", { timeout: 30000 }); await sleep(1300);
    if (variant === "fullscreen") {
      const fsBtn = p.locator('button[aria-label="Enter full screen"]').first();
      if (!(await fsBtn.count())) { warnings.push({ where: tag, control: "Full Screen", what: "no Enter full screen button found" }); await context.close(); return; }
      await fsBtn.click(); await sleep(900);
      await p.mouse.move(1, H - 2);   // park the real pointer: it would otherwise leave the control under it in a real :hover state
      if (!(await p.evaluate(() => Boolean(document.fullscreenElement)))) warnings.push({ where: tag, control: "Full Screen", what: "requestFullscreen did not engage in headless Chromium (standard view audited instead)" });
    }
    // transitions would make forced hover / focus states read mid-fade; the audit measures the settled values
    await p.addStyleTag({ content: "*, *::before, *::after { transition: none !important; scroll-behavior: auto !important; }" }).catch(() => {});
    const shot = async (suffix) => { if (process.env.SHOTS) await p.screenshot({ path: path.join(out, "shots", `${sim}__${variant}__${theme}__${size}${suffix}.png`) }); };
    await shot("");
    const seen = new Set();
    await auditPage(p, cdp, ctx, seen);
    // one level of tabs / segmented options: click each unselected one and audit what appears
    const labels = await p.evaluate(() => Array.from(document.querySelectorAll('[role="tab"], [role="radio"]')).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 4 && r.height > 4 && e.getAttribute("aria-selected") !== "true" && e.getAttribute("aria-checked") !== "true" && !e.disabled; }).map((e) => (e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 30)));
    let n = 0;
    for (const label of [...new Set(labels)].filter(Boolean).slice(0, 8)) {
      const ok = await p.locator('[role="tab"], [role="radio"]').filter({ hasText: label }).first().click({ timeout: 1500 }).then(() => true).catch(() => false);
      if (!ok) continue; await p.mouse.move(1, H - 2); await sleep(350); n += 1;
      await auditPage(p, cdp, { ...ctx, tab: label }, seen);
    }
    if (n) await shot("__tabs");
  } catch (e) {
    warnings.push({ where: tag, control: "(page)", what: `audit aborted: ${String(e.message).split("\n")[0]}` });
  }
  if (errs.length) warnings.push({ where: tag, control: "(console)", what: errs.slice(0, 2).join(" | ").slice(0, 200) });
  await context.close();
}

const browser = await chromium.launch({ executablePath: exe, args: ["--no-sandbox", "--use-gl=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const t0 = Date.now();
for (const sim of ids) {
  for (const variant of variants) {
    if (variant === "embedded" && !EMBEDDED[sim]) continue;
    for (const size of sizes) {
      for (const theme of themes) {
        // fullscreen / embedded reuse the same shell actions: light only unless THEMES is given explicitly
        if (variant !== "standalone" && theme === "dark" && !process.env.THEMES) continue;
        const before = problems.length;
        await runPage(browser, { sim, variant, theme, size });
        console.log(`${sim.padEnd(34)} ${variant.padEnd(10)} ${theme.padEnd(5)} ${`${size[0]}x${size[1]}`.padEnd(9)} controls=${controls} violations+=${problems.length - before}`);
      }
    }
  }
}
await browser.close();

fs.writeFileSync(path.join(out, "button-contrast-rows.json"), JSON.stringify(rows, null, 1));
const bySim = new Map();
for (const v of problems) { const k = v.where.split(" ")[0]; if (!bySim.has(k)) bySim.set(k, []); bySim.get(k).push(v); }
const lines = [];
for (const [sim, vs] of bySim) {
  lines.push(`\n## ${sim}: ${vs.length} violation(s)`);
  const uniq = new Map();
  for (const v of vs) { const k = `${v.control} :: ${v.what.replace(/[\d.]+:1/g, "N:1").replace(/\(.*\)/, "")}`; if (!uniq.has(k)) uniq.set(k, { v, n: 0 }); uniq.get(k).n += 1; }
  for (const { v, n } of uniq.values()) lines.push(`  - ${v.control}  ${v.what}   (${v.where}${n > 1 ? `, +${n - 1} more` : ""})`);
}
fs.writeFileSync(path.join(out, "button-contrast-report.txt"), lines.join("\n"));
console.log(lines.join("\n"));
console.log(`\nWarnings (${warnings.length}):`); for (const w of warnings.slice(0, 60)) console.log(`  ~ ${w.where} ${w.control}: ${w.what}`);
console.log(`\n${controls} controls audited across ${ids.length} simulations in ${((Date.now() - t0) / 1000).toFixed(0)}s; ${problems.length} violation(s), ${warnings.length} warning(s). Report: ${out}/button-contrast-report.txt`);
process.exit(problems.length ? 1 : 0);
