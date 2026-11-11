#!/usr/bin/env node
// Model checks for the Structure Investigation tab:  node scripts/test-structure-model.mjs
// The chemistry of every compound is re-derived here WITHOUT the derive code of structure/model/graph.js (own valence / adjacency / equivalence code)
// and compared with the record the UI uses. Honest limit: this proves internal consistency (one identity, formula <-> mass <-> spectra <-> structure);
// it cannot prove that the entered shifts / intensities are right (they are representative values, see docs/STRUCTURE_INVESTIGATION.md).
import assert from "node:assert/strict";
import { register } from "node:module";
register("./jsx-loader-hooks.mjs", import.meta.url);

const { COMPOUNDS, COMPOUND_IDS } = await import("../src/engines/spectroscopy-studio/structure/data/compounds.js");
const { STRUCTURES, STRUCTURE_IDS } = await import("../src/engines/spectroscopy-studio/structure/data/structures.js");
const { LEVELS, compoundsOfLevel, choiceOrder, sampleId, justificationOk, wordCount } = await import("../src/engines/spectroscopy-studio/structure/model/levels.js");
const { conflictsFor, feedbackFor, hintsFor, explanationFor, PROMPTS } = await import("../src/engines/spectroscopy-studio/structure/model/evaluate.js");
const { buildSignals, regionsOf, integrationValues } = await import("../src/engines/spectroscopy-studio/structure/model/nmrSignals.js");
const { SPECTRA } = await import("../src/engines/spectroscopy-studio/ms/data/spectra.js");
const { COMPOUNDS: IR_COMPOUNDS } = await import("../src/engines/spectroscopy-studio/ir/data/compounds.js");
const { INTERPRET_BY_ID } = await import("../src/engines/spectroscopy-studio/ir/physics/functionalGroups.js");
const { MOLECULE_BY_ID } = await import("../src/engines/spectroscopy-studio/nmr/molecular/model/molecules.js");

let passed = 0; let failed = 0;
function test(name, fn) { try { fn(); console.log(`  ok   ${name}`); passed += 1; } catch (e) { console.log(`  FAIL ${name}\n       ${(e.stack || e.message).split("\n").slice(0, 5).join("\n       ")}`); failed += 1; } }

