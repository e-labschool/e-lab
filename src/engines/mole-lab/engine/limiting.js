// Module 10 -- LIMITING REAGENT by the reaction EXTENT method (spec D Stage 6).
//   for each reactant:  available moles / stoichiometric coefficient   ->  the SMALLEST value is the maximum extent xi.
//   consumed_i = nu_i xi,  remaining_i = available_i - nu_i xi,  produced_j = nu_j xi.
// Integer quanta throughout: xi is floored to a whole quantum, so consumption never exceeds availability and a leftover can
// never be negative.  Reactants whose ratio ties with the minimum (within one quantum) are ALL reported as limiting.
import { reactants, products, getReaction } from "./reactions.js";
import { fromQuanta, toQuanta, clean, MAX_AMOUNT_QUANTA } from "./numeric.js";
import { molesFromMass, massFromMoles } from "./moles.js";
import { molarMass } from "./substances.js";

/**
 * @param reaction  reaction record or id
 * @param availableQ { substanceId: integer quanta } for the reactants (missing = 0)
 */
export function limitingReagent(reaction, availableQ) {
  const r = typeof reaction === "string" ? getReaction(reaction) : reaction;
  const rs = reactants(r);
  for (const s of rs) { const q = availableQ[s.id] ?? 0; if (!Number.isInteger(q) || q < 0 || q > MAX_AMOUNT_QUANTA) throw new Error(`limitingReagent: invalid amount for ${s.id}`); }
  const ratios = rs.map((s) => (availableQ[s.id] ?? 0) / s.coeff);
  const minRatio = Math.min(...ratios);
  const extentQ = Math.floor(minRatio); // whole quanta, never rounding up
  const perReactant = rs.map((s, i) => {
    const available = availableQ[s.id] ?? 0; const consumedQ = s.coeff * extentQ; const remainingQ = available - consumedQ;
    const limiting = ratios[i] - extentQ < 1; // ties (within one quantum) are all limiting
    return {
      id: s.id, coeff: s.coeff, availableQ: available, ratioQ: ratios[i], ratioMol: clean(ratios[i] / 1e9), consumedQ, remainingQ,
      available: fromQuanta(available), consumed: fromQuanta(consumedQ), remaining: fromQuanta(remainingQ), limiting, excess: !limiting && remainingQ > 0,
    };
  });
  const prods = products(r).map((s) => ({ id: s.id, coeff: s.coeff, producedQ: s.coeff * extentQ, produced: fromQuanta(s.coeff * extentQ) }));
  const limitingIds = perReactant.filter((p) => p.limiting).map((p) => p.id);
  return {
    reactionId: r.id, extentQ, extent: fromQuanta(extentQ), perReactant, products: prods, limiting: limitingIds,
    tied: limitingIds.length > 1, stoichiometric: limitingIds.length === rs.length, noReaction: extentQ === 0,
    reason: extentQ === 0 ? "A reactant is absent, so no reaction can occur." : null,
  };
}

/** Same calculation from reactant MASSES (g) under an explicit molar-mass policy. */
export function limitingFromMasses(reaction, massesG, policy = "booklet") {
  const r = typeof reaction === "string" ? getReaction(reaction) : reaction;
  const availableQ = {}; const working = [];
  for (const s of reactants(r)) {
    const m = massesG[s.id] ?? 0; const M = molarMass(s.id, policy);
    const res = molesFromMass(m, M);
    if (!res.ok) return { ok: false, error: `${s.id}: ${res.error}` };
    availableQ[s.id] = res.nQ; working.push({ id: s.id, massG: m, M, n: res.n });
  }
  return { ok: true, working, result: limitingReagent(r, availableQ), policy };
}
/** Theoretical mass of one product (g) from a limiting result. */
export function theoreticalYieldMass(result, productId, policy = "booklet") {
  const p = result.products.find((x) => x.id === productId);
  if (!p) return { ok: false, error: `${productId} is not a product of this reaction.` };
  return massFromMoles(p.produced, molarMass(productId, policy));
}
/** OPTIONAL extension: percentage yield = actual / theoretical x 100.  The actual yield must be SUPPLIED; it is never assumed. */
export function percentYield(actualG, theoreticalG) {
  if (actualG == null || !Number.isFinite(actualG)) return { ok: false, error: "Enter the actual yield (g); it is never assumed." };
  if (actualG < 0) return { ok: false, error: "Actual yield cannot be negative." };
  if (!(theoreticalG > 0)) return { ok: false, error: "The theoretical yield is zero, so a percentage yield is not defined." };
  const pct = clean((actualG / theoreticalG) * 100);
  return { ok: true, percent: pct, warning: pct > 100 ? "More than 100 % usually means the product is impure or wet, or a measurement error." : null };
}
export { toQuanta };
