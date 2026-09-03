// Structure 1.4 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S1-4-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.4",
    topicCode: "Structure 1.4",
    level: "SL",
    paper: "Paper 1B",
    questionType: "Calculation",
    difficulty: "Easy",
    commandTerms: [],
    marks: 2,
    estimatedMinutes: null,
    questionText: "Determine the molar mass of calcium carbonate, CaCO₃. (A_r: Ca = 40.08, C = 12.01, O = 16.00)",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "M(CaCO₃) = 100.09 g mol⁻¹",
    markscheme: "M1: correct summation 40.08 + 12.01 + 3(16.00).\nA1: 100.09 g mol⁻¹ with correct units.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["molar-mass"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
