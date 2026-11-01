import { useMemo } from "react";
import { STATE_ACCENT } from "../../particle-model-visualizer/data/palette.js";
import { curveSegments, stateAtEnergy, totalEnergy } from "../model/phase.js";

// Temperature vs Energy Added, drawn from the same energy model (model/phase.js) that drives the cube, so the plateaus and the
// marker can never disagree with the particles. Colours reuse the phase accents of the existing Particle Model / Phase Change engines.
const W = 340; const H = 250; const PAD = { l: 44, r: 12, t: 12, b: 46 };
const PW = W - PAD.l - PAD.r; const PH = H - PAD.t - PAD.b;
const COL = { solid: STATE_ACCENT.solid, melting: "#E0A64C", liquid: STATE_ACCENT.liquid, boiling: "#E0A64C", gas: STATE_ACCENT.gas };

export default function HeatingGraph({ sub, E, label }) {
  const segs = useMemo(() => curveSegments(sub), [sub]);
  const total = totalEnergy(sub); const Tmin = segs[0].T0; const Tmax = segs[4].T1; const lo = Tmin - (Tmax - Tmin) * 0.04; const hi = Tmax + (Tmax - Tmin) * 0.04;
  const x = (e) => PAD.l + (e / total) * PW; const y = (t) => PAD.t + (1 - (t - lo) / (hi - lo)) * PH;
  const st = stateAtEnergy(sub, E);
  const full = segs.map((g) => `${x(g.E0).toFixed(1)},${y(g.T0).toFixed(1)} ${x(g.E1).toFixed(1)},${y(g.T1).toFixed(1)}`);
  const upTo = (g) => { if (E <= g.E0) return null; const e1 = Math.min(E, g.E1); const f = g.E1 > g.E0 ? (e1 - g.E0) / (g.E1 - g.E0) : 0; return `${x(g.E0)},${y(g.T0)} ${x(e1)},${y(g.T0 + (g.T1 - g.T0) * f)}`; };
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * total);
  const tTicks = [Tmin, sub.Tm, sub.Tb, Tmax];
  const fmt = (v) => (v >= 100 ? Math.round(v) : v.toFixed(1));
  return (
    <figure className="imf-graph" data-testid="heating-graph" data-energy={E.toFixed(3)} data-temp={st.T.toFixed(2)} data-phase={st.phase}>
      <figcaption className="imf-graph-title">Temperature vs Energy Added – {label}</figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Heating curve of ${label}: temperature against energy added, with melting plateau at ${sub.Tm} kelvin and boiling plateau at ${sub.Tb} kelvin. Currently ${Math.round(st.T)} kelvin, ${st.phase}.`}>
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + PH} className="imf-ax" /><line x1={PAD.l} y1={PAD.t + PH} x2={PAD.l + PW} y2={PAD.t + PH} className="imf-ax" />
        {[sub.Tm, sub.Tb].map((t) => (<g key={t}><line x1={PAD.l} y1={y(t)} x2={PAD.l + PW} y2={y(t)} className="imf-ref" /></g>))}
        {tTicks.map((t, i) => <text key={i} x={PAD.l - 5} y={y(t) + 3} textAnchor="end" className="imf-tick">{fmt(t)}</text>)}
        {ticks.map((e, i) => <text key={i} x={x(e)} y={PAD.t + PH + 13} textAnchor="middle" className="imf-tick">{e < 10 ? e.toFixed(1) : Math.round(e)}</text>)}
        <polyline points={full.join(" ")} className="imf-curve-ghost" fill="none" />
        {segs.map((g, i) => { const pts = upTo(g); return pts ? <polyline key={i} points={pts} fill="none" stroke={COL[g.phase]} strokeWidth="3" strokeLinecap="round" /> : null; })}
        <text x={x((segs[1].E0 + segs[1].E1) / 2)} y={y(sub.Tm) - 5} textAnchor="middle" className="imf-plateau">melting</text>
        <text x={x((segs[3].E0 + segs[3].E1) / 2)} y={y(sub.Tb) - 5} textAnchor="middle" className="imf-plateau">boiling</text>
        <text x={x(segs[0].E1 * 0.5)} y={PAD.t + PH - 6} textAnchor="middle" className="imf-region">solid</text>
        <text x={x((segs[2].E0 + segs[2].E1) / 2)} y={PAD.t + PH - 6} textAnchor="middle" className="imf-region">liquid</text>
        <text x={x((segs[4].E0 + segs[4].E1) / 2)} y={PAD.t + PH - 6} textAnchor="middle" className="imf-region">gas</text>
        <circle cx={x(E)} cy={y(st.T)} r="5.5" fill={COL[st.phase]} stroke="#fff" strokeWidth="2" data-testid="graph-marker" />
        <text x={PAD.l + PW / 2} y={H - 6} textAnchor="middle" className="imf-axlabel">Energy added (kJ per mol, simplified)</text>
        <text transform={`translate(11 ${PAD.t + PH / 2}) rotate(-90)`} textAnchor="middle" className="imf-axlabel">Temperature (K)</text>
      </svg>
      <p className="imf-graph-note">Constant pressure (1 atm), no heat loss. The temperature stays at {sub.Tm} K while the solid melts and at {sub.Tb} K while the liquid boils: the added energy goes into the arrangement of the particles, not into temperature. The x axis is energy, not time.</p>
    </figure>
  );
}
