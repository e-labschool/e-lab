import { useEffect, useMemo, useState } from "react";
import { Eye, Calculator, Scissors, Undo2 } from "lucide-react";
import PacketBench from "../scene/PacketBench.jsx";
import EnlargedModel from "../scene/EnlargedModel.jsx";
import StageFrame from "./StageFrame.jsx";
import { CalcPanel, PredictCard, ReferencePanel, ValueField, PacketControls } from "./parts.jsx";
import usePacketInteraction from "./usePacketInteraction.js";
import { packEntries } from "./benchEntries.js";
import { stage1View } from "../engine/selectors.js";
import { stage1Prediction } from "../engine/tutor.js";
import { SELECTABLE_IDS, getSubstance } from "../engine/substances.js";
import { STAGE1_PRESETS } from "../engine/stage1.js";
import { particleCaption } from "../engine/particles.js";
import { fmtMol, fromQuanta } from "../engine/numeric.js";
import { describeDecomposition } from "../engine/packets.js";

const STAGE = { id: 1, title: "Explore the Mole", purpose: "One mole is a fixed count of entities. Use the formula to count the atoms or ions inside it." };

export default function Stage1({ store, shell }) {
  const { state, dispatch, getState } = store; const { layout, reduced, dark, detail, onSlow, mode } = shell;
  const view = stage1View(state); const sc = state.scenes[1]; const d = sc.data; const sub = view.substance;
  const ix = usePacketInteraction({ getState, dispatch, stage: 1, reduced, resetKey: shell.resetNonce });
  useEffect(() => { shell.debug.current = { ...shell.debug.current, ix }; });
  const guided = mode === "guided"; const free = !guided;
  const main = sc.packets.filter((p) => p.role === "main"); const counting = sc.packets.filter((p) => p.role === "counting");
  const cap = layout === "narrow" ? 4 : 6;
  const rows = useMemo(() => [packEntries(main, cap), ...(counting.length ? [packEntries(counting, cap)] : [])], [sc.packets, cap]); // eslint-disable-line react-hooks/exhaustive-deps
  const prediction = useMemo(() => stage1Prediction(d.substanceId, d.amountQ), [d.substanceId, d.amountQ]);
  const answered = prediction ? d.predictions[prediction.key] : null;
  const [askCount, setAskCount] = useState(false);
  useEffect(() => setAskCount(false), [d.substanceId, d.amountQ]);
  const [calcOpen, setCalcOpen] = useState(false);

  // guided progression: each step unlocks the next
  const step = !d.inspect && !d.counted ? 0 : !d.counted ? 1 : !d.separated ? 2 : 3;
  const showInspect = free || step >= 0; const showCount = free || d.inspect || d.counted; const showSeparate = free || d.counted; const showQty = free || d.separated;
  const mainNode = main[0] ?? null;
  const inspectOn = d.inspect && Boolean(mainNode);
  const onCount = () => { if (guided && prediction && !answered) { setAskCount(true); return; } dispatch({ type: "s1/count" }); setCalcOpen(true); };
  const onAnswer = (c) => { dispatch({ type: "guide/answer", stage: 1, key: prediction.key, choice: c.id, correct: c.correct }); dispatch({ type: "s1/count" }); setAskCount(false); setCalcOpen(true); };
  const onSeparate = () => { const r = dispatch({ type: "s1/separate" }); ix.say(r.last.message, r.last.ok ? "ok" : "warn"); setCalcOpen(true); };
  const onAmount = (v) => { const r = dispatch({ type: "s1/setAmount", value: v }); if (!r.last.ok) ix.say(r.last.message, "warn"); };
  const entityLines = entityDescription(sub);
  const packetLabel = (p) => `${fmtMol(fromQuanta(p.q))} mol ${getSubstance(p.substanceId).formulaDisplay}`;

  const overlay = (
    <div className="ml-overlay" data-ml-overlay>
      <div className="ml-chip-row">
        <span className="ml-pill" data-testid="ml-entity-pill">{sub.name} · {sub.formulaDisplay}{sub.state ? `(${sub.state})` : ""} · {fmtMol(view.exact.n)} mol of {sub.entity.plural}</span>
        {(d.counted || d.separated) && <span className="ml-pill ml-pill--note" data-testid="ml-counting-badge">Formula Composition / Counting View: a conceptual count, not a chemical reaction</span>}
      </div>
      {inspectOn && <div className="ml-inspect-card" data-testid="ml-inspect-card" aria-live="polite">
        {d.selectedEntity == null ? <p><b>Inspect:</b> click a particle in the packet to select one representative {sub.entity.singular}.</p>
          : <><p><b>{entityLines.title}</b></p><p>{entityLines.detail}</p><p className="ml-muted">{entityLines.structure}</p></>}
      </div>}
    </div>
  );

  const workspace = (aspect) => (
    <PacketBench
      ix={ix} rows={rows} detail={detail} aspect={aspect} reduced={reduced} dark={dark} inspectFocus={inspectOn ? { packetId: mainNode.id } : null} onSlow={onSlow} overlay={overlay} testId="ml-bench" ariaLabel={`3D laboratory bench: ${describeDecomposition(sc.data.amountQ)} of ${sub.name}`}
      inspect={{ packetId: mainNode?.id, slot: d.selectedEntity, active: inspectOn, onPick: (slot) => dispatch({ type: "s1/selectEntity", stage: 1, index: slot }) }}
      pourHeadroom={free} fallbackNotice="You can still count atoms and separate the packets below."
      extras={inspectOn ? ({ posFor }) => { const p = posFor(mainNode.id); return <EnlargedModel key={d.substanceId} substanceId={d.substanceId} position={[p.x + 2.55, 1.2, p.z + 0.4]} reduced={reduced} dark={dark} scale={1.15} />; } : null}
    />
  );

  const controls = (
    <div className="ml-controls" data-testid="ml-controls-1">
      <section className="ml-card" aria-label="Substance and amount">
        <label className="ml-field"><span className="ml-label">Substance</span>
          <select className="ml-select" value={d.substanceId} onChange={(e) => { ix.cancel(); dispatch({ type: "s1/select", value: e.target.value, substanceId: e.target.value }); }} data-testid="ml-substance">
            {SELECTABLE_IDS.map((id) => { const s = getSubstance(id); return <option key={id} value={id}>{s.formulaDisplay} · {s.name}</option>; })}
          </select></label>
        <div className="ml-qty">
          <span className="ml-label">Amount</span>
          <div className="ml-qty-row">
            {STAGE1_PRESETS.map((n) => <button key={n} type="button" className={"ml-chip" + (view.exact.n === n ? " is-on" : "")} aria-pressed={view.exact.n === n} onClick={() => onAmount(n)} data-testid={`ml-qty-${n}`} disabled={!showQty}>{fmtMol(n)} mol</button>)}
          </div>
          {showQty && <ValueField label="Custom amount" value={fmtMol(view.exact.n)} unit="mol" onCommit={(t) => onAmount(t)} error={d.error} testId="ml-amount-input" width={84} />}
          {!showQty && <p className="ml-hint">Finish counting to change the amount and repeat.</p>}
        </div>
      </section>

      <section className="ml-card" aria-label="Investigate">
        <div className="ml-steps" data-testid="ml-steps">
          <button type="button" className={"sim-btn" + (d.inspect ? " is-on" : "")} aria-pressed={d.inspect} onClick={() => dispatch({ type: "s1/inspect", stage: 1, on: !d.inspect })} data-testid="ml-inspect-btn" disabled={!showInspect}><Eye size={14} aria-hidden="true" /> {d.inspect ? "Leave inspect" : "Inspect"}</button>
          {showCount && <button type="button" className="sim-btn sim-btn--primary" onClick={onCount} data-testid="ml-count-btn" disabled={d.amountQ === 0}><Calculator size={14} aria-hidden="true" /> Count constituent {sub.kind === "ionic" ? "ions" : "atoms"}</button>}
          {showSeparate && (d.separated
            ? <button type="button" className="sim-btn" onClick={() => dispatch({ type: "s1/recombine", stage: 1 })} data-testid="ml-recombine-btn"><Undo2 size={14} aria-hidden="true" /> Back to the original count</button>
            : <button type="button" className="sim-btn sim-btn--primary" onClick={onSeparate} data-testid="ml-separate-btn" disabled={d.amountQ === 0 || sub.kind === "metallic"} title={sub.kind === "metallic" ? "A metal is already a count of atoms: nothing smaller to separate" : "Show counting packets (formula composition, not a reaction)"}><Scissors size={14} aria-hidden="true" /> Separate into counting packets</button>)}
        </div>
        {guided && <p className="ml-hint" data-testid="ml-guide-hint">{["1. Choose a substance, then Inspect to look inside the packet.", "2. Select a particle, then count what is in one of them.", "3. Separate into counting packets to see the amounts as packets.", "4. Change the amount (0.5 or 1.5 mol) and repeat."][step]}</p>}
        {askCount && prediction && <PredictCard prediction={prediction} answered={answered} onAnswer={onAnswer} />}
      </section>

      {free && <section className="ml-card" aria-label="Packets"><PacketControls packets={sc.packets} selectedId={ix.selectedId} onSelect={ix.select} onToggleOpen={ix.toggleOpen} onPour={ix.pour} onSplit={ix.split} onCombine={ix.combine} onResetPositions={ix.resetPositions} pourTargetId={null} onPourTarget={() => {}} busy={Boolean(ix.bench.current.pour)} getLabel={packetLabel} /></section>}
    </div>
  );

  const working = view.text.composition;
  const calc = (
    <CalcPanel open={calcOpen} onToggle={setCalcOpen} summary={d.counted ? view.text.composition.join("  ·  ") : `${fmtMol(view.exact.n)} mol of ${sub.formulaDisplay}: ${describeDecomposition(d.amountQ)}`}>
      <div className="ml-calc-grid">
        <div><h4>Counting from the formula</h4>{d.counted ? <ul className="ml-lines" data-testid="ml-composition">{working.map((l) => <li key={l}>{l}</li>)}</ul> : <p className="ml-muted">Press “Count constituent {sub.kind === "ionic" ? "ions" : "atoms"}” to see the numbers.</p>}
          {d.counted && <p className="ml-total">{view.text.total}</p>}
          {sub.kind === "ionic" && d.counted && <p className="ml-muted">{sub.name} is ionic: 1 formula unit = {sub.ions.map((i) => `${i.count === 1 ? "" : i.count}${i.label}`).join(" + ")}. There are no NaCl-type molecules.</p>}</div>
        <div><h4>Subscripts and amounts</h4><p data-testid="ml-subscript-explain">{view.text.explanation}</p></div>
        <div><h4>Entities</h4><p>{fmtMol(view.exact.n)} mol = {view.text.entities}</p><p className="ml-muted">{particleCaption(d.substanceId, detail)}</p></div>
      </div>
    </CalcPanel>
  );

  const status = ix.message.text || defaultStatus(state);
  return <StageFrame layout={layout} stageTitle={STAGE.title} stageBlurb={STAGE.purpose} workspace={workspace} controls={controls} calc={calc} reference={<ReferencePanel compact={layout !== "wide"} />} status={status} statusTone={ix.message.tone === "warn" ? "warn" : "info"} />;
}

function defaultStatus(state) { return state.last?.message || "Drag a packet, or use the buttons. One bag always represents at most 1 mol."; }

function entityDescription(s) {
  if (s.kind === "molecular") { const comp = Object.entries(s.composition).map(([e, c]) => `${c === 1 ? "" : c} ${e}`.trim()).join(" + ");
    return { title: `One ${s.formulaDisplay} ${s.entity.singular}`, detail: `Contains ${comp} atom${s.atomsPerEntity > 1 ? "s" : ""}.`, structure: `${s.geometry.name}${s.geometry.angleLabel ? ` · ${s.geometry.angleLabel}` : ""}` }; }
  if (s.kind === "ionic") return { title: `One ${s.formulaDisplay} ${s.entity.singular}`, detail: `= ${s.ions.map((i) => `${i.count === 1 ? "" : i.count} ${i.label}`.trim()).join(" + ")} ions.`, structure: `${s.lattice.name}. ${s.lattice.note}` };
  return { title: `One ${s.formula} atom`, detail: "A metal is a lattice of atoms: there are no molecules.", structure: `${s.lattice.name}. ${s.lattice.note}` };
}
