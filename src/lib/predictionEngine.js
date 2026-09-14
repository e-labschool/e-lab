import { supabase } from "./supabaseClient.js";
import { PREDICTION_CONFIG } from "./progressConfig.js";

// ============================================================
// Cycle management
// ============================================================

/** The user's currently active prediction cycle, or null if they've never
 * had one (a brand-new student, or one who hasn't reached evidence yet --
 * see ensureActiveCycle). No DB write happens here. */
export async function getActiveCycle(userId) {
  if (!supabase || !userId) return null;
  const { data } = await supabase.from("prediction_cycles").select("*").eq("user_id", userId).eq("is_active", true).maybeSingle();
  return data ?? null;
}

/** All of a user's cycles, most recent first -- used for the Previous
 * Prediction Cycles section and the cooldown check. */
export async function getAllCycles(userId) {
  if (!supabase || !userId) return [];
  const { data } = await supabase.from("prediction_cycles").select("*").eq("user_id", userId).order("cycle_number", { ascending: false });
  return data ?? [];
}

/**
 * Creates cycle 1 the first time it's actually needed (lazily, once the
 * student has reached minimum evidence) rather than at signup -- avoids an
 * unnecessary row/write for students who never get far enough to need one.
 * `earliestSubmittedAt` is the student's EARLIEST submitted challenge date:
 * cycle 1's started_at is set to that (not "now"), so the very first
 * cycle's window correctly includes all evidence that already exists,
 * instead of accidentally excluding everything that led to the estimate.
 */
export async function ensureActiveCycle(userId, earliestSubmittedAt) {
  const existing = await getActiveCycle(userId);
  if (existing) return existing;
  if (!supabase || !userId) return null;

  const { data, error } = await supabase
    .from("prediction_cycles")
    .insert({ user_id: userId, cycle_number: 1, started_at: earliestSubmittedAt ?? new Date().toISOString(), is_active: true })
    .select()
    .single();
  if (error) {
    // A concurrent request may have already created cycle 1 (the partial
    // unique index would reject this insert) -- re-fetch rather than fail.
    const retry = await getActiveCycle(userId);
    if (retry) return retry;
    throw error;
  }
  return data;
}

/** Whether the user may start a new cycle right now, derived purely from
 * the most recent cycle's started_at -- prediction_cycles.started_at is
 * the single source of truth for the cooldown, no separate "last reset"
 * column. Returns { allowed, availableAt } so the UI can show exactly
 * when the cooldown lifts. */
export function canStartNewCycle(allCycles) {
  if (!allCycles || allCycles.length === 0) return { allowed: true, availableAt: null };
  const mostRecent = allCycles.reduce((latest, c) => (new Date(c.started_at) > new Date(latest.started_at) ? c : latest), allCycles[0]);
  const availableAt = new Date(new Date(mostRecent.started_at).getTime() + PREDICTION_CONFIG.cycleCooldownDays * 24 * 60 * 60 * 1000);
  return { allowed: new Date() >= availableAt, availableAt };
}

/** Ends the current active cycle and starts a fresh one. Never touches
 * student_challenges/challenge_questions/learning_progress -- those stay
 * exactly as they are; only prediction_cycles changes. Throws if still
 * within the cooldown so the UI's confirmation modal can't be bypassed by
 * calling this directly. */
