import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { THREE } from "./sceneAssets.js";
import { ELEM } from "../model/molecules.js";
import { atomPosition } from "../model/particles.js";
import { displayRadii, ionColors } from "../../bonding-visualizer/model/lattice.js";

// The Heat & Phase Change cube. Atoms are InstancedMeshes (one per element), covalent bonds one InstancedMesh of cylinders, the
// "intermolecular attraction" lines one preallocated LineSegments. Nothing is created per frame. The particle dynamics themselves run
// in the React clock (see components/useHeatSim.js) so they also work without WebGL; this component only draws them.
const CUBE_VIEW = 5.4; // scene units across one cube
const ATOM_SCALE = 1.4; // cube atoms are drawn a little larger than in the two-molecule workspace (small objects in a big box)
const MAX_LINES = 260;

function CubeFrame({ L }) {
  const edges = useMemo(() => new THREE.EdgesGeometry(new THREE.BoxGeometry(L, L, L)), [L]);
  const faces = useMemo(() => {
    const mk = (pos, rot, op, col) => ({ pos, rot, op, col }); const h = L / 2;
    return [mk([0, -h, 0], [-Math.PI / 2, 0, 0], 0.16, "#6f9bf0"), mk([0, h, 0], [Math.PI / 2, 0, 0], 0.035, "#9db6e8"), mk([0, 0, -h], [0, 0, 0], 0.05, "#9db6e8"), mk([0, 0, h], [0, Math.PI, 0], 0.035, "#9db6e8"), mk([-h, 0, 0], [0, Math.PI / 2, 0], 0.05, "#9db6e8"), mk([h, 0, 0], [0, -Math.PI / 2, 0], 0.05, "#9db6e8")];
  }, [L]);
  useEffect(() => () => edges.dispose(), [edges]);
  return (
    <group data-testid="cube">
      <lineSegments geometry={edges} renderOrder={3}><lineBasicMaterial color="#8fa8dc" transparent opacity={0.75} depthWrite={false} /></lineSegments>
      {faces.map((f, i) => (<mesh key={i} position={f.pos} rotation={f.rot} renderOrder={1}><planeGeometry args={[L, L]} /><meshBasicMaterial color={f.col} transparent opacity={f.op} depthWrite={false} side={THREE.DoubleSide} /></mesh>))}
    </group>
  );
}

