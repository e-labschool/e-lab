import { CalendarDays } from "lucide-react";
import Container from "../../components/ui/Container.jsx";

// A real nav destination, not a fake feature — Class Planner itself
// (actual lesson-planning functionality) isn't built yet; this is an
// honest placeholder, matching the same pattern Admin's "Coming soon"
// sections already use elsewhere in the app.
export default function ClassPlanner() {
  return (
    <Container className="py-8 md:py-10">
      <h1 className="font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">Class Planner</h1>
      <p className="mt-1.5 text-[15px] text-[var(--color-ink-soft)]">Plan and organise your next class using curriculum-linked teaching tools.</p>
      <div className="mt-8 flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-[var(--color-line)] py-20 text-center">
        <CalendarDays size={22} className="text-[var(--color-ink-faint)]" />
        <p className="text-sm font-medium text-[var(--color-ink)]">Coming soon</p>
        <p className="max-w-xs text-xs text-[var(--color-ink-faint)]">Class Planner is on the roadmap and will be built as its own dedicated stage.</p>
      </div>
    </Container>
  );
}
