#!/usr/bin/env node
// Model-level tests for the Bonding Visualizer:  node scripts/test-bonding-model.mjs
// Covers the data model (elements, ions, ionic solver, covalent table, lattices, metallic lattices, lesson config)
// and the pure scene functions. No DOM. UI-level checks live in scripts/test-bonding-ui.mjs and the headless
// Chromium run (scripts/verify-bonding-visualizer.mjs).
import assert from "node:assert/strict";
import electronConfigExceptions from "../src/data/chemistry/electron-config-exceptions.js";
import { buildConfiguration } from "../src/engines/electron-configuration/logic/buildConfiguration.js";
import * as EL from "../src/engines/bonding-visualizer/model/elements.js";
import * as IO from "../src/engines/bonding-visualizer/model/ionic.js";
import * as CO from "../src/engines/bonding-visualizer/model/covalent.js";
import * as LA from "../src/engines/bonding-visualizer/model/lattice.js";
import * as ME from "../src/engines/bonding-visualizer/model/metallic.js";
import * as CF from "../src/engines/bonding-visualizer/model/config.js";
import { ionicScene } from "../src/engines/bonding-visualizer/scene/ionicScene.js";
import { covalentScene, layoutMolecule, atomsAreClose } from "../src/engines/bonding-visualizer/scene/covalentScene.js";
import * as MS from "../src/engines/bonding-visualizer/scene/metallicScene.js";
import { isCrowded, DOT_RHO } from "../src/engines/bonding-visualizer/scene/covalentScene.js";
import { moleculeStructure, minGap } from "../src/engines/bonding-visualizer/scene/moleculeStructure.js";

let passed = 0; let failed = 0;
function test(name, fn) {
  try { fn(); passed += 1; console.log(`  ok   ${name}`); } catch (e) { failed += 1; console.log(`  FAIL ${name}\n       ${e.message.split("\n").join("\n       ")}`); }
}
const sh = (sym) => EL.getBondingElement(sym).shells.join(",");
const atoms = (...syms) => syms.map((symbol, i) => ({ id: `a${i}`, symbol, x: 200 + i * 150, y: 250, colorIdx: i }));
const world = { W: 900, H: 560 };

console.log("Elements and electron arrangements (source of truth: electron-configuration engine)");
const ORACLE = { H: "1", Li: "2,1", Be: "2,2", B: "2,3", C: "2,4", N: "2,5", O: "2,6", F: "2,7", Na: "2,8,1", Mg: "2,8,2", Al: "2,8,3", P: "2,8,5", S: "2,8,6", Cl: "2,8,7", K: "2,8,8,1", Ca: "2,8,8,2", Br: "2,8,18,7" };
test("[check 1] lithium is exactly 2,1", () => assert.equal(sh("Li"), "2,1"));
test("[check 2] chlorine is exactly 2,8,7", () => assert.equal(sh("Cl"), "2,8,7"));
test("every library element matches an independent textbook shell table", () => {
  assert.deepEqual(Object.keys(ORACLE).sort(), [...EL.ALL_SYMBOLS].sort());
  for (const [s, v] of Object.entries(ORACLE)) assert.equal(sh(s), v, s);
});
test("electron count equals atomic number for every library element (neutral atoms)", () => {
  for (const s of EL.ALL_SYMBOLS) { const e = EL.getBondingElement(s); assert.equal(e.shells.reduce((a, b) => a + b, 0), e.Z, s); }
});
test("no shell exceeds its 2n^2 capacity (2n^2 is a limit, not a filling rule: K = 2,8,8,1)", () => {
  for (const s of EL.ALL_SYMBOLS) EL.getBondingElement(s).shells.forEach((n, i) => assert.ok(n <= 2 * (i + 1) ** 2, `${s} shell ${i + 1}`));
  assert.equal(sh("K"), "2,8,8,1"); assert.equal(sh("Ca"), "2,8,8,2");
});
test("library is consistent with the shared configuration engine and uses no configuration exception", () => {
  assert.deepEqual(EL.validateLibrary(), []);
  for (const s of EL.ALL_SYMBOLS) { const e = EL.getBondingElement(s); assert.deepEqual(e.shells, buildConfiguration(e.Z).shells); assert.ok(!(e.Z in electronConfigExceptions), `${s} is an exception`); }
});
test("ion charges match textbook values and ion electron counts = Z - charge", () => {
  const CH = { Li: 1, Na: 1, K: 1, Mg: 2, Ca: 2, Al: 3, N: -3, O: -2, F: -1, S: -2, Cl: -1, Br: -1 };
  for (const [s, q] of Object.entries(CH)) {
    const i = IO.ionOf(s); assert.equal(i.charge, q, s);
    assert.equal(i.ionShells.reduce((a, b) => a + b, 0), i.Z - q, `${s} electrons`);
  }
});
test("empty outer shells are gone: cations lose a shell, anions keep theirs", () => {
  assert.deepEqual(IO.ionOf("Li").ionShells, [2]); assert.deepEqual(IO.ionOf("Na").ionShells, [2, 8]); assert.deepEqual(IO.ionOf("Mg").ionShells, [2, 8]);
  assert.deepEqual(IO.ionOf("Cl").ionShells, [2, 8, 8]); assert.deepEqual(IO.ionOf("O").ionShells, [2, 8]); assert.deepEqual(IO.ionOf("Br").ionShells, [2, 8, 18, 8]);
  assert.deepEqual(IO.ionOf("K").ionShells, [2, 8, 8]);
});

