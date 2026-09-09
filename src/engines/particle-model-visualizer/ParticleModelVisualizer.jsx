import { useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ParticleChamber from "./components/ParticleChamber.jsx";
import ChamberWalls from "./components/ChamberWalls.jsx";
import ParticleSystem from "./components/ParticleSystem.jsx";
import StateSelector from "./components/StateSelector.jsx";
import ControlBar from "./components/ControlBar.jsx";
import PropertiesPanel from "./components/PropertiesPanel.jsx";
import { PALETTE } from "./data/palette.js";

const FALLBACK_DESCRIPTION =
  "A 3D chamber compares how particles are arranged and how they move in solids, liquids and gases.";

// The mode-agnostic orchestrator, reachable from /interactives directly and
// embeddable inside a lesson via the "e-Lab Simulation" content block —
// same pattern as every other e-Lab engine (see VSEPRExplorer3D.jsx).
//
// Everything — header, state selector, chamber, controls and the
// properties panel — lives inside one self-contained instrument card so it
// reads as a single learning block rather than a chamber with unrelated
// bits floating around it. The chamber and its particle system mount once
// and stay mounted for the whole session (no per-state remount): switching
// SOLID/LIQUID/GAS just changes the target the particle physics blends
// toward, which is what makes the state change read as a smooth,
// synchronized transition (animation + properties together) rather than
// three unrelated scenes being swapped.
export default function ParticleModelVisualizer({ compact = false }) {
  const [state, setState] = useState("solid");
  const [running, setRunning] = useState(true);
  const [showAttractions, setShowAttractions] = useState(false);
  const chamberRef = useRef(null);

  const body = (
    <div className="rounded-xl border p-3 sm:p-4" style={{ borderColor: PALETTE.border, background: PALETTE.bg }}>
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em]" style={{ color: PALETTE.eyebrow }}>
          Particle Model
        </p>
        <StateSelector state={state} onChange={setState} />
      </div>

      <div className="flex flex-col gap-3 lg:flex-row">
        <div className="flex flex-col gap-2.5 lg:w-[67%]">
          <ParticleChamber ref={chamberRef} height={compact ? 340 : 420} fallbackDescription={FALLBACK_DESCRIPTION}>
            <ChamberWalls />
            <ParticleSystem state={state} running={running} showAttractions={showAttractions} />
          </ParticleChamber>
          <ControlBar
            running={running}
            onToggleRunning={() => setRunning((r) => !r)}
            showAttractions={showAttractions}
            onToggleAttractions={() => setShowAttractions((v) => !v)}
            onReset={() => chamberRef.current?.reset()}
          />
        </div>

        <div className="lg:w-[33%]">
          <PropertiesPanel state={state} />
        </div>
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame
      title="Particle Model of Solids, Liquids & Gases"
      subtitle="Switch state to see how particle arrangement, movement and properties change together."
    >
      {body}
    </InteractiveFrame>
  );
}
