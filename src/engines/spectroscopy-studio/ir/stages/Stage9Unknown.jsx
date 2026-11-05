import { useMemo, useState } from "react";
import StepFrame from "../../components/StepFrame.jsx";
import { Badge } from "../../components/ui.jsx";
import { useIr, useIrActions } from "../state/IrContext.jsx";
import { COMPOUNDS, REPRESENTATIVE_NOTE } from "../data/compounds.js";
import { DIAGNOSTIC, evaluateRound, groupLabel, makeRound } from "../physics/challenge.js";
import { transmittanceAt } from "../physics/spectrum.js";
import MolStage from "../components/MolStage.jsx";
import SpectrumPlot from "../components/SpectrumPlot.jsx";
import { IR_STAGES } from "./common.js";

const TEXT = Object.fromEntries(DIAGNOSTIC.map((d) => [d.id, d.text]));
const list = (ids) => (ids.length ? ids.map(groupLabel).join(", ") : "none");

/** Stage 9: unknown compound challenge. The round is generated from a seed; the answer is only computed into the text after the last clue. */
export default function Stage9Unknown() {
  const a = useIrActions(); const { seed, round: r, choice, reveal } = useIr((s) => s.s9);
  const [cursor, setCursor] = useState(null);
  const rd = useMemo(() => makeRound(seed, r), [seed, r]);
  const ev = useMemo(() => evaluateRound(rd), [rd]);
  const bands = ev.spec.bands;
  const shown = choice ?? rd.candidates[0];
  const chosenScore = choice ? ev.scores.find((s) => s.id === choice) : null;
  const observedIds = DIAGNOSTIC.filter((d) => ev.observed[d.id]).map((d) => d.id);
  const verdictOK = reveal >= 3 && choice === ev.best;
  const viz = (
    <div className="ir-buildview ir-unknownview" data-testid="unknown-view" data-round={r} data-reveal={reveal} data-chosen={choice ?? ""}>
      <div className="ir-buildmol">
        <MolStage molId={shown} vib={null} arrows={false} testId="mol-stage" label={`Structure of candidate ${COMPOUNDS[shown].name}`} />
        <Badge className="ss-badge--tl" testId="candidate-caption"><b>{COMPOUNDS[shown].name}</b> · {COMPOUNDS[shown].condensed}<br /><span className="ss-subtitle">{choice ? "your choice" : "candidate structure"}</span></Badge>
      </div>
      <div className="ir-buildplot">
        <SpectrumPlot bands={bands} cursor={cursor} onCursor={setCursor} testId="ir-spectrum" fingerprint
          ariaLabel="Unknown compound: infrared spectrum, transmittance against wavenumber, 4000 to 400 reciprocal centimetres. Move the pointer to read the wavenumber."
          hint={cursor !== null ? `${cursor} cm⁻¹ · T ≈ ${Math.round(transmittanceAt(bands, cursor))} %` : "Move over the spectrum to read it."} />
        <Badge className="ss-badge--tl ir-plotbadge" testId="unknown-caption">Unknown {r + 1} · representative / idealised spectrum</Badge>
      </div>
    </div>
  );
  const strip = (
    <div className="ir-explstrip">
      <div className="ir-cands" role="radiogroup" aria-label="Candidate structures" data-testid="candidates">
        {rd.candidates.map((id) => (
          <button key={id} type="button" role="radio" aria-checked={choice === id} className="sim-btn ss-chipbtn ir-cand" onClick={() => a.patch("s9", { choice: id })} data-testid={`cand-${id}`}>
            <b>{COMPOUNDS[id].name}</b><span>{COMPOUNDS[id].condensed}</span>
          </button>
        ))}
      </div>
      <div className="ss-controlrow">
        <button type="button" className="sim-btn ss-chipbtn" onClick={() => a.patch("s9", { reveal: Math.min(3, reveal + 1) })} disabled={!choice || reveal >= 3} data-testid="reveal-next">{reveal === 0 ? "Check my choice: clue 1" : reveal < 3 ? `Next clue (${reveal + 1} of 3)` : "All clues shown"}</button>
        <button type="button" className="sim-btn ss-chipbtn" onClick={a.nextRound} data-testid="next-unknown">Next unknown</button>
        <span className="ss-stripnote" data-testid="s9-hint">{choice ? "Reveal the clues one at a time." : "Choose a structure first."}</span>
      </div>
    </div>
  );
  const teacher = (
    <>
      <p><b>How to read an unknown.</b> Look first at the region above 1500 cm⁻¹: a broad band near 3300 suggests O–H (alcohol), a very broad band from 3300 to 2500 suggests a carboxylic acid, a strong sharp band near 1700 suggests C=O. Then check what is missing: no C=O rules out the carbonyl compounds, no O–H band rules out alcohols and acids.</p>
      <p><b>Limits.</b> This is a teaching exercise with a small set of candidates. In reality IR rarely identifies a compound alone; it is combined with mass spectrometry and NMR, and the fingerprint region is compared with a reference spectrum.</p>
      <p>{REPRESENTATIVE_NOTE} Each round shifts the band positions and intensities slightly, so no two spectra are identical.</p>
    </>
  );
  return (
    <StepFrame step={9} steps={IR_STAGES} viz={viz} strip={strip} teacher={teacher} vizClass="ss-viz--irbuild">
      <p data-testid="s9-text">Which compound gave this spectrum? Look for the diagnostic bands, then choose.</p>
      <div className="ir-clues" aria-live="polite" data-testid="clues">
        {reveal >= 1 && (
          <div className="ir-clue" data-testid="clue-1"><b>1 · Groups present.</b> The spectrum shows: {observedIds.length ? observedIds.map((id) => <span key={id} className="ir-cluegroup"><b>{groupLabel(id)}</b>: {TEXT[id]}</span>) : "no diagnostic band"}</div>
        )}
        {reveal >= 2 && chosenScore && (
          <div className="ir-clue" data-testid="clue-2"><b>2 · Expected bands for {COMPOUNDS[choice].name}.</b> Missing from the spectrum: <b>{list(chosenScore.missing)}</b>. Seen but not expected: <b>{list(chosenScore.unexpected)}</b>.</div>
        )}
        {reveal >= 3 && (
          <div className={`ir-clue ir-clue--verdict ${verdictOK ? "is-ok" : "is-no"}`} data-testid="clue-3" data-correct={verdictOK ? "1" : "0"}>
            <p><b>3 · Most consistent: {COMPOUNDS[ev.best].name}</b> ({COMPOUNDS[ev.best].condensed}). {verdictOK ? "That is your choice." : "That is not the structure you chose."}</p>
            <ul>
              {ev.scores.filter((s) => s.id !== ev.best).map((s) => (
                <li key={s.id}><b>{COMPOUNDS[s.id].name}</b> is less suitable: {why(s)}</li>
              ))}
            </ul>
            <p className="ss-note">Other bands (C–H, fingerprint) are shared by many compounds, so the decision rests on the diagnostic bands only.</p>
          </div>
        )}
      </div>
    </StepFrame>
  );
}

function why(s) {
  const parts = [];
  if (s.missing.length) parts.push(`it would show ${list(s.missing)}, which is not in the spectrum`);
  if (s.unexpected.length) parts.push(`it has no ${list(s.unexpected)}, but the spectrum has one`);
  return `${parts.join(" and ")}.`;
}
