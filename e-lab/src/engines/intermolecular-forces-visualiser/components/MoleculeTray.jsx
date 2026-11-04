import { useRef, useState } from "react";
import MoleculeIcon from "./MoleculeIcon.jsx";
import { MOLECULES, TRAY_NONPOLAR, TRAY_POLAR } from "../model/molecules.js";
import { DND_TYPE } from "../scene/ImfStage.jsx";

// Compact molecule tray: two categories, one small icon button per molecule. Mouse: HTML5 drag onto the workspace. Touch / pen: a
// pointer-driven ghost (HTML5 drag does not start from touch). Keyboard / click: Enter, Space or click adds the molecule.
function Item({ id, onAdd, stageRef, full }) {
  const mol = MOLECULES[id]; const ghost = useRef(null); const press = useRef(null); const [dragging, setDragging] = useState(false);
  const moveGhost = (x, y) => { if (ghost.current) { ghost.current.style.transform = `translate(${x - 22}px, ${y - 22}px)`; } };
  const onPointerDown = (e) => { if (e.pointerType === "mouse") return; press.current = { x: e.clientX, y: e.clientY, pid: e.pointerId, moved: false }; };
  const onPointerMove = (e) => {
    const p = press.current; if (!p || p.pid !== e.pointerId) return;
    if (!p.moved && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 8) { p.moved = true; setDragging(true); e.currentTarget.setPointerCapture?.(e.pointerId); }
    if (p.moved) moveGhost(e.clientX, e.clientY);
  };
  const onPointerUp = (e) => {
    const p = press.current; press.current = null; if (!p || p.pid !== e.pointerId) return;
    if (p.moved) { setDragging(false); if (stageRef.current?.contains(e.clientX, e.clientY)) { stageRef.current.dropAtClient(id, e.clientX, e.clientY); suppressClick.current = true; } }
  };
  const suppressClick = useRef(false);
  return (
    <>
      <button
        type="button" className="imf-tray-item" draggable data-testid={`tray-${id}`} data-molecule={id} aria-label={`${mol.name}, ${mol.label}. Click to add to the workspace, or drag it there.`} title={`${mol.name} (${mol.label}) – click or drag into the workspace`}
        onClick={() => { if (suppressClick.current) { suppressClick.current = false; return; } onAdd(id); }}
        onDragStart={(e) => { e.dataTransfer.setData(DND_TYPE, id); e.dataTransfer.setData("text/plain", id); e.dataTransfer.effectAllowed = "copy"; }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={() => { press.current = null; setDragging(false); }}
      >
        <MoleculeIcon id={id} size={full ? 46 : 40} />
        <span className="imf-tray-label">{mol.label}</span>
      </button>
      {dragging && <div ref={(el) => { ghost.current = el; }} className="imf-ghost" aria-hidden="true"><MoleculeIcon id={id} size={44} /></div>}
    </>
  );
}

export default function MoleculeTray({ onAdd, onClear, stageRef, count, max }) {
  return (
    <div className="imf-tray" data-testid="molecule-tray">
      <section aria-labelledby="imf-tray-nonpolar" data-testid="tray-nonpolar">
        <h3 id="imf-tray-nonpolar" className="imf-tray-h">Nonpolar <small>molecules &amp; particles</small></h3>
        <div className="imf-tray-grid">{TRAY_NONPOLAR.map((id) => <Item key={id} id={id} onAdd={onAdd} stageRef={stageRef} />)}</div>
      </section>
      <section aria-labelledby="imf-tray-polar" data-testid="tray-polar">
        <h3 id="imf-tray-polar" className="imf-tray-h">Polar <small>molecules</small></h3>
        <div className="imf-tray-grid">{TRAY_POLAR.map((id) => <Item key={id} id={id} onAdd={onAdd} stageRef={stageRef} />)}</div>
      </section>
      <p className="imf-tray-foot">{count}/{max} in workspace · drag or click to add<button type="button" className="sim-btn imf-mini" onClick={onClear} disabled={!count} data-testid="clear-workspace">Clear</button></p>
    </div>
  );
}
