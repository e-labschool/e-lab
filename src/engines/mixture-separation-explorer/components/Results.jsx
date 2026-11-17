// Results panel: verdict, plain-English explanation, what ended up in every container (with a mass bar and a text list), what was
// lost, and (chromatography) the Rf working. Everything shown comes from run.result(); nothing is re-decided here.
import { useId, useMemo, useState } from "react";
import { AlertTriangle, Beaker, CheckCircle2, FlaskConical, Flame, XCircle } from "lucide-react";
import { SUBSTANCES, subName } from "../model/chem.js";
import { describeSample, fmtG, totalMass } from "../model/mixtures.js";
import { checkRf, measureRf } from "../model/chromatography.js";
import { Rich } from "./Rich.jsx";

export const VERDICT = {
  works: { label: "Separated", Icon: CheckCircle2, tone: "ok" },
  partial: { label: "Partly separated", Icon: AlertTriangle, tone: "warn" },
  fails: { label: "Not separated", Icon: XCircle, tone: "bad" },
  unsafe: { label: "Unsafe", Icon: Flame, tone: "bad" },
  reaction: { label: "Chemical change", Icon: FlaskConical, tone: "info" },
  prep: { label: "Preparation step", Icon: Beaker, tone: "info" },
};

const cap = (t) => (t ? t[0].toUpperCase() + t.slice(1) : t);
const FORM_WORD = { solid: "solid", liquid: "liquid", dissolved: "dissolved" };

function CompositionBar({ sample }) {
  const total = totalMass(sample) || 1;
  return (
    <div className="ms-bar" role="img" aria-label={`Composition by mass: ${describeSample(sample)}`}>
      {sample.parts.map((p, i) => (
        <span key={`${p.sub}-${p.form}-${i}`} style={{ width: `${Math.max(2, (p.g / total) * 100)}%`, background: SUBSTANCES[p.sub]?.colour ?? "#999", opacity: p.form === "dissolved" ? 0.55 : 1 }} title={`${subName(p.sub)} (${FORM_WORD[p.form]}) ${fmtG(p.g)}`} />
      ))}
    </div>
  );
}

function OutputCard({ out }) {
  return (
    <li className="ms-out" data-testid={`out-${out.id}`}>
      <div className="ms-out-head"><b>{out.vessel}</b><span>{fmtG(totalMass(out.sample))}</span></div>
      <CompositionBar sample={out.sample} />
      <ul className="ms-out-list">
        {out.sample.parts.map((p, i) => (
          <li key={i}><span className="ms-dot" style={{ background: SUBSTANCES[p.sub]?.colour ?? "#999", opacity: p.form === "dissolved" ? 0.55 : 1 }} aria-hidden="true" />{subName(p.sub)} <em>({FORM_WORD[p.form]})</em> {fmtG(p.g)}</li>
        ))}
      </ul>
      {out.note && <p className="ms-out-note">{out.note}</p>}
    </li>
  );
}

