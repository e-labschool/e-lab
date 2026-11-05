import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Html, OrbitControls } from "@react-three/drei";
import { makeHeadGeometry, makeShaftGeometry, orient } from "../../nmr/scene/protonGeometry.js";
import { useFitZoom } from "../../nmr/scene/useFitZoom.js";
import { advanceVibClock, makeVibClock, poseFactor, publish } from "./vibClock.js";

// The 3D molecule of the IR workspace: ball-and-stick, every atom swinging about its equilibrium position along the REAL displacement pattern of the chosen
// normal mode (position_i(t) = rest_i + A sin(2 pi f t) d_i, the same phase for all atoms, so they move in step or in antiphase exactly as the mode says).
// Geometry is shared and instanced: one sphere mesh for the atoms, one for the equilibrium ghosts, one for the highlight halos, one cylinder mesh for the
// bonds and two meshes for the displacement arrows (shaft + cone head): 6 draw calls for any molecule. Everything per frame runs on refs, React does not render.
//   live.current = { disp: [[x,y,z] per atom, max |d| = 1] | null, hz, amp (A), gain, glow, highlight: number[] | null, paused, reduced, speed, key }
const SPHERE = new THREE.SphereGeometry(1, 32, 22);
const CYL = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
const ARROW_SHAFT = makeShaftGeometry(0.028, 1);
const ARROW_HEAD = makeHeadGeometry(0.085, 0.24);
const Y = new THREE.Vector3(0, 1, 0);
const ARROW_LEN = 0.85; const BOND_R = 0.075; const DIM = new THREE.Color("#3a4a78");

