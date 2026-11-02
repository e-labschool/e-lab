// Learn mode: four guided demonstrations as DATA (step lists with target poses and effect flags). Pure; the 3D scene just
// evaluates lessonFrame(lesson, t) and draws the result. All geometry (poses) is built here once, at module load.
import { MOLECULES } from "./molecules.js";
import { FORCE_LABEL, acceptorPoseForHBond, hydrogenBonds } from "./imf.js";
import { QID, add, lerp, norm, qFromAxisAngle, qFromTo, qRot, qSlerp, scale, smoothstep, sub } from "./vec.js";

const pose = (pos, quat = QID) => ({ pos, quat });
const RZ180 = qFromAxisAngle([0, 0, 1], Math.PI);
const STEP_MOVE = 0.42; // fraction of a step spent moving to its poses; the rest is a hold

// ---- hydrogen-bond poses (computed from the geometry, never typed) ----------------------------------------------------------------
const H2O = MOLECULES.H2O;
const oh = norm(sub(H2O.atoms[1].p, H2O.atoms[0].p));
const donorQ = qFromTo(oh, [1, 0, 0]); // donor O-H1 points along +x
const donorAt = (x) => pose([x, 0, 0], donorQ);
const bondedAcceptor = (d) => acceptorPoseForHBond(H2O, donorAt(0), 0, 1, H2O, 0, d);
const farAcceptor = (() => { const b = bondedAcceptor(1.95); return pose(add(b.pos, [4.5, 0, 0]), b.quat); })();
// re-centre the dimer on the origin (donor shifted by -half of the O...O span)
const shiftX = -bondedAcceptor(1.95).pos[0] / 2;
const sh = (p) => pose(add(p.pos, [shiftX, 0, 0]), p.quat);

const Q90 = qFromAxisAngle([0, 0, 1], Math.PI / 2); // a diatomic turned to stand upright
/** Pose of molecule `id` with orientation q such that its atom `atomIdx` sits exactly at `target` (world). */
const placeAtom = (id, q, atomIdx, target) => pose(sub(target, qRot(q, MOLECULES[id].atoms[atomIdx].p)), q);
// effect flags of a step: gain/fixedDir = instantaneous dipole of the first molecule; induced = neighbour responds; attract = dashed attraction line;
// perm = permanent delta labels; dyn = temporary / induced delta labels; cloud = electron-distribution reveal (0 ball model .. 1 cloud); lobes = lone-pair lobes
const F0 = { gain: 0, fixedDir: null, induced: false, attract: false, perm: false, dyn: false, cloud: 0, lobes: false };
const fx = (o) => ({ ...F0, ...o });

// ---- A: London dispersion, H2 + H2 (upright, side by side) -------------------------------------------------------------------------
const aFar = [pose([-3.5, 0, 0], Q90), pose([3.5, 0, 0], Q90)]; const aNear = [pose([-1.75, 0, 0], Q90), pose([1.75, 0, 0], Q90)];
// ---- B: dipole-induced dipole, HCl + H2 -----------------------------------------------------------------------------------------------
const bH = placeAtom("HCl", RZ180, 0, [-1.4, 0, 0]); // H end faces the H2 molecule
const bCl = placeAtom("HCl", QID, 1, [-1.7, 0, 0]); // turned round: Cl end faces it
const bFar = pose([6.2, 0, 0], Q90); const bNear = pose([1.3, 0, 0], Q90);
// ---- C: dipole-dipole, HCl + HCl --------------------------------------------------------------------------------------------------
const cL = pose([-1.8, 0, 0]); const cRfar = pose([5.0, 0, 0], Q90); const cRfav = pose([1.78, 0, 0]); const cRunfav = pose([1.48, 0, 0], RZ180);

