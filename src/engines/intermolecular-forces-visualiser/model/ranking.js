// Boiling-point ranking task (predict first, then reveal with reasons) and the alkane homologous series. Pure data + scoring (no React).
// Boiling points are at 1 atm, rounded to the nearest degree Celsius.  VERIFIED against a published alkane data table (Potsdam
// "Physical properties of alkanes": methane -161.6 ... octane 125.5, pentane isomers 36.1 / 27.9 / 9.4).  The other sets (halogens, noble
// gases, hydrogen halides, period-2 hydrides, propane / ethanal / ethanol) are standard textbook values that were NOT re-checked online here.
// Every set is chosen so that ONE idea decides the order, and the reason text names that idea in IB terms.

export const FORCE_TAGS = { ldf: "London dispersion", dd: "dipole-dipole", hb: "hydrogen bonding" };

/** items: formula (plain, rendered by `sub`), name, bp (deg C), forces (tags in play), why (one sentence, shown after reveal). */
export const RANK_SETS = [
  { id: "halogens", title: "Halogens", idea: "More electrons, more polarisable cloud, stronger London dispersion.", level: "sl",
    items: [
      { id: "F2", label: "F₂", name: "fluorine", bp: -188, forces: ["ldf"], why: "Fewest electrons (18): the smallest, least polarisable cloud, so the weakest London dispersion forces." },
      { id: "Cl2", label: "Cl₂", name: "chlorine", bp: -34, forces: ["ldf"], why: "34 electrons: stronger London dispersion than F₂, weaker than Br₂." },
      { id: "Br2", label: "Br₂", name: "bromine", bp: 59, forces: ["ldf"], why: "70 electrons: stronger London dispersion than Cl₂ (a liquid at room temperature)." },
      { id: "I2", label: "I₂", name: "iodine", bp: 184, forces: ["ldf"], why: "106 electrons: the largest, most polarisable cloud, so the strongest London dispersion forces (a solid at room temperature)." },
    ] },
  { id: "noble", title: "Noble gases", idea: "All are single atoms: only London dispersion, which grows with the number of electrons.", level: "sl",
    items: [
      { id: "Ne", label: "Ne", name: "neon", bp: -246, forces: ["ldf"], why: "10 electrons: the weakest London dispersion." },
      { id: "Ar", label: "Ar", name: "argon", bp: -186, forces: ["ldf"], why: "18 electrons: stronger dispersion than neon." },
      { id: "Kr", label: "Kr", name: "krypton", bp: -153, forces: ["ldf"], why: "36 electrons: stronger dispersion than argon, weaker than xenon." },
      { id: "Xe", label: "Xe", name: "xenon", bp: -108, forces: ["ldf"], why: "54 electrons: the largest cloud, the strongest dispersion of the four." },
    ] },
  { id: "alkanes", title: "Alkanes (unbranched)", idea: "Same type of force; a longer chain has more electrons and more surface contact, so stronger London dispersion.", level: "sl",
    items: [
      { id: "CH4", label: "CH₄", name: "methane", bp: -162, forces: ["ldf"], why: "10 electrons and the smallest surface: the weakest dispersion forces." },
      { id: "C2H6", label: "C₂H₆", name: "ethane", bp: -89, forces: ["ldf"], why: "18 electrons: stronger dispersion than methane." },
      { id: "C3H8", label: "C₃H₈", name: "propane", bp: -42, forces: ["ldf"], why: "26 electrons: stronger dispersion than ethane." },
      { id: "C4H10", label: "C₄H₁₀", name: "butane", bp: -1, forces: ["ldf"], why: "34 electrons: boils at about 0 °C." },
      { id: "C5H12", label: "C₅H₁₂", name: "pentane", bp: 36, forces: ["ldf"], why: "42 electrons: a liquid at room temperature." },
      { id: "C6H14", label: "C₆H₁₄", name: "hexane", bp: 69, forces: ["ldf"], why: "50 electrons: the longest chain here, so the strongest dispersion." },
    ] },
  { id: "pentanes", title: "Isomers of C₅H₁₂", idea: "Same formula and same electrons: a more compact (branched) molecule touches its neighbours less, so weaker London dispersion.", level: "hl",
    items: [
      { id: "neo", label: "2,2-dimethylpropane", name: "neopentane, almost spherical", bp: 9, forces: ["ldf"], why: "Almost spherical: the least surface contact with neighbours, so the weakest dispersion of the three." },
      { id: "iso", label: "2-methylbutane", name: "one branch", bp: 28, forces: ["ldf"], why: "One branch: less surface contact than the straight chain." },
      { id: "pen", label: "pentane", name: "straight chain", bp: 36, forces: ["ldf"], why: "Unbranched: the most surface contact, so the strongest dispersion." },
    ] },
  { id: "hydrogen-halides", title: "Hydrogen halides", idea: "HF is the exception: hydrogen bonding beats the dispersion trend of the others.", level: "sl",
    items: [
      { id: "HCl", label: "HCl", name: "hydrogen chloride", bp: -85, forces: ["dd", "ldf"], why: "Dipole-dipole plus the weakest dispersion of the three heavier halides (18 electrons)." },
      { id: "HBr", label: "HBr", name: "hydrogen bromide", bp: -67, forces: ["dd", "ldf"], why: "More electrons (36) than HCl, so stronger dispersion." },
      { id: "HI", label: "HI", name: "hydrogen iodide", bp: -35, forces: ["dd", "ldf"], why: "54 electrons: the strongest dispersion of HCl, HBr and HI." },
      { id: "HF", label: "HF", name: "hydrogen fluoride", bp: 20, forces: ["hb", "ldf"], why: "Only 10 electrons, yet it boils highest: H is bonded to the very electronegative F, so hydrogen bonds form between molecules." },
    ] },
  { id: "hydrides", title: "Hydrides of period 2", idea: "Hydrogen bonding needs H on N, O or F; water forms the most hydrogen bonds per molecule.", level: "sl",
    items: [
      { id: "CH4", label: "CH₄", name: "methane", bp: -162, forces: ["ldf"], why: "Non-polar and no H on N, O or F: only weak London dispersion." },
      { id: "NH3", label: "NH₃", name: "ammonia", bp: -33, forces: ["hb", "ldf"], why: "Hydrogen bonds, but one lone pair per N limits how many form." },
      { id: "HF", label: "HF", name: "hydrogen fluoride", bp: 20, forces: ["hb", "ldf"], why: "Strong hydrogen bonds, but each F has only one H to donate." },
      { id: "H2O", label: "H₂O", name: "water", bp: 100, forces: ["hb", "ldf"], why: "Two H to donate and two lone pairs to accept: the most extensive hydrogen bonding, so the highest boiling point." },
    ] },
  { id: "similar-mass", title: "Similar molar mass, different forces", idea: "With almost equal electrons, the type of force decides: London < dipole-dipole < hydrogen bonding.", level: "sl",
    items: [
      { id: "C3H8", label: "CH₃CH₂CH₃", name: "propane, M = 44", bp: -42, forces: ["ldf"], why: "Non-polar: London dispersion only." },
      { id: "ethanal", label: "CH₃CHO", name: "ethanal, M = 44", bp: 20, forces: ["dd", "ldf"], why: "Polar C=O: dipole-dipole forces as well as dispersion, but no H on O, so no hydrogen bonding." },
      { id: "ethanol", label: "CH₃CH₂OH", name: "ethanol, M = 46", bp: 78, forces: ["hb", "ldf"], why: "O-H allows hydrogen bonding between molecules: the strongest of the three." },
    ] },
];
export const RANK_SET_BY_ID = Object.fromEntries(RANK_SETS.map((s) => [s.id, s]));

