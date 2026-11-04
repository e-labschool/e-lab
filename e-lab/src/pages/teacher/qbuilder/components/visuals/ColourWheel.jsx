// A standard artist's colour wheel with complementary pairs opposite each
// other — used for "a complex absorbs X, what colour is observed"
// questions, since observed colour = complement of absorbed colour.
const WHEEL = [
  { name: "Red", hue: 0 }, { name: "Orange", hue: 30 }, { name: "Yellow", hue: 60 },
  { name: "Green", hue: 120 }, { name: "Blue", hue: 210 }, { name: "Violet", hue: 270 },
];

export default function ColourWheel({ absorbed, observed }) {
  const R = 55, CX = 65, CY = 65;
  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 130 130" className="h-32 w-32" role="img" aria-label="Colour wheel">
        {WHEEL.map((c, i) => {
          const a0 = (i / WHEEL.length) * 2 * Math.PI - Math.PI / 2;
          const a1 = ((i + 1) / WHEEL.length) * 2 * Math.PI - Math.PI / 2;
          const x0 = CX + R * Math.cos(a0), y0 = CY + R * Math.sin(a0);
          const x1 = CX + R * Math.cos(a1), y1 = CY + R * Math.sin(a1);
          return <path key={c.name} d={`M${CX},${CY} L${x0},${y0} A${R},${R} 0 0,1 ${x1},${y1} Z`} fill={`hsl(${c.hue}, 65%, 55%)`} stroke="var(--color-paper)" strokeWidth="1" />;
        })}
      </svg>
      <div className="flex gap-4 text-xs text-[var(--color-ink-soft)]">
        {absorbed && <span><span className="font-medium text-[var(--color-ink)]">Absorbed:</span> {absorbed}</span>}
        {observed && <span><span className="font-medium text-[var(--color-ink)]">Observed:</span> {observed}</span>}
      </div>
    </div>
  );
}
