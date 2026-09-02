import { useMemo, useState } from "react";
import { useMode } from "../../context/ModeContext.jsx";
import { buildConfiguration } from "./logic/buildConfiguration.js";
import PeriodicTableSelector from "./components/PeriodicTableSelector.jsx";
import StudentFlow from "./student/StudentFlow.jsx";
import TeacherFlow from "./teacher/TeacherFlow.jsx";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";

const DEFAULT_ATOMIC_NUMBER = 11; // Sodium — recognizable, single valence electron, simple s/p filling.

// The mode-agnostic orchestrator. This is the ONLY file that owns the actual
// chemistry state (which element is selected). It never imports curriculum
// data — it's reachable from /topics/electron-configuration, from a DP
// Chemistry subtopic via the resolver, and from /interactives directly,
// and behaves identically regardless of which door was used to get here.
export default function ElectronConfigurationExplorer({ compact = false }) {
  const { mode } = useMode();
  const [atomicNumber, setAtomicNumber] = useState(DEFAULT_ATOMIC_NUMBER);

  const config = useMemo(() => buildConfiguration(atomicNumber), [atomicNumber]);

  const body = (
    <div className="flex flex-col gap-8">
      <PeriodicTableSelector selectedAtomicNumber={atomicNumber} onSelect={setAtomicNumber} compact={compact} />

      <div className="border-t border-[var(--color-line)] pt-8">
        <div className="mb-6 flex items-baseline gap-3">
          <h3 className="font-[var(--font-display)] text-2xl font-semibold text-[var(--color-ink)]">
            {config.element.name}
          </h3>
          <span className="font-[var(--font-mono)] text-sm text-[var(--color-ink-faint)]">
            {config.element.symbol} &middot; Z = {config.element.atomicNumber} &middot; {config.element.block}-block
            {config.isException && " \u00b7 exception to Aufbau"}
          </span>
        </div>

        {mode === "student" ? (
          <StudentFlow key={atomicNumber} config={config} />
        ) : (
          <TeacherFlow key={atomicNumber} config={config} />
        )}
      </div>
    </div>
  );

  if (compact) return body;

  return (
    <InteractiveFrame
      title="Electron Configuration Explorer"
      subtitle="Ground-state configurations for all 118 elements"
    >
      {body}
    </InteractiveFrame>
  );
}