console.log("Ionic solver");
test("[check 3] LiCl: one electron transferred, Li+ and Cl-", () => {
  const sys = IO.buildIonicSystem(atoms("Li", "Cl"));
  assert.equal(sys.formula, "LiCl"); assert.equal(sys.electronsTransferred, 1);
  assert.deepEqual(sys.transfers, [{ from: "a0", to: "a1" }]);
  assert.equal(sys.byId.a0.charge, 1); assert.equal(sys.byId.a1.charge, -1);
  assert.deepEqual(sys.byId.a0.ionShells, [2]); assert.deepEqual(sys.byId.a1.ionShells, [2, 8, 8]);
});
test("[check 5] MgCl2 requires 1 Mg + 2 Cl", () => {
  assert.deepEqual(IO.chargeBalance("Mg", "Cl"), { cation: 1, anion: 2 }); assert.equal(IO.formulaOf("Mg", "Cl"), "MgCl₂");
  const a = IO.analyzeIonic(["Mg", "Cl"]);
  assert.equal(a.status, "incomplete"); assert.deepEqual(a.missing, [{ symbol: "Cl", count: 1 }]);
  assert.equal(IO.analyzeIonic(["Mg", "Cl", "Cl"]).status, "valid");
  assert.equal(IO.buildIonicSystem(atoms("Cl", "Mg", "Cl")).electronsTransferred, 2);
});
test("[check 6] Na2O requires 2 Na + 1 O", () => {
  assert.deepEqual(IO.chargeBalance("Na", "O"), { cation: 2, anion: 1 });
  const a = IO.analyzeIonic(["Na", "O"]); assert.equal(a.status, "incomplete"); assert.deepEqual(a.missing, [{ symbol: "Na", count: 1 }]);
  assert.equal(IO.analyzeIonic(["Na", "O", "Na"]).status, "valid");
});
test("Al2O3 requires 2 Al + 3 O and transfers 6 electrons; every ratio is charge balanced", () => {
  assert.deepEqual(IO.chargeBalance("Al", "O"), { cation: 2, anion: 3 });
  const sys = IO.buildIonicSystem(atoms("Al", "O", "Al", "O", "O"));
  assert.equal(sys.electronsTransferred, 6);
  for (const m of ["Li", "Na", "K", "Mg", "Ca", "Al"]) for (const n of ["N", "O", "F", "S", "Cl", "Br"]) {
    const r = IO.chargeBalance(m, n); assert.equal(r.cation * IO.ionOf(m).charge + r.anion * IO.ionOf(n).charge, 0, `${m}${n}`);
    assert.equal(IO.gcd(r.cation, r.anion), 1);
  }
});
test("MgO, NaCl, Mg3N2, AlF3, Li3N formulas and ratios", () => {
  assert.equal(IO.formulaOf("Mg", "O"), "MgO"); assert.equal(IO.formulaOf("Na", "Cl"), "NaCl"); assert.equal(IO.formulaOf("Mg", "N"), "Mg₃N₂");
  assert.equal(IO.formulaOf("Al", "F"), "AlF₃"); assert.equal(IO.formulaOf("Li", "N"), "Li₃N");
});
test("charge conservation: electrons lost by cations = electrons gained by anions for every valid system", () => {
  const sets = [["Li", "Cl"], ["Na", "Cl"], ["Mg", "O"], ["Mg", "Cl", "Cl"], ["Na", "Na", "O"], ["Al", "Al", "O", "O", "O"], ["Mg", "Mg", "Mg", "N", "N"], ["Al", "F", "F", "F"], ["Li", "Li", "Li", "N"]];
  for (const s of sets) {
    const sys = IO.buildIonicSystem(atoms(...s));
    const lost = sys.ions.filter((i) => i.charge > 0).reduce((n, i) => n + i.charge, 0);
    const gained = sys.ions.filter((i) => i.charge < 0).reduce((n, i) => n - i.charge, 0);
    assert.equal(lost, gained, s.join()); assert.equal(sys.transfers.length, lost);
    assert.equal(sys.ions.reduce((n, i) => n + i.charge, 0), 0, `${s.join()} net charge`);
    // each acceptor receives exactly |charge| electrons; each donor gives exactly charge
    for (const i of sys.ions) {
      const out = sys.transfers.filter((t) => t.from === i.id).length; const inn = sys.transfers.filter((t) => t.to === i.id).length;
      assert.equal(i.charge > 0 ? out : inn, Math.abs(i.charge)); assert.equal(i.charge > 0 ? inn : out, 0);
    }
  }
});
test("arrangements alternate (Cl-Mg-Cl, O-Al-O-Al-O) or use a star for 1:3", () => {
  const r = (s) => IO.arrangeIons(atoms(...s));
  const kinds = (arr, sys) => arr.order.map((id) => sys.byId[id].charge > 0 ? "+" : "-").join("");
  const s1 = IO.buildIonicSystem(atoms("Mg", "Cl", "Cl")); assert.equal(kinds(s1.arrangement, s1), "-+-");
  const s2 = IO.buildIonicSystem(atoms("Al", "Al", "O", "O", "O")); assert.equal(kinds(s2.arrangement, s2), "-+-+-");
  assert.equal(r(["Al", "F", "F", "F"]).kind, "star"); assert.equal(r(["Li", "Li", "Li", "N"]).kind, "star");
});
test("unsupported or wrong combinations give an explanation, not a result", () => {
  for (const [syms, re] of [[["Li", "Na", "Cl"], /one metal and one non-metal/i], [["Al", "Cl", "Cl", "Cl"], /covalent/i], [["Al", "N"], /covalent/i], [["Li"], /non-metal/i], [["Cl"], /metal/i], [["H", "Cl"], /supported/i], [[], /Add a metal/]]) {
    const a = IO.analyzeIonic(syms); assert.notEqual(a.status, "valid", syms.join()); assert.match(a.message, re, syms.join());
  }
  assert.equal(IO.analyzeIonic(["Mg", "Cl", "Cl", "Cl"]).status, "excess");
  assert.throws(() => IO.buildIonicSystem(atoms("Mg", "Cl")));
});

