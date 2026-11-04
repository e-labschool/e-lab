/**
 * Two small 2D views of the magnetisation: side view (z up, one transverse axis horizontal) and top view (xy plane).
 *   mz, mxy       components in units of M0 (mxy >= 0 is the transverse length)
 *   azimuth       direction of the transverse part in the top view (radians)
 *   size          px of each square
 */
export default function MagnetisationMini({ mz, mxy, azimuth = 0, size = 120, label = true }) {
  const R = size * 0.38; const c = size / 2;
  const side = { x: c + R * mxy * Math.cos(azimuth), y: c - R * mz };
  const top = { x: c + R * mxy * Math.cos(azimuth), y: c - R * mxy * Math.sin(azimuth) };
  return (
    <div className="ss-mini" data-testid="mag-mini" role="img" aria-label={`Magnetisation: longitudinal component ${mz.toFixed(2)} and transverse component ${mxy.toFixed(2)} times M0`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x="1" y="1" width={size - 2} height={size - 2} rx="8" className="ss-plot-bg" />
        <line x1={c} y1="8" x2={c} y2={size - 8} className="ss-axis" /><line x1="8" y1={c} x2={size - 8} y2={c} className="ss-axis" />
        <circle cx={c} cy={c} r={R} fill="none" className="ss-axis" strokeDasharray="3 3" />
        <line x1={c} y1={c} x2={side.x} y2={side.y} stroke="var(--ss-mag)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={side.x} cy={side.y} r="4" fill="var(--ss-mag)" />
        {label && <text x={c + 4} y="14" className="ss-svgtext ss-svgtext--sm">z (B₀)</text>}
        {label && <text x={size - 6} y={c - 4} textAnchor="end" className="ss-svgtext ss-svgtext--sm">⊥</text>}
        {label && <text x="6" y={size - 6} className="ss-svgtext ss-svgtext--sm">side view</text>}
      </svg>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <rect x="1" y="1" width={size - 2} height={size - 2} rx="8" className="ss-plot-bg" />
        <line x1={c} y1="8" x2={c} y2={size - 8} className="ss-axis" /><line x1="8" y1={c} x2={size - 8} y2={c} className="ss-axis" />
        <circle cx={c} cy={c} r={R} fill="none" className="ss-axis" strokeDasharray="3 3" />
        {mxy > 0.01 && <line x1={c} y1={c} x2={top.x} y2={top.y} stroke="var(--ss-mxy)" strokeWidth="3" strokeLinecap="round" />}
        {mxy > 0.01 && <circle cx={top.x} cy={top.y} r="4" fill="var(--ss-mxy)" />}
        {label && <text x={size - 6} y={c - 4} textAnchor="end" className="ss-svgtext ss-svgtext--sm">x</text>}
        {label && <text x={c + 4} y="14" className="ss-svgtext ss-svgtext--sm">y</text>}
        {label && <text x="6" y={size - 6} className="ss-svgtext ss-svgtext--sm">top view</text>}
      </svg>
    </div>
  );
}
