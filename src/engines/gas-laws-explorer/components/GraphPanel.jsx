import { useEffect, useRef, useState } from "react";
import { CircleHelp, LayoutGrid, RotateCcw } from "lucide-react";
import { MODES, allGraphsView, buildGraph, formatPoint, graphOptions, graphPoint } from "../model.js";
import { ACCENTS as ACC } from "../theme.js";

const NAVY = "#14226B";
const fmtTick = (v) => String(Number(v.toPrecision(4)));

function wrapText(text, maxChars) {
  const words = text.split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur); cur = w; } else cur = (cur + " " + w).trim();
  }
  if (cur) lines.push(cur);
  return lines;
}

function useSize(ref, fallback) {
  const [size, setSize] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const r = el.getBoundingClientRect();
      if (r.width > 10 && r.height > 10) setSize((c) => (Math.abs(c.w - r.width) < 0.5 && Math.abs(c.h - r.height) < 0.5 ? c : { w: r.width, h: r.height }));
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [ref]);
  return size;
}

/** SVG graph (own code; scales crisply at any DPR). Marker = live state. */
export function GraphSvg({ graph, accent, mini = false, hoverIdx = null, onHover, trail = [], label }) {
  const wrapRef = useRef(null);
  const { w, h } = useSize(wrapRef, mini ? { w: 150, h: 110 } : { w: 340, h: 240 });
  const m = mini ? { l: 30, r: 8, t: 6, b: 24 } : { l: 50, r: 14, t: 12, b: 42 };
  const pw = Math.max(20, w - m.l - m.r);
  const ph = Math.max(20, h - m.t - m.b);
  const [x0, x1] = graph.xRange;
  const [y0, y1] = graph.yRange;
  const sx = (x) => m.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (y) => m.t + ph - ((y - y0) / (y1 - y0)) * ph;
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ");
  const fs = mini ? 8.5 : 11;
  const dots = graph.accessible.filter((_, i) => i % (graph.kind === "curve" ? 12 : 8) === 0);
  const hp = hoverIdx != null ? graph.accessible[hoverIdx] : null;
  const mk = graph.marker;

  const tip = (pt, text, key) => {
    const tw = text.length * (mini ? 4.6 : 6.1) + 10;
    const th = mini ? 13 : 19;
    let tx = sx(pt.x) + 12;
    let ty = sy(pt.y) - th - 10;
    if (tx + tw > w - 2) tx = sx(pt.x) - tw - 12;
    if (ty < 2) ty = sy(pt.y) + 12;
    return (
      <g key={key} pointerEvents="none">
        <rect x={tx} y={ty} width={tw} height={th} rx="5" fill="#fff" stroke={accent.solid} strokeWidth="1" />
        <text x={tx + 5} y={ty + th / 2 + (mini ? 3 : 4)} fontSize={mini ? 8 : 10.5} fill={NAVY} fontWeight="600">{text}</text>
      </g>
    );
  };

  const onMove = (e) => {
    if (!onHover || mini) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const px = x0 + ((e.clientX - rect.left - m.l) / pw) * (x1 - x0);
    let best = 0;
    let bd = Infinity;
    graph.accessible.forEach((p, i) => { const d = Math.abs(p.x - px); if (d < bd) { bd = d; best = i; } });
    onHover(best);
  };

  return (
    <div ref={wrapRef} className="relative h-full min-h-0 w-full min-w-0">
      <svg
        width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}
        className="absolute inset-0 block touch-none select-none" data-testid={mini ? undefined : "graph-svg"}
        onPointerMove={onMove} onPointerLeave={() => onHover && onHover(null)}
      >
        {graph.yTicks.map((t) => (
          <g key={"y" + t}>
            <line x1={m.l} x2={m.l + pw} y1={sy(t)} y2={sy(t)} stroke="#E4EAF4" />
            <text x={m.l - 5} y={sy(t) + 3.5} fontSize={fs} textAnchor="end" fill="#33415F">{fmtTick(t)}</text>
          </g>
        ))}
        {graph.xTicks.map((t) => (
          <g key={"x" + t}>
            <line x1={sx(t)} x2={sx(t)} y1={m.t} y2={m.t + ph} stroke="#E4EAF4" />
            <text x={sx(t)} y={m.t + ph + (mini ? 11 : 15)} fontSize={fs} textAnchor="middle" fill="#33415F">{fmtTick(t)}</text>
          </g>
        ))}
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="#33415F" />
        <line x1={m.l} x2={m.l} y1={m.t} y2={m.t + ph} stroke="#33415F" />
        {graph.extKind === "celsius" && x0 < -273.15 && (
          <g pointerEvents="none">
            <line x1={sx(-273.15)} x2={sx(-273.15)} y1={m.t} y2={m.t + ph} stroke="#B45309" strokeDasharray="2 3" opacity="0.7" />
            {!mini && <text x={sx(-273.15) + 4} y={m.t + ph - 6} fontSize="10" fill="#B45309">−273.15 °C</text>}
          </g>
        )}
        <text x={m.l + pw / 2} y={h - (mini ? 3 : 6)} fontSize={mini ? 8.5 : 12} textAnchor="middle" fill={NAVY} fontWeight="500">{mini ? graph.xTitle.replace(/^[A-Za-z]+, /, "") : graph.xTitle}</text>
        <text transform={`translate(${mini ? 8 : 13},${m.t + ph / 2}) rotate(-90)`} fontSize={mini ? 8.5 : 12} textAnchor="middle" fill={NAVY} fontWeight="500">{mini ? graph.yTitle.replace(/^[A-Za-z]+, /, "") : graph.yTitle}</text>

        {trail.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={mini ? 1.5 : 2.2} fill={accent.solid} opacity="0.28" />)}
        {graph.extension && (
          <path d={path(graph.extension)} fill="none" stroke="#7B879F" strokeWidth={mini ? 1.4 : 2} strokeDasharray="5 4" data-testid={mini ? undefined : "graph-extension"} />
        )}
        <path d={path(graph.accessible)} fill="none" stroke={accent.solid} strokeWidth={mini ? 1.8 : 2.5} strokeLinejoin="round" strokeLinecap="round" data-testid={mini ? undefined : "graph-curve"} />
        {!mini && dots.map((p, i) => <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r="3" fill={accent.solid} />)}
        {graph.extension && graph.extensionNote && !mini && (
          <text fontSize="10" fill="#5B6785" fontStyle="italic" data-testid="extrapolation-label" pointerEvents="none">
            {(() => { const lines = wrapText(graph.extensionNote, Math.max(18, Math.floor(pw / 6.2) - 14)); return lines.map((ln, i) => (
              <tspan key={i} x={m.l + 10} y={m.t + 14 + i * 12}>{i < lines.length - 1 ? ln + " " : ln}</tspan>
            )); })()}
          </text>
        )}
        {hp && (
          <g>
            <circle cx={sx(hp.x)} cy={sy(hp.y)} r="5" fill="#fff" stroke={NAVY} strokeWidth="1.8" />
            {tip(hp, `${hp.x.toFixed(graph.xDec)}, ${hp.y.toFixed(graph.yDec)}`, "hover")}
          </g>
        )}
        {mk && (
          <g data-testid={mini ? undefined : "graph-marker"} data-x={mk.x} data-y={mk.y}>
            <circle cx={sx(mk.x)} cy={sy(mk.y)} r={mini ? 5 : 9} fill="#fff" fillOpacity="0.9" stroke={accent.solid} strokeWidth={mini ? 2 : 3} />
            <circle cx={sx(mk.x)} cy={sy(mk.y)} r={mini ? 2.4 : 4.5} fill="#F5C518" stroke="#8A6A00" strokeWidth="0.8" />
            {!mini && hp == null && tip(mk, `${mk.x.toFixed(graph.xDec)}, ${mk.y.toFixed(graph.yDec)}`, "mk")}
          </g>
        )}
      </svg>
    </div>
  );
}

