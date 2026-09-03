// Reactivity 2.2 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R2-2-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 2",
    subtopic: "2.2",
    topicCode: "Reactivity 2.2",
    level: "SL",
    paper: "Paper 1A",
    questionType: "MCQ",
    difficulty: "Easy",
    commandTerms: [],
    marks: 1,
    estimatedMinutes: null,
    questionText: "Which factor does NOT increase the rate of a chemical reaction?",
    parts: null,
    options: [
      { id: "A", text: "Increasing temperature" },
      { id: "B", text: "Increasing concentration" },
      { id: "C", text: "Decreasing surface area" },
      { id: "D", text: "Adding a catalyst" },
    ],
    correctAnswer: "C",
    answer: "C",
    markscheme: "1 mark for C.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["factors-affecting-rate"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
