import { useState } from "react";
import { Info } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { SPECTRA, AVAILABLE_ELEMENTS } from "./data/spectra.js";
import SpectrumDisplay from "./components/SpectrumDisplay.jsx";
import EmissionSetup from "./components/EmissionSetup.jsx";
import AbsorptionApparatus from "./components/AbsorptionApparatus.jsx";
import EnergyLevelsView from "./components/EnergyLevelsView.jsx";
import LinkedView from "./components/LinkedView.jsx";

const TOP_VIEWS = [
  { id: "spectroscope", label: "Spectroscope" },
  { id: "energy-levels", label: "Energy Levels" },
  { id: "linked", label: "Linked View" },
];

const SPECTROSCOPE_MODES = [
  { id: "emission", label: "Emission" },
  { id: "absorption", label: "Absorption" },
  { id: "compare", label: "Compare" },
];

export default function AtomicSpectraSimulation({ compact = false }) {
  const [topView, setTopView] = useState("spectroscope");
  const [element, setElement] = useState("Na"); // default first load: Sodium
  const [selectedLineIndex, setSelectedLineIndex] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [spectroscopeMode, setSpectroscopeMode] = useState("emission");

  const spectrum = SPECTRA[element];

  return (
    <InteractiveFrame title="Atomic Spectra Lab" subtitle="See how electron energy transitions connect to photon energy, wavelength and atomic line spectra." compact={compact}>
      <div className="mx-auto flex w-full flex-col gap-3" style={{ maxWidth: 900 }}>
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {TOP_VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setTopView(v.id)}
              aria-pressed={topView === v.id}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold ${topView === v.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
            >
              {v.label}
            </button>
          ))}
          <button type="button" onClick={() => setShowHelp((v) => !v)} aria-label="About this simulation" className="ml-1 flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-faint)]">
            <Info size={13} />
          </button>
        </div>

        {showHelp && (
          <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-xs text-[var(--color-ink-soft)]">
            <ul className="list-disc space-y-1 pl-4">
              <li>Atomic spectra contain discrete wavelengths, not a continuous rainbow.</li>
              <li>Emission occurs when an excited atom returns to a lower energy state and a photon is released.</li>
              <li>Wave animations are schematic and not to scale.</li>
              <li>Displayed colours are approximate screen representations of real wavelengths.</li>
            </ul>
          </div>
        )}

        {topView === "spectroscope" && (
          <>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {AVAILABLE_ELEMENTS.map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => { setElement(sym); setSelectedLineIndex(null); }}
                  aria-pressed={element === sym}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${element === sym ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                >
                  {sym}
                </button>
              ))}
              <span className="mx-1 h-4 w-px bg-[var(--color-line)]" aria-hidden="true" />
              {SPECTROSCOPE_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => { setSpectroscopeMode(m.id); setSelectedLineIndex(null); }}
                  aria-pressed={spectroscopeMode === m.id}
                  className={`rounded-md px-3 py-1.5 text-xs font-semibold ${spectroscopeMode === m.id ? "bg-[var(--color-violet)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {spectroscopeMode === "emission" && (
              <>
                <EmissionSetup elementName={spectrum.name} species={spectrum.species} lines={spectrum.lines} />

                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Emission spectrum \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} />
                </div>

                {/* Sodium's two lines are under 1nm apart across a 370nm
                    axis -- genuinely indistinguishable at full-spectrum
                    scale, so a magnified inset is required (not optional
                    polish) to actually show two lines rather than what
                    would otherwise look like one. */}
                {element === "Na" && (
                  <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                    <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Magnified \u2014 the sodium doublet"}</p>
                    <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} rangeMin={588.5} rangeMax={590.5} />
                  </div>
                )}
              </>
            )}

            {spectroscopeMode === "absorption" && (
              <>
                <AbsorptionApparatus elementName={spectrum.name} species={spectrum.species} />

                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Absorption spectrum \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="absorption" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} />
                  <p className="mt-1.5 text-center text-[10px] text-[var(--color-ink-faint)]">{"Dark lines appear at exactly the same wavelengths the atom would emit \u2014 the same energy gaps, now absorbed from the continuous background instead."}</p>
                </div>

                {element === "Na" && (
                  <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                    <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Magnified \u2014 the sodium doublet"}</p>
                    <SpectrumDisplay lines={spectrum.lines} mode="absorption" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} rangeMin={588.5} rangeMax={590.5} />
                  </div>
                )}
              </>
            )}

            {spectroscopeMode === "compare" && (
              <div className="flex flex-col gap-2">
                <p className="text-center text-xs text-[var(--color-ink-soft)]">{"Emission and absorption share one wavelength axis. Click a line in either spectrum \u2014 the matching line in the other lights up too."}</p>
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Emission \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} />
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Absorption \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="absorption" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} />
                </div>
              </div>
            )}
          </>
        )}

        {topView === "energy-levels" && <EnergyLevelsView />}

        {topView === "linked" && <LinkedView />}
      </div>
    </InteractiveFrame>
  );
}
