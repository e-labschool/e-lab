import { useState, useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { FolderOpen, Loader2 } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";
import { useVisibleResources } from "../../lib/useVisibleResources.js";
import { TEACHER_CATEGORIES } from "../../lib/resourceService.js";
import ResourceCard from "../student/resources/components/ResourceCard.jsx";

export default function Resources() {
  const { subject } = useOutletContext();
  const { resources, loading, error } = useVisibleResources();
  const [activeCategory, setActiveCategory] = useState(TEACHER_CATEGORIES[0].id);
  const teacherResources = useMemo(
    () => resources.filter((r) => (r.audience === "teacher" || r.audience === "both") && r.category === activeCategory),
    [resources, activeCategory]
  );

  return (
    <Container className="py-8 md:py-10">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Resources</p>
        <h1 className="mt-1.5 font-[var(--font-display)] text-[32px] font-bold tracking-tight text-[var(--color-ink)]">
          {subject.label} supporting material
        </h1>
        <p className="mt-2 text-[15px] text-[var(--color-ink-soft)]">
          Worksheets, reference sheets and lesson support &mdash; material you use or download,
          not the main teaching experience itself.
        </p>
      </div>

      <div className="mt-5 flex gap-1.5">
        {TEACHER_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setActiveCategory(c.id)}
            className={`rounded-md px-4 py-2 text-[15px] font-semibold transition-colors ${
              activeCategory === c.id ? "bg-[var(--color-ink)] text-white" : "text-[var(--color-ink-soft)] hover:bg-[var(--color-ink)]/5"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-[var(--color-coral)]">Resources couldn't be loaded: {error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : teacherResources.length === 0 ? (
        <div className="mt-8">
          <EmptyStatePanel
            icon={FolderOpen}
            title="Downloadable resources are on the way"
            description="Worksheets, practical sheets and reference material will appear here."
          />
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-2.5">
          {teacherResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </Container>
  );
}
