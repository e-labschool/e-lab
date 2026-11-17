import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import { AVOGADRO_DISPLAY, MOLE_DEFINITION } from "../engine/constants.js";
import { orderChoices } from "../engine/tutor.js";

/** Typed numeric field that NEVER clamps silently: Enter / blur sends the raw text to the store, which validates it and reports why
 *  it was refused (negative, non-numeric, empty, out of range).  `error` comes from the store; the text stays so it can be fixed. */
export function ValueField({ label, value, onCommit, error, unit, testId, readOnly = false, inputMode = "decimal", width = 96, hint }) {
  const id = useId(); const errId = `${id}-err`;
  const [text, setText] = useState(String(value)); const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(String(value)); }, [value, editing]);
  const commit = () => { setEditing(false); if (text.trim() !== String(value)) onCommit(text); };
  return (
    <div className="ml-field">
      <label htmlFor={id} className="ml-label">{label}</label>
      <div className="ml-field-row">
        <input id={id} className="ml-input" type="text" inputMode={inputMode} autoComplete="off" spellCheck="false" style={{ width }} value={text} readOnly={readOnly} data-testid={testId}
          aria-invalid={error ? "true" : undefined} aria-describedby={error ? errId : undefined}
          onFocus={(e) => { setEditing(true); e.target.select(); }} onChange={(e) => setText(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); commit(); e.currentTarget.blur?.(); } else if (e.key === "Escape") { setText(String(value)); setEditing(false); e.currentTarget.blur?.(); } }} />
        {unit && <span className="ml-unit">{unit}</span>}
      </div>
      {hint && !error && <span className="ml-hint">{hint}</span>}
      <span id={errId} className="ml-error" role="alert" data-testid={testId ? `${testId}-error` : undefined}>{error ?? ""}</span>
    </div>
  );
}

/** Segmented control (radio group) with solid selected state (shared button contract). */
export function Segmented({ label, options, value, onChange, testId, compact = false }) {
  return (
    <div className={"ml-seg" + (compact ? " ml-seg--compact" : "")} role="radiogroup" aria-label={label} data-testid={testId}>
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={"ml-seg-btn" + (value === o.value ? " is-on" : "")} onClick={() => onChange(o.value)} data-testid={testId ? `${testId}-${o.value}` : undefined} title={o.title}>{o.label}</button>
      ))}
    </div>
  );
}

