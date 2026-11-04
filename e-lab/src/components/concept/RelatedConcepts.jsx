import { Link } from "react-router-dom";
import { getConcept } from "../../data/concepts/index.js";

export default function RelatedConcepts({ conceptIds }) {
  const related = conceptIds.map((id) => getConcept(id)).filter(Boolean);
  if (related.length === 0) return null;

  return (
    <div>
      <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
        Related concepts
      </h2>
      <div className="mt-3 flex flex-wrap gap-2">
        {related.map((concept) => (
          <Link
            key={concept.id}
            to={`/topics/${concept.id}`}
            className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink)] transition-colors hover:border-[var(--color-ink)]"
          >
            {concept.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
