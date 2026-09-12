import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

export const STATUS_MESSAGES = [
  "Pure water: [H⁺] = [OH⁻] → Neutral",
  "HCl added → [H⁺] increases ↑",
  "H⁺ reacts with OH⁻ → [OH⁻] decreases ↓",
  "More H⁺ → lower pH",
];

export default function StatusStrip({ statusIndex }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border text-center"
      style={{ height: 48, borderColor: PALETTE.border, background: PALETTE.panel }}
    >
      <p className="px-3 text-[13px]" style={{ color: PALETTE.textSecondary }}>{STATUS_MESSAGES[statusIndex]}</p>
    </div>
  );
}
