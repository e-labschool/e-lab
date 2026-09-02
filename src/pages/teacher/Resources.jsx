import { useOutletContext } from "react-router-dom";
import { FolderOpen } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

export default function Resources() {
  const { subject } = useOutletContext();

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

      <div className="mt-12">
        <EmptyStatePanel
          icon={FolderOpen}
          title="Downloadable resources are on the way"
          description="Worksheets, practical sheets and reference material will appear here."
        />
      </div>
    </Container>
  );
}
