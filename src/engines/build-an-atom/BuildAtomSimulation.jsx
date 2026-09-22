import { useState, useCallback, useRef } from "react";
import { Maximize2, X } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { deriveAtom, CARBON_12, EMPTY_ATOM } from "./lib/atomState.js";
import { describeChange } from "./lib/whatChanged.js";
import { useFullscreen } from "./lib/useFullscreen.js";
import AtomVisualizer from "./components/AtomVisualizer.jsx";
import ParticleControls from "./components/ParticleControls.jsx";
import FlyingParticle from "./components/FlyingParticle.jsx";
import IdentityPanel from "./components/IdentityPanel.jsx";
import WhatChanged from "./components/WhatChanged.jsx";
import ConceptStrip from "./components/ConceptStrip.jsx";
import MiniPeriodicTable from "./components/MiniPeriodicTable.jsx";
import IsotopeComparison from "./components/IsotopeComparison.jsx";
import ChallengeMode from "./components/ChallengeMode.jsx";

const MIN_COUNT = 0;
const MAX_COUNT = 30;

export default function BuildAtomSimulation({ compact = false }) {
  const [atom, setAtom] = useState(CARBON_12);
  const [lastChange, setLastChange] = useState(null);
  const [flights, setFlights] = useState([]);
  const flightIdRef = useRef(0);
  const containerRef = useRef(null);
  const { isFullscreen, supported, enter, exit } = useFullscreen(containerRef);
  const [cssExpanded, setCssExpanded] = useState(false); // CSS fallback when the Fullscreen API is unavailable

  const derived = deriveAtom(atom);
  const expanded = isFullscreen || cssExpanded;

  const handleChange = useCallback((type, delta) => {
    setAtom((prev) => {
      const key = type === "proton" ? "protons" : type === "neutron" ? "neutrons" : "electrons";
      const nextValue = Math.max(MIN_COUNT, Math.min(MAX_COUNT, prev[key] + delta));
      if (nextValue === prev[key]) return prev;
      const next = { ...prev, [key]: nextValue };
      setLastChange({ type, delta: nextValue - prev[key], prevDerived: deriveAtom(prev), nextDerived: deriveAtom(next) });
      flightIdRef.current += 1;
      setFlights((f) => [...f, { id: flightIdRef.current, type, direction: delta > 0 ? "add" : "remove" }]);
      return next;
    });
  }, []);

  const removeFlight = useCallback((id) => setFlights((f) => f.filter((flight) => flight.id !== id)), []);

  function handleSelectElement(atomicNumber) {
    setAtom((prev) => {
      if (prev.protons === atomicNumber) return prev;
      const next = { ...prev, protons: atomicNumber };
      setLastChange({ type: "proton", delta: atomicNumber - prev.protons, prevDerived: deriveAtom(prev), nextDerived: deriveAtom(next) });
      return next;
    });
  }

  function handleStartEmpty() {
    setAtom(EMPTY_ATOM);
    setLastChange(null);
    setFlights([]);
  }
  function handleResetCarbon() {
    setAtom(CARBON_12);
    setLastChange(null);
    setFlights([]);
  }

  function handleToggleFullscreen() {
    if (expanded) {
      if (isFullscreen) exit();
      setCssExpanded(false);
    } else if (supported) {
      enter();
    } else {
      setCssExpanded(true);
    }
  }

  const change = lastChange ? describeChange(lastChange.type, lastChange.delta, lastChange.prevDerived, lastChange.nextDerived) : null;
  const highlightType = lastChange?.type;

  return (
    <InteractiveFrame title="Build an Atom" subtitle={expanded ? undefined : "Change the particles and discover what makes an atom what it is."} compact={compact}>
      <div
        ref={containerRef}
        className={expanded ? "fixed inset-0 z-[999] overflow-y-auto bg-[var(--color-paper)] p-4" : ""}
      >
        <div className="mx-auto w-full" style={{ maxWidth: 1180 }}>
          {/* Header row -- title strip + reset + fullscreen, compact */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{"S1.2 \u2022 The Nuclear Atom"}</p>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={handleStartEmpty} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                Start From Empty
              </button>
              <button type="button" onClick={handleResetCarbon} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
                Reset to Carbon-12
              </button>
              <button
                type="button"
                onClick={handleToggleFullscreen}
                aria-label={expanded ? "Exit Fullscreen" : "Fullscreen"}
                className="flex items-center gap-1.5 rounded-md bg-[var(--color-indigo)] px-2.5 py-1 text-xs font-semibold text-white"
              >
                {expanded ? <X size={13} /> : <Maximize2 size={13} />}
                {expanded ? "Exit Fullscreen" : "Fullscreen"}
              </button>
            </div>
          </div>

          {/* Top tool row: Periodic Table + Challenge -- moved above the
              main workspace so both are immediately visible/usable
              without scrolling past the atom first. */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]">
            <MiniPeriodicTable currentAtomicNumber={atom.protons} onSelectElement={handleSelectElement} />
            <ChallengeMode atom={atom} derived={derived} />
          </div>

          {/* Main three-column workspace: Build | Atom | Identity */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)_minmax(0,260px)]">
            <div className="order-2 flex flex-col gap-2 lg:order-1">
              <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Build It</p>
              <ParticleControls protons={atom.protons} neutrons={atom.neutrons} electrons={atom.electrons} onChange={handleChange} />
            </div>

            <div className="relative order-1 lg:order-2">
              <div
                className="relative overflow-hidden rounded-xl p-3"
                style={{ background: "radial-gradient(ellipse at center, #1B2440 0%, #0D1224 75%)", minHeight: expanded ? "min(62vh, 640px)" : "340px" }}
              >
                <div className="flex h-full items-center justify-center">
                  <AtomVisualizer
                    protons={atom.protons}
                    neutrons={atom.neutrons}
                    electrons={atom.electrons}
                    highlightZ={highlightType === "proton"}
                    highlightA={highlightType === "neutron"}
                    highlightCharge={highlightType === "electron"}
                  />
                </div>
                {flights.map((flight) => (
                  <FlyingParticle key={flight.id} flight={flight} onComplete={() => removeFlight(flight.id)} />
                ))}
              </div>
            </div>

            <div className="order-3 flex flex-col gap-2">
              <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Build?</p>
              <IdentityPanel derived={derived} highlightZ={highlightType === "proton"} highlightA={highlightType === "neutron"} highlightCharge={highlightType === "electron"} />
              <IsotopeComparison protons={atom.protons} neutrons={atom.neutrons} />
            </div>
          </div>

          {/* Bottom learning row: What Changed (wider) + three concept cards */}
          <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Changed?</p>
              <WhatChanged change={change} />
            </div>
            <ConceptStrip highlightedType={highlightType} />
          </div>
        </div>
      </div>
    </InteractiveFrame>
  );
}
