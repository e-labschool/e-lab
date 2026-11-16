import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../lib/acidbase/acidbase-ui.css";
import "./BufferActionVisualizer.css";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";
import BeakerGlass from "./components/BeakerGlass.jsx";
import DropperPair from "./components/DropperPair.jsx";
import BufferParticleDot from "./components/BufferParticleDot.jsx";
import { SYSTEMS, ADDITIONS, MAX_ADDITIONS, bufferState, unbufferedState, targetCounts } from "./lib/bufferModel.js";
import { createSample, addSeeker, step, reconcile } from "./lib/particles.js";
import { formatPH, formatDelta, formatDecimal } from "../../lib/acidbase/format.js";

const FRESH = { sysId: "acid", size: "small", h: 0, oh: 0, count: 0, last: null, drop: null, history: [{ x: 0, buf: null, un: null }], prev: null };
const unTarget = (h, oh) => { const net = h - oh; const n = Math.min(10, Math.round(Math.abs(net) / 0.2)); return { acid: 0, base: 0, free: { H: net > 0 ? n : 0, OH: net < 0 ? n : 0 } }; };
function fresh(sysId, size = "small") {
  const sys = SYSTEMS[sysId]; const b = bufferState(sys, 0, 0); const u = unbufferedState(sys, 0, 0);
  return { ...FRESH, sysId, size, history: [{ x: 0, buf: b.pH, un: u.pH }], prev: { buf: b.pH, un: u.pH } };
}

function PHBar({ sys, buf, un }) {
  const lo = sys.pKa - 4, hi = sys.pKa + 4; const pos = (p) => `${Math.min(100, Math.max(0, ((p - lo) / (hi - lo)) * 100))}%`;
  return (
    <div className="buf-bar" aria-hidden="true">
      <div className="buf-bar-range" style={{ left: pos(sys.pKa - 1), width: `${(2 / (hi - lo)) * 100}%` }}><span>pKa {"±"} 1</span></div>
      <div className="buf-bar-mark buf" style={{ left: pos(buf) }}><b>B</b></div>
      <div className="buf-bar-mark un" style={{ left: pos(un) }}><b>U</b></div>
      <div className="buf-bar-ticks"><span style={{ left: pos(Math.ceil(lo)) }}>{Math.ceil(lo)}</span><span style={{ left: pos(sys.pKa) }}>{sys.pKa.toFixed(2)}</span><span style={{ left: pos(Math.floor(hi)) }}>{Math.floor(hi)}</span></div>
    </div>
  );
}

function Trace({ history, sys }) {
  const W = 300, H = 130, L = 28, B = 22, T = 6, R = 8;
  const maxX = Math.max(2, ...history.map((p) => Math.abs(p.x))); const x = (v) => L + ((v + maxX) / (2 * maxX)) * (W - L - R); const y = (p) => T + ((14 - Math.min(14, Math.max(0, p))) / 14) * (H - T - B);
  const path = (k) => history.map((p, i) => `${i ? "L" : "M"}${x(p.x).toFixed(1)} ${y(p[k]).toFixed(1)}`).join("");
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ab-svg buf-trace" role="img" aria-label={`pH against net acid added in mmol (negative means base). Buffer ends at pH ${formatPH(history[history.length - 1].buf)}, unbuffered at pH ${formatPH(history[history.length - 1].un)}.`}>
      <rect x={L} y={y(sys.pKa + 1)} width={W - L - R} height={y(sys.pKa - 1) - y(sys.pKa + 1)} fill="#f59e0b" fillOpacity="0.16" />
      {[0, 7, 14].map((p) => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="#2b3a50" /><text x={L - 4} y={y(p) + 4} textAnchor="end" fontSize="10" fill="#d3dcea">{p}</text></g>)}
      <line x1={x(0)} x2={x(0)} y1={T} y2={H - B} stroke="#2b3a50" />
      <text x={x(0)} y={H - 8} textAnchor="middle" fontSize="10" fill="#d3dcea">0</text><text x={L} y={H - 8} fontSize="10" fill="#d3dcea">{"−"}{maxX.toFixed(0)} (base)</text><text x={W - R} y={H - 8} textAnchor="end" fontSize="10" fill="#d3dcea">+{maxX.toFixed(0)} mmol H{"⁺"}</text>
      <path d={path("un")} fill="none" stroke="#fda4af" strokeWidth="2" strokeDasharray="5 3" /><path d={path("buf")} fill="none" stroke="#5eead4" strokeWidth="2.5" />
      {history.map((p, i) => <g key={i}><circle cx={x(p.x)} cy={y(p.buf)} r="2.5" fill="#5eead4" /><rect x={x(p.x) - 2.5} y={y(p.un) - 2.5} width="5" height="5" fill="#fda4af" /></g>)}
    </svg>
  );
}

