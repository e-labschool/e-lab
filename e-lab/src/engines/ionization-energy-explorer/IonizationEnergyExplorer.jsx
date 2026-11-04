import { useState, useMemo, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { IONIZATION_DATA } from "./lib/ionizationData.js";
import { deriveAtomState, getRemovalOrder } from "./lib/atomState.js";
import { useReducedMotion } from "./lib/useReducedMotion.js";
import AtomVisualization from "./components/AtomVisualization.jsx";
import EnergyControl from "./components/EnergyControl.jsx";
import ConfigurationPanel from "./components/ConfigurationPanel.jsx";
import IonizationDataTable from "./components/IonizationDataTable.jsx";
import IonizationGraph from "./components/IonizationGraph.jsx";

const DEFAULT_Z = 12; // Magnesium -- the element the brief's worked examples centre on

export default function IonizationEnergyExplorer({ compact = false, standalone = false }) {
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
    <InteractiveFrame title="Ionization Energy Explorer" subtitle="Supply energy to successively remove electrons and watch the atom respond" compact={compact} standalone={standalone}>
      <IonizationEnergyWorkspace
        atomicNumber={atomicNumber}
        element={element}
        values={values}
        atomState={atomState}
        handleSelectElement={handleSelectElement}
        handleReset={handleReset}
        removing={removing}
        reducedMotion={reducedMotion}
        handleAnimationEnd={handleAnimationEnd}
        innerShellPulse={innerShellPulse}
        suppliedEnergy={suppliedEnergy}
        setSuppliedEnergy={setSuppliedEnergy}
        handleSupply={handleSupply}
        canSupply={canSupply}
        feedback={feedback}
        removalOrder={removalOrder}
      />
    </InteractiveFrame>
  );
}

// Split out purely so the two very different layouts (embedded vs.
// viewport/fullscreen/standalone) each read as one clear JSX tree instead
// of one function full of ternary classNames -- no state or scientific
// logic lives here, it's still 100% presentation, reading the exact same
// props IonizationEnergyExplorer always computed.
function IonizationEnergyWorkspace(props) {
  const {
    atomicNumber, element, values, atomState, handleSelectElement, handleReset,
    removing, reducedMotion, handleAnimationEnd, innerShellPulse,
    suppliedEnergy, setSuppliedEnergy, handleSupply, canSupply, feedback, removalOrder,
  } = props;
  const { isViewport } = useSimulationPresentation();

  const elementSelector = (
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
  );

  const resetButton = (
    <button
      type="button"
      onClick={handleReset}
      aria-label="Reset to neutral atom"
      className="flex shrink-0 items-center justify-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-2 text-xs font-medium text-[var(--color-ink-soft)] hover:border-[var(--color-ink)] hover:text-[var(--color-ink)]"
    >
      <RotateCcw size={13} /> Reset
    </button>
  );

  const atomPanel = (
    <AtomVisualization
      atomState={atomState}
      removing={removing}
      reducedMotion={reducedMotion}
      onRemovalAnimationEnd={handleAnimationEnd}
      innerShellPulse={innerShellPulse}
    />
  );

  const energyControl = (
    <EnergyControl
      atomState={atomState}
      suppliedEnergy={suppliedEnergy}
      onChangeSupplied={setSuppliedEnergy}
      onSupply={handleSupply}
      disabled={!canSupply}
      feedback={feedback}
    />
  );

  const configPanel = <ConfigurationPanel atomState={atomState} />;

  const graph = (
    <IonizationGraph element={element} values={values} currentStep={atomState.electronsRemoved + 1} removalOrder={removalOrder} />
  );

  if (!isViewport) {
    // EMBEDDED (normal Learn-page flow): unchanged from before this fix --
    // ordinary content-driven height, the atom panel's own explicit
    // min-heights are what make it dominate the page, page may scroll
    // like any other Learn content.
    return (
      <>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[200px_1fr_280px]">
          <div className="flex flex-col gap-3 lg:order-1">
            {elementSelector}
            <IonizationDataTable element={element} values={values} currentStep={atomState.electronsRemoved + 1} />
            {resetButton}
          </div>
          <div className="flex aspect-square flex-col rounded-md border border-[#1c2740] bg-[#070b14] p-3 sm:aspect-[4/3] lg:order-2 lg:aspect-auto lg:min-h-[560px]">
            {atomPanel}
          </div>
          <div className="flex flex-col gap-4 lg:order-3">
            {energyControl}
            {configPanel}
          </div>
        </div>
        <div className="mt-4">{graph}</div>
      </>
    );
  }

  // VIEWPORT MODE (fullscreen or standalone): the whole simulation must
  // fit in the height InteractiveFrame's content row hands us -- no
  // scrolling except the IE table's own internal one. Outer grid: the
  // 3-column workspace gets the LARGER share of the available height,
  // the graph gets a compact, bounded band beneath it (never intrinsic/
  // unbounded height, per the brief) -- both rows use `minmax(0, ...)` so
  // they can actually SHRINK instead of overflowing.
  return (
    <div className="grid h-full min-h-0 grid-rows-[minmax(0,1fr)_minmax(150px,220px)] gap-2">
      <div className="grid min-h-0 grid-cols-[190px_minmax(0,1fr)_260px] grid-rows-[minmax(0,1fr)] gap-2">
        {/* LEFT: element selector (auto) / IE table (flexible, internal
            scroll) / reset (auto) -- reset can never be pushed off-screen
            because it's its own `auto` grid row, not just "last in a
            column that might overflow". */}
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] gap-2">
          {elementSelector}
          <IonizationDataTable element={element} values={values} currentStep={atomState.electronsRemoved + 1} />
          {resetButton}
        </div>

        {/* CENTRE: hero atom -- fills exactly this column/row's real
            measured size. AtomVisualization derives maxRadius from BOTH
            this panel's width AND height (min of the two), so a wide-but-
            short viewport panel can never blow the atom up past what the
            available height allows -- see AtomVisualization.jsx. */}
        <div className="flex min-h-0 flex-col rounded-md border border-[#1c2740] bg-[#070b14] p-2.5">
          {atomPanel}
        </div>

        {/* RIGHT: energy controls (auto) / configuration + orbital
            diagram (flexible, internally scrollable only if a genuinely
            oversized orbital diagram demands it). */}
        <div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-2">
          {energyControl}
          {configPanel}
        </div>
      </div>

      {/* BOTTOM: compact landscape graph band -- a bounded fraction of
          the workspace height, never full intrinsic height. */}
      <div className="min-h-0">{graph}</div>
    </div>
  );
}
