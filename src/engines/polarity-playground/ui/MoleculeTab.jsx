import { useMemo, useRef, useState } from "react";
import { useElementSize } from "../../mole-lab/ui/hooks.js";
import { ExternalLink, Play, RotateCcw } from "lucide-react";
import Stage from "../scene/Stage.jsx";
import MoleculeScene from "../scene/MoleculeScene.jsx";
import { Card, Pills, Row } from "./parts.jsx";
import useProgress from "./useProgress.js";
import { WORDS, simpleExplain } from "./wording.js";
import { ALL_MOLECULES, getMolecule } from "../model/molecules.js";
import { DURATION, layoutOf, stageText, vectorFrame, stageAt } from "../model/vectorAddition.js";

const MODES = [{ id: "model", label: "Molecular Model" }, { id: "bonds", label: "Bond Dipoles" }, { id: "overall", label: "Resultant Dipole" }];
const PARTNER = { co2: "so2", so2: "co2", h2o: "co2", bf3: "nh3", nh3: "bf3", ch4: "ch3cl", ch3cl: "ch4", ccl4: "chcl3", chcl3: "ccl4", becl2: "h2o", sf6: "pcl3", pcl3: "sf6", xef4: "ch2cl2", "cis-dce": "trans-dce", "trans-dce": "cis-dce", h2: "hcl", hcl: "h2", o3: "co2" };
const STEP_LABEL = { geometry: "Step 1 of 6: geometry and partial charges", reveal: "Step 2 of 6: bond dipoles", add: "Step 3 of 6: move copies into the sum", complete: "Step 4 of 6: complete the sum", result: "Step 5 of 6: resultant or cancellation", classify: "Step 6 of 6: polar or non-polar?" };
/** Where the net dipole points, in words: towards the delta- atoms' element (ozone: its end atoms). */
const towards = (m) => (m.special === "o3" ? "towards the end O atoms" : `towards ${[...new Set(m.atoms.filter((_, i) => m.signs[i] < 0).map((a) => a.el))].join(", ")}`);
const IMF_URL = "/simulation/intermolecular-forces-visualiser";
const fmtAngle = (m) => (m.angles.length ? `${Math.min(...m.angles.map((a) => a.deg)).toFixed(1).replace(/\.0$/, "")}°` : "180°");

/** Place two molecules side by side (each with its own vector-sum diagram below it) and return the offsets and the combined box. */
function compareLayout(a, b, placement) {
  const A = layoutOf(a, placement).bounds; const B = layoutOf(b, placement).bounds; const gap = 0.5;
  const offA = [-A.maxX - gap / 2, 0]; const offB = [-B.minX + gap / 2, 0];
  const box = { minX: A.minX + offA[0], maxX: B.maxX + offB[0], minY: Math.min(A.minY, B.minY), maxY: Math.max(A.maxY, B.maxY) };
  return { offA, offB, box };
}

