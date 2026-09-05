import StimulusRenderer from "../../teacher/qbuilder/components/visuals/StimulusRenderer.jsx";

// Renders a question during an active challenge — no correctness
// feedback, no explanations, no hints, ever (enforced by simply never
// receiving/passing that data down; see ChallengeSession.jsx, which only
// fetches question content, not markschemes, into this component).
// Supports the answer types the current Question Bank actually has data
// for (MCQ, Calculation/numeric, Short/Extended text) — Multi-part
// questions render each part as its own short-response field, keyed by
// part id, which is the honest way to support them without inventing
// per-part answer-type metadata the bank doesn't have yet.
export default function QuestionRenderer({ question, answer, onAnswer }) {
  return (
    <div>
      {question.stimulus && (
        <div className="mb-5">
          <StimulusRenderer stimulus={question.stimulus} />
        </div>
      )}

      <p className="whitespace-pre-line text-[15px] leading-relaxed text-[var(--color-ink)]">{question.questionText}</p>

      <div className="mt-5">
        {question.parts?.length > 0 ? (
          <div className="flex flex-col gap-4">
            {question.parts.map((part) => (
              <div key={part.id}>
                <p className="text-sm text-[var(--color-ink-soft)]">
                  <span className="font-medium text-[var(--color-ink)]">({part.id})</span> {part.questionText}
                  {part.marks != null && <span className="ml-1.5 text-xs text-[var(--color-ink-faint)]">[{part.marks}]</span>}
                </p>
                <textarea
                  rows={2}
                  value={answer?.[part.id] ?? ""}
                  onChange={(e) => onAnswer({ ...(answer ?? {}), [part.id]: e.target.value })}
                  className="mt-1.5 w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
                  aria-label={`Answer for part ${part.id}`}
                />
              </div>
            ))}
          </div>
        ) : question.questionType === "MCQ" ? (
          <div className="flex flex-col gap-2" role="radiogroup" aria-label="Answer options">
            {question.options?.map((opt) => (
              <label
                key={opt.id}
                className={`flex cursor-pointer items-center gap-3 rounded-md border px-3.5 py-2.5 text-sm transition-colors ${
                  answer === opt.id ? "border-[var(--color-indigo)] bg-[var(--color-indigo-soft)]" : "border-[var(--color-line)] hover:border-[var(--color-ink)]"
                }`}
              >
                <input type="radio" name={`q-${question.id}`} checked={answer === opt.id} onChange={() => onAnswer(opt.id)} className="accent-[var(--color-indigo)]" />
                <span className="font-medium text-[var(--color-ink-faint)]">{opt.id}</span>
                <span className="text-[var(--color-ink)]">{opt.text}</span>
              </label>
            ))}
          </div>
        ) : question.questionType === "Calculation" ? (
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--color-ink-soft)]" htmlFor={`ans-${question.id}`}>Your answer</label>
            <input
              id={`ans-${question.id}`}
              type="text"
              inputMode="decimal"
              value={answer ?? ""}
              onChange={(e) => onAnswer(e.target.value)}
              placeholder="Enter your numerical answer"
              className="w-full max-w-xs rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
            />
          </div>
        ) : (
          <textarea
            rows={question.questionType === "Extended Response" ? 8 : 4}
            value={answer ?? ""}
            onChange={(e) => onAnswer(e.target.value)}
            placeholder="Write your response"
            className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-3 py-2.5 text-sm text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none focus:ring-2 focus:ring-[var(--color-indigo)]/30"
            aria-label="Your response"
          />
        )}
      </div>
    </div>
  );
}
