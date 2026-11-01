// Orbital SURFACES as pure functions (no React, no three): the signed polar radius r(direction) of an orbital or hybrid, its lobe
// structure, the blended surface used by the Mix animation and the volumes used by the overlap measure.
//
//   f(dir)  = sum_k c_k * angular_k(dir)            (real spherical harmonics; hybrids are linear combinations of them)
//   r(dir)  = R * sign(f) * (|f| / max|f|)^K        K depends on the orbital class (SURFACE_K in orbitals.js)
//
// The SIGN of f is the phase of the wavefunction in that lobe (it is NOT an electric charge). The drawn point is dir * |r|.
// These are polar plots of the angular part only: an educational representation, not a probability surface.
import { combination, SURFACE_K, classOfTerms, typeOf } from "./orbitals.js";
import { normalize, add, scale } from "./vec.js";

// ---- sampling directions on the unit sphere (Fibonacci lattice) -------------------------------------------------------
function fibonacci(n) {
  const pts = []; const ga = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < n; i += 1) { const y = 1 - (2 * (i + 0.5)) / n; const r = Math.sqrt(1 - y * y); const th = ga * i; pts.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
  return pts;
}
export const SPHERE_DIRS = fibonacci(1600);

export const termsKey = (terms) => terms.map(([k, c]) => `${k}:${c.toFixed(5)}`).join("+");

const gmaxCache = new Map();
/** max |f| over the sphere, refined by hill climbing (so the ratio of two lobes is accurate to ~1e-6). */
export function angularMax(terms) {
  const key = termsKey(terms); const hit = gmaxCache.get(key); if (hit !== undefined) return hit;
  let best = SPHERE_DIRS[0]; let bv = -1;
  for (const p of SPHERE_DIRS) { const v = Math.abs(combination(terms, p[0], p[1], p[2])); if (v > bv) { bv = v; best = p; } }
  let cur = best; let step = 0.1;
  for (let it = 0; it < 120 && step > 1e-8; it += 1) {
    let moved = false;
    for (const t of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      const c = normalize(add(cur, scale(t, step))); const v = Math.abs(combination(terms, c[0], c[1], c[2]));
      if (v > bv + 1e-15) { bv = v; cur = c; moved = true; }
    }
    if (!moved) step *= 0.5;
  }
  gmaxCache.set(key, bv); return bv;
}

/** Signed radius from a raw angular value. */
export function radiusFromAngular(g, gmax, R, k) {
  if (gmax <= 0) return 0;
  const q = g / gmax; return Math.sign(q) * Math.pow(Math.abs(q), k) * R;
}

/** A surface description: terms [[kind, c]...], class ("s"|"p"|"d"|"hybrid"), reach R and exponent k. */
export function makeSurface(terms, cls = classOfTerms(terms), R = 1, k = SURFACE_K[cls]) {
  const gmax = angularMax(terms);
  return {
    terms, cls, R, k, gmax,
    f: (x, y, z) => combination(terms, x, y, z),
    /** signed radius in the unit direction (x, y, z) */
    at: (x, y, z) => radiusFromAngular(combination(terms, x, y, z), gmax, R, k),
  };
}

/** Tangent/peak directions of the sign regions: { pos: {dir, r}, neg: {dir, r} } (largest |r| in each phase), null when absent. */
export function lobePeaks(surface) {
  const best = { pos: null, neg: null };
  for (const p of SPHERE_DIRS) {
    const r = surface.at(p[0], p[1], p[2]);
    const key = r >= 0 ? "pos" : "neg"; const m = Math.abs(r);
    if (!best[key] || m > best[key].r) best[key] = { dir: p, r: m };
  }
  // refine the peak directions with the same hill climb as angularMax, restricted to the sign
  for (const key of ["pos", "neg"]) {
    const b = best[key]; if (!b) continue;
    let cur = b.dir; let bv = b.r; let step = 0.06;
    for (let it = 0; it < 120 && step > 1e-8; it += 1) {
      let moved = false;
      for (const t of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
        const c = normalize(add(cur, scale(t, step))); const r = surface.at(c[0], c[1], c[2]);
        if ((r >= 0) === (key === "pos") && Math.abs(r) > bv + 1e-15) { bv = Math.abs(r); cur = c; moved = true; }
      }
      if (!moved) step *= 0.5;
    }
    best[key] = { dir: cur, r: bv };
  }
  return best;
}

/** Volume enclosed by each phase of the surface, (1/3) * integral r^3 dOmega: { pos, neg, total }. Cached by key. */
const volCache = new Map();
export function lobeVolumes(surface) {
  const key = `${termsKey(surface.terms)}|${surface.R.toFixed(4)}|${surface.k}`; const hit = volCache.get(key); if (hit) return hit;
  let pos = 0; let neg = 0;
  for (const p of SPHERE_DIRS) { const r = surface.at(p[0], p[1], p[2]); const v = Math.abs(r) ** 3; if (r >= 0) pos += v; else neg += v; }
  const w = (4 * Math.PI) / SPHERE_DIRS.length / 3;
  const out = { pos: pos * w, neg: neg * w, total: (pos + neg) * w }; volCache.set(key, out); return out;
}

