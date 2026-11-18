import { useRef, useState } from "react";
import { useFrame } from "@react-three/fiber";

/** Eases a number toward `target` inside the canvas loop and returns it formatted (re-renders only when the text changes). */
export function useEasedText(target, format, reduced) {
  const v = useRef(target); const [text, setText] = useState(() => format(target));
  useFrame((_, dt) => {
    const d = target - v.current;
    if (Math.abs(d) < 1e-6) { return; }
    v.current = reduced || Math.abs(d) < 0.004 ? target : v.current + d * Math.min(1, dt * 6);
    const t = format(v.current); setText((p) => (p === t ? p : t));
  });
  return text;
}
