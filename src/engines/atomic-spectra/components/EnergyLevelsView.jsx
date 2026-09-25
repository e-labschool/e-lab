import { useState, useMemo } from "react";
import { availableUpwardTransitions, availableDownwardTransitions, matchAbsorption, MAX_LEVEL } from "../lib/transitionMatching.js";
import { wavelengthNmToEnergyEv, wavelengthNmToFrequencyHz, classifyRegion } from "../lib/photonMath.js";
import EnergyLevelDiagram from "./EnergyLevelDiagram.jsx";
import PhotonWave from "./PhotonWave.jsx";

const MIN_WAVELENGTH_NM = 85;
const MAX_WAVELENGTH_NM = 700;

function regionLabel(region) {
  if (region === "ultraviolet") return "Ultraviolet \u2014 not visible to the human eye";
  if (region === "infrared") return "Infrared \u2014 not visible to the human eye";
  return "Visible";
}

export default function EnergyLevelsView() {
  const [subMode, setSubMode] = useState("absorption"); // "absorption" | "emission"

  // ---- Absorption state ----
  const [absorptionFrom, setAbsorptionFrom] = useState(1);
  const [incomingWavelength, setIncomingWavelength] = useState(122);
  const [absorptionResult, setAbsorptionResult] = useState(null); // { matched, transition } | null

  const upwardOptions = useMemo(() => availableUpwardTransitions(absorptionFrom), [absorptionFrom]);

  function handleSendPhoton() {
    const match = matchAbsorption(absorptionFrom, incomingWavelength);
    if (match) {
      // Store the ORIGINAL starting level explicitly alongside the
      // transition, since absorptionFrom (the "current state" driving
      // the marker) is about to be updated to the new level -- without
      // this, the diagram's from/to highlight would end up describing
      // a transition from the electron's NEW level to itself.
      setAbsorptionResult({ matched: true, fromLevel: absorptionFrom, transition: match });
      if (match.toLevel !== Infinity) setAbsorptionFrom(match.toLevel);
    } else {
      setAbsorptionResult({ matched: false });
    }
  }

  // ---- Emission state ----
  const [emissionFrom, setEmissionFrom] = useState(4);
  const [emissionTo, setEmissionTo] = useState(2);
  const downwardOptions = useMemo(() => availableDownwardTransitions(emissionFrom), [emissionFrom]);
  const emissionTransition = downwardOptions.find((t) => t.toLevel === emissionTo);

  const incomingEv = wavelengthNmToEnergyEv(incomingWavelength);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-center gap-1.5">
        <button type="button" onClick={() => setSubMode("absorption")} aria-pressed={subMode === "absorption"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${subMode === "absorption" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
          Absorption
        </button>
        <button type="button" onClick={() => setSubMode("emission")} aria-pressed={subMode === "emission"} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${subMode === "emission" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
          Emission
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,220px)_minmax(0,1fr)]">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2" style={{ height: 340 }}>
          <EnergyLevelDiagram
            markerLevel={subMode === "absorption" ? absorptionFrom : emissionFrom}
            highlightFrom={subMode === "absorption" ? (absorptionResult?.matched ? absorptionResult.fromLevel : null) : emissionFrom}
            highlightTo={subMode === "absorption" ? (absorptionResult?.matched ? absorptionResult.transition.toLevel : null) : emissionTo}
          />
        </div>

        {subMode === "absorption" ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs text-[var(--color-ink-soft)]">Electron starts at <strong className="text-[var(--color-ink)]">n = {absorptionFrom}</strong>. Send a photon and see whether it's absorbed.</p>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">Incoming wavelength {"\u03BB"}</span>
              <input type="range" min={MIN_WAVELENGTH_NM} max={MAX_WAVELENGTH_NM} step="0.5" value={incomingWavelength} onChange={(e) => { setIncomingWavelength(Number(e.target.value)); setAbsorptionResult(null); }} aria-label="Incoming photon wavelength in nanometres" />
              <span className="text-[11px] text-[var(--color-ink-faint)]">
                {"\u03BB = "}{incomingWavelength.toFixed(1)}{" nm \u2022 f = "}{(wavelengthNmToFrequencyHz(incomingWavelength) / 1e14).toFixed(2)}{"\u00D710\u00B9\u2074 Hz \u2022 E = "}{incomingEv?.toFixed(2)}{" eV"}
              </span>
            </label>

            <div className="flex flex-wrap gap-1">
              <span className="mr-1 self-center text-[10px] text-[var(--color-ink-faint)]">Try a transition:</span>
              {upwardOptions.map((t) => (
                <button key={t.toLevel} type="button" onClick={() => { setIncomingWavelength(t.wavelengthNm); setAbsorptionResult(null); }} className="rounded-md border border-[var(--color-line)] px-2 py-1 text-[10px] font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-indigo)]">
                  {`n${absorptionFrom}\u2192${t.toLevel === Infinity ? "\u221E" : t.toLevel}`}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={handleSendPhoton} className="rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white">
                Send Photon
              </button>
              <PhotonWave wavelengthNm={incomingWavelength} />
            </div>

            {absorptionResult && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: absorptionResult.matched ? "var(--color-teal-soft)" : "var(--color-coral-soft)" }}>
                <p className="text-sm font-bold" style={{ color: absorptionResult.matched ? "var(--color-teal)" : "var(--color-coral)" }}>
                  {absorptionResult.matched ? "ABSORBED" : "NOT ABSORBED"}
                </p>
                {absorptionResult.matched ? (
                  <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">
                    {"n = "}{absorptionResult.fromLevel}{" \u2192 n = "}{absorptionResult.transition.toLevel === Infinity ? "\u221E (ionized)" : absorptionResult.transition.toLevel}
                    {" \u2022 \u0394E = "}{absorptionResult.transition.deltaEv.toFixed(2)}{" eV \u2022 \u03BB = "}{absorptionResult.transition.wavelengthNm.toFixed(1)}{" nm"}
                  </p>
                ) : (
                  <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">Photon energy does not match an available energy gap. The radiation continues through.</p>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">Initial level</span>
              <select value={emissionFrom} onChange={(e) => { const n = Number(e.target.value); setEmissionFrom(n); const opts = availableDownwardTransitions(n); if (!opts.find(o=>o.toLevel===emissionTo)) setEmissionTo(opts[0]?.toLevel ?? 1); }} className="rounded-md border border-[var(--color-line)] px-2 py-1">
                {Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>n = {n}</option>)}
              </select>
              <span className="font-semibold text-[var(--color-ink)]">Final level</span>
              <select value={emissionTo} onChange={(e) => setEmissionTo(Number(e.target.value))} className="rounded-md border border-[var(--color-line)] px-2 py-1">
                {downwardOptions.map((t) => <option key={t.toLevel} value={t.toLevel}>n = {t.toLevel}</option>)}
              </select>
            </div>

            {emissionTransition && (
              <>
                <div className="flex items-center gap-2">
                  <PhotonWave wavelengthNm={emissionTransition.wavelengthNm} />
                </div>
                <div className="rounded-lg bg-[var(--color-paper-raised)] p-2.5 text-xs text-[var(--color-ink-soft)]">
                  <p><strong className="text-[var(--color-ink)]">{"\u0394E = "}</strong>{emissionTransition.deltaEv.toFixed(2)} eV</p>
                  <p><strong className="text-[var(--color-ink)]">{"\u03BB = "}</strong>{emissionTransition.wavelengthNm.toFixed(1)} nm</p>
                  <p><strong className="text-[var(--color-ink)]">Region: </strong>{regionLabel(classifyRegion(emissionTransition.wavelengthNm))}</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
