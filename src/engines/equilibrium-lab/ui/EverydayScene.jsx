import { memo, useEffect, useMemo, useRef } from "react";
import { everydaySnapshot } from "../model/everyday.js";
import { fmt } from "../model/explain.js";

// Two cities, two buses.  The scene READS the model (populations, cumulative transfer counters) and never writes it.
// A bus departs when the model has produced transfer events it has not carried yet and carries ALL of them (so seating never
// distorts the rate): the label shows the true number, only a few passenger heads are drawn (representative occupancy).
// The model's transfers are instantaneous events: the station pictures and the counters always show the model's exact populations and
// the buses are an illustration that follows those events (not a second source of truth).
const TRIP_S = 1.9; const DWELL_S = 0.35; const HEADS = 5;
const A_COLOR = "#0d9488"; const B_COLOR = "#7c3aed"; const FWD = "#2563eb"; const REV = "#ea580c";

const geoFor = (compact, narrow) => {
  const W = narrow ? 560 : compact ? 640 : 760; const sw = narrow ? 150 : compact ? 170 : 210; const gap = narrow ? 60 : 66;
  const chipTop = 12; const roadTop = 42; const laneF = roadTop + 70; const laneR = laneF + gap; const roadBottom = laneR + 56; const chipBot = roadBottom + 12; const H = chipBot + 24 + 22;
  return { W, H, sw, xA: 8, xB: W - 8 - sw, yS: 10, hS: H - 36, cols: narrow ? 6 : compact ? 7 : 8, laneF, laneR, roadL: 8 + sw, roadR: W - 8 - sw, chipTop, roadTop, roadBottom, chipBot };
};
const unitFor = (m, cap) => { for (const u of [1, 2, 5, 10, 20]) if (Math.ceil(m / u) <= cap) return u; return 50; };
const smooth = (p) => p * p * (3 - 2 * p);

function Person({ x, y, color, dim }) {
  return (<g transform={`translate(${x} ${y})`} opacity={dim ? 0.35 : 1}><circle cy="-10" r="4.3" fill={color} /><path d="M-5.6,5 C-5.6,-4 -3,-5.6 0,-5.6 C3,-5.6 5.6,-4 5.6,5 Z" fill={color} /></g>);
}

function Bus({ id, color, label, facing, refEl, n, headsRef, shown }) {
  const f = facing === "right" ? 1 : -1;
  return (
    <g ref={refEl} data-testid={id} style={{ opacity: shown ? 1 : 0.0 }}>
      <g transform={`scale(${f} 1)`}>
        <rect x="-38" y="-17" width="76" height="32" rx="9" fill={color} stroke="rgba(0,0,0,.35)" strokeWidth="1.2" />
        {[0, 1, 2, 3, 4].map((i) => (<rect key={i} x={-31 + i * 12.6} y="-11" width="10.4" height="11" rx="2.6" fill="#fff" opacity=".92" />))}
        <g ref={headsRef}>{Array.from({ length: HEADS }, (_, i) => (<circle key={i} cx={-25.8 + i * 12.6} cy="-5.2" r="3.4" fill={color} opacity="0" data-head="1" />))}</g>
        <rect x="31" y="-9" width="6" height="8" rx="2" fill="#ffe08a" />
        <circle cx="-22" cy="16" r="5.6" fill="#1f2937" /><circle cx="22" cy="16" r="5.6" fill="#1f2937" />
        <circle cx="-22" cy="16" r="2.2" fill="#d1d5db" /><circle cx="22" cy="16" r="2.2" fill="#d1d5db" />
      </g>
      <text y="9.6" textAnchor="middle" className="eq-bus-txt">{label}</text>
      <g data-bubble="1" style={{ opacity: n > 0 ? 1 : 0 }}><rect x="-27" y="-45" width="54" height="21" rx="10.5" fill="#fff" stroke={color} strokeWidth="1.8" /><text y="-30" textAnchor="middle" className="eq-bus-n" fill="#111827">{n} {n === 1 ? "person" : "people"}</text></g>
    </g>
  );
}

