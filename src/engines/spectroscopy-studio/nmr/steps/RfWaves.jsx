/**
 * The incoming RF wave (top) against the nucleus's own precession frequency (bottom). Both travel to the right. The VISUAL wavelength
 * difference is exaggerated (a real offset of 100 Hz in 400 MHz is one part in four million and could not be drawn): the picture only
 * shows "in step" (on resonance) against "drifting out of step". `offsetHz` is the real offset; `phase` is the ambient display clock.
 */
export default function RfWaves({ offsetHz, phase, onResonance, absorption }) {
  const W = 900; const H = 170; const x0 = 16; const x1 = 700;
  const lam0 = 54; const lam = lam0 / (1 + (0.4 * offsetHz) / 100);
  const wave = (cy, amp, wl, f) => {
    const pts = [];
    for (let x = x0; x <= x1; x += 3) pts.push(`${x},${(cy - amp * Math.sin((2 * Math.PI * (x - x0)) / wl - 2 * Math.PI * f * phase)).toFixed(1)}`);
    return pts.join(" ");
  };
  const fRf = lam0 / lam;
  const cx = 800; const cy = 112;
  return (
    <svg className="ss-rfwaves" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" data-testid="rf-waves" data-on-resonance={onResonance ? "1" : "0"}
      aria-label={onResonance ? "The incoming RF wave and the proton's precession are in step: resonance" : "The incoming RF wave drifts out of step with the proton's precession: no resonance"}>
      <text x={x0} y="16" className="ss-svgtext ss-svgtext--b" fill="var(--ss-rf)">Incoming RF wave (frequency ν_rf)</text>
      <polyline points={wave(46, 15, lam, fRf)} fill="none" stroke="var(--ss-rf)" strokeWidth="3" strokeLinejoin="round" data-testid="rf-wave-line" />
      <text x={x0} y="92" className="ss-svgtext ss-svgtext--b" fill="var(--ss-alpha)">The proton's own frequency (ν₀)</text>
      <polyline points={wave(122, 15, lam0, 1)} fill="none" stroke="var(--ss-alpha)" strokeWidth="3" strokeDasharray="8 5" strokeLinejoin="round" />
      <line x1={x1 + 8} x2={x1 + 8} y1="24" y2="146" stroke="var(--ss-line)" strokeDasharray="3 4" />
      {/* the nucleus */}
      <g transform={`translate(${cx} ${cy})`} data-testid="rf-nucleus">
        {onResonance && <circle r={26 + 6 * Math.sin(phase * 5)} fill="none" stroke="var(--ss-rf)" strokeWidth="3" opacity="0.9" />}
        <circle r="19" fill="#e8eefc" stroke="#0a1330" strokeWidth="2" />
        <text textAnchor="middle" dominantBaseline="central" fontSize="16" fontWeight="800" fill="#0a1330">H</text>
      </g>
      <text x={cx} y="26" textAnchor="middle" className="ss-svgtext ss-svgtext--b">{onResonance ? "absorbs: α → β" : "ignores the wave"}</text>
      <text x={cx} y="44" textAnchor="middle" className="ss-svgtext ss-svgtext--sm">{`absorption ${Math.round(absorption * 100)} % of maximum`}</text>
      <text x={x0} y={H - 4} className="ss-svgtext ss-svgtext--sm">Wavelength difference exaggerated in the picture; the real offset is only a few hertz in 400 million.</text>
    </svg>
  );
}
