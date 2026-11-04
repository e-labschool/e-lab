import { useState } from "react";
import PredictStep from "./PredictStep.jsx";
import ConstructStep from "./ConstructStep.jsx";
import CheckStep from "./CheckStep.jsx";
import HintPanel from "./HintPanel.jsx";

function emptyAnswer(config) {
  return Object.fromEntries(config.subshellsDisplayOrder.map((s) => [`${s.n}-${s.l}`, 0]));
}

// The parent orchestrator remounts this component (via `key={atomicNumber}`)
// whenever a new element is selected, so all state below can simply
// initialize fresh per-mount — no reset effect needed.
export default function StudentFlow({ config }) {
  const [stage, setStage] = useState("predict"); // predict -> construct -> check
  const [answer, setAnswer] = useState(() => emptyAnswer(config));
  const [revealed, setRevealed] = useState(false);

  function handleReset() {
    setAnswer(emptyAnswer(config));
    setRevealed(false);
    setStage("construct");
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div>
        {stage === "predict" && <PredictStep config={config} onContinue={() => setStage("construct")} />}
        {stage === "construct" && (
          <ConstructStep
            config={config}
            answer={answer}
            onChange={(key, value) => setAnswer((a) => ({ ...a, [key]: value }))}
            onSubmit={() => setStage("check")}
          />
        )}
        {stage === "check" && (
          <CheckStep
            config={config}
            answer={answer}
            revealed={revealed}
            onRetry={handleReset}
            onReveal={() => setRevealed(true)}
          />
        )}
      </div>
      <div>
        <HintPanel config={config} />
      </div>
    </div>
  );
}
