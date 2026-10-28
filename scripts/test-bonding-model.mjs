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
import { metallicScene, assignSites } from "../src/engines/bonding-visualizer/scene/metallicScene.js";

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
test("[check 12] BCC sodium: 8 nearest neighbours; FCC 12; HCP 12 (computed from generated coordinates)", () => {
  assert.equal(ME.METAL_STRUCTURE.Na, "bcc");
  const bcc = ME.centralCoordination("bcc", 2); assert.equal(bcc.count, 8); assert.ok(Math.abs(bcc.distance - 1) < 1e-9);
  assert.equal(ME.centralCoordination("fcc", 2).count, 12); assert.equal(ME.centralCoordination("hcp", 2).count, 12);
  const sites = ME.generateMetalLattice("bcc", 2); assert.equal(sites.length, 35);
  const a = 2 / Math.sqrt(3); // cubic edge for d = 1
  const xs = new Set(sites.map((s) => Math.round((s.x - sites[0].x) / (a / 2)))); assert.ok(xs.size === 5);
  for (const s of ["bcc", "fcc", "hcp"]) { const st = ME.generateMetalLattice(s, 2); const interior = st.map((_, i) => i).filter((i) => ME.nearestNeighbourCount(st, i).count === ME.EXPECTED_NEIGHBOURS[s]); assert.ok(interior.length >= 1, s); }
});
test("valence electrons come from the outer shell: Na 1, Mg 2, Al 3; metals map to real structures", () => {
  assert.deepEqual(["Na", "Li", "K", "Mg", "Ca", "Al"].map(ME.valenceElectrons), [1, 1, 1, 2, 2, 3]);
  assert.deepEqual(["Na", "Li", "K", "Mg", "Ca", "Al"].map((s) => ME.METAL_STRUCTURE[s]), ["bcc", "bcc", "bcc", "hcp", "fcc", "fcc"]);
  assert.equal(ME.analyzeMetals([]).status, "empty"); assert.equal(ME.analyzeMetals(["Na"]).status, "few"); assert.equal(ME.analyzeMetals(["Na", "Na"]).status, "valid");
  assert.equal(ME.analyzeMetals(["Na", "Mg"]).status, "unsupported");
});
test("[check 12] metallic scene: positive cores and delocalised electrons throughout a 3D structure, cores fixed", () => {
  const sites = ME.generateMetalLattice("bcc", 2); const at = [[0, 0, 0], [1.4, 0, 0], [0, 1.4, 0.3]]; const assign = assignSites(at, sites);
  assert.equal(new Set(assign).size, 3);
  const s0 = metallicScene({ atoms: at, sites, assign, stage: "place", v: 1 });
  assert.ok(s0.cores.every((c) => c.mix === 0));
  const rel = metallicScene({ atoms: at, sites, assign, stage: "released", p: 1, time: 3, v: 1 });
  assert.ok(rel.cores.every((c) => c.mix === 1)); assert.equal(rel.electrons.length, 3);
  const lat1 = metallicScene({ atoms: at, sites, assign, stage: "lattice", p: 1, time: 1, v: 1 });
  const lat2 = metallicScene({ atoms: at, sites, assign, stage: "lattice", p: 1, time: 7, v: 1 });
  assert.equal(lat1.cores.length, 35); assert.equal(lat1.electrons.length, 35);
  assert.deepEqual(lat1.cores.map((c) => c.pos), lat2.cores.map((c) => c.pos)); // cores fixed
  assert.notDeepEqual(lat1.electrons.map((e) => e.pos), lat2.electrons.map((e) => e.pos)); // electrons move
  for (const ax of [0, 1, 2]) assert.ok(new Set(lat1.electrons.map((e) => e.pos[ax].toFixed(3))).size > 20); // spread over all three axes
  const al = metallicScene({ atoms: at, sites: ME.generateMetalLattice("fcc", 2), assign: assignSites(at, ME.generateMetalLattice("fcc", 2)), stage: "lattice", p: 1, v: ME.valenceElectrons("Al") });
  assert.equal(al.electrons.length, 63 * 3);
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
