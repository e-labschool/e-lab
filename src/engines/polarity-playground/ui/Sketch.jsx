import { useId } from "react";
import { elementStyle } from "../../shared-3d/elementStyle.js";
import { getMolecule } from "../model/molecules.js";
import { elementBond } from "../../shared-3d/electronCloud/electronegativity.js";
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

export function MoleculeSketch({ id, reveal = false, delta = false, size = "100%", label = null }) {
  const mol = getMolecule(id); const uid = useId().replace(/:/g, "");
  const pts = mol.atoms.map((a) => proj(a.p));
  const xs = pts.map((p) => p[0]); const ys = pts.map((p) => p[1]); const hw = (Math.max(...xs) - Math.min(...xs)) / 2; const hh = (Math.max(...ys) - Math.min(...ys)) / 2; const S = Math.min(mol.atoms.length === 2 ? 66 : 58, 96 / Math.max(hw, 0.3), 56 / Math.max(hh, 0.3)); const cx = (Math.min(...xs) + Math.max(...xs)) / 2; const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const P = pts.map((p) => [150 + (p[0] - cx) * S, 100 - (p[1] - cy) * S, p[2]]);
  const order = P.map((p, i) => i).sort((i, j) => P[i][2] - P[j][2]);
  const rad = (el) => 9 + elementStyle(el).r * 25; const mx = P.reduce((a, p) => a + p[0], 0) / P.length; const my = P.reduce((a, p) => a + p[1], 0) / P.length;
  const labelAt = (i) => { let dx = P[i][0] - mx; let dy = P[i][1] - my; const l = Math.hypot(dx, dy); if (l < 14) { dx = 0; dy = 1; } else { dx /= l; dy /= l; } const r = rad(mol.atoms[i].el) + 15; return [P[i][0] + dx * r, P[i][1] + dy * r + 6]; };
  return (
    <svg viewBox="0 0 300 200" width={size} className="pp-sketch" role="img" aria-label={`${mol.name}, ${mol.geometry}${delta || reveal ? "; partial charges marked" : ""}`} data-testid="molecule-sketch">
      <defs>{mol.atoms.map((a, i) => { const c = a.el === "H" ? "#f4f6fb" : elementStyle(a.el).color; return (<radialGradient key={i} id={`${uid}g${i}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.35" stopColor={c} /><stop offset="1" stopColor={c} stopOpacity="0.78" /></radialGradient>); })}</defs>
      {mol.bonds.map(([i, j, o], k) => { const offs = o === 3 ? [-5, 0, 5] : o === 2 ? [-3.5, 3.5] : [0]; const dx = P[j][0] - P[i][0]; const dy = P[j][1] - P[i][1]; const l = Math.hypot(dx, dy) || 1; return offs.map((q) => <line key={`${k}${q}`} x1={P[i][0] - (dy / l) * q} y1={P[i][1] + (dx / l) * q} x2={P[j][0] - (dy / l) * q} y2={P[j][1] + (dx / l) * q} stroke="#b9c2d8" strokeWidth={o === 1 ? 7 : 4} strokeLinecap="round" />); })}
      {order.map((i) => (<g key={i}><circle cx={P[i][0]} cy={P[i][1]} r={rad(mol.atoms[i].el)} fill={`url(#${uid}g${i})`} stroke="rgba(30,40,70,0.25)" /><text x={P[i][0]} y={P[i][1] + 5} textAnchor="middle" fontSize="15" fontWeight="800" fill={mol.atoms[i].el === "H" || mol.atoms[i].el === "S" ? "#1e2a44" : "#fff"}>{mol.atoms[i].el}</text></g>))}
      {reveal && mol.dipoles.filter((d) => d.polar).map((d, k) => { const a = P[d.plus]; const b = P[d.minus]; const dx = b[0] - a[0]; const dy = b[1] - a[1]; const l = Math.hypot(dx, dy) || 1; const ux = dx / l; const uy = dy / l; const r1 = rad(mol.atoms[d.plus].el); const r2 = rad(mol.atoms[d.minus].el);
        return <ArrowSvg key={k} x1={a[0] + ux * (r1 * 0.2)} y1={a[1] + uy * (r1 * 0.2) - 12} x2={b[0] - ux * (r2 * 0.4)} y2={b[1] - uy * (r2 * 0.4) - 12} width={2.6} />; })}
      {(reveal || delta) && mol.signs.map((s, i) => s !== 0 ? <text key={`s${i}`} x={labelAt(i)[0]} y={labelAt(i)[1]} textAnchor="middle" fontSize="17" fontWeight="800" fill={s > 0 ? "#2563eb" : "#e11d48"}>{s > 0 ? "δ+" : "δ−"}</text> : null)}
      {label && <text x="150" y="196" textAnchor="middle" fontSize="16" fontWeight="800" fill="currentColor">{label}</text>}
    </svg>
  );
}
/** A bond A-B drawn large; after the answer, delta labels and the chemistry arrow. */
export function PairSketch({ a, b, reveal = false }) {
  const uid = useId().replace(/:/g, ""); const bond = elementBond(a, b); const ra = 38 + elementStyle(a).r * 28; const rb = 38 + elementStyle(b).r * 28;
  const xa = 110; const xb = 290; const col = (el) => (el === "H" ? "#f4f6fb" : elementStyle(el).color); const txt = (el) => (el === "H" || el === "S" ? "#1e2a44" : "#fff");
  const plusX = bond.less === a ? xa : xb; const minusX = bond.less === a ? xb : xa;
  return (
    <svg viewBox="0 0 400 230" className="pp-sketch pp-sketch--pair" role="img" aria-label={`${a}–${b} bond`} data-testid="pair-visual">
      <defs>{[a, b].map((el, i) => (<radialGradient key={i} id={`${uid}p${i}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="0.35" stopColor={col(el)} /><stop offset="1" stopColor={col(el)} stopOpacity="0.78" /></radialGradient>))}</defs>
      <line x1={xa} y1="125" x2={xb} y2="125" stroke="#b9c2d8" strokeWidth="12" strokeLinecap="round" />
      <circle cx={xa} cy="125" r={ra} fill={`url(#${uid}p0)`} stroke="rgba(30,40,70,0.25)" /><text x={xa} y="136" textAnchor="middle" fontSize="32" fontWeight="800" fill={txt(a)}>{a}</text>
      <circle cx={xb} cy="125" r={rb} fill={`url(#${uid}p1)`} stroke="rgba(30,40,70,0.25)" /><text x={xb} y="136" textAnchor="middle" fontSize="32" fontWeight="800" fill={txt(b)}>{b}</text>
      {reveal && !bond.equal && (<g data-testid="pair-reveal">
        <text x={plusX} y="30" textAnchor="middle" fontSize="24" fontWeight="800" fill="#2563eb">δ+</text><text x={minusX} y="30" textAnchor="middle" fontSize="24" fontWeight="800" fill="#e11d48">δ−</text>
        <ArrowSvg x1={plusX} y1={52} x2={minusX} y2={52} width={4} /></g>)}
    </svg>
  );
}
export { ARROW_SCALE };
