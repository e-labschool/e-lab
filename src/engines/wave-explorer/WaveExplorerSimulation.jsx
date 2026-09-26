import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { frequencyFromWavelengthNm, wavelengthNmFromFrequency, photonEnergyFromFrequency, formatScientific, SPEED_OF_LIGHT, PLANCK_CONSTANT } from "./lib/waveMath.js";
import { wavelengthNmToPx, AMPLITUDE_PX_MIN, AMPLITUDE_PX_MAX } from "./lib/waveDisplayScale.js";
import { describeWaveChange } from "./lib/discoveryFeedback.js";
import TransverseWave from "./components/TransverseWave.jsx";
import LongitudinalWave from "./components/LongitudinalWave.jsx";

const WAVELENGTH_NM_MIN = 400;
const WAVELENGTH_NM_MAX = 700;
const DEFAULT_WAVELENGTH_NM = 550;
const DEFAULT_AMPLITUDE_T = 0.5; // 0..1, mapped to AMPLITUDE_PX_MIN..MAX

export default function WaveExplorerSimulation({ compact = false }) {
  const [waveType, setWaveType] = useState("transverse");
  const [wavelengthNm, setWavelengthNm] = useState(DEFAULT_WAVELENGTH_NM);
  const [amplitudeT, setAmplitudeT] = useState(DEFAULT_AMPLITUDE_T);
  const [paused, setPaused] = useState(false);
  const [lastChange, setLastChange] = useState(null); // { control, prevValue, nextValue }

  const frequency = frequencyFromWavelengthNm(wavelengthNm);
  const photonEnergy = photonEnergyFromFrequency(frequency);
  const amplitudePx = AMPLITUDE_PX_MIN + amplitudeT * (AMPLITUDE_PX_MAX - AMPLITUDE_PX_MIN);
  const wavelengthPx = wavelengthNmToPx(wavelengthNm);

  const handleWavelengthChange = useCallback((nextNm) => {
    setWavelengthNm((prev) => {
      setLastChange({ control: "wavelength", prevValue: prev, nextValue: nextNm });
      return nextNm;
    });
  }, []);

  // Frequency is a SLIDER, but wavelengthNm remains the one
  // authoritative state value -- moving the frequency slider converts
  // the new frequency straight back to a wavelength via f = c/lambda
  // and writes THAT into the same wavelengthNm state, so the two can
  // never independently drift out of sync with each other.
  const handleFrequencyChange = useCallback((nextFrequency) => {
    setWavelengthNm((prev) => {
      const prevFrequency = frequencyFromWavelengthNm(prev);
      const nextNm = wavelengthNmFromFrequency(nextFrequency);
      if (nextNm === null) return prev;
      setLastChange({ control: "wavelength", prevValue: prev, nextValue: nextNm, viaFrequency: true, prevFrequency, nextFrequency });
      return nextNm;
    });
  }, []);

  const handleAmplitudeChange = useCallback((nextT) => {
    setAmplitudeT((prev) => {
      setLastChange({ control: "amplitude", prevValue: prev, nextValue: nextT });
      return nextT;
    });
  }, []);

  function handleWaveTypeChange(next) {
    setWaveType(next);
    setLastChange({ control: "waveType", prevValue: waveType, nextValue: next });
  }

  function handleReset() {
    setWavelengthNm(DEFAULT_WAVELENGTH_NM);
    setAmplitudeT(DEFAULT_AMPLITUDE_T);
    setLastChange(null);
  }

  const message = lastChange ? describeWaveChange(lastChange.control, lastChange.prevValue, lastChange.nextValue, waveType) : null;
  const emphasize = lastChange?.control;
  const emphasizeDiscovery = lastChange?.control === "wavelength" && lastChange.nextValue < lastChange.prevValue;
  const WaveComponent = waveType === "transverse" ? TransverseWave : LongitudinalWave;
  const isTransverse = waveType === "transverse";
  const freqMin = frequencyFromWavelengthNm(WAVELENGTH_NM_MAX);
  const freqMax = frequencyFromWavelengthNm(WAVELENGTH_NM_MIN);

  return (
    <InteractiveFrame title="Wave Explorer" subtitle="Visualise wave properties and their relationships" compact={compact}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 1180 }}>
        {/* header row: type tabs + pause/reset */}
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => handleWaveTypeChange("transverse")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Transverse Wave
          </button>
          <button type="button" onClick={() => handleWaveTypeChange("longitudinal")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${!isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Longitudinal Wave
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="ml-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={handleReset} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            Reset
          </button>
        </div>

        {/* main dashboard row: controls | viewer | values */}
        <div className="grid grid-cols-1 gap-3 lg:grid-cols-[220px_minmax(0,1fr)_240px]">
          {/* LEFT: wave controls */}
          <div className="flex flex-col gap-2.5 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Wave Controls</p>

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">{"Wavelength (\u03BB)"}</span>
              <input type="range" min={WAVELENGTH_NM_MIN} max={WAVELENGTH_NM_MAX} step="1" value={wavelengthNm} onChange={(e) => handleWavelengthChange(Number(e.target.value))} aria-label="Wavelength in nanometres" />
              <span className="text-[11px] text-[var(--color-ink-soft)]">{wavelengthNm.toFixed(0)} nm</span>
            </label>

            {isTransverse && (
              <label className="flex flex-col gap-1 text-xs">
                <span className="font-semibold text-[var(--color-ink)]">Frequency (f)</span>
                <input type="range" min={freqMin} max={freqMax} step={(freqMax - freqMin) / 300} value={frequency} onChange={(e) => handleFrequencyChange(Number(e.target.value))} aria-label="Frequency in hertz" />
                <span className="text-[11px] text-[var(--color-ink-soft)]">{formatScientific(frequency, 3)} Hz</span>
              </label>
            )}

            <label className="flex flex-col gap-1 text-xs">
              <span className="font-semibold text-[var(--color-ink)]">Amplitude (A)</span>
              <input type="range" min="0" max="1" step="0.01" value={amplitudeT} onChange={(e) => handleAmplitudeChange(Number(e.target.value))} aria-label="Amplitude" />
              <span className="text-[11px] text-[var(--color-ink-faint)]">Adjust wave height</span>
            </label>
          </div>

          {/* CENTER: large wave viewer */}
          <div className="flex flex-col gap-1.5">
            <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <WaveComponent wavelengthNm={wavelengthNm} wavelengthPx={wavelengthPx} amplitudePx={amplitudePx} paused={paused} emphasize={emphasize} />
            </div>
            <p className="text-center text-[10px] text-[var(--color-ink-faint)]">
              {isTransverse
                ? "Frequency (f) = number of complete waves passing a point each second. 1 Hz = 1 cycle per second."
                : "Transverse: particle motion \u22A5 wave direction \u2022 Longitudinal: particle motion \u2225 wave direction"}
              <br />
              <span className="italic">Animation not to scale</span>
            </p>
          </div>

          {/* RIGHT: real-time values */}
          <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Wave Values \u2014 Real-time"}</p>
            <div>
              <p className="text-[10px] text-[var(--color-ink-faint)]">{"Wavelength (\u03BB)"}</p>
              <p className="text-base font-bold" style={{ color: "var(--color-indigo)" }}>{wavelengthNm.toFixed(0)} nm</p>
            </div>
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
            {isTransverse && (
              <div className="border-t border-[var(--color-line)] pt-2">
                <p className="text-[10px] text-[var(--color-ink-faint)]">Wave speed (c)</p>
                <p className="text-sm font-bold" style={{ color: "var(--color-amber)" }}>{formatScientific(SPEED_OF_LIGHT, 3)}{" m s\u207B\u00B9"}</p>
              </div>
            )}
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
                  <div className="flex justify-between"><dt>{"\u03BB"}</dt><dd>{wavelengthNm.toFixed(0)} nm</dd></div>
                  <div className="flex justify-between"><dt>f</dt><dd>{formatScientific(frequency, 3)} Hz</dd></div>
                </dl>
                <p className={`mt-1.5 rounded-md px-2 py-1 text-[11px] font-semibold text-[var(--color-ink)] ${emphasizeDiscovery ? "wave-discovery-emphasis" : ""}`}>
                  {"Wavelength and frequency are inversely related \u2014 if wavelength increases, frequency decreases."}
                </p>
              </>
            ) : (
              <p className="mt-1 text-xs text-[var(--color-ink-soft)]">
                {"Wavelength \u03BB = "}{wavelengthNm.toFixed(0)}{" nm, measured compression-centre to compression-centre."}
              </p>
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
              <p className="mt-1 text-[11px] font-semibold text-[var(--color-ink)]">Higher frequency (shorter {"\u03BB"}) {"\u2192"} higher photon energy</p>
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

        {/* discovery feedback -- kept compact, not a full-width duplicate card */}
        {message && (
          <p className="text-center text-xs text-[var(--color-ink-soft)]">{message}</p>
        )}

        <style>{`
          @keyframes wave-discovery-emphasis-kf { 0%, 100% { background-color: transparent; } 50% { background-color: var(--color-indigo-soft); } }
          .wave-discovery-emphasis { animation: wave-discovery-emphasis-kf 700ms ease-in-out 1; }
        `}</style>
      </div>
    </InteractiveFrame>
  );
}
