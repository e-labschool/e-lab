import { useState, useMemo } from "react";
import { Info } from "lucide-react";
import ThreeCanvas from "../../../components/3d/ThreeCanvas.jsx";
import { first36Elements, elementByAtomicNumber } from "../lib/elementLookup.js";
import { fillSublevels, formatConfiguration, occupiedOrbitals, MAX_ATOM_VIEW_Z } from "../lib/electronConfigurations.js";
import { useOrbitalClouds } from "../lib/useOrbitalClouds.js";
import { boundingRadiusFor } from "../lib/orbitalSampling.js";
import { detectQualityTier, pointsPerOrbitalFor, pointsForCount } from "../lib/qualityTier.js";
import { NucleusNote } from "./NucleusDot.jsx";
import EnergyOrder from "./EnergyOrder.jsx";
import ElementSelector from "./ElementSelector.jsx";
import AtomViewer from "./AtomViewer.jsx";
import OrbitalDiagram from "./OrbitalDiagram.jsx";
import AtomLegend from "./AtomLegend.jsx";
import OrbitalInfoPanel from "./OrbitalInfoPanel.jsx";

// OE-02: on short or narrow screens the 36-cell picker would push the 3D view below the fold, so it starts collapsed
// there (and closes after a choice); on a roomy screen it stays open as before.
const SMALL_SCREEN = () => typeof window !== "undefined" && (window.innerHeight < 700 || window.innerWidth < 1024);
const DEFAULT_Z = 6; // Carbon -- a familiar mid-complexity default

