import { useId } from "react";
import { deshieldingIndex, fieldShiftMicroTesla, offsetHz, shieldingVerdict } from "../model/shielding.js";
import { EnvBadge } from "./SpectrumPlot.jsx";

// Conceptual (qualitative, NOT to scale) picture of shielding: B0, the induced circulation of electron density around the proton, the
// small induced field that opposes B0 at the nucleus, and the resulting effective field B_eff = B0 (1 - sigma). The selected environment is
// compared with the TMS reference. Arrow lengths are exaggerated: real sigma differences are ~10^-6.

function Arrow({ x, y1, y2, color, width = 3, head = 8, dashed }) {
  const dir = y2 < y1 ? -1 : 1;
  return (
    <g stroke={color} fill={color}>
      <line x1={x} x2={x} y1={y1} y2={y2 - dir * head * 0.6} strokeWidth={width} strokeDasharray={dashed ? "4 3" : undefined} />
      <path d={`M${x} ${y2}l${-head * 0.7} ${-dir * head}h${head * 1.4}z`} stroke="none" />
    </g>
  );
}

function Panel({ title, env, reference, x, shield }) {
  // shield: 0..1 qualitative strength of the induced (opposing) field
  const B0 = 78; const ind = 8 + shield * 40; const eff = B0 - ind;
  const cx = x + 96; const cy = 118; const ringR = 26 + shield * 8;
  const ringOpacity = 0.28 + shield * 0.6;
  return (
    <g>
      <text x={x + 6} y={16} fontSize="12.5" fontWeight="800" fill="#e8f0ff" className="nm-svgtext">{title}</text>
      {env && <g transform={`translate(${x + 186} 11)`}><EnvBadge env={env} r={8} /></g>}
      {/* B0 */}
      <Arrow x={x + 22} y1={176} y2={176 - B0} color="#60a5fa" width={4} head={11} />
      <text x={x + 10} y={196} fontSize="12" fontWeight="800" fill="#93c5fd" className="nm-svgtext">B₀</text>
      <Arrow x={x + 40} y1={176} y2={176 - B0} color="#60a5fa" width={2} head={7} dashed />
      {/* electron circulation (induced by B0) */}
      <ellipse cx={cx} cy={cy} rx={ringR} ry={ringR * 0.55} fill="none" stroke="#2dd4bf" strokeWidth={2 + shield * 4} opacity={ringOpacity} strokeDasharray={shield < 0.35 ? "3 5" : undefined} />
      <path d={`M${cx + ringR - 2} ${cy - 6}l7 8l-9 1`} fill="#2dd4bf" stroke="#2dd4bf" strokeWidth="1.5" opacity={Math.min(1, ringOpacity + 0.2)} />
      <text x={cx} y={cy - ringR * 0.55 - 8} textAnchor="middle" fontSize="10" fill="#7ce6d8" className="nm-svgtext">electron circulation</text>
      {/* nucleus */}
      <circle cx={cx} cy={cy} r="12" fill="#e8eefc" stroke="#0a1330" strokeWidth="1.5" />
      <text x={cx} y={cy + 0.5} textAnchor="middle" dominantBaseline="central" fontSize="13" fontWeight="800" fill="#0a1330" className="nm-svgtext">H</text>
      {/* induced field at the nucleus (opposes B0) */}
      <Arrow x={cx + 40} y1={cy - ind / 2} y2={cy + ind / 2} color="#fbbf24" width={3.5} head={8} />
      <text x={cx + 47} y={cy + 4} fontSize="10.5" fontWeight="700" fill="#fcd34d" className="nm-svgtext">B_induced</text>
      <text x={cx + 47} y={cy + 17} fontSize="9.5" fill="#fcd34d" className="nm-svgtext">opposes B₀</text>
      {/* effective field */}
      <Arrow x={cx} y1={176} y2={176 - eff} color="#a78bfa" width={4} head={10} />
      <text x={cx + 8} y={196} fontSize="11.5" fontWeight="800" fill="#c4b5fd" className="nm-svgtext">B_eff = B₀(1 − σ)</text>
      <text x={x + 6} y={212} fontSize="10.5" fill="#a9bbe3" className="nm-svgtext">{reference ? "reference: tetramethylsilane (TMS)" : "qualitative; not to scale"}</text>
    </g>
  );
}

/** Compact shielding diagram + a short verdict for one environment (step 6, chemical-shift sub-stage). */
export default function ShieldingDiagram({ env, freqMHz, b0Tesla }) {
  const uid = useId();
  const verdict = env ? shieldingVerdict(env) : null;
  const shieldOf = (e) => (e ? 1 - deshieldingIndex(e.delta) : 1);
  return (
    <div className="nm-shield" data-testid="shielding-diagram">
      <svg viewBox="0 0 440 222" className="nm-shield-svg" role="img" aria-labelledby={`${uid}-t`} data-testid="shield-diagram">
        <title id={`${uid}-t`}>Conceptual diagram: the external field B0 induces circulation of electron density, which creates a small opposing field at the proton, so the effective field B_eff is slightly smaller than B0. The selected proton is compared with the TMS reference.</title>
        <Panel title={env ? `${env.label} proton` : "Selected proton"} env={env} x={0} shield={env ? shieldOf(env) : 0.5} />
        <line x1="220" x2="220" y1="8" y2="214" stroke="#2a4080" strokeDasharray="3 4" />
        <Panel title="TMS proton" env={null} reference x={220} shield={1} />
      </svg>
      {env ? (
        <p className="nm-note-s" data-testid="shield-text"><b>{env.label}</b>: δ ≈ {env.delta.toFixed(1)} ppm. {verdict.text} At {freqMHz.toFixed(1)} MHz that is {offsetHz(env.delta, freqMHz).toFixed(0)} Hz from TMS, from a field change of only B₀ × δ × 10⁻⁶ ≈ {fieldShiftMicroTesla(env.delta, b0Tesla).toFixed(0)} µT.</p>
      ) : (
        <p className="nm-note-s" data-testid="shield-text">Select a hydrogen to compare its shielding with the reference.</p>
      )}
    </div>
  );
}
