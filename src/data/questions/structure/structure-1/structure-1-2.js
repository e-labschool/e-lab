// Structure 1.2 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S1-2-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.2",
    topicCode: "Structure 1.2",
    level: "SL",
    paper: "Paper 1A",
    questionType: "MCQ",
    difficulty: "Easy",
    commandTerms: [],
    marks: 1,
    estimatedMinutes: null,
    questionText: "Which particle has a relative mass of approximately 1/1840 that of a proton?",
    parts: null,
    options: [
      { id: "A", text: "Neutron" },
      { id: "B", text: "Electron" },
      { id: "C", text: "Positron" },
      { id: "D", text: "Alpha particle" },
    ],
    correctAnswer: "B",
    answer: "B",
    markscheme: "1 mark for B.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["subatomic-particles"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
