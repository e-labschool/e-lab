// Bloch-equation model of one spin-1/2 isochromat (the ensemble-averaged magnetisation M of identical 1H nuclei).
// Pure module (no React, no three). Tested by scripts/test-nmr-physics.mjs.
//
// Frame and conventions
//   The equations are written in the frame rotating about z at the RF angular frequency omega_rf, so the RF field is
//   static there. With positive gamma (1H):
//       dM/dt = M x Omega  -  ( Mx / T2 , My / T2 , (Mz - M0) / T1 )
//       Omega = gamma * B_eff = ( omega1 , 0 , Delta ),   omega1 = gamma B1,   Delta = omega0 - omega_rf = -2 pi (nu_rf - nu0)
//   B1 (the co-rotating component of the RF field) lies along +x. Starting from M = (0, 0, M0) it tips the magnetisation
//   towards +y. Relaxation: T2 damps the transverse components, T1 restores Mz towards the equilibrium value M0.
//   Units: M in units of M0 by default (M0 = 1), time in seconds, rates in rad/s.
//
// Approximations (the UI repeats these): a single isochromat (no field inhomogeneity -> T2 stands for the observed decay),
// linear relaxation (Bloch), instantaneous equilibrium magnetisation M0 (no radiation damping), RF applied as a rectangular
// "hard" pulse of constant amplitude and phase, only the co-rotating component of a linearly polarised RF field.
import { GAMMA_H1, larmorHz } from "./constants.js";

export const TWO_PI = 2 * Math.PI;

/** omega1 = gamma B1 (rad/s) from B1 in tesla. */
export const omega1FromB1 = (b1Tesla) => GAMMA_H1 * b1Tesla;
/** nu1 = omega1 / 2 pi in Hz. */
export const nu1FromB1 = (b1Tesla) => (GAMMA_H1 * b1Tesla) / TWO_PI;
/** Flip angle on resonance, theta = gamma B1 t_p (radians). */
export const flipAngle = (omega1, tp) => omega1 * tp;
/** Pulse duration that gives a given on-resonance flip angle. */
export const pulseDurationFor = (angleRad, omega1) => angleRad / omega1;
/** Rotating-frame detuning Delta = omega0 - omega_rf (rad/s) from the RF offset nu_rf - nu0 (Hz). */
export const deltaFromRfOffsetHz = (rfOffsetHz) => -TWO_PI * rfOffsetHz;
/** RF offset (Hz) between the RF frequency (MHz) and the resonance at B0. */
export const rfOffsetHz = (rfMHz, b0Tesla) => rfMHz * 1e6 - larmorHz(b0Tesla);

export function equilibrium(m0 = 1) { return [0, 0, m0]; }
export const norm = (m) => Math.hypot(m[0], m[1], m[2]);
export const transverse = (m) => Math.hypot(m[0], m[1]);

/** dM/dt for the rotating-frame Bloch equations. T1/T2 may be Infinity (no relaxation). */
export function derivative(m, p) {
  const { omega1 = 0, delta = 0, t1 = Infinity, t2 = Infinity, m0 = 1 } = p;
  return [
    m[1] * delta - m[0] / t2,
    m[2] * omega1 - m[0] * delta - m[1] / t2,
    -m[1] * omega1 - (m[2] - m0) / t1,
  ];
}

/** One classical 4th-order Runge-Kutta step of length h. */
export function rk4Step(m, h, p) {
  const k1 = derivative(m, p);
  const k2 = derivative([m[0] + 0.5 * h * k1[0], m[1] + 0.5 * h * k1[1], m[2] + 0.5 * h * k1[2]], p);
  const k3 = derivative([m[0] + 0.5 * h * k2[0], m[1] + 0.5 * h * k2[1], m[2] + 0.5 * h * k2[2]], p);
  const k4 = derivative([m[0] + h * k3[0], m[1] + h * k3[1], m[2] + h * k3[2]], p);
  return [
    m[0] + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]),
    m[1] + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]),
    m[2] + (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]),
  ];
}

