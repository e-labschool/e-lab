// A simplified IR spectrum: wavenumber axis running high-to-low (4000 to
// ~400 cm^-1, matching real IR convention), with labelled absorption
// troughs at the given band positions.
const W = 340, H = 150, PAD_L = 34, PAD_B = 26, PAD_T = 12, PAD_R = 10;
const X_MIN = 400, X_MAX = 4000;

export default function IRSpectrumChart({ bands }) {
  const plotW = W - PAD_L - PAD_R, plotH = H - PAD_T - PAD_B;
  const xFor = (wn) => PAD_L + ((X_MAX - wn) / (X_MAX - X_MIN)) * plotW; // reversed axis
  const baseline = H - PAD_B - plotH * 0.85;

  let path = `M ${PAD_L} ${baseline}`;
  const sorted = [...bands].sort((a, b) => b.wavenumber - a.wavenumber);
  for (const b of sorted) {
    const x = xFor(b.wavenumber);
    const depth = ((b.strength ?? 70) / 100) * plotH * 0.75;
    path += ` L ${x - 6} ${baseline} L ${x} ${baseline + depth} L ${x + 6} ${baseline}`;
  }
  path += ` L ${W - PAD_R} ${baseline}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-md text-[var(--color-ink)]" role="img" aria-label="Infrared spectrum">
      <line x1={PAD_L} y1={H - PAD_B} x2={W - PAD_R} y2={H - PAD_B} stroke="currentColor" strokeWidth="1" opacity="0.4" />
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />
      {sorted.map((b, i) => (
        <text key={i} x={xFor(b.wavenumber)} y={H - PAD_B + 12} fontSize="7" textAnchor="middle" fill="currentColor">{b.wavenumber}</text>
      ))}
      <text x={(PAD_L + W - PAD_R) / 2} y={H - 2} fontSize="8" textAnchor="middle" fill="currentColor">Wavenumber / cm&#8315;&#185;</text>
    </svg>
  );
}
