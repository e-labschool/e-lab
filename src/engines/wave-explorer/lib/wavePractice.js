// Pure helpers for Wave Explorer round 2 (WE-03, WE-04): a mechanical (sound) wave model in real units, an A-vs-B
// comparison with predict questions whose answers are recomputed from c = f*lambda and E = hf, and the "wave to photon"
// link to hydrogen transitions. Tested in scripts/test-wave-explorer.mjs.
import { C, H, J_PER_EV, hydrogenTransitionEv, HC_EV_NM } from "../../../lib/atomic/constants.js";

/** Speed of sound in dry air at 20 C (m/s). Used only by the longitudinal (mechanical) wave. */
export const SPEED_OF_SOUND = 343;
export const SOUND_HZ_MIN = 20;
export const SOUND_HZ_MAX = 20000;
export const SOUND_HZ_DEFAULT = 440;

export const soundWavelengthM = (f) => (f > 0 ? SPEED_OF_SOUND / f : null);
/** slider 0..1 <-> frequency (log scale, 20 Hz - 20 kHz, the nominal range of human hearing). */
export function soundSliderToHz(p) {
  const q = Math.min(1, Math.max(0, p));
  return SOUND_HZ_MIN * (SOUND_HZ_MAX / SOUND_HZ_MIN) ** q;
}
export function soundHzToSlider(f) {
  return Math.min(1, Math.max(0, Math.log(f / SOUND_HZ_MIN) / Math.log(SOUND_HZ_MAX / SOUND_HZ_MIN)));
}
export function formatSoundWavelength(m) {
  if (m >= 1) return `${m.toFixed(m >= 10 ? 1 : 2)} m`;
  if (m >= 0.01) return `${(m * 100).toFixed(m >= 0.1 ? 1 : 2)} cm`;
  return `${(m * 1000).toFixed(1)} mm`;
}
export function formatHz(f) {
  return f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 1 : 2)} kHz` : `${f.toFixed(f >= 100 ? 0 : 1)} Hz`;
}
/** Drawn wavelength in px: schematic (log), longer wavelength = lower frequency = wider drawn wave. */
export function soundDrawnPx(f) {
  return 140 - soundHzToSlider(f) * 90;
}
/** On-screen animation rate (cycles/s), compressed so 20 Hz - 20 kHz stays watchable; higher f still looks faster. */
export function soundVisualCps(f) {
  return Math.min(1.4, Math.max(0.25, 0.6 * (f / SOUND_HZ_DEFAULT) ** 0.12));
}

/** Closest hydrogen emission line (n_hi -> n_lo, n up to 8) to a photon energy. `close` is true within 3 %; null when the nearest line is more than 50 % away. */
export function nearestHydrogenTransition(eV) {
  let best = null;
  for (let lo = 1; lo <= 7; lo++) {
    for (let hi = lo + 1; hi <= 8; hi++) {
      const e = hydrogenTransitionEv(lo, hi);
      const rel = Math.abs(e - eV) / eV;
      if (!best || rel < best.rel) best = { lo, hi, eV: e, rel, nm: HC_EV_NM / e };
    }
  }
  return best && best.rel <= 0.5 ? { ...best, close: best.rel <= 0.03, higher: best.eV > eV } : null;
}

function mulberry32(a) {
  return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const nice = (nm) => { const e = Math.floor(Math.log10(nm)); const m = Math.round(nm / 10 ** e * 2) / 2; return Math.max(1e-3, m * 10 ** e); };
export const energyJ = (nm) => (H * C) / (nm * 1e-9);
export const freqHz = (nm) => C / (nm * 1e-9);

/** Predict question for two EM waves A and B. The answer is recomputed from the numbers, never stored. */
export function compareQuestion(seed, kind) {
  const r = mulberry32(seed);
  const pickNm = () => nice(10 ** (-3 + r() * 15));
  let a = pickNm(); let b = pickNm();
  let guard = 0;
  while ((Math.max(a, b) / Math.min(a, b) < 3) && guard++ < 50) b = pickNm();
  const k = kind ?? (["energy", "frequency", "wavelength"][Math.floor(r() * 3)]);
  return { seed, kind: k, aNm: a, bNm: b, ...answerFor(k, a, b) };
}
export function answerFor(kind, aNm, bNm) {
  if (kind === "energy") return { prompt: "Which wave carries the higher photon energy?", answer: energyJ(aNm) > energyJ(bNm) ? "A" : "B" };
  if (kind === "frequency") return { prompt: "Which wave has the higher frequency?", answer: freqHz(aNm) > freqHz(bNm) ? "A" : "B" };
  return { prompt: "Which wave has the longer wavelength?", answer: aNm > bNm ? "A" : "B" };
}
export function checkCompare(q, guess) {
  const eA = energyJ(q.aNm) / J_PER_EV; const eB = energyJ(q.bNm) / J_PER_EV;
  return { correct: guess === q.answer, ratioE: Math.max(eA, eB) / Math.min(eA, eB) };
}

/** Visible-light zoom: on-screen cycles/s is exactly proportional to the real frequency (550 nm = 0.5 cycles/s), so 400 nm runs 1.375x faster than 550 nm. */
export const visibleCps = (nm) => 0.5 * freqHz(nm) / freqHz(550);

/** 3 s.f. with plain digits for 0.01 - 9999, otherwise the caller's scientific format. */
export function formatEv(v, sci) {
  return v >= 0.01 && v < 1e4 ? Number(v.toPrecision(3)).toString() : sci(v, 3);
}
