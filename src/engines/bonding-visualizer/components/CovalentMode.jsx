import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Merge, Minus, Pause, Play, Plus, Repeat, RotateCcw, Shapes, Trash2 } from "lucide-react";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";
import ElementLibrary from "./ElementLibrary.jsx";
import ModeShell, { Tool, Toolbar } from "./ModeShell.jsx";
import FormationStage from "./FormationStage.jsx";
import MoleculePicker from "./MoleculePicker.jsx";
import RecognitionCard from "./RecognitionCard.jsx";
import { HtmlSubs } from "./subs.jsx";
import { spawnPosition, useAtomDrag, useFrameLoop, useReducedMotion, useWorld } from "./hooks.js";
import { COVALENT_ATOMS } from "../model/elements.js";
import { assignCanvasAtoms, formationFrame, freeFrame, phaseCaption, planFormation } from "../scene/formation.js";
import { buildSummary, chargeLabel, describeStructure, lewisElement, recognise } from "../../../lib/lewis/index.js";

// The rotatable 3D structure (three.js) is loaded only when the student asks for it.
const MoleculeView = lazy(() => import("./MoleculeView.jsx"));

export const MAX_ATOMS = 14; // the resolver's limit (lib/lewis MAX_ATOMS)
const DURATION = 5.2; // seconds of the formation animation
const REDUCED_DURATION = 0.4; // reduced motion: a short, plain move to the end
const SYNC_LIMIT = 4; // up to this many atoms recognition is instant; bigger sets are worked out after a short pause
const GROUPS = [
  { id: "nonmetals", title: "Non-metals", symbols: COVALENT_ATOMS.filter((s) => !["Be", "B", "Al"].includes(s)) },
  { id: "exceptions", title: "Octet exceptions", symbols: ["Be", "B", "Al"] },
];

/** A boolean / number remembered for the browser session only (guarded: storage can be blocked). */
function useSession(key, initial) {
  const [v, setV] = useState(() => {
    try { const s = window.sessionStorage.getItem(`bv.${key}`); return s === null ? initial : JSON.parse(s); } catch { return initial; }
  });
  const set = useCallback((x) => {
    setV(x);
    try { window.sessionStorage.setItem(`bv.${key}`, JSON.stringify(x)); } catch { /* storage blocked: keep it for this page only */ }
  }, [key]);
  return [v, set];
}

const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

/** Why two atoms that were dropped together do not bond (or that they do). Returns a sentence. */
export function contactMessage(sa, sb, result) {
  const ea = lewisElement(sa); const eb = lewisElement(sb);
  if (ea && eb && ea.valence === 8 && eb.valence === 8) return `${sa} and ${sb} both have full outer shells (8 electrons): neither has room for more, so they do not share electrons.`;
  if (result && result.status === "ok") {
    const bonded = result.structure.bonds.some(([i, j]) => pairKey(result.structure.atoms[i], result.structure.atoms[j]) === pairKey(sa, sb));
    if (!bonded) return `In ${result.info.formula} ${sa} and ${sb} are not bonded to each other${sa === sb ? " (each bonds to a different atom)" : ""}. Move them next to the atoms they bond with, or press Form molecule.`;
    return null;
  }
  return result?.message ?? null;
}

