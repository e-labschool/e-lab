// One flexible cell diagram covering voltaic cells, electrolytic cells,
// and fuel cells (three genuinely different circuits sharing the same
// "two electrodes + external circuit" skeleton) — reused across Reactivity
// 1 (fuel cells) and Reactivity 3 (voltaic/electrolytic cells, redox,
// electroplating) rather than building three separate components.
// Correctly distinguishes electron flow (through the wire) from ion
// movement (through the electrolyte/salt bridge), and gets anode/cathode
// polarity right for each mode: voltaic anode is negative, electrolytic
// anode is positive — the definition (anode = oxidation, cathode =
// reduction) never changes; only the polarity label does.
export default function ElectrochemicalCellDiagram({ mode = "voltaic", leftLabel, rightLabel, leftElectrode, rightElectrode, anodeSide = "left" }) {
  const anodeIsLeft = anodeSide === "left";
  const leftIsAnode = anodeIsLeft;
  const leftPolarity = mode === "electrolytic" ? (leftIsAnode ? "+" : "\u2212") : (leftIsAnode ? "\u2212" : "+");
  const rightPolarity = mode === "electrolytic" ? (leftIsAnode ? "\u2212" : "+") : (leftIsAnode ? "+" : "\u2212");

  return (
    <svg viewBox="0 0 260 160" className="w-full max-w-sm text-[var(--color-ink)]" role="img" aria-label={`${mode} electrochemical cell`}>
      <defs>
        <marker id="ecell-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M0,0 L6,3 L0,6 Z" fill="currentColor" />
        </marker>
      </defs>

      {mode === "electrolytic" ? (
        <>
          <rect x="50" y="40" width="160" height="80" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <rect x="80" y="10" width="30" height="16" rx="2" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <text x="95" y="21" fontSize="7" textAnchor="middle" fill="currentColor">DC</text>
          <line x1="95" y1="26" x2="95" y2="35" stroke="currentColor" strokeWidth="1.25" />
          <line x1="95" y1="35" x2="80" y2="45" stroke="currentColor" strokeWidth="1.25" />
          <line x1="165" y1="26" x2="165" y2="35" stroke="currentColor" strokeWidth="1.25" />
          <line x1="165" y1="35" x2="180" y2="45" stroke="currentColor" strokeWidth="1.25" />
          <line x1="95" y1="10" x2="165" y2="10" stroke="currentColor" strokeWidth="1.25" />
          <line x1="95" y1="10" x2="95" y2="26" stroke="currentColor" strokeWidth="1.25" />
          <line x1="165" y1="10" x2="165" y2="26" stroke="currentColor" strokeWidth="1.25" />
        </>
      ) : (
        <>
          <rect x="20" y="55" width="80" height="60" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <rect x="160" y="55" width="80" height="60" fill="none" stroke="currentColor" strokeWidth="1.25" />
          {mode === "voltaic" && (
            <>
              <path d="M100 95 h20 v-8 h-4 v-8 h4 v-8 h-4 v-8 h4 v8 h20" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.7" />
              <text x="130" y="70" fontSize="6.5" textAnchor="middle" fill="currentColor">salt bridge</text>
            </>
          )}
          <line x1="60" y1="20" x2="60" y2="55" stroke="currentColor" strokeWidth="1.25" />
          <line x1="200" y1="20" x2="200" y2="55" stroke="currentColor" strokeWidth="1.25" />
          <line x1="60" y1="20" x2="200" y2="20" stroke="currentColor" strokeWidth="1.25" markerEnd="url(#ecell-arrow)" />
          <text x="130" y="14" fontSize="7" textAnchor="middle" fill="currentColor">e⁻ (external circuit)</text>
        </>
      )}

      <rect x={mode === "electrolytic" ? 88 : 55} y={mode === "electrolytic" ? 48 : 65} width="8" height={mode === "electrolytic" ? 65 : 40} fill="var(--color-ink)" opacity="0.75" />
      <rect x={mode === "electrolytic" ? 170 : 195} y={mode === "electrolytic" ? 48 : 65} width="8" height={mode === "electrolytic" ? 65 : 40} fill="var(--color-ink)" opacity="0.75" />

      <text x={mode === "electrolytic" ? 92 : 60} y="132" fontSize="8" textAnchor="middle" fill="currentColor">{leftLabel}</text>
      <text x={mode === "electrolytic" ? 174 : 200} y="132" fontSize="8" textAnchor="middle" fill="currentColor">{rightLabel}</text>
      <text x={mode === "electrolytic" ? 92 : 60} y="144" fontSize="7" textAnchor="middle" fill="var(--color-ink-faint)">{leftElectrode}</text>
      <text x={mode === "electrolytic" ? 174 : 200} y="144" fontSize="7" textAnchor="middle" fill="var(--color-ink-faint)">{rightElectrode}</text>

      <text x={mode === "electrolytic" ? 92 : 60} y="155" fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--color-amber)">{leftIsAnode ? "Anode" : "Cathode"} ({leftPolarity})</text>
      <text x={mode === "electrolytic" ? 174 : 200} y="155" fontSize="8" fontWeight="700" textAnchor="middle" fill="var(--color-teal)">{leftIsAnode ? "Cathode" : "Anode"} ({rightPolarity})</text>
    </svg>
  );
}
