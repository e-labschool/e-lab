// Structure 1.1 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S1-1-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.1",
    topicCode: "Structure 1.1",
    level: "SL",
    paper: "Paper 1B",
    questionType: "Calculation",
    difficulty: "Medium",
    commandTerms: [],
    marks: 2,
    estimatedMinutes: null,
    questionText: "Calculate the number of molecules present in 0.250 mol of water.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "N = 1.51 × 10²³ molecules",
    markscheme: "M1: correct use of the Avogadro constant (N = n × N_A).\nA1: N = 0.250 × 6.02 × 10²³ = 1.51 × 10²³ molecules.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["mole","avogadro-constant"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
