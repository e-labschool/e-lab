import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import { renderCompactLatex } from "../../../lib/scientificContent.jsx";
import { getOrbitalGeometry, acquireMorphGeometry, releaseMorphGeometry, updateMorphNormals, applyColors } from "./geometry.js";
import { GRID, fillField, fillPositions } from "./orbitalField.js";
import { paletteFor, elementColor } from "./theme.js";
import { DRAW_WIDTH } from "../model/orbitals.js";
import { makeSurface, lobeCentres, blendedSurfaceParams, morphParameter } from "../model/surface.js";
import { qFromUnitVectors, normalize, cross } from "../model/vec.js";

// The r3f content of the Hybridisation Explorer. Rendering is on demand (frameloop="demand"): anything that animates calls invalidate()
// itself, and ALL animation (fades, atom approach, overlap highlights, the Mix morph) runs inside the frame loop on refs: React is only
// re-rendered when the step / selection changes, never per frame, and no geometry is created per frame (orbital geometries are cached
// and shared, see geometry.js; the morph rewrites a preallocated buffer). Interaction is handled OUTSIDE the canvas (ViewerStage.jsx)
// through apiRef, so a drag on an atom can never start an orbit-camera rotation.
// EDUCATIONAL representation: polar plots of the angular part of each orbital, not quantum-mechanical probability surfaces.

const ease = (t) => t * t * (3 - 2 * t);
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const FOV = 40;
export function fitDistance(rad, aspect) {
  const vHalf = (FOV * Math.PI) / 360; const hHalf = Math.atan(Math.tan(vHalf) * aspect);
  return (rad * 1.06) / Math.sin(Math.min(vHalf, hHalf));
}
export const CAMERA_DIR = normalize([0.2, -0.62, 0.76]); // default view: above-front; no p axis or sp3 lobe points straight at the camera
export const MOLECULE_DIR = normalize([0.3, -0.72, 0.62]); // molecules lie in a plane: a lower view shows the pi lobes above and below it
export const clockOverride = { morph: null }; // test / debug hook: freezes the Mix morph at a progress 0..1 (null = real time)
const SRC_AXIS = { px: [1, 0, 0], py: [0, 1, 0], pz: [0, 0, 1] };
const dampK = (dt, tau) => 1 - Math.exp(-Math.min(0.05, Math.max(1 / 120, dt)) / tau);

const Latex = ({ src }) => <span dangerouslySetInnerHTML={{ __html: renderCompactLatex(src) }} />;

function Tag({ position, latex, kind }) {
  return (
    <Html position={position} center zIndexRange={[20, 0]} style={{ pointerEvents: "none" }}>
      <span className={`hy-tag hy-tag--${kind}`}><Latex src={latex} /></span>
    </Html>
  );
}
const D_DIR = { dz2: [0, 0, 1], "dx2-y2": [1, 0, 0], dxy: [Math.SQRT1_2, Math.SQRT1_2, 0], dxz: [Math.SQRT1_2, 0, Math.SQRT1_2], dyz: [0, Math.SQRT1_2, Math.SQRT1_2] };
const tagPosition = (s) => {
  if (s.cls === "s") return [0, 0, s.R * 1.12];
  const a = s.axis ?? D_DIR[s.kind] ?? [0, 0, 1]; const k = s.cls === "d" ? 1.12 : 1.1;
  return [a[0] * s.R * k, a[1] * s.R * k, a[2] * s.R * k];
};

// ---- materials ---------------------------------------------------------------------------------------------------------------
const makeLobeMaterial = () => new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, side: THREE.FrontSide, depthWrite: true, roughness: 0.42, metalness: 0, opacity: 0 });
function applyLook(material, spec) { // a gentle self-illumination only; the selection / hover highlight is the halo shell (OrbitalMesh), which never washes the colours out
  material.emissive.setRGB(0, 0, 0); material.emissiveIntensity = 0; material.userData.glow = spec.selected ? 1 : spec.hovered ? 0.55 : spec.glow ? 0.7 : 0;
}
const orderOf = (spec) => (spec.cls === "s" ? 1 : spec.cls === "hybrid" ? 3 : 2);

