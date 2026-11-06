import { ATOM_STYLE, project } from "../scene/glyphs.js";

/** Gradients shared by every glyph in one <svg>; `id` makes them unique per svg. */
export function GlyphDefs({ id }) {
  const g = (name, light, dark) => (
    <radialGradient key={name} id={`${id}-${name}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor={light} /><stop offset="1" stopColor={dark} /></radialGradient>
  );
  return (
    <defs>
      {Object.entries(ATOM_STYLE).map(([el, s]) => g(el, s.light, s.dark))}
      {g("ionO", "#ffe2c2", "#c2410c")}{g("ionC", "#ffe2c2", "#e8590c")}{g("ionH", "#fff1e0", "#f59f5a")}{g("ionCl", "#ffe2c2", "#d9480f")}{g("ionBr", "#ffe2c2", "#b4410c")}
      {g("e", "#e0f6ff", "#0ea5e9")}
    </defs>
  );
}

/**
 * A ball-and-stick glyph drawn with orthographic projection: atoms [{el, p:[x,y,z]}], bonds [[i,j]], centre (cx, cy), scale (px per angstrom).
 *   ion      the glyph is a positive ion: orange spheres + a "+" (and "•" when radical) badge
 *   dashed   draw the outline dashed (a neutral fragment leaving)
 *   mask     optional set of atom indices to draw (others hidden)
 */
export default function AtomGlyph({ id, atoms, bonds, cx, cy, scale = 40, spin = 0, tilt = 0.35, ion = false, radical = false, opacity = 1, glow = 0, stretch = null, label, labelDy = 0, testId }) {
  const pts = atoms.map((a) => project(a.p, spin, tilt));
  const order = atoms.map((_, i) => i).sort((a, b) => pts[a].z - pts[b].z);
  const X = (q) => cx + q.x * scale; const Y = (q) => cy - q.y * scale;
  const fillOf = (a) => `url(#${id}-${ion ? `ion${a.el === "C" || a.el === "Cl" || a.el === "Br" ? a.el : "H"}` : a.el})`;
  const R = (a, q) => ATOM_STYLE[a.el].r * scale * (1 + q.z * 0.03);
  const bondW = Math.max(2.5, scale * 0.11);
  const top = Math.min(...pts.map((q, i) => Y(q) - R(atoms[i], q)));
  const right = Math.max(...pts.map((q, i) => X(q) + R(atoms[i], q)));
  return (
    <g opacity={opacity} data-testid={testId} data-ion={ion ? "1" : "0"}>
      {glow > 0 && atoms.map((a, i) => <circle key={`gl${i}`} cx={X(pts[i])} cy={Y(pts[i])} r={R(a, pts[i]) * (1.5 + 0.25 * glow)} fill={ion ? "#fb923c" : "#7dd3fc"} opacity={0.22 * glow} />)}
      {bonds.map(([i, j], k) => {
        const dim = stretch && stretch.some((s) => (s[0] === i && s[1] === j) || (s[0] === j && s[1] === i));
        return <line key={`b${k}`} x1={X(pts[i])} y1={Y(pts[i])} x2={X(pts[j])} y2={Y(pts[j])} stroke={ion ? "#fdba74" : "#aab6d6"} strokeWidth={bondW} strokeLinecap="round" strokeDasharray={dim ? "5 5" : undefined} opacity={dim ? 0.7 : 1} />;
      })}
      {order.map((i) => <circle key={`a${i}`} cx={X(pts[i])} cy={Y(pts[i])} r={R(atoms[i], pts[i])} fill={fillOf(atoms[i])} stroke={ion ? "#7c2d12" : "#0a1330"} strokeWidth="1" strokeDasharray={undefined} />)}
      {ion && (
        <g transform={`translate(${right + 4} ${top - 2})`} aria-hidden="true">
          <circle r={Math.max(8, scale * 0.2)} fill="#7c2d12" stroke="#fdba74" strokeWidth="1.5" />
          <text textAnchor="middle" dy="0.35em" fontSize={Math.max(11, scale * 0.28)} fontWeight="800" fill="#fff">+</text>
          {radical && <text x={Math.max(8, scale * 0.2) + 6} dy="0.35em" fontSize={Math.max(16, scale * 0.42)} fontWeight="900" fill="#fdba74">•</text>}
        </g>
      )}
      {label && <text x={cx} y={Y({ y: Math.min(...pts.map((q) => q.y)) - 0.5 }) + 14 + labelDy} textAnchor="middle" className="ms-glyph-label">{label}</text>}
    </g>
  );
}