export default function CovalentMode({ tabs, onReset }) {
  const reduced = useReducedMotion();
  const { boxRef, svgRef, world, toWorld } = useWorld();
  const counter = useRef({ id: 2, color: 2 });
  const [atoms, setAtoms] = useState([{ id: "a1", symbol: "H", x: 270, y: 280, colorIdx: 0 }, { id: "a2", symbol: "H", x: 630, y: 280, colorIdx: 1 }]);
  const pristine = useRef(true);
  const [charge, setCharge] = useState(0);
  const [beyond, setBeyond] = useSession("beyond", false);
  const [outerOnly, setOuterOnly] = useSession("outerOnly", true);
  const [legendChoice, setLegendChoice] = useSession("legend", null);
  const [small, setSmall] = useState(false);
  const [p, setP] = useState(0);
  const [run, setRun] = useState(false);
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState(null);
  const [altIndex, setAltIndex] = useState(0);
  const [view, setView] = useState("lewis");
  const [note, setNote] = useState("");
  const [autoForm, setAutoForm] = useState(false);
  const [deferred, setDeferred] = useState({ key: "", value: null });

  // a small canvas starts with the key folded away (it would hide the molecule); the student's own choice wins and is remembered
  useEffect(() => {
    const el = boxRef.current; if (!el) return undefined;
    const m = () => { const r = el.getBoundingClientRect(); setSmall(r.height < 400 || r.width < 520); };
    m();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(m) : null; ro?.observe(el);
    return () => ro?.disconnect();
  }, [boxRef]);
  const legendOpen = legendChoice === null ? !small : legendChoice;
  const setLegendOpen = setLegendChoice;

  const symbols = useMemo(() => atoms.map((a) => a.symbol), [atoms]);
  const key = `${symbols.join(",")}|${charge}|${beyond ? 1 : 0}`;
  const atomsRef = useRef(atoms); atomsRef.current = atoms;

  // ---- recognition: instant for small sets, after a short pause (debounced) for bigger ones ----
  const syncResult = useMemo(() => (symbols.length <= SYNC_LIMIT ? recognise(symbols, { charge, beyond }) : null), [symbols, charge, beyond]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (symbols.length <= SYNC_LIMIT) return undefined;
    const t = setTimeout(() => setDeferred({ key, value: recognise(symbols, { charge, beyond }) }), 160);
    return () => clearTimeout(t);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  const pending = symbols.length > SYNC_LIMIT && deferred.key !== key;
  const result = symbols.length <= SYNC_LIMIT ? syncResult : (pending ? null : deferred.value);
  const ok = result?.status === "ok";

  // the structure on show (the best one, or an alternative the student picked)
  const shown = useMemo(() => {
    if (!ok) return null;
    if (altIndex === 0 || !result.alternatives[altIndex - 1]) return result;
    const a = result.alternatives[altIndex - 1];
    const info = describeStructure(a.structure, { entry: a.entry });
    return { ...result, structure: a.structure, info, summary: buildSummary(a.structure, info, a.entry), entry: a.entry, source: a.entry ? "library" : "algorithm", expandedNote: null };
  }, [ok, result, altIndex]);

  const plan = useMemo(() => (shown ? planFormation(shown.structure, { outerOnly, world }) : null), [shown, outerOnly, world]);
  const map = useMemo(() => (plan ? assignCanvasAtoms(plan, atoms) : null), [plan, atoms]);
  const starts = useMemo(() => (plan && map ? plan.structure.atoms.map((_, i) => (map[i] >= 0 ? { x: atoms[map[i]].x, y: atoms[map[i]].y } : plan.final[i])) : null), [plan, map, atoms]);

  // any change to the atoms, the charge, the HL switch or the structure picked: back to "atoms apart"
  useEffect(() => { setP(0); setRun(false); setAltIndex(0); setNote(""); setView("lewis"); }, [key]);
  useEffect(() => { setP(0); setRun(false); }, [altIndex]);
  useEffect(() => { if (autoForm && result && (ok || result.status)) { setAutoForm(false); if (ok) { setP(0); setRun(true); setPlaying(true); } } }, [autoForm, result, ok]);

  // keep the two starting hydrogens at 30% / 70% of the (measured) canvas until the student touches anything
  useEffect(() => {
    if (!pristine.current) return;
    setAtoms((l) => l.map((a, i) => ({ ...a, x: world.W * (i === 0 ? 0.3 : 0.7), y: world.H * 0.47 })));
  }, [world.W, world.H]);

  useFrameLoop((dt) => {
    if (!playing) return;
    if (!reduced) setTime((t) => t + dt);
    if (run) {
      setP((v) => {
        const nv = v + dt / (reduced ? REDUCED_DURATION : DURATION);
        if (nv >= 1) { setRun(false); return 1; }
        return nv;
      });
    }
  });

  const touch = () => { pristine.current = false; };
  const inSetup = p <= 0 && !run;

  // ---- editing the atoms ----
  const addAtom = useCallback((symbol, client) => {
    if (!inSetup) { setP(0); setRun(false); }
    if (atomsRef.current.length >= MAX_ATOMS) { setNote(`Up to ${MAX_ATOMS} atoms: bigger species are beyond what this model can work out.`); return; }
    touch();
    const w = client ? toWorld(client.clientX, client.clientY) : null;
    const n = atomsRef.current.length;
    const pos = w ? { x: Math.min(world.W - 40, Math.max(40, w.x)), y: Math.min(world.H - 40, Math.max(40, w.y)) } : spawnPosition(n, world);
    const id = `a${++counter.current.id}`;
    const colorIdx = counter.current.color++;
    setAtoms((l) => [...l, { id, symbol, x: pos.x, y: pos.y, colorIdx }]);
    setNote("");
  }, [inSetup, toWorld, world]);

  const removeSelected = useCallback(() => {
    if (!selected || !inSetup) return;
    touch();
    setAtoms((l) => l.filter((a) => a.id !== selected));
    setSelected(null);
  }, [selected, inSetup]);

  const moveAtom = useCallback((id, x, y) => { touch(); setAtoms((l) => l.map((a) => (a.id === id ? { ...a, x, y } : a))); }, []);
  const bind = useAtomDrag({ toWorld, world, enabled: inSetup, onMove: moveAtom, onSelect: setSelected });

  const startForming = useCallback(() => { setSelected(null); setNote(""); setPlaying(true); setP(0); setRun(true); }, []);

  // ---- manual approach: when a dragged atom is released next to others ----
  const frameRadiusRef = useRef(40);
  const onDrop = useCallback((id) => {
    const list = atomsRef.current;
    const me = list.find((a) => a.id === id);
    if (!me) return;
    const near = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < frameRadiusRef.current * 1.7;
    const close = list.filter((a) => a.id !== id && near(a, me));
    if (!close.length) { setNote(""); return; }
    if (!ok) { const msg = contactMessage(me.symbol, close[0].symbol, result) ?? result?.message; if (msg) setNote(msg); return; }
    const st = shown.structure; const bondSet = new Set(st.bonds.map(([i, j]) => pairKey(st.atoms[i], st.atoms[j])));
    const good = close.filter((a) => bondSet.has(pairKey(a.symbol, me.symbol)));
    if (!good.length) { setNote(contactMessage(me.symbol, close[0].symbol, result)); return; }
    // are all atoms joined into one group by contacts that are bonds in the structure?
    const seen = new Set([list[0].id]); const queue = [list[0]];
    while (queue.length) {
      const u = queue.pop();
      list.forEach((v) => { if (!seen.has(v.id) && near(u, v) && bondSet.has(pairKey(u.symbol, v.symbol))) { seen.add(v.id); queue.push(v); } });
    }
    if (seen.size === list.length) { setNote(`The atoms are in contact: they bond to form ${shown.info.name ? shown.info.name.toLowerCase() + ", " : ""}${shown.info.formula}.`); startForming(); }
    else setNote(`${me.symbol} is next to a bonding partner. ${list.length - seen.size} more atom${list.length - seen.size === 1 ? " is" : "s are"} still apart: bring ${list.length - seen.size === 1 ? "it" : "them"} close too, or press Form molecule.`);
  }, [ok, result, shown, startForming]);

  // ---- the frame on show ----
  const frame = useMemo(() => {
    if (plan && starts) return formationFrame(plan, starts, p, { time, reduced });
    return freeFrame(atoms, { outerOnly, world, time, reduced });
  }, [plan, starts, p, time, reduced, atoms, outerOnly, world]);
  frameRadiusRef.current = frame.atoms.length ? Math.min(...frame.atoms.map((a) => a.r)) : 40;
  const frameIndexOf = useCallback((canvasId) => (plan && map ? map.findIndex((k) => k >= 0 && atoms[k].id === canvasId) : atoms.findIndex((a) => a.id === canvasId)), [plan, map, atoms]);
  const selectedIndex = selected ? frameIndexOf(selected) : -1;
  const dragFor = useCallback((fi) => {
    if (!inSetup) return null;
    const cid = plan && map ? atoms[map[fi]]?.id : atoms[fi]?.id;
    if (!cid) return null;
    const h = bind(cid, () => { const a = atomsRef.current.find((x) => x.id === cid); return { x: a.x, y: a.y }; });
    return { ...h, onPointerUp: (e) => { h.onPointerUp(e); onDrop(cid); } };
  }, [inSetup, plan, map, atoms, bind, onDrop]);

  // ---- keyboard on the canvas ----
  const onKeyDown = (e) => {
    if (e.target !== e.currentTarget) return;
    if (e.key === "n" || e.key === "N" || e.key === "]" || e.key === "[") {
      e.preventDefault();
      const i = atoms.findIndex((a) => a.id === selected); const step = e.key === "N" || e.key === "[" ? -1 : 1;
      if (atoms.length) setSelected(atoms[(i + step + atoms.length) % atoms.length].id);
      return;
    }
    if (e.key === "Enter") { e.preventDefault(); formMolecule(); return; }
    if (!selected || !inSetup) return;
    const step = e.shiftKey ? 30 : 12;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); touch(); setAtoms((l) => l.map((a) => (a.id === selected ? { ...a, x: Math.min(world.W - 30, Math.max(30, a.x + d[0])), y: Math.min(world.H - 30, Math.max(30, a.y + d[1])) } : a))); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
  };

  // ---- actions ----
  const formMolecule = () => {
    touch();
    if (pending) { setNote("Still working out the structure: one moment."); return; }
    if (!ok) { setNote(result?.message ?? "Add atoms first."); return; }
    startForming();
  };
  const replay = () => { if (!ok) return; startForming(); };
  const scrub = (v) => { if (!ok) return; setRun(false); setPlaying(true); setP(v); };
  const pickMolecule = (entry) => {
    touch();
    const st = (!entry.beyond && entry.octetStructure) ? entry.octetStructure : entry.structure;
    const n = st.atoms.length;
    // the atoms start spread round an ellipse, well apart, then bond on their own
    const rx = world.W * 0.34; const ry = world.H * 0.3; const cx = world.W / 2; const cy = world.H * 0.47;
    const list = st.atoms.map((symbol, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n + (n % 2 === 0 ? Math.PI / n : 0);
      return { id: `a${i + 1}`, symbol, x: n === 1 ? cx : cx + rx * Math.cos(ang), y: n === 1 ? cy : cy + ry * Math.sin(ang), colorIdx: i };
    });
    counter.current = { id: n, color: n };
    setAtoms(list); setSelected(null); setCharge(entry.charge); if (entry.beyond) setBeyond(true);
    setAutoForm(true); setNote("");
  };
  const applyAdditions = (add) => { add.forEach((s) => addAtom(s)); };
  const clearAll = () => { touch(); setAtoms([]); setSelected(null); setCharge(0); };

  // ---- text ----
  const caption = ok && p > 0 ? phaseCaption(p, shown.structure) : "";
  const explain = (() => {
    if (note) return note;
    if (pending) return "Working out the structure of these atoms...";
    if (!result) return "Add atoms from the library, or pick a molecule from the list.";
    if (!ok) return result.message;
    if (p >= 1) return shown.summary;
    if (p > 0) return caption;
    return `${shown.info.name ? `${shown.info.name}, ` : ""}${shown.info.formula}: recognised from the atoms. Press Form molecule to watch them bond, or drag the atoms together.`;
  })();

  const info = ok ? shown.info : null;
  const sgn = (q) => (q === 0 ? "0" : q > 0 ? `+${q}` : `−${-q}`);
  const centreSym = ok && shown.structure.centre != null ? shown.structure.atoms[shown.structure.centre] : null;
  const live = [
    { id: "mol", label: "Molecule", value: ok ? `${info.formula}  ${info.structural}` : pending ? "..." : "–", bg: "#e8f7ef", testId: "live-molecule" },
    { id: "shared", label: "Shared pairs", value: ok ? String(info.bondingPairs) : "–", bg: "#eaf1ff", testId: "live-shared" },
    { id: "lone", label: "Lone pairs", value: ok ? String(info.lonePairs) : "–", bg: "#fff1e0", testId: "live-lone" },
    { id: "centre", label: centreSym ? `Central atom` : "Central atom", value: ok ? (centreSym ?? "none") : "–", bg: "#f1ebfb", testId: "live-central" },
    { id: "charge", label: "Net charge", value: ok ? sgn(info.charge) : sgn(charge), bg: "#f3f4f8", testId: "live-charge" },
  ];

  // ---- options row ----
  const options = (
    <div className="bv-options" data-testid="covalent-options">
      <MoleculePicker onPick={pickMolecule} beyond={beyond} />
      <div className="bv-charge" role="group" aria-label="Overall charge of the species" data-testid="charge-control">
        <span className="bv-charge-label" id="bv-charge-label">Charge</span>
        <button type="button" className="bv-step" onClick={() => setCharge((c) => Math.max(-3, c - 1))} disabled={charge <= -3} aria-label="Decrease charge" data-testid="charge-minus"><Minus size={13} aria-hidden="true" /></button>
        <output className="bv-charge-value" aria-labelledby="bv-charge-label" data-testid="charge-value">{charge === 0 ? "0" : chargeLabel(charge)}</output>
        <button type="button" className="bv-step" onClick={() => setCharge((c) => Math.min(3, c + 1))} disabled={charge >= 3} aria-label="Increase charge" data-testid="charge-plus"><Plus size={13} aria-hidden="true" /></button>
      </div>
      <label className="bv-check" data-testid="outer-only-label" title="Show only the outermost (valence) shell of each atom and its electrons. Inner shells are replaced by a small labelled core.">
        <input type="checkbox" checked={outerOnly} onChange={(e) => setOuterOnly(e.target.checked)} data-testid="outer-only" />
        <span>Only outer-shell electrons</span>
      </label>
      <label className="bv-check bv-check--hl" title="Allow expanded octets (SF6, PCl5) and odd-electron species (NO, NO2). Beyond the IB course." data-testid="beyond-label">
        <input type="checkbox" checked={beyond} onChange={(e) => setBeyond(e.target.checked)} data-testid="beyond-toggle" />
        <span>Beyond the course (HL)</span>
      </label>
      <MiniSwitch
        ariaLabel="View" testId="view-tabs" value={view} onChange={(v) => { if (v === "3d" && !ok) { setNote("Form a molecule first: the 3D view needs a recognised structure."); return; } setView(v); }}
        options={[{ id: "lewis", label: "Electrons", title: "Electron sharing view" }, { id: "3d", label: "3D", title: "Rotatable 3D structure" }]}
      />
    </div>
  );

  const library = <ElementLibrary groups={GROUPS} onAdd={addAtom} dropRef={boxRef} mode="covalent" hint="Click or drag atoms onto the canvas, or pick a molecule above the canvas." />;

  const showLabel = ok && p >= 0.88 && view === "lewis";
  const canvas = (
    <div className="bv-covwrap">
      <div className="bv-canvas" ref={boxRef} tabIndex={0} onKeyDown={onKeyDown} data-testid="canvas" data-stage={frame.stage} data-p={p.toFixed(3)} data-formula={ok ? info.formula : ""} data-atoms={atoms.length} data-status={pending ? "pending" : (result?.status ?? "empty")} data-view={view} data-outer={outerOnly ? "1" : "0"} data-small={small ? "1" : "0"} aria-label="Covalent bonding canvas. N selects the next atom, arrow keys move it, Delete removes it, Enter forms the molecule.">
        {view === "lewis" && atoms.length > 0 && (
          <FormationStage frame={frame} outerOnly={outerOnly} dragFor={dragFor} selectedIndex={selectedIndex} world={world} svgRef={svgRef} onBackgroundDown={() => setSelected(null)} label={ok ? `${info.formula} forming from ${atoms.length} atoms` : `${atoms.length} atoms`} />
        )}
        {view === "lewis" && atoms.length === 0 && <><svg ref={svgRef} className="bv-svg" viewBox={`0 0 ${world.W} ${world.H}`} aria-hidden="true" /><p className="bv-placeholder">Click or drag an atom from the library, or pick a molecule</p></>}
        {view === "3d" && ok && (
          <div className="bv-structure" data-on="1" data-testid="structure-layer">
            <Suspense fallback={<div className="bv-loading" role="status">Loading 3D view</div>}><MoleculeView molecule={shown.structure} playing={playing} reduced={reduced} formulaId={info.formula} /></Suspense>
            <div className="bv-mol-label" data-testid="molecule-label"><b><HtmlSubs text={info.formula} /></b><span><HtmlSubs text={info.structural} /></span></div>
          </div>
        )}
        {view === "lewis" && <span className="bv-badge bv-badge--green" data-testid="stage-badge">{outerOnly ? "Outer-shell electrons only" : "All shells shown"}{p > 0 && p < 1 ? ` · ${Math.round(p * 100)}%` : ""}</span>}
        {showLabel && (
          <div className="bv-mol-label" data-testid="molecule-label"><b><HtmlSubs text={info.formula} /></b><span><HtmlSubs text={info.structural} /></span></div>
        )}
        {view === "lewis" && atoms.length > 0 && (
          <div className="bv-keypanel" data-open={legendOpen ? "1" : "0"} data-testid="legend">
            <button type="button" className="bv-keypanel-toggle" aria-expanded={legendOpen} onClick={() => setLegendOpen(!legendOpen)} data-testid="legend-toggle">Key</button>
            {legendOpen && (
              <ul>
                <li><i className="bv-key bv-key--own" aria-hidden="true" /> Own electron (colour of its atom)</li>
                <li><i className="bv-key bv-key--shared" aria-hidden="true" /> Shared electron (gold ring)</li>
                <li><i className="bv-key bv-key--lens" aria-hidden="true" /> Overlap of two valence shells</li>
                <li><i className="bv-key bv-key--core" aria-hidden="true" /> {outerOnly ? "Core: nucleus + inner electrons (n+)" : "Nucleus"}</li>
              </ul>
            )}
          </div>
        )}
        {caption && view === "lewis" && <p className="bv-note" data-testid="phase-caption">{caption}</p>}
        {!caption && view === "lewis" && atoms.length > 0 && inSetup && <p className="bv-note" data-testid="hint-note">Drag atoms together to bond them, or press Form molecule. Keyboard: N selects an atom, arrows move it.</p>}
        {selected && inSetup && view === "lewis" && (
          <button type="button" className="bv-corner-btn" onClick={removeSelected} data-testid="tool-remove" aria-label="Remove selected atom" title="Remove selected atom"><Trash2 size={15} aria-hidden="true" /></button>
        )}
      </div>
      <RecognitionCard result={result} shown={shown} pending={pending} altIndex={altIndex} onAlt={setAltIndex} onSetCharge={setCharge} onAddAtoms={applyAdditions} onBeyond={() => setBeyond(true)} charge={charge} />
    </div>
  );

  const formTitle = pending ? "Working out the structure" : !ok ? (result?.message ?? "Add atoms first") : "Bring the atoms together and form the bonds automatically";
  const toolbar = (
    <Toolbar label="Covalent bonding controls">
      <Tool primary icon={<Merge size={15} aria-hidden="true" />} label="Form molecule" title={formTitle} disabled={atoms.length === 0} onClick={formMolecule} testId="tool-form-bond" />
      <label className="bv-bring" title={ok ? "Drag to move the atoms from far apart to bonded" : "Needs a recognised molecule"}>
        <span className="bv-bring-label">Far apart</span>
        <input type="range" min="0" max="1000" step="1" value={Math.round(p * 1000)} disabled={!ok} onChange={(e) => scrub(Number(e.target.value) / 1000)} aria-label="Bring the atoms together: far apart to bonded" aria-valuetext={`${Math.round(p * 100)} percent bonded`} data-testid="tool-bring" />
        <span className="bv-bring-label">Bonded</span>
      </label>
      <Tool icon={playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={playing ? "Pause" : "Play"} onClick={() => setPlaying((v) => !v)} testId="tool-pause" pressed={!playing} />
      <Tool icon={<Repeat size={15} aria-hidden="true" />} label="Replay" title="Replay the bond formation" disabled={!ok} onClick={replay} testId="tool-replay" />
      <Tool icon={<Shapes size={15} aria-hidden="true" />} label="Clear" title="Remove all atoms" disabled={atoms.length === 0} onClick={clearAll} testId="tool-clear" />
      <Tool icon={<RotateCcw size={15} aria-hidden="true" />} label="Reset" title="Back to two hydrogen atoms" onClick={onReset} testId="tool-reset" />
    </Toolbar>
  );

  return <ModeShell mode="covalent" state={frame.stage} tabs={tabs} onReset={onReset} library={library} options={options} canvas={canvas} toolbar={toolbar} live={live} explain={explain} />;
}
