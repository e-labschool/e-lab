// Collision-theory particle engine (pure JS, no DOM, no React). Fixed time step, typed arrays, no allocation in step().
//
// MODEL (state it honestly in the UI):
//  * A thin slice of a 3-D gas: particles are discs that move in the plane and also carry a HIDDEN velocity component
//    vz (into the screen). Velocity components are Gaussian with variance kT/m, so each particle's total kinetic
//    energy follows the 3-D Maxwell-Boltzmann distribution exactly, and elastic collisions keep it that way.
//  * Collisions between particles (equal mass) and with the walls are perfectly elastic (energy and momentum conserved).
//  * Collision energy = relative kinetic energy along the line of centres, E = (1/2) mu u^2 (u = approach speed).
//    A collision of A with B (or of B with a solid A site) REACTS only if E >= Ea AND both reactive sites face each other
//    (orientation). The collision itself then stays elastic (no heat of reaction is modelled; temperature is fixed).
//  * The reaction is IRREVERSIBLE: A + B -> C + D. Products C and D are inert and stay products for the rest of the run;
//    nothing ever turns them back into A or B and there is no replenishment of reactants. Particle units are conserved
//    (nA + nB + nC + nD is constant; in the solid system a consumed surface site counts as the product C and the B that hit
//    it becomes D). When the limiting reactant is used up no further reaction is possible and the rate is zero.
//    The only way to change the amount of material is the user's own Concentration slider (adds or removes reactant
//    particles; it is marked on the graphs).
//  * Time is simulated time (model seconds). Energies are in kJ mol^-1 with kT = R T. The Ea range is a DEMO scale
//    (5-60 kJ/mol) chosen so reactions happen in watchable time.
import { createRng } from "./rng.js";
import { kT } from "./maxwellBoltzmann.js";

export const WORLD = { w: 480, h: 300 };
export const R = 8; // particle radius
export const TILE_R = 6; // solid-site radius
export const TILE_PITCH = 12;
export const SPEED_C = 70; // px/s per sqrt(kJ/mol): velocity component sigma = SPEED_C * sqrt(kT)
export const DT = 1 / 240;
export const CAP = 200; // hard cap on mobile particles
export const TILE_CAP = 144;
export const PIECES = [1, 4, 9, 16, 36]; // number of solid pieces for the same mass (144 sites)
export const PIECE_GAP = [0, 28, 26, 24, 20];
export const SUCC_CAP = 4096; // successful-collision times kept (a run can never exceed the particle supply; extra are not stored)
export const HIST_EVERY = 0.5; // s between history samples
export const HIST_CAP = 1200;
export const EV_F = 17; // floats per event record
export const EV_CAP = 16;
export const OUT = { SUCCESS: 0, LOW_ENERGY: 1, ORIENTATION: 2, BOTH: 3 };
export const SP = { A: 0, B: 1, C: 2, D: 3 };
export const LIMITS = {
  T: [250, 700], n: [5, 50], ea: [5, 60], site: [60, 360], piece: [0, PIECES.length - 1], catalystFactor: 0.6,
};
const CELL = 2 * R;
const GX = Math.ceil(WORLD.w / CELL) + 1;
const GY = Math.ceil(WORLD.h / CELL) + 1;
const C2 = SPEED_C * SPEED_C;
const TWO_PI = Math.PI * 2;

export function defaultParams() {
  return { system: "mixed", T: 400, n: 40, ea: 10, catalyst: false, site: 240, piece: 1 };
}
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export function sanitizeParams(p) {
  const d = defaultParams();
  const q = { ...d }; for (const k of Object.keys(d)) if (p && p[k] !== undefined) q[k] = p[k]; // only known conditions are kept
  q.system = q.system === "solid" ? "solid" : "mixed";
  q.T = clamp(Math.round(Number(q.T) || d.T), LIMITS.T[0], LIMITS.T[1]);
  q.n = clamp(Math.round(Number(q.n) || d.n), LIMITS.n[0], LIMITS.n[1]);
  q.ea = clamp(Number(q.ea) || d.ea, LIMITS.ea[0], LIMITS.ea[1]);
  q.site = clamp(Math.round(Number(q.site) || d.site), LIMITS.site[0], LIMITS.site[1]);
  q.piece = clamp(Math.round(Number.isFinite(Number(q.piece)) ? Number(q.piece) : d.piece), LIMITS.piece[0], LIMITS.piece[1]);
  q.catalyst = !!q.catalyst;
  return q;
}
export const effectiveEa = (p) => (p.catalyst ? p.ea * LIMITS.catalystFactor : p.ea);
/** Fraction of random contacts with suitable orientation for BOTH reactive sites: (width/360)^2. */
export const stericFactor = (siteDeg) => (Math.min(360, siteDeg) / 360) ** 2;
export const stericFactorSolid = stericFactor; // both the particle's and the surface site's patch must face each other

