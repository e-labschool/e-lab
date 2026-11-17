import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import LabCanvas from "./LabCanvas.jsx";
import FallbackBench from "./FallbackBench.jsx";
import { PacketNode, GroupedStack, PourStream, PourDirector, PointerController, colourOfSubstance } from "./BenchScene.jsx";
import { benchLayout, fitDistance } from "./benchLayout.js";
import { BAG } from "./bagSpec.js";
import * as THREE from "three";
import { detectWebGL } from "../../shared-3d/webgl.js";

/** Places a translucent marker around one representative particle (inspect mode). */
function SlotMarker({ bench, packetId, slot }) {
  const mesh = useMemo(() => new THREE.Mesh(new THREE.SphereGeometry(1, 16, 12), new THREE.MeshBasicMaterial({ color: "#ffffff", transparent: true, opacity: 0.22, depthWrite: false, toneMapped: false })), []);
  useEffect(() => () => { mesh.geometry.dispose(); mesh.material.dispose(); }, [mesh]);
  useFrame(() => {
    const node = bench.current.nodes.get(packetId); const f = node?.obj.field; const c = slot != null && f ? f.slotCentre(slot) : null;
    if (!c) { mesh.visible = false; return; }
    if (mesh.parent !== node.obj.pivot) node.obj.pivot.add(mesh);
    mesh.visible = true; mesh.position.set(c[0], c[1], c[2]); mesh.scale.setScalar(f.radius * 1.35);
  });
  useEffect(() => () => { mesh.removeFromParent(); }, [mesh]);
  return null;
}

/** In inspect mode a click on a particle selects that representative entity. */
function InspectPicker({ bench, packetId, onPick, active }) {
  const { camera, gl } = useThree();
  useEffect(() => {
    if (!active) return undefined;
    const el = gl.domElement.closest("[data-s3d-stage]") ?? gl.domElement.parentElement; const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2(); let down = null;
    const d = (e) => { down = { x: e.clientX, y: e.clientY }; };
    const u = (e) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return; down = null;
      const node = bench.current.nodes.get(packetId); if (!node) return; const r = gl.domElement.getBoundingClientRect();
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera);
      node.obj.group.updateMatrixWorld(true);
      const meshes = [...node.obj.field.meshes.values()]; const hits = ray.intersectObjects(meshes, false);
      if (hits.length) { const slot = node.obj.field.slotOfHit(hits[0].object, hits[0].instanceId); if (slot >= 0) onPick(slot); }
    };
    el.addEventListener("pointerdown", d, true); el.addEventListener("pointerup", u);
    return () => { el.removeEventListener("pointerdown", d, true); el.removeEventListener("pointerup", u); };
  }, [active, bench, camera, gl, onPick, packetId]);
  return null;
}

/**
 * The shared 3D bench: lays out packets / grouped stacks in rows, frames them, runs the pour timeline and pointer input.
 * props:
 *   ix       result of usePacketInteraction
 *   rows     [[{ key, type:"bag", packet } | { key, type:"stack", substanceId, count }]]  (front row last)
 *   detail   "low" | "medium" | "high"      aspect  workspace width / height     reduced  prefers-reduced-motion
 *   focus    optional { target, distance, nonce } override (inspect mode)
 *   subLabel (packetId) => string | null     extras  in-canvas nodes (balance, molecule viewer)     overlay  DOM nodes
 *   inspect  { packetId, slot, onPick, active }
 */
export default function PacketBench({ ix, rows, detail, aspect, reduced, dark, inspectFocus, subLabel, extras, overlay, onSlow, ariaLabel, testId, fallbackNotice, inspect, pourHeadroom = true, extraWidth = 0, showCards = true, frontExtra = 0 }) {
  const keys = rows.map((r) => r.map((e) => e.key));
  const lay = useMemo(() => benchLayout(keys, { maxPerRow: aspect < 1 ? 3 : 6 }), [keys.map((k) => k.join(",")).join("|"), aspect]); // eslint-disable-line react-hooks/exhaustive-deps
  const posFor = (key) => ix.placement[key] ?? lay.pos[key] ?? { x: 0, z: 0 };
  const extent = useMemo(() => ({ ...lay.extent, maxX: lay.extent.maxX + extraWidth, minX: lay.extent.minX, maxZ: lay.extent.maxZ + frontExtra }), [lay, extraWidth, frontExtra]);
  const dist = fitDistance(extent, aspect, 32, { height: pourHeadroom ? 2.9 : BAG.height + 0.5 });
  const baseFocus = useMemo(() => ({ target: [(extent.minX + extent.maxX) / 2, pourHeadroom ? 1.2 : 1.05, (extent.minZ + extent.maxZ) / 2 * 0.6], distance: dist, nonce: 0 }), [extent, dist, pourHeadroom]);
  const ip = inspectFocus ? posFor(inspectFocus.packetId) : null;
  const focus = ip ? { target: [ip.x + 0.95, 1.15, ip.z], distance: aspect < 1 ? 7.4 : 5.6, nonce: 1 } : baseFocus;
  const entries = rows.flat();
  const layoutPos = useMemo(() => Object.fromEntries(entries.filter((e) => e.type === "bag").map((e) => [e.key, posFor(e.key)])), [rows, lay, ix.placement]); // eslint-disable-line react-hooks/exhaustive-deps
  const rowsRef = useRef(rows);
  useEffect(() => { rowsRef.current = rows; }, [rows]);
  const webgl = useMemo(() => detectWebGL(), []);
  if (!webgl) return <div className="ml-stage" data-testid={testId} data-webgl="0" aria-label={ariaLabel}><FallbackBench rows={rows} selectedId={ix.selectedId} onSelect={ix.select} notice={fallbackNotice} />{overlay}</div>;
  return (
    <LabCanvas
      dark={dark} focus={focus} reduced={reduced} ariaLabel={ariaLabel} testId={testId} onSlow={onSlow} fallback="The packets are shown in 2D instead."
      onKeyDownCapture={(e) => { if (e.key === "Escape") ix.cancel("Cancelled."); }}
      overlay={overlay}
    >
      {entries.map((e) => e.type === "bag" ? (
        <PacketNode key={e.key} item={e.packet} home={posFor(e.key)} bench={ix.bench} detail={detail} reduced={reduced} selected={ix.selectedId === e.packet.id} subLabel={subLabel?.(e.packet.id)} showCard={showCards} />
      ) : (
        <GroupedStack key={e.key} substanceId={e.substanceId} count={e.count} home={posFor(e.key)} detail={detail} />
      ))}
      <PourStream bench={ix.bench} colourOf={(id) => { const n = rowsRef.current.flat().find((x) => x.type === "bag" && x.packet.id === id); return n ? colourOfSubstance(n.packet.substanceId) : "#ffffff"; }} reduced={reduced} />
      <PourDirector bench={ix.bench} onCommit={ix.onCommit} onDone={ix.finishPour} />
      <PointerController bench={ix.bench} handlers={ix.handlers} layoutPos={layoutPos} />
      {inspect && <><SlotMarker bench={ix.bench} packetId={inspect.packetId} slot={inspect.slot} /><InspectPicker bench={ix.bench} packetId={inspect.packetId} onPick={inspect.onPick} active={inspect.active} /></>}
      {typeof extras === "function" ? extras({ posFor, lay, extent }) : extras}
    </LabCanvas>
  );
}

