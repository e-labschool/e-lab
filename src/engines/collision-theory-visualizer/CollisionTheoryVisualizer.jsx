import { useState, useCallback } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ParticleContainer from "./components/ParticleContainer.jsx";
import CollisionViewer from "./components/CollisionViewer.jsx";
import MaxwellBoltzmannGraph from "./components/MaxwellBoltzmannGraph.jsx";
import { DEFAULT_TEMPERATURE, DEFAULT_EA, MIN_TEMPERATURE, MAX_TEMPERATURE } from "./lib/maxwellBoltzmann.js";

const MODES = [
  { id: "collision", label: "Collision" },
  { id: "activation", label: "Activation Energy" },
  { id: "orientation", label: "Orientation" },
  { id: "maxwell", label: "Maxwell\u2013Boltzmann" },
];

// Illustrative collision energies for the two Activation Energy demo
// cases, on the SAME 0-100 scale as the Ea slider -- "sufficient" is
// derived LIVE by comparing against the current `ea` state, never a
// hardcoded true/false, so dragging Ea can genuinely flip either case's
// outcome (e.g. dragging Ea above 65 makes even Case B insufficient).
const CASE_A_COLLISION_ENERGY = 25;
const CASE_B_COLLISION_ENERGY = 65;

export default function CollisionTheoryVisualizer({ compact = false }) {
  const [modeId, setModeId] = useState("collision");
  const [temperature, setTemperature] = useState(DEFAULT_TEMPERATURE);
  const [ea, setEa] = useState(DEFAULT_EA);
  const [speed, setSpeed] = useState(0.5);

  // Collision mode -- a REAL detected encounter from the live field.
  const [liveEncounter, setLiveEncounter] = useState(null);
  const [liveReplayKey, setLiveReplayKey] = useState(0);
  const handleCloseEncounter = useCallback((found) => {
    setLiveEncounter((prev) => {
      if (prev) return prev; // already showing one -- don't keep re-triggering every frame
      setLiveReplayKey((k) => k + 1);
      return found;
    });
  }, []);

  // Activation Energy mode -- two curated cases.
  const [eaCase, setEaCase] = useState("insufficient");
  const [eaReplayKey, setEaReplayKey] = useState(0);

  // Orientation mode -- two curated cases, both with sufficient energy.
  const [orientationCase, setOrientationCase] = useState("incorrect");
  const [orientationReplayKey, setOrientationReplayKey] = useState(0);

  return (
    <InteractiveFrame title="Collision Theory Visualizer" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1020 }}>
        {/* Mode tabs */}
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
          <CollisionMode liveEncounter={liveEncounter} liveReplayKey={liveReplayKey} speed={speed} onSpeedChange={setSpeed} onCloseEncounter={handleCloseEncounter} onDismiss={() => setLiveEncounter(null)} temperature={temperature} />
        )}

        {modeId === "activation" && (
          <ActivationEnergyMode ea={ea} setEa={setEa} temperature={temperature} eaCase={eaCase} setEaCase={setEaCase} replayKey={eaReplayKey} bumpReplay={() => setEaReplayKey((k) => k + 1)} speed={speed} onSpeedChange={setSpeed} />
        )}

        {modeId === "orientation" && (
          <OrientationMode temperature={temperature} orientationCase={orientationCase} setOrientationCase={setOrientationCase} replayKey={orientationReplayKey} bumpReplay={() => setOrientationReplayKey((k) => k + 1)} speed={speed} onSpeedChange={setSpeed} />
        )}

        {modeId === "maxwell" && <MaxwellMode temperature={temperature} setTemperature={setTemperature} ea={ea} setEa={setEa} />}
      </div>
    </InteractiveFrame>
  );
}

function ModeIntro({ children }) {
  return <p className="mt-2 text-center text-xs text-[var(--color-ink-soft)]">{children}</p>;
}

function CollisionMode({ liveEncounter, liveReplayKey, speed, onSpeedChange, onCloseEncounter, onDismiss, temperature }) {
  return (
    <div>
      <ModeIntro>{"Particles must collide before they can react."}</ModeIntro>
      <div className="mt-2 rounded-lg border border-[var(--color-line)] p-2">
        <ParticleContainer temperature={temperature} active={!liveEncounter} onCloseEncounter={onCloseEncounter} />
      </div>
      <div className="mt-3">
        {liveEncounter ? (
          <>
            {/* mode="collision-only" structurally cannot evaluate energy/
                orientation or form a product -- see CollisionViewer.jsx */}
            <CollisionViewer mode="collision-only" resultLine="Collision occurs" speed={speed} onSpeedChange={onSpeedChange} replayKey={liveReplayKey} />
            <div className="mt-2 text-center">
              <button type="button" onClick={onDismiss} className="text-xs font-medium text-[var(--color-indigo)] hover:underline">
                Back to container
              </button>
            </div>
          </>
        ) : (
          <p className="text-center text-sm text-[var(--color-ink-faint)]">{"No collision \u2014 no opportunity to react"}</p>
        )}
      </div>
    </div>
  );
}

