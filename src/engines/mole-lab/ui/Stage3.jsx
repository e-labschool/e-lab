import { useEffect, useMemo, useState } from "react";
import { RotateCcw, Droplets, FlaskConical, Zap } from "lucide-react";
import ConcBench from "../scene/ConcBench.jsx";
import StageFrame from "./StageFrame.jsx";
import { CalcPanel, PredictCard, ReferencePanel, Segmented, ValueField } from "./parts.jsx";
import { Step, ScopeCard, NotesCard, Stage3Fallback } from "./stage3/Stage3Parts.jsx";
import useLabInteraction from "./stage3/useLabInteraction.js";
import { stage3View } from "../engine/stage3View.js";
import { stage3Prediction, stage3Apply, checkStage3Apply } from "../engine/stage3Tutor.js";
import { SOLUTES, SOLUTE_IDS, GLASS, fmtMl } from "../engine/concLab.js";
import { STAGE3_EXPERIMENTS } from "../engine/stage3.js";
import { fmtSig } from "../engine/numeric.js";
import { describeDecomposition } from "../engine/packets.js";
import { detectWebGL } from "../../shared-3d/webgl.js";
import "./stage3/Stage3.css";

const STAGE = { id: 3, title: "Concentration Laboratory", purpose: "Prepare, compare and dilute solutions: c = n ÷ V, with V the volume of the SOLUTION." };
const f3 = (x) => fmtSig(x, 3);
const MASS_QUICK = [5, 10, 20, 30];

