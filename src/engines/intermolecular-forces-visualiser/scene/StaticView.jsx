import { MOLECULES, ELEM } from "../model/molecules.js";
import { qRot } from "../model/vec.js";

/**
 * 2D side view of the workspace for devices without WebGL (BS-30): ball-and-stick projection onto the screen plane (x right, y up), drawn
 * from the same poses as the 3D scene.  It shows WHERE the molecules are and how they are built, so the explanations in the strip still
 * make sense; the 3D-only interactions (drag, rotate, electron clouds) are not available and the message says so.
 */
export default function StaticView({ molsRef, ariaLabel }) {
  const list = molsRef.current ?? [];
  if (!list.length) return null;
  const items = list.map((m) => { const mol = MOLECULES[m.id]; return { m, mol, atoms: mol.atoms.map((a) => { const p = qRot(m.quat, a.p); return { el: a.el, x: m.pos[0] + p[0], y: -(m.pos[1] + p[1]), z: m.pos[2] + p[2] }; }) }; });
  const all = items.flatMap((i) => i.atoms); const pad = 2.2;
  const x0 = Math.min(...all.map((a) => a.x)) - pad; const x1 = Math.max(...all.map((a) => a.x)) + pad; const y0 = Math.min(...all.map((a) => a.y)) - pad; const y1 = Math.max(...all.map((a) => a.y)) + pad;
  return (
    <svg className="imf-static2d" viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} preserveAspectRatio="xMidYMid meet" role="img" aria-label={ariaLabel ?? "Side view of the molecules"} data-testid="imf-static-view">
      {items.map(({ m, mol, atoms }) => (
        <g key={m.uid} data-molecule={m.id}>
          {mol.bonds.map(([i, j], k) => <line key={k} x1={atoms[i].x} y1={atoms[i].y} x2={atoms[j].x} y2={atoms[j].y} stroke="#cdd5e8" strokeWidth="0.16" strokeLinecap="round" />)}
          {[...atoms.keys()].sort((a, b) => atoms[a].z - atoms[b].z).map((i) => { const a = atoms[i]; const r = ELEM[a.el].ball * 1.15; return (
            <g key={i}><circle cx={a.x} cy={a.y} r={r} fill={ELEM[a.el].color} stroke="rgba(0,0,0,0.35)" strokeWidth="0.05" />{r > 0.34 && <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(0.3, r * 0.95)} fontWeight="800" fill={ELEM[a.el].text}>{a.el}</text>}</g>
          ); })}
          <text x={m.pos[0]} y={-m.pos[1] + mol.radius + 0.9} textAnchor="middle" fontSize="0.62" fill="#e9f1ff" fontWeight="700">{mol.label}</text>
        </g>
      ))}
    </svg>
  );
}