export default function MoleculeTab({ reduced, layout = "wide", simple = false }) {
  const [id, setId] = useState("h2o"); const [mode, setMode] = useState("overall"); const [cmp, setCmp] = useState(false); const [id2, setId2] = useState("co2");
  const W = WORDS(simple); const wrapRef = useRef(null); const wrap = useElementSize(wrapRef); void layout;
  const placement = wrap.width / Math.max(1, wrap.height) >= 1.45 ? "right" : "below"; // a wide stage puts the vector-sum picture beside the molecule, a tall one below it
  const mol = getMolecule(id); const partner = getMolecule(cmp ? (id2 === id ? PARTNER[id] ?? "h2o" : id2) : id);
  const anim = useProgress({ duration: DURATION, reduced, resetKey: `${id}|${cmp ? partner.id : ""}|${mode}`, auto: mode === "overall" });
  const ref = useRef({ u: 0 }); ref.current.u = mode === "overall" ? anim.p : 1;
  const frame = vectorFrame(mol, ref.current.u, mode, placement);
  const done = mode !== "overall" || stageAt(ref.current.u) === "classify"; // step 6 (classification and explanation) is reached at 90 % of the animation
  const net = mol.net; const polarBonds = mol.dipoles.filter((d) => d.polar);
  const stage = mode === "overall" ? frame.stage : mode === "bonds" ? "bonds" : "model";
  const compareText = cmp ? `${mol.formula} and ${partner.formula}: ${mol.net.hasPolarBonds && partner.net.hasPolarBonds ? "both have polar bonds, but " : ""}${mol.formula} is ${net.polar ? "polar" : "non-polar"} and ${partner.formula} is ${partner.net.polar ? "polar" : "non-polar"}. The shape decides whether the bond dipoles cancel.` : "";
  const caption = cmp ? compareText : done && mode === "overall" ? (simple ? simpleExplain(mol) : mol.explain) : stageText(mol, stage);
  const bondPol = polarBonds.length ? `${W.bondPolar.replace(" covalent", "")}${simple ? "" : ""} (${[...new Set(polarBonds.map((d) => `${mol.atoms[d.plus].el}–${mol.atoms[d.minus].el}`))].join(", ")})` : mol.special === "o3" ? "No ΔEN dipoles (all O–O)" : mol.bonds.length ? "Non-polar (no polar bonds)" : "–";
  const lay = useMemo(() => {
    if (!cmp) { const b = layoutOf(mol, placement).bounds; return { offA: [0, 0], offB: [0, 0], box: b }; }
    return compareLayout(mol, partner, placement);
  }, [mol, partner, cmp, placement]);
  const bw0 = lay.box.maxX - lay.box.minX; const bh0 = lay.box.maxY - lay.box.minY; const low = 0.2 * bh0; // room under the picture for the model note
  const high = mode === "overall" && !cmp ? 0.14 * bh0 : 0; // room above for the 'Net dipole moment = 0' banner
  const bw = bw0; const bh = bh0 + low + high; const centre = [(lay.box.minX + lay.box.maxX) / 2, (lay.box.minY - low + lay.box.maxY + high) / 2];
  const sr = `${mol.name} ${mol.formula}: ${mol.geometry}. ${net.cancels ? "Bond dipoles cancel; net dipole moment is zero." : net.polar ? "Net dipole is not zero." : "No polar bonds."}${cmp ? ` ${compareText}` : ""}`;
  const core = ALL_MOLECULES().filter((m) => m.group === "core"); const more = ALL_MOLECULES().filter((m) => m.group === "more");
  const all = ALL_MOLECULES();
  return (
    <div className="pp-tabpanel" data-testid="tab-molecule" role="tabpanel" aria-labelledby="pp-tab-molecule">
      <Card className="pp-card--stage" title={<><span className="pp-n">3</span>Molecular Polarity</>} aside={<Pills ariaLabel="Display" testId="mol-mode" size="sm" value={mode} onChange={setMode} options={MODES} />}>
        <div className="pp-stagewrap" ref={wrapRef}>
          <Stage testId="pp-stage-molecule" ariaLabel={sr} width={bw} height={bh} center={centre} tilt={0.35} orbit reduced={reduced} fallback={sr}>
            <MoleculeScene mol={mol} mode={mode} anim={ref} reduced={reduced} done={done} placement={placement} offset={lay.offA} />
            {cmp && <MoleculeScene mol={partner} mode={mode} anim={ref} reduced={reduced} done={done} placement={placement} offset={lay.offB} tid="b-" />}
          </Stage>
          <p className="pp-modelnote" data-testid="model-note">Drag to rotate. Arrow lengths show relative ΔEN within a molecule (qualitative), not measured dipole moments.</p>
          {mode === "overall" && done && !cmp && net.zero && <p className="pp-bigzero" data-testid="net-zero-banner">Net dipole moment, μ = 0</p>}
          {mode === "overall" && done && !cmp && net.polar && <p className="pp-bigzero pp-bigzero--net" data-testid="net-polar-banner">Net dipole moment, μ ≠ 0 ({towards(mol)})</p>}
        </div>
        <div className="pp-bar">
          <button type="button" className="pp-btn pp-btn--primary" onClick={anim.play} disabled={mode !== "overall"} data-testid="play" aria-label="Play vector addition"><Play size={15} aria-hidden="true" /> {done && mode === "overall" ? "Replay" : "Play"}</button>
          <button type="button" className="pp-btn" onClick={anim.reset} disabled={mode !== "overall"} data-testid="mol-reset"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
          <label className="pp-check"><input type="checkbox" checked={cmp} onChange={(e) => setCmp(e.target.checked)} data-testid="mol-compare" /> Compare</label>
          {cmp && <label className="pp-field pp-field--inline"><span className="pp-sr">Compare with</span><select value={partner.id} onChange={(e) => setId2(e.target.value)} data-testid="mol-compare-select" aria-label="Compare with">{all.filter((m) => m.id !== id).map((m) => <option key={m.id} value={m.id}>{m.formula} ({m.name})</option>)}</select></label>}
          <span className="pp-hint" data-testid="stage-label">{mode === "overall" ? STEP_LABEL[frame.stage] : ""}</span>
        </div>
        <p className="pp-caption" aria-live="polite" data-testid="caption">{caption}</p>
      </Card>
      <div className="pp-side">
        <Card title="Select molecule" testId="mol-panel">
          <label className="pp-field"><span className="pp-sr">Molecule</span>
            <select value={id} onChange={(e) => setId(e.target.value)} data-testid="mol-select" aria-label="Molecule">
              <optgroup label="Core molecules">{core.map((m) => <option key={m.id} value={m.id}>{m.formula} ({m.name})</option>)}</optgroup>
              <optgroup label="More molecules">{more.map((m) => <option key={m.id} value={m.id}>{m.formula} ({m.name}){m.level ? ` · ${m.level}` : ""}</option>)}</optgroup>
            </select></label>
          <div className="pp-chips" role="group" aria-label="Quick pick">{core.map((m) => <button key={m.id} type="button" className={"pp-chip" + (m.id === id ? " is-on" : "")} aria-pressed={m.id === id} onClick={() => setId(m.id)} data-testid={`mol-${m.id}`}>{m.formula}</button>)}</div>
          <p className="pp-grouplabel">More molecules <span>(IGCSE / A level / IB HL extras)</span></p>
          <div className="pp-chips" role="group" aria-label="More molecules">{more.map((m) => <button key={m.id} type="button" className={"pp-chip" + (m.id === id ? " is-on" : "")} aria-pressed={m.id === id} onClick={() => setId(m.id)} data-testid={`mol-${m.id}`} title={m.level ?? m.name}>{m.formula}{m.level ? " (HL)" : ""}</button>)}</div>
        </Card>
        <Card title="Molecular data" testId="data-card">
          <Row label={W.shape} testId="data-shape">{mol.geometry}{mol.angles.length ? ` (≈ ${fmtAngle(mol)})` : ""}</Row>
          <Row label={W.bondQ} testId="data-bonds">{bondPol}</Row>
          <Row label={W.molQ} testId="data-polarity">{net.polar ? W.molPolar : W.molNon}</Row>
          <Row label={W.mu} testId="data-mu">{simple ? (net.polar ? "Yes" : "No") : net.polar ? "μ ≠ 0" : "μ = 0"}</Row>
          {mol.level && <p className="pp-hint" data-testid="level-note">{mol.level}: beyond the core IB SL content.</p>}
          {mol.special === "o3" && <p className="pp-hint" data-testid="o3-note">Special case: all bonds are O–O, so there are no ΔEN bond dipoles, yet ozone is slightly polar (measured μ ≈ 0.53 D; bent, about 117°). The arrows follow the resonance / formal-charge picture (central O δ+, end O atoms δ−) and are qualitative, not from ΔEN.</p>}
          {net.polar && <a className="pp-btn pp-btn--link" href={IMF_URL} target="_blank" rel="noopener noreferrer" data-testid="imf-link"><ExternalLink size={14} aria-hidden="true" /> See how polar molecules attract (IMF simulation)</a>}
        </Card>
      </div>
    </div>
  );
}
