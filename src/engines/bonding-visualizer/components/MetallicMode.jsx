import { useCallback, useMemo, useRef, useState } from "react";
import { Layers, Pause, Play, Repeat, RotateCcw, Trash2, Unlock, Crosshair } from "lucide-react";
import ElementLibrary from "./ElementLibrary.jsx";
import MetallicStage from "./MetallicStage.jsx";
import ModeShell, { Tool, Toolbar } from "./ModeShell.jsx";
import { chargeText, getBondingElement } from "../model/elements.js";
import { METALLIC_METALS } from "../model/elements.js";
import { MAX_METAL_ATOMS, METAL_STRUCTURE, STRUCTURE_LABEL, analyzeMetals, centralCoordination, generateMetalLattice, valenceElectrons } from "../model/metallic.js";
import { assignSites } from "../scene/metallicScene.js";
import { useReducedMotion } from "./hooks.js";

const GROUPS = [{ id: "metals", title: "Metals", symbols: METALLIC_METALS }];
export const KEY_IDEA = "Metallic bonding is the electrostatic attraction between positive metal ions and delocalized electrons.";

const spawn3d = (i) => [((i % 3) - 1) * 1.7, ((Math.floor(i / 3) % 2) ? -0.9 : 0.9), ((i % 2) ? 0.5 : -0.5) + Math.floor(i / 6) * 0.4];

