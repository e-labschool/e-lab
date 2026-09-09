import { STIMULUS_SCHEMA } from "../../../lib/stimulusSchema.js";

// Categories built to match the actual registered types in
// stimulusSchema.js — every type listed here genuinely has a renderer;
// nothing here is invented. Types not explicitly categorized below fall
// into "Other" automatically, so this list can never silently omit a
// real renderer type as new ones are added to stimulusSchema.js.
const CATEGORY_TYPE_LISTS = {
  "data-graphs": ["table", "bar-chart", "line-graph", "proportionality-graph", "ionization-graph"],
  "atomic-structure": ["nuclide", "atom-diagram", "mass-spectrum", "emission-spectrum", "energy-level-diagram", "orbital-shape", "orbital-box"],
  "bonding-structure": ["lewis-structure", "resonance", "vsepr", "dipole", "bond-comparison", "dipole-comparison", "hydrogen-bond", "ion-grid", "electron-transfer", "bonding-triangle", "organic-structure", "enantiomer-pair"],
  "energetics-kinetics": ["energy-profile", "multistep-energy-profile", "hess-cycle", "born-haber-cycle", "maxwell-boltzmann"],
};

const CATEGORY_LABELS = {
  "data-graphs": "Data & Graphs",
  "atomic-structure": "Atomic Structure",
  "bonding-structure": "Bonding & Structure",
  "energetics-kinetics": "Energetics / Kinetics",
  "experimental-other": "Experimental / Other",
};

function toTitleCase(typeId) {
  return typeId.split("-").map((w) => w[0].toUpperCase() + w.slice(1)).join(" ");
}

/** Every registered type (from stimulusSchema.js, the real source of
 * truth), grouped into categories. Any type not explicitly placed above
 * lands in "Experimental / Other" automatically — never silently
 * dropped from the picker. */
export function getVisualTypeCategories() {
  const allTypes = Object.keys(STIMULUS_SCHEMA).filter((t) => t !== "text" && t !== "integrated");
  const categorized = new Set(Object.values(CATEGORY_TYPE_LISTS).flat());
  const other = allTypes.filter((t) => !categorized.has(t));

  return [
    ...Object.entries(CATEGORY_TYPE_LISTS).map(([id, types]) => ({
      id, label: CATEGORY_LABELS[id],
      types: types.filter((t) => allTypes.includes(t)).map((t) => ({ id: t, label: toTitleCase(t) })),
    })),
    { id: "experimental-other", label: CATEGORY_LABELS["experimental-other"], types: other.map((t) => ({ id: t, label: toTitleCase(t) })) },
  ].filter((cat) => cat.types.length > 0);
}

// Field-based editor forms for a representative set of types — the ones
// explicitly requested plus a few others sharing the same simple shapes.
// A type NOT listed here still works in the editor via the generic JSON
// fallback (see VisualEditor.jsx) — nothing is unsupported, just not yet
// given a dedicated form. Extending this registry with more types later
// requires no other code change.
export const VISUAL_FIELD_DEFS = {
  "line-graph": [
    { key: "trend", label: "Trend", type: "select", options: ["increasing", "decreasing", "rise-then-cool"] },
    { key: "xLabel", label: "X-axis label", type: "text" },
    { key: "yLabel", label: "Y-axis label", type: "text" },
    { key: "context", label: "Context (optional)", type: "text" },
  ],
  "bond-comparison": [
    { key: "bonds", label: "Bonds", type: "array-object", itemFields: [
      { key: "label", label: "Label", type: "text" },
      { key: "order", label: "Bond order", type: "number" },
    ] },
  ],
  "dipole-comparison": [
    { key: "bonds", label: "Bonds (e.g. H-F)", type: "array-text" },
  ],
  "hydrogen-bond": [
    { key: "molecules", label: "Molecules (currently only H2O + H2O is supported)", type: "array-text" },
    { key: "showIntramolecular", label: "Show covalent O-H bonds", type: "boolean" },
    { key: "showIntermolecular", label: "Show hydrogen bond", type: "boolean" },
  ],
  dipole: [
    { key: "bond", label: "Bond (e.g. C-Br)", type: "text" },
    { key: "partialCharges", label: "Partial charges (e.g. C\u03b4+, Br\u03b4\u2212)", type: "array-text" },
  ],
  "bar-chart": [
    { key: "xLabel", label: "X-axis label", type: "text" },
    { key: "yLabel", label: "Y-axis label", type: "text" },
    { key: "bars", label: "Bars", type: "array-object", itemFields: [
      { key: "label", label: "Label", type: "text" },
      { key: "value", label: "Value", type: "number" },
    ] },
  ],
  image: [
    { key: "src", label: "Image", type: "image-upload" },
    { key: "alt", label: "Alt text (required)", type: "text" },
    { key: "caption", label: "Caption (optional)", type: "text" },
    { key: "credit", label: "Credit/source (optional)", type: "text" },
  ],
};

export function getDefaultContentForType(type) {
  const fields = VISUAL_FIELD_DEFS[type];
  if (!fields) return { type };
  const content = { type };
  for (const f of fields) {
    if (f.type === "array-object" || f.type === "array-text") content[f.key] = [];
    else if (f.type === "boolean") content[f.key] = true;
    else content[f.key] = "";
  }
  return content;
}
