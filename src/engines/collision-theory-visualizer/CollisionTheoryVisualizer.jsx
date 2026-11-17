import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, StepForward, Target } from "lucide-react";
import InteractiveFrame from "../../components/interactive-shell/InteractiveFrame.jsx";
import NumberField from "../../components/interactive-shell/NumberField.jsx";
import SimulationDashboard, {
  ChamberToolbar, DashPanel, DashboardTabs, ExplainLine, HeaderPopover, LiveStrip, MiniSwitch, PopoverSection, SettingToggle, SliderRow, ToolButton,
} from "../../components/simulation/SimulationDashboard.jsx";
import { CollisionEngine, DT, LIMITS, defaultParams, effectiveEa, sanitizeParams } from "./lib/collisionEngine.js";
import { makeSnapshot } from "./lib/snapshot.js";
import { scenarioConfigs } from "./lib/scenarios.js";
import { formatFraction } from "./lib/maxwellBoltzmann.js";
import { formatRate, rateUncertainty, RATE_WINDOW } from "./lib/rateMetrics.js";
import { draw } from "./render.js";
import { useBox, useReducedMotion } from "./useBox.js";
import { SPECIES } from "./theme.js";
import MbGraph, { HIST_BIN, XMAX } from "./components/MbGraph.jsx";
import RateGraph from "./components/RateGraph.jsx";
import ReactionProfile from "./components/ReactionProfile.jsx";
import { CollisionViewer } from "./components/CollisionViewer.jsx";
import PredictPanel from "./components/PredictPanel.jsx";
import "./CollisionTheory.css";

const PUBLISH_MS = 125;
const DWELL_MS = 5200; // the 2.6 s replay, then the final frame is held for about 2.5 s
const DWELL_SUCCESS_MS = 3200; // a reaction may replace the shown collision as soon as the replay has finished
const MAX_STEPS_PER_FRAME = 40;
const SPEEDS = [
  { id: "0.25", label: "¼×", title: "Quarter speed" }, { id: "0.5", label: "½×", title: "Half speed" },
  { id: "1", label: "1×", title: "Normal speed" }, { id: "2", label: "2×", title: "Double speed" },
];
const SYSTEMS = [
  { id: "mixed", label: "A + B (both move)", title: "Both reactants are free particles" },
  { id: "solid", label: "Solid A + B", title: "A is a solid made of fixed sites; B particles hit its surface" },
];
const PIECE_NAMES = ["1 lump", "4 pieces", "9 pieces", "16 pieces", "36 pieces"];
const DEFAULT_EXPLAIN = "A collision reacts only if its energy is at least Ea and the reactive sites face each other.";

function explainFor(key, dir) {
  const up = dir > 0;
  switch (key) {
    case "T": return up ? "Higher temperature: collisions are more frequent and a larger fraction of them has E ≥ Ea (the shaded area grows), so the rate rises." : "Lower temperature: collisions are less frequent and fewer of them have E ≥ Ea (the shaded area shrinks), so the rate falls.";
    case "n": return up ? "Higher concentration: more particles in the same volume, so collisions are more frequent. The fraction that is successful is unchanged." : "Lower concentration: fewer particles in the same volume, so collisions are less frequent. The fraction that is successful is unchanged.";
    case "piece": return up ? "Smaller pieces expose more of the solid: B collides with more A sites each second. Ea and the energy distribution are unchanged." : "Larger pieces expose less of the solid, so B collides with fewer A sites each second.";
    case "ea": return up ? "Higher Ea: the shaded area beyond Ea shrinks, so fewer collisions are successful." : "Lower Ea: the shaded area beyond Ea grows, so more collisions are successful.";
    case "catalyst": return up ? "A catalyst gives an alternative pathway with a lower Ea: the Ea line moves left and more collisions are successful. The curve itself does not change." : "Without the catalyst Ea is higher, so a smaller fraction of collisions is successful.";
    case "site": return up ? "A wider reactive site means more collisions meet the orientation condition." : "A narrower reactive site means fewer collisions meet the orientation condition, even when the energy is enough.";
    default: return DEFAULT_EXPLAIN;
  }
}

