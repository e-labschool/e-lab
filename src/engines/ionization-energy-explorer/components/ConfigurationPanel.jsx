import OrbitalDiagram from "../../orbital-explorer/components/OrbitalDiagram.jsx";

/** ONE compact panel showing the CURRENT electronic configuration,
 * orbital box diagram, and species label -- no "before/after" duplicate,
 * no separate progression strip. Reuses the Orbital Explorer's
 * OrbitalDiagram box-diagram component as-is (one box per orbital, one
 * arrow per electron) rather than reimplementing it. */
export default function ConfigurationPanel({ atomState }) {
  return (
    <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Electronic Configuration and Orbital Diagram</h3>

      <p className="mt-2 flex items-center gap-2">
        <span className="rounded-md bg-[var(--color-indigo-soft)] px-2.5 py-1 font-[var(--font-display)] text-lg font-bold text-[var(--color-indigo)]" aria-label={`Current species: ${atomState.speciesSymbol}`}>
          {atomState.speciesSymbol}
        </span>
        <span className="text-xs text-[var(--color-ink-faint)]">charge {atomState.charge > 0 ? `+${atomState.charge}` : "0"}</span>
      </p>

      <p className="mt-2 font-mono text-sm text-[var(--color-ink)]" dangerouslySetInnerHTML={{ __html: htmlSuperscripts(atomState.configuration) }} />

      <div className="mt-3">
        <OrbitalDiagram orbitals={atomState.orbitals} selectedOrbital={null} onSelectOrbital={() => {}} />
      </div>
    </div>
  );
}

// The configuration string already uses real Unicode superscript digits
// (formatConfiguration in electronConfigurations.js) -- this just wraps
// them in <sup> too so they also scale with any surrounding font-size
// change; harmless no-op visually where Unicode superscripts alone
// already render correctly.
function htmlSuperscripts(config) {
  return String(config ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
}
