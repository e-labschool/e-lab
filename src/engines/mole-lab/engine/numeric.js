// Numerical hygiene for the Mole Lab engine (spec A6).
//
// TWO mechanisms keep floating-point artefacts (0.30000000000000004) out of every result:
//
//  1. AMOUNT QUANTA.  Every amount of substance that is STORED or MOVED (packets, vessels, ledgers) is an integer number of
//     quanta, 1 quantum = 1e-9 mol.  Integer addition / subtraction is exact up to 2^53 (9e15 quanta = 9e6 mol), so
//     split / combine / pour / react can never create or destroy material by rounding.  `fromQuanta(q)` is one correctly
//     rounded division of two exactly-representable integers, so 300000000 quanta -> 0.3 (not 0.30000000000000004).
//  2. clean(x).  Every DERIVED real number (n = m/M, c = n/V, V = nRT/P ...) is snapped to 12 significant digits and
//     |x| < 1e-12 becomes 0 before it leaves the engine.
//
// "Exact numbers" (what the maths uses) are always kept apart from "formatted strings" (what the screen shows):
// the fmt* functions at the bottom are the ONLY place numbers become text.

/** Quanta per mole: 1 quantum = 1e-9 mol. */
export const QUANTA_PER_MOL = 1e9;
/** Largest amount (mol) the lab accepts.  Keeps every quantity far below 2^53 quanta and the packet count bounded. */
export const MAX_AMOUNT_MOL = 500;
export const MAX_AMOUNT_QUANTA = MAX_AMOUNT_MOL * QUANTA_PER_MOL;
/** One mole expressed in quanta (the capacity of every standard packet). */
export const ONE_MOLE_Q = QUANTA_PER_MOL;

export function clean(x) {
  if (typeof x !== "number" || !Number.isFinite(x)) return x;
  if (Math.abs(x) < 1e-12) return 0;
  return Number(x.toPrecision(12));
}

/** mol (any real) -> integer quanta (rounded to the nearest quantum). */
export const toQuanta = (mol) => Math.round(mol * QUANTA_PER_MOL);
/** integer quanta -> mol, clean. */
export const fromQuanta = (q) => q / QUANTA_PER_MOL;

/** True when a and b agree to a relative+absolute tolerance. */
export function approxEqual(a, b, rel = 1e-9, abs = 1e-12) {
  return Math.abs(a - b) <= Math.max(abs, rel * Math.max(Math.abs(a), Math.abs(b)));
}

/** Parse user text into a finite number.  Returns { ok, value, error }.  Accepts "12", "12.5", ".5", "1e2", "1,5" (decimal comma). */
export function parseNumberInput(raw, { min = -Infinity, max = Infinity, allowNegative = false, allowZero = true, label = "Value" } = {}) {
  if (typeof raw === "number") {
    if (!Number.isFinite(raw)) return { ok: false, value: NaN, error: `${label} must be a finite number.` };
    return check(raw);
  }
  const s = String(raw ?? "").trim().replace(",", ".");
  if (s === "") return { ok: false, value: NaN, error: `Enter a number for ${label.toLowerCase()}.`, empty: true };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(s)) return { ok: false, value: NaN, error: `${label} must be a number (digits only, e.g. 12.5).` };
  return check(Number(s));
  function check(v) {
    if (!Number.isFinite(v)) return { ok: false, value: NaN, error: `${label} must be a finite number.` };
    if (v < 0 && !allowNegative) return { ok: false, value: v, error: `${label} cannot be negative.` };
    if (v === 0 && !allowZero) return { ok: false, value: 0, error: `${label} must be greater than zero.` };
    if (v < min) return { ok: false, value: v, error: `${label} must be at least ${min}.` };
    if (v > max) return { ok: false, value: v, error: `${label} must be at most ${max}.` };
    return { ok: true, value: clean(v), error: null };
  }
}

// ---------------------------------------------------------------- formatting (display strings only)
/** Round to `dp` decimals, as a string, never "-0". */
export function fmtFixed(x, dp = 2) {
  if (!Number.isFinite(x)) return "–";
  const s = (Math.abs(x) < 0.5 * 10 ** -dp ? 0 : x).toFixed(dp);
  return s.replace(/^-0(\.0+)?$/, (m) => m.slice(1));
}
/** Amount in mol, trimmed sensibly: 0.25 -> "0.25", 1 -> "1.00", 0.333333 -> "0.333". */
export function fmtMol(n) {
  if (!Number.isFinite(n)) return "–";
  const c = clean(n);
  if (c === 0) return "0.00";
  const dp = Math.abs(c) >= 100 ? 1 : Math.abs(c * 100 - Math.round(c * 100)) < 1e-9 ? 2 : 3;
  return fmtFixed(c, dp);
}
/** Significant figures. */
export function fmtSig(x, sig = 3) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  const dp = Math.max(0, sig - 1 - e);
  return fmtFixed(x, Math.min(dp, 12));
}
const SUP = { 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹", "-": "⁻", "+": "⁺" };
export const sup = (s) => String(s).replace(/[0-9+-]/g, (c) => SUP[c]);
/** 6.02214076e23 -> "6.022 × 10²³" */
export function fmtSci(x, sig = 4) {
  if (!Number.isFinite(x)) return "–";
  if (x === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(x)));
  const m = x / 10 ** e;
  return `${m.toFixed(sig - 1)} × 10${sup(e)}`;
}
