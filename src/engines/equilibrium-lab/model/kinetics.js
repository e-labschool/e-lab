// Generic reversible mass-action engine for ONE reaction step with any stoichiometry, plus an adaptive Dormand-Prince RK45
// integrator with controlled error.  Concentrations are mol dm-3 and are the only state the chemistry depends on.
//
//   r_f = kf * prod_i c_i^orderF_i        r_r = kr * prod_j c_j^orderR_j          (orders = stoichiometric coefficients)
//   dc_i/dt = nu_i (r_f - r_r)             Q = prod_i c_i^(nu_i)                     K_c = kf / kr   (so r_f / r_r = K / Q)
//
// Because every species changes by nu_i * d(extent), element totals are conserved exactly by the equations; the integrator keeps
// them to round-off, and a step that would make a concentration negative is rejected and retried with a smaller step.
import { C_ZERO, ODE_ATOL, ODE_MAX_STEPS, ODE_RTOL } from "./constants.js";

const pw = (c, n) => (n === 1 ? c : n === 2 ? c * c : n === 3 ? c * c * c : Math.pow(c, n));

export function forwardRate(rx, c, kf) { let r = kf; for (const id of Object.keys(rx.orderF)) r *= pw(c[id], rx.orderF[id]); return r; }
export function reverseRate(rx, c, kr) { let r = kr; for (const id of Object.keys(rx.orderR)) r *= pw(c[id], rx.orderR[id]); return r; }

/** Reaction quotient from current concentrations (same expression as K_c).  Returns Infinity when a reactant is absent and
 *  a product is present, 0 when no product is present, NaN when both sides are empty. */
export function reactionQuotient(rx, c) {
  let num = 1; let den = 1; let anyP = false; let anyR = false;
  for (const id of Object.keys(rx.nu)) {
    const n = rx.nu[id];
    if (n > 0) { num *= pw(c[id], n); if (c[id] > 0) anyP = true; } else { den *= pw(c[id], -n); if (c[id] > 0) anyR = true; }
  }
  if (!anyP && !anyR) return NaN;
  if (den === 0) return num === 0 ? NaN : Infinity;
  return num / den;
}

/** d c / d t as an object keyed by species id. */
export function derivative(rx, c, kf, kr) {
  const net = forwardRate(rx, c, kf) - reverseRate(rx, c, kr); const d = {};
  for (const id of Object.keys(rx.nu)) d[id] = rx.nu[id] * net;
  return d;
}

// ---- Dormand-Prince 5(4) ----
const C = [0, 1 / 5, 3 / 10, 4 / 5, 8 / 9, 1, 1];
const AA = [[], [1 / 5], [3 / 40, 9 / 40], [44 / 45, -56 / 15, 32 / 9], [19372 / 6561, -25360 / 2187, 64448 / 6561, -212 / 729],
  [9017 / 3168, -355 / 33, 46732 / 5247, 49 / 176, -5103 / 18656], [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84]];
const B5 = [35 / 384, 0, 500 / 1113, 125 / 192, -2187 / 6784, 11 / 84, 0];
const B4 = [5179 / 57600, 0, 7571 / 16695, 393 / 640, -92097 / 339200, 187 / 2100, 1 / 40];

/** Integrate dy/dt = f(y) over [0, dt].  `ids` fixes the species order.  Returns { c, steps, rejected }. */
export function integrate(rx, c0, kf, kr, dt, { rtol = ODE_RTOL, atol = ODE_ATOL, h0 = null } = {}) {
  const ids = Object.keys(rx.nu); const n = ids.length;
  let y = ids.map((id) => c0[id]);
  const f = (v) => { const cc = {}; ids.forEach((id, i) => { cc[id] = v[i] < 0 ? 0 : v[i]; }); const net = forwardRate(rx, cc, kf) - reverseRate(rx, cc, kr); return ids.map((id) => rx.nu[id] * net); };
  let t = 0; let h = Math.min(dt, h0 ?? dt); let steps = 0; let rejected = 0;
  let k1 = f(y);
  while (t < dt * (1 - 1e-15)) {
    if (steps + rejected > ODE_MAX_STEPS) throw new Error("ODE step limit exceeded");
    if (t + h > dt) h = dt - t;
    const k = [k1];
    for (let s = 1; s < 7; s += 1) {
      const ys = y.map((v, i) => { let acc = 0; for (let j = 0; j < s; j += 1) acc += AA[s][j] * k[j][i]; return v + h * acc; });
      k.push(f(ys));
    }
    const y5 = y.map((v, i) => { let acc = 0; for (let j = 0; j < 7; j += 1) acc += B5[j] * k[j][i]; return v + h * acc; });
    let errNorm = 0; let negative = false;
    for (let i = 0; i < n; i += 1) {
      let e = 0; for (let j = 0; j < 7; j += 1) e += (B5[j] - B4[j]) * k[j][i];
      e *= h; const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
      errNorm = Math.max(errNorm, Math.abs(e) / sc);
      if (y5[i] < -1e-12) negative = true;
    }
    if (negative || errNorm > 1 || !Number.isFinite(errNorm)) {
      rejected += 1; h *= negative ? 0.25 : Math.max(0.1, 0.9 * Math.pow(errNorm || 10, -0.2)); if (h < 1e-18) throw new Error("ODE step underflow");
      continue;
    }
    t += h; steps += 1; y = y5.map((v) => (Math.abs(v) < C_ZERO ? 0 : v)); k1 = f(y);
    h *= errNorm === 0 ? 5 : Math.min(5, Math.max(0.2, 0.9 * Math.pow(errNorm, -0.2)));
  }
  const out = {}; ids.forEach((id, i) => { out[id] = Math.max(0, y[i]); });
  return { c: out, steps, rejected };
}

/** Exact solution of the linear system A <=> B (used to validate the RK45 integrator and by the everyday model). */
export function exactAB(A0, B0, kf, kr, t) {
  const N = A0 + B0; const s = kf + kr; const Aeq = (kr * N) / s;
  const A = Aeq + (A0 - Aeq) * Math.exp(-s * t);
  return { A, B: N - A, Aeq, Beq: N - Aeq };
}
