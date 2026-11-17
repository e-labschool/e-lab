// Challenge mode: plan a SEQUENCE of methods to recover every component of an unknown mixture.
// Each step is executed by the same run models as Explore (headless), so the result can never disagree with the simulation.
import { SUBSTANCES } from "./chem.js";
import { describePresence } from "./grade.js";
import { gramsOf, isEmpty, makeSample, part, totalMass, normalise } from "./mixtures.js";
import { runToEnd } from "./runs.js";

export const CHALLENGES = [
  {
    id: "sand-salt", name: "Sand and salt", level: "Starter",
    story: "A beaker holds two dry white-and-brown powders. Recover BOTH pure.",
    parts: [part("sand", "solid", 20), part("salt", "solid", 10)],
    targets: [{ sub: "sand", form: "solid" }, { sub: "salt", form: "solid" }],
    solution: ["dissolve", "filtration", "evaporation"],
    hints: ["Which of the two dissolves in water, and which does not?", "Once the salt is dissolved, which component is a solid you can filter off?", "How do you get a dissolved solid back out of the water?"],
    why: "Dissolve the salt (sand is insoluble), filter off the sand, then evaporate the filtrate to leave the salt.",
  },
  {
    id: "iron-sand-salt", name: "Iron, sand and salt", level: "Standard",
    story: "A spilled toolbox sample: iron filings, sand and salt, all mixed dry. Recover all three.",
    parts: [part("iron", "solid", 7), part("sand", "solid", 20), part("salt", "solid", 10)],
    targets: [{ sub: "iron", form: "solid" }, { sub: "sand", form: "solid" }, { sub: "salt", form: "solid" }],
    solution: ["magnetic", "dissolve", "filtration", "evaporation"],
    hints: ["One of the three is magnetic. Which method uses that?", "After the magnet, you have the same problem as sand and salt.", "Dissolve, then filter, then get the salt back from the water."],
    why: "Magnetic separation first (a dry, one-step job), then dissolve, filter and evaporate as for sand and salt.",
  },
  {
    id: "iodine-sand-salt", name: "Iodine, sand and salt", level: "Standard",
    story: "Dark crystals, sand and salt. One of them turns straight into vapour when warmed.",
    parts: [part("iodine", "solid", 5), part("sand", "solid", 20), part("salt", "solid", 10)],
    targets: [{ sub: "iodine", form: "solid" }, { sub: "sand", form: "solid" }, { sub: "salt", form: "solid" }],
    solution: ["sublimation", "dissolve", "filtration", "evaporation"],
    hints: ["Which component changes directly from solid to gas on gentle heating?", "Take that out first; what is left is sand and salt.", "Dissolve, filter, evaporate."],
    why: "Sublimation removes the iodine (do it first, while everything is dry); then dissolve, filter and evaporate.",
  },
  {
    id: "muddy-copper", name: "Muddy copper(II) sulfate", level: "Standard",
    story: "A blue solution with sand stirred into it. Recover the sand AND the copper(II) sulfate as crystals.",
    parts: [part("sand", "solid", 20), part("copperSulfate", "dissolved", 15), part("water", "liquid", 100)],
    targets: [{ sub: "sand", form: "solid" }, { sub: "copperSulfate", form: "solid" }],
    solution: ["filtration", "crystallisation"],
    hints: ["What can you remove while it is still a liquid?", "Which method gives good crystals when the solubility changes strongly with temperature?"],
    why: "Filter off the sand while the copper sulfate is dissolved, then crystallise the filtrate: copper sulfate is much more soluble hot than cold.",
  },
  {
    id: "oily-brine", name: "Oily salt water", level: "Standard",
    story: "A beaker of salt water with a layer of cooking oil. Recover the oil AND the salt.",
    parts: [part("oil", "liquid", 37), part("salt", "dissolved", 10), part("water", "liquid", 100)],
    targets: [{ sub: "oil", form: "liquid" }, { sub: "salt", form: "solid" }],
    solution: ["separating-funnel", "evaporation"],
    hints: ["The oil and the water do not mix. Which apparatus takes advantage of that?", "The salt is dissolved in the water layer. How do you recover it?"],
    why: "Run off the water layer (with the salt dissolved in it) with a separating funnel, then evaporate it to leave the salt.",
  },
  {
    id: "spirit-sand", name: "Sandy spirit", level: "Advanced",
    story: "A bottle of ethanol and water with sand at the bottom. Recover the sand, the ethanol and the water.",
    parts: [part("sand", "solid", 20), part("ethanol", "liquid", 40), part("water", "liquid", 60)],
    targets: [{ sub: "sand", form: "solid" }, { sub: "ethanol", form: "liquid", minPurity: 0.85 }, { sub: "water", form: "liquid" }],
    solution: ["filtration", "fractional-distillation"],
    hints: ["Remove the insoluble solid first, while it is simply a liquid mixture.", "Ethanol and water mix completely, so filtering will not help. What differs between them?", "Their boiling points are 78 and 100 °C: close enough to need a column."],
    why: "Filter off the sand, then fractionally distil the filtrate: ethanol (78 °C) comes over first, water (100 °C) after.",
  },
];

