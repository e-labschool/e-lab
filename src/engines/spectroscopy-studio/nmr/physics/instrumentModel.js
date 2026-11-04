// What is happening in the spectrometer at each moment of the guided six-step sequence (pure; no React, no SVG).
// The magnetisation values during the pulse come from the Bloch model (a 90 degree pulse on resonance), not from hand-drawn animation curves.
import { equilibrium, stateAt, TWO_PI } from "./blochSim.js";

export const STEP_SECONDS = 4;
export const STEP_COUNT = 6;
export const GUIDED_DURATION = STEP_SECONDS * STEP_COUNT;

export const STEPS = [
  { id: "insert", title: "Insert the sample", focus: "tube" },
  { id: "field", title: "Apply the magnetic field", focus: "magnet" },
  { id: "pulse", title: "Transmit an RF pulse", focus: "probe" },
  { id: "detect", title: "Detect the signal", focus: "receiver" },
  { id: "fid", title: "Generate the FID", focus: "processing" },
  { id: "ft", title: "Fourier transform", focus: "processing" },
];

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const W1 = TWO_PI * 25000; const TP90 = Math.PI / 2 / W1; // 25 kHz RF, 10 microsecond 90 degree pulse (on resonance)
const SCHED = { omega1: W1, delta: 0, tp: TP90, t1: Infinity, t2: Infinity, m0: 1 };

/** Index and progress of the guided step at display time t (0 .. GUIDED_DURATION). */
export function stepAt(t) {
  const c = Math.min(GUIDED_DURATION, Math.max(0, t));
  const step = Math.min(STEP_COUNT - 1, Math.floor(c / STEP_SECONDS));
  return { step, p: c >= GUIDED_DURATION ? 1 : (c - step * STEP_SECONDS) / STEP_SECONDS };
}

/**
 * Parameters of the picture.
 *  insert 0..1 tube position (1 = in the probe)   field 0..1 emphasis of the field lines   mz, mxy: magnetisation (units of M0), az: transverse direction
 *  tx 0..1 RF transmission (amplitude)  txP 0..1 progress through the pulse   rx 0..1 receive chain active   fid, ft 0..1 how much of the FID / transform is drawn
 *  display: "none" | "fid" | "spec"
 */
export function guidedState(step, p, phase = 0) {
  const s = { step, p, insert: 1, field: 0.5, mz: 1, mxy: 0, az: 0, tx: 0, txP: 0, rx: 0, fid: 0, ft: 0, display: "none" };
  if (step === 0) { s.insert = clamp01(p); s.field = 0.35; s.mz = 0; }
  else if (step === 1) { s.field = 1; s.mz = (1 - Math.exp(-3 * p)) / (1 - Math.exp(-3)); }
  else if (step === 2) {
    const m = stateAt(SCHED, p * TP90); s.field = 0.6; s.mz = m[2]; s.mxy = Math.hypot(m[0], m[1]); s.az = Math.PI / 2; s.tx = 1; s.txP = p;
  } else if (step === 3) { s.field = 0.6; s.mz = 0.02 * p; s.mxy = Math.exp(-1.2 * p); s.az = Math.PI / 2 - TWO_PI * (1.5 + 0.7 * phase); s.rx = 1; }
  else if (step === 4) { s.field = 0.5; s.mz = 0.03; s.mxy = Math.exp(-1.2 - p); s.az = -TWO_PI * (0.7 * phase); s.rx = 1; s.fid = p; s.display = "fid"; }
  else { s.field = 0.5; s.mz = 0.04; s.mxy = Math.exp(-2.2); s.az = -TWO_PI * (0.7 * phase); s.rx = 0.4; s.fid = 1; s.ft = p; s.display = "spec"; }
  return s;
}

export const eq = () => equilibrium(1);
