import { useState } from "react";
import RevealSequencer from "./RevealSequencer.jsx";
import TeacherControls from "./TeacherControls.jsx";
import OrbitalBoxDiagram from "../components/OrbitalBoxDiagram.jsx";
import ShellDiagram from "../components/ShellDiagram.jsx";

function getValenceKeys(config) {
  const maxN = Math.max(...config.subshellsDisplayOrder.map((s) => s.n));
  const block = config.element.block;
  const matches = (s) => {
    if (block === "s" || block === "p") return s.n === maxN;
    if (block === "d") return (s.n === maxN && s.l === 0) || (s.n === maxN - 1 && s.l === 2);
    return (s.n === maxN && s.l === 0) || (s.n === maxN - 1 && s.l === 2) || (s.n === maxN - 2 && s.l === 3);
  };
  return new Set(config.subshellsDisplayOrder.filter(matches).map((s) => `${s.n}-${s.l}`));
}

// The parent orchestrator remounts this component (via `key={atomicNumber}`)
// on every new element selection, so revealIndex/display simply initialize
// fresh per-mount — no reset effect needed.
export default function TeacherFlow({ config }) {
  const total = config.subshellsFillingOrder.length;
  const [revealIndex, setRevealIndex] = useState(total);
  const [display, setDisplay] = useState({
    showConfigText: true,
    showOrbitalBoxes: true,
    showShellDiagram: true,
    showLabels: true,
    highlightValence: false,
  });

  const visibleKeys = new Set(config.subshellsFillingOrder.slice(0, revealIndex).map((s) => `${s.n}-${s.l}`));
  const valenceKeys = getValenceKeys(config);
  const revealedShellCount = (() => {
    // How many principal shells have at least one revealed subshell — feeds ShellDiagram's ring count.
    const revealedNs = new Set(config.subshellsFillingOrder.slice(0, revealIndex).map((s) => s.n));
    return revealedNs.size === 0 ? 0 : Math.max(...revealedNs);
  })();

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_240px]">
      <div className="flex flex-col gap-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <RevealSequencer
            revealIndex={revealIndex}
            total={total}
            onStepForward={() => setRevealIndex((i) => Math.min(i + 1, total))}
            onStepBackward={() => setRevealIndex((i) => Math.max(i - 1, 0))}
            onReset={() => setRevealIndex(0)}
          />
          {display.showConfigText && (
            <p className="font-[var(--font-mono)] text-sm text-[var(--color-ink)]">
              {config.subshellsFillingOrder
                .slice(0, revealIndex)
                .map((s) => `${s.n}${["s", "p", "d", "f"][s.l]}${s.electrons}`)
                .join(" ") || "\u2014"}
            </p>
          )}
        </div>

        <div className="grid gap-10 sm:grid-cols-2">
          {display.showOrbitalBoxes && (
            <div>
              <OrbitalBoxDiagram
                orbitals={config.orbitals}
                visibleKeys={visibleKeys}
                showLabels={display.showLabels}
                valenceKeys={valenceKeys}
                highlightValence={display.highlightValence}
              />
            </div>
          )}
          {display.showShellDiagram && (
            <div>
              <ShellDiagram
                shells={config.shells}
                protonCount={config.element.atomicNumber}
                revealCount={revealedShellCount}
              />
            </div>
          )}
        </div>

        {display.highlightValence && (
          <p className="text-xs text-[var(--color-amber)]">{config.valence.note}</p>
        )}
      </div>

      <TeacherControls display={display} onChangeDisplay={setDisplay} />
    </div>
  );
}
