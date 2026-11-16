import { Shuffle, ListFilter } from "lucide-react";
import { MATTER_EXAMPLES } from "../data/examples.js";

// Shown by the mass / volume tests when there is nothing on the bench (or the item on the bench is not matter), so the first run
// through the walkthrough never dead-ends: the student can pick a sample, or let the page pick one, right here.
export default function NeedSample({ example, onChooseSample, onRandomSample, what }) {
  const isNonMatter = example && !MATTER_EXAMPLES.some((e) => e.id === example.id);
  return (
    <div className="flex flex-col items-start gap-4 rounded-md border border-dashed border-[var(--color-line)] p-6 text-sm text-[var(--color-ink-soft)]" data-testid="need-sample">
      <p>
        {isNonMatter
          ? <><strong>{example.label}</strong> is not matter, so it has no {what} to measure. Choose a different sample to run this test.</>
          : <>The bench is empty. Choose a sample to test its {what}.</>}
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onRandomSample} data-testid="pick-for-me" className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-3.5 py-2 text-sm text-[var(--color-paper)]">
          <Shuffle size={14} aria-hidden="true" /> Pick a sample for me
        </button>
        <button type="button" onClick={onChooseSample} data-testid="choose-sample" className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3.5 py-2 text-sm text-[var(--color-ink)]">
          <ListFilter size={14} aria-hidden="true" /> Choose from the tray
        </button>
      </div>
    </div>
  );
}
