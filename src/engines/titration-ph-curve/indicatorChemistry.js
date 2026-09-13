// Indicator selection and colour modelling — a PURE VISUAL LAYER. Never
// reads or writes anything that feeds the chemistry engine (no indicator
// moles, no volume, no effect on solvePH/getChemistryState in
// TitrationPHCurve.jsx) — every colour here is derived from the ALREADY
// CALCULATED pH, nothing else.

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function lerpRGBA([r1, g1, b1, a1], [r2, g2, b2, a2], t) {
  const clamped = Math.max(0, Math.min(1, t));
  return [lerp(r1, r2, clamped), lerp(g1, g2, clamped), lerp(b1, b2, clamped), lerp(a1, a2, clamped)];
}

function rgbaString([r, g, b, a]) {
  return `rgba(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)}, ${a.toFixed(2)})`;
}

// Muted, realistic dilute-indicator colours -- never fluorescent or
// bright-magenta, per the brief.
const BTB_YELLOW = [214, 188, 64, 0.55];
const BTB_GREEN = [120, 178, 120, 0.5];
const BTB_BLUE = [86, 140, 196, 0.55];

const PP_COLOURLESS = [205, 210, 220, 0.12];
const PP_PINK = [224, 120, 168, 0.5];

const MO_RED = [196, 66, 58, 0.55];
const MO_ORANGE = [214, 132, 46, 0.55];
const MO_YELLOW = [208, 188, 64, 0.55];

export const INDICATORS = {
  "bromothymol-blue": {
    id: "bromothymol-blue",
    label: "Bromothymol blue",
    lowPH: 6.0,
    highPH: 7.6,
    transitionSummary: "Yellow \u2192 Green \u2192 Blue",
    colorAt(pH) {
      if (pH <= this.lowPH) return rgbaString(BTB_YELLOW);
      if (pH >= this.highPH) return rgbaString(BTB_BLUE);
      const mid = (this.lowPH + this.highPH) / 2;
      if (pH <= mid) return rgbaString(lerpRGBA(BTB_YELLOW, BTB_GREEN, (pH - this.lowPH) / (mid - this.lowPH)));
      return rgbaString(lerpRGBA(BTB_GREEN, BTB_BLUE, (pH - mid) / (this.highPH - mid)));
    },
  },
  phenolphthalein: {
    id: "phenolphthalein",
    label: "Phenolphthalein",
    lowPH: 8.2,
    highPH: 10.0,
    transitionSummary: "Colourless \u2192 Pink",
    colorAt(pH) {
      if (pH < this.lowPH) return rgbaString(PP_COLOURLESS);
      if (pH >= this.highPH) return rgbaString(PP_PINK);
      return rgbaString(lerpRGBA(PP_COLOURLESS, PP_PINK, (pH - this.lowPH) / (this.highPH - this.lowPH)));
    },
  },
  "methyl-orange": {
    id: "methyl-orange",
    label: "Methyl orange",
    lowPH: 3.1,
    highPH: 4.4,
    transitionSummary: "Red \u2192 Orange \u2192 Yellow",
    colorAt(pH) {
      if (pH <= this.lowPH) return rgbaString(MO_RED);
      if (pH >= this.highPH) return rgbaString(MO_YELLOW);
      const mid = (this.lowPH + this.highPH) / 2;
      if (pH <= mid) return rgbaString(lerpRGBA(MO_RED, MO_ORANGE, (pH - this.lowPH) / (mid - this.lowPH)));
      return rgbaString(lerpRGBA(MO_ORANGE, MO_YELLOW, (pH - mid) / (this.highPH - mid)));
    },
  },
};

/**
 * Selects the chemically appropriate indicator from the ACID/BASE
 * STRENGTH combination only -- never from which reagent happens to be
 * in the flask vs the burette, so "HCl flask + NaOH burette" and
 * "NaOH flask + HCl burette" both correctly resolve to the same
 * indicator (Bromothymol blue), with the colour DIRECTION differing
 * naturally because it's driven by the actual calculated pH, not by any
 * separately-encoded "reverse" rule.
 */
export function selectIndicator(acidStrength, baseStrength) {
  if (acidStrength === "strong" && baseStrength === "strong") return INDICATORS["bromothymol-blue"];
  if (acidStrength === "weak" && baseStrength === "strong") return INDICATORS.phenolphthalein;
  if (acidStrength === "strong" && baseStrength === "weak") return INDICATORS["methyl-orange"];
  return null; // weak acid + weak base -- no sufficiently sharp common indicator
}
