import { ELEM } from "../model/molecules.js";
import { atomPosition } from "../model/particles.js";

/**
 * 2D side view of the heating cube for devices without WebGL (BS-30): the same particles the 3D cube draws, projected onto the screen
 * plane (x right, y up), nearer atoms drawn on top. It is re-rendered from the live simulation every time the parent updates (about
 * ten times a second), so heating and cooling can be watched without a GPU. The dotted interaction lines are not drawn here.
 */
export default function FlatCube({ simRef, compare, ariaLabel }) {
  const items = simRef.current?.items ?? [];
  if (!items.length) return null;
  const cell = 100 / items.length;
  return (
    <svg className="imf-flatcube" viewBox={`0 0 ${items.length * 108} 108`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel} data-testid="imf-flat-cube">
      {items.map((it, idx) => {
        const sys = it.sys; const L = sys.L; const k = 100 / L; const ox = idx * 108 + 4; const out = [0, 0, 0];
        const dots = [];
        if (sys.ionic) {
          for (let i = 0; i < sys.n; i += 1) dots.push({ x: sys.pos[3 * i], y: sys.pos[3 * i + 1], z: sys.pos[3 * i + 2], r: sys.nn * (sys.charge[i] > 0 ? 0.3 : 0.45), c: sys.charge[i] > 0 ? "#9b8cf5" : "#5fd37a" });
        } else {
          for (let i = 0; i < sys.n; i += 1) sys.mol.atoms.forEach((a, kk) => { atomPosition(sys, i, kk, out); dots.push({ x: out[0], y: out[1], z: out[2], r: ELEM[a.el].ball * 1.9, c: ELEM[a.el].color }); });
        }
        dots.sort((a, b) => a.z - b.z);
        return (
          <g key={it.id} data-substance={it.id}>
            <rect x={ox} y={4} width="100" height="100" rx="3" fill="rgba(111,155,240,0.07)" stroke="#8fa8dc" strokeWidth="0.8" />
            {dots.map((d, i) => <circle key={i} cx={ox + 50 + d.x * k} cy={54 - d.y * k} r={Math.max(0.8, d.r * k)} fill={d.c} stroke="rgba(0,0,0,0.3)" strokeWidth="0.2" />)}
            <text x={ox + 3} y={11} fontSize="5" fill="#e9f1ff" fontWeight="700">{it.sub.label}</text>
          </g>
        );
      })}
      <title>{compare ? "Side view of the two heated samples" : "Side view of the heated sample"}</title>
    </svg>
  );
}
