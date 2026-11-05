import { CONE_ANGLE } from "../physics/spinEnsemble.js";

const smooth = (x) => { const k = Math.min(1, Math.max(0, x)); return k * k * (3 - 2 * k); };
const STATE_TEXT = { on: "Resonance achieved", near: "Near resonance", off: "Off resonance" };
const C_LIGHT = 299792458;

/**
 * Step 3 left-top: ONE incoming RF wave travelling to the proton model, nothing else moves. (The old second wave, the proton's "own frequency",
 * is gone on purpose: a proton does not emit a continuous wave.)
 *   response (0..1)  the continuous-wave response: wave thickness, glow, absorption at the proton and the ring around it scale with it,
 *                    so there is a smooth gradation between off, near and on resonance (not a binary switch).
 *   region           "on" | "near" | "off" (cwRegion): only the label and colour.
 *   phase            display seconds (0 and static with reduced motion / pause)
 * The proton is a schematic sphere (turning stripe fixed: one animation at a time) with its moment arrow on the alpha cone about B0 (vertical).
 */
export default function RfWave({ response, region, phase, nu0Hz }) {
  const W = 480; const H = 176; const x0 = 14; const cx = 346; const cy = 100; const r = 31; const xEnd = cx - r - 6;
  const lam = 46; const speed = 64; const A0 = 19;
  const pts = [];
  for (let x = x0; x <= xEnd; x += 3) {
    const env = 1 - 0.7 * response * smooth((x - (xEnd - 110)) / 110); // absorbed on its way into the proton (resonance only)
    pts.push(`${x},${(cy - A0 * env * Math.sin((2 * Math.PI * (x - x0 - phase * speed)) / lam)).toFixed(1)}`);
  }
  const tilt = (CONE_ANGLE * 180) / Math.PI; const L = r + 33; const rr = L * Math.sin(CONE_ANGLE); const h = L * Math.cos(CONE_ANGLE);
  const psi = 0.9; // fixed stripe angle: the proton is not animated in this step
  const front = (a) => ({ rx: r * Math.abs(Math.sin(a)), vis: Math.cos(a) > 0, sweep: Math.sin(a) > 0 ? 1 : 0 });
  const s1 = front(psi); const s2 = front(psi + Math.PI);
  const stateColor = region === "on" ? "var(--ss-ok)" : region === "near" ? "var(--ss-warn)" : "var(--ss-muted)";
  const chipW = 156;
  const wavelengthCm = (C_LIGHT / nu0Hz) * 100;
  return (
    <svg className="ss-rfwave" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet" role="img" data-testid="rf-wave" data-region={region} data-response={response.toFixed(3)}
      aria-label={region === "on" ? "An incoming RF wave reaches the proton and is absorbed: resonance" : region === "near" ? "An incoming RF wave reaches the proton: near resonance, partly absorbed" : "An incoming RF wave reaches the proton but is not absorbed: off resonance"}>
      <defs>
        <radialGradient id="ss-proton-grad" cx="0.35" cy="0.3" r="0.85"><stop offset="0" stopColor="#f2f9ff" /><stop offset="0.55" stopColor="#8cc4f5" /><stop offset="1" stopColor="#2c6bd0" /></radialGradient>
        <marker id="ss-rfw-arr" viewBox="0 0 8 8" refX="4" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L8 4 L0 8 z" fill="context-stroke" /></marker>
        <clipPath id="ss-proton-clip"><circle r={r} /></clipPath>
      </defs>
      <text x={x0} y="18" className="ss-svgtext ss-svgtext--b" fill="var(--ss-rf)">Incoming RF wave</text>
      <text x={x0} y="33" className="ss-svgtext ss-svgtext--sm">travels toward the proton, photon energy hν_RF</text>
      <polyline points={pts.join(" ")} fill="none" stroke="var(--ss-rf)" strokeWidth={9 + 8 * response} strokeLinejoin="round" opacity={0.3 * response} data-testid="rf-wave-glow" />
      <polyline points={pts.join(" ")} fill="none" stroke={region === "on" ? "#ffd2a1" : "var(--ss-rf)"} strokeWidth={3 + 2.4 * response} strokeLinejoin="round" opacity={0.7 + 0.3 * response} data-testid="rf-wave-line" data-width={(3 + 2.4 * response).toFixed(2)} />
      <line x1={xEnd - 40} x2={xEnd + 2} y1={cy + 40} y2={cy + 40} stroke="var(--ss-rf)" strokeWidth="2.5" markerEnd="url(#ss-rfw-arr)" opacity="0.8" />
      <g transform={`translate(${cx} ${cy})`} data-testid="rf-proton">
        {/* B0 reference and the precession cone of the moment (static: precession itself is step 2) */}
        <ellipse cx="0" cy={-h} rx={rr} ry={rr * 0.27} fill="none" stroke="var(--ss-alpha)" strokeWidth="1.6" strokeDasharray="4 4" opacity="0.8" data-testid="precession-cone" />
        <line x1="0" y1="0" x2={-rr} y2={-h} stroke="var(--ss-alpha)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
        <line x1="0" y1="0" x2={rr} y2={-h} stroke="var(--ss-alpha)" strokeWidth="1" strokeDasharray="3 4" opacity="0.5" />
        {response > 0.02 && <circle r={r + 6 + 7 * response} fill="none" stroke="var(--ss-rf)" strokeWidth={2 + 3 * response} opacity={0.25 + 0.7 * response} data-testid="rf-halo" />}
        <g transform={`rotate(${tilt.toFixed(2)})`}>
          <circle r={r} fill="url(#ss-proton-grad)" stroke="#0a1330" strokeWidth="1.5" />
          <g clipPath="url(#ss-proton-clip)">
            <ellipse rx={r} ry={r * 0.27} fill="none" stroke="#1f56c9" strokeWidth="6" opacity="0.85" />
            {s1.vis && <path d={`M0,${-r} A${s1.rx.toFixed(2)},${r} 0 0 ${s1.sweep} 0,${r}`} fill="none" stroke="#fbbf24" strokeWidth="5" strokeLinecap="round" />}
            {s2.vis && <path d={`M0,${-r} A${s2.rx.toFixed(2)},${r} 0 0 ${s2.sweep} 0,${r}`} fill="none" stroke="#f2f7ff" strokeWidth="3.5" strokeLinecap="round" opacity="0.8" />}
          </g>
          <line x1="0" y1="0" x2="0" y2={-(L - 12)} stroke="var(--ss-mag)" strokeWidth="4.5" strokeLinecap="round" data-testid="moment-arrow" />
          <polygon points={`-8,${-(L - 12)} 8,${-(L - 12)} 0,${-L - 4}`} fill="var(--ss-mag)" data-testid="moment-arrowhead" />
        </g>
        <text x={Math.sin(CONE_ANGLE) * (L + 14)} y={-Math.cos(CONE_ANGLE) * (L + 14)} className="ss-svgtext ss-svgtext--b" fill="var(--ss-mag)">μ</text>
      </g>
      {/* the applied field, as the reference axis */}
      <line x1={cx + 112} x2={cx + 112} y1={cy + 34} y2={cy - 62} stroke="var(--ss-b0)" strokeWidth="4" markerEnd="url(#ss-rfw-arr)" data-testid="rf-b0-arrow" />
      <text x={cx + 112} y={cy + 50} textAnchor="middle" className="ss-svgtext ss-svgtext--b" fill="var(--ss-b0)">B₀</text>
      <g transform={`translate(${cx - chipW / 2 + 20} 6)`} data-testid="rf-state-chip" data-region={region}>
        <rect width={chipW} height="24" rx="12" fill="var(--ss-label-bg)" stroke={stateColor} strokeWidth="2" />
        <text x={chipW / 2} y="16.5" textAnchor="middle" className="ss-svgtext ss-svgtext--b" fill={stateColor} data-testid="rf-state-text">{STATE_TEXT[region]}</text>
      </g>
      <text x={x0} y={H - 5} className="ss-svgtext ss-svgtext--sm">{`Schematic, not to scale: the real wavelength is about ${wavelengthCm.toFixed(0)} cm.`}</text>
    </svg>
  );
}
