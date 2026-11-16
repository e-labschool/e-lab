import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";
import "../../lib/acidbase/acidbase-ui.css";
import "./TitrationPHCurve.css";
import { REAGENTS, INDICATORS, INDICATOR_LIST, PKA_ETHANOIC, PKB_AMMONIA } from "../../lib/acidbase/constants.js";
import { makeTitration, comparisonSet } from "../../lib/acidbase/titration.js";
import { formatPH } from "../../lib/acidbase/format.js";
import { indicatorColourName, recommendedIndicator, isSuitable } from "../../lib/acidbase/indicators.js";
import { buildExperimentGraph, buildCompareGraph, describeExperiment } from "./lib/graphModel.js";
import { explainPair, titrantNote, compareExplanations } from "./lib/explain.js";
import { ExperimentGraph, CompareGraph } from "./components/TitrationGraph.jsx";
import Apparatus, { PHMeter } from "./components/Apparatus.jsx";

const DEFAULTS = { flask: "CH3COOH", burette: "NaOH", cFlask: 0.1, cBurette: 0.1 };
const CONCS = [0.05, 0.1, 0.2];
const ADD_STEPS = [0.1, 0.5, 1, 5];
const optionText = (r) => `${r.label} — ${r.strong ? "strong" : "weak"} ${r.kind}`;
const tOf = (cfg) => makeTitration({ flaskId: cfg.flask, buretteId: cfg.burette, cFlask: cfg.cFlask, cBurette: cfg.cBurette });

function initialRun(cfg) { const t = tOf(cfg); return { cfg, v: 0, points: [{ v: 0, pH: t.phAt(0) }], dropKey: 0 }; }

// Pure reducer: no side effects inside state updaters (safe under StrictMode).
function reducer(state, a) {
  if (a.type === "config") { let cfg = { ...state.cfg, ...a.patch }; const f = REAGENTS[cfg.flask]; const b = REAGENTS[cfg.burette]; if (f.kind === b.kind) cfg = { ...cfg, burette: f.kind === "acid" ? "NaOH" : "HCl" }; return initialRun(cfg); }
  if (a.type === "reset") return initialRun(DEFAULTS);
  const t = tOf(state.cfg);
  if (a.type === "add" || a.type === "auto") {
    if (state.v >= t.axisMax - 1e-9) return state;
    let amount = a.amount;
    if (a.type === "auto") amount = Math.abs(state.v - t.veq) < 0.08 * t.veq ? t.veq / 100 : t.veq / 25;
    const v = Math.min(t.axisMax, Math.round((state.v + amount) * 1000) / 1000);
    return { ...state, v, points: [...state.points, { v, pH: t.phAt(v) }], dropKey: state.dropKey + 1 };
  }
  return state;
}

