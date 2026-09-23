import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { frequencyFromWavelengthNm, photonEnergyFromFrequency, formatScientific, SPEED_OF_LIGHT, PLANCK_CONSTANT } from "./lib/waveMath.js";
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
  // A brief highlight when the student moves wavelength shorter --
  // ties directly to the shorter-wavelength discovery being one of the
  // simulation's main takeaways, per instruction; never flashy, one 700ms pulse.
  const emphasizeDiscovery = lastChange?.control === "wavelength" && lastChange.nextValue < lastChange.prevValue;
  const WaveComponent = waveType === "transverse" ? TransverseWave : LongitudinalWave;
  const isTransverse = waveType === "transverse";

  return (
    <InteractiveFrame title="Wave Explorer" subtitle="Understand the basic properties of waves" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 900 }}>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <button type="button" onClick={() => handleWaveTypeChange("transverse")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Transverse
          </button>
          <button type="button" onClick={() => handleWaveTypeChange("longitudinal")} className={`rounded-md px-3 py-1.5 text-xs font-semibold ${!isTransverse ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>
            Longitudinal
          </button>
          <button type="button" onClick={() => setPaused((p) => !p)} className="ml-2 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            {paused ? "Play" : "Pause"}
          </button>
          <button type="button" onClick={handleReset} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">
            Reset
          </button>
        </div>

        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <WaveComponent wavelengthNm={wavelengthNm} wavelengthPx={wavelengthPx} amplitudePx={amplitudePx} paused={paused} emphasize={emphasize} />
        </div>

        <p className="mt-2 text-center text-[11.5px] text-[var(--color-ink-soft)]">
          {isTransverse ? (
            <span className="font-semibold">Transverse</span>
          ) : (
            <span className="text-[var(--color-ink-faint)]">Transverse</span>
          )}
          {": particle motion "}{"\u27C2"}{" wave direction"}
          {"  \u2022  "}
          {!isTransverse ? (
            <span className="font-semibold">Longitudinal</span>
          ) : (
            <span className="text-[var(--color-ink-faint)]">Longitudinal</span>
          )}
          {": particle motion "}{"\u2225"}{" wave direction"}
        </p>

        {/* context-sensitive controls */}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">Amplitude</span>
            <input type="range" min="0" max="1" step="0.01" value={amplitudeT} onChange={(e) => handleAmplitudeChange(Number(e.target.value))} aria-label="Amplitude" />
            <span className="text-[10.5px] text-[var(--color-ink-faint)]">Adjust wave height</span>
          </label>
          <label className="flex flex-col gap-1 text-xs">
            <span className="font-semibold text-[var(--color-ink)]">{"Wavelength (\u03BB = "}{wavelengthNm.toFixed(0)}{" nm)"}</span>
            <input type="range" min={WAVELENGTH_NM_MIN} max={WAVELENGTH_NM_MAX} step="1" value={wavelengthNm} onChange={(e) => handleWavelengthChange(Number(e.target.value))} aria-label="Wavelength in nanometres" />
            <span className="text-[10.5px] text-[var(--color-ink-faint)]">
              {"Frequency: f = "}{formatScientific(frequency, 3)}{" Hz "}
              <span className="italic">{"\u2014 automatically determined from c = f\u03BB"}</span>
            </span>
          </label>
        </div>

        {isTransverse && (
          <p className="mt-2 text-center text-[11px] text-[var(--color-ink-faint)]">
            {"Frequency (f) = number of complete waves passing a point each second. 1 Hz = 1 cycle per second."}
            <br />
            <span className="italic">Animation not to scale</span>
          </p>
        )}

        {/* Chemistry/EM section -- transverse mode ONLY. Longitudinal
            mode has no notion of photon energy in this simulation, so
            this whole block is omitted rather than shown-but-irrelevant. */}
        {isTransverse && (
          <>
            <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Wave relationship</p>
                  <p className="font-mono text-base font-semibold text-[var(--color-ink)]">{"c = f\u03BB"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Photon energy</p>
                  <p className="font-mono text-base font-semibold text-[var(--color-ink)]">E = hf</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 border-t border-[var(--color-line)] pt-2 text-xs text-[var(--color-ink-soft)]">
                <span>{"\u03BB "}{wavelengthNm.toFixed(0)} nm</span>
                <span>f {formatScientific(frequency, 3)} Hz</span>
                <span>{"E "}{formatScientific(photonEnergy, 3)}{" J photon\u207B\u00B9"}</span>
              </div>
              <p className="mt-1.5 text-[11px] text-[var(--color-ink-soft)]">
                {"c = "}{formatScientific(SPEED_OF_LIGHT, 3)}{" m s\u207B\u00B9"} &nbsp;&nbsp; {"h = "}{formatScientific(PLANCK_CONSTANT, 4)}{" J s"}
              </p>
            </div>

            <div className={`mt-2 flex flex-wrap items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-[12px] font-bold text-[var(--color-ink)] ${emphasizeDiscovery ? "wave-discovery-emphasis" : ""}`}>
              <span>Shorter {"\u03BB"}</span>
              <span className="text-[var(--color-indigo)]">{"\u2192"}</span>
              <span>Higher f</span>
              <span className="text-[var(--color-indigo)]">{"\u2192"}</span>
              <span>Higher photon energy E</span>
            </div>
          </>
        )}

        {/* discovery feedback */}
        <div className="mt-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
          <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Discover?</p>
          <p className="mt-1 text-sm text-[var(--color-ink)]">{message ?? "Adjust a control to see what it changes."}</p>
        </div>

        <style>{`
          @keyframes wave-discovery-emphasis-kf { 0%, 100% { background-color: transparent; } 50% { background-color: var(--color-indigo-soft); } }
          .wave-discovery-emphasis { animation: wave-discovery-emphasis-kf 700ms ease-in-out 1; }
        `}</style>
      </div>
    </InteractiveFrame>
  );
}