/** The Rf working for a finished chromatogram. `view` is run.view (distances in cm from the baseline). */
export function RfWorkings({ view, chroma, onCheck }) {
  const [pick, setPick] = useState(0);
  const [entry, setEntry] = useState("");
  const [msg, setMsg] = useState(null);
  const inputId = useId();
  const spots = useMemo(() => (view?.spots ?? []).map((s) => ({ ...s, m: measureRf(s.dist, view.frontDist) })), [view]);
  if (!spots.length) {
    return <div className="ms-rf" data-testid="rf-none"><p>No coloured spots formed, so there is no Rf to calculate. {chroma?.invisible?.length ? "Colourless substances are invisible on the paper." : ""}</p></div>;
  }
  const cur = spots[Math.min(pick, spots.length - 1)];
  const check = () => {
    const raw = entry.trim();
    if (!raw) { setMsg({ ok: false, text: "Type your answer first. An Rf is a number between 0 and 1 (no units)." }); return; }
    const r = checkRf(raw, cur.m.rf);
    setMsg({ ok: r.ok, text: r.ok ? `Correct: Rf = ${cur.m.spotMm / 10} cm ÷ ${cur.m.frontMm / 10} cm = ${cur.m.rf.toFixed(2)}.` : r.reason });
    onCheck?.(r.ok);
  };
  return (
    <div className="ms-rf" data-testid="rf-workings">
      <h4 className="ms-h4">Rf values <small>(distances measured from the baseline)</small></h4>
      <p className="ms-eq" aria-label="Rf equals distance moved by the spot divided by distance moved by the solvent front">Rf = <span className="ms-frac"><span>distance moved by the spot</span><span>distance moved by the solvent front</span></span></p>
      <table className="ms-table" data-testid="rf-table">
        <thead><tr><th scope="col">Spot</th><th scope="col">Spot (cm)</th><th scope="col">Front (cm)</th><th scope="col">Rf</th></tr></thead>
        <tbody>
          {spots.map((s) => (
            <tr key={s.sub} data-testid={`rf-row-${s.sub}`}>
              <th scope="row"><span className="ms-dot" style={{ background: SUBSTANCES[s.sub].colour }} aria-hidden="true" />{SUBSTANCES[s.sub].name.replace(" marker pigment", "").replace(" dye", "")}</th>
              <td>{(s.m.spotMm / 10).toFixed(1)}</td><td>{(s.m.frontMm / 10).toFixed(1)}</td><td><b>{s.m.rf == null ? "-" : s.m.rf.toFixed(2)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
      {chroma?.invisible?.length > 0 && <p className="ms-note">Colourless substances ({chroma.invisible.map((i) => subName(i).toLowerCase()).join(", ")}) are invisible on the paper: chromatography of a coloured mixture cannot show them.</p>}
      <div className="ms-try">
        <label htmlFor={inputId}>Try it: Rf of the </label>
        <select aria-label="Choose a spot" value={pick} onChange={(e) => { setPick(Number(e.target.value)); setMsg(null); }} className="sd-btn sd-btn--sm" data-testid="rf-pick">
          {spots.map((s, i) => <option key={s.sub} value={i}>{SUBSTANCES[s.sub].name.replace(" marker pigment", "").replace(" dye", "").toLowerCase()} spot</option>)}
        </select>
        <input id={inputId} className="ms-input" type="number" inputMode="decimal" min="0" max="1" step="0.01" value={entry} onChange={(e) => { setEntry(e.target.value); setMsg(null); }} onKeyDown={(e) => { if (e.key === "Enter") check(); }} data-testid="rf-input" aria-describedby={`${inputId}-hint`} />
        <button type="button" className="sd-btn sd-btn--sm" onClick={check} data-testid="rf-check">Check</button>
        <p id={`${inputId}-hint`} className="ms-hint">Allowed: 0 to 1, because a spot can never travel further than the solvent. Give 2 decimal places.</p>
        {msg && <p className={`ms-msg ms-msg--${msg.ok ? "ok" : "bad"}`} role="status" data-testid="rf-msg">{msg.text}</p>}
      </div>
    </div>
  );
}

export default function Results({ result, methodId, runView }) {
  if (!result) return null;
  const v = VERDICT[result.verdict] ?? VERDICT.fails;
  const Icon = v.Icon;
  const rec = result.recovered ? Object.entries(result.recovered) : [];
  return (
    <section className="ms-card ms-results" aria-label="Results" data-testid="results" data-verdict={result.verdict}>
      <div className={`ms-verdict ms-verdict--${v.tone}`} data-testid="verdict"><Icon size={16} aria-hidden="true" /><span>{v.label}</span></div>
      <h3 className="ms-h3" data-testid="results-headline">{result.headline}</h3>
      <ul className="ms-lines">{result.lines.map((l, i) => <li key={i}><Rich text={cap(l)} /></li>)}</ul>
      {result.caveats?.length > 0 && <ul className="ms-caveats">{result.caveats.map((c, i) => <li key={i}>{c}</li>)}</ul>}
      {methodId === "chromatography" && <RfWorkings view={runView} chroma={result.chromatogram} />}
      {result.outputs?.length > 0 && (
        <>
          <h4 className="ms-h4">What you ended up with</h4>
          <ul className="ms-outs">{result.outputs.map((o) => <OutputCard key={o.id} out={o} />)}</ul>
        </>
      )}
      {result.lost?.length > 0 && (
        <p className="ms-lost" data-testid="lost">Lost: {result.lost.map((l) => `${fmtG(l.g)} of ${subName(l.sub).toLowerCase()} (${l.how})`).join("; ")}.</p>
      )}
      {rec.length > 0 && result.outputs?.length > 0 && (
        <div className="ms-rec" data-testid="recovered">
          <h4 className="ms-h4">Obtained pure and in bulk?</h4>
          <ul>{rec.map(([sub, r]) => <li key={sub} data-ok={r ? "yes" : "no"}>{r ? <CheckCircle2 size={14} aria-label="yes" role="img" /> : <XCircle size={14} aria-label="no" role="img" />}{subName(sub)}{r ? `: ${Math.round(r.purity * 100)} % pure, ${r.form}` : ": not separated"}</li>)}</ul>
        </div>
      )}
      {result.idea && <p className="ms-idea"><b>Key idea.</b> <Rich text={result.idea} /></p>}
    </section>
  );
}
