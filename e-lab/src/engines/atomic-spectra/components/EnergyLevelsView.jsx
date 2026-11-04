import { useState, useMemo } from "react";
import { availableUpwardTransitions, availableDownwardTransitions, matchAbsorptionByEnergy, ionizationEnergyEv, MAX_LEVEL } from "../lib/transitionMatching.js";
import { wavelengthNmToFrequencyHz, classifyRegion } from "../lib/photonMath.js";
import EnergyLevelDiagram from "./EnergyLevelDiagram.jsx";
import PhotonWave from "./PhotonWave.jsx";
import MiniSpectrumStrip from "./MiniSpectrumStrip.jsx";

function regionLabel(region) {
  if (region === "ultraviolet") return "Ultraviolet \u2014 not visible to the human eye";
  if (region === "infrared") return "Infrared \u2014 not visible to the human eye";
  return "Visible";
}

/** Absorption is deliberately TRANSITION-FIRST: the student selects a
 * target level before touching any energy control, immediately seeing
 * Delta E for that specific transition -- only THEN does a photon-energy
 * control appear (defaulted to the exact required energy, but freely
 * adjustable so the student can deliberately try a wrong value). This
 * replaces an earlier free-wavelength-slider-first design. */
export default function EnergyLevelsView() {
  const [subMode, setSubMode] = useState("absorption");

  // ---- Absorption state ----
  const [absorptionFrom, setAbsorptionFrom] = useState(1);
  const [targetLevel, setTargetLevel] = useState(null); // null | number | Infinity -- nothing selected yet
  const [photonEnergy, setPhotonEnergy] = useState(null); // set once a target is chosen
  const [sendResult, setSendResult] = useState(null);

  const upwardOptions = useMemo(() => availableUpwardTransitions(absorptionFrom), [absorptionFrom]);
  const selectedTarget = useMemo(() => upwardOptions.find((t) => t.toLevel === targetLevel) ?? null, [upwardOptions, targetLevel]);
  const ionizationEv = useMemo(() => ionizationEnergyEv(absorptionFrom), [absorptionFrom]);

  function handleSelectTarget(toLevel) {
    setTargetLevel(toLevel);
    const target = upwardOptions.find((t) => t.toLevel === toLevel);
    setPhotonEnergy(target ? target.deltaEv : ionizationEv);
    setSendResult(null);
  }

  function handleSendPhoton() {
    if (photonEnergy == null) return;
    const match = matchAbsorptionByEnergy(absorptionFrom, photonEnergy);
    if (match?.kind === "bound") {
      setSendResult({ outcome: "bound", fromLevel: absorptionFrom, ...match });
      setAbsorptionFrom(match.toLevel);
      setTargetLevel(null);
      setPhotonEnergy(null);
    } else if (match?.kind === "ionization") {
      setSendResult({ outcome: "ionization", fromLevel: absorptionFrom, ...match });
    } else {
      setSendResult({ outcome: "none", requiredEv: selectedTarget?.deltaEv ?? ionizationEv });
    }
  }

  // ---- Emission state (unchanged design: the transition itself
  // determines photon energy -- no independent slider here) ----
  const [emissionFrom, setEmissionFrom] = useState(3);
  const [emissionTo, setEmissionTo] = useState(2);
  const downwardOptions = useMemo(() => availableDownwardTransitions(emissionFrom), [emissionFrom]);
  const emissionTransition = downwardOptions.find((t) => t.toLevel === emissionTo);

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

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2" style={{ height: 400 }}>
          <EnergyLevelDiagram
            markerLevel={subMode === "absorption" ? absorptionFrom : emissionFrom}
            highlightFrom={subMode === "absorption" ? (targetLevel != null ? absorptionFrom : null) : emissionFrom}
            highlightTo={subMode === "absorption" ? targetLevel : emissionTo}
          />
        </div>

        {subMode === "absorption" ? (
          <div className="flex flex-col gap-2.5">
            <p className="text-xs text-[var(--color-ink-soft)]">Electron starts at <strong className="text-[var(--color-ink)]">n = {absorptionFrom}</strong>. Select a target level to see the energy required.</p>

            <div className="flex flex-wrap gap-1">
              {upwardOptions.map((t) => (
                <button key={t.toLevel} type="button" onClick={() => handleSelectTarget(t.toLevel)} aria-pressed={targetLevel === t.toLevel} className={`rounded-md px-2 py-1 text-[10px] font-medium ${targetLevel === t.toLevel ? "border border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
                  {t.toLevel === Infinity ? `n${absorptionFrom}\u2192\u221E (ionization)` : `n${absorptionFrom}\u2192${t.toLevel}`}
                </button>
              ))}
            </div>

            {targetLevel != null && (
              <div className="rounded-lg bg-[var(--color-paper)] p-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Selected transition</p>
                <p className="text-sm font-bold text-[var(--color-ink)]">{"n = "}{absorptionFrom}{" \u2192 n = "}{targetLevel === Infinity ? "\u221E" : targetLevel}</p>
                {targetLevel === Infinity ? (
                  <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{"Ionization threshold: "}<strong>{ionizationEv.toFixed(2)} eV</strong></p>
                ) : (
                  <>
                    <p className="mt-1 text-xs text-[var(--color-ink-soft)]">{"\u0394E = "}<strong>{selectedTarget.deltaEv.toFixed(2)} eV</strong></p>
                    <p className="text-[11px] text-[var(--color-ink-faint)]">{"\u03BB = "}{selectedTarget.wavelengthNm.toFixed(1)}{" nm \u2022 f = "}{(wavelengthNmToFrequencyHz(selectedTarget.wavelengthNm) / 1e15).toFixed(2)}{"\u00D710\u00B9\u2075 Hz"}</p>
                  </>
                )}
              </div>
            )}

            {targetLevel != null && (
              <>
                <label className="flex flex-col gap-1 text-xs">
                  <span className="font-semibold text-[var(--color-ink)]">Photon energy</span>
                  <input type="range" min={(selectedTarget?.deltaEv ?? ionizationEv) * 0.5} max={(selectedTarget?.deltaEv ?? ionizationEv) * 1.6} step="0.01" value={photonEnergy ?? 0} onChange={(e) => { setPhotonEnergy(Number(e.target.value)); setSendResult(null); }} aria-label="Photon energy in electron-volts" />
                  <span className="text-[11px] text-[var(--color-ink-soft)]">{photonEnergy?.toFixed(2)} eV</span>
                </label>

                <div className="flex items-center gap-2">
                  <button type="button" onClick={handleSendPhoton} className="rounded-md bg-[var(--color-indigo)] px-3 py-1.5 text-xs font-semibold text-white">
                    Send Photon
                  </button>
                  <PhotonWave wavelengthNm={photonEnergy ? (selectedTarget ? selectedTarget.wavelengthNm : 91.2) : 500} />
                </div>
              </>
            )}

            {sendResult && (
              <div className="rounded-lg p-2.5" style={{ backgroundColor: sendResult.outcome !== "none" ? "var(--color-teal-soft)" : "var(--color-coral-soft)" }}>
                {sendResult.outcome === "bound" && (
                  <>
                    <p className="text-sm font-bold text-[var(--color-teal)]">ABSORBED</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{"n = "}{sendResult.fromLevel}{" \u2192 n = "}{sendResult.toLevel}{" \u2022 \u0394E = "}{sendResult.deltaEv.toFixed(2)}{" eV"}</p>
                    <div className="mt-1.5">
                      <MiniSpectrumStrip wavelengthNm={sendResult.wavelengthNm} />
                    </div>
                  </>
                )}
                {sendResult.outcome === "ionization" && (
                  <>
                    <p className="text-sm font-bold text-[var(--color-teal)]">IONIZED</p>
                    <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">The electron leaves the atom entirely. Any photon energy above the ionization threshold becomes kinetic energy of the freed electron.</p>
                    <div className="mt-1.5 grid grid-cols-1 gap-0.5 text-xs text-[var(--color-ink-soft)] sm:grid-cols-3">
                      <p><strong className="text-[var(--color-ink)]">Photon energy</strong><br />{photonEnergy.toFixed(2)} eV</p>
                      <p><strong className="text-[var(--color-ink)]">Ionization energy</strong><br />{sendResult.thresholdEv.toFixed(2)} eV</p>
                      <p><strong className="text-[var(--color-ink)]">Electron KE</strong><br />{sendResult.excessKeEv.toFixed(2)} eV</p>
                    </div>
                  </>
                )}
                {sendResult.outcome === "none" && (
                  <>
                    <p className="text-sm font-bold text-[var(--color-coral)]">NOT ABSORBED</p>
                    <p className="mt-0.5 text-xs text-[var(--color-ink-soft)]">{"Photon: "}{photonEnergy?.toFixed(2)}{" eV \u2022 required: "}{sendResult.requiredEv.toFixed(2)}{" eV. Photon energy does not match an available energy gap \u2014 the radiation continues through."}</p>
                  </>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">Initial level</span>
              <select value={emissionFrom} onChange={(e) => { const n = Number(e.target.value); setEmissionFrom(n); const opts = availableDownwardTransitions(n); if (!opts.find((o) => o.toLevel === emissionTo)) setEmissionTo(opts[0]?.toLevel ?? 1); }} className="rounded-md border border-[var(--color-line)] px-2 py-1">
                {Array.from({ length: MAX_LEVEL - 1 }, (_, i) => i + 2).map((n) => <option key={n} value={n}>n = {n}</option>)}
              </select>
              <span className="font-semibold text-[var(--color-ink)]">Final level</span>
              <select value={emissionTo} onChange={(e) => setEmissionTo(Number(e.target.value))} className="rounded-md border border-[var(--color-line)] px-2 py-1">
                {downwardOptions.map((t) => <option key={t.toLevel} value={t.toLevel}>n = {t.toLevel}</option>)}
              </select>
            </div>

            {emissionTransition && (
              <>
                <div className="rounded-lg bg-[var(--color-paper)] p-2.5 text-xs text-[var(--color-ink-soft)]">
                  <p><strong className="text-[var(--color-ink)]">{"\u0394E = "}</strong>{emissionTransition.deltaEv.toFixed(2)} eV</p>
                  <p><strong className="text-[var(--color-ink)]">{"\u03BB = "}</strong>{emissionTransition.wavelengthNm.toFixed(1)} nm</p>
                  <p><strong className="text-[var(--color-ink)]">Region: </strong>{regionLabel(classifyRegion(emissionTransition.wavelengthNm))}</p>
                </div>
                <div className="flex items-center gap-2">
                  <PhotonWave wavelengthNm={emissionTransition.wavelengthNm} />
                </div>
                <MiniSpectrumStrip wavelengthNm={emissionTransition.wavelengthNm} />
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
