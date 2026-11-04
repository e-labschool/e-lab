import { Molecule } from "./Molecule.jsx";

// A DIRECT continuous mirror of whatever's currently under the
// magnifier lens -- re-centered and enlarged, updated every animation
// frame from the vessel's own live particle state. Deliberately NOT the
// phase-based scripted replay MagnifiedView.jsx uses for the curated
// teaching demonstrations: there is nothing to "reset" here because
// it's simply redrawing real live positions each frame, so moving the
// lens (even quickly) never causes a flash or restart.
const SCALE = 6; // lens radius (32 vessel units) -> comfortably fills the panel
const W = 560, H = 200;

export default function MagnifierLiveView({ particles, center }) {
  if (!center) {
    return (
      <div className="flex h-full min-h-[180px] items-center justify-center rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
        <p className="text-center text-sm text-[var(--color-ink-faint)]">Move the magnifier over the beaker to inspect molecules.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col rounded-lg border border-[var(--color-line)] bg-[var(--color-paper)] p-3">
      <p className="mb-1 text-center text-xs font-medium text-[var(--color-ink-soft)]">{"Magnifier \u2014 live view"}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full flex-1">
        {particles.map((p) => (
          <Molecule
            key={p.id}
            species={p.kind}
            x={W / 2 + (p.x - center.x) * SCALE}
            y={H / 2 + (p.y - center.y) * SCALE}
            rotation={p.rotation}
            size={1.6}
            label={false}
          />
        ))}
        {particles.length === 0 && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize="12" fill="var(--color-ink-faint)">
            No molecules nearby
          </text>
        )}
      </svg>
    </div>
  );
}
