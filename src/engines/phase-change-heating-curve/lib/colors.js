import { STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";

export const PLATEAU_COLOR = "#E0A64C";

/** Accent colour of a curve segment: amber for the phase-change plateaus, the state colour otherwise. */
export function segColor(key) {
  if (key === "melt" || key === "boil" || key === "condense" || key === "freeze") return PLATEAU_COLOR;
  if (key === "solidHeat" || key === "solidCool") return STATE_ACCENT.solid;
  if (key === "liquidHeat" || key === "liquidCool") return STATE_ACCENT.liquid;
  return STATE_ACCENT.gas;
}
