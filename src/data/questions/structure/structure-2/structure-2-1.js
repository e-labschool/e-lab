// Structure 2.1 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S2-1-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 2",
    subtopic: "2.1",
    topicCode: "Structure 2.1",
    level: "SL",
    paper: "Paper 1A",
    questionType: "MCQ",
    difficulty: "Easy",
    commandTerms: [],
    marks: 1,
    estimatedMinutes: null,
    questionText: "Which compound contains an ionic lattice structure?",
    parts: null,
    options: [
      { id: "A", text: "CO₂" },
      { id: "B", text: "NaCl" },
      { id: "C", text: "CH₄" },
      { id: "D", text: "I₂" },
    ],
    correctAnswer: "B",
    answer: "B",
    markscheme: "1 mark for B.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["ionic-bonding"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
