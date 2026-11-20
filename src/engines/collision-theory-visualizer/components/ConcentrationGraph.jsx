import { useMemo, useRef } from "react";
import { productCurve, countCurves, niceStep, niceTicks } from "../lib/rateMetrics.js";
import { useBox } from "../useBox.js";
import { TEXT, MUTED, SPECIES } from "../theme.js";

const MIN_T_AXIS = 10; // s: the time axis starts at this length and then grows to cover exactly the run so far
const SAMPLES = 36; // evenly spaced sample times behind the smooth curves (and the markers of the Both view)
const [SP_A, SP_B, SP_C, SP_D] = SPECIES;
const REACTANT_COLOR = "#7c3aed"; const PRODUCT_COLOR = "#15803d"; // Both view, as in the reference graph: purple falls, green rises

/**
 * CONCENTRATION against time, three views of the SAME run, all drawn from the engine's counts and all continuous curves
 * (no bars, no histogram, nothing hard-coded):
 *  "reactants" A and B left against time (solid system: unused solid sites A, and B): smooth decreasing curves (PCHIP).
 *  "products"  cumulative C and D formed (each equals the number of reactions): smooth monotone curve through real counts;
 *              it levels off when the limiting reactant is used up. Dotted line = most possible.
 *  "both"      one reactant (A, or B in the solid system) falling and one product rising on the same axis, markers at the
 *              sample times (the default view).
 * The vessel volume is fixed, so concentration is proportional to the number of particles: the y axis is labelled in
 * particles in the vessel (no mol dm-3 numbers are invented).
 * `species` (null | "A" | "B" | "C" | "D") narrows the reactants / products view to that one species.
 * Dashed vertical lines mark the moments conditions were changed.
 */
