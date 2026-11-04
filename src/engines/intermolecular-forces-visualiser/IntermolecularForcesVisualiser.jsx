import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BookOpen, ChevronsLeftRight, ChevronsRightLeft, Compass, FlipHorizontal2, Flame, Pause, Play, RotateCcw, RotateCw, Rotate3d, SkipBack, SkipForward, Snowflake, Thermometer, Trash2, ArrowLeft, Camera, Repeat } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import SimulationDashboard, { DashPanel, DashboardTabs, ExplainLine, LiveStrip, MiniSwitch, PopoverSection, SettingToggle, SliderRow } from "../../components/simulation/SimulationDashboard.jsx";
import { useSimulationSessionState } from "../../components/interactive-shell/simulationSession.js";
import { createFrameClock } from "../../lib/frameTime.js";
import ImfStage from "./scene/ImfStage.jsx";
import CubeStage from "./scene/CubeStage.jsx";
import { warmClouds } from "./scene/cloudGeometry.js";
import MoleculeTray from "./components/MoleculeTray.jsx";
import IntraInterPopover from "./components/IntraInterPopover.jsx";
import HeatingGraph from "./components/HeatingGraph.jsx";
import useHeatSim from "./components/useHeatSim.js";
import { MOLECULES, TRAY_NONPOLAR, TRAY_POLAR, COMPARE_PAIRS } from "./model/molecules.js";
import { FORCES, FORCE_LABEL, FORCE_SHORT, computeInteractions } from "./model/imf.js";
import { LESSONS, LESSON_BY_ID, lessonDuration, lessonExtent, lessonFrame, lessonStepSettled, lessonStepStart } from "./model/lessons.js";
import { exploreNarration } from "./model/narration.js";
import { MOLECULAR_SUBSTANCES, SUBSTANCES, CO2_NOTE, PHASE_LABEL } from "./model/phase.js";
import { MAX_IN_WORKSPACE, START_GAP, addMolecule, changeSeparation, cloneAll, focusPair, fromPoses, layoutRow, removeMolecule, rotateEntry, validateWorkspace } from "./model/workspace.js";
import { QID } from "./model/vec.js";
import "./IntermolecularForcesVisualiser.css";

// Intermolecular Forces Visualiser (IB DP Chemistry S2.2). Explore | Learn, an "Intra vs Inter" popover, and a Heat & Phase Change view
// inside Explore. Pure model code (molecule data, qualitative force models, phase-change energy model, particle dynamics, lessons) lives
// in ./model and is tested by scripts/test-imf-model.mjs; ./scene draws it with react-three-fiber; ./components holds the controls.
// Everything shown is a QUALITATIVE teaching model, labelled as such. See docs/INTERMOLECULAR_FORCES.md.

/** Visual theme: "dark" (navy) is the same default as VSEPR_THEME in the VSEPR Explorer, so the simulations look consistent. */
export const IMF_THEME = "dark";
const TAB_STYLE = { soft: "#1a2b5b", border: "#2e4a90", text: "#d4e3ff", solid: "#1f6bff" };
const TABS = [
  { id: "explore", label: "Explore", sub: "Drag, rotate and investigate", icon: Compass, title: "Drag molecules into the workspace and investigate how they attract each other", ...TAB_STYLE },
  { id: "learn", label: "Learn", sub: "Guided demonstrations", icon: BookOpen, title: "Watch a short guided demonstration of one intermolecular force", ...TAB_STYLE },
];
const reducedMotion = () => { try { return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false; } catch { return false; } };
const isFinitePos = (v) => Number.isFinite(v);
const oneOf = (list) => (v) => list.includes(v);

