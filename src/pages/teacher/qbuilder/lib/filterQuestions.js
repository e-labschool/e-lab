// Filter shape is now array/set-based to match the checkbox filter panel:
// an empty array for a group means "no restriction from this group" (show
// everything); a non-empty array means OR-within-group (any match passes).
// Between groups, filters combine with AND — the same as before, just
// expressed with arrays instead of single "All" sentinel strings.
import { getCurriculumCode } from "./paperUtils.js";

export const DEFAULT_FILTERS = {
  search: "",
  curriculumCodes: [], // e.g. ["S1.3", "R2.2"] — a question passes if its topicCode's short form is included
  levels: [], // exact match against a question's literal `level` value: "SL" | "HL" | "SL/HL" (never merged/inferred)
  papers: [], // "Paper 1A" | "Paper 1B" | "Paper 2"
  difficulties: [], // "Easy" | "Medium" | "Hard" | "Challenge"
  questionTypes: [], // the 6 teacher-facing categories — see QUESTION_TYPE_GROUPS in paperUtils.js
  status: "All", // kept as a single select — an internal workflow filter, not part of the primary checkbox groups
  commandTerm: "All",
  skill: "All",
  marksMin: "",
  marksMax: "",
};

export function countActiveFilters(filters) {
  return (
    filters.curriculumCodes.length +
    filters.levels.length +
    filters.papers.length +
    filters.difficulties.length +
    filters.questionTypes.length +
    (filters.status !== "All" ? 1 : 0) +
    (filters.commandTerm !== "All" ? 1 : 0) +
    (filters.skill !== "All" ? 1 : 0) +
    (filters.marksMin !== "" ? 1 : 0) +
    (filters.marksMax !== "" ? 1 : 0) +
    (filters.search.trim() !== "" ? 1 : 0)
  );
}

export function filterQuestions(questions, filters, questionTypeMatchers) {
  const search = filters.search.trim().toLowerCase();

  return questions.filter((q) => {
    if (filters.curriculumCodes.length > 0) {
      if (!filters.curriculumCodes.includes(getCurriculumCode(q))) return false;
    }
    if (filters.levels.length > 0 && !filters.levels.includes(q.level)) return false;
    if (filters.papers.length > 0 && !filters.papers.includes(q.paper)) return false;
    if (filters.difficulties.length > 0 && !filters.difficulties.includes(q.difficulty)) return false;
    if (filters.questionTypes.length > 0 && questionTypeMatchers) {
      const matches = filters.questionTypes.some((typeId) => questionTypeMatchers[typeId]?.(q));
      if (!matches) return false;
    }
    if (filters.status !== "All" && q.status !== filters.status) return false;
    if (filters.commandTerm !== "All" && !(q.commandTerms || []).includes(filters.commandTerm)) return false;
    if (filters.skill !== "All" && !(q.skills || []).includes(filters.skill)) return false;
    if (filters.marksMin !== "" && q.marks < Number(filters.marksMin)) return false;
    if (filters.marksMax !== "" && q.marks > Number(filters.marksMax)) return false;
    if (search) {
      const haystack = `${q.id} ${q.questionText} ${q.topicCode ?? ""} ${(q.tags || []).join(" ")} ${(q.skills || []).join(" ")} ${(q.commandTerms || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
