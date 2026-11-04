// localStorage is used for two things only now:
//   1. "My Questions" (teacher's personal question bank) — unaffected by
//      the paper-persistence change, still local-only.
//   2. Draft paper METADATA (school name, class, date, etc.) — kept here
//      because public.question_papers has no matching columns for these
//      fields (only title/paper/level); adding them wasn't part of this
//      change's approved scope. The actual paper QUESTIONS/ITEMS are
//      Supabase-backed now (see paperService.js) — that's the part this
//      change is about.
//
// The OLD keys (myPapers, draftPaper) are still READABLE here (never
// written to anymore) purely so a one-time "Import your local papers"
// prompt can detect and offer to migrate anything left over from before
// this change — see QuestionBuilder's local-import flow.

const KEYS = {
  myQuestions: "e-lab:qbuilder:my-questions",
  draftDetails: "e-lab:qbuilder:draft-details",
  legacyMyPapers: "e-lab:qbuilder:my-papers", // old key, read-only now
  legacyDraftPaper: "e-lab:qbuilder:draft-paper", // old key, read-only now
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
    // localStorage can throw (quota, private mode) — fail silently, the
    // in-memory React state still works for the current session.
  }
}

// ---- My Questions (teacher-created / edited-copy questions) ----

export function loadMyQuestions() {
  return readJSON(KEYS.myQuestions, []);
}

export function saveMyQuestions(questions) {
  writeJSON(KEYS.myQuestions, questions);
}

// ---- Draft paper metadata only (school/class/date/etc — not questions) ----

const DEFAULT_DRAFT_DETAILS = {
  schoolName: "",
  assessmentTitle: "",
  subject: "Chemistry",
  classGrade: "",
  date: "",
  duration: "",
  maxMarks: "",
  instructions: "Answer all questions.\nShow working for calculation questions.",
};

export function loadDraftDetails() {
  return { ...DEFAULT_DRAFT_DETAILS, ...readJSON(KEYS.draftDetails, {}) };
}

export function saveDraftDetails(details) {
  writeJSON(KEYS.draftDetails, details);
}

// ---- One-time local-papers import support (read-only access to the
// OLD combined localStorage format, never written to anymore) ----

export function loadLegacyLocalPapers() {
  return readJSON(KEYS.legacyMyPapers, []);
}

export function loadLegacyDraftPaper() {
  return readJSON(KEYS.legacyDraftPaper, null);
}

export function clearLegacyLocalPapers() {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEYS.legacyMyPapers);
    window.localStorage.removeItem(KEYS.legacyDraftPaper);
  } catch {
    // non-critical if this fails — worst case the import prompt reappears once more
  }
}
