import { useEffect, useMemo, useRef, useState } from "react";
import { RotateCcw, Play, FastForward, Rewind, SkipForward, Undo2 } from "lucide-react";
import ZoneBench from "../../scene/ZoneBench.jsx";
import StageFrame from "../StageFrame.jsx";
import { CalcPanel, PredictCard, ReferencePanel, Segmented, ValueField } from "../parts.jsx";
import { ZoneControls, ApplyCard, AmountTable } from "./StageParts456.jsx";
import useZoneInteraction from "./useZoneInteraction.js";
import { packEntries } from "../benchEntries.js";
import { benchView, extentLines } from "../../engine/views456.js";
import { stage5Prediction, stage5Apply, stage6Prediction, stage6Apply } from "../../engine/tutor456.js";
import { planReaction } from "../../engine/rearrange.js";
import { limitingReagent } from "../../engine/limiting.js";
import { REACTION_LIST, getReaction } from "../../engine/reactions.js";
import { STAGE5_SCALES, S5_MAX_MOL, S6_MAX_MOL } from "../../engine/reactionBench.js";
import { getSubstance, molarMass } from "../../engine/substances.js";
import { fmtMol, fmtSig, fromQuanta } from "../../engine/numeric.js";
import { toUnicodeFormula } from "../../engine/formula.js";
import { atomColour } from "../../engine/particles.js";
import { detectWebGL } from "../../../shared-3d/webgl.js";

const TITLES = {
  5: { title: "Chemical Equations", purpose: "Use the balanced equation as a recipe in moles: coefficients give mole ratios, and atoms (not moles) are conserved." },
  6: { title: "Limiting Reagents", purpose: "Find which reactant runs out first, how much of the other is left over, and how much product forms." },
};
const nm = (id) => toUnicodeFormula(getSubstance(id).formula);