function SystemView({ item, offsetX, showLines }) {
  const sys = item.sys; const L = sys.L; const s = CUBE_VIEW / L; const n = sys.n;
  const parts = useMemo(() => {
    if (sys.ionic) { const r = displayRadii("Na", "Cl"); const col = ionColors("Na", "Cl"); const nn = sys.nn; return { kinds: [{ key: "Na", color: col.cation, radius: r.cation * nn * 1.9, atoms: [] }, { key: "Cl", color: col.anion, radius: r.anion * nn * 1.9, atoms: [] }], bonds: [] }; }
    const kinds = []; const idx = {}; sys.mol.atoms.forEach((a, k) => { if (idx[a.el] === undefined) { idx[a.el] = kinds.length; kinds.push({ key: a.el, color: ELEM[a.el].color, radius: ELEM[a.el].ball * ATOM_SCALE, atoms: [] }); } kinds[idx[a.el]].atoms.push(k); });
    const bonds = []; sys.mol.bonds.forEach(([a, b, order]) => { const offs = order === 3 ? [-1, 0, 1] : order === 2 ? [-0.5, 0.5] : [0]; offs.forEach((o) => bonds.push({ a, b, o, r: order === 1 ? 0.11 : 0.07 })); });
    return { kinds, bonds };
  }, [sys]);
  const atomRefs = useRef([]); const bondRef = useRef(null); const lineRef = useRef(null);
  const sphere = useMemo(() => new THREE.SphereGeometry(1, 20, 14), []); const cyl = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 10, 1), []);
  const mats = useMemo(() => parts.kinds.map((k) => new THREE.MeshStandardMaterial({ color: k.color, roughness: 0.4, metalness: 0.04 })), [parts]);
  const bondMat = useMemo(() => new THREE.MeshStandardMaterial({ color: "#c7cedd", roughness: 0.5 }), []);
  const lineGeo = useMemo(() => { const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.BufferAttribute(new Float32Array(MAX_LINES * 6), 3).setUsage(THREE.DynamicDrawUsage)); g.setDrawRange(0, 0); return g; }, []);
  const lineMat = useMemo(() => new THREE.LineBasicMaterial({ color: "#b7c8ee", transparent: true, opacity: 0.38, depthWrite: false }), []);
  useEffect(() => () => { sphere.dispose(); cyl.dispose(); mats.forEach((m) => m.dispose()); bondMat.dispose(); lineGeo.dispose(); lineMat.dispose(); }, [sphere, cyl, mats, bondMat, lineGeo, lineMat]);
  const tmp = useMemo(() => ({ m: new THREE.Matrix4(), q: new THREE.Quaternion(), p: new THREE.Vector3(), sc: new THREE.Vector3(), a: new THREE.Vector3(), b: new THREE.Vector3(), up: new THREE.Vector3(0, 1, 0), d: new THREE.Vector3() }), []);
  useFrame(() => {
    const out = [0, 0, 0];
    parts.kinds.forEach((kd, ki) => {
      const mesh = atomRefs.current[ki]; if (!mesh) return; let c = 0;
      if (sys.ionic) { for (let i = 0; i < n; i += 1) { if ((sys.charge[i] > 0) !== (ki === 0)) continue; tmp.m.makeScale(kd.radius, kd.radius, kd.radius).setPosition(sys.pos[3 * i], sys.pos[3 * i + 1], sys.pos[3 * i + 2]); mesh.setMatrixAt(c, tmp.m); c += 1; } }
      else for (let i = 0; i < n; i += 1) for (const k of kd.atoms) { atomPosition(sys, i, k, out); tmp.m.makeScale(kd.radius, kd.radius, kd.radius).setPosition(out[0], out[1], out[2]); mesh.setMatrixAt(c, tmp.m); c += 1; }
      mesh.count = c; mesh.instanceMatrix.needsUpdate = true;
    });
    const bm = bondRef.current;
    if (bm && parts.bonds.length) {
      let c = 0; const A = [0, 0, 0]; const B = [0, 0, 0];
      for (let i = 0; i < n; i += 1) for (const bd of parts.bonds) {
        atomPosition(sys, i, bd.a, A); atomPosition(sys, i, bd.b, B); tmp.a.set(A[0], A[1], A[2]); tmp.b.set(B[0], B[1], B[2]); tmp.d.copy(tmp.b).sub(tmp.a); const l = tmp.d.length() || 1e-6;
        // parallel sticks for double / triple bonds: offset perpendicular to the bond and to the vertical
        if (bd.o !== 0) { const perp = new THREE.Vector3().crossVectors(tmp.d, tmp.up); if (perp.lengthSq() < 1e-6) perp.set(1, 0, 0); perp.normalize().multiplyScalar(bd.o * 0.28); tmp.a.add(perp); }
        tmp.p.copy(tmp.a).addScaledVector(tmp.d, 0.5); tmp.q.setFromUnitVectors(tmp.up, tmp.d.multiplyScalar(1 / l)); tmp.sc.set(bd.r, l, bd.r); tmp.m.compose(tmp.p, tmp.q, tmp.sc); bm.setMatrixAt(c, tmp.m); c += 1;
      }
      bm.count = c; bm.instanceMatrix.needsUpdate = true;
    }
    // faint lines between neighbouring particles: "intermolecular attractions" (schematic). They fade as cohesion is released.
    const lp = lineGeo.attributes.position.array; let nl = 0;
    if (showLines) {
      const rc = sys.nn * 1.32;
      for (let i = 0; i < n && nl < MAX_LINES; i += 1) for (let j = i + 1; j < n && nl < MAX_LINES; j += 1) {
        if (Math.min(sys.c[i], sys.c[j]) < 0.5) continue; const dx = sys.pos[3 * j] - sys.pos[3 * i]; const dy = sys.pos[3 * j + 1] - sys.pos[3 * i + 1]; const dz = sys.pos[3 * j + 2] - sys.pos[3 * i + 2];
        if (dx * dx + dy * dy + dz * dz > rc * rc) continue; lp.set([sys.pos[3 * i], sys.pos[3 * i + 1], sys.pos[3 * i + 2], sys.pos[3 * j], sys.pos[3 * j + 1], sys.pos[3 * j + 2]], nl * 6); nl += 1;
      }
    }
    lineGeo.setDrawRange(0, nl * 2); lineGeo.attributes.position.needsUpdate = true; lineMat.opacity = 0.14 + 0.3 * (nl > 0 ? 1 : 0);
  });
  const counts = parts.kinds.map((k) => (sys.ionic ? n / 2 : k.atoms.length * n));
  return (
    <group position={[offsetX, 0, 0]} scale={s}>
      <CubeFrame L={L} />
      {parts.kinds.map((k, i) => (<instancedMesh key={k.key} ref={(m) => { atomRefs.current[i] = m; }} args={[sphere, mats[i], counts[i]]} frustumCulled={false} renderOrder={2} />))}
      {parts.bonds.length > 0 && <instancedMesh ref={bondRef} args={[cyl, bondMat, n * parts.bonds.length]} frustumCulled={false} renderOrder={2} />}
      <lineSegments ref={lineRef} geometry={lineGeo} material={lineMat} frustumCulled={false} renderOrder={2} />
    </group>
  );
}

export default function CubeScene({ simRef, apiRef, revision, compare }) {
  const { camera, gl, invalidate } = useThree(); const controlsRef = useRef(null);
  const items = simRef.current.items; void revision;
  useEffect(() => {
    apiRef.current = { invalidate, project(x, y, z) { const r = gl.domElement.getBoundingClientRect(); camera.updateMatrixWorld(); const v = new THREE.Vector3(x, y, z).project(camera); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height]; } };
    return () => { apiRef.current = null; };
  }, [apiRef, camera, gl, invalidate]);
  useEffect(() => { const d = compare ? 17 : 12.5; camera.position.set(0, 3.2, d); camera.lookAt(0, -0.3, 0); controlsRef.current?.update?.(); invalidate(); }, [compare, camera, invalidate]);
  useFrame(() => { /* drawing happens in SystemView; the React clock invalidates on every simulated tick */ });
  const gap = CUBE_VIEW * 0.62;
  return (
    <>
      <ambientLight intensity={0.9} /><directionalLight position={[6, 9, 8]} intensity={1.5} /><directionalLight position={[-6, -3, -5]} intensity={0.35} />
      <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.12} minDistance={7} maxDistance={30} rotateSpeed={0.8} target={[0, -0.3, 0]} />
      {items.map((it, i) => <SystemView key={`${it.id}`} item={it} offsetX={items.length > 1 ? (i === 0 ? -gap : gap) : 0} showLines />)}
    </>
  );
}
