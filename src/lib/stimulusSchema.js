// The single source of truth for what each stimulus type actually
// requires — used by StimulusRenderer.jsx (to decide whether to render
// or fall back) AND by the Admin bulk importer (to reject malformed
// visualData before it ever enters the canonical bank). Deliberately its
// own file with zero component imports: pulling in StimulusRenderer.jsx
// directly here would drag all 34 heavy sub-renderer components into
// whatever eagerly imports this (the Admin importer), even though
// validation only ever needs the schema, not the render code.
//
// Verified against each component's ACTUAL implementation, not assumed
// from prop names — required/arrayFields reflect exactly what each
// component reads with no safe default.
export const STIMULUS_SCHEMA = {
  table: { required: ["table"], arrayFields: ["table.headers", "table.rows"] },
  nuclide: { required: [], arrayFields: ["nuclides"] },
  "mass-spectrum": { required: [], arrayFields: ["peaks"] },
  "bar-chart": { required: [], arrayFields: ["bars"] },
  "atom-diagram": { required: [], arrayFields: [] },
  "emission-spectrum": { required: [], arrayFields: ["lines"] },
  "energy-level-diagram": { required: [], arrayFields: ["levels", "transitions"] },
  "orbital-shape": { required: [], arrayFields: ["shapes"] },
  "orbital-box": { required: [], arrayFields: ["subshells"] },
  "ionization-graph": { required: [], arrayFields: ["points"] },
  "proportionality-graph": { required: [], arrayFields: ["points"] },
  "gas-particle-diagram": { required: [], arrayFields: ["containers"] },
  "apparatus-diagram": { required: [], arrayFields: ["items"] },
  "lewis-structure": { required: [], arrayFields: ["atoms", "bonds"] },
  resonance: { required: [], arrayFields: ["structures"] },
  vsepr: { required: ["geometry"], arrayFields: [] },
  // dipole has TWO legitimate, proven modes in the live data: the
  // original molecular/geometry-based diagram, and a simpler
  // bond-polarity representation (bond + partialCharges). Neither field
  // set is required of the other — validated by a custom function below
  // rather than the generic required/arrayFields shape, since this is a
  // genuine union, not a single fixed contract.
  dipole: {
    validate: (stimulus) => {
      const hasGeometryMode = getNestedValue(stimulus, "geometry") != null;
      const hasBondPolarityMode =
        typeof stimulus.bond === "string" && stimulus.bond.trim() !== "" && Array.isArray(stimulus.partialCharges);
      if (!hasGeometryMode && !hasBondPolarityMode) {
        return { valid: false, missingField: "geometry (molecular mode) or bond + partialCharges (bond-polarity mode)" };
      }
      return { valid: true };
    },
  },
  "ion-grid": { required: [], arrayFields: [] },
  "electron-transfer": { required: ["from", "to"], arrayFields: [] },
  "bonding-triangle": { required: [], arrayFields: ["markers"] },
  polymer: { required: [], arrayFields: [] },
  "sigma-pi": { required: [], arrayFields: [] },
  chromatogram: { required: [], arrayFields: ["spots"] },
  "periodic-table-highlight": { required: [], arrayFields: ["highlights"] },
  "colour-wheel": { required: [], arrayFields: [] },
  "organic-structure": { required: [], arrayFields: ["atoms", "bonds"] },
  "enantiomer-pair": { required: [], arrayFields: [] },
  "ir-spectrum": { required: [], arrayFields: ["bands"] },
  "nmr-spectrum": { required: [], arrayFields: ["signals"] },
  "energy-profile": { required: [], arrayFields: [] },
  "calorimeter-diagram": { required: [], arrayFields: [] },
  "hess-cycle": { required: [], arrayFields: ["nodes", "arrows"] },
  "born-haber-cycle": { required: [], arrayFields: ["steps"] },
  "carbon-cycle-diagram": { required: [], arrayFields: ["stages"] },
  "electrochemical-cell": { required: [], arrayFields: [] },
  "maxwell-boltzmann": { required: [], arrayFields: ["temps"] },
  "multistep-energy-profile": { required: [], arrayFields: ["points"] },
  integrated: { required: [], arrayFields: ["blocks"] },
  "line-graph": { required: ["trend"], arrayFields: [] },
  "bond-comparison": { required: [], arrayFields: ["bonds"] },
  "dipole-comparison": { required: [], arrayFields: ["bonds"] },
  "hydrogen-bond": { required: [], arrayFields: ["molecules"] },
};

function getNestedValue(obj, path) {
  return path.split(".").reduce((acc, key) => acc?.[key], obj);
}

/** Returns { valid, missingField } — checks that every genuinely-required
 * field for this stimulus type is present, AND that every field which
 * must be an array genuinely is one (Array.isArray, not just truthy). */
export function validateStimulus(stimulus) {
  if (stimulus === null || typeof stimulus !== "object" || Array.isArray(stimulus)) {
    return { valid: false, missingField: "stimulus object" };
  }

  if (typeof stimulus.type !== "string" || stimulus.type.trim() === "") {
    return { valid: false, missingField: "type" };
  }

  const schema = STIMULUS_SCHEMA[stimulus.type];
  if (schema === undefined) {
    // Previously returned { valid: true } here, which let an unrecognized
    // type silently fall through to the render switch's own
    // `default: return null` — rendering nothing rather than the
    // "Visual unavailable" fallback. An unsupported type is not a valid
    // one; it must fail the same way a malformed known type does.
    return { valid: false, missingField: "unsupported visual type" };
  }

  // A type may define a custom `validate` function instead of the
  // generic required/arrayFields shape, for a genuine union of valid
  // shapes (currently only "dipole") — used in preference to the
  // generic check when present.
  if (typeof schema.validate === "function") {
    return schema.validate(stimulus);
  }

  for (const field of schema.required) {
    if (getNestedValue(stimulus, field) == null) {
      return { valid: false, missingField: field };
    }
  }
  for (const field of schema.arrayFields) {
    if (!Array.isArray(getNestedValue(stimulus, field))) {
      return { valid: false, missingField: field };
    }
  }
  return { valid: true };
}