export default function ReactionStage({ stage, store, shell }) {
  const { state, dispatch, getState } = store; const { layout, reduced, dark, detail, onSlow, mode } = shell;
  const pre = `s${stage}`; const guided = mode === "guided";
  const view = benchView(state, stage); const sc = state.scenes[stage]; const d = sc.data; const r = view.reaction; const policy = state.policy;
  const run = d.lastRun; const canAnimate = useMemo(() => detectWebGL(), []); const live = useRef({ idle: null, runPlan: null, runNonce: 0, skipNonce: 0, speed: 1 });
  const [calcOpen, setCalcOpen] = useState(false); const [animating, setAnimating] = useState(false); const [slow, setSlow] = useState(false);
  const zoneQ = view.exact.zoneQ; const rs = r.species.filter((s) => s.side === "reactant"); const ps = r.species.filter((s) => s.side === "product");
  const stockQ = rs.reduce((a, s) => a + sc.packets.filter((p) => p.substanceId === s.id && p.role !== "product").reduce((x, p) => x + p.q, 0), 0);
  const zoneTotal = Object.values(zoneQ).reduce((a, b) => a + b, 0);

  // ---- prediction (the guided gate): stage 5 predicts the product amount, stage 6 predicts the limiting reagent
  const prediction = useMemo(() => (stage === 5 ? stage5Prediction(d.reactionId, d.initialQ) : stage6Prediction(d.reactionId, d.initialQ)), [stage, d.reactionId, d.initialQ]);
  const answered = prediction ? d.predictions[prediction.key] : null;
  const gated = guided && Boolean(prediction) && !answered && (stage === 6 ? zoneTotal + stockQ > 0 : true);
  const gateWhy = gated ? "Answer the prediction question first." : "";
  const ix = useZoneInteraction({ getState, dispatch, stage, vesselId: "zone", reduced, resetKey: shell.resetNonce, gate: () => gateWhy });
  useEffect(() => { shell.debug.current = { ...shell.debug.current, ix, live }; });

  // ---- the drawing reads these plans; it never decides an amount
  const zoneKey = JSON.stringify(zoneQ);
  const idle = useMemo(() => planReaction(d.reactionId, zoneQ, 0), [d.reactionId, zoneKey]); // eslint-disable-line react-hooks/exhaustive-deps
  const runPlan = useMemo(() => (run ? planReaction(run.reactionId, run.beforeQ, run.extentQ) : null), [run]);
  const seen = useRef(run?.id ?? 0);
  live.current.idle = idle; live.current.runPlan = runPlan; live.current.speed = slow ? 0.5 : 1; live.current.onPhase = (ph) => setAnimating(ph === "run");
  useEffect(() => { if (run && run.id !== seen.current) { seen.current = run.id; live.current.runPlan = runPlan; live.current.runNonce += 1; setAnimating(canAnimate && !reduced); } }, [run, runPlan, reduced, canAnimate]);
  useEffect(() => { const t = setTimeout(() => setAnimating(false), 9000); return () => clearTimeout(t); }, [run?.id]);
  const replay = () => { if (!run) return; live.current.runPlan = runPlan; live.current.runNonce += 1; setAnimating(canAnimate && !reduced); };
  const skip = () => { live.current.skipNonce += 1; };

  const act = (a) => { const res = dispatch({ ...a, stage }); ix.say(res.last.message, res.last.ok ? "ok" : "warn"); return res; };
  const cap = layout === "narrow" ? 4 : 5; const packets = sc.packets;
  const rows = useMemo(() => [packEntries(packets, cap)], [packets, cap]);
  const M = (id) => molarMass(id, policy);
  const packetLabel = (p) => `${fmtMol(fromQuanta(p.q))} mol ${nm(p.substanceId)}${p.role === "leftover" ? " (left over)" : p.role === "product" ? " (product)" : ""}`;
  const subLabel = (id) => { const p = packets.find((x) => x.id === id); if (!p) return null; const aqp = p.role === "product" && getSubstance(p.substanceId).kind === "aqueous-ionic"; return aqp ? "conceptual mole summary" : `${fmtSig(fromQuanta(p.q) * M(p.substanceId), 4)} g`; };
  const busy = animating || Boolean(ix.bench.current.pour);
  const hasStock = packets.some((p) => p.role !== "product" && p.q > 0);

  const overlay = (
    <div className="ml-overlay" data-ml-overlay>
      <div className="ml-chip-row">
        <span className="ml-pill ml4-overlay-pill" data-testid="ml-eq-pill">{view.equation}</span>
        {animating && <span className="ml-pill ml-pill--note" data-testid="ml-anim-pill">Representative molecules: atoms rearrange, none are created or lost</span>}
      </div>
    </div>
  );
  const workspace = (aspect) => (
    <ZoneBench ix={ix} kind="reaction" rows={rows} live={live} detail={detail} aspect={aspect} reduced={reduced} dark={dark} onSlow={onSlow} overlay={overlay} testId="ml-bench" subLabel={subLabel}
      ariaLabel={`3D reaction bench for ${r.name}: ${view.equationPlain}. ${view.text.zoneTotal}.`} fallbackNotice="The equation, amounts and calculation panel still work." />
  );

  // ---- controls ---------------------------------------------------------------------------------
  const eqChips = (
    <div className="ml4-eq" data-testid="ml-equation" aria-label={`Balanced equation: ${view.equation}`}>
      {rs.map((s, i) => <span key={s.id} className="ml4-eqterm">{i > 0 && <span className="ml4-arrow"> + </span>}<span className="ml4-sp">{s.coeff === 1 ? "" : s.coeff}{nm(s.id)}<small>({s.state})</small></span></span>)}
      <span className="ml4-arrow">→</span>
      {ps.map((s, i) => <span key={s.id} className="ml4-eqterm">{i > 0 && <span className="ml4-arrow"> + </span>}<span className="ml4-sp">{s.coeff === 1 ? "" : s.coeff}{nm(s.id)}<small>({s.state})</small></span></span>)}
    </div>
  );
  const els = [...new Set(r.species.flatMap((s) => Object.keys(getSubstance(s.id).composition)))];
  const legend = <div className="ml4-legend" data-testid="ml-legend">{els.map((e) => <span key={e}><i style={{ background: atomColour(e) }} />{e}</span>)}<span className="ml-muted">representative molecules, not 6.022 × 10²³</span></div>;
  const amountOf = (id) => fromQuanta(d.initialQ[id] ?? 0);
  const massOf = (id) => amountOf(id) * M(id);
  const inputs = (
    <div className="ml4-row" data-testid="ml-amounts">
      {rs.map((s) => {
        const inMass = stage === 6 && d.inputMode === "mass"; const val = inMass ? fmtSig(massOf(s.id), 5) : fmtMol(amountOf(s.id));
        const bad = d.error && d.error.startsWith(nm(s.id)) ? d.error : null;
        return <ValueField key={s.id} label={`${nm(s.id)}(${s.state})`} value={val} unit={inMass ? "g" : "mol"} testId={`ml-in-${s.id}`} error={bad} hint={inMass ? `= ${fmtMol(amountOf(s.id))} mol` : stage === 6 ? `= ${fmtSig(massOf(s.id), 4)} g` : `max ${S5_MAX_MOL}`}
          onCommit={(v) => act({ type: inMass ? `${pre}/setMass` : `${pre}/setAmount`, substanceId: s.id, value: v })} />;
      })}
    </div>
  );
  const scaleNow = d.scale ?? 1;
  const selector = (
    <div className="ml-field"><span className="ml-label" id={`ml${stage}-rx-l`}>Reaction</span>
      <div className="ml4-gases" role="radiogroup" aria-labelledby={`ml${stage}-rx-l`} data-testid="ml-reaction">
        {REACTION_LIST.map((x) => <button key={x.id} type="button" role="radio" aria-checked={d.reactionId === x.id} className="ml4-gas" disabled={busy} onClick={() => { ix.cancel(); act({ type: `${pre}/selectReaction`, reactionId: x.id }); }} data-testid={`ml-rx-${x.id}`}><b>{x.name}</b></button>)}
      </div></div>
  );
  const runBtn = (
    <div className="ml-pc-actions">
      {stage === 5 && <button type="button" className="sim-btn" disabled={busy || !hasStock} onClick={() => { if (gated) { ix.say(gateWhy, "warn"); return; } ix.cancel(); act({ type: "s5/loadAll" }); }} data-testid="ml-load-all" title="Accessible alternative to dragging: add every reactant packet to the zone">Add all to the zone</button>}
      {stage === 5 && <button type="button" className="sim-btn" disabled={busy || zoneTotal === 0} onClick={() => act({ type: "s5/unload" })} data-testid="ml-unload" title="Take the reactants back out of the zone">Take out</button>}
      <button type="button" className="sim-btn sim-btn--primary" disabled={busy} onClick={() => { if (gated) { ix.say(gateWhy, "warn"); return; } ix.cancel(); act({ type: `${pre}/run` }); }} data-testid="ml-run"><Play size={14} aria-hidden="true" /> Run the reaction</button>
      <button type="button" className="sim-btn" disabled={busy} onClick={() => { ix.cancel(); act({ type: `${pre}/again` }); }} data-testid="ml-again" title="Set the experiment up again with the same starting amounts"><Undo2 size={14} aria-hidden="true" /> Set up again</button>
      <button type="button" className="sim-btn ml-reset-stage" onClick={() => { ix.cancel(); dispatch({ type: "reset", stage }); ix.say("Reset to the starting state.", "ok"); }} data-testid="ml-reset-stage"><RotateCcw size={14} aria-hidden="true" /> Reset this stage</button>
    </div>
  );

  const apply = useMemo(() => (stage === 5 ? stage5Apply(d.reactionId) : stage6Apply(d.reactionId, d.initialQ, policy)), [stage, d.reactionId, d.initialQ, policy]);
  const lastLim = run ? limitingReagent(r, Object.fromEntries(rs.map((s) => [s.id, run.beforeQ[s.id] ?? 0]))) : null;
  const tbl = run && lastLim ? lastLim.perReactant.map((p) => ({ key: p.id, name: nm(p.id), tag: `(${r.species.find((s) => s.id === p.id).state})`, limiting: stage === 6 && p.limiting && !lastLim.tied, cells: [fmtMol(p.available), `−${fmtMol(p.consumed)}`, fmtMol(p.remaining)] })) : null;
  const tblP = run && lastLim ? lastLim.products.map((p) => ({ key: p.id, name: nm(p.id), tag: `(${r.species.find((s) => s.id === p.id).state})`, cells: ["0", `+${fmtMol(p.produced)}`, fmtMol(p.produced)] })) : null;
  const ionic = view.ionic; const hasAq = ps.some((s) => s.state === "aq");

  const controls = (
    <div className="ml-controls" data-testid={`ml-controls-${stage}`}>
      {guided && prediction && <section className="ml-card" aria-label="Prediction"><PredictCard prediction={prediction} answered={answered} onAnswer={(c) => dispatch({ type: "guide/answer", stage, key: prediction.key, choice: c.id, correct: c.correct })} /></section>}
      <section className="ml-card" aria-label="Reaction and amounts">
        {selector}
        {eqChips}
        {legend}
        {stage === 5 && (<>
          <Segmented label="Scale of the experiment" value={String(scaleNow)} onChange={(v) => { ix.cancel(); act({ type: "s5/setScale", factor: Number(v) }); }} testId="ml-scale" options={STAGE5_SCALES.map((f) => ({ value: String(f), label: `× ${f}`, title: `${f} times the equation's amounts: the same mole ratio` }))} />
          {mode === "free" && inputs}
        </>)}
        {stage === 6 && (<>
          <Segmented label="Enter reactant amounts as" value={d.inputMode} onChange={(v) => act({ type: "s6/setInputMode", mode: v })} testId="ml-inputmode" options={[{ value: "mol", label: "Moles (mol)" }, { value: "mass", label: "Masses (g)" }]} />
          {inputs}
          <p className="ml-hint">Up to {S6_MAX_MOL} mol of each reactant. Fractions such as 0.25 are fine; 0 means none of that reactant.</p>
        </>)}
        {d.error && !d.error.startsWith(rs.map((s) => nm(s.id)).find((n) => d.error.startsWith(n)) ?? "\u0000") && <p className="ml-error" role="alert">{d.error}</p>}
      </section>
      <section className="ml-card" aria-label="Packets and the reaction zone">
        <ZoneControls packets={packets} ix={ix} getLabel={packetLabel} zoneName="into the reaction zone" zoneVerb="Add to the zone" why={gateWhy} busy={busy} />
        <p className="ml-hint" data-testid="ml-zone-total">{view.text.zoneTotal}{stage === 6 ? " (Run adds every reactant packet to the zone for you.)" : ""}</p>
        {runBtn}
      </section>
      {run && (
        <section className="ml-card" aria-label="Result" data-testid="ml-result">
          <p className="ml4-fb" data-tone={run.partial ? "warn" : "ok"} role="status" data-testid="ml-run-feedback">{run.feedback.text}</p>
          {tbl && <AmountTable title="Amounts (mol)" cols={["Before", "Change", "After"]} rows={[...tbl, ...tblP]} testId="ml-result-table" note={stage === 6 && lastLim.tied ? "Both reactants run out together: neither is in excess." : stage === 6 ? "Highlighted: the limiting reagent." : null} />}
          <div className="ml4-run">
            <button type="button" className="sim-btn" disabled={busy || !run} onClick={replay} data-testid="ml-replay"><Play size={14} aria-hidden="true" /> Replay</button>
            <button type="button" className="sim-btn" aria-pressed={slow} onClick={() => setSlow((s) => !s)} data-testid="ml-slow">{slow ? <Rewind size={14} aria-hidden="true" /> : <FastForward size={14} aria-hidden="true" />} {slow ? "Normal speed" : "Slow motion"}</button>
            <button type="button" className="sim-btn" disabled={!animating} onClick={skip} data-testid="ml-skip"><SkipForward size={14} aria-hidden="true" /> Skip</button>
          </div>
          {hasAq && <p className="ml-hint" data-testid="ml-aq-note">{ionic}. A product packet is only a labelled conceptual mole summary: NaOH(aq) is Na⁺(aq) and OH⁻(aq) ions in water, and H₂ is a gas that bubbles away.</p>}
        </section>
      )}
      {stage === 6 && <YieldCard view={view} d={d} act={act} run={run} stage={stage} />}
      {guided && apply && <ApplyCard q={apply} unit={stage === 5 ? "mol" : "g"} how={apply.how} testId="ml-apply" />}
      <section className="ml-card" aria-label="Safety and realism" data-testid="ml-notes">
        <ul className="ml4-notes">{view.notes.map((n) => <li key={n}>{n}</li>)}<li>Real reactions depend on conditions (temperature, catalysts, rates) and some are hazardous: this lab models the mole ratios only.</li></ul>
      </section>
    </div>
  );

  // ---- calculation panel -------------------------------------------------------------------------
  const nowLim = view.exact.lim; const reveal = !guided || Boolean(answered) || Boolean(run);
  const lines = reveal ? extentLines(run ? lastLim : nowLim, r) : [];
  const ratioLine = rs.map((s) => `${s.coeff} mol ${nm(s.id)}`).join(" + ") + ` → ` + ps.map((s) => `${s.coeff} mol ${nm(s.id)}`).join(" + ");
  const summary = run ? `ξ = ${fmtMol(fromQuanta(run.extentQ))} mol: ${ps.map((s) => `${fmtMol(fromQuanta(run.afterQ[s.id] ?? 0))} mol ${nm(s.id)}`).join(", ")}` : `Mole ratio: ${ratioLine}`;
  const calc = (
    <CalcPanel open={calcOpen} onToggle={setCalcOpen} summary={summary}>
      {!reveal ? <p className="ml-muted" data-testid="ml-calc-locked">Answer the prediction first, then the working appears here.</p> : (
        <div className="ml-calc-grid">
          <div><h4>The equation as a mole recipe</h4><p data-testid="ml-recipe">{view.equation}</p><p>{ratioLine}</p><p className="ml-muted">Coefficients are mole ratios. Atoms are conserved; moles of substances are not.</p></div>
          <div><h4>{stage === 6 ? "Extent method" : "Working"}</h4><ol className="ml-lines" data-testid="ml-working">{lines.map((l) => <li key={l}>{l}</li>)}</ol></div>
          <div><h4>Masses</h4><ul className="ml-lines" data-testid="ml-masses">{view.text.rows.map((x) => <li key={x.id}>{x.name}: {fmtMol(x.n)} mol × {fmtSig(M(x.id), 4)} g mol⁻¹ = {fmtSig(x.mass, 4)} g</li>)}</ul>
            {stage === 6 && <p data-testid="ml-theoretical">Theoretical mass of {view.text.productName}: <b>{view.text.theoreticalMass}</b></p>}
            <p className="ml-muted">Using: the IB data booklet relative atomic masses (e.g. Mg = 24.31).</p></div>
        </div>
      )}
    </CalcPanel>
  );
  const status = ix.message.text || state.last?.message || (stage === 5 ? "Drag the reactant packets into the reaction zone (or press Add all to the zone), then run the reaction." : "Set the amount of each reactant, predict which runs out first, then run the reaction.");
  return <StageFrame layout={layout} stageTitle={TITLES[stage].title} stageBlurb={TITLES[stage].purpose} workspace={workspace} controls={controls} calc={calc} reference={<ReferencePanel compact={layout !== "wide"} />} status={status} statusTone={ix.message.tone === "warn" ? "warn" : "info"} />;
}