/** Number of separate phase regions of the surface: s = 1, p = 2, sp/sp2/sp3 hybrid = 2 (one large + one small), dxy = 4, dz2 = 3 (two lobes + the ring/torus). */
export function lobeCount(terms) {
  const nT = 40; const nP = 80; const lab = new Int32Array(nT * nP).fill(-1);
  const sgn = new Int8Array(nT * nP); const max = angularMax(terms);
  const tol = max * 1e-3; // a vanishing amplitude at a node counts as no lobe
  for (let i = 0; i < nT; i += 1) for (let j = 0; j < nP; j += 1) {
    const th = (Math.PI * (i + 0.5)) / nT; const ph = (2 * Math.PI * (j + 0.5)) / nP;
    const v = combination(terms, Math.sin(th) * Math.cos(ph), Math.sin(th) * Math.sin(ph), Math.cos(th));
    sgn[i * nP + j] = Math.abs(v) < tol ? 0 : v > 0 ? 1 : -1;
  }
  let count = 0;
  for (let s = 0; s < nT * nP; s += 1) {
    if (lab[s] >= 0 || sgn[s] === 0) continue;
    const stack = [s]; lab[s] = count;
    while (stack.length) {
      const c = stack.pop(); const i = Math.floor(c / nP); const j = c % nP;
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const ii = i + di; if (ii < 0 || ii >= nT) continue; const jj = (j + dj + nP) % nP; const n = ii * nP + jj;
        if (lab[n] < 0 && sgn[n] === sgn[s]) { lab[n] = count; stack.push(n); }
      }
    }
    count += 1;
  }
  return count;
}

// ---- the Mix animation: a genuine interpolation of the surface FUNCTION --------------------------------------------------
const lerp1 = (a, b, t) => a + (b - a) * t;
/** Coefficient blend (1-t) * source + t * target over kinds: the angular function itself is interpolated, so the lobes grow
 *  out of the atomic orbitals (a p dumbbell gains s character on one side and loses it on the other, an s sphere gains p
 *  character and acquires a direction). t = 0 is exactly the source orbital, t = 1 exactly the hybrid. */
export function blendTerms(sourceTerms, targetTerms, t) {
  const m = new Map();
  for (const [k, c] of sourceTerms) m.set(k, (m.get(k) ?? 0) + (1 - t) * c);
  for (const [k, c] of targetTerms) m.set(k, (m.get(k) ?? 0) + t * c);
  return [...m.entries()].filter(([, c]) => Math.abs(c) > 1e-12);
}
/** Parameters of the surface at morph parameter t: terms, reach, exponent and class (class flips from source to target at t = 1). */
export function blendedSurfaceParams(source, target, t) {
  return {
    terms: blendTerms(source.terms, target.terms, t), R: lerp1(source.R, target.R, t),
    k: lerp1(source.k ?? SURFACE_K[source.cls], target.k ?? SURFACE_K[target.cls], t),
  };
}
/** Morph easing with a short highlight hold at the start and a short settle at the end: 0 for the first 14 %, 1 for the last 8 %. */
export function morphParameter(progress) {
  const x = Math.min(1, Math.max(0, (progress - 0.14) / (1 - 0.14 - 0.08)));
  return x * x * (3 - 2 * x);
}

export { SURFACE_K, classOfTerms, typeOf };

/** Centres of the separate lobes: local maxima of |r| over a coarse sphere sampling -> [{dir, r, phase: +1|-1}], strongest first. Used for the optional +/- phase markers. */
const COARSE = fibonacci(420);
export function lobeCentres(surface, minRel = 0.22) {
  const vals = COARSE.map((p) => surface.at(p[0], p[1], p[2])); const max = Math.max(...vals.map(Math.abs)); const out = [];
  if (max <= 0) return out;
  const cosLim = Math.cos(0.42);
  for (let i = 0; i < COARSE.length; i += 1) {
    const m = Math.abs(vals[i]); if (m < minRel * max) continue;
    let isMax = true;
    for (let j = 0; j < COARSE.length && isMax; j += 1) {
      if (j === i) continue; const q = COARSE[j]; const p = COARSE[i];
      if (p[0] * q[0] + p[1] * q[1] + p[2] * q[2] > cosLim && Math.abs(vals[j]) > m + 1e-12 && (vals[j] >= 0) === (vals[i] >= 0)) isMax = false;
    }
    if (isMax) out.push({ dir: COARSE[i], r: m, phase: vals[i] >= 0 ? 1 : -1 });
  }
  return out.sort((a, b) => b.r - a.r);
}
