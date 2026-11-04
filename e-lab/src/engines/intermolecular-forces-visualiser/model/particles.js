// Particle-state generation and dynamics for the Heat & Phase Change cube (pure, no React / three).
//
// Every particle is a RIGID body: a molecule is its fixed local atom list (from ./molecules.js) moved by one position and one
// quaternion, so covalent bond lengths and angles are identical in every phase BY CONSTRUCTION (tested). The dynamics are a small
// Langevin simulation with a soft pair potential (repulsive core, cohesive well) whose parameters are driven by the energy model's
// state (T, melt fraction, vapour fraction) -- the phase is NOT computed from the particle dynamics:
//   solid   : springs to lattice sites + small thermal noise (amplitude grows as sqrt(T)), cohesion on
//   melting : each site's spring is released as the melt fraction passes its own threshold (outer sites first), continuously
//   liquid  : no site springs, cohesion on (molecules stay close, rearrange), gravity keeps the liquid at the bottom
//   boiling : each particle's cohesion is released as the vapour fraction passes its own threshold, continuously
//   gas     : no cohesion, ballistic motion with speed ~ sqrt(T), elastic walls
// Nothing is ever teleported: positions only change through integrated velocities.
import { MOLECULES } from "./molecules.js";
import { SUBSTANCES } from "./phase.js";
import { generateIonicBlock } from "../../bonding-visualizer/model/lattice.js";
import { QID, cross, dot, norm, qFromFrames, qFromTo, qMul, qNorm, qRot, scale, smoothstep, sub, add, len } from "./vec.js";

export const N_PARTICLES = 48;
export function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(1e-12, r()))) * Math.cos(2 * Math.PI * r());

// ---- solid arrangements -----------------------------------------------------------------------------------------------------
/** Close-packed (fcc) block: 3 columns x 4 rows x 4 layers (A B C A) stacked along +y. Returns { sites, info:[{col,row,layer}] }. */
function fccSites(nn) {
  const sites = []; const info = []; const hL = nn * Math.sqrt(2 / 3);
  for (let k = 0; k < 4; k += 1) {
    const off = [[0, 0], [nn / 2, (nn * Math.sqrt(3)) / 6], [nn, (nn * Math.sqrt(3)) / 3], [0, 0]][k];
    for (let r = 0; r < 4; r += 1) for (let c = 0; c < 3; c += 1) { sites.push([c * nn + r * (nn / 2) + off[0], k * hL, r * ((nn * Math.sqrt(3)) / 2) + off[1]]); info.push({ col: c, row: r, layer: k }); }
  }
  return { sites, info };
}
/** Cubic-diamond (ice Ic-type) block of 48 oxygen sites, O-O distance nn; z of the diamond cell is drawn as +y (up). */
function diamondSites(nn) {
  const a = (4 * nn) / Math.sqrt(3); const fcc = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]]; const sites = [];
  for (let i = 0; i < 2; i += 1) for (let j = 0; j < 2; j += 1) for (let k = 0; k < 2; k += 1) for (const b of fcc) for (const o of [0, 0.25]) {
    const x = i + b[0] + o; const y = j + b[1] + o; const z = k + b[2] + o; if (z < 1.5 - 1e-9) sites.push([x * a, z * a, y * a]);
  }
  return { sites, info: sites.map(() => ({})) };
}
/** Rock-salt block of 48 ions (4 x 4 x 3) from the Bonding Visualizer's generated lattice. */
function rocksaltSites(nn) {
  const ions = generateIonicBlock("rocksalt", 2).filter((p) => { const gx = p.ix / 2; const gy = p.iy / 2; const gz = p.iz / 2; return gx >= 0 && gx <= 3 && gy >= 0 && gy <= 3 && gz >= 0 && gz <= 2; });
  return { sites: ions.map((p) => [p.x * nn, p.z * nn, p.y * nn]), info: ions.map((p) => ({ species: p.species === "cation" ? 0 : 1 })) };
}