export const CHALLENGE_BY_ID = Object.fromEntries(CHALLENGES.map((c) => [c.id, c]));

let containerSeq = 0;
/** Start state for a challenge: one container holding the unknown mixture. */
export function startChallenge(ch) {
  containerSeq = 0;
  const sample = makeSample("Unknown mixture", ch.parts);
  return { containers: [{ id: `c${++containerSeq}`, label: "Unknown mixture", sample }], log: [], lostTotals: {}, original: sample };
}

/** Which targets are satisfied by the current containers? */
export function targetStatus(ch, state) {
  return ch.targets.map((t) => {
    const orig = gramsOf(state.original, t.sub);
    let best = null;
    for (const c of state.containers) {
      const pr = describePresence({ sample: c.sample }, t.sub);
      const need = t.minPurity ?? (t.form === "liquid" ? 0.985 : 0.95);
      if (pr.total > 1e-9 && pr.form === t.form && pr.purity >= need && pr.total / orig >= 0.6 && (!best || pr.purity > best.purity)) best = { container: c.id, purity: pr.purity };
    }
    return { ...t, done: !!best, container: best?.container ?? null, purity: best?.purity ?? 0 };
  });
}
export const isSolved = (ch, state) => targetStatus(ch, state).every((t) => t.done);

/** Apply `methodId` to container `containerId`; returns the new state (pure) and the step record. */
export function applyStep(ch, state, containerId, methodId, opts = {}) {
  const c = state.containers.find((x) => x.id === containerId);
  if (!c) return { state, step: null };
  const { result } = runToEnd(methodId, c.sample, opts);
  const before = JSON.stringify(normalise(c.sample).parts.map((p) => [p.sub, p.form, Math.round(p.g * 100)]).sort());
  const newContainers = result.outputs.filter((o) => !isEmpty(o.sample)).map((o) => ({ id: `c${++containerSeq}`, label: o.vessel, sample: { ...o.sample, label: o.vessel } }));
  const unchanged = newContainers.length === 1 && JSON.stringify(normalise(newContainers[0].sample).parts.map((p) => [p.sub, p.form, Math.round(p.g * 100)]).sort()) === before;
  const wasted = unchanged || result.verdict === "fails" || result.verdict === "unsafe" || result.verdict === "reaction" || !newContainers.length;
  const lost = { ...state.lostTotals }; for (const l of result.lost) lost[l.sub] = (lost[l.sub] ?? 0) + l.g;
  const containers = [...state.containers.filter((x) => x.id !== containerId), ...(result.verdict === "unsafe" || result.verdict === "reaction" ? [] : newContainers)];
  // an unsafe / reaction step destroys the sample's separability: keep the products so the student sees the consequence
  const kept = result.verdict === "unsafe" || result.verdict === "reaction" ? [...state.containers.filter((x) => x.id !== containerId), ...newContainers] : containers;
  const step = { method: methodId, container: containerId, containerLabel: c.label, verdict: result.verdict, headline: result.headline, lines: result.lines, wasted, hazard: result.verdict === "unsafe" || result.verdict === "reaction" };
  return { state: { ...state, containers: kept, log: [...state.log, step], lostTotals: lost }, step, result };
}

/**
 * Score a finished or in-progress challenge (0-100).
 *   correctness 60: share of targets recovered
 *   efficiency  25: the model solution's length compared with the steps used (each extra step costs 8)
 *   no wasted steps 15: each step that changed nothing or failed costs 6 (an unsafe or reacting step costs 15)
 *   hints: each costs 5 (at most 3 count)
 */
export function scoreChallenge(ch, state, hintsUsed = 0) {
  const st = targetStatus(ch, state);
  const done = st.filter((t) => t.done).length;
  const correctness = Math.round((60 * done) / st.length);
  const steps = state.log.length; const opt = ch.solution.length;
  const efficiency = steps === 0 || done < st.length ? 0 : Math.max(0, 25 - Math.max(0, steps - opt) * 8);
  const wasted = state.log.filter((s) => s.wasted && !s.hazard).length; const haz = state.log.filter((s) => s.hazard).length;
  const tidy = done < st.length ? 0 : Math.max(0, 15 - wasted * 6 - haz * 15);
  const hintCost = Math.min(3, hintsUsed) * 5;
  const total = Math.max(0, correctness + efficiency + tidy - hintCost);
  return { total, correctness, efficiency, tidy, hintCost, wasted, hazards: haz, steps, optimal: opt, solved: done === st.length, done, of: st.length };
}

/** Amount of each substance still "in play" (for the bars on the workbench). */
export const containerMass = (c) => totalMass(c.sample);
export const subLabel = (id) => SUBSTANCES[id]?.name ?? id;
