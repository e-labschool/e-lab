// Evidence only supports the proven stored shape: exactly two H2O
// molecules. This renderer does NOT attempt to draw any other molecule
// pair — an unsupported `molecules` value fails gracefully rather than
// inventing a geometry that was never proven by the data.
function isSupportedH2OPair(molecules) {
  return Array.isArray(molecules) && molecules.length === 2 && molecules.every((m) => m === "H2O");
}

// One water molecule: O atom plus two H atoms in a bent arrangement.
// Atoms are ALWAYS drawn — showIntramolecular only controls whether the
// solid covalent O-H bond LINES are drawn, never whether the molecule
// itself exists. `facingH` identifies which of the two H atoms points
// toward the neighbouring molecule (the one involved in the hydrogen
// bond) so the dashed line can be anchored to it specifically.
function WaterMolecule({ cx, cy, flip = false, showIntramolecular }) {
  const dir = flip ? -1 : 1;
  const outerH = { x: cx - dir * 22, y: cy + 16 };
  const facingH = { x: cx + dir * 10, y: cy + 20 };

  return (
    <g>
      {showIntramolecular && (
        <>
          <line x1={cx} y1={cy} x2={outerH.x} y2={outerH.y} stroke="currentColor" strokeWidth="1.5" />
          <line x1={cx} y1={cy} x2={facingH.x} y2={facingH.y} stroke="currentColor" strokeWidth="1.5" />
        </>
      )}
      <circle cx={cx} cy={cy} r="9" fill="var(--color-indigo-soft)" stroke="currentColor" strokeWidth="1.25" />
      <text x={cx} y={cy + 4} fontSize="9" textAnchor="middle" fill="currentColor">O</text>
      <circle cx={outerH.x} cy={outerH.y} r="6" fill="white" stroke="currentColor" strokeWidth="1.25" />
      <text x={outerH.x} y={outerH.y + 3} fontSize="8" textAnchor="middle" fill="currentColor">H</text>
      <circle cx={facingH.x} cy={facingH.y} r="6" fill="white" stroke="currentColor" strokeWidth="1.25" />
      <text x={facingH.x} y={facingH.y + 3} fontSize="8" textAnchor="middle" fill="currentColor">H</text>
    </g>
  );
}

export default function HydrogenBond({ molecules, showIntermolecular = true, showIntramolecular = true }) {
  if (!isSupportedH2OPair(molecules)) {
    return (
      <p className="rounded-md border border-dashed border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-xs text-[var(--color-ink-faint)]">
        Visual unavailable
      </p>
    );
  }

  // Left molecule's facing H sits at (70, 55). Right molecule's O sits
  // at (160, 35). The dashed hydrogen bond connects THAT H to THAT O —
  // never H to H.
  const leftFacingH = { x: 70, y: 55 };
  const rightO = { x: 160, y: 35 };

  return (
    <div className="flex flex-col items-center gap-2">
      <svg viewBox="0 0 220 90" className="w-full max-w-xs text-[var(--color-ink)]" role="img" aria-label="Hydrogen bonding between two water molecules: solid covalent O-H bonds within each molecule, dashed hydrogen bond from a hydrogen atom to the neighbouring oxygen atom">
        <WaterMolecule cx={60} cy={35} showIntramolecular={showIntramolecular} />
        <WaterMolecule cx={160} cy={35} flip showIntramolecular={showIntramolecular} />
        {showIntermolecular && (
          <line
            x1={leftFacingH.x} y1={leftFacingH.y} x2={rightO.x} y2={rightO.y}
            stroke="var(--color-coral)" strokeWidth="1.5" strokeDasharray="3 3"
          />
        )}
      </svg>
      <div className="flex items-center gap-4 text-[10px] text-[var(--color-ink-faint)]">
        <span className="flex items-center gap-1"><span className="inline-block h-[1.5px] w-4 bg-[var(--color-ink)]" /> Covalent O\u2013H bond</span>
        <span className="flex items-center gap-1"><span className="inline-block h-[1.5px] w-4 border-t border-dashed border-[var(--color-coral)]" /> Hydrogen bond (O\u2013H\u00b7\u00b7\u00b7O)</span>
      </div>
    </div>
  );
}
