import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Merge, Pause, Play, Repeat, RotateCcw, Trash2, Shrink } from "lucide-react";
import { MiniSwitch } from "../../../components/simulation/SimulationDashboard.jsx";
import ElementLibrary from "./ElementLibrary.jsx";
import ModeShell, { Tool, Toolbar } from "./ModeShell.jsx";
import { AtomBody, Electrons } from "./AtomLayers.jsx";
import { spawnPosition, useAtomDrag, useFrameLoop, useReducedMotion, useWorld } from "./hooks.js";
import { COVALENT_ATOMS } from "../model/elements.js";
import {
  BOND_ORDERS, COVALENT_GROUPS, electronsAround, examplesForGroup, examplesForOrder, explainUnsupported, findMolecule, getMolecule,
  totalLonePairs, totalSharedPairs, uniformBondOrder,
} from "../model/covalent.js";
import { atomsAreClose, covalentScene, covalentSize, gatherTargets } from "../scene/covalentScene.js";
import { ringRadius } from "../scene/atomGeometry.js";
import { getBondingElement } from "../model/elements.js";

// The final sphere-and-bond structure (three.js) is loaded only when a molecule has been bonded.
const MoleculeView = lazy(() => import("./MoleculeView.jsx"));
const HOLD = 1.3; // seconds the finished electron-sharing picture stays before the structure fades in
const FADE = 0.9;
const SUBS = "₀₁₂₃₄₅₆₇₈₉";
/** Splits "SF₆" into [{t:"SF"},{t:"6",sub:true}] so subscripts can be drawn as real subscripts. */
function subParts(str) {
  const out = [];
  for (const ch of str) {
    const k = SUBS.indexOf(ch);
    const sub = k >= 0;
    const t = sub ? String(k) : ch;
    if (out.length && !!out[out.length - 1].sub === sub) out[out.length - 1].t += t; else out.push({ t, sub });
  }
  return out;
}
const HtmlSubs = ({ text }) => subParts(text).map((q, i) => (q.sub ? <sub key={i}>{q.t}</sub> : <span key={i}>{q.t}</span>));
const SvgSubs = ({ text, size }) => subParts(text).map((q, i) => (q.sub ? <tspan key={i} dy={size * 0.22} fontSize={size * 0.68}>{q.t}</tspan> : <tspan key={i} dy={i && subParts(text)[i - 1].sub ? -size * 0.22 : undefined}>{q.t}</tspan>));

const MAX_ATOMS = 8;
const DUR_BOND = 4.2;
const GROUPS = [
  { id: "nonmetals", title: "Non-metals", symbols: COVALENT_ATOMS.filter((s) => !["Be", "B"].includes(s)) },
  { id: "exceptions", title: "Octet exceptions", symbols: ["Be", "B"] },
];
const DEFAULT_EXAMPLE = { normal: "CH4", incomplete: "BF3", expanded: "SF6" };

const octetWord = { normal: "octet", incomplete: "incomplete octet", expanded: "expanded octet" };

function explainBonded(m) {
  const pairs = totalSharedPairs(m);
  const base = `${m.formula}: ${pairs} shared pair${pairs > 1 ? "s" : ""}, ${totalLonePairs(m)} lone pair${totalLonePairs(m) === 1 ? "" : "s"}. Electrons are shared, not transferred.`;
  if (m.id === "H2") return "H₂: one shared pair = 2 electrons, one from each H. Shared, not transferred.";
  if (m.group === "incomplete") return `${m.formula}: ${m.atoms[m.central]} has only ${electronsAround(m, m.central)} electrons (incomplete octet).`;
  if (m.group === "expanded") return `${m.formula}: ${m.atoms[m.central]} has ${electronsAround(m, m.central)} electrons (expanded octet, period 3).`;
  if (uniformBondOrder(m) === 2) return "O₂: double bond = 2 shared pairs (4 electrons shared).";
  if (uniformBondOrder(m) === 3) return "N₂: triple bond = 3 shared pairs (6 electrons shared).";
  return base;
}

