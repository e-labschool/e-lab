import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import { BAG, groupsFor, buildPacketInstances } from "../engine/packetModel.js";
import { getSubstance } from "../engine/substances.js";
import { toUnicodeFormula } from "../engine/formula.js";
import { lookOf, SIZE_BOOST, BOND_COLOUR } from "./palette.js";
import { labelTexture, crinkleNormal, plasticAlpha, glareTexture, shadowTexture, zipTexture } from "./textures.js";

// THE shared premium one-mole packet.  Same geometry for every substance, amount and stage; only the fill (a prefix of the
// representative groups) and the fold of the empty plastic change.

const cache = new Map();
const instancesFor = (id, detail) => { const k = `${id}|${detail}`; if (!cache.has(k)) cache.set(k, buildPacketInstances(id, detail, { sizeBoost: SIZE_BOOST })); return cache.get(k); };
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const SEG_U = 34; const SEG_V = 44;

/** Front/back half-thickness at (u in -1..1, v in 0..1) for a pouch filled to height `fillTop` (scene units). */
export function surfaceZ(u, v, fillTop, fold) {
  const y = v * BAG.height; const au = Math.abs(u);
  const lateral = Math.pow(Math.max(0, 1 - Math.pow(au, 2.1)), 0.62);
  const bottom = smooth(0, 0.1, v) * 0.35 + 0.65 * smooth(0.02, 0.2, v);
  const filled = 1 - smooth(fillTop - 0.05, fillTop + 0.4, y);
  const half = BAG.depth / 2;
  const open = 0.035 + (half * 0.92 - 0.035) * filled;
  const wr = (Math.sin(u * 7.3 + y * 3.1) * 0.5 + Math.sin(u * 13.1 - y * 5.3 + 1.2) * 0.35 + Math.sin(y * 9.7 + u * 2.1) * 0.25) * (0.02 + 0.05 * (1 - filled) * fold);
  const top = 1 - 0.8 * smooth(0.86, 1, v); // the header is nearly flat
  return (open * lateral * bottom * top + wr * lateral) ;
}

