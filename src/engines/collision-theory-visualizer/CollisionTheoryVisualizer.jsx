import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ReactionVessel from "./components/ReactionVessel.jsx";
import MagnifiedView from "./components/MagnifiedView.jsx";
import MaxwellBoltzmannGraph from "./components/MaxwellBoltzmannGraph.jsx";
import { Molecule } from "./components/Molecule.jsx";
import { DEFAULT_TEMPERATURE, DEFAULT_EA, TEMPERATURE_OPTIONS, DEFAULT_TEMPERATURES } from "./lib/maxwellBoltzmann.js";

const MODES = [
  { id: "collision", label: "Collision" },
  { id: "activation", label: "Activation Energy" },
  { id: "orientation", label: "Orientation" },
  { id: "maxwell", label: "Maxwell\u2013Boltzmann" },
];

// Illustrative collision energies for the two Activation Energy demo
// cases, on the SAME 0-100 scale as the Ea slider -- "sufficient" is
// derived LIVE by comparing against the current `ea` state.
const CASE_A_COLLISION_ENERGY = 25;
const CASE_B_COLLISION_ENERGY = 65;

export default function CollisionTheoryVisualizer({ compact = false }) {
  const [modeId, setModeId] = useState("collision");
  const [temperature] = useState(DEFAULT_TEMPERATURE);
  const [ea, setEa] = useState(DEFAULT_EA);
  const [speed, setSpeed] = useState(0.5);

  // Collision tab -- real captured/inspected encounters from the vessel.
  const [encounter, setEncounter] = useState(null);
  const [encounterSeq, setEncounterSeq] = useState(0);
  const handleCloseEncounter = useCallback((found) => {
    setEncounter((prev) => {
      if (prev) return prev;
      setEncounterSeq((n) => n + 1);
      return found;
    });
  }, []);
  const handleInspect = useCallback((found) => {
    setEncounter(found);
    setEncounterSeq((n) => n + 1);
  }, []);

  // Activation Energy tab -- two curated cases.
  const [eaCase, setEaCase] = useState("insufficient");
  const [eaReplayKey, setEaReplayKey] = useState(0);

  // Orientation tab -- two curated cases, both with sufficient energy.
  const [orientationCase, setOrientationCase] = useState("incorrect");
  const [orientationReplayKey, setOrientationReplayKey] = useState(0);

  // Maxwell-Boltzmann tab.
  const [temperatures, setTemperatures] = useState(DEFAULT_TEMPERATURES);
  const [mbEa, setMbEa] = useState(DEFAULT_EA);
  const [particleView, setParticleView] = useState("T1");

  return (
    <InteractiveFrame title="Collision Theory Visualizer" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1060 }}>
        <div className="flex flex-wrap justify-center gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setModeId(m.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                modeId === m.id ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {modeId === "collision" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} onCloseEncounter={handleCloseEncounter} onInspect={handleInspect} />}
            main={
              encounter ? (
                <MagnifiedView mode="collision" encounterId={encounterSeq} calloutLine="Particles must collide for a reaction to occur." speed={speed} onSpeedChange={setSpeed} replayKey={encounterSeq} />
              ) : (
                <EmptyMagnifiedView text="Watching the vessel for an A\u2013B encounter\u2026" />
              )
            }
          />
        )}

        {modeId === "activation" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} />}
            main={
              <ActivationEnergyPanel
                ea={ea}
                setEa={setEa}
                eaCase={eaCase}
                setEaCase={setEaCase}
                replayKey={eaReplayKey}
                bumpReplay={() => setEaReplayKey((k) => k + 1)}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            }
          />
        )}

        {modeId === "orientation" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperature} active={true} />}
            main={
              <OrientationPanel
                orientationCase={orientationCase}
                setOrientationCase={setOrientationCase}
                replayKey={orientationReplayKey}
                bumpReplay={() => setOrientationReplayKey((k) => k + 1)}
                speed={speed}
                onSpeedChange={setSpeed}
              />
            }
          />
        )}

        {modeId === "maxwell" && (
          <ObservationLayout
            vessel={<ReactionVessel temperature={temperatures[particleView]} active={true} />}
            main={<MaxwellBoltzmannGraph temperatures={temperatures} ea={mbEa} />}
            belowVessel={
              <div className="mt-2 flex justify-center gap-1">
                {["T1", "T2", "T3"].map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setParticleView(key)}
                    className={`rounded px-2 py-0.5 text-[10px] font-semibold ${particleView === key ? "bg-[var(--color-indigo)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-faint)]"}`}
                  >
                    {key}
                  </button>
                ))}
              </div>
            }
            belowMain={
              <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
                {["T1", "T2", "T3"].map((key) => (
                  <label key={key} className="flex items-center gap-1.5 text-xs text-[var(--color-ink-soft)]">
                    {key}
                    <select
                      value={temperatures[key]}
                      onChange={(e) => setTemperatures((prev) => clampOrdered({ ...prev, [key]: Number(e.target.value) }, key))}
                      aria-label={`${key} temperature in kelvin`}
                      className="rounded border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-1.5 py-0.5 text-[var(--color-ink)]"
                    >
                      {TEMPERATURE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t} K</option>
                      ))}
                    </select>
                  </label>
                ))}
                <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
                  Ea
                  <input type="range" min={10} max={80} value={mbEa} onChange={(e) => setMbEa(Number(e.target.value))} aria-label="Activation energy" />
                </label>
              </div>
            }
          />
        )}

        <MoleculeKey />
      </div>
    </InteractiveFrame>
  );
}

