import React from "react";

const SYMBOLS = [
  [/\\times/g, "×"], [/\\cdot/g, "·"], [/\\sum/g, "∑"], [/\\rightarrow/g, "→"], [/\\to/g, "→"],
  [/\\approx/g, "≈"], [/\\pm/g, "±"], [/\\Delta/g, "Δ"], [/\\leq/g, "≤"], [/\\geq/g, "≥"],
];

function matchingBrace(s, start) {
  let depth = 0;
  for (let i = start; i < s.length; i += 1) {
    if (s[i] === "{") depth += 1;
    if (s[i] === "}") { depth -= 1; if (depth === 0) return i; }
  }
  return -1;
}

function MathParts({ source }) {
  let s = String(source ?? "").trim();
  SYMBOLS.forEach(([re, value]) => { s = s.replace(re, value); });
  const out = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith("\\frac{", i)) {
      const n0 = i + 5; const n1 = matchingBrace(s, n0);
      if (n1 > n0 && s[n1 + 1] === "{") {
        const d0 = n1 + 1; const d1 = matchingBrace(s, d0);
        if (d1 > d0) {
          out.push(<span key={i} className="mx-1 inline-flex align-middle flex-col items-stretch text-center leading-tight"><span className="border-b border-current px-1"><MathParts source={s.slice(n0 + 1, n1)} /></span><span className="px-1"><MathParts source={s.slice(d0 + 1, d1)} /></span></span>);
          i = d1 + 1; continue;
        }
      }
    }
    if ((s[i] === "_" || s[i] === "^") && s[i + 1] === "{") {
      const end = matchingBrace(s, i + 1);
      if (end > i) {
        const Tag = s[i] === "_" ? "sub" : "sup";
        out.push(<Tag key={i} className="text-[0.72em]"><MathParts source={s.slice(i + 2, end)} /></Tag>);
        i = end + 1; continue;
      }
    }
    if ((s[i] === "_" || s[i] === "^") && s[i + 1]) {
      const Tag = s[i] === "_" ? "sub" : "sup";
      out.push(<Tag key={i} className="text-[0.72em]">{s[i + 1]}</Tag>); i += 2; continue;
    }
    if (s[i] === "\\") {
      const m = s.slice(i).match(/^\\([A-Za-z]+)/);
      if (m) { out.push(m[1]); i += m[0].length; continue; }
    }
    out.push(s[i] === "-" ? "−" : s[i]); i += 1;
  }
  return out;
}

export function DisplayEquation({ children }) {
  return <div className="my-3 overflow-x-auto rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3 text-center font-serif text-[1.08rem] font-medium text-[var(--color-ink)]"><MathParts source={children} /></div>;
}

export default function StructuredText({ text = "", className = "" }) {
  const lines = String(text ?? "").split("\n");
  const nodes = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i]; const trimmed = line.trim();
    const math = trimmed.match(/^\[\[math:(.*)\]\]$/);
    if (math) { nodes.push(<DisplayEquation key={i}>{math[1]}</DisplayEquation>); continue; }
    if (trimmed === "[[box]]") {
      const body = []; let j = i + 1;
      while (j < lines.length && lines[j].trim() !== "[[/box]]") { body.push(lines[j]); j += 1; }
      nodes.push(<div key={i} className="my-3 rounded-md border-2 border-[var(--color-indigo)]/35 bg-[var(--color-indigo-soft)] px-4 py-3 text-[var(--color-ink)]"><StructuredText text={body.join("\n")} /></div>);
      i = j; continue;
    }
    if (!trimmed) { nodes.push(<div key={i} className="h-2" />); continue; }
    nodes.push(<div key={i} className="whitespace-pre-wrap">{line}</div>);
  }
  return <div className={className}>{nodes}</div>;
}
