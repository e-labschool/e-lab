// One rendered particle -- colour/label depend on kind AND the current
// buffer system (acid-form/base-form labels differ between the acid and
// basic buffer). Spectator and water styling stay fixed across systems.
export default function BufferParticleDot({ particle, system }) {
  const style = stylesFor(particle.kind, system);
  if (!style) return null;
  const opacity = particle.status === "reacting" ? 0.9 : 1;
  const glow = particle.kind === "water" ? Math.max(0, particle.glowT ?? 0) : 0;

  return (
    <g style={{ opacity, transition: "opacity 0.25s ease" }}>
      {glow > 0 && <circle cx={particle.x} cy={particle.y} r={style.r + 5} fill={style.color} opacity={glow * 0.35} />}
      <circle cx={particle.x} cy={particle.y} r={style.r} fill={style.color} stroke="rgba(0,0,0,0.2)" strokeWidth="0.5" />
      <text x={particle.x} y={particle.y + style.r * 0.3} textAnchor="middle" fontSize={Math.max(6, style.r * 0.62)} fontWeight="700" fill="white">
        {style.label}
      </text>
    </g>
  );
}

function stylesFor(kind, system) {
  switch (kind) {
    case "H": return { color: "#c23b3b", r: 9, label: "H\u207A" };
    case "OH": return { color: "#2f4bc4", r: 9, label: "OH\u207B" };
    case "water": return { color: "#7fa8d9", r: 7, label: "H\u2082O" };
    case "spectator": return { color: "#7d8b9c", r: 8, label: system.spectatorShort };
    case "acid": return { color: "#c99a3a", r: 13, label: system.acidShort };
    case "base": return { color: "#3a9ac9", r: 13, label: system.baseShort };
    default: return null;
  }
}
