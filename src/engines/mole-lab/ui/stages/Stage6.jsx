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
  useFrame((_, dt) => { const want = ran ? 1 : 0; const p = progressRef.current; progressRef.current = reduced ? want : Math.abs(want - p) < 0.002 ? want : p + Math.sign(want - p) * Math.min(Math.abs(want - p), Math.min(dt, globalThis.__ML_DT_MAX ?? 0.1) * 0.4); });
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
  const stacked = shell.layout === "narrow";
  const groups = useMemo(() => {
    const EPS = 1e-6; // sub-micromole residue is rounding noise: never draw a packet for it
    // Reactants stay on the board.  After Run, consumed packets EMPTY OUT (same bags, fraction -> 0) and the unreacted amount stays in place, marked "left over".
    const r = rs.flatMap((s) => {
      const start = packetLayout(amounts[s.id] ?? 0).packets;
      const rem = ran ? (res.remaining.find((x) => x.id === s.id)?.n ?? 0) : 0; const left = rem > EPS ? packetLayout(rem).packets : [];
      return start.map((f0, i) => { const f = ran ? (left[i] ?? 0) : f0; return { key: `r-${s.id}-${i}`, substanceId: s.id, fraction: f, amount: f, id: s.id, highlight: ran && f > 0, tag: ran && f > 0 ? "left over" : undefined }; });
    });
    // Products: truly empty bags (0.00 mol) before the run, then they fill up to the calculated amounts.
    const pr = res.products.filter((p) => p.n > EPS).flatMap((p) => packetLayout(p.n).packets.map((f1, i) => ({ key: `p-${p.id}-${i}`, substanceId: p.id, fraction: ran ? f1 : 0, amount: ran ? f1 : 0, id: p.id })));
    return [
      { key: "r", kind: "reactants", label: ran ? "Reactants (consumed ones empty out)" : "Reactants (initial amounts)", items: r },
      { key: "p", kind: "products", label: "Products formed", items: pr },
    ];
  }, [rs, amounts, ran, res]);
  const lay = useMemo(() => boardLayout(groups, stacked), [groups, stacked]);
  const bounds = stacked ? { w: Math.max(lay.width + 1.8, 8), h: lay.height + 1.2, cx: 0, cy: (lay.height - 0.7) / 2 + 0.5, depth: 1 } : { w: Math.max(lay.width + 1.8, 9), h: 5.9, cx: 0, cy: 1.75, depth: 1 };
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
        <Board groups={groups} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} progressRef={progress} stacked={stacked} travel={ran ? { colours, toGroup: 1 } : null} running={ran && progress.current < 1} />
      </LabCanvas>
    </StageFrame>
  );
}
