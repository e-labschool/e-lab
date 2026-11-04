import { PALETTE, STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";
import { STAGE_CAPTION } from "../data/content.js";

const STAGE_ACCENT = {
  solidHeat: STATE_ACCENT.solid,
  melt: "#E0A64C",
  liquidHeat: STATE_ACCENT.liquid,
  boil: "#E0A64C",
  gasHeat: STATE_ACCENT.gas,
  done: STATE_ACCENT.gas,
};

export default function PhaseCaption({ stageKey }) {
  const info = STAGE_CAPTION[stageKey];
  const accent = STAGE_ACCENT[stageKey];

  return (
    <div className="flex items-baseline gap-2 px-0.5">
      <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: accent }}>
        {info.label}
      </span>
      <span className="text-xs" style={{ color: PALETTE.textSecondary }}>
        {info.text}
      </span>
    </div>
  );
}
