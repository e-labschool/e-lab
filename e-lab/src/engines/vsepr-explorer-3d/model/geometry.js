// VSEPR geometry engine: PURE (no React, no three). Educational model, NOT a calculation of real electron forces or
// molecular energies.
//
//   * names / AXE notation / domain counting       classify(b, l)
//   * ideal target direction sets per domain count idealSlots(n), buildSlots(b, l)
//   * assignment of domains to slots               assign / fit (minimum total displacement, deterministic)
//   * relaxation                                   createSim / syncDomains / stepSim / dragDomain / releaseDomain
//   * angles                                       angleBetween, pairAngles
//
// How the relaxation works (see docs/VSEPR_EXPLORER.md):
//   Every electron domain (a bonding domain of ANY bond order, or a lone pair) is one unit direction from the fixed
//   central atom. The reference arrangement is an ideal slot set for the number of domains (2 linear, 3 trigonal planar,
//   4 tetrahedral, 5 trigonal bipyramidal, 6 octahedral). Lone pairs take the slots VSEPR prefers (equatorial in a
//   bipyramid, trans in an octahedron) and the bonding slots are slightly compressed away from the lone pairs, so the
//   LP-containing shapes show the familiar ~107 / ~104.5 / ~102 ... degrees. A rigid frame R orients the slot set.
//   Each domain is a critically damped spring toward its assigned slot. While one domain is dragged (pinned to the
//   pointer direction) the others receive an extra push away from it that is the INCREASE of a pair repulsion over its
//   resting value, weighted LP-LP > LP-BP > BP-BP. A minimum angular separation is enforced so domains never overlap.
//   On release the assignment of domains to slots is re-evaluated once (with hysteresis) and everything relaxes.
export const MAX_DOMAINS = 6;
export const MAX_LONE_PAIRS = { 0: 0, 1: 0, 2: 1, 3: 2, 4: 3, 5: 3, 6: 2 };

const SUB = "₀₁₂₃₄₅₆₇₈₉";
export const subscript = (n) => String(n).split("").map((d) => SUB[Number(d)]).join("");
export const toSubscripts = (s) => String(s).replace(/\d+/g, (m) => subscript(m));

export const ED_NAMES = { 1: "Single domain", 2: "Linear", 3: "Trigonal planar", 4: "Tetrahedral", 5: "Trigonal bipyramidal", 6: "Octahedral" };

const MG_TABLE = {
  "2,0": "Linear", "3,0": "Trigonal planar", "4,0": "Tetrahedral", "5,0": "Trigonal bipyramidal", "6,0": "Octahedral",
  "2,1": "Bent", "3,1": "Trigonal pyramidal", "4,1": "Seesaw", "5,1": "Square pyramidal",
  "2,2": "Bent", "3,2": "T-shaped", "4,2": "Square planar",
  "2,3": "Linear",
};
/** Molecular geometry name from b bonding domains and l lone-pair domains on the central atom (null when there is no shape). */
export function molecularGeometryName(b, l) {
  if (b <= 0) return null;
  if (b === 1) return "Linear";
  return MG_TABLE[`${b},${l}`] ?? null;
}
export function electronDomainName(n) { return ED_NAMES[n] ?? null; }
/** AXE notation, e.g. "AX₃E". */
export function axeNotation(b, l) {
  return `AX${b > 1 ? subscript(b) : ""}${l > 0 ? `E${l > 1 ? subscript(l) : ""}` : ""}`;
}
export const axePlain = (b, l) => `AX${b > 1 ? b : ""}${l > 0 ? `E${l > 1 ? l : ""}` : ""}`;
export const isSupportedCombination = (b, l) => b >= 1 && b + l >= 2 && b + l <= MAX_DOMAINS && l <= (MAX_LONE_PAIRS[b + l] ?? 0);

