import { toSubscripts } from "../model/geometry.js";
import { PRESET_BY_ID } from "../model/presets.js";

/** Formula text of a built model, central atom first: "NH₂", "SF₄". */
export function formulaOf(model) {
  if (!model.central) return "";
  const counts = new Map();
  for (const d of model.domains) if (d.kind === "bond") { const s = d.symbol ?? "X"; counts.set(s, (counts.get(s) ?? 0) + 1); }
  const lig = [...counts.entries()].sort((a, b) => (a[0] === "H" ? -1 : b[0] === "H" ? 1 : a[0].localeCompare(b[0]))).map(([s, c]) => `${s}${c > 1 ? c : ""}`).join("");
  return toSubscripts(`${model.central}${lig}`);
}
export const presetLabel = (p) => `${p.display} (${p.name.split(" (")[0].toLowerCase()})`;
export { PRESET_BY_ID };
