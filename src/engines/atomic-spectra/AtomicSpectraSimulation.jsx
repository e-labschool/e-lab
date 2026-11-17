import { useState } from "react";
import { Info } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { SPECTRA, AVAILABLE_ELEMENTS, absorptionFor } from "./data/spectra.js";
import SpectrumDisplay from "./components/SpectrumDisplay.jsx";
import EmissionSetup from "./components/EmissionSetup.jsx";
import AbsorptionApparatus from "./components/AbsorptionApparatus.jsx";
import EnergyLevelsView from "./components/EnergyLevelsView.jsx";
import LinkedView from "./components/LinkedView.jsx";
import SeriesView from "./components/SeriesView.jsx";
import IdentifyMode from "./components/IdentifyMode.jsx";
import { UV_RESONANCE } from "./data/spectra.js";

const TOP_VIEWS = [
  { id: "spectroscope", label: "Spectroscope" },
  { id: "energy-levels", label: "Energy Levels" },
  { id: "linked", label: "Linked View" },
  { id: "series", label: "Series & limit" },
];

const SPECTROSCOPE_MODES = [
  { id: "emission", label: "Emission" },
  { id: "absorption", label: "Absorption" },
  { id: "compare", label: "Compare" },
  { id: "identify", label: "Identify unknown" },
];

function NoVisibleAbsorption({ element, spectrum }) {
  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-center text-xs text-[var(--color-ink-soft)]" data-testid="no-visible-absorption">
      <p className="font-semibold text-[var(--color-ink)]">No dark lines in the visible spectrum for cold {spectrum.name.toLowerCase()}</p>
      <p className="mt-1">Atoms in the ground state can only absorb photons that lift an electron out of it. For {element} the first such transition is in the ultraviolet ({UV_RESONANCE[element]}), so white light shows no visible absorption lines. The bright lines in the emission spectrum come from atoms that were excited by the discharge and then fall between higher levels. Choose Emission, or hydrogen or sodium here.</p>
    </div>
  );
}

export default function AtomicSpectraSimulation({ compact = false, standalone = false }) {
  const [topView, setTopView] = useState("spectroscope");
  const [element, setElement] = useState("Na"); // default first load: Sodium
  const [selectedLineIndex, setSelectedLineIndex] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [spectroscopeMode, setSpectroscopeMode] = useState("emission");

  const [gasCondition, setGasCondition] = useState("cold"); // hydrogen absorption only: cold (Lyman, UV) or hot (Balmer)

  const spectrum = SPECTRA[element];
  const absorption = absorptionFor(element, gasCondition);
  // Emission and absorption lines correspond (same wavelengths) except for cold hydrogen, where absorption is Lyman (UV) and emission is Balmer.
  const linesCorrespond = absorption.lines === spectrum.lines;
  const uvLines = absorption.lines.filter((l) => l.wavelengthNm < 380);
  const absorptionCaption = linesCorrespond
    ? "Dark lines appear at the same wavelengths the atom emits \u2014 the same energy gaps, absorbed from the continuous background instead."
    : "Cold hydrogen atoms are in the ground state (n = 1), so they absorb only the Lyman series (n = 1 \u2192 2, 3, \u2026), all in the ultraviolet. The visible spectrum stays continuous: no Balmer dark lines. Balmer absorption needs atoms already in n = 2 (hot gas).";

  return (
    <InteractiveFrame title="Atomic Spectra Lab" subtitle="See how electron energy transitions connect to photon energy, wavelength and atomic line spectra." compact={compact} standalone={standalone}>
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
                <EmissionSetup elementName={spectrum.name} species={spectrum.species} lines={spectrum.lines} glowColor={spectrum.lampGlow} />

                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Emission spectrum \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} />
                </div>

                {/* Sodium's two lines are under 1nm apart across a 370nm
                    axis -- genuinely indistinguishable at full-spectrum
                    scale, so a magnified inset is required (not optional
                    polish) to actually show two lines rather than what
                    would otherwise look like one. */}
                {element === "Na" && (
                  <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                    <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Magnified \u2014 the sodium doublet"}</p>
                    <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} rangeMin={588.5} rangeMax={590.5} />
                  </div>
                )}
              </>
            )}

            {spectroscopeMode === "absorption" && UV_RESONANCE[element] && <NoVisibleAbsorption element={element} spectrum={spectrum} />}
            {spectroscopeMode === "absorption" && !UV_RESONANCE[element] && (
              <>
                <AbsorptionApparatus elementName={spectrum.name} species={spectrum.species} />

                {element === "H" && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Hydrogen gas condition">
                    {[{ id: "cold", label: "Cool gas (n = 1)" }, { id: "hot", label: "Hot excited gas (n = 2)" }].map((g) => (
                      <button key={g.id} type="button" aria-pressed={gasCondition === g.id} onClick={() => { setGasCondition(g.id); setSelectedLineIndex(null); }}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold ${gasCondition === g.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>{g.label}</button>
                    ))}
                  </div>
                )}

                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Absorption spectrum (visible) \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={absorption.visibleLines} mode="absorption" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} />
                  {uvLines.length > 0 && (
                    <>
                      <p className="mb-1.5 mt-3 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Ultraviolet \u2014 Lyman series (invisible to the eye)"}</p>
                      <SpectrumDisplay lines={uvLines} mode="absorption" ultraviolet selectedIndex={null} elementLabel="hydrogen Lyman" rangeMin={90} rangeMax={125} medium="vacuum" />
                    </>
                  )}
                  <p className="mt-1.5 text-center text-[11px] text-[var(--color-ink-soft)]">{absorptionCaption}</p>
                </div>

                {element === "Na" && (
                  <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                    <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Magnified \u2014 the sodium doublet"}</p>
                    <SpectrumDisplay lines={absorption.lines} mode="absorption" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} rangeMin={588.5} rangeMax={590.5} />
                  </div>
                )}
              </>
            )}

            {spectroscopeMode === "compare" && UV_RESONANCE[element] && <NoVisibleAbsorption element={element} spectrum={spectrum} />}
            {spectroscopeMode === "identify" && <IdentifyMode />}
            {spectroscopeMode === "compare" && !UV_RESONANCE[element] && (
              <div className="flex flex-col gap-2">
                <p className="text-center text-xs text-[var(--color-ink-soft)]">{linesCorrespond ? "Emission and absorption share one wavelength axis. Click a line in either spectrum \u2014 the matching line in the other lights up too." : "Cool hydrogen: emission is Balmer (visible) but absorption is Lyman (ultraviolet), so there are no matching lines to link."}</p>
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Emission \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={spectrum.lines} mode="emission" selectedIndex={selectedLineIndex} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} />
                </div>
                <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
                  <p className="mb-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">{"Absorption \u2014 "}{spectrum.name}</p>
                  <SpectrumDisplay lines={absorption.visibleLines} mode="absorption" selectedIndex={linesCorrespond ? selectedLineIndex : null} onSelectLine={setSelectedLineIndex} elementLabel={spectrum.name} medium={spectrum.medium} />
                  {!linesCorrespond && <p className="mt-1.5 text-center text-[11px] text-[var(--color-ink-soft)]">{"No dark lines in the visible range. The Lyman lines are in the ultraviolet (see the Absorption view)."}</p>}
                </div>
              </div>
            )}
          </>
        )}

        {topView === "energy-levels" && <EnergyLevelsView />}

        {topView === "linked" && <LinkedView />}
        {topView === "series" && <SeriesView />}
      </div>
    </InteractiveFrame>
  );
}
