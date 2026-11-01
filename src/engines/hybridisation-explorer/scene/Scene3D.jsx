import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { renderCompactLatex } from "../../../lib/scientificContent.jsx";
import { getOrbitalGeometry, createMorphGeometry, updateMorphNormals, applyColors } from "./geometry.js";
import { GRID_LOW, signedField, lerpField, fillPositions } from "./orbitalField.js";
import { paletteFor, elementColor } from "./theme.js";
import { overlapRegions } from "./viewModel.js";
import { qFromUnitVectors, qFromBasis, normalize, cross } from "../model/vec.js";

// The r3f content of the Hybridisation Explorer. Rendering is on demand (frameloop="demand"): anything that animates calls
// invalidate() itself. Interaction is handled OUTSIDE the canvas (ViewerStage.jsx) through apiRef, so a drag on an atom can
// never start an orbit-camera rotation. Orbital surfaces are cached, shared geometries (see geometry.js).
// EDUCATIONAL representation: polar plots of the angular part of each orbital, not quantum-mechanical probability surfaces.

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const FOV = 40;
export function fitDistance(rad, aspect) {
  const vHalf = (FOV * Math.PI) / 360; const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return (rad * 1.06) / Math.sin(Math.min(vHalf, hHalf));
}
export const CAMERA_DIR = normalize([0.28, -1, 0.5]);

const Latex = ({ src }) => <span dangerouslySetInnerHTML={{ __html: renderCompactLatex(src) }} />;

function Tag({ position, latex, kind }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <span className={`hy-tag hy-tag--${kind}`}><Latex src={latex} /></span>
    </Html>
  );
}

const tagPosition = (s) => {
  const a = s.axis ?? [0, 0, 1]; const k = s.cls === "s" ? 0.7 : 1.08;
  return s.cls === "s" ? [0, 0, s.R * k] : [a[0] * s.R * k, a[1] * s.R * k, a[2] * s.R * k];
};

const OrbitalMesh = memo(function OrbitalMesh({ spec, theme, picks }) {
  const pal = paletteFor(theme, spec.palette);
  const geometry = useMemo(() => getOrbitalGeometry(spec.terms, spec.R, spec.palette, pal), [spec.terms, spec.R, spec.palette, pal]);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.55, metalness: 0 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => {
    material.opacity = spec.opacity; material.emissive.copy(spec.selected ? theme.colors.sel : new THREE.Color(0, 0, 0));
    material.emissiveIntensity = spec.selected ? 0.55 : spec.hovered ? 0.22 : 0; if (spec.hovered && !spec.selected) material.emissive.copy(theme.colors.sel);
    material.needsUpdate = false;
  }, [material, spec.opacity, spec.selected, spec.hovered, theme]);
  const meshRef = useRef(null);
  const ref = useCallback((m) => {
    if (meshRef.current) picks.current.delete(meshRef.current);
    meshRef.current = m;
    if (m) { m.userData.pick = { kind: "orbital", atomId: spec.atomId, orbId: spec.id, cls: spec.cls, key: spec.key }; picks.current.set(m, m.userData.pick); }
  }, [picks, spec.atomId, spec.id, spec.cls, spec.key]);
  return <mesh ref={ref} geometry={geometry} material={material} renderOrder={spec.cls === "s" ? 1 : spec.cls === "hybrid" ? 3 : 2} />;
});

