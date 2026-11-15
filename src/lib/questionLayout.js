// Optional placement of a question's visual/image relative to its stem text.
//
// Honest scope: questions are stored as plain fields (question_content text, visual_data JSON, options, parts) -- NOT as
// blocks -- so this is NOT the Learn grid. It is one optional setting kept INSIDE the existing visual_data JSON (no migration,
// no new column, marking/answers untouched):
//
//   visual_data.placement = { side: "above" | "below" | "left" | "right", width: "third" | "half" | "twothirds" | "full" }
//
// No placement => every view renders exactly as it always has (student: visual above the text; teacher modal / printed paper:
// text then visual). Options, parts, answer fields and mark schemes are never part of the placement.
import { normalizeStimulus } from "./normalizeStimulus.js";

export const STEM_SIDES = ["above", "below", "left", "right"];
export const STEM_WIDTHS = { third: 4, half: 6, twothirds: 8, full: 12 };
export const STEM_SIDE_LABELS = { above: "Above the text", below: "Below the text", left: "Left of the text", right: "Right of the text" };
export const STEM_WIDTH_LABELS = { third: "⅓", half: "½", twothirds: "⅔", full: "Full width" };

const isObj = (v) => v !== null && typeof v === "object" && !Array.isArray(v);

/** Clean placement object or null (null = "no placement: legacy layout"). Never throws. */
export function normalizePlacement(raw) {
  if (!isObj(raw) || !STEM_SIDES.includes(raw.side)) return null;
  const side = raw.side;
  const sideBySide = side === "left" || side === "right";
  let width = Object.hasOwn(STEM_WIDTHS, raw.width) ? raw.width : sideBySide ? "half" : "full";
  if (sideBySide && width === "full") width = "half"; // full width cannot sit beside text
  if (!sideBySide) width = "full";                     // above/below always use the whole line
  return { side, width };
}

export function getStimulusPlacement(stimulus) {
  const s = normalizeStimulus(stimulus);
  return isObj(s) ? normalizePlacement(s.placement) : null;
}

/** New stimulus with the placement set (or removed when `placement` is null). Everything else is copied untouched. */
export function withStimulusPlacement(stimulus, placement) {
  if (!isObj(stimulus)) return stimulus;
  const next = { ...stimulus };
  const clean = normalizePlacement(placement);
  if (clean) next.placement = clean; else delete next.placement;
  return next;
}

/** Column spans of the (media, text) pair on the 12-column grid, plus DOM/phone order. */
export function stemColumns(placement) {
  const p = normalizePlacement(placement);
  if (!p) return null;
  if (p.side === "above" || p.side === "below") return { stacked: true, mediaFirst: p.side === "above", mediaSpan: 12, stemSpan: 12, phoneMediaFirst: p.side === "above" };
  const mediaSpan = STEM_WIDTHS[p.width];
  return { stacked: false, mediaFirst: p.side === "left", mediaSpan, stemSpan: 12 - mediaSpan, phoneMediaFirst: true };
}