function BagShell({ shown, ghost, dark }) {
  const front = useRef(); const back = useRef(); const roll = useRef();
  const normal = useMemo(() => crinkleNormal(), []);
  const amap = useMemo(() => { const t = plasticAlpha(); t.colorSpace = THREE.NoColorSpace; return t; }, []);
  const glare = useMemo(() => glareTexture(), []);
  useEffect(() => () => { normal.dispose(); amap.dispose(); glare.dispose(); }, [normal, amap, glare]);
  const geoF = useMemo(() => new THREE.PlaneGeometry(BAG.width, BAG.height, SEG_U, SEG_V), []);
  const geoB = useMemo(() => new THREE.PlaneGeometry(BAG.width, BAG.height, SEG_U, SEG_V), []);
  useEffect(() => () => { geoF.dispose(); geoB.dispose(); }, [geoF, geoB]);
  const state = useRef({ f: -1 });
  const apply = (f) => {
    const fillTop = BAG.pile.y0 + BAG.pile.h * f + 0.08; const fold = f < 0.999 ? 1 : 0.35;
    for (const [geo, sign] of [[geoF, 1], [geoB, -1]]) {
      const pos = geo.attributes.position;
      for (let j = 0; j <= SEG_V; j += 1) for (let i = 0; i <= SEG_U; i += 1) {
        const idx = j * (SEG_U + 1) + i; const u = (i / SEG_U) * 2 - 1; const v = 1 - j / SEG_V;
        pos.setXYZ(idx, u * BAG.width / 2 * (1 - 0.07 * Math.pow(1 - smooth(0, 0.5, v), 1.4) + 0.025 * smooth(0.12, 0.45, v) * (1 - smooth(0.6, 0.9, v))), v * BAG.height, sign * surfaceZ(u, v, fillTop, fold) * (sign > 0 ? 1 : 1));
      }
      pos.needsUpdate = true; geo.computeVertexNormals();
    }
    if (roll.current) { roll.current.visible = f > 0 && f < 0.999 || f === 0; roll.current.position.set(0, Math.min(BAG.zipY - 0.25, fillTop + 0.42), surfaceZ(0, (fillTop + 0.42) / BAG.height, fillTop, 1) + 0.03); }
  };
  useLayoutEffect(() => { apply(shown.current); state.current.f = shown.current; }, []); // eslint-disable-line
  useFrame(() => { if (Math.abs(shown.current - state.current.f) > 0.002) { state.current.f = shown.current; apply(shown.current); } });
  const matProps = { color: dark ? "#dbe6ff" : "#cddcf3", transparent: true, alphaMap: amap, opacity: ghost ? 0.25 : dark ? 0.55 : 0.6, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: dark ? 1.2 : 2.1, side: THREE.DoubleSide, depthWrite: false, normalMap: normal, normalScale: new THREE.Vector2(1.1, 1.1), ior: 1.45, specularIntensity: 1 };
  const seam = { color: "#ffffff", transparent: true, opacity: ghost ? 0.18 : 0.85, roughness: 0.1, depthWrite: false };
  return (
    <group>
      <mesh ref={back} geometry={geoB} renderOrder={1}><meshPhysicalMaterial {...matProps} /></mesh>
      <mesh ref={front} geometry={geoF} renderOrder={3}><meshPhysicalMaterial {...matProps} /></mesh>
      <mesh geometry={geoF} renderOrder={4}><meshBasicMaterial map={glare} transparent blending={THREE.CustomBlending} blendSrc={THREE.SrcAlphaFactor} blendDst={THREE.OneFactor} blendSrcAlpha={THREE.ZeroFactor} blendDstAlpha={THREE.OneFactor} opacity={ghost ? 0.15 : 0.6} depthWrite={false} toneMapped={false} side={THREE.FrontSide} /></mesh>
      {/* sealed edges and header ribs */}
      <mesh position={[0, BAG.height - 0.01, 0]} renderOrder={2}><boxGeometry args={[BAG.width, 0.04, 0.02]} /><meshPhysicalMaterial {...seam} /></mesh>
      {[0.14, 0.26, 0.38].map((d) => <mesh key={d} position={[0, BAG.height - d, 0.012]} renderOrder={2}><boxGeometry args={[BAG.width * 0.98, 0.012, 0.01]} /><meshPhysicalMaterial {...seam} opacity={seam.opacity * 0.55} /></mesh>)}
      <mesh position={[0, BAG.zipY + 0.055, 0.03]} renderOrder={4}><boxGeometry args={[BAG.width * 0.97, 0.052, 0.04]} /><meshStandardMaterial color="#d4202e" emissive="#d4202e" emissiveIntensity={0.3} roughness={0.3} transparent opacity={ghost ? 0.45 : 0.97} /></mesh>
      <mesh position={[0, BAG.zipY - 0.045, 0.03]} renderOrder={4}><boxGeometry args={[BAG.width * 0.97, 0.052, 0.04]} /><meshStandardMaterial color="#1f58d6" emissive="#1f58d6" emissiveIntensity={0.3} roughness={0.3} transparent opacity={ghost ? 0.45 : 0.97} /></mesh>
      {/* folded / rolled spare plastic (only visible when the pouch is not full) */}
      <mesh ref={roll} rotation={[0, 0, Math.PI / 2]} renderOrder={4}><cylinderGeometry args={[0.05, 0.05, BAG.width * 0.9, 16]} /><meshPhysicalMaterial color="#ffffff" transparent opacity={0.3} roughness={0.08} clearcoat={1} envMapIntensity={2} depthWrite={false} /></mesh>
    </group>
  );
}

