// A minimal, evidence-based normalization layer between raw Supabase
// visual_data and validateStimulus()/StimulusRenderer.
//
// IMPORTANT — what this file deliberately does NOT do: after cross-
// checking src/data/questions/schema.js's long-standing documented field
// reference (the canonical shape comment block, present since the
// question schema was first written) against src/lib/stimulusSchema.js,
// every field name matches exactly — bars, points, atoms/bonds, geometry,
// temps, containers, nodes/arrows, highlights, structures, from/to. There
// is no evidence anywhere in this repository of a legacy/alternate field
// name ever being used for any visual type. So this file does NOT invent
// alias mappings (data->bars, values->points, etc) — doing so without
// proof would risk silently reinterpreting genuinely different data as
// something it was never authored to mean.
//
// What this DOES fix, because it's a structural encoding problem, not a
// scientific-content question: if visual_data was ever stored as a
// JSON-encoded STRING rather than a native JSONB object — e.g.
// "{\"type\":\"bar-chart\",\"bars\":[]}" instead of the real object — every
// single field read would fail identically regardless of the underlying
// visual type, which is consistent with the audit's large,
// undifferentiated "unrecognized type" bucket. Safely unwrapping that is
// pure structural normalization: it does not change what the data means,
// only how it's represented.
export function normalizeStimulus(rawVisualData) {
  if (rawVisualData == null) return rawVisualData;

  if (typeof rawVisualData === "string") {
    try {
      const parsed = JSON.parse(rawVisualData);
      if (import.meta.env?.DEV) {
        console.warn("[normalizeStimulus] visual_data was a JSON-encoded string, not a native object — unwrapped it.", { raw: rawVisualData });
      }
      return parsed;
    } catch {
      // Not valid JSON either — genuinely malformed, not a double-encoding
      // case. Return as-is; validateStimulus will correctly reject it.
      return rawVisualData;
    }
  }

  return rawVisualData;
}
