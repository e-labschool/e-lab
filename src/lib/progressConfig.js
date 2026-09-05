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