/** The OPTIONAL percentage-yield extension: it needs an ACTUAL yield supplied by the student; nothing is invented. */
function YieldCard({ view, d, act, run }) {
  const [open, setOpen] = useState(false);
  return (
    <section className="ml-card" aria-label="Percentage yield (optional extension)" data-testid="ml-yield">
      <button type="button" className="sim-btn" aria-expanded={open} onClick={() => setOpen((o) => !o)} data-testid="ml-yield-toggle">{open ? "Hide" : "Show"} percentage yield (optional extension)</button>
      {open && (<>
        <p className="ml-hint">The simulation always makes the theoretical yield. Percentage yield compares an ACTUAL mass you measured (or are given) with it.</p>
        <p data-testid="ml-yield-theo">Theoretical mass of {view.text.productName}: <b>{view.text.theoreticalMass}</b></p>
        <ValueField label="Actual yield" value={d.actual} unit="g" testId="ml-actual" onCommit={(v) => act({ type: "s6/setActual", value: v })} error={view.text.percentError} hint="type the actual mass, then Enter" width={110} />
        <p className="ml4-fb" data-testid="ml-yield-result" role="status">{view.text.percent ? `Percentage yield = ${view.text.percent}${view.text.percentWarn ? `. ${view.text.percentWarn}` : ""}` : "Enter an actual yield to see the percentage."}</p>
        {!run && <p className="ml-hint">Run the reaction first if you want the theoretical yield for the amounts you set.</p>}
      </>)}
    </section>
  );
}
