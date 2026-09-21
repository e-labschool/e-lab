/** Generic label + leader-line renderer, extracted from what was
 * previously hand-coded inline in every SVG simulation. `labels` is an
 * array of { from: {x,y}, textPos: {x,y}, text, anchor }, where `from`
 * is where the leader line starts (a point on the apparatus, typically
 * an asset anchor) and `textPos` is where the label text itself sits. */
export default function LabelLayer({ labels }) {
  return (
    <g fontSize="3.4" fontWeight="600" fill="var(--color-ink)">
      {labels.map((l, i) => (
        <g key={i}>
          <line x1={l.from.x} y1={l.from.y} x2={l.textPos.x} y2={l.textPos.y} stroke="var(--color-ink-faint)" strokeWidth="0.25" />
          <text x={l.textPos.x} y={l.textPos.y} textAnchor={l.anchor ?? "start"} dy="-0.8">
            {l.text}
          </text>
        </g>
      ))}
    </g>
  );
}
