import MsFrame from "./common.jsx";
import { ChipGroup, Scene } from "../components/ui.jsx";
import MsSpectrum from "../components/MsSpectrum.jsx";
import { useMs, useMsActions } from "../state/MsContext.jsx";
import { EXAMPLES, NO_SINGLE_TECHNIQUE, POOLS, TECHNIQUES_ORDER, TECHNIQUE_ROWS, evidenceFor, remaining } from "../data/evidence.js";
import { SPECTRA } from "../data/spectra.js";

const NAME = { ethanol: "Ethanol", propanone: "Propanone", chloromethane: "Chloromethane" };
const TECH_NAME = { ms: "Mass spectrometry", ir: "IR spectroscopy", nmr: "¹H NMR" };
const pct = (x) => (x >= 10 ? Math.round(x) : x.toFixed(1));
/** Stage 13: the table of what each technique gives, and the three kinds of evidence for one example, with the candidates they leave. */
export default function Stage13Compare() {
  const a = useMsActions(); const { example, revealed } = useMs((s) => s.s13);
  const ev = evidenceFor(example); const spec = SPECTRA[example];
  const left = remaining(example, revealed); const leftIds = new Set(left.map((c) => c.id));
  const pool = POOLS[example];
  const card = (tech, body) => (
    <section key={tech} className={`ms-ev ms-ev--${tech}${revealed.includes(tech) ? " is-on" : ""}`} data-testid={`ev-${tech}`} data-revealed={revealed.includes(tech) ? "1" : "0"} aria-label={`${TECH_NAME[tech]} evidence`}>
      <h3>{TECH_NAME[tech]}</h3>
      {revealed.includes(tech) ? body : <p className="ss-note">Not shown yet. Use the button below.</p>}
    </section>
  );
  const viz = (
    <div className="ms-evidence" data-testid="compare-view" data-example={example} data-left={left.length}>
      {card("ms", (
        <>
          <div className="ms-ev-spec"><Scene>{({ w, h }) => <MsSpectrum width={w} height={h} peaks={spec.peaks} labels="mz" compact ariaLabel={`Representative mass spectrum of the example`} testId="ev-ms-spectrum" />}</Scene></div>
          <ul>
            <li>Molecular ion m/z {ev.ms.M.mz} ({pct(ev.ms.M.rel)} %)</li>
            <li>Base peak m/z {ev.ms.base.mz}</li>
            <li>Main fragments: {ev.ms.frags.map((f) => `${f.mz} (${f.label})`).join(", ")}</li>
            <li>{ev.ms.iso}</li>
          </ul>
        </>
      ))}
      {card("ir", (
        <>
          <ul>{ev.ir.bands.map((b) => <li key={`${b.group}${b.nu}`}>{b.nu} cm⁻¹: {b.assign}</li>)}</ul>
          <p className="ss-note">{ev.ir.also}</p><p className="ss-note">{ev.ir.source}</p>
        </>
      ))}
      {card("nmr", (
        <>
          <ul>{ev.nmr.envs.map((e, i) => <li key={i}>δ {Number(e.delta).toFixed(1)} ppm · {e.count} H · {e.mult} ({e.label})</li>)}</ul>
          <p className="ss-note">{ev.nmr.source}</p>
        </>
      ))}
    </div>
  );
  const strip = (
    <div className="ss-controlrow">
      <ChipGroup label="Example compound" options={EXAMPLES.map((id) => ({ id, label: NAME[id] }))} value={example} onChange={a.setExample} testId="example" small />
      <div className="ms-chipgroup" role="group" aria-label="Show evidence">
        {TECHNIQUES_ORDER.map((t) => (
          <button key={t} type="button" className="sim-btn ss-chipbtn ms-chip ms-chip--sm" aria-pressed={revealed.includes(t)} onClick={() => a.toggleEvidence(t)} data-testid={`reveal-${t}`}>{revealed.includes(t) ? "Hide" : "Show"} {t === "nmr" ? "¹H NMR" : t.toUpperCase()}</button>
        ))}
      </div>
    </div>
  );
  const verdict = revealed.length === 0 ? "Show some evidence to narrow the candidates." : left.length === 1 ? `Only ${left[0].name} fits the evidence shown.` : `${left.length} candidates still fit the evidence shown.`;
  return (
    <MsFrame stage={13} viz={viz} strip={strip} teacher={(
      <>
        <p>The candidates are a teaching list (isomers and look-alikes with the same nominal mass). The filters are simple: MS keeps the same molecular-ion mass and halogen pattern, IR keeps candidates that show the observed diagnostic bands, NMR keeps the same hydrogen environments and ratio. Real identification uses all the details of every spectrum, plus exact mass, ¹³C NMR, and often a reference spectrum.</p>
        <p>For chloromethane the Cl pattern with M = 50 settles the answer within this list; for ethanol and propanone this is not so, and no single technique is enough.</p>
      </>
    )}>
      <table className="ms-table" data-testid="technique-table">
        <thead><tr><th scope="col">Technique</th><th scope="col">Main information obtained</th></tr></thead>
        <tbody>{TECHNIQUE_ROWS.map((r) => <tr key={r.id}><th scope="row">{r.name}</th><td>{r.gives}</td></tr>)}</tbody>
      </table>
      <ul className="ms-cands" data-testid="candidates" aria-label="Candidate compounds">
        {pool.map((c) => <li key={c.id} className={leftIds.has(c.id) ? "is-on" : "is-off"} data-testid={`cand-${c.id}`} data-in={leftIds.has(c.id) ? "1" : "0"}>{c.name} <span>{c.formula}</span></li>)}
      </ul>
      <p className="ms-outcome is-ok" data-testid="verdict" aria-live="polite">{verdict}</p>
      <p className="ss-note" data-testid="no-single">{NO_SINGLE_TECHNIQUE}</p>
    </MsFrame>
  );
}