function useSize(ref) {
  const [size, setSize] = useState({ w: 640, h: 340 });
  useEffect(() => {
    const el = ref.current; if (!el || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => { const r = el.getBoundingClientRect(); if (r.width > 40 && r.height > 40) setSize({ w: Math.floor(r.width), h: Math.floor(r.height) }); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(el); return () => ro.disconnect();
  }, [ref]);
  return size;
}

function Body() {
  const { isViewport } = useSimulationPresentation();
  const [run, dispatch] = useReducer(reducer, DEFAULTS, initialRun);
  const { cfg } = run;
  const [mode, setMode] = useState("experiment");
  const [showExpected, setShowExpected] = useState(true);
  const [showFeatures, setShowFeatures] = useState(true);
  const [indChoice, setIndChoice] = useState(null); // null = recommended for the pair
  const [side, setSide] = useState("acid");
  const [weakWeak, setWeakWeak] = useState(false);
  const [auto, setAuto] = useState(false);
  const stageRef = useRef(null);
  const size = useSize(stageRef);

  const t = useMemo(() => tOf(cfg), [cfg]);
  const rec = recommendedIndicator(t);
  const indicatorId = indChoice === null ? rec : indChoice === "none" ? null : indChoice;
  const cur = run.points[run.points.length - 1];
  const state = t.stateAt(run.v);
  const stage = t.stageText(state);
  const atMax = run.v >= t.axisMax - 1e-9;

  useEffect(() => {
    if (!auto) return undefined;
    if (atMax) { setAuto(false); return undefined; }
    const id = setInterval(() => dispatch({ type: "auto" }), 550);
    return () => clearInterval(id);
  }, [auto, atMax]);

  const setCfg = (patch) => { setAuto(false); setIndChoice(null); dispatch({ type: "config", patch }); };
  const resetAll = () => { setAuto(false); setIndChoice(null); setMode("experiment"); setShowExpected(true); setShowFeatures(true); setSide("acid"); setWeakWeak(false); dispatch({ type: "reset" }); };

  const set = useMemo(() => comparisonSet({ side, cFlask: cfg.cFlask, cBurette: cfg.cBurette, includeWeakWeak: weakWeak }), [side, cfg.cFlask, cfg.cBurette, weakWeak]);
  const gw = Math.max(260, size.w); const gh = Math.max(200, size.h);
  const expGraph = useMemo(() => (mode === "experiment" ? buildExperimentGraph(t, { W: gw, H: gh, points: run.points, showExpected, showFeatures, indicatorId }) : null), [mode, t, gw, gh, run.points, showExpected, showFeatures, indicatorId]);
  const cmpGraph = useMemo(() => (mode === "compare" ? buildCompareGraph(set, { W: gw, H: gh }) : null), [mode, set, gw, gh]);
  const explain = explainPair(t); const tnote = titrantNote(t);
  const xTitle = `Volume of ${t.burette.label} added / cm³`;
  const bufferCmp = (c) => (c.t.buffer ? `${c.t.buffer.vLow.toFixed(1)}–${c.t.buffer.vHigh.toFixed(1)} cm³ (pH ${(c.t.buffer.pKa - 1).toFixed(2)}–${(c.t.buffer.pKa + 1).toFixed(2)})` : "none");
  const eqRel = (pH) => (Math.abs(pH - 7) < 0.05 ? "= 7" : pH > 7 ? "> 7" : "< 7");
  const indSuit = indicatorId ? isSuitable(indicatorId, t) : null;

  return (
    <section className={"ab-root ab-fixed tit sim-surface-dark" + (isViewport ? " is-viewport" : "")} data-testid="titration-root">
      <div className="ab-row tit-setup">
        <label className="ab-field"><span>Flask (25.0 cm{"³"})</span>
          <select value={cfg.flask} disabled={mode === "compare"} onChange={(e) => setCfg({ flask: e.target.value })} aria-label="Flask solution">
            {Object.values(REAGENTS).map((r) => <option key={r.id} value={r.id}>{optionText(r)}</option>)}
          </select></label>
        <label className="ab-field"><span>Burette</span>
          <select value={cfg.burette} disabled={mode === "compare"} onChange={(e) => setCfg({ burette: e.target.value })} aria-label="Burette solution">
            {Object.values(REAGENTS).filter((r) => r.kind !== REAGENTS[cfg.flask].kind).map((r) => <option key={r.id} value={r.id}>{optionText(r)}</option>)}
          </select></label>
        <label className="ab-field"><span>Flask conc.</span>
          <select value={cfg.cFlask} onChange={(e) => setCfg({ cFlask: Number(e.target.value) })} aria-label="Flask concentration">{CONCS.map((c) => <option key={c} value={c}>{c.toFixed(3)} mol dm{"⁻³"}</option>)}</select></label>
        <label className="ab-field"><span>Burette conc.</span>
          <select value={cfg.cBurette} onChange={(e) => setCfg({ cBurette: Number(e.target.value) })} aria-label="Burette concentration">{CONCS.map((c) => <option key={c} value={c}>{c.toFixed(3)} mol dm{"⁻³"}</option>)}</select></label>
        <label className="ab-field"><span>Indicator</span>
          <select value={indChoice ?? "auto"} onChange={(e) => setIndChoice(e.target.value === "auto" ? null : e.target.value)} aria-label="Indicator" disabled={mode === "compare"}>
            <option value="auto">{rec ? `Recommended: ${INDICATORS[rec].label}` : "Recommended: none (use pH meter)"}</option>
            {INDICATOR_LIST.map((i) => <option key={i.id} value={i.id}>{i.label} (pH {i.low.toFixed(1)}{"–"}{i.high.toFixed(1)})</option>)}
            <option value="none">No indicator (pH meter only)</option>
          </select></label>
        <div className="ab-btns tit-modes" role="group" aria-label="View">
          <button type="button" className="sim-btn ab-btn" aria-pressed={mode === "experiment"} onClick={() => setMode("experiment")}>Experiment</button>
          <button type="button" className="sim-btn ab-btn" aria-pressed={mode === "compare"} onClick={() => { setAuto(false); setMode("compare"); }}>Compare</button>
        </div>
      </div>

      <div className={"tit-main" + (mode === "compare" ? " is-compare" : "")}>
        {mode === "experiment" && (
          <div className="ab-panel tit-lab">
            <Apparatus t={t} v={run.v} pH={cur.pH} indicatorId={indicatorId} dropKey={run.dropKey} />
            <PHMeter pH={cur.pH} />
            {indicatorId && <p className="ab-note tit-ind-note">{INDICATORS[indicatorId].label}: <strong>{indicatorColourName(indicatorId, cur.pH)}</strong></p>}
          </div>
        )}
        <div className="ab-panel tit-chart">
          <div className="ab-row tit-chart-head">
            {mode === "experiment" ? (
              <>
                <h3 className="tit-h">pH curve: {t.burette.label} added to {t.flask.label}</h3>
                <div className="ab-btns">
                  <button type="button" className="sim-btn ab-btn" aria-pressed={showExpected} onClick={() => setShowExpected((x) => !x)} title="Dense theoretical curve from the exact solver">Expected curve</button>
                  <button type="button" className="sim-btn ab-btn" aria-pressed={showFeatures} onClick={() => setShowFeatures((x) => !x)}>Features</button>
                </div>
              </>
            ) : (
              <>
                <h3 className="tit-h">Compare strong and weak, same concentrations ({cfg.cFlask.toFixed(3)} into {cfg.cBurette.toFixed(3)} mol dm{"⁻³"})</h3>
                <div className="ab-btns">
                  <button type="button" className="sim-btn ab-btn" aria-pressed={side === "acid"} onClick={() => setSide("acid")}>Acid in flask</button>
                  <button type="button" className="sim-btn ab-btn" aria-pressed={side === "base"} onClick={() => setSide("base")}>Base in flask</button>
                  <button type="button" className="sim-btn ab-btn" aria-pressed={weakWeak} onClick={() => setWeakWeak((x) => !x)}>+ weak/weak</button>
                </div>
              </>
            )}
          </div>
          <div className="tit-stage" ref={stageRef}>
            {mode === "experiment" && expGraph && <ExperimentGraph m={expGraph} showExpected={showExpected} xTitle={xTitle} description={describeExperiment(t, cur)} />}
            {mode === "compare" && cmpGraph && <CompareGraph m={cmpGraph} xTitle={xTitle.replace(t.burette.label, side === "acid" ? "NaOH / HCl titrant" : "titrant")} description={`Comparison of ${set.map((s) => s.name).join(", ")}. ${set.map((s) => `${s.name}: initial pH ${formatPH(s.titration.initial.pH)}, equivalence pH ${formatPH(s.titration.eq.pH)}`).join(". ")}.`} />}
          </div>
          {mode === "experiment" ? (
            <div className="tit-legend" data-testid="legend">
              {showExpected && <span className="ab-chip"><i style={{ background: "#9db8e8", opacity: 0.7 }} />Expected curve (exact calculation)</span>}
              <span className="ab-chip"><i style={{ background: "#ffd166" }} />Your readings</span>
              {showFeatures && t.buffer && <span className="ab-chip"><i style={{ background: "#f59e0b" }} />Buffer region: {t.buffer.species.ratioText}, pH = pKa {"±"} 1 ({t.buffer.vLow.toFixed(1)}{"–"}{t.buffer.vHigh.toFixed(1)} cm{"³"})</span>}
              {showFeatures && t.halfEq && <span className="ab-chip"><i style={{ background: "#d8b4fe" }} />Half-equivalence ({t.halfEq.v.toFixed(1)} cm{"³"}): pH = pKa = {t.buffer.pKa.toFixed(2)}</span>}
              {showFeatures && <span className="ab-chip"><i style={{ background: "#5eead4" }} />Equivalence ({t.veq.toFixed(1)} cm{"³"}): pH {formatPH(t.eq.pH)} {eqRel(t.eq.pH)}</span>}
              {showFeatures && <span className="ab-chip"><i style={{ background: "#fda4af" }} />Steep region: Veq {"±"} 1%, pH jumps {t.steep.jump.toFixed(1)}</span>}
              {indicatorId && <span className="ab-chip"><i style={{ background: "#e2e8f0", opacity: 0.5 }} />{INDICATORS[indicatorId].short} = {INDICATORS[indicatorId].label} pH {INDICATORS[indicatorId].low.toFixed(1)}{"–"}{INDICATORS[indicatorId].high.toFixed(1)}{indSuit === false ? " (not suitable here)" : ""}</span>}
            </div>
          ) : (
            <>
            <div className="tit-legend" data-testid="legend">
              <span className="ab-chip"><i style={{ background: "#e2e8f0", borderRadius: 5, width: 10 }} />Circle = initial pH</span>
              <span className="ab-chip"><i style={{ background: "#e2e8f0", width: 10, transform: "rotate(45deg)" }} />Diamond = equivalence point</span>
              <span className="ab-chip"><i style={{ background: "#f59e0b" }} />Buffer region (weak acid/base titrated by a strong one only): [salt]/[weak] between 1:10 and 10:1, pH = pKa {"\u00B1"} 1</span>
              <span className="ab-chip"><i style={{ background: "#e2e8f0", opacity: 0.5 }} />Grey bands = indicator ranges</span>
            </div>
            <table className="ab-table tit-compare-table" data-testid="compare-table">
              <thead><tr><th scope="col">Curve</th><th scope="col">Initial pH</th><th scope="col">Equivalence pH</th><th scope="col">Buffer region</th><th scope="col">pH jump</th></tr></thead>
              <tbody>
                {cmpGraph.curves.map((c) => (
                  <tr key={c.id}><th scope="row"><span className="ab-chip"><i style={{ background: c.colour }} />{c.name}</span></th><td>{formatPH(c.t.initial.pH)}</td><td>{formatPH(c.t.eq.pH)} ({eqRel(c.t.eq.pH)})</td><td>{bufferCmp(c)}</td><td>{c.t.steep.jump.toFixed(1)}</td></tr>
                ))}
              </tbody>
            </table>
            </>
          )}
          {mode === "experiment" ? (
            <p className="ab-note tit-explain" data-testid="explain"><strong>{explain.title}.</strong> {explain.text} {tnote}</p>
          ) : (
            <details className="ab-note tit-explain" open>
              <summary>Indicator ranges (grey bands): {INDICATOR_LIST.map((i) => `${i.short} = ${i.label} ${i.low.toFixed(1)}–${i.high.toFixed(1)}`).join("; ")}. Why the curves differ</summary>
              {compareExplanations(set).map((e) => <p key={e.id}><strong>{e.title}.</strong> {e.text}</p>)}
            </details>
          )}
          {!showExpected && !showFeatures && mode === "experiment" && <p className="ab-note">Predict first: sketch the curve, then switch on {"“"}Expected curve{"”"} to check.</p>}
        </div>
      </div>

      <div className="ab-strip tit-bottom">
        {mode === "experiment" ? (
          <>
            <div className="ab-readout"><span>Added</span><strong>{run.v.toFixed(2)} cm{"³"}</strong></div>
            <div className="ab-readout"><span>pH</span><strong data-testid="ph-readout">{formatPH(cur.pH)}</strong></div>
            <div className="ab-readout tit-state" aria-live="polite"><span>State</span><strong data-testid="state-text">{stage.text}{t.regionAt(run.v) === "buffer" ? " · in buffer region" : ""}</strong></div>
            <div className="ab-btns tit-adds" role="group" aria-label="Add titrant">
              {ADD_STEPS.map((a) => <button key={a} type="button" className="sim-btn ab-btn" disabled={atMax} onClick={() => dispatch({ type: "add", amount: a })}>+{a.toFixed(1)} cm{"³"}</button>)}
              <button type="button" className="sim-btn ab-btn" aria-pressed={auto} disabled={atMax} onClick={() => setAuto((x) => !x)}>{auto ? "Pause" : "Auto add"}</button>
            </div>
            {atMax && <span className="ab-note ab-warn">Axis limit {t.axisMax} cm{"³"} reached (about twice Veq); press Reset to start again.</span>}
          </>
        ) : (
          <span className="ab-note">Concentrations come from the selectors above; all curves use 25.0 cm{"³"} in the flask at 298 K, pKa(CH{"₃"}COOH) = {PKA_ETHANOIC.toFixed(2)}, pKb(NH{"₃"}) = {PKB_AMMONIA.toFixed(2)}.</span>
        )}
        <button type="button" className="sim-btn ab-btn tit-reset" onClick={resetAll}>Reset</button>
      </div>
      <p className="ab-sr-only" aria-live="polite">{mode === "experiment" ? `${run.v.toFixed(2)} cubic centimetres added, pH ${formatPH(cur.pH)}. ${stage.text}.` : "Comparison view"}</p>
      <table className="ab-sr-only"><caption>Recorded readings</caption><thead><tr><th>Volume added / cm3</th><th>pH</th></tr></thead><tbody>{run.points.map((p, i) => <tr key={i}><td>{p.v.toFixed(2)}</td><td>{formatPH(p.pH)}</td></tr>)}</tbody></table>
      <p className="ab-note tit-copy">{COPYRIGHT_TEXT_COMPACT} {"·"} 298 K, pKa 4.76, pKb 4.75, ideal behaviour.</p>
    </section>
  );
}

export default function TitrationPHCurve({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="pH Curve & Titration Visualizer" subtitle={"A numerical acid/base equilibrium solver — build real titration curves for strong and weak monoprotic systems"} compact={compact} standalone={standalone}>
      <Body />
    </InteractiveFrame>
  );
}
