// Heat & Phase Change energy model (pure, no React / three).
//
// A SIMPLIFIED constant-pressure (1 atm) heating model for ONE mole-equivalent of a pure substance, no heat loss:
//   solid  : dE = Cs dT          (T0 -> Tm)
//   melting: dE at T = Tm        (latent heat, dHfus)
//   liquid : dE = Cl dT          (Tm -> Tb)
//   boiling: dE at T = Tb        (latent heat, dHvap)
//   gas    : dE = Cg dT          (Tb -> Tmax)
// Energy E is "energy added per mole (kJ/mol)". Temperature is a function of E only, so it rises monotonically with E and has
// exact plateaus at Tm and Tb. Heat capacities are rough constant, rounded literature values (they actually vary with T) and
// are labelled simplified in the UI. Melting and boiling points and enthalpies are literature values at 1 atm.
//
// CO2 is deliberately NOT offered: at 1 atm it has no liquid phase and sublimes (solid -> gas at 194.7 K); a heating curve with a
// liquid plateau would be wrong at atmospheric pressure. I2 does sublime readily below its melting point at room pressure; the
// values below are for the triple-point-like melting at 386.9 K and boiling at 457.6 K and the UI says so.
export const SUBSTANCES = {
  H2O: { id: "H2O", label: "H₂O", name: "Water", mol: "H2O", kind: "molecular", Tm: 273.15, Tb: 373.15, dHfus: 6.01, dHvap: 40.65, cs: 38, cl: 75.3, cg: 33.6, nn: 2.75, arrangement: "ice", note: "Solid drawn as an open, hydrogen-bonded network (proton-disordered ice Ic-type; ordinary ice is Ih). Simplified." },
  NH3: { id: "NH3", label: "NH₃", name: "Ammonia", mol: "NH3", kind: "molecular", Tm: 195.4, Tb: 239.8, dHfus: 5.66, dHvap: 23.35, cs: 50, cl: 80.8, cg: 35.1, nn: 3.4, arrangement: "fcc", orient: "updown", note: "Solid drawn as a simplified close-packed arrangement (real solid NH₃ is cubic P2₁3 with N–H···N hydrogen bonds)." },
  HCl: { id: "HCl", label: "HCl", name: "Hydrogen chloride", mol: "HCl", kind: "molecular", Tm: 158.9, Tb: 188.1, dHfus: 1.99, dHvap: 16.15, cs: 46, cl: 60, cg: 29.1, nn: 3.7, arrangement: "fcc", orient: "chains", note: "Solid drawn as a simplified close-packed arrangement with head-to-tail dipole rows." },
  CH4: { id: "CH4", label: "CH₄", name: "Methane", mol: "CH4", kind: "molecular", Tm: 90.7, Tb: 111.7, dHfus: 0.94, dHvap: 8.2, cs: 38, cl: 54, cg: 35.7, nn: 4.1, arrangement: "fcc", orient: "random", note: "Solid drawn as close-packed with random orientations (solid CH₄ I is an orientationally disordered fcc crystal). Simplified." },
  I2: { id: "I2", label: "I₂", name: "Iodine", mol: "I2", kind: "molecular", Tm: 386.9, Tb: 457.6, dHfus: 15.52, dHvap: 41.57, cs: 54.4, cl: 80.7, cg: 36.9, nn: 4.4, arrangement: "fcc", orient: "herringbone", note: "Real I₂ sublimes readily below its melting point at room pressure and forms a layered orthorhombic crystal; here it is modelled as melting at 386.9 K and boiling at 457.6 K (1 atm values) with a simplified herringbone arrangement." },
  Ar: { id: "Ar", label: "Ar", name: "Argon", mol: "Ar", kind: "molecular", Tm: 83.8, Tb: 87.3, dHfus: 1.18, dHvap: 6.43, cs: 33.6, cl: 44, cg: 20.8, nn: 3.76, arrangement: "fcc", orient: "none", note: "Solid argon is face-centred cubic (close-packed), as drawn." },
  NaCl: { id: "NaCl", label: "NaCl", name: "Sodium chloride (ionic)", mol: null, kind: "ionic", Tm: 1074, Tb: 1686, dHfus: 28.2, dHvap: 170, cs: 50.5, cl: 66.9, cg: 36.5, nn: 2.82, arrangement: "rocksalt", note: "Ionic compound: an extended Na⁺/Cl⁻ lattice, not molecules. Heat capacities simplified; the vapour is mostly Na⁺Cl⁻ ion pairs." },
};
export const MOLECULAR_SUBSTANCES = ["H2O", "NH3", "HCl", "CH4", "I2", "Ar"];
export const CO2_NOTE = "CO₂ is not offered: at 1 atm carbon dioxide has no liquid phase – it sublimes (solid → gas) at 194.7 K – so a melting/boiling heating curve would be wrong at atmospheric pressure.";
export const PHASES = ["solid", "melting", "liquid", "boiling", "gas"];
export const PHASE_LABEL = { solid: "Solid", melting: "Melting (solid + liquid)", liquid: "Liquid", boiling: "Boiling (liquid + gas)", gas: "Gas" };

