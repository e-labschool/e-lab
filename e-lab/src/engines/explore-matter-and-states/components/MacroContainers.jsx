// Three differently-shaped "containers" used to demonstrate macroscopic
// shape/volume behaviour. Pure CSS shapes — no illustration library needed.

const SHAPES = [
  { id: "round", className: "h-20 w-20 rounded-full" },
  { id: "tall", className: "h-24 w-12 rounded-md" },
  { id: "wide", className: "h-14 w-28 rounded-md" },
];

function Fill({ state, color }) {
  if (state === "solid") {
    return <div className="h-9 w-9 rounded-sm" style={{ backgroundColor: color }} />;
  }
  if (state === "liquid") {
    return <div className="absolute inset-x-0 bottom-0 h-1/2 rounded-b-[inherit]" style={{ backgroundColor: color, opacity: 0.65 }} />;
  }
  return <div className="absolute inset-0 rounded-[inherit]" style={{ backgroundColor: color, opacity: 0.22 }} />;
}

export default function MacroContainers({ state, color }) {
  return (
    <div className="flex flex-wrap items-end gap-6">
      {SHAPES.map((shape) => (
        <div key={shape.id} className={`relative flex items-center justify-center overflow-hidden border border-[var(--color-line)] ${shape.className}`}>
          <Fill state={state} color={color} />
        </div>
      ))}
    </div>
  );
}
