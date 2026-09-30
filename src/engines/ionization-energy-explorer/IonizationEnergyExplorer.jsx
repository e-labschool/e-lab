import { useState, useMemo, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { IONIZATION_DATA } from "./lib/ionizationData.js";
import { deriveAtomState, getRemovalOrder } from "./lib/atomState.js";
import { useReducedMotion } from "./lib/useReducedMotion.js";
import AtomVisualization from "./components/AtomVisualization.jsx";
import EnergyControl from "./components/EnergyControl.jsx";
import ConfigurationPanel from "./components/ConfigurationPanel.jsx";
import IonizationDataTable from "./components/IonizationDataTable.jsx";
import IonizationGraph from "./components/IonizationGraph.jsx";

const DEFAULT_Z = 12; // Magnesium -- the element the brief's worked examples centre on

export default function IonizationEnergyExplorer({ compact = false }) {
  const reducedMotion = useReducedMotion();
  const [atomicNumber, setAtomicNumber] = useState(DEFAULT_Z);
  const [electronsRemoved, setElectronsRemoved] = useState(0);
  const [suppliedEnergy, setSuppliedEnergy] = useState(0);
  const [removing, setRemoving] = useState(null); // in-flight animation descriptor, or null
  const [feedback, setFeedback] = useState(null);
  const [innerShellPulse, setInnerShellPulse] = useState(false);

  const atomState = useMemo(() => deriveAtomState(atomicNumber, electronsRemoved), [atomicNumber, electronsRemoved]);
  const element = atomState.element;
  const values = element.successiveIonizationEnergies;
  // One removal-order label per ionization step, for the graph's tooltip
  // ("electron removed from 2p") -- removalOrder[i] is the sublevel that
  // IE[i+1] removes an electron from, straight from the same reversed-
  // Aufbau sequence atomState.js's deriveAtomState uses internally.
  const removalOrder = useMemo(() => getRemovalOrder(atomicNumber), [atomicNumber]);

  const handleSelectElement = useCallback((z) => {
    setAtomicNumber(z);
    setElectronsRemoved(0);
    setSuppliedEnergy(0);
    setRemoving(null);
    setFeedback(null);
    setInnerShellPulse(false);
  }, []);

  const handleReset = useCallback(() => {
    setElectronsRemoved(0);
    setSuppliedEnergy(0);
    setRemoving(null);
    setFeedback(null);
    setInnerShellPulse(false);
  }, []);

  const handleSupply = useCallback(() => {
    if (!atomState || atomState.isFullyIonized || removing) return;
    const currentIE = atomState.nextIonizationEnergy;
    if (!(suppliedEnergy >= currentIE)) {
      setFeedback({ text: "Not enough energy. The electron remains bound.", tone: "warn" });
      return;
    }
    const shell = atomState.nextShell;
    const occupancyAtRemoval = atomState.shells[shell];
    setFeedback(null);
    setRemoving({ shell, indexInShell: occupancyAtRemoval - 1, occupancyAtRemoval });
  }, [atomState, suppliedEnergy, removing]);

  const handleAnimationEnd = useCallback(() => {
    setRemoving((current) => {
      if (!current) return current;
      const prevSpecies = atomState.speciesSymbol;
      const nextRemoved = electronsRemoved + 1;
      const nextState = deriveAtomState(atomicNumber, nextRemoved);
      const shellEmptied = !(nextState.shells[current.shell] > 0);
      setElectronsRemoved(nextRemoved);
      setSuppliedEnergy(0);
      let text = `Electron removed. ${prevSpecies} → ${nextState.speciesSymbol}`;
      if (nextState.isInnerShellJump) {
        text += " Notice the jump! The next electron must be removed from an inner main energy level, where it is held much more strongly.";
      }
      setFeedback({ text, tone: "success" });
      setInnerShellPulse(shellEmptied);
      if (shellEmptied) setTimeout(() => setInnerShellPulse(false), 950);
      return null;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [atomState, atomicNumber, electronsRemoved]);

  const canSupply = !atomState.isFullyIonized && !removing;

  return (
    <InteractiveFrame title="Ionization Energy Explorer" subtitle="Supply energy to successively remove electrons and watch the atom respond" compact={compact}>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[220px_1fr_300px]">
        {/* LEFT: element selector + data table */}
        <div className="flex flex-col gap-3 lg:order-1">
          <div>
            <label htmlFor="ie-element-select" className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]">Element</label>
            <select
              id="ie-element-select"
              aria-label="Select element"
              value={atomicNumber}
              onChange={(e) => handleSelectElement(Number(e.target.value))}
              className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none"
            >
              {IONIZATION_DATA.map((el) => <option key={el.atomicNumber} value={el.atomicNumber}>{el.symbol} &mdash; {el.name}</option>)}
            </select>
          </div>
          <IonizationDataTable element={element} values={values} currentStep={atomState.electronsRemoved + 1} />
          <button
            type="button"
            onClick={handleReset}
            aria-label="Reset to neutral atom"
            className="flex items-center justify-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
          >
            <RotateCcw size={13} /> Reset
          </button>
        </div>

        {/* CENTRE: hero atom visualization */}
        <div className="flex items-center justify-center rounded-md border border-[#1c2740] bg-[#070b14] p-4 lg:order-2">
          <AtomVisualization
            atomState={atomState}
            removing={removing}
            reducedMotion={reducedMotion}
            onRemovalAnimationEnd={handleAnimationEnd}
            innerShellPulse={innerShellPulse}
          />
        </div>

        {/* RIGHT: energy control + configuration panel */}
        <div className="flex flex-col gap-4 lg:order-3">
          <EnergyControl
            atomState={atomState}
            suppliedEnergy={suppliedEnergy}
            onChangeSupplied={setSuppliedEnergy}
            onSupply={handleSupply}
            disabled={!canSupply}
            feedback={feedback}
          />
          <ConfigurationPanel atomState={atomState} />
        </div>
      </div>

      {/* BOTTOM: full-width graph */}
      <div className="mt-4">
        <IonizationGraph element={element} values={values} currentStep={atomState.electronsRemoved + 1} removalOrder={removalOrder} />
      </div>
    </InteractiveFrame>
  );
}
