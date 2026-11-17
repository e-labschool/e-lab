const SUBS = "₀₁₂₃₄₅₆₇₈₉";
const SUPS = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** Splits "SO₄²⁻" into runs so subscripts / superscripts can be drawn as real <sub> / <sup> (or font-size shifts in SVG). */
export function subParts(str) {
  const out = [];
  for (const ch of String(str)) {
    let kind = ""; let t = ch;
    const a = SUBS.indexOf(ch); const b = SUPS.indexOf(ch);
    if (a >= 0) { kind = "sub"; t = String(a); } else if (b >= 0) { kind = "sup"; t = String(b); } else if (ch === "⁺") { kind = "sup"; t = "+"; } else if (ch === "⁻") { kind = "sup"; t = "−"; }
    if (out.length && out[out.length - 1].kind === kind) out[out.length - 1].t += t; else out.push({ t, kind });
  }
  return out;
}
export const HtmlSubs = ({ text }) => subParts(text).map((q, i) => (q.kind === "sub" ? <sub key={i}>{q.t}</sub> : q.kind === "sup" ? <sup key={i}>{q.t}</sup> : <span key={i}>{q.t}</span>));
