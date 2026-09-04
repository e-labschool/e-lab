const COLOR_A = "#6C86EE", COLOR_B = "#E2872F";

// Simple, original SVG dot diagrams — 2D is clearer here than 3D for a
// quick side-by-side comparison, per the brief's own guidance not to
// force 3D everywhere.
function ElementDiagram() {
  const dots = [[20, 20], [45, 15], [70, 25], [30, 45], [55, 50], [75, 45]];
  return <svg viewBox="0 0 95 65" className="h-16 w-full">{dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="7" fill={COLOR_A} />)}</svg>;
}
function CompoundDiagram() {
  const pairs = [[20, 20, 34, 20], [50, 18, 64, 18], [30, 45, 44, 45]];
  return (
    <svg viewBox="0 0 95 65" className="h-16 w-full">
      {pairs.map(([x1, y1, x2, y2], i) => <line key={`l${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#8A909C" strokeWidth="2" />)}
      {pairs.map(([x1, y1], i) => <circle key={`a${i}`} cx={x1} cy={y1} r="7" fill={COLOR_A} />)}
      {pairs.map(([, , x2, y2], i) => <circle key={`b${i}`} cx={x2} cy={y2} r="7" fill={COLOR_B} />)}
    </svg>
  );
}
function MixtureDiagram() {
  const a = [[20, 20], [60, 40], [75, 15]];
  const b = [[40, 45], [25, 50], [70, 50]];
  return (
    <svg viewBox="0 0 95 65" className="h-16 w-full">
      {a.map(([x, y], i) => <circle key={`a${i}`} cx={x} cy={y} r="7" fill={COLOR_A} />)}
      {b.map(([x, y], i) => <circle key={`b${i}`} cx={x} cy={y} r="7" fill={COLOR_B} />)}
    </svg>
  );
}
const DIAGRAMS = { ELEMENT: ElementDiagram, COMPOUND: CompoundDiagram, MIXTURE: MixtureDiagram };

export default function ThreeWayParticlesVisual({ panels }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {panels.map((panel) => {
        const Diagram = DIAGRAMS[panel.label] ?? ElementDiagram;
        return (
          <div key={panel.label} className="rounded-lg border border-[var(--color-line)] p-4">
            <Diagram />
            <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">{panel.label}</p>
            <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{panel.description}</p>
          </div>
        );
      })}
    </div>
  );
}
