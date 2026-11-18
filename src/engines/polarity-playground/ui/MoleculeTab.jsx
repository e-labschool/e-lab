import { useRef, useState } from "react";
import { Play, RotateCcw } from "lucide-react";
import Stage from "../scene/Stage.jsx";
import MoleculeScene from "../scene/MoleculeScene.jsx";
import { Card, Pills, Row } from "./parts.jsx";
import useProgress from "./useProgress.js";
import { ALL_MOLECULES, getMolecule } from "../model/molecules.js";
import { DURATION, stageText, vectorFrame } from "../model/vectorAddition.js";

const MODES = [{ id: "model", label: "Molecular Model" }, { id: "bonds", label: "Bond Dipoles" }, { id: "overall", label: "Resultant Dipole" }];

export default function MoleculeTab({ reduced }) {
  const [id, setId] = useState("h2o"); const [mode, setMode] = useState("overall");
  const mol = getMolecule(id); const anim = useProgress({ duration: DURATION, reduced, resetKey: `${id}|${mode}`, auto: mode === "overall" });
  const ref = useRef({ u: 0 }); ref.current.u = mode === "overall" ? anim.p : 1;
  const done = mode !== "overall" || anim.p >= 0.99;
  const frame = vectorFrame(mol, ref.current.u, mode);
  const net = mol.net; const polarBonds = mol.dipoles.filter((d) => d.polar);
  const stage = mode === "overall" ? (done ? "result" : frame.stage) : mode === "bonds" ? "bonds" : "model";
  const caption = done && mode === "overall" ? mol.explain : stageText(mol, stage);
  const angle = mol.angles[0] ? `${mol.angles[0].deg.toFixed(1).replace(/\.0$/, "")}°` : "180°";
  const bondPol = polarBonds.length ? `Polar (${[...new Set(polarBonds.map((d) => `${mol.atoms[d.plus].el}–${mol.atoms[d.minus].el}`))].join(", ")})` : mol.bonds.length ? "Non-polar (no polar bonds)" : "–";
  const size = Math.max(4.6, (mol.radius + 0.7) * 2.2);
  const sr = `${mol.name} ${mol.formula}: ${mol.geometry}. ${net.cancels ? "Bond dipoles cancel; net dipole moment is zero." : net.polar ? "Net dipole is not zero." : "No polar bonds."}`;
  return (
    <div className="pp-tabpanel" data-testid="tab-molecule" role="tabpanel" aria-labelledby="pp-tab-molecule">
      <Card className="pp-card--stage" title={<><span className="pp-n">3</span>Molecular Polarity</>} aside={<Pills ariaLabel="Display" testId="mol-mode" size="sm" value={mode} onChange={setMode} options={MODES} />}>
        <div className="pp-stagewrap">
          <Stage testId="pp-stage-molecule" ariaLabel={sr} width={size * 1.3} height={size} tilt={0.1} orbit reduced={reduced} fallback={sr}>
            <MoleculeScene mol={mol} mode={mode} anim={ref} reduced={reduced} done={done} />
          </Stage>
          <p className="pp-modelnote" data-testid="model-note">Drag to rotate. Arrow lengths show relative ΔEN only (qualitative), not measured dipole moments.</p>
          {mode === "overall" && done && net.cancels && <p className="pp-bigzero" data-testid="net-zero-banner">Net dipole moment = 0</p>}
        </div>
        <div className="pp-bar">
          <button type="button" className="pp-btn pp-btn--primary" onClick={anim.play} disabled={mode !== "overall"} data-testid="play" aria-label="Play vector addition"><Play size={15} aria-hidden="true" /> {done && mode === "overall" ? "Replay" : "Play"}</button>
          <button type="button" className="pp-btn" onClick={anim.reset} disabled={mode !== "overall"} data-testid="mol-reset"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
          <span className="pp-hint" data-testid="stage-label">{mode === "overall" ? { reveal: "1. Bond dipoles", add: "2. Add as vectors", result: "3. Result" }[frame.stage] : ""}</span>
        </div>
        <p className="pp-caption" aria-live="polite" data-testid="caption">{caption}</p>
      </Card>
      <div className="pp-side">
        <Card title="Select molecule" testId="mol-panel">
          <label className="pp-field"><span className="pp-sr">Molecule</span><select value={id} onChange={(e) => setId(e.target.value)} data-testid="mol-select" aria-label="Molecule">{ALL_MOLECULES().map((m) => <option key={m.id} value={m.id}>{m.formula} ({m.name})</option>)}</select></label>
          <div className="pp-chips" role="group" aria-label="Quick pick">{ALL_MOLECULES().map((m) => <button key={m.id} type="button" className={"pp-chip" + (m.id === id ? " is-on" : "")} aria-pressed={m.id === id} onClick={() => setId(m.id)} data-testid={`mol-${m.id}`}>{m.formula}</button>)}</div>
        </Card>
        <Card title="Molecular data" testId="data-card">
          <Row label="Shape" testId="data-shape">{mol.geometry}{mol.angles[0] ? ` (≈ ${angle})` : ""}</Row>
          <Row label="Bond polarity" testId="data-bonds">{bondPol}</Row>
          <Row label="Molecular polarity" testId="data-polarity">{net.polar ? "Polar" : "Non-polar"}</Row>
          <Row label="Dipole moment" testId="data-mu">{net.polar ? "μ ≠ 0" : "μ = 0"}</Row>
        </Card>
      </div>
    </div>
  );
}
