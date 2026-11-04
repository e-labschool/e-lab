import RevealChip from "../components/RevealChip.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

const SAMPLES = [
  { id: "solid", label: "Solid", swatch: "var(--color-indigo)" },
  { id: "liquid", label: "Liquid", swatch: "var(--color-teal)" },
  { id: "gas", label: "Gas", swatch: "var(--color-block-f)" },
];

export default function TransitionScene({ forceToken }) {
  return (
    <div className="flex flex-col gap-8">
      <SceneQuestion eyebrow="How can matter exist?">
        Three unidentified samples. What differences can you observe?
      </SceneQuestion>

      <div className="grid gap-4 sm:grid-cols-3">
        {SAMPLES.map((s) => (
          <div key={s.id} className="flex flex-col items-center gap-3 rounded-md border border-[var(--color-line)] p-6">
            <div
              className="h-16 w-16 rounded-md border border-[var(--color-line)]"
              style={{
                background: s.id === "solid" ? s.swatch : s.id === "liquid" ? `linear-gradient(180deg, transparent 30%, ${s.swatch})` : "none",
                opacity: s.id === "gas" ? 0.15 : 0.85,
                borderColor: s.swatch,
              }}
            />
            <RevealChip label="Reveal" forceToken={forceToken}>
              <span className="text-sm font-medium" style={{ color: s.swatch }}>{s.label}</span>
            </RevealChip>
          </div>
        ))}
      </div>

      <div className="flex flex-col items-center gap-3 border-t border-[var(--color-line)] pt-8 text-center">
        <span className="text-base font-medium text-[var(--color-ink)]">MATTER</span>
        <span className="h-6 w-px bg-[var(--color-line)]" />
        <span className="text-xs uppercase tracking-wide text-[var(--color-ink-faint)]">Physical classification</span>
        <div className="flex gap-8">
          {SAMPLES.map((s) => (
            <span key={s.id} className="text-sm font-medium" style={{ color: s.swatch }}>{s.label}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