export default function Stage3({ store, shell }) {
  const { state, dispatch, getState } = store; const { layout, reduced, dark, detail, onSlow, mode } = shell;
  const sc = state.scenes[3]; const d = sc.data; const view = stage3View(state); const guided = mode === "guided";
  const webgl = useMemo(() => detectWebGL(), []);
  const ix = useLabInteraction({ getState, dispatch, reduced, animate: webgl, resetKey: shell.resetNonce });
  useEffect(() => { shell.debug.current = { ...shell.debug.current, ix }; });
  const [errs, setErrs] = useState({}); const [calcOpen, setCalcOpen] = useState(false); const [scopeBig, setScopeBig] = useState(false);
  const [water, setWater] = useState(""); const [top, setTop] = useState("1"); const [apply, setApply] = useState({ text: "", fb: null });
  const A = view.stations[0]; const Bv = view.stations[1]; const dil = view.dil; const sol = view.solute;

  const prediction = useMemo(() => stage3Prediction(sc), [sc]); const answered = prediction ? d.predictions[prediction.key] : null;
  const reveal = !guided || Boolean(answered) || !prediction;
  const task = useMemo(() => stage3Apply(sc), [sc]);
  const dock = layout === "wide" && !scopeBig;
  const everyDone = dil ? dil.phase === "done" : view.stations.every((s) => s.phase === "done");
  const mark = (key, r) => { setErrs((e) => ({ ...e, [key]: r.last.ok ? null : r.last.message })); if (!r.last.ok) ix.say(r.last.message, "warn"); else ix.say(r.last.message, "ok"); return r.last.ok; };
  const act = (key, a) => mark(key, dispatch({ stage: 3, ...a }));
  const setExp = (n) => { ix.cancel(); setErrs({}); setApply({ text: "", fb: null }); setWater(""); dispatch({ type: "s3/setExp", stage: 3, exp: n }); };
  const onAnswer = (c) => { dispatch({ type: "guide/answer", stage: 3, key: prediction.key, choice: c.id, correct: c.correct }); setCalcOpen(true); };
  const onApply = () => { const r = checkStage3Apply(task, apply.text); setApply((a) => ({ ...a, fb: r })); if (r.ok) dispatch({ type: "s3/applyAnswer", stage: 3, key: task.key, value: apply.text, correct: r.correct }); };
  useEffect(() => { setApply({ text: "", fb: null }); }, [task?.key]);

  // ------------------------------------------------------------------------------------------------ 3D labels
  const labels = useMemo(() => {
    const out = {}; const dd = sc.data;
    if (view.kind === "single") {
      out.cylinder = { text: "Cylinder", sub: A.exact.cylMl > 0 ? `${fmtMl(A.exact.cylMl)} mL water` : "100 mL" };
      const parts = []; if (A.exact.waterMl > 0) parts.push(`${fmtMl(A.exact.waterMl)} mL water`); if (A.exact.solidQ > 0) parts.push(`+ solid`); else if (A.exact.dissolvedQ > 0) parts.push("dissolved");
      out.beaker = { text: "Beaker", sub: parts.length ? parts.join(" ") : "250 mL" };
    }
    const flaskLabel = (st) => ({ text: `Flask ${fmtMl(st.exact.flaskMl)} mL`, sub: st.exact.atMark ? (reveal ? `c = ${st.text.conc}` : "at the mark") : st.exact.flaskQ > 0 ? `${fmtMl(st.exact.liquidMl)} mL · fill to mark` : "empty" });
    if (view.kind === "single") out.flaskA = flaskLabel(A);
    if (view.kind === "compare") { out.flaskA = { ...flaskLabel(A), text: `A · ${fmtMl(A.exact.flaskMl)} mL` }; out.flaskB = { ...flaskLabel(Bv), text: `B · ${fmtMl(Bv.exact.flaskMl)} mL` }; }
    if (view.kind === "dilution") {
      out.cylinder = { text: "Cylinder", sub: dil.exact.cylMl > 0 ? `${fmtMl(dil.exact.cylMl)} mL aliquot` : "100 mL" };
      out.stock = { text: "Stock", sub: `${dil.text.c1} · ${dil.text.stockVol}` };
      out.flaskA = { text: `Flask ${fmtMl(dd.stations.A.flaskMl)} mL`, sub: dil.exact.atMark ? (reveal ? `c = ${dil.text.c2}` : "at the mark") : dil.exact.flaskQ > 0 ? `${fmtMl(dd.stations.A.liquidMl)} mL · fill to mark` : "empty" };
    }
    return out;
  }, [sc, view, A, Bv, dil, reveal]);

  // ------------------------------------------------------------------------------------------------ controls
  const expBar = (
    <section className="ml-card ml3-exp" aria-label="Experiment" data-testid="ml3-exp-card">
      <div className="ml3-exp-row" role="radiogroup" aria-label="Experiment">
        {STAGE3_EXPERIMENTS.map((e) => <button key={e.id} type="button" role="radio" aria-checked={d.exp === e.id} className={"ml-chip ml3-exp-chip" + (d.exp === e.id ? " is-on" : "")} onClick={() => setExp(e.id)} data-testid={`ml3-exp-${e.id}`} title={e.title}>{e.id}</button>)}
      </div>
      <p className="ml3-exp-title" data-testid="ml3-exp-title"><b>Experiment {view.exp}.</b> {view.def.title}</p>
      {mode === "free" && <label className="ml-field"><span className="ml-label">Solute</span>
        <select className="ml-select" value={d.soluteId} onChange={(e) => { ix.cancel(); act("solute", { type: "s3/setSolute", soluteId: e.target.value }); }} data-testid="ml3-solute">{SOLUTE_IDS.map((id) => <option key={id} value={id}>{SOLUTES[id].formula} · {SOLUTES[id].name}</option>)}</select></label>}
      {view.flags.policyMismatch && <p className="ml-hint ml3-warn" data-testid="ml3-policy-note">This solution was prepared with {state.policy === "teaching" ? "precise" : "teaching"} molar masses; press Start over to weigh again with the current values.</p>}
    </section>
  );

  const flaskChips = (st, key) => (
    <div className="ml-quick" role="group" aria-label={`Final volume, flask ${key}`}>
      {GLASS.flask.standard.map((v) => <button key={v} type="button" className={"ml-chip" + (st.exact.flaskMl === v ? " is-on" : "")} aria-pressed={st.exact.flaskMl === v} disabled={ix.busy} onClick={() => act(`flask${key}`, { type: "s3/setFlask", station: key, value: v })} data-testid={`ml3-flask-chip-${key}-${v}`}>{v} mL</button>)}
    </div>
  );
  const massFields = (st, key, label = "Mass of solute") => (
    <div className="ml3-station" data-testid={`ml3-setup-${key}`}>
      {label && view.kind === "compare" && <h4 className="ml3-station-title">{label}</h4>}
      <div className="ml-io">
        <ValueField label={view.kind === "compare" && d.lockMass ? "Mass (both)" : "Mass"} value={f3(st.exact.massG ?? 0)} unit="g" onCommit={(v) => act(`mass${key}`, { type: "s3/setMass", station: key, value: v })} error={errs[`mass${key}`]} readOnly={ix.busy} testId={`ml3-mass-${key}`} hint="type a mass, then Enter" />
        <ValueField label="Final volume" value={fmtMl(st.exact.flaskMl)} unit="mL" onCommit={(v) => act(`flask${key}`, { type: "s3/setFlask", station: key, value: v })} error={errs[`flask${key}`]} readOnly={ix.busy} testId={`ml3-vol-${key}`} hint="the flask's marked volume" />
      </div>
      <div className="ml-quick" role="group" aria-label={`Quick masses, ${key}`}>
        {MASS_QUICK.map((m) => <button key={m} type="button" className={"ml-chip" + (st.exact.massG === m ? " is-on" : "")} aria-pressed={st.exact.massG === m} disabled={ix.busy} onClick={() => act(`mass${key}`, { type: "s3/setMass", station: key, value: m })} data-testid={`ml3-mass-chip-${key}-${m}`}>{m} g</button>)}
      </div>
      {flaskChips(st, key)}
      <p className="ml3-readout" data-testid={`ml3-weighed-${key}`}>M = {st.text.molarMass} → n = m ÷ M = <b>{st.text.amount}</b> · {st.exact.weighedQ > 0 ? describeDecomposition(st.exact.weighedQ) : "no material"}</p>
    </div>
  );

  const setupSingle = view.kind === "single" && (
    <section className="ml-card" aria-label="Weigh the solute" data-testid="ml3-setup">
      <h3 className="ml3-h"><FlaskConical size={14} aria-hidden="true" /> Weigh {sol.formula}</h3>
      {massFields(A, "A", "")}
      {!A.flags.untouched && <p className="ml-hint" data-testid="ml3-locked-note">Some of the sample has left the packet, so the mass is fixed. Press Start over to weigh a new sample.</p>}
    </section>
  );
  const setupCompare = view.kind === "compare" && (
    <section className="ml-card" aria-label="The two solutions" data-testid="ml3-setup">
      <h3 className="ml3-h"><FlaskConical size={14} aria-hidden="true" /> Two independent solutions</h3>
      {d.lockMass ? (
        <>
          <ValueField label="Mass of solute (the same in A and B)" value={f3(A.exact.massG ?? 0)} unit="g" onCommit={(v) => act("massA", { type: "s3/setMass", station: "A", value: v })} error={errs.massA} readOnly={ix.busy} testId="ml3-mass-A" hint="type a mass, then Enter" />
          <div className="ml-quick" role="group" aria-label="Quick masses">{MASS_QUICK.map((m) => <button key={m} type="button" className={"ml-chip" + (A.exact.massG === m ? " is-on" : "")} aria-pressed={A.exact.massG === m} disabled={ix.busy} onClick={() => act("massA", { type: "s3/setMass", station: "A", value: m })} data-testid={`ml3-mass-chip-A-${m}`}>{m} g</button>)}</div>
          {[["A", A], ["B", Bv]].map(([k, st]) => (
            <div key={k} className="ml3-station" data-testid={`ml3-setup-${k}`}><h4 className="ml3-station-title">Solution {k}</h4>
              <ValueField label="Final volume" value={fmtMl(st.exact.flaskMl)} unit="mL" onCommit={(v) => act(`flask${k}`, { type: "s3/setFlask", station: k, value: v })} error={errs[`flask${k}`]} readOnly={ix.busy} testId={`ml3-vol-${k}`} hint="the flask's marked volume" />
              {flaskChips(st, k)}<p className="ml3-readout" data-testid={`ml3-weighed-${k}`}>n = <b>{st.text.amount}</b> in {st.text.flask}</p></div>
          ))}
        </>
      ) : <>{massFields(A, "A", "Solution A")}{massFields(Bv, "B", "Solution B")}</>}
      <div className="ml-pc-actions">
        {view.stations.map((st) => <button key={st.id} type="button" className="sim-btn" disabled={ix.busy || st.phase === "done"} onClick={() => act(`prep${st.id}`, { type: "s3/prepare", station: st.id })} data-testid={`ml3-prepare-${st.id}`} title="Dissolve, transfer and make up to the mark in one go">Prepare {st.id}</button>)}
        {view.stations.map((st) => <button key={`r${st.id}`} type="button" className="sim-btn" disabled={ix.busy || st.flags.untouched} onClick={() => act(`restart${st.id}`, { type: "s3/restart", station: st.id })} data-testid={`ml3-restart-${st.id}`}>Start over {st.id}</button>)}
      </div>
      <p className="ml-hint">Both solutions are made up in volumetric flasks. Change a mass or a volume and that solution is re-prepared, so the two stay comparable.</p>
    </section>
  );
  const setupDilution = dil && (
    <section className="ml-card" aria-label="Stock and aliquot" data-testid="ml3-setup">
      <h3 className="ml3-h"><FlaskConical size={14} aria-hidden="true" /> Stock and dilution</h3>
      <div className="ml-io">
        <ValueField label="Stock c₁" value={f3(dil.exact.c1)} unit="mol dm⁻³" width={84} onCommit={(v) => act("stock", { type: "s3/setStock", c: v, volumeMl: d.dil.stockVolMl0 })} error={errs.stock} readOnly={ix.busy || dil.exact.taken} testId="ml3-stock-c" hint="the bottle's label" />
        <ValueField label="Stock volume" value={fmtMl(d.dil.stockVolMl0)} unit="mL" width={72} onCommit={(v) => act("stockV", { type: "s3/setStock", c: dil.exact.c1, volumeMl: v })} error={errs.stockV} readOnly={ix.busy || dil.exact.taken} testId="ml3-stock-v" />
      </div>
      {view.flags.hasPrepared && <button type="button" className="sim-btn" disabled={ix.busy || dil.exact.taken} onClick={() => act("stock", { type: "s3/stockFromPrepared" })} data-testid="ml3-use-prepared">Use my last prepared solution as the stock</button>}
      <div className="ml-io">
        <ValueField label="Aliquot V₁" value={fmtMl(dil.exact.aliquotMl)} unit="mL" width={72} onCommit={(v) => act("aliquot", { type: "s3/setAliquot", value: v })} error={errs.aliquot} readOnly={ix.busy || dil.exact.taken} testId="ml3-aliquot" hint="5 to 100 mL" />
        <ValueField label="Final volume V₂" value={fmtMl(dil.exact.finalMl)} unit="mL" width={72} onCommit={(v) => act("final", { type: "s3/setFinal", value: v })} error={errs.final} readOnly={ix.busy || d.stations.A.liquidMl > 0} testId="ml3-final" hint="the flask's marked volume" />
      </div>
      <p className="ml3-readout" data-testid="ml3-stock-readout">Stock: <b>{dil.text.c1}</b>, {dil.text.stockVol} remaining, holds <b>{dil.text.stockAmount}</b>. The aliquot is only <b>part</b> of it.</p>
    </section>
  );

  // ---- procedure (single) --------------------------------------------------------------------
  const stA = A?.exact; const ph = A?.phase;
  const sugg = A ? A.suggestedWater : null; const waterText = water !== "" ? water : sugg != null ? String(sugg) : "60";
  const order = ["weigh", "water", "pourWater", "open", "pour", "stir", "transfer", "mark", "done"]; const idx = (p) => order.indexOf(p);
  const statusOf = (first, last = first) => (idx(ph) > idx(last) ? "done" : idx(ph) >= idx(first) ? "current" : "todo");
  const pourWhy = A ? ix.pourBlock("A") : "";
  const procedureSingle = view.kind === "single" && A && (
    <section className="ml-card" aria-label="Procedure" data-testid="ml3-procedure">
      <h3 className="ml3-h"><Droplets size={14} aria-hidden="true" /> Procedure</h3>
      <p className="ml3-next" data-testid="ml3-next" role="status">{A.next}</p>
      <ol className="ml3-steps">
        <Step n={1} title="Measure the water" status={statusOf("water", "water")} guided={guided} summary={`${fmtMl(stA.waterMl || stA.cylMl)} mL`} testId="ml3-step-water">
          <div className="ml-field-row"><input className="ml-input" aria-label="Water to measure in mL" inputMode="decimal" style={{ width: 70 }} value={waterText} onChange={(e) => setWater(e.target.value)} data-testid="ml3-water-input" /><span className="ml-unit">mL</span>
            <button type="button" className="sim-btn" disabled={ix.busy || stA.cylMl > 0 || stA.atMark} onClick={() => act("water", { type: "s3/measureWater", station: "A", value: waterText })} data-testid="ml3-measure"><Droplets size={14} aria-hidden="true" /> Fill cylinder from tap</button></div>
          {errs.water && <span className="ml-error" role="alert" data-testid="ml3-water-error">{errs.water}</span>}
          <span className="ml-hint">About 60 % of the flask volume; the final volume is made up in the flask.</span>
        </Step>
        <Step n={2} title="Pour it into the beaker" status={statusOf("pourWater", "pourWater") === "done" || stA.waterMl > 0 ? (idx(ph) > idx("pourWater") || stA.waterMl > 0 ? "done" : "current") : statusOf("pourWater")} guided={guided} summary={`${fmtMl(stA.waterMl)} mL in the beaker`} testId="ml3-step-pourwater">
          <button type="button" className="sim-btn" disabled={ix.busy || stA.cylMl <= 0} onClick={() => ix.pourWater()} data-testid="ml3-pour-water">Pour cylinder into beaker</button>
          {errs.pourWater && <span className="ml-error" role="alert">{errs.pourWater}</span>}
        </Step>
        <Step n={3} title="Open the packet and pour the solid" status={statusOf("open", "pour")} guided={guided} summary={`${A.text.amount} poured`} testId="ml3-step-pour">
          <div className="ml-pc-actions">
            <button type="button" className="sim-btn" disabled={ix.busy || !A.packet || A.packet.q <= 0} onClick={() => ix.toggleOpen("A")} data-testid="ml-open-btn" aria-pressed={Boolean(A.packet?.open)}>{A.packet?.open ? "Close zipper" : "Open zipper"}</button>
            <button type="button" className="sim-btn sim-btn--primary" disabled={ix.busy || Boolean(pourWhy)} title={pourWhy || "Tilt the packet over the beaker"} onClick={() => ix.pourSolid("A")} data-testid="ml-pour-btn">Pour {sol.formula} into beaker</button>
          </div>
          <span className="ml-hint" data-testid="ml-pour-why">{pourWhy || "Or drag the open packet onto the beaker."}</span>
        </Step>
        <Step n={4} title="Stir until it dissolves" status={statusOf("stir", "stir")} guided={guided} summary={`${sol.ions.map((i) => i.label).join(" + ")} in water`} testId="ml3-step-stir">
          <button type="button" className="sim-btn" disabled={ix.busy || stA.solidQ + stA.dissolvedQ <= 0 || stA.atMark} onClick={() => ix.stir()} data-testid="ml3-stir">Stir</button>
          {errs.stir && <span className="ml-error" role="alert">{errs.stir}</span>}
        </Step>
        <Step n={5} title="Transfer to the volumetric flask" status={statusOf("transfer", "transfer")} guided={guided} summary="all of it moved" testId="ml3-step-transfer">
          <button type="button" className="sim-btn" disabled={ix.busy || stA.dissolvedQ <= 0 || stA.solidQ > 0} onClick={() => ix.transfer()} data-testid="ml3-transfer">Transfer to flask</button>
          {errs.transfer && <span className="ml-error" role="alert">{errs.transfer}</span>}
        </Step>
        <Step n={6} title="Make up to the calibration mark" status={statusOf("mark", "mark")} guided={guided} summary={`${fmtMl(stA.flaskMl)} mL at the mark`} testId="ml3-step-mark">
          <div className="ml-pc-actions">
            <button type="button" className="sim-btn sim-btn--primary" disabled={ix.busy || stA.flaskQ <= 0 || stA.atMark} onClick={() => ix.fillToMark("A")} data-testid="ml3-fill-mark">Fill to the mark</button>
            <div className="ml-field-row"><input className="ml-input" aria-label="Water to add in mL" inputMode="decimal" style={{ width: 60 }} value={top} onChange={(e) => setTop(e.target.value)} data-testid="ml3-top-input" /><span className="ml-unit">mL</span>
              <button type="button" className="sim-btn" disabled={ix.busy || stA.flaskQ <= 0 || stA.atMark} onClick={() => { const r = ix.topUp(top); setErrs((e) => ({ ...e, top: r ? null : getState().last.message })); }} data-testid="ml3-top-up">Add</button></div>
          </div>
          {errs.top && <span className="ml-error" role="alert" data-testid="ml3-top-error">{errs.top}</span>}
          <span className="ml-hint">Adding past the mark cannot be undone: the volume would no longer be the calibrated volume.</span>
        </Step>
      </ol>
      <div className="ml-pc-actions">
        <button type="button" className="sim-btn" disabled={ix.busy || A.flags.untouched && !stA.waterMl && !stA.cylMl} onClick={() => { ix.cancel(); act("restart", { type: "s3/restart", station: "A" }); setWater(""); }} data-testid="ml3-restart"><RotateCcw size={14} aria-hidden="true" /> Start over</button>
        <button type="button" className="sim-btn" disabled={ix.busy || !A.flags.untouched || stA.weighedQ <= 0 || Boolean(stA.waterMl || stA.cylMl)} onClick={() => act("prepare", { type: "s3/prepare", station: "A" })} data-testid="ml3-prepare-A" title="Skip the steps: dissolve, transfer and make up in one go"><Zap size={14} aria-hidden="true" /> Quick prepare</button>
      </div>
    </section>
  );

  const dp = dil?.phase;
  const procedureDilution = dil && (
    <section className="ml-card" aria-label="Procedure" data-testid="ml3-procedure">
      <h3 className="ml3-h"><Droplets size={14} aria-hidden="true" /> Procedure</h3>
      <p className="ml3-next" data-testid="ml3-next" role="status">{dil.next}</p>
      <ol className="ml3-steps">
        <Step n={1} title="Take the aliquot from the stock" status={dp === "take" ? "current" : "done"} guided={guided} summary={`${fmtMl(dil.exact.aliquotMl)} mL · ${dil.text.aliquotAmount}`} testId="ml3-step-take">
          <button type="button" className="sim-btn sim-btn--primary" disabled={ix.busy || dil.exact.taken} onClick={() => ix.takeAliquot()} data-testid="ml3-take">Take {fmtMl(dil.exact.aliquotMl)} mL aliquot</button>
          {dil.planError && <span className="ml-error" role="alert">{dil.planError}</span>}
        </Step>
        <Step n={2} title="Pour the aliquot into the flask" status={dp === "transfer" ? "current" : dp === "take" ? "todo" : "done"} guided={guided} summary="aliquot in the flask" testId="ml3-step-transfer">
          <button type="button" className="sim-btn" disabled={ix.busy || !dil.exact.taken || dil.exact.cylQ <= 0} onClick={() => ix.transferAliquot()} data-testid="ml3-transfer-aliquot">Pour aliquot into flask</button>
        </Step>
        <Step n={3} title="Make up to the calibration mark" status={dp === "mark" ? "current" : dp === "done" ? "done" : "todo"} guided={guided} summary={`${fmtMl(dil.exact.finalMl)} mL at the mark`} testId="ml3-step-mark">
          <div className="ml-pc-actions">
            <button type="button" className="sim-btn sim-btn--primary" disabled={ix.busy || dil.exact.flaskQ <= 0 || dil.exact.atMark} onClick={() => ix.fillToMark("A")} data-testid="ml3-fill-mark">Fill to the mark</button>
            <div className="ml-field-row"><input className="ml-input" aria-label="Water to add in mL" inputMode="decimal" style={{ width: 60 }} value={top} onChange={(e) => setTop(e.target.value)} data-testid="ml3-top-input" /><span className="ml-unit">mL</span>
              <button type="button" className="sim-btn" disabled={ix.busy || dil.exact.flaskQ <= 0 || dil.exact.atMark} onClick={() => { const r = ix.topUp(top); setErrs((e) => ({ ...e, top: r ? null : getState().last.message })); }} data-testid="ml3-top-up">Add</button></div>
          </div>
          {errs.top && <span className="ml-error" role="alert" data-testid="ml3-top-error">{errs.top}</span>}
        </Step>
      </ol>
      <div className="ml-pc-actions"><button type="button" className="sim-btn" disabled={ix.busy} onClick={() => { ix.cancel(); act("restart", { type: "s3/restart", station: "A" }); }} data-testid="ml3-restart"><RotateCcw size={14} aria-hidden="true" /> Start over</button></div>
    </section>
  );

  const applyCard = task && (guided ? everyDone : true) && (
    <section className="ml-card" aria-label="Apply" data-testid="ml-apply">
      <p className="ml-apply-q"><b>Apply</b> · {task.prompt.replace(/^Apply: /, "")}</p>
      <div className="ml-field-row"><input className="ml-input" aria-label={`Your answer in ${task.unit}`} inputMode="decimal" value={apply.text} onChange={(e) => setApply({ text: e.target.value, fb: null })} onKeyDown={(e) => { if (e.key === "Enter") onApply(); }} style={{ width: 90 }} data-testid="ml-apply-input" /><span className="ml-unit">{task.unit}</span><button type="button" className="sim-btn" onClick={onApply} data-testid="ml-apply-check">Check</button></div>
      <p className="ml-predict-fb" role="status" data-testid="ml-apply-fb">{apply.fb?.feedback ?? ""}</p>
    </section>
  );

  const controls = (
    <div className="ml-controls" data-testid="ml-controls-3">
      {expBar}
      {guided && prediction && <section className="ml-card" aria-label="Prediction"><PredictCard prediction={prediction} answered={answered} onAnswer={onAnswer} /></section>}
      {view.kind === "single" && <>{setupSingle}{procedureSingle}</>}
      {view.kind === "compare" && setupCompare}
      {view.kind === "dilution" && <>{setupDilution}{procedureDilution}</>}
      {!scopeBig && !dock && <ScopeCard view={view} dark={dark} reduced={reduced} reveal={reveal} big={false} onBig={() => setScopeBig(true)} />}
      <NotesCard solute={sol} />
      {applyCard}
    </div>
  );

  // ------------------------------------------------------------------------------------------------ calculations
  const sumLine = dil ? (dil.exact.atMark && reveal ? `c₂ = ${dil.text.c2}` : `c₁ = ${dil.text.c1}`) : view.stations.map((s) => (s.exact.c != null && reveal ? `${view.stations.length > 1 ? s.id + ": " : ""}${s.text.mass} ÷ ${s.text.molarMass} = ${s.text.amount}; c = ${s.text.conc}` : `${view.stations.length > 1 ? s.id + ": " : ""}c is defined once the flask is made up to the mark`)).join("   ·   ");
  const gate = guided && prediction && !answered;
  const calc = (
    <CalcPanel open={calcOpen} onToggle={setCalcOpen} summary={gate ? "Answer the prediction to see the working" : sumLine}>
      {gate ? <p className="ml-muted" data-testid="ml-calc-locked">Answer the prediction first, then the working appears here.</p> : (
        <div className="ml-calc-grid">
          <div><h4>Live calculation</h4>
            {dil ? <ol className="ml-lines" data-testid="ml-working">{dil.working.map((l) => <li key={l}>{l}</li>)}</ol>
              : view.stations.map((s) => (<div key={s.id}>{view.stations.length > 1 && <b>Solution {s.id}</b>}{s.working.length ? <ol className="ml-lines" data-testid={`ml-working-${s.id}`}>{s.working.map((l) => <li key={l}>{l}</li>)}</ol> : <p className="ml-muted" data-testid={`ml-working-${s.id}`}>c = n ÷ V needs the final volume of the SOLUTION, which is only known once the flask is made up to the mark. n = {s.text.amount} so far.</p>}</div>))}
            <p className="ml-formulas"><b>c = n ÷ V</b> (V in dm³) &nbsp; <b>C₁V₁ = C₂V₂</b></p></div>
          <div><h4>The key distinction</h4><p data-testid="ml-explain">The volume that matters is the volume of the <b>solution</b>, not the volume of water you started with: dissolving a solid changes the volume. The volumetric flask makes the final volume exact, so c = n ÷ V is reliable only at the mark. {view.cmp ? (view.cmp.sameN && !view.cmp.sameV ? `Both solutions hold the same amount of solute, but B is made up to ${view.stations[1].text.flask} and A to ${view.stations[0].text.flask}, so their concentrations differ by the inverse ratio of the volumes (c(B) ÷ c(A) = ${f3(view.cmp.ratio)}).` : view.cmp.sameC ? "These two solutions have the same concentration even though their amounts and volumes differ: the ions are equally crowded in the viewer." : `c(B) ÷ c(A) = ${f3(view.cmp.ratio)}: the denser the ions in the microscopic view, the higher the concentration.`) : ""}</p></div>
          <div><h4>Dilution and amounts</h4><p>{dil ? `Only the aliquot (${dil.text.aliquotAmount}) goes into the flask, not the whole stock; the stock keeps ${dil.text.stockAmount} at ${dil.text.c1}. Then c₂ = n ÷ V₂ = C₁V₁ ÷ V₂.` : "Adding water to a solution does not change the amount of solute: the same moles are spread over a larger volume, so the concentration falls."} All values here are for the final solution at room conditions, calculated from the amounts and volumes, never from the number of particles drawn.</p><p className="ml-muted">Molar mass: {view.text.molarMass} ({view.text.policy}).</p></div>
        </div>
      )}
    </CalcPanel>
  );

  // ------------------------------------------------------------------------------------------------ workspace
  const overlay = (
    <div className={"ml-overlay" + (dock ? " has-dock" : "")} data-ml-overlay>
      <div className="ml-chip-row"><span className="ml-pill" data-testid="ml-entity-pill">{sol.name} · M = {view.text.molarMass}</span>{sol.hazard === "corrosive" && <span className="ml-pill ml-pill--note" data-testid="ml3-hazard-pill">Corrosive · virtual lab</span>}</div>
      {dock && <div className="ml3-dock" data-testid="ml3-dock"><ScopeCard view={view} dark={dark} reduced={reduced} reveal={reveal} big={false} compact onBig={() => setScopeBig(true)} size={Math.min(330, 130 * view.panes.length)} /></div>}
      {scopeBig && <div className="ml3-bigscope" data-testid="ml3-bigscope"><ScopeCard view={view} dark={dark} reduced={reduced} reveal={reveal} big onBig={() => setScopeBig(false)} size={layout === "wide" ? 640 : 420} /></div>}
    </div>
  );
  const workspace = (aspect) => (
    <ConcBench reserve={dock} view={view} scene={sc} ix={ix} detail={detail} aspect={aspect} reduced={reduced} dark={dark} onSlow={onSlow} overlay={overlay} labels={labels} testId="ml-bench"
      ariaLabel={`3D laboratory bench: ${view.def.title}. ${view.stations.map((s) => `${s.text.amount} of ${sol.name}${s.exact.atMark && reveal ? `, concentration ${s.text.conc}` : ""}`).join("; ")}${dil ? `. Stock ${dil.text.c1}` : ""}`}
      fallback={<Stage3Fallback view={view} scene={sc} />} />
  );

  return <StageFrame layout={layout} stageTitle={STAGE.title} stageBlurb={STAGE.purpose} workspace={workspace} controls={controls} calc={calc} reference={<ReferencePanel compact={layout !== "wide"} />}
    status={ix.message.text || state.last?.message || "Weigh the solute, dissolve it in water, then make the solution up to the mark in a volumetric flask."} statusTone={ix.message.tone === "warn" ? "warn" : "info"} />;
}
