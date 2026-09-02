import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { getAllDomains, getConceptsByDomain } from "../data/concepts/index.js";
import { getCoverageForConcept } from "../data/coverage-map.js";
import Container from "../components/ui/Container.jsx";

const STATUS_DOT = {
  live: "bg-[var(--color-teal)]",
  "in-development": "bg-[var(--color-amber)]",
  planned: "bg-[var(--color-ink-faint)]",
  uncovered: "bg-transparent border border-[var(--color-line)]",
};

function domainLabel(domain) {
  return domain.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function Topics() {
  const [query, setQuery] = useState("");
  const domains = getAllDomains();

  const filteredByDomain = useMemo(() => {
    const q = query.trim().toLowerCase();
    return domains
      .map((domain) => {
        const concepts = getConceptsByDomain(domain).filter(
          (c) => !q || c.title.toLowerCase().includes(q) || c.description.toLowerCase().includes(q)
        );
        return { domain, concepts };
      })
      .filter((d) => d.concepts.length > 0);
  }, [query, domains]);

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          Topics
        </h1>
        <p className="mt-3 text-base text-[var(--color-ink-soft)]">
          Every chemistry concept e-Lab covers, independent of any curriculum. Browse by
          idea instead of syllabus order.
        </p>
      </div>

      <div className="relative mt-8 max-w-sm">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-ink-faint)]" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics"
          className="w-full rounded-md border border-[var(--color-line)] bg-transparent py-2.5 pl-9 pr-3 text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-ink-faint)] focus:border-[var(--color-ink)]"
        />
      </div>

      <div className="mt-12 flex flex-col gap-12">
        {filteredByDomain.map(({ domain, concepts }) => (
          <div key={domain}>
            <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">
              {domainLabel(domain)}
            </h2>
            <div className="mt-4 grid gap-x-8 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {concepts.map((concept) => {
                const coverage = getCoverageForConcept(concept.id);
                return (
                  <Link
                    key={concept.id}
                    to={`/topics/${concept.id}`}
                    className="group flex items-center gap-2 py-1 text-sm text-[var(--color-ink-soft)] transition-colors hover:text-[var(--color-ink)]"
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[coverage.coverageStatus]}`} aria-hidden="true" />
                    {concept.title}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}

        {filteredByDomain.length === 0 && (
          <p className="text-sm text-[var(--color-ink-faint)]">No topics match &ldquo;{query}&rdquo;.</p>
        )}
      </div>
    </Container>
  );
}
