import { useState, useCallback, useRef } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { deriveAtom, CARBON_12, EMPTY_ATOM } from "./lib/atomState.js";
import { describeChange, autoBalanceLines } from "./lib/whatChanged.js";
import { applyChange, setProtons, toggleAutoBalance, nuclideStatus, LIMITS } from "./lib/atomControls.js";
import { useSize } from "./lib/useSize.js";
import AtomVisualizer from "./components/AtomVisualizer.jsx";
import ParticleControls from "./components/ParticleControls.jsx";
import FlyingParticle from "./components/FlyingParticle.jsx";
import IdentityPanel from "./components/IdentityPanel.jsx";
import WhatChanged from "./components/WhatChanged.jsx";
import ConceptStrip from "./components/ConceptStrip.jsx";
import MiniPeriodicTable from "./components/MiniPeriodicTable.jsx";
import IsotopeComparison from "./components/IsotopeComparison.jsx";
import ChallengeMode from "./components/ChallengeMode.jsx";
import ShellPanel from "./components/ShellPanel.jsx";

// Container width (px) of the simulation's own box at which the side-by-side
// layout (atom ~66 % | controls ~34 %) replaces the stacked one. Container
// driven (ResizeObserver), never window driven.
export const WIDE_MIN_WIDTH = 860;

// Presentation (embedded / fullscreen / standalone) comes from the shared
// InteractiveFrame. This component holds only the SCIENTIFIC state: the three
// particle counts and the Auto-balance flag (unchecked by default).
export default function BuildAtomSimulation({ compact = false, standalone = false }) {
  const [atom, setAtom] = useState(CARBON_12);
  const [autoBalance, setAutoBalance] = useState(false);
  const [lastChange, setLastChange] = useState(null);
  const [flights, setFlights] = useState([]);
  const flightIdRef = useRef(0);

  const derived = deriveAtom(atom);

  const record = useCallback((type, prev, next, extra = []) => {
    const key = type === "proton" ? "protons" : type === "neutron" ? "neutrons" : "electrons";
    setLastChange({ type, delta: next[key] - prev[key], prevDerived: deriveAtom(prev), nextDerived: deriveAtom(next), extra });
  }, []);

  // Each +/- press goes through applyChange(): with Auto-balance OFF it changes
  // exactly one count by exactly one (no hidden neutron / electron / isotope
  // change); see lib/atomControls.js for the full contract.
  const handleChange = useCallback((type, delta) => {
    const next = applyChange(atom, type, delta, { autoBalance });
    if (next === atom) return;
    setAtom(next);
    record(type, atom, next, autoBalance ? autoBalanceLines(type, atom, next) : []);
    flightIdRef.current += 1;
    const id = flightIdRef.current;
    setFlights((f) => [...f, { id, type, direction: delta > 0 ? "add" : "remove" }]);
  }, [atom, autoBalance, record]);

  const removeFlight = useCallback((id) => setFlights((f) => f.filter((flight) => flight.id !== id)), []);

  function handleSelectElement(atomicNumber) {
    const next = setProtons(atom, atomicNumber, { autoBalance });
    if (next === atom) return;
    setAtom(next);
    record("proton", atom, next, autoBalance ? autoBalanceLines("proton", atom, next) : []);
  }

  function handleToggleAutoBalance(on) {
    setAutoBalance(on);
    const next = toggleAutoBalance(atom, on);
    if (next !== atom) { setAtom(next); setLastChange(null); }
  }

  function handleStartEmpty() { setAtom(EMPTY_ATOM); setLastChange(null); setFlights([]); }
  function handleResetCarbon() { setAtom(CARBON_12); setLastChange(null); setFlights([]); }

  const change = lastChange ? describeChange(lastChange.type, lastChange.delta, lastChange.prevDerived, lastChange.nextDerived, lastChange.extra) : null;
  const highlightType = lastChange?.type;
  const stability = nuclideStatus(atom.protons, atom.neutrons).status;

  return (
    <InteractiveFrame title="Build an Atom" subtitle="Change the particles and discover what makes an atom what it is." compact={compact} standalone={standalone}>
      <BuildAtomWorkspace
        atom={atom}
        derived={derived}
        autoBalance={autoBalance}
        flights={flights}
        removeFlight={removeFlight}
        handleChange={handleChange}
        handleToggleAutoBalance={handleToggleAutoBalance}
        handleSelectElement={handleSelectElement}
        handleStartEmpty={handleStartEmpty}
        handleResetCarbon={handleResetCarbon}
        change={change}
        highlightType={highlightType}
        unstable={stability === "radioactive" || stability === "not-stable"}
      />
    </InteractiveFrame>
  );
}

