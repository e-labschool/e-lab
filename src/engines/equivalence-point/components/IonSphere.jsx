// A glossy, representative ion sphere — radial gradients + a highlight
// give a convincing 3D look without any external asset. These spheres
// are explicitly representative (a capped, illustrative count), never a
// literal ion count — the real calculation lives in titration.js.
//
// The <radialGradient> definitions themselves live ONCE in the parent
// (see IonGradientDefs in BeamBalance.jsx) — defining them here per
// instance would mean duplicate SVG element ids whenever more than one
// sphere of the same species renders, which is invalid markup.
export const SPECIES_STYLE = {
  OH: { base: "#2f4bc4", label: "OH\u207B" },
  H: { base: "#c23b3b", label: "H\u207A" },
};

export default function IonSphere({ x, y, species, r = 13, opacity = 1 }) {
  return (
    <g style={{ opacity, transition: "opacity 0.35s ease" }}>
      <ellipse cx={x} cy={y + r * 0.92} rx={r * 0.8} ry={r * 0.22} fill="rgba(20,20,30,0.18)" />
      <circle cx={x} cy={y} r={r} fill={`url(#ion-grad-${species})`} stroke="rgba(0,0,0,0.15)" strokeWidth="0.5" />
      <ellipse cx={x - r * 0.35} cy={y - r * 0.4} rx={r * 0.3} ry={r * 0.18} fill="rgba(255,255,255,0.65)" />
    </g>
  );
}

export function IonGradientDefs() {
  // Returns the gradient elements directly (a fragment), NOT wrapped in
  // its own <defs> — this gets placed inside the PARENT's single <defs>
  // block (see BeamBalance.jsx); a nested <defs> inside another <defs>
  // is invalid SVG.
  return (
    <>
      <radialGradient id="ion-grad-OH" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#7b93f2" />
        <stop offset="55%" stopColor="#2f4bc4" />
        <stop offset="100%" stopColor="#2f4bc4" stopOpacity="0.85" />
      </radialGradient>
      <radialGradient id="ion-grad-H" cx="35%" cy="30%" r="75%">
        <stop offset="0%" stopColor="#f28080" />
        <stop offset="55%" stopColor="#c23b3b" />
        <stop offset="100%" stopColor="#c23b3b" stopOpacity="0.85" />
      </radialGradient>
    </>
  );
}