export async function startNewCycle(userId) {
  if (!supabase || !userId) throw new Error("You need to be signed in to start a new prediction cycle.");
  const allCycles = await getAllCycles(userId);
  const { allowed, availableAt } = canStartNewCycle(allCycles);
  if (!allowed) {
    const err = new Error(`You can start a new prediction cycle from ${availableAt.toLocaleDateString()}.`);
    err.availableAt = availableAt;
    throw err;
  }

  const active = allCycles.find((c) => c.is_active);
  if (active) {
    await supabase.from("prediction_cycles").update({ is_active: false, ended_at: new Date().toISOString() }).eq("id", active.id);
  }
  const nextCycleNumber = allCycles.length > 0 ? Math.max(...allCycles.map((c) => c.cycle_number)) + 1 : 1;
  const { data, error } = await supabase
    .from("prediction_cycles")
    .insert({ user_id: userId, cycle_number: nextCycleNumber, started_at: new Date().toISOString(), is_active: true })
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ============================================================
// Difficulty lookup — bulk, never one query per question
// ============================================================

/** Builds a question_id -> difficulty map in at most ONE Supabase round
 * trip from the canonical question bank. A question whose
 * difficulty can't be resolved is simply absent from the map; callers use
 * PREDICTION_CONFIG.unknownDifficultyWeight rather than failing. */
export async function buildDifficultyMap(questionIds) {
  const map = new Map();
  const uniqueIds = [...new Set(questionIds)];
  if (uniqueIds.length === 0) return map;

  // Supabase is the single canonical question source. Resolve every
  // requested ID in one bulk query; unknown/old IDs simply remain absent.
  if (supabase) {
    const { data } = await supabase.from("questions").select("id, difficulty").in("id", uniqueIds);
    for (const row of data ?? []) {
      if (row.difficulty) map.set(row.id, row.difficulty);
    }
  }

  return map;
}

function difficultyWeightFor(difficultyMap, questionId) {
  const difficulty = difficultyMap.get(questionId);
  return (difficulty && PREDICTION_CONFIG.difficultyWeights[difficulty]) ?? PREDICTION_CONFIG.unknownDifficultyWeight;
}

// ============================================================
// Component calculations — each returns a 0-100 value (or null if there's
// no evidence for that component at all).
// ============================================================

function marksRatio(attempts) {
  const marked = attempts.filter((a) => a.marks_awarded != null && a.marks_possible != null);
  if (marked.length === 0) return null;
  const awarded = marked.reduce((s, a) => s + a.marks_awarded, 0);
  const possible = marked.reduce((s, a) => s + a.marks_possible, 0);
  return possible > 0 ? (awarded / possible) * 100 : null;
}

/** Syllabus coverage with PARTIAL credit per subtopic -- a subtopic with 1
 * of the 4 required marked attempts contributes 25% of full coverage, not
 * 0% or 100%. This is what stops "a tiny amount of evidence spread across
 * many subtopics" from looking like strong coverage: each subtopic still
 * needs to individually approach the evidence threshold. */
function computeSyllabusCoverage(subtopicStats) {
  if (subtopicStats.length === 0) return { percent: 0, coveredCount: 0, partialCount: 0 };
  const required = PREDICTION_CONFIG.minimumEvidence.questionsPerSubtopicForFullCoverage;
  let sum = 0;
  let coveredCount = 0;
  let partialCount = 0;
  for (const s of subtopicStats) {
    const fraction = Math.min(1, s.attemptCount / required);
    sum += fraction;
    if (fraction >= 1) coveredCount += 1;
    else if (fraction > 0) partialCount += 1;
  }
  return { percent: (sum / subtopicStats.length) * 100, coveredCount, partialCount };
}

function computeDifficultyPerformance(attempts, difficultyMap) {
  const marked = attempts.filter((a) => a.marks_awarded != null && a.marks_possible != null);
  if (marked.length === 0) return null;
  let weightedAwarded = 0;
  let weightedPossible = 0;
  for (const a of marked) {
    const w = difficultyWeightFor(difficultyMap, a.question_id);
    weightedAwarded += a.marks_awarded * w;
    weightedPossible += a.marks_possible * w;
  }
  return weightedPossible > 0 ? (weightedAwarded / weightedPossible) * 100 : null;
}

function computeConsistency(recentChallengePercents) {
  if (recentChallengePercents.length < 2) return null;
  const mean = recentChallengePercents.reduce((s, p) => s + p, 0) / recentChallengePercents.length;
  const variance = recentChallengePercents.reduce((s, p) => s + (p - mean) ** 2, 0) / recentChallengePercents.length;
  const stdDev = Math.sqrt(variance);
  // A stdDev of 0 (perfectly consistent) -> 100; a stdDev of 50 points
  // (wildly inconsistent) or more -> 0. Never negative.
  return Math.max(0, 100 - stdDev * 2);
}

// ============================================================
// Grade / range / confidence
// ============================================================

function gradeForScore(score) {
  const boundaries = PREDICTION_CONFIG.gradeBoundaries;
  for (const grade of [7, 6, 5, 4, 3, 2, 1]) {
    if (score >= boundaries[grade]) return grade;
  }
  return 1;
}

/** Deterministic, score-distance-based range decision -- never random.
 * If the score sits within gradeRangeMarginPoints of the boundary for an
 * adjacent grade, that adjacent grade is included in the displayed range. */
function gradeRangeForScore(score) {
  const grade = gradeForScore(score);
  const margin = PREDICTION_CONFIG.gradeRangeMarginPoints;
  const boundaries = PREDICTION_CONFIG.gradeBoundaries;

  let low = grade, high = grade;
  const higherBoundary = boundaries[grade + 1];
  if (grade < 7 && higherBoundary != null && score >= higherBoundary - margin) high = grade + 1;
  const ownBoundary = boundaries[grade];
  if (grade > 1 && score <= ownBoundary + margin) low = grade - 1;

  return { low, high, isRange: low !== high };
}

/** Confidence is a SEPARATE composite from the grade itself -- evidence
 * volume, syllabus breadth, and consistency, never the grade or the
 * performance percentage. A student can have Grade 7 with Low confidence
 * if only a sliver of the syllabus has been assessed.
 *
 * Deliberately gated by the WEAKEST dimension (60% weight on the minimum
 * of the three factors, 40% on their average) rather than a plain
 * average: a plain average lets strong consistency/volume mask genuinely
 * thin syllabus coverage, which would contradict the exact scenario this
 * feature needs to communicate honestly (high score, narrow coverage ->
 * low confidence, not medium). Verified against that scenario directly
 * before this formula was finalized. */
function computeConfidence({ challengeCount, syllabusCoveragePercent, consistencyScore }) {
  const challengeAdequacy = Math.min(100, (challengeCount / (PREDICTION_CONFIG.minimumEvidence.challenges * 2)) * 100);
  const coverageAdequacy = Math.min(100, syllabusCoveragePercent * 1.4); // full marks well before 100% coverage, which is an unrealistic bar
  const consistencyAdequacy = consistencyScore ?? 100;

  const avg = (challengeAdequacy + coverageAdequacy + consistencyAdequacy) / 3;
  const min = Math.min(challengeAdequacy, coverageAdequacy, consistencyAdequacy);
  const composite = avg * 0.4 + min * 0.6;

  const { medium, high } = PREDICTION_CONFIG.confidenceThresholds;
  const level = composite >= high ? "high" : composite >= medium ? "medium" : "low";
  return { level, composite };
}

function getTrend(recentGrades) {
  if (recentGrades.length < 2) return null;
  const first = recentGrades[0];
  const last = recentGrades[recentGrades.length - 1];
  if (last > first) return "improving";
  if (last < first) return "declining";
  return "stable";
}

// ============================================================
// Main entry point
// ============================================================

/**
 * Computes the Estimated IB Grade for the CURRENT prediction cycle.
 *
 * `cycleStartedAt` is null for a student with no explicit cycle yet (their
 * whole history counts); otherwise only attempts/challenges on or after
 * that date count -- the timestamp-based cycle boundary the brief asked
 * for, with no prediction_cycle_id written onto any Challenge row.
 */
export async function calculatePrediction({ subtopicStats, challenges, attempts, cycleStartedAt }) {
  const cycleChallenges = cycleStartedAt ? challenges.filter((c) => new Date(c.submitted_at) >= new Date(cycleStartedAt)) : challenges;
  const cycleChallengeIds = new Set(cycleChallenges.map((c) => c.id));
  const cycleAttempts = attempts.filter((a) => cycleChallengeIds.has(a.challenge_id));

  const evidenceChallenges = cycleChallenges.length;
  const subtopicsWithEvidence = subtopicStats.filter((s) => s.attemptCount > 0).length;

  const meetsMinimumEvidence = evidenceChallenges >= PREDICTION_CONFIG.minimumEvidence.challenges && subtopicsWithEvidence >= PREDICTION_CONFIG.minimumEvidence.syllabusAreas;

  if (!meetsMinimumEvidence) {
    return {
      hasEstimate: false,
      evidenceChallenges,
      subtopicsWithEvidence,
      requiredChallenges: PREDICTION_CONFIG.minimumEvidence.challenges,
      requiredSyllabusAreas: PREDICTION_CONFIG.minimumEvidence.syllabusAreas,
    };
  }

  // ---- Overall performance (50%) ----
  const overallPerformance = marksRatio(cycleAttempts) ?? 0;

  // ---- Recent performance (20%) — most recent N SUBMITTED challenges ----
  const recentChallenges = [...cycleChallenges].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)).slice(0, PREDICTION_CONFIG.recentChallengeCount);
  const recentChallengeIds = new Set(recentChallenges.map((c) => c.id));
  const recentAttempts = cycleAttempts.filter((a) => recentChallengeIds.has(a.challenge_id));
  const recentPerformance = marksRatio(recentAttempts) ?? overallPerformance;

  // ---- Syllabus coverage (15%) — partial credit, SL/HL-scoped subtopics only ----
  const coverage = computeSyllabusCoverage(subtopicStats);

  // ---- Difficulty-adjusted performance (10%) ----
  const questionIds = cycleAttempts.map((a) => a.question_id).filter(Boolean);
  const difficultyMap = await buildDifficultyMap(questionIds);
  const difficultyPerformance = computeDifficultyPerformance(cycleAttempts, difficultyMap) ?? overallPerformance;

  // ---- Consistency (5%) — variance across recent challenge percentages ----
  const recentPercents = recentChallenges.map((c) => (c.max_score > 0 ? (c.score / c.max_score) * 100 : 0));
  const consistencyScore = computeConsistency(recentPercents) ?? 100; // a single recent challenge can't be "inconsistent" -- neutral default

  const weights = PREDICTION_CONFIG.weights;
  const weightedScore =
    overallPerformance * weights.overallPerformance +
    recentPerformance * weights.recentPerformance +
    coverage.percent * weights.syllabusCoverage +
    difficultyPerformance * weights.difficultyPerformance +
    consistencyScore * weights.consistency;

  const { low, high, isRange } = gradeRangeForScore(weightedScore);
  const confidence = computeConfidence({ challengeCount: evidenceChallenges, syllabusCoveragePercent: coverage.percent, consistencyScore });

  return {
    hasEstimate: true,
    estimatedGrade: isRange ? null : low,
    estimatedGradeLow: low,
    estimatedGradeHigh: high,
    isRange,
    estimatedPercentage: Math.round(weightedScore * 10) / 10,
    confidence: confidence.level,
    overallPerformance: Math.round(overallPerformance * 10) / 10,
    recentPerformance: Math.round(recentPerformance * 10) / 10,
    syllabusCoverage: Math.round(coverage.percent * 10) / 10,
    difficultyPerformance: Math.round(difficultyPerformance * 10) / 10,
    consistencyScore: Math.round(consistencyScore * 10) / 10,
    evidenceChallenges,
    evidenceMarks: cycleAttempts.filter((a) => a.marks_awarded != null).reduce((s, a) => s + a.marks_possible, 0),
    subtopicsWithEvidence,
  };
}

export { getTrend, gradeForScore, gradeRangeForScore };
