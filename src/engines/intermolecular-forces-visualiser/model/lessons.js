// Learn mode: four guided demonstrations as DATA (step lists with target poses and effect flags). Pure; the 3D scene just
// evaluates lessonFrame(lesson, t) and draws the result. All geometry (poses) is built here once, at module load.
import { MOLECULES } from "./molecules.js";
import { FORCE_LABEL, acceptorPoseForHBond, hydrogenBonds } from "./imf.js";
import { QID, add, lerp, norm, qFromAxisAngle, qFromTo, qRot, qSlerp, scale, smoothstep, sub } from "./vec.js";

const pose = (pos, quat = QID) => ({ pos, quat });
const RZ180 = qFromAxisAngle([0, 0, 1], Math.PI);
const STEP_MOVE = 0.55; // fraction of a step spent moving to its poses; the rest is a hold

// ---- hydrogen-bond poses (computed from the geometry, never typed) ----------------------------------------------------------------
const H2O = MOLECULES.H2O;
const oh = norm(sub(H2O.atoms[1].p, H2O.atoms[0].p));
const donorQ = qFromTo(oh, [1, 0, 0]); // donor O-H1 points along +x
const donorAt = (x) => pose([x, 0, 0], donorQ);
const bondedAcceptor = (d) => acceptorPoseForHBond(H2O, donorAt(0), 0, 1, H2O, 0, d);
const farAcceptor = (() => { const b = bondedAcceptor(1.95); return pose(add(b.pos, [4.5, 0, 0]), b.quat); })();
const misAcceptor = (() => { const b = bondedAcceptor(1.95); const twist = qFromAxisAngle([0, 1, 0], Math.PI); const q = (a, c) => [a[3] * c[0] + a[0] * c[3] + a[1] * c[2] - a[2] * c[1], a[3] * c[1] - a[0] * c[2] + a[1] * c[3] + a[2] * c[0], a[3] * c[2] + a[0] * c[1] - a[1] * c[0] + a[2] * c[3], a[3] * c[3] - a[0] * c[0] - a[1] * c[1] - a[2] * c[2]]; return pose(b.pos, q(twist, b.quat)); })();
// re-centre the dimer on the origin (donor shifted by -half of the O...O span)
const shiftX = -bondedAcceptor(1.95).pos[0] / 2;
const sh = (p) => pose(add(p.pos, [shiftX, 0, 0]), p.quat);