/** Assign two hydrogen directions to every water site obeying the ice rule "no O-O link carries two H atoms" (backtracking, seeded). */
export function assignIceProtons(sites, nn, seed = 7) {
  const n = sites.length; const nb = sites.map((p, i) => sites.map((q, j) => (j !== i && Math.abs(len(sub(p, q)) - nn) < 0.15 * nn ? j : -1)).filter((j) => j >= 0));
  const R = rng(seed); const combos = [];
  const pick = []; // each choice: pair of neighbour slots (0..3)
  for (let a = 0; a < 4; a += 1) for (let b = a + 1; b < 4; b += 1) pick.push([a, b]);
  const dirs = sites.map((p, i) => [0, 1, 2, 3].map((s) => (nb[i][s] !== undefined ? norm(sub(sites[nb[i][s]], p)) : null)));
  void combos;
  const choice = Array(n).fill(null); let nodes = 0; const order = [...Array(n).keys()];
  const donatesTo = (i, c) => c.map((s) => nb[i][s]).filter((j) => j !== undefined);
  const ok = (i, c) => { for (const j of donatesTo(i, c)) { const cj = choice[j]; if (cj && donatesTo(j, cj).includes(i)) return false; } return true; };
  const dfs = (idx) => {
    if (idx === n) return true; if (nodes > 300000) return false; nodes += 1;
    const i = order[idx]; const opts = pick.map((c) => [R(), c]).sort((x, y) => x[0] - y[0]).map((x) => x[1]);
    for (const c of opts) { if (!ok(i, c)) continue; choice[i] = c; if (dfs(idx + 1)) return true; choice[i] = null; }
    return false;
  };
  const solved = dfs(0);
  return { choice, nb, dirs, solved, nodes };
}

function orientations(subst, info, sites, mol, R) {
  const q = sites.map(() => QID);
  if (subst.arrangement === "ice") {
    const { choice, dirs } = assignIceProtons(sites, subst.nn, 7);
    const h1 = norm(mol.atoms[1].p.map((v, k) => v - mol.atoms[0].p[k])); const h2 = norm(mol.atoms[2].p.map((v, k) => v - mol.atoms[0].p[k]));
    const fa = norm(add(h1, h2)); const fb = norm(sub(h1, h2));
    for (let i = 0; i < sites.length; i += 1) {
      const c = choice[i] ?? [0, 1]; const d1 = dirs[i][c[0]] ?? [0, 1, 0]; const d2 = dirs[i][c[1]] ?? [1, 0, 0];
      q[i] = qFromFrames(fa, fb, norm(add(d1, d2)), norm(sub(d1, d2)));
    }
    return q;
  }
  if (subst.orient === "random") return sites.map(() => qNorm([R() - 0.5, R() - 0.5, R() - 0.5, R() - 0.5]));
  const ax = norm(mol.dipole.some((v) => Math.abs(v) > 1e-9) ? mol.dipole : [1, 0, 0]);
  if (subst.orient === "chains") return info.map((f) => qFromTo(ax, ((f.row + f.layer) % 2 === 0 ? [1, 0, 0] : [-1, 0, 0])));
  if (subst.orient === "updown") return info.map((f) => qMul(qFromTo(ax, ((f.col + f.row + f.layer) % 2 === 0 ? [0, 1, 0] : [0, -1, 0])), [0, 0, 0, 1]));
  if (subst.orient === "herringbone") { const a = (40 * Math.PI) / 180; return info.map((f) => qFromTo([1, 0, 0], (f.row + f.layer) % 2 === 0 ? [Math.cos(a), 0, Math.sin(a)] : [Math.cos(a), 0, -Math.sin(a)])); }
  void cross; void dot; void scale;
  return q;
}

// ---- system ------------------------------------------------------------------------------------------------------------------
/** Dynamics constants (visual time units: Angstrom and seconds of simulated display time). */
export const DYN = { kHome: 22, kRot: 16, kRep: 60, kAtt: 4.0, rc: 1.55, gravity: 1.2, ionK: 14, vmax: 26 };

