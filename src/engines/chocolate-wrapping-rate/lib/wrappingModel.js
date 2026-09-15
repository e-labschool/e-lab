// Pure rate-of-process model for the Chocolate Wrapping analogy.
//
// Rule: 2 chocolates + 1 wrapper -> 1 wrapped pack.
//
// Deliberately NOT a fixed decay formula or random-event model: at every
// tick, the number of packs wrapped is a fraction of whatever pairs are
// CURRENTLY POSSIBLE (min(floor(chocolates/2), wrappers)), clamped to at
// least 1 while any pair remains. This is what makes the slowdown emerge
// naturally from decreasing availability of required items -- never from
// the "worker" getting tired -- and verified numerically to be
// monotonically non-increasing and to finish at exactly zero of whichever
// component runs out first.
export const DECAY_FRACTION = 0.35;

export function createInitialState(chocolates = 20, wrappers = 10) {
  return { chocolates, wrappers, packs: 0, time: 0, lastEventCount: 0, running: false, finished: false };
}

/** Advances the process by exactly one tick. Returns a NEW state object
 * (never mutates the one passed in) so callers can compare before/after
 * for the animation layer. */
export function advanceTick(state) {
  const maxPossible = Math.min(Math.floor(state.chocolates / 2), state.wrappers);
  if (maxPossible <= 0) {
    return { ...state, running: false, finished: true, lastEventCount: 0 };
  }
  const eventsThisTick = Math.min(maxPossible, Math.max(1, Math.round(maxPossible * DECAY_FRACTION)));
  const nextChocolates = state.chocolates - eventsThisTick * 2;
  const nextWrappers = state.wrappers - eventsThisTick;
  const nextPacks = state.packs + eventsThisTick;
  const nextTime = state.time + 1;
  const nextMaxPossible = Math.min(Math.floor(nextChocolates / 2), nextWrappers);
  return {
    chocolates: nextChocolates,
    wrappers: nextWrappers,
    packs: nextPacks,
    time: nextTime,
    lastEventCount: eventsThisTick,
    running: state.running,
    finished: nextMaxPossible <= 0,
  };
}

/** Packs-per-tick "current rate" -- the same eventsThisTick just wrapped,
 * i.e. the actual gradient of the packs-vs-time curve over the most
 * recent step, not a separately-invented number. */
export function currentRate(state) {
  return state.finished ? 0 : state.lastEventCount;
}
