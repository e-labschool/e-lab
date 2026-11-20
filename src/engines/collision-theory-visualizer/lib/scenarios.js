// Predict-first scenarios. Each one has a baseline set-up, ONE change, a question with choices, and the reasoning.
// The reveal does not just show text: measureScenario() runs the SAME engine twice (before / after the change, fixed
// seeds) and reports the measured INITIAL rates, so the answer is evidence from the model, not an assertion. The reaction
// is irreversible and reactants are used up, so the rate is measured over the first few seconds of a fresh vessel, while
// little has been consumed.
import { CollisionEngine, defaultParams, sanitizeParams } from "./collisionEngine.js";

export const CHOICES = [
  { id: "up-lot", label: "Increases a lot (more than 1.5 times)" },
  { id: "up-little", label: "Increases slightly" },
  { id: "same", label: "Stays about the same" },
  { id: "down", label: "Decreases" },
];

export const SCENARIOS = [
  {
    id: "temperature", title: "Raise the temperature", base: { system: "mixed", T: 350 }, change: { T: 450 }, changeText: "temperature from 350 K to 450 K",
    question: "What will happen to the rate of reaction if the temperature is raised from 350 K to 450 K?", correct: "up-lot",
    why: "Two effects add up: particles move faster, so collisions are more frequent, but mainly a much larger fraction of collisions has energy of at least Ea. The shaded area under the Maxwell–Boltzmann curve beyond Ea grows far faster than the collision frequency does.",
  },
  {
    id: "concentration", title: "Double the concentration", base: { system: "mixed", n: 20 }, change: { n: 40 }, changeText: "concentration (particles per reactant) from 20 to 40",
    question: "What will happen to the rate if the number of A and B particles in the same vessel is doubled?", correct: "up-lot",
    why: "More particles in the same volume means more frequent collisions. The fraction of collisions that is successful does not change (same temperature, same Ea), so the rate rises in proportion to the collision frequency. With both A and B doubled, collisions between A and B become about four times as frequent.",
  },
  {
    id: "surface", title: "Crush the solid", base: { system: "solid", piece: 0, n: 40, ea: 8 }, change: { piece: 4 }, changeText: "the same mass of solid from one lump to 36 small pieces",
    question: "The same mass of solid A is crushed into 36 small pieces. What happens to the rate?", correct: "up-lot",
    why: "Only particles of the solid at the surface can collide with B. Breaking the solid up exposes more surface for the same mass, so B collides with A sites more often. Ea and the temperature are unchanged, so the fraction of successful collisions is the same; the collision frequency rises.",
  },
  {
    id: "catalyst", title: "Add a catalyst", base: { system: "mixed" }, change: { catalyst: true }, changeText: "a catalyst (lower Ea)",
    question: "A catalyst provides an alternative pathway with a lower activation energy. What happens to the rate at the same temperature?", correct: "up-lot",
    why: "The catalyst does not change the collision frequency or the energy distribution. It moves Ea to the left, so a larger fraction of collisions has enough energy. The area under the curve beyond Ea increases.",
  },
  {
    id: "activation", title: "Raise Ea", base: { system: "mixed", ea: 10 }, change: { ea: 16 }, changeText: "activation energy from 10 to 16 kJ/mol",
    question: "A different reaction has a higher activation energy, same temperature and concentrations. What happens to the rate?", correct: "down",
    why: "The collision frequency is the same, but fewer collisions have energy of at least Ea (the shaded area is smaller), so fewer collisions are successful and the rate decreases.",
  },
  {
    id: "orientation", title: "Narrow the reactive site", base: { system: "mixed", site: 360 }, change: { site: 120 }, changeText: "reactive site from any orientation to 120° wide",
    question: "Each particle can only react through a small reactive site. If the site is made narrower, what happens to the rate?", correct: "down",
    why: "Even with enough energy, a collision only reacts if both reactive sites face each other. A narrower site means fewer collisions meet that condition, so fewer collisions are successful.",
  },
];

export function scenarioConfigs(sc) {
  const base = sanitizeParams({ ...defaultParams(), ...sc.base });
  const changed = sanitizeParams({ ...base, ...sc.change });
  return { base, changed };
}

export function classifyRatio(ratio) {
  if (ratio > 1.5) return "up-lot";
  if (ratio > 1.1) return "up-little";
  if (ratio >= 0.9) return "same";
  return "down";
}

/** Mean INITIAL rate: successful collisions per second over the first `duration` s of a fresh vessel, averaged over `reps`
 *  seeded runs. Pure and synchronous (a few ms per run). Short on purpose: later the reactants are used up and the rate falls. */
export function measureRate(params, { reps = 6, duration = 6, seed = 101 } = {}) {
  let total = 0;
  for (let r = 0; r < reps; r++) {
    const e = new CollisionEngine({ seed: seed + r, params });
    e.run(duration);
    total += e.succ / duration;
  }
  return total / reps;
}

export function measureScenario(sc, opts) {
  const { base, changed } = scenarioConfigs(sc);
  const before = measureRate(base, opts);
  const after = measureRate(changed, opts);
  const ratio = before > 0 ? after / before : after > 0 ? Infinity : 1;
  return { before, after, ratio, outcome: classifyRatio(ratio) };
}
