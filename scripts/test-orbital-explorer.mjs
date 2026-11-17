// Orbital Explorer pure logic: radial probability distribution (OE-06) against known hydrogen values.
import assert from "node:assert/strict";
import * as R from "../src/engines/orbital-explorer/lib/radial.js";
import { ORBITAL_DEFS } from "../src/engines/orbital-explorer/lib/orbitalMath.js";
import { occupiedOrbitals, fillSublevels, formatConfiguration, energyOrderRows, MAX_ATOM_VIEW_Z } from "../src/engines/orbital-explorer/lib/electronConfigurations.js";
import { BASE_ORBITALS, ORIENTATIONS } from "../src/engines/orbital-explorer/lib/orbitalDefinitions.js";
import { colorForOrbitalId } from "../src/engines/orbital-explorer/lib/orbitalColors.js";
import { pointsForCount } from "../src/engines/orbital-explorer/lib/qualityTier.js";
import { cloudFor, hasCloud, clearCloudCache } from "../src/engines/orbital-explorer/lib/cloudCache.js";
import { boundingRadiusFor } from "../src/engines/orbital-explorer/lib/orbitalSampling.js";
import { neutralOccupancy } from "../src/lib/atomic/index.js";
let n = 0; const t = (name, fn) => { fn(); n++; console.log("ok -", name); };
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
t("P(r) integrates to 1 for every orbital offered", () => { for (const d of Object.values(ORBITAL_DEFS)) close(R.integrate(R.radialCurve(d.n, d.l, 140, 14000)), 1, 2e-3, `${d.n},${d.l}`); });
t("1s most probable radius is the Bohr radius (1 a0), no nodes", () => { const f = R.radialFeatures(1, 0); assert.equal(f.peaks.length, 1); close(f.peaks[0].r, 1, 0.01, "1s"); assert.equal(f.nodes.length, 0); });
t("2s: peaks 0.76 and 5.24 a0, node at 2 a0", () => { const f = R.radialFeatures(2, 0); close(f.peaks[0].r, 0.764, 0.02, "p1"); close(f.peaks[1].r, 5.236, 0.02, "p2"); assert.equal(f.nodes.length, 1); close(f.nodes[0].r, 2, 0.001, "node"); });
t("2p peak 4 a0; 3d peak 9 a0 (n^2 for l = n-1)", () => { close(R.radialFeatures(2, 1).peaks[0].r, 4, 0.01, "2p"); close(R.radialFeatures(3, 2).peaks[0].r, 9, 0.01, "3d"); });
t("3s nodes 1.90 and 7.10 a0; 3p node 6 a0; radial nodes = n - l - 1 for all", () => { const s = R.radialFeatures(3, 0); close(s.nodes[0].r, 1.9, 0.01, "3s a"); close(s.nodes[1].r, 7.1, 0.01, "3s b"); close(R.radialFeatures(3, 1).nodes[0].r, 6, 0.001, "3p"); for (const d of Object.values(ORBITAL_DEFS)) assert.equal(R.radialFeatures(d.n, d.l).nodes.length, d.n - d.l - 1, `${d.n},${d.l}`); });