const OrbitalMesh = memo(function OrbitalMesh({ spec, theme, picks, tau, instant }) {
  const { invalidate } = useThree();
  const pal = paletteFor(theme, spec.palette);
  const geometry = useMemo(() => getOrbitalGeometry(spec.terms, spec.R, spec.K, spec.palette, pal, spec.axis, spec.width), [spec.terms, spec.R, spec.K, spec.palette, pal, spec.axis, spec.width]);
  const material = useMemo(() => { const m = makeLobeMaterial(); m.opacity = instant ? spec.opacity : 0; return m; }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const meshRef = useRef(null);
  useEffect(() => () => material.dispose(), [material]);
  const halo = useMemo(() => new THREE.MeshBasicMaterial({ color: theme.colors.sel, transparent: true, opacity: 0, side: THREE.BackSide, depthWrite: false }), [theme]);
  useEffect(() => () => halo.dispose(), [halo]);
  useLayoutEffect(() => { applyLook(material, spec); invalidate(); }, [material, spec, invalidate]);
  useFrame((_, dt) => {
    const m = meshRef.current; if (!m) return;
    const diff = spec.opacity - material.opacity;
    if (Math.abs(diff) > 0.004) { material.opacity += diff * dampK(dt, tau); invalidate(); } else material.opacity = spec.opacity;
    material.depthWrite = material.opacity > 0.55 && !spec.faded && spec.cls !== "s"; m.visible = material.opacity > 0.006;
    const hg = (material.userData.glow ?? 0) * Math.min(1, material.opacity * 1.6); halo.opacity = 0.55 * hg; if (haloRef.current) haloRef.current.visible = hg > 0.01 && spec.cls !== "s";
  });
  const haloRef = useRef(null);
  const ref = useCallback((m) => {
    if (meshRef.current) picks.current.delete(meshRef.current);
    meshRef.current = m;
    if (m) { m.userData.pick = { kind: "orbital", atomId: spec.atomId, orbId: spec.id, cls: spec.cls, key: spec.key }; picks.current.set(m, m.userData.pick); }
  }, [picks, spec.atomId, spec.id, spec.cls, spec.key]);
  return (
    <>
      <mesh ref={ref} geometry={geometry} material={material} renderOrder={orderOf(spec)} />
      <mesh ref={haloRef} geometry={geometry} material={halo} scale={1.07} renderOrder={orderOf(spec) - 0.5} visible={false} />
    </>
  );
});

/**
 * The Mix animation of ONE hybrid: the surface FUNCTION is interpolated, f_t = (1-t) * f_source + t * f_hybrid, so the lobes grow out of
 * the atomic orbitals (the s sphere acquires a direction, a p dumbbell loses its far lobe and gains s character on the near side, ...).
 * The radius, exponent and colours are blended with the same t; the buffer is rewritten in place each frame (no allocation).
 */
function MorphOrbital({ spec, theme, startMs, durMs, onDone }) {
  const { invalidate } = useThree();
  const geometry = useMemo(() => acquireMorphGeometry(), []);
  const material = useMemo(() => makeLobeMaterial(), []);
  const data = useMemo(() => {
    const src = { terms: spec.morphFrom.terms, R: spec.morphFrom.R, k: spec.morphFrom.K, cls: spec.morphFrom.cls }; const dst = { terms: spec.terms, R: spec.R, k: spec.K, cls: "hybrid" };
    return { src, dst, field: new Float32Array(GRID.V), tmp: new Float32Array(GRID.V), srcAxis: SRC_AXIS[spec.morphFrom.terms[0][0]] ?? null, dstAxis: spec.axis ?? [0, 0, 1], taper: { axis: [0, 0, 1], strength: 1, R: 1, width: 1 }, wSrc: spec.morphFrom.cls === "p" ? 1 : 1, pf: paletteFor(theme, spec.morphFrom.palette), pt: paletteFor(theme, spec.palette), pos: new THREE.Color(), neg: new THREE.Color(), done: false };
  }, [spec, theme]);
  useEffect(() => () => { releaseMorphGeometry(geometry); material.dispose(); }, [geometry, material]);
  useEffect(() => { invalidate(); }, [invalidate, startMs]);
  useFrame(() => {
    const p = clockOverride.morph !== null ? clockOverride.morph : clamp01((performance.now() - startMs) / durMs); const e = morphParameter(p);
    const prm = blendedSurfaceParams(data.src, data.dst, e);
    fillField(prm.terms, prm.R, prm.k, data.field, data.tmp);
    data.taper.strength = data.srcAxis ? 1 : e; data.taper.R = prm.R; data.taper.width = 1 + (DRAW_WIDTH.hybrid - 1) * e;
    if (data.srcAxis) { for (let i = 0; i < 3; i += 1) data.taper.axis[i] = data.srcAxis[i] * (1 - e) + data.dstAxis[i] * e; } else { for (let i = 0; i < 3; i += 1) data.taper.axis[i] = data.dstAxis[i]; }
    { const a = data.taper.axis; const l = Math.hypot(a[0], a[1], a[2]) || 1; a[0] /= l; a[1] /= l; a[2] /= l; }
    fillPositions(GRID, data.field, geometry.attributes.position.array, data.taper); geometry.attributes.position.needsUpdate = true;
    data.pos.copy(data.pf.pos).lerp(data.pt.pos, e); data.neg.copy(data.pf.neg).lerp(data.pt.neg, e);
    applyColors(GRID, data.field, data.pos, data.neg, geometry.attributes.color); updateMorphNormals(geometry);
    material.opacity = spec.morphFrom.opacity + (spec.opacity - spec.morphFrom.opacity) * e;
    const hold = 1 - clamp01(p / 0.14); // the selected atomic orbitals glow while they are highlighted, then the glow fades as they mix
    material.emissive.copy(theme.colors.sel); material.emissiveIntensity = 0.22 * hold;
    material.depthWrite = true;
    if (clockOverride.morph !== null) return;
    if (p < 1) invalidate(); else if (!data.done) { data.done = true; onDone?.(); }
  });
  return <mesh geometry={geometry} material={material} renderOrder={3} frustumCulled={false} />;
}

const LonePairDots = ({ spec }) => {
  const a = spec.axis; const p = normalize(Math.abs(a[2]) < 0.9 ? cross(a, [0, 0, 1]) : cross(a, [1, 0, 0])); const d = spec.R * 0.5;
  return [1, -1].map((s) => <mesh key={s} position={[a[0] * d + p[0] * 0.07 * s, a[1] * d + p[1] * 0.07 * s, a[2] * d + p[2] * 0.07 * s]} renderOrder={5}><sphereGeometry args={[0.04, 10, 8]} /><meshBasicMaterial color="#ffffff" depthTest={false} transparent opacity={0.95} /></mesh>);
};

/** Small "+" / "-" wavefunction-phase markers on the lobes (optional legend toggle). Phase is the sign of the wavefunction, not a charge. */
function PhaseMarks({ spec, atomOpacity }) {
  const marks = useMemo(() => {
    const surf = makeSurface(spec.terms, spec.cls, spec.R, spec.K);
    return lobeCentres(surf).slice(0, 6).map((c) => ({ pos: [c.dir[0] * c.r * 0.62, c.dir[1] * c.r * 0.62, c.dir[2] * c.r * 0.62], phase: c.phase }));
  }, [spec.terms, spec.cls, spec.R, spec.K]);
  if (spec.cls === "s" || atomOpacity < 0.3) return null;
  return marks.map((m, i) => (
    <Html key={i} position={m.pos} center zIndexRange={[12, 0]} style={{ pointerEvents: "none" }}><span className="hy-phase" data-phase={m.phase > 0 ? "+" : "-"} aria-hidden="true">{m.phase > 0 ? "+" : "−"}</span></Html>
  ));
}

const AtomView = memo(function AtomView({ atom, theme, picks, morph, onMorphDone, tau, smooth, showPhase }) {
  const { invalidate } = useThree();
  const color = elementColor(theme, atom.symbol);
  const nucRef = useRef(null); const groupRef = useRef(null); const target = useRef({ pos: atom.pos, quat: atom.quat });
  const [doneMorph, setDoneMorph] = useState(null);
  const morphing = !!morph && doneMorph !== morph.startMs;
  const justDone = !!morph && doneMorph === morph.startMs;
  const setNuc = useCallback((m) => {
    if (nucRef.current) picks.current.delete(nucRef.current);
    nucRef.current = m; if (m) { m.userData.pick = { kind: "nucleus", atomId: atom.id }; picks.current.set(m, m.userData.pick); }
  }, [picks, atom.id]);
  useLayoutEffect(() => {
    target.current = { pos: atom.pos, quat: atom.quat }; const g = groupRef.current; if (!g) return;
    if (!smooth || !g.userData.placed) { const p0 = smooth && atom.startPos ? atom.startPos : atom.pos; g.position.set(p0[0], p0[1], p0[2]); g.quaternion.set(atom.quat[0], atom.quat[1], atom.quat[2], atom.quat[3]); g.userData.placed = true; }
    invalidate();
  }, [atom.pos, atom.quat, atom.startPos, smooth, invalidate]);
  useFrame((_, dt) => {
    const g = groupRef.current; if (!g || !smooth) return;
    const t = target.current.pos; const k = dampK(dt, tau * 1.6);
    const dx = t[0] - g.position.x; const dy = t[1] - g.position.y; const dz = t[2] - g.position.z;
    if (Math.abs(dx) + Math.abs(dy) + Math.abs(dz) > 0.002) { g.position.x += dx * k; g.position.y += dy * k; g.position.z += dz * k; invalidate(); } else g.position.set(t[0], t[1], t[2]);
  });
  const done = useCallback(() => { setDoneMorph(morph?.startMs ?? null); onMorphDone?.(); }, [morph, onMorphDone]);
  const tags = atom.orbitals.filter((s) => (s.selected || s.hovered || s.tag) && !(s.morphFrom && morphing) && !s.faded);
  return (
    <group ref={groupRef}>
      {atom.orbitals.map((s) => (s.morphFrom && morphing
        ? <MorphOrbital key={s.key} spec={s} theme={theme} startMs={morph.startMs} durMs={morph.durMs} onDone={done} />
        : <OrbitalMesh key={s.key} spec={s} theme={theme} picks={picks} tau={tau} instant={justDone || !!atom.instant} />))}
      {atom.orbitals.filter((s) => s.lonePair && !(s.morphFrom && morphing) && !s.faded).map((s) => <LonePairDots key={`lp${s.key}`} spec={s} />)}
      {tags.map((s) => <Tag key={`t${s.key}`} position={tagPosition(s)} latex={s.tagLatex ?? s.latex ?? "sp"} kind={s.selected ? "sel" : "hov"} />)}
      {showPhase && !morphing && atom.orbitals.filter((s) => !s.faded).map((s) => <PhaseMarks key={`ph${s.key}`} spec={s} atomOpacity={s.opacity} />)}
      {atom.showLabel && atom.label && <Html position={[0, 0, -0.38]} center zIndexRange={[15, 0]} style={{ pointerEvents: "none" }}><span className={"hy-atom-tag" + (atom.active ? " is-active" : "")}>{atom.label}</span></Html>}
      <mesh ref={setNuc} renderOrder={6}>
        <sphereGeometry args={[atom.active ? 0.13 : 0.11, 20, 14]} />
        <meshStandardMaterial color={color} roughness={0.4} emissive={atom.active ? theme.colors.sel : "#000000"} emissiveIntensity={atom.active ? 0.2 : 0} />
      </mesh>
    </group>
  );
});

/** A sigma / pi tag that appears `delay` ms after the step started (so it never labels a bond that has not formed yet). */
function DelayedTag({ tag, startMs }) {
  const [on, setOn] = useState(!tag.delay);
  useEffect(() => { if (!tag.delay) return undefined; const left = tag.delay - (performance.now() - startMs); if (left <= 0) { setOn(true); return undefined; } const t = setTimeout(() => setOn(true), left); return () => clearTimeout(t); }, [tag.delay, startMs]);
  return on ? <Tag position={tag.position} latex={tag.latex} kind={tag.type} /> : null;
}

// ---- overlap highlight: ellipsoid fitted to the intersection of the two drawn lobes; size, brightness and opacity all follow the overlap measure ----
const sphereGeo = new THREE.SphereGeometry(1, 20, 14);
function OverlapView({ region, theme, tau, startMs }) {
  const { invalidate } = useThree();
  const color = region.type === "sigma" ? theme.colors.sigma : theme.colors.pi;
  const material = useMemo(() => new THREE.MeshStandardMaterial({ transparent: true, depthWrite: false, depthTest: false, roughness: 0.35, opacity: 0 }), []);
  const meshRef = useRef(null); const cur = useRef({ s: 0 });
  useEffect(() => () => material.dispose(), [material]);
  useLayoutEffect(() => { material.color.copy(color); material.emissive.copy(color); invalidate(); }, [material, color, region, invalidate]);
  useFrame((_, dt) => {
    const m = meshRef.current; if (!m) return;
    const waiting = region.delay && performance.now() - startMs < region.delay; // swells in only after the atoms have arrived
    const target = waiting ? 0 : region.strength * region.alpha; if (waiting) invalidate();
    const c = cur.current; const diff = target - c.s;
    if (Math.abs(diff) > 0.003) { c.s += diff * dampK(dt, tau); invalidate(); } else c.s = target;
    const s = c.s; m.visible = s > 0.01;
    const grow = (0.35 + 0.65 * s) * 0.82; // the lens swells with the overlap
    m.scale.set(Math.max(0.1, region.radii[0]) * grow, Math.max(0.1, region.radii[1]) * grow, Math.max(0.1, region.radii[2]) * grow);
    material.opacity = (region.formed ? 0.62 : 0.42) * Math.min(1, s * 1.4); material.emissiveIntensity = region.formed ? 0.9 : 0.7;
  });
  return <mesh ref={meshRef} geometry={sphereGeo} material={material} position={region.center} quaternion={region.quat} renderOrder={7} />;
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
          <torusGeometry args={[1.6, 0.04, 10, 72]} />
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
    const dir = new THREE.Vector3(...(fit.keepDirection ? camera.position.clone().sub(controls?.target ?? new THREE.Vector3()).normalize().toArray() : fit.dir ?? CAMERA_DIR));
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

/** Compiles every shader program once at mount (a hidden off-screen sample of each material kind) so the first animation never stalls on shader compilation. */
function WarmUp() {
  const { gl, scene, camera, invalidate } = useThree();
  useEffect(() => {
    const t = setTimeout(() => { try { performance.mark("hy-compile-start"); gl.compile(scene, camera); performance.mark("hy-compile-end"); } catch { /* compile is only an optimisation */ } invalidate(); }, 0);
    return () => clearTimeout(t);
  }, [gl, scene, camera, invalidate]);
  return (
    <group position={[0, 0, -4000]} visible>
      <mesh><sphereGeometry args={[0.01, 4, 3]} /><meshStandardMaterial vertexColors transparent opacity={0.5} /></mesh>
      <mesh><sphereGeometry args={[0.01, 4, 3]} /><meshStandardMaterial transparent opacity={0.5} emissive="#ffffff" depthWrite={false} depthTest={false} /></mesh>
      <mesh><sphereGeometry args={[0.01, 4, 3]} /><meshBasicMaterial transparent opacity={0.5} depthTest={false} /></mesh>
    </group>
  );
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
      freezeMorph(p) { clockOverride.morph = p; invalidate(); },
      meshCount: () => picks.current.size,
    };
    return () => { apiRef.current = null; };
  }, [apiRef, picks, camera, gl, scene, invalidate, controls]);
  return null;
}

