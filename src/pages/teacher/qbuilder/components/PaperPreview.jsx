export default function PaperPreview({ draft, totalMarks }) {
  const { details, questions } = draft;
  const maxMarks = details.maxMarks !== "" ? details.maxMarks : totalMarks;

  return (
    <div className="mx-auto max-w-2xl bg-white p-10 text-[#111] shadow-sm print:shadow-none">
      <div className="text-center">
        {details.schoolName && <p className="text-lg font-semibold uppercase tracking-wide">{details.schoolName}</p>}
        <p className="mt-1 text-sm">IB Diploma Programme</p>
        <p className="text-sm">{details.subject}</p>
        {(details.classGrade || details.assessmentTitle) && (
          <p className="mt-1 text-sm font-medium">
            {details.classGrade}{details.classGrade && details.assessmentTitle ? " \u2013 " : ""}{details.assessmentTitle}
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-wrap justify-between border-y border-[#ccc] py-3 text-sm">
        <span>Date: {details.date || "__________"}</span>
        <span>Duration: {details.duration || "__________"}</span>
        <span>Maximum Marks: {maxMarks}</span>
      </div>

      {details.instructions && (
        <div className="mt-5 whitespace-pre-line text-sm italic text-[#333]">{details.instructions}</div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        {questions.map((q, index) => (
          <div key={q.id}>
            <div className="flex items-baseline justify-between gap-3">
              <p className="whitespace-pre-line text-sm leading-relaxed">
                <span className="font-semibold">{index + 1}.</span> {q.questionText}
              </p>
            </div>
            <p className="mt-1 text-right text-xs font-medium">[{q.marks} mark{q.marks === 1 ? "" : "s"}]</p>
          </div>
        ))}
        {questions.length === 0 && <p className="text-sm text-[#666]">No questions added to this paper yet.</p>}
      </div>
    </div>
  );
}
