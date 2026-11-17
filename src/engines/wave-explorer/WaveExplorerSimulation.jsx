import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { frequencyFromWavelengthNm, wavelengthNmFromFrequency, photonEnergyFromFrequency, formatScientific, SPEED_OF_LIGHT, PLANCK_CONSTANT } from "./lib/waveMath.js";
import { AMPLITUDE_PX_MAX } from "./lib/waveDisplayScale.js";
import { EM_REGIONS, regionOf, sliderToWavelengthNm, wavelengthNmToSlider, formatWavelength, photonEnergies, drawnWavelengthPx, amplitudeToPx, VISIBLE_NM_MIN, VISIBLE_NM_MAX, LOG_NM_MIN, LOG_NM_MAX } from "./lib/emSpectrum.js";
import { describeWaveChange } from "./lib/discoveryFeedback.js";
import { formatEv, SPEED_OF_SOUND, SOUND_HZ_DEFAULT, soundWavelengthM, soundSliderToHz, soundHzToSlider, formatSoundWavelength, formatHz, soundDrawnPx, soundVisualCps, nearestHydrogenTransition, compareQuestion, answerFor, visibleCps, freqHz, energyJ } from "./lib/wavePractice.js";
import ComparePanel from "./components/ComparePanel.jsx";
import TransverseWave from "./components/TransverseWave.jsx";
import LongitudinalWave from "./components/LongitudinalWave.jsx";

const DEFAULT_WAVELENGTH_NM = 550;
const DEFAULT_AMPLITUDE_T = 0.5; // 0..1, mapped to AMPLITUDE_PX_MIN..MAX

