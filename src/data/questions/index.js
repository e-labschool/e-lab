// THE central question registry — the ONE list both Teacher Q Builder and
// (later) Student Solve read from. Aggregates every topic file below into
// one flat array plus a set of query helpers. No component anywhere should
// import an individual topic file directly; everything goes through here.

import s11 from "./structure/structure-1/structure-1-1.js";
import s12 from "./structure/structure-1/structure-1-2.js";
import s13 from "./structure/structure-1/structure-1-3.js";
import s14 from "./structure/structure-1/structure-1-4.js";
import s15 from "./structure/structure-1/structure-1-5.js";
import s21 from "./structure/structure-2/structure-2-1.js";
import s22 from "./structure/structure-2/structure-2-2.js";
import s23 from "./structure/structure-2/structure-2-3.js";
import s24 from "./structure/structure-2/structure-2-4.js";
import s31 from "./structure/structure-3/structure-3-1.js";
import s32 from "./structure/structure-3/structure-3-2.js";
import r11 from "./reactivity/reactivity-1/reactivity-1-1.js";
import r12 from "./reactivity/reactivity-1/reactivity-1-2.js";
import r13 from "./reactivity/reactivity-1/reactivity-1-3.js";
import r14 from "./reactivity/reactivity-1/reactivity-1-4.js";
import r21 from "./reactivity/reactivity-2/reactivity-2-1.js";
import r22 from "./reactivity/reactivity-2/reactivity-2-2.js";
import r23 from "./reactivity/reactivity-2/reactivity-2-3.js";
import r31 from "./reactivity/reactivity-3/reactivity-3-1.js";
import r32 from "./reactivity/reactivity-3/reactivity-3-2.js";
import r33 from "./reactivity/reactivity-3/reactivity-3-3.js";
import r34 from "./reactivity/reactivity-3/reactivity-3-4.js";

import { normalizeQuestion, validateQuestion, DEFAULT_VISIBLE_STATUSES } from "./schema.js";

// Adding a new topic file later means adding one import above and one entry
// here — nothing else in the app needs to change (see README.md).
const TOPIC_FILES = [
  s11, s12, s13, s14, s15,
  s21, s22, s23, s24,
  s31, s32,
  r11, r12, r13, r14,
  r21, r22, r23,
  r31, r32, r33, r34,
];

const rawQuestions = TOPIC_FILES.flat();
const allQuestions = rawQuestions.map(normalizeQuestion);

export function getAllQuestions() {
  return allQuestions;
}

export function getQuestionsByStatus(statuses = DEFAULT_VISIBLE_STATUSES) {
  return allQuestions.filter((q) => statuses.includes(q.status));
}

/** The default bank view: reviewed + published only, never drafts. */
export function getVisibleQuestions() {
  return getQuestionsByStatus(DEFAULT_VISIBLE_STATUSES);
}

export function getQuestionById(id) {
  return allQuestions.find((q) => q.id === id) ?? null;
}

/** IDs that appear more than once — should always be empty; surfaced for dev-time checking. */
export function findDuplicateIds() {
  const seen = new Map();
  const duplicates = [];
  for (const q of allQuestions) {
    if (seen.has(q.id)) duplicates.push(q.id);
    seen.set(q.id, true);
  }
  return [...new Set(duplicates)];
}

/** Very lightweight duplicate-text flagging: exact (normalized) questionText matches across different ids. */
export function findPossibleDuplicateText() {
  const byText = new Map();
  for (const q of allQuestions) {
    const key = q.questionText.trim().toLowerCase().replace(/\s+/g, " ");
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(q.id);
  }
  return [...byText.values()].filter((ids) => ids.length > 1);
}

export function getAllCommandTerms() {
  return [...new Set(allQuestions.flatMap((q) => q.commandTerms || []))].sort();
}

export function getAllSkills() {
  return [...new Set(allQuestions.flatMap((q) => q.skills || []))].sort();
}

// Dev-time safety net: flags malformed questions and duplicate IDs in the
// browser console as soon as the registry loads, so a bad batch paste is
// caught immediately rather than discovered later. Silent in production.
if (import.meta.env?.DEV) {
  const dupIds = findDuplicateIds();
  if (dupIds.length > 0) {
    // eslint-disable-next-line no-console
    console.warn("[question bank] Duplicate question IDs found:", dupIds);
  }
  for (const q of allQuestions) {
    const problems = validateQuestion(q);
    if (problems.length > 0) {
      // eslint-disable-next-line no-console
      console.warn(`[question bank] ${q.id} has validation issues:`, problems);
    }
  }
}
