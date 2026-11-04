// Snap to Overlap: find the nearest placement of the MOVING atom (position + orientation of its whole orbital set) at which
// one of its orbitals forms a valid overlap with an orbital of another atom, then add the twist about the bond axis that
// lines up parallel p orbitals for pi bonding. Candidates are verified with the SAME overlap engine used for detection, so a
// snap can only ever produce a bond that the engine itself accepts. Pure (no React / three).
import { atomOrbitalInstances, analyseBonds, distanceWindow, evaluatePair, sigmaCompatible } from "./overlap.js";
import { P_AXIS } from "./orbitals.js";
import { sub, add, scale, dot, len, normalize, neg, qMul, qFromUnitVectors, qFromAxisAngle, qRotate, signedAngleAbout } from "./vec.js";


function facingOptionsPartner(ob, awayFromN) {
  if (ob.cls === "s") return [{ dir: awayFromN, sign: 1 }];
  if (ob.cls === "p") return [{ dir: ob.axis, sign: 1 }, { dir: neg(ob.axis), sign: -1 }];
  return [{ dir: ob.axis, sign: 1 }]; // hybrid: its large (+) lobe
}
function facingOptionsMoving(oa) {
  if (oa.cls === "s") return [{ lobe: null, sign: 1 }];
  if (oa.cls === "p") return [{ lobe: oa.axis, sign: 1 }, { lobe: neg(oa.axis), sign: -1 }];
  return [{ lobe: oa.axis, sign: 1 }];
}
const withAtom = (atoms, id, pos, quat) => atoms.map((a) => (a.id === id ? { ...a, pos, quat } : a));
const bondsBetween = (atoms, idA, idB) => {
  const inst = atoms.filter((a) => a.id === idA || a.id === idB).flatMap(atomOrbitalInstances);
  return analyseBonds(inst).bonds;
};

/**
 * planSnap(atoms, movingId, usedKeys?) -> { pos, quat, target: atomId, bonds: [labels], sigma, pi, cost } | null
 * `used` = orbital keys that already carry a bond with some OTHER atom (those orbitals are not offered again).
 */
export function planSnap(atoms, movingId) {
  const M = atoms.find((a) => a.id === movingId); if (!M) return null;
  const current = analyseBonds(atoms.flatMap(atomOrbitalInstances));
  const used = new Set(); for (const b of current.bonds) { used.add(b.a.key); used.add(b.b.key); }
  const mInst = atomOrbitalInstances(M).filter((o) => o.electrons === 1 && o.cls !== "d" && !used.has(o.key));
  let best = null;
  for (const N of atoms) {
    if (N.id === M.id) continue;
    const nAll = atomOrbitalInstances(N); const nInst = nAll.filter((o) => o.electrons === 1 && o.cls !== "d" && !used.has(o.key));
    const away = (() => { const v = sub(M.pos, N.pos); return len(v) < 1e-6 ? [1, 0, 0] : normalize(v); })();
    for (const oa of mInst) for (const ob of nInst) {
      if (!sigmaCompatible(oa, ob)) continue;
      for (const fb of facingOptionsPartner(ob, away)) for (const fa of facingOptionsMoving(oa)) {
        if (fa.sign !== fb.sign) continue; // phase: facing lobes must carry the same phase
        const d0 = distanceWindow("sigma", oa, ob).ideal;
        const R = fa.lobe ? qFromUnitVectors(fa.lobe, neg(fb.dir)) : [0, 0, 0, 1];
        const baseQuat = qMul(R, M.quat);
        const axisU = fb.dir; // from N towards M
        // pi twist candidates: align one of M's p orbitals (perpendicular to the bond) with one of N's
        const pos0 = add(N.pos, scale(axisU, d0));
        const twists = [{ ang: 0, d: d0 }];
        const tmp = withAtom(atoms, M.id, pos0, baseQuat); const tm = atomOrbitalInstances(tmp.find((a) => a.id === M.id)).filter((o) => o.cls === "p" && o.electrons === 1 && Math.abs(dot(o.axis, axisU)) < 0.5);
        const tn = nAll.filter((o) => o.cls === "p" && o.electrons === 1 && !used.has(o.key) && Math.abs(dot(o.axis, axisU)) < 0.5);
        for (const pa of tm) for (const pb of tn) {
          const w = distanceWindow("pi", pa, pb); const s = distanceWindow("sigma", oa, ob);
          const lo = Math.max(w.min, s.min); const hi = Math.min(w.max, s.max); if (lo > hi) continue;
          const d = lo + 0.45 * (hi - lo);
          for (const tgt of [pb.axis, neg(pb.axis)]) twists.push({ ang: signedAngleAbout(pa.axis, tgt, axisU), d });
        }
        for (const tw of twists) {
          const quat = qMul(qFromAxisAngle(axisU, tw.ang), baseQuat);
          const pos = add(N.pos, scale(axisU, tw.d));
          const next = withAtom(atoms, M.id, pos, quat);
          const bonds = bondsBetween(next, M.id, N.id);
          if (!bonds.length) continue;
          const sigma = bonds.filter((b) => b.type === "sigma").length; const pi = bonds.length - sigma;
          const rotAngle = 2 * Math.acos(Math.min(1, Math.abs(qMul(quat, [-M.quat[0], -M.quat[1], -M.quat[2], M.quat[3]])[3])));
          const cost = len(sub(pos, M.pos)) + 0.9 * rotAngle;
          const rank = bonds.length * 1000 - cost + (sigma ? 0 : -500);
          if (!best || rank > best.rank) best = { rank, pos, quat, target: N.id, bonds: bonds.map((b) => b.label), sigma, pi, cost };
        }
      }
    }
  }
  return best;
}
export { evaluatePair, P_AXIS, qRotate };
