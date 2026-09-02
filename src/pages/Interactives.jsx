import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { getAllResources } from "../data/resources-registry.js";
import Container from "../components/ui/Container.jsx";
import Card from "../components/ui/Card.jsx";
import Badge from "../components/ui/Badge.jsx";

const CATEGORIES = ["simulate", "visualize", "explore", "practice", "teach"];
const STATUS_TONE = { live: "teal", "in-development": "amber", planned: "neutral" };
const STATUS_LABEL = { live: "Live", "in-development": "Coming soon", planned: "Planned" };

export default function Interactives() {
  const [activeCategory, setActiveCategory] = useState(null);
  const resources = getAllResources();

  const filtered = useMemo(() => {
    if (!activeCategory) return resources;
    return resources.filter((r) => r.categories.includes(activeCategory));
  }, [activeCategory, resources]);

  const sorted = useMemo(
    () => [...filtered].sort((a, b) => (a.status === "live" ? -1 : b.status === "live" ? 1 : 0)),
    [filtered]
  );

  return (
    <Container className="py-16">
      <div className="max-w-2xl">
        <h1 className="font-[var(--font-display)] text-4xl font-semibold tracking-tight text-[var(--color-ink)]">
          Interactives
        </h1>
        <p className="mt-3 text-base text-[var(--color-ink-soft)]">
          The full library of e-Lab tools — live and planned. Each one is designed for
          both a student exploring independently and a teacher demonstrating live.
        </p>
      </div>

      <div className="mt-8 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setActiveCategory(null)}
          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
            activeCategory === null
              ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
              : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
          }`}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setActiveCategory(cat)}
            className={`rounded-full border px-3.5 py-1.5 text-sm capitalize transition-colors ${
              activeCategory === cat
                ? "border-[var(--color-ink)] bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "border-[var(--color-line)] text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((resource) => (
          <Link key={resource.id} to={`/interactives/${resource.id}`}>
            <Card className="flex h-full flex-col justify-between p-6 transition-colors hover:border-[var(--color-ink)]">
              <div>
                <div className="mb-3 flex items-start justify-between gap-3">
                  <h3 className="text-base font-medium text-[var(--color-ink)]">{resource.title}</h3>
                  <Badge tone={STATUS_TONE[resource.status]}>{STATUS_LABEL[resource.status]}</Badge>
                </div>
                <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">{resource.description}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {resource.categories.map((c) => (
                  <span key={c} className="text-xs capitalize text-[var(--color-ink-faint)]">
                    {c}
                    {c !== resource.categories.at(-1) ? " ·" : ""}
                  </span>
                ))}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
