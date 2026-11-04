// Simple original SVG dot patterns: a uniform scatter (homogeneous) next
// to a visibly clustered/separate pattern (heterogeneous) — 2D is clearer
// here than 3D for a quick side-by-side glance.
function UniformDots() {
  const dots = Array.from({ length: 30 }, (_, i) => [8 + (i % 6) * 15, 8 + Math.floor(i / 6) * 12]);
  return <svg viewBox="0 0 95 65" className="h-16 w-full">{dots.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3.2" fill="var(--color-indigo)" />)}</svg>;
}
function ClusteredDots() {
  const water = Array.from({ length: 16 }, (_, i) => [10 + (i % 4) * 20, 10 + Math.floor(i / 4) * 12]);
  const clump = [[70, 20], [78, 25], [72, 32], [80, 35], [75, 42], [82, 18]];
  return (
    <svg viewBox="0 0 95 65" className="h-16 w-full">
      {water.map(([x, y], i) => <circle key={`w${i}`} cx={x} cy={y} r="3" fill="var(--color-indigo)" opacity="0.6" />)}
      {clump.map(([x, y], i) => <rect key={`c${i}`} x={x - 3} y={y - 3} width="6" height="6" fill="#C9A876" />)}
    </svg>
  );
}

export default function SideBySideVisual({ panels }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {panels.map((panel, i) => (
        <div key={panel.label} className="rounded-lg border border-[var(--color-line)] p-4">
          {i === 0 ? <UniformDots /> : <ClusteredDots />}
          <p className="mt-2 text-xs font-semibold text-[var(--color-ink)]">{panel.label}</p>
          <p className="mt-0.5 text-xs text-[var(--color-ink-faint)]">{panel.description}</p>
        </div>
      ))}
    </div>
  );
}