function EverydayScene({ ev, running, reduced, speed, layout = "wide", compact = false, simple = false }) {
  const narrow = layout === "narrow"; const g = geoFor(compact, narrow);
  const snap = useMemo(() => everydaySnapshot(ev.s), [ev.s]);
  const blueRef = useRef(null); const orangeRef = useRef(null); const blueHeads = useRef(null); const orangeHeads = useRef(null);
  const evRef = useRef(ev); evRef.current = ev;
  const anim = useRef({ blue: { phase: "idle", p: 0, n: 0, boarded: 0 }, orange: { phase: "idle", p: 0, n: 0, boarded: 0 }, seen: -1 });
  const setBus = (el, headsEl, x, y, n, show) => {
    if (!el) return; el.setAttribute("transform", `translate(${x.toFixed(1)} ${y})`); el.style.opacity = show ? "1" : "0";
    const bubble = el.querySelector("[data-bubble]"); if (bubble) { bubble.style.opacity = n > 0 ? "1" : "0"; const t = bubble.querySelector("text"); if (t) t.textContent = `${n} ${n === 1 ? "person" : "people"}`; }
    headsEl?.querySelectorAll("circle").forEach((c, i) => { c.style.opacity = i < Math.min(n, HEADS) ? "1" : "0"; });
  };
  const geoRef = useRef(g); geoRef.current = g; const speedRef = useRef(speed); speedRef.current = speed || 1;

  useEffect(() => {
    const a = anim.current; const gg = () => geoRef.current;
    const park = () => {
      const G = gg(); const bx = G.roadL + 40; const rx = G.roadR - 40;
      setBus(blueRef.current, blueHeads.current, bx, G.laneF, 0, true); setBus(orangeRef.current, orangeHeads.current, rx, G.laneR, 0, true);
    };
    const resync = () => { const s = evRef.current.s; a.blue = { phase: "idle", p: 0, n: 0, boarded: s.nF }; a.orange = { phase: "idle", p: 0, n: 0, boarded: s.nR }; park(); };
    if (reduced) { resync(); return undefined; }
    let raf = 0; let last = null; let cancelled = false;
    const step = (bus, counter, dt, dir) => {
      const G = gg(); const x0 = dir > 0 ? G.roadL + 40 : G.roadR - 40; const x1 = dir > 0 ? G.roadR - 40 : G.roadL + 40;
      if (bus.phase === "idle") { const pend = counter - bus.boarded; if (pend > 0) { bus.phase = "go"; bus.p = 0; bus.n = pend; bus.boarded = counter; } }
      else if (bus.phase === "go") { bus.p += dt / TRIP_S; if (bus.p >= 1) { bus.p = 1; bus.phase = "dwell"; bus.t = 0; } }
      else if (bus.phase === "dwell") { bus.t += dt; if (bus.t >= DWELL_S) { bus.phase = "idle"; bus.n = 0; bus.p = 0; } }
      const x = bus.phase === "idle" ? x0 : x0 + (x1 - x0) * smooth(bus.p);
      return { x, onBoard: bus.phase === "go" ? bus.n : 0, shownN: bus.phase === "go" ? bus.n : bus.phase === "dwell" ? bus.n : 0 };
    };
    const frame = (now) => {
      if (cancelled) return;
      const s = evRef.current.s; const G = gg();
      if (a.seen > s.t + 1e-9 || (s.t === 0 && (s.nF === 0 && s.nR === 0))) { resync(); }
      a.seen = s.t;
      const dt = last == null ? 0 : Math.min((now - last) / 1000, globalThis.__EQ_DT_MAX ?? 0.1) * speedRef.current;
      last = now;
      {
        const rb = step(a.blue, s.nF, dt, +1); const ro = step(a.orange, s.nR, dt, -1);
        setBus(blueRef.current, blueHeads.current, rb.x, G.laneF, rb.shownN, true); setBus(orangeRef.current, orangeHeads.current, ro.x, G.laneR, ro.shownN, true);
      }
      if (runRef.current) raf = requestAnimationFrame(frame);
    };
    const runRef = { current: running };
    // paint once from the animator's own state (a paused bus stays exactly where it was: frozen, not reset)
    frame(performance.now());
    if (running) raf = requestAnimationFrame(frame);
    return () => { cancelled = true; runRef.current = false; cancelAnimationFrame(raf); };
  }, [running, reduced, g.W, g.laneF, g.laneR]);

  const unit = unitFor(Math.max(ev.s.A, ev.s.B), g.cols * 4);
  const figs = (n) => (n <= 0 ? 0 : Math.max(1, Math.round(n / unit)));
  const grid = (count, x0, color) => Array.from({ length: count }, (_, i) => { const c = i % g.cols; const r = Math.floor(i / g.cols); return <Person key={i} x={x0 + 22 + c * ((g.sw - 40) / g.cols) + 6} y={g.yS + 88 + r * 25} color={color} />; });
  const attained = ev.phase === "attained";
  const label = `Two cities connected by a two-way road. City A has ${ev.s.A} people and City B has ${ev.s.B}. The blue bus carries people from A to B at ${fmt(snap.rfDet)} people per time unit; the orange bus carries people from B to A at ${fmt(snap.rrDet)}.`;
  return (
    <div className={"eq-scene eq-scene--everyday" + (attained ? " is-eq" : "")} data-testid="everyday-scene" data-people-a={ev.s.A} data-people-b={ev.s.B}>
      <svg viewBox={`0 0 ${g.W} ${g.H}`} role="img" aria-label={label} preserveAspectRatio="xMidYMid meet">
        <rect x="0" y="0" width={g.W} height={g.H} rx="16" className="eq-sceneBg" />
        {/* road */}
        <rect x={g.roadL - 4} y={g.roadTop} width={g.roadR - g.roadL + 8} height={g.roadBottom - g.roadTop} rx="14" className="eq-road" />
        <line x1={g.roadL + 6} x2={g.roadR - 6} y1={(g.laneF + g.laneR) / 2} y2={(g.laneF + g.laneR) / 2} className="eq-lane" />
        <text x={g.roadL + 14} y={g.roadTop + 20} className="eq-lanelabel" fill={FWD}>A → B</text>
        <text x={g.roadR - 14} y={g.roadBottom - 10} textAnchor="end" className="eq-lanelabel" fill={REV}>B → A</text>
        {/* stations */}
        {[{ x: g.xA, name: "City A", n: ev.s.A, c: A_COLOR, vis: ev.s.A, id: "a" }, { x: g.xB, name: "City B", n: ev.s.B, c: B_COLOR, vis: ev.s.B, id: "b" }].map((s) => (
          <g key={s.id} data-testid={`city-${s.id}`}>
            <rect x={s.x} y={g.yS} width={g.sw} height={g.hS} rx="14" className={"eq-station" + (attained ? " is-eq" : "")} stroke={s.c} />
            <rect x={s.x} y={g.yS} width={g.sw} height="60" rx="14" fill={s.c} opacity=".13" /><rect x={s.x} y={g.yS + 46} width={g.sw} height="14" fill={s.c} opacity=".13" />
            <text x={s.x + 14} y={g.yS + 26} className="eq-city" fill={s.c}>{s.name}</text>
            <text x={s.x + g.sw - 14} y={g.yS + 49} textAnchor="end" className="eq-count" fill={s.c} data-testid={`count-${s.id}`}>{s.n}</text>
            <text x={s.x + 14} y={g.yS + 49} className="eq-countlabel">people</text>
            {grid(figs(s.vis), s.x, s.c)}
          </g>))}
        {unit > 1 && <text x={g.W / 2} y={g.H - 8} textAnchor="middle" className="eq-unit" data-testid="figure-unit">1 figure = {unit} people (counters show exact numbers)</text>}
        <Bus id="bus-forward" color={FWD} label="A→B" facing="right" refEl={blueRef} headsRef={blueHeads} n={0} shown />
        <Bus id="bus-reverse" color={REV} label="B→A" facing="left" refEl={orangeRef} headsRef={orangeHeads} n={0} shown />
        {/* live rates */}
        <g className="eq-ratechips">
          <rect x={g.W / 2 - 112} y={g.chipTop} width="224" height="24" rx="12" fill="#fff" stroke={FWD} strokeWidth="1.8" />
          <text x={g.W / 2} y={g.chipTop + 16} textAnchor="middle" className="eq-chiptxt" data-testid="rate-forward-chip">{simple ? "A → B" : "Forward rate"}: {fmt(snap.rfDet)} / time unit</text>
          <rect x={g.W / 2 - 112} y={g.chipBot} width="224" height="24" rx="12" fill="#fff" stroke={REV} strokeWidth="1.8" />
          <text x={g.W / 2} y={g.chipBot + 16} textAnchor="middle" className="eq-chiptxt" data-testid="rate-reverse-chip">{simple ? "B → A" : "Reverse rate"}: {fmt(snap.rrDet)} / time unit</text>
        </g>
        {attained && (<g className="eq-eqbadge"><rect x={g.W / 2 - 92} y={g.roadTop + 3} width="184" height="22" rx="11" /><text x={g.W / 2} y={g.roadTop + 18} textAnchor="middle">Forward rate = Reverse rate</text></g>)}
      </svg>
    </div>
  );
}
export default memo(EverydayScene);