// ---- OE-06: Atom View covers Z = 1-36 from the shared layer; 4p exists; energy order; OE-10 cache; OE-11 4s bound
const electronsIn = (z) => occupiedOrbitals(z).reduce((s, o) => s + (o.occupancy === "paired" ? 2 : o.occupancy === "up" ? 1 : 0), 0);
t("Atom View: every Z = 1-36 gives orbitals holding exactly Z electrons, all ids drawable, all colours defined", () => {
  assert.equal(MAX_ATOM_VIEW_Z, 36);
  for (let z = 1; z <= 36; z++) { assert.equal(electronsIn(z), z, `Z=${z}`); for (const o of occupiedOrbitals(z)) { assert.ok(ORBITAL_DEFS[o.id], `${z}: ${o.id} has a definition`); assert.notEqual(colorForOrbitalId(o.id), "#9CA3AF", `${o.id} colour`); } }
});
t("Atom View agrees with the shared layer, including the Cr and Cu exceptions", () => {
  const cfg = (z) => formatConfiguration(fillSublevels(z));
  assert.equal(cfg(24), "1s\u00B2 2s\u00B2 2p\u2076 3s\u00B2 3p\u2076 4s\u00B9 3d\u2075");
  assert.equal(cfg(29), "1s\u00B2 2s\u00B2 2p\u2076 3s\u00B2 3p\u2076 4s\u00B9 3d\u00B9\u2070");
  assert.equal(cfg(26), "1s\u00B2 2s\u00B2 2p\u2076 3s\u00B2 3p\u2076 4s\u00B2 3d\u2076");
  for (let z = 1; z <= 36; z++) assert.deepEqual(fillSublevels(z).map((s) => [s.n, s.l, s.count]), neutralOccupancy(z).map((s) => [s.n, s.l, s.electrons]), `Z=${z}`);
  assert.deepEqual(fillSublevels(37), []); assert.deepEqual(fillSublevels(0), []);
});
t("Hund's rule on the drawn orbitals: N 2p all single; O 2p one pair; Cr 3d five single; Fe 3d one pair; Kr 18 orbitals all paired", () => {
  const occ = (z, sub) => occupiedOrbitals(z).filter((o) => o.sublevel === sub).map((o) => o.occupancy);
  assert.deepEqual(occ(7, "2p"), ["up", "up", "up"]); assert.deepEqual(occ(8, "2p"), ["paired", "up", "up"]);
  assert.deepEqual(occ(24, "3d"), ["up", "up", "up", "up", "up"]); assert.deepEqual(occ(26, "3d"), ["paired", "up", "up", "up", "up"]);
  assert.equal(occupiedOrbitals(36).length, 18); assert.ok(occupiedOrbitals(36).every((o) => o.occupancy === "paired"));
  assert.equal(occupiedOrbitals(21).filter((o) => o.sublevel === "3d").map((o) => o.occupancy).join(), "up,,,,");
});
t("4p is offered: definition, orientations, nodes n-l-1 = 2, peak plausible, bound 48 a0", () => {
  assert.ok(BASE_ORBITALS.includes("4p")); assert.deepEqual(ORIENTATIONS["4p"], ["4px", "4py", "4pz"]);
  const f = R.radialFeatures(4, 1); assert.equal(f.nodes.length, 2); assert.equal(f.peaks.length, 3); close(f.nodes[0].r, 2 * (5 - Math.sqrt(5)), 0.002, "4p node 1 = 2(5 - sqrt5)"); close(f.nodes[1].r, 2 * (5 + Math.sqrt(5)), 0.002, "4p node 2 = 2(5 + sqrt5)"); const top = f.peaks.reduce((a, b) => (b.p > a.p ? b : a)); assert.ok(top.r > f.nodes[1].r, "the most probable radius is outside the last node");
  assert.equal(boundingRadiusFor(4), 48);
});
t("energy order strip: 4s below 3d; K has 4s1 and empty 3d; Ca 4s2; Sc first 3d electron; Zn full 3d", () => {
  const e = (z) => Object.fromEntries(energyOrderRows(z).map((r) => [r.sublevel, r.electrons]));
  assert.deepEqual(energyOrderRows(1).map((r) => r.sublevel), ["1s", "2s", "2p", "3s", "3p", "4s", "3d", "4p"]);
  assert.equal(e(19)["4s"], 1); assert.equal(e(19)["3d"], 0); assert.equal(e(20)["4s"], 2); assert.equal(e(21)["3d"], 1); assert.equal(e(30)["3d"], 10); assert.equal(e(30)["4p"], 0); assert.equal(e(31)["4p"], 1);
});
t("OE-10: points per orbital shrink for heavy atoms (never below 2,500, never above the tier), clouds are cached and deterministic", () => {
  assert.equal(pointsForCount(10000, 3), 10000); assert.equal(pointsForCount(10000, 12), 10000); assert.equal(pointsForCount(10000, 18), 6500); assert.equal(pointsForCount(10000, 27), 4500); assert.equal(pointsForCount(3000, 18), 2500); assert.ok(pointsForCount(10000, 99) >= 2500);
  clearCloudCache(); assert.equal(hasCloud("4px", 800), false);
  const a = cloudFor("4px", 800); assert.equal(hasCloud("4px", 800), true); assert.equal(cloudFor("4px", 800), a, "second call returns the cached array");
  clearCloudCache(); const b = cloudFor("4px", 800); assert.deepEqual(a[0], b[0], "same seed, same points"); assert.equal(b.length, 800);
  const mean = (pts) => pts.reduce((s, p) => s + Math.hypot(p.x, p.y, p.z), 0) / pts.length;
  assert.ok(mean(cloudFor("4px", 800)) > mean(cloudFor("3pz", 800)), "4p cloud is larger than 3p");
});
console.log(`${n} passed`);
