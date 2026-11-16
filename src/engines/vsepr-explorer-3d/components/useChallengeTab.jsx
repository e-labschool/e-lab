import { useCallback, useMemo, useReducer, useState } from "react";
import ChallengePanel from "./ChallengePanel.jsx";
import ViewOptions from "./ViewOptions.jsx";
import useBuilderWorkspace, { useViewState } from "./useBuilderWorkspace.jsx";
import { classify, createHistory, historyReducer, modelFromPreset } from "../model/builder.js";
import { buildRound, checkPrediction, compareBuild, emptyAnswers, emptyScore, recordResult } from "../model/challenge.js";
import { PRESET_BY_ID } from "../model/presets.js";

const CHALLENGE_VIEW = { mode: "ed", showDomains: true, showLP: true, showRepulsion: false, showAngles: false };
const newSeed = () => (Math.floor(Math.random() * 0x7fffffff) + 1);

/**
 * Challenge tab = a scored round: choose a level, answer 8 randomly ordered molecules (Predict -> Build -> Observe -> Explain),
 * one optional hint per molecule (it hands over the two counting answers, which then do not score), running score and streak,
 * end-of-round summary.  Results stay in the session (nothing is stored or sent).  Has its OWN builder state (never touches Build).
 */
export default function useChallengeTab({ optionItems }) {
  const [phase, setPhase] = useState("start"); // start | play | done
  const [levelId, setLevelId] = useState("sl");
  const [ids, setIds] = useState([]);
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState("predict");
  const [answers, setAnswers] = useState(emptyAnswers);
  const [hinted, setHinted] = useState(false);
  const [result, setResult] = useState(null);
  const [score, setScore] = useState(emptyScore);
  const [recorded, setRecorded] = useState(false);
  const [showReal, setShowReal] = useState(false);
  const [hist, dispatch] = useReducer(historyReducer, undefined, createHistory);
  const viewState = useViewState(CHALLENGE_VIEW);
  const molecule = PRESET_BY_ID[ids[index] ?? "h2o"];
  const real = useMemo(() => historyReducer(createHistory(), { type: "load", ...modelFromPreset(molecule) }).present, [molecule]);
  const playing = phase === "play";
  const revealed = playing && (step === "observe" || step === "explain");
  const showingReal = revealed && showReal;
  const ws = useBuilderWorkspace({
    hist, dispatch, viewState, model: showingReal ? real : hist.present, resetKey: showingReal ? `real:${molecule.id}` : `mine:${hist.present.epoch}`, editable: !showingReal,
    lockedNote: "Showing the real molecule. Choose “My build” to edit your own model.", hint: "Optional: build your prediction here with the toolbox.",
    emptyHint: step === "predict" ? "Optional: build your prediction here while you think." : "Drag an atom here to start your model.", ariaLabel: "3D workspace for the challenge",
    onReset: () => viewState.reset(),
  });
  const mine = classify(hist.present);
  const built = mine.hasCentral && mine.n > 0;
  const setAnswer = useCallback((k, v) => setAnswers((a) => ({ ...a, [k]: v })), []);

  const resetMolecule = () => { setStep("predict"); setAnswers(emptyAnswers()); setHinted(false); setResult(null); setRecorded(false); setShowReal(false); dispatch({ type: "reset" }); };
  const start = (seed = newSeed()) => { setIds(buildRound(levelId, seed)); setIndex(0); setScore(emptyScore()); resetMolecule(); setPhase("play"); };
  const useHint = () => { setHinted(true); setAnswers((a) => ({ ...a, domains: String(molecule.domains), lonePairs: String(molecule.lonePairs) })); };
  const onCheck = () => {
    const r = checkPrediction(molecule, answers, { hinted }); setResult(r);
    if (!recorded) { setScore((s) => recordResult(s, molecule, r)); setRecorded(true); }
    setShowReal(true); setStep("observe");
  };
  const onNext = () => { if (index + 1 >= ids.length) { setPhase("done"); return; } setIndex(index + 1); resetMolecule(); };
  const toStart = () => { setPhase("start"); resetMolecule(); };
  const reset = () => { toStart(); setScore(emptyScore()); setIds([]); setIndex(0); viewState.reset(); };

  const buildSummary = built ? `Your model: ${mine.n} domains (${mine.b} bonding + ${mine.l} lone pair${mine.l === 1 ? "" : "s"}), ${mine.axe}.` : "Nothing built yet. You can also skip building and check.";
  const graph = (
    <div className="vx-side">
      <ChallengePanel
        phase={phase} levelId={levelId} setLevelId={setLevelId} onStart={() => start()} onPlayAgain={() => start()} onChangeLevel={toStart} score={score}
        molecule={molecule} step={step} setStep={setStep} answers={answers} setAnswer={setAnswer} result={result} comparison={compareBuild(molecule, mine)} buildSummary={buildSummary}
        hinted={hinted} onHint={useHint}
        showReal={showReal} setShowReal={setShowReal} builtAnything={built} onCheck={onCheck} onNext={onNext} onRetry={() => { setStep("predict"); setResult(null); setShowReal(false); }} index={index} total={ids.length}
        isLast={index + 1 >= ids.length}
      />
      <section className="vx-card vx-card--slim" aria-label="View options"><h3 className="vx-h">View options</h3><ViewOptions variant="chips" items={optionItems(viewState.view, viewState.patch)} /></section>
    </div>
  );
  const explain = phase === "start" ? "Choose a level and start a round of 8 molecules: predict, build, observe, explain."
    : phase === "done" ? "Round complete. See your score and the areas to revise."
      : step === "predict" ? "Predict first: count electron domains around the central atom, then choose the geometry." : step === "build" ? "Build the arrangement you predicted, or go straight to the check." : step === "observe" ? "Compare your prediction with the real molecule. Drag an atom, then release it." : `${molecule.display}: ${molecule.axe}, ${molecule.ed.toLowerCase()} domains, ${molecule.mg.toLowerCase()}.`;
  return { controls: ws.controls, chamber: ws.chamber, graph, explain, reset, step, phase };
}
