// The canonical e-Lab question schema, constants, ID convention, and
// validation. This is the ONE place question "shape" is defined — every
// topic file, the registry, and the Q Builder UI all import from here
// rather than re-declaring field lists.
//
// Field-naming note: this keeps the field names already used by the
// existing (working) Q Builder UI — syllabusSection/topic/subtopic,
// questionText, answer/markscheme, tags — and ADDS every field requested
// for the scaled-up bank (curriculum, syllabusVersion, unit, unitTitle,
// topicCode, topicTitle, commandTerms, estimatedMinutes, parts, options,
// correctAnswer, explanation, skills, dataBookletRequired,
// calculatorRequired, diagram/table/graph, status). Nothing conceptually
// requested is missing; a few fields are named to match what the UI
// components already read, to avoid a risky mass rename across the
// existing, working Q Builder. See the project report for the exact
// field-name mapping.

export const LEVELS = ["SL", "HL", "SL/HL"];
export const PAPERS = ["Paper 1A", "Paper 1B", "Paper 2"];
export const SYLLABUS_SECTIONS = ["Structure", "Reactivity"];
export const DIFFICULTIES = ["Easy", "Medium", "Hard", "Challenge"];
export const QUESTION_TYPES = ["MCQ", "Calculation", "Short Response", "Extended Response", "Data-based"];
export const STATUSES = ["draft", "reviewed", "published"];
export const DEFAULT_VISIBLE_STATUSES = ["reviewed", "published"]; // shown by default; drafts hidden until explicitly requested

export const CURRICULUM = "IB DP Chemistry";
export const SYLLABUS_VERSION = "First assessment 2025";
export const SOURCE = "e-Lab Original";

