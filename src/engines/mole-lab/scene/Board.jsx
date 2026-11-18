import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import Packet from "./Packet.jsx";
import { Travelers } from "./Fx.jsx";
import { layoutRow, BAG } from "../engine/packetModel.js";
import { amountText, labelOf } from "../engine/labConfig.js";

export const ROW_H = 5.0;
/** Positions for the board: groups [{ key, kind, label, items }] left to right (or, `stacked`, one row per group from the top) with room for the arrow. */
export function boardLayout(groups, stacked = false) {
  if (stacked) {
    const rows = groups.filter((g) => g.items.length > 0).length; let r = -1;
    const pos = groups.map((g) => { if (!g.items.length) return []; r += 1; const lay = layoutRow([g.items.length], { gap: 2.5 }); return g.items.map((it, i) => ({ ...it, x: lay.xs[0][i], y: (rows - 1 - r) * ROW_H })); });
    const widths = groups.map((g) => (g.items.length ? layoutRow([g.items.length]).width : 0));
    const centres = groups.map((g, gi) => [0, pos[gi][0]?.y ?? 0]);
    return { pos, centres, width: Math.max(...widths, 1), height: rows * ROW_H, stacked: true };
  }
  const lay = layoutRow(groups.map((g) => g.items.length), { gap: 2.5 });
  const pos = groups.map((g, gi) => g.items.map((it, i) => ({ ...it, x: lay.xs[gi][i], y: 0 })));
  return { pos, centres: lay.centres.map((c) => [c, 0]), width: lay.width, height: ROW_H, stacked: false };
}

function Arrow({ x, y = 1.5, glow, down }) {
  const geo = useMemo(() => { const s = new THREE.Shape(); s.moveTo(-0.9, -0.22); s.lineTo(0.35, -0.22); s.lineTo(0.35, -0.55); s.lineTo(1.0, 0); s.lineTo(0.35, 0.55); s.lineTo(0.35, 0.22); s.lineTo(-0.9, 0.22); s.closePath(); return new THREE.ShapeGeometry(s); }, []);
  useEffect(() => () => geo.dispose(), [geo]);
  const m = useRef();
  useFrame(({ clock }) => { if (m.current) m.current.opacity = 0.55 + (glow ? 0.35 * Math.sin(clock.getElapsedTime() * 5) : 0); });
  return <mesh geometry={geo} position={[x, y, 0.6]} rotation={[0, 0, down ? -Math.PI / 2 : 0]} renderOrder={6}><meshBasicMaterial ref={m} color="#5bb8ff" transparent opacity={0.7} toneMapped={false} depthWrite={false} /></mesh>;
}

/** The shared reaction board (Stages 5 and 6): packet groups with headings, an arrow, optional flying particles.  Every bag is the standard bag. */
export default function Board({ groups, detail, dark, reduced, progressRef, travel, running, flagY = 3.85, stacked = false, fillRate = 1.3 }) {
  const { pos, centres } = useMemo(() => boardLayout(groups, stacked), [groups, stacked]);
  const arrow = useMemo(() => { const a = pos[0]?.[pos[0].length - 1]; const b = pos[1]?.[0]; if (!a || !b) return null; return stacked ? { x: 0, y: (a.y + b.y) / 2 + 1.55 } : { x: (a.x + b.x) / 2, y: 1.5 }; }, [pos, stacked]);
  const arrowX = arrow?.x ?? 0;
  const travelers = useMemo(() => {
    if (!travel) return null; const from = []; const to = [];
    const src = pos[0] ?? []; const dst = (travel.toGroup != null ? pos[travel.toGroup] : pos[1]) ?? [];
    if (!src.length || !dst.length) return null;
    for (let i = 0; i < 60; i += 1) { const a = src[i % src.length]; const b = dst[i % dst.length]; from.push([a.x + ((i * 37) % 17 - 8) * 0.07, a.y + 1.2 + ((i * 13) % 11) * 0.1, 0.4]); to.push([b.x + ((i * 29) % 15 - 7) * 0.07, b.y + 1.1 + ((i * 7) % 11) * 0.1, 0.4]); }
    return { from, to };
  }, [pos, travel]);
  return (
    <group>
      {pos.map((items, gi) => (
        <group key={groups[gi].key}>
          {items.map((it) => (
            <Packet key={it.key} substanceId={it.substanceId} fraction={it.fraction} detail={detail} dark={dark} reduced={reduced} position={[it.x, it.y ?? 0, 0]} fillRate={fillRate} amountSub={it.tag} ghost={it.ghost} dimmed={it.dimmed} highlight={it.highlight}
              amountText={`${labelOf(it.substanceId).replace(/\(.*\)$/, "")} — ${amountText(it.amount ?? it.fraction)}`} />
          ))}
          {items.length > 0 && groups[gi].label && (
            <Html position={[centres[gi][0], (stacked ? centres[gi][1] + 3.55 : flagY), 0]} center zIndexRange={[18, 0]} style={{ pointerEvents: "none" }}><div className={`ml-flag is-${groups[gi].kind}`} data-testid={`ml-flag-${groups[gi].kind}`}>{groups[gi].label}</div></Html>
          )}
        </group>
      ))}
      {arrow && <Arrow x={arrow.x} y={arrow.y} glow={running} down={stacked} />}
      {travelers && progressRef && <Travelers from={travelers.from} to={travelers.to} colours={travel.colours} progressRef={progressRef} centre={[arrowX, arrow ? (stacked ? arrow.y : 2.2) : 2.2, 0.8]} />}
    </group>
  );
}
export { BAG };
