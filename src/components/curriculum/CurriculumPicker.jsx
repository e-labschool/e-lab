import { Link } from "react-router-dom";
import { getAllCurricula } from "../../data/curricula/index.js";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";

// Lists every registered curriculum. Adding a new curriculum to the registry
// is enough to make it appear here — nothing in this component changes.
export default function CurriculumPicker() {
  const curricula = getAllCurricula();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {curricula.map((c) => {
        const subtopicCount = c.sections.reduce(
          (sum, section) => sum + section.topics.reduce((s, t) => s + t.subtopics.length, 0),
          0
        );
        return (
          <Link key={c.id} to={`/explore/${c.curriculum}`}>
            <Card className="p-7 transition-colors hover:border-[var(--color-ink)]">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-medium text-[var(--color-ink)]">{c.label}</h3>
                <Badge tone="indigo">{c.subject}</Badge>
              </div>
              <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
                {c.sections.length} sections &middot; {subtopicCount} subtopics
              </p>
            </Card>
          </Link>
        );
      })}

      <Card className="flex flex-col justify-center p-7 border-dashed">
        <p className="text-sm text-[var(--color-ink-faint)]">
          More curricula — IB MYP Sciences, Cambridge IGCSE, and additional DP sciences —
          will appear here as they're added.
        </p>
      </Card>
    </div>
  );
}
