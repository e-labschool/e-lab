import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import Container from "../ui/Container.jsx";
import SimulationThumb from "../simulation-library/SimulationThumb.jsx";
import { getFeaturedSimulations } from "../../data/simulationCatalogue.js";
import { useAccessConfig } from "../../lib/access/AccessConfigContext.jsx";
import { tierBadge, tierLabel } from "../../lib/access/accessPolicy.js";
import { useLandingLinks } from "./useLandingLinks.js";

/** Showcase driven by the catalogue's `featured` flag (admin: /admin/simulations).  Cards open the public standalone
 *  view (/simulation/:id); "Browse all simulations" goes to the signed-in user's library, or to log in first. */
export default function SimulationShowcase() {
  const { catalogue, config } = useAccessConfig();
  const { libraryPath } = useLandingLinks();
  const featured = getFeaturedSimulations(catalogue).slice(0, 4);
  if (!featured.length) return null;
  return (
    <section id="simulations" aria-labelledby="showcase-title" className="scroll-mt-20 border-b border-[var(--color-line)] bg-[var(--color-paper-raised)]/60 py-14 md:py-16">
      <Container>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 id="showcase-title" className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Explore the simulations</h2>
            <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">Each one opens in your browser. Pick one and start moving things.</p>
          </div>
          <Link to={libraryPath} data-browse-all className="inline-flex items-center gap-2 rounded-md border border-[var(--color-ink)]/50 bg-[var(--color-paper-raised)] px-4 py-2 text-sm font-semibold text-[var(--color-ink)] hover:border-[var(--color-ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)]">
            Browse all simulations <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </div>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {featured.map((e) => {
            const badge = tierBadge(e, config);
            return (
              <li key={e.id} className="relative min-w-0 overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-paper-raised)] hover:shadow-[0_6px_18px_-6px_rgba(20,30,80,0.25)]">
                <SimulationThumb id={e.id} src={e.thumbnail} label={e.label} />
                {badge && <span data-tier-badge={badge} className="absolute left-2.5 top-2.5 rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold uppercase text-[#1F5E54]">{tierLabel(badge)}</span>}
                <div className="p-4">
                  <h3 className="font-[var(--font-display)] text-base font-semibold text-[var(--color-ink)]">
                    <Link to={`/simulation/${e.id}`} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:rounded-xl focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-[var(--color-indigo)]">{e.label}</Link>
                  </h3>
                  <p className="mt-1 line-clamp-2 text-sm text-[var(--color-ink-soft)]">{e.description}</p>
                </div>
              </li>
            );
          })}
        </ul>
      </Container>
    </section>
  );
}