function angDiff(a, b) {
  let d = (a - b) % TWO_PI;
  if (d > Math.PI) d -= TWO_PI; else if (d < -Math.PI) d += TWO_PI;
  return d;
}

export class CollisionEngine {
  constructor(opts = {}) {
    this.seed = (opts.seed ?? 12345) >>> 0;
    this.rng = createRng(this.seed);
    this.p = sanitizeParams(opts.params ?? {});
    this.x = new Float64Array(CAP); this.y = new Float64Array(CAP);
    this.vx = new Float64Array(CAP); this.vy = new Float64Array(CAP); this.vz = new Float64Array(CAP);
    this.phi = new Float64Array(CAP); this.spin = new Float64Array(CAP);
    this.sp = new Uint8Array(CAP); this.flash = new Float32Array(CAP);
    this.tx = new Float64Array(TILE_CAP); this.ty = new Float64Array(TILE_CAP); this.tphi = new Float64Array(TILE_CAP);
    this.tstate = new Uint8Array(TILE_CAP); this.tflash = new Float32Array(TILE_CAP);
    this.head = new Int16Array(GX * GY); this.next = new Int16Array(CAP);
    this.evBuf = new Float64Array(EV_CAP * EV_F); this.lastEv = new Float64Array(4 * EV_F);
    this.hT = new Float64Array(HIST_CAP); this.hSucc = new Float64Array(HIST_CAP); this.hColl = new Float64Array(HIST_CAP); this.hA = new Float64Array(HIST_CAP); this.hB = new Float64Array(HIST_CAP);
    this.sT = new Float64Array(SUCC_CAP); // simulated time of every successful collision (the data behind the rate graph)
    this.marks = []; // {t, label}, bounded
    this.reset(this.seed);
  }

  reset(seed = this.seed) {
    this.seed = seed >>> 0;
    this.rng.reseed(this.seed);
    this.n = 0; this.tn = 0; this.t = 0; this.stepCount = 0;
    this.coll = 0; this.succ = 0; this.failE = 0; this.failO = 0; this.failB = 0; this.energetic = 0;
    this.evSeq = 0; this.evHead = 0; this.evCount = 0;
    this.lastEvSeq = new Float64Array(4).fill(-1);
    this.histStart = 0; this.histLen = 0; this.nextHist = HIST_EVERY;
    this.marks.length = 0;
    this.lastEv.fill(-1);
    this._populate();
    this._pushHist(); // after populating, so the first sample holds the full initial reactants
  }

  _populate() {
    const p = this.p;
    this.n = 0; this.tn = 0;
    if (p.system === "solid") this._buildTiles();
    if (p.system === "mixed") for (let i = 0; i < p.n; i++) this._spawn(SP.A);
    for (let i = 0; i < p.n; i++) this._spawn(SP.B);
    this._normaliseEnergy();
  }

  /** Scale the freshly sampled velocities so the sample's mean kinetic energy is exactly (3/2) kT. Removes the large
   *  run-to-run scatter of a small sample, which would otherwise make 'faster vs slower' comparisons unreliable. */
  _normaliseEnergy() {
    if (this.n === 0) return;
    const target = this.n * 1.5 * kT(this.p.T); const have = this.totalKE();
    const f = Math.sqrt(target / have);
    for (let i = 0; i < this.n; i++) { this.vx[i] *= f; this.vy[i] *= f; this.vz[i] *= f; }
  }

