// The navigation state machine of the single NMR workspace. PURE (no React, no store): the store delegates to `navigate`, so the
// rules below are the only place where "which step / sub-stage / instrument operation is active" is decided.
//
//   step  1..6   the six steps of the workspace (Previous / Next / direct selection; never locked)
//   sub          the inline progression inside step 6: environments -> chemical shift -> integration -> coupling
//   op    0..5   the instrument walk-through inside step 4 ("Next Stage"): sample into magnet -> field -> RF pulse -> detection -> FID -> FT
//
// The three levels are independent: moving between steps never changes `sub` or `op`, and neither of them changes the step, so the
// molecule, B0 and every other experiment setting (kept elsewhere in the store) are untouched by navigation.

export const STEPS = [
  { id: "nucleus", n: 1, label: "Hydrogen nucleus", title: "Explore a Hydrogen Nucleus" },
  { id: "field", n: 2, label: "Magnetic field", title: "Apply the Magnetic Field" },
  { id: "radio", n: 3, label: "Radiofrequency", title: "Send Radiofrequency Radiation" },
  { id: "instrument", n: 4, label: "Instrument", title: "Explore the NMR Instrument" },
  { id: "spectrum", n: 5, label: "Spectrum", title: "Generate the Spectrum" },
  { id: "molecules", n: 6, label: "Molecules", title: "Introduce Molecules and Interpret NMR" },
];
export const STEP_COUNT = STEPS.length;

export const SUBSTAGES = [
  { id: "environments", n: 1, label: "Environments", letter: "a" },
  { id: "shift", n: 2, label: "Chemical shift", letter: "b" },
  { id: "integration", n: 3, label: "Integration", letter: "c" },
  { id: "coupling", n: 4, label: "Coupling", letter: "d" },
];
export const SUB_IDS = SUBSTAGES.map((s) => s.id);

/** The instrument operations, in order (the details of each live in physics/instrumentModel.js). */
export const OPS = [
  { id: "insert", short: "Sample", label: "Sample into the magnet" },
  { id: "field", short: "Field", label: "Magnetic field" },
  { id: "pulse", short: "RF pulse", label: "RF pulse" },
  { id: "detect", short: "Detect", label: "Signal detection" },
  { id: "fid", short: "FID", label: "FID and processing" },
  { id: "ft", short: "Fourier", label: "Fourier transform" },
];
export const OP_COUNT = OPS.length;

export const clampStep = (n) => (Number.isFinite(n) ? Math.min(STEP_COUNT, Math.max(1, Math.round(n))) : 1);
export const clampOp = (n) => (Number.isFinite(n) ? Math.min(OP_COUNT - 1, Math.max(0, Math.round(n))) : 0);
export const subIndex = (sub) => Math.max(0, SUB_IDS.indexOf(sub));
export const subAt = (i) => SUB_IDS[Math.min(SUB_IDS.length - 1, Math.max(0, Math.round(i)))];

/**
 * navigate(nav, action) -> new nav ({ step, sub, op }). Actions:
 *   { type: "next" | "prev" }                     step by one (stops at the ends; no wrap-around)
 *   { type: "goto", step }                        direct selection of any step
 *   { type: "subNext" | "subPrev" }, { type: "subGoto", sub }
 *   { type: "opNext" | "opPrev" }, { type: "opGoto", op }
 * The returned object is the SAME reference when nothing changed.
 */
export function navigate(nav, action) {
  const { step, sub, op } = nav;
  let next = nav;
  switch (action?.type) {
    case "next": next = { ...nav, step: clampStep(step + 1) }; break;
    case "prev": next = { ...nav, step: clampStep(step - 1) }; break;
    case "goto": next = { ...nav, step: clampStep(action.step) }; break;
    case "subNext": next = { ...nav, sub: subAt(subIndex(sub) + 1) }; break;
    case "subPrev": next = { ...nav, sub: subAt(subIndex(sub) - 1) }; break;
    case "subGoto": next = SUB_IDS.includes(action.sub) ? { ...nav, sub: action.sub } : nav; break;
    case "opNext": next = { ...nav, op: clampOp(op + 1) }; break;
    case "opPrev": next = { ...nav, op: clampOp(op - 1) }; break;
    case "opGoto": next = { ...nav, op: clampOp(action.op) }; break;
    default: break;
  }
  return next.step === step && next.sub === sub && next.op === op ? nav : next;
}

export const canPrev = (nav) => nav.step > 1;
export const canNext = (nav) => nav.step < STEP_COUNT;
export const stepInfo = (step) => STEPS[clampStep(step) - 1];

/** Which transport controls make sense in each step (Play / Pause / Reset / speed "where relevant"). */
export const TRANSPORT = {
  1: { play: false, reset: true, speed: true },
  2: { play: true, reset: true, speed: true },
  3: { play: true, reset: true, speed: true },
  4: { play: true, reset: true, speed: true },
  5: { play: true, reset: true, speed: true },
  6: { play: true, reset: true, speed: true },
};
