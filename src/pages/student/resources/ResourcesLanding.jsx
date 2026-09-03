import { Link } from "react-router-dom";
import { FolderOpen, ArrowRight } from "lucide-react";
import { CATEGORIES, getResourceCounts } from "./lib/resourceUtils.js";
import Container from "../../../components/ui/Container.jsx";
import Card from "../../../components/ui/Card.jsx";

export default function ResourcesLanding() {
  const counts = getResourceCounts();

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Resources</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Resources
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Essential documents and learning materials for your IB Diploma Chemistry journey.
        </p>
      </div>

      <div className="mt-12 grid gap-4 sm:grid-cols-2">
        {Object.values(CATEGORIES).map((category) => (
          <Link key={category.id} to={category.id}>
            <Card className="flex h-full flex-col justify-between p-7 transition-colors hover:border-[var(--color-ink)]">
              <div>
                <FolderOpen size={22} strokeWidth={1.75} className="text-[var(--color-indigo)]" />
                <h2 className="mt-4 text-lg font-medium text-[var(--color-ink)]">{category.label}</h2>
                <p className="mt-2 text-sm leading-relaxed text-[var(--color-ink-soft)]">{category.description}</p>
              </div>
              <div className="mt-6 flex items-center justify-between text-sm">
                <span className="text-[var(--color-ink-faint)]">
                  {counts[category.id]} resource{counts[category.id] === 1 ? "" : "s"}
                </span>
                <span className="inline-flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                  Open <ArrowRight size={14} />
                </span>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </Container>
  );
}