export default function CovalentMode({ tabs, onReset }) {
  const reduced = useReducedMotion();
  const { boxRef, svgRef, world, toWorld } = useWorld();
  const counter = useRef({ id: 2, color: 2 });
  const [atoms, setAtoms] = useState([{ id: "a1", symbol: "H", x: 270, y: 280, colorIdx: 0 }, { id: "a2", symbol: "H", x: 630, y: 280, colorIdx: 1 }]);
  const pristine = useRef(true);
  const [anim, setAnim] = useState({ stage: "setup", p: 0 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [playing, setPlaying] = useState(true);
  const [time, setTime] = useState(0);
  const [bondedT, setBondedT] = useState(0);
  const [selected, setSelected] = useState(null);
  const [groupState, setGroupState] = useState("normal");
  const [orderState, setOrderState] = useState(1);
  const [note, setNote] = useState("");
  const tween = useRef(null);

  const symbols = useMemo(() => atoms.map((a) => a.symbol), [atoms]);
  const molecule = useMemo(() => findMolecule(symbols), [symbols]);
  const S = covalentSize(world, molecule);
  const stage = anim.stage;
  const inSetup = stage === "setup";
  const close = useMemo(() => atomsAreClose(atoms, S), [atoms, S]);
  const group = molecule?.group ?? groupState;
  const order = (molecule && uniformBondOrder(molecule)) || orderState;

  // keep the two starting hydrogens at 30% / 70% of the (measured) canvas until the student touches anything
  useEffect(() => {
    if (!pristine.current) return;
    setAtoms((l) => l.map((a, i) => ({ ...a, x: world.W * (i === 0 ? 0.3 : 0.7), y: world.H * 0.5 })));
  }, [world.W, world.H]);

  useFrameLoop((dt) => {
    if (tween.current) {
      const tw = tween.current; tw.t = Math.min(1, tw.t + dt / 0.5);
      const e = tw.t * tw.t * (3 - 2 * tw.t);
      setAtoms((l) => l.map((a) => { const f = tw.from[a.id]; const to = tw.to[a.id]; return f && to ? { ...a, x: f.x + (to.x - f.x) * e, y: f.y + (to.y - f.y) * e } : a; }));
      if (tw.t >= 1) tween.current = null;
    }
    if (stage !== "bonded") setBondedT((t) => (t === 0 ? t : 0));
    if (!playing) return;
    setBondedT((t) => (stage === "bonded" ? t + dt : t));
    if (!reduced) setTime((t) => t + dt);
    setAnim((a) => {
      if (a.stage !== "bonding") return a;
      const p = a.p + (dt * (reduced ? 8 : 1)) / DUR_BOND;
      return p < 1 ? { stage: "bonding", p } : { stage: "bonded", p: 1 };
    });
  });

  const settle = stage === "bonded" && molecule ? Math.min(1, Math.max(0, (bondedT - (reduced ? 0.2 : HOLD)) / (reduced ? 0.2 : FADE))) : 0;
  const smooth = settle * settle * (3 - 2 * settle);
  const scene = useMemo(() => covalentScene({ atoms, molecule, stage, p: anim.p, time, world, offset }), [atoms, molecule, stage, anim.p, time, world, offset]);

  const touch = () => { pristine.current = false; };

  const loadMolecule = useCallback((m) => {
    touch();
    const n = m.atoms.length;
    const c = { x: world.W / 2, y: world.H / 2 };
    const list = [];
    if (n === 2) {
      const d = Math.min(world.W * 0.3, 260);
      m.atoms.forEach((sym, i) => list.push({ symbol: sym, x: c.x + (i ? d : -d), y: c.y }));
    } else {
      const Sm = covalentSize(world, m);
      const lim = Math.max(...m.atoms.slice(1).map((s) => (ringRadius(getBondingElement(m.atoms[0]).shells.length) + ringRadius(getBondingElement(s).shells.length) + 36) * Sm));
      const R = Math.min(250, Math.max(world.H * 0.34, lim * 1.2));
      list.push({ symbol: m.atoms[0], x: c.x, y: c.y });
      m.atoms.slice(1).forEach((sym, i) => {
        const ang = -Math.PI / 2 + (2 * Math.PI * i) / (n - 1);
        list.push({ symbol: sym, x: Math.min(world.W - 40, Math.max(40, c.x + R * 1.25 * Math.cos(ang))), y: c.y + R * Math.sin(ang) });
      });
    }
    counter.current = { id: n, color: n };
    setAtoms(list.map((a, i) => ({ id: `a${i + 1}`, ...a, colorIdx: i })));
    setAnim({ stage: "setup", p: 0 }); setOffset({ x: 0, y: 0 }); setSelected(null); setNote("");
    setGroupState(m.group); setOrderState(uniformBondOrder(m) ?? 1);
  }, [world]);

  const pickGroup = (g) => { loadMolecule(getMolecule(DEFAULT_EXAMPLE[g])); };
  const pickOrder = (o) => { loadMolecule(examplesForOrder(o)[0]); };

  const addAtom = useCallback((symbol, client) => {
    if (!inSetup) return;
    if (atoms.length >= MAX_ATOMS) { setNote(`Maximum ${MAX_ATOMS} atoms on the canvas.`); return; }
    touch();
    const w = client ? toWorld(client.clientX, client.clientY) : null;
    const pos = w ? { x: Math.min(world.W - 40, Math.max(40, w.x)), y: Math.min(world.H - 40, Math.max(40, w.y)) } : spawnPosition(atoms.length, world);
    const id = `a${++counter.current.id}`;
    const colorIdx = counter.current.color++;
    setAtoms((l) => [...l, { id, symbol, x: pos.x, y: pos.y, colorIdx }]);
    setNote("");
  }, [inSetup, atoms.length, toWorld, world]);

  const removeSelected = useCallback(() => {
    if (!selected || !inSetup) return;
    touch();
    setAtoms((l) => l.filter((a) => a.id !== selected));
    setSelected(null);
  }, [selected, inSetup]);

  const moveAtom = useCallback((id, x, y) => { touch(); setAtoms((l) => l.map((a) => (a.id === id ? { ...a, x, y } : a))); }, []);
  const groupMove = useCallback((dx, dy) => setOffset((o) => ({ x: o.x + dx, y: o.y + dy })), []);
  const bind = useAtomDrag({ toWorld, world, enabled: inSetup, onMove: moveAtom, onSelect: setSelected, onGroupMove: groupMove, groupEnabled: stage === "bonded" && settle === 0 });

  const onKeyDown = (e) => {
    if (!selected || !inSetup) return;
    const step = e.shiftKey ? 30 : 12;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (d) { e.preventDefault(); touch(); setAtoms((l) => l.map((a) => (a.id === selected ? { ...a, x: Math.min(world.W - 30, Math.max(30, a.x + d[0])), y: Math.min(world.H - 30, Math.max(30, a.y + d[1])) } : a))); }
    else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); removeSelected(); }
  };

  const formBond = () => { if (!molecule || !close || !inSetup) return; touch(); setSelected(null); setPlaying(true); setAnim({ stage: "bonding", p: 0 }); };
  const bring = () => {
    if (!molecule || !inSetup) return;
    touch();
    const to = Object.fromEntries(gatherTargets(molecule, atoms, world).map((t) => [t.id, t]));
    tween.current = { t: 0, from: Object.fromEntries(atoms.map((a) => [a.id, { x: a.x, y: a.y }])), to };
  };
  const replay = () => { if (inSetup) return; setPlaying(true); setAnim({ stage: "bonding", p: 0 }); };

  const explain = useMemo(() => {
    if (note) return note;
    if (stage === "bonding") return "Electron clouds overlap. Each atom shares one electron per bond; both colours are kept.";
    if (stage === "bonded" && molecule) return explainBonded(molecule);
    if (!molecule) return explainUnsupported(symbols);
    return close ? `${molecule.formula}: atoms are close. Form Bond to share electrons.` : `${molecule.formula}: drag the atoms closer (or use Bring together), then Form Bond.`;
  }, [note, stage, molecule, symbols, close]);

  const done = molecule && stage !== "setup";
  const centralText = molecule && stage === "bonded" ? (molecule.central !== null
    ? `${molecule.atoms[molecule.central]} has ${electronsAround(molecule, molecule.central)} electrons around it (${octetWord[molecule.group]})`
    : [...new Set(molecule.atoms)].map((s) => `${s}: ${electronsAround(molecule, molecule.atoms.indexOf(s))}`).join(" · ") + " electrons") : "";

  const live = [
    { id: "mol", label: "Molecule", value: molecule ? `${molecule.formula}  ${molecule.structural}` : "–", bg: "#e8f7ef", testId: "live-molecule" },
    { id: "shared", label: "Shared pairs", value: done ? String(totalSharedPairs(molecule)) : "–", bg: "#eaf1ff", testId: "live-shared" },
    { id: "lone", label: "Lone pairs", value: done ? String(totalLonePairs(molecule)) : "–", bg: "#fff1e0", testId: "live-lone" },
    { id: "centre", label: molecule?.central !== null && molecule ? `e⁻ around ${molecule.atoms[molecule.central]}` : "e⁻ per atom", value: done && stage === "bonded" ? (molecule.central !== null ? String(electronsAround(molecule, molecule.central)) : [...new Set(molecule.atoms)].map((s) => electronsAround(molecule, molecule.atoms.indexOf(s))).join(", ")) : "–", bg: "#f1ebfb", testId: "live-central" },
    { id: "charge", label: "Net charge", value: done && stage === "bonded" ? "0" : "–", bg: "#f3f4f8", testId: "live-charge" },
  ];

  const lockReason = !inSetup ? "Reset to add more atoms." : null;

  const examples = group === "normal" ? examplesForOrder(order) : examplesForGroup(group);
  const options = (
    <div className="bv-options" data-testid="covalent-options">
      <MiniSwitch
        ariaLabel="Octet rule" testId="octet-tabs" value={group} onChange={pickGroup}
        options={COVALENT_GROUPS.map((g) => ({ id: g.id, label: g.label, title: g.ahl ? "Higher level only" : undefined }))}
      />
      {group === "normal" && (
        <MiniSwitch ariaLabel="Bond order" testId="order-tabs" value={order} onChange={pickOrder} options={BOND_ORDERS.map((b) => ({ id: b.id, label: b.label, title: b.title }))} />
      )}
      <div className="bv-examples" role="group" aria-label="Examples" data-testid="examples">
        <span className="bv-examples-label">Examples</span>
        {examples.map((m) => (
          <button key={m.id} type="button" className="bv-example" aria-pressed={molecule?.id === m.id} onClick={() => loadMolecule(m)} data-testid={`example-${m.id}`} title={`${m.name}: load ${m.formula}`}>{m.formula}</button>
        ))}
        {group === "expanded" && <span className="bv-ahl" title="Higher level only">AHL</span>}
      </div>
    </div>
  );

  const library = <ElementLibrary groups={GROUPS} onAdd={addAtom} dropRef={boxRef} disabledReason={lockReason} mode="covalent" hint="Start with two H, or load an example above the canvas." />;

  const canvas = (
    <div className="bv-canvas" ref={boxRef} tabIndex={0} onKeyDown={onKeyDown} data-testid="canvas" data-stage={stage} data-formula={molecule?.id ?? ""} data-atoms={atoms.length} data-close={close ? "1" : "0"} data-crowded={scene.crowded ? "1" : "0"} data-view={settle >= 1 ? "structure" : "lewis"} aria-label="Covalent bonding canvas. Arrow keys move the selected atom.">
      <svg ref={svgRef} className="bv-svg" style={settle > 0 ? { opacity: 1 - smooth } : undefined} viewBox={`0 0 ${world.W} ${world.H}`} preserveAspectRatio="xMidYMid meet" onPointerDown={(e) => { if (e.target === e.currentTarget) setSelected(null); }} role="img" aria-label={atoms.length ? `${atoms.length} atoms` : "Empty canvas"}>
        <defs>
          {scene.lenses.map((l, i) => (
            <g key={`d${i}`}>
              <clipPath id={`bv-clip-${i}`}><circle cx={l.ax} cy={l.ay} r={l.ar} /></clipPath>
              <linearGradient id={`bv-grad-${i}`} gradientUnits="userSpaceOnUse" x1={l.ax} y1={l.ay} x2={l.bx} y2={l.by}><stop offset="0" stopColor={l.ca} /><stop offset="1" stopColor={l.cb} /></linearGradient>
            </g>
          ))}
        </defs>
        {settle < 1 && scene.atoms.map((a) => {
          const src = atoms.find((x) => x.id === a.id);
          const el = a.electrons.find((e) => !e.core);
          return <AtomBody key={a.id} a={a} cloud={done ? el?.color : null} testId={`atom-${a.symbol}`} selected={selected === a.id && inSetup} dragProps={bind(a.id, () => ({ x: src.x, y: src.y }))} />;
        })}
        {settle < 1 && scene.lenses.map((l, i) => (
          <circle key={`l${i}`} cx={l.bx} cy={l.by} r={l.br} fill={`url(#bv-grad-${i})`} fillOpacity={0.38 * l.opacity} clipPath={`url(#bv-clip-${i})`} data-testid="overlap" pointerEvents="none" />
        ))}
        {settle < 1 && <Electrons atoms={scene.atoms} />}
        {stage === "bonded" && molecule && settle < 1 && (
          <g pointerEvents="none" data-testid="molecule-label">
            <text x={scene.centroid.x} y={Math.min(world.H - 30, scene.bottom + 38)} textAnchor="middle" fontSize="26" fontWeight="800" fill="#14226b"><SvgSubs text={molecule.formula} size={26} /></text>
            <text x={scene.centroid.x} y={Math.min(world.H - 8, scene.bottom + 62)} textAnchor="middle" fontSize="19" fontWeight="700" fill="#33415f" letterSpacing="1"><SvgSubs text={molecule.structural} size={19} /></text>
          </g>
        )}
      </svg>
      {settle > 0 && molecule && (
        <div className="bv-structure" data-on={settle >= 1 ? "1" : "0"} style={{ opacity: smooth }} data-testid="structure-layer">
          <Suspense fallback={null}><MoleculeView molecule={molecule} playing={playing} reduced={reduced} /></Suspense>
          <div className="bv-mol-label" data-testid="molecule-label"><b><HtmlSubs text={molecule.formula} /></b><span><HtmlSubs text={molecule.structural} /></span></div>
        </div>
      )}
      {atoms.length === 0 && <p className="bv-placeholder">Click or drag an atom from the library</p>}
      {centralText && <span className="bv-pill" data-testid="central-count">{centralText}</span>}
      {stage === "bonding" && <span className="bv-badge bv-badge--green" data-testid="stage-badge">{scene.crowded ? "Sharing electrons (valence dots only)" : "Sharing electrons"}</span>}
      {stage === "bonded" && (settle < 1
        ? <p className="bv-note" data-testid="lewis-note">Each shared pair has one electron from each atom (colours kept). Lewis diagram: electrons only, not molecular shape.</p>
        : <p className="bv-note" data-testid="structure-note">Final structure: spheres are atoms, bonds are shared pairs (2 or 3 lines for double or triple). Drag to rotate.</p>)}
      {selected && inSetup && (
        <button type="button" className="bv-corner-btn" onClick={removeSelected} data-testid="tool-remove" aria-label="Remove selected atom" title="Remove selected atom"><Trash2 size={15} aria-hidden="true" /></button>
      )}
    </div>
  );

  const reasonBond = !molecule ? explainUnsupported(symbols) : !close ? "Drag the atoms closer together first" : "Share electrons between the atoms";
  const toolbar = (
    <Toolbar label="Covalent bonding controls">
      <Tool icon={<Shrink size={15} aria-hidden="true" />} label="Bring together" title="Move the atoms next to each other" disabled={!molecule || !inSetup || close} onClick={bring} testId="tool-bring" />
      <Tool primary icon={<Merge size={15} aria-hidden="true" />} label="Form Bond" title={reasonBond} disabled={!molecule || !close || !inSetup} onClick={formBond} testId="tool-form-bond" />
      <Tool icon={playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />} label={playing ? "Pause" : "Play"} onClick={() => setPlaying((p) => !p)} testId="tool-pause" pressed={!playing} />
      <Tool icon={<Repeat size={15} aria-hidden="true" />} label="Replay" title="Replay the bond formation" disabled={inSetup} onClick={replay} testId="tool-replay" />
      <Tool icon={<RotateCcw size={15} aria-hidden="true" />} label="Reset" title="Back to two hydrogen atoms" onClick={onReset} testId="tool-reset" />
    </Toolbar>
  );

  return <ModeShell mode="covalent" state={stage} tabs={tabs} onReset={onReset} library={library} options={options} canvas={canvas} toolbar={toolbar} live={live} explain={explain} />;
}