function ActivationEnergyMode({ ea, setEa, temperature, eaCase, setEaCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const collisionEnergy = eaCase === "insufficient" ? CASE_A_COLLISION_ENERGY : CASE_B_COLLISION_ENERGY;
  const sufficient = collisionEnergy >= ea;
  return (
    <div>
      <ModeIntro>{"Collision alone is not enough \u2014 the collision energy must also be sufficient."}</ModeIntro>
      <div className="mt-2 rounded-lg border border-[var(--color-line)] p-2">
        <ParticleContainer temperature={temperature} active={true} height={110} />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-center gap-3">
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          Activation energy, Ea
          <input type="range" min={10} max={80} value={ea} onChange={(e) => setEa(Number(e.target.value))} aria-label="Activation energy" />
        </label>
        <div className="flex gap-1.5">
          <TabButton active={eaCase === "insufficient"} onClick={() => { setEaCase("insufficient"); bumpReplay(); }}>Case A</TabButton>
          <TabButton active={eaCase === "sufficient"} onClick={() => { setEaCase("sufficient"); bumpReplay(); }}>Case B</TabButton>
        </div>
      </div>
      <p className="mt-1 text-center text-[11px] text-[var(--color-ink-faint)]">
        Case {eaCase === "insufficient" ? "A" : "B"} collision energy: {collisionEnergy} &middot; Ea: {ea}
      </p>

      <div className="mt-3">
        <CollisionViewer
          mode="energy-only"
          energySufficient={sufficient}
          resultLine={sufficient ? "Reaction possible" : "Insufficient energy \u2014 particles separate"}
          speed={speed}
          onSpeedChange={onSpeedChange}
          replayKey={`${replayKey}-${sufficient}`}
        />
      </div>
    </div>
  );
}

function OrientationMode({ temperature, orientationCase, setOrientationCase, replayKey, bumpReplay, speed, onSpeedChange }) {
  const correct = orientationCase === "correct";
  return (
    <div>
      <ModeIntro>{"Both collisions have enough energy \u2014 only orientation differs."}</ModeIntro>
      <div className="mt-2 rounded-lg border border-[var(--color-line)] p-2">
        <ParticleContainer temperature={temperature} active={true} height={110} />
      </div>

      <div className="mt-3 flex justify-center gap-1.5">
        <TabButton active={!correct} onClick={() => { setOrientationCase("incorrect"); bumpReplay(); }}>Incorrect Orientation</TabButton>
        <TabButton active={correct} onClick={() => { setOrientationCase("correct"); bumpReplay(); }}>Correct Orientation</TabButton>
      </div>

      <div className="mt-3">
        <CollisionViewer
          mode="full"
          energySufficient={true}
          orientationCorrect={correct}
          resultLine={correct ? "Successful collision \u2014 product forms" : "Wrong orientation \u2014 particles separate"}
          speed={speed}
          onSpeedChange={onSpeedChange}
          replayKey={replayKey}
        />
      </div>
    </div>
  );
}

function MaxwellMode({ temperature, setTemperature, ea, setEa }) {
  return (
    <div>
      <ModeIntro>{"Higher temperature \u2192 greater fraction of particles with E \u2265 Ea."}</ModeIntro>
      <div className="mt-2">
        <MaxwellBoltzmannGraph temperature={temperature} ea={ea} />
      </div>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-4">
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          Temperature: <strong className="text-[var(--color-ink)]">{temperature} K</strong>
          <input type="range" min={MIN_TEMPERATURE} max={MAX_TEMPERATURE} step={10} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} aria-label="Temperature in kelvin" />
        </label>
        <label className="flex items-center gap-2 text-xs text-[var(--color-ink-soft)]">
          Activation energy, Ea
          <input type="range" min={10} max={80} value={ea} onChange={(e) => setEa(Number(e.target.value))} aria-label="Activation energy" />
        </label>
      </div>
      <div className="mt-3 rounded-lg border border-[var(--color-line)] p-2">
        <ParticleContainer temperature={temperature} active={true} height={90} />
      </div>
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
