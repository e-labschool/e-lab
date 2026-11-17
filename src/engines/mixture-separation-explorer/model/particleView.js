// A small multi-species particle model that shows WHY each separation works (sizes, volatility, solubility, stickiness).
// Pure JS (no React / DOM) so it is unit-tested. It shares the seeded random generator and the temperature scaling of the
// States-of-matter particle core (src/lib/particles/particleCore.js: makeRng, sigmaFor), but it is its own model because it
// needs several species of different size and volatility, which the single-species core does not have.
//
// World: 1.4 wide, 1.0 tall, y DOWN (canvas orientation). Radii are in world units. Not to scale with real nanometres:
// the picture shows relative size (a grain is much bigger than a pore, an ion much smaller).
import { makeRng, sigmaFor } from "../../../lib/particles/particleCore.js";
import { SUBSTANCES } from "./chem.js";

export const WORLD = { w: 1.4, h: 1.0 };
const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

function mk(rng, type, x, y, extra = {}) { return { type, x, y, vx: 0, vy: 0, ...extra }; }
const jitter = (p, rng, s) => { p.vx += (rng() - 0.5) * s; p.vy += (rng() - 0.5) * s; };
function bounce(p, r, minY = 0, maxY = WORLD.h, minX = 0, maxX = WORLD.w) {
  if (p.x < minX + r) { p.x = minX + r; p.vx = Math.abs(p.vx); } else if (p.x > maxX - r) { p.x = maxX - r; p.vx = -Math.abs(p.vx); }
  if (p.y < minY + r) { p.y = minY + r; p.vy = Math.abs(p.vy); } else if (p.y > maxY - r) { p.y = maxY - r; p.vy = -Math.abs(p.vy); }
}
function pairPush(ps, rOf, pass = 1) {
  for (let k = 0; k < pass; k++) for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
    const a = ps[i]; const b = ps[j]; if (a.fixed && b.fixed) continue;
    const dx = b.x - a.x; const dy = b.y - a.y; const d2 = dx * dx + dy * dy; const m = rOf(a) + rOf(b);
    if (d2 >= m * m || d2 < 1e-12) continue;
    const d = Math.sqrt(d2); const push = (m - d) / 2; const nx = dx / d; const ny = dy / d;
    if (!a.fixed) { a.x -= nx * push; a.y -= ny * push; } if (!b.fixed) { b.x += nx * push; b.y += ny * push; }
  }
}

export const SPECIES = {
  water: { name: "Water molecule", colour: "#4aa3ee", r: 0.017 },
  ethanol: { name: "Ethanol molecule", colour: "#35b27a", r: 0.021 },
  oil: { name: "Oil molecule (long, non-polar)", colour: "#e0a914", r: 0.026 },
  hexane: { name: "Short hydrocarbon", colour: "#9ad27a", r: 0.02 },
  decane: { name: "Medium hydrocarbon", colour: "#e1b04a", r: 0.024 },
  hexadecane: { name: "Long hydrocarbon", colour: "#b8672e", r: 0.028 },
  ion: { name: "Dissolved ion", colour: "#c0462e", r: 0.011 },
  ionPlus: { name: "Positive ion", colour: "#d0583a", r: 0.011 },
  ionMinus: { name: "Negative ion", colour: "#2f9b6d", r: 0.013 },
  grain: { name: "Sand grain (insoluble)", colour: "#cba86a", r: 0.06 },
  fibre: { name: "Paper fibre", colour: "#9aa3b2", r: 0.038 },
  iron: { name: "Iron", colour: "#6f7480", r: 0.04 },
  sulfur: { name: "Sulfur", colour: "#e5cf2a", r: 0.04 },
  iodine: { name: "Iodine molecule", colour: "#5b2f86", r: 0.026 },
  dyeYellow: { name: "Yellow dye", colour: "#f2bd0a", r: 0.022 },
  dyeRed: { name: "Red dye", colour: "#d9322e", r: 0.022 },
  dyeBlue: { name: "Blue dye", colour: "#2457c9", r: 0.022 },
  pigOrange: { name: "Orange pigment", colour: "#f08a1c", r: 0.022 },
  pigViolet: { name: "Violet pigment", colour: "#7a3fb0", r: 0.022 },
  bitumen: { name: "Residue", colour: "#3a302a", r: 0.034 },
  silica: { name: "Silicon dioxide (sand lattice)", colour: "#cba86a", r: 0.03 },
};
const sp = (id) => SPECIES[id] ?? { name: id, colour: "#888", r: 0.02 };
export const radiusOf = (p) => p.r ?? sp(p.type).r;

