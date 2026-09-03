// Structure 2.2 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S2-2-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 2",
    subtopic: "2.2",
    topicCode: "Structure 2.2",
    level: "HL",
    paper: "Paper 1B",
    questionType: "Short Response",
    difficulty: "Medium",
    commandTerms: [],
    marks: 3,
    estimatedMinutes: null,
    questionText: "Describe the bonding in the nitrate ion, NO₃⁻, including the concept of resonance, and state the bond order of each N–O bond.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "Three equivalent resonance structures, each with one N=O double bond and two N–O single bonds; the true structure is an average of all three; bond order = 4/3 (≈1.33) for each N–O bond.",
    markscheme: "M1: correct connectivity (N central, bonded to 3 O).\nM1: resonance explanation (delocalization / average of structures).\nA1: correct bond order of 4/3.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["resonance","lewis-structures","bond-order"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