// ---------------------------------------------------------------------------------------------------------------
// Slot sets
// ---------------------------------------------------------------------------------------------------------------
const S3 = Math.sqrt(3) / 2;
const R3 = 1 / Math.sqrt(3);
/** Ideal (uncompressed) unit-vector sets. For n = 5 the first two are axial; the rest equatorial. */
export function idealSlots(n) {
  switch (n) {
    case 1: return [[0, 0, 1]];
    case 2: return [[0, 0, 1], [0, 0, -1]];
    case 3: return [[1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]];
    case 4: return [[R3, R3, R3], [R3, -R3, -R3], [-R3, R3, -R3], [-R3, -R3, R3]];
    case 5: return [[0, 0, 1], [0, 0, -1], [1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]];
    case 6: return [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
    default: return [];
  }
}
const rad = (d) => (d * Math.PI) / 180;
const sph = (polarDeg, azDeg) => { const p = rad(polarDeg); const a = rad(azDeg); return [Math.sin(p) * Math.cos(a), Math.sin(p) * Math.sin(a), Math.cos(p)]; };

/** Illustrative reference angles used to compress the bonding slots away from lone pairs (they match the usual experimental values). */
export const MODEL_ANGLES = { trigonalPyramidal: 107, bent4: 104.5, lpLp4: 115, bent3: 118, seesawAxial: 173.1, seesawEq: 101.6, tShapeAxEq: 87.5, sqPyramidBasal: 84.8 };

/**
 * Slot set for b bonding + l lone-pair domains: { dirs, roles }, roles[i] = "bond" | "lp".
 * Lone pairs take the VSEPR-preferred positions of the ideal set, then the bonding slots are bent away from them.
 */
export function buildSlots(b, l) {
  const n = b + l;
  const A = MODEL_ANGLES;
  if (n === 3 && l === 1) {
    const a = A.bent3 / 2;
    return { dirs: [[-Math.cos(rad(a)), Math.sin(rad(a)), 0], [-Math.cos(rad(a)), -Math.sin(rad(a)), 0], [1, 0, 0]], roles: ["bond", "bond", "lp"] };
  }
  if (n === 4 && l === 1) {
    const cp = -Math.sqrt((((Math.cos(rad(A.trigonalPyramidal)) + 0.5) / 1.5)));
    const p = (Math.acos(cp) * 180) / Math.PI;
    return { dirs: [sph(p, 0), sph(p, 120), sph(p, 240), [0, 0, 1]], roles: ["bond", "bond", "bond", "lp"] };
  }
  if (n === 4 && l === 2) {
    const h = rad(A.bent4 / 2); const f = rad(A.lpLp4 / 2);
    return { dirs: [[Math.sin(h), 0, -Math.cos(h)], [-Math.sin(h), 0, -Math.cos(h)], [0, Math.sin(f), Math.cos(f)], [0, -Math.sin(f), Math.cos(f)]], roles: ["bond", "bond", "lp", "lp"] };
  }
  if (n === 5 && l === 1) { // seesaw: lone pair equatorial at +x
    const d = rad((180 - A.seesawAxial) / 2); const a = rad(A.seesawEq / 2);
    return {
      dirs: [[-Math.sin(d), 0, Math.cos(d)], [-Math.sin(d), 0, -Math.cos(d)], [-Math.cos(a), Math.sin(a), 0], [-Math.cos(a), -Math.sin(a), 0], [1, 0, 0]],
      roles: ["bond", "bond", "bond", "bond", "lp"],
    };
  }
  if (n === 5 && l === 2) { // T-shape: both lone pairs equatorial, axial bonds lean toward the equatorial bond
    const d = rad(90 - A.tShapeAxEq);
    return {
      dirs: [[Math.sin(d), 0, Math.cos(d)], [Math.sin(d), 0, -Math.cos(d)], [1, 0, 0], [-0.5, S3, 0], [-0.5, -S3, 0]],
      roles: ["bond", "bond", "bond", "lp", "lp"],
    };
  }
  if (n === 6 && l === 1) { // square pyramidal: lone pair at -z, basal bonds bent away from it
    const p = A.sqPyramidBasal;
    return { dirs: [[0, 0, 1], sph(p, 0), sph(p, 90), sph(p, 180), sph(p, 270), [0, 0, -1]], roles: ["bond", "bond", "bond", "bond", "bond", "lp"] };
  }
  // ideal sets (also the fallback for combinations the model does not recognise)
  const ideal = idealSlots(n).map((v) => v.slice());
  let lpIdx;
  if (n === 5) lpIdx = [2, 3, 4].slice(0, l);
  else if (n === 6) lpIdx = l === 1 ? [5] : l === 2 ? [4, 5] : [3, 4, 5].slice(0, l);
  else lpIdx = Array.from({ length: l }, (_, k) => n - 1 - k).reverse();
  const roles = ideal.map((_, i) => (lpIdx.includes(i) ? "lp" : "bond"));
  // bonding slots first, then lone pairs (stable order for the assignment)
  const order = [...roles.keys()].sort((x, y) => (roles[x] === roles[y] ? x - y : roles[x] === "bond" ? -1 : 1));
  return { dirs: order.map((i) => ideal[i]), roles: order.map((i) => roles[i]) };
}

// ---------------------------------------------------------------------------------------------------------------
// Small linear algebra (flat Float64Arrays, no per-call allocation in the hot loop)
// ---------------------------------------------------------------------------------------------------------------
const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x);
export const angleOf = (ax, ay, az, bx, by, bz) => Math.acos(clamp(ax * bx + ay * by + az * bz, -1, 1));

