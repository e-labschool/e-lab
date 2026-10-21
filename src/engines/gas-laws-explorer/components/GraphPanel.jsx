import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, CircleHelp, LayoutGrid, Maximize2, RotateCcw } from "lucide-react";
import { MODES, allGraphsView, buildGraph, formatPoint, graphOptions, graphPoint } from "../model.js";
import { ACCENTS as ACC } from "../theme.js";
import { DashPanel } from "../../../components/simulation/SimulationDashboard.jsx";

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
  const k = mini ? 1 : Math.min(1.3, Math.max(1, w / 480)); // text scale on large plots
  const m = mini ? { l: 32, r: 13, t: 6, b: 26 } : { l: 50 * k, r: 16, t: 12, b: 42 * k };
  const pw = Math.max(20, w - m.l - m.r);
  const ph = Math.max(20, h - m.t - m.b);
  const [x0, x1] = graph.xRange;
  const [y0, y1] = graph.yRange;
  const sx = (x) => m.l + ((x - x0) / (x1 - x0)) * pw;
  const sy = (y) => m.t + ph - ((y - y0) / (y1 - y0)) * ph;
  const path = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${sx(p.x).toFixed(2)},${sy(p.y).toFixed(2)}`).join(" ");
  const fs = mini ? 9.5 : 11 * k;
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
    <div ref={wrapRef} className="sd-graph-plot h-full w-full">
      <svg
        width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label}
        className="touch-none select-none" data-testid={mini ? undefined : "graph-svg"}
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
        <text x={m.l + pw / 2} y={h - (mini ? 3 : 6)} fontSize={mini ? 9.5 : 12 * k} textAnchor="middle" fill={NAVY} fontWeight="500">{mini ? graph.xTitle.replace(/^[A-Za-z]+, /, "") : graph.xTitle}</text>
        <text transform={`translate(${mini ? 8 : 13 * k},${m.t + ph / 2}) rotate(-90)`} fontSize={mini ? 9.5 : 12 * k} textAnchor="middle" fill={NAVY} fontWeight="500">{mini ? graph.yTitle.replace(/^[A-Za-z]+, /, "") : graph.yTitle}</text>

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

const GRAPH_TITLES = { pv: "Pressure vs Volume", vt: "Volume vs Temperature", pt: "Pressure vs Temperature", vn: "Volume vs Amount" };

const iconBtn = "sd-btn sd-btn--sm";

export default function GraphPanel({
  state, accent, graphId, onGraphId, allView, onToggleAll, onResetGraph, onOpenMode, trail,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const [enlarged, setEnlarged] = useState(null); // mode id of the enlarged All-Graphs panel
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

  const buttons = (
    <span className="inline-flex shrink-0 items-center gap-1">
      <button type="button" onClick={() => { setHoverIdx(null); setEnlarged(null); onResetGraph(); }} data-testid="reset-graph"
        title="Reset graph: restore the default graph view (does not change the gas)" aria-label="Reset graph" className={iconBtn}>
        <RotateCcw size={13} aria-hidden="true" /><span className="sd-wide-label">Reset graph</span>
      </button>
      <button type="button" onClick={() => { setEnlarged(null); onToggleAll(); }} aria-pressed={allView} aria-label="All graphs" data-testid="all-graphs-toggle"
        title="All Graphs View: compare the four relationships side by side" className={iconBtn}
        style={allView ? { background: accent.solid, borderColor: accent.solid, color: "#fff" } : undefined}>
        <LayoutGrid size={13} aria-hidden="true" /><span className="sd-wide-label">All graphs</span>
      </button>
    </span>
  );
  const help = (
    <span title="Curves are computed from PV = nRT using this investigation’s constant variables. The yellow marker is the current state of the gas." className="sd-help">
      <CircleHelp size={16} aria-label="About this graph" role="img" />
    </span>
  );
  const heading = (text) => <h3 className="sd-panel-title" title={text}>{text}</h3>;

  if (allView && enlarged) {
    const p = allGraphsView(state).find((x) => x.mode === enlarged);
    const a = ACC[p.mode];
    return (
      <DashPanel grow noBody ariaLabel="Interactive graph" id="gl-graph" testId="all-graphs-enlarged">
        <div className="sd-panel-head">
          {heading(`${p.graph.yName} vs ${p.graph.xName} (${MODES[p.mode].short})`)}
          <span className="inline-flex items-center gap-1">{buttons}{help}</span>
        </div>
        <p className="sd-small shrink-0">
          <span className="font-semibold">{p.active ? "Current investigation" : "Reference conditions"}:</span> {p.conditions.replaceAll(" (constant)", "")} · <span className="italic">{p.graph.formula}</span>
        </p>
        <div className="sd-graph-plot">
          <GraphSvg graph={p.graph} accent={a} label={`${p.graph.yName} versus ${p.graph.xName} at ${p.conditions}`} />
        </div>
        <p className="sd-text shrink-0">{p.graph.interpretation}</p>
        <div className="flex shrink-0 gap-1.5">
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => setEnlarged(null)} data-testid="all-back"><ArrowLeft size={13} aria-hidden="true" /> Back to all graphs</button>
          <button type="button" className="sd-btn sd-btn--sm" onClick={() => { setEnlarged(null); onOpenMode(p.mode); }} data-testid="all-open">Open this investigation</button>
        </div>
      </DashPanel>
    );
  }

  if (allView) {
    const panels = allGraphsView(state);
    return (
      <DashPanel grow noBody ariaLabel="Interactive graph" id="gl-graph" testId="all-graphs">
        <div className="sd-panel-head">{heading("All Graphs View")}<span className="inline-flex items-center gap-1">{buttons}{help}</span></div>
        <div className="grid min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-1.5">
          {panels.map((p) => {
            const a = ACC[p.mode];
            return (
              <div key={p.mode} data-testid={`all-panel-${p.mode}`} aria-current={p.active ? "true" : undefined}
                className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl border bg-white p-1"
                style={{ borderColor: p.active ? a.solid : "#E3EAF6", borderWidth: p.active ? 2 : 1 }}>
                <span className="flex items-center justify-between gap-1 px-1">
                  <span className="min-w-0 truncate text-[11.5px] font-bold" style={{ color: a.text }}>{p.graph.yName} vs {p.graph.xName} <span className="font-medium text-[#4a5a82]">({MODES[p.mode].short})</span></span>
                  <span className="inline-flex shrink-0 gap-1">
                    <button type="button" onClick={() => setEnlarged(p.mode)} data-testid={`all-enlarge-${p.mode}`} title="Enlarge this graph" aria-label={`Enlarge the ${p.graph.yName} versus ${p.graph.xName} graph`}
                      className="grid h-6 w-6 place-items-center rounded-md border border-[#cbd6ec] bg-white text-[#14226B] hover:bg-[#eef4ff]"><Maximize2 size={12} aria-hidden="true" /></button>
                    <button type="button" onClick={() => onOpenMode(p.mode)} data-testid={`all-open-${p.mode}`}
                      title={`Open the ${MODES[p.mode].title} (${MODES[p.mode].short}) investigation with your current values`}
                      aria-label={`Open the ${MODES[p.mode].title} (${MODES[p.mode].short}) investigation. ${p.conditionsLabel}: ${p.conditions}`}
                      className="grid h-6 w-6 place-items-center rounded-md border border-[#cbd6ec] bg-white text-[#14226B] hover:bg-[#eef4ff]"><ArrowUpRight size={13} aria-hidden="true" /></button>
                  </span>
                </span>
                <span className="px-1 text-[10.5px] leading-tight text-[#4a5a82]" title={p.conditions}>
                  <span className="font-semibold">{p.active ? "Current" : "Reference"}:</span> {p.conditions.replaceAll(" (constant)", "")}
                </span>
                <span className="min-h-0 flex-1">
                  <GraphSvg graph={p.graph} accent={a} mini label={`${p.graph.yName} versus ${p.graph.xName} at ${p.conditions}`} />
                </span>
              </div>
            );
          })}
        </div>
        <p className="sd-small shrink-0">Each panel has its own conditions, so these are not one experiment. Enlarge reads one graph; the arrow opens that investigation.</p>
      </DashPanel>
    );
  }

  return (
    <DashPanel grow noBody ariaLabel="Interactive graph" id="gl-graph" testId="graph-panel">
      <div className="sd-panel-head">{heading(GRAPH_TITLES[state.mode])}{buttons}</div>
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
              className={"min-h-[28px] truncate px-1 text-[length:var(--sd-fs)] font-semibold transition-colors focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#2F7BF5] " + (sel ? "text-white" : "text-[#14226B] hover:bg-white")}
              style={sel ? { background: accent.solid } : undefined}>
              {o.label}
            </button>
          );
        })}
      </div>
      <p className="sd-small flex shrink-0 items-start justify-between gap-1 rounded-lg bg-[#F4F7FC] px-2 py-0.5 text-[#33415F]" data-testid="graph-constants">
        <span>{graph.constants} · <span className="italic">{graph.formula}</span></span>
        {help}
      </p>
      <div
        tabIndex={0} role="group" onKeyDown={onKey} onBlur={() => setHoverIdx(null)}
        aria-label="Graph. Use the left and right arrow keys to move a readout along the curve."
        className="relative flex min-h-[110px] flex-1 flex-col rounded-lg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#2F7BF5]"
      >
        <GraphSvg graph={graph} accent={accent} hoverIdx={hoverIdx} onHover={setHoverIdx} trail={trailPts}
          label={`${graph.yTitle} against ${graph.xTitle}. ${graph.interpretation} Current state ${formatPoint(graph, graph.marker.x, graph.marker.y)}.`} />
      </div>
      {graph.extension && (
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 text-[length:var(--sd-fs-sm)] text-[#4a5a82]" data-testid="graph-legend">
          <span className="inline-flex items-center gap-1"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke={accent.solid} strokeWidth="2.5" /></svg>accessible range</span>
          <span className="inline-flex items-center gap-1"><svg width="22" height="6" aria-hidden="true"><line x1="0" y1="3" x2="22" y2="3" stroke="#7B879F" strokeWidth="2" strokeDasharray="5 4" /></svg>{graph.extKind === "celsius" ? "extrapolation: not physically accessible" : "extrapolation to the origin"}</span>
        </div>
      )}
      <p className="shrink-0 text-[length:var(--sd-fs-sm)] font-medium text-[#14226B]" data-testid="graph-readout">{readout}</p>
      <p className="sd-text shrink-0" data-testid="graph-interpretation">{graph.interpretation}</p>
    </DashPanel>
  );
}
