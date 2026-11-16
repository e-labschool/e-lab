// Particle world for the neutralisation visualiser (pure, framework-free). Everything lives INSIDE the liquid rectangles.
// Illustrative: ions wander randomly; each H+/OH- pair is scheduled to meet one after another (not a collision-rate model).
export const TYPES = {
  H: { label: "H\u207A", colour: "#c2410c", r: 11 }, OH: { label: "OH\u207B", colour: "#3654d6", r: 12 },
  NA: { label: "Na\u207A", colour: "#0f766e", r: 12 }, CL: { label: "Cl\u207B", colour: "#7e3fb0", r: 12 }, W: { label: "H\u2082O", colour: "#4b7bb5", r: 11 },
};
export const BEAKERS = { left: { x: 40, y: 170, w: 220, h: 170 }, right: { x: 340, y: 170, w: 220, h: 170 }, mixed: { x: 150, y: 150, w: 300, h: 190 } };
const SPEED = 38; const PAIR_START = 0.9; const PAIR_GAP = 0.75; const PAIR_SPEED = 90;
const rnd = (a, b) => a + Math.random() * (b - a);

function make(id, type, b) {
  const r = TYPES[type].r; const a = rnd(0, Math.PI * 2);
  return { id, type, x: rnd(b.x + r, b.x + b.w - r), y: rnd(b.y + r, b.y + b.h - r), vx: Math.cos(a) * SPEED, vy: Math.sin(a) * SPEED, state: "free", partner: null };
}

export function createWorld(nA, nB) {
  const ps = []; let i = 0;
  for (let k = 0; k < nA; k += 1) ps.push(make(`h${i++}`, "H", BEAKERS.left));
  for (let k = 0; k < nA; k += 1) ps.push(make(`c${i++}`, "CL", BEAKERS.left));
  for (let k = 0; k < nB; k += 1) ps.push(make(`n${i++}`, "NA", BEAKERS.right));
  for (let k = 0; k < nB; k += 1) ps.push(make(`o${i++}`, "OH", BEAKERS.right));
  separate(ps, 60);
  for (const p of ps) clampIn(p, boundsFor(p, "separate"));
  return { stage: "separate", t: 0, particles: ps, pairs: [], reacted: 0, nextWater: 0 };
}
export const boundsFor = (p, stage) => (stage === "separate" ? (p.type === "H" || p.type === "CL" ? BEAKERS.left : BEAKERS.right) : BEAKERS.mixed);

function separate(ps, iterations = 1) {
  for (let it = 0; it < iterations; it += 1) {
    for (let i = 0; i < ps.length; i += 1) for (let j = i + 1; j < ps.length; j += 1) {
      const a = ps[i], b = ps[j]; if (a.state === "pairing" && b.state === "pairing" && a.partner === b.id) continue;
      const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const min = TYPES[a.type].r + TYPES[b.type].r + 2;
      if (d < min) { const o = ((min - d) / 2) * (iterations > 1 ? 1 : 0.5); const nx = dx / d, ny = dy / d; a.x -= nx * o; a.y -= ny * o; b.x += nx * o; b.y += ny * o; }
    }
  }
}
function clampIn(p, b) { const r = TYPES[p.type].r; p.x = Math.min(b.x + b.w - r, Math.max(b.x + r, p.x)); p.y = Math.min(b.y + b.h - r, Math.max(b.y + r, p.y)); }

/** Pour: move every particle proportionally into the mixed beaker and plan the pairs (one H+ with one OH-). */
export function startMix(w) {
  for (const p of w.particles) {
    const from = boundsFor(p, "separate"); const to = BEAKERS.mixed;
    p.x = to.x + ((p.x - from.x) / from.w) * to.w; p.y = to.y + ((p.y - from.y) / from.h) * to.h;
  }
  separate(w.particles, 40);
  for (const p of w.particles) clampIn(p, BEAKERS.mixed);
  const hs = w.particles.filter((p) => p.type === "H"); const os = w.particles.filter((p) => p.type === "OH");
  w.pairs = []; const n = Math.min(hs.length, os.length);
  for (let k = 0; k < n; k += 1) { w.pairs.push({ h: hs[k].id, o: os[k].id, start: PAIR_START + k * PAIR_GAP, done: false }); }
  w.stage = "mixing"; w.t = 0;
}

export function stepWorld(w, dt, reducedMotion = false) {
  const ps = w.particles; const byId = new Map(ps.map((p) => [p.id, p]));
  if (w.stage === "mixing") {
    w.t += dt;
    for (const pr of w.pairs) {
      if (pr.done) continue;
      const h = byId.get(pr.h), o = byId.get(pr.o);
      if (w.t >= pr.start || reducedMotion) {
        h.state = "pairing"; o.state = "pairing"; h.partner = o.id; o.partner = h.id;
        const dx = o.x - h.x, dy = o.y - h.y; const d = Math.hypot(dx, dy);
        const step = reducedMotion ? 1e9 : PAIR_SPEED * dt;
        if (d <= TYPES.H.r + TYPES.OH.r + 2 || step >= d) {
          const x = (h.x + o.x) / 2, y = (h.y + o.y) / 2; pr.done = true; w.reacted += 1;
          w.particles = w.particles.filter((p) => p.id !== h.id && p.id !== o.id);
          w.particles.push({ id: `w${w.nextWater++}`, type: "W", x, y, vx: rnd(-1, 1) * SPEED * 0.5, vy: rnd(-1, 1) * SPEED * 0.5, state: "free", partner: null });
          return stepWorld(w, 0, reducedMotion);
        }
        const ux = dx / d, uy = dy / d; h.x += ux * step; h.y += uy * step; o.x -= ux * step; o.y -= uy * step;
      }
    }
    if (w.pairs.every((p) => p.done)) w.stage = "done";
  }
  for (const p of w.particles) {
    if (p.state === "pairing") continue;
    p.x += p.vx * dt; p.y += p.vy * dt; const b = boundsFor(p, w.stage); const r = TYPES[p.type].r;
    if (p.x < b.x + r) { p.x = b.x + r; p.vx = Math.abs(p.vx); } if (p.x > b.x + b.w - r) { p.x = b.x + b.w - r; p.vx = -Math.abs(p.vx); }
    if (p.y < b.y + r) { p.y = b.y + r; p.vy = Math.abs(p.vy); } if (p.y > b.y + b.h - r) { p.y = b.y + b.h - r; p.vy = -Math.abs(p.vy); }
  }
  separate(w.particles.filter((p) => p.state !== "pairing"), 2);
  for (const p of w.particles) clampIn(p, boundsFor(p, w.stage));
  return w;
}
