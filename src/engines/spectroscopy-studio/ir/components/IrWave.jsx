/**
 * The incoming infrared wave (stage 3): the electric field of a travelling wave approaching the molecule from the left and leaving it on the right, weaker by
 * the fraction the molecule absorbs. The molecule itself is drawn by the 3D scene laid over the middle of this SVG. The number of cycles across the picture
 * grows with the wavenumber (wavelength = 1 / wavenumber): that is the only thing the slider changes about the wave.
 */
export default function IrWave({ nu, absorbed = 0, phase = 0, width = 600, height = 200, state = "off" }) {
  const W = Math.max(200, width); const H = Math.max(110, height); const cy = H * 0.5; const A = Math.min(H * 0.3, 46);
  const cycles = Math.max(1.2, Math.min(11, nu / 380)); const lambda = W / cycles;
  const mid0 = W * 0.38; const mid1 = W * 0.62; const ramp = W * 0.05;
  const speed = 130; // px per second
  const pts = (xa, xb, a0) => { const out = []; for (let x = xa; x <= xb; x += 3) out.push(`${out.length ? "L" : "M"}${x.toFixed(0)},${(cy - A * a0(x) * Math.sin((2 * Math.PI * (x - speed * phase)) / lambda)).toFixed(1)}`); return out.join(""); };
  const inc = pts(8, mid0 - ramp, () => 1); const out = pts(mid1 + ramp, W - 8, () => 1 - 0.92 * absorbed);
  const tCol = state === "absorbed" ? "#86efac" : state === "near" ? "#ffd37a" : "#fb923c";
  return (
    <svg className="ir-wave" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Infrared radiation: an electric field wave travelling from the left to the molecule and leaving on the right" data-testid="ir-wave" data-cycles={cycles.toFixed(2)} data-absorbed={absorbed.toFixed(3)}>
      <line x1="8" x2={W - 8} y1={cy} y2={cy} stroke="#2b4780" strokeDasharray="3 5" />
      <path d={inc} fill="none" stroke="#fb923c" strokeWidth="3" strokeLinejoin="round" data-testid="ir-wave-in" />
      <path d={out} fill="none" stroke={tCol} strokeWidth="3" strokeLinejoin="round" opacity={0.55 + 0.45 * (1 - absorbed)} data-testid="ir-wave-out" />
      <path d={`M${W * 0.25 - 14},${H - 12} h28 m-8,-6 l8,6 l-8,6`} fill="none" stroke="#fb923c" strokeWidth="2.2" />
      <text x={W * 0.25 + 22} y={H - 8} className="ss-svgtext ss-svgtext--sm">travelling IR wave</text>
      <text x="10" y="16" className="ss-svgtext ss-svgtext--b">Infrared radiation {Math.round(nu)} cm⁻¹</text>
      <text x={W - 10} y="16" textAnchor="end" className="ss-svgtext ss-svgtext--sm" data-testid="wave-out-label">{absorbed > 0.5 ? "weaker after the molecule (absorbed)" : "leaves almost unchanged"}</text>
    </svg>
  );
}
