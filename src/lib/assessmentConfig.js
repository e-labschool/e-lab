// Assessment behaviour is configuration, not hardcoded logic — so a
// future Exam Simulation mode can reuse the exact same ChallengeSession
// machinery with stricter values (e.g. maxFocusViolations: 0) instead of
// duplicating the focus/fullscreen/navigation-lock code.
export const CUSTOM_CHALLENGE_CONFIG = {
  assessmentMode: "custom_challenge",
  maxFocusViolations: 3, // the 3rd violation auto-submits
  fullscreenRequired: false, // requested, but the challenge still works if denied/unsupported
  navigationLocked: true,
};

// Not wired into a real Exam Simulation route yet (that feature isn't
// built) — kept here so the day it exists, it configures the SAME
// ChallengeSession rather than a forked copy of this logic.
export const EXAM_SIMULATION_CONFIG = {
  assessmentMode: "exam_simulation",
  maxFocusViolations: 1,
  fullscreenRequired: true,
  navigationLocked: true,
};
