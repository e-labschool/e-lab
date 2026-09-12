import { formatPH } from "../../ph-calculator-visualizer/lib/ph.js";
import { classify } from "../lib/math.js";
import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

export default function PHPanel({ pH }) {
  const label = classify(pH);
  const labelColor = label === "Neutral" ? "#3FA9A0" : label === "Acidic" ? "#D97757" : "#6C86EE";

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="flex flex-col items-center justify-center gap-0.5 rounded-lg border"
        style={{ width: 180, borderColor: PALETTE.border, background: PALETTE.panel, padding: "14px 10px" }}
      >
        <span className="text-base font-semibold uppercase tracking-wide" style={{ color: PALETTE.textSecondary }}>pH</span>
        <span className="text-[44px] font-bold leading-none tabular-nums" style={{ color: PALETTE.textPrimary }}>{formatPH(pH)}</span>
        <span className="text-sm font-semibold uppercase tracking-wide" style={{ color: labelColor }}>{label}</span>
      </div>
      <p className="text-[13px]" style={{ color: PALETTE.textFaint }}>pH = −log₁₀[H⁺]</p>
    </div>
  );
}
