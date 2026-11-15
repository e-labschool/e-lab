// Legacy question fixtures (no stimulus.placement anywhere) for the question-layout identity test.
const IMG = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
export const LEGACY_QUESTIONS = [
  { id: "EL-S1-1-001", marks: 2, questionType: "MCQ", questionText: "Which species has 17 protons and 18 neutrons?", stimulus: { type: "image", src: IMG, alt: "diagram", caption: "Figure 1" }, options: [{ id: "A", text: "<sup>35</sup>Cl" }, { id: "B", text: "<sup>37</sup>Cl" }, { id: "C", text: "Ar" }, { id: "D", text: "K" }], parts: null },
  { id: "EL-S1-1-002", marks: 3, questionType: "Short Response", questionText: "Explain why isotopes have the same chemical properties.", stimulus: { type: "table", table: { headers: ["Isotope", "Abundance"], rows: [["Cl-35", "75%"], ["Cl-37", "25%"]] } }, options: null, parts: null },
  { id: "EL-S1-1-003", marks: 4, questionType: "Calculation", questionText: "Calculate the relative atomic mass.", stimulus: null, options: null, parts: [{ id: "a", questionText: "State A", marks: 1 }, { id: "b", questionText: "Work out Ar", marks: 3 }] },
];
export const LEGACY_DRAFT = {
  details: { schoolName: "School", subject: "Chemistry", classGrade: "G9", assessmentTitle: "Test", date: "", duration: "", maxMarks: "", instructions: "Answer all." },
  questions: [
    { id: "q1", questionText: "Which species?", marks: 2, questionType: "MCQ", stimulus: { type: "image", src: IMG, alt: "diagram", caption: "Figure 1" }, options: [{ id: "A", text: "x" }, { id: "B", text: "y" }], parts: null },
    { id: "q2", questionText: "Explain.", marks: 3, questionType: "Short Response", stimulus: { type: "table", table: { headers: ["a"], rows: [["1"]] } }, options: null, parts: null },
  ],
};
