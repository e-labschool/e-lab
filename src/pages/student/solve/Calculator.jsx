import { useState } from "react";
import { X } from "lucide-react";

// A plain numerical calculator — evaluates arithmetic the student
// explicitly enters, never chemistry. No formula lookup, no equation
// solving, no unit conversion beyond what the student computes by hand.
const BASIC_KEYS = ["7", "8", "9", "\u00f7", "4", "5", "6", "\u00d7", "1", "2", "3", "\u2212", "0", ".", "=", "+"];
const SCIENCE_KEYS = [
  { label: "x\u00b2", op: "^2" }, { label: "x\u02b8", op: "^" }, { label: "\u221a", op: "sqrt(" }, { label: "10\u02e3", op: "10^" },
  { label: "log", op: "log(" }, { label: "ln", op: "ln(" }, { label: "e\u02e3", op: "e^" }, { label: "EXP", op: "e" },
  { label: "(", op: "(" }, { label: ")", op: ")" },
];

// Minimal, safe expression evaluator — deliberately not a raw `eval()`.
// The `expr` string this receives can ONLY ever have been built by
// press() below, which is only ever called from this component's own
// button clicks — there is no free-text input anywhere in this
// calculator, so the input alphabet is already constrained to exactly
// the symbols these buttons produce, before any parsing happens here.
function evaluateExpression(expr) {
  const prepped = expr
    .replace(/\u00d7/g, "*")
    .replace(/\u00f7/g, "/")
    .replace(/\u2212/g, "-")
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
    setExpr((prev) => prev + value);
  }
  function clear() { setExpr(""); setResult(null); setError(false); }
  function backspace() { setExpr((prev) => prev.slice(0, -1)); setResult(null); }

  return (
    <div className="w-full max-w-xs rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Calculator</p>
        <button type="button" onClick={onClose} aria-label="Close calculator" className="text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"><X size={15} /></button>
      </div>

      <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-right">
        <p className="min-h-[1.25rem] truncate text-sm text-[var(--color-ink-faint)]">{expr || "0"}</p>
        <p className={`min-h-[1.5rem] truncate text-lg font-semibold ${error ? "text-[var(--color-coral)]" : "text-[var(--color-ink)]"}`}>
          {error ? "Error" : result != null ? result : "\u00a0"}
        </p>
      </div>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {SCIENCE_KEYS.map((k) => (
          <button key={k.label} type="button" onClick={() => press(k.op)} aria-label={k.label} className="rounded-md border border-[var(--color-line)] py-2 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20">
            {k.label}
          </button>
        ))}
      </div>

      <div className="mt-2 grid grid-cols-4 gap-1.5">
        <button type="button" onClick={clear} aria-label="Clear" className="rounded-md border border-[var(--color-line)] py-2.5 text-sm font-medium text-[var(--color-coral)] hover:bg-[var(--color-coral-soft)]">C</button>
        <button type="button" onClick={backspace} aria-label="Backspace" className="rounded-md border border-[var(--color-line)] py-2.5 text-sm font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/20">{"\u232b"}</button>
        <span className="col-span-2" />
        {BASIC_KEYS.map((k) => (
          <button
            key={k} type="button" onClick={() => press(k)} aria-label={k}
            className={`rounded-md border py-2.5 text-sm font-medium ${
              k === "=" ? "border-[var(--color-indigo)] bg-[var(--color-indigo)] text-white" : "border-[var(--color-line)] text-[var(--color-ink)] hover:bg-[var(--color-line)]/20"
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  );
}