console.log("Ionic scene (animation geometry)");
test("[check 4] after ionisation Li+ shows 2 (empty shell removed) and Cl- shows 2,8,8", () => {
  const sys = IO.buildIonicSystem(atoms("Li", "Cl")); const a = atoms("Li", "Cl");
  const before = ionicScene({ atoms: a, system: sys, stage: "setup", world });
  assert.deepEqual(before.atoms.map((x) => x.label), ["2,1", "2,8,7"]);
  const after = ionicScene({ atoms: a, system: sys, stage: "ionized", p: 1, world });
  assert.deepEqual(after.atoms.map((x) => x.label), ["2", "2,8,8"]);
  const li = after.atoms[0]; assert.equal(li.rings.find((r) => r.k === 2).opacity, 0); assert.equal(li.rings.find((r) => r.k === 1).opacity, 1);
  // electrons are listed with their atom of origin; 3 + 17 = Z(Li) + Z(Cl) are drawn before and after, one of them has moved
  assert.equal(after.atoms.flatMap((x) => x.electrons).length, 20); assert.equal(before.atoms.flatMap((x) => x.electrons).length, 20);
  assert.equal(after.atoms[0].charge, 1); assert.equal(after.atoms[1].charge, -1);
});
test("[check 3] the transferred electron keeps its original colour and ends on the Cl outer shell", () => {
  const sys = IO.buildIonicSystem(atoms("Li", "Cl")); const a = atoms("Li", "Cl");
  const s0 = ionicScene({ atoms: a, system: sys, stage: "setup", world });
  const liOuter = s0.atoms[0].electrons.find((e) => !e.core); const liColour = liOuter.color;
  assert.notEqual(liColour, s0.atoms[1].electrons.find((e) => !e.core).color);
  const s1 = ionicScene({ atoms: a, system: sys, stage: "ionized", p: 1, world });
  const moved = s1.atoms[0].electrons.find((e) => !e.core);
  assert.equal(moved.color, liColour); assert.equal(moved.id, liOuter.id);
  const cl = s1.atoms[1]; const d = Math.hypot(moved.x - cl.x, moved.y - cl.y);
  assert.ok(Math.abs(d - cl.rings.find((r) => r.k === 3).r) < 1e-6, "arrives on the 3rd ring of Cl");
  assert.equal(s1.atoms.flatMap((x) => x.electrons).filter((e) => e.color === liColour && !e.core).length, 1);
});
test("MgCl2 / Na2O / Al2O3 scenes end with the right shells and charges", () => {
  const cases = { "Mg,Cl,Cl": ["2,8,2->2,8", "2,8,7->2,8,8"], "Na,O,Na": ["2,8,1->2,8", "2,6->2,8"] };
  for (const [k] of Object.entries(cases)) {
    const syms = k.split(","); const a = atoms(...syms); const sys = IO.buildIonicSystem(a);
    const e = ionicScene({ atoms: a, system: sys, stage: "attracted", p: 1, world });
    e.atoms.forEach((x, i) => assert.equal(x.label, sys.byId[a[i].id].ionShells.join(",")));
    assert.equal(e.atoms.reduce((n, x) => n + x.charge, 0), 0);
  }
});
test("attraction is a separate stage: ions are separated after ionisation and closer after attraction", () => {
  const a = atoms("Li", "Cl"); const sys = IO.buildIonicSystem(a);
  const dist = (sc) => Math.hypot(sc.atoms[0].x - sc.atoms[1].x, sc.atoms[0].y - sc.atoms[1].y);
  const ionised = ionicScene({ atoms: a, system: sys, stage: "ionized", p: 1, world });
  const mid = ionicScene({ atoms: a, system: sys, stage: "attracting", p: 0.5, world });
  const end = ionicScene({ atoms: a, system: sys, stage: "attracted", p: 1, world });
  assert.ok(dist(ionised) > dist(mid) && dist(mid) > dist(end));
  const gap = (sc) => dist(sc) - sc.atoms.reduce((n, x) => n + x.currentOuterR, 0);
  assert.ok(gap(ionised) > 5, "ions slightly separated after transfer"); assert.ok(Math.abs(gap(end)) < 4, "touching after attraction");
  const during = ionicScene({ atoms: a, system: sys, stage: "ionizing", p: 0.6, world });
  const during2 = ionicScene({ atoms: a, system: sys, stage: "ionizing", p: 1, world });
  assert.ok(Math.abs(dist(during) - dist(during2)) < 1e-9, "no attraction movement during electron transfer");
});

