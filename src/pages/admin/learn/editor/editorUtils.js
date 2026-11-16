import { isFullOnly, SPAN_PRESETS } from "../../../../lib/blockLayout.js";
import { blockText, firstLine, stripHtml } from "../../../../lib/learnMeta.js";

/** Height of one canvas / preview row, in px. A block's height is rows * UNIT. */
export const UNIT = 28;
export const GAP = 8;
/** A tile never contains more than this many characters of a block's text: the rest is not in the DOM at all. */
export const PREVIEW_CHARS = 220;
export const canShareRow = (block) => !isFullOnly(block?.block_type);

export const WIDTH_LABELS = { 3: "¼", 4: "⅓", 5: "5/12", 6: "½", 7: "7/12", 8: "⅔", 12: "Full" };
export const QUICK_WIDTHS = [3, 4, 6, 8, 12];
export const WIDTH_PRESETS = SPAN_PRESETS;
export const DEVICES = { phone: { label: "Phone", px: 390 }, tablet: { label: "Tablet", px: 768 }, desktop: { label: "Desktop", px: null } };

/** What a compact tile shows: { kind, title, text (clamped), thumb, more }. */
export function tilePreview(block, { checkCount = 0 } = {}) {
  const c = block?.content && typeof block.content === "object" ? block.content : {};
  const full = blockText(block);
  const text = full.length > PREVIEW_CHARS ? `${full.slice(0, PREVIEW_CHARS).trimEnd()}…` : full;
  const title = firstLine(block, 70);
  const thumb = block?.block_type === "image" ? c.url || "" : typeof c.imageUrl === "string" ? c.imageUrl : "";
  let kind = "text";
  if (block?.block_type === "image") kind = "image";
  else if (block?.block_type === "simulation") kind = "simulation";
  else if (block?.block_type === "check_understanding") kind = "question";
  else if (["video", "molecule_3d", "page_break", "topic_link"].includes(block?.block_type)) kind = "media";
  const label = kind === "simulation" ? String(c.simulationId || "Choose a simulation").replace(/-/g, " ") : kind === "question" ? `${checkCount} question${checkCount === 1 ? "" : "s"}` : block?.block_type === "page_break" ? "Page break" : block?.block_type === "video" ? c.url ? "Video" : "Add a video link" : kind === "image" && !c.url ? "Choose an image" : "";
  return { kind, title, text: kind === "text" ? text : c.caption ? stripHtml(c.caption).slice(0, PREVIEW_CHARS) : "", thumb, label, more: full.length > PREVIEW_CHARS };
}

export function searchText(block, label) {
  return `${label?.typeLabel ?? ""} ${block?.block_type} ${blockText(block)}`.toLowerCase();
}
export function matchesQuery(block, label, query) {
  const q = String(query || "").trim().toLowerCase();
  return !q || searchText(block, label).includes(q);
}