export function createSystem(id, seed = 11) {
  const sub0 = SUBSTANCES[id]; if (!sub0) throw new Error(`Unknown substance ${id}`);
  const ionic = sub0.kind === "ionic"; const mol = ionic ? null : MOLECULES[sub0.mol]; const R = rng(seed);
  const nn = sub0.nn; const L = 11 * nn;
  const arr = sub0.arrangement === "ice" ? diamondSites(nn) : sub0.arrangement === "rocksalt" ? rocksaltSites(nn) : fccSites(nn);
  const n = arr.sites.length;
  // centre horizontally, put the lowest layer just above the floor
  const mean = [0, 1, 2].map((k) => arr.sites.reduce((s, p) => s + p[k], 0) / n); const minY = Math.min(...arr.sites.map((p) => p[1]));
  const floor = -L / 2 + 0.62 * nn;
  const sites = arr.sites.map((p) => [p[0] - mean[0], p[1] - minY + floor, p[2] - mean[2]]);
  const homeQuat = ionic ? sites.map(() => QID) : orientations(sub0, arr.info, sites, mol, R);
  const anchor = sub0.arrangement === "ice" ? mol.atoms[0].p : [0, 0, 0];
  const homePos = sites.map((p, i) => sub(p, qRot(homeQuat[i], anchor)));
  // thresholds: outer sites release first when melting (surface melting), random order for boiling
  const cen = [0, 1, 2].map((k) => sites.reduce((s, p) => s + p[k], 0) / n);
  const score = sites.map((p) => len(sub(p, cen)) + (R() - 0.5) * 0.5 * nn); const ranked = score.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]);
  const uMelt = new Float64Array(n); ranked.forEach(([, i], r) => { uMelt[i] = 0.02 + (r / (n - 1)) * 0.86; });
  const vBoil = new Float64Array(n); const perm = [...Array(n).keys()].sort(() => R() - 0.5); perm.forEach((i, r) => { vBoil[i] = 0.02 + (r / (n - 1)) * 0.86; });
  const sys = {
    id, n, L, nn, ionic, mol, sub: sub0, rngState: R,
    pos: new Float64Array(3 * n), vel: new Float64Array(3 * n), quat: new Float64Array(4 * n), omega: new Float64Array(3 * n),
    homePos: homePos.map((p) => p.slice()), homeQuat: homeQuat.map((q) => q.slice()), site: Int32Array.from([...Array(n).keys()]),
    uMelt, vBoil, charge: new Int8Array(n), partner: new Int32Array(n).fill(-1), prevMelt: 0, wh: new Float64Array(n), c: new Float64Array(n).fill(1),
    time: 0, acc: 0, radius: 0.5 * nn,
  };
  for (let i = 0; i < n; i += 1) { sys.pos.set(homePos[i], 3 * i); sys.quat.set(homeQuat[i], 4 * i); if (ionic) sys.charge[i] = arr.info[i].species === 0 ? 1 : -1; }
  if (ionic) { // ion-pair partners for the vapour: greedy nearest opposite
    const used = new Set(); const pairs = [];
    for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) if (sys.charge[i] !== sys.charge[j]) pairs.push([len(sub(homePos[i], homePos[j])), i, j]);
    pairs.sort((a, b) => a[0] - b[0]);
    for (const [, i, j] of pairs) if (!used.has(i) && !used.has(j)) { used.add(i); used.add(j); sys.partner[i] = j; sys.partner[j] = i; }
  }
  return sys;
}