  _buildTiles() {
    const p = this.p; const pieces = PIECES[p.piece]; const g = Math.round(Math.sqrt(pieces));
    const side = Math.round(Math.sqrt(TILE_CAP / pieces)); const pw = side * TILE_PITCH; const gap = PIECE_GAP[p.piece];
    const total = g * pw + (g - 1) * gap;
    const ox = 48 + (244 - total) / 2; const oy = (WORLD.h - total) / 2;
    let k = 0;
    for (let gy = 0; gy < g; gy++) for (let gx = 0; gx < g; gx++) {
      for (let iy = 0; iy < side; iy++) for (let ix = 0; ix < side; ix++) {
        this.tx[k] = ox + gx * (pw + gap) + (ix + 0.5) * TILE_PITCH;
        this.ty[k] = oy + gy * (pw + gap) + (iy + 0.5) * TILE_PITCH;
        this.tphi[k] = this.rng.next() * TWO_PI; this.tstate[k] = 0; this.tflash[k] = 0; k++;
      }
    }
    this.tn = k;
    this.tbx0 = ox - 2 * R; this.tbx1 = ox + total + 2 * R; this.tby0 = oy - 2 * R; this.tby1 = oy + total + 2 * R;
  }

  _findSpot() {
    const rng = this.rng; const lim = 2 * R + 1; const l2 = lim * lim;
    for (let attempt = 0; attempt < 80; attempt++) {
      const x = rng.range(R, WORLD.w - R); const y = rng.range(R, WORLD.h - R);
      let ok = true;
      for (let i = 0; i < this.n && ok; i++) { const dx = this.x[i] - x; const dy = this.y[i] - y; if (dx * dx + dy * dy < l2) ok = false; }
      if (ok && this.p.system === "solid") {
        const m = R + TILE_R + 1; const m2 = m * m;
        for (let k = 0; k < this.tn && ok; k++) { const dx = this.tx[k] - x; const dy = this.ty[k] - y; if (dx * dx + dy * dy < m2) ok = false; }
      }
      if (ok) { this._spot = [x, y]; return true; }
    }
    return false;
  }

  _spawn(species) {
    if (this.n >= CAP || !this._findSpot()) return false;
    const i = this.n++; const rng = this.rng; const s = SPEED_C * Math.sqrt(kT(this.p.T));
    this.x[i] = this._spot[0]; this.y[i] = this._spot[1];
    this.vx[i] = rng.gauss() * s; this.vy[i] = rng.gauss() * s; this.vz[i] = rng.gauss() * s;
    this.phi[i] = rng.next() * TWO_PI; this.spin[i] = rng.range(-4, 4);
    this.sp[i] = species; this.flash[i] = 0;
    return true;
  }

  _remove(i) {
    const l = --this.n;
    if (i !== l) {
      this.x[i] = this.x[l]; this.y[i] = this.y[l]; this.vx[i] = this.vx[l]; this.vy[i] = this.vy[l]; this.vz[i] = this.vz[l];
      this.phi[i] = this.phi[l]; this.spin[i] = this.spin[l]; this.sp[i] = this.sp[l]; this.flash[i] = this.flash[l];
    }
  }

  countSpecies(s) { let c = 0; for (let i = 0; i < this.n; i++) if (this.sp[i] === s) c++; return c; }

  /** Replace ALL conditions and restart (keeps the seed unless one is given). */
  configure(params, seed = this.seed) { this.p = sanitizeParams(params); this.reset(seed); }

  /** Change conditions while running. Unknown keys are ignored. The vessel is reset only when the system changes.
   *  Concentration: the slider is the amount of EACH reactant, so a change adds or removes that many reactant particles
   *  (the difference); it never tops reactants up to the slider value (that would be replenishment).
   *  Surface area (solid): the solid is rebuilt in the new number of pieces with the same number of sites already used up
   *  (taken from the outermost sites first), so consumed A never comes back. */
  setParams(patch) {
    const old = this.p; const q = sanitizeParams({ ...old, ...patch });
    this.p = q;
    if (q.system !== old.system) { this.reset(this.seed); return; }
    if (q.T !== old.T) {
      const f = Math.sqrt(q.T / old.T);
      for (let i = 0; i < this.n; i++) { this.vx[i] *= f; this.vy[i] *= f; this.vz[i] *= f; }
    }
    if (q.piece !== old.piece && q.system === "solid") {
      const used = this.consumedTiles();
      this._buildTiles(); this._consumeOutermost(used);
      for (let i = 0; i < this.n; i++) this._relocateIfOverlapTiles(i);
    }
    if (q.n !== old.n) {
      const reactants = q.system === "mixed" ? [SP.A, SP.B] : [SP.B];
      for (const s of reactants) {
        let delta = q.n - old.n;
        while (delta > 0 && this._spawn(s)) delta--;
        while (delta < 0) { let found = false; for (let i = this.n - 1; i >= 0; i--) if (this.sp[i] === s) { this._remove(i); found = true; break; } if (!found) break; delta++; }
      }
    }
  }