/** Choose the kind of particle picture for a method. */
export function kindFor(methodId) {
  return { filtration: "sieve", decanting: "sieve", "simple-distillation": "vapour", "fractional-distillation": "vapour", evaporation: "vapour", crystallisation: "crystal", sublimation: "vapour", chromatography: "chroma", magnetic: "magnet", "separating-funnel": "layers", dissolve: "dissolve" }[methodId] ?? "vapour";
}

/**
 * Build a particle view. `spec`:
 *   liquids: [{ id, n, bp }]   solutes: [{ id, n }]   solids: [{ id, n }]   (counts are particles, not grams)
 *   dyes: [{ id, rf }]         iodine: bool
 * returns { kind, particles, legend, step(dt, ctl), stats() } ; ctl: { T (degC), progress (0..1), sweep, front }
 */
export function createParticleView(kind, spec = {}, seed = 7) {
  const rng = makeRng(seed);
  const ps = [];
  const legendIds = [];
  const note = (id) => { if (!legendIds.includes(id)) legendIds.push(id); };
  const view = { kind, particles: ps, collected: 0, t: 0, escapes: {} };

  if (kind === "sieve") {
    // paper fibres with pores between them at y = 0.55; liquid + ions fall through, grains are held back
    const Y = 0.55; const pitch = 0.14; const nF = Math.floor(WORLD.w / pitch);
    for (let i = 0; i < nF; i++) { ps.push(mk(rng, "fibre", pitch / 2 + i * pitch + (WORLD.w - nF * pitch) / 2, Y, { fixed: true })); }
    note("fibre");
    const grainN = (spec.solids ?? []).reduce((a, s) => a + s.n, 0);
    (spec.solids ?? []).forEach((s) => { for (let i = 0; i < s.n; i++) ps.push(mk(rng, s.id === "sand" ? "grain" : s.id, 0.15 + rng() * 1.1, 0.04 + rng() * 0.22, { released: false, rank: rng() })); note(s.id === "sand" ? "grain" : s.id); });
    (spec.liquids ?? []).forEach((l) => { for (let i = 0; i < l.n; i++) ps.push(mk(rng, l.id, 0.06 + rng() * 1.28, 0.03 + rng() * 0.45, { released: false, rank: rng() })); note(l.id); });
    (spec.solutes ?? []).forEach((s) => { for (let i = 0; i < s.n; i++) ps.push(mk(rng, s.id, 0.06 + rng() * 1.28, 0.03 + rng() * 0.45, { released: false, rank: rng() })); note(s.id); });
    void grainN;
    view.step = (dt, ctl = {}) => {
      view.t += dt; const prog = ctl.progress ?? 1; const T = ctl.T ?? 293; const s = sigmaFor(T) * 0.12;
      for (const p of ps) {
        if (p.fixed) continue;
        p.released = p.released || p.rank <= prog;
        const r = radiusOf(p);
        if (!p.released) { p.vy = 0; p.vx = 0; jitter(p, rng, 0); continue; }
        p.vy += 0.9 * dt; jitter(p, rng, s * 0.8);
        p.vx *= 0.96; p.vy *= p.y > Y - 0.02 && p.y < Y + 0.1 ? 0.97 : 0.985;
        const sp0 = Math.hypot(p.vx, p.vy); if (sp0 > 0.5) { p.vx *= 0.5 / sp0; p.vy *= 0.5 / sp0; }
        p.x += p.vx * dt; p.y += p.vy * dt;
        // fibres block anything wider than the gap
        for (const f of ps) {
          if (!f.fixed) continue; const dx = p.x - f.x; const dy = p.y - f.y; const m = radiusOf(f) + r; const d2 = dx * dx + dy * dy;
          if (d2 < m * m) { const d = Math.sqrt(d2) || 1e-6; p.x = f.x + (dx / d) * m; p.y = f.y + (dy / d) * m; const vn = p.vx * (dx / d) + p.vy * (dy / d); if (vn < 0) { p.vx -= 1.4 * vn * (dx / d); p.vy -= 1.4 * vn * (dy / d); } }
        }
        bounce(p, r, 0, WORLD.h);
        if (p.y > WORLD.h - r - 0.004 && !p.landed) { p.landed = true; view.collected += 1; }
      }
      pairPush(ps.filter((p) => !p.fixed && p.released), radiusOf, 1);
    };
  } else if (kind === "vapour") {
    // liquid pool at the bottom, vapour above, cold ceiling where vapour condenses and drips back
    const liquidTop = 0.52;
    const volatile = (spec.liquids ?? []).concat((spec.iodine ? [{ id: "iodine", n: spec.iodineN ?? 10, bp: 60, sub: true }] : []));
    volatile.forEach((l) => { for (let i = 0; i < l.n; i++) ps.push(mk(rng, l.id, 0.05 + rng() * 1.3, liquidTop + 0.03 + rng() * 0.42, { state: l.sub ? "solid" : "liquid", bp: l.bp, sub: !!l.sub })); note(l.id); });
    (spec.solutes ?? []).forEach((s) => { for (let i = 0; i < s.n; i++) ps.push(mk(rng, s.id, 0.05 + rng() * 1.3, liquidTop + 0.05 + rng() * 0.4, { state: "liquid", bp: 9999, nonvol: true })); note(s.id); });
    (spec.solids ?? []).forEach((s) => { for (let i = 0; i < s.n; i++) ps.push(mk(rng, s.id === "sand" ? "silica" : s.id, 0.06 + rng() * 1.28, 0.86 + rng() * 0.1, { state: "liquid", bp: 9999, nonvol: true, heavy: true })); note(s.id === "sand" ? "silica" : s.id); });
    view.step = (dt, ctl = {}) => {
      view.t += dt; const Tc = ctl.T ?? 25; const Tk = Tc + 273.15; const s = sigmaFor(Tk) * 0.16;
      for (const p of ps) {
        const r = radiusOf(p);
        if (p.state === "liquid" || p.state === "solid") {
          // thermal jiggle inside the liquid; can escape from the surface layer with a probability that grows steeply near its boiling point
          jitter(p, rng, s * (p.state === "solid" ? 0.3 : 1)); p.vx *= 0.9; p.vy *= 0.9;
          p.vy += 0.25 * dt * (p.heavy ? 2 : 1);
          if (!p.nonvol && p.y < liquidTop + 0.1) {
            const base = p.sub ? 0.7 : 0.55; const k = p.sub ? 16 : 7;
            const prob = base * Math.exp((Tc - p.bp) / k) * dt;
            if (rng() < Math.min(0.9, prob)) { view.escapes[p.type] = (view.escapes[p.type] ?? 0) + 1; p.state = "gas"; p.vx = (rng() - 0.5) * 0.55; p.vy = -(0.25 + rng() * 0.35); }
          }
          p.x += p.vx * dt; p.y += p.vy * dt; bounce(p, r, liquidTop, WORLD.h);
          if (p.heavy) p.y = Math.max(p.y, 0.82);
        } else if (p.state === "gas") {
          p.vy += (rng() - 0.5) * 0.05; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < r || p.x > WORLD.w - r) { p.vx = -p.vx; p.x = clamp(p.x, r, WORLD.w - r); }
          if (p.y > liquidTop - r) { p.state = "liquid"; p.vy = 0.1; } // fell back in
          if (p.y < 0.08 + r) { p.state = "drip"; p.vy = 0.05; p.vx *= 0.1; view.collected += 1; } // condensed on the cold surface
        } else if (p.state === "drip") {
          p.vy += 0.8 * dt; p.y += p.vy * dt; p.x += p.vx * dt;
          if (p.y > liquidTop - r) { p.state = "liquid"; p.vy = 0.1; }
        }
      }
      pairPush(ps, radiusOf, 1);
      for (const p of ps) { if (p.state === "liquid") p.y = clamp(p.y, liquidTop + radiusOf(p), WORLD.h - radiusOf(p)); }
    };
  } else if (kind === "crystal") {
    // ions in solution; as the solution cools the fraction `ctl.progress` attaches to an ordered lattice on the floor
    const n = spec.ions ?? 36; const lat = []; const cols = 9; const dx = 0.052;
    for (let i = 0; i < n; i++) lat.push({ x: WORLD.w / 2 - (cols * dx) / 2 + (i % cols) * dx + 0.03, y: 0.95 - Math.floor(i / cols) * dx });
    for (let i = 0; i < n; i++) { const plus = i % 2 === 0; ps.push(mk(rng, plus ? "ionPlus" : "ionMinus", 0.05 + rng() * 1.3, 0.1 + rng() * 0.75, { site: lat[i], attached: false, rank: rng() })); }
    note("ionPlus"); note("ionMinus");
    for (let i = 0; i < (spec.water ?? 70); i++) ps.push(mk(rng, "water", 0.05 + rng() * 1.3, 0.05 + rng() * 0.9, { free: true }));
    note("water");
    view.step = (dt, ctl = {}) => {
      view.t += dt; const prog = ctl.progress ?? 0; const s = sigmaFor((ctl.T ?? 60) + 273.15) * 0.22;
      // order of attachment: lowest rank first; chequerboard sites need both ions, so rank pairs
      ps.forEach((p) => { if (p.site) p.attached = p.rank < prog; });
      for (const p of ps) {
        const r = radiusOf(p);
        if (p.attached) { p.x += (p.site.x - p.x) * Math.min(1, dt * 5); p.y += (p.site.y - p.y) * Math.min(1, dt * 5); p.vx = p.vy = 0; continue; }
        jitter(p, rng, s); p.vx *= 0.93; p.vy *= 0.93; p.x += p.vx * dt; p.y += p.vy * dt; bounce(p, r);
        if (p.site && p.y > 0.7 && p.x > 0.35 && p.x < 1.05) p.y = Math.min(p.y, 0.7); // free ions stay above the growing crystal
      }
      pairPush(ps.filter((p) => !p.attached), radiusOf, 1);
    };
  } else if (kind === "chroma") {
    // vertical paper strip: fibres on the left half, solvent molecules rising, dye molecules stick (stay) or flow with the solvent
    const cx0 = 0.35; const cx1 = 1.05;
    for (let i = 0; i < 26; i++) ps.push(mk(rng, "fibre", cx0 + rng() * (cx1 - cx0), 0.04 + rng() * 0.92, { fixed: true, r: 0.026 }));
    note("fibre");
    (spec.dyes ?? []).forEach((d, k) => { for (let i = 0; i < 6; i++) ps.push(mk(rng, d.id, cx0 + 0.05 + rng() * (cx1 - cx0 - 0.1), 0.9 + rng() * 0.04, { rf: d.rf, k, stuck: 0 })); note(d.id); });
    for (let i = 0; i < 40; i++) ps.push(mk(rng, "water", cx0 + rng() * (cx1 - cx0), 0.98 - rng() * 0.2, { solvent: true }));
    note("water");
    view.step = (dt, ctl = {}) => {
      view.t += dt; const front = ctl.front ?? 0; // 0..1 how far up the paper the solvent has risen
      const frontY = 0.96 - front * 0.9;
      for (const p of ps) {
        if (p.fixed) continue;
        const r = radiusOf(p);
        if (p.solvent) {
          p.vy = -0.18 - 0.12 * rng(); p.vx = (rng() - 0.5) * 0.2; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.y < frontY + 0.02) { p.y = frontY + 0.02 + rng() * 0.03; p.vy = 0; }
          if (p.y > 0.98) p.y = 0.98;
          if (p.x < cx0 + r) p.x = cx0 + r; if (p.x > cx1 - r) p.x = cx1 - r;
          if (rng() < dt * 0.4) p.y = Math.min(0.98, p.y + 0.15 + rng() * 0.1);
        } else {
          // a dye moves up with the solvent a fraction rf of the time: sticks to the paper the rest of the time
          const target = 0.9 - p.rf * (0.9 - frontY) * 1.0 + (p.k * 0.0);
          const dy = target - p.y; p.vy = clamp(dy * 1.6, -0.35, 0.35); p.vx = (rng() - 0.5) * 0.08; p.x += p.vx * dt; p.y += p.vy * dt;
          if (p.x < cx0 + r) p.x = cx0 + r; if (p.x > cx1 - r) p.x = cx1 - r; p.y = clamp(p.y, frontY + 0.02, 0.96);
          p.sticking = Math.abs(dy) < 0.04;
        }
      }
    };
  } else if (kind === "magnet") {
    // iron grains (magnetic) and sulfur grains on a tray; a magnet above pulls only the iron up
    const nI = spec.iron ?? 14; const nS = spec.other ?? 16;
    for (let i = 0; i < nI + nS; i++) { const iron = i < nI; ps.push(mk(rng, iron ? "iron" : (spec.otherId ?? "sulfur"), 0.12 + rng() * 1.16, 0.84 + rng() * 0.1, { magnetic: iron, rank: rng(), home: null })); }
    note("iron"); note(spec.otherId ?? "sulfur");
    view.step = (dt, ctl = {}) => {
      view.t += dt; const collected = ctl.progress ?? 0; const mx = ctl.sweep ?? 0.5; const attract = ctl.sweeping ?? false;
      for (const p of ps) {
        const r = radiusOf(p) * 0.6;
        if (p.magnetic && (p.rank < collected)) { const tx = 0.25 + (p.rank / Math.max(0.01, collected)) * 0.9; p.x += (tx - p.x) * Math.min(1, dt * 3); p.y += (0.2 + (p.rank % 0.07) * 1.2 - p.y) * Math.min(1, dt * 3); }
        else { if (p.magnetic && attract && Math.abs(p.x - mx * WORLD.w) < 0.25) { p.y -= dt * 0.12; p.y = Math.max(p.y, 0.7); } else if (p.magnetic) p.y += (0.88 - p.y) * Math.min(1, dt * 2); jitter(p, rng, 0.02); p.vx *= 0.8; p.vy *= 0.8; p.x += p.vx * dt; p.y += p.vy * dt; bounce(p, r, 0.6, WORLD.h); }
      }
      pairPush(ps, (p) => radiusOf(p) * 0.6, 1);
    };
  } else if (kind === "layers") {
    // two liquids that do not mix: polar (water) molecules attract each other (hydrogen bonds); oil molecules do not join them
    const nA = spec.polarN ?? 42; const nB = spec.nonpolarN ?? 30; const polarId = spec.polarId ?? "water"; const nonId = spec.nonpolarId ?? "oil";
    for (let i = 0; i < nA; i++) ps.push(mk(rng, polarId, rng() * WORLD.w, rng(), {}));
    for (let i = 0; i < nB; i++) ps.push(mk(rng, nonId, rng() * WORLD.w, rng(), {}));
    note(polarId); note(nonId);
    view.step = (dt, ctl = {}) => {
      view.t += dt; const settle = ctl.progress ?? 1; // 0 shaken, 1 settled
      for (const p of ps) {
        const heavy = p.type === polarId; const targetY = heavy ? 0.78 : 0.3;
        const r = radiusOf(p);
        p.vy += (targetY - p.y) * 1.3 * settle * dt; p.vx *= 0.92; p.vy *= 0.92; jitter(p, rng, 0.07 + 0.25 * (1 - settle));
        p.x += p.vx * dt; p.y += p.vy * dt; bounce(p, r);
        // keep the two liquids from crossing the boundary when settled
        if (settle > 0.6) { if (heavy && p.y < 0.5) p.y += 0.01; if (!heavy && p.y > 0.52) p.y -= 0.01; }
      }
      pairPush(ps, radiusOf, 1);
    };
  } else { // dissolve
    // a salt lattice at the bottom; ions leave it one by one and spread in the water as `progress` rises
    const n = spec.ions ?? 30; const cols = 6; const dx = 0.055;
    for (let i = 0; i < n; i++) ps.push(mk(rng, i % 2 === 0 ? "ionPlus" : "ionMinus", 0, 0, { site: { x: 0.35 + (i % cols) * dx, y: 0.95 - Math.floor(i / cols) * dx }, rank: rng() }));
    note("ionPlus"); note("ionMinus");
    for (let i = 0; i < 60; i++) ps.push(mk(rng, "water", rng() * WORLD.w, rng(), {}));
    note("water");
    for (const p of ps) if (p.site) { p.x = p.site.x; p.y = p.site.y; }
    view.step = (dt, ctl = {}) => {
      view.t += dt; const prog = ctl.progress ?? 0; const s = sigmaFor(293) * 0.2;
      for (const p of ps) {
        const r = radiusOf(p);
        if (p.site && p.rank >= prog) { p.x += (p.site.x - p.x) * Math.min(1, dt * 6); p.y += (p.site.y - p.y) * Math.min(1, dt * 6); continue; }
        jitter(p, rng, s); p.vx *= 0.93; p.vy *= 0.93; p.x += p.vx * dt; p.y += p.vy * dt; bounce(p, r);
      }
      pairPush(ps, radiusOf, 1);
    };
  }
  view.legend = legendIds.map((id) => ({ id, name: sp(id).name, colour: sp(id).colour }));
  view.stats = () => {
    const by = {}; for (const p of ps) by[p.type] = (by[p.type] ?? 0) + 1;
    const gas = ps.filter((p) => p.state === "gas" || p.state === "drip").length;
    const inside = ps.every((p) => p.x >= -0.001 && p.x <= WORLD.w + 0.001 && p.y >= -0.001 && p.y <= WORLD.h + 0.001 && Number.isFinite(p.x) && Number.isFinite(p.y));
    return { n: ps.length, by, gas, inside, collected: view.collected };
  };
  return view;
}

/** A particle spec (counts of drawn particles, not grams) for a sample. */
export function specFor(sample) {
  const spec = { liquids: [], solutes: [], solids: [], dyes: [], iodine: false };
  const drawn = (g, lo, hi, k) => Math.max(lo, Math.min(hi, Math.round(Math.sqrt(g) * k)));
  for (const p of sample.parts) {
    const s = SUBSTANCES[p.sub] ?? {};
    if (p.form === "liquid") spec.liquids.push({ id: p.sub, n: drawn(p.g, 6, 24, 3), bp: s.bp ?? 9999 });
    else if (p.form === "dissolved") { if (s.dye) spec.dyes.push({ id: p.sub, rf: s.rf?.water ?? 0.4 }); else spec.solutes.push({ id: s.ions ? "ion" : p.sub, n: drawn(p.g, 5, 14, 3) }); }
    else if (s.sublimes) { spec.iodine = true; spec.iodineN = drawn(p.g, 6, 14, 3); }
    else if (s.dye) spec.dyes.push({ id: p.sub, rf: s.rf?.water ?? 0.4 });
    else spec.solids.push({ id: p.sub, n: drawn(p.g, 3, 9, 1.2) });
  }
  return spec;
}
