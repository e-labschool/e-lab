// One-sentence narration for the explanation line (pure). Everything is derived from the interaction model's output so the words
// always match what is drawn.
import { MOLECULES } from "./molecules.js";
import { FORCE_LABEL, nearSideSign, noDipoleReason } from "./imf.js";
import { norm, qRot, scale, sub } from "./vec.js";

const lab = (id) => MOLECULES[id].label;
const signWord = (s) => (s < 0 ? "δ⁻" : s > 0 ? "δ⁺" : "neutral");

export function describeSingle(id) {
  const m = MOLECULES[id];
  if (m.polar) return `${lab(id)} is polar: a permanent dipole of ${m.mu.toFixed(2)} D from δ⁺ to δ⁻ (the amber arrow). Add a second molecule to see how they interact.`;
  if (id === "CO2") return "CO₂ has polar C=O bonds, but they cancel by symmetry, so the molecule is nonpolar. Add another particle to see London dispersion at work.";
  return `${lab(id)} is nonpolar: ${noDipoleReason(m)}, so its time-averaged electron cloud is symmetric. Add a second particle to see how it interacts.`;
}

/** Narration for the Explore workspace. `focus` = the closest pair record from computeInteractions, `list` = workspace entries. */
export function exploreNarration({ force, list, focus, inter }) {
  if (list.length === 0) return "Drag a molecule from the tray into the workspace (or click it to add), then add a second one to see how molecules attract each other.";
  if (list.length === 1) return describeSingle(list[0].id);
  if (!focus) return "Move the molecules close together to see the interaction.";
  const a = list[focus.i]; const b = list[focus.j]; const A = MOLECULES[a.id]; const B = MOLECULES[b.id]; const pair = `${A.label} and ${B.label}`;
  if (!focus.applicable) return focus.text;
  const near = focus.r > (A.radius + B.radius) * 1.6;
  if (force === "ldf") {
    if (near) return `${pair}: bring them closer and watch the clouds. London dispersion acts between all particles, polar or not.`;
    return `${pair}: a temporary dipole in one cloud induces an opposite-facing dipole in its neighbour, so they attract (London dispersion, ${Math.round(focus.strength * 100)} % on a relative scale).`;
  }
  if (force === "dip-ind") {
    const polIdx = A.polar ? focus.i : focus.j; const otherIdx = polIdx === focus.i ? focus.j : focus.i; const P = list[polIdx]; const O = list[otherIdx];
    const toward = norm(sub(P.pos, O.pos)); const s = nearSideSign(inter.mols[otherIdx].induced, toward);
    const face = nearSideSign(qRot(P.quat, MOLECULES[P.id].dipole), scale(toward, -1)); // sign of the end of P that faces O
    if (near || s === 0 || face === 0) return `${lab(P.id)} has a permanent dipole; bring ${lab(O.id)} closer and its electron cloud will be pulled out of shape.`;
    return `The ${signWord(face)} end of ${lab(P.id)} faces ${lab(O.id)}, so its electrons are ${face > 0 ? "pulled towards" : "pushed away from"} it: the near side of ${lab(O.id)} becomes ${signWord(s)} (an induced dipole) and is attracted. Turn ${lab(P.id)} round and the induced dipole reverses.`;
  }
  if (force === "dip-dip") {
    if (focus.kind === "attract") return `${pair}: unlike partial charges face each other, so the arrangement is attractive (${Math.round(focus.strength * 100)} %, relative). Rotate or move a molecule to see how orientation and distance change it.`;
    if (focus.kind === "repel") return `${pair}: like partial charges face each other, so this orientation is repulsive (unfavourable). Rotate one molecule to turn it into an attraction.`;
    return `${pair}: too far apart for a noticeable dipole–dipole interaction; bring them closer and rotate one.`;
  }
  // hydrogen bonding
  const best = focus.hbonds.slice().sort((x, y) => y.strength - x.strength)[0];
  if (best) return `Hydrogen bond (${Math.round(best.strength * 100)} %): the δ⁺ H lies ${best.dHA.toFixed(2)} Å from a lone pair and X–H···A is ${Math.round(best.angle)}°. It is an attraction between the molecules, not the covalent bond.`;
  return `${pair}: no hydrogen bond yet. Bring a δ⁺ H (bonded to N, O or F) within about 2 Å of a lone-pair lobe on the other molecule, with X–H···A close to 180°; closeness alone is not enough.`;
}
export const forceTitle = (f) => FORCE_LABEL[f];
