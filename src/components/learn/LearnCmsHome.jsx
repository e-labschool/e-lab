import { BookOpen } from "lucide-react";

export default function LearnCmsHome() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center px-6 text-center">
      <BookOpen size={28} className="text-[var(--color-ink-faint)]" />
      <p className="mt-3 text-lg font-semibold text-[var(--color-ink)]">Choose a topic to begin</p>
      <p className="mt-1 max-w-sm text-sm text-[var(--color-ink-soft)]">Select a section from the curriculum panel to open a lesson.</p>
    </div>
  );
}
