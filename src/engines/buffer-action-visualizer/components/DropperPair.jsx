// Two small droppers side by side above a beaker — red for H+, blue for
// OH-. `activeDrop` ("H" | "OH" | null) controls which one animates a
// falling droplet; both beakers receive the same activeDrop value
// simultaneously so it's visually obvious they get the same addition.
export default function DropperPair({ activeDrop }) {
  return (
    <div className="dropper-pair">
      <MiniDropper color="#c23b3b" label="H\u207A" dropping={activeDrop === "H"} />
      <MiniDropper color="#2f4bc4" label="OH\u207B" dropping={activeDrop === "OH"} />
    </div>
  );
}

function MiniDropper({ color, label, dropping }) {
  return (
    <div className="mini-dropper">
      <svg viewBox="0 0 24 40" className="mini-dropper-svg">
        <rect x="9" y="2" width="6" height="4" rx="1" fill="#8b98a8" />
        <rect x="7" y="6" width="10" height="18" rx="3" fill="rgba(230,240,250,0.35)" stroke="rgba(225,235,250,0.5)" strokeWidth="1" />
        <rect x="9" y="9" width="6" height="10" rx="1.5" fill={color} opacity="0.55" />
        <path d="M 9 24 L 15 24 L 12.7 33 L 11.3 33 Z" fill="rgba(230,240,250,0.35)" stroke="rgba(225,235,250,0.5)" strokeWidth="0.75" />
        {dropping && <circle cx="12" cy="36" r="2.6" fill={color} className="mini-dropper-drop" />}
      </svg>
      <span className="mini-dropper-label" style={{ color }}>{label}</span>
    </div>
  );
}
