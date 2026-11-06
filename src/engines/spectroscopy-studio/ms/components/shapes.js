// Outline shapes used as the NON-COLOUR cue of an ion identity (the same shape appears around the particle, on the analyser token and above the spectrum peak).
export const shapePath = (shape, cx, cy, r) => {
  const poly = (n, rot = -Math.PI / 2, k = 1) => Array.from({ length: n }, (_, i) => { const a = rot + (2 * Math.PI * i) / n; return `${i ? "L" : "M"}${(cx + r * k * Math.cos(a)).toFixed(2)} ${(cy + r * k * Math.sin(a)).toFixed(2)}`; }).join(" ") + " Z";
  switch (shape) {
    case "square": { const q = r * 0.86; return `M${cx - q} ${cy - q} H${cx + q} V${cy + q} H${cx - q} Z`; }
    case "hexagon": return poly(6, 0);
    case "diamond": return poly(4, -Math.PI / 2, 1.1);
    case "triangle": return poly(3, -Math.PI / 2, 1.15);
    case "pentagon": return poly(5);
    case "cross": { const a = r * 0.36; return `M${cx - a} ${cy - r} H${cx + a} V${cy - a} H${cx + r} V${cy + a} H${cx + a} V${cy + r} H${cx - a} V${cy + a} H${cx - r} V${cy - a} H${cx - a} Z`; }
    default: return `M${cx - r} ${cy} a${r} ${r} 0 1 0 ${2 * r} 0 a${r} ${r} 0 1 0 ${-2 * r} 0 Z`;
  }
};
export const SHAPE_NAME = { circle: "circle", square: "square", hexagon: "hexagon", diamond: "diamond", triangle: "triangle", pentagon: "pentagon", cross: "cross" };
