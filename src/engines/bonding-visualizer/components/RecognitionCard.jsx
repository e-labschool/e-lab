import { AlertTriangle, CheckCircle2, Info, Sparkles } from "lucide-react";
import { HtmlSubs } from "./subs.jsx";
import { chargeLabel } from "../../../lib/lewis/index.js";

const ORDER_WORD = { 1: "single", 2: "double", 3: "triple" };
const fmtCharge = (q) => (q === 0 ? "0" : q > 0 ? `+${q}` : `−${-q}`);

/** The "what did the app recognise" panel: formula and name, counts, bonds, shape hint, polarity and a plain-language summary. */
export default function RecognitionCard({ result, shown, altIndex, onAlt, onSetCharge, onAddAtoms, onBeyond, charge, pending }) {
  if (pending) return <aside className="bv-card" aria-label="Molecule recognised" data-testid="recognition-card" data-status="pending"><p role="status" className="bv-card-msg">Working it out...</p></aside>;
  const r = result;
  if (!r) return null;
  if (r.status !== "ok") {
    return (
      <aside className="bv-card bv-card--no" aria-label="Molecule recognised" data-testid="recognition-card" data-status={r.status}>
        <h3 className="bv-card-title"><AlertTriangle size={15} aria-hidden="true" /> {r.status === "few" ? "Add more atoms" : r.status === "needs-charge" ? "This needs a charge" : r.status === "needs-beyond" ? "Beyond the octet rule" : "No stable molecule"}</h3>
        <p className="bv-card-msg" role="status" aria-live="polite" data-testid="card-message">{r.message}</p>
        <div className="bv-card-actions">
          {r.status === "needs-charge" && r.suggestions?.slice(0, 3).map((s) => (
            <button key={s.charge} type="button" className="bv-action" onClick={() => onSetCharge(s.charge)} data-testid={`apply-charge-${s.charge}`}>Set charge to {chargeLabel(s.charge)}: <HtmlSubs text={s.formula} /></button>
          ))}
          {r.status === "needs-beyond" && <button type="button" className="bv-action" onClick={onBeyond} data-testid="apply-beyond">Switch on Beyond the course (HL)</button>}
          {r.additions?.map((a) => (
            <button key={a.add.join("")} type="button" className="bv-action" onClick={() => onAddAtoms(a.add)} data-testid={`add-${a.add.join("")}`}>Add {a.add.join(" + ")} to make <HtmlSubs text={a.formula} /></button>
          ))}
          {charge !== 0 && <button type="button" className="bv-action bv-action--soft" onClick={() => onSetCharge(0)} data-testid="apply-charge-0">Set charge back to 0</button>}
        </div>
      </aside>
    );
  }
  const info = shown.info; const s = shown.structure;
  const alt = result.alternatives ?? [];
  return (
    <aside className="bv-card" aria-label="Molecule recognised" data-testid="recognition-card" data-status="ok" data-source={shown.source}>
      <header className="bv-card-head">
        <h3 className="bv-card-formula" data-testid="card-formula"><HtmlSubs text={info.formula} /></h3>
        <span className="bv-card-name" data-testid="card-name">{info.name ?? "Unnamed species"}</span>
      </header>
      <p className="bv-card-structural" data-testid="card-structural"><HtmlSubs text={info.structural} /></p>
      <div className="bv-badges">
        <span className={"bv-tag " + (shown.source === "library" ? "bv-tag--ok" : "bv-tag--calc")} title={shown.source === "library" ? "Checked against the hand-verified list" : "Not in the curated list: worked out from the electron count"}>{shown.source === "library" ? <><CheckCircle2 size={12} aria-hidden="true" /> In the verified list</> : <><Sparkles size={12} aria-hidden="true" /> Worked out by the app</>}</span>
        {info.expanded && <span className="bv-tag bv-tag--hl" title="More than 8 electrons around an atom">Expanded octet (HL)</span>}
        {info.radical && <span className="bv-tag bv-tag--hl" title="An unpaired electron">Odd-electron (beyond the course)</span>}
        {info.resonance && <span className="bv-tag" title="Equivalent drawings: the real bonds are all alike">Resonance</span>}
        {info.dative.length > 0 && <span className="bv-tag bv-tag--dative">Coordinate bond</span>}
        {shown.uncertain && <span className="bv-tag bv-tag--warn" title="Formal charges are separated on its atoms">Check this species exists</span>}
      </div>
      <dl className="bv-facts" data-testid="card-facts">
        <div><dt>Valence electrons</dt><dd data-testid="fact-valence">{info.valenceElectrons}</dd></div>
        <div><dt>Bonding pairs</dt><dd data-testid="fact-bonding">{info.bondingPairs}</dd></div>
        <div><dt>Lone pairs</dt><dd data-testid="fact-lone">{info.lonePairs}</dd></div>
        <div><dt>Shared electrons</dt><dd data-testid="fact-shared">{info.sharedElectrons}</dd></div>
        <div><dt>Net charge</dt><dd data-testid="fact-charge">{fmtCharge(info.charge)}</dd></div>
      </dl>
      <section aria-label="Bonds" className="bv-card-sec">
        <h4>Bonds</h4>
        <ul className="bv-bond-list" data-testid="bond-list">
          {info.bonds.map((b) => {
            const row = info.bondTable.find((t) => (t.a === b.a && t.b === b.b) || (t.a === b.b && t.b === b.a));
            return <li key={b.label}><b>{b.count > 1 ? `${b.count} × ` : ""}{b.label}</b> {ORDER_WORD[b.order]}{row && row.delta !== undefined ? <span className="bv-muted"> · ΔEN {row.delta.toFixed(1)}, {row.kind}</span> : null}</li>;
          })}
        </ul>
        {info.resonance && <p className="bv-small" data-testid="resonance-note">{info.resonance[0].atoms.length} equivalent {s.atoms[info.resonance[0].atoms[0]]} atoms share the double bond: {info.resonance[0].forms} resonance forms, average bond order {Math.round(info.resonance[0].average * 100) / 100}.</p>}
      </section>
      <section aria-label="Shape" className="bv-card-sec">
        <h4>Shape</h4>
        <p className="bv-small" data-testid="card-shape">{info.shape || "No single shape for this species."}</p>
        <p className="bv-hint-link">VSEPR: build this shape in the VSEPR Explorer to see the angles.</p>
      </section>
      <section aria-label="Polarity" className="bv-card-sec">
        <h4>Polarity</h4>
        <p className="bv-small" data-testid="card-polarity">{info.polarity}</p>
      </section>
      <section aria-label="Octet and charges" className="bv-card-sec">
        <h4>Electrons around each atom</h4>
        <p className="bv-small" data-testid="card-octet">{info.octet}{info.formalCharges.length ? ` Formal charges: ${info.formalCharges.map((f) => `${f.symbol} ${fmtCharge(f.value)}`).join(", ")}.` : ""}</p>
      </section>
      {shown.expandedNote && <p className="bv-note-inline" data-testid="expanded-note"><Info size={13} aria-hidden="true" /> {shown.expandedNote}</p>}
      <section aria-label="What you built" className="bv-card-sec">
        <h4>What you built</h4>
        <p className="bv-small" data-testid="card-summary">{shown.summary}</p>
      </section>
      {alt.length > 0 && (
        <section aria-label="Other structures" className="bv-card-sec">
          <h4>Other structures from the same atoms</h4>
          <div className="bv-alts" role="group" aria-label="Other structures">
            <button type="button" className="bv-alt" aria-pressed={altIndex === 0} onClick={() => onAlt(0)} data-testid="alt-0"><HtmlSubs text={result.info.name ?? result.info.formula} /></button>
            {alt.map((a, i) => <button key={i} type="button" className="bv-alt" aria-pressed={altIndex === i + 1} onClick={() => onAlt(i + 1)} data-testid={`alt-${i + 1}`}><HtmlSubs text={a.name ?? a.structural} /></button>)}
          </div>
        </section>
      )}
    </aside>
  );
}