// Stimulus / visual data — kept structurally separate from questionText,
// parts, options and markscheme, per the batch-import spec: never a
// screenshot, always the underlying data, rendered by
// components/visuals/StimulusRenderer.jsx (and re-drawn as real vector
// content in PDF export; approximated as text in Word export, since the
// docx package has no arbitrary vector-drawing surface).
//
//   { type: "text", intro }
//   { type: "table", intro?, table: { headers: string[], rows: string[][] } }
//   { type: "nuclide", intro?, nuclides: [{ massNumber, atomicNumber, symbol, charge?, label? }] }
//   { type: "mass-spectrum", intro?, xLabel, yLabel, peaks: [{ mz, abundance }] }
//   { type: "bar-chart", intro?, xLabel, yLabel, bars: [{ label, value }] }
//   { type: "atom-diagram", intro? }  — generic illustrative schematic, no per-question data needed
//   { type: "emission-spectrum", intro?, lines: [{ wavelength }], continuous?, label? }
//   { type: "energy-level-diagram", intro?, levels: number[], transitions: [{ from, to, label }], converge? }
//   { type: "orbital-shape", intro?, shapes: [{ id, kind: "s"|"px"|"py"|"pz", label }] }
//   { type: "orbital-box", intro?, subshells: [{ label, boxes: [{ spins: ("up"|"down")[] }] }] }
//   { type: "ionization-graph", intro?, points: [{ label, value }], xLabel, yLabel, logScale? }
//   { type: "proportionality-graph", intro?, points: [{ x, y }], xLabel, yLabel, relationship?: "linear"|"inverse"|"points", highlightPoint?: { x, y, label } }
//   { type: "gas-particle-diagram", intro?, containers: [{ label, relativeSize, particleCount, spread? }] }
//   { type: "apparatus-diagram", intro?, items: [{ kind: "beaker"|"measuring-cylinder"|"volumetric-flask"|"conical-flask", label }] }
//   { type: "lewis-structure", intro?, label?, atoms: [{ id, symbol, x, y, lonePairs, formalCharge? }], bonds: [{ from, to, order: 1|2|3, coordinate? }], overallCharge? }
//   { type: "resonance", intro?, structures: [ ...lewis-structure-shaped objects ] }
//   { type: "vsepr", intro?, geometry: "linear"|"bent"|"trigonal-planar"|"trigonal-pyramidal"|"tetrahedral"|"trigonal-bipyramidal"|"octahedral", centralLabel?, domains: [{ type:"bond"|"lonePair", label? }] }
//   { type: "dipole", intro?, geometry, centralLabel?, bondLabels: (string|null)[], netDipole: "present"|"absent" }
//   { type: "ion-grid", intro?, mode: "ionic-alternating"|"metallic-sea"|"covalent-network", rows?, cols?, variant?: "pure"|"alloy" }
//   { type: "electron-transfer", intro?, from: { symbol, electronsLost, resultLabel }, to: { symbol, electronsGained, resultLabel } }
//   { type: "bonding-triangle", intro?, markers: [{ label, region: "ionic"|"covalent"|"metallic"|"center" }] }
//   { type: "polymer", intro?, mode: "addition"|"condensation", monomerText, repeatingUnitText, byproductText? }
//   { type: "sigma-pi", intro? }
//   { type: "chromatogram", intro?, baselineToFront, spots: [{ label, distance }] }
//   { type: "periodic-table-highlight", intro?, highlights: [{ period, group, label }] }
//   { type: "colour-wheel", intro?, absorbed?, observed? }
//   { type: "organic-structure", intro?, label?, atoms: [{ id, symbol, x, y, implicit? }], bonds: [{ from, to, order?, style?: "wedge"|"dash" }] } — skeletal (implicit carbons) or displayed (all atoms shown) depending on atom.implicit
//   { type: "enantiomer-pair", intro?, left: organic-structure-shaped, right: organic-structure-shaped }
//   { type: "ir-spectrum", intro?, bands: [{ wavenumber, strength? }] }
//   { type: "nmr-spectrum", intro?, signals: [{ shift, integration, multiplicity: "singlet"|"doublet"|"triplet"|"quartet"|"multiplet" }] }
//   { type: "energy-profile", intro?, reactantsEnergy, productsEnergy, hasHump?, humpEnergy?, catalysedHumpEnergy?, label? }
//   { type: "calorimeter-diagram", intro?, labels?: [lid, thermometer, solution, cup] }
//   { type: "hess-cycle", intro?, nodes: [{ id, label }], arrows: [{ from, to, label, labelOffsetX? }] }
//   { type: "born-haber-cycle", intro?, steps: [{ label, value?, unknown? }] }
//   { type: "carbon-cycle-diagram", intro?, stages: string[] }
//   { type: "electrochemical-cell", intro?, mode: "voltaic"|"electrolytic"|"fuel-cell", leftLabel, rightLabel, leftElectrode?, rightElectrode?, anodeSide?: "left"|"right" }
//   { type: "maxwell-boltzmann", intro?, temps: number[], ea?, labels?: string[] }
//   { type: "multistep-energy-profile", intro?, points: [{ label, energy, kind?: "ts"|"stable" }] }
//   { type: "integrated", intro?, blocks: [ ...any of the above, minus "integrated" itself ] }
export const STIMULUS_TYPES = [
  "text", "table", "nuclide", "mass-spectrum", "bar-chart", "atom-diagram",
  "emission-spectrum", "energy-level-diagram", "orbital-shape", "orbital-box", "ionization-graph",
  "proportionality-graph", "gas-particle-diagram", "apparatus-diagram",
  "lewis-structure", "resonance", "vsepr", "dipole", "ion-grid", "electron-transfer",
  "bonding-triangle", "polymer", "sigma-pi", "chromatogram",
  "periodic-table-highlight", "colour-wheel", "organic-structure", "enantiomer-pair",
  "ir-spectrum", "nmr-spectrum",
  "energy-profile", "calorimeter-diagram", "hess-cycle", "born-haber-cycle", "carbon-cycle-diagram", "electrochemical-cell",
  "maxwell-boltzmann", "multistep-energy-profile",
  "integrated",
];

