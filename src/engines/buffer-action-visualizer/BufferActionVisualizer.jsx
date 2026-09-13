import { useState, useCallback, useMemo } from "react";
import "./BufferActionVisualizer.css";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";
import BufferParticles from "./components/BufferParticles.jsx";
import {
  createInitialState,
  bufferPH,
  unbufferedPH,
  addAcidToBuffer,
  addBaseToBuffer,
  addAcidToUnbuffered,
  addBaseToUnbuffered,
  isBufferCapacityExceeded,
  getBufferParticleCounts,
  ADDITION_SIZES,
} from "./lib/bufferChemistry.js";

function formatPH(v) {
  return Number.isFinite(v) ? v.toFixed(2) : "\u2014";
}
function formatDelta(v) {
  if (!Number.isFinite(v)) return "\u2014";
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

export default function BufferActionVisualizer() {
  const [state, setState] = useState(createInitialState);
  const [additionSize, setAdditionSize] = useState("Small");
  const [lastAction, setLastAction] = useState(null); // "acid" | "base" | null
  const [prevPH, setPrevPH] = useState(() => {
    const s = createInitialState();
    return { buffer: bufferPH(s.buffer.acidMoles, s.buffer.baseMoles, s.buffer.excessStrong), unbuffered: unbufferedPH(s.unbuffered.netH) };
  });
  const [history, setHistory] = useState(() => [{ step: 0, buffer: null, unbuffered: null }]);
  const [showExplanation, setShowExplanation] = useState(false);

  const currentBufferPH = bufferPH(state.buffer.acidMoles, state.buffer.baseMoles, state.buffer.excessStrong);
  const currentUnbufferedPH = unbufferedPH(state.unbuffered.netH);
  const exceeded = isBufferCapacityExceeded(state.buffer);
  const particleCounts = getBufferParticleCounts(state.buffer);

  const deltaBuffer = history.length > 1 ? currentBufferPH - prevPH.buffer : null;
  const deltaUnbuffered = history.length > 1 ? currentUnbufferedPH - prevPH.unbuffered : null;

  const bufferTotal = state.buffer.acidMoles + state.buffer.baseMoles;
  const acidBarPct = bufferTotal > 0 ? (state.buffer.acidMoles / bufferTotal) * 100 : 50;
  const baseBarPct = bufferTotal > 0 ? (state.buffer.baseMoles / bufferTotal) * 100 : 50;

  const handleAdd = useCallback(
    (type) => {
      const amount = ADDITION_SIZES[additionSize];
      setPrevPH({ buffer: currentBufferPH, unbuffered: currentUnbufferedPH });
      setState((prev) => {
        const nextBuffer = type === "acid" ? addAcidToBuffer(prev.buffer, amount) : addBaseToBuffer(prev.buffer, amount);
        const nextUnbuffered = type === "acid" ? addAcidToUnbuffered(prev.unbuffered, amount) : addBaseToUnbuffered(prev.unbuffered, amount);
        const nextBufferPH = bufferPH(nextBuffer.acidMoles, nextBuffer.baseMoles, nextBuffer.excessStrong);
        const nextUnbufferedPH = unbufferedPH(nextUnbuffered.netH);
        setHistory((h) => [...h, { step: h.length, buffer: nextBufferPH, unbuffered: nextUnbufferedPH }]);
        return { buffer: nextBuffer, unbuffered: nextUnbuffered };
      });
      setLastAction(type);
    },
    [additionSize, currentBufferPH, currentUnbufferedPH]
  );

  const handleReset = useCallback(() => {
    const fresh = createInitialState();
    setState(fresh);
    setLastAction(null);
    setShowExplanation(false);
    const initialPH = bufferPH(fresh.buffer.acidMoles, fresh.buffer.baseMoles, fresh.buffer.excessStrong);
    const initialUPH = unbufferedPH(fresh.unbuffered.netH);
    setPrevPH({ buffer: initialPH, unbuffered: initialUPH });
    setHistory([{ step: 0, buffer: null, unbuffered: null }]);
  }, []);

  const comparisonText = useMemo(() => {
    if (deltaBuffer == null) return null;
    const bufferMagnitude = Math.abs(deltaBuffer);
    const unbufferedMagnitude = Math.abs(deltaUnbuffered);
    const bufferDescriptor = exceeded ? "Large pH change" : bufferMagnitude < 0.3 ? "Small pH change" : "Growing pH change";
    const unbufferedDescriptor = unbufferedMagnitude > 0.5 ? "Large pH change" : "Moderate pH change";
    return { bufferDescriptor, unbufferedDescriptor };
  }, [deltaBuffer, deltaUnbuffered, exceeded]);

  // Compact live graph -- pH vs number of additions, two traces.
  const graph = useMemo(() => {
    const W = 320, H = 90, padL = 26, padR = 8, padT = 8, padB = 16;
    const steps = history.length;
    const maxStep = Math.max(steps - 1, 1);
    function x(step) {
      return padL + (step / maxStep) * (W - padL - padR);
    }
    function y(pH) {
      const clamped = Math.max(0, Math.min(14, pH));
      return padT + ((14 - clamped) / 14) * (H - padT - padB);
    }
    const bufferPoints = history.map((h, i) => (h.buffer == null ? null : `${x(i)},${y(h.buffer)}`)).filter(Boolean).join(" ");
    const unbufferedPoints = history.map((h, i) => (h.unbuffered == null ? null : `${x(i)},${y(h.unbuffered)}`)).filter(Boolean).join(" ");
    return { W, H, padL, padR, padT, padB, x, y, bufferPoints, unbufferedPoints };
  }, [history]);

  return (
    <section className="buffer-sim">
      <header className="buffer-header">
        <h2>Buffer Action Visualizer</h2>
      </header>

      <div className="buffer-beakers">
        {/* UNBUFFERED */}
        <div className="buffer-beaker-card">
          <p className="buffer-beaker-label">UNBUFFERED SOLUTION</p>
          <div className="buffer-beaker-glass">
            <BufferParticles
              counts={currentUnbufferedPH < 7 ? { H: 3 } : { OH: 3 }}
            />
          </div>
          <div className="buffer-ph-display">
            <span>pH</span>
            <strong>{formatPH(currentUnbufferedPH)}</strong>
            {deltaUnbuffered != null && <small>{"\u0394pH " + formatDelta(deltaUnbuffered)}</small>}
          </div>
        </div>

        {/* BUFFER */}
        <div className="buffer-beaker-card">
          <p className="buffer-beaker-label">{"BUFFER"}<br />{"CH\u2083COOH / CH\u2083COO\u207B"}</p>
          <div className="buffer-beaker-glass">
            <BufferParticles counts={{ CH3COOH: particleCounts.acid, CH3COO: particleCounts.base }} />
          </div>
          <div className="buffer-ph-display">
            <span>pH</span>
            <strong>{formatPH(currentBufferPH)}</strong>
            {deltaBuffer != null && <small>{"\u0394pH " + formatDelta(deltaBuffer)}</small>}
          </div>
        </div>
      </div>

      <div className="buffer-composition">
        <p className="buffer-composition-label">Buffer composition</p>
        <div className="buffer-bar-row">
          <span className="buffer-bar-tag acid-tag">{"CH\u2083COOH"}</span>
          <div className="buffer-bar-track"><div className="buffer-bar-fill acid-fill" style={{ width: `${acidBarPct}%` }} /></div>
        </div>
        <div className="buffer-bar-row">
          <span className="buffer-bar-tag base-tag">{"CH\u2083COO\u207B"}</span>
          <div className="buffer-bar-track"><div className="buffer-bar-fill base-fill" style={{ width: `${baseBarPct}%` }} /></div>
        </div>
        {exceeded && <p className="buffer-capacity-warning">BUFFER CAPACITY EXCEEDED</p>}
      </div>

      {comparisonText && (
        <div className="buffer-comparison">
          <span>UNBUFFERED: {comparisonText.unbufferedDescriptor}</span>
          <span>BUFFER: {comparisonText.bufferDescriptor}</span>
        </div>
      )}

      <div className="buffer-graph-wrap">
        <svg viewBox={`0 0 ${graph.W} ${graph.H}`} className="buffer-graph">
          {[0, 7, 14].map((pH) => (
            <g key={pH}>
              <line x1={graph.padL} x2={graph.W - graph.padR} y1={graph.y(pH)} y2={graph.y(pH)} className="buffer-graph-grid" />
              <text x={graph.padL - 4} y={graph.y(pH) + 3} textAnchor="end" className="buffer-graph-axis-text">{pH}</text>
            </g>
          ))}
          {graph.unbufferedPoints && <polyline points={graph.unbufferedPoints} className="buffer-graph-line unbuffered-line" />}
          {graph.bufferPoints && <polyline points={graph.bufferPoints} className="buffer-graph-line buffer-line" />}
          <text x={graph.W - graph.padR} y={graph.H - 2} textAnchor="end" className="buffer-graph-axis-text">{"Additions \u2192"}</text>
        </svg>
        <div className="buffer-graph-legend">
          <span><i className="legend-dot buffer-dot" /> Buffer</span>
          <span><i className="legend-dot unbuffered-dot" /> Unbuffered</span>
        </div>
      </div>

      <div className="buffer-controls">
        <div className="buffer-size-select">
          <label htmlFor="buffer-size">Addition size</label>
          <select id="buffer-size" value={additionSize} onChange={(e) => setAdditionSize(e.target.value)}>
            <option value="Small">Small</option>
            <option value="Medium">Medium</option>
          </select>
        </div>
        <button type="button" className="buffer-btn-acid" onClick={() => handleAdd("acid")}>{"+ Add H\u207A"}</button>
        <button type="button" className="buffer-btn-base" onClick={() => handleAdd("base")}>{"+ Add OH\u207B"}</button>
        <button type="button" className="buffer-btn-reset" onClick={handleReset}>Reset</button>
      </div>

      <div className="buffer-explanation-wrap">
        <button type="button" className="buffer-explanation-toggle" onClick={() => setShowExplanation((v) => !v)}>
          {showExplanation ? "Hide Explanation" : "Show Explanation"}
        </button>
        {showExplanation && lastAction === "acid" && (
          <p className="buffer-explanation-text">
            {"CH\u2083COO\u207B + H\u207A \u2192 CH\u2083COOH"}
            <br />{"CH\u2083COO\u207B removes much of the added H\u207A."}
          </p>
        )}
        {showExplanation && lastAction === "base" && (
          <p className="buffer-explanation-text">
            {"CH\u2083COOH + OH\u207B \u2192 CH\u2083COO\u207B + H\u2082O"}
            <br />{"CH\u2083COOH removes much of the added OH\u207B."}
          </p>
        )}
        {showExplanation && !lastAction && (
          <p className="buffer-explanation-text">{"Add H\u207A or OH\u207B to see the buffer reaction."}</p>
        )}
      </div>

      <p className="buffer-copyright">{COPYRIGHT_TEXT_COMPACT}</p>
    </section>
  );
}