// Presentation only. One container-driven layout for embedded, fullscreen and
// new-tab:
//   wide (container >= 860 px): atom stage ~66 % | side panel ~34 %. The side
//     panel scrolls INSIDE itself; the particle controls are pinned at its top
//     so they are always visible. The stage fills its own grid cell, so it can
//     never reach the controls.
//   stacked (narrower): atom stage on top, panels below (in fullscreen / new
//     tab the panels scroll inside their own region; embedded they flow).
function BuildAtomWorkspace(props) {
  const { atom, derived, autoBalance, flights, removeFlight, handleChange, handleToggleAutoBalance, handleSelectElement, handleStartEmpty, handleResetCarbon, change, highlightType, unstable } = props;
  const { isViewport } = useSimulationPresentation();
  const [rootRef, { width }] = useSize();
  const wide = width === 0 || width >= WIDE_MIN_WIDTH;

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{"S1.2 • The Nuclear Atom"}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleStartEmpty} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30" data-testid="atom-start-empty">
          Start From Empty
        </button>
        <button type="button" onClick={handleResetCarbon} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30" data-testid="atom-reset-carbon">
          Reset to Carbon-12
        </button>
      </div>
    </div>
  );

  const buildControls = (
    <div className="flex flex-col gap-2" data-testid="atom-build-controls">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Build It</p>
      <ParticleControls atom={atom} autoBalance={autoBalance} onToggleAutoBalance={handleToggleAutoBalance} onChange={handleChange} />
    </div>
  );

  // The stage is a positioned box with a definite size from the layout; the
  // visualiser is absolutely positioned inside it and scales to fit.
  const atomStage = (
    <div className="relative h-full min-h-0 w-full min-w-0 overflow-hidden rounded-xl" style={{ background: "radial-gradient(ellipse at center, #1B2440 0%, #0D1224 75%)" }} data-testid="atom-stage">
      <AtomVisualizer
        protons={atom.protons}
        neutrons={atom.neutrons}
        electrons={atom.electrons}
        highlightZ={highlightType === "proton"}
        highlightA={highlightType === "neutron"}
        highlightCharge={highlightType === "electron"}
        nucleusWarning={unstable}
      />
      {flights.map((flight) => (
        <FlyingParticle key={flight.id} flight={flight} onComplete={() => removeFlight(flight.id)} />
      ))}
    </div>
  );

  // Shell counts / arrangement / configuration for the ELECTRON count drawn in the stage.
  const shellPanel = <ShellPanel protons={atom.protons} electrons={atom.electrons} />;

  const identity = (
    <div className="flex flex-col gap-2">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Build?</p>
      <IdentityPanel derived={derived} highlightZ={highlightType === "proton"} highlightA={highlightType === "neutron"} highlightCharge={highlightType === "electron"} />
      <IsotopeComparison protons={atom.protons} electrons={atom.electrons} />
    </div>
  );

  const secondary = (
    <div className="flex flex-col gap-3">
      <ChallengeMode atom={atom} derived={derived} />
      <MiniPeriodicTable currentAtomicNumber={atom.protons} maxAtomicNumber={LIMITS.protons} onSelectElement={handleSelectElement} />
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Changed?</p>
        <WhatChanged change={change} />
      </div>
      <ConceptStrip highlightedType={highlightType} stacked />
    </div>
  );

  const rootStyle = isViewport ? undefined : wide ? { height: "clamp(560px, calc(100dvh - 8rem), 800px)" } : undefined;
  const rootCls = "mx-auto flex w-full min-w-0 flex-col gap-2 " + (isViewport ? "h-full min-h-0" : "");

  if (wide) {
    return (
      <div ref={rootRef} className={rootCls} style={{ maxWidth: isViewport ? undefined : 1500, ...rootStyle }} data-testid="atom-workspace" data-layout="wide">
        {toolbar}
        <div className="grid min-h-0 flex-1 gap-3" style={{ gridTemplateColumns: "minmax(0, 66fr) minmax(300px, 34fr)" }}>
          <div className="flex min-h-0 min-w-0 flex-col gap-2" data-testid="atom-column">
            <div className="min-h-[200px] min-w-0 flex-1">{atomStage}</div>
            {shellPanel}
          </div>
          <div className="min-h-0 min-w-0 overflow-y-auto overflow-x-hidden pr-1" data-testid="atom-side">
            <div className="sticky top-0 z-10 bg-[var(--color-paper)] pb-2">{buildControls}</div>
            <div className="flex flex-col gap-3">
              {identity}
              {secondary}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STACKED. Fullscreen / new tab: stage takes ~40 % of the height, the panels
  // scroll in the rest. Embedded: a square-ish stage, then everything flows.
  return (
    <div ref={rootRef} className={rootCls + (isViewport ? " overflow-y-auto overflow-x-hidden" : "")} data-testid="atom-workspace" data-layout="stacked">
      {toolbar}
      <div className={isViewport ? "shrink-0" : "shrink-0"} style={{ height: isViewport ? "clamp(190px, 34%, 420px)" : `clamp(240px, ${Math.round(width * 0.9)}px, 420px)` }}>{atomStage}</div>
      {shellPanel}
      <div className={"flex flex-col gap-3 " + (isViewport ? "min-h-[220px] flex-1 overflow-y-auto overflow-x-hidden pr-1" : "min-h-0")} data-testid="atom-side">
        {buildControls}
        {identity}
        {secondary}
      </div>
    </div>
  );
}
