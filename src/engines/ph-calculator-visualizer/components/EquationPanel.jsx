import { concentrationFromPH, formatDecimal, formatScientific, formatPH } from "../lib/ph.js";

export default function EquationPanel({ pH }) {
  const conc = concentrationFromPH(pH);
  const isNeutral = Math.abs(pH - 7) < 0.05;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-center text-base font-medium tracking-wide" style={{ color: "var(--color-ink)" }}>
        pH = −log₁₀[H₃O⁺]
      </p>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-md border px-3 py-2.5 text-center" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
            [H₃O⁺]
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color: "var(--color-indigo)" }}>
            {formatDecimal(conc)}
          </p>
          <p className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
            mol dm⁻³ &middot; {formatScientific(conc)}
          </p>
        </div>

        <div className="rounded-md border px-3 py-2.5 text-center" style={{ borderColor: "var(--color-line)", background: "var(--color-paper-raised)" }}>
          <p className="text-[11px] font-medium uppercase tracking-wide" style={{ color: "var(--color-ink-faint)" }}>
            pH
          </p>
          <p className="mt-0.5 text-xl font-semibold tabular-nums" style={{ color: "var(--color-indigo)" }}>
            {formatPH(pH)}
          </p>
          <p className="text-[11px]" style={{ color: "var(--color-ink-faint)" }}>
            {isNeutral ? "Neutral at 25°C" : "\u00A0"}
          </p>
        </div>
      </div>
    </div>
  );
}
