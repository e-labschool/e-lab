import Container from "../../../components/ui/Container.jsx";
import ResourceBrowser from "../../../components/resources/ResourceBrowser.jsx";
import { useStudentResources } from "./lib/useStudentResources.js";

// Folder browser (tree + breadcrumb + search).  Before the folders SQL is applied the
// folders are the same four legacy categories, so the page works identically either way.
export default function ResourcesLanding() {
  const { resources, loading, error } = useStudentResources();
  return (
    <Container className="py-10 md:py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Resources</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Resources</h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Essential documents and learning materials for your IB Diploma Chemistry journey. Browse by folder, or search everything.
        </p>
      </div>
      <div className="mt-8">
        <ResourceBrowser role="student" resources={resources} resourcesLoading={loading} resourcesError={error} />
      </div>
    </Container>
  );
}
