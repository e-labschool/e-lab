import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../lib/acidbase/acidbase-ui.css";
import "./Neutralization.css";
import { formatPH } from "../../lib/acidbase/format.js";
import { neutralisation, MIN_PARTICLES, MAX_PARTICLES, BEAKER_CM3 } from "./lib/model.js";
import { createWorld, startMix, stepWorld, TYPES, BEAKERS } from "./lib/sim.js";

const DEFAULT_N = 4;
const prefersReduced = () => typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function Beaker({ b, label, sub, fillColour }) {
  const top = b.y - 22; // meniscus a little above the particle area
  return (
    <g>
      <path d={`M${b.x - 8} ${top - 30} V${b.y + b.h + 4} Q${b.x - 8} ${b.y + b.h + 16} ${b.x + 6} ${b.y + b.h + 16} H${b.x + b.w - 6} Q${b.x + b.w + 8} ${b.y + b.h + 16} ${b.x + b.w + 8} ${b.y + b.h + 4} V${top - 30}`} fill="none" stroke="#94a3b8" strokeWidth="3" />
      <path d={`M${b.x - 12} ${top - 30} h-6 M${b.x + b.w + 12} ${top - 30} h6`} stroke="#94a3b8" strokeWidth="3" />
      <path d={`M${b.x - 5} ${top} H${b.x + b.w + 5} V${b.y + b.h + 4} Q${b.x + b.w + 5} ${b.y + b.h + 13} ${b.x + b.w - 6} ${b.y + b.h + 13} H${b.x + 6} Q${b.x - 5} ${b.y + b.h + 13} ${b.x - 5} ${b.y + b.h + 4} Z`} fill={fillColour} />
      <line x1={b.x - 5} x2={b.x + b.w + 5} y1={top} y2={top} stroke="#cbd5e1" strokeWidth="1.5" />
      <text x={b.x + b.w / 2} y={b.y + b.h + 38} textAnchor="middle" fontSize="15" fontWeight="700" fill="#f1f5f9">{label}</text>
      {sub && <text x={b.x + b.w / 2} y={b.y + b.h + 55} textAnchor="middle" fontSize="12" fill="#b9c4d4">{sub}</text>}
    </g>
  );
}

