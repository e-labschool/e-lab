
import { dotRadius } from "../scene/atomGeometry.js";

const RING = "#9fb1d1";

/** Rings + nucleus of one atom (electrons are drawn in a separate layer so travelling electrons stay on top). */
export function AtomBody({ a, selected, cloud, dragProps, testId }) {
  const nucR = Math.max(9, 13 * a.scale);
  return (
    <g data-testid={testId} data-symbol={a.symbol} data-rings={a.rings.filter((r) => r.opacity > 0.01).length}
      className={"bv-atom" + (dragProps ? " bv-atom--drag" : "")} {...(dragProps ?? {})}>
      {/* generous invisible hit area so atoms are easy to grab with a finger */}
      <circle cx={a.x} cy={a.y} r={Math.max(a.outerR, 30)} fill="transparent" />
      {cloud && <circle cx={a.x} cy={a.y} r={a.outerR} fill={cloud} fillOpacity="0.1" />}
      {a.rings.map((r) => (
        <circle key={r.k} cx={a.x} cy={a.y} r={r.r} fill="none" stroke={RING} strokeWidth="1.4" strokeOpacity={r.opacity} data-ring={r.k} />
      ))}
      {selected && <circle cx={a.x} cy={a.y} r={a.outerR + 7} fill="none" stroke="#2f7bf5" strokeWidth="1.6" strokeDasharray="5 4" />}
      <circle cx={a.x} cy={a.y} r={nucR} fill={a.color} stroke="#fff" strokeWidth="1.5" />
      <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, 12.5 * a.scale)} fontWeight="800" fill="#1e2a44" pointerEvents="none">{a.symbol}</text>
    </g>
  );
}

export function Electrons({ atoms, testId = "electrons" }) {
  return (
    <g data-testid={testId} pointerEvents="none">
      {atoms.flatMap((a) => a.electrons.map((e) => (
        <circle key={e.id} cx={e.x} cy={e.y} r={dotRadius(a.scale) * (e.core ? 0.78 : 1)} fill={e.color} stroke="#fff" strokeWidth="1" data-core={e.core ? "1" : "0"} data-state={e.state} />
      )))}
    </g>
  );
}

/** Arrangement text under the atom, e.g. "2,8,7". */
export function ShellLabel({ a, y, text }) {
  return <text x={a.x} y={y ?? a.y + a.outerR + 17} textAnchor="middle" fontSize="13" fontWeight="700" fill="#33415f" data-testid={`shells-${a.id}`} pointerEvents="none">{text ?? a.label}</text>;
}

/** Charge pill: red for positive ions, blue for negative ions. */
export function ChargeBadge({ a }) {
  if (!a.charge || a.chargeOpacity <= 0.01) return null;
  const pos = a.charge > 0;
  const mag = Math.abs(a.charge);
  const txt = `${mag > 1 ? mag : ""}${pos ? "+" : "\u2212"}`;
  const x = a.x + a.outerR * 0.72; const y = a.y - a.outerR * 0.72;
  return (
    <g opacity={a.chargeOpacity} pointerEvents="none" data-testid={`charge-${a.id}`} data-charge={a.charge}>
      <circle cx={x} cy={y} r="14.5" fill={pos ? "#fde4e1" : "#dbe9ff"} stroke={pos ? "#e0524d" : "#2f6fe0"} strokeWidth="1.6" />
      <text x={x} y={y + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="14" fontWeight="800" fill={pos ? "#b3261e" : "#1c4fb8"}>{txt}</text>
    </g>
  );
}
