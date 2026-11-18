import { useState } from "react";
import Stage from "../scene/Stage.jsx";
import TugScene, { CHARACTER } from "../scene/TugScene.jsx";
import { Card, Pills, Row } from "./parts.jsx";
import { FREE_RANGE, FREE_DEFAULT, REAL_ATOMS, NAMES, PAULING, clampFree, judgePrediction, resultOf } from "../model/tug.js";

const REAL_PAIRS = [["H", "Cl"], ["H", "F"], ["C", "O"], ["N", "H"], ["H", "H"], ["O", "H"], ["C", "H"], ["Cl", "Cl"]];
const nm = (e) => `${NAMES[e]} (${e})`;

export default function TugTab({ reduced }) {
  const [mode, setMode] = useState("free");
  const [free, setFree] = useState(FREE_DEFAULT);
  const [real, setReal] = useState({ a: "H", b: "Cl" });
  const [pick, setPick] = useState(null); // null = still predicting; "A" | "B" | "equal"
  const [pairIdx, setPairIdx] = useState(0);
  const isReal = mode === "real"; const revealed = !isReal || pick !== null;
  const enA = isReal ? PAULING[real.a] : free.enA; const enB = isReal ? PAULING[real.b] : free.enB;
  const labelA = isReal ? real.a : "A"; const labelB = isReal ? real.b : "B";
  const res = resultOf(isReal ? nm(real.a) : "Atom A", isReal ? nm(real.b) : "Atom B", enA, enB);
  const verdict = isReal && pick !== null ? judgePrediction(real.a, real.b, pick) : null;
  const setAtom = (side, el) => { setReal((r) => ({ ...r, [side]: el })); setPick(null); };
  const another = () => { const n = (pairIdx + 1) % REAL_PAIRS.length; setPairIdx(n); setReal({ a: REAL_PAIRS[n][0], b: REAL_PAIRS[n][1] }); setPick(null); };
  const colorOf = (el) => CHARACTER[el] ?? "#8a94ad";
  const caption = !revealed ? "Predict first: which atom pulls the shared electrons harder?"
    : res.equal ? "Equal pull: the shared pair stays in the middle. Symmetric density, no δ+ or δ−."
      : `${res.winner === "A" ? labelA : labelB} pulls harder, so the shared density shifts towards it: it becomes δ−, the other atom δ+.`;
  const sr = `Tug of war: ${labelA} EN ${revealed ? enA.toFixed(2) : "hidden"}, ${labelB} EN ${revealed ? enB.toFixed(2) : "hidden"}. ${caption}`;
  return (
    <div className="pp-tabpanel" data-testid="tab-tug" role="tabpanel" aria-labelledby="pp-tab-tug">
      <Card className="pp-card--stage" title={<><span className="pp-n">1</span>Game: Electron Tug-of-War</>} aside={<Pills ariaLabel="Game mode" testId="tug-mode" size="sm" value={mode} onChange={(m) => { setMode(m); setPick(null); }} options={[{ id: "free", label: "Free Play" }, { id: "real", label: "Real Atoms" }]} />}>
        <div className="pp-stagewrap">
          <Stage testId="pp-stage-tug" ariaLabel={sr} width={12.4} height={6.4} tilt={0.04} reduced={reduced} fallback={sr}>
            <TugScene enA={enA} enB={enB} labelA={labelA} labelB={labelB} colorA={colorOf(isReal ? real.a : "A")} colorB={colorOf(isReal ? real.b : "B")} reveal={revealed ? 1 : 0} showValues={revealed} reduced={reduced} />
          </Stage>
          <p className="pp-modelnote" data-testid="model-note">Simplified electron-density model: not to scale. The two dots are a conceptual picture of the shared pair.</p>
        </div>
        <p className="pp-caption" aria-live="polite" data-testid="caption">{caption}</p>
      </Card>
      <div className="pp-side">
        {!isReal && (
          <Card title="Electronegativity (EN)" testId="free-panel">
            {[["A", "enA", "Atom A"], ["B", "enB", "Atom B"]].map(([k, key, lab]) => (
              <label key={k} className="pp-slider"><span className="pp-slider-top"><b>{lab}</b><output data-testid={`en-value-${k.toLowerCase()}`}>{free[key].toFixed(1)}</output></span>
                <input type="range" min={FREE_RANGE.min} max={FREE_RANGE.max} step={FREE_RANGE.step} value={free[key]} onChange={(e) => setFree((f) => ({ ...f, [key]: clampFree(e.target.value) }))} data-testid={`slider-${k.toLowerCase()}`} aria-label={`Electronegativity of ${lab}`} /></label>
            ))}
            <p className="pp-hint">Fictional atoms: drag the sliders. Equal values share equally.</p>
          </Card>
        )}
        {isReal && (
          <Card title="Real atoms" testId="real-panel">
            <div className="pp-selects">
              {[["a", "Atom 1"], ["b", "Atom 2"]].map(([side, lab]) => (
                <label key={side} className="pp-field"><span>{lab}</span>
                  <select value={real[side]} onChange={(e) => setAtom(side, e.target.value)} data-testid={`atom-${side}`}>{REAL_ATOMS.map((el) => <option key={el} value={el}>{nm(el)}</option>)}</select>
                  <small data-testid={`atom-${side}-en`}>{revealed ? `EN = ${PAULING[real[side]].toFixed(2)} (fixed, Pauling)` : "EN shown after your prediction"}</small></label>
              ))}
            </div>
            {pick === null ? (
              <div className="pp-predict" data-testid="predict">
                <p><b>Which atom attracts the shared electrons more strongly?</b></p>
                <div className="pp-btnrow">
                  <button type="button" className="pp-btn" onClick={() => setPick("A")} data-testid="pick-a">{real.a}</button>
                  <button type="button" className="pp-btn" onClick={() => setPick("B")} data-testid="pick-b">{real.b}</button>
                  <button type="button" className="pp-btn pp-btn--ghost" onClick={() => setPick("equal")} data-testid="pick-equal">Neither (equal)</button>
                </div>
              </div>
            ) : (
              <div className={"pp-feedback " + (verdict.correct ? "is-ok" : "is-no")} role="status" data-testid="feedback"><b>{verdict.correct ? "Correct!" : "Not quite."}</b> {verdict.text}
                <div className="pp-btnrow"><button type="button" className="pp-btn" onClick={another} data-testid="another-pair">Try another pair</button></div></div>
            )}
          </Card>
        )}
        <Card title="Result" testId="result-panel">
          {revealed ? (<>
            <Row label="More electronegative">{res.equal ? "Neither (equal)" : res.more}</Row>
            <Row label="ΔEN" testId="delta-en">{res.dENText}</Row>
            <Row label="Bond type" testId="bond-type">{res.bondType}</Row>
            <Row label="Partial charges" testId="partials">{res.equal ? "none: equal sharing" : `${res.plus.replace(/ \(.*/, "")} δ+ , ${res.minus.replace(/ \(.*/, "")} δ−`}</Row>
          </>) : <p className="pp-hint" data-testid="result-hidden">Make your prediction to reveal the result.</p>}
        </Card>
      </div>
    </div>
  );
}