console.log("Covalent molecules");
test("every molecule is consistent: valence electrons, lone + shared pairs, neutrality, octet class", () => {
  for (const m of CO.MOLECULES) assert.deepEqual(CO.validateMolecule(m), [], m.id);
});
test("[check 9] H2 shares exactly two electrons, one from each hydrogen, and stays neutral", () => {
  const m = CO.getMolecule("H2"); assert.equal(CO.totalSharedPairs(m), 1); assert.equal(CO.totalLonePairs(m), 0);
  const a = atoms("H", "H"); const sc = covalentScene({ atoms: a, molecule: m, stage: "bonded", p: 1, world });
  const shared = sc.atoms.flatMap((x) => x.electrons.filter((e) => e.state === "shared").map((e) => ({ ...e, owner: x.id })));
  assert.equal(shared.length, 2); assert.deepEqual(shared.map((e) => e.owner).sort(), ["a0", "a1"]);
  assert.notEqual(shared[0].color, shared[1].color); // two different electron colours
  assert.ok(Math.hypot(shared[0].x - shared[1].x, shared[0].y - shared[1].y) < 16, "the pair sits together between the nuclei");
  const mid = { x: (sc.atoms[0].x + sc.atoms[1].x) / 2, y: (sc.atoms[0].y + sc.atoms[1].y) / 2 };
  shared.forEach((e) => assert.ok(Math.hypot(e.x - mid.x, e.y - mid.y) < 12));
  assert.equal(sc.atoms.reduce((n, x) => n + x.electrons.length, 0), 2);
  assert.equal(EL.getBondingElement("H").valence * 2, 2);
});
test("[check 10] O2 is a double bond (2 shared pairs, 2 lone pairs each); N2 is a triple bond (3 pairs, 1 lone pair each)", () => {
  const o2 = CO.getMolecule("O2"); const n2 = CO.getMolecule("N2");
  assert.equal(o2.bonds[0][2], 2); assert.equal(CO.totalSharedPairs(o2), 2); assert.deepEqual(o2.lonePairs, [2, 2]);
  assert.equal(n2.bonds[0][2], 3); assert.equal(CO.totalSharedPairs(n2), 3); assert.deepEqual(n2.lonePairs, [1, 1]);
  assert.equal(o2.structural, "O=O"); assert.equal(n2.structural, "N≡N");
  for (const [m, pairs] of [[o2, 2], [n2, 3]]) {
    const sc = covalentScene({ atoms: atoms(...m.atoms), molecule: m, stage: "bonded", p: 1, world });
    assert.equal(sc.atoms.reduce((n, x) => n + x.electrons.filter((e) => e.state === "shared").length, 0), pairs * 2);
  }
});
test("selector example sets are scientifically sound: Single={H2,Cl2,HCl,H2O,NH3,CH4}, Double={O2}, Triple={N2}", () => {
  assert.deepEqual(CO.examplesForOrder(1).map((m) => m.id), ["H2", "Cl2", "HCl", "H2O", "NH3", "CH4"]);
  assert.deepEqual(CO.examplesForOrder(2).map((m) => m.id), ["O2"]); assert.deepEqual(CO.examplesForOrder(3).map((m) => m.id), ["N2"]);
});
test("H2O, NH3, CH4: shared and lone pairs", () => {
  const exp = { H2O: [2, 2], NH3: [3, 1], CH4: [4, 0], Cl2: [1, 6], HCl: [1, 3] };
  for (const [id, [shared, lone]] of Object.entries(exp)) { const m = CO.getMolecule(id); assert.equal(CO.totalSharedPairs(m), shared, id); assert.equal(CO.totalLonePairs(m), lone, id); }
});
test("[check 11] octet exceptions: BF3 B has 6 e-, BeCl2 Be has 4 e-, PCl5 P has 10 e-, SF6 S has 12 e-, CH4 C has 8 e-", () => {
  const around = (id) => { const m = CO.getMolecule(id); return CO.electronsAround(m, m.central); };
  assert.equal(around("BF3"), 6); assert.equal(around("BeCl2"), 4); assert.equal(around("PCl5"), 10); assert.equal(around("SF6"), 12); assert.equal(around("CH4"), 8);
  assert.equal(CO.getMolecule("BF3").group, "incomplete"); assert.equal(CO.getMolecule("BeCl2").group, "incomplete");
  assert.equal(CO.getMolecule("PCl5").group, "expanded"); assert.equal(CO.getMolecule("SF6").group, "expanded"); assert.equal(CO.getMolecule("CH4").group, "normal");
  assert.ok(CO.getMolecule("PCl5").ahl && CO.getMolecule("SF6").ahl);
  // the drawn electrons around the central atom agree with the counts
  for (const id of ["BF3", "BeCl2", "PCl5", "SF6", "CH4"]) {
    const m = CO.getMolecule(id); const sc = covalentScene({ atoms: atoms(...m.atoms), molecule: m, stage: "bonded", p: 1, world });
    const sharedDots = sc.atoms.reduce((n, x) => n + x.electrons.filter((e) => e.state === "shared").length, 0);
    assert.equal(sharedDots, 2 * CO.totalSharedPairs(m), id);
    assert.equal(sc.info.perAtom[m.central].electrons, around(id), id);
  }
});
test("electron sharing never changes the overall charge: electrons drawn = valence electrons supplied", () => {
  for (const m of CO.MOLECULES) {
    const sc = covalentScene({ atoms: atoms(...m.atoms), molecule: m, stage: "bonded", p: 1, world });
    const valenceDots = sc.atoms.reduce((n, x) => n + x.electrons.filter((e) => !e.core).length, 0);
    assert.equal(valenceDots, m.atoms.reduce((n, s) => n + EL.getBondingElement(s).valence, 0), m.id);
    assert.equal(sc.atoms.reduce((n, x) => n + x.electrons.length, 0), m.atoms.reduce((n, s) => n + EL.getBondingElement(s).Z, 0), `${m.id} total electrons = sum of Z`);
  }
});
test("lookup and explanations for unsupported sets", () => {
  assert.equal(CO.findMolecule(["H", "O", "H"]).id, "H2O"); assert.equal(CO.findMolecule(["H", "H"]).id, "H2"); assert.equal(CO.findMolecule(["F", "B", "F", "F"]).id, "BF3");
  assert.equal(CO.findMolecule(["H", "O"]), null); assert.match(CO.explainUnsupported(["H", "O"]), /H₂O/); assert.match(CO.explainUnsupported(["H", "Cl", "O"]), /No validated molecule/);
  assert.equal(CO.findMolecule(["O", "O", "O"]), null);
});
test("proximity rule: far atoms cannot bond, close atoms can", () => {
  assert.equal(atomsAreClose([{ symbol: "H", x: 100, y: 100 }, { symbol: "H", x: 600, y: 100 }], 1), false);
  assert.equal(atomsAreClose([{ symbol: "H", x: 100, y: 100 }, { symbol: "H", x: 150, y: 100 }], 1), true);
  const lay = layoutMolecule(CO.getMolecule("SF6")); assert.ok(lay.pos.length === 7 && lay.L > 40);
});

