import { useState } from "react";
import { X } from "lucide-react";

// A plain numerical calculator — evaluates arithmetic the student
// explicitly enters, never chemistry. No formula lookup, no equation
// solving, no unit conversion beyond what the student computes by hand.
// Sized and keyed like an actual scientific calculator (420px+, large
// keys) rather than a small utility popup, per explicit feedback that
// the previous compact version felt too small to use comfortably.
const BASIC_KEYS = ["7", "8", "9", "\u00f7", "4", "5", "6", "\u00d7", "1", "2", "3", "\u2212", "0", ".", "\u00b1", "+"];
const SCIENCE_KEYS = [
  { label: "sin", op: "sin(" }, { label: "cos", op: "cos(" }, { label: "tan", op: "tan(" }, { label: "\u03c0", op: "pi" },
  { label: "log", op: "log(" }, { label: "ln", op: "ln(" }, { label: "\u221a", op: "sqrt(" }, { label: "x\u00b2", op: "^2" },
  { label: "x\u02b8", op: "^" }, { label: "10\u02e3", op: "10^" }, { label: "e\u02e3", op: "e^" }, { label: "EXP", op: "e" },
];

// Minimal, safe expression evaluator — deliberately not a raw `eval()`.
// The `expr` string this receives can ONLY ever have been built by
// press() below, which is only ever called from this component's own
// button clicks — there is no free-text input anywhere in this
// calculator, so the input alphabet is already constrained to exactly
// the symbols these buttons produce, before any parsing happens here.
// Trig functions take degrees (the convention IB DP Chemistry students
// actually use), not radians.
function evaluateExpression(expr) {
  const prepped = expr
    .replace(/\u00d7/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/\u2212/g, "-")
    .replace(/pi/g, "Math.PI")
    .replace(/sin\(/g, "Math.sin(Math.PI/180*")
    .replace(/cos\(/g, "Math.cos(Math.PI/180*")
    .replace(/tan\(/g, "Math.tan(Math.PI/180*")
    .replace(/(\d+(?:\.\d+)?)\^2/g, "Math.pow($1,2)")
    .replace(/(\d+(?:\.\d+)?)\^(\d+(?:\.\d+)?)/g, "Math.pow($1,$2)")
    .replace(/10\^(-?\d+(?:\.\d+)?)/g, "Math.pow(10,$1)")
    .replace(/e\^(-?\d+(?:\.\d+)?)/g, "Math.exp($1)")
    .replace(/sqrt\(/g, "Math.sqrt(")
    .replace(/log\(/g, "Math.log10(")
    .replace(/ln\(/g, "Math.log(")
    .replace(/(\d+(?:\.\d+)?)e(-?\d+)/g, "($1*Math.pow(10,$2))"); // 6.02e23 scientific notation

  // eslint-disable-next-line no-new-func
  return Function(`"use strict"; return (${prepped});`)();
}

export default function Calculator({ onClose }) {
  const [expr, setExpr] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(false);

  function press(value) {
    setError(false);
    if (value === "=") {
      try {
        const r = evaluateExpression(expr);
        if (typeof r !== "number" || Number.isNaN(r) || !Number.isFinite(r)) throw new Error("invalid");
        setResult(r);
      } catch {
        setError(true);
        setResult(null);
      }
      return;
    }
    if (value === "\u00b1") {
      setExpr((prev) => (prev.startsWith("-") ? prev.slice(1) : `-${prev}`));
      return;
    }
    setExpr((prev) => prev + value);
  }
  function clear() { setExpr(""); setResult(null); setError(false); }
  function backspace() { setExpr((prev) => prev.slice(0, -1)); setResult(null); }

  return (
    <div className="w-full max-w-[460px] rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 shadow-2xl">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--color-ink)]">Scientific Calculator</p>
        <button type="button" onClick={onClose} aria-label="Close calculator" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={20} /></button>
      </div>

      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-4 py-3.5 text-right">
        <p className="min-h-[1.5rem] truncate text-base text-[var(--color-ink-faint)]">{expr || "0"}</p>
        <p className={`min-h-[2.5rem] truncate text-3xl font-bold ${error ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>
          {error ? "Error" : result != null ? result : "\u00a0"}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-2">
        {SCIENCE_KEYS.map((k) => (
          <button key={k.label} type="button" onClick={() => press(k.op)} aria-label={k.label} className="rounded-md border border-[var(--color-line)] py-3 text-sm font-semibold text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-line)]/25 active:scale-[0.97]">
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-2.5 grid grid-cols-6 gap-2">
        <button type="button" onClick={() => press("(")} aria-label="Open parenthesis" className="rounded-md border border-[var(--color-line)] py-3 text-base font-semibold text-[var(--color-ink)] hover:bg-[var(--color-line)]/25">(</button>
        <button type="button" onClick={() => press(")")} aria-label="Close parenthesis" className="rounded-md border border-[var(--color-line)] py-3 text-base font-semibold text-[var(--color-ink)] hover:bg-[var(--color-line)]/25">)</button>
        <button type="button" onClick={clear} aria-label="Clear all" className="col-span-2 rounded-md border border-[var(--color-coral)]/40 bg-[var(--color-coral-soft)] py-3 text-sm font-bold text-[var(--color-coral)] hover:opacity-80">AC</button>
        <button type="button" onClick={backspace} aria-label="Delete last character" className="col-span-2 rounded-md border border-[var(--color-line)] py-3 text-sm font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/25">DEL</button>
      </div>

      <div className="mt-2.5 grid grid-cols-4 gap-2">
        {BASIC_KEYS.map((k) => (
          <button
            key={k} type="button" onClick={() => press(k)} aria-label={k}
            className="rounded-md border border-[var(--color-line)] py-4 text-lg font-semibold text-[var(--color-ink)] transition-colors hover:bg-[var(--color-line)]/25 active:scale-[0.97]"
          >
            {k}
          </button>
        ))}
      </div>
      <button
        type="button" onClick={() => press("=")} aria-label="Equals"
        className="mt-2.5 w-full rounded-md bg-[#2647C4] py-3.5 text-lg font-bold text-white shadow-[0_2px_6px_rgba(20,30,80,0.25)] transition-colors hover:bg-[#3654D6] active:scale-[0.99]"
      >
        =
      </button>
    </div>
  );
}
