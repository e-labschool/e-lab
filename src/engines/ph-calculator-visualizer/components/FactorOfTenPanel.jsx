import { concentrationFromPH, formatDecimal, PH_MIN, PH_MAX } from "../lib/ph.js";

export default function FactorOfTenPanel({ pH }) {
  const center = Math.min(PH_MAX - 1, Math.max(PH_MIN + 1, Math.round(pH)));
  const rows = [center - 1, center, center + 1];

  return (
    <div className="flex flex-col gap-1 rounded-md border px-3 py-2.5" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
      <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
        The factor-of-10 pattern
      </p>

      {rows.map((rowPH, i) => (
        <div key={rowPH}>
          <div className={`flex items-center justify-between rounded px-2 py-1 ${rowPH === center ? "font-semibold" : ""}`} style={{ background: rowPH === center ? "var(--color-indigo-soft)" : "transparent", color: rowPH === center ? "var(--color-indigo)" : "var(--color-ink-soft)" }}>
            <span className="text-xs">pH {rowPH}</span>
            <span className="text-xs tabular-nums">[H₃O⁺] = {formatDecimal(concentrationFromPH(rowPH))} mol dm⁻³</span>
          </div>
          {i < rows.length - 1 && (
            <p className="py-0.5 text-center text-[10px]" style={{ color: "var(--color-ink-faint)" }}>
              pH +1 → [H₃O⁺] ÷ 10 &nbsp;·&nbsp; pH −1 → [H₃O⁺] × 10
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
