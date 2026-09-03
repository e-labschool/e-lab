import { getQuestionMarks } from "../../../../data/questions/schema.js";

export default function MarkschemePreview({ draft, totalMarks }) {
  const { details, questions } = draft;

  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-[#111] shadow-sm print:shadow-none">
      <div className="text-center">
        {details.schoolName && <p className="text-lg font-semibold uppercase tracking-wide">{details.schoolName}</p>}
        <p className="mt-1 text-sm">IB Diploma Programme \u2014 {details.subject}</p>
        <p className="mt-1 text-sm font-medium">Markscheme{details.assessmentTitle ? ` \u2014 ${details.assessmentTitle}` : ""}</p>
        <p className="mt-1 text-xs text-[#666]">Total Marks: {totalMarks}</p>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {questions.map((q, index) => {
          const marks = getQuestionMarks(q);
          const hasParts = Array.isArray(q.parts) && q.parts.length > 0;
          return (
            <div key={q.id} className="border-b border-[#eee] pb-5">
              <p className="text-sm font-semibold">Question {index + 1}</p>
              {hasParts ? (
                <div className="mt-1.5 flex flex-col gap-2">
                  {q.parts.map((part, i) => (
                    <div key={part.id ?? i}>
                      <p className="text-sm text-[#333]">({part.id ?? String.fromCharCode(97 + i)})</p>
                      <p className="whitespace-pre-line text-sm text-[#555]">{part.markscheme}</p>
                      <p className="text-xs font-medium">[{part.marks}]</p>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  {q.questionType === "MCQ" ? (
                    <p className="mt-1.5 text-sm text-[#333]">Correct answer: {q.correctAnswer}</p>
                  ) : (
                    <p className="mt-1.5 whitespace-pre-line text-sm text-[#333]">{q.answer}</p>
                  )}
                  <p className="mt-1.5 whitespace-pre-line text-sm text-[#555]">{q.markscheme}</p>
                </>
              )}
              <p className="mt-1.5 text-xs font-medium">[{marks} mark{marks === 1 ? "" : "s"}]</p>
            </div>
          );
        })}
        {questions.length === 0 && <p className="text-sm text-[#666]">No questions added to this paper yet.</p>}
      </div>

      <p className="mt-10 border-t border-[#eee] pt-4 text-center text-[10px] text-[#999]">
        e-Lab Practice Questions &mdash; original practice material. Teacher copy &mdash; not for student distribution.
      </p>
    </div>
  );
}
