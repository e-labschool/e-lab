import { PALETTE } from "../../particle-model-visualizer/data/palette.js";

/** Thin strip — one message at a time, not every explanatory sentence at
 * once. Text is driven directly by the orchestrator (different sequences
 * for the HCl vs NaOH path), rather than indexing into one fixed list. */
export default function StatusStrip({ statusText }) {
  return (
    <div
      className="flex items-center justify-center rounded-md border text-center"
      style={{ height: 48, borderColor: PALETTE.border, background: PALETTE.panel }}
    >
      <p className="px-3 text-[13px]" style={{ color: PALETTE.textSecondary }}>{statusText}</p>
    </div>
  );
}
