// Reactivity 3.4 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R3-4-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 3",
    subtopic: "3.4",
    topicCode: "Reactivity 3.4",
    level: "HL",
    paper: "Paper 2",
    questionType: "Extended Response",
    difficulty: "Hard",
    commandTerms: [],
    marks: 4,
    estimatedMinutes: null,
    questionText: "Outline the mechanism for the nucleophilic substitution reaction between bromoethane and hydroxide ions, stating whether the mechanism is Sᴴ1 or Sᴺ2 and justifying your answer.",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "Sᴺ2 mechanism: OH⁻ attacks the carbon from the side directly opposite the leaving Br⁻ (backside attack); a transition state forms with partial bonds to both OH and Br; the C–O bond forms as the C–Br bond breaks in one concerted step. Justified because bromoethane is a primary halogenoalkane, where steric hindrance is low, favouring Sᴺ2 over Sᴴ1.",
    markscheme: "M1: correctly identifies Sᴺ2.\nM1: describes backside attack / transition state.\nM1: describes concerted bond breaking/forming.\nA1: justification based on primary carbon / steric hindrance.",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: false,
    tags: ["nucleophilic-substitution-mechanism","electrophiles-and-nucleophiles"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
