export const DEFAULT_FILTERS = {
  search: "",
  paper: "All", // "All" | "Paper 1A" | "Paper 1B" | "Paper 2" — horizontal tab, single-select
  section: "All", // "All" | "Structure" | "Reactivity"
  unit: "All", // "All" | "Structure 1" | "Structure 2" | ...
  code: "All", // a specific curriculum topic code, e.g. "S1.3", or "All"
  level: "All", // "All" | "SL" | "HL" | "SL/HL" — a question is shown for an SL filter only if it's SL or SL/HL (never HL-only)
  difficulty: "All",
  questionType: "All",
  commandTerm: "All",
  skill: "All",
  status: "All", // "All" | "published" | "reviewed" | "draft"
  marksMin: "",
  marksMax: "",
};

export function filterQuestions(questions, filters) {
  const search = filters.search.trim().toLowerCase();

  return questions.filter((q) => {
    if (filters.paper !== "All" && q.paper !== filters.paper) return false;
    if (filters.section !== "All" && q.syllabusSection !== filters.section) return false;
    if (filters.unit !== "All" && q.topic !== filters.unit) return false;
    if (filters.code !== "All") {
      const letter = filters.code[0];
      const sub = filters.code.slice(1);
      if (q.syllabusSection[0] !== letter || q.subtopic !== sub) return false;
    }
    // SL selected -> show SL and SL/HL, never HL-only. HL selected -> show HL and SL/HL, never SL-only.
    if (filters.level === "SL" && q.level === "HL") return false;
    if (filters.level === "HL" && q.level === "SL") return false;
    if (filters.level === "SL/HL" && q.level !== "SL/HL") return false;
    if (filters.difficulty !== "All" && q.difficulty !== filters.difficulty) return false;
    if (filters.questionType !== "All" && q.questionType !== filters.questionType) return false;
    if (filters.commandTerm !== "All" && !(q.commandTerms || []).includes(filters.commandTerm)) return false;
    if (filters.skill !== "All" && !(q.skills || []).includes(filters.skill)) return false;
    if (filters.status !== "All" && q.status !== filters.status) return false;
    if (filters.marksMin !== "" && q.marks < Number(filters.marksMin)) return false;
    if (filters.marksMax !== "" && q.marks > Number(filters.marksMax)) return false;
    if (search) {
      const haystack = `${q.id} ${q.questionText} ${q.topicCode ?? ""} ${(q.tags || []).join(" ")} ${(q.skills || []).join(" ")} ${(q.commandTerms || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
