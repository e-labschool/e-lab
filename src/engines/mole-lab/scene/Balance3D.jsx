import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { makeTexture } from "./textures.js";

/** Digital balance: a thin weighing pan under the packets and a housing with a live LCD in front.  `reading` is the formatted
 *  mass string produced by the selectors (the 3D object never computes chemistry). */
export default function Balance3D({ minX, maxX, z, reading, subtitle, dark }) {
  const w = Math.max(3.6, maxX - minX + 1.3); const cx = (minX + maxX) / 2;
  const tex = useMemo(() => makeTexture(512, 192, (g, W, H) => {
    g.fillStyle = "#0e1c1a"; g.fillRect(0, 0, W, H);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, "rgba(120,255,220,0.07)"); gr.addColorStop(1, "rgba(0,0,0,0.25)"); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.fillStyle = "#7ff3d2"; g.font = "700 96px 'DSEG7 Classic', ui-monospace, 'SF Mono', Menlo, Consolas, monospace"; g.textAlign = "right"; g.textBaseline = "middle"; g.fillText(reading, W - 28, H * 0.44);
    g.fillStyle = "rgba(127,243,210,0.7)"; g.font = "500 30px ui-monospace, Menlo, Consolas, monospace"; g.textAlign = "left"; g.fillText(subtitle ?? "", 24, H * 0.86);
  }), [reading, subtitle]);
  useEffect(() => () => tex.dispose(), [tex]);
  const body = dark ? "#9aa3b8" : "#cfd5e3"; const dk = dark ? "#2b3246" : "#56607a";
  return (
    <group position={[cx, 0, z]}>
      <mesh position={[0, 0.0, 0]}><boxGeometry args={[w, 0.05, 2.3]} /><meshStandardMaterial color={body} roughness={0.3} metalness={0.35} envMapIntensity={0.9} /></mesh>
      <mesh position={[0, 0.03, 0]}><boxGeometry args={[w - 0.1, 0.012, 2.2]} /><meshStandardMaterial color={dark ? "#aeb6c9" : "#e9edf6"} roughness={0.18} metalness={0.2} envMapIntensity={1} /></mesh>
      <group position={[0, 0.2, 1.75]} rotation={[-0.28, 0, 0]}>
        <mesh><boxGeometry args={[Math.min(w, 3.4), 0.62, 0.62]} /><meshStandardMaterial color={dk} roughness={0.45} metalness={0.2} /></mesh>
        <mesh position={[0, 0.02, 0.32]}><planeGeometry args={[Math.min(w, 3.4) - 0.3, 0.45]} /><meshBasicMaterial map={tex} toneMapped={false} /></mesh>
      </group>
      <mesh position={[0, -0.02, 1.0]}><boxGeometry args={[w + 0.2, 0.08, 3.3]} /><meshStandardMaterial color={dk} roughness={0.55} metalness={0.15} /></mesh>
    </group>
  );
}
