import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Move, Plus, Copy, Undo2, RotateCcw, Rotate3d, Magnet, Layers, Link2 } from "lucide-react";
import Sci from "./Sci.jsx";
import EnergyPanel, { ExpandButton } from "./EnergyPanel.jsx";
import ViewerStage from "./ViewerStage.jsx";
import PhaseLegend from "./PhaseLegend.jsx";
import { clockOverride } from "../scene/Scene3D.jsx";
import { SELECTABLE_SYMBOLS, condensedLatex } from "../model/elements.js";
import { getElementBySymbol } from "../../../data/chemistry/elements.js";
import { RECIPES, mixOrbitals } from "../model/hybrids.js";
import { workspaceOverlaps } from "../model/overlapVolume.js";
import { createHistory, reduce, describeActive, selectionSummary, analyseWorkspace, atomLabel } from "../model/workspace.js";
import { planSnap } from "../model/snap.js";
import { bondSummary, REASON_TEXT, labelText } from "../model/overlap.js";
import { orbitalSpecs, requestsFromSpecs, highlightFor } from "../scene/viewModel.js";
import { qSlerp, lerp, len, sub, add } from "../model/vec.js";

export const MIX_MS = 1800; // Mix animation: ~0.25 s highlight, ~1.3 s morph, ~0.15 s settle
const SNAP_MS = 450;
const SNAP_MAX_COST = 4.2; // auto-snap on release only for atoms already reasonably close / aligned

export function Seg({ children, label, testId }) { return <div className="hy-seg" role="radiogroup" aria-label={label} data-testid={testId}>{children}</div>; }
export function SegBtn({ checked, onClick, disabled, children, title, testId }) {
  return <button type="button" role="radio" aria-checked={checked} className="hy-seg-btn" onClick={onClick} disabled={disabled} title={title} data-testid={testId}>{children}</button>;
}
export function Switch({ checked, onChange, children, testId, title }) {
  return <label className="hy-switch" title={title}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} data-testid={testId} /><span className="hy-track"><i /></span><span>{children}</span></label>;
}

const dotAxis = (o) => { const u = sub(o.b.pos, o.a.pos); const l = len(u) || 1; return (o.a.axis ? Math.abs(o.a.axis[0] * u[0] + o.a.axis[1] * u[1] + o.a.axis[2] * u[2]) / l : 0); };

const fitFor = (atoms, count) => {
  const c = atoms.reduce((s, a) => add(s, a.pos), [0, 0, 0]).map((v) => v / atoms.length);
  const rad = Math.max(1.55, ...atoms.map((a) => len(sub(a.pos, c)) + 1.6));
  return { key: `lab:${count}`, center: c, radius: rad, keepDirection: atoms.length > 1 };
};

