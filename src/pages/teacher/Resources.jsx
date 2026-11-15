import { useMemo } from "react";
import { useOutletContext } from "react-router-dom";
import Container from "../../components/ui/Container.jsx";
import ResourceBrowser from "../../components/resources/ResourceBrowser.jsx";
import { useVisibleResources } from "../../lib/useVisibleResources.js";
import { isResourceVisibleToAudience } from "../../lib/resourceService.js";

export default function Resources() {
  const { subject } = useOutletContext();
  const { resources, loading, error } = useVisibleResources();
  // Audience rule unchanged: teacher + "both".  Folder placement is done by ResourceBrowser.
  const teacherResources = useMemo(() => resources.filter((r) => isResourceVisibleToAudience(r, "teacher")), [resources]);

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

      <div className="mt-6">
        <ResourceBrowser
          role="teacher" resources={teacherResources} resourcesLoading={loading} resourcesError={error}
          emptyTitle="Downloadable resources are on the way"
          emptyDescription="Worksheets, practical sheets and reference material will appear here."
        />
      </div>
    </Container>
  );
}
