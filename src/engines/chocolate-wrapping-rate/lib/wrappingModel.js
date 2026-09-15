// Pure rate-of-process model for the Chocolate Wrapping analogy.
//
// Generalized to the wrapping RULE's chocolate:wrapper ratio (1:1 or
// 2:1), so both options run through the exact same logic -- never two
// parallel implementations. `chocolatesPerEvent` is the only thing that
// differs between rules; wrappers are always 1 per event.
//
// Deliberately NOT a fixed decay formula or random-event model: at every
// simulated second, the number of packs wrapped is a fraction of
// whatever complete sets are CURRENTLY POSSIBLE
// (min(floor(chocolates/chocolatesPerEvent), wrappers)), clamped to at
// least 1 while any complete set remains. This is what makes the
// slowdown emerge naturally from decreasing availability of required
// items -- never from the "worker" getting tired.
export const DECAY_FRACTION = 0.35;
export const RATE_WINDOW_SECONDS = 10;

export const WRAPPING_RULES = {
  rule1: { id: "rule1", chocolatesPerEvent: 1, label: "1 Chocolate + 1 Wrapper \u2192 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 20 },
  rule2: { id: "rule2", chocolatesPerEvent: 2, label: "2 Chocolates + 1 Wrapper \u2192 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 10 },
};

export function createInitialState(chocolates, wrappers) {
  return { chocolates, wrappers, packs: 0, time: 0, lastEventCount: 0, running: false, finished: false, eventHistory: [] };
}

/** Advances the process by exactly one simulated second. Returns a NEW
 * state object (never mutates the one passed in). `eventHistory` keeps
 * only the last RATE_WINDOW_SECONDS entries -- enough to compute "packs
 * per 10 s" without the array growing unbounded over a long run. */
export function advanceTick(state, chocolatesPerEvent) {
  const maxPossible = Math.min(Math.floor(state.chocolates / chocolatesPerEvent), state.wrappers);
  if (maxPossible <= 0) {
    return { ...state, running: false, finished: true, lastEventCount: 0 };
  }
  const eventsThisTick = Math.min(maxPossible, Math.max(1, Math.round(maxPossible * DECAY_FRACTION)));
  const nextChocolates = state.chocolates - eventsThisTick * chocolatesPerEvent;
  const nextWrappers = state.wrappers - eventsThisTick;
  const nextPacks = state.packs + eventsThisTick;
  const nextTime = state.time + 1;
  const nextMaxPossible = Math.min(Math.floor(nextChocolates / chocolatesPerEvent), nextWrappers);
  const nextHistory = [...state.eventHistory, eventsThisTick].slice(-RATE_WINDOW_SECONDS);
  return {
    chocolates: nextChocolates,
    wrappers: nextWrappers,
    packs: nextPacks,
    time: nextTime,
    lastEventCount: eventsThisTick,
    running: state.running,
    finished: nextMaxPossible <= 0,
    eventHistory: nextHistory,
  };
}

/** "Packs per RATE_WINDOW_SECONDS s" -- summed from the actual recent
 * event history, the same numbers already driving the counters and
 * graph, never a separately-invented display value. */
export function currentRateOverWindow(state) {
  if (state.finished) return 0;
  return state.eventHistory.reduce((s, n) => s + n, 0);
}