export const LESSONS = [
  {
    id: "ldf", force: "ldf", label: "London Dispersion", pair: ["H2", "H2"],
    summary: "H₂ + H₂: temporary dipoles", start: [pose([-5.5, 0, 0]), pose([5.5, 0, 0])],
    steps: [
      { id: "approach", dur: 4.5, text: "Two nonpolar H₂ molecules approach; on average each electron cloud is symmetric.", poses: [pose([-1.9, 0, 0]), pose([1.9, 0, 0])], fx: { gain: 0, fixedDir: null, induced: false, attract: false, labels: false } },
      { id: "fluctuate", dur: 4.5, text: "At one instant the electrons in the left molecule bunch up on one side, a temporary dipole (δ⁺/δ⁻).", poses: [pose([-1.9, 0, 0]), pose([1.9, 0, 0])], fx: { gain: 1, fixedDir: [1, 0, 0], induced: false, attract: false, labels: true } },
      { id: "induce", dur: 4.5, text: "Its electric field pushes the electrons of the neighbour away from the δ⁺ side: an induced dipole forms in the right molecule.", poses: [pose([-1.9, 0, 0]), pose([1.9, 0, 0])], fx: { gain: 1, fixedDir: [1, 0, 0], induced: true, attract: false, labels: true } },
      { id: "attract", dur: 5.5, text: "Adjacent δ⁺ and δ⁻ regions attract: this correlated flicker is the London dispersion force, present between all particles.", poses: [pose([-1.9, 0, 0]), pose([1.9, 0, 0])], fx: { gain: 1, fixedDir: null, induced: true, attract: true, labels: true } },
    ],
  },
  {
    id: "dip-ind", force: "dip-ind", label: "Dipole–Induced Dipole", pair: ["HCl", "Ar"],
    summary: "HCl + Ar: induced polarisation", start: [pose([0, 0, 0], RZ180), pose([9, 0, 0])],
    steps: [
      { id: "setup", dur: 4.5, text: "HCl has a permanent dipole (H is δ⁺, Cl is δ⁻); the argon atom's electron cloud is symmetric.", poses: [pose([0, 0, 0], RZ180), pose([9, 0, 0])], fx: { gain: 0, fixedDir: null, induced: false, attract: false, labels: true } },
      { id: "induce", dur: 4.5, text: "As Ar comes near the δ⁺ end, the HCl field pulls Ar's electrons toward it, making the near side δ⁻: an induced dipole.", poses: [pose([0, 0, 0], RZ180), pose([4.5, 0, 0])], fx: { gain: 0, fixedDir: null, induced: true, attract: false, labels: true } },
      { id: "attract", dur: 4.5, text: "The permanent δ⁺ end attracts the induced δ⁻ side, and the induced dipole vanishes again if the molecules separate.", poses: [pose([0, 0, 0], RZ180), pose([4.5, 0, 0])], fx: { gain: 0, fixedDir: null, induced: true, attract: true, labels: true } },
      { id: "reverse", dur: 5.5, text: "Turn HCl around so δ⁻ Cl faces Ar: the induced dipole reverses (near side δ⁺) and the force is still attractive.", poses: [pose([1.04, 0, 0], QID), pose([4.5, 0, 0])], fx: { gain: 0, fixedDir: null, induced: true, attract: true, labels: true } },
    ],
  },
  {
    id: "dip-dip", force: "dip-dip", label: "Dipole–Dipole", pair: ["HCl", "HCl"],
    summary: "HCl + HCl: orientation matters", start: [pose([-4, 0, 0]), pose([4, 0, 0])],
    steps: [
      { id: "setup", dur: 4.5, text: "Each HCl molecule has a permanent dipole, δ⁺ on H and δ⁻ on Cl.", poses: [pose([-2.1, 0, 0]), pose([6.3, 0, 0])], fx: { gain: 0, fixedDir: null, induced: false, attract: false, labels: true } },
      { id: "repel", dur: 4.5, text: "With the two δ⁻ Cl ends facing each other the electrostatic arrangement is unfavourable (repulsive).", poses: [pose([-2.2, 0, 0]), pose([2.2, 0, 0], RZ180)], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
      { id: "attract", dur: 5, text: "Rotate one molecule so δ⁺ H faces δ⁻ Cl and the arrangement becomes attractive.", poses: [pose([-2.1, 0, 0]), pose([2.08, 0, 0])], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
      { id: "summary", dur: 5, text: "So dipole–dipole attraction depends on orientation and distance; in a liquid the molecules keep turning, and favourable orientations win on average.", poses: [pose([-2.1, 0, 0]), pose([2.08, 0, 0])], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
    ],
  },
  {
    id: "hbond", force: "hbond", label: "Hydrogen Bonding", pair: ["H2O", "H2O"],
    summary: "H₂O + H₂O: directional H-bond", start: [sh(donorAt(0)), sh(farAcceptor)],
    steps: [
      { id: "setup", dur: 4.5, text: "Each water has δ⁺ hydrogens bonded to O and, on oxygen, δ⁻ lone pairs (the small lobes) that can accept a hydrogen.", poses: [sh(donorAt(0)), sh(farAcceptor)], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
      { id: "misaligned", dur: 4.5, text: "Close is not enough: if the O–H does not point at a lone pair there is no hydrogen bond.", poses: [sh(donorAt(0)), sh(misAcceptor)], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
      { id: "bond", dur: 5, text: "When X–H···A is nearly straight and the H meets a lone pair, a dashed hydrogen bond appears between the molecules.", poses: [sh(donorAt(0)), sh(bondedAcceptor(1.95))], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
      { id: "summary", dur: 5, text: "A hydrogen bond is a strong, directional dipole–dipole attraction between molecules, quite different from the covalent O–H bond inside each one.", poses: [sh(donorAt(0)), sh(bondedAcceptor(1.95))], fx: { gain: 0, fixedDir: null, induced: false, attract: true, labels: true } },
    ],
  },
];
export const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
export const lessonDuration = (l) => l.steps.reduce((s, st) => s + st.dur, 0);
export const lessonStepStart = (l, k) => l.steps.slice(0, k).reduce((s, st) => s + st.dur, 0);

const ease = (x) => x * x * (3 - 2 * x);
const mixFx = (a, b, u) => ({ gain: a.gain + (b.gain - a.gain) * u, fixedDir: u < 0.5 ? a.fixedDir : b.fixedDir, induced: u < 0.5 ? a.induced : b.induced, attract: u < 0.5 ? a.attract : b.attract, labels: b.labels });
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