  /** Number of solid sites already used up (turned into product C). */
  consumedTiles() { let c = 0; for (let k = 0; k < this.tn; k++) if (this.tstate[k] === 1) c++; return c; }
  _consumeOutermost(m) {
    if (m <= 0) return;
    const tn = this.tn; const eps = 0.5; const nb = new Int8Array(tn);
    for (let k = 0; k < tn; k++) for (let j = 0; j < tn; j++) {
      if (j === k) continue; const dx = Math.abs(this.tx[j] - this.tx[k]); const dy = Math.abs(this.ty[j] - this.ty[k]);
      if ((dx < eps && Math.abs(dy - TILE_PITCH) < eps) || (dy < eps && Math.abs(dx - TILE_PITCH) < eps)) nb[k]++;
    }
    for (let c = 0; c < Math.min(m, tn); c++) {
      let best = -1; for (let k = 0; k < tn; k++) if (this.tstate[k] === 0 && (best < 0 || nb[k] < nb[best])) best = k;
      if (best < 0) break; this.tstate[best] = 1; this.tflash[best] = 0;
    }
  }
  /** [A, B, C, D] in particle units. Solid system: A = unused surface sites, C = used-up sites (each is one C), B and D are particles. */
  speciesCounts() {
    const c = [0, 0, 0, 0];
    for (let i = 0; i < this.n; i++) c[this.sp[i]]++;
    if (this.p.system === "solid") { const used = this.consumedTiles(); c[0] = this.tn - used; c[2] = used; }
    return c;
  }
  /** Total particle units A + B + C + D: unchanged by any number of reactions. */
  unitsTotal() { const c = this.speciesCounts(); return c[0] + c[1] + c[2] + c[3]; }
  /** How many more reactions are possible at most: the amount of the limiting reactant that is left (0 = reaction finished). */
  limitingLeft() { const c = this.speciesCounts(); return Math.min(c[0], c[1]); }
  /** Amount of A left: mobile A particles (mixed system) or unused solid sites (solid system). B is countSpecies(SP.B). */
  countA() { return this.p.system === "solid" ? this.tn - this.consumedTiles() : this.countSpecies(SP.A); }
  /** Times (simulated s) of all successful collisions so far, oldest first (copy). */
  successTimes() { return this.sT.slice(0, Math.min(this.succ, SUCC_CAP)); }

  _relocateIfOverlapTiles(i) {
    const m = R + TILE_R; const m2 = m * m;
    for (let k = 0; k < this.tn; k++) {
      const dx = this.x[i] - this.tx[k]; const dy = this.y[i] - this.ty[k];
      if (dx * dx + dy * dy < m2) {
        const save = this.n; this.n = i; // ignore this particle and later ones while searching
        const ok = this._findSpot(); this.n = save;
        if (ok) { this.x[i] = this._spot[0]; this.y[i] = this._spot[1]; }
        return;
      }
    }
  }

  mark(label) { this.marks.push({ t: this.t, label }); if (this.marks.length > 24) this.marks.shift(); }
  get eaEff() { return effectiveEa(this.p); }
  get products() { return this.succ; }