export default function AtomBuilder({ compact }) {
  const [atomicNumber, setAtomicNumber] = useState(DEFAULT_Z);
  const [visibleIds, setVisibleIds] = useState(() => new Set(occupiedOrbitals(DEFAULT_Z).map((o) => o.id)));
  const [highlightedId, setHighlightedId] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [small] = useState(SMALL_SCREEN);
  const [pickerOpen, setPickerOpen] = useState(() => !SMALL_SCREEN());
  // Tracks which element visibleIds/highlightedId currently belong to.
  const [lastAtomicNumber, setLastAtomicNumber] = useState(DEFAULT_Z);

  // Computed once (viewport width doesn't change mid-session for a
  // student on one device) -- same pattern ThreeCanvas already uses for
  // its own mobile detection. Desktop resolves to "high" (~10,000
  // points/orbital); narrower/touch viewports step down automatically.
  const basePoints = useMemo(() => pointsPerOrbitalFor(detectQualityTier()), []);

  const element = elementByAtomicNumber(atomicNumber);
  const orbitals = useMemo(() => occupiedOrbitals(atomicNumber), [atomicNumber]);
  const occupiedIds = useMemo(() => orbitals.map((o) => o.id), [orbitals]);
  const pointsPerOrbital = pointsForCount(basePoints, occupiedIds.length); // heavier atoms: fewer points per orbital (OE-10)
  const { clouds, done, total, pending } = useOrbitalClouds(occupiedIds, pointsPerOrbital);
  const configString = useMemo(() => formatConfiguration(fillSublevels(atomicNumber)), [atomicNumber]);
  const highlightedOrbital = useMemo(() => orbitals.find((o) => o.id === highlightedId) ?? null, [orbitals, highlightedId]);

  // Reset visibility (all occupied orbitals shown) and clear any
  // highlight whenever the selected element changes -- adjusted DURING
  // RENDER (React's documented pattern for "adjusting state when a prop
  // changes": https://react.dev/learn/you-might-not-need-an-effect),
  // not inside a useEffect -- calling setState synchronously inside an
  // effect just to mirror a value already derivable from a prop/state
  // change triggers an extra, avoidable render pass.
  if (atomicNumber !== lastAtomicNumber) {
    setLastAtomicNumber(atomicNumber);
    setVisibleIds(new Set(occupiedIds));
    setHighlightedId(null);
  }

  function toggleVisible(id) {
    setVisibleIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleSelectOrbital(id) {
    setHighlightedId((prev) => (prev === id ? null : id));
  }

  function goToElement(z) {
    if (z < 1 || z > MAX_ATOM_VIEW_Z) return;
    setAtomicNumber(z);
  }

  if (!element) return null;

  const maxN = Math.max(...occupiedIds.map((id) => parseInt(id[0], 10)));

  return (
    <div className="flex flex-col gap-3">
      {small && (
        <button type="button" onClick={() => setPickerOpen((v) => !v)} aria-expanded={pickerOpen} aria-controls="oe-element-picker" data-testid="oe-choose-element" className="mx-auto rounded-md border border-[var(--color-line)] px-3 py-1 text-xs font-semibold text-[var(--color-ink-soft)]">
          {pickerOpen ? "Hide periodic table" : "Choose element"}
        </button>
      )}
      {pickerOpen && <div id="oe-element-picker"><ElementSelector elements={first36Elements} selectedZ={atomicNumber} onSelect={(z) => { goToElement(z); if (small) setPickerOpen(false); }} /></div>}

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => goToElement(atomicNumber - 1)} disabled={atomicNumber <= 1} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] disabled:opacity-30">
          {"← Previous"}
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-[var(--color-ink)]">{element.name}</p>
          <p className="text-xs text-[var(--color-ink-faint)]">
            {element.symbol} {"•"} Z = {atomicNumber} {"•"} {atomicNumber} electrons
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--color-indigo)]">{configString}</p>
        </div>
        <button type="button" onClick={() => goToElement(atomicNumber + 1)} disabled={atomicNumber >= MAX_ATOM_VIEW_Z} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] disabled:opacity-30">
          {"Next →"}
        </button>
        <button
          type="button"
          onClick={() => setShowInfo((v) => !v)}
          aria-pressed={showInfo}
          aria-label="What do these clouds represent?"
          className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--color-line)] text-[var(--color-ink-faint)]"
        >
          <Info size={13} />
        </button>
      </div>

      {showInfo && (
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3 text-xs text-[var(--color-ink-soft)]">
          Each point represents a possible electron position sampled from the orbital probability distribution. The cloud shows
          where the electron is more likely to be found; it is not a path travelled by the electron. The translucent surfaces are
          orbital boundaries -- soft probability regions, not physical shells -- and points are simulated position detections, never
          separate electrons.
        </div>
      )}

      {/* CENTER: 3D viewer is the hero -- large on every breakpoint, with
          the legend/info/diagram arranged around it on wide screens and
          stacked below it on narrower ones, never shrunk to the point of
          uselessness. */}
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_260px]">
        <div role="group" aria-label={`3D atom view for atomic number ${atomicNumber}, configuration ${configString}. Drag to rotate, scroll to zoom; use the Reset view button to recentre. The orbital legend lists every orbital shown.`}>
        <ThreeCanvas keyboard ariaLabel={`3D atom view, atomic number ${atomicNumber}, configuration ${configString}`} height={compact ? 420 : "clamp(340px, calc(100vh - 300px), 560px)"} cameraDistance={boundingRadiusFor(maxN) * 2.6} fallbackDescription="This device can't render the 3D atom view." fallbackLabel="Atom viewer">
          <color attach="background" args={["#070A12"]} />
          <AtomViewer clouds={clouds} maxN={maxN} visibleIds={visibleIds} highlightedId={highlightedId} />
        </ThreeCanvas>
        <p className="mt-1 text-[11px] text-[var(--color-ink-soft)]" role="status" aria-live="polite" data-testid="cloud-status">
          {pending ? `Sampling electron clouds: ${done} of ${total} orbitals done\u2026` : `${total} orbital${total === 1 ? "" : "s"} shown, about ${pointsPerOrbital.toLocaleString()} simulated detections each.`}
        </p>
        <NucleusNote />
        </div>

        <div className="flex flex-col gap-3">
          <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
            <AtomLegend
              orbitals={orbitals}
              visibleIds={visibleIds}
              highlightedId={highlightedId}
              onToggleVisible={toggleVisible}
              onSelect={handleSelectOrbital}
              onShowAll={() => setVisibleIds(new Set(occupiedIds))}
              onHideAll={() => setVisibleIds(new Set())}
              onOnlyShell={(n) => setVisibleIds(new Set(occupiedIds.filter((id) => Number(id[0]) === n)))}
            />
          </div>
          <OrbitalInfoPanel orbital={highlightedOrbital} />
        </div>
      </div>

      <EnergyOrder z={atomicNumber} />

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital Diagram</p>
        <OrbitalDiagram orbitals={orbitals} selectedOrbital={highlightedId} onSelectOrbital={handleSelectOrbital} />
      </div>
    </div>
  );
}