export const COLLECTION_LABEL = "e-Lab Practice Questions";
export const COLLECTION_DISCLAIMER =
  "Original practice material aligned with the IB Diploma Chemistry curriculum. e-Lab is not affiliated with or endorsed by the International Baccalaureate Organization.";

/** EL-[UNITCODE]-[SUBTOPIC MAJOR]-[SEQUENCE], e.g. EL-S1-1-001, EL-R3-4-012. IDs are permanent once assigned. */
export function buildQuestionId(unitCode, subtopic, sequence) {
  const minor = subtopic.split(".")[1] ?? subtopic;
  return `EL-${unitCode}-${minor}-${String(sequence).padStart(3, "0")}`;
}

/** Sums part marks when a question has parts; otherwise returns its own marks field. */
export function getQuestionMarks(question) {
  if (Array.isArray(question.parts) && question.parts.length > 0) {
    return question.parts.reduce((sum, part) => sum + (Number(part.marks) || 0), 0);
  }
  return Number(question.marks) || 0;
}

/**
 * Validates a question against the requirements needed before it can be
 * published. Returns an array of problem strings — empty array means valid.
 * Never throws; callers decide what to do with the problems (log, block
 * publish, flag in a dev view, etc).
 */
export function validateQuestion(question) {
  const problems = [];
  const required = ["id", "topic", "subtopic", "level", "paper", "difficulty", "questionType", "questionText", "status"];
  for (const field of required) {
    if (question[field] === undefined || question[field] === null || question[field] === "") {
      problems.push(`Missing required field: ${field}`);
    }
  }

  const hasParts = Array.isArray(question.parts) && question.parts.length > 0;
  if (!hasParts && (question.marks === undefined || question.marks === null)) {
    problems.push("Missing marks (and no parts array to derive it from)");
  }
  if (!hasParts && !question.markscheme) {
    problems.push("Missing markscheme (and no parts array to derive it from)");
  }
  if (hasParts) {
    const summed = getQuestionMarks(question);
    if (question.marks !== undefined && question.marks !== null && Number(question.marks) !== summed) {
      problems.push(`Parent marks (${question.marks}) does not equal the sum of part marks (${summed})`);
    }
    question.parts.forEach((part, i) => {
      if (!part.questionText) problems.push(`Part ${i + 1}: missing questionText`);
      if (part.marks === undefined || part.marks === null) problems.push(`Part ${i + 1}: missing marks`);
      if (!part.markscheme) problems.push(`Part ${i + 1}: missing markscheme`);
    });
  }

  if (question.questionType === "MCQ") {
    if (!Array.isArray(question.options) || question.options.length < 2) {
      problems.push("MCQ requires at least two options");
    }
    if (!question.correctAnswer) {
      problems.push("MCQ requires a correctAnswer");
    }
  }

  if (question.level && !LEVELS.includes(question.level)) {
    problems.push(`Invalid level: ${question.level}`);
  }
  if (question.paper && !PAPERS.includes(question.paper)) {
    problems.push(`Invalid paper: ${question.paper}`);
  }
  if (question.status && !STATUSES.includes(question.status)) {
    problems.push(`Invalid status: ${question.status}`);
  }

  return problems;
}

/**
 * Fills in derived/optional fields with safe defaults so older or
 * partially-specified question objects (e.g. teacher-created questions
 * from before this schema existed) still work everywhere the richer
 * fields are read. Never invents subject-matter content — only
 * structural defaults (empty arrays, null, false).
 */
export function normalizeQuestion(question) {
  return {
    curriculum: CURRICULUM,
    syllabusVersion: SYLLABUS_VERSION,
    commandTerms: [],
    estimatedMinutes: null,
    stimulus: null, // See "Stimulus / visual data" doc block below for the full shape reference.
    parts: null,
    options: null,
    correctAnswer: null,
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    diagram: null,
    table: null,
    graph: null,
    source: SOURCE,
    status: "published",
    isCustom: false,
    tags: [],
    ...question,
  };
}
