// One consistent molecular model used EVERYWHERE (vessel, magnified
// view, activation-energy demos, orientation demos, molecule key):
//
//   A = X (large, blue)   -- Y (small, light blue)   reactive end = Y
//   B = Z (large, red)    -- W (small, orange)        reactive end = W
//
// The reaction is a partner-swap at the reactive (small) ends -- X and Z
// keep their own bond position, but Y and W exchange which large atom
// they're bonded to. This is what makes atom conservation trivially
// checkable by eye: every atom that exists in A/B still exists,
// unchanged in colour/size, somewhere in C/D.
//
//   C = X (large, blue)   -- W (small, orange)   [X kept, W swapped in]
//   D = Z (large, red)    -- Y (small, light blue) [Z kept, Y swapped in]
//
// A single generic renderer draws all four species from one shared
// shape, so A/B/C/D are visually guaranteed consistent rather than
// four independently-hand-drawn shapes that could drift apart.
export const ATOMS = {
  X: { color: "#3654D6", r: 9 }, // A's large atom
  Y: { color: "#93A7F5", r: 5.5 }, // A's reactive (small) atom
  Z: { color: "#C23B3B", r: 9 }, // B's large atom
  W: { color: "#EFAE6D", r: 5.5 }, // B's reactive (small) atom
};

// species -> { largeAtom, smallAtom, label } -- the small atom is ALWAYS
// drawn on the local +x side (the "reactive"/outward-facing side at
// rotation=0), the large atom on the local -x side.
export const SPECIES = {
  A: { large: "X", small: "Y", label: "A" },
  B: { large: "Z", small: "W", label: "B" },
  C: { large: "X", small: "W", label: "C" },
  D: { large: "Z", small: "Y", label: "D" },
};

// Reactive-orientation rotations, expressed per-role (A is drawn on the
// left, B on the right of a facing pair). Both species use the SAME
// local layout (small atom at local +x) -- so for their reactive ends
// to face EACH OTHER, A stays unrotated (small atom -> local +x ->
// world-right, toward B) while B needs a 180 deg base rotation (small
// atom -> local +x -> after 180 deg rotation, world-left, toward A).
// NON_REACTIVE_ROTATION swaps this, so the LARGE (non-reactive) atoms
// face each other instead -- used for the wrong-orientation demo.
export const REACTIVE_ROTATION = { left: 0, right: 180 };
export const NON_REACTIVE_ROTATION = { left: 180, right: 0 };

export function Molecule({ species, x, y, rotation = 0, size = 1, label = true }) {
  const def = SPECIES[species];
  const large = ATOMS[def.large];
  const small = ATOMS[def.small];
  return (
    <g transform={`translate(${x},${y}) rotate(${rotation}) scale(${size})`}>
      <line x1="-9" y1="0" x2="9" y2="0" stroke="#6b7280" strokeWidth="2.5" />
      <circle cx="-9" cy="0" r={large.r} fill={large.color} />
      <circle cx="9" cy="0" r={small.r} fill={small.color} />
      <ellipse cx="-11.5" cy="-3" rx="3" ry="2" fill="rgba(255,255,255,0.35)" />
      {label && <text x="0" y="-15" textAnchor="middle" fontSize="9" fontWeight="700" fill="var(--color-ink-faint)">{def.label}</text>}
    </g>
  );
}