/** Integrate under constant parameters for a time `t` with `steps` equal RK4 steps (deterministic). */
export function integrateRK4(m, t, p, steps = 2000) {
  if (!(t > 0)) return [m[0], m[1], m[2]];
  const n = Math.max(1, Math.ceil(steps));
  const h = t / n; let s = m;
  for (let i = 0; i < n; i += 1) s = rk4Step(s, h, p);
  return s;
}

/** Exact solution WITHOUT relaxation: rotation of M about the axis Omega by the angle |Omega| t (Rodrigues' formula), in the
 * direction given by dM/dt = M x Omega. */
export function rotateExact(m, omega1, delta, t) {
  const w = Math.hypot(omega1, delta);
  if (w === 0 || t === 0) return [m[0], m[1], m[2]];
  // dM/dt = M x Omega = -Omega x M, i.e. a rotation about Omega by the angle  -w t.
  const nx = omega1 / w; const nz = delta / w; const ny = 0;
  const a = -w * t; const c = Math.cos(a); const s = Math.sin(a);
  const dot = nx * m[0] + ny * m[1] + nz * m[2];
  const cx = ny * m[2] - nz * m[1]; const cy = nz * m[0] - nx * m[2]; const cz = nx * m[1] - ny * m[0]; // n x m
  return [
    m[0] * c + cx * s + nx * dot * (1 - c),
    m[1] * c + cy * s + ny * dot * (1 - c),
    m[2] * c + cz * s + nz * dot * (1 - c),
  ];
}

/** Closed-form free precession (no RF) for time t: rotation about z by Delta t, T2 decay of Mxy, T1 recovery of Mz. */
export function freePrecession(m, delta, t, t1 = Infinity, t2 = Infinity, m0 = 1) {
  const c = Math.cos(delta * t); const s = Math.sin(delta * t);
  const d2 = Math.exp(-t / t2); const d1 = Math.exp(-t / t1);
  return [d2 * (m[0] * c + m[1] * s), d2 * (m[1] * c - m[0] * s), m0 + (m[2] - m0) * d1];
}

/** Analytic response of equilibrium magnetisation (0,0,1) to a rectangular pulse, no relaxation (Rabi result). */
export function analyticPulseResponse(omega1, delta, tp) {
  const w2 = omega1 * omega1 + delta * delta; const w = Math.sqrt(w2);
  if (w === 0) return { mx: 0, my: 0, mz: 1, mxy: 0 };
  const c = Math.cos(w * tp); const s = Math.sin(w * tp);
  const mz = (delta * delta + omega1 * omega1 * c) / w2;
  const my = (omega1 / w) * s;
  const mx = (omega1 * delta * (1 - c)) / w2;
  return { mx, my, mz, mxy: Math.hypot(mx, my) };
}

/** Schedule: a rectangular pulse of length tp at t = 0, then free evolution. Parameters:
 *  { omega1, delta, tp, t1, t2, m0 }. Returns M at time t >= 0 (seconds from the start of the pulse), recomputed from t = 0
 *  every call, so scrubbing or stepping back gives exactly the same state as playing forward (pure function of t). */
export function stateAt(sched, t, { pulseSteps = 2400 } = {}) {
  const { omega1, delta, tp, t1 = Infinity, t2 = Infinity, m0 = 1 } = sched;
  const p = { omega1, delta, t1, t2, m0 };
  const start = equilibrium(m0);
  if (t <= 0) return start;
  const during = (tt) => {
    // Very large detuning (e.g. the RF is MHz away from resonance): |Omega| tp is hundreds of radians. Relaxation during a
    // microsecond pulse is then irrelevant, so the exact rotation is used instead of ever more RK4 steps.
    if (Math.hypot(omega1, delta) * tp > 400) { const r = rotateExact(start, omega1, delta, tt); return [r[0] * m0, r[1] * m0, r[2] * m0]; }
    return integrateRK4(start, tt, p, Math.max(1, Math.ceil(Math.max((pulseSteps * tt) / tp, (Math.hypot(omega1, delta) * tt) / 0.02))));
  };
  if (t <= tp) return during(t);
  return freePrecession(during(tp), delta, t - tp, t1, t2, m0);
}

