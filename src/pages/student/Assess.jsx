import { useOutletContext } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

export default function Assess() {
  const { subject } = useOutletContext();

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Assess</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Check your {subject.label} mastery
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Find out how well you can do independently.
        </p>
      </div>

      <div className="mt-12">
        <EmptyStatePanel
          icon={ClipboardCheck}
          title="Assessment tools are on the way"
          description="Topic tests, timed and mixed-topic assessments, and exam-style practice will appear here."
          items={["Paper 1 & Paper 2-style practice", "Timed mock assessments", "Performance summaries"]}
        />
      </div>
    </Container>
  );
}
