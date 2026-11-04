import { useOutletContext } from "react-router-dom";
import { MessageSquareQuote } from "lucide-react";
import Container from "../../components/ui/Container.jsx";
import EmptyStatePanel from "../../components/ui/EmptyStatePanel.jsx";

export default function Quiz() {
  const { subject } = useOutletContext();

  return (
    <Container className="py-14">
      <div className="max-w-2xl">
        <p className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-faint)]">Quiz</p>
        <h1 className="mt-2 font-[var(--font-display)] text-3xl font-semibold tracking-tight text-[var(--color-ink)]">
          Question your {subject.label} class
        </h1>
        <p className="mt-3 text-sm text-[var(--color-ink-soft)]">
          Classroom questioning and quick checks for understanding.
        </p>
      </div>

      <div className="mt-12">
        <EmptyStatePanel
          icon={MessageSquareQuote}
          title="Quiz tools are on the way"
          description="Ready-made topic quizzes, exit tickets and live classroom questioning will appear here."
        />
      </div>
    </Container>
  );
}
