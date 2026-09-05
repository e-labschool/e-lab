import { supabase } from "./supabaseClient.js";
import { getLearnTree, summarizeProgress } from "./learn-tree.js";
import { getStreak } from "./challengeService.js";
import { PROGRESS_CONFIG, classifyTopic } from "./progressConfig.js";

// Nothing here stores a standalone "progress percentage" — every number
// is computed fresh from the same two existing tables the rest of the app
// already uses: public.learning_progress (Learn) and
// public.challenge_questions / public.student_challenges (Solve). No new
// table, no new migration — both already exist with compatible curriculum
// codes ("S1.1", "R2.2", ...), confirmed by inspection before writing this.

function buildSubtopicIndex() {
  const tree = getLearnTree();
  const subtopics = []; // { code, label, topicCode, topicLabel, conceptIds }
  const topics = []; // { code, label, subtopicCodes }
  for (const section of tree.sections) {
    for (const topic of section.topics) {
      const subtopicCodes = topic.subtopics.map((s) => s.code);
      topics.push({ code: topic.code, label: topic.label, subtopicCodes });
      for (const sub of topic.subtopics) {
        subtopics.push({ code: sub.code, label: sub.label, topicCode: topic.code, topicLabel: topic.label, conceptIds: sub.concepts.map((c) => c.id) });
      }
    }
  }
  return { subtopics, topics };
}

/** Only auto-marked attempts contribute to Assessment Performance —
 * Short/Extended/Data-based responses (marks_awarded stays null, per the
 * Solve build's explicit "no unreliable auto-marking" rule) don't
 * silently corrupt the average by being treated as 0 or skipped
 * inconsistently; they're excluded from the denominator entirely. */
function isMarkedAttempt(row) {
  return row.marks_awarded != null && row.marks_possible != null;
}

function aggregateAssessment(rows) {
  const marked = rows.filter(isMarkedAttempt);
  if (marked.length === 0) return { assessedPercent: null, attemptCount: 0 };
  const awarded = marked.reduce((s, r) => s + r.marks_awarded, 0);
  const possible = marked.reduce((s, r) => s + r.marks_possible, 0);
  return {
    assessedPercent: possible > 0 ? Math.round((awarded / possible) * 100) : null,
    attemptCount: marked.length,
  };
}

export async function getProgressOverview() {
  const { subtopics, topics } = buildSubtopicIndex();

  if (!supabase) {
    return emptyOverview(subtopics, topics);
  }
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id;
  if (!userId) return emptyOverview(subtopics, topics);

  const [{ data: learnRows }, { data: attemptRows }, { data: challengeRows }, streak] = await Promise.all([
    supabase.from("learning_progress").select("*").eq("user_id", userId),
    supabase.from("challenge_questions").select("*").eq("user_id", userId),
    supabase.from("student_challenges").select("*").eq("user_id", userId).eq("status", "submitted").order("submitted_at", { ascending: false }),
    getStreak(),
  ]);

  const learn = learnRows ?? [];
  const attempts = attemptRows ?? [];
  const challenges = challengeRows ?? [];

  // ---- Subtopic-level rollup ----
  const subtopicStats = subtopics.map((s) => {
    const { completed, total } = summarizeProgress(
      Object.fromEntries(learn.map((r) => [r.concept_id, r])),
      s.conceptIds
    );
    const learnedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const subtopicAttempts = attempts.filter((a) => a.topic_code === s.code);
    const { assessedPercent, attemptCount } = aggregateAssessment(subtopicAttempts);
    const status = classifyTopic({ learnedPercent, assessedPercent, attemptCount });
    return { ...s, learnedPercent, completedConcepts: completed, totalConcepts: total, assessedPercent, attemptCount, status };
  });

  // ---- Topic-level rollup (sum of its subtopics) ----
  const topicStats = topics.map((t) => {
    const subs = subtopicStats.filter((s) => s.topicCode === t.code);
    const totalConcepts = subs.reduce((sum, s) => sum + s.totalConcepts, 0);
    const completedConcepts = subs.reduce((sum, s) => sum + s.completedConcepts, 0);
    const learnedPercent = totalConcepts > 0 ? Math.round((completedConcepts / totalConcepts) * 100) : 0;
    const topicAttempts = attempts.filter((a) => t.subtopicCodes.includes(a.topic_code));
    const { assessedPercent, attemptCount } = aggregateAssessment(topicAttempts);
    const status = classifyTopic({ learnedPercent, assessedPercent, attemptCount });
    return { ...t, learnedPercent, totalConcepts, completedConcepts, assessedPercent, attemptCount, status, subtopics: subs };
  });

  // ---- Overall summary metrics (top of page) ----
  const overallTotalConcepts = subtopicStats.reduce((s, x) => s + x.totalConcepts, 0);
  const overallCompletedConcepts = subtopicStats.reduce((s, x) => s + x.completedConcepts, 0);
  const overallLearnedPercent = overallTotalConcepts > 0 ? Math.round((overallCompletedConcepts / overallTotalConcepts) * 100) : 0;
  const overallAssessment = aggregateAssessment(attempts);
  const questionsAttempted = attempts.filter((a) => a.answered_at != null).length;
  const avgChallengeScore = challenges.length > 0
    ? Math.round(challenges.reduce((s, c) => s + (c.max_score > 0 ? (c.score / c.max_score) * 100 : 0), 0) / challenges.length)
    : null;

  // ---- Strengths: real evidence only, minimum attempts enforced ----
  const strengths = subtopicStats
    .filter((s) => s.status === "strong" && s.attemptCount >= PROGRESS_CONFIG.minAttemptsForStrength)
    .sort((a, b) => b.assessedPercent - a.assessedPercent)
    .slice(0, 5);

  // ---- Areas to strengthen: learned but weak, or actively weak with real data ----
  const areasToStrengthen = subtopicStats
    .filter((s) => (s.status === "revisit" || s.status === "priority") && s.attemptCount >= PROGRESS_CONFIG.minAttemptsForInsight)
    .sort((a, b) => a.assessedPercent - b.assessedPercent)
    .slice(0, 5);

  // ---- One recommendation, deterministic priority order ----
  const recommendation = pickRecommendation(subtopicStats);

  // ---- Recent activity (real events only, merged + sorted) ----
  const recentActivity = buildRecentActivity(learn, challenges, subtopicStats);

  // ---- Performance trend: last 10 submitted challenges, oldest first ----
  const trend = [...challenges].reverse().slice(-10).map((c) => ({
    date: c.submitted_at,
    percent: c.max_score > 0 ? Math.round((c.score / c.max_score) * 100) : 0,
  }));

  return {
    overallLearnedPercent,
    overallAssessedPercent: overallAssessment.assessedPercent,
    questionsAttempted,
    avgChallengeScore,
    challengesCompleted: challenges.length,
    streak,
    topicStats,
    subtopicStats,
    strengths,
    areasToStrengthen,
    recommendation,
    recentActivity,
    trend,
  };
}

