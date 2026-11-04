import { useCallback, useRef, useState } from "react";
import Toolbox from "./Toolbox.jsx";
import ViewerPanel from "./ViewerPanel.jsx";
import SelectionBar from "./SelectionBar.jsx";
import { canRedo, canUndo, classify } from "../model/builder.js";

export const DEFAULT_VIEW = { mode: "ed", showDomains: true, showLP: true, showRepulsion: false, showAngles: false };
export function useViewState(initial = DEFAULT_VIEW) {
  const [view, setView] = useState(initial);
  const patch = useCallback((p) => setView((v) => ({ ...v, ...p })), []);
  return { view, patch, reset: () => setView(initial) };
}

/**
 * The toolbox + viewer wiring shared by Build and Challenge: click-to-add, pointer drag-and-drop with a live attachment
 * preview, selection editing, undo / redo / clear / reset. `editable=false` shows the model read-only (drag-to-perturb still works).
 */
export default function useBuilderWorkspace({ hist, dispatch, viewState, model: modelOverride, resetKey, editable = true, lockedNote, hint, emptyHint, onReset, ariaLabel }) {
  const stageRef = useRef(null);
  const [bondTool, setBondTool] = useState(1);
  const [selected, setSelected] = useState(null);
  const [dragging, setDragging] = useState(false);
  const model = modelOverride ?? hist.present;
  const cls = classify(model);
  const selectedId = selected === "central" ? (model.central ? "central" : null) : model.domains.some((d) => d.id === selected) ? selected : null;
  const { view, patch } = viewState;

  const act = useCallback((a) => { if (editable) dispatch(a); }, [editable, dispatch]);
  const activate = useCallback((item) => {
    if (item.type === "bond") { setBondTool(item.order); const sel = model.domains.find((d) => d.id === selectedId); if (sel?.kind === "bond") act({ type: "setOrder", id: sel.id, order: item.order }); return; }
    if (!editable) return;
    if (item.type === "atom") { if (!model.central) act({ type: "setCentral", symbol: item.symbol }); else act({ type: "add", kind: "bond", symbol: item.symbol, order: bondTool }); return; }
    if (item.type === "lp") act({ type: "add", kind: "lp" });
  }, [model, selectedId, act, bondTool, editable]);

  const onDragMove = useCallback((item, x, y) => {
    if (!editable) return;
    const kind = item.type === "atom" ? (model.central ? "bond" : "central") : item.type;
    stageRef.current?.setPreview({ kind, symbol: item.symbol, order: item.type === "atom" ? bondTool : item.order }, x, y);
  }, [model.central, bondTool, editable]);

  const onDrop = useCallback((item, x, y) => {
    stageRef.current?.clearPreview();
    if (!editable) return;
    const hit = stageRef.current?.hit(x, y); if (!hit?.inside) return;
    const pick = hit.pick; const target = pick && pick.kind === "bond" ? model.domains.find((d) => d.id === pick.id) : null;
    if (item.type === "atom") {
      if (!model.central) { dispatch({ type: "setCentral", symbol: item.symbol }); return; }
      if (target) { dispatch({ type: "setSymbol", id: target.id, symbol: item.symbol }); return; } // drop onto a bond / free end: set or replace its atom
      dispatch({ type: "add", kind: "bond", symbol: item.symbol, order: bondTool, hint: hit.dir ?? undefined });
    } else if (item.type === "bond") {
      setBondTool(item.order);
      if (target && target.kind === "bond") { dispatch({ type: "setOrder", id: target.id, order: item.order }); return; }
      dispatch({ type: "add", kind: "bond", symbol: null, order: item.order, hint: hit.dir ?? undefined });
    } else if (item.type === "lp") dispatch({ type: "add", kind: "lp", hint: hit.dir ?? undefined });
  }, [editable, model, dispatch, bondTool]);

  const removeSelected = useCallback((id) => {
    if (!editable) return;
    if (id === "central") { dispatch({ type: "clear" }); setSelected(null); } else dispatch({ type: "remove", id });
  }, [editable, dispatch]);

  const controls = (
    <Toolbox
      bondTool={bondTool} onActivate={activate} onDragMove={onDragMove} onDrop={onDrop} onDragEnd={() => stageRef.current?.clearPreview()}
      hint={hint ?? "Drag atoms from the panel and drop onto the central atom. Use bonds or lone pairs."} disabledNote={!editable ? lockedNote : hist.note}
      canUndo={canUndo(hist) && editable} canRedo={canRedo(hist) && editable}
      onUndo={() => act({ type: "undo" })} onRedo={() => act({ type: "redo" })} onClear={() => act({ type: "clear" })} onReset={() => { act({ type: "reset" }); setSelected(null); setBondTool(1); onReset?.(); }}
    />
  );
  const chamber = (
    <ViewerPanel
      stageRef={stageRef} model={model} resetKey={resetKey} view={view} setMode={(mode) => patch({ mode })} angleEntries={cls.angles?.entries ?? []}
      selectedId={selectedId} onSelect={setSelected} onRemove={removeSelected} onDragActive={setDragging}
      selectionBar={editable ? <SelectionBar model={model} selectedId={selectedId} dispatch={dispatch} onClose={() => setSelected(null)} onClearAll={() => { dispatch({ type: "clear" }); setSelected(null); }} /> : null}
      emptyHint={emptyHint ?? "Drag an atom here to start. The first atom becomes the central atom."} ariaLabel={ariaLabel}
      liveHint
      hint={dragging ? "Release to let the domains relax back to the VSEPR arrangement." : undefined}
    />
  );
  return { controls, chamber, cls, model, selectedId, stageRef, bondTool, resetLocal: () => { setSelected(null); setBondTool(1); } };
}