export default function ConcentrationGraph({ events, tNow, marks, view, species = null, left = null, finished = false, hist = null, live = { a: 0, b: 0 }, solid = false }) {
  const wrap = useRef(null);
  const { w: W, h: H } = useBox(wrap, { w: 380, h: 190 });
  const legendRow = true;
  const padL = 46; const padR = 10; const padT = legendRow ? 26 : 10; const padB = 38;
  const pw = Math.max(40, W - padL - padR); const ph = Math.max(36, H - padT - padB);
  const total = events.length;
  const tMax = niceStep(Math.max(MIN_T_AXIS, tNow * 1.04));
  const data = useMemo(() => {
    return { prod: productCurve(events, tNow, SAMPLES), cc: hist ? countCurves(hist, tNow, { a: live.a, b: live.b, c: events.length }, SAMPLES) : null };
  }, [events, tNow, hist, live.a, live.b]);
  const x = (t) => padL + (t / tMax) * pw;
  const potential = total + (left ?? 0);
  const cc = data.cc;

  // ---- which curves does this view draw? (each: key, label, colour, dash, getter of the smooth values and of the sample values)
  const reaKey = solid ? "B" : "A"; const prodKey = solid ? "D" : "C";
  const SP_OF = { A: SP_A, B: SP_B, C: SP_C, D: SP_D };
  const smooth = { A: cc?.ca, B: cc?.cb, C: data.prod.v, D: data.prod.v };
  const names = { A: solid ? "A (solid sites left)" : "A left", B: "B left", C: "C formed", D: "D formed" };
  let curves = [];
  if (view === "reactants") curves = ["A", "B"].filter((k) => !species || species === k).map((k) => ({ k, label: names[k], color: SP_OF[k].color, dash: k === "B" ? "7 2.5" : null, ys: smooth[k], marker: null }));
  else if (view === "products") curves = ["C", "D"].filter((k) => !species || species === k).map((k) => ({ k, label: names[k], color: SP_OF[k].color, dash: k === "D" ? "7 2.5" : null, ys: smooth[k], marker: null }));
  else if (view === "both") curves = [
    { k: reaKey, label: solid ? "B left" : "A left (= B)", color: REACTANT_COLOR, dash: null, ys: smooth[reaKey], marker: "circle", samples: cc ? (solid ? cc.b : cc.a) : [] },
    { k: prodKey, label: solid ? "D formed (= sites used)" : "C formed (= D)", color: PRODUCT_COLOR, dash: "7 2.5", ys: smooth[prodKey], marker: "square", samples: cc ? cc.c : [] },
  ];
  const tCurve = view === "products" ? data.prod.t : cc ? cc.t : data.prod.t;
  let yData = 1; for (const c of curves) if (c.ys) for (let k = 0; k < c.ys.length; k++) yData = Math.max(yData, c.ys[k]);
  const yTop = (view === "products" ? Math.max(species === "C" || species === "D" || !species ? potential : 0, yData, 1) : yData) * 1.08;
  const ymax = niceStep(yTop);
  const y = (v) => padT + (1 - v / ymax) * ph;
  const yt = niceTicks(ymax, ph < 110 ? 3 : 5);
  const xt = niceTicks(tMax, pw < 260 ? 4 : 6);
  const pathOf = (ts, ys) => { let d = ""; for (let k = 0; k < ts.length; k++) d += `${k ? "L" : "M"}${x(ts[k]).toFixed(1)},${y(ys[k]).toFixed(1)}`; return d; };

  // condition-change markers: none at the very start (that is just the set-up); a label only if there is room beside the previous one
  const visMarks = marks.filter((m) => m.t >= 0.5 && m.t <= tMax).slice(-4);
  let lastLabelX = -1e9; const labelled = visMarks.map((m) => { const lx = x(m.t); const ok = lx - lastLabelX >= 56; if (ok) lastLabelX = lx; return ok; });
  const nowOf = (k) => (k === "A" ? live.a : k === "B" ? live.b : total);
  const done = finished ? "; the limiting reactant is used up" : "";
  const label = `Graph of concentration against simulated time. The vessel volume is fixed, so concentration is proportional to the number of particles in the vessel. ${curves.map((c) => `${c.label} (now ${nowOf(c.k)})`).join(" and ")}${done}.`;
  const yFmt = (v) => String(Math.round(v));
  let lx = padL + 2; // legend layout
  return (
    <div ref={wrap} className="ct-conc-plot" data-testid="conc-plot" data-view={view} data-species={species ?? ""}>
      <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} data-testid="conc-svg" data-total={total} data-finished={finished ? "1" : "0"}>
        <defs><clipPath id="ct-conc-clip"><rect x={padL} y={padT} width={pw} height={ph} /></clipPath></defs>
        {yt.ticks.map((v) => (
          <g key={v}>
            <line x1={padL} x2={padL + pw} y1={y(v)} y2={y(v)} stroke="#d6e0f2" />
            <text x={padL - 6} y={y(v) + 4} textAnchor="end" fontSize="11" fill={MUTED}>{yFmt(v)}</text>
          </g>
        ))}
        {xt.ticks.map((t) => (<g key={t}><line x1={x(t)} x2={x(t)} y1={padT + ph} y2={padT + ph + 4} stroke={MUTED} /><text x={x(t)} y={padT + ph + 16} textAnchor="middle" fontSize="11" fill={MUTED}>{Math.round(t)}</text></g>))}
        <line x1={padL} x2={padL} y1={padT} y2={padT + ph} stroke={MUTED} />
        <line x1={padL} x2={padL + pw} y1={padT + ph} y2={padT + ph} stroke={MUTED} />
        <text x={padL + pw / 2} y={H - 6} textAnchor="middle" fontSize="12" fill={TEXT}>Time / s</text>
        <text transform={`translate(12 ${padT + ph / 2}) rotate(-90)`} textAnchor="middle" fontSize="12" fill={TEXT}>{ph >= 175 ? "Concentration (particles in the vessel)" : ph >= 105 ? "Concentration (particles)" : "Particles"}</text>
        {legendRow && (
          <g data-testid="graph-legend" fontSize="11" fill={TEXT}>
            {curves.map((c) => {
              const x0 = lx; lx += 26 + c.label.length * 5.6 + 12;
              return (
                <g key={c.k} data-testid={`legend-${c.k}`}>
                  <line x1={x0} x2={x0 + 20} y1={12} y2={12} stroke={c.color} strokeWidth="2.4" strokeDasharray={c.dash ?? undefined} />
                  {c.marker === "circle" && <circle cx={x0 + 10} cy={12} r="3" fill={c.color} />}
                  {c.marker === "square" && <path d={`M${x0 + 7},9 h6 v6 h-6 z`} fill={c.color} />}
                  <text x={x0 + 24} y={16}>{c.label}</text>
                </g>
              );
            })}
          </g>
        )}
        <g clipPath="url(#ct-conc-clip)">
          {visMarks.map((m, i) => (<line key={i} x1={x(m.t)} x2={x(m.t)} y1={padT} y2={padT + ph} stroke="#7c3aed" strokeDasharray="4 3" />))}
          {view === "products" && potential > 0 && <line x1={padL} x2={padL + pw} y1={y(potential)} y2={y(potential)} stroke={MUTED} strokeDasharray="2 3" data-testid="products-max" />}
          {curves.map((c) => c.ys && (
            <path key={c.k} d={pathOf(tCurve, c.ys)} fill="none" stroke={c.color} strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={c.dash ?? undefined}
              data-testid={`curve-${c.k}`} data-points={tCurve.length} data-final={Math.round(nowOf(c.k))} />
          ))}
          {view === "both" && curves.map((c) => (c.samples ? Array.from(cc.ts).map((t, k) => (c.marker === "circle"
            ? <circle key={`${c.k}${k}`} cx={x(t)} cy={y(c.samples[k])} r="2.4" fill={c.color} stroke="#ffffff" strokeWidth="0.6" data-testid="sample-dot" />
            : <path key={`${c.k}${k}`} d={`M${x(t) - 2},${y(c.samples[k]) - 2}h4v4h-4z`} fill={c.color} stroke="#ffffff" strokeWidth="0.6" data-testid="sample-dot" />)) : null))}
        </g>
        {view === "products" && potential > 0 && ph >= 90 && <text x={padL + pw - 4} y={Math.max(padT + 12, y(potential) + 13)} textAnchor="end" fontSize="11" fill={MUTED}>{finished ? `all ${potential} formed: reactant used up` : `most possible: ${potential}`}</text>}
        {(view === "reactants" || view === "both") && finished && ph >= 90 && <text x={padL + pw - 4} y={padT + ph - 6} textAnchor="end" fontSize="11" fill={MUTED} data-testid="graph-finished-note">limiting reactant used up</text>}
        {visMarks.map((m, i) => (labelled[i] && <text key={i} x={Math.min(x(m.t) + 3, padL + pw - 4)} y={padT + 11 + (i % 2) * 12 + 0} fontSize="11" fill="#5b21b6" textAnchor={x(m.t) + 3 > padL + pw - 70 ? "end" : "start"}>{m.label}</text>))}
      </svg>
    </div>
  );
}