/** n -> n morph: every source orbital turns into its hybrid (shape, colour and opacity interpolated); the surface is re-filled each frame. */
function MorphOrbital({ spec, theme, startMs, durMs, onDone }) {
  const { invalidate } = useThree();
  const geometry = useMemo(() => createMorphGeometry(GRID_LOW), []);
  const material = useMemo(() => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, roughness: 0.55, metalness: 0 }), []);
  const data = useMemo(() => {
    const from = signedField(spec.morphFrom.terms, spec.morphFrom.R, GRID_LOW); const to = signedField(spec.terms, spec.R, GRID_LOW);
    return { from, to, tmp: new Float32Array(from.length), pf: paletteFor(theme, spec.morphFrom.palette), pt: paletteFor(theme, spec.palette), pos: new THREE.Color(), neg: new THREE.Color(), done: false };
  }, [spec, theme]);
  useEffect(() => () => { geometry.dispose(); material.dispose(); }, [geometry, material]);
  useFrame(() => {
    const t = clamp01((performance.now() - startMs) / durMs); const e = ease(t);
    lerpField(data.from, data.to, e, data.tmp);
    fillPositions(GRID_LOW, data.tmp, geometry.attributes.position.array); geometry.attributes.position.needsUpdate = true;
    data.pos.copy(data.pf.pos).lerp(data.pt.pos, e); data.neg.copy(data.pf.neg).lerp(data.pt.neg, e);
    applyColors(GRID_LOW, data.tmp, data.pos, data.neg, geometry.attributes.color); updateMorphNormals(geometry, GRID_LOW);
    material.opacity = spec.morphFrom.opacity + (spec.opacity - spec.morphFrom.opacity) * e;
    if (t < 1) invalidate(); else if (!data.done) { data.done = true; onDone?.(); }
  });
  return <mesh geometry={geometry} material={material} renderOrder={3} frustumCulled={false} />;
}

const LonePairDots = ({ spec }) => {
  const a = spec.axis; const p = normalize(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])); const d = spec.R * 0.52;
  return [1, -1].map((s) => <mesh key={s} position={[a[0] * d + p[0] * 0.11 * s, a[1] * d + p[1] * 0.11 * s, a[2] * d + p[2] * 0.11 * s]} renderOrder={5}><sphereGeometry args={[0.055, 10, 8]} /><meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} /></mesh>);
};

const AtomView = memo(function AtomView({ atom, theme, picks, morph, onMorphDone }) {
  const color = elementColor(theme, atom.symbol);
  const nucRef = useRef(null);
  const setNuc = useCallback((m) => {
    if (nucRef.current) picks.current.delete(nucRef.current);
    nucRef.current = m; if (m) { m.userData.pick = { kind: "nucleus", atomId: atom.id }; picks.current.set(m, m.userData.pick); }
  }, [picks, atom.id]);
  return (
    <group position={atom.pos} quaternion={atom.quat}>
      {atom.orbitals.map((s) => (s.morphFrom && morph
        ? <MorphOrbital key={s.key} spec={s} theme={theme} startMs={morph.startMs} durMs={morph.durMs} onDone={onMorphDone} />
        : <OrbitalMesh key={s.key} spec={s} theme={theme} picks={picks} />))}
      {atom.orbitals.filter((s) => s.lonePair && !(s.morphFrom && morph)).map((s) => <LonePairDots key={`lp${s.key}`} spec={s} />)}
      {atom.orbitals.filter((s) => (s.selected || s.hovered || s.tag) && !(s.morphFrom && morph)).map((s) => <Tag key={`t${s.key}`} position={tagPosition(s)} latex={s.tagLatex ?? s.latex ?? "sp"} kind={s.selected ? "sel" : "hov"} />)}
      <mesh ref={setNuc} renderOrder={6}>
        <sphereGeometry args={[atom.active ? 0.19 : 0.16, 20, 14]} />
        <meshStandardMaterial color={color} roughness={0.4} emissive={atom.active ? theme.colors.sel : "#000000"} emissiveIntensity={atom.active ? 0.35 : 0} />
      </mesh>
    </group>
  );
});

const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
function OverlapView({ region, theme }) {
  const color = region.type === "sigma" ? theme.colors.sigma : theme.colors.pi;
  const material = useMemo(() => new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, roughness: 0.4 }), []);
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => { material.color.copy(color); material.emissive.copy(color); material.emissiveIntensity = 0.55; material.opacity = 0.62 * region.alpha; }, [material, color, region.alpha]);
  const q = useMemo(() => { const y = region.side; const z = cross(region.u, y); return qFromBasis(region.u, y, normalize(z)); }, [region]);
  return <mesh geometry={sphereGeo} material={material} position={region.center} quaternion={q} scale={[region.radii[0], region.radii[1], region.radii[2]]} renderOrder={7} />;
}