function Particles({ substanceId, detail, target, ghost, reduced, shown }) {
  const inst = useMemo(() => instancesFor(substanceId, detail), [substanceId, detail]);
  const meshes = useRef({}); const bondRef = useRef();
  const sphere = useMemo(() => new THREE.SphereGeometry(1, detail === "low" ? 14 : 20, detail === "low" ? 10 : 14), [detail]);
  const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 8, 1, false), []);
  useEffect(() => () => { sphere.dispose(); cyl.dispose(); }, [sphere, cyl]);
  const mats = useMemo(() => {
    const o = {};
    for (const el of Object.keys(inst.atoms)) { const l = lookOf(el); o[el] = new THREE.MeshPhysicalMaterial({ color: l.color, metalness: l.metal, roughness: l.rough, clearcoat: l.metal > 0.5 ? 0.3 : 1, clearcoatRoughness: 0.06, envMapIntensity: l.metal > 0.5 ? 1.5 : l.pearl ? 0.85 : 1.15, iridescence: l.pearl ? 0.4 : 0, sheen: l.pearl ? 0.6 : 0, sheenColor: new THREE.Color("#ffffff"), transparent: ghost, opacity: ghost ? 0.4 : 1 }); }
    o.__bond = new THREE.MeshPhysicalMaterial({ color: BOND_COLOUR, metalness: 0.1, roughness: 0.35, transparent: ghost, opacity: ghost ? 0.4 : 1 });
    return o;
  }, [inst, ghost]);
  useEffect(() => () => Object.values(mats).forEach((m) => m.dispose()), [mats]);
  const setCounts = (f) => {
    const k = groupsFor(f, detail);
    for (const [el, a] of Object.entries(inst.atoms)) { const m = meshes.current[el]; if (m) m.count = a.prefix(k); }
    if (bondRef.current) bondRef.current.count = inst.bonds.prefix(k);
  };
  useLayoutEffect(() => {
    for (const [el, a] of Object.entries(inst.atoms)) { const m = meshes.current[el]; if (m) { m.instanceMatrix.array.set(a.matrices); m.instanceMatrix.needsUpdate = true; } }
    if (bondRef.current && inst.bonds.count) { bondRef.current.instanceMatrix.array.set(inst.bonds.matrices); bondRef.current.instanceMatrix.needsUpdate = true; }
    // per-marble tint variation (multiplies the material colour): a more varied, glossier handful
    const c = new THREE.Color(); let sd = 99;
    for (const [el, a] of Object.entries(inst.atoms)) { const m = meshes.current[el]; if (!m) continue; for (let i = 0; i < a.count; i += 1) { sd = (sd * 1664525 + 1013904223) >>> 0; const t = sd / 4294967296; c.setScalar(0.8 + 0.2 * t); m.setColorAt(i, c); } if (m.instanceColor) m.instanceColor.needsUpdate = true; }
    setCounts(shown.current);
  }, [inst, mats, sphere, cyl]); // eslint-disable-line
  useFrame((_, dt) => {
    const t = target; const s = shown.current;
    if (Math.abs(t - s) > 0.0005) { shown.current = reduced ? t : (Math.abs(t - s) < 0.004 ? t : s + (t - s) * Math.min(1, dt * 4.5)); setCounts(shown.current); }
  });
  return (
    <group>
      {Object.entries(inst.atoms).map(([el, a]) => (
        <instancedMesh key={el + detail + substanceId} ref={(m) => { meshes.current[el] = m; }} args={[sphere, mats[el], a.count]} frustumCulled={false} />
      ))}
      {inst.bonds.count > 0 && <instancedMesh key={"b" + substanceId + detail} ref={bondRef} args={[cyl, mats.__bond, inst.bonds.count]} frustumCulled={false} />}
    </group>
  );
}

let shadowTex = null;
/**
 * <Packet substanceId fraction position ... />  fraction = share of ONE mole (0..1).  `amountText` is shown under the bag.
 */
export default function Packet({ substanceId, fraction = 1, detail = "medium", position = [0, 0, 0], rotationY = 0, ghost = false, highlight = false, dark = false, reduced = false,
  stickerMain, stickerSub, amountText, amountSub, onClick, onPointerDown, groupRef, scale = 1, showLabel = true, showAmount = true, dimmed = false, lift = 0 }) {
  const shown = useRef(fraction);
  const s = getSubstance(substanceId);
  const main = stickerMain ?? `${toUnicodeFormula(s.formula)}`;
  const sub = stickerSub ?? (s.state ? `(${s.state})` : undefined);
  const tex = useMemo(() => labelTexture({ main: stickerSub === null ? main : main + (sub ?? ""), dark }), [main, sub, stickerSub, dark]);
  useEffect(() => () => tex.dispose(), [tex]);
  if (!shadowTex) shadowTex = shadowTexture();
  const stickerY = 2.0;
  const opa = ghost ? 0.5 : dimmed ? 0.55 : 1;
  return (
    <group ref={groupRef} position={position} rotation={[0, rotationY, 0]} scale={scale}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.004 - lift, 0]} renderOrder={0}><planeGeometry args={[BAG.width * 1.5, 1.7]} /><meshBasicMaterial map={shadowTex} transparent opacity={ghost ? 0.25 : 0.7} depthWrite={false} /></mesh>
      <group position={[0, lift, 0]} onClick={onClick} onPointerDown={onPointerDown}>
        <BagShell shown={shown} ghost={ghost || dimmed} dark={dark} />
        <Particles shown={shown} substanceId={substanceId} detail={detail} target={fraction} ghost={ghost || dimmed} reduced={reduced} />
        {showLabel && !ghost && <mesh position={[0, stickerY, surfaceZ(0, stickerY / BAG.height, BAG.pile.y0 + BAG.pile.h * Math.max(shown.current, fraction) + 0.08, 1) + 0.045]} renderOrder={5}><planeGeometry args={[1.12, 0.56]} /><meshBasicMaterial map={tex} transparent opacity={opa} depthWrite={false} toneMapped={false} /></mesh>}
        {highlight && <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}><ringGeometry args={[1.45, 1.62, 48]} /><meshBasicMaterial color="#6d7dff" transparent opacity={0.55} depthWrite={false} /></mesh>}
      </group>
      {showAmount && amountText && (
        <Html position={[0, -0.12, 0.55]} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
          <div className={"ml-qty" + (ghost ? " is-ghost" : "")} data-testid="ml-qty">{amountText}{amountSub && <small>{amountSub}</small>}</div>
        </Html>
      )}
    </group>
  );
}
export { zipTexture };