export const LESSONS = [
  {
    id: "ldf", force: "ldf", label: "London Dispersion", pair: ["H2", "H2"], summary: "H₂ + H₂: temporary dipoles",
    note: "London dispersion comes from correlated fluctuations of electron density in neighbouring molecules. The electron clouds do not need to collide or repel each other.",
    steps: [
      { id: "show", dur: 3.6, text: "Two hydrogen molecules, each two H atoms joined by a covalent bond (H–H).", poses: aFar, fx: fx({}) },
      { id: "nonpolar", dur: 4, text: "Hydrogen molecules are nonpolar because they have no permanent molecular dipole.", poses: aFar, fx: fx({ cloud: 1 }) },
      { id: "instant", dur: 4.2, text: "A temporary fluctuation in electron density produces an instantaneous dipole.", poses: aFar, fx: fx({ cloud: 1, gain: 1, fixedDir: [1, 0, 0], dyn: true }) },
      { id: "induce", dur: 4.2, text: "The instantaneous dipole induces a dipole in the neighbouring molecule.", poses: aNear, fx: fx({ cloud: 1, gain: 1, fixedDir: [1, 0, 0], induced: true, dyn: true }) },
      { id: "attract", dur: 4.6, text: "The temporary and induced dipoles attract one another through London dispersion forces.", poses: aNear, fx: fx({ cloud: 1, gain: 1, fixedDir: [1, 0, 0], induced: true, attract: true, dyn: true }) },
    ],
  },
  {
    id: "dip-ind", force: "dip-ind", label: "Dipole–Induced Dipole", pair: ["HCl", "H2"], summary: "HCl + H₂: induced polarisation",
    note: "A permanent dipole polarises any neighbouring electron cloud; the induced dipole always points so that the two attract.",
    steps: [
      { id: "show", dur: 3.6, text: "A hydrogen chloride molecule (H–Cl) and a hydrogen molecule (H–H), each with a covalent bond.", poses: [bH, bFar], fx: fx({}) },
      { id: "perm", dur: 4, text: "HCl is polar: the shared electrons lie closer to Cl, so H is δ⁺ and Cl is δ⁻.", poses: [bH, bFar], fx: fx({ cloud: 1, perm: true }) },
      { id: "induce", dur: 4.4, text: "As H₂ approaches, the electric field of HCl shifts its electron cloud towards the δ⁺ end.", poses: [bH, bNear], fx: fx({ cloud: 1, perm: true, induced: true, dyn: true }) },
      { id: "attract", dur: 4.4, text: "The induced dipole in H₂ is attracted to the permanent dipole of HCl.", poses: [bH, bNear], fx: fx({ cloud: 1, perm: true, induced: true, attract: true, dyn: true }) },
      { id: "reverse", dur: 4.6, text: "Turn HCl round and the induced polarisation reverses: the cloud now shifts towards δ⁻ Cl, and the attraction remains.", poses: [bCl, bNear], fx: fx({ cloud: 1, perm: true, induced: true, attract: true, dyn: true }) },
    ],
  },
  {
    id: "dip-dip", force: "dip-dip", label: "Dipole–Dipole", pair: ["HCl", "HCl"], summary: "HCl + HCl: orientation matters",
    note: "In a liquid the molecules keep tumbling, so favourable orientations dominate on average; not every orientation attracts equally.",
    steps: [
      { id: "show", dur: 3.6, text: "Two hydrogen chloride molecules, each a covalently bonded H–Cl pair.", poses: [cL, cRfar], fx: fx({}) },
      { id: "perm", dur: 4, text: "Each HCl has permanent partial charges: δ⁺ on H and δ⁻ on Cl.", poses: [cL, cRfar], fx: fx({ cloud: 1, perm: true }) },
      { id: "favour", dur: 4.4, text: "Rotate one molecule so that δ⁺ H faces δ⁻ Cl: the favourable orientation.", poses: [cL, cRfav], fx: fx({ cloud: 1, perm: true }) },
      { id: "attract", dur: 4.2, text: "Opposite partial charges face each other, so the molecules attract.", poses: [cL, cRfav], fx: fx({ cloud: 1, perm: true, attract: true }) },
      { id: "unfavour", dur: 4.6, text: "Rotate it the other way so like charges face each other: the interaction weakens and becomes repulsive.", poses: [cL, cRunfav], fx: fx({ cloud: 1, perm: true, attract: true }) },
    ],
  },
  {
    id: "hbond", force: "hbond", label: "Hydrogen Bonding", pair: ["H2O", "H2O"], summary: "H₂O + H₂O: directional H-bond",
    note: "A hydrogen bond is an intermolecular attraction between a δ⁺ H bonded to N, O or F and a lone pair on a neighbouring N, O or F. It is much weaker than the covalent O–H bond.",
    steps: [
      { id: "show", dur: 3.6, text: "Two water molecules, each bent (H–O–H, about 104.5°) with two covalent O–H bonds.", poses: [sh(donorAt(0)), sh(farAcceptor)], fx: fx({}) },
      { id: "perm", dur: 4, text: "In each water molecule the oxygen is δ⁻ and each hydrogen is δ⁺.", poses: [sh(donorAt(0)), sh(farAcceptor)], fx: fx({ cloud: 1, perm: true, lobes: true }) },
      { id: "approach", dur: 4.4, text: "Bring an O–H hydrogen of one molecule towards a lone-pair site on the oxygen of the other.", poses: [sh(donorAt(0)), sh(bondedAcceptor(2.7))], fx: fx({ cloud: 1, perm: true, lobes: true }) },
      { id: "bond", dur: 4.4, text: "A dashed O–H···O hydrogen bond forms between the molecules; it is not a covalent bond.", poses: [sh(donorAt(0)), sh(bondedAcceptor(1.95))], fx: fx({ cloud: 1, perm: true, lobes: true, attract: true }) },
      { id: "apart", dur: 4.6, text: "Move the molecules apart and the hydrogen bond weakens and disappears; each O–H covalent bond stays intact.", poses: [sh(donorAt(0)), sh(farAcceptor)], fx: fx({ cloud: 1, perm: true, lobes: true, attract: true }) },
    ],
  },
];
LESSONS.forEach((l) => { l.start = l.steps[0].poses; });
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const lessonDuration = (l) => l.steps.reduce((s, st) => s + st.dur, 0);
export const lessonStepStart = (l, k) => l.steps.slice(0, k).reduce((s, st) => s + st.dur, 0);
/** Time at which step k has finished moving (all poses / effects settled): Next / Previous jump here, so the state is shown at once. */
export const lessonStepSettled = (l, k) => lessonStepStart(l, k) + l.steps[k].dur * STEP_MOVE + 1e-3;

