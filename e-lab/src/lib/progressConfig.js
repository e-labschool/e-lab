// Every threshold the Progress insight engine uses lives here — never
// scattered inline in components — so tuning "what counts as a strength"
// later is a one-line change, not a hunt through the UI.
export const PROGRESS_CONFIG = {
  strongThreshold: 75, // assessment % at/above this can be a "Strength"
  weakThreshold: 55, // assessment % below this is "Needs Reinforcement"
  minAttemptsForStrength: 5, // a topic needs at least this many marked attempts to count as a genuine strength — never from one lucky question
  minAttemptsForInsight: 2, // below this, treat assessment data as too thin to classify at all ("Not assessed" instead of a potentially misleading label)
};

/**
 * HIGH learning + HIGH assessment -> Strong
 * HIGH learning + LOW assessment  -> Needs reinforcement
 * LOW learning + HIGH assessment  -> Performing well / continue learning
 * LOW learning + LOW assessment   -> Priority area
 * no assessment data              -> Not assessed
 * no learning data                -> Not started
 */
export function classifyTopic({ learnedPercent, assessedPercent, attemptCount }) {
  const hasLearning = learnedPercent > 0;
  const hasAssessment = assessedPercent != null && attemptCount >= PROGRESS_CONFIG.minAttemptsForInsight;

  if (!hasLearning && !hasAssessment) return "not_started";
  if (!hasAssessment) return "not_assessed";

  const highLearning = learnedPercent >= 70;
  const highAssessment = assessedPercent >= PROGRESS_CONFIG.strongThreshold;
  const lowAssessment = assessedPercent < PROGRESS_CONFIG.weakThreshold;

  if (highLearning && highAssessment) return "strong";
  if (highLearning && lowAssessment) return "revisit"; // "Needs reinforcement" — learned it, but assessment says otherwise
  if (!highLearning && highAssessment) return "performing_well";
  if (!hasLearning) return "practise"; // no learning yet, but has been attempted in Solve
  return "priority"; // some learning, but assessment is weak
}

export const STATUS_LABELS = {
  strong: "Strong",
  revisit: "Needs Reinforcement",
  performing_well: "Continue Learning",
  priority: "Priority Area",
  practise: "Practise",
  not_assessed: "Not Assessed",
  not_started: "Not Started",
};

// Estimated IB Grade prediction — every threshold/weight lives here so the
// model can be retuned without touching predictionEngine.js or the UI.
export const PREDICTION_CONFIG = {
  weights: {
    overallPerformance: 0.5,
    recentPerformance: 0.2,
    syllabusCoverage: 0.15,
    difficultyPerformance: 0.1,
    consistency: 0.05,
  },

  // Matches the question bank's actual DIFFICULTIES tiers (Easy/Medium/
  // Hard/Challenge, see src/data/questions/schema.js) -- not a generic
  // three-tier scale invented for this feature. "Challenge" extrapolates
  // one step past "Hard" at the same spacing (1.2 -> 1.3).
  difficultyWeights: {
    Easy: 0.8,
    Medium: 1.0,
    Hard: 1.2,
    Challenge: 1.3,
  },
  unknownDifficultyWeight: 1.0, // a question whose difficulty can't be resolved never excludes it, just treats it as neutral

  recentChallengeCount: 6, // "the last N meaningful submitted challenges" for the recent-performance component

  minimumEvidence: {
    challenges: 3, // fewest submitted challenges before ANY estimate is shown
    syllabusAreas: 2, // fewest distinct subtopics with meaningful evidence
    questionsPerSubtopicForFullCoverage: 4, // a subtopic counts as FULLY covered once it has this many marked attempts
  },

  cycleCooldownDays: 30, // derived from the most recent prediction_cycles.started_at -- see canStartNewCycle() in predictionEngine.js, no extra "last reset" column

  // e-Lab's own indicative estimation boundaries -- explicitly NOT official
  // IB grade boundaries, which vary by session/component. Percentage is the
  // MINIMUM to reach that grade (7 needs 80%+, down to 1 for anything below 30%).
  gradeBoundaries: {
    7: 80,
    6: 70,
    5: 60,
    4: 50,
    3: 40,
    2: 30,
    1: 0,
  },

  // Below this weighted-score margin from the nearest boundary, show a
  // grade RANGE instead of a single number -- keeps the range decision
  // deterministic (a fixed distance from the boundary), never random.
  gradeRangeMarginPoints: 3,

  // Confidence tiers, in ascending order of the composite evidence score
  // computed in predictionEngine.js (0-100) -- see getConfidence().
  confidenceThresholds: { medium: 40, high: 70 },
};