export default function SceneContent({ view, theme, apiRef, fit, onMorphDone }) {
  const picks = useRef(new Map());
  const regions = view.regions ?? [];
  const activeAtom = view.atoms.find((a) => a.active);
  const tau = view.smooth ? 0.3 : 0.1;
  return (
    <>
      <ambientLight intensity={0.9} />
      <directionalLight position={[3, -4, 6]} intensity={1.0} />
      <directionalLight position={[-4, 3, -2]} intensity={0.4} />
      <OrbitControls makeDefault enableDamping={false} enablePan minDistance={2.5} maxDistance={60} />
      <Rig fit={fit} />
      <Bridge apiRef={apiRef} picks={picks} />
      <WarmUp />
      {view.atoms.map((a) => <AtomView key={a.id} atom={view.atoms.length > 1 ? { ...a, showLabel: true } : a} theme={theme} picks={picks} tau={tau} smooth={!!view.smooth} showPhase={!!view.showPhase} morph={view.morph && view.morph.atomIds.includes(a.id) ? view.morph : null} onMorphDone={onMorphDone} />)}
      {regions.map((r) => <OverlapView key={r.id} region={r} theme={theme} tau={view.smooth ? 0.28 : 0.08} startMs={view.stepStart ?? 0} />)}
      {view.ring && <RingView ring={view.ring} theme={theme} />}
      {view.gizmo && activeAtom && <Gizmo atom={activeAtom} theme={theme} picks={picks} />}
      {view.bondTags?.map((t) => <DelayedTag key={`${t.id}@${view.stepStart ?? 0}`} tag={t} startMs={view.stepStart ?? 0} />)}
    </>
  );
}
