import NuclearNotation from "./NuclearNotation.jsx";
import { isotopeIdentity, nuclideStatus } from "../lib/atomControls.js";

const CLASSIFICATION_LABEL = { neutral: "Neutral atom", cation: "Positive ion — cation", anion: "Negative ion — anion" };
const CLASSIFICATION_COLOR = { neutral: "var(--color-teal)", cation: "var(--color-amber)", anion: "var(--color-indigo)" };
// Informative, never blocking. "no-data" is neutral (not a warning): this
// simulation simply has no isotope data for that element.
const STATUS_COLOR = { reference: "var(--color-teal)", stable: "var(--color-teal)", radioactive: "var(--color-coral)", "not-stable": "var(--color-coral)", "no-data": "var(--color-ink-faint)" };

export default function IdentityPanel({ derived, highlightA, highlightZ, highlightCharge }) {
  const { protons, neutrons, electrons, atomicNumber, massNumber, netCharge, element, nuclideName, classification } = derived;

  if (!element) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] p-5 text-center" data-testid="atom-identity">
        <p className="text-sm font-semibold text-[var(--color-ink)]">No element yet</p>
        <p className="text-xs text-[var(--color-ink-faint)]">Add a proton to begin building an atom.</p>
        <p className="text-xs text-[var(--color-ink-faint)]">Net charge: {netCharge > 0 ? `+${netCharge}` : netCharge} &middot; mass number: {massNumber}</p>
      </div>
    );
  }

  const status = nuclideStatus(protons, neutrons);
  const iso = isotopeIdentity(protons, neutrons);

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-3" data-testid="atom-identity">
      <div className="flex items-center gap-3">
        <div className="flex shrink-0 justify-center pl-8"><NuclearNotation derived={derived} highlightA={highlightA} highlightZ={highlightZ} highlightCharge={highlightCharge} /></div>
        <dl className="grid min-w-0 flex-1 grid-cols-[1fr_auto] gap-x-3 gap-y-0.5 text-xs">
          <dt className="text-[var(--color-ink-faint)]">Element</dt>
          <dd className="text-right font-semibold text-[var(--color-ink)]" data-testid="atom-element">{element.name}</dd>
          <dt className="text-[var(--color-ink-faint)]">Atomic number, Z</dt>
          <dd className="text-right font-semibold" style={{ color: "var(--color-teal)" }} data-testid="atom-Z">{atomicNumber}</dd>
          <dt className="text-[var(--color-ink-faint)]">Mass number, A</dt>
          <dd className="text-right font-semibold" style={{ color: "var(--color-violet)" }} data-testid="atom-A">{massNumber}</dd>
          <dt className="text-[var(--color-ink-faint)]">Net charge</dt>
          <dd className="text-right font-semibold text-[var(--color-ink)]" data-testid="atom-charge">{netCharge > 0 ? `+${netCharge}` : netCharge}</dd>
          <dt className="text-[var(--color-ink-faint)]">p / n / e</dt>
          <dd className="text-right font-semibold text-[var(--color-ink)]">{protons} / {neutrons} / {electrons}</dd>
        </dl>
      </div>

      <p className="text-center text-base font-bold text-[var(--color-ink)]">
        <span data-testid="atom-isotope-name">{nuclideName}</span>
        <span className="ml-2 text-sm font-semibold text-[var(--color-ink-faint)]" data-testid="atom-isotope-notation">{iso?.notation}</span>
      </p>

      <div className="flex flex-wrap items-center justify-center gap-1.5">
        <span className="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white" style={{ backgroundColor: CLASSIFICATION_COLOR[classification] }} data-testid="atom-classification">
          {CLASSIFICATION_LABEL[classification]}
        </span>
        <span className="rounded-full border px-2.5 py-0.5 text-[11px] font-semibold" style={{ borderColor: STATUS_COLOR[status.status], color: STATUS_COLOR[status.status] }} data-testid="atom-stability" title={status.detail}>
          {status.label}
        </span>
      </div>
      {status.detail && <p className="text-center text-[11px] text-[var(--color-ink-faint)]" data-testid="atom-stability-detail">{status.detail}</p>}
    </div>
  );
}
