import { Pause, Play, RotateCcw, Repeat, StepForward, Minus, Plus, Thermometer, FlaskConical, Zap } from "lucide-react";
import { MODES, MODE_LABELS, SPEEDS } from "../model/store.js";
import { PRESET_IDS, PRESETS, ADD_STEP } from "../model/everyday.js";
import { REACTIONS, REACTION_IDS } from "../model/reactions.js";
import { fmt } from "../model/explain.js";

export function ModeSelector({ mode, onChange }) {
  const go = (i, d) => { const n = MODES[(i + d + MODES.length) % MODES.length]; onChange(n); requestAnimationFrame(() => document.getElementById(`eq-mode-${n}`)?.focus()); };
  return (
    <div className="eq-modes" role="tablist" aria-label="Simulation mode" data-testid="mode-selector">
      {MODES.map((m, i) => (
        <button key={m} id={`eq-mode-${m}`} type="button" role="tab" aria-selected={mode === m} tabIndex={mode === m ? 0 : -1} className={"eq-mode" + (mode === m ? " is-on" : "")} data-testid={`mode-${m}`}
          onClick={() => onChange(m)} onKeyDown={(e) => { if (e.key === "ArrowRight") { e.preventDefault(); go(i, 1); } else if (e.key === "ArrowLeft") { e.preventDefault(); go(i, -1); } else if (e.key === "Home") { e.preventDefault(); go(i, -i); } else if (e.key === "End") { e.preventDefault(); go(i, MODES.length - 1 - i); } }}>
          {MODE_LABELS[m]}
        </button>))}
    </div>
  );
}

export function RunControls({ scene, speed, onAction, onSpeed, narrow }) {
  const st = scene.status; const label = st === "running" ? "Pause" : st === "paused" ? "Resume" : "Start"; const Icon = st === "running" ? Pause : Play;
  return (
    <div className="eq-run" role="group" aria-label="Simulation controls" data-testid="run-controls">
      <button type="button" className="eq-btn eq-btn--primary" data-testid="run-toggle" data-status={st} onClick={() => onAction({ type: "run/toggle" })}><Icon size={16} aria-hidden="true" /><span>{label}</span></button>
      <button type="button" className="eq-btn" data-testid="run-reset" onClick={() => onAction({ type: "run/reset" })} title="Back to the initial conditions and clear the graphs"><RotateCcw size={15} aria-hidden="true" /><span>Reset</span></button>
      <button type="button" className="eq-btn" data-testid="run-replay" onClick={() => onAction({ type: "run/replay" })} title="Run again from the start, repeating your disturbances at the same times"><Repeat size={15} aria-hidden="true" /><span>Replay</span></button>
      <button type="button" className="eq-btn" data-testid="run-step" onClick={() => onAction({ type: "run/step" })} title="Advance one second of animation time, then pause"><StepForward size={15} aria-hidden="true" /><span>{narrow ? "Step" : "Step Forward"}</span></button>
      <div className="eq-speed" role="group" aria-label="Animation speed">
        {SPEEDS.map((s) => (<button key={s} type="button" className={"eq-pill" + (speed === s ? " is-on" : "")} aria-pressed={speed === s} data-testid={`speed-${s}`} onClick={() => onSpeed(s)}>{s}×</button>))}
      </div>
    </div>
  );
}

export function PresetSelector({ scene, onPick, simple }) {
  const cur = scene.setup.preset;
  return (
    <div className="eq-presets" role="group" aria-label="Equilibrium position" data-testid="preset-selector">
      <span className="eq-label">{simple ? "Where do people end up?" : "Equilibrium position"}</span>
      <div className="eq-seg">
        {PRESET_IDS.map((id) => (
          <button key={id} type="button" className={"eq-segbtn" + (cur === id ? " is-on" : "")} aria-pressed={cur === id} data-testid={`preset-${id}`} onClick={() => onPick(id)}>
            <b>{PRESETS[id].label}</b><small>k<sub>f</sub> {PRESETS[id].kf.toFixed(2)} · k<sub>r</sub> {PRESETS[id].kr.toFixed(2)}</small>
          </button>))}
      </div>
    </div>
  );
}

export function EverydayDisturb({ scene, onAction, simple }) {
  const dis = !scene.started; const s = scene.ev.s;
  const btn = (key, { type, city, children, off }) => (<button key={key} type="button" className="eq-btn eq-btn--dist" disabled={dis || off} data-testid={`${type === "ev/add" ? "add" : "remove"}-${city}`} onClick={() => onAction({ type, city, n: ADD_STEP })}>{type === "ev/add" ? <Plus size={14} aria-hidden="true" /> : <Minus size={14} aria-hidden="true" />}<span>{children}</span></button>);
  return (
    <div className="eq-dist" role="group" aria-label="Disturb the equilibrium" data-testid="everyday-disturb">
      <span className="eq-label">{simple ? "Change the crowds" : "Disturb the equilibrium"} <small>({ADD_STEP} people per press)</small></span>
      <div className="eq-dist-grid">
        {btn("aa", { type: "ev/add", city: "A", children: "Add People to A" })}{btn("ra", { type: "ev/remove", city: "A", off: s.A === 0, children: "Remove People from A" })}
        {btn("ab", { type: "ev/add", city: "B", children: "Add People to B" })}{btn("rb", { type: "ev/remove", city: "B", off: s.B === 0, children: "Remove People from B" })}
      </div>
      {dis && <p className="eq-hint">Press Start to enable these buttons.</p>}
    </div>
  );
}