export default function MetallicMode({ tabs, onReset }) {
  const reduced = useReducedMotion();
  const [atoms, setAtoms] = useState([]);
  const [stage, setStage] = useState("place");
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState(null);
  const [assign, setAssign] = useState([]);
  const [viewKey, setViewKey] = useState(0);
  const [note, setNote] = useState("");
  const counter = useRef(0);
  const apiRef = useRef(null);
  const boxRef = useRef(null);

  const symbols = useMemo(() => atoms.map((a) => a.symbol), [atoms]);
  const analysis = useMemo(() => analyzeMetals(symbols), [symbols]);
  const symbol = atoms[0]?.symbol ?? "Na";
  const structure = METAL_STRUCTURE[symbol];
  const v = valenceElectrons(symbol);
  const sites = useMemo(() => generateMetalLattice(structure, 2), [structure]);
  const coordination = useMemo(() => centralCoordination(structure, 2), [structure]);
  const inPlace = stage === "place";

  const addAtom = useCallback((sym, client) => {
    if (stage !== "place") return;
    if (atoms.length && atoms[0].symbol !== sym) { setNote(`Use one metal at a time (alloys are not modelled). Reset to switch from ${atoms[0].symbol}.`); return; }
    if (atoms.length >= MAX_METAL_ATOMS) { setNote(`Maximum ${MAX_METAL_ATOMS} atoms before the lattice is built.`); return; }
    let pos = client ? apiRef.current?.project(client.clientX, client.clientY) : null;
    if (pos) pos = pos.map((c) => Math.max(-4.5, Math.min(4.5, c)));
    const id = `m${++counter.current}`;
    setAtoms((l) => [...l, { id, symbol: sym, pos: pos ?? spawn3d(l.length) }]);
    setNote("");
  }, [stage, atoms]);

  const removeSelected = () => { if (!selected || !inPlace) return; setAtoms((l) => l.filter((a) => a.id !== selected)); setSelected(null); };
  const moveAtom = useCallback((id, pos) => setAtoms((l) => l.map((a) => (a.id === id ? { ...a, pos } : a))), []);

  const release = () => { if (analysis.status !== "valid" || !inPlace) return; setSelected(null); setPlaying(true); setRun((r) => r + 1); setStage("releasing"); };
  const formLattice = () => {
    if (stage !== "released") return;
    setAssign(assignSites(atoms.map((a) => a.pos), sites));
    setPlaying(true); setRun((r) => r + 1); setStage("forming");
  };
  const onDone = useCallback((s) => { setStage((cur) => (cur === s ? (s === "releasing" ? "released" : "lattice") : cur)); }, []);
  const replay = () => {
    if (stage === "place") return;
    setPlaying(true); setRun((r) => r + 1);
    if (stage === "forming" || stage === "lattice") { setAssign(assignSites(atoms.map((a) => a.pos), sites)); setStage("forming"); } else setStage("releasing");
  };

  const released = stage === "released" || stage === "forming" || stage === "lattice";
  const cores = stage === "forming" || stage === "lattice" ? sites.length : atoms.length;
  const live = [
    { id: "metal", label: "Metal", value: atoms.length ? `${symbol} ${getBondingElement(symbol).shells.join(",")}` : "–", bg: "#fdf0e1", testId: "live-metal" },
    { id: "cores", label: released ? `${chargeText(symbol, 1)} cores` : "Atoms", value: String(cores), bg: "#fde8e6", testId: "live-cores" },
    { id: "electrons", label: "Delocalized e⁻", value: released ? String(cores * v) : "0", bg: "#e3f4ff", testId: "live-electrons" },
    { id: "lattice", label: "Lattice", value: stage === "lattice" ? `${structure.toUpperCase()} · ${coordination.count} neighbours` : "–", bg: "#eaf1ff", testId: "live-lattice" },
  ];

  const explain = note
    || (stage === "place" ? analysis.message
      : stage === "releasing" ? `Each ${symbol} atom releases ${v} valence electron${v > 1 ? "s" : ""}.`
        : stage === "released" ? `${chargeText(symbol, v === 1 ? 1 : 1)} cores in a sea of delocalized electrons. Build the lattice next.`
          : stage === "forming" ? `Cores move into a regular ${STRUCTURE_LABEL[structure]} arrangement.`
            : `${STRUCTURE_LABEL[structure]}: each ion has ${coordination.count} nearest neighbours. Cores stay fixed; electrons move.`);

  const library = <ElementLibrary groups={GROUPS} onAdd={addAtom} dropRef={boxRef} disabledReason={!inPlace ? "Reset to add more atoms." : null} mode="metallic" hint="Add several atoms (start with Na), then arrange them." />;

  const canvas = (
    <div className="bv-canvas" ref={boxRef} data-testid="canvas" data-stage={stage} data-atoms={atoms.length} data-cores={cores} aria-label="Metallic bonding 3D workspace. Drag to rotate, scroll to zoom.">
      <MetallicStage
        metal={{ symbol, valence: v }} structure={structure} atoms={atoms} sites={sites} assign={assign} stage={stage} runKey={run} playing={playing} selected={selected}
        onMove={moveAtom} onSelect={setSelected} onDone={onDone} apiRef={apiRef} viewKey={viewKey} reduced={reduced}
      />
      {atoms.length === 0 && <p className="bv-placeholder">Click or drag a metal from the library</p>}
      {released && (
        <div className="bv-keyidea" data-testid="key-idea"><b>Key idea</b> {KEY_IDEA}</div>
      )}
      <p className="bv-note" data-testid="simplified-note">Simplified model: electron motion is illustrative, not real trajectories or to scale.</p>
      <span className="bv-tag3d">3D · drag to rotate</span>
      {selected && inPlace && (
        <button type="button" className="bv-corner-btn" onClick={removeSelected} data-testid="tool-remove" aria-label="Remove selected atom" title="Remove selected atom"><Trash2 size={15} aria-hidden="true" /></button>
      )}
      <button type="button" className="bv-corner-btn bv-corner-btn--br" onClick={() => setViewKey((k) => k + 1)} data-testid="tool-reset-view" aria-label="Reset view" title="Reset view"><Crosshair size={15} aria-hidden="true" /></button>
    </div>
  );

  const toolbar = (
    <Toolbar label="Metallic bonding controls">
      <Tool primary icon={<Unlock size={15} aria-hidden="true" />} label="Release Valence Electrons" title={analysis.status === "valid" && inPlace ? "Free the valence electrons" : analysis.message} disabled={analysis.status !== "valid" || !inPlace} onClick={release} testId="tool-release" />
      <Tool icon={<Layers size={15} aria-hidden="true" />} label="Form Metallic Lattice" title={stage === "released" ? "Arrange the cores in a regular 3D lattice" : "Release the valence electrons first"} disabled={stage !== "released"} onClick={formLattice} testId="tool-form-lattice" />
      <Tool icon={playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} testId="tool-pause" pressed={!playing} />
      <Tool icon={<Repeat size={15} aria-hidden="true" />} label="Replay" title="Replay the last step" disabled={inPlace} onClick={replay} testId="tool-replay" />
      <Tool icon={<RotateCcw size={15} aria-hidden="true" />} label="Reset" title="Clear the workspace" onClick={onReset} testId="tool-reset" />
    </Toolbar>
  );

  return <ModeShell mode="metallic" state={stage} tabs={tabs} onReset={onReset} library={library} canvas={canvas} toolbar={toolbar} live={live} explain={explain} />;
}
