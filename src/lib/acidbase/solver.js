// Exact charge-balance solver for aqueous acid-base mixtures at 298 K (pure, no React).
//
//   [H+] + strongCations + sum_b c_b * [H+]/([H+]+Ka_b)  =  [OH-] + strongAnions + sum_a c_a * Ka_a/(Ka_a+[H+])
//
// strongCations / strongAnions: concentrations (mol dm-3) of fully ionised spectator ions (Na+, Cl- ...).
// weakAcids  [{ c, pKa }]: total concentration of HA + A-; the acid form is neutral (CH3COOH/CH3COO-).
// weakBases  [{ c, pKa }]: total concentration of B + BH+; pKa is that of the CONJUGATE ACID BH+ (NH4+ = 9.25).
// The residual is strictly increasing in [H+], so a bisection in log10[H+] always finds the one root.
// Ideal behaviour is assumed (activities = concentrations), so very concentrated solutions are only approximate;
// pH below 0 or above 14 is returned as calculated, and the UI says that real meters read differently there.
import { KW } from "./constants.js";

/** Mean negative charge per molecule of an n-protic acid H_nA at [H+] = H (pKas = [pKa1, pKa2, ...]) and the species fractions alpha_0..alpha_n. */
export function polyproticFractions(H, pKas) {
  const n = pKas.length; const terms = [Math.pow(H, n)];
  let k = 1;
  for (let i = 1; i <= n; i += 1) { k *= Math.pow(10, -pKas[i - 1]); terms.push(k * Math.pow(H, n - i)); }
  const sum = terms.reduce((a, b) => a + b, 0);
  const alpha = terms.map((t) => t / sum);
  return { alpha, charge: alpha.reduce((a, x, i) => a + i * x, 0) };
}

export function residual(H, sol) {
  const { strongCations = 0, strongAnions = 0, weakAcids = [], weakBases = [], polyAcids = [], kw = KW } = sol;
  let positive = H + strongCations;
  let negative = kw / H + strongAnions;
  for (const a of polyAcids) negative += a.c * polyproticFractions(H, a.pKas).charge;
  for (const a of weakAcids) { const Ka = Math.pow(10, -a.pKa); negative += a.c * (Ka / (Ka + H)); }
  for (const b of weakBases) { const Ka = Math.pow(10, -b.pKa); positive += b.c * (H / (H + Ka)); }
  return positive - negative;
}

export function solveSolution(sol) {
  let lo = -17.5; // log10 [H+]
  let hi = 2.5;
  for (let i = 0; i < 200 && hi - lo > 1e-13; i += 1) {
    const mid = (lo + hi) / 2;
    if (residual(Math.pow(10, mid), sol) > 0) hi = mid; else lo = mid;
  }
  const logH = (lo + hi) / 2;
  const H = Math.pow(10, logH);
  const kw = sol.kw ?? KW;
  const OH = kw / H;
  const species = (sol.weakAcids || []).map((a) => { const Ka = Math.pow(10, -a.pKa); return { type: "acid", c: a.c, pKa: a.pKa, ionised: Ka / (Ka + H) }; })
    .concat((sol.polyAcids || []).map((a) => ({ type: "poly", c: a.c, pKas: a.pKas, alpha: polyproticFractions(H, a.pKas).alpha })))
    .concat((sol.weakBases || []).map((b) => { const Ka = Math.pow(10, -b.pKa); return { type: "base", c: b.c, pKa: b.pKa, protonated: H / (H + Ka) }; }));
  return { H, OH, pH: -logH, pOH: -Math.log10(kw) + logH, species };
}

/** pH of a strong acid (c > 0) or strong base (c < 0 means base) solution, including water autoionisation. */
export function strongPH(signedConcentration) {
  const c = signedConcentration;
  return solveSolution(c >= 0 ? { strongAnions: c } : { strongCations: -c }).pH;
}