export default function GraphPanel({
  state, accent, graphId, onGraphId, allView, onToggleAll, onResetGraph, onOpenMode, trail, dense,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const graph = buildGraph(state, graphId);
  const opts = graphOptions(state.mode);
  const trailPts = trail.map((t) => graphPoint(t, graphId));
  const readout = hoverIdx != null && graph.accessible[hoverIdx]
    ? `Curve point: ${formatPoint(graph, graph.accessible[hoverIdx].x, graph.accessible[hoverIdx].y)}`
    : `Current state: ${formatPoint(graph, graph.marker.x, graph.marker.y)}`;

  const onKey = (e) => {
    const n = graph.accessible.length;
    if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setHoverIdx((i) => Math.min(n - 1, (i ?? Math.round(n / 2)) + 1)); }
    else if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setHoverIdx((i) => Math.max(0, (i ?? Math.round(n / 2)) - 1)); }
    else if (e.key === "Escape") setHoverIdx(null);
  };

  const head = (
    <div className="flex items-center justify-between gap-2">
      <h3 className={"font-bold leading-tight text-[#14226B] " + (dense ? "text-[15px]" : "text-[17px]")}>
        {allView ? "All Graphs View" : `Graph: ${GRAPH_TITLES[state.mode]}`}
      </h3>
      <span title="Curves are computed from PV = nRT using this investigation’s constant variables. The yellow marker is the current state of the gas." className="cursor-help text-[#8A97B2]">
        <CircleHelp size={18} aria-label="About this graph" />
      </span>
    </div>
  );

  const buttons = (
    <div className="flex shrink-0 flex-wrap items-center gap-2">
      <button type="button" onClick={() => { setHoverIdx(null); onResetGraph(); }} data-testid="reset-graph"
        title="Restore the default graph view (does not change the gas)"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#D5DEEF] bg-white px-2.5 py-1 text-[12.5px] font-semibold text-[#14226B] hover:bg-[#EEF4FF] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5]">
        <RotateCcw size={13} aria-hidden="true" /> Reset Graph
      </button>
      <button type="button" onClick={onToggleAll} aria-pressed={allView} data-testid="all-graphs-toggle"
        className={"inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[12.5px] font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F7BF5] " + (allView ? "border-transparent text-white" : "border-[#D5DEEF] bg-white text-[#14226B] hover:bg-[#EEF4FF]")}
        style={allView ? { background: accent.solid } : undefined}>
        <LayoutGrid size={13} aria-hidden="true" /> All Graphs View
      </button>
    </div>
  );

  if (allView) {
    const panels = allGraphsView(state);
    return (
      <div className="flex h-full min-h-0 flex-col gap-1.5" data-testid="all-graphs">
        {head}
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {panels.map((p) => {
            const a = ACC[p.mode];
            return (
              <button key={p.mode} type="button" onClick={() => onOpenMode(p.mode)} data-testid={`all-panel-${p.mode}`}
                aria-label={`Open the ${MODES[p.mode].title} (${MODES[p.mode].short}) investigation. ${p.conditionsLabel}: ${p.conditions}`}
                aria-current={p.active ? "true" : undefined}
                className="flex min-h-[120px] min-w-0 flex-col rounded-xl border bg-white p-1 text-left transition-shadow hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F7BF5]"
                style={{ borderColor: p.active ? a.solid : "#E3EAF6", borderWidth: p.active ? 2 : 1 }}>
                <span className="flex items-baseline justify-between gap-1 px-1">
                  <span className="text-[11.5px] font-bold" style={{ color: a.text }}>{p.graph.yName} vs {p.graph.xName}  <span className="font-medium text-[#6B7A99]">({MODES[p.mode].short})</span></span>
                </span>
                <span className="px-1 text-[9.5px] leading-tight text-[#5B6785]">
                  <span className="font-semibold">{p.active ? "Current investigation" : "Reference conditions"}:</span> {p.conditions.replaceAll(" (constant)", "")}
                </span>
                <span className="min-h-0 flex-1">
                  <GraphSvg graph={p.graph} accent={a} mini label={`${p.graph.yName} versus ${p.graph.xName} at ${p.conditions}`} />
                </span>
              </button>
            );
          })}
        </div>
        <p className="shrink-0 text-[11px] leading-tight text-[#5B6785]">
          Each panel has its own conditions, so these are not one experiment. Select a panel to open that investigation with your current values.
        </p>
        {buttons}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-1.5">
      {head}
      <div role="radiogroup" aria-label="Graph type" className="grid shrink-0 overflow-hidden rounded-lg border border-[#DAE3F3] bg-[#F4F7FC]" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0,1fr))` }}>
        {opts.map((o, i) => {
          const sel = o.id === graphId;
          return (
            <button key={o.id} type="button" role="radio" aria-checked={sel} tabIndex={sel ? 0 : -1} data-testid={`graph-opt-${o.id}`}
              onClick={() => { setHoverIdx(null); onGraphId(o.id); }}
              onKeyDown={(e) => {
                const d = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
                if (!d) return;
                e.preventDefault();
                const nx = opts[(i + d + opts.length) % opts.length];
                onGraphId(nx.id);
                requestAnimationFrame(() => document.querySelector(`[data-testid="graph-opt-${nx.id}"]`)?.focus());
              }}
              className={"px-1 text-[12.5px] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2F7BF5] " + (dense ? "py-1.5 " : "py-2 ") + (sel ? "text-white" : "text-[#14226B] hover:bg-white")}
              style={sel ? { background: accent.solid } : undefined}>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="shrink-0 rounded-lg bg-[#F4F7FC] px-2 py-1 text-[11.5px] leading-tight text-[#33415F]" data-testid="graph-constants">
        {graph.constants} · <span className="italic">{graph.formula}</span>
      </p>
      <div
        tabIndex={0} role="group" onKeyDown={onKey} onBlur={() => setHoverIdx(null)}
        aria-label="Graph. Use the left and right arrow keys to move a readout along the curve."
        className="relative min-h-[150px] flex-1 rounded-lg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F7BF5]"
      >
        <GraphSvg graph={graph} accent={accent} hoverIdx={hoverIdx} onHover={setHoverIdx} trail={trailPts}
          label={`${graph.yTitle} against ${graph.xTitle}. ${graph.interpretation} Current state ${formatPoint(graph, graph.marker.x, graph.marker.y)}.`} />
      </div>
      {graph.extension && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 text-[10.5px] text-[#5B6785]" data-testid="graph-legend">
          <span className="inline-flex items-center gap-1"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke={accent.solid} strokeWidth="2.5" /></svg>accessible range</span>
          <span className="inline-flex items-center gap-1"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="#7B879F" strokeWidth="2" strokeDasharray="5 4" /></svg>{graph.extKind === "celsius" ? "extrapolation: not physically accessible" : "extrapolation to the origin"}</span>
        </div>
      )}
      <p className="shrink-0 text-[11.5px] font-medium text-[#14226B]" data-testid="graph-readout">{readout}</p>
      <p className="shrink-0 text-[12px] leading-snug text-[#33415F]" data-testid="graph-interpretation">{graph.interpretation}</p>
      {buttons}
    </div>
  );
}

const GRAPH_TITLES = { pv: "Pressure vs Volume (P – V)", vt: "Volume vs Temperature (V – T)", pt: "Pressure vs Temperature (P – T)", vn: "Volume vs Amount of Gas (V – n)" };
