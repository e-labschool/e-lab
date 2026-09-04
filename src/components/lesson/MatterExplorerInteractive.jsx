import { useState } from "react";
import ParticleBox3D from "../3d/ParticleBox3D.jsx";

const OPTIONS = {
  ice: { label: "Ice", state: "solid", speed: 0.6 },
  "liquid-water": { label: "Liquid Water", state: "liquid", speed: 1 },
  "water-vapour": { label: "Water Vapour", state: "gas", speed: 1.3 },
};

// Deliberately does NOT explain states yet — the brief is explicit that
// this interactive's purpose is curiosity, not the full explanation
// (which arrives properly in the "Solids, Liquids & Gases" section).
export default function MatterExplorerInteractive({ options }) {
  const [active, setActive] = useState(options[0]);

  return (
    <div>
      <div className="flex gap-1.5">
        {options.map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setActive(id)}
            className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
              active === id
                ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]"
            }`}
          >
            {OPTIONS[id].label}
          </button>
        ))}
      </div>
      <div className="mt-3">
        <ParticleBox3D state={OPTIONS[active].state} speedFactor={OPTIONS[active].speed} count={24} />
      </div>
    </div>
  );
}
