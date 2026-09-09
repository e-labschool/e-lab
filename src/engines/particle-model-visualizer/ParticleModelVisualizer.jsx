import { useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import ParticleChamber from "./components/ParticleChamber.jsx";
import ChamberWalls from "./components/ChamberWalls.jsx";
import ParticleSystem from "./components/ParticleSystem.jsx";
import ControlPanel from "./components/ControlPanel.jsx";
import InfoPanel from "./components/InfoPanel.jsx";

const FALLBACK_DESCRIPTION =
  "A 3D chamber compares how particles are arranged and how they move in solids, liquids and gases.";

// The mode-agnostic orchestrator, reachable from /interactives directly and
// embeddable inside a lesson via the "e-Lab Simulation" content block —
// same pattern as every other e-Lab engine (see VSEPRExplorer3D.jsx).
//
// The chamber and its particle system mount once and stay mounted for the
// whole session (no per-state remount): switching SOLID/LIQUID/GAS just
// changes the target the particle physics blends toward, which is what
// makes the state change read as a smooth transition rather than three
// unrelated scenes being swapped.
export default function ParticleModelVisualizer({ compact = false }) {
  const [state, setState] = useState("solid");
  const [running, setRunning] = useState(true);
  const [showAttractions, setShowAttractions] = useState(false);

  const body = (
    <div className="flex flex-col gap-3">
      <ParticleChamber height={compact ? 360 : 420} fallbackDescription={FALLBACK_DESCRIPTION}>
        <ChamberWalls />
        <ParticleSystem state={state} running={running} showAttractions={showAttractions} />
      </ParticleChamber>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="sm:flex-1">
          <ControlPanel
            state={state}
            onChangeState={setState}
            running={running}
            onToggleRunning={() => setRunning((r) => !r)}
            showAttractions={showAttractions}
            onToggleAttractions={() => setShowAttractions((v) => !v)}
          />
        </div>
        <div className="sm:w-64">
          <InfoPanel state={state} />
        </div>
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame
      title="Particle Model of Solids, Liquids & Gases"
      subtitle="Rotate the 3D chamber and switch state to see how particle arrangement, movement and attraction differ."
    >
      {body}
    </InteractiveFrame>
  );
}