const ease = (x) => x * x * (3 - 2 * x);
const mixFx = (a, b, u) => ({ gain: a.gain + (b.gain - a.gain) * u, fixedDir: u < 0.5 ? a.fixedDir : b.fixedDir, induced: b.induced, attract: b.attract, perm: b.perm, dyn: b.dyn, lobes: b.lobes, cloud: a.cloud + (b.cloud - a.cloud) * u });
/** State of a lesson at time t (seconds from the start): { step, local (0..1 within the step), moving (0..1), poses[2], fx, done } */
export function lessonFrame(lesson, t) {
  const total = lessonDuration(lesson); const tt = Math.min(Math.max(t, 0), total - 1e-6); let k = 0; let acc = 0;
  while (k < lesson.steps.length - 1 && tt >= acc + lesson.steps[k].dur) { acc += lesson.steps[k].dur; k += 1; }
  const st = lesson.steps[k]; const local = (tt - acc) / st.dur; const moving = ease(Math.min(1, local / STEP_MOVE));
  const prev = k === 0 ? { poses: lesson.start, fx: st.fx } : lesson.steps[k - 1];
  const poses = st.poses.map((p, i) => pose(lerp(prev.poses[i].pos, p.pos, moving), qSlerp(prev.poses[i].quat, p.quat, moving)));
  return { step: k, local, moving, poses, fx: mixFx(prev.fx, st.fx, moving), done: t >= total, text: st.text };
}
/** Final poses of step k (used by the tests and by "Try in Explore" when a step is selected). */
export const stepPoses = (lesson, k) => lesson.steps[k].poses;
export { FORCE_LABEL, hydrogenBonds, qRot, scale, smoothstep };

/** Half extents (A) of everything a lesson ever shows, for the camera framing: { hw, hh }. */
export function lessonExtent(lesson) {
  let hw = 3; let hh = 2.5;
  for (const st of [{ poses: lesson.start }, ...lesson.steps]) st.poses.forEach((p, i) => { const r = MOLECULES[lesson.pair[i]].radius; hw = Math.max(hw, Math.abs(p.pos[0]) + r * 0.95); hh = Math.max(hh, Math.abs(p.pos[1]) + r * 0.95); });
  return { hw, hh };
}