export default function useOrbitalLab() {
  const [hist, dispatch] = useReducer(reduce, undefined, createHistory);
  const [tool, setTool] = useState("move");
  const [showSigma, setShowSigma] = useState(true); const [showPi, setShowPi] = useState(true); const [autoSnap, setAutoSnap] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true); const [focus, setFocus] = useState(false); const [showPhase, setShowPhase] = useState(false);
  const [hover, setHover] = useState(null); const [mixAnim, setMixAnim] = useState(null);
  const [resetCount, setResetCount] = useState(0);
  const histRef = useRef(hist); histRef.current = hist;
  const snapRef = useRef(0); const timers = useRef([]);
  const present = hist.present; const active = present.atoms.find((a) => a.id === present.activeId) ?? present.atoms[0];
  const info = describeActive(active); const summary = selectionSummary(active);

  useEffect(() => () => { snapRef.current += 1; timers.current.forEach(clearTimeout); }, []);
  // safety net: the mix animation always ends (also where WebGL is unavailable and nothing renders it)
  useEffect(() => { if (!mixAnim) return undefined; let t = 0; const arm = () => { t = setTimeout(() => { if (clockOverride.morph !== null) arm(); else setMixAnim(null); }, MIX_MS + 250); }; arm(); return () => clearTimeout(t); }, [mixAnim]);

  const analysis = useMemo(() => analyseWorkspace(present.atoms), [present.atoms]);
  const apply = useCallback((action) => { snapRef.current += 1; dispatch(action); }, []);

  const onSymbol = (symbol) => { setMixAnim(null); apply({ type: "setSymbol", symbol }); };
  const onKind = (kind, promotionId) => { setMixAnim(null); apply({ type: "setKind", kind, promotionId }); };
  const onMix = () => {
    const before = histRef.current; const next = reduce(before, { type: "mix" });
    const a = next.present.atoms.find((x) => x.id === next.present.activeId); const was = before.present.atoms.find((x) => x.id === a.id);
    if (a.hybrid && !was.hybrid) setMixAnim({ atomId: a.id, startMs: performance.now(), durMs: MIX_MS });
    dispatch({ type: "mix" });
  };
  const onUndo = () => { snapRef.current += 1; setMixAnim(null); dispatch({ type: "undo" }); };
  const onReset = () => { snapRef.current += 1; setMixAnim(null); setHover(null); setTool("move"); setShowSigma(true); setShowPi(true); setAutoSnap(false); setFocus(false); setShowPhase(false); setResetCount((c) => c + 1); dispatch({ type: "reset" }); };

  // ---- snap (animated; one undo step)
  const runSnap = useCallback((id, { threshold = Infinity } = {}) => {
    const atoms = histRef.current.present.atoms; const a = atoms.find((x) => x.id === id); if (!a) return false;
    const plan = planSnap(atoms, id);
    if (!plan) { dispatch({ type: "note", note: `No valid overlap found for ${atomLabel(atoms, a)}: it needs an unpaired orbital that can overlap an orbital of another atom (sigma end-on, or parallel p orbitals for pi).` }); return false; }
    if (plan.cost > threshold) return false;
    const token = ++snapRef.current; const t0 = performance.now(); const from = { pos: a.pos, quat: a.quat };
    dispatch({ type: "gestureStart" }); dispatch({ type: "setActive", id });
    const step = () => {
      if (snapRef.current !== token) { dispatch({ type: "gestureEnd" }); return; }
      const k = Math.min(1, (performance.now() - t0) / SNAP_MS); const e = k * k * (3 - 2 * k);
      dispatch({ type: "transform", id, pos: lerp(from.pos, plan.pos, e), quat: qSlerp(from.quat, plan.quat, e) });
      if (k < 1) requestAnimationFrame(step);
      else { dispatch({ type: "gestureEnd" }); dispatch({ type: "note", note: `Snapped: ${plan.bonds.map(labelText).join(", ")}.` }); }
    };
    requestAnimationFrame(step); return true;
  }, []);

  // ---- viewer callbacks
  const getAtom = useCallback((id) => histRef.current.present.atoms.find((a) => a.id === id), []);
  const onOrbitalClick = useCallback((atomId, orbId) => { dispatch({ type: "toggleOrbital", atomId, orbId }); }, []);
  const onAtomClick = useCallback((id) => dispatch({ type: "setActive", id }), []);
  const onGestureStart = useCallback((id) => { snapRef.current += 1; dispatch({ type: "gestureStart" }); dispatch({ type: "setActive", id }); }, []);
  const onTransform = useCallback((id, patch) => dispatch({ type: "transform", id, ...patch }), []);
  const onGestureEnd = useCallback(() => {
    dispatch({ type: "gestureEnd" });
    if (autoSnapRef.current) { const id = histRef.current.present.activeId; timers.current.push(setTimeout(() => runSnap(id, { threshold: SNAP_MAX_COST }), 0)); }
  }, [runSnap]);
  const autoSnapRef = useRef(autoSnap); autoSnapRef.current = autoSnap;
  const onHover = useCallback((h) => setHover(h), []);

  // ---- scene view model
  const formedSet = useMemo(() => new Set(present.formed ?? []), [present.formed]);
  const overlaps = useMemo(() => workspaceOverlaps(analysis.instances), [analysis.instances]);
  const bondByPair = useMemo(() => new Map(analysis.bonds.map((b) => [b.id.replace(/^(sigma|pi):/, ""), b])), [analysis.bonds]);
  const unformed = analysis.bonds.filter((b) => !formedSet.has(b.id));
  const view = useMemo(() => {
    const bonds = analysis.bonds.filter((b) => (b.type === "sigma" ? showSigma : showPi));
    // overlap highlights: every in-phase intersection of two half-filled orbitals (size and brightness follow the overlap measure); confirmed bonds are drawn solid
    const regions = []; const shown = new Set(); const tagAt = new Map();
    const pushRegions = (id, type, hl, formed, minStrength = 0) => {
      hl.regions.forEach((r, i) => regions.push({ ...r, id: `${id}#${i}`, type, strength: Math.max(r.strength, minStrength), alpha: 1, formed }));
      if (hl.regions[0]) tagAt.set(id, hl.regions[0].center);
    };
    for (const o of overlaps) {
      const bond = bondByPair.get(o.id); const type = bond ? bond.type : o.a.cls === "p" && o.b.cls === "p" && Math.abs(dotAxis(o)) < 0.5 ? "pi" : "sigma";
      if (type === "sigma" ? !showSigma : !showPi) continue;
      const formed = !!bond && formedSet.has(bond.id); shown.add(o.id);
      pushRegions(o.id, type, { regions: o.regions.map((r) => ({ ...r, strength: o.strength })) }, formed);
    }
    for (const b of bonds) { // a confirmed bond is always drawn, even when its overlap measure is small
      const pair = b.id.replace(/^(sigma|pi):/, ""); if (shown.has(pair) || !formedSet.has(b.id)) continue;
      pushRegions(pair, b.type, highlightFor(b.a, b.b, b.type), true, 0.6);
    }
    const involved = new Map();
    if (focus) {
      for (const b of analysis.bonds) for (const o of [b.a, b.b]) { if (!involved.has(o.atomId)) involved.set(o.atomId, new Set()); involved.get(o.atomId).add(o.orbId); }
      for (const o of overlaps) if (o.strength > 0.12) for (const q of [o.a, o.b]) { if (!involved.has(q.atomId)) involved.set(q.atomId, new Set()); involved.get(q.atomId).add(q.orbId); }
    }
    const fadeActive = focus && involved.size > 0;
    const atoms = present.atoms.map((a) => {
      const morphing = !!mixAnim && mixAnim.atomId === a.id && !!a.hybrid;
      const keep = involved.get(a.id) ?? new Set();
      const fade = fadeActive ? new Set(a.orbitals.map((o) => o.id).concat((a.hybrid?.hybrids ?? []).map((h) => h.id)).filter((id) => !keep.has(id))) : null;
      const orbitals = orbitalSpecs(a, { selected: new Set(a.selected), hover: hover && hover.atomId === a.id ? hover.orbId : null, morph: morphing, labels: !!a.hybrid, fade });
      for (const s of orbitals) if (s.cls === "hybrid") s.latex = RECIPES[a.hybrid.recipeId].latex;
      return { id: a.id, symbol: a.symbol, label: atomLabel(present.atoms, a), pos: a.pos, quat: a.quat, active: a.id === present.activeId, orbitals };
    });
    return {
      atoms, regions, gizmo: tool === "rotate", showPhase, smooth: false, morph: mixAnim ? { atomIds: [mixAnim.atomId], startMs: mixAnim.startMs, durMs: mixAnim.durMs } : null,
      bondTags: bonds.length <= 8 ? bonds.map((b) => { const c = tagAt.get(b.id.replace(/^(sigma|pi):/, "")) ?? b.center; return { id: b.id, type: b.type, latex: b.label, position: b.type === "pi" ? [c[0] + b.side[0] * 0.62, c[1] + b.side[1] * 0.62, c[2] + b.side[2] * 0.62] : [c[0], c[1], c[2] - 0.5] }; }) : [],
    };
  }, [present.atoms, present.activeId, hover, mixAnim, analysis, overlaps, bondByPair, formedSet, showSigma, showPi, tool, focus, showPhase]);
  const warm = useMemo(() => {
    const specs = present.atoms.flatMap((a) => orbitalSpecs(a, {}));
    const ids = active.selected.filter((id) => active.orbitals.some((o) => o.id === id)); const mixed = ids.length > 1 && !active.hybrid ? mixOrbitals(active.orbitals, ids) : null;
    if (mixed?.ok) specs.push(...orbitalSpecs({ ...active, hybrid: { recipeId: mixed.recipeId, consumed: mixed.consumed, remaining: mixed.remaining, hybrids: mixed.hybrids, totalElectrons: mixed.totalElectrons } }, {}));
    return requestsFromSpecs(specs);
  }, [present.atoms, active]);
  const fit = useMemo(() => fitFor(present.atoms, `${present.atoms.length}:${resetCount}`), [present.atoms.length, resetCount]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- explanation line
  const recipe = active.hybrid ? RECIPES[active.hybrid.recipeId] : null;
  let explain;
  if (present.note) explain = present.note;
  else if (analysis.bonds.length) explain = `Bonds formed: ${bondSummary(analysis.sigma, analysis.pi)} — ${analysis.bonds.map((b) => b.plain.replace("sigma", "σ").replace("pi", "π")).join(", ")}.`;
  else if (analysis.near && present.atoms.length > 1) explain = `Not bonded: ${analysis.near.a.plain} and ${analysis.near.b.plain} are close, but they are ${REASON_TEXT[analysis.near.reason] ?? "not compatible"}.`;
  else if (summary.ok) explain = `Mix ${summary.parts.length} orbitals → ${summary.parts.length} ${RECIPES[info.analysis.recipeId].id.replace("2", "²").replace("3", "³")} hybrid orbitals (${RECIPES[info.analysis.recipeId].geometry.toLowerCase()}, ${RECIPES[info.analysis.recipeId].idealText}). Press Mix Selected Orbitals.`;
  else if (recipe) explain = `${recipe.id.replace("2", "²").replace("3", "³")} hybridisation: ${active.hybrid.hybrids.length} hybrid orbitals (${recipe.geometry.toLowerCase()}, ${recipe.idealText})${active.hybrid.remaining.filter((id) => active.orbitals.find((o) => o.id === id && (o.type !== "d" || o.electrons))).length ? `; the unhybridised ${active.hybrid.remaining.filter((id) => active.orbitals.find((o) => o.id === id && (o.type !== "d" || o.electrons))).join(", ")} stay${active.hybrid.remaining.length === 1 ? "s" : ""} as ordinary atomic orbitals` : "; no unhybridised p orbitals remain"}. Add an atom to form bonds.`;
  else explain = "Click orbital boxes (or orbitals in the 3D view) to select orbitals to mix, e.g. 2s + 2px + 2py → sp². Orbital shapes are educational angular-part representations.";

  const el = getElementBySymbol(active.symbol);
  const disabledMix = !info.mix.enabled;
  const tools = (
    <>
      <button type="button" className="hy-vt" aria-pressed={tool === "move"} onClick={() => setTool("move")} title="Move tool: drag an atom (its orbitals move with it)" data-testid="tool-move"><Move size={16} aria-hidden="true" /><span>Move</span></button>
      <button type="button" className="hy-vt" aria-pressed={tool === "rotate"} onClick={() => setTool("rotate")} title="Rotate tool: drag the rings to turn the selected atom about an axis, or drag the atom to tumble its orbitals" data-testid="tool-rotate"><Rotate3d size={16} aria-hidden="true" /><span>Rotate</span></button>
      <button type="button" className="hy-vt" aria-pressed={panelOpen} onClick={() => setPanelOpen((v) => !v)} title="Show or hide the Energy Levels panel" data-testid="vt-energy"><Layers size={16} aria-hidden="true" /><span>Energy</span></button>
    </>
  );

  const controls = (
    <div className="hy-left" data-testid="hybridisation-left" data-tab="lab">
      <section className="hy-ctl" aria-label="Atom">
        <label className="hy-field">Select Element
          <select value={active.symbol} onChange={(e) => onSymbol(e.target.value)} data-testid="select-element" aria-label="Select Element">
            {SELECTABLE_SYMBOLS.map((s) => <option key={s} value={s}>{s} {"–"} {getElementBySymbol(s).name}</option>)}
          </select>
        </label>
        <p className="hy-config" data-testid="config-line"><b>Z = {el.atomicNumber} {"·"} {active.kind === "excited" ? "excited state (illustrative promotion)" : "ground state"}</b><Sci src={condensedLatex(active.state)} /></p>
        <Seg label="Electronic state" testId="state-switch">
          <SegBtn checked={active.kind === "ground"} onClick={() => onKind("ground")} testId="state-ground">Ground State</SegBtn>
          <SegBtn checked={active.kind === "excited"} onClick={() => info.canExcite && onKind("excited", active.promotionId ?? info.promotions[0]?.id)} disabled={!info.canExcite} title={info.canExcite ? "Show the illustrative promotion used in the valence-bond model" : info.noPromotionReason} testId="state-excited">Excited State</SegBtn>
        </Seg>
        {!info.canExcite && <p className="hy-small" data-testid="excited-note">{info.noPromotionReason}</p>}
        {info.promotions.length > 1 && (
          <label className="hy-field">Promotion (illustrative)
            <select value={active.promotionId ?? ""} onChange={(e) => onKind("excited", e.target.value)} disabled={active.kind !== "excited"} data-testid="select-promotion" aria-label="Illustrative promotion">
              {info.promotions.map((p) => <option key={p.id} value={p.id}>{p.example}</option>)}
            </select>
          </label>
        )}
      </section>
      <section className="hy-ctl" aria-label="Hybridisation">
        <p className="hy-summary" data-testid="selection-summary" data-ok={summary.ok} aria-live="polite">
          {summary.parts.length ? <><b>Selected: </b>{summary.parts.map((p, i) => <span key={p}>{i ? " + " : ""}<Sci src={p} /></span>)}{summary.ok ? <> {"→"} <Sci src={summary.result} /></> : summary.hybridCount ? ` (+ ${summary.hybridCount} hybrid)` : ""}</> : summary.hybridCount ? <><b>Selected: </b>{summary.hybridCount} hybrid orbital{summary.hybridCount > 1 ? "s" : ""} (highlight only)</> : <><b>Selected: </b>none</>}
        </p>
        <button type="button" className="hy-btn hy-btn--primary hy-btn--wide" onClick={onMix} disabled={disabledMix} title={disabledMix ? info.mix.reason : "Mix the selected atomic orbitals into hybrid orbitals"} data-testid="btn-mix">Mix Selected Orbitals</button>
      </section>
      <section className="hy-ctl" aria-label="Atoms and bonding">
        <div className="hy-pair">
          <button type="button" className="hy-btn" onClick={() => { setMixAnim(null); apply({ type: "addAtom", symbol: "H" }); }} title="Add a hydrogen atom to the workspace (change its element with Select Element)" data-testid="btn-add-atom"><Plus size={14} aria-hidden="true" /> Add Atom</button>
          <button type="button" className="hy-btn" onClick={() => apply({ type: "duplicate" })} title="Copy the selected atom with its configuration, selection and hybridisation" data-testid="btn-duplicate"><Copy size={14} aria-hidden="true" /> Duplicate</button>
        </div>
        <Switch checked={autoSnap} onChange={setAutoSnap} testId="opt-snap" title="When on, releasing a dragged atom near a valid overlap smoothly aligns and positions it">Snap to Overlap</Switch>
        <Switch checked={focus} onChange={setFocus} testId="opt-focus" title="Fade the orbitals that take no part in the overlap, so the bonding region stays clear">Focus on overlap</Switch>
        <button type="button" className="hy-btn hy-btn--wide" onClick={() => runSnap(present.activeId)} disabled={present.atoms.length < 2} title="Smoothly align the selected atom to its nearest valid overlap" data-testid="btn-snap-now"><Magnet size={14} aria-hidden="true" /> Snap now</button>
        {unformed.length > 0 && (
          <button type="button" className="hy-btn hy-btn--primary hy-btn--wide" onClick={() => apply({ type: "formBonds", note: `Bond formed: ${unformed.map((b) => labelText(b.label)).join(", ")}.` })} title="The overlap check passed: confirm it so the bond stays drawn" data-testid="btn-form-bond"><Link2 size={14} aria-hidden="true" /> Form bond{unformed.length > 1 ? "s" : ""}</button>
        )}
        <div className="hy-pair">
          <Switch checked={showSigma} onChange={setShowSigma} testId="opt-sigma">Show {"σ"}</Switch>
          <Switch checked={showPi} onChange={setShowPi} testId="opt-pi">Show {"π"}</Switch>
        </div>
        <div className="hy-pair">
          <button type="button" className="hy-btn" onClick={onUndo} disabled={!hist.past.length} data-testid="btn-undo" title="Undo the last change"><Undo2 size={14} aria-hidden="true" /> Undo</button>
          <button type="button" className="hy-btn" onClick={onReset} data-testid="btn-reset" title="Reset the workspace to a single carbon atom"><RotateCcw size={14} aria-hidden="true" /> Reset</button>
        </div>
      </section>
    </div>
  );

  const barBonds = analysis.bonds.filter((b) => (b.type === "sigma" ? showSigma : showPi));
  const chamber = (
    <div className="hy-center" data-tab="lab">
      <div className="hy-viewer">
        <ViewerStage
          view={view} fit={fit} tool={tool} getAtom={getAtom} onOrbitalClick={onOrbitalClick} onAtomClick={onAtomClick} onHover={onHover}
          onGestureStart={onGestureStart} onTransform={onTransform} onGestureEnd={onGestureEnd} onMorphDone={() => setMixAnim(null)} tools={tools} warm={warm}
          ariaLabel="3D workspace: atoms and their orbitals" testId="hy-stage"
          extraData={{ "data-active": present.activeId, "data-atoms": present.atoms.length, "data-sigma": analysis.sigma, "data-pi": analysis.pi, "data-mixing": mixAnim ? "1" : "0", "data-formed": (present.formed ?? []).length, "data-overlap": overlaps.length ? overlaps[0].measure.toFixed(3) : "0" }}
        >
          <div className="hy-bondbar" data-testid="bond-bar" aria-live="polite">
            <b>Bonds:</b>
            <span className="hy-chip hy-chip--sigma" data-testid="count-sigma">{analysis.sigma} {"σ"}</span>
            <span className="hy-chip hy-chip--pi" data-testid="count-pi">{analysis.pi} {"π"}</span>
            {barBonds.slice(0, 8).map((b) => <span key={b.id} className={`hy-chip hy-chip--${b.type}`} data-testid="bond-label" data-formed={formedSet.has(b.id) ? "true" : "false"}>{formedSet.has(b.id) ? "✓ " : ""}<Sci src={b.label} /></span>)}
          </div>
          <PhaseLegend showPhase={showPhase} onToggle={setShowPhase} />
        </ViewerStage>
      </div>
    </div>
  );

  const toggleOrbital = (id) => dispatch({ type: "toggleOrbital", orbId: id });
  const graph = panelOpen
    ? <div className="hy-right" data-tab="lab"><EnergyPanel atom={active} selectable onToggle={toggleOrbital} hoverId={hover && hover.atomId === active.id ? hover.orbId : null} onCollapse={() => setPanelOpen(false)} label={atomLabel(present.atoms, active)} /></div>
    : null;

  return { controls, chamber, graph, graphShown: panelOpen, explain, onReset, expandButton: panelOpen ? null : <ExpandButton onClick={() => setPanelOpen(true)} />, state: { hist, analysis, active, mixAnim } };
}