// Keeps T1 < T2 < T3 whenever one is changed. The changed value is
// first clamped into a range that leaves enough room for the other two
// (this is what prevents an unsatisfiable boundary case -- e.g. setting
// T3 to 260 would otherwise try to push T1/T2 below the 250 K floor),
// then the other two are cascaded away from it in both directions.
// Verified against boundary cases (T1 at the max, T3 at the min) before
// being wired in.
function clampOrdered(temps, changedKey) {
  const MIN = 250, MAX = 700, STEP = 50;
  const next = { ...temps };
  if (changedKey === "T1") next.T1 = Math.min(next.T1, MAX - 2 * STEP);
  if (changedKey === "T2") next.T2 = Math.max(MIN + STEP, Math.min(next.T2, MAX - STEP));
  if (changedKey === "T3") next.T3 = Math.max(MIN + 2 * STEP, next.T3);

  const order = ["T1", "T2", "T3"];
  const changedIdx = order.indexOf(changedKey);
  for (let i = changedIdx + 1; i < order.length; i++) {
    if (next[order[i]] <= next[order[i - 1]]) next[order[i]] = Math.min(MAX, next[order[i - 1]] + STEP);
  }
  for (let i = changedIdx - 1; i >= 0; i--) {
    if (next[order[i]] >= next[order[i + 1]]) next[order[i]] = Math.max(MIN, next[order[i + 1]] - STEP);
  }
  return next;
}

/** The shared LEFT-vessel / RIGHT-main layout used by all four tabs --
 * one layout component, not four independently-built screens. */
function ObservationLayout({ vessel, main, belowVessel, belowMain }) {
  return (
    <div className="mt-3 flex flex-col gap-3 sm:flex-row">
      <div className="sm:w-[28%]">
        <div className="rounded-lg border border-[var(--color-line)] p-1.5">{vessel}</div>
        {belowVessel}
      </div>
      <div className="sm:w-[72%]">
        {main}
        {belowMain}
      </div>
    </div>
  );
}

function EmptyMagnifiedView({ text }) {
  return (
    <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <p className="text-center text-sm text-[var(--color-ink-faint)]">{text}</p>
    </div>
  );
}

function ActivationEnergyPanel({ ea, setEa, eaCase, setEaCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const collisionEnergy = eaCase === "insufficient" ? CASE_A_COLLISION_ENERGY : CASE_B_COLLISION_ENERGY;
  const sufficient = collisionEnergy >= ea;
  return (
    <div>
      <MagnifiedView
        mode="activation"
        energySufficient={sufficient}
        calloutLine="Particles must collide with sufficient energy."
        resultLine={sufficient ? "Reaction possible" : "Insufficient energy \u2014 particles separate"}
        speed={speed}
        onSpeedChange={onSpeedChange}
        replayKey={`${replayKey}-${sufficient}`}
      />
      <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          Ea
          <input type="range" min={10} max={80} value={ea} onChange={(e) => setEa(Number(e.target.value))} aria-label="Activation energy" />
        </label>
        <div className="flex gap-1.5">
          <TabButton active={eaCase === "insufficient"} onClick={() => { setEaCase("insufficient"); bumpReplay(); }}>Case 1</TabButton>
          <TabButton active={eaCase === "sufficient"} onClick={() => { setEaCase("sufficient"); bumpReplay(); }}>Case 2</TabButton>
        </div>
      </div>
    </div>
  );
}

function OrientationPanel({ orientationCase, setOrientationCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const correct = orientationCase === "correct";
  return (
    <div>
      <MagnifiedView
        mode="orientation"
        energySufficient={true}
        orientationCorrect={correct}
        calloutLine="Sufficient energy alone may still not be enough."
        resultLine={correct ? "Successful collision \u2014 products form" : "Particles separate"}
        speed={speed}
        onSpeedChange={onSpeedChange}
        replayKey={replayKey}
      />
      <div className="mt-2 flex justify-center gap-1.5">
        <TabButton active={!correct} onClick={() => { setOrientationCase("incorrect"); bumpReplay(); }}>Incorrect Orientation</TabButton>
        <TabButton active={correct} onClick={() => { setOrientationCase("correct"); bumpReplay(); }}>Correct Orientation</TabButton>
      </div>
    </div>
  );
}

function MoleculeKey() {
  return (
    <div className="mt-3 flex items-center justify-center gap-5 rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 py-2">
      {["A", "B", "C", "D"].map((species) => (
        <div key={species} className="flex flex-col items-center gap-0.5">
          <svg viewBox="0 0 32 24" width="32" height="24">
            <Molecule species={species} x={16} y={12} size={1} label={false} />
          </svg>
          <span className="text-[10px] font-semibold text-[var(--color-ink-faint)]">{species}</span>
        </div>
      ))}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${active ? "bg-[var(--color-teal)] text-white" : "border border-[var(--color-line)] text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30"}`}
    >
      {children}
    </button>
  );
}
