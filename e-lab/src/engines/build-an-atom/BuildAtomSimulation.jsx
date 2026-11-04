import { useState, useCallback, useRef } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { deriveAtom, CARBON_12, EMPTY_ATOM } from "./lib/atomState.js";
import { describeChange } from "./lib/whatChanged.js";
import { defaultNeutronsFor, classifyNuclide } from "./data/nuclides.js";
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

// Presentation (embedded / fullscreen / standalone) is no longer owned
// here at all -- it comes entirely from the shared InteractiveFrame /
// useSimulationPresentation() architecture, exactly like every other
// engine. This component only ever holds the SCIENTIFIC state (the atom
// being built) and hands it to a workspace that reads `isViewport` to
// choose between the comfortable embedded layout and the compact
// one-viewport layout -- never its own fullscreen/expanded state.
export default function BuildAtomSimulation({ compact = false, standalone = false }) {
  const [atom, setAtom] = useState(CARBON_12);
  const [lastChange, setLastChange] = useState(null);
  const [flights, setFlights] = useState([]);
  const flightIdRef = useRef(0);

  const derived = deriveAtom(atom);

  // Every particle button always changes its count by exactly +/-1 and
  // always commits -- the curated nuclide dataset is used ONLY for
  // classifying the result (stable / radioactive / not included), never
  // as a boundary that blocks construction. The only limits are the
  // practical floor/ceiling (can't go below 0 or above MAX_COUNT).
  const handleChange = useCallback((type, delta) => {
    setAtom((prev) => {
      const key = type === "proton" ? "protons" : type === "neutron" ? "neutrons" : "electrons";
      const nextValue = Math.max(MIN_COUNT, Math.min(MAX_COUNT, prev[key] + delta));
      if (nextValue === prev[key]) return prev;
      let next = { ...prev, [key]: nextValue };
      // Changing protons changes the element -- if the new element has
      // curated nuclide coverage, snap neutrons to its default nuclide
      // so the student lands on a recognizable starting isotope rather
      // than an arbitrary neutron count carried over from the previous
      // element. Electron count is preserved, matching the existing
      // ion/charge rules. This does NOT apply to neutron changes, which
      // always move by exactly 1 regardless of curated coverage.
      if (type === "proton") {
        const defaultN = defaultNeutronsFor(nextValue);
        if (defaultN !== null) next = { ...next, neutrons: defaultN };
      }
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
      const defaultN = defaultNeutronsFor(atomicNumber);
      const next = { ...prev, protons: atomicNumber, neutrons: defaultN !== null ? defaultN : prev.neutrons };
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

  const change = lastChange ? describeChange(lastChange.type, lastChange.delta, lastChange.prevDerived, lastChange.nextDerived) : null;
  const highlightType = lastChange?.type;
  // Pure classification for display -- "stable" | "radioactive" |
  // "not-included" -- never a boundary on what can be built.
  const nuclideClassification = classifyNuclide(atom.protons, atom.neutrons);

  return (
    <InteractiveFrame title="Build an Atom" subtitle="Change the particles and discover what makes an atom what it is." compact={compact} standalone={standalone}>
      <BuildAtomWorkspace
        atom={atom}
        derived={derived}
        flights={flights}
        removeFlight={removeFlight}
        handleChange={handleChange}
        handleSelectElement={handleSelectElement}
        handleStartEmpty={handleStartEmpty}
        handleResetCarbon={handleResetCarbon}
        change={change}
        highlightType={highlightType}
        nuclideClassification={nuclideClassification}
      />
    </InteractiveFrame>
  );
}

// Split out so the two layouts (embedded vs. viewport/fullscreen/
// standalone) each read as one clear JSX tree -- no state or scientific
// logic lives here, it's 100% presentation over the exact same props
// BuildAtomSimulation always computed. Mirrors the split already used by
// IonizationEnergyExplorer.jsx, the reference implementation.
function BuildAtomWorkspace(props) {
  const {
    atom, derived, flights, removeFlight, handleChange, handleSelectElement,
    handleStartEmpty, handleResetCarbon, change, highlightType, nuclideClassification,
  } = props;
  const { isViewport } = useSimulationPresentation();

  const toolbar = (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{"S1.2 • The Nuclear Atom"}</p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleStartEmpty} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
          Start From Empty
        </button>
        <button type="button" onClick={handleResetCarbon} className="rounded-md border border-[var(--color-line)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
          Reset to Carbon-12
        </button>
      </div>
    </div>
  );

  const buildControls = (
    <div className="flex flex-col gap-2">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Build It</p>
      <ParticleControls protons={atom.protons} neutrons={atom.neutrons} electrons={atom.electrons} onChange={handleChange} />
    </div>
  );

  const atomStage = (fillHeight) => (
    <div className="relative overflow-hidden rounded-xl p-3" style={{ background: "radial-gradient(ellipse at center, #1B2440 0%, #0D1224 75%)", ...(fillHeight ? { height: "100%" } : { minHeight: "340px" }) }}>
      <div className="flex h-full items-center justify-center">
        <AtomVisualizer
          protons={atom.protons}
          neutrons={atom.neutrons}
          electrons={atom.electrons}
          highlightZ={highlightType === "proton"}
          highlightA={highlightType === "neutron"}
          highlightCharge={highlightType === "electron"}
          nucleusWarning={nuclideClassification === "radioactive"}
          fillHeight={fillHeight}
        />
      </div>
      {flights.map((flight) => (
        <FlyingParticle key={flight.id} flight={flight} onComplete={() => removeFlight(flight.id)} />
      ))}
    </div>
  );

  const identity = (
    <div className="flex flex-col gap-2">
      <p className="text-center text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Build?</p>
      <IdentityPanel derived={derived} nuclideClassification={nuclideClassification} highlightZ={highlightType === "proton"} highlightA={highlightType === "neutron"} highlightCharge={highlightType === "electron"} />
      <IsotopeComparison protons={atom.protons} electrons={atom.electrons} />
    </div>
  );

  // These two blocks are laid out differently depending on how WIDE the
  // column they land in actually is: the embedded layout gives them the
  // full ~1180px page width (so a two-up split earns its keep), while
  // viewport mode places them inside a narrow (~220-260px) sidebar
  // column. Tailwind's `lg:` is a VIEWPORT-width breakpoint, not a
  // container-width one, so reusing the embedded two-column split inside
  // a narrow sidebar at a wide desktop viewport would still try to lay
  // out two columns in ~220px and collide -- `twoUp` picks the version
  // that actually matches the space available.
  const periodicTableAndChallenge = (twoUp) => (
    <div className={twoUp ? "grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1fr)]" : "flex flex-col gap-3"}>
      <MiniPeriodicTable currentAtomicNumber={atom.protons} onSelectElement={handleSelectElement} />
      <ChallengeMode atom={atom} derived={derived} />
    </div>
  );

  const whatChangedAndConcepts = (twoUp) => (
    <div className={twoUp ? "grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)]" : "flex flex-col gap-3"}>
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Changed?</p>
        <WhatChanged change={change} />
      </div>
      <ConceptStrip highlightedType={highlightType} stacked={!twoUp} />
    </div>
  );

  if (!isViewport) {
    // EMBEDDED (normal Learn-page flow): unchanged from before this fix --
    // ordinary content-driven height, everything stacked vertically, page
    // may scroll like any other Learn content.
    return (
      <div className="mx-auto w-full" style={{ maxWidth: 1180 }}>
        {toolbar}
        <div className="mt-3">{periodicTableAndChallenge(true)}</div>
        <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,230px)_minmax(0,1fr)_minmax(0,260px)]">
          <div className="order-2 lg:order-1">{buildControls}</div>
          <div className="order-1 lg:order-2">{atomStage(false)}</div>
          <div className="order-3">{identity}</div>
        </div>
        <div className="mt-3">{whatChangedAndConcepts(true)}</div>
      </div>
    );
  }

  // VIEWPORT MODE (fullscreen or standalone): the whole simulation must
  // fit in the height InteractiveFrame's content row hands us. CORE
  // interaction -- particle controls, the atom itself, and the identity
  // read-out -- is always fully visible, never scrolled to reach. Only
  // the SECONDARY teaching aids (periodic table + challenge on the left,
  // "what changed" + concept strip on the right) sit in a `minmax(0,1fr)`
  // row with its own contained `overflow-y-auto`, exactly the kind of
  // "long optional panel" internal scrolling the brief allows.
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
      {toolbar}
      <div className="grid min-h-0 grid-cols-1 gap-2 lg:grid-cols-[220px_minmax(0,1fr)_260px]">
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          {buildControls}
          <div className="min-h-0 overflow-y-auto pr-0.5">{periodicTableAndChallenge(false)}</div>
        </div>

        <div className="min-h-0">{atomStage(true)}</div>

        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          {identity}
          <div className="min-h-0 overflow-y-auto pr-0.5">{whatChangedAndConcepts(false)}</div>
        </div>
      </div>
    </div>
  );
}
