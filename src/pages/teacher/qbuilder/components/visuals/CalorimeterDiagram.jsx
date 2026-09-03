// A simple insulated-cup calorimeter, labelled — used for calorimetry
// apparatus-identification questions.
export default function CalorimeterDiagram({ labels = ["lid", "thermometer", "solution", "insulated cup"] }) {
  return (
    <svg viewBox="0 0 160 160" className="h-40 w-40 text-[var(--color-ink)]" role="img" aria-label="Insulated-cup calorimeter">
      <rect x="20" y="10" width="70" height="10" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="55" y1="10" x2="55" y2="70" stroke="currentColor" strokeWidth="1.5" />
      <rect x="52" y="4" width="6" height="10" fill="var(--color-paper)" stroke="currentColor" strokeWidth="1" />
      <path d="M15 20 L15 100 Q15 115 30 115 L80 115 Q95 115 95 100 L95 20 Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="20" y="70" width="70" height="40" fill="var(--color-indigo-soft)" opacity="0.5" />
      {labels[0] && <text x="55" y="6" fontSize="8" textAnchor="middle" fill="currentColor">{labels[0]}</text>}
      {labels[1] && <text x="65" y="45" fontSize="8" fill="currentColor">{labels[1]}</text>}
      {labels[2] && <text x="35" y="95" fontSize="8" fill="currentColor">{labels[2]}</text>}
      {labels[3] && <text x="55" y="130" fontSize="8" textAnchor="middle" fill="currentColor">{labels[3]}</text>}
    </svg>
  );
}