function Workspace() {
  const [mode, setMode] = useSimulationSessionState("mode", "explore", oneOf(["explore", "learn"]));
  const [force, setForce] = useSimulationSessionState("force", "ldf", oneOf(FORCES));
  const [view, setView] = useSimulationSessionState("view", "ball", oneOf(["ball", "cloud"]));
  const [showDelta, setShowDelta] = useSimulationSessionState("delta", false, (v) => typeof v === "boolean");
  const [showDipole, setShowDipole] = useSimulationSessionState("dipole", false, (v) => typeof v === "boolean");
  const [learnView, setLearnView] = useState(null); // null = the lesson reveals the electron cloud itself; "ball" / "cloud" = the student chose
  const [exaggeration, setExaggeration] = useSimulationSessionState("exaggeration", 1.5, (v) => isFinitePos(v) && v >= 1 && v <= 3);
  const [molsState, setMolsState] = useSimulationSessionState("mols", [], validateWorkspace);
  const [lessonId, setLessonId] = useSimulationSessionState("lesson", "ldf", (v) => !!LESSON_BY_ID[v]);
  const [heat, setHeat] = useSimulationSessionState("heat", false, (v) => typeof v === "boolean");
  const [substanceId, setSubstanceId] = useSimulationSessionState("substance", "H2O", oneOf(MOLECULAR_SUBSTANCES));
  const [compare, setCompare] = useSimulationSessionState("compareIonic", false, (v) => typeof v === "boolean");
  const [graphShown, setGraphShown] = useState(true);
  const [heatSpeed, setHeatSpeed] = useSimulationSessionState("heatSpeed", 1, (v) => isFinitePos(v) && v >= 0.5 && v <= 4);
  const [interactMode, setInteractMode] = useState("move");
  const [selectedUid, setSelectedUid] = useState(null);
  const [frozen, setFrozen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [step, setStep] = useSimulationSessionState("learnStep", 0, (v) => Number.isInteger(v) && v >= 0 && v <= 4);
  const [summary, setSummary] = useState(null);
  const [notice, setNotice] = useState("");
  const [rev, setRev] = useState(0);
  const [liveTick, setLiveTick] = useState(0);

  const stageRef = useRef(null);
  const molsRef = useRef(cloneAll(molsState)); // Explore workspace (committed + live-mutated while dragging)
  const learnRef = useRef([]); // the two molecules of the current lesson
  const liveRef = useRef(molsRef.current); // what the scene draws
  const simRef = useRef({ t: 0, lt: mode === "learn" && LESSON_BY_ID[lessonId] ? lessonStepStart(LESSON_BY_ID[lessonId], Math.min(step, LESSON_BY_ID[lessonId].steps.length - 1)) + 0.001 : 0, fx: null, inter: null, mark: null });
  const rootRef = useRef(null);
  const latency = useRef({ clickAt: 0, ms: null });

  // ---- keep the scene's list in step with the mode ------------------------------------------------------------------------------
  const lesson = LESSON_BY_ID[lessonId];
  const buildLearn = useCallback((l) => {
    learnRef.current = l.pair.map((id, i) => ({ uid: 101 + i, id, pos: [...l.start[i].pos], quat: [...l.start[i].quat] }));
  }, []);
  const applyLesson = useCallback((l, lt) => {
    const f = lessonFrame(l, lt); simRef.current.fx = f.fx;
    learnRef.current.forEach((e, i) => { e.pos = [...f.poses[i].pos]; e.quat = [...f.poses[i].quat]; });
    return f;
  }, []);
  useEffect(() => {
    if (heat) return;
    if (mode === "learn") { buildLearn(lesson); applyLesson(lesson, simRef.current.lt); liveRef.current = learnRef.current; } else { liveRef.current = molsRef.current; simRef.current.fx = null; }
    setRev((r) => r + 1); stageRef.current?.invalidate();
  }, [mode, lessonId, heat]); // eslint-disable-line react-hooks/exhaustive-deps

  const commitExplore = useCallback((next) => { molsRef.current = next; if (!heat && mode === "explore") liveRef.current = next; setMolsState(next); setRev((r) => r + 1); stageRef.current?.invalidate(); }, [heat, mode, setMolsState]);

  // ---- idle warm-up: build every electron cloud before the user needs it (so Play and the first drop never wait for geometry) ------------------
  useEffect(() => { const cancel = warmClouds([...LESSONS.flatMap((l) => l.pair), ...TRAY_POLAR, ...TRAY_NONPOLAR]); return cancel; }, []);

  // ---- the Explore / Learn clock (not used in the heating view) ----------------------------------------------------------------------------
  const st = useRef({}); st.current = { mode, force, frozen, playing, lessonId, heat };
  useEffect(() => {
    if (heat) return undefined;
    const clock = createFrameClock(); let raf = 0; let lastStep = -1; let ended = false;
    const tick = (now) => {
      raf = requestAnimationFrame(tick); const dt = clock.tick(now); const S = simRef.current; const cur = st.current; if (dt <= 0) return;
      let dirty = false;
      if (cur.mode === "learn") {
        const l = LESSON_BY_ID[cur.lessonId]; const total = lessonDuration(l);
        if (cur.playing) {
          const before = S.lt; S.lt = Math.min(total, S.lt + dt); dirty = true;
          if (latency.current.clickAt && S.lt > before) { S.mark = { t0: latency.current.clickAt, key: "playLatency" }; latency.current.clickAt = 0; }
          if (S.lt >= total && !ended) { ended = true; setPlaying(false); }
        }
        const f = applyLesson(l, S.lt); if (f.step !== lastStep) { lastStep = f.step; setStep(f.step); }
        if (!cur.frozen && f.fx.gain > 0 && !f.fx.fixedDir) { S.t += dt; dirty = true; }
        const el = stageRef.current?.el?.(); if (el && dirty) { el.dataset.lessonT = S.lt.toFixed(2); el.dataset.lessonStep = String(f.step); }
        if (!cur.playing && S.mark) dirty = true;
      } else if (cur.force === "ldf" && !cur.frozen && molsRef.current.length >= 2) { S.t += dt; dirty = true; }
      if (cur.mode === "learn" && !cur.playing) ended = false;
      if (dirty) stageRef.current?.invalidate();
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); clock.dispose(); };
  }, [heat, applyLesson]);

  // ---- Explore interactions ------------------------------------------------------------------------------------------------------------------
  const flash = useCallback((msg) => { setNotice(msg); window.clearTimeout(flash.t); flash.t = window.setTimeout(() => setNotice(""), 3200); }, []);
  const addMol = useCallback((id, pos = null) => {
    const cur = molsRef.current;
    if (cur.length >= MAX_IN_WORKSPACE) { flash(`The workspace holds up to ${MAX_IN_WORKSPACE} molecules. Remove one first.`); return; }
    let next;
    const untouched = cur.every((m) => m.pos[1] === 0 && m.pos[2] === 0 && m.quat[3] === 1);
    if (!pos && untouched) next = layoutRow(addMolecule(cur, id, [0, 0, 0]), START_GAP); else next = addMolecule(cur, id, pos);
    commitExplore(next); setSelectedUid(next[next.length - 1].uid);
    if (heat) setHeat(false);
  }, [commitExplore, flash, heat, setHeat]);
  const onDrop = useCallback((id, pos) => addMol(id, pos), [addMol]);
  const removeSel = useCallback((uid) => { commitExplore(removeMolecule(molsRef.current, uid)); setSelectedUid(null); }, [commitExplore]);
  const clearAll = () => { commitExplore([]); setSelectedUid(null); };
  const rotateSel = (axis, deg) => { if (selectedUid == null) return; commitExplore(rotateEntry(molsRef.current, selectedUid, axis, (deg * Math.PI) / 180)); };
  const flipSel = () => { if (selectedUid == null) return; commitExplore(rotateEntry(molsRef.current, selectedUid, [0, 1, 0], Math.PI)); };
  const separate = useCallback((delta) => { commitExplore(changeSeparation(molsRef.current, delta)); }, [commitExplore]);
  const holdRef = useRef(0);
  const startHold = (delta) => { separate(delta); window.clearInterval(holdRef.current); holdRef.current = window.setInterval(() => separate(delta * 0.4), 90); };
  const stopHold = () => { window.clearInterval(holdRef.current); holdRef.current = 0; };
  useEffect(() => stopHold, []);
  const onLive = useCallback(() => setLiveTick((n) => n + 1), []);

  // ---- Learn controls ----------------------------------------------------------------------------------------------------------------------------
  const playPause = () => {
    const S = simRef.current; const total = lessonDuration(lesson);
    if (playing) { setPlaying(false); return; }
    if (S.lt >= total - 1e-6) S.lt = 0;
    latency.current.clickAt = performance.now(); latency.current.ms = null; setPlaying(true);
  };
  const jumpStep = (k) => {
    const S = simRef.current; const kk = Math.max(0, Math.min(lesson.steps.length - 1, k)); S.lt = kk === 0 ? 0.001 : lessonStepSettled(lesson, kk);
    S.mark = { t0: performance.now(), key: "stepLatency" }; applyLesson(lesson, S.lt); setStep(kk); stageRef.current?.invalidate();
  };
  const prevStep = () => jumpStep(step - 1);
  const resetLesson = () => { const S = simRef.current; S.lt = 0; S.t = 0; setPlaying(false); setFrozen(false); applyLesson(lesson, 0); setStep(0); stageRef.current?.invalidate(); };
  const replay = () => { const S = simRef.current; S.lt = 0; S.t = 0; setFrozen(false); applyLesson(lesson, 0); setStep(0); latency.current.clickAt = performance.now(); setPlaying(true); stageRef.current?.invalidate(); };
  const chooseLesson = (id) => { simRef.current.lt = 0; simRef.current.t = 0; setLessonId(id); setStep(0); setFrozen(false); setLearnView(null); latency.current.clickAt = performance.now(); setPlaying(!reducedMotion()); };
  const switchMode = (m) => {
    if (m === mode) return;
    setMode(m); setHeat(false);
    if (m === "learn") { const k = Math.min(step, lesson.steps.length - 1); simRef.current.lt = k === 0 ? 0 : lessonStepSettled(lesson, k); setFrozen(false); latency.current.clickAt = performance.now(); setPlaying(!reducedMotion()); } else setPlaying(false);
  };
  const tryInExplore = () => {
    const f = applyLesson(lesson, simRef.current.lt);
    const next = fromPoses(lesson.pair, f.poses, 1); molsRef.current = next; setMolsState(next); setForce(lesson.force); setPlaying(false); setSelectedUid(null); setFrozen(false);
    setMode("explore"); setHeat(false); flash(`Moved to Explore: ${lesson.pair.map((id) => MOLECULES[id].label).join(" + ")} with ${FORCE_LABEL[lesson.force]}. Drag and rotate them yourself.`);
  };

  // ---- Heat & Phase Change -------------------------------------------------------------------------------------------------------------------------
  const heatSim = useHeatSim({ active: heat, substanceId, compare, speed: heatSpeed });
  const openHeat = () => { setHeat(true); setGraphShown(true); setPlaying(false); };

  // ---- derived UI -------------------------------------------------------------------------------------------------------------------------------------
  const effForce = mode === "learn" ? lesson.force : force;
  const effView = mode === "learn" ? (learnView ?? "auto") : view;
  const frame = useMemo(() => (mode === "learn" ? lessonExtent(lesson) : null), [mode, lesson]);
  const frameKey = mode === "learn" ? `L${lessonId}` : `E${molsRef.current.length}`;
  const opts = useMemo(() => ({ force: effForce, view: effView, showDelta, showDipole: mode === "explore" && showDipole, exaggeration: mode === "learn" ? 2.5 : exaggeration, mode: interactMode, selectedUid: mode === "explore" ? selectedUid : null, interactive: mode === "explore" && !heat, frame, frameKey }), [effForce, effView, showDelta, showDipole, exaggeration, interactMode, selectedUid, mode, heat, frame, frameKey]);
  const stepCloud = (lesson.steps[Math.min(step, lesson.steps.length - 1)]?.fx.cloud ?? 0) > 0.5;
  const cloudShown = mode === "learn" ? (learnView ? learnView === "cloud" : stepCloud) : view === "cloud";
  const list = liveRef.current; void liveTick; void rev;
  const inter = summary?.inter ?? simRef.current.inter;
  const lessonFx = simRef.current.fx;
  const exploreText = useMemo(() => {
    const entries = molsRef.current;
    // the scene reports the live interaction summary; without WebGL (no scene) the same pure model is evaluated once here
    const it = inter ?? (entries.length >= 2 ? computeInteractions(entries.map((m) => ({ uid: m.uid, mol: MOLECULES[m.id], pose: m })), { force, t: 0, fluct: { gain: 0, fixedDir: null }, exaggeration: 1 }) : { mols: [], pairs: [] });
    const f = entries.length >= 2 ? (it.pairs ?? []).reduce((b, p) => (!b || p.r < b.r ? p : b), null) : null;
    return exploreNarration({ force, list: entries, focus: f, inter: it });
  }, [force, rev, inter, liveTick]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedMol = selectedUid != null ? molsRef.current.find((m) => m.uid === selectedUid) : null;
  const focusLive = (() => { const n = molsRef.current; const fp = focusPair(n); return fp ? { fp, a: MOLECULES[n[fp.i].id], b: MOLECULES[n[fp.j].id] } : null; })();
  void focusLive;

  const resetCurrent = () => {
    if (heat) { heatSim.reset(); return; }
    if (mode === "learn") { resetLesson(); return; }
    simRef.current.t = 0; setFrozen(false); stageRef.current?.resetView();
    commitExplore(layoutRow(molsRef.current)); setSelectedUid(null);
  };

  // ---- pieces -----------------------------------------------------------------------------------------------------------------------------------------
  const forceBar = (
    <div className="imf-topbar" data-testid="topbar">
      <div className="imf-force" role="radiogroup" aria-label="Intermolecular force to emphasise" data-testid="force-selector">
        {FORCES.map((f) => (
          <button key={f} type="button" role="radio" aria-checked={effForce === f} className="imf-force-btn" disabled={mode === "learn"} onClick={() => setForce(f)} data-testid={`force-${f}`} title={mode === "learn" ? "The lesson chooses the force" : `Emphasise ${FORCE_LABEL[f]}`}>
            <span className="imf-lab-full">{FORCE_LABEL[f]}</span><span className="imf-lab-short">{FORCE_SHORT[f]}</span>
          </button>
        ))}
      </div>
      <div className="imf-viewbar">
        <MiniSwitch options={[{ id: "ball", label: "Ball Model" }, { id: "cloud", label: "Electron Cloud" }]} value={mode === "learn" ? (cloudShown ? "cloud" : "ball") : view} onChange={mode === "learn" ? setLearnView : setView} ariaLabel="Molecule display" testId="view-switch" large />
        {mode === "explore" && <button type="button" className="sim-btn imf-mini" aria-pressed={showDelta} onClick={() => setShowDelta((v) => !v)} data-testid="delta-toggle" title="Show partial charges (permanent) and temporary / induced charges">Show δ⁺/δ⁻</button>}
        {mode === "explore" && <button type="button" className="sim-btn imf-mini" aria-pressed={showDipole} onClick={() => setShowDipole((v) => !v)} data-testid="dipole-toggle" title="Show small dipole arrows (vectors, not forces)">Dipoles</button>}
      </div>
    </div>
  );
  const note = (
    <p className="imf-ldf-note" data-testid="ldf-note">
      London dispersion acts between <b>all</b> atoms and molecules, polar or not{effForce !== "ldf" ? `; here ${FORCE_LABEL[effForce]} is emphasised.` : "."}
    </p>
  );
  const cloudLegend = cloudShown && (
    <div className="imf-legend" data-testid="cloud-legend" role="note">
      <b>Electron-density surface</b> (qualitative, not a quantum calculation)
      <span className="imf-legend-bar" aria-hidden="true" />
      <span><i style={{ background: "#e5483f" }} />electron-rich <i style={{ background: "#3a6fe8" }} />electron-poor<span className="imf-legend-long"> – <em>electrostatic potential colouring</em>, not the electrons themselves</span></span>
    </div>
  );

  // chamber
  let chamber; let controls; let live; let explain; let graph = null;
  if (heat) {
    const ui = heatSim.ui ?? []; const main = ui[0]; const ion = ui[1];
    const sub = SUBSTANCES[substanceId];
    chamber = (
      <div className="imf-chamber" data-testid="heat-chamber">
        <div className="imf-topbar imf-topbar--heat">
          <span className="imf-heat-title"><Thermometer size={15} aria-hidden="true" /> Heat &amp; Phase Change <small>1 atm · simplified model</small></span>
          <button type="button" className="sim-btn imf-mini" onClick={() => setHeat(false)} data-testid="heat-back"><ArrowLeft size={13} aria-hidden="true" /> Back to molecules</button>
        </div>
        <CubeStage simRef={heatSim.simRef} revision={heatSim.revision} compare={compare} ariaLabel={`Transparent cube containing ${compare ? `${sub.name} and sodium chloride` : sub.name} particles; use the Heat and Cool buttons to change the temperature`}>
          <div className="imf-cube-caps" aria-hidden="true">
            <span className="imf-cap">{sub.label} <small>{sub.kind === "molecular" ? "molecules, covalent bonds inside" : ""}</small></span>
            {compare && <span className="imf-cap imf-cap--ion">NaCl <small>ionic lattice (not molecules)</small></span>}
          </div>
          <p className="imf-cube-key" data-testid="cube-key">Dotted lines = intermolecular interactions (hydrogen bonds in water, dipole or dispersion contacts elsewhere; schematic). Steady in a solid, forming and breaking in a liquid, gone in a gas apart from brief contacts.</p>
        </CubeStage>
        <div className="imf-bar imf-bar--heat" role="toolbar" aria-label="Heating controls" data-testid="heat-controls">
          <div className="imf-readout" aria-live="polite" data-testid="heat-readout">
            <span>Temperature <b data-testid="heat-temp">{main ? `${main.T.toFixed(main.T < 100 ? 1 : 0)} K` : "–"}</b></span>
            <span>Phase <b data-testid="heat-phase" data-phase={main?.phase}>{main ? PHASE_LABEL[main.phase] : "–"}</b></span>
            {compare && ion && <span className="imf-readout-ion">NaCl <b data-testid="heat-temp-ion">{ion.T.toFixed(0)} K</b> <b data-testid="heat-phase-ion">{PHASE_LABEL[ion.phase]}</b></span>}
          </div>
          <div className="imf-btns">
            <button type="button" className="sim-btn sim-btn--primary imf-heatbtn" aria-pressed={heatSim.dir > 0} onClick={() => heatSim.setDir(heatSim.dir > 0 ? 0 : 1)} data-testid="btn-heat"><Flame size={14} aria-hidden="true" /> Heat</button>
            <button type="button" className="sim-btn imf-heatbtn" aria-pressed={heatSim.dir < 0} onClick={() => heatSim.setDir(heatSim.dir < 0 ? 0 : -1)} data-testid="btn-cool"><Snowflake size={14} aria-hidden="true" /> Cool</button>
            <button type="button" className="sim-btn imf-heatbtn" aria-pressed={heatSim.dir === 0} onClick={() => heatSim.setDir(0)} data-testid="btn-pause"><Pause size={14} aria-hidden="true" /> Pause</button>
            <button type="button" className="sim-btn imf-heatbtn" onClick={() => heatSim.reset()} data-testid="btn-heat-reset"><RotateCcw size={14} aria-hidden="true" /> Reset</button>
          </div>
        </div>
      </div>
    );
    controls = (
      <DashPanel title="Substance" grow className="imf-panel" testId="substance-panel">
        <div className="imf-subs" role="radiogroup" aria-label="Substance to heat">
          {MOLECULAR_SUBSTANCES.map((id) => (
            <button key={id} type="button" role="radio" aria-checked={substanceId === id} className="imf-sub" onClick={() => { setSubstanceId(id); }} data-testid={`sub-${id}`}>
              <b>{SUBSTANCES[id].label}</b><span>{SUBSTANCES[id].name}</span><small>{SUBSTANCES[id].Tm} K / {SUBSTANCES[id].Tb} K</small>
            </button>
          ))}
        </div>
        <p className="imf-sub-note" data-testid="co2-note">{CO2_NOTE}</p>
        <SettingToggle id="imf-compare" label="Compare with Ionic Solid" hint="Add NaCl (Tm 1074 K, Tb 1686 K)" checked={compare} onChange={setCompare} testId="compare-ionic" />
        <p className="imf-sub-note" data-testid="substance-note">{sub.note}</p>
      </DashPanel>
    );
    graph = main ? <HeatingGraph sub={sub} E={main.E} label={sub.name} /> : null;
    live = <LiveStrip items={[{ id: "t", label: "Temperature", value: main ? `${main.T.toFixed(0)} K` : "–", bg: "#e6efff", testId: "live-temp" }, { id: "p", label: "Phase", value: main ? PHASE_LABEL[main.phase].split(" (")[0] : "–", bg: "#e8f6ec", testId: "live-phase" }, { id: "e", label: "Energy added", value: main ? `${main.E.toFixed(1)} kJ/mol` : "–", bg: "#fff2d8", testId: "live-energy" }]} />;
    explain = <ExplainLine text={heatText(main, sub, compare, ion)} testId="what-is-happening" />;
  } else if (mode === "learn") {
    const f = lessonFx; void f;
    chamber = (
      <div className="imf-chamber" data-testid="learn-chamber">
        {forceBar}
        <ImfStage ref={stageRef} molsRef={liveRef} revision={rev} opts={opts} simRef={simRef} interactive={false} onSummary={setSummary} ariaLabel={`Animation: ${lesson.label}, ${lesson.summary}`}>
          {cloudLegend}
          <span className="imf-stepchip" data-testid="step-chip">Step {step + 1} of {lesson.steps.length}</span>
        </ImfStage>
        {note}
        <div className="imf-bar" role="toolbar" aria-label="Playback controls" data-testid="playback">
          <div className="imf-btns">
            <button type="button" className="sim-btn" onClick={prevStep} data-testid="btn-prev" disabled={step === 0}><SkipBack size={14} aria-hidden="true" /> Previous</button>
            <button type="button" className="sim-btn sim-btn--primary" onClick={playPause} data-testid="btn-play" aria-label={playing ? "Pause" : "Play"}>{playing ? <><Pause size={14} aria-hidden="true" /> Pause</> : <><Play size={14} aria-hidden="true" /> Play</>}</button>
            <button type="button" className="sim-btn" onClick={() => jumpStep(step + 1)} data-testid="btn-next" disabled={step >= lesson.steps.length - 1}>Next <SkipForward size={14} aria-hidden="true" /></button>
            <button type="button" className="sim-btn" onClick={replay} data-testid="btn-replay" title="Restart this demonstration from the beginning and play it"><Repeat size={14} aria-hidden="true" /> Replay</button>
          </div>
          <div className="imf-btns">
            <button type="button" className="sim-btn sim-btn--primary" onClick={tryInExplore} data-testid="btn-try-explore"><Compass size={14} aria-hidden="true" /> Try in Explore</button>
          </div>
        </div>
      </div>
    );
    controls = (
      <DashPanel title="Lessons" grow className="imf-panel" testId="lessons-panel">
        <div className="imf-lessons" role="radiogroup" aria-label="Guided demonstration">
          {LESSONS.map((l) => (
            <button key={l.id} type="button" role="radio" aria-checked={lessonId === l.id} className="imf-lesson" onClick={() => chooseLesson(l.id)} data-testid={`lesson-${l.id}`}>
              <b>{l.label}</b><span>{l.summary}</span>
            </button>
          ))}
        </div>
        <ol className="imf-steps" aria-label="Steps of this lesson">{lesson.steps.map((s, i) => <li key={s.id} aria-current={i === step ? "step" : undefined} data-active={i === step ? "1" : "0"}><button type="button" onClick={() => jumpStep(i)} data-testid={`step-${i}`}>{i + 1}</button></li>)}</ol>
      </DashPanel>
    );
    live = <LiveStrip items={[{ id: "s", label: "Step", value: `${step + 1} / ${lesson.steps.length}`, bg: "#e6efff", testId: "live-step" }, { id: "f", label: "Force", value: FORCE_LABEL[lesson.force], bg: "#e8f6ec", testId: "live-force" }]} />;
    explain = <ExplainLine text={lesson.steps[Math.min(step, lesson.steps.length - 1)]?.text ?? ""} testId="what-is-happening" details={<p className="imf-detail">{lesson.note}</p>} detailsLabel="About this demonstration" />;
  } else {
    const fpNow = focusPair(molsRef.current); const sep = fpNow ? fpNow.d : null;
    const pr = summary?.focus && molsRef.current.length >= 2 ? summary.focus : null;
    const interText = !pr ? "–" : !pr.applicable ? "not applicable" : force === "hbond" ? (pr.hbStrength > 0.05 ? `H-bond ${Math.round(pr.hbStrength * 100)} %` : "no H-bond") : pr.kind === "repel" ? `repulsive ${Math.round(pr.strength * 100)} %` : pr.kind === "attract" ? `attractive ${Math.round(pr.strength * 100)} %` : "–";
    chamber = (
      <div className="imf-chamber" data-testid="explore-chamber">
        {forceBar}
        <ImfStage
          ref={stageRef} molsRef={liveRef} revision={rev} opts={opts} simRef={simRef} interactive onSelect={setSelectedUid} onCommit={(n) => { molsRef.current = n; setMolsState(n); setRev((r) => r + 1); }}
          onDropMolecule={onDrop} onSummary={setSummary} onRemove={removeSel} onLive={onLive} onSeparate={separate} ariaLabel="3D workspace: drag molecules to move them, switch to Rotate to turn them"
        >
          {cloudLegend}
          {list.length === 0 && <p className="imf-empty" data-testid="empty-hint">Drag a molecule here from the tray, or click one to add it.</p>}
          {notice && <p className="imf-notice" role="status" data-testid="notice">{notice}</p>}
          {selectedMol && <span className="imf-selchip" data-testid="selected-chip">Selected: {MOLECULES[selectedMol.id].label}</span>}
        </ImfStage>
        {note}
        <div className="imf-bar" role="toolbar" aria-label="Workspace controls" data-testid="explore-controls">
          <div className="imf-btns">
            <MiniSwitch options={[{ id: "move", label: "Move" }, { id: "rotate", label: "Rotate" }]} value={interactMode} onChange={setInteractMode} ariaLabel="Drag action" testId="drag-mode" large titles={{ move: "Dragging a molecule moves it in the plane facing you", rotate: "Dragging a molecule turns it about its centre (Shift also rotates)" }} />
            <span className="imf-grp" role="group" aria-label="Rotate the selected molecule">
              <button type="button" className="sim-btn imf-ico" onClick={() => rotateSel([0, 1, 0], -30)} disabled={!selectedMol} aria-label="Turn left 30 degrees" title="Turn left 30°" data-testid="rot-left"><RotateCcw size={15} aria-hidden="true" /></button>
              <button type="button" className="sim-btn imf-ico" onClick={() => rotateSel([0, 1, 0], 30)} disabled={!selectedMol} aria-label="Turn right 30 degrees" title="Turn right 30°" data-testid="rot-right"><RotateCw size={15} aria-hidden="true" /></button>
              <button type="button" className="sim-btn imf-ico" onClick={() => rotateSel([0, 0, 1], 30)} disabled={!selectedMol} aria-label="Tilt 30 degrees" title="Tilt 30°" data-testid="rot-tilt"><Rotate3d size={15} aria-hidden="true" /></button>
              <button type="button" className="sim-btn imf-ico" onClick={flipSel} disabled={!selectedMol} aria-label="Flip 180 degrees" title="Flip 180° (reverses the dipole direction)" data-testid="rot-flip"><FlipHorizontal2 size={15} aria-hidden="true" /></button>
            </span>
            <span className="imf-grp" role="group" aria-label="Separation of the two closest molecules">
              <button type="button" className="sim-btn" onPointerDown={() => startHold(-0.4)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); separate(-0.5); } }} disabled={molsRef.current.length < 2} data-testid="btn-closer" title="Bring the two closest molecules closer (hold to keep going)"><ChevronsRightLeft size={14} aria-hidden="true" /> Closer</button>
              <button type="button" className="sim-btn" onPointerDown={() => startHold(0.4)} onPointerUp={stopHold} onPointerLeave={stopHold} onPointerCancel={stopHold} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); separate(0.5); } }} disabled={molsRef.current.length < 2} data-testid="btn-apart" title="Move the two closest molecules apart (hold to keep going)"><ChevronsLeftRight size={14} aria-hidden="true" /> Apart</button>
            </span>
          </div>
          <div className="imf-btns">
            {force === "ldf" && <button type="button" className="sim-btn" aria-pressed={frozen} onClick={() => setFrozen((v) => !v)} data-testid="btn-freeze" title="Freeze the fluctuating electron clouds to discuss the instantaneous and induced dipoles"><Camera size={14} aria-hidden="true" /> Freeze Moment</button>}
            {force === "ldf" && <CompareMenu onPick={(pair) => { const next = layoutRow(pair.flatMap((id) => [id, id]).map((id, i) => ({ uid: i + 1, id, pos: [0, 0, 0], quat: [...QID] }))); compareLayout(next, commitExplore); setSelectedUid(null); }} />}
            <button type="button" className="sim-btn" onClick={() => selectedMol && removeSel(selectedMol.uid)} disabled={!selectedMol} data-testid="btn-remove" title="Remove the selected molecule"><Trash2 size={14} aria-hidden="true" /> Remove</button>
            <button type="button" className="sim-btn sim-btn--primary" onClick={openHeat} data-testid="btn-heat-view" title="Replace the workspace with a transparent cube you can heat and cool"><Thermometer size={14} aria-hidden="true" /> Heat &amp; Phase Change</button>
          </div>
        </div>
      </div>
    );
    controls = (
      <DashPanel title="Molecules" grow className="imf-panel" testId="tray-panel">
        <MoleculeTray onAdd={(id) => addMol(id)} onClear={clearAll} stageRef={stageRef} count={molsRef.current.length} max={MAX_IN_WORKSPACE} />
      </DashPanel>
    );
    live = <LiveStrip items={[{ id: "sep", label: "Separation", value: sep == null ? "–" : `${sep.toFixed(1)} Å`, bg: "#e6efff", testId: "live-sep", title: "Centre-to-centre distance of the two closest molecules" }, { id: "int", label: "Interaction", value: interText, bg: "#e8f6ec", testId: "live-interaction", title: "Relative, unitless indicator from a qualitative model – not an interaction energy" }]} />;
    explain = <ExplainLine text={exploreText} testId="what-is-happening" details={<p className="imf-detail">Indicators are relative and qualitative: they come from simple classical electrostatics on model partial charges, not from quantum calculations.</p>} detailsLabel="About the indicators" />;
  }

  const settings = (
    <>
      <PopoverSection title="Electron-cloud polarisation">
        <SliderRow id="imf-exag" label="Exaggeration" value={exaggeration} min={1} max={3} step={0.25} onChange={setExaggeration} badgeText={`×${exaggeration.toFixed(2)}`} minText="×1" maxText="×3" testId="exaggeration" note="Visual only: scales how far the cloud is displaced. ×1 is the model's own scale (still qualitative)." />
      </PopoverSection>
      <PopoverSection title="Heating speed">
        <SliderRow id="imf-speed" label="Speed" value={heatSpeed} min={0.5} max={4} step={0.5} onChange={setHeatSpeed} badgeText={`×${heatSpeed}`} minText="×0.5" maxText="×4" testId="heat-speed" note="Each stage is paced to last a few seconds; the graph's x axis is energy, not time." />
      </PopoverSection>
    </>
  );

  return (
    <div className="imf-theme" data-imf-theme={IMF_THEME} ref={rootRef}>
      <SimulationDashboard
        title="Intermolecular Forces Visualiser" subtitle="S2.2 The Covalent Model" role="region" ariaLabel="Intermolecular Forces Visualiser" testId="imf-workspace" id="imf-root"
        onReset={resetCurrent} graphShown={heat && graphShown} graphWide={false} graphId="imf-graph" onGraphToggle={heat ? () => setGraphShown((v) => !v) : undefined}
        headerExtra={<IntraInterPopover />} settings={settings}
        tabs={<DashboardTabs ariaLabel="Mode" idPrefix="imf-tab" value={mode} onChange={switchMode} tabs={TABS.map((t) => ({ ...t, testId: `tab-${t.id}` }))} testId="imf-tabs" />}
        controls={controls} chamber={chamber} graph={graph} live={live} explain={explain}
      />
    </div>
  );
}