/** Start and end temperature of the simulated range: 25 % of Tm below the melting point, 12 % of Tb above the boiling point. */
export const startTemperature = (s) => Math.round(s.Tm * 0.75 * 10) / 10;
export const endTemperature = (s) => Math.round(s.Tb * 1.12 * 10) / 10;

/** Ordered segments of the heating curve: { phase, E0, E1 (kJ/mol), T0, T1 }. */
export function curveSegments(s) {
  const T0 = startTemperature(s); const T3 = endTemperature(s);
  const e1 = (s.cs * (s.Tm - T0)) / 1000; const e2 = e1 + s.dHfus; const e3 = e2 + (s.cl * (s.Tb - s.Tm)) / 1000; const e4 = e3 + s.dHvap; const e5 = e4 + (s.cg * (T3 - s.Tb)) / 1000;
  return [
    { phase: "solid", E0: 0, E1: e1, T0, T1: s.Tm },
    { phase: "melting", E0: e1, E1: e2, T0: s.Tm, T1: s.Tm },
    { phase: "liquid", E0: e2, E1: e3, T0: s.Tm, T1: s.Tb },
    { phase: "boiling", E0: e3, E1: e4, T0: s.Tb, T1: s.Tb },
    { phase: "gas", E0: e4, E1: e5, T0: s.Tb, T1: T3 },
  ];
}
export const totalEnergy = (s) => curveSegments(s)[4].E1;

/** State at energy E (clamped to the range): { E, T, phase, melt (0..1 of the fusion plateau), vap (0..1 of the vaporisation plateau), segIndex }. */
export function stateAtEnergy(s, E) {
  const segs = curveSegments(s); const total = segs[4].E1; const e = Math.min(total, Math.max(0, E));
  let k = segs.findIndex((g) => e < g.E1); if (k < 0) k = 4;
  const g = segs[k]; const f = g.E1 > g.E0 ? (e - g.E0) / (g.E1 - g.E0) : 0;
  const plateau = g.phase === "melting" || g.phase === "boiling";
  const T = plateau ? g.T0 : g.T0 + (g.T1 - g.T0) * f;
  const melt = k === 0 ? 0 : k === 1 ? f : 1; const vap = k < 3 ? 0 : k === 3 ? f : 1;
  return { E: e, T, phase: g.phase, melt, vap, segIndex: k, frac: f };
}
/** Points of the whole curve for plotting. */
export function curvePoints(s) { const segs = curveSegments(s); const pts = [[0, segs[0].T0]]; for (const g of segs) pts.push([g.E1, g.T1]); return pts; }

/**
 * Display-speed model: energy is added at a rate that makes every stage last a few seconds (the graph's x axis is ENERGY, not time).
 * Returns dE/dt in kJ/mol per second at speed 1, positive = heating.
 */
export function energyRate(s, E, speed = 1, stageSeconds = { heat: 5, plateau: 7 }) {
  const segs = curveSegments(s); const st = stateAtEnergy(s, E); const g = segs[st.segIndex];
  const plateau = g.phase === "melting" || g.phase === "boiling";
  return ((g.E1 - g.E0) / (plateau ? stageSeconds.plateau : stageSeconds.heat)) * speed;
}
/** Advance E by dt seconds in direction dir (+1 heat, -1 cool) with the display-speed model; sub-stepped so a stage boundary is never skipped. */
export function advanceEnergy(s, E, dt, dir = 1, speed = 1) {
  let e = E; let remaining = dt; const total = totalEnergy(s);
  for (let guard = 0; guard < 40 && remaining > 1e-9; guard += 1) {
    const segs = curveSegments(s); const st = stateAtEnergy(s, dir > 0 ? Math.min(e + 1e-9, total) : Math.max(e - 1e-9, 0)); const g = segs[st.segIndex];
    const plateau = g.phase === "melting" || g.phase === "boiling"; const rate = ((g.E1 - g.E0) / (plateau ? 7 : 5)) * speed;
    const edge = dir > 0 ? g.E1 : g.E0; const timeToEdge = Math.abs(edge - e) / rate;
    const step = Math.min(remaining, Math.max(timeToEdge, 1e-6));
    e += dir * rate * step; remaining -= step;
    if (e >= total) { e = total; break; } if (e <= 0) { e = 0; break; }
  }
  return e;
}