// ------------------------------------------------------------ independent chemistry
const VAL = { C: 4, O: 2 }; const NOM = { C: 12, H: 1, O: 16 }; const AVG = { C: 12.011, H: 1.008, O: 15.999 };
function derive(st) {
  const ids = st.atoms.map((a) => a.id); const el = Object.fromEntries(st.atoms.map((a) => [a.id, a.el]));
  const adj = Object.fromEntries(ids.map((i) => [i, []]));
  for (const [a, b, o] of st.bonds) { adj[a].push([b, o]); adj[b].push([a, o]); }
  const h = Object.fromEntries(ids.map((i) => [i, VAL[el[i]] - adj[i].reduce((s, [, o]) => s + o, 0)]));
  for (const i of ids) assert.ok(h[i] >= 0, `${st.id}: valence of ${i}`);
  // equivalence classes by iterative refinement (element, H count, sorted neighbour classes with bond order)
  let cls = Object.fromEntries(ids.map((i) => [i, `${el[i]}${h[i]}`]));
  for (let k = 0; k < ids.length + 1; k += 1) {
    const next = Object.fromEntries(ids.map((i) => [i, `${cls[i]}(${adj[i].map(([j, o]) => `${o}${cls[j]}`).sort().join(",")})`]));
    const remap = new Map(); let n = 0; const norm = {};
    for (const i of ids) { if (!remap.has(next[i])) remap.set(next[i], `k${n++}`); norm[i] = remap.get(next[i]); }
    if (new Set(Object.values(norm)).size === new Set(Object.values(cls)).size) { cls = norm; break; }
    cls = norm;
  }
  const count = (e) => ids.filter((i) => el[i] === e).length;
  const C = count("C"); const O = count("O"); const H = ids.reduce((s, i) => s + h[i], 0);
  const carbonyl = (i) => el[i] === "C" && adj[i].some(([j, o]) => o === 2 && el[j] === "O");
  const groups = new Set();
  for (const i of ids) {
    if (el[i] === "O" && h[i] > 0) groups.add(adj[i].some(([j]) => carbonyl(j)) ? "oh-acid" : "oh-alc");
    if (carbonyl(i)) { groups.add("cdo"); if (h[i] > 0) groups.add("aldch"); }
  }
  for (const [a, b, o] of st.bonds) if (o === 2 && el[a] === "C" && el[b] === "C") groups.add("cdc");
  return { ids, el, adj, h, cls, C, O, H, groups, nominal: C * 12 + H + O * 16, mass: C * AVG.C + H * AVG.H + O * AVG.O };
}
const hillOf = (C, H, O) => `C${C > 1 ? C : ""}H${H > 1 ? H : ""}${O ? `O${O > 1 ? O : ""}` : ""}`;
/** The signals of a structure, counted from the adjacency only: groups of H-bearing atoms by class. */
function envs(d) {
  const by = new Map();
  for (const i of d.ids) if (d.h[i] > 0) { const c = d.cls[i]; by.set(c, [...(by.get(c) ?? []), i]); }
  return [...by.entries()].map(([c, atoms]) => {
    const i = atoms[0]; const exch = d.el[i] === "O";
    // hydrogens on neighbouring CARBON atoms of a different class (vicinal H-C-C-H); O-H is exchange-broadened and not split
    const nb = exch ? 0 : d.adj[i].filter(([j]) => d.el[j] === "C" && d.cls[j] !== c).reduce((s, [j]) => s + d.h[j], 0);
    return { c, atoms, n: atoms.length * d.h[i], exch, nb };
  });
}
const parseComp = (s) => { const m = {}; for (const [, e, n] of s.matchAll(/([CHO])(\d*)/g)) m[e] = (m[e] ?? 0) + (n ? +n : 1); return m; };
const nomOfComp = (s) => Object.entries(parseComp(s)).reduce((t, [e, n]) => t + NOM[e] * n, 0);

// ------------------------------------------------------------ the library
console.log("Library: 8 unknowns, every required compound present");
test("ethanol, propan-2-ol, propanal, propanone, ethanoic acid and ethyl ethanoate are unknowns; all unknowns exist as structures", () => {
  for (const id of ["ethanol", "propan-2-ol", "propanal", "propanone", "ethanoic-acid", "ethyl-ethanoate"]) assert.ok(COMPOUNDS[id], id);
  assert.ok(COMPOUND_IDS.length >= 6);
  for (const id of COMPOUND_IDS) assert.ok(STRUCTURES[id], `structure ${id}`);
  assert.equal(new Set(COMPOUND_IDS).size, COMPOUND_IDS.length);
});
test("every level has at least two unknowns and the levels partition the unknowns", () => {
  for (const l of LEVELS) assert.ok(compoundsOfLevel(l.id).length >= 2, l.id);
  assert.equal(LEVELS.flatMap((l) => compoundsOfLevel(l.id)).length, COMPOUND_IDS.length);
});

