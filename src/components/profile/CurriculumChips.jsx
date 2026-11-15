import { curriculumDisplay, isCurriculumAvailable } from "../../data/curricula.js";

/** Small read-only chip row for a user's chosen curricula.  `legacyText` is shown as one plain chip when the stored text matches no known curriculum. */
export default function CurriculumChips({ ids = [], other = "", legacyText = "" }) {
  const chips = ids.map((id) => ({ id, text: curriculumDisplay(id, other, { short: true }), planned: !isCurriculumAvailable(id) }));
  if (!chips.length && legacyText) chips.push({ id: "legacy", text: legacyText, planned: false });
  if (!chips.length) return <span className="text-[var(--color-ink-faint)]">{"—"}</span>;
  return (
    <ul className="m-0 flex list-none flex-wrap justify-end gap-1.5 p-0" data-testid="curriculum-chips" aria-label="Curriculum">
      {chips.map((c) => (
        <li key={c.id} data-curriculum-chip={c.id} className="rounded-full border border-[var(--color-line)] bg-[var(--color-indigo-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--color-indigo)]">
          {c.text}{c.planned ? <span className="sr-only"> (content planned)</span> : null}
        </li>
      ))}
    </ul>
  );
}
