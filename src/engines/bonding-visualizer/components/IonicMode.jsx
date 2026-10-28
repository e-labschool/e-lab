import { lazy, Suspense, useCallback, useMemo, useRef, useState } from "react";
import { ArrowLeft, Box, Magnet, Pause, Play, Plus, RotateCcw, Trash2, Zap, Repeat } from "lucide-react";
import ElementLibrary from "./ElementLibrary.jsx";
import ModeShell, { Tool, Toolbar } from "./ModeShell.jsx";
import { AtomBody, ChargeBadge, Electrons, ShellLabel } from "./AtomLayers.jsx";
import { spawnPosition, useAtomDrag, useFrameLoop, useReducedMotion, useWorld } from "./hooks.js";
import { IONIC_METALS, IONIC_NONMETALS, chargeText, getBondingElement, shellText } from "../model/elements.js";
import { MAX_IONIC_ATOMS, analyzeIonic, buildIonicSystem } from "../model/ionic.js";
import { latticeSupport } from "../model/lattice.js";
import { ionicScene } from "../scene/ionicScene.js";

const LatticeStage = lazy(() => import("./LatticeStage.jsx"));

const DUR = { ionizing: 5.2, attracting: 2.8 };
const GROUPS = [
  { id: "metals", title: "Metals", symbols: IONIC_METALS },
  { id: "nonmetals", title: "Non-metals", symbols: IONIC_NONMETALS },
];

const stageText = (stage) => (stage === "ionizing" || stage === "ionized" ? "Stage 1 · Electron transfer" : stage === "attracting" || stage === "attracted" ? "Stage 2 · Electrostatic attraction" : "Place atoms");

