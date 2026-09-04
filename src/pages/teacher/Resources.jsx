import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import { FolderOpen, Loader2 } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";
import { useVisibleResources } from "../../lib/useVisibleResources.js";
import ResourceCard from "../student/resources/components/ResourceCard.jsx";

// Teacher Resources previously had no category structure of its own —
// just this placeholder — so a single flat, searchable-by-eye list (no
// invented category hierarchy) is the natural fit, rather than forcing
// the Student IB Documents/Study Materials split onto a page that never
// had it.
export default function Resources() {
  const { subject } = useOutletContext();
  const { resources, loading, error } = useVisibleResources();
  const teacherResources = useMemo(
    () => resources.filter((r) => r.audience === "teacher" || r.audience === "both"),
    [resources]
  );

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Resources</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          {subject.label} supporting material
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Worksheets, reference sheets and lesson support &mdash; material you use or download,
          not the main teaching experience itself.
        </p>
      </div>

      {error && <p className="mt-6 text-sm text-[var(--color-coral)]">Resources couldn't be loaded: {error}</p>}

      {loading ? (
        <div className="mt-16 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-[var(--color-ink-faint)]" /></div>
      ) : teacherResources.length === 0 ? (
        <div className="mt-12">
          <EmptyStatePanel
            icon={FolderOpen}
            title="Downloadable resources are on the way"
            description="Worksheets, practical sheets and reference material will appear here."
          />
        </div>
      ) : (
        <div className="mt-10 flex flex-col gap-3">
          {teacherResources.map((resource) => (
            <ResourceCard key={resource.id} resource={resource} />
          ))}
        </div>
      )}
    </Container>
  );
}