/** State right after the pulse (end of the pulse, start of free precession). */
export function afterPulse(sched, opts) { return stateAt(sched, sched.tp, opts); }

/** Response after the pulse as a function of RF offset (Hz): the plot behind "what happens when the RF matches the resonance". */
export function responseVsOffset(sched, offsetsHz, { steps = 600 } = {}) {
  return offsetsHz.map((off) => {
    const p = { omega1: sched.omega1, delta: deltaFromRfOffsetHz(off), t1: sched.t1, t2: sched.t2, m0: sched.m0 ?? 1 };
    const m = integrateRK4(equilibrium(p.m0), sched.tp, p, steps);
    return { offsetHz: off, mz: m[2], mxy: transverse(m), mx: m[0], my: m[1] };
  });
}

/**
 * Pedagogical time line of one excitation experiment: display seconds (animation) -> physical seconds.
 *   [0, pulseDisplay]                  the RF pulse     (physical 0 .. tp)
 *   [pulseDisplay, pulseDisplay+free]  free precession  (physical tp .. tp + tFree)
 * The two segments use DIFFERENT time compressions (a pulse lasts microseconds, relaxation takes up to seconds), which the UI states.
 * tFree = 3 periods of the offset (so the precession is readable) but at most 2 T2 and at least 1 ms... on resonance 2 T2.
 */
export function makeExcitationTimeline(sched, { pulseDisplayS = 3, freeDisplayS = 5 } = {}) {
  const { tp, delta, t2 = Infinity } = sched;
  const nu = Math.abs(delta) / TWO_PI;
  const t2c = Number.isFinite(t2) ? t2 : 1;
  const tFree = nu > 1 ? Math.min(3 / nu, 2 * t2c) : 2 * t2c;
  const total = pulseDisplayS + freeDisplayS;
  const toPhysical = (tau) => {
    if (tau <= 0) return 0;
    if (tau <= pulseDisplayS) return (tau / pulseDisplayS) * tp;
    return tp + (Math.min(tau, total) - pulseDisplayS) / freeDisplayS * tFree;
  };
  return { pulseDisplayS, freeDisplayS, totalDisplayS: total, tFree, toPhysical };
}

/**
 * Dense table of M along the display time line (for the trail behind the tip and the time plots): `n` points from display time 0 to the end.
 * The pulse part is integrated sequentially with RK4 (a few steps per interval), the free part uses the closed form, so a whole table costs
 * a few thousand derivative evaluations. It agrees with stateAt() (tested).
 */
export function trajectory(sched, timeline, n = 320) {
  const { omega1, delta, tp, t1 = Infinity, t2 = Infinity, m0 = 1 } = sched;
  const p = { omega1, delta, t1, t2, m0 };
  const pts = []; const total = timeline.totalDisplayS;
  const huge = Math.hypot(omega1, delta) * tp > 400;
  let m = equilibrium(m0); let tPrev = 0;
  for (let i = 0; i <= n; i += 1) {
    const tau = (total * i) / n; const t = timeline.toPhysical(tau);
    if (t <= tp) {
      if (huge) { const r = rotateExact(equilibrium(m0), omega1, delta, t); m = [r[0] * m0, r[1] * m0, r[2] * m0]; }
      else { const steps = Math.max(2, Math.ceil((Math.hypot(omega1, delta) * (t - tPrev)) / 0.02)); m = integrateRK4(m, t - tPrev, p, steps); }
      tPrev = t;
      pts.push({ tau, t, m });
    } else {
      if (tPrev < tp) { // land exactly on the end of the pulse first
        if (huge) { const r = rotateExact(equilibrium(m0), omega1, delta, tp); m = [r[0] * m0, r[1] * m0, r[2] * m0]; }
        else { const steps = Math.max(2, Math.ceil((Math.hypot(omega1, delta) * (tp - tPrev)) / 0.02)); m = integrateRK4(m, tp - tPrev, p, steps); }
        tPrev = tp;
      }
      pts.push({ tau, t, m: freePrecession(m, delta, t - tp, t1, t2, m0) });
    }
  }
  return pts;
}
