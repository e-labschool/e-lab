// Number formatting shared by the acid-base simulations. Rounds DECIMAL digits half-up (not binary), so
// 1.25e-5 -> "1.3 x 10^-5" rather than the toExponential() result "1.2".
const SUP = { "-": "⁻", 0: "⁰", 1: "¹", 2: "²", 3: "³", 4: "⁴", 5: "⁵", 6: "⁶", 7: "⁷", 8: "⁸", 9: "⁹" };
export const superscript = (n) => String(n).split("").map((c) => SUP[c] ?? c).join("");

/** Round positive v to n significant figures (half-up on the decimal digits). Returns { digits: "125", exp: -5 } meaning 1.25e-5. */
export function roundSig(v, n) {
  if (!(v > 0) || !Number.isFinite(v)) return { digits: "0", exp: 0 };
  const [m, e] = v.toExponential(14).split("e");
  let exp = Number(e);
  const all = m.replace(".", "");
  let head = all.slice(0, n);
  if (Number(all[n] ?? 0) >= 5) {
    head = String(BigInt(head) + 1n);
    if (head.length > n) { head = head.slice(0, n); exp += 1; }
  }
  return { digits: head.padStart(n, "0"), exp };
}

export function formatScientific(v, sig = 2) {
  if (!(v > 0)) return "0";
  const { digits, exp } = roundSig(v, sig);
  const mant = digits.length > 1 ? `${digits[0]}.${digits.slice(1)}` : digits;
  return `${mant} × 10${superscript(exp)}`;
}

export function formatDecimal(v, sig = 3) {
  if (!(v > 0)) return "0";
  const { digits, exp } = roundSig(v, sig);
  let s;
  if (exp >= 0) { s = digits.padEnd(exp + 1, "0"); const intPart = s.slice(0, exp + 1); const frac = s.slice(exp + 1); s = frac ? `${intPart}.${frac}` : intPart; }
  else s = `0.${"0".repeat(-exp - 1)}${digits}`;
  if (s.includes(".")) s = s.replace(/0+$/, "").replace(/\.$/, "");
  return s;
}

/** pH with a true minus sign and 2 decimal places (IB: decimal places of pH = significant figures of concentration). */
export function formatPH(pH, dp = 2) {
  if (!Number.isFinite(pH)) return "—";
  const s = (Math.abs(pH) < 0.5 * Math.pow(10, -dp) ? 0 : pH).toFixed(dp);
  return s.startsWith("-") ? `−${s.slice(1)}` : s;
}

/** Signed change with a true minus; hidden (null) when it would display as zero. */
export function formatDelta(d, dp = 2) {
  if (!Number.isFinite(d) || Math.abs(d) < 0.5 * Math.pow(10, -dp)) return null;
  return `${d > 0 ? "+" : "−"}${Math.abs(d).toFixed(dp)}`;
}

/** Parse a typed concentration: accepts "0,001", "1e-3", "1x10^-3", "1 x 10-3", "1×10⁻³", spaces. Returns NaN when unreadable. */
export function parseNumber(text) {
  if (typeof text !== "string") return NaN;
  let t = text.trim().replace(/\s+/g, "").replace(",", ".");
  const SUPMAP = { "⁻": "-", "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9" };
  t = t.replace(/[⁻⁰¹²³⁴-⁹]/g, (c) => SUPMAP[c]);
  t = t.replace(/(?:x|×|\*)10\^?(?=[-+\d])/i, "e").replace(/^10\^/, "1e");
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return NaN;
  return Number(t);
}
