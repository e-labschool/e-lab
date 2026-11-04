// Turns the studio settings (B0, RF frequency, B1, pulse length, relaxation) into the Bloch-model schedule. Pure.
import { larmorHz } from "./constants.js";
import { TWO_PI, deltaFromRfOffsetHz, makeExcitationTimeline, omega1FromB1 } from "./blochSim.js";

/** Display-time layout of one excitation experiment (seconds of animation). */
export const PULSE_DISPLAY_S = 3;
export const FREE_DISPLAY_S = 5;
export const RF_DURATION = PULSE_DISPLAY_S + FREE_DISPLAY_S;
/** Pedagogical angular rate (rad per display second) of the laboratory-frame precession drawn in the 3D view. */
export const LAB_DISPLAY_RATE = TWO_PI * 0.75;

export function deriveExcitation(b0Tesla, rf) {
  const nu0 = larmorHz(b0Tesla);
  const offsetHz = rf.rfMHz * 1e6 - nu0;
  const omega1 = omega1FromB1(rf.b1uT * 1e-6);
  const tp = rf.tpUs * 1e-6;
  const delta = deltaFromRfOffsetHz(offsetHz);
  const base = { omega1, delta, tp, t1: rf.t1, t2: rf.t2, m0: 1 };
  let sched = base;
  let timeline = makeExcitationTimeline(base, { pulseDisplayS: PULSE_DISPLAY_S, freeDisplayS: FREE_DISPLAY_S });
  const nuOff = Math.abs(delta) / TWO_PI;
  if (rf.shortenRelax && nuOff > 1) {
    // demonstration only: make T2 comparable with the displayed free-precession window so that the decay is visible
    const t2 = timeline.tFree / 1.5;
    sched = { ...base, t2, t1: 2.5 * t2 };
    timeline = makeExcitationTimeline(sched, { pulseDisplayS: PULSE_DISPLAY_S, freeDisplayS: FREE_DISPLAY_S });
  }
  const nu1 = omega1 / TWO_PI;
  const effOmega = Math.hypot(omega1, delta);
  return {
    nu0, offsetHz, omega1, nu1, tp, delta, sched, timeline,
    flipDeg: ((omega1 * tp) / Math.PI) * 180, effFlipDeg: ((effOmega * tp) / Math.PI) * 180,
    effDir: [omega1, 0, delta],
    demoRelax: sched !== base,
  };
}

/** Pulse length (microseconds) giving a flip angle on resonance, for a B1 in microtesla. */
export const tpForFlipUs = (flipDeg, b1uT) => ((flipDeg * Math.PI) / 180 / omega1FromB1(b1uT * 1e-6)) * 1e6;