for (const id of COMPOUND_IDS) {
  const c = COMPOUNDS[id]; const st = STRUCTURES[id]; const d = derive(st);
  console.log(`Compound ${id}`);
  test("formula, molar mass, nominal mass and DoU agree with the drawn structure", () => {
    assert.equal(c.formula, hillOf(d.C, d.H, d.O)); assert.equal(c.nominal, d.nominal);
    assert.ok(Math.abs(c.molarMass - d.mass) < 0.02, `${c.molarMass} vs ${d.mass}`);
    assert.equal(c.dou, (2 * d.C + 2 - d.H) / 2);
    assert.equal(c.skeleton.atoms.length, st.atoms.length);
    // the drawn skeleton is the same graph
    for (const b of c.skeleton.bonds) { const A = c.skeleton.atoms[b.a]?.id ?? b.a; const B = c.skeleton.atoms[b.b]?.id ?? b.b; assert.ok(st.bonds.some(([x, y, o]) => o === b.order && ((x === A && y === B) || (x === B && y === A))), `bond ${A}-${B}`); }
  });
  test("MS: M+• peak = molar mass (nominal); exactly one 100 % peak; base peak declared correctly", () => {
    const M = c.ms.peaks.filter((p) => p.role === "M"); assert.equal(M.length, 1);
    assert.equal(M[0].mz, c.nominal); assert.equal(c.ms.mMz, c.nominal);
    assert.equal(M[0].charge, "+•"); assert.equal(M[0].comp, c.formula);
    assert.equal(c.ms.peaks.filter((p) => p.rel === 100).length, 1);
    assert.equal(c.ms.byMz[c.ms.baseMz].rel, 100);
    assert.ok(c.ms.peaks.every((p) => p.rel > 0 && p.rel <= 100));
    assert.equal(new Set(c.ms.peaks.map((p) => p.mz)).size, c.ms.peaks.length, "duplicate m/z");
    assert.ok(c.ms.peaks.every((p) => p.mz <= c.nominal + 1), "peak above M+1");
  });
  test("MS: every fragment's nominal mass equals its m/z; radical-dot convention (+• iff the H count is even; none with halogens here)", () => {
    for (const p of c.ms.peaks) {
      const m = parseComp(p.comp);
      if (p.role === "isotope") { assert.equal(p.mz, nomOfComp(p.comp) + 1, `isotope ${p.mz}`); continue; }
      assert.equal(nomOfComp(p.comp), p.mz, `${p.label}: ${p.comp} = ${nomOfComp(p.comp)}, m/z ${p.mz}`);
      assert.equal(p.charge, (m.H ?? 0) % 2 === 0 ? "+•" : "+", `${p.label} (${p.comp}): charge ${p.charge}`);
      assert.ok(p.label.endsWith(p.charge === "+•" ? "⁺•" : "⁺"), `label ${p.label}`);
      // an ion cannot contain more atoms than the molecule
      for (const e of Object.keys(m)) assert.ok(m[e] <= parseComp(c.formula)[e], `${p.comp} has too many ${e}`);
    }
  });
  test("IR: diagnostic groups present / absent as the structure requires; bands lie inside their group's range; absent groups give no band in their range", () => {
    for (const g of ["oh-alc", "oh-acid", "cdo", "aldch", "cdc"]) assert.equal(c.ir.groups.includes(g), d.groups.has(g), `${g} presence`);
    assert.ok(c.ir.groups.includes("ch"), "C-H stretch");
    assert.equal(c.ir.groups.includes("co"), st.bonds.some(([a, b, o]) => o === 1 && [d.el[a], d.el[b]].sort().join("") === "CO"), "C-O");
    for (const b of c.ir.bands) {
      if (b.group) { const g = INTERPRET_BY_ID[b.group]; assert.ok(b.nu >= g.range[0] && b.nu <= g.range[1], `band ${b.nu} (${b.group}) outside ${g.range}`); }
      assert.ok(b.nu >= 400 && b.nu <= 4000 && b.A > 0 && b.fwhm > 0);
    }
    for (const gid of ["oh-alc", "oh-acid", "cdo", "cdc"]) if (!d.groups.has(gid)) {
      const g = INTERPRET_BY_ID[gid];
      assert.ok(!c.ir.bands.some((b) => b.nu >= g.range[0] && b.nu <= g.range[1] && b.A > 0.15 && !(gid === "oh-acid")), `${id}: a band inside the absent ${gid} range`);
    }
  });
  test("1H NMR: number of environments, hydrogens per signal, integration sum = H count, n + 1, exchangeable O-H as broad singlet", () => {
    const e = envs(d); const sig = c.nmr.signals;
    assert.equal(sig.length, e.length, "number of signals");
    assert.equal(sig.reduce((s, x) => s + x.n, 0), d.H); assert.equal(sig.reduce((s, x) => s + x.integration, 0), d.H);
    assert.deepEqual(sig.map((s) => s.n).sort(), e.map((x) => x.n).sort());
    for (const s of sig) {
      const ex = e.find((x) => x.atoms.includes(s.atoms[0]) || s.atoms.some((a) => x.atoms.includes(a))); assert.ok(ex, `signal ${s.id} atoms`);
      assert.equal(s.n, ex.n, `${s.id} H`); assert.equal(s.exchangeable, ex.exch); assert.equal(s.nNeighbours, ex.nb, `${s.id}: neighbours`);
      const lines = s.couplings.reduce((p, k) => p * (k.nH + 1), 1);
      const spins = s.couplings.reduce((t, k) => t + k.nH, 0); assert.equal(spins, s.nNeighbours);
      if (s.exchangeable) { assert.equal(s.multiplicity, "singlet"); assert.ok(s.linewidthHz > 5, "O-H must be broad"); assert.equal(s.couplings.length, 0); }
      else if (s.nNeighbours === 0) assert.equal(s.multiplicity, "singlet");
      else if (s.couplings.length === 1 || s.couplings.every((k) => k.J === s.couplings[0].J)) {
        assert.equal(s.nPlusOne, true);
        assert.equal(s.multiplicity.replace(" (apparent)", ""), ["singlet", "doublet", "triplet", "quartet", "quintet", "sextet", "septet"][s.nNeighbours], `${s.id} n+1`);
      }
      assert.ok(lines >= 1);
    }
    // every coupling is mutual (A sees B with nH(B) <=> B sees A with nH(A)), and J symmetric
    for (const s of sig) for (const k of s.couplings) {
      const o = sig.find((t) => t.id === k.with); assert.ok(o, "coupling partner");
      const back = o.couplings.find((q) => q.with === s.id); assert.ok(back, `${s.id}<->${o.id} not mutual`); assert.equal(back.J, k.J);
    }
  });
  test("1H NMR: shifts inside typical ranges (TMS = 0), decreasing order, built signals integrate to the H count, D2O removes exactly the O-H", () => {
    const sh = c.nmr.signals.map((s) => s.shift); assert.deepEqual(sh, [...sh].sort((a, b) => b - a));
    assert.ok(sh.every((x) => x > 0 && x < 14));
    for (const s of c.nmr.signals) { if (s.exchangeable) assert.ok(s.shift >= 1 && s.shift <= 13); }
    const sigs = buildSignals(c); assert.equal(sigs.reduce((s, x) => s + x.area, 0), d.H);
    for (const x of sigs) { const cp = x.sig.couplings; const eq = cp.every((k) => k.J === cp[0].J); assert.equal(x.nLines, eq ? cp.reduce((t, k) => t + k.nH, 0) + 1 : cp.reduce((p, k) => p * (k.nH + 1), 1)); }
    const reg = regionsOf(sigs); assert.equal(reg.reduce((s, r) => s + r.n, 0), d.H); assert.equal(reg.flatMap((r) => r.ids).length, sigs.length);
    const iv = integrationValues(reg, "count"); assert.equal(Object.values(iv).reduce((s, v) => s + v.value, 0), d.H);
    const dry = buildSignals(c, { d2o: true }); const nEx = c.nmr.signals.filter((s) => s.exchangeable).length;
    assert.equal(dry.length, sigs.length - nEx); assert.equal(dry.reduce((s, x) => s + x.n, 0), d.H - c.nmr.signals.filter((s) => s.exchangeable).reduce((t, s) => t + s.n, 0));
  });
  test("choices: four distinct structures including the answer, deterministic order, Foundation / Intermediate / Advanced rules", () => {
    assert.equal(c.choices.length, 4); assert.equal(new Set(c.choices).size, 4); assert.ok(c.choices.includes(id));
    for (const x of c.choices) assert.ok(STRUCTURES[x], x);
    assert.deepEqual(choiceOrder(id), choiceOrder(id)); assert.deepEqual([...choiceOrder(id)].sort(), [...c.choices].sort());
    if (c.level !== "foundation") for (const x of c.choices) assert.equal(derive(STRUCTURES[x]).nominal === c.nominal || x === "ethanoic-acid", true, `${id}: ${x} should share M (or be the deliberate formula-different acid)`);
  });
  test("every wrong choice conflicts with the evidence in at least one way, and the feedback never names the answer", () => {
    for (const x of c.choices.filter((y) => y !== id)) {
      const cf = conflictsFor(c, x); assert.ok(cf.length >= 1, `${id} vs ${x}: no conflict found`);
      const fb = feedbackFor(c, x); assert.equal(fb.correct, false); assert.ok(fb.conflicts.length >= 1);
      const text = `${fb.text} ${fb.conflicts.map((k) => k.text).join(" ")}`.toLowerCase();
      for (const nm of [c.name, ...c.aliases]) assert.ok(!text.includes(nm.toLowerCase()), `feedback names "${nm}": ${text}`);
      assert.ok(!text.includes(c.condensed.toLowerCase()));
    }
    assert.equal(feedbackFor(c, id).correct, true); assert.equal(conflictsFor(c, id).length, 0, `${id}: the right answer has conflicts`);
  });
  test("hints never contain the name, formula-class words or condensed formula of the answer", () => {
    const banned = [c.name, ...c.aliases, c.condensed, "alcohol", "aldehyde", "ketone", "carboxylic", "ester", "ether"].map((s) => s.toLowerCase());
    for (const l of LEVELS) for (const hnt of hintsFor(c, l.id)) for (const b of banned) assert.ok(!hnt.toLowerCase().includes(b), `hint contains "${b}": ${hnt}`);
    for (const k of Object.keys(PROMPTS)) for (const p of PROMPTS[k]) for (const b of [c.name, ...c.aliases]) assert.ok(!`${p.q} ${p.a}`.toLowerCase().includes(b.toLowerCase()));
  });
  test("the full explanation covers MS, IR and 1H NMR and the rejected choices", () => {
    const ex = explanationFor(c); assert.deepEqual(ex.sections.map((s) => s.tech), ["ms", "ir", "nmr", "others"]);
    for (const s of ex.sections) assert.ok(s.lines.length >= 1, s.tech);
    assert.equal(ex.sections[3].lines.length, 3); assert.equal(ex.sections[2].lines.length, c.nmr.signals.length);
    assert.match(ex.conclusion, new RegExp(c.name.replace(/[()]/g, "\\$&")));
  });
}

