const W = 120;
const H = 64;

/** A genuine instrument schematic: a slit admits incoming radiation,
 * a dispersing prism/grating element bends it, and a fan of coloured
 * rays spreads out toward the recording spectrum below -- replacing
 * the earlier plain bordered text box labelled "Spectroscope". */
export default function SpectroscopeInstrument({ dispersed = true }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label="Spectroscope: entrance slit, dispersing prism, and fanned-out spectrum">
        {/* housing */}
        <rect x="2" y="10" width={W - 4} height="30" rx="4" fill="#20222b" stroke="#4a4f60" strokeWidth="1.2" />
        {/* entrance slit */}
        <rect x="4" y="21" width="6" height="8" fill="#000" />
        <line x1="10" y1="25" x2="34" y2="25" stroke="#c8ccd8" strokeWidth="1" opacity="0.7" />
        {/* prism */}
        <polygon points="40,32 56,32 48,14" fill="#8ea6c9" opacity="0.55" stroke="#c9d6ea" strokeWidth="1" />
        {/* fanned dispersed rays */}
        {dispersed ? (
          [
            { c: "#7a1f1f", a: 20 },
            { c: "#b3562a", a: 12 },
            { c: "#c9a227", a: 5 },
            { c: "#2f8f4e", a: -3 },
            { c: "#2e6fb0", a: -11 },
            { c: "#5a3f9e", a: -19 },
          ].map((r, i) => {
            const x2 = 116;
            const y2 = 25 + r.a * 1.4;
            return <line key={i} x1="50" y1="24" x2={x2} y2={y2} stroke={r.c} strokeWidth="1.4" opacity="0.85" />;
          })
        ) : (
          <line x1="50" y1="24" x2="116" y2="24" stroke="#c8ccd8" strokeWidth="1.4" opacity="0.85" />
        )}
      </svg>
      <p className="text-[9px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Spectroscope</p>
    </div>
  );
}
