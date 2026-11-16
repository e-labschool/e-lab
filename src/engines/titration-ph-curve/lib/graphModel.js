// Geometry + label placement for the titration chart (pure: no React, no DOM). 1 SVG unit = 1 CSS px.
import { placeLabels } from "../../../lib/acidbase/labels.js";
import { INDICATOR_LIST } from "../../../lib/acidbase/constants.js";
import { endpointPH } from "../../../lib/acidbase/indicators.js";
import { formatPH } from "../../../lib/acidbase/format.js";

const STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
export const niceStep = (max, maxTicks = 10) => STEPS.find((s) => max / s <= maxTicks) ?? 100;

export function makeScales(W, H, axisMax) {
  const margin = { left: 44, right: 46, top: 12, bottom: 54 };
  const plot = { x: margin.left, y: margin.top, w: Math.max(80, W - margin.left - margin.right), h: Math.max(80, H - margin.top - margin.bottom) };
  const x = (v) => plot.x + (v / axisMax) * plot.w;
  const y = (pH) => plot.y + ((14 - Math.max(0, Math.min(14, pH))) / 14) * plot.h;
  const step = niceStep(axisMax, plot.w < 420 ? 6 : 10);
  const xTicks = []; for (let v = 0; v <= axisMax + 1e-9; v += step) xTicks.push({ v, x: x(v) });
  const yTicks = [0, 2, 4, 6, 7, 8, 10, 12, 14].map((pH) => ({ pH, y: y(pH) }));
  return { margin, plot, x, y, xTicks, yTicks, step };
}

const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join("");
const volText = (v) => `${v < 10 ? v.toFixed(2) : v.toFixed(1)} cm³`;

/** Axis value tags that must not touch each other or the regular tick labels. */
function placeTags(tags, existing, min) {
  const taken = existing.slice(); const out = [];
  for (const t of tags) { if (taken.every((p) => Math.abs(p - t.pos) >= min)) { out.push(t); taken.push(t.pos); } }
  return out;
}

export function buildExperimentGraph(t, { W, H, points = [], current = null, showFeatures = true, indicatorId = null }) {
  const S = makeScales(W, H, t.axisMax);
  const { plot, x, y } = S;
  const dense = t.curve(t.axisMax).map((p) => ({ ...p, px: x(p.v), py: y(p.pH) }));
  const curvePath = path(dense.map((p) => ({ x: p.px, y: p.py })));
  const studentPts = points.map((p) => ({ v: p.v, pH: p.pH, x: x(p.v), y: y(p.pH) }));
  const cur = current ?? points[points.length - 1] ?? null;
  const model = { W, H, ...S, dense, curvePath, studentPts, studentPath: path(studentPts), current: cur ? { v: cur.v, pH: cur.pH, x: x(cur.v), y: y(cur.pH) } : null, labels: [], tags: { x: [], y: [] }, features: showFeatures };
  const ind = indicatorId ? INDICATOR_LIST.find((i) => i.id === indicatorId) : null;
  if (ind) model.indicator = { ...ind, y1: y(ind.high), y2: y(ind.low), mid: y((ind.low + ind.high) / 2) };

  if (showFeatures) {
    const eqX = x(t.veq); const eqY = y(t.eq.pH);
    model.eq = { x: eqX, y: eqY, v: t.veq, pH: t.eq.pH };
    model.steep = { x1: Math.min(x(t.steep.vLow), eqX - 3), x2: Math.max(x(t.steep.vHigh), eqX + 3), jump: t.steep.jump };
    if (t.buffer) {
      model.buffer = { x1: x(t.buffer.vLow), x2: x(t.buffer.vHigh), pKa: t.buffer.pKa };
      model.halfEq = { x: x(t.halfEq.v), y: y(t.halfEq.pH), v: t.halfEq.v, pH: t.halfEq.pH };
    }
    const items = [{ id: "eq", x: eqX, y: eqY, lines: ["Equivalence point", `${volText(t.veq)}, pH ${formatPH(t.eq.pH)}`] }];
    if (t.halfEq) items.push({ id: "half", x: model.halfEq.x, y: model.halfEq.y, lines: ["Half-equivalence", `pH = pKa = ${t.buffer.pKa.toFixed(2)}`] });
    items.push({ id: "steep", x: eqX, y: y((t.steep.pHLow + t.steep.pHHigh) / 2), lines: ["Steep region", `±1% of Veq`] });
    if (ind) {
      const ev = t.curve(t.axisMax).find((p, i, a) => i > 0 && (a[i - 1].pH - endpointPH(ind.id)) * (p.pH - endpointPH(ind.id)) <= 0);
      if (ev) { model.endpoint = { x: x(ev.v), y: y(endpointPH(ind.id)), v: ev.v, pH: endpointPH(ind.id) }; items.push({ id: "end", x: model.endpoint.x, y: model.endpoint.y, lines: ["Indicator endpoint", `pH ${endpointPH(ind.id).toFixed(1)}`] }); }
    }
    const fixed = [];
    if (model.buffer) fixed.push({ x: (model.buffer.x1 + model.buffer.x2) / 2 - 42, y: plot.y + 3, w: 84, h: 17 });
    model.bufferLabel = model.buffer ? { x: (model.buffer.x1 + model.buffer.x2) / 2, y: plot.y + 15 } : null;
    const obstacles = dense.map((p) => ({ x: p.px, y: p.py })).concat(studentPts.map((p) => ({ x: p.x, y: p.y })));
    model.labels = placeLabels(items, { bounds: plot, obstacles, fixed });
    const xtags = [{ id: "eq", pos: eqX, text: volText(t.veq).replace(" cm³", "") }];
    if (model.halfEq) xtags.push({ id: "half", pos: model.halfEq.x, text: model.halfEq.v.toFixed(1) });
    model.tags.x = placeTags(xtags, [], 26);
    const ytags = [{ id: "eq", pos: eqY, text: formatPH(t.eq.pH) }];
    if (model.halfEq) ytags.push({ id: "half", pos: model.halfEq.y, text: formatPH(t.halfEq.pH) });
    model.tags.y = placeTags(ytags, S.yTicks.map((tk) => tk.y), 14);
  }
  return model;
}

