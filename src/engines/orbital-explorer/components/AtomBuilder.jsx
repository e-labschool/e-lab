import { useState, useMemo } from "react";
import ThreeCanvas from "../../../components/3d/ThreeCanvas.jsx";
import { first20Elements, elementByAtomicNumber } from "../lib/elementLookup.js";
import { fillSublevels, formatConfiguration, occupiedOrbitals } from "../lib/electronConfigurations.js";
import { boundingRadiusFor } from "../lib/orbitalSampling.js";
import ElementSelector from "./ElementSelector.jsx";
import AtomViewer from "./AtomViewer.jsx";
import OrbitalDiagram from "./OrbitalDiagram.jsx";

const DEFAULT_Z = 6; // Carbon -- a familiar mid-complexity default

export default function AtomBuilder({ compact }) {
  const [atomicNumber, setAtomicNumber] = useState(DEFAULT_Z);
  const [visibleIds, setVisibleIds] = useState(() => new Set(occupiedOrbitals(DEFAULT_Z).map((o) => o.id)));
  const [highlightedId, setHighlightedId] = useState(null);
  // Tracks which element visibleIds/highlightedId currently belong to.
  const [lastAtomicNumber, setLastAtomicNumber] = useState(DEFAULT_Z);

  const element = elementByAtomicNumber(atomicNumber);
  const orbitals = useMemo(() => occupiedOrbitals(atomicNumber), [atomicNumber]);
  const occupiedIds = useMemo(() => orbitals.map((o) => o.id), [orbitals]);
  const configString = useMemo(() => formatConfiguration(fillSublevels(atomicNumber)), [atomicNumber]);

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
    if (z < 1 || z > 20) return;
    setAtomicNumber(z);
  }

  if (!element) return null;

  const maxN = Math.max(...occupiedIds.map((id) => parseInt(id[0], 10)));

  return (
    <div className="flex flex-col gap-3">
      <ElementSelector elements={first20Elements} selectedZ={atomicNumber} onSelect={goToElement} />

      <div className="flex items-center justify-center gap-3">
        <button type="button" onClick={() => goToElement(atomicNumber - 1)} disabled={atomicNumber <= 1} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] disabled:opacity-30">
          {"\u2190 Previous"}
        </button>
        <div className="text-center">
          <p className="text-base font-bold text-[var(--color-ink)]">{element.name}</p>
          <p className="text-xs text-[var(--color-ink-faint)]">
            {element.symbol} {"\u2022"} Z = {atomicNumber} {"\u2022"} {atomicNumber} electrons
          </p>
          <p className="mt-0.5 text-sm font-semibold text-[var(--color-indigo)]">{configString}</p>
        </div>
        <button type="button" onClick={() => goToElement(atomicNumber + 1)} disabled={atomicNumber >= 20} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] disabled:opacity-30">
          {"Next \u2192"}
        </button>
      </div>

      <ThreeCanvas height={compact ? 320 : 440} cameraDistance={boundingRadiusFor(maxN) * 1.6} fallbackDescription="This device can't render the 3D atom view." fallbackLabel="Atom viewer">
        <color attach="background" args={["#0A0E1A"]} />
        <AtomViewer occupiedIds={occupiedIds} visibleIds={visibleIds} highlightedId={highlightedId} />
      </ThreeCanvas>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="mr-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Visible orbitals</span>
        {occupiedIds.map((id) => (
          <label key={id} className="flex items-center gap-1 rounded-md border border-[var(--color-line)] px-2 py-1 text-[11px] text-[var(--color-ink-soft)]">
            <input type="checkbox" checked={visibleIds.has(id)} onChange={() => toggleVisible(id)} aria-label={`Show ${id} orbital`} />
            {id}
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
        <p className="mb-2 text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Orbital Diagram</p>
        <OrbitalDiagram orbitals={orbitals} selectedOrbital={highlightedId} onSelectOrbital={handleSelectOrbital} />
      </div>
    </div>
  );
}
