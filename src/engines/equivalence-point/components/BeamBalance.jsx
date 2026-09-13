import IonSphere, { IonGradientDefs, SPECIES_STYLE } from "./IonSphere.jsx";

// A semi-realistic traditional beam balance built entirely from SVG
// gradients/shapes (no static image) — metallic stand and beam, brass
// pans, a graduated centre scale, and a needle. The needle and the beam
// are driven by the EXACT SAME `angleDeg` value (see the single
// `computeTitrationState().balance` -> `excessFractionToBeamAngle()`
// pipeline in the parent) — there is no independent "pointer physics"
// anywhere in this file, so the two can never contradict each other.
export default function BeamBalance({ angleDeg, leftCount, rightCount, cx = 450, cy = 175 }) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const armLength = 175;
  const leftX = cx - armLength * Math.cos(angleRad);
  const leftY = cy + armLength * Math.sin(angleRad);
  const rightX = cx + armLength * Math.cos(angleRad);
  const rightY = cy - armLength * Math.sin(angleRad);
  const panDrop = 46;

  const needleLength = 110;
  const needleX = cx + needleLength * Math.sin(angleRad);
  const needleY = cy - needleLength * Math.cos(angleRad);

  return (
    <g>
      <defs>
        <IonGradientDefs />
        <linearGradient id="metal-stand" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#5b6472" />
          <stop offset="50%" stopColor="#9aa6b5" />
          <stop offset="100%" stopColor="#5b6472" />
        </linearGradient>
        <linearGradient id="metal-beam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#aab4c2" />
          <stop offset="100%" stopColor="#6b7482" />
        </linearGradient>
        <linearGradient id="brass-pan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8cf82" />
          <stop offset="100%" stopColor="#b8933f" />
        </linearGradient>
      </defs>

      {/* base + column */}
      <ellipse cx={cx} cy={cy + 158} rx="70" ry="10" fill="rgba(20,25,35,0.15)" />
      <rect x={cx - 62} y={cy + 148} width="124" height="14" rx="4" fill="url(#metal-stand)" />
      <rect x={cx - 7} y={cy - 4} width="14" height="152" rx="4" fill="url(#metal-stand)" />
      <polygon points={`${cx - 13},${cy} ${cx + 13},${cy} ${cx},${cy - 18}`} fill="#4a5260" />

      {/* graduated centre scale, behind the needle */}
      <g stroke="var(--color-ink-faint)" strokeWidth="1.2">
        {[-2, -1, 0, 1, 2].map((tick) => {
          const tx = cx + tick * 14;
          return <line key={tick} x1={tx} y1={cy - 96} x2={tx} y2={cy - (tick === 0 ? 112 : 104)} />;
        })}
      </g>

      {/* beam */}
      <line x1={leftX} y1={leftY} x2={rightX} y2={rightY} stroke="url(#metal-beam)" strokeWidth="7" strokeLinecap="round" />
      <circle cx={leftX} cy={leftY} r="5" fill="#8993a1" />
      <circle cx={rightX} cy={rightY} r="5" fill="#8993a1" />

      {/* needle -- same angle as the beam, always */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="#c23b3b" strokeWidth="3" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="5" fill="#c23b3b" />
      {angleDeg === 0 && <circle cx={cx} cy={cy - 6} r="16" fill="none" stroke="var(--color-teal)" strokeWidth="1.5" opacity="0.55" />}

      {/* left pan (OH-) */}
      <PanWithSpheres x={leftX} y={leftY} drop={panDrop} species="OH" count={leftCount} />
      {/* right pan (H+) */}
      <PanWithSpheres x={rightX} y={rightY} drop={panDrop} species="H" count={rightCount} />
    </g>
  );
}

function PanWithSpheres({ x, y, drop, species, count }) {
  const panY = y + drop;
  const positions = spherePositions(count, x, panY - 12);
  const style = SPECIES_STYLE[species];

  return (
    <g>
      <line x1={x - 30} y1={y} x2={x - 8} y2={panY - 6} stroke="var(--color-ink-faint)" strokeWidth="1.3" />
      <line x1={x + 30} y1={y} x2={x + 8} y2={panY - 6} stroke="var(--color-ink-faint)" strokeWidth="1.3" />
      <ellipse cx={x} cy={panY} rx="46" ry="11" fill="url(#brass-pan)" stroke="#8a6d2e" strokeWidth="1.2" />
      <ellipse cx={x} cy={panY - 3} rx="40" ry="7" fill="#f0dca0" opacity="0.6" />
      {positions.map((p, i) => (
        <IonSphere key={i} x={p.x} y={p.y} species={species} r={11} />
      ))}
      {/* ONE clear label per pan, not per sphere — with up to 10 spheres
          stacked in two rows, a label under every individual sphere would
          overlap the row below it; colour + one label is unambiguous. */}
      <text x={x} y={panY + 26} textAnchor="middle" fontSize="12" fontWeight="700" fill={style.base}>
        {style.label}
      </text>
    </g>
  );
}

// Arranges up to 10 spheres in a loose two-row cluster above the pan --
// compact, never sprawling across the whole scene.
function spherePositions(count, cx, cy) {
  const positions = [];
  const perRow = 5;
  const spacingX = 24, spacingY = 22;
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / perRow);
    const col = i % perRow;
    const rowCount = Math.min(perRow, count - row * perRow);
    const rowOffset = ((rowCount - 1) * spacingX) / 2;
    positions.push({ x: cx - rowOffset + col * spacingX, y: cy - row * spacingY });
  }
  return positions;
}