/** Jacobi eigen-decomposition of a symmetric 4x4 (row-major array of 16). Returns the eigenvector of the largest eigenvalue. */
function maxEigenvector4(m) {
  const a = Float64Array.from(m);
  const v = new Float64Array(16); for (let i = 0; i < 4; i += 1) v[i * 5] = 1;
  for (let sweep = 0; sweep < 40; sweep += 1) {
    let off = 0; for (let i = 0; i < 4; i += 1) for (let j = i + 1; j < 4; j += 1) off += a[i * 4 + j] * a[i * 4 + j];
    if (off < 1e-24) break;
    for (let p = 0; p < 3; p += 1) {
      for (let q = p + 1; q < 4; q += 1) {
        const apq = a[p * 4 + q]; if (Math.abs(apq) < 1e-300) continue;
        const theta = (a[q * 4 + q] - a[p * 4 + p]) / (2 * apq);
        const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1); const s = t * c;
        for (let k = 0; k < 4; k += 1) { const akp = a[k * 4 + p]; const akq = a[k * 4 + q]; a[k * 4 + p] = c * akp - s * akq; a[k * 4 + q] = s * akp + c * akq; }
        for (let k = 0; k < 4; k += 1) { const apk = a[p * 4 + k]; const aqk = a[q * 4 + k]; a[p * 4 + k] = c * apk - s * aqk; a[q * 4 + k] = s * apk + c * aqk; }
        for (let k = 0; k < 4; k += 1) { const vkp = v[k * 4 + p]; const vkq = v[k * 4 + q]; v[k * 4 + p] = c * vkp - s * vkq; v[k * 4 + q] = s * vkp + c * vkq; }
      }
    }
  }
  let best = 0; for (let i = 1; i < 4; i += 1) if (a[i * 5] > a[best * 5]) best = i;
  return [v[best], v[4 + best], v[8 + best], v[12 + best]];
}
function quatToMat(q, out) {
  let [w, x, y, z] = q; const n = Math.hypot(w, x, y, z) || 1; w /= n; x /= n; y /= n; z /= n;
  out[0] = 1 - 2 * (y * y + z * z); out[1] = 2 * (x * y - z * w); out[2] = 2 * (x * z + y * w);
  out[3] = 2 * (x * y + z * w); out[4] = 1 - 2 * (x * x + z * z); out[5] = 2 * (y * z - x * w);
  out[6] = 2 * (x * z - y * w); out[7] = 2 * (y * z + x * w); out[8] = 1 - 2 * (x * x + y * y);
}
/** Best rotation (Horn's method) taking source vectors a_k to targets b_k, weights w_k. Writes a 3x3 row-major matrix to `out`. */
export function bestRotation(a, b, w, out) {
  let sxx = 0, sxy = 0, sxz = 0, syx = 0, syy = 0, syz = 0, szx = 0, szy = 0, szz = 0;
  for (let k = 0; k < w.length; k += 1) {
    const ax = a[k * 3], ay = a[k * 3 + 1], az = a[k * 3 + 2]; const bx = b[k * 3], by = b[k * 3 + 1], bz = b[k * 3 + 2]; const wk = w[k];
    sxx += wk * ax * bx; sxy += wk * ax * by; sxz += wk * ax * bz;
    syx += wk * ay * bx; syy += wk * ay * by; syz += wk * ay * bz;
    szx += wk * az * bx; szy += wk * az * by; szz += wk * az * bz;
  }
  const N = [
    sxx + syy + szz, syz - szy, szx - sxz, sxy - syx,
    syz - szy, sxx - syy - szz, sxy + syx, szx + sxz,
    szx - sxz, sxy + syx, -sxx + syy - szz, syz + szy,
    sxy - syx, szx + sxz, syz + szy, -sxx - syy + szz,
  ];
  quatToMat(maxEigenvector4(N), out);
}

