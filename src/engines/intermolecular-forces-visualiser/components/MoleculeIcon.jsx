import { useMemo } from "react";
import { ELEM, MOLECULES } from "../model/molecules.js";
import { qFromAxisAngle, qMul, qRot } from "../model/vec.js";

// Tray icons: small ball-and-stick pictures drawn as inline SVG from the SAME molecule data as the 3D scene (orthographic
// projection of a fixed viewing rotation). No canvases and no WebGL, so any number of them are free.
const VIEW = qMul(qFromAxisAngle([1, 0, 0], 0.5), qFromAxisAngle([0, 1, 0], -0.55));
const SPECIAL_VIEW = { H2O: qMul(qFromAxisAngle([1, 0, 0], 0.15), qFromAxisAngle([0, 0, 1], 0)), SO2: qFromAxisAngle([1, 0, 0], 0.15), HCl: qFromAxisAngle([0, 1, 0], -0.35), HBr: qFromAxisAngle([0, 1, 0], -0.35), HF: qFromAxisAngle([0, 1, 0], -0.35) };
const darker = (hex, f) => { const n = parseInt(hex.slice(1), 16); const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v * f)); return `rgb(${c.join(",")})`; };

export default function MoleculeIcon({ id, size = 44 }) {
  const mol = MOLECULES[id];
  const g = useMemo(() => {
    const q = SPECIAL_VIEW[id] ?? VIEW; const pts = mol.atoms.map((a) => { const p = qRot(q, a.p); return { x: p[0], y: -p[1], z: p[2], el: a.el }; });
    const ext = Math.max(...pts.map((p) => Math.max(Math.abs(p.x) + ELEM[p.el].ball * 1.1, Math.abs(p.y) + ELEM[p.el].ball * 1.1)), 0.6); const k = 21 / ext;
    return { k, pts: pts.map((p) => ({ ...p, cx: 24 + p.x * k, cy: 24 + p.y * k, r: Math.max(3.4, ELEM[p.el].ball * k * 1.05) })), bonds: mol.bonds };
  }, [id, mol]);
  const order = [...g.pts.keys()].sort((a, b) => g.pts[a].z - g.pts[b].z);
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false" className="imf-icon">
      <defs>{[...new Set(mol.atoms.map((a) => a.el))].map((el) => (
        <radialGradient id={`ig-${el}`} key={el} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#ffffff" stopOpacity="0.9" /><stop offset="0.35" stopColor={ELEM[el].color} /><stop offset="1" stopColor={darker(ELEM[el].color, 0.62)} /></radialGradient>
      ))}</defs>
      {g.bonds.map(([a, b, o], i) => { const pa = g.pts[a]; const pb = g.pts[b]; const dx = pb.cx - pa.cx; const dy = pb.cy - pa.cy; const l = Math.hypot(dx, dy) || 1; const nx = -dy / l; const ny = dx / l; const offs = o === 3 ? [-2.4, 0, 2.4] : o === 2 ? [-1.5, 1.5] : [0]; return offs.map((s, j) => <line key={`${i}-${j}`} x1={pa.cx + nx * s} y1={pa.cy + ny * s} x2={pb.cx + nx * s} y2={pb.cy + ny * s} stroke="#cdd5e8" strokeWidth={o === 1 ? 2.4 : 1.5} strokeLinecap="round" />); })}
      {order.map((i) => { const p = g.pts[i]; return <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={`url(#ig-${p.el})`} stroke="rgba(6,14,38,0.55)" strokeWidth="0.8" />; })}
    </svg>
  );
}