// ------------------------------------------------------------ distractor structures
console.log("Structure library");
test("every structure has a consistent formula / mass; all four-choice isomer sets share a molar mass where the level promises it", () => {
  for (const id of STRUCTURE_IDS) { const d = derive(STRUCTURES[id]); assert.equal(STRUCTURES[id].formula, hillOf(d.C, d.H, d.O), id); assert.equal(STRUCTURES[id].nominal, d.nominal, id); assert.ok(Math.abs(STRUCTURES[id].molarMass - d.mass) < 0.02); }
});
test("Foundation distractors: at least one shares the molar mass (an isomer) so formula alone is not enough for every unknown", () => {
  const ok = compoundsOfLevel("foundation").filter((id) => COMPOUNDS[id].choices.some((x) => x !== id && STRUCTURES[x].nominal === COMPOUNDS[id].nominal));
  assert.ok(ok.length >= 2);
});
test("choice order is deterministic and the correct answer is not always in the same position", () => {
  const pos = COMPOUND_IDS.map((id) => choiceOrder(id).indexOf(id)); assert.ok(new Set(pos).size >= 3, `positions ${pos}`);
});
test("sample ids are unique, level-lettered and stable", () => {
  const ids = LEVELS.flatMap((l) => compoundsOfLevel(l.id).map((_, i) => sampleId(l.id, i))); assert.equal(new Set(ids).size, ids.length);
  assert.ok(!ids.some((s) => COMPOUND_IDS.some((c) => s.toLowerCase().includes(c))));
});
test("Advanced justification: needs a real sentence", () => {
  assert.equal(justificationOk(""), false); assert.equal(justificationOk("it is the one"), false);
  assert.equal(justificationOk("The molecular ion at 60 and the broad O-H band with a doublet of six hydrogens show it."), true); assert.equal(wordCount("  a  b "), 2);
});

