import { validateStimulus } from "../../../lib/stimulusSchema.js";

// Case-insensitive phrases suggesting a question's wording implies a
// visual — a review AID only, never an automatic classification. Never
// used to modify a question; only to surface a badge for Admin to
// manually inspect.
const VISUAL_REFERENCE_PHRASES = [
  "graph", "graph below", "diagram", "diagram below", "figure", "figure below",
  "structure", "structure below", "spectrum", "spectrum below", "apparatus", "apparatus shown",
  "table below", "energy profile", "lewis structure", "molecular structure", "displayed formula",
  "chromatogram", "cell diagram", "particle diagram", "reaction profile", "orbital diagram",
  "shown below", "shown above", "as shown", "the following graph", "the following diagram",
];

function textSuggestsVisual(question) {
  const haystacks = [question.question_content, ...(Array.isArray(question.parts) ? question.parts.map((p) => p.questionText) : [])];
  const combined = haystacks.filter(Boolean).join(" ").toLowerCase();
  return VISUAL_REFERENCE_PHRASES.some((phrase) => combined.includes(phrase));
}

/** One shared classification used by both the list badges and the
 * filter/counter logic, so they can never disagree with each other.
 * Note: q.visual_data arrives as plain JS `null` from the client for
 * BOTH a SQL NULL column and a stored JSONB `null` scalar — Postgrest
 * serializes both identically, so no special-casing is needed here;
 * this was only a distinction at the raw-SQL audit level, never at the
 * application layer. */
export function getVisualStatus(question) {
  if (!question.visual_data) {
    return textSuggestsVisual(question) ? "possible-visual-needed" : "no-visual";
  }
  const { valid } = validateStimulus(question.visual_data);
  if (!valid) return "visual-issue";
  return question.visual_data.type === "image" ? "uploaded-image" : "elab-visual";
}

export const VISUAL_FILTER_OPTIONS = [
  { id: "all", label: "All Questions" },
  { id: "elab-visual-or-image", label: "Has Visual" },
  { id: "no-visual", label: "No Visual" },
  { id: "possible-visual-needed", label: "Possible Visual Needed" },
  { id: "uploaded-image", label: "Uploaded Image" },
  { id: "elab-visual", label: "e-Lab Visual" },
  { id: "visual-issue", label: "Visual Issue" },
];

export function matchesVisualFilter(question, filterId) {
  if (filterId === "all") return true;
  const status = getVisualStatus(question);
  if (filterId === "elab-visual-or-image") return status === "elab-visual" || status === "uploaded-image";
  return status === filterId;
}
