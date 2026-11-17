// Pure rate-of-process model for the Chocolate Wrapping analogy (no React, no timers).
//
// THE GAME: wrapping rule 1 is 1 chocolate + 1 wrapper -> 1 wrapped pack; rule 2 is 2 chocolates + 1 wrapper -> 1 pack.
// Each simulated second the worker wraps 35 % of the packs that could STILL be made (rounded, at least 1 while any can be
// made). So the output per second is large at first and falls as the supply of chocolates and wrappers runs down. That is
// the point of the analogy: the rate of a reaction falls as the reactants are used up (their concentration falls).
// It is a qualitative analogy: a real rate also depends on a rate constant and on the concentrations in a rate equation.
//
// TWO RATES (both exposed, and both read off the same per-second counts that draw the graph):
//   rate in the last second = packs wrapped in the most recent second = gradient of the last segment of "packs vs time"
//   average rate so far     = total packs / total time              = gradient of the line from the origin to now
export const DECAY_FRACTION = 0.35;
export const MIN_QUANTITY = 1;
export const MAX_QUANTITY = 200;

export const WRAPPING_RULES = {
  rule1: { id: "rule1", chocolatesPerEvent: 1, label: "1 Chocolate + 1 Wrapper → 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 20 },
  rule2: { id: "rule2", chocolatesPerEvent: 2, label: "2 Chocolates + 1 Wrapper → 1 Wrapped Pack", defaultChocolates: 20, defaultWrappers: 10 },
};

/** Whole packs that can still be made from the given supplies. */
export function packsPossible(chocolates, wrappers, perEvent) {
  return Math.max(0, Math.min(Math.floor(chocolates / perEvent), wrappers));
}

/**
 * Validate a quantity typed by the user. Any whole number from MIN_QUANTITY to MAX_QUANTITY is accepted. Returns
 * { value, notice }: `value` is what will be used, `notice` explains any change ("" when the input was used as typed).
 */
export function normaliseQuantity(raw, label = "quantity") {
  const n = typeof raw === "number" ? raw : Number(String(raw ?? "").trim().replace(",", "."));
  if (!Number.isFinite(n) || String(raw ?? "").trim() === "") return { value: null, notice: `Type a whole number from ${MIN_QUANTITY} to ${MAX_QUANTITY} for the ${label}.` };
  const r = Math.round(n);
  if (r < MIN_QUANTITY) return { value: MIN_QUANTITY, notice: `The ${label} must be at least ${MIN_QUANTITY}, so ${MIN_QUANTITY} was used.` };
  if (r > MAX_QUANTITY) return { value: MAX_QUANTITY, notice: `The ${label} can be at most ${MAX_QUANTITY} (the table only draws a sample of the pieces), so ${MAX_QUANTITY} was used.` };
  if (r !== n) return { value: r, notice: `The ${label} must be a whole number, so ${n} was rounded to ${r}.` };
  return { value: r, notice: "" };
}

/** Why a start is impossible with these supplies ("" when it is possible). */
export function startBlocker(rule, chocolates, wrappers) {
  if (packsPossible(chocolates, wrappers, rule.chocolatesPerEvent) > 0) return "";
  if (chocolates < rule.chocolatesPerEvent) return `This rule needs ${rule.chocolatesPerEvent} chocolates for each pack, so you need at least ${rule.chocolatesPerEvent} chocolates.`;
  return "You need at least 1 wrapper.";
}

export function createInitialState(chocolates, wrappers, perEvent = 1) {
  return { chocolates, wrappers, packs: 0, time: 0, finished: false, lastEvents: 0, maxPacks: packsPossible(chocolates, wrappers, perEvent) };
}

/** Advances by exactly one simulated second. Returns a NEW state; `lastEvents` = packs wrapped in this second. */
export function advanceTick(state, chocolatesPerEvent) {
  const maxPossible = packsPossible(state.chocolates, state.wrappers, chocolatesPerEvent);
  if (maxPossible <= 0) return { ...state, finished: true, lastEvents: 0 };
  const events = Math.min(maxPossible, Math.max(1, Math.round(maxPossible * DECAY_FRACTION)));
  const chocolates = state.chocolates - events * chocolatesPerEvent;
  const wrappers = state.wrappers - events;
  return {
    ...state, chocolates, wrappers, packs: state.packs + events, time: state.time + 1, lastEvents: events,
    finished: packsPossible(chocolates, wrappers, chocolatesPerEvent) <= 0,
  };
}

/** Packs wrapped during the most recent second (packs s^-1). Null before the first second. */
export function rateLastSecond(state) { return state.time > 0 ? state.lastEvents : null; }
/** Total packs divided by total time (packs s^-1). Null before the first second. */
export function rateAverage(state) { return state.time > 0 ? state.packs / state.time : null; }

/** A history row for the graphs. */
export function historyRow(state) { return { time: state.time, packs: state.packs, chocolates: state.chocolates, wrappers: state.wrappers, rate: state.lastEvents }; }

/** Run a whole game to the end. Returns the per-second rows (row 0 = start). Pure; used by the predict-then-reveal task. */
export function runToEnd(rule, chocolates, wrappers) {
  let s = createInitialState(chocolates, wrappers, rule.chocolatesPerEvent); const rows = [historyRow(s)];
  for (let i = 0; i < 1000 && !s.finished; i += 1) { s = advanceTick(s, rule.chocolatesPerEvent); rows.push(historyRow(s)); }
  return rows;
}

/** AK-58: predict-then-reveal tasks. Each answer is computed from the model, never typed in. */
export const PREDICT_TASKS = [
  { id: "double", question: "Start again with 40 chocolates and 40 wrappers instead of 20 and 20 (rule 1). Compared with 20 + 20, the rate in the first second will be...",
    run(rule1 = WRAPPING_RULES.rule1) { const a = runToEnd(rule1, 20, 20); const b = runToEnd(rule1, 40, 40); const ra = a[1].rate; const rb = b[1].rate;
      return { answer: rb > ra ? "higher" : rb < ra ? "lower" : "the same", text: `With 20 + 20 the first second wraps ${ra} packs (${ra} packs s⁻¹); with 40 + 40 it wraps ${rb} (${rb} packs s⁻¹). More reactant means a higher concentration, so a higher rate. The whole run takes ${a.length - 1} s and ${b.length - 1} s.` }; } },
  { id: "fall", question: "Start with 20 chocolates and 20 wrappers (rule 1). Compared with the first second, the rate in the fourth second will be...",
    run(rule1 = WRAPPING_RULES.rule1) { const a = runToEnd(rule1, 20, 20); const r1 = a[1].rate; const r4 = (a[4] ?? { rate: 0 }).rate;
      return { answer: r4 > r1 ? "higher" : r4 < r1 ? "lower" : "the same", text: `The first second wraps ${r1} packs and the fourth wraps ${r4}. The chocolates and wrappers are being used up, so their concentration falls and so does the rate, just as the rate of a reaction falls as the reactants are used up.` }; } },
];
