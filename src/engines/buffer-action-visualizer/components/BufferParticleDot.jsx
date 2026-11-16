// One rendered particle: colour/label depend on kind and on the buffer system. `flash` rings a particle that just reacted.
const STYLE = (kind, system) => ({
  H: { color: "#c23b3b", r: 9, label: "H⁺" }, OH: { color: "#2f4bc4", r: 9, label: "OH⁻" }, water: { color: "#7fa8d9", r: 7, label: "H₂O" },
  spectator: { color: "#6f7d90", r: 8, label: system.spectatorShort }, acid: { color: "#b0841f", r: 13, label: system.acidShort }, base: { color: "#2f86b5", r: 13, label: system.baseShort },
}[kind]);
export default function BufferParticleDot({ particle: p, system }) {
  const s = STYLE(p.kind, system); if (!s) return null;
  return (
    <g>
      {p.flash > 0 && <circle cx={p.x} cy={p.y} r={s.r + 5} fill="none" stroke="#fde68a" strokeWidth="2" opacity={Math.min(1, p.flash * 1.6)} />}
      <circle cx={p.x} cy={p.y} r={s.r} fill={s.color} stroke="rgba(0,0,0,0.3)" strokeWidth="0.6" />
      <text x={p.x} y={p.y + s.r * 0.32} textAnchor="middle" fontSize={Math.max(7, s.r * 0.66)} fontWeight="700" fill="#fff">{s.label}</text>
    </g>
  );
}
