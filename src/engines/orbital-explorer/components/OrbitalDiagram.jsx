// Renders the orbital box diagram (one box per individual orbital,
// grouped visually by sublevel) with proper up/down spin arrows.
// Clicking a box calls onSelectOrbital(orbitalId) -- the link back to
// the 3D view and the electron-by-electron builder.
const OCCUPANCY_ARROWS = { "": "", up: "\u2191", paired: "\u2191\u2193" };

function groupBySublevel(orbitals) {
  const groups = [];
  let current = null;
  for (const o of orbitals) {
    if (!current || current.sublevel !== o.sublevel) {
      current = { sublevel: o.sublevel, orbitals: [] };
      groups.push(current);
    }
    current.orbitals.push(o);
  }
  return groups;
}

export default function OrbitalDiagram({ orbitals, selectedOrbital, onSelectOrbital }) {
  const groups = groupBySublevel(orbitals);

  return (
    <div className="flex flex-wrap items-end justify-center gap-4">
      {groups.map((group) => (
        <div key={group.sublevel} className="flex flex-col items-center gap-1">
          <div className="flex gap-0.5">
            {group.orbitals.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => onSelectOrbital(o.id)}
                aria-pressed={selectedOrbital === o.id}
                aria-label={`${o.id} orbital, ${o.occupancy === "paired" ? "2 electrons, paired" : o.occupancy === "up" ? "1 electron" : "empty"}`}
                className={`flex h-9 w-9 items-center justify-center rounded border text-sm font-semibold transition-colors ${
                  selectedOrbital === o.id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-ink-soft)]"
                }`}
              >
                {OCCUPANCY_ARROWS[o.occupancy]}
              </button>
            ))}
          </div>
          <span className="text-[10px] font-medium text-[var(--color-ink-faint)]">{group.sublevel}</span>
        </div>
      ))}
    </div>
  );
}
