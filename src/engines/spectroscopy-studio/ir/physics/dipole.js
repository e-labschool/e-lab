// IR activity from the dipole-moment-derivative rule (pure). A vibration is IR-active only if the molecular dipole moment changes along it:
//     d(mu)/dQ  !=  0.
// The dipole is modelled by fixed partial point charges q_i on the atoms (neutral molecule), mu = sum q_i r_i. For a normal mode with
// Cartesian displacement pattern d_i (per unit normal coordinate Q), mu(Q) is evaluated at +/- a small displacement and d(mu)/dQ is a
// numerical central difference. Because the molecule is neutral, mu (and so d(mu)/dQ) does not depend on the origin.
// Honest limits: a charge-on-atom picture ignores charge flux (charge moving as bonds change), so RELATIVE intensities are only
// qualitative; the yes / no outcome is a SYMMETRY property and is robust: it follows from the geometry of the mode, not from the charges.
import { norm } from "./linalg.js";

export const ACTIVE_THRESHOLD = 1e-6; // e / sqrt(u); numerical zeros are ~1e-12

export const dipoleOf = (atoms, positions) => {
  const mu = [0, 0, 0]; atoms.forEach((a, i) => { for (let k = 0; k < 3; k += 1) mu[k] += a.q * positions[i][k]; }); return mu;
};

/** d(mu)/dQ for one mode: vector (e per sqrt(u)) from a central difference of the displaced geometries; dispRaw = flat Cartesian pattern (angstrom per unit Q). */
export function dipoleDerivative(atoms, dispRaw, delta = 0.02) {
  const shifted = (s) => atoms.map((a, i) => [a.pos[0] + s * dispRaw[3 * i], a.pos[1] + s * dispRaw[3 * i + 1], a.pos[2] + s * dispRaw[3 * i + 2]]);
  const mp = dipoleOf(atoms, shifted(delta)); const mm = dipoleOf(atoms, shifted(-delta));
  return [0, 1, 2].map((k) => (mp[k] - mm[k]) / (2 * delta));
}
export const isIRActive = (dmu) => norm(dmu) > ACTIVE_THRESHOLD;
export const netCharge = (atoms) => atoms.reduce((s, a) => s + a.q, 0);