// ------------------------------------------------------------ one identity with the existing MS / IR / NMR workspaces
console.log("Consistency with the existing MS / IR / NMR workspaces");
test("MS peaks of ethanol, propanone and butanone are the MS workspace's peaks", () => {
  for (const id of ["ethanol", "propanone", "butanone"]) {
    const mine = COMPOUNDS[id].ms.peaks.filter((p) => p.role !== "isotope" || SPECTRA[id].peaks.some((q) => q.mz === p.mz));
    for (const q of SPECTRA[id].peaks) { const p = COMPOUNDS[id].ms.byMz[q.mz]; assert.ok(p, `${id} m/z ${q.mz}`); assert.equal(p.rel, q.rel); assert.equal(p.comp, q.comp); assert.equal(p.charge, q.charge); }
    assert.ok(mine.length >= 3);
  }
});
test("IR bands of ethanol, ethanoic acid, propanone, ethyl ethanoate and propan-1-ol are the IR workspace's bands", () => {
  for (const id of ["ethanol", "ethanoic-acid", "propanone", "ethyl-ethanoate", "propan-1-ol"]) {
    const a = COMPOUNDS[id].ir.bands; const b = IR_COMPOUNDS[id].bands; assert.equal(a.length, b.length, id);
    a.forEach((x, i) => { assert.equal(x.nu, b[i].nu); assert.equal(x.fwhm, b[i].fwhm); assert.equal(x.A, b[i].A); });
  }
});
test("1H shifts equal the NMR workspace's values where that workspace has the molecule (propan-1-ol's O-H is deliberately moved to 1.7 ppm for the Advanced overlap)", () => {
  for (const id of ["ethanol", "propan-2-ol", "propan-1-ol", "propanone", "ethyl-ethanoate"]) {
    const m = MOLECULE_BY_ID[id]; assert.ok(m, id);
    const theirs = m.environments.filter((e) => !(id === "propan-1-ol" && e.exchangeable)).map((e) => [e.delta, e.count].join("/")).sort();
    const mine = COMPOUNDS[id].nmr.signals.filter((s) => !(id === "propan-1-ol" && s.exchangeable)).map((s) => [s.shift, s.n].join("/")).sort();
    assert.deepEqual(mine, theirs, id);
    for (const e of m.environments) assert.equal(Boolean(e.exchangeable), COMPOUNDS[id].nmr.signals.some((s) => s.exchangeable && s.shift === e.delta) || (id === "propan-1-ol" && e.exchangeable));
    const J = m.couplings[0]?.J; if (J !== undefined) assert.equal(COMPOUNDS[id].nmr.J, J, `${id} J`);
  }
});
test("Advanced propan-1-ol has overlapping signals (O-H under a CH2) and ethyl ethanoate the four-signal-free three-signal pattern", () => {
  const sig = buildSignals(COMPOUNDS["propan-1-ol"]); assert.ok(regionsOf(sig).some((r) => r.overlapped));
  assert.equal(COMPOUNDS["ethyl-ethanoate"].nmr.signals.length, 3);
});
test("determinism: building the same compound twice gives identical data (no random spectra)", () => {
  const a = JSON.stringify(buildSignals(COMPOUNDS.propanal)); const b = JSON.stringify(buildSignals(COMPOUNDS.propanal)); assert.equal(a, b);
  assert.ok(!/Math\.random/.test(String(choiceOrder)));
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