function RingView({ ring, theme }) {
  const q = useMemo(() => qFromUnitVectors([0, 0, 1], ring.normal), [ring.normal]);
  const mk = (c, o) => <meshStandardMaterial color={c} emissive={c} emissiveIntensity={0.35} transparent opacity={o} depthWrite={false} roughness={0.5} />;
  return [1, -1].map((s) => (
    <mesh key={s} position={[ring.center[0] + ring.normal[0] * ring.offset * s, ring.center[1] + ring.normal[1] * ring.offset * s, ring.center[2] + ring.normal[2] * ring.offset * s]} quaternion={q} renderOrder={4}>
      <torusGeometry args={[ring.radius, ring.tube, 20, 72]} />
      {mk(s > 0 ? theme.colors["ring-pos"] : theme.colors["ring-neg"], 0.5 * ring.alpha)}
    </mesh>
  ));
}

const AXES = [[1, 0, 0, "axis-x"], [0, 1, 0, "axis-y"], [0, 0, 1, "axis-z"]];
function Gizmo({ atom, theme, picks }) {
  const refs = useRef([]);
  useEffect(() => { const list = refs.current; list.forEach((m, i) => { if (m) { m.userData.pick = { kind: "ring", atomId: atom.id, axis: AXES[i].slice(0, 3) }; picks.current.set(m, m.userData.pick); } }); return () => list.forEach((m) => m && picks.current.delete(m)); }, [atom.id, picks]);
  return (
    <group position={atom.pos}>
      {AXES.map(([x, y, z, name], i) => (
        <mesh key={name} ref={(m) => { refs.current[i] = m; }} quaternion={qFromUnitVectors([0, 0, 1], [x, y, z])} renderOrder={8}>
          <torusGeometry args={[2.0, 0.045, 10, 72]} />
          <meshBasicMaterial color={theme.colors[name]} transparent opacity={0.9} depthTest={false} />
        </mesh>
      ))}
    </group>
  );
}

/** Camera: smoothly (re)frames the scene when `fit.key` changes; never fights the user otherwise. */
function Rig({ fit }) {
  const { camera, size, invalidate, controls } = useThree();
  const tween = useRef(null);
  const aspect = size.width / Math.max(1, size.height);
  useEffect(() => {
    const target = new THREE.Vector3(...fit.center); const dist = fitDistance(fit.radius, aspect);
    const dir = new THREE.Vector3(...(fit.keepDirection ? camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize().toArray() : CAMERA_DIR));
    tween.current = { t0: performance.now(), dur: fit.instant ? 1 : 500, fromT: (controls?.target ?? new THREE.Vector3()).clone(), fromD: camera.position.distanceTo(controls?.target ?? new THREE.Vector3()) || dist, toT: target, toD: dist, dir };
    invalidate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fit.key]);
  useFrame(() => {
    const tw = tween.current; if (!tw || !controls) return;
    const k = ease(clamp01((performance.now() - tw.t0) / tw.dur));
    const tgt = tw.fromT.clone().lerp(tw.toT, k); const d = tw.fromD + (tw.toD - tw.fromD) * k;
    controls.target.copy(tgt); camera.position.copy(tgt).addScaledVector(tw.dir, d); camera.lookAt(tgt); controls.update();
    if (k >= 1) tween.current = null; else invalidate();
  });
  return null;
}

