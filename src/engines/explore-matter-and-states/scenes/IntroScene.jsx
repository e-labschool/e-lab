import { MATTER_EXAMPLES, NON_MATTER_EXAMPLES } from "../data/examples.js";
import { MATTER_ICONS, NON_MATTER_ICONS } from "../components/MatterIcons.jsx";
import SceneQuestion from "../components/SceneQuestion.jsx";

function TrayButton({ id, label, Icon, selected, onSelect }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(id)}
      aria-pressed={selected}
      className={`flex flex-col items-center gap-1.5 rounded-md border p-3 transition-colors ${
        selected ? "border-[var(--color-ink)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
      }`}
    >
      <Icon />
      <span className="text-[11px] text-[var(--color-ink-soft)]">{label}</span>
    </button>
  );
}

export default function IntroScene({ selectedExample, onSelectExample }) {
  const selected = selectedExample;
  const isMatter = selected ? MATTER_EXAMPLES.some((e) => e.id === selected.id) : null;
  const Icon = selected ? (MATTER_ICONS[selected.id] ?? NON_MATTER_ICONS[selected.id]) : null;

  return (
    <div className="flex flex-col gap-8">
      <SceneQuestion eyebrow="What is matter?">
        Choose a sample and bring it to the investigation bench.
      </SceneQuestion>

      <div className="grid grid-cols-2 gap-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Sample tray</p>
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
            {MATTER_EXAMPLES.map((ex) => (
              <TrayButton key={ex.id} id={ex.id} label={ex.label} Icon={MATTER_ICONS[ex.id]} selected={selected?.id === ex.id} onSelect={() => onSelectExample(ex, true)} />
            ))}
            {NON_MATTER_EXAMPLES.map((ex) => (
              <TrayButton key={ex.id} id={ex.id} label={ex.label} Icon={NON_MATTER_ICONS[ex.id]} selected={selected?.id === ex.id} onSelect={() => onSelectExample(ex, false)} />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-[var(--color-line)] p-8">
          {selected ? (
            <>
              <div className="scale-[2.5]">
                <Icon />
              </div>
              <p className="mt-6 text-base font-medium text-[var(--color-ink)]">{selected.label}</p>
              <p className="mt-1 text-xs text-[var(--color-ink-faint)]">On the investigation bench</p>
            </>
          ) : (
            <p className="text-sm text-[var(--color-ink-faint)]">The investigation bench is empty &mdash; choose a sample.</p>
          )}
        </div>
      </div>

      {selected && !isMatter && (
        <p className="text-xs text-[var(--color-ink-faint)]">
          {selected.label} is included here for contrast \u2014 its own visual test is in the next section.
        </p>
      )}
    </div>
  );
}
