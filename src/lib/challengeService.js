import { getVisibleQuestions } from "../data/questions/index.js";
import { getCurriculumCode } from "../pages/teacher/qbuilder/lib/paperUtils.js";
import { supabase } from "./supabaseClient.js";

// ============================================================
// Question eligibility + curation (pure logic, no DB) — kept separate
// from the Supabase persistence functions below so the selection
// algorithm itself can be tested/reasoned about without a live database.
// ============================================================

// Solve is stricter than the Question Bank's normal "reviewed OR
// published" visibility: only fully `published` questions are eligible
// for a student-facing timed assessment, per the brief's question-
// security requirements — draft/reviewed-only content stays out of Solve.
function isEligibleForSolve(q, level) {
  if (q.status !== "published") return false;
  if (level === "SL") return q.level === "SL" || q.level === "SL/HL";
  // HL challenges may include appropriate SL foundation content.
  return q.level === "HL" || q.level === "SL/HL" || q.level === "SL";
}

// Most existing questions have estimatedMinutes: null — this is the
// documented, disclosed fallback used until estimatedMinutes is
// populated across the bank. Values are deliberately conservative
// (rounded, not falsely precise).
const TYPE_FALLBACK_MINUTES = {
  MCQ: 1.5,
  "Short Response": 2.5,
  Calculation: 3.5,
  "Data-based": 4,
  "Extended Response": 5,
};
export function estimateMinutesFor(question) {
  return question.estimatedMinutes ?? TYPE_FALLBACK_MINUTES[question.questionType] ?? 3;
}

function shuffle(array) {
  const copy = [...array];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// Exam Ready favours reasoning/application-style questions over quick MCQ
// recall — approximated here via question type + difficulty, since the
// bank doesn't yet have a dedicated "assessment_skill" field (see the
// Question Bank future-proofing note in the final report).
const EXAM_READY_TYPE_WEIGHT = { "Extended Response": 3, "Data-based": 3, Calculation: 2, "Short Response": 1, MCQ: 0.5 };

/**
 * Selects a balanced, non-duplicate set of questions for a challenge.
 * excludeQuestionIds: recently-seen question ids to deprioritize (not
 * hard-exclude, unless there's no alternative) — this is the hook a
 * future "avoid recently seen" feature plugs into; V1 uses it lightly.
 * Returns { questions, insufficientReason } — questions is [] and
 * insufficientReason is set when the pool can't satisfy the request.
 */
export function curateChallenge({ topicCodes, level, mode, questionCount, timeLimitMinutes, style, excludeQuestionIds = [] }) {
  const all = getVisibleQuestions();
  const eligible = all.filter((q) => isEligibleForSolve(q, level) && topicCodes.includes(getCurriculumCode(q)));

  if (eligible.length === 0) {
    return { questions: [], insufficientReason: "Not enough questions are currently available for this combination." };
  }

  // Deprioritize recently-seen questions rather than hard-excluding them —
  // if the eligible pool is small, repetition is preferable to failing
  // the whole challenge build.
  const fresh = shuffle(eligible.filter((q) => !excludeQuestionIds.includes(q.id)));
  const seen = shuffle(eligible.filter((q) => excludeQuestionIds.includes(q.id)));
  const pool = [...fresh, ...seen];

  const byTopic = new Map();
  for (const q of pool) {
    const code = getCurriculumCode(q);
    if (!byTopic.has(code)) byTopic.set(code, []);
    byTopic.get(code).push(q);
  }

  if (style === "exam_ready") {
    for (const list of byTopic.values()) {
      list.sort((a, b) => (EXAM_READY_TYPE_WEIGHT[b.questionType] ?? 1) - (EXAM_READY_TYPE_WEIGHT[a.questionType] ?? 1));
    }
  }

  function roundRobinSelect(targetCount) {
    const selected = [];
    const cursors = new Map(topicCodes.map((c) => [c, 0]));
    let stillAdding = true;
    while (selected.length < targetCount && stillAdding) {
      stillAdding = false;
      for (const code of topicCodes) {
        if (selected.length >= targetCount) break;
        const list = byTopic.get(code) ?? [];
        const cursor = cursors.get(code);
        if (cursor < list.length) {
          selected.push(list[cursor]);
          cursors.set(code, cursor + 1);
          stillAdding = true;
        }
      }
    }
    return selected;
  }

  if (mode === "questions") {
    const selected = roundRobinSelect(questionCount);
    if (selected.length < questionCount) {
      return {
        questions: [],
        insufficientReason: `Not enough questions are currently available for this combination (found ${selected.length} of ${questionCount}).`,
      };
    }
    return { questions: selected, insufficientReason: null };
  }

  // mode === "time": add questions (round-robin across topics) until the
  // cumulative estimated time reaches the selected duration, then stop —
  // never overshoot significantly past the requested time.
  const selected = [];
  const cursors = new Map(topicCodes.map((c) => [c, 0]));
  let totalMinutes = 0;
  let stillAdding = true;
  while (totalMinutes < timeLimitMinutes && stillAdding) {
    stillAdding = false;
    for (const code of topicCodes) {
      const list = byTopic.get(code) ?? [];
      const cursor = cursors.get(code);
      if (cursor < list.length) {
        const candidate = list[cursor];
        const candidateMinutes = estimateMinutesFor(candidate);
        if (totalMinutes + candidateMinutes > timeLimitMinutes + 3 && selected.length > 0) continue; // don't overshoot badly once we have at least something
        selected.push(candidate);
        cursors.set(code, cursor + 1);
        totalMinutes += candidateMinutes;
        stillAdding = true;
      }
    }
  }

  if (selected.length === 0) {
    return { questions: [], insufficientReason: "Not enough questions are currently available for this combination." };
  }
  return { questions: selected, insufficientReason: null };
}

// ============================================================
// Supabase persistence
// ============================================================

export async function createChallenge({ topicCodes, level, mode, timeLimitSeconds, style, questions }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) throw new Error("You need to be signed in to start a challenge.");

  const { data: challenge, error } = await supabase
    .from("student_challenges")
    .insert({
      user_id: userId,
      topic_codes: topicCodes,
      level,
      mode,
      question_count: questions.length,
      time_limit_seconds: timeLimitSeconds ?? null,
      style,
    })
    .select()
    .single();
  if (error) throw error;

  const rows = questions.map((q, i) => ({
    challenge_id: challenge.id,
    user_id: userId,
    question_id: q.id,
    position: i,
    topic_code: getCurriculumCode(q),
    marks_possible: q.marks ?? 1,
  }));
  const { error: qError } = await supabase.from("challenge_questions").insert(rows);
  if (qError) throw qError;

  return challenge;
}

