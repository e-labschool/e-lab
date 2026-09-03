// Structure 1.5 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S1-5-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.5",
    topicCode: "Structure 1.5",
    level: "SL",
    paper: "Paper 2",
    questionType: "Calculation",
    difficulty: "Medium",
    commandTerms: [],
    marks: 4,
    estimatedMinutes: null,
    questionText: "A sample of an ideal gas occupies 2.40 dm³ at 298 K and 101 kPa. Calculate the volume of the gas at 350 K and 150 kPa.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "V₂ ≈ 1.90 dm³",
    markscheme: "M1: correct rearrangement of the combined gas law (P₁V₁/T₁ = P₂V₂/T₂).\nM1: correct substitution of values.\nA1: V₂ = 1.90 dm³.\nA1: correct units stated.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["gas-laws","ideal-gas-equation"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
