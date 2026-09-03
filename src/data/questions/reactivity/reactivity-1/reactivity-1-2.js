// Reactivity 1.2 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R1-2-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 1",
    subtopic: "1.2",
    topicCode: "Reactivity 1.2",
    level: "HL",
    paper: "Paper 2",
    questionType: "Calculation",
    difficulty: "Hard",
    commandTerms: [],
    marks: 4,
    estimatedMinutes: null,
    questionText: "Use Hess's law and the following standard enthalpies of formation to calculate ΔH for the complete combustion of methane:\nCH₄(g) + 2O₂(g) → CO₂(g) + 2H₂O(l)\nΔHₑ°(CO₂) = −394 kJ mol⁻¹, ΔHₑ°(H₂O, l) = −286 kJ mol⁻¹, ΔHₑ°(CH₄) = −75 kJ mol⁻¹",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "ΔH = −891 kJ mol⁻¹",
    markscheme: "M1: correct Hess cycle / ΔH = ΣΔHₑ(products) − ΣΔHₑ(reactants).\nM1: correct substitution.\nA1: ΔH = −891 kJ mol⁻¹.\nA1: correct sign and units.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["hess-law","standard-enthalpy-of-reaction"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
