// pH <-> concentration helpers for the pH Calculator. The maths is pH = -log10[H3O+] and pH + pOH = 14 (Kw = 1.00e-14 at 298 K).
// The scale runs from pH -1 to 15 so that 10 mol dm-3 strong acid / base can be shown; real pH meters and glass electrodes
// are only reliable between about 0 and 14 (and concentrated solutions are not ideal), which the UI says.
import { KW } from "../../../lib/acidbase/constants.js";
import { formatDecimal as fd, formatScientific as fs, formatPH as fp, parseNumber } from "../../../lib/acidbase/format.js";

export const PH_MIN = -1;
export const PH_MAX = 15;
export const DEFAULT_PH = 3;
export const CONC_MAX = Math.pow(10, -PH_MIN); // 10 mol dm-3
export const CONC_MIN = Math.pow(10, -PH_MAX); // 1e-15 mol dm-3

export const concentrationFromPH = (pH) => Math.pow(10, -pH);
export const pHFromConcentration = (c) => -Math.log10(c);
export const clampPH = (pH) => Math.min(PH_MAX, Math.max(PH_MIN, pH));
export const hydroxideFromPH = (pH) => KW / Math.pow(10, -pH);
export const pOHFromPH = (pH) => 14 - pH;
export const formatDecimal = (v, sig = 2) => fd(v, sig);
export const formatScientific = (v, sig = 2) => fs(v, sig);
export const formatPH = (pH, dp = 2) => fp(pH, dp);

/** Interpret typed text. kind: "conc" ([H3O+] in mol dm-3) or "ph". Returns { ok, pH } or { ok:false, reason, pHWouldBe? } - never a silent clamp. */
export function interpretInput(text, kind) {
  const n = parseNumber(text);
  if (!Number.isFinite(n)) return { ok: false, reason: "Not a number. Try 0.001, 1e-3 or 1 × 10⁻³ (a comma is accepted as a decimal point)." };
  if (kind === "ph") {
    if (n < PH_MIN || n > PH_MAX) return { ok: false, reason: `pH ${formatPH(n)} is outside this scale (${PH_MIN} to ${PH_MAX}). The scale stops there; real solutions that acidic or basic are far from ideal and glass pH meters are only reliable from about 0 to 14.` };
    return { ok: true, pH: n };
  }
  if (n <= 0) return { ok: false, reason: "A concentration must be greater than zero (pH = −log₁₀ of it)." };
  const pH = pHFromConcentration(n);
  if (n > CONC_MAX * (1 + 1e-9) || n < CONC_MIN * (1 - 1e-9)) {
    return { ok: false, pHWouldBe: pH, reason: `${formatScientific(n)} mol dm⁻³ would be pH ${formatPH(pH)}, outside this scale (${PH_MIN} to ${PH_MAX}, i.e. 10 to 1 × 10⁻¹⁵ mol dm⁻³). It was not changed. Very concentrated solutions are not ideal (activity ≠ concentration) and a pH meter would not read this value.` };
  }
  return { ok: true, pH };
}
