// Reactivity 3.3 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R3-3-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 3",
    subtopic: "3.3",
    topicCode: "Reactivity 3.3",
    level: "SL",
    paper: "Paper 1A",
    questionType: "MCQ",
    difficulty: "Easy",
    commandTerms: [],
    marks: 1,
    estimatedMinutes: null,
    questionText: "Which type of mechanism describes the reaction between methane and chlorine in the presence of UV light?",
    parts: null,
    options: [
      { id: "A", text: "Nucleophilic substitution" },
      { id: "B", text: "Electrophilic addition" },
      { id: "C", text: "Radical substitution" },
      { id: "D", text: "Elimination" },
    ],
    correctAnswer: "C",
    answer: "C",
    markscheme: "1 mark for C.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["radical-substitution-mechanism"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