// ---------------------------------------------------------------------------------------------------------------
// Simulation state
// ---------------------------------------------------------------------------------------------------------------
const PRIOR = 1e-3; // weight of the "keep the previous frame" prior (resolves the free rotation of linear / planar sets)

export function createSim() {
  return {
    n: 0, ids: [], kinds: [],
    dir: new Float64Array(18), vel: new Float64Array(18), tgt: new Float64Array(18),
    slots: new Float64Array(18), roles: [], pi: [0, 0, 0, 0, 0, 0],
    R: Float64Array.from([1, 0, 0, 0, 1, 0, 0, 0, 1]),
    gStar: new Float64Array(36), minSep: 0, pin: -1, pinDir: new Float64Array(3), pulse: 0, time: 0, acc: 0,
  };
}
export const DEFAULT_PARAMS = { omega: 9, zeta: 1, pinOmega: 28, repel: 20, vmax: 9, h: 1 / 120, wLL: 1.7, wLB: 1.3, wBB: 1.0 };

const gOf = (cosT) => 1 / (1 - cosT + 0.12); // monotone pair repulsion profile (qualitative, dimensionless)
const pairW = (P, ki, kj) => (ki === "lp" && kj === "lp" ? P.wLL : ki === "lp" || kj === "lp" ? P.wLB : P.wBB);

function farthestDirection(sim, count) {
  // deterministic Fibonacci-sphere search for the direction farthest (max of min angle) from the existing domains
  let best = [0, 0, 1]; let bestScore = -2;
  for (let k = 0; k < 120; k += 1) {
    const z = 1 - ((k + 0.5) * 2) / 120; const r = Math.sqrt(1 - z * z); const ph = k * 2.399963229728653;
    const x = r * Math.cos(ph); const y = r * Math.sin(ph);
    let worst = -2; // largest cosine to any existing domain: smaller is better
    for (let i = 0; i < count; i += 1) worst = Math.max(worst, x * sim.dir[i * 3] + y * sim.dir[i * 3 + 1] + z * sim.dir[i * 3 + 2]);
    const score = -worst;
    if (score > bestScore + 1e-12) { bestScore = score; best = [x, y, z]; }
  }
  return best;
}

function permutations(arr) {
  const out = []; const a = arr.slice();
  const rec = (k) => { if (k === a.length) { out.push(a.slice()); return; } for (let i = k; i < a.length; i += 1) { [a[k], a[i]] = [a[i], a[k]]; rec(k + 1); [a[k], a[i]] = [a[i], a[k]]; } };
  // lexicographic-stable generation: sort result for determinism
  rec(0);
  out.sort((p, q) => { for (let i = 0; i < p.length; i += 1) if (p[i] !== q[i]) return p[i] - q[i]; return 0; });
  return out;
}
const PERM_CACHE = new Map();
const permsOf = (n) => { if (!PERM_CACHE.has(n)) PERM_CACHE.set(n, permutations([...Array(n).keys()])); return PERM_CACHE.get(n); };

function slotVec(sim, s, out) {
  const R = sim.R; const x = sim.slots[s * 3]; const y = sim.slots[s * 3 + 1]; const z = sim.slots[s * 3 + 2];
  out[0] = R[0] * x + R[1] * y + R[2] * z; out[1] = R[3] * x + R[4] * y + R[5] * z; out[2] = R[6] * x + R[7] * y + R[8] * z;
}
const TMP = new Float64Array(3);

