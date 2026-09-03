// Reactivity 1.1 — question batch file.
// PASTE NEW QUESTIONS FOR THIS SUBTOPIC HERE, as additional objects inside
// this array, following the exact shape of the objects already present
// (or see src/data/questions/schema.js for the full field reference and
// src/data/questions/README.md for the batch-paste workflow).
//
// Do not change existing question "id" values once published — ids are
// permanent. Next available sequence number for this file: 002.

const questions = [
  {
    id: "EL-R1-1-001",
    curriculum: "IB DP Chemistry",
    syllabusVersion: "First assessment 2025",
    syllabusSection: "Reactivity",
    topic: "Reactivity 1",
    subtopic: "1.1",
    topicCode: "Reactivity 1.1",
    level: "SL",
    paper: "Paper 1B",
    questionType: "Calculation",
    difficulty: "Medium",
    commandTerms: [],
    marks: 3,
    estimatedMinutes: null,
    questionText: "50.0 cm³ of 1.00 mol dm⁻³ HCl(aq) was mixed with 50.0 cm³ of 1.00 mol dm⁻³ NaOH(aq) in a calorimeter. The temperature rose by 6.8 °C. Calculate the enthalpy change of neutralization per mole of water formed. (Assume density 1.00 g cm⁻³, specific heat capacity 4.18 J g⁻¹ K⁻¹)",
    parts: null,
    options: null,
    correctAnswer: null,
    answer: "ΔH ≈ −56.8 kJ mol⁻¹",
    markscheme: "M1: q = mcΔT = 100 × 4.18 × 6.8 = 2842 J.\nM1: moles of water formed = 0.0500 mol.\nA1: ΔH = −2842/0.0500 = −56.8 kJ mol⁻¹ (sign and units required).",
    explanation: "",
    skills: [],
    dataBookletRequired: false,
    calculatorRequired: true,
    tags: ["enthalpy-change","calorimetry"],
    diagram: null,
    table: null,
    graph: null,
    source: "e-Lab Original",
    status: "published",
  },
];

export default questions;