console.log("Lattices");
test("[check 8] NaCl is the rock-salt structure: 6 nearest oppositely charged neighbours around every interior ion (computed from coordinates)", () => {
  const sup = LA.latticeSupport("Na", "Cl"); assert.equal(sup.supported, true); assert.equal(sup.structureId, "rocksalt");
  const ions = LA.generateIonicBlock("rocksalt", 2); const interior = LA.interiorIndices(ions);
  assert.ok(interior.length >= 27);
  for (const i of interior) { const n = LA.nearestOpposite(ions, i); assert.equal(n.count, 6, `ion ${i}`); assert.ok(Math.abs(n.distance - 1) < 1e-9); assert.equal(LA.sameSpeciesAtContact(ions, i), 0); }
  const c = LA.computeCoordination("rocksalt", 2); assert.deepEqual([c.cation, c.anion], [6, 6]);
  // genuinely 3D: spans all three axes, equal numbers of both species in whole cells, alternating along every axis
  for (const ax of ["x", "y", "z"]) assert.ok(new Set(ions.map((p) => p[ax].toFixed(6))).size >= 5);
  assert.deepEqual(LA.unitCellContents("rocksalt"), { cation: 4, anion: 4 });
  const row = ions.filter((p) => Math.abs(p.y - ions[0].y) < 1e-9 && Math.abs(p.z - ions[0].z) < 1e-9).sort((p, q) => p.x - q.x);
  for (let i = 1; i < row.length; i += 1) assert.notEqual(row[i].species, row[i - 1].species);
});
test("growth order extends along x first, then y, then z", () => {
  const ions = LA.generateIonicBlock("rocksalt", 2);
  assert.ok(ions.slice(0, 5).every((p) => p.iy === ions[0].iy && p.iz === ions[0].iz));
  assert.ok(ions[5].iy > ions[0].iy && ions[5].iz === ions[0].iz);
  assert.ok(ions[ions.length - 1].iz > ions[0].iz);
  for (let i = 1; i < ions.length; i += 1) assert.ok(ions[i].iz > ions[i - 1].iz || (ions[i].iz === ions[i - 1].iz && (ions[i].iy > ions[i - 1].iy || (ions[i].iy === ions[i - 1].iy && ions[i].ix > ions[i - 1].ix))));
});
test("fluorite is 8:4 and antifluorite 4:8, computed; unit-cell content matches the formula ratio", () => {
  const f = LA.computeCoordination("fluorite", 2); assert.deepEqual([f.cation, f.anion], [8, 4]);
  const a = LA.computeCoordination("antifluorite", 2); assert.deepEqual([a.cation, a.anion], [4, 8]);
  for (const [id, s] of Object.entries(LA.STRUCTURES)) {
    const u = LA.unitCellContents(id); const g = IO.gcd(u.cation, u.anion);
    assert.deepEqual({ cation: u.cation / g, anion: u.anion / g }, s.ratio, id);
    const c = LA.computeCoordination(id, 2); assert.deepEqual([c.cation, c.anion], [s.expected.cation, s.expected.anion], id);
    for (const i of LA.interiorIndices(LA.generateIonicBlock(id, 2))) assert.equal(LA.sameSpeciesAtContact(LA.generateIonicBlock(id, 2), i), 0);
  }
});
test("every enabled compound's charge ratio equals its structure ratio, and no unvalidated compound is enabled", () => {
  for (const [id, list] of Object.entries(LA.COMPOUND_STRUCTURES)) for (const pair of list) {
    const [c, a] = pair.split("|"); assert.deepEqual(IO.chargeBalance(c, a), LA.STRUCTURES[id].ratio, pair);
    const sup = LA.latticeSupport(c, a); assert.equal(sup.supported, true, pair); assert.equal(sup.structureId, id);
    const rc = LA.displayRadii(c, a); assert.ok(rc.cation > 0.1 && rc.anion > 0.1 && rc.cation + rc.anion < 0.7);
  }
  for (const [c, a] of [["Mg", "Cl"], ["Al", "O"], ["Ca", "Cl"], ["Mg", "N"], ["Al", "F"], ["Li", "N"], ["Al", "S"], ["Ca", "Br"]]) {
    const sup = LA.latticeSupport(c, a); assert.equal(sup.supported, false, `${c}${a}`); assert.match(sup.reason, /isn’t available/);
  }
});