/** Total squared angular displacement of an assignment (domain index -> slot index) under the current frame. */
function assignmentCost(sim, pi) {
  let c = 0;
  for (let i = 0; i < sim.n; i += 1) { slotVec(sim, pi[i], TMP); const a = angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], TMP[0], TMP[1], TMP[2]); c += a * a; }
  return c;
}
/** Minimum-displacement assignment for the current frame; bonding domains only go to bonding slots, lone pairs to lone-pair slots. */
export function bestAssignment(sim) {
  const out = sim.pi.slice(); let total = 0;
  for (const role of ["bond", "lp"]) {
    const dom = []; const slt = [];
    for (let i = 0; i < sim.n; i += 1) if (sim.kinds[i] === role) dom.push(i);
    for (let s = 0; s < sim.n; s += 1) if (sim.roles[s] === role) slt.push(s);
    if (!dom.length) continue;
    let best = Infinity; let bestP = null;
    for (const p of permsOf(dom.length)) {
      let c = 0;
      for (let k = 0; k < dom.length; k += 1) { slotVec(sim, slt[p[k]], TMP); const i = dom[k]; const a = angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], TMP[0], TMP[1], TMP[2]); c += a * a; }
      if (c < best - 1e-12) { best = c; bestP = p; }
    }
    for (let k = 0; k < dom.length; k += 1) out[dom[k]] = slt[bestP[k]];
    total += best;
  }
  return { pi: out, cost: total };
}

function fitFrame(sim) {
  const n = sim.n; if (!n) return;
  const a = new Float64Array((n + 3) * 3); const bb = new Float64Array((n + 3) * 3); const w = new Float64Array(n + 3);
  for (let it = 0; it < 4; it += 1) {
    sim.pi = bestAssignment(sim).pi;
    for (let i = 0; i < n; i += 1) {
      a[i * 3] = sim.slots[sim.pi[i] * 3]; a[i * 3 + 1] = sim.slots[sim.pi[i] * 3 + 1]; a[i * 3 + 2] = sim.slots[sim.pi[i] * 3 + 2];
      bb[i * 3] = sim.dir[i * 3]; bb[i * 3 + 1] = sim.dir[i * 3 + 1]; bb[i * 3 + 2] = sim.dir[i * 3 + 2]; w[i] = 1;
    }
    for (let k = 0; k < 3; k += 1) { // prior: keep the previous frame where the data does not determine it
      const r = n + k; a[r * 3] = k === 0 ? 1 : 0; a[r * 3 + 1] = k === 1 ? 1 : 0; a[r * 3 + 2] = k === 2 ? 1 : 0;
      bb[r * 3] = sim.R[k]; bb[r * 3 + 1] = sim.R[3 + k]; bb[r * 3 + 2] = sim.R[6 + k]; w[r] = PRIOR;
    }
    bestRotation(a, bb, w, sim.R);
  }
  sim.pi = bestAssignment(sim).pi;
  refreshTargets(sim);
}

function refreshTargets(sim) {
  const n = sim.n;
  for (let i = 0; i < n; i += 1) { slotVec(sim, sim.pi[i], TMP); sim.tgt[i * 3] = TMP[0]; sim.tgt[i * 3 + 1] = TMP[1]; sim.tgt[i * 3 + 2] = TMP[2]; }
  let minPair = Math.PI;
  for (let i = 0; i < n; i += 1) for (let j = 0; j < n; j += 1) {
    if (i === j) { sim.gStar[i * 6 + j] = 0; continue; }
    const c = clamp(sim.tgt[i * 3] * sim.tgt[j * 3] + sim.tgt[i * 3 + 1] * sim.tgt[j * 3 + 1] + sim.tgt[i * 3 + 2] * sim.tgt[j * 3 + 2], -1, 1);
    sim.gStar[i * 6 + j] = gOf(c); if (j > i) minPair = Math.min(minPair, Math.acos(c));
  }
  sim.minSep = n > 1 ? 0.55 * minPair : 0;
}

/**
 * Replace the domain list. `ids` / `kinds` describe the NEW list in order; existing ids keep their direction and velocity,
 * `hints` ({id: [x,y,z]}) gives a starting direction for new ids, otherwise the direction farthest from the others is used.
 */