export async function getActiveChallenge() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("student_challenges")
    .select("*")
    .eq("status", "in_progress")
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getChallengeQuestions(challengeId) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("challenge_questions")
    .select("*")
    .eq("challenge_id", challengeId)
    .order("position", { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveAnswer(challengeId, questionId, answer) {
  if (!supabase) return;
  const { error } = await supabase
    .from("challenge_questions")
    .update({ student_answer: answer, answered_at: new Date().toISOString() })
    .eq("challenge_id", challengeId)
    .eq("question_id", questionId);
  if (error) throw error;
}

export async function updateChallengeProgress(challengeId, { currentQuestionIndex, flaggedQuestionIds }) {
  if (!supabase) return;
  const patch = {};
  if (currentQuestionIndex != null) patch.current_question_index = currentQuestionIndex;
  if (flaggedQuestionIds != null) patch.flagged_question_ids = flaggedQuestionIds;
  const { error } = await supabase.from("student_challenges").update(patch).eq("id", challengeId);
  if (error) throw error;
}

export async function getChallengeHistory(limit = 10) {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("student_challenges")
    .select("*")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data;
}

export async function getChallengeStats() {
  if (!supabase) return { questionsSolved: 0, accuracy: null, challengesCompleted: 0 };
  const { data, error } = await supabase
    .from("student_challenges")
    .select("question_count, score, max_score")
    .eq("status", "submitted");
  if (error) throw error;

  const questionsSolved = data.reduce((sum, c) => sum + (c.question_count ?? 0), 0);
  const totalScore = data.reduce((sum, c) => sum + (c.score ?? 0), 0);
  const totalMax = data.reduce((sum, c) => sum + (c.max_score ?? 0), 0);
  return {
    questionsSolved,
    accuracy: totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : null,
    challengesCompleted: data.length,
  };
}

// ============================================================
// Scoring — deliberately narrow, per the brief's warning against
// "scientifically unreliable automatic marking for free-text responses".
// Only MCQ (exact option-id match) and single-value Calculation answers
// (numeric, small relative tolerance) are auto-marked here. Short/
// Extended Response and Data-based questions are left unmarked
// (is_correct/marks_awarded stay null) — the Challenge Report shows these
// as "Needs Review" rather than guessing a score for them.
// ============================================================
function markAnswer(question, studentAnswer) {
  if (studentAnswer == null || studentAnswer === "") return { is_correct: null, marks_awarded: null };

  if (question.questionType === "MCQ") {
    const correct = String(studentAnswer).trim() === String(question.correctAnswer).trim();
    return { is_correct: correct, marks_awarded: correct ? (question.marks ?? 1) : 0 };
  }

  if (question.questionType === "Calculation" && question.correctAnswer != null) {
    const expected = parseFloat(String(question.correctAnswer).replace(/[^0-9.-]/g, ""));
    const given = parseFloat(String(studentAnswer).replace(/[^0-9.-]/g, ""));
    if (!Number.isNaN(expected) && !Number.isNaN(given) && expected !== 0) {
      const withinTolerance = Math.abs((given - expected) / expected) < 0.01; // 1% relative tolerance
      return { is_correct: withinTolerance, marks_awarded: withinTolerance ? (question.marks ?? 1) : 0 };
    }
  }

  return { is_correct: null, marks_awarded: null };
}

/**
 * Freezes answers, marks what can be reliably auto-marked, records
 * completion time, and updates the streak. Guards against duplicate
 * submission by checking status first.
 */
export async function submitChallenge(challengeId, { questionsById, durationSeconds }) {
  if (!supabase) throw new Error("Not connected to Supabase.");

  const { data: challenge, error: fetchError } = await supabase
    .from("student_challenges")
    .select("*")
    .eq("id", challengeId)
    .single();
  if (fetchError) throw fetchError;
  if (challenge.status === "submitted") return challenge; // already submitted — never double-score

  const rows = await getChallengeQuestions(challengeId);

  let score = 0;
  let maxScore = 0;
  for (const row of rows) {
    const question = questionsById[row.question_id];
    if (!question) continue;
    const marksPossible = question.marks ?? 1;
    maxScore += marksPossible;
    const { is_correct, marks_awarded } = markAnswer(question, row.student_answer);
    if (marks_awarded != null) score += marks_awarded;
    await supabase
      .from("challenge_questions")
      .update({ is_correct, marks_awarded })
      .eq("id", row.id);
  }

  const { data: updated, error: updateError } = await supabase
    .from("student_challenges")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      duration_seconds: durationSeconds,
      score,
      max_score: maxScore,
    })
    .eq("id", challengeId)
    .eq("status", "in_progress") // extra guard against a race producing a double submit
    .select()
    .single();
  if (updateError) throw updateError;

  if (rows.length >= 5) await recordStreakDay();

  return updated;
}

