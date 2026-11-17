// Sphere-and-bond model of any structure from lib/lewis (pure data, no rendering): positions come from the VSEPR-based embedding.
import { embed3D } from "../../../lib/lewis/geometry.js";
import { lewisElement } from "../../../lib/lewis/data.js";
import { getBondingElement } from "../model/elements.js";
import { elementEdge } from "../../shared-3d/elementStyle.js";

/** Display radius of a sphere (world units): grows with the covalent radius; spheres never touch in a correct structure. */
export const displayRadius = (symbol) => (symbol === "H" ? 0.32 : Math.min(0.62, 0.12 + 0.0045 * (lewisElement(symbol).cov ?? 90)));

/** { atoms:[{index,symbol,pos,radius,color,text,edge}], bonds:[{i,j,order,dative}], radius } for a structure of lib/lewis. */
export function structure3D(s) {
  const emb = embed3D(s);
  const atoms = s.atoms.map((sym, i) => {
    const el = getBondingElement(sym);
    return { index: i, symbol: sym, pos: emb.pos[i], radius: displayRadius(sym), color: el.color, text: el.text, edge: elementEdge(sym) };
  });
  const bonds = s.bonds.map(([i, j, order, dat]) => ({ i, j, order, dative: !!dat }));
  const radius = Math.max(...atoms.map((a) => Math.hypot(...a.pos) + a.radius), 0.8);
  return { atoms, bonds, radius };
}