function reassignSites(sys) { // freezing: each particle takes the nearest free lattice site (greedy); nothing jumps, a spring then pulls it there
  const { n } = sys; const cand = [];
  for (let i = 0; i < n; i += 1) for (let k = 0; k < n; k += 1) cand.push([Math.hypot(sys.pos[3 * i] - sys.homePos[k][0], sys.pos[3 * i + 1] - sys.homePos[k][1], sys.pos[3 * i + 2] - sys.homePos[k][2]), i, k]);
  cand.sort((a, b) => a[0] - b[0]); const usedI = new Set(); const usedK = new Set();
  for (const [, i, k] of cand) if (!usedI.has(i) && !usedK.has(k)) { usedI.add(i); usedK.add(k); sys.site[i] = k; }
}

/** Advance the dynamics by dt seconds given the energy-model state st = { T, melt, vap }. */
export function stepSystem(sys, dt, st) {
  const H = 1 / 90; sys.acc += Math.min(dt, 0.06); let steps = 0;
  if (sys.prevMelt >= 0.999 && st.melt < 0.999 && st.vap < 0.05) { // liquid is starting to freeze: settle onto the nearest sites
    if (!sys.ionic) reassignSites(sys); else reassignIons(sys);
  }
  sys.prevMelt = st.melt;
  while (sys.acc >= H && steps < 8) { sys.acc -= H; steps += 1; integrate(sys, H, st); sys.time += H; }
}

function reassignIons(sys) {
  const { n } = sys; const siteCharge = sys.siteCharge ?? (sys.siteCharge = Array.from({ length: n }, (_, k) => sys.charge[sys.site.indexOf(k)] ?? 1));
  const cand = [];
  for (let i = 0; i < n; i += 1) for (let k = 0; k < n; k += 1) if (siteCharge[k] === sys.charge[i]) cand.push([Math.hypot(sys.pos[3 * i] - sys.homePos[k][0], sys.pos[3 * i + 1] - sys.homePos[k][1], sys.pos[3 * i + 2] - sys.homePos[k][2]), i, k]);
  cand.sort((a, b) => a[0] - b[0]); const ui = new Set(); const uk = new Set();
  for (const [, i, k] of cand) if (!ui.has(i) && !uk.has(k)) { ui.add(i); uk.add(k); sys.site[i] = k; }
}

