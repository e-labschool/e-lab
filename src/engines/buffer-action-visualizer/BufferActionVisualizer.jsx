import { useState, useRef, useEffect, useCallback } from "react";
import "./BufferActionVisualizer.css";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";
import BeakerGlass from "./components/BeakerGlass.jsx";
import DropperPair from "./components/DropperPair.jsx";
import BufferParticleDot from "./components/BufferParticleDot.jsx";
import { createParticle, stepBufferParticles, createWaterParticle } from "./lib/bufferParticles.js";
import {
  BUFFER_SYSTEMS,
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

// Beaker-local coordinate space (matches BeakerGlass's default viewBox)
// and the liquid region within it, used as the physics bounds for both
// beakers.
const BEAKER_W = 170, BEAKER_H = 190;
const LIQUID_BOUNDS = { x: 10, y: 58, w: BEAKER_W - 20, h: BEAKER_H - 72 };
const SPECTATOR_COUNT = 3;
const RECONCILE_DELAY_MS = 900;

function formatPH(v) {
  return Number.isFinite(v) ? v.toFixed(2) : "\u2014";
}
function formatDelta(v) {
  if (!Number.isFinite(v)) return null;
  const sign = v > 0 ? "+" : v < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(v).toFixed(2)}`;
}

function buildBufferParticles(counts, idRef) {
  const list = [];
  for (let i = 0; i < counts.acid; i++) list.push(createParticle(`a${idRef.current++}`, "acid", LIQUID_BOUNDS));
  for (let i = 0; i < counts.base; i++) list.push(createParticle(`b${idRef.current++}`, "base", LIQUID_BOUNDS));
  for (let i = 0; i < SPECTATOR_COUNT; i++) list.push(createParticle(`s${idRef.current++}`, "spectator", LIQUID_BOUNDS));
  return list;
}

export default function BufferActionVisualizer() {
  const [systemId, setSystemId] = useState("acid");
  const [chem, setChem] = useState(() => createInitialState("acid"));
  const [additionSize, setAdditionSize] = useState("Small amount");
  const [activeDrop, setActiveDrop] = useState(null);
  const [lastReaction, setLastReaction] = useState(null); // { systemId, type: "H"|"OH" } | null
  const [prevPH, setPrevPH] = useState(null);

  const [bufferParticles, setBufferParticles] = useState([]);
  const [unbufferedParticles, setUnbufferedParticles] = useState([]);

  const idRef = useRef(0);
  const rafRef = useRef(null);
  const lastTimeRef = useRef(null);
  const reconcileTimeoutRef = useRef(null);
  const chemRef = useRef(chem);
  chemRef.current = chem;

  const system = BUFFER_SYSTEMS[systemId];
  const currentBufferPH = bufferPH(chem.buffer.acidMoles, chem.buffer.baseMoles, chem.buffer.excessStrong, system.pKa);
  const currentUnbufferedPH = unbufferedPH(chem.unbuffered.netH);
  const exceeded = isBufferCapacityExceeded(chem.buffer);
  const deltaBuffer = prevPH ? formatDelta(currentBufferPH - prevPH.buffer) : null;
  const deltaUnbuffered = prevPH ? formatDelta(currentUnbufferedPH - prevPH.unbuffered) : null;

  const resetTo = useCallback((nextSystemId) => {
    if (reconcileTimeoutRef.current) clearTimeout(reconcileTimeoutRef.current);
    const fresh = createInitialState(nextSystemId);
    setChem(fresh);
    setActiveDrop(null);
    setLastReaction(null);
    setPrevPH(null);
    setUnbufferedParticles([]);
    setBufferParticles(buildBufferParticles(getBufferParticleCounts(fresh.buffer), idRef));
  }, []);

  useEffect(() => {
    resetTo("acid");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Single animation loop, whole lifetime -- reactionRule read fresh each
  // frame from a ref so it never needs the loop itself to restart.
  const reactionRuleRef = useRef(null);
  useEffect(() => {
    reactionRuleRef.current =
      lastReaction?.type === "H"
        ? { seekerKind: "H", targetKind: "base", targetBecomes: "acid" }
        : lastReaction?.type === "OH"
        ? { seekerKind: "OH", targetKind: "acid", targetBecomes: "base" }
        : null;
  }, [lastReaction]);

  useEffect(() => {
    function tick(now) {
      const dt = lastTimeRef.current == null ? 0 : Math.min(0.05, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;

      setBufferParticles((prev) => {
        const newWater = [];
        const stepped = stepBufferParticles(prev, LIQUID_BOUNDS, dt, reactionRuleRef.current, (x, y) => newWater.push(createWaterParticle(`w${idRef.current++}`, x, y)));
        return [...stepped, ...newWater];
      });
      setUnbufferedParticles((prev) => stepBufferParticles(prev, LIQUID_BOUNDS, dt, null));

      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); lastTimeRef.current = null; };
  }, []);

  useEffect(() => () => { if (reconcileTimeoutRef.current) clearTimeout(reconcileTimeoutRef.current); }, []);

  const handleAdd = useCallback(
    (type) => {
      const amount = ADDITION_SIZES[additionSize];
      setPrevPH({ buffer: currentBufferPH, unbuffered: currentUnbufferedPH });
      setActiveDrop(type === "acid" ? "H" : "OH");
      setLastReaction({ systemId, type: type === "acid" ? "H" : "OH" });

      const nextBuffer = type === "acid" ? addAcidToBuffer(chem.buffer, amount) : addBaseToBuffer(chem.buffer, amount);
      const nextUnbuffered = type === "acid" ? addAcidToUnbuffered(chem.unbuffered, amount) : addBaseToUnbuffered(chem.unbuffered, amount);
      setChem({ buffer: nextBuffer, unbuffered: nextUnbuffered });

      const particleKind = type === "acid" ? "H" : "OH";
      setBufferParticles((prev) => [...prev, createParticle(`x${idRef.current++}`, particleKind, LIQUID_BOUNDS)]);
      setUnbufferedParticles((prev) => [...prev, createParticle(`u${idRef.current++}`, particleKind, LIQUID_BOUNDS)]);

      window.setTimeout(() => setActiveDrop(null), 500);

      // Reconcile the buffer beaker's acid/base particle counts to the
      // fresh chemistry state once the individual animated reaction has
      // had time to play out -- keeps the long-run visual composition
      // accurate to the model even though the moment-to-moment particle
      // physics is representational, not literally counted.
      if (reconcileTimeoutRef.current) clearTimeout(reconcileTimeoutRef.current);
      reconcileTimeoutRef.current = window.setTimeout(() => {
        const counts = getBufferParticleCounts(nextBuffer);
        setBufferParticles((prev) => {
          const spectators = prev.filter((p) => p.kind === "spectator");
          const reacting = prev.filter((p) => p.status !== "active" && (p.kind === "acid" || p.kind === "base" || p.kind === "H" || p.kind === "OH" || p.kind === "water"));
          const freshAcidBase = buildBufferParticles(counts, idRef).filter((p) => p.kind !== "spectator");
          return [...freshAcidBase, ...spectators, ...reacting];
        });
      }, RECONCILE_DELAY_MS);
    },
    [additionSize, chem, currentBufferPH, currentUnbufferedPH, systemId]
  );

  const handleSystemChange = useCallback(
    (e) => {
      const next = e.target.value;
      setSystemId(next);
      resetTo(next);
    },
    [resetTo]
  );

  const handleReset = useCallback(() => resetTo(systemId), [resetTo, systemId]);

  const reactionLine = (() => {
    if (!lastReaction || lastReaction.systemId !== systemId) return null;
    if (systemId === "acid") {
      return lastReaction.type === "H" ? "CH\u2083COO\u207B + H\u207A \u2192 CH\u2083COOH" : "CH\u2083COOH + OH\u207B \u2192 CH\u2083COO\u207B + H\u2082O";
    }
    return lastReaction.type === "H" ? "NH\u2083 + H\u207A \u2192 NH\u2084\u207A" : "NH\u2084\u207A + OH\u207B \u2192 NH\u2083 + H\u2082O";
  })();

  return (
    <section className="buffer-sim">
      <header className="buffer-header">
        <h2>Buffer Action Visualizer</h2>
      </header>

      <div className="buffer-beakers">
        <div className="buffer-beaker-col">
          <p className="buffer-beaker-label">{"UNBUFFERED SOLUTION"}</p>
          <DropperPair activeDrop={activeDrop} />
          <BeakerGlass gradientId="unbuf">
            {unbufferedParticles.map((p) => (
              <BufferParticleDot key={p.id} particle={p} system={system} />
            ))}
          </BeakerGlass>
          <div className="buffer-ph-readout">
            <span>pH</span>
            <strong>{formatPH(currentUnbufferedPH)}</strong>
            {deltaUnbuffered && <small>{"\u0394pH " + deltaUnbuffered}</small>}
          </div>
        </div>

        <div className="buffer-beaker-col">
          <p className="buffer-beaker-label">{"BUFFER SOLUTION"}</p>
          <DropperPair activeDrop={activeDrop} />
          <BeakerGlass gradientId="buf">
            {bufferParticles.map((p) => (
              <BufferParticleDot key={p.id} particle={p} system={system} />
            ))}
          </BeakerGlass>
          <div className="buffer-ph-readout">
            <span>pH</span>
            <strong>{formatPH(currentBufferPH)}</strong>
            {deltaBuffer && <small>{"\u0394pH " + deltaBuffer}</small>}
          </div>
          {exceeded && <p className="buffer-capacity-warning">{"BUFFER CAPACITY EXCEEDED"}</p>}
        </div>
      </div>

      <div className="buffer-type-row">
        <label htmlFor="buffer-system">{"BUFFER TYPE"}</label>
        <select id="buffer-system" value={systemId} onChange={handleSystemChange}>
          <option value="acid">{"Acid Buffer \u2014 CH\u2083COOH / CH\u2083COO\u207B"}</option>
          <option value="basic">{"Basic Buffer \u2014 NH\u2083 / NH\u2084\u207A"}</option>
        </select>
      </div>

      <div className="buffer-controls">
        <div className="buffer-size-select">
          <label htmlFor="buffer-addition-size">Addition</label>
          <select id="buffer-addition-size" value={additionSize} onChange={(e) => setAdditionSize(e.target.value)}>
            <option value="Small amount">Small amount</option>
            <option value="Medium amount">Medium amount</option>
          </select>
        </div>
        <button type="button" className="buffer-btn-acid" onClick={() => handleAdd("acid")}>{"Add H\u207A"}</button>
        <button type="button" className="buffer-btn-base" onClick={() => handleAdd("base")}>{"Add OH\u207B"}</button>
        <button type="button" className="buffer-btn-reset" onClick={handleReset}>Reset</button>
      </div>

      {reactionLine && <p className="buffer-reaction-line">{reactionLine}</p>}

      <div className="buffer-legend">
        <span><i className="legend-dot" style={{ background: "#c99a3a" }} /> {system.acidLabel}{" \u2014 acid form"}</span>
        <span><i className="legend-dot" style={{ background: "#3a9ac9" }} /> {system.baseLabel}{" \u2014 base form"}</span>
        <span><i className="legend-dot" style={{ background: "#7d8b9c" }} /> {system.spectatorLabel}{" \u2014 "}{system.spectatorNote}</span>
        <span><i className="legend-dot" style={{ background: "#c23b3b" }} /> {"H\u207A"}</span>
        <span><i className="legend-dot" style={{ background: "#2f4bc4" }} /> {"OH\u207B"}</span>
      </div>

      <p className="buffer-copyright">{COPYRIGHT_TEXT_COMPACT}</p>
    </section>
  );
}
