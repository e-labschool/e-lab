#!/usr/bin/env node
// Fits the valence-force-field constants of the small IR molecules (HCl, N2, H2O, CO2, CH4) so that the HARMONIC model reproduces the
// observed gas-phase fundamentals listed in ir/physics/molecules.js ("ref" wavenumbers).   node scripts/fit-ir-force-field.mjs
// Gauss-Newton with a finite-difference Jacobian. The printed constants are what ir/physics/forceConstants.js stores. The constants are
// EFFECTIVE (the fundamentals include anharmonicity), so they are not ab-initio force constants. Ethanol is not fitted here (see docs).
import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);
const { SMALL_DEFS } = await import("../src/engines/spectroscopy-studio/ir/physics/molecules.js");
const { computeNormalModes, modeGroups } = await import("../src/engines/spectroscopy-studio/ir/physics/normalModes.js");

const FREE = { hcl: ["r"], n2: ["r"], h2o: ["r", "rr", "a"], co2: ["r", "rr", "a"], ch4: ["r", "rr", "a", "aa"] };
const model = (def, p) => modeGroups(computeNormalModes(def, p)).map((g) => g.wavenumber);
const solve = (A, b) => { const n = b.length; const M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i += 1) { let p = i; for (let k = i + 1; k < n; k += 1) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k += 1) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j += 1) M[k][j] -= f * M[i][j]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i -= 1) { let s = M[i][n]; for (let j = i + 1; j < n; j += 1) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x; };

for (const [id, names] of Object.entries(FREE)) {
  const def = SMALL_DEFS[id]; const target = def.ref.map((r) => r.wn); let p = { ...def.params };
  for (let it = 0; it < 60; it += 1) {
    const m0 = model(def, p); const res = m0.map((v, i) => v - target[i]);
    const J = m0.map(() => names.map(() => 0));
    names.forEach((nm, c) => { const q = { ...p }; const h = Math.max(1e-4, Math.abs(p[nm]) * 1e-4); q[nm] += h; const m1 = model(def, q); m1.forEach((v, r) => { J[r][c] = (v - m0[r]) / h; }); });
    const JT = names.map((_, c) => J.map((row) => row[c]));
    const A = names.map((_, i) => names.map((_, j) => JT[i].reduce((s, v, k) => s + v * JT[j][k], 0) + (i === j ? 1e-9 : 0)));
    const g = names.map((_, i) => JT[i].reduce((s, v, k) => s + v * res[k], 0));
    const dx = solve(A, g); names.forEach((nm, i) => { p[nm] -= dx[i]; });
    if (Math.max(...dx.map(Math.abs)) < 1e-10) break;
  }
  const m = model(def, p);
  console.log(`${id}: ${JSON.stringify(Object.fromEntries(Object.entries(p).map(([k, v]) => [k, Number(v.toPrecision(7))])))}  model ${m.map((v) => v.toFixed(1)).join(", ")}  target ${target.join(", ")}`);
}