const lerp = (a, b, t) => a + (b - a) * t;
function integrate(sys, h, st) {
  const { n, pos, vel, quat, omega, nn, L, sub: s, ionic } = sys; const R = sys.rngState;
  const tm = Math.max(0.05, st.T / s.Tm); const tb = Math.max(0.05, st.T / s.Tb);
  // per-site / per-particle weights
  for (let i = 0; i < n; i += 1) {
    const k = sys.site[i];
    sys.wh[i] = 1 - smoothstep(sys.uMelt[k] - 0.04, sys.uMelt[k] + 0.1, st.melt);
    sys.c[i] = 1 - smoothstep(sys.vBoil[i] - 0.04, sys.vBoil[i] + 0.1, st.vap);
    if (st.melt < 0.001) sys.wh[i] = 1; if (st.vap < 0.001) sys.c[i] = 1; if (st.vap > 0.999) sys.c[i] = 0;
  }
  const fx = new Float64Array(3 * n);
  const d0 = nn; const rc = d0 * DYN.rc;
  for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) {
    const dx = pos[3 * j] - pos[3 * i]; const dy = pos[3 * j + 1] - pos[3 * i + 1]; const dz = pos[3 * j + 2] - pos[3 * i + 2];
    const r2 = dx * dx + dy * dy + dz * dz; if (r2 > (rc * 2.2) ** 2 || r2 < 1e-9) continue; const r = Math.sqrt(r2);
    const cij = Math.min(sys.c[i], sys.c[j]); let f = 0; // + = repulsion along i->j
    if (ionic) { // Coulomb-like: like charges push apart (+), unlike pull together (-), short-range hard core; scaled by cohesion
      const qq = sys.charge[i] * sys.charge[j]; const rcore = d0 * 0.92;
      if (r < rcore) f += DYN.kRep * (rcore - r);
      if (r < 3 * nn) f += (qq * DYN.ionK * cij * (1 - 0.95 * Math.min(sys.wh[i], sys.wh[j]))) / (r2 + 0.5 * nn);
    } else if (r < d0) f = DYN.kRep * (d0 - r);
    else if (r < rc) f = -DYN.kAtt * cij * (1 - 0.85 * Math.min(sys.wh[i], sys.wh[j])) * Math.sin((Math.PI * (r - d0)) / (rc - d0));
    const ux = dx / r; const uy = dy / r; const uz = dz / r; // force on j = +f u, on i = -f u  (f>0 pushes apart)
    fx[3 * j] += f * ux; fx[3 * j + 1] += f * uy; fx[3 * j + 2] += f * uz; fx[3 * i] -= f * ux; fx[3 * i + 1] -= f * uy; fx[3 * i + 2] -= f * uz;
  }
  const lim = L / 2 - 0.55 * nn;
  for (let i = 0; i < n; i += 1) {
    const k = sys.site[i]; const wh = sys.wh[i]; const gasW = 1 - sys.c[i]; const free = 1 - wh;
    // forces from the lattice spring and gravity
    for (let a = 0; a < 3; a += 1) fx[3 * i + a] += -DYN.kHome * wh * (pos[3 * i + a] - sys.homePos[k][a]);
    fx[3 * i + 1] -= DYN.gravity;
    if (ionic && sys.partner[i] >= 0 && gasW > 0) { // vapour: Na+Cl- ion pairs stay together
      const j = sys.partner[i]; const dx = pos[3 * j] - pos[3 * i]; const dy = pos[3 * j + 1] - pos[3 * i + 1]; const dz = pos[3 * j + 2] - pos[3 * i + 2]; const r = Math.hypot(dx, dy, dz) || 1;
      const f = 30 * gasW * (r - 0.84 * nn); fx[3 * i] += (f * dx) / r; fx[3 * i + 1] += (f * dy) / r; fx[3 * i + 2] += (f * dz) / r;
    }
    const kTs = 1.8 * tm * tm; const kTl = 2.4 * tm; const kTg = 30 * tb; // visual temperatures
    const kT = lerp(lerp(kTs, kTl, free), kTg, gasW);
    const gam = lerp(lerp(2.2, 3.0, free), 0.5, gasW);
    const sig = Math.sqrt(2 * gam * kT * h);
    for (let a = 0; a < 3; a += 1) {
      let v = vel[3 * i + a]; v += (fx[3 * i + a] - gam * v) * h + sig * gauss(R); const vm = DYN.vmax; if (v > vm) v = vm; else if (v < -vm) v = -vm; vel[3 * i + a] = v;
      let x = pos[3 * i + a] + v * h; const lo = a === 1 ? -L / 2 + 0.55 * nn : -lim; const hi = a === 1 ? L / 2 - 0.55 * nn : lim;
      if (x > hi) { x = hi; vel[3 * i + a] = -Math.abs(vel[3 * i + a]) * 0.9; } else if (x < lo) { x = lo; vel[3 * i + a] = Math.abs(vel[3 * i + a]) * 0.9; }
      pos[3 * i + a] = x;
    }
    if (ionic || sys.mol.atoms.length === 1) continue;
    // rotation: restoring torque towards the site orientation + Langevin noise
    const q = [quat[4 * i], quat[4 * i + 1], quat[4 * i + 2], quat[4 * i + 3]]; const qh = sys.homeQuat[k];
    let dq = qMul(q, [-qh[0], -qh[1], -qh[2], qh[3]]); if (dq[3] < 0) dq = [-dq[0], -dq[1], -dq[2], -dq[3]];
    const sn = Math.hypot(dq[0], dq[1], dq[2]); const ang = 2 * Math.atan2(sn, dq[3]); const ax = sn > 1e-9 ? [dq[0] / sn, dq[1] / sn, dq[2] / sn] : [0, 0, 0];
    const kTrs = 0.32 * tm; const kTrl = 7 * tm; const kTrg = 10 * tb; const kTr = lerp(lerp(kTrs, kTrl, free), kTrg, gasW); const gr = lerp(lerp(2.5, 3.0, free), 0.4, gasW); const sr = Math.sqrt(2 * gr * kTr * h);
    for (let a = 0; a < 3; a += 1) { let w = omega[3 * i + a]; w += (-DYN.kRot * wh * ang * ax[a] - gr * w) * h + sr * gauss(R); w = Math.max(-14, Math.min(14, w)); omega[3 * i + a] = w; }
    const wl = Math.hypot(omega[3 * i], omega[3 * i + 1], omega[3 * i + 2]);
    if (wl > 1e-9) { const half = (wl * h) / 2; const sH = Math.sin(half) / wl; const dr = [omega[3 * i] * sH, omega[3 * i + 1] * sH, omega[3 * i + 2] * sH, Math.cos(half)]; const nq = qNorm(qMul(dr, q)); quat.set(nq, 4 * i); }
  }
}