function Body() {
  const { isViewport } = useSimulationPresentation();
  const [nA, setNA] = useState(DEFAULT_N);
  const [nB, setNB] = useState(DEFAULT_N);
  const worldRef = useRef(null);
  const [, redraw] = useReducer((x) => x + 1, 0);
  const [stage, setStage] = useState("separate");
  const rafRef = useRef(0);
  const m = useMemo(() => neutralisation(nA, nB), [nA, nB]);

  function build(a, b) { cancelAnimationFrame(rafRef.current); worldRef.current = createWorld(a, b); setStage("separate"); redraw(); }
  useEffect(() => { build(nA, nB); return () => cancelAnimationFrame(rafRef.current); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Animation loop runs ONLY while particles are moving (separate beakers drift; mixing runs; stops at "done").
  useEffect(() => {
    let last = null; let alive = true;
    function tick(now) {
      if (!alive) return;
      const dt = last == null ? 0 : Math.min(0.05, (now - last) / 1000); last = now;
      const w = worldRef.current; if (!w) { rafRef.current = requestAnimationFrame(tick); return; }
      if (w.stage !== "done" && !(prefersReduced() && w.stage === "separate")) stepWorld(w, dt, false);
      if (w.stage === "done" && stage !== "done") setStage("done");
      redraw();
      if (w.stage !== "done") rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { alive = false; cancelAnimationFrame(rafRef.current); };
  }, [stage]);

  function changeCounts(a, b) { setNA(a); setNB(b); build(a, b); }
  function mix() {
    const w = worldRef.current; if (!w || w.stage !== "separate") return;
    startMix(w); setStage("mixing");
    if (prefersReduced()) { stepWorld(w, 0.01, true); while (w.stage !== "done") stepWorld(w, 0.01, true); setStage("done"); redraw(); }
  }
  const replay = () => build(nA, nB);
  const reset = () => { setNA(DEFAULT_N); setNB(DEFAULT_N); build(DEFAULT_N, DEFAULT_N); };

  const w = worldRef.current;
  const done = stage === "done";
  const separate = stage === "separate";
  const status = separate ? "Two solutions, not yet mixed." : done
    ? (m.result === "neutral" ? `All ${m.reacted} H\u207A and OH\u207B pairs reacted: neither is left over, so the solution is neutral (pH ${formatPH(m.pH)}).` : `${m.reacted} pairs reacted. ${m.limiting} was the limiting reagent; ${m.result === "acidic" ? `${m.excessH} H\u207A` : `${m.excessOH} OH\u207B`} left over, so the solution is ${m.result} (pH ${formatPH(m.pH)}).`)
    : `Mixing: ${w ? w.reacted : 0} of ${m.reacted} pairs have reacted.`;

  return (
    <section className={"ab-root neu sim-surface-dark" + (isViewport ? " is-viewport" : "")}>
      <div className="neu-main">
        <div className="ab-panel neu-stage">
          <svg viewBox="0 0 600 420" className="ab-svg neu-svg" role="img" aria-label={`Particle diagram: ${nA} HCl formula units and ${nNaOHText(nB)} ${separate ? "in separate beakers" : done ? "after mixing" : "mixing"}. ${status}`}>
            {separate ? (<>
              <Beaker b={BEAKERS.left} label="HCl(aq)" sub={`${m.cHCl.toFixed(3)} mol dm\u207B\u00B3, ${BEAKER_CM3.toFixed(1)} cm\u00B3`} fillColour="rgba(232,121,100,0.22)" />
              <Beaker b={BEAKERS.right} label="NaOH(aq)" sub={`${m.cNaOH.toFixed(3)} mol dm\u207B\u00B3, ${BEAKER_CM3.toFixed(1)} cm\u00B3`} fillColour="rgba(108,134,238,0.24)" />
            </>) : (
              <Beaker b={BEAKERS.mixed} label={done ? "Final solution" : "Mixed solution"} sub={`${2 * BEAKER_CM3} cm\u00B3`} fillColour="rgba(150,175,215,0.2)" />
            )}
            {w && w.particles.map((p) => { const t = TYPES[p.type]; return (
              <g key={p.id}><circle cx={p.x} cy={p.y} r={t.r} fill={t.colour} stroke="#0e1520" strokeWidth="1" /><text x={p.x} y={p.y + 3.5} textAnchor="middle" fontSize={p.type === "OH" || p.type === "W" ? 8.5 : 9.5} fontWeight="700" fill="#fff">{t.label}</text></g>); })}
          </svg>
          <div className="neu-legend">
            <span className="ab-chip"><i style={{ background: TYPES.H.colour }} />H{"\u207A"} (reacts)</span><span className="ab-chip"><i style={{ background: TYPES.OH.colour }} />OH{"\u207B"} (reacts)</span>
            <span className="ab-chip"><i style={{ background: TYPES.NA.colour }} />Na{"\u207A"} (spectator)</span><span className="ab-chip"><i style={{ background: TYPES.CL.colour }} />Cl{"\u207B"} (spectator)</span><span className="ab-chip"><i style={{ background: TYPES.W.colour }} />H{"\u2082"}O</span>
          </div>
        </div>
        <div className="neu-side">
          <div className="ab-panel neu-ctl">
            <label className="ab-field">Amount of HCl: {nA} particles ({nA} mmol)
              <input type="range" min={MIN_PARTICLES} max={MAX_PARTICLES} value={nA} disabled={!separate} aria-label="Amount of HCl in particles" onChange={(e) => changeCounts(Number(e.target.value), nB)} /></label>
            <label className="ab-field">Amount of NaOH: {nB} particles ({nB} mmol)
              <input type="range" min={MIN_PARTICLES} max={MAX_PARTICLES} value={nB} disabled={!separate} aria-label="Amount of NaOH in particles" onChange={(e) => changeCounts(nA, Number(e.target.value))} /></label>
            <p className="ab-note">1 particle = 1.0 mmol in 25.0 cm{"\u00B3"}. {separate ? "Choose the amounts, then mix." : "Press Replay to change the amounts."}</p>
            <div className="ab-btns">
              <button type="button" className="sim-btn sim-btn--primary ab-btn" disabled={!separate} onClick={mix}>Mix</button>
              <button type="button" className="sim-btn ab-btn" disabled={separate} onClick={replay}>Replay</button>
              <button type="button" className="sim-btn ab-btn" onClick={reset}>Reset</button>
            </div>
          </div>
          <div className="ab-panel neu-out" aria-live="polite">
            <p className="neu-status" data-testid="status">{status}</p>
            <table className="ab-table"><tbody>
              <tr><th scope="row">Limiting reagent</th><td>{m.limiting === "none" ? "none (equal amounts)" : m.limiting}</td></tr>
              <tr><th scope="row">Left over</th><td>{m.excessH ? `${m.excessH} mmol H\u207A` : m.excessOH ? `${m.excessOH} mmol OH\u207B` : "nothing"}</td></tr>
              <tr><th scope="row">Final pH (50 cm{"\u00B3"})</th><td>{formatPH(m.pH)} ({m.result})</td></tr>
            </tbody></table>
          </div>
          <div className="ab-panel neu-eqs" data-testid="equations">
            <p><span className="neu-k">Formula</span> HCl(aq) + NaOH(aq) {"\u2192"} NaCl(aq) + H{"\u2082"}O(l)</p>
            <p><span className="neu-k">Ionic</span> H{"\u207A"}(aq) + <s className="neu-spec">Cl{"\u207B"}(aq)</s> + <s className="neu-spec">Na{"\u207A"}(aq)</s> + OH{"\u207B"}(aq) {"\u2192"} <s className="neu-spec">Na{"\u207A"}(aq)</s> + <s className="neu-spec">Cl{"\u207B"}(aq)</s> + H{"\u2082"}O(l)</p>
            <p><span className="neu-k">Net ionic</span> <strong>H{"\u207A"}(aq) + OH{"\u207B"}(aq) {"\u2192"} H{"\u2082"}O(l)</strong></p>
            <p className="ab-note">Crossed-out ions are spectator ions: they are present before and after and do not take part. H{"\u207A"} stands for H{"\u2083"}O{"\u207A"}. Illustrative: the pairs react one after another, real solutions react far faster.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
const nNaOHText = (n) => `${n} NaOH formula units`;

export default function NeutralizationParticleVisualizer({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Neutralization Particle Visualizer" subtitle="What happens when HCl and NaOH solutions mix?" compact={compact} standalone={standalone}>
      <Body />
    </InteractiveFrame>
  );
}
