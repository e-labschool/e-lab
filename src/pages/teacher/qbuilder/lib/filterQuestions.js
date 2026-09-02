export const DEFAULT_FILTERS = {
  search: "",
  level: "All",
  paper: [],
  syllabusSection: [],
  topic: [],
  subtopic: [], // stored as "Topic \u00b7 Subtopic" strings, matching FilterSidebar's option format
  difficulty: [],
  questionType: [],
  marksMin: "",
  marksMax: "",
};

export function filterQuestions(questions, filters) {
  const search = filters.search.trim().toLowerCase();

  return questions.filter((q) => {
    if (filters.level !== "All" && q.level !== filters.level) return false;
    if (filters.paper.length > 0 && !filters.paper.includes(q.paper)) return false;
    if (filters.syllabusSection.length > 0 && !filters.syllabusSection.includes(q.syllabusSection)) return false;
    if (filters.topic.length > 0 && !filters.topic.includes(q.topic)) return false;
    if (filters.subtopic.length > 0 && !filters.subtopic.includes(`${q.topic} \u00b7 ${q.subtopic}`)) return false;
    if (filters.difficulty.length > 0 && !filters.difficulty.includes(q.difficulty)) return false;
    if (filters.questionType.length > 0 && !filters.questionType.includes(q.questionType)) return false;
    if (filters.marksMin !== "" && q.marks < Number(filters.marksMin)) return false;
    if (filters.marksMax !== "" && q.marks > Number(filters.marksMax)) return false;
    if (search) {
      const haystack = `${q.id} ${q.questionText} ${(q.tags || []).join(" ")}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}