/** Correct order, lowest boiling point first. */
export const correctOrder = (setId) => [...RANK_SET_BY_ID[setId].items].sort((a, b) => a.bp - b.bp).map((i) => i.id);

/** Deterministic shuffle (never returns the correct order) so the same round always starts the same way. */
export function shuffledOrder(setId, seed = 1) {
  const ids = RANK_SET_BY_ID[setId].items.map((i) => i.id); const good = correctOrder(setId).join();
  let s = seed >>> 0 || 1; const rnd = () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  for (let tries = 0; tries < 50; tries += 1) { const a = [...ids]; for (let i = a.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } if (a.join() !== good) return a; }
  return [...ids].reverse();
}

/** Score a predicted order (array of item ids, lowest first). Marks: one per item in the right place; `perfect` when all are. */
export function scoreRanking(setId, order) {
  const right = correctOrder(setId); const n = right.length;
  if (!Array.isArray(order) || order.length !== n || new Set(order).size !== n || order.some((id) => !right.includes(id))) return { valid: false, correct: 0, total: n, perfect: false, places: [] };
  const places = order.map((id, i) => ({ id, placed: i, actual: right.indexOf(id), ok: right.indexOf(id) === i }));
  const correct = places.filter((p) => p.ok).length;
  return { valid: true, correct, total: n, perfect: correct === n, places };
}

/** Move the item at `from` to `to` (used by the up / down buttons and the keyboard). */
export function moveItem(order, from, to) {
  if (from < 0 || from >= order.length) return order; const t = Math.max(0, Math.min(order.length - 1, to)); if (t === from) return order;
  const a = [...order]; const [x] = a.splice(from, 1); a.splice(t, 0, x); return a;
}

// ---- homologous series: alkanes CnH2n+2 ------------------------------------------------------------------------------------------------
const ALKANE_NAMES = ["", "methane", "ethane", "propane", "butane", "pentane", "hexane", "heptane", "octane"];
const ALKANE_BP = [null, -162, -89, -42, -1, 36, 69, 98, 126]; // deg C, verified (see header)
export const ALKANE_MAX = 8;
export const alkaneFormula = (n) => (n === 1 ? "CH4" : `C${n}H${2 * n + 2}`);
/** Electrons in CnH2n+2: 6 per C + 1 per H.  The size proxy used in the explanation (more electrons: a more polarisable cloud). */
export const alkaneElectrons = (n) => 6 * n + 2 * n + 2;
export const alkaneMolarMass = (n) => Math.round((12.011 * n + 1.008 * (2 * n + 2)) * 10) / 10;
export const alkaneSeries = () => Array.from({ length: ALKANE_MAX }, (_, i) => { const n = i + 1; return { n, formula: alkaneFormula(n), name: ALKANE_NAMES[n], electrons: alkaneElectrons(n), M: alkaneMolarMass(n), bp: ALKANE_BP[n], phase: ALKANE_BP[n] > 25 ? "liquid" : "gas" }; });
/** Sentence for the chosen chain length. */
export function alkaneExplanation(n) {
  const s = alkaneSeries()[n - 1]; const prev = n > 1 ? alkaneSeries()[n - 2] : null;
  const base = `${s.name} (${s.formula}) has ${s.electrons} electrons and boils at ${s.bp} °C (${s.phase} at room temperature).`;
  return prev ? `${base} Adding one CH₂ adds 8 electrons: a larger, more polarisable cloud and more surface contact, so stronger London dispersion forces and a boiling point ${s.bp - prev.bp} °C higher than ${prev.name}.` : `${base} The smallest alkane has the weakest London dispersion forces of the series.`;
}
