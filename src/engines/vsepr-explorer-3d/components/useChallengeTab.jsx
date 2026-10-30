import { useCallback, useMemo, useReducer, useState } from "react";
import ChallengePanel from "./ChallengePanel.jsx";
import ViewOptions from "./ViewOptions.jsx";
import useBuilderWorkspace, { useViewState } from "./useBuilderWorkspace.jsx";
import { classify, createHistory, historyReducer, modelFromPreset } from "../model/builder.js";
import { CHALLENGE_ORDER, checkPrediction, compareBuild, emptyAnswers } from "../model/challenge.js";
import { PRESET_BY_ID } from "../model/presets.js";

const CHALLENGE_VIEW = { mode: "ed", showDomains: true, showLP: true, showRepulsion: false, showAngles: false };

/** Challenge tab: Predict -> Build -> Observe -> Explain. Has its OWN builder state (it never touches the Build tab). */
export default function useChallengeTab({ optionItems }) {
  const [index, setIndex] = useState(0);
  const [step, setStep] = useState("predict");
  const [answers, setAnswers] = useState(emptyAnswers);
  const [result, setResult] = useState(null);
  const [showReal, setShowReal] = useState(false);
  const [hist, dispatch] = useReducer(historyReducer, undefined, createHistory);
  const viewState = useViewState(CHALLENGE_VIEW);
  const molecule = PRESET_BY_ID[CHALLENGE_ORDER[index % CHALLENGE_ORDER.length]];
  const real = useMemo(() => historyReducer(createHistory(), { type: "load", ...modelFromPreset(molecule) }).present, [molecule]);
  const revealed = step === "observe" || step === "explain";
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
  const onCheck = () => { setResult(checkPrediction(molecule, answers)); setShowReal(true); setStep("observe"); };
  const restart = (nextIndex) => { setIndex(nextIndex); setStep("predict"); setAnswers(emptyAnswers()); setResult(null); setShowReal(false); dispatch({ type: "reset" }); };
  const buildSummary = built ? `Your model: ${mine.n} domains (${mine.b} bonding + ${mine.l} lone pair${mine.l === 1 ? "" : "s"}), ${mine.axe}.` : "Nothing built yet. You can also skip building and check.";
  const graph = (
    <div className="vx-side">
      <ChallengePanel
        molecule={molecule} step={step} setStep={setStep} answers={answers} setAnswer={setAnswer} result={result} comparison={compareBuild(molecule, mine)} buildSummary={buildSummary}
        showReal={showReal} setShowReal={setShowReal} builtAnything={built} onCheck={onCheck} onNext={() => restart(index + 1)} onRetry={() => { setStep("predict"); setResult(null); setShowReal(false); }} index={index % CHALLENGE_ORDER.length} total={CHALLENGE_ORDER.length}
      />
      <section className="vx-card vx-card--slim" aria-label="View options"><h3 className="vx-h">View options</h3><ViewOptions variant="chips" items={optionItems(viewState.view, viewState.patch)} /></section>
    </div>
  );
  const explain = step === "predict" ? "Predict first: count electron domains around the central atom, then choose the geometry." : step === "build" ? "Build the arrangement you predicted, or go straight to the check." : step === "observe" ? "Compare your prediction with the real molecule. Drag an atom, then release it." : `${molecule.display}: ${molecule.axe}, ${molecule.ed.toLowerCase()} domains, ${molecule.mg.toLowerCase()}.`;
  return { controls: ws.controls, chamber: ws.chamber, graph, explain, reset: () => { restart(0); viewState.reset(); }, step };
}
