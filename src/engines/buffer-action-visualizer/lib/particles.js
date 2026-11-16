// Particle sample for one beaker. Positions live in a ref (the component redraws per frame); the rules are:
//  * an added H+/OH- is a "seeker" that flies to a real partner particle (base form for H+, acid form for OH-) and reacts,
//  * once no seeker is in flight, the sample is reconciled IN PLACE to the chemistry (flip kinds / add / remove free ions),
//    so the picture can never contradict the pH shown and no stray ion is left behind.
const SPEED = 36; const R = { acid: 13, base: 13, spectator: 8, H: 9, OH: 9, water: 7 };
export const BOUNDS = { x: 10, y: 77, w: 220, h: 165 };
const rnd = (a, b) => a + Math.random() * (b - a);
let uid = 0;
export function make(kind, near) {
  const a = rnd(0, Math.PI * 2);
  return { id: `p${uid++}`, kind, x: near ? near.x : rnd(BOUNDS.x + R[kind] + 2, BOUNDS.x + BOUNDS.w - R[kind] - 2), y: near ? near.y : rnd(BOUNDS.y + R[kind] + 2, BOUNDS.y + BOUNDS.h - R[kind] - 2), vx: Math.cos(a) * SPEED * rnd(0.7, 1.3), vy: Math.sin(a) * SPEED * rnd(0.7, 1.3), seek: null, flash: 0, glow: 0 };
}
export function createSample(counts, spectators = 3, free = { H: 0, OH: 0 }) {
  const ps = []; for (let i = 0; i < counts.acid; i += 1) ps.push(make("acid")); for (let i = 0; i < counts.base; i += 1) ps.push(make("base"));
  for (let i = 0; i < spectators; i += 1) ps.push(make("spectator")); for (let i = 0; i < free.H; i += 1) ps.push(make("H")); for (let i = 0; i < free.OH; i += 1) ps.push(make("OH"));
  relax(ps, 80); return ps;
}
function relax(ps, n) { for (let k = 0; k < n; k += 1) separate(ps); }
function separate(ps) {
  for (let i = 0; i < ps.length; i += 1) for (let j = i + 1; j < ps.length; j += 1) {
    const a = ps[i], b = ps[j]; if (a.seek || b.seek) continue; const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const min = R[a.kind] + R[b.kind] + 1;
    if (d < min) { const o = (min - d) / 2; a.x -= (dx / d) * o; a.y -= (dy / d) * o; b.x += (dx / d) * o; b.y += (dy / d) * o; }
  }
  for (const p of ps) { const r = R[p.kind]; p.x = Math.min(BOUNDS.x + BOUNDS.w - r, Math.max(BOUNDS.x + r, p.x)); p.y = Math.min(BOUNDS.y + BOUNDS.h - r, Math.max(BOUNDS.y + r, p.y)); }
}
/** Release one seeker of `kind` ("H" | "OH") from the top of the beaker, aimed at the nearest valid partner. */
export function addSeeker(ps, kind) {
  const s = make(kind, { x: rnd(BOUNDS.x + 40, BOUNDS.x + BOUNDS.w - 40), y: BOUNDS.y + 4 });
  const want = kind === "H" ? "base" : "acid";
  let best = null; let bd = Infinity; for (const p of ps) if (p.kind === want && !p.taken) { const d = Math.hypot(p.x - s.x, p.y - s.y); if (d < bd) { bd = d; best = p; } }
  if (best) { best.taken = true; s.seek = best.id; }
  ps.push(s); return s;
}
export function step(ps, dt, reduced) {
  const byId = new Map(ps.map((p) => [p.id, p])); const gone = new Set();
  for (const p of ps) {
    p.flash = Math.max(0, p.flash - dt); p.glow = Math.max(0, p.glow - dt);
    if (p.seek) {
      const t = byId.get(p.seek); if (!t) { p.seek = null; continue; }
      const dx = t.x - p.x, dy = t.y - p.y; const d = Math.hypot(dx, dy); const sp = 120 * dt;
      if (d < R[t.kind] + R[p.kind] || sp >= d || reduced) { gone.add(p.id); t.taken = false; t.flash = 0.7; if (p.kind === "OH") ps.push({ ...make("water", { x: t.x, y: t.y }), glow: 0.8 }); }
      else { p.x += (dx / d) * sp; p.y += (dy / d) * sp; }
      continue;
    }
    if (reduced) continue;
    p.x += p.vx * dt; p.y += p.vy * dt; const r = R[p.kind];
    if (p.x < BOUNDS.x + r) { p.x = BOUNDS.x + r; p.vx = Math.abs(p.vx); } if (p.x > BOUNDS.x + BOUNDS.w - r) { p.x = BOUNDS.x + BOUNDS.w - r; p.vx = -Math.abs(p.vx); }
    if (p.y < BOUNDS.y + r) { p.y = BOUNDS.y + r; p.vy = Math.abs(p.vy); } if (p.y > BOUNDS.y + BOUNDS.h - r) { p.y = BOUNDS.y + BOUNDS.h - r; p.vy = -Math.abs(p.vy); }
  }
  let out = ps.filter((p) => !gone.has(p.id));
  // water fades: shrink away after its glow
  out = out.filter((p) => p.kind !== "water" || p.glow > 0);
  const flying = out.some((p) => p.seek); // the caller reconciles the sample to the chemistry once nothing is in flight
  separate(out.filter((p) => !p.seek));
  ps.length = 0; for (const p of out) ps.push(p);
  return flying;
}
/** Bring the sample to the chemistry: exact counts of acid/base forms and free ions; flips in place, never rebuilds. */
export function reconcile(ps, target) {
  const count = (k) => ps.filter((p) => p.kind === k).length;
  let acid = count("acid"), base = count("base");
  while (acid < target.acid && base > target.base) { const p = ps.find((q) => q.kind === "base"); p.kind = "acid"; p.flash = 0.5; acid += 1; base -= 1; }
  while (base < target.base && acid > target.acid) { const p = ps.find((q) => q.kind === "acid"); p.kind = "base"; p.flash = 0.5; base += 1; acid -= 1; }
  for (const k of ["H", "OH"]) {
    let n = count(k); const want = target.free[k];
    while (n < want) { ps.push(make(k)); n += 1; }
    while (n > want) { const i = ps.findIndex((q) => q.kind === k && !q.seek); if (i < 0) break; ps.splice(i, 1); n -= 1; }
  }
}
