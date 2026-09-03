// Structure 1.3 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S1-3-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 1",
    subtopic: "1.3",
    topicCode: "Structure 1.3",
    level: "HL",
    paper: "Paper 1B",
    questionType: "Short Response",
    difficulty: "Medium",
    commandTerms: [],
    marks: 3,
    estimatedMinutes: null,
    questionText: "Write the full ground-state electron configuration of a chromium atom (Z = 24) and explain why it is an exception to the pattern predicted by the Aufbau principle.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s¹; the half-filled 3d subshell (combined with the half-filled 4s) gives extra stability compared with the naively predicted 3d⁴ 4s².",
    markscheme: "M1: correct configuration 1s² 2s² 2p⁶ 3s² 3p⁶ 3d⁵ 4s¹.\nM1: identifies it as an exception to Aufbau.\nA1: correct stability reasoning (half-filled subshell).",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["electron-configuration","aufbau-principle"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
