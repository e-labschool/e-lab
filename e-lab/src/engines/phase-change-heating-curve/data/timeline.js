// Single source of truth for the animation's timing and the heating-curve
// shape. Both the 3D particle system and the 2D graph read from these same
// functions so they can never drift out of sync with each other.
//
// Water at standard atmospheric pressure is the worked example: melting
// point 0 °C, boiling point 100 °C. Other substances melt/boil at
// different temperatures — this is illustrative for water specifically.
export const STAGES = {
  solidHeat: { start: 0, end: 3 },
  melt: { start: 3, end: 7 },
  liquidHeat: { start: 7, end: 11 },
  boil: { start: 11, end: 16 },
  gasHeat: { start: 16, end: 19 },
};

export const DONE_AT = STAGES.gasHeat.end; // 19s of active animation
export const PAUSE_BUFFER = 1.5; // brief pause on the final frame before "Replay" appears

export const TEMP_MIN = -20;
export const TEMP_MELT = 0;
export const TEMP_BOIL = 100;
export const TEMP_MAX = 130;

function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function stageKeyAt(t) {
  if (t < STAGES.solidHeat.end) return "solidHeat";
  if (t < STAGES.melt.end) return "melt";
  if (t < STAGES.liquidHeat.end) return "liquidHeat";
  if (t < STAGES.boil.end) return "boil";
  if (t < STAGES.gasHeat.end) return "gasHeat";
  return "done";
}

export function temperatureAt(rawT) {
  const t = Math.min(rawT, DONE_AT);
  if (t < STAGES.solidHeat.end) return lerp(TEMP_MIN, TEMP_MELT, t / STAGES.solidHeat.end);
  if (t < STAGES.melt.end) return TEMP_MELT;
  if (t < STAGES.liquidHeat.end) return lerp(TEMP_MELT, TEMP_BOIL, (t - STAGES.melt.end) / (STAGES.liquidHeat.end - STAGES.melt.end));
  if (t < STAGES.boil.end) return TEMP_BOIL;
  return lerp(TEMP_BOIL, TEMP_MAX, (t - STAGES.boil.end) / (STAGES.gasHeat.end - STAGES.boil.end));
}

// 0 -> 1 across the melting plateau only; 0 before it, 1 after it.
export function meltProgressAt(t) {
  if (t < STAGES.melt.start) return 0;
  if (t >= STAGES.melt.end) return 1;
  return (t - STAGES.melt.start) / (STAGES.melt.end - STAGES.melt.start);
}

// 0 -> 1 across the boiling plateau only; 0 before it, 1 after it.
export function boilProgressAt(t) {
  if (t < STAGES.boil.start) return 0;
  if (t >= STAGES.boil.end) return 1;
  return (t - STAGES.boil.start) / (STAGES.boil.end - STAGES.boil.start);
}

// Vibration amplitude while still solid: grows through solid heating (more
// kinetic energy -> more vigorous vibration) and holds at its peak through
// melting — particles that are still solid during melting are already at
// the melting point's energy, so they don't vibrate harder as melting
// proceeds; the extra energy goes into breaking arrangement, not into
// faster vibration (see gasSpeedScaleAt/liquidSpeedScaleAt for the same
// idea applied to the other two phases).
export function solidAmplitudeAt(t) {
  if (t < STAGES.solidHeat.end) return lerp(0.02, 0.06, t / STAGES.solidHeat.end);
  return 0.06;
}

// Liquid translational speed ceiling: starts at a modest "just melted"
// baseline (held constant through the melting plateau, since temperature
// isn't rising yet), then climbs through liquid heating, then holds at its
// peak through the boiling plateau (temperature constant again).
export function liquidSpeedScaleAt(t) {
  if (t < STAGES.melt.end) return 0.55;
  if (t < STAGES.liquidHeat.end) return lerp(0.55, 1, (t - STAGES.melt.end) / (STAGES.liquidHeat.end - STAGES.melt.end));
  return 1;
}

// Gas speed ceiling: starts at a modest "just escaped" baseline (held
// constant through the rest of the boiling plateau), then climbs through
// gas heating to its peak.
export function gasSpeedScaleAt(t) {
  if (t < STAGES.boil.end) return 0.5;
  if (t < STAGES.gasHeat.end) return lerp(0.5, 1, (t - STAGES.boil.end) / (STAGES.gasHeat.end - STAGES.boil.end));
  return 1;
}
