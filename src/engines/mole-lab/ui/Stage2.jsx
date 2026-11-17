import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, RotateCcw } from "lucide-react";
import PacketBench from "../scene/PacketBench.jsx";
import Balance3D from "../scene/Balance3D.jsx";
import StageFrame from "./StageFrame.jsx";
import { CalcPanel, PredictCard, ReferencePanel, Segmented, ValueField, PacketControls } from "./parts.jsx";
import usePacketInteraction from "./usePacketInteraction.js";
import { packEntries } from "./benchEntries.js";
import { stage2View } from "../engine/selectors.js";
import { stage2Prediction, checkApplyMass } from "../engine/tutor.js";
import { SELECTABLE_IDS, getSubstance } from "../engine/substances.js";
import { fmtMol, fmtSig, fromQuanta, parseNumberInput } from "../engine/numeric.js";
import { describeDecomposition } from "../engine/packets.js";
import { particleCaption } from "../engine/particles.js";

const STAGE = { id: 2, title: "Mass ↔ Moles", purpose: "Connect mass, molar mass and amount of substance: n = m / M and m = nM." };
const QUICK_MOL = [0.25, 0.5, 1, 1.5, 2.5];
const STEPS = [{ value: "0.1", label: "0.1 g" }, { value: "1", label: "1 g" }, { value: "10", label: "10 g" }];