function Body() {
  const { isViewport } = useSimulationPresentation();
  const [st, setSt] = useState(() => fresh("acid"));
  const sys = SYSTEMS[st.sysId];
  const stRef = useRef(st); stRef.current = st;
  const bufP = useRef(null); const unP = useRef(null);
  const [, tick] = useState(0);

  const b = useMemo(() => bufferState(sys, st.h, st.oh), [sys, st.h, st.oh]);
  const u = useMemo(() => unbufferedState(sys, st.h, st.oh), [sys, st.h, st.oh]);
  const rebuild = useCallback((s) => { const sy = SYSTEMS[s.sysId]; const t = targetCounts(sy, s.h, s.oh); bufP.current = createSample(t, 3, t.free); unP.current = createSample({ acid: 0, base: 0 }, 3, unTarget(s.h, s.oh).free); }, []);
  useEffect(() => { rebuild(stRef.current); }, [rebuild]);

  useEffect(() => {
    let raf = 0; let last = null; const reduced = () => window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = (now) => {
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      const s = stRef.current; const sy = SYSTEMS[s.sysId];
      if (bufP.current && unP.current) {
        const f1 = step(bufP.current, dt, reduced()); const f2 = step(unP.current, dt, reduced());
        if (!f1) reconcile(bufP.current, targetCounts(sy, s.h, s.oh));
        if (!f2) reconcile(unP.current, unTarget(s.h, s.oh));
      }
      tick((n) => (n + 1) % 1e9); raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, []);

  const left = MAX_ADDITIONS - st.count;
  function add(type) {
    const s = stRef.current; if (s.count >= MAX_ADDITIONS) return;
    const a = ADDITIONS[s.size]; const h = s.h + (type === "H" ? a.mmol : 0); const oh = s.oh + (type === "OH" ? a.mmol : 0);
    const nb = bufferState(sys, h, oh), nu = unbufferedState(sys, h, oh);
    setSt({ ...s, h, oh, count: s.count + 1, last: type, drop: type, prev: { buf: b.pH, un: u.pH }, history: [...s.history, { x: h - oh, buf: nb.pH, un: nu.pH }] });
    for (let i = 0; i < a.seekers; i += 1) { if (bufP.current) addSeeker(bufP.current, type); if (unP.current) { const sk = addSeeker(unP.current, type); sk.seek = null; } }
    window.setTimeout(() => setSt((x) => (x.drop ? { ...x, drop: null } : x)), 500);
  }
  const changeSys = (id) => { const s = fresh(id, stRef.current.size); setSt(s); rebuild(s); };
  const reset = () => { const s = fresh("acid", "small"); setSt(s); rebuild(s); };
  const reaction = st.last == null ? null : sys.kind === "acid"
    ? (st.last === "H" ? "CH₃COO⁻ + H⁺ → CH₃COOH" : "CH₃COOH + OH⁻ → CH₃COO⁻ + H₂O")
    : (st.last === "H" ? "NH₃ + H⁺ → NH₄⁺" : "NH₄⁺ + OH⁻ → NH₃ + H₂O");
  const dB = formatDelta(b.pH - st.prev.buf), dU = formatDelta(u.pH - st.prev.un);
  const freeCount = (ps, k) => (ps ? ps.filter((p) => p.kind === k).length : 0);
  const realFree = Math.abs(st.h - st.oh) / 0.2;

  return (
    <section className={"ab-root ab-fixed buf sim-surface-dark" + (isViewport ? " is-viewport" : "")}>
      <div className="buf-grid">
        <div className="buf-beakers">
          <div className="buf-col">
            <p className="buf-label">UNBUFFERED: {sys.unbuffered}</p>
            <DropperPair activeDrop={st.drop} />
            <BeakerGlass gradientId="unbuf">{unP.current && unP.current.map((p) => <BufferParticleDot key={p.id} particle={p} system={sys} />)}</BeakerGlass>
            <div className="buf-ph"><span>pH</span><strong data-testid="ph-unbuffered">{formatPH(u.pH)}</strong>{dU && <small>{"Δ"}pH {dU}</small>}</div>
            {realFree > 10 && <p className="ab-note">Showing 10 of {Math.round(realFree)} {st.h > st.oh ? "H⁺" : "OH⁻"} units</p>}
          </div>
          <div className="buf-col">
            <p className="buf-label">BUFFER: {sys.pair}, 0.100 mol dm{"⁻³"} each</p>
            <DropperPair activeDrop={st.drop} />
            <BeakerGlass gradientId="buf">{bufP.current && bufP.current.map((p) => <BufferParticleDot key={p.id} particle={p} system={sys} />)}</BeakerGlass>
            <div className="buf-ph"><span>pH</span><strong data-testid="ph-buffer">{formatPH(b.pH)}</strong>{dB && <small>{"Δ"}pH {dB}</small>}</div>
          </div>
        </div>
        <div className="buf-side">
          <div className="ab-panel buf-ctl">
            <label className="ab-field">Buffer type<select value={st.sysId} onChange={(e) => changeSys(e.target.value)} aria-label="Buffer type"><option value="acid">Acid buffer: CH{"₃"}COOH / CH{"₃"}COO{"⁻"}</option><option value="basic">Basic buffer: NH{"₃"} / NH{"₄⁺"}</option></select></label>
            <label className="ab-field">Addition (1.00 mol dm{"⁻³"} reagent)<select value={st.size} onChange={(e) => setSt({ ...st, size: e.target.value })} aria-label="Addition size">{Object.values(ADDITIONS).map((a) => <option key={a.id} value={a.id}>{a.label}: {a.cm3.toFixed(1)} cm{"³"} = {a.mmol.toFixed(1)} mmol</option>)}</select></label>
            <div className="ab-btns">
              <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("H")}>Add H{"⁺"} (HCl)</button>
              <button type="button" className="sim-btn ab-btn" disabled={left <= 0} onClick={() => add("OH")}>Add OH{"⁻"} (NaOH)</button>
              <button type="button" className="sim-btn ab-btn" onClick={reset}>Reset</button>
            </div>
            <p className="ab-note">Additions: {st.count} of {MAX_ADDITIONS}.{left <= 0 ? " Limit reached: press Reset." : ""} Volume change is included (25.0 {"→"} {b.totalCm3.toFixed(1)} cm{"³"}).</p>
          </div>
          <div className="ab-panel buf-ratio" aria-live="polite" data-testid="ratio">
            <p><strong>{sys.ratioText} = {formatDecimal(b.ratio, 3)}</strong> {"·"} pKa = {sys.pKa.toFixed(2)} {"·"} buffer range pH {(sys.pKa - 1).toFixed(2)}{"–"}{(sys.pKa + 1).toFixed(2)} (ratio 1:10 to 10:1)</p>
            <p className={b.inRange ? "buf-ok" : "buf-bad"}>{b.inRange ? "Inside the effective buffer range." : "BUFFER CAPACITY EXCEEDED: ratio is outside 1:10 to 10:1, pH is more than 1 from pKa."}</p>
            <PHBar sys={sys} buf={b.pH} un={u.pH} />
            <p className="ab-note">B = buffer, U = unbuffered, on a pH scale. Shaded: pKa {"±"} 1.</p>
          </div>
          <div className="ab-panel">
            <p className="buf-label">pH against net acid added</p>
            <Trace history={st.history} sys={sys} />
            <p className="ab-note"><span style={{ color: "#5eead4" }}>Solid</span> buffer, <span style={{ color: "#fda4af" }}>dashed</span> unbuffered. Shaded band: pKa {"±"} 1.</p>
          </div>
          {reaction && <p className="buf-reaction" data-testid="reaction">{reaction}</p>}
        </div>
      </div>
      <div className="buf-legend">
        <span className="ab-chip"><i style={{ background: "#b0841f" }} />{sys.acidLabel} (acid form)</span><span className="ab-chip"><i style={{ background: "#2f86b5" }} />{sys.baseLabel} (base form)</span>
        <span className="ab-chip"><i style={{ background: "#6f7d90" }} />{sys.spectatorLabel} (spectator)</span><span className="ab-chip"><i style={{ background: "#c23b3b" }} />H{"⁺"}</span><span className="ab-chip"><i style={{ background: "#2f4bc4" }} />OH{"⁻"}</span>
        <span className="ab-note">Particle view is a sample: 10 dots stand for the buffer (1 dot = 1 mmol) and always match the pH shown. {freeCount(bufP.current, "H") + freeCount(bufP.current, "OH") > 0 ? "Free H⁺ / OH⁻ appear only once the buffer can no longer absorb them." : ""}</span>
      </div>
      <p className="ab-note buf-copy">{COPYRIGHT_TEXT_COMPACT}</p>
    </section>
  );
}

export default function BufferActionVisualizer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Buffer Action Visualizer" subtitle={"See why a CH₃COOH/CH₃COO⁻ buffer resists pH change, and what happens when its capacity runs out"} compact={compact} standalone={standalone}>
      <Body />
    </InteractiveFrame>
  );
}
