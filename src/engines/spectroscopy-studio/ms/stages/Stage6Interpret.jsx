import { useState } from "react";
import { X, Plus } from "lucide-react";
import { useMsActions, useMsShallow } from "../state/MsContext.jsx";
import { ChipGroup } from "../components/ui.jsx";
import { ACTIVITIES } from "../state/msState.js";
import { buildExperiment } from "../model/experiment.js";
import { COMMON_LOSSES, peakHint } from "../physics/challenge.js";
import { SPECTRA_NOTE } from "../data/spectra.js";

export function Strip() {
  const a = useMsActions(); const { activity } = useMsShallow((s) => ({ activity: s.activity }));
  return (
    <div className="ss-controlrow" data-testid="stage6-strip">
      <span className="ss-stripnote">Interpret</span>
      <ChipGroup label="Interpretation activity" options={ACTIVITIES.map((x) => ({ id: String(x.id), label: x.label }))} value={String(activity)} onChange={(id) => a.setActivity(id === "null" ? null : id)} testId="activity" small />
      <span className="ss-stripnote">Click a peak, then record what it tells you.</span>
    </div>
  );
}

/** the evidence a student reads from a spectrum, computed from the data (not typed) */
export function evidenceOf(exp) {
  const spec = exp.spec; const main = spec.peaks.filter((p) => !p.derived); const sat = spec.peaks.find((p) => p.derived === "13C"); const M = spec.byMz[spec.mMz];
  const frags = main.filter((p) => p.role !== "M" && p.rel >= 10).sort((p, q) => q.rel - p.rel);
  const ratio = sat ? (100 * sat.rel) / M.rel : null; const nC = ratio !== null ? Math.round(ratio / 1.1) : null;
  return { M, base: spec.byMz[spec.baseMz], frags, ratio, nC, sat, halogen: spec.isotopePattern };
}
const lossText = (M, mz) => { const d = M - mz; return COMMON_LOSSES[d] ? `M – ${d}: loss of ${COMMON_LOSSES[d]}` : `M – ${d}`; };

export function Panel() {
  const a = useMsActions(); const { molId, seed, n, selPeak, notes } = useMsShallow((s) => ({ molId: s.molId, seed: s.seed, n: s.n, selPeak: s.selPeak, notes: s.notes }));
  const exp = buildExperiment({ molId, seed, n }); const ev = evidenceOf(exp); const [text, setText] = useState("");
  const hint = selPeak !== null ? peakHint(exp.spec, selPeak) : null; const pk = selPeak !== null ? exp.spec.byMz[selPeak] : null;
  const mine = notes.slice().sort((p, q) => p.mz - q.mz);
  return (
    <>
      <p data-testid="s6-text">Read the spectrum like evidence. Here the compound is known (<b>{exp.sim.name}</b>), so use it to practise; the <b>Unknown challenge</b> hides the answer. <b>Click a peak</b>, then write one short deduction.</p>
      <details className="ms-more" data-testid="s6-hints"><summary>Hint: what to look for</summary>
        <ul><li>The <b>molecular ion</b> is the heaviest main peak (ignore a tiny peak one unit higher: that is ¹³C).</li><li>The <b>base peak</b> is the tallest (100 %); it is not always M⁺•.</li><li>The <b>gap</b> between M and a fragment is the mass of the neutral piece lost.</li><li>A pair of peaks 2 u apart suggests chlorine (3 : 1) or bromine (1 : 1).</li></ul>
      </details>
      <details className="ms-more" data-testid="s6-reveal"><summary>Reveal: worked interpretation</summary>
        <ul className="ms-evidence-list" data-testid="evidence">
          <li><b>Molecular ion:</b> the heaviest main peak is m/z {ev.M.mz} ({ev.M.rel.toFixed(0)} %), so the molecular mass is {exp.spec.nominalM}.</li>
          <li><b>Base peak:</b> m/z {ev.base.mz} ({exp.cat[ev.base.mz].label}){ev.base.mz === ev.M.mz ? ", which is also the molecular ion" : ", a fragment, not the molecular ion"}.</li>
          <li><b>Significant fragments:</b> {ev.frags.map((p) => `m/z ${p.mz} (${lossText(ev.M.mz, p.mz)})`).join("; ") || "none above 10 %"}.</li>
          <li><b>Isotope pattern:</b> {ev.halogen === "none" ? "no pair 2 u apart, so no chlorine or bromine" : ev.halogen === "cl" ? "a 3 : 1 pair 2 u apart: one chlorine" : "a 1 : 1 pair 2 u apart: one bromine"}{ev.ratio !== null ? `; the M+1 peak is ${ev.ratio.toFixed(1)} % of M, about ${ev.nC} carbon atom${ev.nC === 1 ? "" : "s"} (1.1 % each)` : ""}.</li>
        </ul>
        <p className="ss-note">{exp.spec.explain}</p>
      </details>
      <div className="ms-peakinfo" data-testid="peak-info" aria-live="polite">
        {pk ? (
          <>
            <p><b>m/z {pk.mz}</b> · {exp.cat[pk.mz].label} · {pk.rel.toFixed(pk.rel < 10 ? 1 : 0)} %</p>
            {hint && <ul className="ms-hintlist">{hint.lines.slice(1).map((l) => <li key={l}>{l}</li>)}</ul>}
            <label className="ms-notelabel" htmlFor="ms-note">Your deduction for m/z {pk.mz}</label>
            <div className="ms-noterow">
              <input id="ms-note" type="text" maxLength={160} value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. loss of 15 = CH₃, so a methyl group" className="ms-noteinput" data-testid="note-input" onKeyDown={(e) => { if (e.key === "Enter" && text.trim()) { a.addNote(pk.mz, text); setText(""); } }} />
              <button type="button" className="sim-btn ss-chipbtn" disabled={!text.trim()} onClick={() => { a.addNote(pk.mz, text); setText(""); }} data-testid="note-add"><Plus size={15} aria-hidden="true" /> Record</button>
            </div>
          </>
        ) : <p className="ss-note">Click a peak to see what it might be and to record a deduction.</p>}
      </div>
      <ul className="ms-notes" data-testid="notes" aria-label="Your deductions">
        {mine.map((x) => (
          <li key={x.mz} data-mz={x.mz}><b>m/z {x.mz}</b>: {x.text} <button type="button" className="sim-btn ss-chipbtn ms-chip--sm" onClick={() => a.removeNote(x.mz)} aria-label={`Delete the deduction for m/z ${x.mz}`}><X size={13} aria-hidden="true" /></button></li>
        ))}
        {mine.length === 0 && <li className="ss-note">No deductions yet.</li>}
      </ul>
      <p className="ss-note">{SPECTRA_NOTE}</p>
    </>
  );
}
export const TEACHER = (
  <>
    <p><b>Where the full investigation lives.</b> Combining mass spectrometry with IR and NMR to determine a structure belongs to the separate Structure Investigation tab; it is not repeated here. The earlier mass-spectrometry-only comparison page with IR and NMR was removed from this tab for that reason.</p>
    <p><b>Activities.</b> The halogen isotope-pattern activity (chlorine and bromine clusters from the binomial expansion) and the isotope-abundance / relative-atomic-mass revision activity are reached from the chips under the spectrum. They are optional.</p>
  </>
);