export default function IonicMode({ tabs, onReset }) {
  const reduced = useReducedMotion();
  const { boxRef, svgRef, world, toWorld } = useWorld();
  const [atoms, setAtoms] = useState([]);
  const [anim, setAnim] = useState({ stage: "setup", p: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [selected, setSelected] = useState(null);
  const [view, setView] = useState("atoms");
  const [lat, setLat] = useState({ run: 0, reset: 0, playing: true, placed: 0, total: 0 });
  const [note, setNote] = useState("");
  const counter = useRef({ id: 0, color: 0 });

  const symbols = useMemo(() => atoms.map((a) => a.symbol), [atoms]);
  const analysis = useMemo(() => analyzeIonic(symbols), [symbols]);
  const system = useMemo(() => (analysis.status === "valid" ? buildIonicSystem(atoms) : null), [analysis, atoms]);
  const stage = anim.stage;
  const inSetup = stage === "setup";
  const speed = reduced ? 8 : 1;

  useFrameLoop((dt) => {
    if (!playing || view !== "atoms") return;
    if (!reduced) setTime((t) => t + dt);
    setAnim((a) => {
      if (a.stage !== "ionizing" && a.stage !== "attracting") return a;
      const p = a.p + (dt * speed) / DUR[a.stage];
      if (p < 1) return { stage: a.stage, p };
      return { stage: a.stage === "ionizing" ? "ionized" : "attracted", p: 1 };
    });
  });

  const scene = useMemo(
    () => ionicScene({ atoms, system, stage, p: anim.p, time, world, offset }),
    [atoms, system, stage, anim.p, time, world, offset],
  );

  // ---- atoms
  const addAtom = useCallback((symbol, client) => {
    if (!inSetup || view !== "atoms") return;
    if (atoms.length >= MAX_IONIC_ATOMS) { setNote(`Maximum ${MAX_IONIC_ATOMS} atoms on the canvas.`); return; }
    const w = client ? toWorld(client.clientX, client.clientY) : null;
    const pos = w ? { x: Math.min(world.W - 40, Math.max(40, w.x)), y: Math.min(world.H - 40, Math.max(40, w.y)) } : spawnPosition(atoms.length, world);
    const id = `a${++counter.current.id}`;
    const colorIdx = counter.current.color++;
    setAtoms((list) => [...list, { id, symbol, x: pos.x, y: pos.y, colorIdx }]);
    setNote("");
  }, [inSetup, view, atoms.length, toWorld, world]);

  const addMissing = useCallback(() => {
    if (!analysis.missing?.length || !inSetup) return;
    const total = analysis.missing.reduce((n, m) => n + m.count, 0);
    if (atoms.length + total > MAX_IONIC_ATOMS) { setNote(`Maximum ${MAX_IONIC_ATOMS} atoms on the canvas.`); return; }
    const added = [];
    let n = atoms.length;
    for (const m of analysis.missing) for (let i = 0; i < m.count; i += 1) {
      const pos = spawnPosition(n, world); n += 1;
      added.push({ id: `a${++counter.current.id}`, symbol: m.symbol, x: pos.x, y: pos.y, colorIdx: counter.current.color++ });
    }
    setAtoms((list) => [...list, ...added]);
    setNote("");
  }, [analysis, inSetup, atoms.length, world]);

  const removeSelected = useCallback(() => {
    if (!selected || !inSetup) return;
    setAtoms((list) => list.filter((a) => a.id !== selected));
    setSelected(null);
  }, [selected, inSetup]);

  const moveAtom = useCallback((id, x, y) => setAtoms((list) => list.map((a) => (a.id === id ? { ...a, x, y } : a))), []);
  const groupMove = useCallback((dx, dy) => setOffset((o) => ({ x: o.x + dx, y: o.y + dy })), []);
  const bind = useAtomDrag({ toWorld, world, enabled: inSetup, onMove: moveAtom, onSelect: setSelected, onGroupMove: groupMove, groupEnabled: stage === "ionized" || stage === "attracted" });

  const onKeyDown = (e) => {
    if (!selected || !inSetup) return;
    const step = e.shiftKey ? 30 : 12;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); setAtoms((l) => l.map((a) => (a.id === selected ? { ...a, x: Math.min(world.W - 30, Math.max(30, a.x + d[0])), y: Math.min(world.H - 30, Math.max(30, a.y + d[1])) } : a))); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
  };

  // ---- actions
  const ionize = () => { if (!system || !inSetup) return; setSelected(null); setPlaying(true); setAnim({ stage: "ionizing", p: 0 }); };
  const attract = () => { if (stage !== "ionized") return; setPlaying(true); setAnim({ stage: "attracting", p: 0 }); };
  const replay = () => {
    if (view === "lattice") { setLat((l) => ({ ...l, run: l.run + 1, playing: true })); return; }
    if (inSetup) return;
    setPlaying(true);
    setAnim({ stage: stage === "attracting" || stage === "attracted" ? "attracting" : "ionizing", p: 0 });
  };
  const togglePlay = () => { if (view === "lattice") setLat((l) => ({ ...l, playing: !l.playing })); else setPlaying((p) => !p); };
  const resetTool = () => { if (view === "lattice") setLat((l) => ({ ...l, reset: l.reset + 1, playing: false, placed: 0 })); else onReset(); };

  const formed = stage === "ionized" || stage === "attracting" || stage === "attracted";
  const lattice = analysis.cation && analysis.anion ? latticeSupport(analysis.cation, analysis.anion) : null;
  const latticeOk = !!(formed && lattice?.supported);
  const openLattice = () => { if (!latticeOk) return; setView("lattice"); setLat({ run: 0, reset: 0, playing: true, placed: 0, total: 0 }); };

  const isPlaying = view === "lattice" ? lat.playing : playing;

  // ---- text
  const explain = useMemo(() => {
    if (view === "lattice") return lat.placed >= lat.total && lat.total > 0 ? "Ions fill a regular 3D lattice. Drag to rotate, scroll to zoom." : "Ions take their lattice positions one by one along x, then y, then z.";
    if (stage === "ionizing") return `${analysis.cation} gives ${system.electronsTransferred} electron${system.electronsTransferred > 1 ? "s" : ""} to ${analysis.anion}. The moving electron keeps its colour.`;
    if (stage === "ionized") return `${formatIons(system)}. Oppositely charged ions are still slightly apart. Show attraction.`;
    if (stage === "attracting") return "Opposite charges attract: the ions move together.";
    if (stage === "attracted") return `${analysis.formula}: ionic bond = electrostatic attraction between oppositely charged ions.`;
    if (note) return note;
    return analysis.message;
  }, [view, lat.placed, lat.total, stage, analysis, system, note]);

  const live = useMemo(() => {
    const species = [...new Set(symbols)];
    const ionStage = formed || stage === "ionizing";
    const atomsChip = species.length === 0 ? "none yet" : species.map((s) => {
      const e = getBondingElement(s);
      return ionStage && system ? `${chargeText(s, e.ionCharge)} ${shellText(e.ionShells)}` : `${s} ${shellText(e.shells)}`;
    }).join("  ·  ");
    return [
      { id: "atoms", label: ionStage ? "Ions" : "Atoms", value: atomsChip, bg: "#eaf1ff", testId: "live-atoms" },
      { id: "formula", label: "Formula", value: analysis.formula ?? "–", bg: "#e8f7ef", testId: "live-formula" },
      { id: "moved", label: "Electrons moved", value: system && stage !== "setup" ? String(system.electronsTransferred) : "0", bg: "#fff1e0", testId: "live-moved" },
      ...(view === "lattice" ? [{ id: "placed", label: "Ions placed", value: `${lat.placed}/${lat.total || "–"}`, bg: "#f1ebfb", testId: "live-placed" }] : []),
    ];
  }, [symbols, formed, stage, system, analysis.formula, view, lat.placed, lat.total]);

  const lockReason = !inSetup || view !== "atoms" ? "Reset to add more atoms." : null;
  const canIonize = !!system && inSetup && view === "atoms";
  const canAddMissing = analysis.status === "incomplete" && analysis.missing.length > 0 && inSetup && view === "atoms";

  const legendFor = (a) => (a.chargeOpacity > 0.5 ? `${chargeText(a.symbol, a.charge)} · ${a.label}` : a.label);

  const library = (
    <ElementLibrary
      groups={GROUPS} onAdd={addAtom} dropRef={boxRef} disabledReason={lockReason} mode="ionic"
      hint="Pick one metal and one non-metal."
    />
  );

  const canvas = (
    <div className="bv-canvas" ref={boxRef} tabIndex={0} onKeyDown={onKeyDown} data-testid="canvas" data-stage={view === "lattice" ? "lattice" : stage} data-formula={analysis.formula ?? ""} data-atoms={atoms.length} aria-label="Ionic bonding canvas. Arrow keys move the selected atom.">
      {view === "atoms" ? (
        <>
          <svg ref={svgRef} className="bv-svg" viewBox={`0 0 ${world.W} ${world.H}`} preserveAspectRatio="xMidYMid meet" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }} role="img" aria-label={atoms.length ? `${atoms.length} atoms` : "Empty canvas"}>
            <defs>
              <marker id="bv-arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#4a5a82" /></marker>
            </defs>
            {scene.links.map((l) => {
              const A = scene.atoms.find((x) => x.id === l.a); const B = scene.atoms.find((x) => x.id === l.b);
              const dx = B.x - A.x; const dy = B.y - A.y; const len = Math.hypot(dx, dy) || 1;
              const s = A.currentOuterR + 5; const e = len - B.currentOuterR - 5;
              if (e - s < 14) return null;
              return <line key={l.a + l.b} x1={A.x + (dx / len) * s} y1={A.y + (dy / len) * s} x2={A.x + (dx / len) * e} y2={A.y + (dy / len) * e} stroke="#4a5a82" strokeWidth="2" strokeDasharray="6 5" opacity={l.opacity * 0.85} markerStart="url(#bv-arrow)" markerEnd="url(#bv-arrow)" pointerEvents="none" />;
            })}
            {scene.atoms.map((a) => {
              const src = atoms.find((x) => x.id === a.id);
              return <AtomBody key={a.id} a={a} testId={`atom-${a.symbol}`} selected={selected === a.id && inSetup} dragProps={bind(a.id, () => ({ x: src.x, y: src.y }))} />;
            })}
            <Electrons atoms={scene.atoms} />
            {scene.atoms.map((a) => <ChargeBadge key={`c${a.id}`} a={a} />)}
            {scene.atoms.map((a) => <ShellLabel key={`s${a.id}`} a={a} text={legendFor(a)} />)}
          </svg>
          {atoms.length === 0 && <p className="bv-placeholder">Click or drag an element from the library</p>}
          {stage !== "setup" && <span className="bv-badge" data-testid="stage-badge">{stageText(stage)}</span>}
          {selected && inSetup && (
            <button type="button" className="bv-corner-btn" onClick={removeSelected} data-testid="tool-remove" aria-label="Remove selected atom" title="Remove selected atom"><Trash2 size={15} aria-hidden="true" /></button>
          )}
        </>
      ) : (
        <Suspense fallback={<div className="bv-loading">Loading 3D view</div>}>
          <LatticeStage
            structureId={lattice.structureId} cat={analysis.cation} an={analysis.anion} playing={lat.playing} runKey={lat.run * 1000 + lat.reset} resetKey={lat.reset}
            reduced={reduced} onProgress={(placed, total) => setLat((l) => (l.placed === placed && l.total === total ? l : { ...l, placed, total }))}
          />
        </Suspense>
      )}
    </div>
  );

  const toolbar = view === "atoms" ? (
    <Toolbar label="Ionic bonding controls">
      {canAddMissing && <Tool icon={<Plus size={15} aria-hidden="true" />} label="Add missing atoms" title={`Add ${analysis.missing.map((m) => `${m.count} ${m.symbol}`).join(" + ")} for ${analysis.formula}`} onClick={addMissing} testId="tool-add-missing" />}
      <Tool primary icon={<Zap size={15} aria-hidden="true" />} label="Ionize" title={canIonize ? "Transfer electrons from the metal to the non-metal" : analysis.message} disabled={!canIonize} onClick={ionize} testId="tool-ionize" />
      <Tool icon={<Magnet size={15} aria-hidden="true" />} label="Show Attraction" title={stage === "ionized" ? "Show the ions attracted together" : "Available after ionization"} disabled={stage !== "ionized"} onClick={attract} testId="tool-attraction" />
      <Tool icon={<Box size={15} aria-hidden="true" />} label="Lattice Arrangement" title={latticeOk ? "Open the 3D lattice" : formed ? lattice?.reason : "Available after the ions have formed"} disabled={!latticeOk} onClick={openLattice} testId="tool-lattice" />
      <Tool icon={isPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={isPlaying ? "Pause" : "Play"} onClick={togglePlay} testId="tool-pause" pressed={!isPlaying} />
      <Tool icon={<Repeat size={15} aria-hidden="true" />} label="Replay" title="Replay the last stage" disabled={inSetup} onClick={replay} testId="tool-replay" />
      <Tool icon={<RotateCcw size={15} aria-hidden="true" />} label="Reset" title="Clear the canvas and start again" onClick={resetTool} testId="tool-reset" />
    </Toolbar>
  ) : (
    <Toolbar label="Lattice controls">
      <Tool icon={<ArrowLeft size={15} aria-hidden="true" />} label="Back to ions" onClick={() => { setView("atoms"); }} testId="tool-back" />
      <Tool icon={isPlaying ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={isPlaying ? "Pause" : "Play"} primary onClick={togglePlay} testId="tool-pause" pressed={!isPlaying} />
      <Tool icon={<Repeat size={15} aria-hidden="true" />} label="Replay" title="Rebuild the lattice from the first ion" onClick={replay} testId="tool-replay" />
      <Tool icon={<RotateCcw size={15} aria-hidden="true" />} label="Reset" title="Empty the lattice and reset the camera" onClick={resetTool} testId="tool-reset" />
    </Toolbar>
  );

  return <ModeShell mode="ionic" state={view === "lattice" ? "lattice" : stage} tabs={tabs} onReset={onReset} library={library} canvas={canvas} toolbar={toolbar} live={live} explain={explain} />;
}

function formatIons(system) {
  if (!system) return "";
  const seen = new Set();
  return system.ions.filter((i) => (seen.has(i.symbol) ? false : seen.add(i.symbol))).map((i) => `${chargeText(i.symbol, i.charge)} (${shellText(i.ionShells)})`).join(" and ");
}
