import { useState, useMemo } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { MIXTURES, getMixture } from "./data/mixtures.js";
import { METHODS } from "./data/methods.js";
import { simulationRegistry } from "./components/simulations/simulationRegistry.js";
import MixtureSelector from "./components/MixtureSelector.jsx";
import MethodSelector from "./components/MethodSelector.jsx";
import InfoPanel from "./components/InfoPanel.jsx";
import SimulationStage from "./components/SimulationStage.jsx";

function firstAvailableMethodId(mixture) {
  return mixture.methods.find((m) => simulationRegistry[m.methodId])?.methodId ?? null;
}

export default function MixtureSeparationExplorer({ compact = false }) {
  const [mixtureId, setMixtureId] = useState(MIXTURES[0].id);
  const mixture = useMemo(() => getMixture(mixtureId), [mixtureId]);
  const [methodId, setMethodId] = useState(() => firstAvailableMethodId(mixture));

  function handleSelectMixture(nextId) {
    setMixtureId(nextId);
    setMethodId(firstAvailableMethodId(getMixture(nextId)));
  }

  const SimulationComponent = methodId ? simulationRegistry[methodId] : null;
  const methodMeta = methodId ? METHODS[methodId] : null;

  return (
    <InteractiveFrame title="Mixture Separation Explorer" compact={compact}>
      <div className="mx-auto w-full" style={{ maxWidth: 1100 }}>
        <p className="text-center text-sm text-[var(--color-ink-soft)]">
          Choose a mixture and a separation method, then watch the apparatus demonstrate the separation.
        </p>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row">
          <aside className="lg:w-[20%]">
            <MixtureSelector mixtures={MIXTURES} selectedId={mixtureId} onSelect={handleSelectMixture} />
          </aside>

          <div className="lg:w-[55%]">
            <MethodSelector mixture={mixture} methodsMeta={METHODS} registry={simulationRegistry} selectedMethodId={methodId} onSelect={setMethodId} />
            <div className="mt-3">
              {SimulationComponent ? (
                <SimulationStage key={`${mixtureId}-${methodId}`} SimulationComponent={SimulationComponent} />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-[var(--color-line)] text-sm text-[var(--color-ink-faint)]">
                  No simulation available yet for this mixture.
                </div>
              )}
            </div>
          </div>

          <aside className="lg:w-[25%]">
            <div className="rounded-lg border border-[var(--color-line)] p-3">
              <InfoPanel method={methodMeta} />
            </div>
          </aside>
        </div>
      </div>
    </InteractiveFrame>
  );
}
