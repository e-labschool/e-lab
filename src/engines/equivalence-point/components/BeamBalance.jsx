// A traditional two-pan beam balance. Positive `angleDeg` means the
// LEFT pan (OH-) is down and the right pan (H+) is up; negative means
// the reverse. The needle rotates by the same angle, pointing away from
// centre exactly as far as the beam is tilted -- there is no separate
// "pointer physics", it is a direct, readable proxy for the beam angle.
export default function BeamBalance({ angleDeg, cx = 450, cy = 190 }) {
  const angleRad = (angleDeg * Math.PI) / 180;
  const armLength = 170;
  const leftX = cx - armLength * Math.cos(angleRad);
  const leftY = cy + armLength * Math.sin(angleRad);
  const rightX = cx + armLength * Math.cos(angleRad);
  const rightY = cy - armLength * Math.sin(angleRad);
  const panDrop = 60;

  const needleLength = 100;
  const needleX = cx + needleLength * Math.sin(angleRad);
  const needleY = cy - needleLength * Math.cos(angleRad);

  return (
    <g>
      {/* stand + fulcrum */}
      <line x1={cx} y1={cy} x2={cx} y2={cy + 150} stroke="var(--color-ink-faint)" strokeWidth="6" strokeLinecap="round" />
      <path d={`M ${cx - 50} ${cy + 150} L ${cx + 50} ${cy + 150}`} stroke="var(--color-ink-faint)" strokeWidth="6" strokeLinecap="round" />
      <polygon points={`${cx - 10},${cy} ${cx + 10},${cy} ${cx},${cy - 16}`} fill="var(--color-ink-soft)" />

      {/* needle -- rotates with the beam, pointing up from the fulcrum */}
      <line x1={cx} y1={cy} x2={needleX} y2={needleY} stroke="var(--color-coral)" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={cx} cy={cy} r="4" fill="var(--color-coral)" />
      {/* centre reference tick, so "near centre but not exact" is legible */}
      <line x1={cx} y1={cy - 96} x2={cx} y2={cy - 108} stroke="var(--color-ink-faint)" strokeWidth="1.5" />

      {/* beam */}
      <line x1={leftX} y1={leftY} x2={rightX} y2={rightY} stroke="var(--color-ink-soft)" strokeWidth="5" strokeLinecap="round" />

      {/* left pan -- OH- */}
      <g>
        <line x1={leftX} y1={leftY} x2={leftX} y2={leftY + panDrop} stroke="var(--color-ink-faint)" strokeWidth="1.5" />
        <path d={`M ${leftX - 34} ${leftY + panDrop} Q ${leftX} ${leftY + panDrop + 22} ${leftX + 34} ${leftY + panDrop}`} fill="none" stroke="var(--color-indigo)" strokeWidth="3" strokeLinecap="round" />
        <text x={leftX} y={leftY + panDrop + 42} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-indigo)">OH\u207B</text>
      </g>

      {/* right pan -- H+ */}
      <g>
        <line x1={rightX} y1={rightY} x2={rightX} y2={rightY + panDrop} stroke="var(--color-ink-faint)" strokeWidth="1.5" />
        <path d={`M ${rightX - 34} ${rightY + panDrop} Q ${rightX} ${rightY + panDrop + 22} ${rightX + 34} ${rightY + panDrop}`} fill="none" stroke="var(--color-coral)" strokeWidth="3" strokeLinecap="round" />
        <text x={rightX} y={rightY + panDrop + 42} textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--color-coral)">H\u207A</text>
      </g>
    </g>
  );
}