function heatText(main, sub, compare, ion) {
  if (!main) return "Press Heat to add thermal energy and watch the particles.";
  const bonds = sub.kind === "molecular" ? ` The covalent bonds inside each ${sub.label} molecule stay intact in every phase.` : "";
  const t = {
    solid: `Solid: particles vibrate about fixed positions that hold the ordered arrangement; temperature rises as energy is added.${bonds}`,
    melting: `Melting at ${sub.Tm} K: the added energy loosens the ordered arrangement, so the temperature stays constant. The attractions between particles remain.${bonds}`,
    liquid: `Liquid: particles are close but disordered, move past one another and tumble; interactions form and break all the time.${bonds}`,
    boiling: `Boiling at ${sub.Tb} K: the added energy separates particles from each other (overcoming the intermolecular attractions) at constant temperature.${bonds}`,
    gas: `Gas: particles are widely separated and move freely.${bonds}`,
  }[main.phase];
  if (compare && ion) return `${t} NaCl: ${ion.phase === "melting" || ion.phase === "liquid" ? "the ordered ionic lattice has broken down; ions move but still attract each other" : ion.phase === "solid" ? "an ordered lattice of Na⁺ and Cl⁻ ions" : "ions separated"}.`;
  return t;
}

function compareLayout(next, commit) {
  // Compare pair: two identical particles in each pair, the two pairs apart, parallel orientation, equal separation (4.6 A) inside a pair
  const [a1, a2, b1, b2] = next; const sepIn = 4.6; const off = 6.2;
  a1.pos = [-off - sepIn / 2, 0, 0]; a2.pos = [-off + sepIn / 2, 0, 0]; b1.pos = [off - sepIn / 2, 0, 0]; b2.pos = [off + sepIn / 2, 0, 0];
  commit(next);
}