function initialSeed(prop) {
  if (Number.isFinite(prop)) return prop >>> 0;
  try { const q = new URLSearchParams(window.location.search).get("seed"); if (q != null && /^\d+$/.test(q)) return Number(q) >>> 0; } catch { /* no window */ }
  return (Math.random() * 2 ** 32) >>> 0;
}

export default function CollisionTheoryVisualizer({ compact = false, standalone = false, seed }) {
  return (
    <InteractiveFrame title="Collision Theory Visualizer" compact={compact} standalone={standalone} dashboard>
      <Workspace seedProp={seed} />
    </InteractiveFrame>
  );
}

function Workspace({ seedProp }) {
  const reduced = useReducedMotion();
  const fixedSeed = useRef(initialSeed(seedProp));
  const engineRef = useRef(null);
  if (!engineRef.current) engineRef.current = new CollisionEngine({ seed: fixedSeed.current, params: defaultParams() });
  const engine = engineRef.current;

  const [params, setParams] = useState(() => engine.p);
  const [playing, setPlaying] = useState(!reduced ? true : false);
  const [speed, setSpeed] = useState(reduced ? "0.25" : "1");
  const [showSites, setShowSites] = useState(true);
  const [showEnergetic, setShowEnergetic] = useState(true);
  const [showHist, setShowHist] = useState(true);
  const [repeatable, setRepeatable] = useState(false);
  const [graphShown, setGraphShown] = useState(true);
  const [zoom, setZoom] = useState(false);
  const [rateView, setRateView] = useState("rate");
  const [graphTab, setGraphTab] = useState("mb");
  const [pinnedCurve, setPinnedCurve] = useState(null);
  const [pauseOnReaction, setPauseOnReaction] = useState(false);
  const [snap, setSnap] = useState(() => makeSnapshot(engine));
  const [mag, setMag] = useState({ ev: null, pinned: null, token: 0 });
  const [explain, setExplain] = useState({ key: "default", dir: 1 });
  const [notices, setNotices] = useState({});
  const [resetToken, setResetToken] = useState(0);

  // refs read by the animation loop (no re-subscription when they change)
  const live = useRef({});
  live.current = { playing, speed: Number(speed), showSites, showEnergetic, pauseOnReaction, reduced };
  const magRef = useRef({ ev: null, pinned: null, at: 0, token: 0 });
  const histRef = useRef({ ema: new Float64Array(Math.ceil(XMAX / HIST_BIN)), tmp: new Float64Array(Math.ceil(XMAX / HIST_BIN)), key: "", measured: null, mkey: "" });
  const [histView, setHistView] = useState(() => new Float64Array(Math.ceil(XMAX / HIST_BIN)));
  const [measured, setMeasured] = useState(null);

  const publish = useCallback((force = false) => {
    const e = engine; const s = makeSnapshot(e); const h = histRef.current; const now = performance.now();
    // energy histogram of the particles in the vessel (smoothed over a few seconds)
    const hk = `${s.T}|${e.p.system}`;
    e.energyHistogram(h.tmp, HIST_BIN);
    if (h.key !== hk) { h.ema.set(h.tmp); h.key = hk; } else for (let i = 0; i < h.ema.length; i++) h.ema[i] = h.ema[i] * 0.92 + h.tmp[i] * 0.08;
    const mk = `${s.T}|${s.eaEff}`;
    h.measured = h.mkey !== mk || h.measured == null ? s.aboveNow : h.measured * 0.97 + s.aboveNow * 0.03; h.mkey = mk;
    // which collision is shown in the magnified view
    const m = magRef.current; let cand = null;
    if (m.pinned != null) cand = e.lastEvent(m.pinned);
    else { const ok = e.lastEvent(0); cand = ok && (!m.ev || ok.seq > m.ev.seq) ? ok : e.latestEvent(); }
    if (cand && (!m.ev || cand.seq !== m.ev.seq) && (force || now - m.at >= (cand.outcome === 0 ? DWELL_SUCCESS_MS : DWELL_MS))) {
      m.ev = cand; m.at = now; m.token++;
      setMag({ ev: cand, pinned: m.pinned, token: m.token });
    }
    setHistView(h.ema.slice()); setMeasured(h.measured);
    setSnap(s);
  }, [engine]);

  // ---- animation loop: fixed time step, accumulator, bounded steps per frame
  const stageRef = useRef(null); const canvasRef = useRef(null);
  const box = useBox(stageRef, { w: 480, h: 300 });
  const boxRef = useRef(box); boxRef.current = box;
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return undefined;
    const ctx = canvas.getContext?.("2d") ?? null;
    let raf = 0; let last = performance.now(); let acc = 0; let lastPub = 0;
    canvas.__engine = engine;
    const frame = (now) => {
      const L = live.current; const dtw = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
      let pausedByReaction = false;
      if (L.playing) {
        acc += dtw * L.speed; let steps = 0; const s0 = engine.succ;
        while (acc >= DT && steps < MAX_STEPS_PER_FRAME) {
          engine.step(); acc -= DT; steps++;
          if (L.pauseOnReaction && engine.succ > s0) { pausedByReaction = true; acc = 0; break; }
        }
        if (steps >= MAX_STEPS_PER_FRAME) acc = 0;
      }
      if (pausedByReaction) { setPlaying(false); setPauseOnReaction(false); magRef.current.pinned = null; publish(true); lastPub = now; }
      else if (now - lastPub >= PUBLISH_MS) { publish(false); lastPub = now; }
      if (ctx) {
        const b = boxRef.current; const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const pw = Math.round(b.w * dpr); const ph = Math.round(b.h * dpr);
        if (canvas.width !== pw || canvas.height !== ph) { canvas.width = pw; canvas.height = ph; canvas.style.width = `${b.w}px`; canvas.style.height = `${b.h}px`; }
        draw(ctx, engine, { cssW: b.w, cssH: b.h, dpr }, { showSites: L.showSites, showEnergetic: L.showEnergetic, marker: magRef.current.ev && engine.t - magRef.current.ev.t < 4 ? magRef.current.ev : null });
      }
      canvas.dataset.t = engine.t.toFixed(2); canvas.dataset.n = String(engine.n); canvas.dataset.succ = String(engine.succ); canvas.dataset.coll = String(engine.coll);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); delete canvas.__engine; };
  }, [engine, publish]);

  // ---- changing conditions
  const change = useCallback((patch, key, label) => {
    const before = engine.p; const next = sanitizeParams({ ...before, ...patch });
    engine.setParams(patch);
    engine.mark(label);
    setParams(engine.p);
    const k = key ?? Object.keys(patch)[0];
    const dir = k === "catalyst" ? (next.catalyst ? 1 : -1) : Math.sign((next[k] ?? 0) - (before[k] ?? 0)) || 1;
    setExplain({ key: k, dir });
    if (key === "system") { setPinnedCurve(null); magRef.current = { ev: null, pinned: null, at: 0, token: 0 }; setMag({ ev: null, pinned: null, token: 0 }); }
    publish(false);
  }, [engine, publish]);
  const note = (k, text) => setNotices((n) => ({ ...n, [k]: text }));

  const doReset = useCallback((cfg = defaultParams(), keepPredict = false) => {
    const seed = repeatable ? fixedSeed.current : (Math.random() * 2 ** 32) >>> 0;
    engine.configure(cfg, seed);
    setParams(engine.p); setPlaying(!reduced); setSpeed(reduced ? "0.25" : "1"); setPauseOnReaction(false);
    setPinnedCurve(null); setZoom(false); setRateView("rate"); setGraphTab("mb"); setExplain({ key: "default", dir: 1 }); setNotices({});
    histRef.current.key = ""; histRef.current.mkey = ""; histRef.current.measured = null;
    magRef.current = { ev: null, pinned: null, at: 0, token: 0 }; setMag({ ev: null, pinned: null, token: 0 });
    if (!keepPredict) setResetToken((n) => n + 1);
    publish(true);
  }, [engine, repeatable, reduced, publish]);
  const handleReset = () => { setShowSites(true); setShowEnergetic(true); setShowHist(true); doReset(); };

  const onPin = (outcome, replay) => {
    if (replay) { setMag((m) => ({ ...m, token: m.token + 1 })); magRef.current.token++; return; }
    magRef.current.pinned = outcome; magRef.current.at = 0;
    publish(true);
    setMag((m) => ({ ...m, pinned: outcome }));
  };

  const setupScenario = (sc) => {
    const { base } = scenarioConfigs(sc);
    doReset(base, true); engine.run(30); setPlaying(true); publish(true);
    setExplain({ key: "default", dir: 1 });
  };
  const applyScenario = (sc) => {
    const patch = sc.change;
    const key = Object.keys(patch)[0];
    change(patch, key, labelFor(key, { ...engine.p, ...patch }));
  };
  const stepOnce = () => { for (let i = 0; i < 24; i++) engine.step(); publish(true); };

  // ---- derived values
  const p = params; const eaEff = effectiveEa(p); const solid = p.system === "solid";
  const stericPct = Math.round(snap.steric * 100);
  const rateText = formatRate(snap.rate);
  const sigma = rateUncertainty(snap.rate * snap.span, snap.span);
  const exposure = snap.tiles ? `${snap.tiles.exposed} of ${snap.tiles.total} sites exposed` : "";

  const live1 = useMemo(() => [
    { id: "T", label: "Temperature", value: `${p.T} K`, bg: "#fde9d8", testId: "live-T" },
    { id: "rate", label: `Rate (last ${Math.round(snap.span) || RATE_WINDOW} s)`, value: `${rateText} s⁻¹`, bg: "#dbeafe", testId: "live-rate", title: `Successful collisions per second of simulated time, averaged over the last ${RATE_WINDOW} s (±${sigma.toFixed(2)})` },
    { id: "coll", label: "A–B collisions", value: `${formatRate(snap.collRate)} s⁻¹`, bg: "#e9e4fb", testId: "live-coll" },
    { id: "share", label: "Successful", value: snap.collRate > 0 ? formatFraction(snap.successShare) : "—", bg: "#dcf5e4", testId: "live-share" },
    { id: "prod", label: "Reactions so far", value: String(snap.succ), bg: "#fff1c9", testId: "live-total" },
  ], [p.T, snap.span, rateText, sigma, snap.collRate, snap.successShare, snap.succ]);

  const nSpecies = solid ? `${p.n} B` : `${p.n} A + ${p.n} B`;

  const controls = (
    <DashPanel title="Conditions" grow className="ct-cond" ariaLabel="Conditions you can change" testId="conditions">
      <div className="sd-rows ct-rows">
        <SliderRow id="ct-T" label="Temperature" symbol="T" testId="T" rowTestId="row-T" color="#c2410c" badgeBg="#fde9d8" badgeText={`${p.T} K`} valueText={`${p.T} kelvin`}
          value={p.T} min={LIMITS.T[0]} max={LIMITS.T[1]} step={5} minText={`${LIMITS.T[0]} K`} maxText={`${LIMITS.T[1]} K`} note={notices.T}
          onChange={(v) => { note("T", null); change({ T: v }, "T", `T ${v} K`); }}
          labelExtra={<NumberField value={p.T} min={LIMITS.T[0]} max={LIMITS.T[1]} decimals={0} unit="K" label="Type a temperature" testId="input-T" width={52} onNotice={(t) => note("T", t)} onCommit={(x) => change({ T: x }, "T", `T ${x} K`)} />} />
        <SliderRow id="ct-n" label="Concentration" testId="n" rowTestId="row-n" color="#2b5fd0" badgeBg="#dce7fb" badgeText={nSpecies} valueText={`${nSpecies} in the same vessel`}
          value={p.n} min={LIMITS.n[0]} max={LIMITS.n[1]} step={1} minText={`${LIMITS.n[0]}`} maxText={`${LIMITS.n[1]}`} note={notices.n}
          onChange={(v) => { note("n", null); change({ n: v }, "n", `n ${v}`); }}
          labelExtra={<NumberField value={p.n} min={LIMITS.n[0]} max={LIMITS.n[1]} decimals={0} unit="particles" label="Type a number of particles of each reactant" testId="input-n" width={40} onNotice={(t) => note("n", t)} onCommit={(x) => change({ n: x }, "n", `n ${x}`)} />} />
        {solid && (
          <SliderRow id="ct-piece" label="Surface area" symbol="same mass" testId="piece" rowTestId="row-piece" color="#0f766e" badgeBg="#d5f3ee" badgeText={PIECE_NAMES[p.piece]} valueText={`${PIECE_NAMES[p.piece]}, ${exposure}`}
            value={p.piece} min={0} max={LIMITS.piece[1]} step={1} minText="1 lump" maxText="36 pieces" note={exposure} noteTone="info"
            onChange={(v) => change({ piece: v }, "piece", PIECE_NAMES[v])} />
        )}
        <SliderRow id="ct-ea" label={<Lbl full="Activation energy" short="Ea" />} symbol="Ea" testId="ea" rowTestId="row-ea" color="#7c3aed" badgeBg="#e9e0fb" badgeText={`${p.ea.toFixed(0)} kJ/mol`} valueText={`${p.ea.toFixed(1)} kilojoules per mole`}
          value={p.ea} min={LIMITS.ea[0]} max={LIMITS.ea[1]} step={1} minText={`${LIMITS.ea[0]}`} maxText={`${LIMITS.ea[1]} kJ/mol`} note={notices.ea}
          onChange={(v) => { note("ea", null); change({ ea: v }, "ea", `Ea ${v}`); }}
          labelExtra={<NumberField value={p.ea} min={LIMITS.ea[0]} max={LIMITS.ea[1]} decimals={0} unit="kJ/mol" label="Type an activation energy" testId="input-ea" width={44} onNotice={(t) => note("ea", t)} onCommit={(x) => change({ ea: x }, "ea", `Ea ${x}`)} />} />
        <SliderRow id="ct-site" label={<Lbl full="Reactive-site width" short="Site width" />} symbol="orientation" testId="site" rowTestId="row-site" color="#b45309" badgeBg="#fdebc8" badgeText={p.site >= 360 ? "any" : `${p.site}°`} valueText={p.site >= 360 ? "any orientation" : `${p.site} degrees`}
          value={p.site} min={LIMITS.site[0]} max={LIMITS.site[1]} step={10} minText="60°" maxText="360° (any)"
          note={p.site >= 360 ? "Orientation never prevents a reaction." : `Both sites face each other in ${stericPct} % of contacts.`} noteTone="info"
          onChange={(v) => change({ site: v }, "site", p.site >= 360 ? "any orientation" : `site ${v}°`)} />
        <div className="sd-row sd-row--active ct-cat" data-testid="row-catalyst">
          <div className="sd-row-top">
            <span className="sd-row-label" id="ct-cat-label">Catalyst</span><span className="sd-row-spacer" />
            <span className="sd-badge" style={{ background: "#d9f3e3" }} aria-hidden="true">{p.catalyst ? `Ea ${eaEff.toFixed(1)}` : "none"}</span>
          </div>
          <MiniSwitch ariaLabel="Catalyst" testId="catalyst-switch" fill value={p.catalyst ? "on" : "off"} options={[{ id: "off", label: "Off" }, { id: "on", label: "On", title: "Lowers Ea to 60 % of its value" }]}
            onChange={(v) => change({ catalyst: v === "on" }, "catalyst", v === "on" ? "catalyst on" : "catalyst off")} />
          <p className="sd-note sd-note--info">{p.catalyst ? `Alternative pathway: Ea ${p.ea.toFixed(0)} → ${eaEff.toFixed(1)} kJ/mol` : "On lowers Ea by 40 % (alternative pathway)."}</p>
        </div>
      </div>
    </DashPanel>
  );

  const vesselLabel = `Reaction vessel with ${snap.nA} A, ${snap.nB} B, ${snap.nC} C and ${snap.nD} D particles at ${p.T} kelvin. ${snap.succ} reactions so far, ${rateText} per second.`;
  const chamber = (
    <DashPanel ariaLabel="Reaction vessel and magnified collision" grow noBody className="ct-chamber-panel" testId="chamber">
      <div className="ct-vessel" ref={stageRef} data-testid="vessel">
        <canvas ref={canvasRef} role="img" aria-label={vesselLabel} className="ct-canvas" data-testid="vessel-canvas" />
        <ul className="ct-key" aria-label="Particle key">
          {SPECIES.map((s) => <li key={s.id}><i style={{ background: s.color }} aria-hidden="true" />{s.id}</li>)}
          <li className="ct-key-ring"><i className="ct-ring" aria-hidden="true" />E {"≥"} Ea</li>
        </ul>
      </div>
      <div className="ct-tools">
        <ChamberToolbar>
          <ToolButton icon={playing ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />} label={playing ? "Pause" : "Play"} title={playing ? "Pause the simulation" : "Play the simulation"} onClick={() => setPlaying((v) => !v)} primary testId="play-pause" />
          <ToolButton icon={<StepForward size={14} aria-hidden="true" />} label="Step" title="Advance 0.1 s of simulated time" onClick={() => { setPlaying(false); stepOnce(); }} testId="step" />
          <ToolButton icon={<Target size={14} aria-hidden="true" />} label="Next reaction" title="Pause at the next reaction: run until the next successful collision, then pause and show it" pressed={pauseOnReaction} onClick={() => { setPauseOnReaction((v) => !v); setPlaying(true); }} testId="pause-on-reaction" />
        </ChamberToolbar>
        <span className="ct-speed"><MiniSwitch ariaLabel="Speed" testId="speed" options={SPEEDS} value={speed} onChange={setSpeed} /></span>
      </div>
      <div className="ct-mag" data-testid="mag">
        <CollisionViewer event={mag.ev} siteDeg={p.site} reduced={reduced} replayToken={mag.token} counts={snap.counts} pinned={mag.pinned} onPin={onPin}
          followText={playing ? "Following the latest collision (reactions first)." : "Paused."} />
      </div>
    </DashPanel>
  );

  const graph = (
    <>
      <DashPanel title="Energy distribution" ariaLabel="Maxwell-Boltzmann energy distribution" grow className="ct-g1" testId="mb-panel" data-hide={graphTab !== "mb" ? "true" : "false"}
        aside={
          <span className="ct-aside">
            <span className="ct-gtabs"><MiniSwitch ariaLabel="Graph shown" testId="graph-tab" value={graphTab} onChange={setGraphTab} options={[{ id: "mb", label: "Energy" }, { id: "rate", label: "Rate" }]} /></span>
            <button type="button" className="sd-btn sd-btn--sm" aria-pressed={zoom} onClick={() => setZoom((z) => !z)} data-testid="mb-zoom" title="Zoom the y-axis to see the tail beyond Ea">{zoom ? "Full view" : "Zoom tail"}</button>
            <button type="button" className="sd-btn sd-btn--sm" onClick={() => setPinnedCurve(pinnedCurve ? null : { T: p.T, ea: p.ea })} aria-pressed={!!pinnedCurve} data-testid="mb-pin" title="Keep this curve (dashed) to compare with the next temperature">{pinnedCurve ? `Unpin ${pinnedCurve.T} K` : "Pin curve"}</button>
          </span>
        }>
        <MbGraph T={p.T} ea={p.ea} eaEff={eaEff} catalyst={p.catalyst} hist={histView} nParticles={snap.n} measured={showHist ? measured : null} pinned={pinnedCurve} zoom={zoom} showHist={showHist} />
      </DashPanel>
      <DashPanel title="Rate of reaction" ariaLabel="Measured rate against time" grow className="ct-g2" testId="rate-panel" data-hide={graphTab !== "rate" ? "true" : "false"}
        aside={<span className="ct-aside"><span className="ct-gtabs"><MiniSwitch ariaLabel="Graph shown" testId="graph-tab-2" value={graphTab} onChange={setGraphTab} options={[{ id: "mb", label: "Energy" }, { id: "rate", label: "Rate" }]} /></span><MiniSwitch ariaLabel="Graph type" testId="rate-view" value={rateView} onChange={setRateView} options={[{ id: "rate", label: "Rate", title: "Rate against time" }, { id: "products", label: "Products", title: "Products formed; rate = gradient" }]} /></span>}>
        <RateGraph hist={snap.hist} marks={snap.marks} view={rateView} />
      </DashPanel>
    </>
  );

  const settings = (
    <>
      <PopoverSection title="Vessel">
        <SettingToggle id="ct-steady" label="Steady supply of reactants" hint="Products turn back into reactants after 1.5 s so the concentrations, and the rate, stay constant. Off: reactants are used up." checked={p.steady} onChange={(v) => change({ steady: v }, "steady", v ? "steady supply" : "closed vessel")} testId="set-steady" />
        <SettingToggle id="ct-sites" label="Show reactive sites" hint="Yellow arc on each particle." checked={showSites} onChange={setShowSites} testId="set-sites" />
        <SettingToggle id="ct-energetic" label="Ring particles with E ≥ Ea" hint="Kinetic energy of a particle, not of a collision." checked={showEnergetic} onChange={setShowEnergetic} testId="set-energetic" />
        <SettingToggle id="ct-hist" label="Show vessel energies on the graph" hint="Bars: kinetic energies of the particles now in the vessel." checked={showHist} onChange={setShowHist} testId="set-hist" />
      </PopoverSection>
      <PopoverSection title="Speed">
        <MiniSwitch ariaLabel="Speed (settings)" testId="speed-settings" options={SPEEDS} value={speed} onChange={setSpeed} fill />
      </PopoverSection>
      <PopoverSection title="Repeatability">
        <SettingToggle id="ct-seed" label="Repeatable runs" hint={`Reset restarts the same random sequence (seed ${fixedSeed.current}).`} checked={repeatable} onChange={setRepeatable} testId="set-seed" />
      </PopoverSection>
      <PopoverSection title="About the model">
        <p className="sd-text">A thin slice of a 3-D gas: collisions and wall bounces are elastic; speeds follow the Maxwell–Boltzmann distribution at the chosen T. Time is simulated time. Ea values here (5–60 kJ/mol) are a demonstration scale so reactions are watchable.</p>
      </PopoverSection>
    </>
  );

  const detail = (
    <div className="ct-detail">
      <p><b>Rate</b> = successful collisions per second (simulated time), averaged over the last {RATE_WINDOW} s: {snap.succ} reactions so far. It is proportional to the gradient of the products graph, and noisy because collisions are random (±{sigma.toFixed(2)} s{"⁻¹"} now).</p>
      <p><b>Collision energy</b> is the kinetic energy along the line of centres. A collision reacts only if that is at least Ea <i>and</i> both reactive sites face each other (here {stericPct} % of contacts). Collisions with enough energy: about e<sup>{"−"}Ea/RT</sup> = {formatFraction(snap.arrhenius)} (Arrhenius factor).</p>
      <p><b>Shaded area</b> = exact fraction of molecules with kinetic energy of at least Ea (see the readout under the graph). It is a different quantity from the fraction of collisions, which favours faster molecules.</p>
          <ReactionProfile ea={p.ea} eaEff={eaEff} catalyst={p.catalyst} />
    </div>
  );

  return (
    <SimulationDashboard
      id="ct-workspace" role="region" ariaLabel="Collision theory investigation" testId="workspace"
      title="Collision Theory Visualizer"
      subtitle="Why concentration, surface area, temperature and a catalyst change the rate (R2.2)"
      subtitleLong="Why concentration, surface area, temperature and a catalyst change the rate of reaction (IB R2.2)"
      onReset={handleReset}
      graphShown={graphShown} onGraphToggle={() => setGraphShown((g) => !g)} graphId="ct-graph"
      settings={settings}
      tabs={<DashboardTabs segmented role="radio" tabs={SYSTEMS} value={p.system} onChange={(v) => change({ system: v }, "system", v === "solid" ? "solid A" : "A + B")} ariaLabel="Type of system" idPrefix="ct-sys" testId="system-tabs" />}
      controls={controls}
      chamber={chamber}
      graph={graph}
      live={<LiveStrip items={live1} ariaLabel="Measured values" />}
      predict={
        <HeaderPopover label="Predict" icon={null} placement="up" width={360} testId="predict-toggle" panelTestId="predict" small>
          <PredictPanel onSetup={setupScenario} onApply={applyScenario} resetToken={resetToken} />
        </HeaderPopover>
      }
      explain={<ExplainLine text={explainFor(explain.key, explain.dir)} details={detail} />}
    />
  );
}

function Lbl({ full, short }) {
  return <><span className="ct-l-full">{full}</span><span className="ct-l-short">{short}</span></>;
}

function labelFor(key, p) {
  switch (key) {
    case "T": return `T ${p.T} K`;
    case "n": return `n ${p.n}`;
    case "ea": return `Ea ${p.ea.toFixed(0)}`;
    case "catalyst": return p.catalyst ? "catalyst on" : "catalyst off";
    case "piece": return PIECE_NAMES[p.piece];
    case "site": return p.site >= 360 ? "any orientation" : `site ${p.site}°`;
    default: return key;
  }
}
