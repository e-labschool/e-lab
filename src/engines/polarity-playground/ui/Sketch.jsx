import { useId } from "react";
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { getMolecule } from "../model/molecules.js";
import { ARROW_SCALE } from "../model/vectorAddition.js";

// 2D schematic drawings for the Polarity Challenge: a molecule (orthographic projection of the same 3D coordinates the viewer uses),
// and the chemistry dipole arrow with its crossed tail. Plain SVG, no WebGL.
const proj = (p) => { const a = 0.5; const b = 0.28; const x = p[0] * Math.cos(a) + p[2] * Math.sin(a); const z = -p[0] * Math.sin(a) + p[2] * Math.cos(a); return [x, p[1] * Math.cos(b) - z * Math.sin(b), z]; };

/** The dipole arrow between two points: crossed tail on the delta+ end (x1), head on the delta- end (x2). */
export function ArrowSvg({ x1, y1, x2, y2, color = "#d98600", width = 3.2 }) {
  const dx = x2 - x1; const dy = y2 - y1; const l = Math.hypot(dx, dy) || 1; const ux = dx / l; const uy = dy / l; const nx = -uy; const ny = ux; const hs = 9;
  return (
    <g stroke={color} strokeWidth={width} strokeLinecap="round" fill="none" data-arrow="chem">
      <line x1={x1} y1={y1} x2={x2 - ux * hs * 0.8} y2={y2 - uy * hs * 0.8} />
      <line data-part="cross-tail" x1={x1 + nx * 7} y1={y1 + ny * 7} x2={x1 - nx * 7} y2={y1 - ny * 7} />
      <path data-part="head" d={`M ${x2} ${y2} L ${x2 - ux * hs - nx * 5.5} ${y2 - uy * hs - ny * 5.5} L ${x2 - ux * hs + nx * 5.5} ${y2 - uy * hs + ny * 5.5} Z`} fill={color} stroke="none" />
    </g>
  );
}

/** A bond drawn as "A  ->  B" with the arrow option: tail = "left" | "right" | null (no arrow). */
export function BondArrowOption({ a, b, tail }) {
  return (
    <svg viewBox="0 0 220 60" className="pp-optsvg" role="img" aria-label={tail ? `${tail === "left" ? a : b} has the crossed tail and the arrowhead points to ${tail === "left" ? b : a}` : "no arrow"}>
      <text x="20" y="38" fontSize="24" fontWeight="700" fill="currentColor" textAnchor="middle">{a}</text>
      <text x="200" y="38" fontSize="24" fontWeight="700" fill="currentColor" textAnchor="middle">{b}</text>
      {tail === "left" && <ArrowSvg x1={50} y1={30} x2={170} y2={30} />}
      {tail === "right" && <ArrowSvg x1={170} y1={30} x2={50} y2={30} />}
    </svg>
  );
}

export function MoleculeSketch({ id, reveal = false, size = 260 }) {
  const mol = getMolecule(id); const uid = useId().replace(/:/g, "");
  const pts = mol.atoms.map((a) => proj(a.p)); const S = mol.atoms.length === 2 ? 52 : 44;
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const P = pts.map((p) => [150 + (p[0] - cx) * S, 100 - (p[1] - cy) * S, p[2]]);
  const order = P.map((p, i) => i).sort((i, j) => P[i][2] - P[j][2]);
  const rad = (el) => 15 + elementStyle(el).r * 26;
  return (
    <svg viewBox="0 0 300 200" width={size} className="pp-sketch" role="img" aria-label={`${mol.name}, ${mol.geometry}`} data-testid="molecule-sketch">
      <defs>{mol.atoms.map((a, i) => { const c = a.el === "H" ? "#f4f6fb" : elementStyle(a.el).color; return (<radialGradient key={i} id={`${uid}g${i}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.35" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity="0.78" /></radialGradient>); })}</defs>
      {mol.bonds.map(([i, j, o], k) => { const offs = o === 3 ? [-5, 0, 5] : o === 2 ? [-3.5, 3.5] : [0]; const dx = P[j][0] - P[i][0]; const dy = P[j][1] - P[i][1]; const l = Math.hypot(dx, dy) || 1; return offs.map((q) => <line key={`${k}${q}`} x1={P[i][0] - (dy / l) * q} y1={P[i][1] + (dx / l) * q} x2={P[j][0] - (dy / l) * q} y2={P[j][1] + (dx / l) * q} stroke="#b9c2d8" strokeWidth={o === 1 ? 7 : 4} strokeLinecap="round" />); })}
      {order.map((i) => (<g key={i}><circle cx={P[i][0]} cy={P[i][1]} r={rad(mol.atoms[i].el)} fill={`url(#${uid}g${i})`} stroke="rgba(30,40,70,0.25)" /><text x={P[i][0]} y={P[i][1] + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={mol.atoms[i].el === "H" || mol.atoms[i].el === "S" ? "#1e2a44" : "#fff"}>{mol.atoms[i].el}</text></g>))}
      {reveal && mol.dipoles.filter((d) => d.polar).map((d, k) => { const a = P[d.plus]; const b = P[d.minus]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; const ux = dx / l; const uy = dy / l; const r1 = rad(mol.atoms[d.plus].el); const r2 = rad(mol.atoms[d.minus].el);
        return <ArrowSvg key={k} x1={a[0] + ux * (r1 * 0.2)} y1={a[1] + uy * (r1 * 0.2) - 12} x2={b[0] - ux * (r2 * 0.4)} y2={b[1] - uy * (r2 * 0.4) - 12} width={2.6} />; })}
      {reveal && mol.signs.map((s, i) => s !== 0 ? <text key={`s${i}`} x={P[i][0]} y={P[i][1] - rad(mol.atoms[i].el) - 14} textAnchor="middle" fontSize="17" fontWeight="800" fill={s > 0 ? "#2563eb" : "#e11d48"}>{s > 0 ? "δ+" : "δ−"}</text> : null)}
    </svg>
  );
}
export { ARROW_SCALE };
