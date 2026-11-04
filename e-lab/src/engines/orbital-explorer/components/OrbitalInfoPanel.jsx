import { colorForOrbitalId } from "../lib/orbitalColors.js";
import { describeOrbital, splitOrbitalId } from "../lib/orbitalInfo.js";

/** Compact info panel for whichever orbital is currently selected
 * (clicked) in the legend/box diagram -- n, sublevel, orientation,
 * shape, and occupancy, all derived from the same electron-configuration
 * data already driving the rest of Build an Atom. */
export default function OrbitalInfoPanel({ orbital }) {
  if (!orbital) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--color-line)] p-3 text-[11px] text-[var(--color-ink-faint)]">
        Click an orbital in the legend or the diagram below to see its details.
      </div>
    );
  }

  const info = describeOrbital(orbital);
  if (!info) return null;
  const { suffix } = splitOrbitalId(orbital.id);
  const color = colorForOrbitalId(orbital.id);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3">
      <div className="flex items-center gap-2">
        <span className="inline-block h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}` }} />
        <p className="text-sm font-bold text-[var(--color-ink)]">
          {info.n}{info.sublevel}
          {suffix && <sub>{suffix}</sub>}
        </p>
      </div>
      <dl className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-[var(--color-ink-soft)]">
        <dt>Main energy level</dt><dd className="text-right">n = {info.n}</dd>
        <dt>Sublevel</dt><dd className="text-right">{info.sublevel}</dd>
        <dt>Orientation</dt><dd className="text-right">{info.orientation}</dd>
        <dt>Shape</dt><dd className="text-right">{info.shape}</dd>
        <dt>Maximum electrons</dt><dd className="text-right">{info.maxElectrons}</dd>
        <dt>Currently occupying</dt><dd className="text-right">{info.currentElectrons}</dd>
      </dl>
    </div>
  );
}
