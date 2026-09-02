import { Link } from "react-router-dom";
import { ArrowUpRight, Clock } from "lucide-react";
import { getResource } from "../../data/resources-registry.js";
import Container from "../ui/Container.jsx";
import Card from "../ui/Card.jsx";
import Badge from "../ui/Badge.jsx";

// The six flagship cards called for in the brief. Card copy/status is pulled
// from the resource registry — only this list of *which* resources to feature
// is fixed here.
const FEATURED_IDS = [
  "electron-configuration-explorer",
  "periodic-trends-explorer",
  "molecular-geometry-explorer",
  "collision-theory-lab",
  "equilibrium-simulator",
  "titration-lab",
];

export default function FeaturedInteractives() {
  const resources = FEATURED_IDS.map((id) => getResource(id)).filter(Boolean);

  return (
    <section className="border-b border-[var(--color-line)] py-20">
      <Container>
        <div className="mb-10 flex items-end justify-between">
          <h2 className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
            Featured interactives
          </h2>
          <Link
            to="/interactives"
            className="hidden text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] md:inline"
          >
            View all interactives
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {resources.map((resource) => (
            <Link key={resource.id} to={`/interactives/${resource.id}`}>
              <Card className="group flex h-full flex-col justify-between p-6 transition-colors hover:border-[var(--color-ink)]">
                <div>
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <h3 className="text-base font-medium text-[var(--color-ink)]">
                      {resource.title}
                    </h3>
                    {resource.status === "live" ? (
                      <ArrowUpRight
                        size={16}
                        className="mt-0.5 shrink-0 text-[var(--color-ink-faint)] transition-colors group-hover:text-[var(--color-ink)]"
                      />
                    ) : (
                      <Clock size={16} className="mt-0.5 shrink-0 text-[var(--color-ink-faint)]" />
                    )}
                  </div>
                  <p className="text-sm leading-relaxed text-[var(--color-ink-soft)]">
                    {resource.description}
                  </p>
                </div>
                <div className="mt-5">
                  {resource.status === "live" ? (
                    <Badge tone="teal">Live</Badge>
                  ) : resource.status === "in-development" ? (
                    <Badge tone="amber">Coming soon</Badge>
                  ) : (
                    <Badge tone="neutral">Planned</Badge>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </Container>
    </section>
  );
}