export function syncDomains(sim, ids, kinds, hints = {}) {
  const oldIdx = new Map(sim.ids.map((id, i) => [id, i]));
  const dir = new Float64Array(18); const vel = new Float64Array(18); let placed = 0;
  const staged = [];
  ids.forEach((id, i) => {
    if (oldIdx.has(id)) { const o = oldIdx.get(id); for (let k = 0; k < 3; k += 1) { dir[i * 3 + k] = sim.dir[o * 3 + k]; vel[i * 3 + k] = sim.vel[o * 3 + k]; } staged.push(i); }
  });
  sim.dir = dir; sim.vel = vel; sim.n = ids.length; sim.ids = ids.slice(); sim.kinds = kinds.slice(); sim.pin = -1;
  // new domains: hinted ones first, then farthest-point, one at a time (so each sees the previous ones)
  const have = new Set(staged);
  // temporarily compact: farthestDirection needs the already placed directions at the front; use a scratch copy
  ids.forEach((id, i) => {
    if (have.has(i)) return;
    let v = hints[id];
    if (!v) {
      const scratch = { dir: new Float64Array(18) }; let c = 0;
      for (let j = 0; j < ids.length; j += 1) if (have.has(j)) { scratch.dir.set(dir.subarray(j * 3, j * 3 + 3), c * 3); c += 1; }
      v = farthestDirection(scratch, c);
    }
    const len = Math.hypot(v[0], v[1], v[2]) || 1; dir[i * 3] = v[0] / len; dir[i * 3 + 1] = v[1] / len; dir[i * 3 + 2] = v[2] / len;
    have.add(i); placed += 1;
  });
  const b = kinds.filter((k) => k === "bond").length; const l = kinds.length - b;
  const s = buildSlots(b, l);
  sim.roles = s.roles.slice(); sim.slots = new Float64Array(18);
  s.dirs.forEach((v, i) => { sim.slots[i * 3] = v[0]; sim.slots[i * 3 + 1] = v[1]; sim.slots[i * 3 + 2] = v[2]; });
  sim.pi = [0, 1, 2, 3, 4, 5];
  if (sim.n > 0) fitFrame(sim);
  sim.pulse = placed || ids.length ? 1 : 0;
  return sim;
}

/** Snap straight to the reference arrangement (used for static previews and tests). */
export function settleInstant(sim) {
  for (let i = 0; i < sim.n * 3; i += 1) { sim.dir[i] = sim.tgt[i]; sim.vel[i] = 0; }
}

export function dragDomain(sim, index, x, y, z) {
  const len = Math.hypot(x, y, z) || 1;
  sim.pin = index; sim.pinDir[0] = x / len; sim.pinDir[1] = y / len; sim.pinDir[2] = z / len;
}
/** Release the dragged domain: re-evaluate the assignment ONCE (hysteresis against flipping), then everything relaxes. */
export function releaseDomain(sim) {
  if (sim.pin < 0) return;
  sim.pin = -1;
  const cur = assignmentCost(sim, sim.pi); const best = bestAssignment(sim);
  if (best.cost < cur - 0.03) { sim.pi = best.pi; refreshTargets(sim); }
  sim.pulse = 1;
}

/** Largest angular displacement (radians) of any domain from its slot; ~0 once relaxed. */
export function maxDisplacement(sim) {
  let m = 0;
  for (let i = 0; i < sim.n; i += 1) m = Math.max(m, angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], sim.tgt[i * 3], sim.tgt[i * 3 + 1], sim.tgt[i * 3 + 2]));
  return m;
}
export function energy(sim) {
  let e = 0;
  for (let i = 0; i < sim.n; i += 1) { const a = angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], sim.tgt[i * 3], sim.tgt[i * 3 + 1], sim.tgt[i * 3 + 2]); e += a * a; }
  return e;
}
export function isSettled(sim, tolRad = 0.002) {
  if (sim.pin >= 0) return false;
  let v = 0; for (let i = 0; i < sim.n * 3; i += 1) v = Math.max(v, Math.abs(sim.vel[i]));
  return maxDisplacement(sim) < tolRad && v < 0.01;
}
export function angleBetween(sim, i, j) {
  return angleOf(sim.dir[i * 3], sim.dir[i * 3 + 1], sim.dir[i * 3 + 2], sim.dir[j * 3], sim.dir[j * 3 + 1], sim.dir[j * 3 + 2]);
}
export function minPairAngle(sim) {
  let m = Math.PI; for (let i = 0; i < sim.n; i += 1) for (let j = i + 1; j < sim.n; j += 1) m = Math.min(m, angleBetween(sim, i, j)); return m;
}