export const COMPARE_COLOURS = { "SA-SB": "#60a5fa", "WA-SB": "#fbbf24", "WA-WB": "#d8b4fe", "SB-SA": "#60a5fa", "WB-SA": "#fbbf24", "WB-WA": "#d8b4fe" };
export const COMPARE_DASH = { "SA-SB": "", "WA-SB": "", "WA-WB": "7 4", "SB-SA": "", "WB-SA": "", "WB-WA": "7 4" };

export function buildCompareGraph(set, { W, H }) {
  const axisMax = set[0].titration.axisMax;
  const S = makeScales(W, H, axisMax);
  const { plot, x, y } = S;
  const curves = set.map((s) => {
    const t = s.titration; const dense = t.curve(axisMax).map((p) => ({ ...p, px: x(p.v), py: y(p.pH) }));
    return { id: s.id, name: s.name, t, colour: COMPARE_COLOURS[s.id], dash: COMPARE_DASH[s.id], path: path(dense.map((p) => ({ x: p.px, y: p.py }))), dense,
      initial: { x: x(0), y: y(t.initial.pH), pH: t.initial.pH }, eq: { x: x(t.veq), y: y(t.eq.pH), pH: t.eq.pH, v: t.veq },
      buffer: t.buffer ? { x1: x(t.buffer.vLow), x2: x(t.buffer.vHigh) } : null };
  });
  const items = [];
  for (const c of curves) {
    items.push({ id: `${c.id}-init`, x: c.initial.x, y: c.initial.y, lines: [`pH ${formatPH(c.initial.pH)}`] });
    items.push({ id: `${c.id}-eq`, x: c.eq.x, y: c.eq.y, lines: [`pH ${formatPH(c.eq.pH)}`] });
    const pick = c.dense.find((p) => p.v >= axisMax * 0.78) ?? c.dense[c.dense.length - 1];
    items.push({ id: `${c.id}-name`, x: pick.px, y: pick.py, lines: [c.id.replace("-", " / ")] });
  }
  const obstacles = curves.flatMap((c) => c.dense.map((p) => ({ x: p.px, y: p.py })));
  const bands = INDICATOR_LIST.map((i) => ({ ...i, y1: y(i.high), y2: y(i.low), mid: y((i.low + i.high) / 2) }));
  const labels = placeLabels(items, { bounds: plot, obstacles });
  return { W, H, ...S, axisMax, curves, bands, labels };
}

/** Text alternative for the chart (screen readers). */
export function describeExperiment(t, current) {
  const parts = [`Titration curve of ${t.burette.label} added to ${t.flask.label}, pH against volume added.`, `Initial pH ${formatPH(t.initial.pH)}.`, `Equivalence point at ${volText(t.veq)}, pH ${formatPH(t.eq.pH)}.`];
  if (t.buffer) parts.push(`Buffer region from ${volText(t.buffer.vLow)} to ${volText(t.buffer.vHigh)}; half-equivalence at ${volText(t.halfEq.v)} where pH equals pKa, ${t.buffer.pKa.toFixed(2)}.`);
  else parts.push("There is no buffer region for this pair.");
  if (current) parts.push(`Now ${volText(current.v)} added, pH ${formatPH(current.pH)}.`);
  return parts.join(" ");
}
