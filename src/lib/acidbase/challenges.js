// Practice tasks for the acid-base simulations (pure, seeded so tests are repeatable). Answers are computed here, never typed in.
import { formatScientific, formatDecimal, formatPH, parseNumber } from "./format.js";
import { KW } from "./constants.js";

/** Small deterministic PRNG (mulberry32) returning floats in [0, 1). */
export function rng(seed) { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

// ---------- pH Calculator strip ----------
export const PH_TASKS = ["conc-to-ph", "ph-to-conc", "oh-to-ph"];
/** One question. `kind` fixes the type; otherwise it is drawn from the seed. Answers are rounded as the IB expects: pH to 2 dp (2 s.f.). */
export function phChallenge(seed, kind) {
  const r = rng(seed); const k = kind ?? PH_TASKS[Math.floor(r() * PH_TASKS.length)];
  const mant = Math.round((1 + r() * 8.9) * 10) / 10; const ex = -(2 + Math.floor(r() * 10)); // a x 10^-b, a 1.0-9.9, b 2-11
  const val = mant * Math.pow(10, ex); const sci = formatScientific(val, 2);
  if (k === "conc-to-ph") { const pH = -Math.log10(val); return { kind: k, prompt: `[H₃O⁺] = ${sci} mol dm⁻³. What is the pH?`, answer: Number(pH.toFixed(2)), unit: "", tol: 0.011, working: `pH = −log₁₀(${sci}) = ${formatPH(pH)}` }; }
  if (k === "oh-to-ph") { const pOH = -Math.log10(val); const pH = 14 - pOH; return { kind: k, prompt: `[OH⁻] = ${sci} mol dm⁻³ at 298 K. What is the pH?`, answer: Number(pH.toFixed(2)), unit: "", tol: 0.011, working: `pOH = −log₁₀(${sci}) = ${formatPH(pOH)}; pH = 14.00 − ${formatPH(pOH)} = ${formatPH(pH)}` }; }
  const pH = Math.round((1 + r() * 12) * 100) / 100; const c = Math.pow(10, -pH);
  return { kind: "ph-to-conc", pH, prompt: `pH = ${pH.toFixed(2)}. What is [H₃O⁺] in mol dm⁻³? (2 significant figures, e.g. 3.2e-5)`, answer: Number(c.toPrecision(2)), unit: "mol dm⁻³", rel: 0.03, working: `[H₃O⁺] = 10^(−${pH.toFixed(2)}) = ${formatScientific(c, 2)} mol dm⁻³` };
}
/** Check a typed answer. Returns { ok, close, message }. A concentration is judged on relative error, a pH on absolute error. */
export function checkPhAnswer(ch, text) {
  const x = parseNumber(String(text ?? "").replace("−", "-"));
  if (!Number.isFinite(x)) return { ok: false, close: false, message: "Type a number (for a concentration you can write 3.2e-5 or 3.2 x 10^-5)." };
  if (ch.kind === "ph-to-conc") { const err = Math.abs(x - ch.answer) / ch.answer; return err <= ch.rel ? { ok: true, close: true, message: "Correct." } : { ok: false, close: err < 0.5, message: err < 0.5 ? "Close, but check your significant figures or the sign of the exponent." : "Not yet. Remember [H₃O⁺] = 10^(−pH)." }; }
  const err = Math.abs(x - ch.answer);
  if (err <= ch.tol) return { ok: true, close: true, message: "Correct." };
  if (Math.abs(x - (14 - ch.answer)) <= ch.tol) return { ok: false, close: true, message: "That is the pOH. Use pH + pOH = 14." };
  return { ok: false, close: err < 1, message: x < 0 === ch.answer < 0 ? "Not yet. pH = −log₁₀[H₃O⁺]." : "Check the sign: concentrations below 1 mol dm⁻³ give a positive pH." };
}

// ---------- Titration: unknown concentration ----------
export const UNKNOWN_FLASKS = ["HCl", "CH3COOH", "NaOH", "NH3"];
export const UNKNOWN_TITRANT_CONC = 0.1;
/** The hidden concentration of the unknown, 0.0500 .. 0.1500 mol dm-3 in steps of 0.0005 (3 s.f.). */
export function makeUnknown(seed, flaskId) {
  const r = rng(seed); const id = flaskId ?? UNKNOWN_FLASKS[Math.floor(r() * UNKNOWN_FLASKS.length)];
  const c = Math.round((0.05 + r() * 0.1) / 0.0005) * 0.0005;
  return { flaskId: id, buretteId: id === "HCl" || id === "CH3COOH" ? "NaOH" : "HCl", cFlask: Number(c.toFixed(4)), cBurette: UNKNOWN_TITRANT_CONC };
}
/** Student's concentration from their equivalence volume (mono-protic 1:1): c = c(titrant) V(eq) / V(flask). */
export const concFromVeq = (veq, cBurette = UNKNOWN_TITRANT_CONC, vFlask = 25) => (cBurette * veq) / vFlask;
/** Mark an answer: within 2 % of the hidden value is accepted (a good burette reading is +/- 0.05 cm3 on ~25 cm3). */
export function checkUnknown(u, answerText, tol = 0.02) {
  const x = parseNumber(String(answerText ?? ""));
  if (!Number.isFinite(x) || x <= 0) return { ok: false, message: "Type a concentration in mol dm⁻³, for example 0.0850." };
  const err = (x - u.cFlask) / u.cFlask;
  return Math.abs(err) <= tol ? { ok: true, err, message: `Correct: within ${(tol * 100).toFixed(0)} % (error ${(err * 100).toFixed(1)} %).` } : { ok: false, err, message: `Not within ${(tol * 100).toFixed(0)} %. You are ${err > 0 ? "too high" : "too low"} by ${(Math.abs(err) * 100).toFixed(0)} %. Find the steepest rise on your readings, then c = c(titrant) × V(eq) / 25.0.` };
}
export const revealUnknown = (u) => `${formatDecimal(u.cFlask, 3)} mol dm⁻³`;
export { KW };
