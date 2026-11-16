import React, { useEffect, useMemo, useReducer, useRef, useState } from "react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import { useSimulationPresentation } from "../../components/interactive-shell/SimulationPresentation.js";
import "../../lib/acidbase/acidbase-ui.css";
import "./EquivalencePoint.css";
import "./EquivalencePoint.layout.css";
import { COPYRIGHT_TEXT_COMPACT } from "../../data/copyright.js";
import { ACIDS, BASES, ACID_CONCS, BASE_CONCS, EQUATIONS, FLASK_CM3, state as chem, statusText, validate, equivalenceAcidVolume, axisFor } from "./lib/model.js";
import { formatPH } from "../../lib/acidbase/format.js";

const MAX_VISIBLE_SPHERES = 10;
const MAX_BEAM_ANGLE = 10;
const MAX_POINTER_ANGLE = 22;
const ART_W = 720;
const ART_H = 440;
const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
const DEFAULTS = { acidId: "HCl", baseId: "NaOH", cAcid: 0.1, cBase: 0.1 };

function IonSphere({ type, index }) {
  const isOH = type === "OH";
  return <div className={`ion-sphere ${isOH ? "oh-sphere" : "h-sphere"}`} style={{ "--delay": `${index * 40}ms` }}>{isOH ? "OH⁻" : "H⁺"}</div>;
}
function SphereGroup({ type, count }) {
  return <div className="sphere-group">{Array.from({ length: count }).map((_, i) => <IonSphere key={`${type}-${i}`} type={type} index={i} />)}</div>;
}

// Pure reducer: volumes and the recorded (volume, pH) points; no side effects in updaters.
function reducer(st, a) {
  const cap = axisFor(equivalenceAcidVolume({ ...st.cfg, baseVolume: st.baseVolume }));
  if (a.type === "cfg") return init({ ...st.cfg, ...a.patch });
  if (a.type === "reset") return init(DEFAULTS);
  if (a.type === "acid") { const v = Math.min(cap, Math.round((st.acidVolume + a.amount) * 1000) / 1000); if (v === st.acidVolume) return st; return { ...st, acidVolume: v, acidDrop: st.acidDrop + 1, points: [...st.points, { v, pH: chem({ ...st.cfg, acidVolume: v, baseVolume: st.baseVolume }).pH }] }; }
  if (a.type === "base") { const bv = Math.min(100, st.baseVolume + a.amount); return { ...st, baseVolume: bv, baseDrop: st.baseDrop + 1, points: [{ v: 0, pH: chem({ ...st.cfg, acidVolume: 0, baseVolume: bv }).pH }] , acidVolume: 0, acidDrop: st.acidDrop + 1 }; }
  return st;
}
function init(cfg) {
  const s = { cfg, acidVolume: 0, baseVolume: FLASK_CM3, acidDrop: 0, baseDrop: 0, points: [] };
  s.points = [{ v: 0, pH: chem({ ...cfg, acidVolume: 0, baseVolume: FLASK_CM3 }).pH }];
  return s;
}

function MiniTrace({ points, veq, axis }) {
  const W = 280, H = 120, L = 28, B = 20, T = 6, R = 8;
  const x = (v) => L + (v / axis) * (W - L - R); const y = (pH) => T + ((14 - clamp(pH, 0, 14)) / 14) * (H - T - B);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="ab-svg eq2-trace" role="img" aria-label={`pH against volume of acid added, ${points.length} readings, equivalence at ${veq.toFixed(1)} cubic centimetres`}>
      {[0, 7, 14].map((p) => <g key={p}><line x1={L} x2={W - R} y1={y(p)} y2={y(p)} stroke="#2b3a50" strokeDasharray={p === 7 ? "4 3" : ""} /><text x={L - 4} y={y(p) + 4} textAnchor="end" fontSize="10" fill="#d3dcea">{p}</text></g>)}
      <line x1={x(veq)} x2={x(veq)} y1={T} y2={H - B} stroke="#5eead4" strokeDasharray="4 3" />
      <text x={x(veq)} y={H - 7} textAnchor="middle" fontSize="10" fill="#5eead4" fontWeight="700">{veq.toFixed(1)}</text>
      <text x={L + 2} y={H - 7} fontSize="10" fill="#d3dcea">0</text><text x={W - R} y={H - 7} textAnchor="end" fontSize="10" fill="#d3dcea">{axis} cm{"³"}</text>
      <path d={points.map((p, i) => `${i ? "L" : "M"}${x(p.v).toFixed(1)} ${y(p.pH).toFixed(1)}`).join("")} fill="none" stroke="#ffd166" strokeWidth="1.5" />
      {points.map((p, i) => <circle key={i} cx={x(p.v)} cy={y(p.pH)} r={i === points.length - 1 ? 4.5 : 2.5} fill="#ffd166" />)}
    </svg>
  );
}