function Bridge({ apiRef, picks }) {
  const { camera, gl, scene, invalidate, controls } = useThree();
  useEffect(() => {
    const rc = new THREE.Raycaster(); const ndc = new THREE.Vector2(); const v = new THREE.Vector3();
    const setNdc = (cx, cy) => { const r = gl.domElement.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1); rc.setFromCamera(ndc, camera); return r; };
    apiRef.current = {
      pick(cx, cy) {
        const r = gl.domElement.getBoundingClientRect(); if (cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return null;
        camera.updateMatrixWorld(); scene.updateMatrixWorld(); setNdc(cx, cy);
        const objs = [...picks.current.keys()].filter((o) => o.visible);
        const hits = rc.intersectObjects(objs, false); if (!hits.length) return null;
        const rank = (h) => { const p = h.object.userData.pick; return p.kind === "ring" ? 0 : p.kind === "nucleus" ? 1 : p.cls === "s" ? 3 : 2; };
        // prefer rings, then nuclei, then non-s orbitals (the big s sphere would otherwise swallow clicks on p / hybrid lobes)
        const best = hits.reduce((a, h) => (rank(h) < rank(a) || (rank(h) === rank(a) && h.distance < a.distance) ? h : a));
        return { ...best.object.userData.pick, point: best.point.toArray(), distance: best.distance };
      },
      ray(cx, cy) { camera.updateMatrixWorld(); setNdc(cx, cy); return { origin: rc.ray.origin.toArray(), dir: rc.ray.direction.toArray() }; },
      basis() { camera.updateMatrixWorld(); const m = camera.matrixWorld.elements; return { right: [m[0], m[1], m[2]], up: [m[4], m[5], m[6]], forward: [-m[8], -m[9], -m[10]] }; },
      project(x, y, z) { camera.updateMatrixWorld(); v.set(x, y, z).project(camera); const r = gl.domElement.getBoundingClientRect(); return { x: r.left + ((v.x + 1) / 2) * r.width, y: r.top + ((1 - v.y) / 2) * r.height, depth: v.z }; },
      zoom(f) { if (!controls) return; const t = controls.target; camera.position.sub(t).multiplyScalar(f).add(t); controls.update(); invalidate(); },
      cameraPosition: () => camera.position.toArray(),
      meshCount: () => picks.current.size,
    };
    return () => { apiRef.current = null; };
  }, [apiRef, picks, camera, gl, scene, invalidate, controls]);
  return null;
}

export default function SceneContent({ view, theme, apiRef, fit, onMorphDone }) {
  const picks = useRef(new Map());
  const regions = useMemo(() => (view.overlaps ?? []).flatMap((b) => overlapRegions(b, b.alpha ?? 1)), [view.overlaps]);
  const activeAtom = view.atoms.find((a) => a.active);
  return (
    <>
      <ambientLight intensity={0.85} />
      <directionalLight position={[3, -4, 6]} intensity={1.0} />
      <directionalLight position={[-4, 3, -2]} intensity={0.35} />
      <OrbitControls makeDefault enableDamping={false} enablePan minDistance={2.5} maxDistance={60} />
      <Rig fit={fit} />
      <Bridge apiRef={apiRef} picks={picks} />
      {view.atoms.map((a) => <AtomView key={a.id} atom={a} theme={theme} picks={picks} morph={view.morph && view.morph.atomIds.includes(a.id) ? view.morph : null} onMorphDone={onMorphDone} />)}
      {regions.map((r) => <OverlapView key={r.id} region={r} theme={theme} />)}
      {view.ring && <RingView ring={view.ring} theme={theme} />}
      {view.gizmo && activeAtom && <Gizmo atom={activeAtom} theme={theme} picks={picks} />}
      {view.atoms.length > 1 && view.atoms.map((a) => (
        <Html key={`lab${a.id}`} position={[a.pos[0], a.pos[1], a.pos[2] - 0.42]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}><span className={"hy-atom-tag" + (a.active ? " is-active" : "")}>{a.label}</span></Html>
      ))}
      {view.bondTags?.map((t) => <Tag key={t.id} position={t.position} latex={t.latex} kind={t.type} />)}
    </>
  );
}
