import { useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import Stage from "../scene/Stage.jsx";
import BondScene from "../scene/BondScene.jsx";
import { Card, Key, Pills, Row } from "./parts.jsx";
import useProgress from "./useProgress.js";
import { BOND_PAIRS, describePair, pairById } from "../model/bondPairs.js";

const VIEWS = [{ id: "bond", label: "Bond View" }, { id: "cloud", label: "Electron Cloud" }, { id: "polarity", label: "Bond Polarity" }];
const TITLES = { bond: "Atom and Bond View", cloud: "Electron Cloud View", polarity: "Bond Polarity View" };

export default function BondTab({ reduced }) {
  const [pairId, setPairId] = useState("H-Cl"); const [view, setView] = useState("cloud"); const [compare, setCompare] = useState(false);
  const pair = pairById(pairId); const info = describePair(pair);
  const anim = useProgress({ duration: 3, reduced, resetKey: `${pairId}` });
  const sharing = info.equal ? "equal" : "unequal";
  const caption = info.equal ? "Equal electronegativity: two identical density regions overlap symmetrically about the midpoint."
    : anim.p < 0.95 ? "The shared density is being drawn towards the more electronegative atom…" : `The ${info.minus} side holds more of the shared density: ${info.minus} is δ−, ${info.plus} is δ+.`;
  const sr = `${pair.label}: ${info.summary}. ${caption}`;
  return (
    <div className="pp-tabpanel" data-testid="tab-bond" role="tabpanel" aria-labelledby="pp-tab-bond">
      <Card className="pp-card--stage" title={<><span className="pp-n">2</span>Inside a Covalent Bond</>} aside={<Pills ariaLabel="View" testId="bond-view" size="sm" value={view} onChange={setView} options={VIEWS} />}>
        <h4 className="pp-stagetitle" data-testid="view-title">{TITLES[view]}: {pair.label} <span>({sharing === "equal" ? "equal EN, symmetric" : "different EN, asymmetric"})</span></h4>
        <div className="pp-stagewrap">
          <Stage testId="pp-stage-bond" ariaLabel={sr} width={compare && !(pair.a === "H" && pair.b === "H") ? 14.5 : 9.6} height={6.2} tilt={0.05} reduced={reduced} fallback={sr}>
            <BondScene pair={pair} view={view} progress={anim.p} reduced={reduced} compare={compare} />
          </Stage>
          <p className="pp-modelnote" data-testid="model-note">Simplified electron-density model: not to scale.</p>
        </div>
        <div className="pp-bar">
          <button type="button" className="pp-btn pp-btn--primary" onClick={anim.play} data-testid="play" aria-label="Play animation">{anim.playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} Play Animation</button>
          <button type="button" className="pp-btn" onClick={anim.reset} data-testid="bond-reset"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
          <label className="pp-check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} data-testid="compare" /> Compare with H₂</label>
        </div>
        <p className="pp-caption" aria-live="polite" data-testid="caption">{caption}</p>
      </Card>
      <div className="pp-side">
        <Card title="Select a molecule" testId="pair-panel">
          <label className="pp-field"><span className="pp-sr">Atom pair</span><select value={pairId} onChange={(e) => setPairId(e.target.value)} data-testid="pair-select" aria-label="Atom pair">{BOND_PAIRS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
        </Card>
        <Card title="Bond Polarity" testId="polarity-panel">
          <p className="pp-formula" data-testid="polarity-formula">{info.equal ? <>{pair.a} – {pair.b}: <b>no δ+ / δ−</b></> : <>{info.plus} <b className="pp-plus">δ+</b> <span className="pp-arrow" aria-label="dipole arrow with crossed tail on the delta-plus atom, head towards the delta-minus atom">+⟶</span> {info.minus} <b className="pp-minus">δ−</b></>}</p>
          <Row label="ΔEN" testId="delta-en">{info.dEN.toFixed(2)}</Row>
          <p className="pp-pillnote" data-testid="bond-type">{info.equal ? "Non-polar covalent bond" : info.kind === "slightly polar" ? "Slightly polar covalent bond" : "Polar covalent bond"}</p>
          <p className="pp-hint">{info.equal ? "Equal sharing: no bond dipole arrow." : "Bond dipole: crossed tail on δ+, head towards δ−."}</p>
        </Card>
        <Card title="Colour key"><Key /></Card>
      </div>
    </div>
  );
}
