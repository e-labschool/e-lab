// Generic grading of a separation outcome: which original components ended up (nearly) pure in some container?
// Pure helpers; used by the run models, the Challenge and the Quiz so they cannot disagree.
import { SUBSTANCES } from "./chem.js";
import { gramsOf, subsIn, totalMass } from "./mixtures.js";

export const PURITY_SOLID = 0.95; // dry-basis purity needed to call a solid "pure"
export const PURITY_LIQUID = 0.985; // mass purity needed to call a liquid "pure" (undissolved solids and solutes count as impurity)
export const MIN_YIELD = 0.6; // fraction of the original mass that must be in that container

/** How `sub` sits in one output: its grams by form and its purity. */
export function describePresence(output, sub) {
  const s = output.sample ?? output;
  const g = { solid: 0, liquid: 0, dissolved: 0 };
  let solidsAndSolutes = 0; let everything = 0;
  for (const p of s.parts) {
    everything += p.g;
    if (p.form !== "liquid") solidsAndSolutes += p.g;
    if (p.sub === sub) g[p.form] += p.g;
  }
  const total = g.solid + g.liquid + g.dissolved;
  if (total <= 1e-9) return { total: 0, form: null, purity: 0, g };
  // the dominant form decides whether the substance is "a solid we have", "a liquid we have" or "still dissolved"
  const form = g.liquid >= g.solid && g.liquid >= g.dissolved ? "liquid" : g.solid >= g.dissolved ? "solid" : "dissolved";
  const purity = form === "liquid" ? g.liquid / everything : (g.solid + g.dissolved) / Math.max(1e-9, solidsAndSolutes);
  return { total, form, purity, g };
}

/**
 * Best container for each original component.
 * returns { [sub]: { output: id, form, purity, yield } | null }  (null = not obtained pure and in bulk)
 */
export function recoveredMap(original, outputs) {
  const map = {};
  for (const sub of subsIn(original)) {
    const orig = gramsOf(original, sub); let best = null;
    for (const out of outputs) {
      const pr = describePresence(out, sub);
      if (pr.total <= 1e-9 || pr.form === "dissolved") continue;
      const need = pr.form === "liquid" ? PURITY_LIQUID : PURITY_SOLID;
      const yld = pr.total / orig;
      if (pr.purity >= need && yld >= MIN_YIELD && (!best || pr.purity * yld > best.purity * best.yield)) best = { output: out.id, form: pr.form, purity: pr.purity, yield: Math.min(1, yld) };
    }
    map[sub] = best;
  }
  return map;
}

/** works: every component is recovered or removed to the air; partial: some; fails: none. */
export function gradeOutcome(original, outputs, lost = []) {
  const rec = recoveredMap(original, outputs);
  const subs = Object.keys(rec);
  const lostSubs = new Set(lost.filter((l) => l.g > 0.05 * gramsOf(original, l.sub)).map((l) => l.sub));
  const done = subs.filter((s) => rec[s] || lostSubs.has(s));
  const verdict = done.length === subs.length ? "works" : done.length === 0 ? "fails" : "partial";
  // a single-component sample (e.g. pure water out of a flask) is not a "separation" unless something was taken away
  return { recovered: rec, verdict, lostSubs: [...lostSubs] };
}

/** Is the mass balance closed? (outputs + lost vs original); used by tests. */
export function massBalance(original, outputs, lost = []) {
  return totalMass(original) - outputs.reduce((a, o) => a + totalMass(o.sample), 0) - lost.reduce((a, l) => a + l.g, 0);
}

export const solidFormG = (output, sub) => describePresence(output, sub).g.solid;
export const isMagnetic = (sub) => !!SUBSTANCES[sub]?.magnetic;
