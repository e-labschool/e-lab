import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import StageFrame from "../StageFrame.jsx";
import { Pick, Caption, Fallback2D } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import Board, { boardLayout } from "../../scene/Board.jsx";
import { REACTION_LIST, DEFAULT_REACTION, stage5Board, labelOf, formulaOf } from "../../engine/labConfig.js";
import { atomColour } from "../../engine/particles.js";
import { ionicNote, checkBalance } from "../../engine/reactions.js";
import { getSubstance } from "../../engine/substances.js";
import { Play, ListOrdered, RotateCcw } from "lucide-react";

// waypoints of the animation: 0 = start, 1 = reactants highlighted, 2 = particles gather / reactants used, 3 = products formed
const WAY = [0, 0.3, 0.62, 1];

/** Moves the animation progress toward the waypoint of the requested step and reports which step the picture is showing. */
function Driver({ target, progressRef, reduced, onShown }) {
  const last = useRef(0);
  useFrame((_, dt) => {
    const want = WAY[target]; const p = progressRef.current;
    const np = reduced ? want : Math.abs(want - p) < 0.002 ? want : p + Math.sign(want - p) * Math.min(Math.abs(want - p), dt * 0.22);
    progressRef.current = np;
    const shown = np >= 0.995 ? 3 : np >= 0.6 ? 2 : np >= 0.28 ? 1 : 0;
    if (shown !== last.current) { last.current = shown; onShown(shown); }
  });
  return null;
}

export default function Stage5({ shell }) {
  const [rid, setRid] = useState(DEFAULT_REACTION); const [target, setTarget] = useState(0); const [shown, setShown] = useState(0);
  const progress = useRef(0);
  const board = useMemo(() => stage5Board(rid), [rid]);
  useEffect(() => { setTarget(0); progress.current = 0; setShown(0); }, [rid]);
  const run = useCallback(() => setTarget(3), []);
  const step = useCallback(() => setTarget((t) => Math.min(3, t + 1)), []);
  const reset = useCallback(() => { setTarget(0); progress.current = 0; setShown(0); }, []);
  const expand = (list, role) => list.flatMap((s) => Array.from({ length: s.n }, (_, i) => ({ key: `${role}-${s.id}-${i}`, substanceId: s.id, amount: 1, fraction: 1, id: s.id })));
  const groups = useMemo(() => {
    const r = expand(board.reactants, "r").map((it) => ({ ...it, fraction: shown >= 2 ? 0 : 1, amount: shown >= 2 ? 0 : 1, highlight: shown === 1 }));
    const p = expand(board.products, "p").map((it) => ({ ...it, ghost: shown < 3, fraction: 1, amount: 1, highlight: false }));
    return [{ key: "r", kind: "reactants", label: "Reactants", items: r }, { key: "p", kind: "products", label: "Products", items: p }];
  }, [board, shown]);
  const lay = useMemo(() => boardLayout(groups), [groups]);
  const bounds = { w: lay.width + 1.8, h: 5.9, cx: 0, cy: 1.75, depth: 1 };
  const colours = useMemo(() => board.reactants.map((s) => atomColour(Object.keys(getSubstance(s.id).composition)[0])), [board]);
  const note = ionicNote(board.reaction); const bal = checkBalance(board.reaction).balanced;
  const fb = [...groups[0].items, ...groups[1].items].map((it) => ({ substanceId: it.substanceId, fraction: it.fraction, ghost: it.ghost, formula: labelOf(it.substanceId), text: "1.00 mol" }));
  return (
    <StageFrame stage={5} title="Chemical Equations"
      controls={<>
        <Pick label="Reaction" value={rid} options={REACTION_LIST.map((r) => ({ value: r.id, label: stage5Board(r.id).equation }))} onChange={setRid} testId="ml-reaction" wide />
      </>}
      caption={<div className="ml-caption" data-testid="ml-caption-5">
        <span className="ml-ratio" data-testid="ml-ratio">Mole ratio <b>{board.ratio}</b></span>
        <p className="ml-line" data-testid="ml-line" aria-live="polite">{board.sentence}</p>
        <div className="ml-actionbar">
          <button type="button" className="ml-btn is-primary" onClick={run} disabled={shown === 3 && target === 3} data-testid="ml-run"><Play size={15} aria-hidden="true" /> Run Reaction</button>
          <button type="button" className="ml-btn" onClick={step} disabled={target >= 3} data-testid="ml-step"><ListOrdered size={15} aria-hidden="true" /> Step</button>
          <button type="button" className="ml-btn" onClick={reset} data-testid="ml-reset-run"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
          <details className="ml-more" data-testid="ml-more"><summary>Details</summary><div className="ml-more-body">
            <p>The balanced equation ({bal ? "atoms and charge conserved" : "check balance"}) gives the mole ratio {board.ratio}: each packet is one mole, so the packets show the coefficients.</p>
            {note && <p>{note}. The product packet is a conceptual mole summary, not a dry solid.</p>}
            {board.reaction.notes?.map((t) => <p key={t}>{t}</p>)}
          </div></details>
        </div></div>}
      aside={<div className="ml-equation" data-testid="ml-equation" aria-label="Balanced equation">{board.equation}</div>}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${board.equation}. ${board.sentence}.`}
        fallback="WebGL is not available, so a 2D picture of the packets is shown." noGL={<Fallback2D items={fb} title={board.equation} note={board.sentence} />}>
        <Driver target={target} progressRef={progress} reduced={shell.reduced} onShown={setShown} />
        <Board groups={groups} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} progressRef={progress} travel={{ colours }} running={shown === 1 || shown === 2} />
      </LabCanvas>
    </StageFrame>
  );
}
export { formulaOf };
