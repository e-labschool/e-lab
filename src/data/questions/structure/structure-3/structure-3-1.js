// Structure 3.1 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S3-1-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 3",
    subtopic: "3.1",
    topicCode: "Structure 3.1",
    level: "SL",
    paper: "Paper 1A",
    questionType: "MCQ",
    difficulty: "Easy",
    commandTerms: [],
    marks: 1,
    estimatedMinutes: null,
    questionText: "Which element has the largest atomic radius?",
    parts: null,
    options: [
      { id: "A", text: "Li" },
      { id: "B", text: "Na" },
      { id: "C", text: "K" },
      { id: "D", text: "Rb" },
    ],
    correctAnswer: "D",
    answer: "D",
    markscheme: "1 mark for D — atomic radius increases down a group.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["periodic-trends-atomic-radius"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