// ---- readouts ------------------------------------------------------------------------------------------------------------------------
/** World position of atom k of particle i (ions: the ion centre). */
export function atomPosition(sys, i, k, out = [0, 0, 0]) {
  const p = [sys.pos[3 * i], sys.pos[3 * i + 1], sys.pos[3 * i + 2]];
  if (sys.ionic) { out[0] = p[0]; out[1] = p[1]; out[2] = p[2]; return out; }
  const q = [sys.quat[4 * i], sys.quat[4 * i + 1], sys.quat[4 * i + 2], sys.quat[4 * i + 3]]; const v = qRot(q, sys.mol.atoms[k].p);
  out[0] = p[0] + v[0]; out[1] = p[1] + v[1]; out[2] = p[2] + v[2]; return out;
}
export const poseOf = (sys, i) => ({ pos: [sys.pos[3 * i], sys.pos[3 * i + 1], sys.pos[3 * i + 2]], quat: [sys.quat[4 * i], sys.quat[4 * i + 1], sys.quat[4 * i + 2], sys.quat[4 * i + 3]] });
/** Every covalent bond length of every molecule (A). Constant for rigid bodies: used by the "bonds stay intact" test. */
export function bondLengths(sys) {
  if (sys.ionic) return []; const out = [];
  for (let i = 0; i < sys.n; i += 1) for (const [a, b] of sys.mol.bonds) out.push(len(sub(atomPosition(sys, i, a), atomPosition(sys, i, b))));
  return out;
}
export function metrics(sys) {
  const n = sys.n; let nnSum = 0; let homeMs = 0; let ymin = Infinity; let ymax = -Infinity; let spd = 0; let coh = 0;
  for (let i = 0; i < n; i += 1) {
    let best = Infinity;
    for (let j = 0; j < n; j += 1) if (j !== i) best = Math.min(best, Math.hypot(sys.pos[3 * i] - sys.pos[3 * j], sys.pos[3 * i + 1] - sys.pos[3 * j + 1], sys.pos[3 * i + 2] - sys.pos[3 * j + 2]));
    nnSum += best; const k = sys.site[i];
    homeMs += (sys.pos[3 * i] - sys.homePos[k][0]) ** 2 + (sys.pos[3 * i + 1] - sys.homePos[k][1]) ** 2 + (sys.pos[3 * i + 2] - sys.homePos[k][2]) ** 2;
    ymin = Math.min(ymin, sys.pos[3 * i + 1]); ymax = Math.max(ymax, sys.pos[3 * i + 1]); spd += Math.hypot(sys.vel[3 * i], sys.vel[3 * i + 1], sys.vel[3 * i + 2]); coh += sys.c[i];
  }
  return { meanNN: nnSum / n / sys.nn, homeRms: Math.sqrt(homeMs / n) / sys.nn, span: (ymax - ymin) / sys.nn, meanSpeed: spd / n, cohesion: coh / n };
}