export function ReactionSelector({ scene, onReaction, onRates, simple }) {
  const rid = scene.setup.reactionId; const rx = REACTIONS[rid];
  return (
    <div className="eq-rxsel" data-testid="reaction-selector">
      <label className="eq-label" htmlFor="eq-reaction">{simple ? "Choose a reaction" : "Reaction"}</label>
      <select id="eq-reaction" className="eq-select" value={rid} onChange={(e) => onReaction(e.target.value)} data-testid="reaction-select">
        {REACTION_IDS.map((id) => (<option key={id} value={id}>{REACTIONS[id].short}</option>))}
      </select>
      {rid === "ab" && (
        <div className="eq-rates">
          <label className="eq-slider"><span>k<sub>f</sub> (forward) <output data-testid="kf-out">{fmt(scene.setup.kfRef)}</output></span>
            <input type="range" min="0.05" max="2" step="0.05" value={scene.setup.kfRef} onChange={(e) => onRates({ kf: Number(e.target.value), kr: scene.setup.krRef })} data-testid="kf-slider" aria-label="Forward rate constant k f" /></label>
          <label className="eq-slider"><span>k<sub>r</sub> (reverse) <output data-testid="kr-out">{fmt(scene.setup.krRef)}</output></span>
            <input type="range" min="0.05" max="2" step="0.05" value={scene.setup.krRef} onChange={(e) => onRates({ kf: scene.setup.kfRef, kr: Number(e.target.value) })} data-testid="kr-slider" aria-label="Reverse rate constant k r" /></label>
        </div>)}
    </div>
  );
}

/** Le Chatelier controls: only those that apply to the selected reaction. */
export function ChemConditions({ scene, onAction, simple }) {
  const ch = scene.ch.s; const rx = REACTIONS[ch.rid]; const dis = !scene.started; const c = rx.controls;
  const reactants = rx.species.filter((s) => rx.nu[s.id] < 0); const products = rx.species.filter((s) => rx.nu[s.id] > 0);
  const nearMax = (dir) => (dir > 0 ? ch.T + rx.run.Tstep > rx.run.Tmax + 1e-9 : ch.T - rx.run.Tstep < rx.run.Tmin - 1e-9);
  const volMin = ch.V <= ch.V0 * 0.25 + 1e-12; const volMax = ch.V >= ch.V0 * 4 - 1e-12;
  const conc = (key, list, title) => (
    <div key={key} className="eq-cgroup"><span className="eq-cgl">{title}</span>
      <div className="eq-chips">{list.map((s) => (
        <span key={s.id} className="eq-addrem">
          <button type="button" className="eq-chip" disabled={dis} data-testid={`add-${s.id}`} onClick={() => onAction({ type: "ch/add", id: s.id })} aria-label={`Add ${s.text}`}><Plus size={12} aria-hidden="true" />{s.formula}</button>
          <button type="button" className="eq-chip eq-chip--rm" disabled={dis || !(ch.c[s.id] > 0)} data-testid={`remove-${s.id}`} onClick={() => onAction({ type: "ch/remove", id: s.id })} aria-label={`Remove ${s.text}`}><Minus size={12} aria-hidden="true" />{s.formula}</button>
        </span>))}</div></div>);
  return (
    <div className="eq-cond" role="group" aria-label="Le Chatelier's principle controls" data-testid="chem-conditions">
      {c.concentration && (<fieldset className="eq-fs"><legend><FlaskConical size={13} aria-hidden="true" /> {simple ? "Amounts" : "Concentration"}</legend>{conc("r", reactants, reactants.length > 1 ? "Reactants" : "Reactant")}{conc("p", products, "Product")}</fieldset>)}
      {c.temperature && (
        <fieldset className="eq-fs"><legend><Thermometer size={13} aria-hidden="true" /> {simple ? "Heat" : "Temperature"}: <b data-testid="temp-readout">{Math.round(ch.T)} K</b></legend>
          <div className="eq-chips"><button type="button" className="eq-chip" disabled={dis || nearMax(-1)} data-testid="temp-down" onClick={() => onAction({ type: "ch/temp", dir: -1 })}>Decrease temperature</button>
            <button type="button" className="eq-chip" disabled={dis || nearMax(1)} data-testid="temp-up" onClick={() => onAction({ type: "ch/temp", dir: 1 })}>Increase temperature</button></div></fieldset>)}
      {c.volume && (
        <fieldset className="eq-fs"><legend>{simple ? "Squeeze" : "Volume"}: <b data-testid="vol-readout">{ch.V.toFixed(2)} dm³</b></legend>
          <div className="eq-chips"><button type="button" className="eq-chip" disabled={dis || volMin} data-testid="vol-down" onClick={() => onAction({ type: "ch/vol", dir: "decrease" })}>Decrease volume (pressure ↑)</button>
            <button type="button" className="eq-chip" disabled={dis || volMax} data-testid="vol-up" onClick={() => onAction({ type: "ch/vol", dir: "increase" })}>Increase volume (pressure ↓)</button></div></fieldset>)}
      {c.catalyst && (
        <fieldset className="eq-fs"><legend><Zap size={13} aria-hidden="true" /> Catalyst: <b data-testid="cat-readout">{ch.cat ? "present" : "none"}</b></legend>
          <div className="eq-chips"><button type="button" className="eq-chip" disabled={dis || ch.cat} data-testid="cat-add" onClick={() => onAction({ type: "ch/cat", on: true })}>Add catalyst</button>
            <button type="button" className="eq-chip" disabled={dis || !ch.cat} data-testid="cat-remove" onClick={() => onAction({ type: "ch/cat", on: false })}>Remove catalyst</button></div></fieldset>)}
      {!c.temperature && !c.volume && <p className="eq-hint">{rx.aqueous ? "This is a solution: no gas-pressure controls, and temperature is not varied here. Concentration changes are the experiment." : null}</p>}
      {dis && <p className="eq-hint">Press Start to enable these controls.</p>}
    </div>
  );
}
