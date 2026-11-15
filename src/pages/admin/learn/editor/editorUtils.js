import { isFullOnly, SPAN_PRESETS } from "../../../../lib/blockLayout.js";

/** Types never rendered live inside the editor canvas (heavy, interactive or remote). */
export const HEAVY_TYPES = new Set(["simulation", "molecule_3d", "video", "check_understanding", "topic_link", "page_break"]);
export const canShareRow = (block) => !isFullOnly(block?.block_type);

export const WIDTH_LABELS = { 3: "¼", 4: "⅓", 5: "5/12", 6: "½", 7: "7/12", 8: "⅔", 12: "Full" };
export const WIDTH_PRESETS = SPAN_PRESETS;
export const DEVICES = { phone: { label: "Phone", px: 390 }, tablet: { label: "Tablet", px: 768 }, desktop: { label: "Desktop", px: null } };

const strip = (html) => String(html ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
/** Lower-case searchable text of a block: its type label plus every text field (layout excluded). */
export function searchText(block, label) {
  const typeLabel = `${label?.typeLabel ?? ""} ${label?.preview ?? ""}`;
  const c = block?.content && typeof block.content === "object" ? { ...block.content } : {};
  delete c.layout;
  return `${typeLabel} ${block?.block_type} ${strip(JSON.stringify(c).replace(/\\"/g, '"'))}`.toLowerCase();
}
export function matchesQuery(block, label, query) {
  const q = String(query || "").trim().toLowerCase();
  return !q || searchText(block, label).includes(q);
}
