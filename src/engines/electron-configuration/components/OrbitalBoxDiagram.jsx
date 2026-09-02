// Orbital-box notation: one box per orbital, arrows for electron spin.
// Hund's rule is already applied upstream in buildConfiguration.js — this
// component only renders whatever orbital/spin data it's given.

function OrbitalBox({ spins, highlight }) {
  return (
    <div
      className={`flex h-8 w-8 items-center justify-center gap-[1px] rounded-sm border text-xs ${
        highlight ? "border-[var(--color-amber)] bg-[var(--color-amber-soft)]" : "border-[var(--color-line)]"
      }`}
    >
      {spins.includes("up") && <span className="leading-none text-[var(--color-ink)]">&uarr;</span>}
      {spins.includes("down") && <span className="leading-none text-[var(--color-ink)]">&darr;</span>}
    </div>
  );
}

export default function OrbitalBoxDiagram({ orbitals, visibleKeys, showLabels = true, valenceKeys, highlightValence }) {
  const rows = visibleKeys ? orbitals.filter((s) => visibleKeys.has(`${s.n}-${s.l}`)) : orbitals;

  return (
    <div className="flex flex-col gap-3">
      {rows.map((subshell) => {
        const key = `${subshell.n}-${subshell.l}`;
        const isValence = highlightValence && valenceKeys?.has(key);
        return (
          <div key={key} className="flex items-center gap-3">
            {showLabels && (
              <span className="w-9 shrink-0 font-[var(--font-mono)] text-sm text-[var(--color-ink-soft)]">
                {subshell.label}
              </span>
            )}
            <div className="flex gap-1">
              {subshell.orbitals.map((orbital, i) => (
                <OrbitalBox key={i} spins={orbital.spins} highlight={isValence} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
