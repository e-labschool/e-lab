import { useState } from "react";

// Deterministic dark gradients used whenever a simulation has no thumbnail file (or it fails to load), so a card never
// shows a broken image.  Picked from the id so the same simulation always gets the same colour.
const GRADIENTS = [
  ["#0F172A", "#1E3A8A"], ["#111827", "#134E4A"], ["#1E1B4B", "#4C1D95"],
  ["#1F2937", "#7C2D12"], ["#0B1220", "#155E75"], ["#172554", "#312E81"],
];
function hash(str) { let h = 0; for (let i = 0; i < str.length; i += 1) h = (h * 31 + str.charCodeAt(i)) >>> 0; return h; }
export const fallbackGradient = (id) => { const [a, b] = GRADIENTS[hash(String(id)) % GRADIENTS.length]; return `linear-gradient(135deg, ${a}, ${b})`; };

/** 16:10 thumbnail.  `src` null / missing / failing => gradient fallback with the simulation's initials (decorative). */
export default function SimulationThumb({ id, src, label, className = "", eager = false, fit = "cover" }) {
  const [failed, setFailed] = useState(false);
  const showImage = src && !failed;
  return (
    <div className={`relative aspect-[16/10] w-full overflow-hidden bg-[#0F172A] ${className}`} style={showImage ? undefined : { backgroundImage: fallbackGradient(id) }} data-thumb={showImage ? "image" : "fallback"}>
      {showImage ? (
        <img src={src} alt="" width={640} height={400} loading={eager ? "eager" : "lazy"} decoding="async" onError={() => setFailed(true)} className={`h-full w-full ${fit === "contain" ? "object-contain" : "object-cover object-top"}`} />
      ) : (
        <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center font-[var(--font-display)] text-2xl font-semibold tracking-wide text-white/70">
          {String(label || id).split(/[\s\-(]+/).filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("")}
        </span>
      )}
    </div>
  );
}