const ACC = new Float64Array(3);
/** One fixed substep. */
function substep(sim, P, h) {
  const n = sim.n; const d = sim.dir; const v = sim.vel;
  for (let i = 0; i < n; i += 1) {
    const ix = i * 3; const px = d[ix], py = d[ix + 1], pz = d[ix + 2];
    const pinned = i === sim.pin;
    const tx = pinned ? sim.pinDir[0] : sim.tgt[ix]; const ty = pinned ? sim.pinDir[1] : sim.tgt[ix + 1]; const tz = pinned ? sim.pinDir[2] : sim.tgt[ix + 2];
    const om = pinned ? P.pinOmega : P.omega; const zeta = pinned ? 1 : P.zeta;
    // spring toward the target along the sphere
    let ex = tx - px, ey = ty - py, ez = tz - pz; const dt = ex * px + ey * py + ez * pz; ex -= dt * px; ey -= dt * py; ez -= dt * pz;
    const el = Math.hypot(ex, ey, ez);
    const phi = angleOf(px, py, pz, tx, ty, tz);
    let ax = 0, ay = 0, az = 0;
    if (el > 1e-12) { const k = (om * om * phi) / el; ax = ex * k; ay = ey * k; az = ez * k; }
    ax -= 2 * zeta * om * v[ix]; ay -= 2 * zeta * om * v[ix + 1]; az -= 2 * zeta * om * v[ix + 2];
    if (!pinned) {
      for (let j = 0; j < n; j += 1) {
        if (j === i) continue;
        const jx = j * 3; const c = clamp(px * d[jx] + py * d[jx + 1] + pz * d[jx + 2], -1, 1);
        const extra = gOf(c) - sim.gStar[i * 6 + j];
        if (extra <= 0) continue;
        let ux = px - d[jx] * c, uy = py - d[jx + 1] * c, uz = pz - d[jx + 2] * c; // tangent at i pointing away from j
        let ul = Math.hypot(ux, uy, uz);
        if (ul < 1e-9) { ux = -py; uy = px; uz = 0; ul = Math.hypot(ux, uy) || 1; if (ul < 1e-9) { ux = 1; ul = 1; } }
        const k = (P.repel * extra * pairW(P, sim.kinds[i], sim.kinds[j])) / ul;
        ax += ux * k; ay += uy * k; az += uz * k;
      }
    }
    ACC[0] = ax; ACC[1] = ay; ACC[2] = az;
    v[ix] += ACC[0] * h; v[ix + 1] += ACC[1] * h; v[ix + 2] += ACC[2] * h;
    // tangent projection and speed limit
    const vn = v[ix] * px + v[ix + 1] * py + v[ix + 2] * pz; v[ix] -= vn * px; v[ix + 1] -= vn * py; v[ix + 2] -= vn * pz;
    const sp = Math.hypot(v[ix], v[ix + 1], v[ix + 2]);
    if (sp > P.vmax) { const s = P.vmax / sp; v[ix] *= s; v[ix + 1] *= s; v[ix + 2] *= s; }
  }
  for (let i = 0; i < n; i += 1) {
    const ix = i * 3;
    d[ix] += v[ix] * h; d[ix + 1] += v[ix + 1] * h; d[ix + 2] += v[ix + 2] * h;
    const l = Math.hypot(d[ix], d[ix + 1], d[ix + 2]) || 1; d[ix] /= l; d[ix + 1] /= l; d[ix + 2] /= l;
    const vn = v[ix] * d[ix] + v[ix + 1] * d[ix + 1] + v[ix + 2] * d[ix + 2]; v[ix] -= vn * d[ix]; v[ix + 1] -= vn * d[ix + 1]; v[ix + 2] -= vn * d[ix + 2];
  }
  // minimum angular separation (position-based): no two domains ever overlap
  if (sim.minSep > 0) {
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
      const ix = i * 3, jx = j * 3;
      const ang = angleOf(d[ix], d[ix + 1], d[ix + 2], d[jx], d[jx + 1], d[jx + 2]);
      if (ang >= sim.minSep) continue;
      const c = Math.cos(ang);
      let ux = d[ix] - d[jx] * c, uy = d[ix + 1] - d[jx + 1] * c, uz = d[ix + 2] - d[jx + 2] * c; let ul = Math.hypot(ux, uy, uz);
      let wx = d[jx] - d[ix] * c, wy = d[jx + 1] - d[ix + 1] * c, wz = d[jx + 2] - d[ix + 2] * c; let wl = Math.hypot(wx, wy, wz);
      if (ul < 1e-9 || wl < 1e-9) { // coincident: split deterministically along an arbitrary perpendicular
        ux = -d[ix + 1]; uy = d[ix]; uz = 0; ul = Math.hypot(ux, uy); if (ul < 1e-9) { ux = 1; uy = 0; uz = 0; ul = 1; }
        wx = -ux; wy = -uy; wz = -uz; wl = ul;
      }
      ux /= ul; uy /= ul; uz /= ul; wx /= wl; wy /= wl; wz /= wl;
      const push = sim.minSep - ang;
      const iPinned = i === sim.pin; const jPinned = j === sim.pin;
      const fi = jPinned ? 1 : iPinned ? 0 : 0.5; const fj = iPinned ? 1 : jPinned ? 0 : 0.5;
      const ti = Math.tan(push * fi); const tj = Math.tan(push * fj);
      d[ix] += ux * ti; d[ix + 1] += uy * ti; d[ix + 2] += uz * ti;
      d[jx] += wx * tj; d[jx + 1] += wy * tj; d[jx + 2] += wz * tj;
      for (const q of [ix, jx]) { const l = Math.hypot(d[q], d[q + 1], d[q + 2]) || 1; d[q] /= l; d[q + 1] /= l; d[q + 2] /= l; }
    }
  }
}