function pickRecommendation(subtopicStats) {
  // 1. High learning, weak assessment — reinforce what should already be understood.
  const reinforce = subtopicStats
    .filter((s) => s.status === "revisit" && s.attemptCount >= PROGRESS_CONFIG.minAttemptsForInsight)
    .sort((a, b) => a.assessedPercent - b.assessedPercent)[0];
  if (reinforce) return { kind: "strengthen", subtopic: reinforce };

  // 2. Learning genuinely in progress (started, not finished) — nudge to finish it.
  const inProgress = subtopicStats
    .filter((s) => s.learnedPercent > 0 && s.learnedPercent < 100)
    .sort((a, b) => b.learnedPercent - a.learnedPercent)[0];
  if (inProgress) return { kind: "continue", subtopic: inProgress };

  // 3. Weak, frequently-attempted topic — most-practised area still underperforming.
  const weakFrequent = subtopicStats
    .filter((s) => s.status === "priority")
    .sort((a, b) => b.attemptCount - a.attemptCount)[0];
  if (weakFrequent) return { kind: "strengthen", subtopic: weakFrequent };

  // 4. Recently completed learning with no assessment yet — close the loop.
  const unassessedButLearned = subtopicStats
    .filter((s) => s.learnedPercent === 100 && s.attemptCount === 0)
    .sort((a, b) => (b.completedConcepts ?? 0) - (a.completedConcepts ?? 0))[0];
  if (unassessedButLearned) return { kind: "challenge", subtopic: unassessedButLearned };

  return null;
}

function buildRecentActivity(learnRows, challenges, subtopicStats) {
  const events = [];
  for (const row of learnRows) {
    if (row.status === "completed" && row.completed_at) {
      events.push({ type: "learn", at: row.completed_at, label: `Completed a concept in ${labelFor(subtopicStats, row.curriculum_code)}` });
    }
  }
  for (const c of challenges) {
    const pct = c.max_score > 0 ? Math.round((c.score / c.max_score) * 100) : null;
    events.push({ type: "challenge", at: c.submitted_at, label: `Completed ${c.topic_codes.join(" + ")} challenge${pct != null ? ` — ${pct}%` : ""}` });
  }
  return events.sort((a, b) => new Date(b.at) - new Date(a.at)).slice(0, 6);
}

function labelFor(subtopicStats, code) {
  return subtopicStats.find((s) => s.code === code)?.label ?? code;
}

function emptyOverview(subtopics, topics) {
  const subtopicStats = subtopics.map((s) => ({ ...s, learnedPercent: 0, completedConcepts: 0, totalConcepts: s.conceptIds.length, assessedPercent: null, attemptCount: 0, status: "not_started" }));
  const topicStats = topics.map((t) => ({
    ...t,
    learnedPercent: 0, totalConcepts: subtopicStats.filter((s) => s.topicCode === t.code).reduce((s, x) => s + x.totalConcepts, 0),
    completedConcepts: 0, assessedPercent: null, attemptCount: 0, status: "not_started",
    subtopics: subtopicStats.filter((s) => s.topicCode === t.code),
  }));
  return {
    overallLearnedPercent: 0, overallAssessedPercent: null, questionsAttempted: 0, avgChallengeScore: null, challengesCompleted: 0,
    streak: { current_streak: 0 }, topicStats, subtopicStats, strengths: [], areasToStrengthen: [], recommendation: null, recentActivity: [], trend: [],
  };
}
