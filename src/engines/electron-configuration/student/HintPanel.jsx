import { useState } from "react";
import { Lightbulb } from "lucide-react";
import { getHintText, getMaxHintLevel } from "../logic/hints.js";

export default function HintPanel({ config }) {
  const [level, setLevel] = useState(0);
  const maxLevel = getMaxHintLevel(config);

  return (
    <div className="rounded-md border border-[var(--color-line)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--color-ink)]">
          <Lightbulb size={15} className="text-[var(--color-amber)]" />
          Hints
        </div>
        <button
          type="button"
          onClick={() => setLevel((l) => Math.min(l + 1, maxLevel))}
          disabled={level >= maxLevel}
          className="text-sm text-[var(--color-indigo)] hover:underline disabled:cursor-not-allowed disabled:text-[var(--color-ink-faint)] disabled:no-underline"
        >
          {level === 0 ? "Show a hint" : "Reveal more"}
        </button>
      </div>

      {level > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 border-t border-[var(--color-line)] pt-3 text-sm text-[var(--color-ink-soft)]">
          {Array.from({ length: level }, (_, i) => (
            <li key={i}>{getHintText(i + 1, config)}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
