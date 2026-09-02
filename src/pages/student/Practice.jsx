import { useOutletContext } from "react-router-dom";
import { PenTool } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

export default function Practice() {
  const { subject } = useOutletContext();

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Practice</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Apply {subject.label}
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          You understand the idea — now practise it, with hints and instant feedback.
        </p>
      </div>

      <div className="mt-12">
        <EmptyStatePanel
          icon={PenTool}
          title="Practice questions are on the way"
          description="Topic practice, calculations, structure drawing and guided problems will appear here per topic, matching the same organization as Learn."
          items={["Multiple-choice & short-answer questions", "Equation and calculation practice", "Instant feedback with worked solutions"]}
        />
      </div>
    </Container>
  );
}
