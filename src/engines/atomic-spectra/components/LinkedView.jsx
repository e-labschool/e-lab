import { useState } from "react";
import { availableDownwardTransitions } from "../lib/transitionMatching.js";
import { wavelengthNmToFrequencyHz, classifyRegion } from "../lib/photonMath.js";
import { wavelengthToPosition, VISIBLE_MIN_NM, VISIBLE_MAX_NM } from "../lib/spectrumMath.js";
import { wavelengthToCSS } from "../lib/wavelengthColor.js";
import EnergyLevelDiagram from "./EnergyLevelDiagram.jsx";
import PhotonWave from "./PhotonWave.jsx";

// The four visible hydrogen Balmer lines (n->2), computed from the SAME
// verified hydrogenEnergy/photonMath functions used everywhere else in
// this engine -- never a separately hand-typed list, so there is only
// one place these values could ever be wrong.
const BALMER_VISIBLE = [3, 4, 5, 6].map((n) => {
  const t = availableDownwardTransitions(n).find((d) => d.toLevel === 2);
  return { fromLevel: n, toLevel: 2, deltaEv: t.deltaEv, wavelengthNm: t.wavelengthNm };
});

function regionLabel(region) {
  if (region === "ultraviolet") return "Ultraviolet";
  if (region === "infrared") return "Infrared";
  return "Visible";
}

/** The signature integrative view: one selected hydrogen transition
 * drives THREE coordinated panels (energy levels, photon, spectrum)
 * simultaneously, and is reachable from either direction -- selecting
 * a transition highlights its spectral line, and clicking a spectral
 * line selects the corresponding transition. Deliberately scoped to
 * the visible Balmer series (n->2) for this pass: this is exactly the
 * set of transitions that has both a real energy-level story AND a
 * real, clickable spectral line, which is the whole point of this view. */
export default function LinkedView() {
  const [selected, setSelected] = useState(BALMER_VISIBLE[0]); // default n=3->2, the signature example

  function selectByFromLevel(fromLevel) {
    setSelected(BALMER_VISIBLE.find((t) => t.fromLevel === fromLevel));
  }
  function selectByWavelength(wavelengthNm) {
    const closest = BALMER_VISIBLE.reduce((best, t) => (Math.abs(t.wavelengthNm - wavelengthNm) < Math.abs(best.wavelengthNm - wavelengthNm) ? t : best));
    setSelected(closest);
  }

  const frequency = wavelengthNmToFrequencyHz(selected.wavelengthNm);
  const region = classifyRegion(selected.wavelengthNm);

  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      {/* LEFT: energy levels */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2">
        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Energy Levels</p>
        <div style={{ height: 320 }}>
          <EnergyLevelDiagram markerLevel={selected.fromLevel} highlightFrom={selected.fromLevel} highlightTo={selected.toLevel} />
        </div>
        <div className="mt-1 flex flex-wrap justify-center gap-1">
          {BALMER_VISIBLE.map((t) => (
            <button key={t.fromLevel} type="button" onClick={() => selectByFromLevel(t.fromLevel)} aria-pressed={selected.fromLevel === t.fromLevel} className={`rounded-md px-2 py-1 text-[10px] font-medium ${selected.fromLevel === t.fromLevel ? "border border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
              {`n${t.fromLevel}\u2192${t.toLevel}`}
            </button>
          ))}
        </div>
      </div>

      {/* CENTRE: photon */}
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Photon</p>
        <PhotonWave wavelengthNm={selected.wavelengthNm} />
        <dl className="w-full max-w-[180px] space-y-1 text-xs text-[var(--color-ink-soft)]">
          <div className="flex justify-between"><dt>{"\u0394E"}</dt><dd className="font-semibold text-[var(--color-ink)]">{selected.deltaEv.toFixed(2)} eV</dd></div>
          <div className="flex justify-between"><dt>f</dt><dd className="font-semibold text-[var(--color-ink)]">{(frequency / 1e14).toFixed(2)}{"\u00D710\u00B9\u2074 Hz"}</dd></div>
          <div className="flex justify-between"><dt>{"\u03BB"}</dt><dd className="font-semibold text-[var(--color-ink)]">{selected.wavelengthNm.toFixed(1)} nm</dd></div>
          <div className="flex justify-between"><dt>Region</dt><dd className="font-semibold text-[var(--color-ink)]">{regionLabel(region)}</dd></div>
        </dl>
      </div>

      {/* RIGHT: spectrum */}
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2">
        <p className="mb-1 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Spectrum</p>
        <svg viewBox="0 0 280 320" className="h-auto w-full" role="img" aria-label="Hydrogen visible emission spectrum, click a line to see its transition">
          <rect x="0" y="0" width="280" height="320" fill="#050608" />
          {BALMER_VISIBLE.map((t) => {
            const x = wavelengthToPosition(t.wavelengthNm, VISIBLE_MIN_NM, VISIBLE_MAX_NM) * 280;
            const isSelected = t.fromLevel === selected.fromLevel;
            return (
              <line key={t.fromLevel} x1={x} y1="10" x2={x} y2="310" stroke={wavelengthToCSS(t.wavelengthNm)} strokeWidth={isSelected ? 4 : 2} opacity={isSelected ? 1 : 0.7} style={{ cursor: "pointer" }} onClick={() => selectByWavelength(t.wavelengthNm)} />
            );
          })}
        </svg>
        <p className="mt-1 text-center text-[11px] text-[var(--color-ink-soft)]">{selected.wavelengthNm.toFixed(1)} nm</p>
      </div>
    </div>
  );
}