function EquivalencePointBody() {
  const { isViewport } = useSimulationPresentation();
  const [st, dispatch] = useReducer(reducer, DEFAULTS, init);
  const { cfg } = st;
  const rootRef = useRef(null); const boxRef = useRef(null);
  const [scale, setScale] = useState(0.8);
  const [explore, setExplore] = useState(false);
  useEffect(() => {
    const root = rootRef.current; const box = boxRef.current; if (!root || !box || typeof ResizeObserver === "undefined") return undefined;
    const measure = () => { const narrow = root.clientWidth < 760; const w = box.clientWidth; const h = box.clientHeight; setScale(clamp(narrow ? w / ART_W : Math.min(w / ART_W, h / ART_H), 0.4, 1.15)); };
    measure(); const ro = new ResizeObserver(measure); ro.observe(root); ro.observe(box); return () => ro.disconnect();
  }, []);

  const s = useMemo(() => chem({ ...cfg, acidVolume: st.acidVolume, baseVolume: st.baseVolume }), [cfg, st.acidVolume, st.baseVolume]);
  const ref = (FLASK_CM3 / 1000) * cfg.cBase * BASES[cfg.baseId].factor;
  const stat = statusText(s, st.acidVolume, ref);
  const normalized = clamp(s.diff / ref, -1, 1);
  const frac = clamp(Math.abs(s.diff) / ref, 0, 1);
  const count = s.status === "equivalence" ? 0 : Math.max(1, Math.round(frac * MAX_VISIBLE_SPHERES));
  const spheres = { oh: s.status === "base" ? count : 0, h: s.status === "acid" ? count : 0 };
  const veq = equivalenceAcidVolume({ ...cfg, baseVolume: st.baseVolume });
  const axis = axisFor(veq);
  const atMax = st.acidVolume >= axis - 1e-9;
  const valid = validate(cfg.baseId, cfg.cBase);
  const acid = ACIDS[cfg.acidId], base = BASES[cfg.baseId];
  const changeCfg = (patch) => {
    const next = { ...cfg, ...patch };
    if (patch.baseId === "CaOH2" && next.cBase > BASES.CaOH2.maxConc) next.cBase = 0.01; // pick a physically possible concentration
    dispatch({ type: "cfg", patch: next });
  };
  const nBaseMmol = s.nBase * 1000 * base.factor; const nAcidMmol = s.nAcid * 1000 * acid.factor;
  const isDefaultCfg = cfg.acidId === "HCl" && cfg.baseId === "NaOH";

  return (
    <section ref={rootRef} className={"ab-root ab-fixed equivalence-simulation eq2 sim-surface-dark" + (isViewport ? " is-viewport" : "")}>
      <div className="eq2-grid">
        <div className="eq2-artbox" ref={boxRef} style={{ "--art-h": `${ART_H * scale}px` }}>
          <div className="simulation-stage eq2-art" style={{ width: ART_W, height: ART_H, transform: `scale(${scale})`, "--eq-scale": 1 }} role="img" aria-label={`Balance: ${stat.title}. ${stat.detail}. pH ${formatPH(s.pH)}.`}>
        {/* NaOH dropper -- left/OH- side */}
        <div className="naoh-unit">
          <div className="burette">
            <div className="burette-liquid" />
            <div className="burette-lines"><i /><i /><i /><i /><i /></div>
            <div className="burette-tip" />
          </div>
          <div key={st.baseDrop} className={st.baseDrop > 0 ? "acid-drop acid-drop-active" : "acid-drop"} />
          <span className="hcl-label">{base.label}</span>
        </div>

        {/* HCl dropper -- right/H+ side */}
        <div className="hcl-unit">
          <div className="burette">
            <div className="burette-liquid" />
            <div className="burette-lines"><i /><i /><i /><i /><i /></div>
            <div className="burette-tip" />
          </div>
          <div key={st.acidDrop} className={st.acidDrop > 0 ? "acid-drop acid-drop-active" : "acid-drop"} />
          <span className="hcl-label">{acid.label}</span>
        </div>

        <div className="balance-wrapper">
          <div className="balance-gauge">
            <div className="gauge-arc">
              <span className="tick tick-1" />
              <span className="tick tick-2" />
              <span className="tick tick-3" />
              <span className="tick tick-4" />
              <span className="tick tick-5" />
            </div>
            <div className="balance-pointer" style={{ transform: `translateX(-50%) rotate(${normalized * MAX_POINTER_ANGLE}deg)` }} />
          </div>

          <div className="balance-stand">
            <div className="stand-column" />
            <div className="stand-base" />
          </div>

          <div className="balance-beam" style={{ transform: `translate(-50%, -50%) rotate(${normalized * MAX_BEAM_ANGLE}deg)` }}>
            <div className="beam-body" />

            <div className="pan-unit pan-unit-left">
              <div className="pan-support" />
              <div className="balance-pan">
                <SphereGroup type="OH" count={spheres.oh} />
              </div>
              <div className="pan-label oh-label">{"OH\u207B"}</div>
            </div>

            <div className="pan-unit pan-unit-right">
              <div className="pan-support" />
              <div className="balance-pan">
                <SphereGroup type="H" count={spheres.h} />
              </div>
              <div className="pan-label h-label">{"H\u207A"}</div>
            </div>

            <div className="beam-pivot-dot" />
          </div>
        </div>
          </div>
        </div>
        <div className="eq2-panel">
          <div className="eq2-head">
            <div className={`eq2-status status-card-x ${stat.key}`} aria-live="polite" data-testid="status"><strong>{stat.title}</strong><span>{stat.detail}</span></div>
            <div className="eq2-ph"><span>pH</span><strong data-testid="ph">{formatPH(s.pH)}</strong></div>
          </div>
          <p className="eq2-setup" data-testid="setup">Flask: <strong>{st.baseVolume.toFixed(1)} cm{"³"} of {cfg.cBase.toFixed(3)} mol dm{"⁻³"} {base.label}</strong> ({nBaseMmol.toFixed(2)} mmol OH{"⁻"}). Burette: <strong>{cfg.cAcid.toFixed(3)} mol dm{"⁻³"} {acid.label}</strong>, <strong>{st.acidVolume.toFixed(1)} cm{"³"}</strong> added ({nAcidMmol.toFixed(2)} mmol H{"⁺"}). Equivalence at {veq.toFixed(1)} cm{"³"}.</p>
          <p className="eq2-eq">{EQUATIONS[`${cfg.acidId}+${cfg.baseId}`]} {"·"} net: H{"⁺"} + OH{"⁻"} {"→"} H{"₂"}O</p>
          <div className="eq2-btns">
            <button type="button" className="sim-btn sim-btn--primary ab-btn" disabled={atMax} onClick={() => dispatch({ type: "acid", amount: 2.5 })}>Add 2.5 cm{"³"} {acid.label}</button>
            <button type="button" className="sim-btn ab-btn" disabled={atMax} onClick={() => dispatch({ type: "acid", amount: 0.5 })}>Add 0.5 cm{"³"}</button>
            <button type="button" className="sim-btn ab-btn" onClick={() => dispatch({ type: "base", amount: 2.5 })}>Add 2.5 cm{"³"} {base.label}</button>
            <button type="button" className="sim-btn ab-btn" onClick={() => dispatch({ type: "reset" })}>Reset</button>
          </div>
          {atMax && <p className="ab-note ab-warn">Limit: {axis} cm{"³"} of acid (about twice the equivalence volume) is added. Reset to start again.</p>}
          <MiniTrace points={st.points} veq={veq} axis={axis} />
          <p className="ab-note">Each ion sphere stands for about one tenth of the starting OH{"⁻"}, an analogy, not a count. The trace shows how little the pH moves until the equivalence point, then how fast it jumps.</p>
          <label className="eq2-toggle"><input type="checkbox" checked={explore} onChange={(e) => { setExplore(e.target.checked); if (!e.target.checked) dispatch({ type: "reset" }); }} /> Explore stoichiometry (other acids, bases, concentrations)</label>
          {explore && (
            <div className="eq2-explore">
              <label className="ab-field">Acid<select value={cfg.acidId} onChange={(e) => changeCfg({ acidId: e.target.value })}>{Object.values(ACIDS).map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}</select></label>
              <label className="ab-field">Acid conc.<select value={cfg.cAcid} onChange={(e) => changeCfg({ cAcid: Number(e.target.value) })}>{ACID_CONCS.map((c) => <option key={c} value={c}>{c.toFixed(3)}</option>)}</select></label>
              <label className="ab-field">Base<select value={cfg.baseId} onChange={(e) => changeCfg({ baseId: e.target.value })}>{Object.values(BASES).map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
              <label className="ab-field">Base conc.<select value={cfg.cBase} onChange={(e) => changeCfg({ cBase: Number(e.target.value) })}>{BASE_CONCS.map((c) => <option key={c} value={c} disabled={!validate(cfg.baseId, c).ok}>{c.toFixed(3)}{validate(cfg.baseId, c).ok ? "" : " (above solubility)"}</option>)}</select></label>
              <p className="ab-note">{acid.ratio}. {base.ratio}.</p>
              {!valid.ok && <p className="ab-note ab-warn">{valid.message}</p>}
              {cfg.baseId === "CaOH2" && <p className="ab-note">Ca(OH){"₂"} dissolves only to about 0.02 mol dm{"⁻³"} at 25 {"°"}C, so higher concentrations are not offered.</p>}
              {cfg.acidId === "H2SO4" && <p className="ab-note">H{"₂"}SO{"₄"}: the first H{"⁺"} is fully released, HSO{"₄⁻"} has pKa 1.99 and is solved exactly, so equivalence for NaOH is a little above pH 7.</p>}
              {s.precipitate && <p className="ab-note ab-warn">Calcium sulfate is sparingly soluble: here it would start to precipitate, so the pH shown is approximate.</p>}
              {!isDefaultCfg && <p className="ab-note">Ideal behaviour assumed (activities = concentrations).</p>}
            </div>
          )}
        </div>
      </div>
      <p className="ab-note eq2-copy">{COPYRIGHT_TEXT_COMPACT}</p>
    </section>
  );
}

export default function EquivalencePoint({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Equivalence Point" subtitle={"A beam-balance analogy for stoichiometric neutralization"} compact={compact} standalone={standalone}>
      <EquivalencePointBody />
    </InteractiveFrame>
  );
}
