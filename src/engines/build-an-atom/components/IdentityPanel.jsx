import NuclearNotation from "./NuclearNotation.jsx";

const CLASSIFICATION_LABEL = { neutral: "Neutral atom", cation: "Positive ion \u2014 cation", anion: "Negative ion \u2014 anion" };
const CLASSIFICATION_COLOR = { neutral: "var(--color-teal)", cation: "var(--color-amber)", anion: "var(--color-indigo)" };

export default function IdentityPanel({ derived, highlightA, highlightZ, highlightCharge }) {
  const { protons, neutrons, electrons, atomicNumber, massNumber, netCharge, element, nuclideName, classification } = derived;

  if (!element) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--color-line)] p-5 text-center">
        <p className="text-sm font-semibold text-[var(--color-ink)]">No element yet</p>
        <p className="text-xs text-[var(--color-ink-faint)]">Add a proton to begin building an atom.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <div className="flex justify-center">
        <NuclearNotation derived={derived} highlightA={highlightA} highlightZ={highlightZ} highlightCharge={highlightCharge} />
      </div>
      <p className="text-center text-lg font-bold text-[var(--color-ink)]">{nuclideName}</p>

      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        <dt className="text-[var(--color-ink-faint)]">Element</dt>
        <dd className="text-right font-semibold text-[var(--color-ink)]">{element.name}</dd>
        <dt className="text-[var(--color-ink-faint)]">Atomic number, Z</dt>
        <dd className="text-right font-semibold" style={{ color: "var(--color-teal)" }}>{atomicNumber}</dd>
        <dt className="text-[var(--color-ink-faint)]">Mass number, A</dt>
        <dd className="text-right font-semibold" style={{ color: "var(--color-violet)" }}>{massNumber}</dd>
        <dt className="mt-1 text-[var(--color-ink-faint)]">Protons</dt>
        <dd className="mt-1 text-right font-semibold text-[var(--color-ink)]">{protons}</dd>
        <dt className="text-[var(--color-ink-faint)]">Neutrons</dt>
        <dd className="text-right font-semibold text-[var(--color-ink)]">{neutrons}</dd>
        <dt className="text-[var(--color-ink-faint)]">Electrons</dt>
        <dd className="text-right font-semibold text-[var(--color-ink)]">{electrons}</dd>
        <dt className="mt-1 text-[var(--color-ink-faint)]">Net charge</dt>
        <dd className="mt-1 text-right font-semibold text-[var(--color-ink)]">{netCharge > 0 ? `+${netCharge}` : netCharge}</dd>
      </dl>

      <div className="flex flex-col items-center gap-1.5 border-t border-[var(--color-line)] pt-3">
        <span className="rounded-full px-3 py-1 text-xs font-bold text-white" style={{ backgroundColor: CLASSIFICATION_COLOR[classification] }}>
          {CLASSIFICATION_LABEL[classification]}
        </span>
        <p className="text-center text-xs text-[var(--color-ink-faint)]">
          Nuclide / isotope: <span className="font-semibold text-[var(--color-ink)]">{nuclideName}</span>
        </p>
      </div>
    </div>
  );
}
