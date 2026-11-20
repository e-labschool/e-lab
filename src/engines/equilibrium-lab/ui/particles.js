// Display-only particle system for the vessel.  It never decides chemistry: it
//   * mirrors the whole-molecule counts that model/visual.js derives from the engine (reconcile), and
//   * animates each drawn reaction event with its REAL stoichiometry (nu reactants converge, nu products appear), so every
//     animated event conserves atoms.
// Positions are normalised to the vessel interior (0..1) so a volume change compresses/expands the picture without moving the molecules'
// bookkeeping.  Pure data + functions (no React, no canvas) so it can be unit-tested.
import { REACTIONS } from "../model/reactions.js";

export const CONVERGE_S = 0.36;        // reactants slide together
export const FADE_S = 0.28;

let uid = 1;
export function createSystem(seed = 1) { return { parts: [], pending: [], flashes: [], lastSeq: 0, rng: seed >>> 0 || 1, shownRid: null }; }

// small LCG: the picture only needs "random-looking", not the model's PRNG
const rnd = (sys) => { sys.rng = (Math.imul(sys.rng, 1664525) + 1013904223) >>> 0; return sys.rng / 4294967296; };

function newParticle(sys, species, x, y, fade = true) {
  const a = rnd(sys) * Math.PI * 2; const sp = 0.07 + rnd(sys) * 0.1;
  return { id: uid++, sp: species, x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, yaw: rnd(sys) * 6.28, pitch: rnd(sys) * 6.28, wy: (rnd(sys) - 0.5) * 2.2, wp: (rnd(sys) - 0.5) * 2.2, alpha: fade ? 0 : 1, dying: null };
}

export const countsOf = (sys) => { const c = {}; for (const p of sys.parts) if (!p.dying) c[p.sp] = (c[p.sp] ?? 0) + 1; for (const q of sys.pending) c[q.sp] = (c[q.sp] ?? 0) + 1; return c; };

/** Add / remove particles until the displayed counts equal `counts` (species not in `counts` disappear). */
export function reconcile(sys, counts, rid) {
  if (sys.shownRid !== rid) { sys.parts = []; sys.pending = []; sys.flashes = []; sys.shownRid = rid; }
  const have = countsOf(sys);
  for (const id of Object.keys({ ...have, ...counts })) {
    let diff = (counts[id] ?? 0) - (have[id] ?? 0);
    while (diff > 0) { sys.parts.push(newParticle(sys, id, 0.08 + rnd(sys) * 0.84, 0.08 + rnd(sys) * 0.84)); diff -= 1; }
    while (diff < 0) {
      const i = sys.pending.findIndex((q) => q.sp === id);
      if (i >= 0) sys.pending.splice(i, 1); else { const k = sys.parts.findIndex((p) => p.sp === id && !p.dying); if (k < 0) break; sys.parts.splice(k, 1); }
      diff += 1;
    }
  }
}

/** Animate the drawn reaction events with seq > lastSeq.  `events` come from vis.recent. */
export function processEvents(sys, events, rid, now, instant = false) {
  const rx = REACTIONS[rid]; let handled = 0;
  for (const ev of events) {
    if (ev.seq <= sys.lastSeq) continue; sys.lastSeq = ev.seq; handled += 1;
    const forward = ev.dir === "f"; const take = []; const make = [];
    for (const s of rx.species) { const n = rx.nu[s.id]; if (n === 0) continue; if ((n < 0) === forward) take.push([s.id, Math.abs(n)]); else make.push([s.id, Math.abs(n)]); }
    // choose the molecules that react: a random first one, the others nearest to it
    const chosen = []; let cx = 0; let cy = 0;
    const anchor = (() => { const pool = sys.parts.filter((p) => !p.dying && p.sp === take[0][0]); return pool.length ? pool[Math.floor(rnd(sys) * pool.length)] : null; })();
    if (!anchor) continue;
    for (const [id, need] of take) {
      const pool = sys.parts.filter((p) => !p.dying && p.sp === id && !chosen.includes(p)).sort((a, b) => ((a.x - anchor.x) ** 2 + (a.y - anchor.y) ** 2) - ((b.x - anchor.x) ** 2 + (b.y - anchor.y) ** 2));
      for (let k = 0; k < need && k < pool.length; k += 1) chosen.push(pool[k]);
    }
    for (const p of chosen) { cx += p.x; cy += p.y; } cx /= chosen.length; cy /= chosen.length;
    for (const p of chosen) {
      if (instant) { sys.parts.splice(sys.parts.indexOf(p), 1); } else p.dying = { x: cx, y: cy, t: 0 };
    }
    let j = 0;
    for (const [id, n] of make) for (let k = 0; k < n; k += 1) {
      const ang = (j / Math.max(1, make.reduce((a, [, m]) => a + m, 0))) * Math.PI * 2 + rnd(sys); j += 1;
      const q = { sp: id, x: Math.min(0.95, Math.max(0.05, cx + Math.cos(ang) * 0.02)), y: Math.min(0.95, Math.max(0.05, cy + Math.sin(ang) * 0.02)), at: now + (instant ? 0 : CONVERGE_S), ang };
      sys.pending.push(q);
    }
    sys.flashes.push({ x: cx, y: cy, t: instant ? 0.4 : 0, forward });
  }
  return handled;
}

