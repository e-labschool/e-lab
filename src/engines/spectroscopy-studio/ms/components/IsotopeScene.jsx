const P_COL = "#f87171"; const N_COL = "#cbd5e1";
export const COL35 = "#2dd4bf"; export const COL37 = "#a78bfa";

function Nucleus({ cx, cy, R, protons, neutrons, label, sub }) {
  const n = protons + neutrons; const c = R / Math.sqrt(n + 1) * 0.98; const r = c * 0.62;
  const dots = Array.from({ length: n }, (_, i) => { const rad = c * Math.sqrt(i + 0.5); const a = i * 2.39996323; return { x: cx + rad * Math.cos(a), y: cy + rad * Math.sin(a), proton: (i * 7) % n < protons }; });
  // spread protons evenly among the dots: a dot is a proton when floor((i+1)*p/n) > floor(i*p/n)
  const isP = (i) => Math.floor(((i + 1) * protons) / n) > Math.floor((i * protons) / n);
  return (
    <g data-testid={`nucleus-${label}`}>
      <circle cx={cx} cy={cy} r={R + 4} fill="rgba(56,189,248,0.07)" stroke="#31446f" />
      {dots.map((d, i) => <circle key={i} cx={d.x} cy={d.y} r={r} fill={isP(i) ? P_COL : N_COL} stroke="#0a1330" strokeWidth="0.8" />)}
      <text x={cx} y={cy + R + 22} textAnchor="middle" className="ms-scenelabel" fontWeight="800">{label}</text>
      <text x={cx} y={cy + R + 38} textAnchor="middle" className="ms-scenelabel is-sm">{sub}</text>
    </g>
  );
}

/** Stage 10 (left): the two nucleus models and a 10 x 10 sample of 100 atoms with the chosen share of 35Cl. */
export default function IsotopeScene({ w, h, p35 }) {
  const pad = 10; const nR = Math.max(24, Math.min(60, h * 0.15, w * 0.15));
  const cy1 = pad + nR + 6;
  const gridTop = cy1 + nR + 76; const gridH = Math.max(60, h - gridTop - 26); const cell = Math.min(gridH / 10, (w - 2 * pad) / 10, 30);
  const gx = (w - cell * 10) / 2; const n35 = Math.round(p35);
  const atoms = Array.from({ length: 100 }, (_, i) => ({ i, is35: i < n35, x: gx + (i % 10) * cell + cell / 2, y: gridTop + Math.floor(i / 10) * cell + cell / 2 }));
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ms-isoscene" role="img" data-testid="isotope-svg" data-p35={p35}
      aria-label={`Two chlorine isotope models and a sample of 100 chlorine atoms, ${n35} of them chlorine-35`}>
      <Nucleus cx={w * 0.27} cy={cy1} R={nR} protons={17} neutrons={18} label="Chlorine-35" sub="17 protons + 18 neutrons" />
      <Nucleus cx={w * 0.73} cy={cy1} R={nR} protons={17} neutrons={20} label="Chlorine-37" sub="17 protons + 20 neutrons" />
      <g aria-hidden="true"><circle cx={w * 0.5 - 38} cy={cy1 - nR + 6} r="5" fill={P_COL} /><text x={w * 0.5 - 30} y={cy1 - nR + 10} className="ms-scenelabel is-sm">proton</text><circle cx={w * 0.5 - 38} cy={cy1 - nR + 22} r="5" fill={N_COL} /><text x={w * 0.5 - 30} y={cy1 - nR + 26} className="ms-scenelabel is-sm">neutron</text></g>
      <text x={w / 2} y={gridTop - 8} textAnchor="middle" className="ms-scenelabel">A sample of 100 chlorine atoms</text>
      {atoms.map((a) => <circle key={a.i} cx={a.x} cy={a.y} r={cell * 0.38} fill={a.is35 ? COL35 : COL37} stroke="#0a1330" strokeWidth="0.8" data-iso={a.is35 ? "35" : "37"} />)}
      <g transform={`translate(${gx} ${h - 12})`} className="ms-scenelabel is-sm"><circle cx="5" cy="-4" r="5" fill={COL35} /><text x="14" y="0">³⁵Cl: {n35}</text><circle cx={cell * 5 + 5} cy="-4" r="5" fill={COL37} /><text x={cell * 5 + 14} y="0">³⁷Cl: {100 - n35}</text></g>
    </svg>
  );
}
