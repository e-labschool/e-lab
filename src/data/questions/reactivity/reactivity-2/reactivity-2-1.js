// Reactivity 2.1 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R2-1-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 2",
    subtopic: "2.1",
    topicCode: "Reactivity 2.1",
    level: "SL",
    paper: "Paper 1B",
    questionType: "Calculation",
    difficulty: "Medium",
    commandTerms: [],
    marks: 3,
    estimatedMinutes: null,
    questionText: "Calculate the mass of magnesium oxide formed when 6.00 g of magnesium reacts completely with oxygen. (A_r: Mg = 24.31, O = 16.00)",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "m(MgO) ≈ 9.95 g",
    markscheme: "M1: moles of Mg = 6.00/24.31.\nM1: correct 1:1 mole ratio to MgO.\nA1: mass MgO = 9.95 g.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["reaction-stoichiometry"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