export default function MoleculeVibScene({ vis, live, arrows = true, ghost = true, labels = true }) {
  useFitZoom(1.3);
  const clock = useMemo(() => makeVibClock(), []);
  const atoms = useRef(); const ghosts = useRef(); const halos = useRef(); const bonds = useRef(); const shafts = useRef(); const heads = useRef(); const atomMat = useRef();
  const labelRefs = useRef([]);
  const o = useMemo(() => new THREE.Object3D(), []);
  const tmp = useMemo(() => ({ a: new THREE.Vector3(), b: new THREE.Vector3(), d: new THREE.Vector3(), q: new THREE.Quaternion(), c: new THREE.Color(), perp: new THREE.Vector3(), ref: new THREE.Vector3() }), []);
  const n = vis.atoms.length;
  const strands = useMemo(() => { const out = []; vis.bonds.forEach((b, bi) => { for (let k = 0; k < b.order; k += 1) out.push({ a: b.a, b: b.b, k, order: b.order, bi }); }); return out; }, [vis]);
  const lastKey = useRef("");
  const showLabel = useMemo(() => vis.atoms.map((a) => (n <= 6 ? true : a.el !== "H")), [vis, n]);

  useLayoutEffect(() => { for (const m of [atoms.current, ghosts.current, halos.current, bonds.current, shafts.current, heads.current]) if (m) m.frustumCulled = false; }, []);
  useEffect(() => () => { labelRefs.current = []; }, [vis]);

  useFrame((state, delta) => {
    const L = live.current; const A = atoms.current; const G = ghosts.current; const H = halos.current; const B = bonds.current; const S = shafts.current; const HD = heads.current;
    if (!A || !G || !H || !B || !S || !HD) return;
    advanceVibClock(clock, L, state.clock.elapsedTime, delta);
    const pose = L.disp ? poseFactor(clock, L.hz, L.reduced) : 0;
    const amp = (L.amp ?? 0.34) * (L.gain ?? 1) * pose;
    const hl = L.highlight && L.highlight.length ? new Set(L.highlight) : null;
    const key = `${vis.id}|${hl ? [...hl].join(",") : ""}`;
    const pos = vis.atoms.map((a, i) => { const d = L.disp ? L.disp[i] : [0, 0, 0]; return [a.pos[0] + amp * d[0], a.pos[1] + amp * d[1], a.pos[2] + amp * d[2]]; });
    for (let i = 0; i < n; i += 1) {
      const a = vis.atoms[i]; const on = !hl || hl.has(i);
      o.position.set(pos[i][0], pos[i][1], pos[i][2]); o.quaternion.identity(); o.scale.setScalar(a.style.radius * (on && hl ? 1.1 : 1)); o.updateMatrix(); A.setMatrixAt(i, o.matrix);
      o.position.set(a.pos[0], a.pos[1], a.pos[2]); o.scale.setScalar(ghost && L.disp ? a.style.radius * 1.02 : 0.0001); o.updateMatrix(); G.setMatrixAt(i, o.matrix);
      o.position.set(pos[i][0], pos[i][1], pos[i][2]); o.scale.setScalar(hl && hl.has(i) ? a.style.radius * 1.55 : 0.0001); o.updateMatrix(); H.setMatrixAt(i, o.matrix);
      const lab = labelRefs.current[i]; if (lab) lab.position.set(pos[i][0], pos[i][1], pos[i][2]);
    }
    A.count = n; G.count = n; H.count = n;
    if (key !== lastKey.current) {
      lastKey.current = key;
      for (let i = 0; i < n; i += 1) { tmp.c.set(vis.atoms[i].style.color); if (hl && !hl.has(i)) tmp.c.lerp(DIM, 0.62); A.setColorAt(i, tmp.c); tmp.c.set("#7dd3fc"); H.setColorAt(i, tmp.c); tmp.c.set(vis.atoms[i].style.color); G.setColorAt(i, tmp.c); }
      for (const m of [A, G, H]) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    if (atomMat.current) atomMat.current.emissiveIntensity = 0.12 + 0.55 * (L.glow ?? 0) * (0.6 + 0.4 * Math.abs(pose));
    // bonds: cylinders between the (moving) atom centres; multiple strands for double / triple bonds
    let bi = 0; let bondLen0 = 0;
    for (const s of strands) {
      tmp.a.set(pos[s.a][0], pos[s.a][1], pos[s.a][2]); tmp.b.set(pos[s.b][0], pos[s.b][1], pos[s.b][2]); tmp.d.copy(tmp.b).sub(tmp.a); const len = tmp.d.length(); tmp.d.normalize();
      if (bi === 0) bondLen0 = len;
      tmp.q.setFromUnitVectors(Y, tmp.d);
      let ox = 0; let oy = 0; let oz = 0;
      if (s.order > 1) { // offset strands in a plane perpendicular to the bond, using a fixed reference axis
        tmp.ref.set(0, 1, 0); if (Math.abs(tmp.d.dot(tmp.ref)) > 0.9) tmp.ref.set(1, 0, 0); tmp.perp.crossVectors(tmp.d, tmp.ref).normalize();
        const off = (s.k - (s.order - 1) / 2) * 0.17; ox = tmp.perp.x * off; oy = tmp.perp.y * off; oz = tmp.perp.z * off;
      }
      const dim = hl && !(hl.has(s.a) && hl.has(s.b)) ? 0.55 : 1;
      o.position.set((tmp.a.x + tmp.b.x) / 2 + ox, (tmp.a.y + tmp.b.y) / 2 + oy, (tmp.a.z + tmp.b.z) / 2 + oz); o.quaternion.copy(tmp.q);
      const r = BOND_R * (s.order > 1 ? 0.62 : 1) * dim; o.scale.set(r, Math.max(len, 0.0001), r); o.updateMatrix(); B.setMatrixAt(bi, o.matrix); bi += 1;
    }
    B.count = bi;
    // displacement arrows: the direction and relative size of each atom's displacement in this mode (the atom swings along it, to both sides)
    let k = 0;
    if (arrows && L.disp) for (let i = 0; i < n && k < S.instanceMatrix.count; i += 1) {
      const d = L.disp[i]; const m = Math.hypot(d[0], d[1], d[2]); if (m < 0.08) continue;
      const ux = d[0] / m; const uy = d[1] / m; const uz = d[2] / m; const shaft = Math.max(0.1, ARROW_LEN * m - 0.2);
      orient(o.quaternion, [ux, uy, uz], 0); o.position.set(vis.atoms[i].pos[0], vis.atoms[i].pos[1], vis.atoms[i].pos[2]); o.scale.set(1, 1, shaft); o.updateMatrix(); S.setMatrixAt(k, o.matrix);
      o.position.set(vis.atoms[i].pos[0] + ux * shaft, vis.atoms[i].pos[1] + uy * shaft, vis.atoms[i].pos[2] + uz * shaft); o.scale.setScalar(1); o.updateMatrix(); HD.setMatrixAt(k, o.matrix); k += 1;
    }
    S.count = k; HD.count = k;
    for (const mesh of [A, G, H, B, S, HD]) mesh.instanceMatrix.needsUpdate = true;
    if (L.disp) publish(state, clock, { motion: L.paused || L.reduced ? "static" : "running", pose: pose.toFixed(3), bond0: bondLen0.toFixed(4), atoms: n, key: L.key ?? "", "max-disp": amp !== 0 ? Math.max(...L.disp.map((d) => Math.hypot(d[0], d[1], d[2]) * Math.abs(amp))).toFixed(3) : "0.000", arrows: k });
    else publish(state, clock, { motion: "none", atoms: n, key: L.key ?? "", arrows: 0, pose: "0" });
  });

  return (
    <>
      <ambientLight intensity={0.95} />
      <directionalLight position={[3, -4, 5]} intensity={1.4} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} />
      <group rotation={[0, vis.rotY, 0]}>
        <instancedMesh ref={atoms} args={[SPHERE, undefined, n]}><meshStandardMaterial ref={atomMat} roughness={0.38} metalness={0.05} emissive="#7dd3fc" emissiveIntensity={0.12} /></instancedMesh>
        <instancedMesh ref={ghosts} args={[SPHERE, undefined, n]}><meshBasicMaterial transparent opacity={0.16} depthWrite={false} wireframe /></instancedMesh>
        <instancedMesh ref={halos} args={[SPHERE, undefined, n]}><meshBasicMaterial transparent opacity={0.28} depthWrite={false} side={THREE.BackSide} /></instancedMesh>
        <instancedMesh ref={bonds} args={[CYL, undefined, strands.length]}><meshStandardMaterial color="#aab6d6" roughness={0.55} metalness={0.05} /></instancedMesh>
        <instancedMesh ref={shafts} args={[ARROW_SHAFT, undefined, n]}><meshBasicMaterial color="#fcd34d" /></instancedMesh>
        <instancedMesh ref={heads} args={[ARROW_HEAD, undefined, n]}><meshBasicMaterial color="#fcd34d" /></instancedMesh>
        {labels && vis.atoms.map((a, i) => (showLabel[i] ? (
          <group key={`${vis.id}-${i}`} ref={(g) => { labelRefs.current[i] = g; }} position={a.pos}>
            <Html center zIndexRange={[4, 0]} style={{ pointerEvents: "none" }}><span className={`ir-atomlabel ir-atomlabel--${a.el}`}>{a.el}</span></Html>
          </group>
        ) : null))}
      </group>
      <OrbitControls makeDefault enablePan={false} enableDamping dampingFactor={0.12} minDistance={vis.radius * 1.4} maxDistance={vis.radius * 7} />
    </>
  );
}
