import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Layers, Pause, Play, Repeat, RotateCcw, Trash2, Unlock, Crosshair } from "lucide-react";
import ElementLibrary from "./ElementLibrary.jsx";
import MetallicStage from "./MetallicStage.jsx";
import ModeShell, { Tool, Toolbar } from "./ModeShell.jsx";
import { chargeText, getBondingElement } from "../model/elements.js";
import { METALLIC_METALS } from "../model/elements.js";
import { ADD_STEPS, MAX_METAL_ATOMS, METAL_STRUCTURE, STRUCTURE_LABEL, EXPECTED_NEIGHBOURS, addCount, analyzeMetals, maxCoordination, metalCounts, valenceElectrons } from "../model/metallic.js";
import { assignSites, clampToCube, cubeHalf, latticeLayout, placeNewAtoms } from "../scene/metallicScene.js";
import { useReducedMotion } from "./hooks.js";

const GROUPS = [{ id: "metals", title: "Metals", symbols: METALLIC_METALS }];
export const KEY_IDEA = "Metallic bonding is the electrostatic attraction between positive metal ions and delocalized electrons.";


export default function MetallicMode({ tabs, onReset }) {
  const reduced = useReducedMotion();
  const [atoms, setAtoms] = useState([]);
  const [stage, setStage] = useState("place");
  const [run, setRun] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [selected, setSelected] = useState(null);
  const [lat, setLat] = useState(null); // { sites, u, H, coreRadius, assign } once the lattice is requested
  const [metal, setMetal] = useState("Na");
  const [viewKey, setViewKey] = useState(0);
  const [note, setNote] = useState("");
  const counter = useRef(0);
  const apiRef = useRef(null);
  const boxRef = useRef(null);

  const atomsRef = useRef(atoms);
  useEffect(() => { atomsRef.current = atoms; });
  const symbols = useMemo(() => atoms.map((a) => a.symbol), [atoms]);
  const analysis = useMemo(() => analyzeMetals(symbols), [symbols]);
  const symbol = atoms[0]?.symbol ?? metal;
  const structure = METAL_STRUCTURE[symbol];
  const v = valenceElectrons(symbol);
  const inPlace = stage === "place";
  const atomPos = useMemo(() => { const a = new Float32Array(atoms.length * 3); atoms.forEach((x, i) => a.set(x.pos, i * 3)); return a; }, [atoms]);
  const sitePos = useMemo(() => {
    if (!lat) return null;
    const a = new Float32Array(atoms.length * 3);
    lat.assign.forEach((j, i) => { const s = lat.sites[j]; a[i * 3] = s.x; a[i * 3 + 1] = s.y; a[i * 3 + 2] = s.z; });
    return a;
  }, [lat, atoms.length]);
  const coordination = useMemo(() => (lat ? maxCoordination(lat.sites.map((s) => ({ x: s.x / lat.u, y: s.y / lat.u, z: s.z / lat.u }))) : 0), [lat]);
  const selectedIndex = selected ? atoms.findIndex((a) => a.id === selected) : -1;

  /** Adds `k` atoms of `sym` (clamped at the capacity). `client` = screen drop position (only for a single dragged atom). */
  const addAtoms = useCallback((sym, k, client) => {
    if (stage !== "place") return;
    if (atoms.length && atoms[0].symbol !== sym) { setNote(`Use one metal at a time (alloys are not modelled). Reset to switch from ${atoms[0].symbol}.`); return; }
    const { added, clamped } = addCount(atoms.length, k);
    if (added === 0) { setNote(`Limit reached: ${MAX_METAL_ATOMS} atoms. Release the electrons or Reset.`); return; }
    const H = cubeHalf(atoms.length + added);
    let fresh;
    const drop = added === 1 && client ? apiRef.current?.project(client.clientX, client.clientY) : null;
    if (drop) fresh = [clampToCube(drop, H)];
    else fresh = placeNewAtoms(atoms.map((a) => a.pos), added, counter.current);
    const items = fresh.map((pos) => ({ id: `m${++counter.current}`, symbol: sym, pos }));
    setAtoms((l) => [...l, ...items]);
    setMetal(sym);
    setNote(clamped ? `Added ${added} of ${k}: the limit is ${MAX_METAL_ATOMS} atoms.` : "");
  }, [stage, atoms]);
  const addAtom = useCallback((sym, client) => addAtoms(sym, 1, client), [addAtoms]);

  const removeSelected = () => { if (!selected || !inPlace) return; setAtoms((l) => l.filter((a) => a.id !== selected)); setSelected(null); };
  const moveAtom = useCallback((index, pos) => setAtoms((l) => l.map((a, i) => (i === index ? { ...a, pos } : a))), []);
  const selectIndex = useCallback((index) => setSelected(atomsRef.current[index]?.id ?? null), []);

  const release = () => { if (analysis.status !== "valid" || !inPlace) return; setSelected(null); setNote(""); setPlaying(true); setRun((r) => r + 1); setStage("releasing"); };
  const buildLattice = () => { const L = latticeLayout(structure, atoms.length); return { ...L, assign: assignSites(atoms.map((a) => a.pos), L.sites) }; };
  const formLattice = () => {
    if (stage !== "released") return;
    setLat(buildLattice());
    setPlaying(true); setRun((r) => r + 1); setStage("forming");
  };
  const onDone = useCallback((s) => { setStage((cur) => (cur === s ? (s === "releasing" ? "released" : "lattice") : cur)); }, []);
  const replay = () => {
    if (stage === "place") return;
    setPlaying(true); setRun((r) => r + 1);
    if (stage === "forming" || stage === "lattice") { setStage("forming"); } else setStage("releasing");
  };

  const released = stage === "released" || stage === "forming" || stage === "lattice";
  const counts = metalCounts(symbol, atoms.length);
  const cores = counts.ions;
  const live = [
    { id: "metal", label: "Metal", value: atoms.length ? `${symbol} ${getBondingElement(symbol).shells.join(",")}` : "–", bg: "#fdf0e1", testId: "live-metal" },
    { id: "cores", label: released ? `${chargeText(symbol, v)} cores` : "Atoms", value: String(cores), bg: "#fde8e6", testId: "live-cores" },
    { id: "electrons", label: "Delocalized e⁻", value: released ? String(counts.electrons) : "0", bg: "#e3f4ff", testId: "live-electrons" },
    { id: "lattice", label: "Lattice", value: stage === "lattice" ? `${structure.toUpperCase()} · ${coordination} neighbours` : "–", bg: "#eaf1ff", testId: "live-lattice" },
  ];

  const explain = note
    || (stage === "place" ? analysis.message
      : stage === "releasing" ? `Each ${symbol} atom releases ${v} valence electron${v > 1 ? "s" : ""}.`
        : stage === "released" ? `${atoms.length} ${chargeText(symbol, v)} cores in a sea of ${counts.electrons} delocalized electrons. Build the lattice next.`
          : stage === "forming" ? `Cores move into a regular ${STRUCTURE_LABEL[structure]} arrangement.`
            : coordination >= EXPECTED_NEIGHBOURS[structure]
              ? `${STRUCTURE_LABEL[structure]}: each interior ion has ${coordination} nearest neighbours. Cores stay fixed; electrons move.`
              : `${STRUCTURE_LABEL[structure]}: a small block (a bulk crystal gives each ion ${EXPECTED_NEIGHBOURS[structure]} nearest neighbours). Cores stay fixed; electrons move.`);

  const atLimit = atoms.length >= MAX_METAL_ATOMS;
  const addPanel = (
    <div className="bv-addatoms" data-testid="add-atoms" role="group" aria-label={`Add ${symbol} atoms`}>
      <div className="bv-addatoms-head"><span>Add <b>{symbol}</b> atoms</span><span className="bv-addatoms-count" data-testid="atom-count">{atoms.length} / {MAX_METAL_ATOMS}</span></div>
      <div className="bv-addatoms-row">
        {ADD_STEPS.map((k) => (
          <button key={k} type="button" className="bv-addbtn" data-testid={`add-${k}`} disabled={!inPlace || atLimit} onClick={() => addAtoms(symbol, k)}
            title={atLimit ? `Limit reached (${MAX_METAL_ATOMS} atoms)` : !inPlace ? "Reset to add more atoms." : `Add ${k} ${symbol} atom${k > 1 ? "s" : ""}`}>+{k}</button>
        ))}
      </div>
      {atLimit && <p className="bv-addatoms-limit" data-testid="atom-limit">Limit reached: {MAX_METAL_ATOMS} atoms.</p>}
    </div>
  );
  const library = <ElementLibrary groups={GROUPS} onAdd={addAtom} dropRef={boxRef} disabledReason={!inPlace ? "Reset to add more atoms." : null} mode="metallic" hint="Pick a metal (start with Na), add atoms with +1 to +50, then release the electrons." footer={addPanel} />;

  const canvas = (
    <div className="bv-canvas" ref={boxRef} data-testid="canvas" data-stage={stage} data-atoms={atoms.length} data-cores={cores} data-electrons={released ? counts.electrons : 0} aria-label="Metallic bonding 3D workspace. Drag to rotate, scroll to zoom.">
      <MetallicStage
        metal={{ symbol, valence: v }} atomPos={atomPos} sitePos={sitePos} n={atoms.length} lat={lat} stage={stage} runKey={run} playing={playing} selectedIndex={selectedIndex}
        onMove={moveAtom} onSelect={selectIndex} onDone={onDone} apiRef={apiRef} viewKey={viewKey} reduced={reduced}
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