console.log("Metallic");
const METALS = ["Na", "Li", "K", "Mg", "Ca", "Al"];
const COUNTS = [1, 2, 6, 9, 20, 27, 70, 125, 126, 200];
test("capacity is 200 atoms; +1/+5/+20/+50 steps clamp at the cap", () => {
  assert.equal(ME.MAX_METAL_ATOMS, 200); assert.deepEqual(ME.ADD_STEPS, [1, 5, 20, 50]);
  assert.deepEqual(ME.addCount(0, 50), { added: 50, total: 50, clamped: false });
  let n = 0; for (const k of [50, 50, 50, 20, 20]) n = ME.addCount(n, k).total; assert.equal(n, 190);
  assert.deepEqual(ME.addCount(190, 20), { added: 10, total: 200, clamped: true });
  assert.deepEqual(ME.addCount(200, 1), { added: 0, total: 200, clamped: true });
  assert.equal(ME.addCount(199, 5).total, 200);
});
test("counters follow the simplified model: ions = atoms, electrons = atoms x valence (Na 1, Mg 2, Al 3)", () => {
  assert.deepEqual(ME.metalCounts("Na", 200), { atoms: 200, ions: 200, electrons: 200 });
  assert.deepEqual(ME.metalCounts("Mg", 37), { atoms: 37, ions: 37, electrons: 74 });
  assert.deepEqual(ME.metalCounts("Al", 200), { atoms: 200, ions: 200, electrons: 600 });
  assert.equal(MS.MAX_ELECTRONS, 600); // the buffers hold the largest possible sea
});
test("[check 12] lattices are real: BCC 8, FCC 12, HCP 12 nearest neighbours, computed from generated coordinates", () => {
  assert.equal(ME.METAL_STRUCTURE.Na, "bcc");
  for (const st of ["bcc", "fcc", "hcp"]) {
    const sites = ME.latticeBlock(st, 200); assert.equal(sites.length, 200, st);
    assert.equal(ME.maxCoordination(sites), ME.EXPECTED_NEIGHBOURS[st], st);
    let interior = 0;
    sites.forEach((_, i) => { const c = ME.nearestNeighbourCount(sites, i); assert.ok(Math.abs(c.distance - 1) < 1e-9, `${st} nn distance`); if (c.count === ME.EXPECTED_NEIGHBOURS[st]) interior += 1; });
    assert.ok(interior >= 20, `${st}: ${interior} fully surrounded ions`);
  }
});
test("Na BCC: every interior atom has exactly 8 nearest neighbours and none has more; 9 atoms = one body-centred cell", () => {
  const sites = ME.latticeBlock("bcc", 200);
  const counts = sites.map((_, i) => ME.nearestNeighbourCount(sites, i).count);
  assert.ok(Math.max(...counts) === 8); assert.ok(counts.filter((c) => c === 8).length >= 40);
  const cell = ME.latticeBlock("bcc", 9); const a = 2 / Math.sqrt(3);
  assert.equal(cell.filter((p) => Math.abs(Math.abs(p.x) - a / 2) < 1e-9 && Math.abs(Math.abs(p.y) - a / 2) < 1e-9 && Math.abs(Math.abs(p.z) - a / 2) < 1e-9).length, 8);
  assert.equal(cell.filter((p) => Math.hypot(p.x, p.y, p.z) < 1e-9).length, 1);
});
test("never invents atoms: n atoms give exactly n distinct lattice sites for every metal and count", () => {
  for (const m of METALS) for (const n of COUNTS) {
    const L = MS.latticeLayout(ME.METAL_STRUCTURE[m], n); assert.equal(L.sites.length, n, `${m} ${n}`);
    assert.equal(new Set(L.sites.map((p) => [p.x, p.y, p.z].map((v) => v.toFixed(5)).join())).size, n, `${m} ${n} distinct`);
  }
});
test("all lattice cores lie inside the cube (with their radius) for every metal at several counts; nothing overlaps", () => {
  for (const m of METALS) for (const n of COUNTS) {
    const L = MS.latticeLayout(ME.METAL_STRUCTURE[m], n);
    assert.equal(L.H, MS.cubeHalf(n));
    for (const p of L.sites) for (const c of [p.x, p.y, p.z]) assert.ok(Math.abs(c) + L.coreRadius <= L.H + 1e-9, `${m} ${n}: ${c} vs ${L.H}`);
    if (n >= 2) { let min = Infinity; for (let i = 0; i < n; i += 1) for (let j = i + 1; j < n; j += 1) min = Math.min(min, Math.hypot(L.sites[i].x - L.sites[j].x, L.sites[i].y - L.sites[j].y, L.sites[i].z - L.sites[j].z)); assert.ok(min > 2 * L.coreRadius, `${m} ${n}: cores overlap`); }
  }
});
test("cube size grows with the count and is never smaller than the placement needs; 200 atoms fit", () => {
  let prev = 0; for (let n = 1; n <= 200; n += 1) { const h = MS.cubeHalf(n); assert.ok(h >= prev && h >= 2.4); prev = h; }
  assert.ok(MS.cubeHalf(200) < 6.5);
});
test("'arrange atoms' placement scales to 200: inside the cube, no overlapping atoms, +N appends without moving old atoms", () => {
  let pos = [];
  for (const k of [1, 5, 20, 50, 50, 50, 24]) {
    const fresh = MS.placeNewAtoms(pos, k, pos.length); assert.equal(fresh.length, k);
    const before = pos.slice(); pos = [...pos, ...fresh];
    assert.deepEqual(pos.slice(0, before.length), before);
    const H = MS.cubeHalf(pos.length);
    for (const p of pos) for (const c of p) assert.ok(Math.abs(c) + MS.R_ATOM <= H + 1e-9);
  }
  assert.equal(pos.length, 200);
  let min = Infinity; for (let i = 0; i < 200; i += 1) for (let j = i + 1; j < 200; j += 1) min = Math.min(min, Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1], pos[i][2] - pos[j][2]));
  assert.ok(min > 2 * MS.R_ATOM, `closest pair ${min}`);
});
test("valence electrons come from the outer shell: Na 1, Mg 2, Al 3; metals map to real structures", () => {
  assert.deepEqual(METALS.map(ME.valenceElectrons), [1, 1, 1, 2, 2, 3]);
  assert.deepEqual(METALS.map((s) => ME.METAL_STRUCTURE[s]), ["bcc", "bcc", "bcc", "hcp", "fcc", "fcc"]);
  assert.equal(ME.analyzeMetals([]).status, "empty"); assert.equal(ME.analyzeMetals(["Na"]).status, "few"); assert.equal(ME.analyzeMetals(["Na", "Na"]).status, "valid");
  assert.equal(ME.analyzeMetals(["Na", "Mg"]).status, "unsupported");
});
test("[check 12] metallic engine: positive cores and delocalised electrons throughout the cube, cores fixed in the lattice", () => {
  for (const [metal, n] of [["Na", 40], ["Al", 200], ["Mg", 7]]) {
    const st = ME.METAL_STRUCTURE[metal]; const v = ME.valenceElectrons(metal);
    const L = MS.latticeLayout(st, n);
    const atoms3 = MS.placeNewAtoms([], n, 0); const assign = MS.assignSites(atoms3, L.sites);
    assert.equal(new Set(assign).size, n);
    const atomPos = new Float32Array(n * 3); atoms3.forEach((p, i) => atomPos.set(p, i * 3));
    const sitePos = new Float32Array(n * 3); assign.forEach((j, i) => { sitePos[i * 3] = L.sites[j].x; sitePos[i * 3 + 1] = L.sites[j].y; sitePos[i * 3 + 2] = L.sites[j].z; });
    const eng = MS.createEngine();
    const base = { atomPos, sitePos, n, v, H: L.H, u: L.u };
    MS.stepEngine(eng, { ...base, stage: "place", p: 0, time: 1 });
    assert.equal(eng.mix, 0); assert.equal(eng.nElec, n * v);
    MS.stepEngine(eng, { ...base, stage: "released", p: 1, time: 3 }); assert.equal(eng.mix, 1); assert.equal(eng.nElec, n * v);
    const lim = L.H - MS.R_ELECTRON;
    const snaps = [1, 7, 20].map((t) => { MS.stepEngine(eng, { ...base, stage: "lattice", p: 1, time: t }); return { cores: Array.from(eng.corePos.slice(0, n * 3)), e: Array.from(eng.elecPos.slice(0, n * v * 3)) }; });
    assert.deepEqual(snaps[0].cores, snaps[1].cores); assert.notDeepEqual(snaps[0].e, snaps[1].e);
    for (const sn of snaps) for (const c of sn.e) assert.ok(Math.abs(c) <= lim + 1e-5, `${metal} ${n}: electron outside cube`);
    if (n >= 40) for (const ax of [0, 1, 2]) assert.ok(new Set(snaps[0].e.filter((_, k) => k % 3 === ax).map((x) => x.toFixed(2))).size > 20);
    // every stage keeps electrons inside the cube (orbiting atoms, releasing, forming)
    for (const [stage, p] of [["place", 0], ["releasing", 0.4], ["forming", 0.3], ["forming", 0.9]]) {
      for (const t of [0.5, 4.2]) { MS.stepEngine(eng, { ...base, stage, p, time: t }); for (let k = 0; k < eng.nElec * 3; k += 1) assert.ok(Math.abs(eng.elecPos[k]) <= lim + 1e-5, `${stage} ${p}`); for (let k = 0; k < n * 3; k += 1) assert.ok(Math.abs(eng.corePos[k]) <= L.H, "core inside"); }
    }
  }
});
test("engine allocates nothing per step (buffers are reused)", () => {
  const eng = MS.createEngine(); const n = 200; const atomPos = new Float32Array(n * 3); const a0 = eng.corePos; const e0 = eng.elecPos;
  for (let t = 0; t < 5; t += 1) MS.stepEngine(eng, { atomPos, sitePos: null, n, v: 3, stage: "released", p: 1, time: t, H: 5.5, u: 1 });
  assert.equal(eng.corePos, a0); assert.equal(eng.elecPos, e0);
});

