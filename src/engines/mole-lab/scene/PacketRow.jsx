import Packet from "./Packet.jsx";
import { amountText, labelOf } from "../engine/labConfig.js";
import { Html } from "@react-three/drei";

/** A row of standard packets: items [{ key, substanceId, fraction, x, ghost, dimmed, highlight, fillOnly }] at bench height y.  Quantity label under each bag. */
export default function PacketRow({ items, y = 0, z = 0, detail, dark, reduced, onClick, showAmount = true, total }) {
  return (
    <group>
      {items.map((it) => (
        <Packet key={it.key} substanceId={it.substanceId} fraction={it.fraction} detail={detail} dark={dark} reduced={reduced} position={[it.x, y, z]} ghost={it.ghost} dimmed={it.dimmed} highlight={it.highlight}
          stickerMain={it.stickerMain} stickerSub={it.stickerSub} amountText={showAmount ? `${labelOf(it.substanceId).replace(/\(.*\)$/, "")} — ${amountText(it.fraction)}` : undefined} onClick={onClick ? () => onClick(it) : undefined} />
      ))}
      {total && (
        <Html position={[total.x, y - 0.95, 0.5]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}><div className="ml-qty is-total" data-testid="ml-total">{total.text}</div></Html>
      )}
    </group>
  );
}
