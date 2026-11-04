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
// items -- never from the "worker" getting tired -- and it's the SAME
// per-tick event count that feeds chocolates/wrappers/packs, the graph,
// AND the rolling rate below. No separate/artificial rate model.
export const DECAY_FRACTION = 0.35;

// "The most recent 2-3 seconds of ACTIVE simulation time" -- since one
// tick IS one active simulated second (ticks only ever fire while
// running, never during a pause), a plain window over the last N tick
// entries is already active-time-only by construction; no separate
// pause-time bookkeeping is needed.
export const RATE_WINDOW_SECONDS = 3;

export const WRAPPING_RULES = {
  rule1: { id: "rule1", chocolatesPerEvent: 1, label: "1 Chocolate + 1 Wrapper \u2192 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 20 },
  rule2: { id: "rule2", chocolatesPerEvent: 2, label: "2 Chocolates + 1 Wrapper \u2192 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 10 },
};

export function createInitialState(chocolates, wrappers) {
  return { chocolates, wrappers, packs: 0, time: 0, finished: false, eventHistory: [] };
}

/** Advances the process by exactly one simulated second. Returns a NEW
 * state object (never mutates the one passed in). `eventHistory` keeps
 * only the last RATE_WINDOW_SECONDS per-tick event counts -- exactly
 * what currentRate() below needs, and nothing unbounded. */
export function advanceTick(state, chocolatesPerEvent) {
  const maxPossible = Math.min(Math.floor(state.chocolates / chocolatesPerEvent), state.wrappers);
  if (maxPossible <= 0) {
    return { ...state, finished: true };
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
    finished: nextMaxPossible <= 0,
    eventHistory: nextHistory,
  };
}

/** Current rate in packs/second, rounded to one decimal place -- a
 * rolling average over the last RATE_WINDOW_SECONDS of ACTIVE simulation
 * time (or fewer, right at the start), computed from the SAME per-tick
 * event counts already driving chocolates/wrappers/packs and the graph.
 * Returns `null` once naturally finished OR before any ticks have run
 * (the caller distinguishes "not started" / "paused" -> null from
 * "finished" -> the separate literal 0 it already has from `finished`;
 * this function only reports the live computed value while there's
 * genuine recent activity to average). */
export function currentRate(state) {
  if (state.finished) return 0;
  if (state.eventHistory.length === 0) return null;
  const windowSeconds = Math.min(RATE_WINDOW_SECONDS, state.eventHistory.length);
  const sum = state.eventHistory.slice(-windowSeconds).reduce((s, n) => s + n, 0);
  return Math.round((sum / windowSeconds) * 10) / 10;
}
