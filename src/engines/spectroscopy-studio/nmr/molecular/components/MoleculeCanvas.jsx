import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { coordinatesFor, boundingRadius } from "../model/geometry.js";
import { visualsFor } from "./viewModel.js";
import { isSoftwareGL } from "./webgl.js";

// The three.js / react-three-fiber renderer of the molecule (lazy-loaded by MoleculeViewer; never imported in the WebGL-less path).
// Same rendering approach as the other explorers: atoms are spheres at their coordinates, bonds are cylinders that END at the atoms'
// centres (hidden inside the spheres), one shared group, OrbitControls for rotate / zoom. Interaction is through r3f pointer events.

const Y = new THREE.Vector3(0, 1, 0);
const FOV = 40;

function labelTexture(main, sub, dark, cache) {
  const key = `${main}|${sub}|${dark}`; if (cache.has(key)) return cache.get(key);
  const c = document.createElement("canvas"); c.width = 128; c.height = 128; const g = c.getContext("2d");
  if (g) {
    g.textAlign = "left"; g.textBaseline = "alphabetic"; g.fillStyle = dark ? "#0a1330" : "#ffffff";
    g.font = "800 72px system-ui, -apple-system, Segoe UI, sans-serif"; const wMain = g.measureText(main).width;
    g.font = "800 46px system-ui, -apple-system, Segoe UI, sans-serif"; const wSub = sub ? g.measureText(sub).width : 0;
    const x0 = 64 - (wMain + wSub) / 2;
    g.font = "800 72px system-ui, -apple-system, Segoe UI, sans-serif"; g.fillText(main, x0, 84);
    if (sub) { g.font = "800 46px system-ui, -apple-system, Segoe UI, sans-serif"; g.fillText(sub, x0 + wMain + 1, 104); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; cache.set(key, t); return t;
}

function Bond({ p, q, radius, color, opacity }) {
  const { pos, quat, len } = useMemo(() => {
    const a = new THREE.Vector3(...p); const b = new THREE.Vector3(...q); const d = b.clone().sub(a); const length = d.length();
    return { pos: a.clone().add(b).multiplyScalar(0.5), quat: new THREE.Quaternion().setFromUnitVectors(Y, d.normalize()), len: length };
  }, [p, q]);
  return (
    <mesh position={pos} quaternion={quat} raycast={() => null}>
      <cylinderGeometry args={[radius, radius, len, 14, 1]} />
      <meshStandardMaterial color={color} roughness={0.55} metalness={0.05} transparent={opacity < 1} opacity={opacity} />
    </mesh>
  );
}

function Scene({ molecule, ctx, showBonds, showLabels, onAtomClick, autoRotate, onReady, resetToken }) {
  const { camera, gl, size, invalidate } = useThree();
  const controls = useRef(null);
  const xyz = useMemo(() => coordinatesFor(molecule), [molecule]);
  const R = useMemo(() => boundingRadius(xyz) + 0.9, [xyz]);
  const vis = useMemo(() => visualsFor(molecule, ctx), [molecule, ctx]);
  const texCache = useMemo(() => new Map(), []);
  useEffect(() => () => { texCache.forEach((t) => t.dispose()); texCache.clear(); }, [texCache]);

  const fitDistance = useMemo(() => {
    const aspect = size.width / Math.max(1, size.height);
    const vf = (FOV * Math.PI) / 180; const hf = 2 * Math.atan(Math.tan(vf / 2) * aspect);
    return (R / Math.sin(Math.min(vf, hf) / 2)) * 0.86;
  }, [R, size.width, size.height]);

  const home = useRef({ dist: 8 }); home.current.dist = fitDistance;
  const resetCamera = (dist = home.current.dist) => {
    camera.position.set(0.62, 0.38, 0.9).normalize().multiplyScalar(dist); camera.up.set(0, 1, 0); camera.lookAt(0, 0, 0);
    camera.near = 0.1; camera.far = 200; camera.updateProjectionMatrix(); controls.current?.update?.(); invalidate();
  };
  // fit when the molecule or container size changes
  useEffect(() => { resetCamera(fitDistance); }, [molecule.id, resetToken]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { invalidate(); }, [fitDistance, invalidate]);

  useEffect(() => {
    const v = new THREE.Vector3();
    onReady?.({
      project(idx) { const r = gl.domElement.getBoundingClientRect(); camera.updateMatrixWorld(); v.set(...xyz[idx]).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height]; },
      zoom(f) { const d = camera.position.length(); const nd = Math.min(fitDistance * 3, Math.max(fitDistance * 0.35, d * f)); camera.position.multiplyScalar(nd / d); controls.current?.update?.(); invalidate(); },
      reset() { resetCamera(); },
      rotate(dy, dp) { const q = new THREE.Quaternion().setFromAxisAngle(Y, -dy); camera.position.applyQuaternion(q); const right = new THREE.Vector3().crossVectors(camera.position, Y).normalize(); const q2 = new THREE.Quaternion().setFromAxisAngle(right, -dp); const np = camera.position.clone().applyQuaternion(q2); if (Math.abs(np.clone().normalize().y) < 0.97) camera.position.copy(np); camera.lookAt(0, 0, 0); controls.current?.update?.(); invalidate(); },
      distance: () => camera.position.length(),
    });
  }, [onReady, gl, camera, xyz, invalidate, fitDistance]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { invalidate(); }, [ctx, showBonds, showLabels, molecule, invalidate]);

  const density = ctx.style === "density";
  // plane normal for each double bond (offset the two strands inside the bond plane)
  const bondGeoms = useMemo(() => molecule.bonds.map((b) => {
    const A = new THREE.Vector3(...xyz[b.a]); const B = new THREE.Vector3(...xyz[b.b]);
    if (b.order !== 2) return { b, strands: [[xyz[b.a], xyz[b.b]]] };
    const dir = B.clone().sub(A).normalize();
    const carbon = molecule.atoms[b.a].el === "C" ? b.a : b.b;
    const others = molecule.atoms[carbon].neighbours.filter((n) => n !== b.a && n !== b.b);
    let normal = new THREE.Vector3(0, 0, 1);
    if (others.length >= 2) { const C0 = new THREE.Vector3(...xyz[carbon]); normal = new THREE.Vector3(...xyz[others[0]]).sub(C0).cross(new THREE.Vector3(...xyz[others[1]]).sub(C0)).normalize(); }
    const off = normal.clone().cross(dir).normalize().multiplyScalar(0.085);
    return { b, strands: [[A.clone().add(off).toArray(), B.clone().add(off).toArray()], [A.clone().sub(off).toArray(), B.clone().sub(off).toArray()]] };
  }), [molecule, xyz]);

  return (
    <>
      <ambientLight intensity={1.05} />
      <directionalLight position={[4, 6, 5]} intensity={1.5} />
      <directionalLight position={[-5, -2, -4]} intensity={0.45} />
      <group>
        {showBonds && bondGeoms.map(({ b, strands }) => {
          const dimB = ctx.selectedEnvId && vis[b.a].dim && vis[b.b].dim;
          return strands.map((s, i) => <Bond key={`${b.a}-${b.b}-${i}`} p={s[0]} q={s[1]} radius={(b.order === 2 ? 0.05 : 0.075) * (density ? 0.6 : 1)} color="#aab6d6" opacity={dimB ? 0.4 : 1} />);
        })}
        {vis.map((v) => {
          const a = molecule.atoms[v.idx]; const env = v.envId ? molecule.environments.find((e) => e.id === v.envId) : null;
          const haloColor = v.carrier ? "#e8f0ff" : v.color;
          return (
            <group key={v.idx} position={xyz[v.idx]}>
              <mesh scale={v.radius} onClick={(e) => { e.stopPropagation(); onAtomClick?.(v.idx); }}
                onPointerOver={(e) => { e.stopPropagation(); gl.domElement.style.cursor = "pointer"; }} onPointerOut={() => { gl.domElement.style.cursor = ""; }} name={`atom-${v.idx}`}>
                <sphereGeometry args={[1, 36, 24]} />
                <meshStandardMaterial color={v.color} roughness={density ? 0.9 : 0.35} metalness={0.05} transparent={v.opacity < 1} opacity={v.opacity} depthWrite={!density}
                  emissive={v.selected ? v.color : "#000000"} emissiveIntensity={v.selected ? 0.45 : 0} />
              </mesh>
              {(v.selected || v.carrier) && (
                <mesh scale={v.radius * 1.5} raycast={() => null}>
                  <sphereGeometry args={[1, 24, 16]} />
                  <meshBasicMaterial color={haloColor} transparent opacity={v.carrier ? 0.14 : 0.3} depthWrite={false} side={THREE.BackSide} />
                </mesh>
              )}
              {v.coupled && (
                <mesh scale={v.radius * 1.55} raycast={() => null}>
                  <sphereGeometry args={[1, 14, 10]} />
                  <meshBasicMaterial color={env?.color ?? "#ffffff"} wireframe transparent opacity={0.85} />
                </mesh>
              )}
              {v.focus && (
                <mesh scale={v.radius * 1.75} raycast={() => null}>
                  <sphereGeometry args={[1, 24, 16]} />
                  <meshBasicMaterial color="#ffffff" transparent opacity={0.18} depthWrite={false} side={THREE.BackSide} />
                </mesh>
              )}
              {showLabels && (
                <sprite scale={[Math.max(0.5, v.radius * 1.9), Math.max(0.5, v.radius * 1.9), 1]} renderOrder={20} raycast={() => null}>
                  <spriteMaterial map={labelTexture(v.label.main, v.label.sub, !(a.el === "O" && !density), texCache)} transparent depthTest={false} depthWrite={false} />
                </sprite>
              )}
            </group>
          );
        })}
      </group>
      <OrbitControls ref={controls} makeDefault enablePan={false} enableDamping dampingFactor={0.12} minDistance={fitDistance * 0.35} maxDistance={fitDistance * 3} autoRotate={autoRotate} autoRotateSpeed={1.6} />
    </>
  );
}

export default function MoleculeCanvas(props) {
  const aa = useMemo(() => !isSoftwareGL(), []);
  return (
    <Canvas flat dpr={[1, 1.75]} frameloop={props.autoRotate ? "always" : "demand"} camera={{ fov: FOV, near: 0.1, far: 200, position: [3, 2, 5] }} gl={{ antialias: aa, alpha: true, powerPreference: "low-power" }}
      style={{ touchAction: "none" }} resize={{ scroll: false }} onPointerMissed={() => props.onBackgroundClick?.()}>
      <Scene {...props} />
    </Canvas>
  );
}
