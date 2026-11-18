import { useMemo, useState } from "react";
import StageFrame from "../StageFrame.jsx";
import { Choice, Pick, Caption, Fallback2D } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import Packet from "../../scene/Packet.jsx";
import { Balance, PAN_TOP_Y, panWidthFor } from "../../scene/Equipment.jsx";
import { useEasedText } from "../../scene/useEased.js";
import { packetLayout, layoutRow, BAG } from "../../engine/packetModel.js";
import { STAGE2_IDS, STAGE2_AMOUNTS, stage2Info, stage2MassChoices, optionLabel, labelOf, amountText, formulaOf } from "../../engine/labConfig.js";
import { fmtFixed } from "../../engine/numeric.js";

function BalanceScene({ id, packets, info, shell }) {
  const text = useEasedText(info.massG, (x) => fmtFixed(x + 1e-9, 2), shell.reduced);
  const row = layoutRow([packets.length], { pitch: 2.75 });
  return (
    <group>
      <Balance packets={packets.length || 1} text={text} unit="g" dark={shell.dark} />
      {packets.map((f, i) => <Packet key={i} substanceId={id} fraction={f} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} position={[row.xs[0][i], PAN_TOP_Y, -0.2]} showAmount={false}
        stickerMain={formulaOf(id)} stickerSub={`(${"s"})`} />)}
    </group>
  );
}

export default function Stage2({ shell }) {
  const [id, setId] = useState("Mg"); const [mode, setMode] = useState("m"); const [n, setN] = useState(1); const [massG, setMassG] = useState(25);
  const info = useMemo(() => stage2Info(id, { mode, n, massG }), [id, mode, n, massG]);
  const L = useMemo(() => packetLayout(info.n), [info.n]);
  const masses = stage2MassChoices(id); const massSel = masses.includes(massG) ? massG : masses[masses.length > 2 ? 2 : 0];
  const eff = mode === "n" && massSel !== massG ? stage2Info(id, { mode, n, massG: massSel }) : info;
  const L2 = mode === "n" && massSel !== massG ? packetLayout(eff.n) : L;
  const k = Math.max(1, L2.count); const W = panWidthFor(k) + 1.4;
  const bounds = { w: W, h: 4.8, cx: 0, cy: 2.15, depth: 2 };
  const fb = L2.packets.map((f) => ({ substanceId: id, fraction: f, formula: labelOf(id), text: amountText(f) }));
  return (
    <StageFrame stage={2} title="Mass and Moles"
      controls={<>
        <Pick label="Substance" value={id} options={STAGE2_IDS.map((v) => ({ value: v, label: optionLabel(v) }))} onChange={setId} testId="ml-substance" />
        <Choice label="Calculate" value={mode} options={["m", "n"]} onChange={setMode} format={(v) => (v === "m" ? "mass from moles" : "moles from mass")} testId="ml-mode" />
        {mode === "m"
          ? <Choice label="Amount" value={n} options={STAGE2_AMOUNTS} onChange={setN} format={(v) => `${v} mol`} testId="ml-amount" />
          : <Choice label="Mass" value={massSel} options={masses} onChange={setMassG} format={(v) => `${v} g`} testId="ml-mass" />}
      </>}
      aside={<div className="ml-legend" data-testid="ml-molar-mass">Molar mass M = {fmtFixed(info.M, 2)} g mol⁻¹</div>}
      caption={<Caption line={eff.line} testId="ml-line" more={<><p>One packet is one mole of {formulaOf(id)} atoms, so a full packet has a mass of M grams; a half packet has half of that.</p><p>Drawn particle sizes are a design convention only (for example Ca is drawn a little larger than Mg): they do not decide molar mass.</p><p>Molar masses are the IB data booklet values.</p></>} />}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${eff.line}. Packets on a digital balance.`}
        fallback="WebGL is not available, so a 2D picture of the packets is shown." noGL={<Fallback2D items={fb} title={eff.line} note={`Balance reads ${eff.display} g.`} />}>
        <BalanceScene id={id} packets={L2.packets} info={eff} shell={shell} />
      </LabCanvas>
    </StageFrame>
  );
}
export { BAG };