/** Advance motion by dt seconds.  `heat` scales speed (sqrt(T / T_ref)); `slow` for solutions. */
export function update(sys, dt, now, { heat = 1, slow = 1, still = false } = {}) {
  // spawn products whose reactants have arrived
  for (let i = sys.pending.length - 1; i >= 0; i -= 1) {
    const q = sys.pending[i]; if (q.at > now) continue;
    const p = newParticle(sys, q.sp, q.x, q.y, true); const sp = 0.12; p.vx = Math.cos(q.ang) * sp; p.vy = Math.sin(q.ang) * sp; sys.parts.push(p); sys.pending.splice(i, 1);
  }
  const k = heat * slow;
  for (let i = sys.parts.length - 1; i >= 0; i -= 1) {
    const p = sys.parts[i];
    if (p.dying) {
      p.dying.t += dt; const f = Math.min(1, p.dying.t / CONVERGE_S); const e = f * f * (3 - 2 * f);
      p.x += (p.dying.x - p.x) * Math.min(1, e * 0.35 + dt * 8); p.y += (p.dying.y - p.y) * Math.min(1, e * 0.35 + dt * 8);
      if (p.dying.t >= CONVERGE_S) sys.parts.splice(i, 1);
      continue;
    }
    if (p.alpha < 1) p.alpha = Math.min(1, p.alpha + dt / FADE_S);
    if (still) continue;
    p.x += p.vx * k * dt; p.y += p.vy * k * dt; p.yaw += p.wy * dt; p.pitch += p.wp * dt;
    if (p.x < 0.05) { p.x = 0.05; p.vx = Math.abs(p.vx); } else if (p.x > 0.95) { p.x = 0.95; p.vx = -Math.abs(p.vx); }
    if (p.y < 0.05) { p.y = 0.05; p.vy = Math.abs(p.vy); } else if (p.y > 0.95) { p.y = 0.95; p.vy = -Math.abs(p.vy); }
  }
  for (let i = sys.flashes.length - 1; i >= 0; i -= 1) { sys.flashes[i].t += dt; if (sys.flashes[i].t > 0.55) sys.flashes.splice(i, 1); }
}

/** Qualitative tint of the gas / solution from the engine's concentrations (colour is an aid, never the only cue). */
export function tintFor(rid, c) {
  switch (rid) {
    case "n2o4": { const a = Math.min(0.5, 0.5 * (c.NO2 ?? 0) / 0.16); return { r: 150, g: 82, b: 30, a }; }
    case "hi": { const a = Math.min(0.42, 0.42 * (c.I2 ?? 0) / 0.2); return { r: 112, g: 40, b: 190, a }; }
    case "fescn": { const red = Math.min(0.62, 0.62 * (c.FeSCN ?? 0) / 0.006); const yel = Math.min(0.2, 0.2 * (c.Fe3 ?? 0) / 0.01); return red >= yel ? { r: 200, g: 30, b: 30, a: red + 0.06 } : { r: 232, g: 190, b: 40, a: yel }; }
    default: return { r: 120, g: 160, b: 255, a: 0.06 };
  }
}
