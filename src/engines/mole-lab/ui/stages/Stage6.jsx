import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";
import StageFrame from "../StageFrame.jsx";
import { Pick, Caption, Fallback2D } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import Board, { boardLayout } from "../../scene/Board.jsx";
import { REACTION_LIST, DEFAULT_REACTION, STAGE6_AMOUNTS, stage5Board, stage6Defaults, stage6Result, labelOf, formulaOf } from "../../engine/labConfig.js";
import { atomColour } from "../../engine/particles.js";
import { getSubstance } from "../../engine/substances.js";
import { reactants as reactantsOf } from "../../engine/reactions.js";
import { packetLayout } from "../../engine/packetModel.js";
import { fmtMol } from "../../engine/numeric.js";
import { Play, RotateCcw } from "lucide-react";

function Driver({ ran, progressRef, reduced }) {
  useFrame((_, dt) => { const want = ran ? 1 : 0; const p = progressRef.current; progressRef.current = reduced ? want : Math.abs(want - p) < 0.002 ? want : p + Math.sign(want - p) * Math.min(Math.abs(want - p), dt * 0.4); });
  return null;
}
const expand = (id, n, role, extra = {}) => packetLayout(n).packets.map((f, i) => ({ key: `${role}-${id}-${i}`, substanceId: id, fraction: f, amount: f, id, ...extra }));

export default function Stage6({ shell }) {
  const [rid, setRid] = useState(DEFAULT_REACTION); const [amounts, setAmounts] = useState(() => stage6Defaults(DEFAULT_REACTION)); const [ran, setRan] = useState(false);
  const progress = useRef(0);
  const board = useMemo(() => stage5Board(rid), [rid]);
  const rs = useMemo(() => reactantsOf(board.reaction), [board]);
  useEffect(() => { setAmounts(stage6Defaults(rid)); setRan(false); progress.current = 0; }, [rid]);
  const res = useMemo(() => stage6Result(rid, amounts), [rid, amounts]);
  const setAmt = useCallback((id, v) => { setAmounts((a) => ({ ...a, [id]: v })); setRan(false); progress.current = 0; }, []);
  const groups = useMemo(() => {
    const r = rs.flatMap((s) => expand(s.id, amounts[s.id] ?? 0, "r", { dimmed: ran }));
    const g = [{ key: "r", kind: "reactants", label: "Reactants (initial amounts)", items: r }];
    if (ran) {
      g.push({ key: "p", kind: "products", label: "Products formed", items: res.products.flatMap((p) => (p.n > 0 ? expand(p.id, p.n, "p") : [])) });
      g.push({ key: "x", kind: "remaining", label: "Remaining unreacted", items: res.remaining.flatMap((p) => expand(p.id, p.n, "x")) });
    }
    return g;
  }, [rs, amounts, ran, res]);
  const lay = useMemo(() => boardLayout(groups), [groups]);
  const bounds = { w: Math.max(lay.width + 1.6, 9), h: 5.9, cx: 0, cy: 1.75, depth: 1 };
  const colours = useMemo(() => rs.map((s) => atomColour(Object.keys(getSubstance(s.id).composition)[0])), [rs]);
  const nm = (id) => formulaOf(id);
  const out = res.noReaction ? "A reactant is missing (0 mol): no reaction can occur." : null;
  const fb = groups.flatMap((g) => g.items).map((it) => ({ substanceId: it.substanceId, fraction: it.fraction, formula: labelOf(it.substanceId), text: `${fmtMol(it.amount)} mol` }));
  const stoich = rs.map((s) => `${s.coeff} mol ${nm(s.id)}`).concat(board.products.map((p) => `${p.n} mol ${nm(p.id)}`)).join(" : ");
  return (
    <StageFrame stage={6} title="Limiting Reagents"
      controls={<>
        <Pick label="Reaction" value={rid} options={REACTION_LIST.map((r) => ({ value: r.id, label: stage5Board(r.id).equation }))} onChange={setRid} testId="ml-reaction" wide />
        {rs.map((s) => <Pick key={s.id} label={`${nm(s.id)} (mol)`} value={String(amounts[s.id] ?? 0)} options={STAGE6_AMOUNTS.map((v) => ({ value: String(v), label: v.toFixed(2) }))} onChange={(v) => setAmt(s.id, Number(v))} testId={`ml-amt-${s.id}`} />)}
      </>}
      caption={<div className="ml-caption" data-testid="ml-caption-6">
        {ran && !out ? (
          <div className="ml-result" data-testid="ml-result" role="status">
            <span>Limiting reagent: <b>{res.limiting.map(nm).join(", ")}</b></span>
            <span>Excess reagent: <b>{res.excess.length ? res.excess.map(nm).join(", ") : "none"}</b></span>
            {res.products.map((p) => <span key={p.id}>Product formed: <b>{fmtMol(p.n)} mol {nm(p.id)}</b></span>)}
            {res.remaining.map((p) => <span key={p.id}>{nm(p.id)} remaining: <b>{fmtMol(p.n)} mol</b></span>)}
          </div>
        ) : <p className="ml-line" data-testid="ml-line" aria-live="polite">{out ?? `Stoichiometry: ${stoich}. Choose the starting amounts, then run the reaction.`}</p>}
        <div className="ml-actionbar">
          <button type="button" className="ml-btn is-primary" onClick={() => setRan(true)} disabled={ran || res.noReaction} data-testid="ml-run"><Play size={15} aria-hidden="true" /> Run Reaction</button>
          <button type="button" className="ml-btn" onClick={() => { setAmounts(stage6Defaults(rid)); setRan(false); progress.current = 0; }} data-testid="ml-reset-run"><RotateCcw size={15} aria-hidden="true" /> Reset</button>
          <details className="ml-more" data-testid="ml-more"><summary>Details</summary><div className="ml-more-body">
            <p>Divide each amount by its coefficient: the smallest value limits the reaction (the extent). Products = coefficient × extent; leftover = amount − coefficient × extent.</p>
            <p>Every packet holds one mole, so three moles are always three full packets; fractions are partly filled packets.</p></div></details>
        </div></div>}
      aside={<div className="ml-equation" data-testid="ml-equation" aria-label="Balanced equation">{board.equation}</div>}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${board.equation}. Limiting reagent example.`}
        fallback="WebGL is not available, so a 2D picture of the packets is shown." noGL={<Fallback2D items={fb} title={board.equation} note={ran ? "After the reaction." : "Before the reaction."} />}>
        <Driver ran={ran} progressRef={progress} reduced={shell.reduced} />
        <Board groups={groups} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} progressRef={progress} travel={ran ? { colours, toGroup: 1 } : null} running={ran && progress.current < 1} />
      </LabCanvas>
    </StageFrame>
  );
}