/** Advance the simulation by dt seconds (fixed substeps, capped). */
export function stepSim(sim, dtRaw, params = DEFAULT_PARAMS) {
  const dt = Math.min(Math.max(dtRaw, 0), 0.05);
  sim.acc += dt; let guard = 0;
  while (sim.acc >= params.h && guard < 8) { substep(sim, params, params.h); sim.acc -= params.h; sim.time += params.h; guard += 1; }
  if (guard === 8) sim.acc = 0;
  if (sim.pulse > 0) sim.pulse = Math.max(0, sim.pulse - dt / 0.9);
}

// ---------------------------------------------------------------------------------------------------------------
// Angles for presentation
// ---------------------------------------------------------------------------------------------------------------
const IDEAL_ANGLES = [90, 109.47, 120, 180];
/** Idealised angle class (90 / 109.5 / 120 / 180) closest to a measured angle, in degrees. */
export function nearestIdealAngle(deg) { return IDEAL_ANGLES.reduce((best, a) => (Math.abs(a - deg) < Math.abs(best - deg) ? a : best), IDEAL_ANGLES[0]); }
export const formatIdeal = (a) => (Math.abs(a - 109.47) < 0.01 ? "109.5" : String(a));

/** Bonding-bonding angle classes of the REFERENCE arrangement: [{ deg, i, j }] one representative per class (rounded to 1 degree). */
export function referenceAngleClasses(b, l) {
  const sim = syncDomains(createSim(), Array.from({ length: b + l }, (_, i) => `d${i}`), [...Array(b).fill("bond"), ...Array(l).fill("lp")]);
  settleInstant(sim);
  const classes = [];
  for (let i = 0; i < b; i += 1) for (let j = i + 1; j < b; j += 1) {
    const deg = (angleBetween(sim, i, j) * 180) / Math.PI;
    if (!classes.some((c) => Math.abs(c.deg - deg) < 0.75)) classes.push({ deg, i, j });
  }
  return classes.sort((x, y) => x.deg - y.deg);
}
