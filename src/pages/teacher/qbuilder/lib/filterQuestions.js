export const DEFAULT_FILTERS = {
  search: "",
  paper: "All", // "All" | "Paper 1A" | "Paper 1B" | "Paper 2" — horizontal tab, single-select
  section: "All", // "All" | "Structure" | "Reactivity"
  code: "All", // a specific curriculum code, e.g. "S1.3", or "All"
  difficulty: "All",
  questionType: "All",
  marksMin: "",
  marksMax: "",
};

export function filterQuestions(questions, filters) {
  const search = filters.search.trim().toLowerCase();

  return questions.filter((q) => {
    if (filters.paper !== "All" && q.paper !== filters.paper) return false;
    if (filters.section !== "All" && q.syllabusSection !== filters.section) return false;
    if (filters.code !== "All") {
      const letter = filters.code[0];
      const sub = filters.code.slice(1);
      if (q.syllabusSection[0] !== letter || q.subtopic !== sub) return false;
    }
    if (filters.difficulty !== "All" && q.difficulty !== filters.difficulty) return false;
    if (filters.questionType !== "All" && q.questionType !== filters.questionType) return false;
    if (filters.marksMin !== "" && q.marks < Number(filters.marksMin)) return false;
    if (filters.marksMax !== "" && q.marks > Number(filters.marksMax)) return false;
    if (search) {
      const haystack = `${q.id} ${q.questionText} ${(q.tags || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
