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

  const handleFrequencyChange = useCallback((nextFrequency) => {
    setWavelengthNm((prev) => {
      const prevFrequency = frequencyFromWavelengthNm(prev);
      const nextNm = wavelengthNmFromFrequency(nextFrequency);
      if (nextNm === null) return prev;
      setLastChange({ control: "frequency", prevValue: prevFrequency, nextValue: nextFrequency });
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

  const message = lastChange ? describeWaveChange(lastChange.control, lastChange.prevValue, lastChange.nextValue, waveType) : null;
  const emphasize = lastChange?.control;
  const WaveComponent = waveType === "transverse" ? TransverseWave : LongitudinalWave;

  const freqMin = frequencyFromWavelengthNm(WAVELENGTH_NM_MAX); // longer wavelength -> lower frequency
  const freqMax = frequencyFromWavelengthNm(WAVELENGTH_NM_MIN);

  return (
    <InteractiveFrame title="Wave Explorer" subtitle="Understand the basic properties of waves" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 900 }}>
        <div className="flex items-center justify-center gap-2">
          <button type="button" onClick={() => handleWaveTypeChange("transverse")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${waveType === "transverse" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Transverse
          </button>
          <button type="button" onClick={() => handleWaveTypeChange("longitudinal")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${waveType === "longitudinal" ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Longitudinal
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="ml-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            {paused ? "Play" : "Pause"}
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <WaveComponent wavelengthNm={wavelengthNm} wavelengthPx={wavelengthPx} amplitudePx={amplitudePx} paused={paused} emphasize={emphasize} />
        </div>

        {waveType === "transverse" && (
          <p className="mt-2 text-center text-[11px] text-[var(--color-ink-faint)]">
            {"1 Hz = 1 cycle per second \u2014 watch the observation point pulse once per complete wave"}
          </p>
        )}
        {waveType === "longitudinal" && (
          <p className="mt-2 text-center text-[11px] text-[var(--color-ink-faint)]">
            Transverse: particle motion {"\u27C2"} wave direction &nbsp;&nbsp; Longitudinal: particle motion {"\u2225"} wave direction
          </p>
        )}

        {/* context-sensitive controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">Amplitude</span>
            <input type="range" min="0" max="1" step="0.01" value={amplitudeT} onChange={(e) => handleAmplitudeChange(Number(e.target.value))} aria-label="Amplitude" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">Wavelength ({"\u03BB"} = {wavelengthNm.toFixed(0)} nm)</span>
            <input type="range" min={WAVELENGTH_NM_MIN} max={WAVELENGTH_NM_MAX} step="1" value={wavelengthNm} onChange={(e) => handleWavelengthChange(Number(e.target.value))} aria-label="Wavelength in nanometres" />
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">Frequency (f = {formatScientific(frequency, 3)} Hz)</span>
            <input type="range" min={freqMin} max={freqMax} step={(freqMax - freqMin) / 200} value={frequency} onChange={(e) => handleFrequencyChange(Number(e.target.value))} aria-label="Frequency in hertz" />
          </label>
        </div>

        {/* equations + live values */}
        <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-3 py-2 text-xs">
          <span className="font-mono font-semibold text-[var(--color-ink)]">c = f{"\u03BB"}</span>
          <span className="font-mono font-semibold text-[var(--color-ink)]">E = hf</span>
          <span className="text-[var(--color-ink-soft)]">{"\u03BB"} {wavelengthNm.toFixed(0)} nm</span>
          <span className="text-[var(--color-ink-soft)]">f {formatScientific(frequency, 3)} Hz</span>
          <span className="text-[var(--color-ink-soft)]">E {formatScientific(photonEnergy, 3)} {"J photon\u207B\u00B9"}</span>
        </div>
        <p className="mt-1 text-center text-[10px] text-[var(--color-ink-faint)]">
          c = {formatScientific(SPEED_OF_LIGHT, 3)} m s{"\u207B\u00B9"} &nbsp;&nbsp; h = {formatScientific(PLANCK_CONSTANT, 4)} J s
        </p>

        {/* relationship strip */}
        <div className="mt-2 flex flex-wrap items-center justify-center gap-2 text-[11px] font-semibold text-[var(--color-ink-soft)]">
          <span>Shorter wavelength</span>
          <span className="text-[var(--color-indigo)]">{"\u2192"}</span>
          <span>Higher frequency</span>
          <span className="text-[var(--color-indigo)]">{"\u2192"}</span>
          <span>Higher photon energy</span>
        </div>

        {/* discovery feedback */}
        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Discover?</p>
          <p className="mt-1 text-sm text-[var(--color-ink)]">{message ?? "Adjust a control to see what it changes."}</p>
        </div>
      </div>
    </InteractiveFrame>
  );
}
