import { useEffect, useMemo, useRef } from "react";
import LabCanvas from "./LabCanvas.jsx";
import FallbackBench from "./FallbackBench.jsx";
import { PacketNode, GroupedStack, PourStream, PourDirector, PointerController, colourOfSubstance } from "./BenchScene.jsx";
import GasChamber from "./GasChamber.jsx";
import ReactionZone from "./ReactionZone.jsx";
import { benchLayout, fitDistance } from "./benchLayout.js";
import { detectWebGL } from "../../shared-3d/webgl.js";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

/** Test / verification aid: lets headless checks turn a bench point into a screen pixel (read-only). */
function ProjectionProbe({ bench }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const v = new THREE.Vector3();
    bench.current.project = (x, y, z) => { camera.updateMatrixWorld(); v.set(x, y, z).project(camera); const r = gl.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height }; };
    return () => { delete bench.current.project; };
  }, [bench, camera, gl]);
  return null;
}

// The Stage 4 / 5 / 6 bench: the SHARED packet rows (PacketNode, PourStream, PourDirector, PointerController) plus one apparatus
// that receives packets: the gas chamber (kind "gas") or the reaction zone (kind "reaction").  The apparatus registers a funnel
// pseudo-node under `zoneId`, so the shared pour animation and the drop-target glow work unchanged.  Nothing here writes chemistry.
const APP = { gas: { left: 2.9, right: 4.3, h: 5.8, anchors: [-2.15, -1.1, 0, 1], cy: 2.3 }, reaction: { left: 3.5, right: 3.5, h: 3.7, anchors: [-2.4, -1.2, 0, 1.2, 2.4], cy: 1.5 } };
export const ZONE_ID = { gas: "chamber", reaction: "zone" };

export default function ZoneBench({ ix, kind, rows, live, detail, aspect, reduced, dark, onSlow, overlay, testId, ariaLabel, fallbackNotice, subLabel, showCards = true }) {
  const app = APP[kind]; const zoneId = ZONE_ID[kind];
  const keys = rows.map((r) => r.map((e) => e.key));
  const portrait = aspect < 1.3;
  const lay = useMemo(() => benchLayout(keys, { maxPerRow: portrait ? 3 : 4 }), [keys.map((k) => k.join(",")).join("|"), portrait]); // eslint-disable-line react-hooks/exhaustive-deps
  const posFor = (key) => ix.placement[key] ?? lay.pos[key] ?? { x: 0, z: 0 };
  const hasPackets = rows.flat().length > 0;
  const packExt = hasPackets ? lay.extent : { minX: 0, maxX: 0, minZ: 0, maxZ: 0 };
  const home = useMemo(() => (portrait ? { x: 0, z: packExt.minZ - 3.2 } : { x: packExt.maxX + 0.8 + app.left, z: packExt.maxZ }), [portrait, packExt.maxX, packExt.minZ, packExt.maxZ, app.left]);
  const extent = useMemo(() => ({ minX: Math.min(packExt.minX, home.x - app.left), maxX: Math.max(packExt.maxX, home.x + app.right), minZ: Math.min(packExt.minZ, home.z - 1), maxZ: packExt.maxZ }), [packExt, home, app]);
  const dist = fitDistance(extent, aspect, 32, { height: app.h });
  const focus = useMemo(() => ({ target: [(extent.minX + extent.maxX) / 2, app.cy, ((extent.minZ + extent.maxZ) / 2) * 0.6], distance: dist, nonce: 0 }), [extent, dist, app.cy]);
  const entries = rows.flat();
  const layoutPos = useMemo(() => {
    const o = Object.fromEntries(entries.filter((e) => e.type === "bag").map((e) => [e.key, posFor(e.key)]));
    app.anchors.forEach((dx, i) => { o[`${zoneId}#${i}`] = { x: home.x + dx, z: home.z }; });
    return o;
  }, [rows, lay, ix.placement, home, kind]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsRef = useRef(rows); useEffect(() => { rowsRef.current = rows; }, [rows]);
  const webgl = useMemo(() => detectWebGL(), []);
  if (!webgl) return <div className="ml-stage" data-testid={testId} data-webgl="0" aria-label={ariaLabel}><FallbackBench rows={rows} selectedId={ix.selectedId} onSelect={ix.select} notice={fallbackNotice} />{overlay}</div>;
  return (
    <LabCanvas dark={dark} focus={focus} reduced={reduced} ariaLabel={ariaLabel} testId={testId} onSlow={onSlow} fallback="The packets are shown in 2D instead." onKeyDownCapture={(e) => { if (e.key === "Escape") ix.cancel("Cancelled."); }} overlay={overlay}>
      {entries.map((e) => e.type === "bag" ? (
        <PacketNode key={e.key} item={e.packet} home={posFor(e.key)} bench={ix.bench} detail={detail} reduced={reduced} selected={ix.selectedId === e.packet.id} subLabel={subLabel?.(e.packet.id)} showCard={showCards} />
      ) : (
        <GroupedStack key={e.key} substanceId={e.substanceId} count={e.count} home={posFor(e.key)} detail={detail} />
      ))}
      {kind === "gas" ? <GasChamber home={home} bench={ix.bench} live={live} zoneId={zoneId} reduced={reduced} dark={dark} /> : <ReactionZone home={home} bench={ix.bench} live={live} zoneId={zoneId} reduced={reduced} dark={dark} />}
      <PourStream bench={ix.bench} colourOf={(id) => { const n = rowsRef.current.flat().find((x) => x.type === "bag" && x.packet.id === id); return n ? colourOfSubstance(n.packet.substanceId) : "#ffffff"; }} reduced={reduced} />
      <PourDirector bench={ix.bench} onCommit={ix.onCommit} onDone={ix.finishPour} />
      <ProjectionProbe bench={ix.bench} />
      <PointerController bench={ix.bench} handlers={ix.handlers} layoutPos={layoutPos} />
    </LabCanvas>
  );
}
