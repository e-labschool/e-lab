import { useMemo, useState } from "react";
import { Html } from "@react-three/drei";
import StageFrame from "../StageFrame.jsx";
import { Choice, Pick, Caption, Reference, Fallback2D } from "../parts.jsx";
import LabCanvas from "../../scene/LabCanvas.jsx";
import PacketRow from "../../scene/PacketRow.jsx";
import { packetLayout, layoutRow, BAG } from "../../engine/packetModel.js";
import { STAGE1_IDS, STAGE1_AMOUNTS, optionLabel, stage1Info, labelOf, amountText } from "../../engine/labConfig.js";

export default function Stage1({ shell }) {
  const [id, setId] = useState("H2O"); const [n, setN] = useState(1); const [zoom, setZoom] = useState(null);
  const L = useMemo(() => packetLayout(n), [n]);
  const row = useMemo(() => layoutRow([L.count]), [L.count]);
  const info = stage1Info(id, n);
  const items = L.packets.map((f, i) => ({ key: `p${i}`, substanceId: id, fraction: f, x: row.xs[0][i] }));
  const bounds = { w: Math.max(row.width + 0.6, 4.2), h: 4.5, cx: 0, cy: 1.15, depth: 1 };
  const focus = zoom ? { target: [zoom.x, 1.5, 0], distance: 6.2, key: `${zoom.k}` } : null;
  const fb = items.map((it) => ({ substanceId: id, fraction: it.fraction, formula: labelOf(id), text: amountText(it.fraction) }));
  return (
    <StageFrame stage={1} title="Explore the Mole"
      controls={<>
        <Pick label="Substance" value={id} options={STAGE1_IDS.map((v) => ({ value: v, label: optionLabel(v) }))} onChange={(v) => { setId(v); setZoom(null); }} testId="ml-substance" />
        <Choice label="Amount" value={n} options={STAGE1_AMOUNTS} onChange={(v) => { setN(v); setZoom(null); }} format={(v) => `${v} mol`} testId="ml-amount" />
      </>}
      caption={<Caption line={info.line} testId="ml-line" more={<><p>{info.composition}</p><p>{info.how}</p><p>Click a packet to zoom in; use the mouse wheel or + / − to zoom further.</p></>} />}
      aside={<Reference />}>
      <LabCanvas reflect={shell.detail !== "low"} dark={shell.dark} reduced={shell.reduced} bounds={bounds} focus={focus} onSlow={shell.onSlow} testId="ml-bench" ariaLabel={`${info.line}. Drag to rotate, scroll to zoom.`}
        fallback="WebGL is not available, so a 2D picture of the packets is shown." noGL={<Fallback2D items={fb} title={info.line} />} onPointerMissed={() => setZoom(null)}>
        <PacketRow items={items} detail={shell.detail} dark={shell.dark} reduced={shell.reduced} onClick={(it) => setZoom((z) => (z && z.x === it.x ? null : { x: it.x, k: Date.now() }))}
          total={L.count > 1 ? { x: 0, text: `Total ${amountText(n)}` } : undefined} />
        {zoom && <Html position={[zoom.x, 4.1, 0]} center><button type="button" className="ml-chip" onClick={() => setZoom(null)} data-testid="ml-zoom-out">Zoom out</button></Html>}
      </LabCanvas>
    </StageFrame>
  );
}
export { BAG };
