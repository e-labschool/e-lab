import { PALETTE } from "../../particle-model-visualizer/data/palette.js";
import { STAGE_STATUS } from "../data/content.js";

export default function StatusStrip({ stageKey }) {
  const s = STAGE_STATUS[stageKey];

  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 rounded-md border px-3 py-2"
      style={{ borderColor: PALETTE.border, background: PALETTE.panel }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: PALETTE.textPrimary }}>
        {s.label}
      </span>
      <span className="text-[11px]" style={{ color: PALETTE.textSecondary }}>{s.energy}</span>
      <span className="text-[11px]" style={{ color: PALETTE.textSecondary }}>{s.motion}</span>
      <span className="text-[11px]" style={{ color: PALETTE.textSecondary }}>{s.temp}</span>
    </div>
  );
}
