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
        {questions.map((q, index) => (
          <div key={q.id} className="border-b border-[#eee] pb-5">
            <p className="text-sm font-semibold">Question {index + 1}</p>
            <p className="mt-1.5 whitespace-pre-line text-sm text-[#333]">{q.answer}</p>
            <p className="mt-1.5 whitespace-pre-line text-sm text-[#555]">{q.markscheme}</p>
            <p className="mt-1.5 text-xs font-medium">[{q.marks} mark{q.marks === 1 ? "" : "s"}]</p>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-[#666]">No questions added to this paper yet.</p>}
      </div>
    </div>
  );
}
