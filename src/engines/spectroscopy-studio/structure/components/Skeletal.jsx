import { getStructure } from "../data/structures.js";

// A clean skeletal formula drawn as SVG from the structure's graph (carbons implicit, O drawn as O or OH, double bonds as two parallel lines).
const LABEL_R = 0.27; // bond length units hidden around a labelled atom
export default function Skeletal({ id, size = 120, testId, title }) {
  const st = getStructure(id); const g = st.graph;
  const pts = g.atoms.map((a) => ({ x: a.x, y: -a.y }));
  const minX = Math.min(...pts.map((p) => p.x)) - 0.55; const maxX = Math.max(...pts.map((p) => p.x)) + 0.55;
  const minY = Math.min(...pts.map((p) => p.y)) - 0.55; const maxY = Math.max(...pts.map((p) => p.y)) + 0.55;
  const labelled = g.atoms.map((a) => a.el !== "C");
  const bonds = g.bonds.map((b, k) => {
    const A = pts[b.a]; const B = pts[b.b]; const dx = B.x - A.x; const dy = B.y - A.y; const len = Math.hypot(dx, dy); const ux = dx / len; const uy = dy / len;
    const s = labelled[b.a] ? LABEL_R : 0; const e = labelled[b.b] ? LABEL_R : 0;
    const x1 = A.x + ux * s; const y1 = A.y + uy * s; const x2 = B.x - ux * e; const y2 = B.y - uy * e;
    const nx = -uy; const ny = ux; const off = b.order === 2 ? 0.06 : 0;
    const lines = b.order === 2 ? [-off, off] : [0];
    return <g key={k}>{lines.map((o, i) => <line key={i} x1={x1 + nx * o} y1={y1 + ny * o} x2={x2 + nx * o} y2={y2 + ny * o} className="st-bond" />)}</g>;
  });
  return (
    <svg className="st-skel" viewBox={`${minX} ${minY} ${maxX - minX} ${maxY - minY}`} height={size} role="img" aria-label={title ?? `Skeletal formula of ${st.name}`} data-testid={testId} preserveAspectRatio="xMidYMid meet">
      {bonds}
      {g.atoms.map((a, i) => labelled[i] && (
        <text key={a.id} x={pts[i].x} y={pts[i].y} className="st-atom" textAnchor="middle" dominantBaseline="central">{a.h > 0 ? "OH" : "O"}</text>
      ))}
    </svg>
  );
}
