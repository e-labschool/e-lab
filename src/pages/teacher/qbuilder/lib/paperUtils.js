// Small pure helpers shared across the Question Bank, Paper Builder, and
// exports — kept separate from both data and UI so the same logic can't
// drift between components.

export function calcTotalMarks(questions) {
  return questions.reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
}

export function generateCustomId(baseId) {
  const suffix = Date.now().toString(36).toUpperCase();
  return `CUSTOM-${baseId ? `${baseId}-` : ""}${suffix}`;
}

export function generatePaperId() {
  return `PAPER-${Date.now().toString(36).toUpperCase()}`;
}

export const LEVELS = ["SL", "HL"];
export const PAPERS = ["Paper 1A", "Paper 1B", "Paper 2"];
export const SYLLABUS_SECTIONS = ["Structure", "Reactivity"];
export const TOPICS_BY_SECTION = {
  Structure: ["Structure 1", "Structure 2", "Structure 3"],
  Reactivity: ["Reactivity 1", "Reactivity 2", "Reactivity 3"],
};
export const SUBTOPICS_BY_TOPIC = {
  "Structure 1": ["1.1", "1.2", "1.3", "1.4", "1.5"],
  "Structure 2": ["2.1", "2.2", "2.3", "2.4"],
  "Structure 3": ["3.1", "3.2"],
  "Reactivity 1": ["1.1", "1.2", "1.3", "1.4"],
  "Reactivity 2": ["2.1", "2.2", "2.3"],
  "Reactivity 3": ["3.1", "3.2", "3.3", "3.4"],
};
export const DIFFICULTIES = ["Easy", "Medium", "Hard"];
export const QUESTION_TYPES = ["MCQ", "Calculation", "Short Response", "Extended Response", "Data-based"];

export function formatDateStamp(isoString) {
  if (!isoString) return "";
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// Derives a compact curriculum code (e.g. "S1.3", "R3.2") straight from the
// question's own syllabusSection + subtopic fields — never hard-coded per
// question. subtopic values already embed the topic number (e.g. "1.3" for
// Structure 1's third subtopic), so this is just section-initial + subtopic.
export function getCurriculumCode(question) {
  const sectionLetter = question.syllabusSection?.[0] ?? "?";
  return `${sectionLetter}${question.subtopic ?? ""}`;
}

// All curriculum codes that exist across the static topic/subtopic maps,
// grouped by section — used to populate the compact subsection filter.
export function getAllCurriculumCodes() {
  const codes = [];
  for (const [section, topics] of Object.entries({ Structure: TOPICS_BY_SECTION.Structure, Reactivity: TOPICS_BY_SECTION.Reactivity })) {
    const letter = section[0];
    for (const topic of topics) {
      for (const sub of SUBTOPICS_BY_TOPIC[topic]) {
        codes.push(`${letter}${sub}`);
      }
    }
  }
  return codes;
}
