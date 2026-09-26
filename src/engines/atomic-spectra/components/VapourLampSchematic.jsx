import { useReducedMotion } from "../lib/useReducedMotion.js";

const TUBE_W = 150;
const TUBE_H = 46;

// Fixed, deterministic atom-marker positions inside the tube -- never
// randomised per render (that would make every screenshot/regression
// comparison unstable for no visual benefit).
const ATOM_POSITIONS = [
  { x: 28, y: 16 }, { x: 52, y: 30 }, { x: 78, y: 14 },
  { x: 100, y: 32 }, { x: 122, y: 18 }, { x: 40, y: 34 },
  { x: 90, y: 24 }, { x: 112, y: 12 },
];

/** A genuine schematic of a discharge tube: glass envelope, two
 * electrodes at either end, atom markers (labelled "atoms", never
 * "molecules" -- vapour lamps contain free atoms, not molecular gas),
 * and a glow that only appears once the tube is "excited". This
 * replaces the earlier plain text box + down-arrow "flowchart". */
export default function VapourLampSchematic({ elementName, species, excited = true, glowColor = "#F5C542" }) {
  const reduced = useReducedMotion();

  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${TUBE_W} ${TUBE_H + 20}`} width={TUBE_W} height={TUBE_H + 20} role="img" aria-label={`${elementName} discharge tube containing ${species}, ${excited ? "electrically excited" : "unexcited"}`}>
        {/* soft ambient glow behind the glass, only while excited */}
        {excited && (
          <ellipse cx={TUBE_W / 2} cy={TUBE_H / 2 + 6} rx={TUBE_W / 2 - 4} ry={TUBE_H / 2 + 6} fill={glowColor} opacity={reduced ? 0.18 : 0.22}>
            {!reduced && (
              <animate attributeName="opacity" values="0.14;0.26;0.14" dur="2.4s" repeatCount="indefinite" />
            )}
          </ellipse>
        )}

        {/* electrodes */}
        <rect x="2" y={TUBE_H / 2 - 10 + 6} width="8" height="20" rx="1.5" fill="#8b8f9e" />
        <rect x={TUBE_W - 10} y={TUBE_H / 2 - 10 + 6} width="8" height="20" rx="1.5" fill="#8b8f9e" />
        <line x1="6" y1={TUBE_H / 2 + 6} x2="6" y2={TUBE_H + 18} stroke="#8b8f9e" strokeWidth="2" />
        <line x1={TUBE_W - 6} y1={TUBE_H / 2 + 6} x2={TUBE_W - 6} y2={TUBE_H + 18} stroke="#8b8f9e" strokeWidth="2" />
        <text x="6" y={TUBE_H + 17} textAnchor="middle" fontSize="6" fill="var(--color-ink-faint)">{"−"}</text>
        <text x={TUBE_W - 6} y={TUBE_H + 17} textAnchor="middle" fontSize="6" fill="var(--color-ink-faint)">{"+"}</text>

        {/* glass envelope */}
        <rect x="10" y="6" width={TUBE_W - 20} height={TUBE_H} rx={TUBE_H / 2} fill={excited ? "rgba(58,45,5,0.55)" : "rgba(20,20,24,0.5)"} stroke="#5a5f70" strokeWidth="1.5" />
        <rect x="10" y="6" width={TUBE_W - 20} height={TUBE_H} rx={TUBE_H / 2} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="4" />

        {/* atom markers -- discrete dots, explicitly atoms not molecules */}
        {ATOM_POSITIONS.map((p, i) => (
          <circle key={i} cx={14 + p.x * ((TUBE_W - 28) / TUBE_W)} cy={10 + p.y * (TUBE_H / (TUBE_H + 20))} r={excited ? 2.1 : 1.6} fill={excited ? glowColor : "#9aa0b0"} opacity={excited ? 0.95 : 0.6}>
            {excited && !reduced && (
              <animate attributeName="r" values="1.6;2.4;1.6" dur={`${1.8 + (i % 3) * 0.3}s`} repeatCount="indefinite" begin={`${i * 0.15}s`} />
            )}
          </circle>
        ))}
      </svg>
      <p className="text-center text-[10px] font-bold text-[var(--color-ink)]">{elementName}{" vapour lamp"}</p>
      <p className="text-center text-[9px] text-[var(--color-ink-faint)]">{species}{excited ? ", electrically excited" : ""}</p>
    </div>
  );
}
