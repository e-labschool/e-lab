// Structure 2.4 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-S2-4-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Structure",
    topic: "Structure 2",
    subtopic: "2.4",
    topicCode: "Structure 2.4",
    level: "HL",
    paper: "Paper 2",
    questionType: "Extended Response",
    difficulty: "Hard",
    commandTerms: [],
    marks: 5,
    estimatedMinutes: null,
    questionText: "Compare and contrast the melting point, electrical conductivity, and solubility in water of sodium chloride, diamond, and iodine, explaining each in terms of structure and bonding.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "NaCl: ionic lattice — high melting point, conducts only when molten/aqueous, soluble in water.\nDiamond: giant covalent lattice — very high melting point, non-conductor (no delocalized electrons/ions), insoluble in water.\nIodine: simple molecular, held by weak London forces — low melting point, non-conductor, poorly soluble in water.",
    markscheme: "M1–M2: NaCl properties with structural reasoning.\nM1–M2: diamond properties with structural reasoning.\nA1: iodine properties with structural reasoning.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["bonding-continuum","properties-of-ionic-compounds","covalent-network-structures"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