console.log("Covalent final structures");
test("crowding is detected from geometry (full outer shells of non-bonded atoms overlap): exactly PCl5 and SF6", () => {
  assert.deepEqual(CO.MOLECULES.filter(isCrowded).map((m) => m.id), ["PCl5", "SF6"]);
  assert.ok(DOT_RHO > 0);
});
test("crowded molecules use the valence-dot drawing: no shell rings, every electron kept, colours by atom of origin", () => {
  for (const id of ["PCl5", "SF6"]) {
    const m = CO.getMolecule(id); const at = atoms(...m.atoms);
    const full = at.reduce((n, a) => n + EL.getBondingElement(a.symbol).Z, 0);
    for (const p of [0, 0.15, 0.5, 0.85, 1]) {
      const sc = covalentScene({ atoms: at, molecule: m, stage: p === 1 ? "bonded" : "bonding", p, world });
      assert.equal(sc.crowded, true);
      assert.equal(sc.atoms.reduce((n, a) => n + a.electrons.length, 0), full, `${id} p=${p}: electrons are never deleted`);
      for (const a of sc.atoms) for (const e of a.electrons) if (!e.core) assert.equal(e.color, sc.atoms.find((x) => x.id === a.id).electrons.find((q) => !q.core).color);
    }
    const end = covalentScene({ atoms: at, molecule: m, stage: "bonded", p: 1, world });
    assert.ok(end.atoms.every((a) => a.rings.every((r) => r.opacity < 0.01)), `${id}: no Bohr shell rings drawn in the final electron picture`);
    assert.equal(end.lenses.length, 0);
    // shared / lone electrons: 6 (SF6) or 5 (PCl5) shared pairs = 2 electrons each, one from each atom
    const shared = end.atoms.flatMap((a) => a.electrons.filter((e) => e.state === "shared"));
    assert.equal(shared.length, 2 * CO.totalSharedPairs(m)); assert.equal(end.atoms.flatMap((a) => a.electrons.filter((e) => e.state === "lone")).length, 2 * CO.totalLonePairs(m));
    // electron dots never sit on top of each other and valence rings of different atoms do not overlap
    const dots = end.atoms.flatMap((a) => a.electrons);
    let min = Infinity; for (let i = 0; i < dots.length; i += 1) for (let j = i + 1; j < dots.length; j += 1) min = Math.min(min, Math.hypot(dots[i].x - dots[j].x, dots[i].y - dots[j].y));
    assert.ok(min > 2 * 3.2, `${id}: closest electron dots ${min.toFixed(1)}`);
    for (let i = 0; i < end.atoms.length; i += 1) for (let j = i + 1; j < end.atoms.length; j += 1) assert.ok(Math.hypot(end.atoms[i].x - end.atoms[j].x, end.atoms[i].y - end.atoms[j].y) > end.atoms[i].outerR + end.atoms[j].outerR - 1e-6, `${id}: valence discs overlap`);
  }
  // uncrowded molecules keep the normal shell drawing and lens overlap
  const h2o = CO.getMolecule("H2O"); const sc = covalentScene({ atoms: atoms(...h2o.atoms), molecule: h2o, stage: "bonded", p: 1, world });
  assert.equal(sc.crowded, false); assert.ok(sc.lenses.length === 2 && sc.atoms.every((a) => a.rings[0].opacity === 1));
});
test("SF6 final structure: 1 S at the centre, 6 F in an octahedron at equal distance, 6 single bonds, Lewis counts correct", () => {
  const m = CO.getMolecule("SF6"); const st = moleculeStructure(m);
  assert.equal(st.atoms.length, 7); assert.equal(st.atoms.filter((a) => a.symbol === "S").length, 1); assert.equal(st.atoms.filter((a) => a.symbol === "F").length, 6);
  const S = st.atoms[0]; assert.deepEqual(S.pos.map((c) => Math.abs(c) < 1e-9), [true, true, true]);
  assert.equal(st.bonds.length, 6); assert.ok(st.bonds.every((b) => b.i === 0 && b.order === 1));
  const F = st.atoms.slice(1); const d = Math.hypot(...F[0].pos);
  for (const f of F) assert.ok(Math.abs(Math.hypot(...f.pos) - d) < 1e-9);
  const axes = F.map((f) => f.pos.map((c) => Math.round(c / d))); // +-x, +-y, +-z
  assert.deepEqual(new Set(axes.map((a) => a.join())), new Set(["1,0,0", "-1,0,0", "0,1,0", "0,-1,0", "0,0,1", "0,0,-1"]));
  for (let i = 0; i < 6; i += 1) for (let j = i + 1; j < 6; j += 1) { const dot = F[i].pos.reduce((s, c, k) => s + c * F[j].pos[k], 0) / (d * d); assert.ok(Math.abs(dot) < 1e-9 || Math.abs(dot + 1) < 1e-9, "octahedral: 90 or 180 degrees only"); }
  assert.equal(CO.sharedPairsOn(m, 0), 6); assert.equal(CO.electronsAround(m, 0), 12); assert.equal(m.lonePairs.slice(1).every((x) => x === 3), true); assert.equal(CO.electronsAround(m, 1), 8);
});
test("every molecule's final structure matches the molecule table (atoms, bond orders, valence/lone pairs) and nothing overlaps", () => {
  for (const m of CO.MOLECULES) {
    assert.deepEqual(CO.validateMolecule(m), [], m.id);
    const st = moleculeStructure(m);
    assert.deepEqual(st.atoms.map((a) => a.symbol), m.atoms, m.id);
    assert.deepEqual(st.bonds.map((b) => [b.i, b.j, b.order]), m.bonds, m.id);
    st.atoms.forEach((a, i) => { assert.equal(2 * m.lonePairs[i] + st.bonds.reduce((n, b) => n + (b.i === i || b.j === i ? b.order : 0), 0), EL.getBondingElement(a.symbol).valence, `${m.id} atom ${i}`); });
    assert.ok(minGap(st) > 0.1, `${m.id}: spheres overlap (gap ${minGap(st).toFixed(3)})`);
    for (const a of st.atoms) a.pos.forEach((c) => assert.ok(Number.isFinite(c)));
    const c = [0, 1, 2].map((ax) => (Math.min(...st.atoms.map((a) => a.pos[ax])) + Math.max(...st.atoms.map((a) => a.pos[ax]))) / 2); c.forEach((v) => assert.ok(Math.abs(v) < 1e-9, `${m.id} centred`));
  }
  const orders = (id) => moleculeStructure(CO.getMolecule(id)).bonds.map((b) => b.order);
  assert.deepEqual(orders("O2"), [2]); assert.deepEqual(orders("N2"), [3]); assert.deepEqual(orders("CH4"), [1, 1, 1, 1]);
  assert.equal(moleculeStructure(CO.getMolecule("PCl5")).bonds.length, 5); assert.equal(moleculeStructure(CO.getMolecule("BF3")).atoms.length, 4);
});

console.log("Lesson configuration");
test("config: initial mode, restricted modes, invalid input falls back safely", () => {
  assert.deepEqual(CF.normalizeConfig({ initialMode: "covalent", allowedModes: ["covalent"] }), { allowedModes: ["covalent"], initialMode: "covalent" });
  assert.deepEqual(CF.normalizeConfig({ initialMode: "metallic", allowedModes: ["ionic", "covalent"] }), { allowedModes: ["ionic", "covalent"], initialMode: "ionic" });
  assert.deepEqual(CF.normalizeConfig(undefined), { allowedModes: ["ionic", "covalent", "metallic"], initialMode: "ionic" });
  assert.deepEqual(CF.normalizeConfig({ initialMode: "x", allowedModes: ["zzz"] }).allowedModes, ["ionic", "covalent", "metallic"]);
  assert.deepEqual(CF.normalizeConfig({ initialMode: "metallic" }), { allowedModes: ["ionic", "covalent", "metallic"], initialMode: "metallic" });
  assert.deepEqual(CF.configFromSearch("?mode=covalent&modes=ionic,covalent"), { allowedModes: ["ionic", "covalent"], initialMode: "covalent" });
  assert.equal(CF.configFromSearch(""), null);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