/** Persistent mole-reference panel: the definition (A1) and the permanent counting-analogy statement (A2). */
export function ReferencePanel({ compact = false }) {
  const [open, setOpen] = useState(!compact);
  useEffect(() => setOpen(!compact), [compact]);
  return (
    <section className="ml-card ml-ref" aria-label="Mole reference" data-testid="ml-reference">
      <header className="ml-card-head"><h3><Info size={14} aria-hidden="true" /> Mole reference</h3>
        {compact && <button type="button" className="ml-icon-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} aria-label={open ? "Collapse mole reference" : "Expand mole reference"}>{open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>}
      </header>
      <p className="ml-ref-def" data-testid="ml-ref-def"><b>{MOLE_DEFINITION}</b><br /><span className="ml-muted">N<sub>A</sub> = {AVOGADRO_DISPLAY} mol⁻¹ (exact value 6.02214076 × 10²³).</span></p>
      <p className="ml-ref-note" data-testid="ml-analogy"><b>The packets are a counting analogy.</b>{open && <> Every bag is the same size and holds at most 1 mol. They do <u>not</u> show molar volume, density or real packing, and the particles drawn are representative, not 6.022 × 10²³.</>}</p>
    </section>
  );
}

/** Expandable calculations panel: a one-line summary while collapsed, the full working when open. */
export function CalcPanel({ summary, children, defaultOpen = false, open: controlled, onToggle, testId = "ml-calc" }) {
  const [own, setOwn] = useState(defaultOpen); const open = controlled ?? own; const id = useId();
  return (
    <section className="ml-card ml-calc" aria-label="Calculations" data-testid={testId} data-open={open ? "1" : "0"}>
      <button type="button" className="ml-calc-toggle" aria-expanded={open} aria-controls={id} onClick={() => { onToggle ? onToggle(!open) : setOwn(!open); }} data-testid={`${testId}-toggle`}>
        <span className="ml-calc-title">Calculations</span><span className="ml-calc-summary" aria-live="polite">{summary}</span>{open ? <ChevronDown size={16} aria-hidden="true" /> : <ChevronUp size={16} aria-hidden="true" />}
      </button>
      <div id={id} className="ml-calc-body" hidden={!open}>{open && children}</div>
    </section>
  );
}

/** One brief predict question (spec G).  `prediction` comes from engine/tutor.js; the answer is recorded in the store. */
export function PredictCard({ prediction, answered, onAnswer, testId = "ml-predict" }) {
  const choices = orderChoices(prediction.choices, prediction.key);
  return (
    <div className="ml-predict" data-testid={testId} role="group" aria-label="Prediction question">
      <p className="ml-predict-q"><b>Predict</b> · {prediction.prompt.replace(/^Predict: /, "")}</p>
      <div className="ml-choices">
        {choices.map((c) => {
          const picked = answered?.choice === c.id; const cls = answered ? (c.correct ? " is-right" : picked ? " is-wrong" : "") : "";
          return <button key={c.id} type="button" className={"ml-choice" + cls} disabled={Boolean(answered)} onClick={() => onAnswer(c)} data-testid={`${testId}-choice`} data-correct={c.correct ? "1" : "0"}>{c.label}</button>;
        })}
      </div>
      <p className="ml-predict-fb" role="status" aria-live="polite" data-testid={`${testId}-feedback`}>{answered ? (answered.correct ? prediction.explainRight : prediction.explainWrong) : "Choose an answer, then the calculation is revealed."}</p>
    </div>
  );
}

/** The accessible alternatives to dragging: select a packet, then Open / Close, Pour, Split, Combine, Reset position. */
export function PacketControls({ packets, selectedId, onSelect, onToggleOpen, onPour, onSplit, onCombine, onResetPositions, pourTargetId, onPourTarget, busy, getLabel, testId = "ml-packet-controls" }) {
  const sel = packets.find((p) => p.id === selectedId) ?? null;
  const dests = packets.filter((p) => sel && p.id !== sel.id && p.substanceId === sel.substanceId && p.q < 1e9);
  const dest = dests.find((p) => p.id === pourTargetId) ?? dests[0] ?? null;
  const pourWhy = !sel ? "Select a packet first." : !sel.open ? "Open the zipper first: a closed packet cannot pour." : !dest ? "There is no other packet with room to pour into." : sel.q <= 0 ? "That packet is empty." : "";
  return (
    <div className="ml-pc" data-testid={testId} role="group" aria-label="Packet controls">
      <div className="ml-pc-list" role="radiogroup" aria-label="Packets on the bench">
        {packets.map((p, i) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === selectedId} className={"ml-chip" + (p.id === selectedId ? " is-on" : "")} onClick={() => onSelect(p.id)} data-testid={`ml-packet-${p.id}`} data-open={p.open ? "1" : "0"}>
            {i + 1}. {getLabel(p)}{p.open ? " · open" : ""}
          </button>
        ))}
      </div>
      <div className="ml-pc-actions">
        <button type="button" className="sim-btn" disabled={!sel || busy} onClick={() => onToggleOpen(sel.id)} data-testid="ml-open-btn">{sel?.open ? "Close zipper" : "Open zipper"}</button>
        <button type="button" className="sim-btn sim-btn--primary" disabled={Boolean(pourWhy) || busy} title={pourWhy || "Pour the selected packet into another packet"} onClick={() => onPour(sel.id, dest.id)} data-testid="ml-pour-btn">Pour</button>
        <button type="button" className="sim-btn" disabled={!sel || sel.q < 2 || busy} onClick={() => onSplit(sel.id)} data-testid="ml-split-btn" title="Split the selected packet into two equal parts">Split</button>
        <button type="button" className="sim-btn" disabled={!sel || busy || packets.filter((p) => p.substanceId === sel.substanceId).length < 2} onClick={() => onCombine(sel.id)} data-testid="ml-combine-btn" title="Combine the selected packet with another packet of the same substance">Combine</button>
        <button type="button" className="sim-btn" onClick={onResetPositions} data-testid="ml-reset-pos-btn" title="Put every packet back in its place">Reset positions</button>
      </div>
      {sel && dests.length > 1 && (
        <label className="ml-pour-to"><span className="ml-label">Pour into</span>
          <select className="ml-select" value={dest?.id ?? ""} onChange={(e) => onPourTarget(e.target.value)} data-testid="ml-pour-target">{dests.map((d) => <option key={d.id} value={d.id}>{getLabel(d)}</option>)}</select></label>
      )}
      <p className="ml-hint" data-testid="ml-pour-why">{pourWhy}</p>
    </div>
  );
}

export const MODE_OPTIONS = [{ value: "guided", label: "Guided", title: "Predict, interact, observe, explain, apply: controls appear step by step" }, { value: "free", label: "Free", title: "Every control is available at once" }];