  totalKE() {
    let s = 0;
    for (let i = 0; i < this.n; i++) s += this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i];
    return s / (2 * C2);
  }
  momentum(out = [0, 0]) { let a = 0; let b = 0; for (let i = 0; i < this.n; i++) { a += this.vx[i]; b += this.vy[i]; } out[0] = a; out[1] = b; return out; }
  ke(i) { return (this.vx[i] * this.vx[i] + this.vy[i] * this.vy[i] + this.vz[i] * this.vz[i]) / (2 * C2); }
  /** Number of mobile particles whose kinetic energy is >= e (kJ/mol). */
  countAbove(e) { let c = 0; for (let i = 0; i < this.n; i++) if (this.ke(i) >= e) c++; return c; }

  step() {
    const dt = DT; const n = this.n; const x = this.x; const y = this.y; const vx = this.vx; const vy = this.vy;
    const p = this.p; const eaEff = effectiveEa(p); const half = (Math.min(360, p.site) * Math.PI) / 360; const anyOri = p.site >= 360;
    const maxX = WORLD.w - R; const maxY = WORLD.h - R;
    this.t += dt; this.stepCount++;
    const t = this.t;
    for (let i = 0; i < n; i++) {
      x[i] += vx[i] * dt; y[i] += vy[i] * dt; this.phi[i] += this.spin[i] * dt;
      if (x[i] < R) { x[i] = R; if (vx[i] < 0) vx[i] = -vx[i]; } else if (x[i] > maxX) { x[i] = maxX; if (vx[i] > 0) vx[i] = -vx[i]; }
      if (y[i] < R) { y[i] = R; if (vy[i] < 0) vy[i] = -vy[i]; } else if (y[i] > maxY) { y[i] = maxY; if (vy[i] > 0) vy[i] = -vy[i]; }
      if (this.flash[i] > 0) this.flash[i] -= dt;
    }
    // ---- solid sites (immovable, infinitely heavy)
    if (p.system === "solid" && this.tn > 0) {
      const rr = R + TILE_R; const rr2 = rr * rr; const tn = this.tn;
      for (let i = 0; i < n; i++) {
        if (x[i] < this.tbx0 || x[i] > this.tbx1 || y[i] < this.tby0 || y[i] > this.tby1) continue;
        for (let k = 0; k < tn; k++) {
          if (this.tstate[k] !== 0) continue;
          const dx = x[i] - this.tx[k]; const dy = y[i] - this.ty[k]; const d2 = dx * dx + dy * dy;
          if (d2 >= rr2) continue;
          const d = Math.sqrt(d2) || 1e-9; const nx = dx / d; const ny = dy / d; // tile -> particle
          const vn = vx[i] * nx + vy[i] * ny;
          x[i] = this.tx[k] + nx * rr; y[i] = this.ty[k] + ny * rr;
          if (vn >= 0) continue;
          const u = -vn;
          vx[i] += 2 * u * nx; vy[i] += 2 * u * ny;
          if (this.sp[i] !== SP.B) continue;
          const E = (u * u) / (2 * C2);
          const th = Math.atan2(ny, nx); // direction tile -> particle
          const oriA = anyOri || Math.abs(angDiff(this.tphi[k], th)) <= half; // surface site faces the particle
          const oriB = anyOri || Math.abs(angDiff(this.phi[i], th + Math.PI)) <= half;
          const out = this._outcome(E >= eaEff, oriA && oriB);
          // event geometry: relative velocity A(tile)-B = -(B velocity before the bounce)
          const bvx = vx[i] - 2 * u * nx; const bvy = vy[i] - 2 * u * ny;
          this._fillEvent(out, 1, E, eaEff, -bvx, -bvy, -nx * 2 * R, -ny * 2 * R, this.tphi[k], this.phi[i], oriA, oriB, this.tx[k], this.ty[k]);
          if (out === OUT.SUCCESS) {
            this.tstate[k] = 1; this.tflash[k] = 0.6; // the site is used up for good (it became C) and B became D
            this.sp[i] = SP.D; this.flash[i] = 0.6;
          }
        }
      }
    }
    // ---- particle-particle (uniform grid)
    const head = this.head; head.fill(-1); const nxt = this.next;
    for (let i = 0; i < n; i++) { const c = ((x[i] / CELL) | 0) + ((y[i] / CELL) | 0) * GX; nxt[i] = head[c]; head[c] = i; }
    const lim2 = 4 * R * R;
    for (let i = 0; i < n; i++) {
      const cx = (x[i] / CELL) | 0; const cy = (y[i] / CELL) | 0;
      for (let oy = -1; oy <= 1; oy++) {
        const yy = cy + oy; if (yy < 0 || yy >= GY) continue;
        for (let ox = -1; ox <= 1; ox++) {
          const xx = cx + ox; if (xx < 0 || xx >= GX) continue;
          for (let j = head[xx + yy * GX]; j !== -1; j = nxt[j]) {
            if (j <= i) continue;
            const dx = x[j] - x[i]; const dy = y[j] - y[i]; const d2 = dx * dx + dy * dy;
            if (d2 >= lim2) continue;
            const d = Math.sqrt(d2) || 1e-9; const nx = dx / d; const ny = dy / d; // i -> j
            const rvx = vx[i] - vx[j]; const rvy = vy[i] - vy[j];
            const u = rvx * nx + rvy * ny;
            const ov = (2 * R - d) / 2;
            x[i] -= nx * ov; y[i] -= ny * ov; x[j] += nx * ov; y[j] += ny * ov;
            if (u <= 0) continue;
            vx[i] -= u * nx; vy[i] -= u * ny; vx[j] += u * nx; vy[j] += u * ny; // equal masses, elastic
            if (this.sp[i] + this.sp[j] !== 1) continue; // only A with B can react
            const a = this.sp[i] === SP.A ? i : j; const b = a === i ? j : i;
            const sgn = a === i ? 1 : -1; // direction A -> B is sgn * (nx, ny)
            const thAB = Math.atan2(sgn * ny, sgn * nx);
            const E = (u * u) / (4 * C2);
            const oriA = anyOri || Math.abs(angDiff(this.phi[a], thAB)) <= half;
            const oriB = anyOri || Math.abs(angDiff(this.phi[b], thAB + Math.PI)) <= half;
            const out = this._outcome(E >= eaEff, oriA && oriB);
            // relative velocity A - B BEFORE the bounce, and separation A - B
            const rvAx = sgn * rvx; const rvAy = sgn * rvy;
            this._fillEvent(out, 0, E, eaEff, rvAx, rvAy, -sgn * nx * 2 * R, -sgn * ny * 2 * R, this.phi[a], this.phi[b], oriA, oriB, (x[i] + x[j]) / 2, (y[i] + y[j]) / 2);
            if (out === OUT.SUCCESS) {
              this.sp[a] = SP.C; this.sp[b] = SP.D; this.flash[a] = 0.6; this.flash[b] = 0.6; // irreversible: C and D stay products
            }
          }
        }
      }
    }
    if (this.tn > 0) for (let k = 0; k < this.tn; k++) if (this.tflash[k] > 0) this.tflash[k] -= dt;
    if (t >= this.nextHist) { this._pushHist(); this.nextHist += HIST_EVERY; }
  }

  _outcome(energyOk, oriOk) { return energyOk ? (oriOk ? OUT.SUCCESS : OUT.ORIENTATION) : (oriOk ? OUT.LOW_ENERGY : OUT.BOTH); }

  _fillEvent(out, kind, E, ea, ux, uy, dx, dy, phiA, phiB, oriA, oriB, lx, ly) {
    this.coll++;
    if (out === OUT.SUCCESS) { if (this.succ < SUCC_CAP) this.sT[this.succ] = this.t; this.succ++; } else if (out === OUT.LOW_ENERGY) this.failE++; else if (out === OUT.ORIENTATION) this.failO++; else this.failB++;
    if (E >= ea) this.energetic++;
    const seq = ++this.evSeq;
    const slot = this.evHead; this.evHead = (this.evHead + 1) % EV_CAP; if (this.evCount < EV_CAP) this.evCount++;
    const b = this.evBuf; const o = slot * EV_F;
    b[o] = seq; b[o + 1] = this.t; b[o + 2] = out; b[o + 3] = kind; b[o + 4] = E; b[o + 5] = ea; b[o + 6] = this.p.T;
    b[o + 7] = ux; b[o + 8] = uy; b[o + 9] = dx; b[o + 10] = dy; b[o + 11] = phiA; b[o + 12] = phiB;
    b[o + 13] = oriA ? 1 : 0; b[o + 14] = oriB ? 1 : 0; b[o + 15] = lx; b[o + 16] = ly;
    const l = this.lastEv; const lo = out * EV_F;
    for (let q = 0; q < EV_F; q++) l[lo + q] = b[o + q];
  }

  /** Most recent recorded event of an outcome (0..3) as a plain object, or null. */
  lastEvent(out) {
    const l = this.lastEv; const o = out * EV_F;
    if (l[o] < 0) return null;
    return eventFromBuf(l, o);
  }
  /** Most recent event of any outcome. */
  latestEvent() {
    if (this.evCount === 0) return null;
    const slot = (this.evHead - 1 + EV_CAP) % EV_CAP;
    return eventFromBuf(this.evBuf, slot * EV_F);
  }

  _pushHist() {
    const idx = (this.histStart + this.histLen) % HIST_CAP;
    if (this.histLen < HIST_CAP) this.histLen++; else this.histStart = (this.histStart + 1) % HIST_CAP;
    this.hT[idx] = this.t; this.hSucc[idx] = this.succ; this.hColl[idx] = this.coll; this.hA[idx] = this.countA(); this.hB[idx] = this.countSpecies(SP.B);
  }
  _hist(k) { return (this.histStart + k) % HIST_CAP; }

  /** Successful collisions per second averaged over the last `window` seconds of simulated time (at history resolution). */
  rateOver(window = 10, what = "succ") {
    const arr = what === "coll" ? this.hColl : this.hSucc; const L = this.histLen;
    const last = this._hist(L - 1); const tNow = this.hT[last];
    let k = L - 1; while (k > 0 && tNow - this.hT[this._hist(k - 1)] <= window + 1e-9) k--;
    const first = this._hist(k); const span = tNow - this.hT[first];
    if (span <= 0) return 0;
    return (arr[last] - arr[first]) / span;
  }
  /** Seconds actually covered by rateOver(window) (shorter than the window right after a start). */
  rateSpan(window = 10) {
    const L = this.histLen; const tNow = this.hT[this._hist(L - 1)]; const t0 = this.hT[this._hist(0)];
    return Math.min(window, tNow - t0);
  }
  /** Copy of the history every 0.5 s: time, cumulative successes (= products C formed), cumulative A-B collisions, amount of A (solid system: unused sites) and of B. */
  history() {
    const L = this.histLen; const t = new Float64Array(L); const s = new Float64Array(L); const c = new Float64Array(L); const ha = new Float64Array(L); const hb = new Float64Array(L);
    for (let k = 0; k < L; k++) { const i = this._hist(k); t[k] = this.hT[i]; s[k] = this.hSucc[i]; c[k] = this.hColl[i]; ha[k] = this.hA[i]; hb[k] = this.hB[i]; }
    return { t, succ: s, coll: c, a: ha, b: hb };
  }

  run(seconds) { const steps = Math.round(seconds / DT); for (let i = 0; i < steps; i++) this.step(); }

  exposedTiles() {
    let ex = 0; let present = 0; const tn = this.tn; const eps = 0.5;
    for (let k = 0; k < tn; k++) {
      if (this.tstate[k] !== 0) continue; present++;
      let nb = 0;
      for (let m = 0; m < tn; m++) {
        if (m === k || this.tstate[m] !== 0) continue;
        const dx = Math.abs(this.tx[m] - this.tx[k]); const dy = Math.abs(this.ty[m] - this.ty[k]);
        if ((dx < eps && Math.abs(dy - TILE_PITCH) < eps) || (dy < eps && Math.abs(dx - TILE_PITCH) < eps)) nb++;
      }
      if (nb < 4) ex++;
    }
    return { exposed: ex, present, total: tn };
  }
}

function eventFromBuf(b, o) {
  return {
    seq: b[o], t: b[o + 1], outcome: b[o + 2], kind: b[o + 3], E: b[o + 4], ea: b[o + 5], T: b[o + 6],
    ux: b[o + 7], uy: b[o + 8], dx: b[o + 9], dy: b[o + 10], phiA: b[o + 11], phiB: b[o + 12],
    oriA: b[o + 13] === 1, oriB: b[o + 14] === 1, x: b[o + 15], y: b[o + 16],
  };
}
