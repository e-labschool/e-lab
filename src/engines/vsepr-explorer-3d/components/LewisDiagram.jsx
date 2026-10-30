import { ELEMENTS } from "../model/elements.js";

const W = 240; const H = 170; const CX = W / 2; const CY = H / 2;
const rad = (d) => (d * Math.PI) / 180;

/** Skeletal Lewis drawing: central atom, bonds (1-3 lines), lone pairs (dots). Not geometry-accurate: a Lewis structure is a bonding diagram. */
export default function LewisDiagram({ model, lewis }) {
  if (!model.central) return <p className="vx-lewis-empty">Add a central atom to see its Lewis structure.</p>;
  const n = model.domains.length;
  const rx = n <= 2 ? 78 : 80; const ry = 54;
  const items = model.domains.map((d, i) => {
    // two domains: left / right; otherwise spread evenly starting at the top
    const a = n === 1 ? 0 : n === 2 ? (i === 0 ? 180 : 0) : -90 + (360 / n) * i;
    return { d, i, a, x: CX + rx * Math.cos(rad(a)), y: CY + ry * Math.sin(rad(a)) };
  });
  const term = (id) => lewis.terminals?.find((t) => t.id === id);
  const dots = (cx, cy, angleDeg, count, dist, sep = 5) => {
    const out = [];
    for (let k = 0; k < count; k += 1) {
      const off = count === 1 ? 0 : count === 2 ? (k === 0 ? -55 : 55) : (k - (count - 1) / 2) * 62;
      const a = rad(angleDeg + off); const px = cx + dist * Math.cos(a); const py = cy + dist * Math.sin(a);
      const tx = -Math.sin(a) * sep * 0.5; const ty = Math.cos(a) * sep * 0.5;
      out.push(<g key={k}><circle cx={px + tx} cy={py + ty} r="1.9" /><circle cx={px - tx} cy={py - ty} r="1.9" /></g>);
    }
    return out;
  };
  const el = ELEMENTS[model.central];
  const sign = (v) => (v === 0 ? "" : v > 0 ? (v === 1 ? "+" : `${v}+`) : (v === -1 ? "−" : `${-v}−`));
  return (
    <svg className="vx-lewis-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Lewis structure of the central ${el.name} atom`} data-testid="lewis-svg">
      {items.map(({ d, a, x, y }) => {
        if (d.kind !== "bond") return null;
        const ux = Math.cos(rad(a)); const uy = Math.sin(rad(a)); const px = -uy; const py = ux;
        const x1 = CX + ux * 15; const y1 = CY + uy * 13; const x2 = x - ux * 14; const y2 = y - uy * 12;
        const offs = d.order === 1 ? [0] : d.order === 2 ? [-3, 3] : [-4.5, 0, 4.5];
        return <g key={d.id} className="vx-lewis-bond">{offs.map((o, k) => <line key={k} x1={x1 + px * o} y1={y1 + py * o} x2={x2 + px * o} y2={y2 + py * o} />)}</g>;
      })}
      <g className="vx-lewis-atoms">
        <text x={CX} y={CY + 6} textAnchor="middle" className="vx-lewis-sym vx-lewis-sym--c">{model.central}</text>
        {!lewis.empty && lewis.centralFormal ? <text x={CX + 14} y={CY - 8} className="vx-lewis-fc">{sign(lewis.centralFormal)}</text> : null}
        {items.map(({ d, x, y }) => d.kind === "bond" && (
          <g key={d.id}>
            <text x={x} y={y + 5} textAnchor="middle" className="vx-lewis-sym">{d.symbol ?? "?"}</text>
            {term(d.id)?.formal ? <text x={x + 11} y={y - 7} className="vx-lewis-fc">{sign(term(d.id).formal)}</text> : null}
          </g>
        ))}
      </g>
      <g className="vx-lewis-dots">
        {items.map(({ d, a, x, y }) => {
          if (d.kind === "lp") return <g key={d.id}>{dots(CX, CY, a, 1, 24, 7)}</g>;
          const t = term(d.id); if (!t?.lonePairs) return null;
          return <g key={d.id}>{dots(x, y, a, t.lonePairs, 17, 6)}</g>;
        })}
      </g>
    </svg>
  );
}
