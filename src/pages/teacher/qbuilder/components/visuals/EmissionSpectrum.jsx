// Reusable for any emission/line spectrum in the question bank — pass the
// wavelengths, get a spectrum. Deliberately monochrome (thin sharp lines on
// a neutral band), not a decorative rainbow gradient, so it stays legible
// in print/export and doesn't imply more precision about colour than the
// question intends.
const W = 340;
const H = 70;
const PAD = 20;
const MIN_NM = 380;
const MAX_NM = 750;

export default function EmissionSpectrum({ lines, continuous = false, label }) {
  const plotW = W - PAD * 2;
  const xFor = (nm) => PAD + ((nm - MIN_NM) / (MAX_NM - MIN_NM)) * plotW;

  return (
    <div className="flex flex-col items-center gap-1">
      {label && <span className="text-xs font-medium text-[var(--color-ink-faint)]">{label}</span>}
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label={continuous ? "Continuous spectrum" : "Line (emission) spectrum"}>
        <rect x={PAD} y={16} width={plotW} height={28} fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        {continuous ? (
          <rect x={PAD + 1} y={17} width={plotW - 2} height={26} fill="currentColor" opacity="0.55" />
        ) : (
          lines.map((l, i) => (
            <line key={i} x1={xFor(l.wavelength)} y1={17} x2={xFor(l.wavelength)} y2={43} stroke="currentColor" strokeWidth="2" />
          ))
        )}
        {!continuous && lines.map((l, i) => (
          <text key={i} x={xFor(l.wavelength)} y={58} fontSize="8" textAnchor="middle" fill="currentColor">{l.wavelength}</text>
        ))}
        <text x={W / 2} y={H - 2} fontSize="8" textAnchor="middle" fill="currentColor">Wavelength / nm</text>
      </svg>
    </div>
  );
}
