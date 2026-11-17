import { useState } from "react";
import { Check } from "lucide-react";
import { parseNumberInput } from "../../engine/numeric.js";
import { checkNumeric } from "../../engine/tutor456.js";
import "./stages456.css";

/** Packet controls for Stages 4-6: the accessible alternatives to dragging (select, open, release into the apparatus, split, combine). */
export function ZoneControls({ packets, ix, getLabel, zoneName, zoneVerb, why = "", busy = false, testId = "ml-zone-controls" }) {
  const sel = packets.find((p) => p.id === ix.selectedId) ?? null;
  const pourWhy = !sel ? "Select a packet first." : sel.q <= 0 ? "That packet is empty." : !sel.open ? "Open the zipper first: a closed packet cannot pour." : why;
  const mayOpen = sel && !busy && !why;
  void mayOpen;
  return (
    <div className="ml-pc" data-testid={testId} role="group" aria-label="Packet controls">
      <div className="ml-pc-list" role="radiogroup" aria-label="Packets on the bench">
        {packets.length === 0 && <span className="ml-muted ml4-empty">No packets on the bench.</span>}
        {packets.map((p, i) => (
          <button key={p.id} type="button" role="radio" aria-checked={p.id === ix.selectedId} className={"ml-chip" + (p.id === ix.selectedId ? " is-on" : "")} onClick={() => ix.select(p.id)} data-testid={`ml-packet-${p.id}`} data-open={p.open ? "1" : "0"} data-role={p.role}>
            {i + 1}. {getLabel(p)}{p.open ? " · open" : ""}
          </button>
        ))}
      </div>
      <div className="ml-pc-actions">
        <button type="button" className="sim-btn" disabled={!sel || busy} onClick={() => ix.toggleOpen(sel.id)} data-testid="ml-open-btn">{sel?.open ? "Close zipper" : "Open zipper"}</button>
        <button type="button" className="sim-btn sim-btn--primary" disabled={Boolean(pourWhy) || busy} title={pourWhy || `${zoneVerb} the selected packet ${zoneName}`} onClick={() => ix.pour(sel.id)} data-testid="ml-zone-pour-btn">{zoneVerb}</button>
        <button type="button" className="sim-btn" disabled={!sel || sel.q < 2 || busy} onClick={() => ix.split(sel.id)} data-testid="ml-split-btn" title="Split the selected packet into two equal parts">Split</button>
        <button type="button" className="sim-btn" disabled={!sel || busy || packets.filter((p) => p.substanceId === sel.substanceId && p.role === sel.role).length < 2} onClick={() => ix.combine(sel.id)} data-testid="ml-combine-btn" title="Combine the selected packet with another packet of the same substance">Combine</button>
        <button type="button" className="sim-btn" onClick={ix.resetPositions} data-testid="ml-reset-pos-btn" title="Put every packet back in its place">Reset positions</button>
      </div>
      <p className="ml-hint" data-testid="ml-pour-why">{sel && pourWhy && !busy ? pourWhy : ""}</p>
    </div>
  );
}

/** One apply question with a numeric answer (spec G: Apply).  `q` = { prompt, expected, unit, how }. */
export function ApplyCard({ q, unit, how, testId = "ml-apply", width = 90 }) {
  const [text, setText] = useState(""); const [fb, setFb] = useState(null);
  const check = () => { const p = parseNumberInput(text, { label: "Answer" }); setFb(p.ok ? checkNumeric(p.value, q.expected, unit, how) : { correct: false, feedback: p.error }); };
  return (
    <section className="ml-card" aria-label="Apply" data-testid={testId}>
      <p className="ml-apply-q"><b>Apply</b> · {q.prompt.replace(/^Apply: /, "")}</p>
      <div className="ml-field-row">
        <input className="ml-input" aria-label={`Your answer in ${unit}`} inputMode="decimal" value={text} onChange={(e) => { setText(e.target.value); setFb(null); }} onKeyDown={(e) => { if (e.key === "Enter") check(); }} data-testid={`${testId}-input`} style={{ width }} />
        <span className="ml-unit">{unit}</span>
        <button type="button" className="sim-btn" onClick={check} data-testid={`${testId}-check`}><Check size={14} aria-hidden="true" /> Check</button>
      </div>
      <p className={"ml-predict-fb" + (fb ? (fb.correct ? " ml4-right" : " ml4-wrong") : "")} role="status" data-testid={`${testId}-fb`}>{fb?.feedback ?? ""}</p>
    </section>
  );
}

/** A small labelled before / change / after table (Stages 5 and 6).  rows: [{ key, name, a, b, c }] */
export function AmountTable({ title, cols, rows, testId, note }) {
  return (
    <div className="ml4-tablewrap">
      <table className="ml4-table" data-testid={testId}>
        <caption className="ml4-cap">{title}</caption>
        <thead><tr><th scope="col">Species</th>{cols.map((c) => <th key={c} scope="col">{c}</th>)}</tr></thead>
        <tbody>{rows.map((r) => <tr key={r.key} data-limiting={r.limiting ? "1" : "0"}><th scope="row">{r.name}{r.tag && <span className="ml4-tag">{r.tag}</span>}</th>{r.cells.map((c, i) => <td key={i}>{c}</td>)}</tr>)}</tbody>
      </table>
      {note && <p className="ml-hint">{note}</p>}
    </div>
  );
}
