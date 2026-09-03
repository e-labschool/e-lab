// Reactivity 2.3 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R2-3-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 2",
    subtopic: "2.3",
    topicCode: "Reactivity 2.3",
    level: "HL",
    paper: "Paper 2",
    questionType: "Data-based",
    difficulty: "Hard",
    commandTerms: [],
    marks: 5,
    estimatedMinutes: null,
    questionText: "The equilibrium constant K_c for N₂(g) + 3H₂(g) ⇌ 2NH₃(g) is 4.20 × 10⁻² at 500 K. At equilibrium, [N₂] = 0.200 mol dm⁻³ and [H₂] = 0.600 mol dm⁻³. Calculate [NH₃] at equilibrium and comment on the position of equilibrium.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "[NH₃] ≈ 0.0426 mol dm⁻³; the small K_c value and low product concentration show equilibrium lies well to the left (favouring reactants).",
    markscheme: "M1: correct K_c expression.\nM1: correct substitution.\nA1: [NH₃] = 0.0426 mol dm⁻³.\nA1: comment that equilibrium favours reactants.\nA1: reasoning linked to small K_c value.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["equilibrium-constant","dynamic-equilibrium"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
