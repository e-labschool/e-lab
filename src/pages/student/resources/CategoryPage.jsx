import { useParams } from "react-router-dom";
import Container from "../../../components/ui/Container.jsx";
import ResourceBrowser from "../../../components/resources/ResourceBrowser.jsx";
import { useStudentResources } from "./lib/useStudentResources.js";

// Deep link kept for old bookmarks: /student/resources/ib-documents (or study-materials, or any
// top-level folder slug / folder id) opens the same browser with that folder selected.
export default function CategoryPage() {
  const { categoryId } = useParams();
  const { resources, loading, error } = useStudentResources();
  return (
    <Container className="py-10 md:py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Resources</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">Resources</h1>
      </div>
      <div className="mt-8">
        <ResourceBrowser role="student" resources={resources} resourcesLoading={loading} resourcesError={error} initialFolderRef={categoryId} redirectIfUnknown="/student/resources" />
      </div>
    </Container>
  );
}