export default function WaveExplorerSimulation({ compact = false, standalone = false }) {
  const [waveType, setWaveType] = useState("transverse");
  const [wavelengthNm, setWavelengthNm] = useState(DEFAULT_WAVELENGTH_NM);
  const [amplitudeT, setAmplitudeT] = useState(DEFAULT_AMPLITUDE_T);
  const [paused, setPaused] = useState(false);
  // "visible" = linear 400-700 nm zoom (the original view); "full" = log scale, gamma to radio.
  const [rangeMode, setRangeMode] = useState("visible");
  const [lastChange, setLastChange] = useState(null); // { control, prevValue, nextValue }
  // Longitudinal (mechanical) wave: real sound units. Wave B + predict question for the comparison panel (WE-04).
  const [soundHz, setSoundHz] = useState(SOUND_HZ_DEFAULT);
  const [bNm, setBNm] = useState(450);
  const [qKind, setQKind] = useState("energy");
  const [guess, setGuess] = useState(null); // { g, aNm, bNm, kind }
  const [seed, setSeed] = useState(1);

  const frequency = frequencyFromWavelengthNm(wavelengthNm);
  const photonEnergy = photonEnergyFromFrequency(frequency);
  const amplitudePx = amplitudeToPx(amplitudeT, AMPLITUDE_PX_MAX); // 0 -> flat line
  const isTransverse = waveType === "transverse";
  const wavelengthPx = isTransverse ? drawnWavelengthPx(wavelengthNm, rangeMode) : soundDrawnPx(soundHz);
  const soundLambda = soundWavelengthM(soundHz);
  const cps = isTransverse ? (rangeMode === "visible" ? visibleCps(wavelengthNm) : undefined) : soundVisualCps(soundHz);
  const region = regionOf(wavelengthNm);
  const energies = photonEnergies(wavelengthNm);
  const hLine = isTransverse ? nearestHydrogenTransition(energies.eV) : null;
  const inVisible = wavelengthNm >= VISIBLE_NM_MIN && wavelengthNm <= VISIBLE_NM_MAX;

  // "Last change" is derived in the event handler (not inside another state's updater), so it is pure under StrictMode.
  function handleWavelengthChange(nextNm) {
    setLastChange({ control: "wavelength", prevValue: wavelengthNm, nextValue: nextNm });
    setWavelengthNm(nextNm);
  }

  // Frequency is a SLIDER, but wavelengthNm remains the one authoritative state value: the new frequency is converted
  // straight back to a wavelength via f = c/lambda, so the two can never drift apart.
  function handleFrequencyChange(nextFrequency) {
    const nextNm = wavelengthNmFromFrequency(nextFrequency);
    if (nextNm === null) return;
    setLastChange({ control: "wavelength", prevValue: wavelengthNm, nextValue: nextNm, viaFrequency: true });
    setWavelengthNm(nextNm);
  }

  function handleSoundChange(hz) {
    setLastChange({ control: "soundFrequency", prevValue: soundHz, nextValue: hz });
    setSoundHz(hz);
  }

  function handleAmplitudeChange(nextT) {
    setLastChange({ control: "amplitude", prevValue: amplitudeT, nextValue: nextT });
    setAmplitudeT(nextT);
  }

  function handleRangeMode(next) {
    setRangeMode(next);
    if (next === "visible") setWavelengthNm((nm) => Math.min(VISIBLE_NM_MAX, Math.max(VISIBLE_NM_MIN, nm)));
    setLastChange(null);
  }

  function handleWaveTypeChange(next) {
    setWaveType(next);
    setLastChange({ control: "waveType", prevValue: waveType, nextValue: next });
  }

  function handleReset() {
    // Resets EVERYTHING: wave type, range mode, playback, wavelength and amplitude.
    setWaveType("transverse");
    setRangeMode("visible");
    setPaused(false);
    setWavelengthNm(DEFAULT_WAVELENGTH_NM);
    setAmplitudeT(DEFAULT_AMPLITUDE_T);
    setSoundHz(SOUND_HZ_DEFAULT);
    setBNm(450);
    setQKind("energy");
    setGuess(null);
    setSeed(1);
    setLastChange(null);
  }

  const message = lastChange ? describeWaveChange(lastChange.control, lastChange.prevValue, lastChange.nextValue, waveType) : null;
  const emphasize = lastChange?.control;
  const emphasizeDiscovery = lastChange?.control === "wavelength" && lastChange.nextValue < lastChange.prevValue;
  const WaveComponent = waveType === "transverse" ? TransverseWave : LongitudinalWave;
  const full = rangeMode === "full";
  const freqMin = full ? Math.log10(frequencyFromWavelengthNm(10 ** LOG_NM_MAX)) : frequencyFromWavelengthNm(VISIBLE_NM_MAX);
  const freqMax = full ? Math.log10(frequencyFromWavelengthNm(10 ** LOG_NM_MIN)) : frequencyFromWavelengthNm(VISIBLE_NM_MIN);

  return (
    <InteractiveFrame title="Wave Explorer" subtitle="Visualise wave properties and their relationships" compact={compact} standalone={standalone}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 1180 }}>
        {/* header row: type tabs + pause/reset */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" aria-pressed={isTransverse} onClick={() => handleWaveTypeChange("transverse")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Transverse Wave
          </button>
          <button type="button" aria-pressed={!isTransverse} onClick={() => handleWaveTypeChange("longitudinal")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${!isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Longitudinal Wave
          </button>
          <button type="button" aria-pressed={paused} aria-label={paused ? "Play animation (currently paused)" : "Pause animation"} onClick={() => setPaused((p) => !p)} className="ml-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={handleReset} title="Reset wave type, range, playback, wavelength, frequency, amplitude and the A vs B comparison" className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            Reset
          </button>
        </div>

        {/* main dashboard row: controls | viewer | values */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
          {/* LEFT: wave controls */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Wave Controls</p>

            {isTransverse && (
              <div className="flex gap-1" role="group" aria-label="Wavelength range">
                <button type="button" aria-pressed={!full} onClick={() => handleRangeMode("visible")} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${!full ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>Visible light</button>
                <button type="button" aria-pressed={full} onClick={() => handleRangeMode("full")} className={`flex-1 rounded-md px-2 py-1 text-[11px] font-semibold ${full ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>Whole EM spectrum</button>
              </div>
            )}

            {!isTransverse && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-[var(--color-ink)]">Frequency (f) {"\u2014"} log scale</span>
                <input type="range" min="0" max="1" step="0.001" value={soundHzToSlider(soundHz)} onChange={(e) => handleSoundChange(soundSliderToHz(Number(e.target.value)))} aria-label="Sound frequency in hertz, logarithmic scale from 20 hertz to 20 kilohertz" aria-valuetext={`${formatHz(soundHz)}, wavelength ${formatSoundWavelength(soundLambda)}`} />
                <span className="text-[11px] text-[var(--color-ink-soft)]">{formatHz(soundHz)} {"\u2022"} {"\u03BB"} = {formatSoundWavelength(soundLambda)}</span>
              </label>
            )}

            {isTransverse && <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">{"Wavelength (\u03BB)"}{full ? " \u2014 log scale" : ""}</span>
              {full && isTransverse ? (
                <input type="range" min="0" max="1" step="0.001" value={wavelengthNmToSlider(wavelengthNm)} onChange={(e) => handleWavelengthChange(sliderToWavelengthNm(Number(e.target.value)))} aria-label="Wavelength, logarithmic scale from 1 picometre to 1 kilometre" aria-valuetext={`${formatWavelength(wavelengthNm)}, ${region.label}`} />
              ) : (
                <input type="range" min={VISIBLE_NM_MIN} max={VISIBLE_NM_MAX} step="1" value={Math.min(VISIBLE_NM_MAX, Math.max(VISIBLE_NM_MIN, wavelengthNm))} onChange={(e) => handleWavelengthChange(Number(e.target.value))} aria-label="Wavelength in nanometres, 400 to 700" aria-valuetext={`${wavelengthNm.toFixed(0)} nanometres`} />
              )}
              <span className="text-[11px] text-[var(--color-ink-soft)]">{formatWavelength(wavelengthNm)}{` \u2022 ${region.label}`}</span>
            </label>}

            {isTransverse && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-[var(--color-ink)]">Frequency (f){full ? " \u2014 log scale" : ""}</span>
                {full ? (
                  <input type="range" min={freqMin} max={freqMax} step="0.005" value={Math.log10(frequency)} onChange={(e) => handleFrequencyChange(10 ** Number(e.target.value))} aria-label="Frequency in hertz, logarithmic scale" aria-valuetext={`${formatScientific(frequency, 3)} hertz`} />
                ) : (
                  <input type="range" min={freqMin} max={freqMax} step={(freqMax - freqMin) / 300} value={Math.min(freqMax, Math.max(freqMin, frequency))} onChange={(e) => handleFrequencyChange(Number(e.target.value))} aria-label="Frequency in hertz" aria-valuetext={`${formatScientific(frequency, 3)} hertz`} />
                )}
                <span className="text-[11px] text-[var(--color-ink-soft)]">{formatScientific(frequency, 3)} Hz</span>
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">Amplitude (A)</span>
              <input type="range" min="0" max="1" step="0.01" value={amplitudeT} onChange={(e) => handleAmplitudeChange(Number(e.target.value))} aria-label="Amplitude, relative" aria-valuetext={amplitudeT === 0 ? "zero: flat line" : `${amplitudeT.toFixed(2)} relative`} />
              <span className="text-[11px] text-[var(--color-ink-soft)]">{amplitudeT === 0 ? "Zero amplitude: no wave" : "Adjust wave height"}</span>
            </label>
          </div>

          {/* CENTER: large wave viewer */}
          <div className="flex flex-col gap-1.5">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <WaveComponent wavelengthNm={wavelengthNm} wavelengthPx={wavelengthPx} amplitudePx={amplitudePx} paused={paused} emphasize={emphasize} cyclesPerSecond={cps} wavelengthLabel={isTransverse ? undefined : formatSoundWavelength(soundLambda)} />
            </div>
            <p className="text-center text-[10px] text-[var(--color-ink-faint)]">
              {isTransverse
                ? "Frequency (f) = number of complete waves passing a point each second. 1 Hz = 1 cycle per second."
                : "Transverse: particle motion \u22A5 wave direction \u2022 Longitudinal: particle motion \u2225 wave direction"}
              <br />
              <span className="italic">{full && isTransverse ? "Drawn wavelength and animation speed are compressed: 15 orders of magnitude cannot be drawn to scale." : "Animation not to scale"}</span>
            </p>
          </div>

          {/* RIGHT: real-time values */}
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Wave Values \u2014 Real-time"}</p>
            <div>
              <p className="text-[10px] text-[var(--color-ink-faint)]">{"Wavelength (\u03BB)"}</p>
              <p className="text-base font-bold" style={{ color: "var(--color-indigo)" }}>{isTransverse ? formatWavelength(wavelengthNm) : formatSoundWavelength(soundLambda)}</p>
            </div>
            {!isTransverse && (
              <div className="border-t border-[var(--color-line)] pt-2">
                <p className="text-[10px] text-[var(--color-ink-faint)]">Frequency (f)</p>
                <p className="text-base font-bold" style={{ color: "var(--color-violet)" }}>{formatHz(soundHz)}</p>
              </div>
            )}
            {isTransverse && (
              <>
                <div className="border-t border-[var(--color-line)] pt-2">
                  <p className="text-[10px] text-[var(--color-ink-faint)]">Frequency (f)</p>
                  <p className="text-base font-bold" style={{ color: "var(--color-violet)" }}>{formatScientific(frequency, 3)} Hz</p>
                </div>
              </>
            )}
            <div className="border-t border-[var(--color-line)] pt-2">
              <p className="text-[10px] text-[var(--color-ink-faint)]">Amplitude (A)</p>
              <p className="text-base font-bold" style={{ color: "var(--color-teal)" }}>{amplitudeT.toFixed(2)} relative</p>
            </div>
            <div className="border-t border-[var(--color-line)] pt-2">
              <p className="text-[10px] text-[var(--color-ink-faint)]">{isTransverse ? "Wave speed (c)" : "Wave speed (v, sound in air, 20 \u00B0C)"}</p>
              <p className="text-sm font-bold" style={{ color: "var(--color-amber)" }}>{isTransverse ? formatScientific(SPEED_OF_LIGHT, 3) : SPEED_OF_SOUND}{" m s\u207B\u00B9"}</p>
            </div>
          </div>
        </div>

        {/* bottom row */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Relations Between Quantities</p>
            {isTransverse ? (
              <>
                <p className="mt-1 text-center font-mono text-lg font-bold text-[var(--color-ink)]">{"c = f\u03BB"}</p>
                <dl className="mt-1 space-y-0.5 text-[11px] text-[var(--color-ink-soft)]">
                  <div className="flex justify-between"><dt>c</dt><dd>{formatScientific(SPEED_OF_LIGHT, 3)}{" m s\u207B\u00B9"}</dd></div>
                  <div className="flex justify-between"><dt>{"\u03BB"}</dt><dd>{formatWavelength(wavelengthNm)}</dd></div>
                  <div className="flex justify-between"><dt>f</dt><dd>{formatScientific(frequency, 3)} Hz</dd></div>
                </dl>
                <p className={`mt-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)] ${emphasizeDiscovery ? "wave-discovery-emphasis" : ""}`}>
                  {"Wavelength and frequency are inversely related \u2014 if wavelength increases, frequency decreases."}
                </p>
              </>
            ) : (
              <>
                <p className="mt-1 text-center font-mono text-lg font-bold text-[var(--color-ink)]">{"v = f\u03BB"}</p>
                <dl className="mt-1 space-y-0.5 text-[11px] text-[var(--color-ink-soft)]">
                  <div className="flex justify-between"><dt>v (air, 20 {"\u00B0"}C)</dt><dd>{SPEED_OF_SOUND}{" m s\u207B\u00B9"}</dd></div>
                  <div className="flex justify-between"><dt>f</dt><dd>{formatHz(soundHz)}</dd></div>
                  <div className="flex justify-between"><dt>{"\u03BB = v / f"}</dt><dd>{formatSoundWavelength(soundLambda)}</dd></div>
                </dl>
                <p className="mt-1.5 text-[11px] text-[var(--color-ink-soft)]">The drawn wavelength is schematic (not to scale); the numbers are real. Sound needs a medium; light does not.</p>
              </>
            )}
          </div>

          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Explore the Relationship</p>
            <div className="grid grid-cols-3 gap-1.5 text-center text-[10px]">
              <div className="rounded-md bg-[var(--color-paper)] p-1.5">
                <p className="font-bold text-[var(--color-indigo)]">Shorter {"\u03BB"}</p>
                {isTransverse ? <p className="mt-0.5 text-[var(--color-ink-faint)]">Higher f, higher photon energy</p> : <p className="mt-0.5 text-[var(--color-ink-faint)]">Higher f</p>}
              </div>
              <div className="rounded-md bg-[var(--color-paper)] p-1.5">
                <p className="font-bold text-[var(--color-indigo)]">Longer {"\u03BB"}</p>
                {isTransverse ? <p className="mt-0.5 text-[var(--color-ink-faint)]">Lower f, lower photon energy</p> : <p className="mt-0.5 text-[var(--color-ink-faint)]">Lower f</p>}
              </div>
              <div className="rounded-md bg-[var(--color-paper)] p-1.5">
                <p className="font-bold text-[var(--color-teal)]">Higher A</p>
                <p className="mt-0.5 text-[var(--color-ink-faint)]">Amplitude does not change frequency or wavelength</p>
              </div>
            </div>
          </div>

          {isTransverse ? (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Photon Energy (for EM waves)</p>
              <p className="mt-1 text-center font-mono text-base font-bold text-[var(--color-ink)]">E = hf = hc/{"\u03BB"}</p>
              <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]">{"h = "}{formatScientific(PLANCK_CONSTANT, 4)}{" J s"}</p>
              <p className="mt-1 text-sm font-bold" style={{ color: "var(--color-amber)" }}>{formatScientific(photonEnergy, 3)}{" J photon\u207B\u00B9"}</p>
              <p className="text-[11px] text-[var(--color-ink-soft)]">{`= ${formatEv(energies.eV, formatScientific)} eV = ${formatEv(energies.kJPerMol, formatScientific)} kJ mol\u207B\u00B9`}</p>
              <p className="mt-1 text-[11px] font-semibold text-[var(--color-ink)]">Higher frequency (shorter {"\u03BB"}) {"\u2192"} higher photon energy</p>
              <p className="mt-1.5 border-t border-[var(--color-line)] pt-1.5 text-[11px] text-[var(--color-ink-soft)]" data-testid="photon-strip">
                {hLine
                  ? hLine.close
                    ? `Wave to photon: this matches hydrogen's n = ${hLine.hi} \u2192 ${hLine.lo} transition (${hLine.eV.toFixed(2)} eV, ${hLine.nm.toFixed(0)} nm). See it in Atomic Spectra Lab.`
                    : `Wave to photon: the nearest hydrogen line is n = ${hLine.hi} \u2192 ${hLine.lo} (${hLine.eV.toFixed(2)} eV, ${hLine.nm.toFixed(0)} nm), which is ${(hLine.rel * 100).toFixed(0)}% ${hLine.higher ? "higher" : "lower"} in energy than this photon.`
                  : "Wave to photon: no hydrogen emission line (n up to 8) is within 50% of this energy."}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Longitudinal Waves</p>
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                Particles oscillate parallel to the direction the wave travels, creating regions of compression and rarefaction. Photon-energy calculations apply to electromagnetic radiation, not generic mechanical waves like this one.
              </p>
            </div>
          )}
        </div>

        {isTransverse && (
          <ComparePanel
            aNm={wavelengthNm}
            bNm={bNm}
            onB={setBNm}
            kind={qKind}
            onKind={(k) => { setQKind(k); setGuess(null); }}
            guess={guess}
            onGuess={setGuess}
            onNewPair={() => {
              const q = compareQuestion(seed + 1, qKind);
              setSeed(seed + 1);
              setRangeMode("full");
              setWavelengthNm(q.aNm);
              setBNm(q.bNm);
              setGuess(null);
              setLastChange(null);
            }}
          />
        )}

        {isTransverse && (
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-2" aria-label="Electromagnetic spectrum regions">
            <div className="flex flex-wrap justify-center gap-1 text-[10px] font-semibold">
              {EM_REGIONS.map((r) => (
                <span key={r.id} className={`rounded px-2 py-0.5 ${r.id === region.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>{r.label}</span>
              ))}
            </div>
            <p className="mt-1 text-center text-[10px] text-[var(--color-ink-soft)]">{inVisible ? "This wavelength is visible light." : `${region.label}: not visible to the human eye.`}</p>
          </div>
        )}

        {/* discovery feedback -- kept compact, not a full-width duplicate card */}
        {message && (
          <p className="text-center text-xs text-[var(--color-ink-soft)]" role="status" aria-live="polite">{message}</p>
        )}

        <style>{`
          @keyframes wave-discovery-emphasis-kf { 0%, 100% { background-color: transparent; } 50% { background-color: var(--color-indigo-soft); } }
          .wave-discovery-emphasis { animation: wave-discovery-emphasis-kf 700ms ease-in-out 1; }
        `}</style>
      </div>
    </InteractiveFrame>
  );
}