function CompareMenu({ onPick }) {
  const [open, setOpen] = useState(false);
  return (
    <span className="imf-compare">
      <button type="button" className="sim-btn" aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen((v) => !v)} data-testid="btn-compare" title="Compare how polarizability changes the dispersion attraction"><Compass size={14} aria-hidden="true" /> Compare</button>
      {open && (
        <div className="imf-menu" role="menu" aria-label="Compare size and polarizability" data-testid="compare-menu">
          {COMPARE_PAIRS.map((p) => {
            const [x, y] = p.map((id) => MOLECULES[id]);
            return (<button key={p.join()} type="button" role="menuitem" className="sim-btn imf-menuitem" onClick={() => { setOpen(false); onPick(p); }} data-testid={`compare-${p.join("-")}`}>{x.label} vs {y.label} <small>α′ {x.alpha} vs {y.alpha} Å³</small></button>);
          })}
          <p className="imf-menu-note">Larger, more polarizable electron clouds generally give stronger dispersion forces when other factors are comparable. Size alone is not a universal measure: ionisation energy and shape matter too.</p>
        </div>
      )}
    </span>
  );
}

// Reachable from /interactives, /simulation/intermolecular-forces-visualiser and any Learn page that embeds it through the simulation registry.
export default function IntermolecularForcesVisualiser({ compact = false, standalone = false }) {
  return (
    <InteractiveFrame title="Intermolecular Forces Visualiser" subtitle="How molecules attract one another, from electron clouds to phase changes" compact={compact} standalone={standalone} dashboard>
      <Workspace />
    </InteractiveFrame>
  );
}
