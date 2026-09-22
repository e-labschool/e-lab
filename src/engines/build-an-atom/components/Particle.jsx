import { useId } from "react";

// One shared, dimensional gradient-sphere renderer for all three
// particle types -- proton, neutron and electron differ only in
// colour/symbol/size, never in rendering technique, so they read as
// genuinely the same "kind of object" (subatomic particles) rather
// than three unrelated visual styles.
const PARTICLE_STYLES = {
  proton: { base: "#D9622E", light: "#F5A874", dark: "#A8431A", symbol: "p\u207A", chargeLabel: "+1" },
  neutron: { base: "#7B838F", light: "#B7BEC7", dark: "#565D66", symbol: "n\u2070", chargeLabel: "0" },
  electron: { base: "#2E6FE0", light: "#7FAEFF", dark: "#1B4A9E", symbol: "e\u207B", chargeLabel: "\u22121" },
};

export default function Particle({ type, size = 32, showSymbol = true, symbolOverride }) {
  const uid = `atom-particle-${useId().replace(/:/g, "")}`;
  const style = PARTICLE_STYLES[type];

  return (
    <svg width={size} height={size} viewBox="0 0 40 40" role="img" aria-label={type}>
      <defs>
        <radialGradient id={`${uid}-grad`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={style.light} />
          <stop offset="55%" stopColor={style.base} />
          <stop offset="100%" stopColor={style.dark} />
        </radialGradient>
      </defs>
      <ellipse cx="20" cy="35" rx="12" ry="2.5" fill="rgba(0,0,0,0.12)" />
      <circle cx="20" cy="19" r="17" fill={`url(#${uid}-grad)`} />
      <ellipse cx="14.5" cy="12.5" rx="5" ry="3.2" fill="rgba(255,255,255,0.4)" />
      {showSymbol && (
        <text x="20" y="24" textAnchor="middle" fontSize="13" fontWeight="700" fill="rgba(255,255,255,0.95)">
          {symbolOverride ?? style.symbol}
        </text>
      )}
    </svg>
  );
}

export { PARTICLE_STYLES };
