// Simple fictional two-atom "ball model" molecules with a genuine
// structural asymmetry -- each has one LARGE (non-reactive) atom and one
// SMALL "reactive end" atom. ONE consistent definition of the reactive
// sites is used everywhere in this simulation (container, Collision
// mode, Activation Energy mode, Orientation mode, product formation):
//
//   A's reactive site = its SMALL atom (light blue), at local x=+9
//   B's reactive site = its SMALL atom (orange),     at local x=-9
//
// At rotation=0 for both, with A drawn to the left of B, those two small
// atoms already face each other -- so REACTIVE_ROTATION (0 for both) is
// the "correct orientation" pose, and the product's new bond is drawn
// between those SAME two small atoms, never the large ones. This is
// exported so CollisionViewer never has to re-derive/guess the geometry.
const COLORS = {
  aLarge: "#3654D6", aSmall: "#93A7F5",
  bLarge: "#C23B3B", bSmall: "#EFAE6D",
};

export const REACTIVE_ROTATION = { a: 0, b: 0 };
// A rotation that turns each molecule's LARGE (non-reactive) atom to
// face inward instead -- used for the wrong-orientation demonstration.
export const NON_REACTIVE_ROTATION = { a: 180, b: 180 };

export function MoleculeA({ x, y, rotation = 0, size = 1, label = true }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation}) scale(${size})`}>
      <line x1="-9" y1="0" x2="9" y2="0" stroke="#6b7280" strokeWidth="2.5" />
      <circle cx="-9" cy="0" r="9" fill={COLORS.aLarge} />
      <circle cx="9" cy="0" r="5.5" fill={COLORS.aSmall} />
      <ellipse cx="-11.5" cy="-3" rx="3" ry="2" fill="rgba(255,255,255,0.35)" />
      {label && <text x="0" y="-15" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-ink-faint)">A</text>}
    </g>
  );
}

export function MoleculeB({ x, y, rotation = 0, size = 1, label = true }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation}) scale(${size})`}>
      <line x1="-9" y1="0" x2="9" y2="0" stroke="#6b7280" strokeWidth="2.5" />
      <circle cx="9" cy="0" r="9" fill={COLORS.bLarge} />
      <circle cx="-9" cy="0" r="5.5" fill={COLORS.bSmall} />
      <ellipse cx="6.5" cy="-3" rx="3" ry="2" fill="rgba(255,255,255,0.35)" />
      {label && <text x="0" y="-15" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-ink-faint)">B</text>}
    </g>
  );
}

/** The product: a bent 4-atom chain formed by a NEW bond between A's and
 * B's SMALL (reactive) atoms -- the same two atoms the orientation
 * demonstration aligns -- with the two LARGE (non-reactive) atoms as the
 * chain's terminal ends. Visibly different from either starting
 * molecule's simple 2-atom shape, and geometrically consistent with
 * which atoms were actually described as "reactive" throughout. */
export function MoleculeProduct({ x, y, rotation = 0, size = 1 }) {
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation}) scale(${size})`}>
      <line x1="-22" y1="-6" x2="-6" y2="0" stroke="#6b7280" strokeWidth="2.5" />
      <line x1="-6" y1="0" x2="6" y2="0" stroke="#6b7280" strokeWidth="2.5" />
      <line x1="6" y1="0" x2="22" y2="-6" stroke="#6b7280" strokeWidth="2.5" />
      <circle cx="-22" cy="-6" r="9" fill={COLORS.aLarge} />
      <circle cx="-6" cy="0" r="5.5" fill={COLORS.aSmall} />
      <circle cx="6" cy="0" r="5.5" fill={COLORS.bSmall} />
      <circle cx="22" cy="-6" r="9" fill={COLORS.bLarge} />
      <text x="0" y="18" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-ink-faint)">Product</text>
    </g>
  );
}
