import { Eye, EyeOff } from "lucide-react";

function ToggleRow({ label, value, onChange }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="flex w-full items-center justify-between gap-3 rounded-md px-2.5 py-2 text-sm text-[var(--color-ink-soft)] transition-colors hover:bg-[var(--color-indigo-soft)] hover:text-[var(--color-ink)]"
    >
      <span>{label}</span>
      {value ? <Eye size={15} /> : <EyeOff size={15} className="text-[var(--color-ink-faint)]" />}
    </button>
  );
}

// Generic-feeling but interactive-specific: these particular toggles (config
// text, orbital boxes, shell diagram, labels, valence highlight) are what
// make sense for THIS engine. A future engine's TeacherControls would offer
// a different set, still inside its own teacher/ folder.
export default function TeacherControls({ display, onChangeDisplay }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-[var(--color-line)] p-2">
      <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
        Show / hide
      </p>
      <ToggleRow
        label="Configuration text"
        value={display.showConfigText}
        onChange={(v) => onChangeDisplay({ ...display, showConfigText: v })}
      />
      <ToggleRow
        label="Orbital boxes"
        value={display.showOrbitalBoxes}
        onChange={(v) => onChangeDisplay({ ...display, showOrbitalBoxes: v })}
      />
      <ToggleRow
        label="Shell diagram"
        value={display.showShellDiagram}
        onChange={(v) => onChangeDisplay({ ...display, showShellDiagram: v })}
      />
      <ToggleRow
        label="Subshell labels"
        value={display.showLabels}
        onChange={(v) => onChangeDisplay({ ...display, showLabels: v })}
      />
      <ToggleRow
        label="Highlight valence electrons"
        value={display.highlightValence}
        onChange={(v) => onChangeDisplay({ ...display, highlightValence: v })}
      />
    </div>
  );
}