// ============================================================
// Streak — consistency, not correctness. Recomputed from
// last_qualifying_date rather than trusted incrementally forever, so a
// missed day naturally lapses without a separate "reset" write.
// ============================================================
function todayISODate() {
  return new Date().toISOString().slice(0, 10);
}
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}

export async function getStreak() {
  if (!supabase) return { current_streak: 0, longest_streak: 0, last_qualifying_date: null };
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return { current_streak: 0, longest_streak: 0, last_qualifying_date: null };

  const { data, error } = await supabase.from("student_streaks").select("*").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  if (!data) return { current_streak: 0, longest_streak: 0, last_qualifying_date: null };

  // A streak only "counts" as still active if today or yesterday was the
  // last qualifying day — otherwise it's effectively lapsed, shown as 0
  // without needing a background job to proactively reset it.
  const gap = data.last_qualifying_date ? daysBetween(data.last_qualifying_date, todayISODate()) : Infinity;
  if (gap > 1) return { ...data, current_streak: 0 };
  return data;
}

async function recordStreakDay() {
  if (!supabase) return;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return;

  const { data: existing } = await supabase.from("student_streaks").select("*").eq("user_id", userId).maybeSingle();
  const today = todayISODate();

  if (!existing) {
    await supabase.from("student_streaks").insert({ user_id: userId, current_streak: 1, longest_streak: 1, last_qualifying_date: today });
    return;
  }
  if (existing.last_qualifying_date === today) return; // already counted today

  const gap = existing.last_qualifying_date ? daysBetween(existing.last_qualifying_date, today) : Infinity;
  const nextStreak = gap === 1 ? existing.current_streak + 1 : 1; // consecutive day continues it; any gap > 1 starts fresh at 1
  await supabase
    .from("student_streaks")
    .update({ current_streak: nextStreak, longest_streak: Math.max(nextStreak, existing.longest_streak), last_qualifying_date: today })
    .eq("user_id", userId);
}
