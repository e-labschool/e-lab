import { useState, useCallback, useRef } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { deriveAtom, CARBON_12, EMPTY_ATOM } from "./lib/atomState.js";
import { describeChange } from "./lib/whatChanged.js";
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
const MAX_COUNT = 30; // a sensible ceiling -- large enough for every test case and the heaviest challenge (Cl, Z=17), well short of anything unwieldy to render

export default function BuildAtomSimulation({ compact = false }) {
  const [atom, setAtom] = useState(CARBON_12);
  const [lastChange, setLastChange] = useState(null); // { type, delta, prevDerived, nextDerived } | null
  const [flights, setFlights] = useState([]);
  const [challengeActive, setChallengeActive] = useState(false);
  const flightIdRef = useRef(0);

  const derived = deriveAtom(atom);

  const handleChange = useCallback(
    (type, delta) => {
      setAtom((prev) => {
        const key = type === "proton" ? "protons" : type === "neutron" ? "neutrons" : "electrons";
        const nextValue = Math.max(MIN_COUNT, Math.min(MAX_COUNT, prev[key] + delta));
        if (nextValue === prev[key]) return prev; // no-op at the boundary -- no flight, no change event
        const next = { ...prev, [key]: nextValue };

        const prevDerived = deriveAtom(prev);
        const nextDerived = deriveAtom(next);
        setLastChange({ type, delta: nextValue - prev[key], prevDerived, nextDerived });

        flightIdRef.current += 1;
        const flightId = flightIdRef.current;
        setFlights((f) => [...f, { id: flightId, type, direction: delta > 0 ? "add" : "remove" }]);

        return next;
      });
    },
    []
  );

  const removeFlight = useCallback((id) => {
    setFlights((f) => f.filter((flight) => flight.id !== id));
  }, []);

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

  const change = lastChange ? describeChange(lastChange.type, lastChange.delta, lastChange.prevDerived, lastChange.nextDerived) : null;
  const highlightType = lastChange?.type;

  return (
    <InteractiveFrame title="Build an Atom" subtitle="Change the particles and discover what makes an atom what it is." compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1120 }}>
        <p className="text-center text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">{"S1.2 \u2022 The Nuclear Atom"}</p>

        <div className="mt-3 flex flex-wrap justify-center gap-2">
          <button type="button" onClick={handleStartEmpty} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            Start From Empty
          </button>
          <button type="button" onClick={handleResetCarbon} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            Reset to Carbon-12
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,260px)_minmax(0,1fr)_minmax(0,280px)]">
          {/* order-2 on mobile puts the atom first, matching the required mobile order */}
          <div className="order-2 lg:order-1">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Build It</p>
            <ParticleControls protons={atom.protons} neutrons={atom.neutrons} electrons={atom.electrons} onChange={handleChange} />
          </div>

          <div className="relative order-1 lg:order-2">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Your Atom</p>
            <div className="relative rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
              <AtomVisualizer
                protons={atom.protons}
                neutrons={atom.neutrons}
                electrons={atom.electrons}
                highlightZ={highlightType === "proton"}
                highlightA={highlightType === "neutron"}
                highlightCharge={highlightType === "electron"}
              />
              {flights.map((flight) => (
                <FlyingParticle key={flight.id} flight={flight} onComplete={() => removeFlight(flight.id)} />
              ))}
            </div>
          </div>

          <div className="order-3">
            <p className="mb-2 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Did You Build?</p>
            <IdentityPanel derived={derived} highlightZ={highlightType === "proton"} highlightA={highlightType === "neutron"} highlightCharge={highlightType === "electron"} />
            <IsotopeComparison protons={atom.protons} neutrons={atom.neutrons} />
          </div>
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-center text-xs font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">What Changed?</p>
          <WhatChanged change={change} />
        </div>

        <div className="mt-4">
          <ConceptStrip highlightedType={highlightType} />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <MiniPeriodicTable currentAtomicNumber={atom.protons} onSelectElement={handleSelectElement} />
          <ChallengeMode derived={derived} active={challengeActive} onToggle={setChallengeActive} />
        </div>
      </div>
    </InteractiveFrame>
  );
}
