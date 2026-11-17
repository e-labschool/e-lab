import { colorForOrbitalId } from "../lib/orbitalColors.js";
import { splitOrbitalId } from "../lib/orbitalInfo.js";


/** "2p" + suffix "x" -> 2p<sub>x</sub>; "1s" -> 1s (no suffix). Occupancy
 * count is THIS individual orbital's own electron count (0/1/2), not
 * the whole sublevel's -- so carbon's three 2p rows read 2p_x^1, 2p_y^1,
 * 2p_z (empty), never implying an unoccupied orientation has an
 * electron. */
function OrbitalLabel({ id, occupancy }) {
  const { n, letter, suffix } = splitOrbitalId(id);
  return (
    <span>
      {n}{letter}
      {suffix && <sub>{suffix}</sub>}{" "}
      <span className="text-[0.85em] opacity-80" title={`${occupancy === "paired" ? 2 : occupancy === "up" ? 1 : 0} electron${occupancy === "paired" ? "s" : ""} in this orbital`}>({occupancy === "paired" ? 2 : occupancy === "up" ? 1 : 0} e⁻)</span>
    </span>
  );
}

/** Compact legend + visibility control list for Build an Atom. One row
 * per individual occupied orbital (so carbon shows separate 2p_x/2p_y/
 * 2p_z rows, per the brief) with a color swatch matching the 3D view,
 * a visibility checkbox, and a click target that selects the orbital
 * for the info panel. */
export default function AtomLegend({ orbitals, visibleIds, highlightedId, onToggleVisible, onSelect, onShowAll, onHideAll, onOnlyShell }) {
  // OE-02: shell-by-shell view. "Only n = k" isolates one shell; pressed when exactly that shell is visible.
  const shells = [...new Set(orbitals.map((o) => Number(o.id[0])))].sort((x, y) => x - y);
  const onlyShell = (n) => { const ids = orbitals.filter((o) => Number(o.id[0]) === n).map((o) => o.id); return ids.length === visibleIds.size && ids.every((id) => visibleIds.has(id)); };
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Visible Orbitals</p>
        <div className="flex gap-1">
          <button type="button" onClick={onShowAll} className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            Show All
          </button>
          <button type="button" onClick={onHideAll} className="rounded border border-[var(--color-line)] px-1.5 py-0.5 text-[10px] font-semibold text-[var(--color-ink-soft)] hover:bg-[var(--color-line)]/30">
            Hide All
          </button>
        </div>
      </div>

      {onOnlyShell && shells.length > 1 && (
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Show one shell at a time">
          <span className="text-[11px] text-[var(--color-ink-soft)]">Only shell:</span>
          {shells.map((n) => (
            <button key={n} type="button" aria-pressed={onlyShell(n)} onClick={() => onOnlyShell(n)} data-testid={`only-shell-${n}`} className={`rounded border px-2 py-0.5 text-[11px] font-semibold ${onlyShell(n) ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)] text-[var(--color-indigo)]" : "border-[var(--color-line)] text-[var(--color-ink-soft)]"}`}>n = {n}</button>
          ))}
        </div>
      )}

      <ul className="flex flex-col gap-1">
        {orbitals.map((o) => {
          const color = colorForOrbitalId(o.id);
          const selected = highlightedId === o.id;
          return (
            <li
              key={o.id}
              className={`flex items-center gap-2 rounded-md border px-2 py-1 text-[11.5px] ${selected ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)]"}`}
            >
              <input
                type="checkbox"
                checked={visibleIds.has(o.id)}
                onChange={() => onToggleVisible(o.id)}
                aria-label={`Show ${o.id} orbital`}
              />
              <button type="button" onClick={() => onSelect(o.id)} className="flex flex-1 items-center gap-2 text-left">
                <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}` }} />
                <span className="font-semibold text-[var(--color-ink)]">
                  <OrbitalLabel id={o.id} occupancy={o.occupancy} />
                </span>
                {o.occupancy !== "paired" && o.occupancy !== "up" && <span className="text-[11px] text-[var(--color-ink-soft)]">empty</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
