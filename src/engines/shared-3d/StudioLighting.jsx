import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/** Soft studio light for glossy atoms: a procedural room environment (no network, no HDR file) plus a key, a fill and a rim light. */
export default function StudioLighting({ intensity = 0.9, key1 = 1.5 }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    const pm = new THREE.PMREMGenerator(gl); const room = new RoomEnvironment(); const rt = pm.fromScene(room, 0.04);
    const prev = scene.environment; scene.environment = rt.texture; scene.environmentIntensity = intensity;
    return () => { scene.environment = prev; rt.dispose(); pm.dispose(); room.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); };
  }, [gl, scene, intensity]);
  return (<><ambientLight intensity={0.35} /><directionalLight position={[4, 7, 6]} intensity={key1} /><directionalLight position={[-6, -2, 3]} intensity={0.45} /><directionalLight position={[0, 3, -6]} intensity={0.5} color="#cdbfff" /></>);
}
