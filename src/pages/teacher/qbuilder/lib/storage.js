// Version 1 persistence: browser localStorage, since the project has no
// backend/database yet (per the architecture, this is a static frontend).
// Every function below is small and pure enough that swapping this file's
// internals for real API calls later won't require touching any component.

const KEYS = {
  myQuestions: "e-lab:qbuilder:my-questions",
  myPapers: "e-lab:qbuilder:my-papers",
  draftPaper: "e-lab:qbuilder:draft-paper",
};

function readJSON(key, fallback) {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON(key, value) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // localStorage can throw (quota, private mode) — fail silently for V1,
    // the in-memory React state still works for the current session.
  }
}

// ---- My Questions (teacher-created / edited-copy questions) ----

export function loadMyQuestions() {
  return readJSON(KEYS.myQuestions, []);
}

export function saveMyQuestions(questions) {
  writeJSON(KEYS.myQuestions, questions);
}

// ---- My Papers (saved question papers) ----

export function loadMyPapers() {
  return readJSON(KEYS.myPapers, []);
}

export function saveMyPapers(papers) {
  writeJSON(KEYS.myPapers, papers);
}

// ---- Draft paper (the "My Paper" currently being assembled) ----

const DEFAULT_DRAFT = {
  questions: [],
  details: {
    schoolName: "",
    assessmentTitle: "",
    subject: "Chemistry",
    classGrade: "",
    date: "",
    duration: "",
    maxMarks: "",
    instructions: "Answer all questions.\nShow working for calculation questions.",
  },
};

export function loadDraftPaper() {
  const draft = readJSON(KEYS.draftPaper, DEFAULT_DRAFT);
  return { ...DEFAULT_DRAFT, ...draft, details: { ...DEFAULT_DRAFT.details, ...draft.details } };
}

export function saveDraftPaper(draft) {
  writeJSON(KEYS.draftPaper, draft);
}

export function clearDraftPaper() {
  writeJSON(KEYS.draftPaper, DEFAULT_DRAFT);
}