export default function Stage2({ store, shell }) {
  const { state, dispatch, getState } = store; const { layout, reduced, dark, detail, onSlow, mode } = shell;
  const view = stage2View(state); const sc = state.scenes[2]; const d = sc.data; const sub = view.substance; const M = view.exact.molarMass;
  const ix = usePacketInteraction({ getState, dispatch, stage: 2, reduced, resetKey: shell.resetNonce });
  useEffect(() => { shell.debug.current = { ...shell.debug.current, ix }; });
  const guided = mode === "guided";
  const cap = layout === "narrow" ? 4 : 6;
  const rows = useMemo(() => [packEntries(sc.packets, cap)], [sc.packets, cap]);
  const [step, setStep] = useState("1"); const [pourTarget, setPourTarget] = useState(null); const [calcOpen, setCalcOpen] = useState(false);
  const [apply, setApply] = useState({ text: "", fb: null });
  const policy = state.policy;
  const prediction = useMemo(() => stage2Prediction(d.substanceId, view.exact.massG, policy), [d.substanceId, view.exact.massG, policy]);
  const answeredAny = Object.keys(d.predictions).some((k) => k.startsWith(`s2:${d.substanceId}:`));
  const answered = prediction ? d.predictions[prediction.key] : null;
  const gate = guided && !answeredAny && view.exact.massG > 0 && !!prediction;
  const sliderMax = Math.max(1, Math.ceil(3.5 * M));
  const massVal = view.exact.massG;
  const dm = (n) => { const r = dispatch({ type: "s2/addMass", stage: 2, delta: n * Number(step) }); if (r.last.message.includes("below zero") || !r.last.ok) ix.say(r.last.message, "warn"); };
  const setMass = (v) => { const r = dispatch({ type: "s2/setMass", stage: 2, value: v }); if (!r.last.ok) ix.say(r.last.message, "warn"); };
  const setMoles = (v) => { const r = dispatch({ type: "s2/setMoles", stage: 2, value: v }); if (!r.last.ok) ix.say(r.last.message, "warn"); };
  const massPrimary = d.direction === "mass-to-moles";
  const packetLabel = (p) => `${fmtMol(fromQuanta(p.q))} mol`;
  const subLabel = (id) => { const p = sc.packets.find((x) => x.id === id); return p ? `${fmtSig(fromQuanta(p.q) * M, 4)} g` : null; };
  const grouped = view.grouped;

  const onAnswer = (c) => { dispatch({ type: "guide/answer", stage: 2, key: prediction.key, choice: c.id, correct: c.correct }); setCalcOpen(true); };
  const onApply = () => { const p = parseNumberInput(apply.text, { label: "Mass" }); const r = p.ok ? checkApplyMass(d.substanceId, 1.5, p.value, policy) : { correct: false, feedback: p.error }; setApply((a) => ({ ...a, fb: r })); };

  const overlay = (
    <div className="ml-overlay" data-ml-overlay>
      <div className="ml-chip-row">
        <span className="ml-pill" data-testid="ml-entity-pill">{sub.name} · M = {view.text.molarMass}</span>
        {grouped.grouped && <span className="ml-pill ml-pill--note" data-testid="ml-grouped-note">{grouped.label} shown as one stack · total {view.text.amount}</span>}
      </div>
    </div>
  );
  const workspace = (aspect) => (
    <PacketBench ix={ix} rows={rows} detail={detail} aspect={aspect} reduced={reduced} dark={dark} onSlow={onSlow} overlay={overlay} testId="ml-bench" frontExtra={1.6} subLabel={subLabel}
      ariaLabel={`3D laboratory bench with a digital balance: ${view.text.amount} of ${sub.name}, ${describeDecomposition(view.exact.totalQ)}`} fallbackNotice="The balance reading and the calculation panel still work."
      extras={({ lay, extent }) => <Balance3D minX={extent.minX} maxX={extent.maxX} z={lay.extent.maxZ + 0.1} reading={view.text.mass} subtitle={`${sub.formula}  n = ${fmtMol(view.exact.n)} mol`} dark={dark} />}
    />
  );

  const controls = (
    <div className="ml-controls" data-testid="ml-controls-2">
      {gate && <section className="ml-card" aria-label="Prediction"><PredictCard prediction={prediction} answered={answered} onAnswer={onAnswer} /></section>}
      <section className="ml-card" aria-label="Substance and mass">
        <label className="ml-field"><span className="ml-label">Substance</span>
          <select className="ml-select" value={d.substanceId} onChange={(e) => { ix.cancel(); dispatch({ type: "s2/select", stage: 2, substanceId: e.target.value }); }} data-testid="ml-substance">
            {SELECTABLE_IDS.map((id) => { const s = getSubstance(id); return <option key={id} value={id}>{s.formulaDisplay} · {s.name}</option>; })}
          </select></label>
        <p className="ml-molar" data-testid="ml-molar-mass">M = <b>{view.text.molarMass}</b></p>
        {view.text.molarMassNote.includes("simplified") && <p className="ml-hint" data-testid="ml-simplified-note">{view.text.molarMassNote}</p>}
        <Segmented label="Direction of the conversion" value={d.direction} onChange={(v) => dispatch({ type: "s2/setDirection", stage: 2, direction: v })} testId="ml-direction" options={[{ value: "mass-to-moles", label: "Mass → moles" }, { value: "moles-to-mass", label: "Moles → mass" }]} />
        <div className="ml-io">
          <ValueField label="Mass" value={fmtSig(massVal, 4)} unit="g" onCommit={setMass} error={massPrimary ? d.error : null} readOnly={!massPrimary} testId="ml-mass-input" hint={massPrimary ? "type a mass, then Enter" : "calculated from n"} />
          <ValueField label="Amount" value={fmtMol(view.exact.n)} unit="mol" onCommit={setMoles} error={!massPrimary ? d.error : null} readOnly={massPrimary} testId="ml-moles-input" hint={!massPrimary ? "type an amount, then Enter" : "calculated from m"} />
        </div>
        <div className="ml-slider">
          <label htmlFor="ml-mass-slider" className="ml-label">Mass slider</label>
          <input id="ml-mass-slider" type="range" min="0" max={sliderMax} step="0.1" value={Math.min(sliderMax, massVal)} onChange={(e) => setMass(e.target.value)} data-testid="ml-mass-slider" aria-valuetext={`${fmtSig(massVal, 4)} grams, ${view.text.amount}`} />
          <div className="ml-slider-ends"><span>0 g</span><span>{sliderMax} g</span></div>
        </div>
        <div className="ml-pm">
          <button type="button" className="sim-btn" onClick={() => dm(-1)} aria-label={`Remove ${step} g`} data-testid="ml-minus"><Minus size={14} aria-hidden="true" /> {step} g</button>
          <button type="button" className="sim-btn" onClick={() => dm(1)} aria-label={`Add ${step} g`} data-testid="ml-plus"><Plus size={14} aria-hidden="true" /> {step} g</button>
          <Segmented compact label="Step size" value={step} onChange={setStep} options={STEPS} testId="ml-step" />
        </div>
        <div className="ml-quick" role="group" aria-label="Quick amounts">
          {QUICK_MOL.map((n) => <button key={n} type="button" className={"ml-chip" + (view.exact.n === n ? " is-on" : "")} aria-pressed={view.exact.n === n} onClick={() => setMoles(n)} data-testid={`ml-quick-${n}`}>{fmtMol(n)} mol <span className="ml-chip-sub">· {(Math.round(n * M * 100 + 1e-7) / 100).toFixed(2)} g</span></button>)}
        </div>
      </section>
      <section className="ml-card" aria-label="Packets">
        <PacketControls packets={sc.packets} selectedId={ix.selectedId} onSelect={ix.select} onToggleOpen={ix.toggleOpen} onPour={ix.pour} onSplit={ix.split} onCombine={ix.combine} onResetPositions={ix.resetPositions} pourTargetId={pourTarget} onPourTarget={setPourTarget} busy={Boolean(ix.bench.current.pour)} getLabel={packetLabel} />
        <button type="button" className="sim-btn ml-reset-stage" onClick={() => { ix.cancel(); dispatch({ type: "reset", stage: 2 }); ix.say("Reset to the starting state.", "ok"); }} data-testid="ml-reset-stage"><RotateCcw size={14} aria-hidden="true" /> Reset this stage</button>
      </section>
      {guided && (
        <section className="ml-card" aria-label="Apply" data-testid="ml-apply">
          <p className="ml-apply-q"><b>Apply</b> · You need 1.50 mol of {sub.formulaDisplay}. What mass should you weigh out?</p>
          <div className="ml-field-row"><input className="ml-input" aria-label="Your mass in grams" inputMode="decimal" value={apply.text} onChange={(e) => setApply({ text: e.target.value, fb: null })} onKeyDown={(e) => { if (e.key === "Enter") onApply(); }} data-testid="ml-apply-input" style={{ width: 90 }} /><span className="ml-unit">g</span><button type="button" className="sim-btn" onClick={onApply} data-testid="ml-apply-check">Check</button></div>
          <p className="ml-predict-fb" role="status" data-testid="ml-apply-fb">{apply.fb?.feedback ?? ""}</p>
        </section>
      )}
    </div>
  );

  const w = view.text.working;
  const calc = (
    <CalcPanel open={calcOpen} onToggle={setCalcOpen} summary={`${view.text.mass} ÷ ${view.text.molarMass} = ${view.text.amount}`}>
      {gate ? <p className="ml-muted" data-testid="ml-calc-locked">Answer the prediction first, then the working appears here.</p> : (
        <div className="ml-calc-grid">
          <div><h4>Live calculation</h4><ol className="ml-lines" data-testid="ml-working">{w.map((l) => <li key={l}>{l}</li>)}</ol>
            <p className="ml-formulas"><b>n = m ÷ M</b> &nbsp; and &nbsp; <b>m = n × M</b></p></div>
          <div><h4>What it means</h4><p data-testid="ml-explain">{fmtSig(massVal, 4)} g of {sub.formulaDisplay}, with each mole having a mass of {view.text.molarMass}, is {view.text.amount} = {view.text.entities}. On the bench that is {view.text.decomposition}.</p></div>
          <div><h4>Molar mass values</h4><p>{view.text.molarMassNote}</p><p className="ml-muted">Using: {view.text.policy}. {particleCaption(d.substanceId, detail)}</p></div>
        </div>
      )}
    </CalcPanel>
  );
  return <StageFrame layout={layout} stageTitle={STAGE.title} stageBlurb={STAGE.purpose} workspace={workspace} controls={controls} calc={calc} reference={<ReferencePanel compact={layout !== "wide"} />} status={ix.message.text || state.last?.message || "Change the mass and watch the packets fill: one bag holds at most 1 mol."} statusTone={ix.message.tone === "warn" ? "warn" : "info"} />;
}
