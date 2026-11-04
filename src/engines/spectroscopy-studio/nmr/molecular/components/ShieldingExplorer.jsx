import { useId } from "react";
import { deshieldingIndex, fieldShiftMicroTesla, offsetHz, shieldingVerdict, DELTA_SCALE_MAX } from "../model/shielding.js";
import { EnvBadge } from "./SpectrumPlot.jsx";
import { EnvChip } from "./EnvBits.jsx";

// Conceptual (qualitative, NOT to scale) picture of shielding: B0, the induced circulation of electron density around the proton, the
// small induced field that opposes B0 at the nucleus, and the resulting effective field B_eff = B0 (1 - sigma). Two protons are
// compared (the selected environment and a reference). Arrow lengths are exaggerated: real sigma differences are ~10^-6.

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

export default function ShieldingExplorer({ mol, selectedEnvId, onSelectEnv, compareEnvId, onCompare, freqMHz, b0Tesla, mode, onClose }) {
  const uid = useId();
  const env = mol.environments.find((e) => e.id === selectedEnvId) ?? null;
  const cmp = compareEnvId && compareEnvId !== selectedEnvId ? mol.environments.find((e) => e.id === compareEnvId) ?? null : null;
  const shieldOf = (e) => (e ? 1 - deshieldingIndex(e.delta) : 1);
  const verdict = env ? shieldingVerdict(env) : null;
  const rulerX = (d) => 28 + ((DELTA_SCALE_MAX + 0.6 - d) / (DELTA_SCALE_MAX + 0.6 + 0.2)) * 304;
  return (
    <div className="nm-shield" data-testid="shielding-explorer">
      <div className="nm-sh-head">
        <h3 className="nm-h">Shielding and chemical shift</h3>
        {onClose && <button type="button" className="sim-btn nm-textbtn" onClick={onClose} data-testid="shield-close">Back to environments</button>}
      </div>
      {!env ? (
        <p className="nm-note" data-testid="shield-hint">Select a hydrogen in the molecule (or a chip below) to see why its environment sets its chemical shift.</p>
      ) : null}
      <div className="nm-env-row" role="group" aria-label="Choose the proton to examine">
        {mol.environments.map((e) => <EnvChip key={e.id} env={e} selected={e.id === selectedEnvId} onClick={() => onSelectEnv(e.id)} showShift testId={`shield-chip-${e.id}`} />)}
      </div>
      <svg viewBox="0 0 440 222" className="nm-shield-svg" role="img" aria-labelledby={`${uid}-t`} data-testid="shield-diagram">
        <title id={`${uid}-t`}>Conceptual diagram: the external field B0 induces circulation of electron density, which creates a small opposing field at the proton, so the effective field B_eff is slightly smaller than B0.</title>
        <Panel title={env ? `${env.label} proton` : "Selected proton"} env={env} x={0} shield={env ? shieldOf(env) : 0.5} />
        <line x1="220" x2="220" y1="8" y2="214" stroke="#2a4080" strokeDasharray="3 4" />
        <Panel title={cmp ? `${cmp.label} proton` : "TMS proton"} env={cmp} reference={!cmp} x={220} shield={cmp ? shieldOf(cmp) : 1} />
      </svg>
      <div className="nm-compare-row">
        <span className="nm-note-s">Compare with:</span>
        <button type="button" className="sim-btn nm-textbtn" aria-pressed={!cmp} onClick={() => onCompare(null)} data-testid="compare-tms">TMS reference</button>
        {mol.environments.filter((e) => e.id !== selectedEnvId).map((e) => <button key={e.id} type="button" className="sim-btn nm-textbtn" aria-pressed={cmp?.id === e.id} onClick={() => onCompare(e.id)} data-testid={`compare-${e.id}`}>{e.label}</button>)}
      </div>
      <svg viewBox="0 0 360 74" className="nm-ruler" role="img" aria-label="Chemical shift scale from 12 ppm on the left to 0 ppm on the right. Deshielded protons are downfield (left), shielded protons upfield (right)." data-testid="shield-ruler">
        <line x1="20" x2="340" y1="40" y2="40" stroke="#cdd9f5" strokeWidth="2" />
        {[0, 2, 4, 6, 8, 10].map((t) => <g key={t}><line x1={rulerX(t)} x2={rulerX(t)} y1="36" y2="44" stroke="#cdd9f5" /><text x={rulerX(t)} y="58" textAnchor="middle" fontSize="10" fill="#dbe6ff" className="nm-svgtext">{t}</text></g>)}
        <text x="20" y="12" fontSize="10" fill="#a9bbe3" className="nm-svgtext">◀ downfield · deshielded · higher δ</text>
        <text x="340" y="12" textAnchor="end" fontSize="10" fill="#a9bbe3" className="nm-svgtext">upfield · shielded · lower δ ▶</text>
        <text x={rulerX(0)} y="72" textAnchor="middle" fontSize="9.5" fill="#e8f0ff" className="nm-svgtext">TMS</text>
        {mol.environments.map((e) => (
          <g key={e.id} transform={`translate(${rulerX(e.delta)} 26)`} role="button" tabIndex={0} aria-label={`${e.label} at ${e.delta} ppm`} style={{ cursor: "pointer" }} onClick={() => onSelectEnv(e.id)} onKeyDown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onSelectEnv(e.id); } }} data-testid={`ruler-${e.id}`}>
            <EnvBadge env={e} r={e.id === selectedEnvId ? 9.5 : 7.5} />
          </g>
        ))}
      </svg>
      <div className="nm-explain" data-testid="shield-text" aria-live="polite">
        {env ? (
          <>
            <p><b>{env.label}</b> (environment {env.letter}): δ ≈ {env.delta.toFixed(1)} ppm. {verdict.text}</p>
            <p className="nm-math">δ = (ν − ν<sub>ref</sub>) / ν<sub>ref</sub> × 10⁶ &nbsp;·&nbsp; ν = (γ/2π) B<sub>eff</sub>, B<sub>eff</sub> = B₀(1 − σ)</p>
            <p>At {freqMHz} MHz, δ = {env.delta.toFixed(2)} ppm is {offsetHz(env.delta, freqMHz).toFixed(0)} Hz from TMS, equivalent to a field difference of only B₀ × δ × 10⁻⁶ ≈ {fieldShiftMicroTesla(env.delta, b0Tesla).toFixed(0)} µT ({b0Tesla.toFixed(2)} T field): a tiny shift, which is why it is quoted in parts per million.</p>
            <p className="nm-note-s">{env.exchangeable ? "Exchangeable O–H: shift is variable (booklet range 1.0–6.0 ppm); the value shown is a placeholder." : `Representative value; booklet/literature range ${env.range[0]}–${env.range[1]} ppm.`}</p>
          </>
        ) : (
          <p className="nm-math">δ = (ν − ν<sub>ref</sub>) / ν<sub>ref</sub> × 10⁶, measured relative to a reference (TMS, defined as δ = 0).</p>
        )}
        <details className="nm-terms" open={mode === "teacher"}>
          <summary>Terms: shielded, deshielded, upfield, downfield, chemical shift</summary>
          <dl>
            <dt>Shielded</dt><dd>Surrounded by more electron density: the induced field opposing B₀ is larger, B<sub>eff</sub> is smaller, the signal is at lower δ (upfield).</dd>
            <dt>Deshielded</dt><dd>Electron density is pulled away (e.g. by oxygen or C=O): less opposing field, B<sub>eff</sub> is larger, the signal is at higher δ (downfield).</dd>
            <dt>Upfield / downfield</dt><dd>Towards the right (low δ) / towards the left (high δ) of the spectrum.</dd>
            <dt>Chemical shift, δ</dt><dd>The resonance frequency relative to the reference divided by the reference frequency, in ppm. It is the same number at any spectrometer frequency; the offset in Hz is not.</dd>
          </dl>
          <p className="nm-note-s">Caution: electrons are not a rigid shield. B₀ induces a circulation of electron density, and that induced field is what opposes B₀ at the nucleus. Other local fields (for example the anisotropy of C=O) also contribute.</p>
        </details>
      </div>
    </div>
  );
}
