import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { UNITS, TOPICS } from "../../data/questions/unitMeta.js";

// Builds the three-level tree (section -> unit -> subtopic) once from the
// same curriculum data everything else in the Question Builder already
// uses (unitMeta.js, itself derived from the DP Chemistry curriculum map)
// — never a second hand-maintained copy of the syllabus structure.
const SECTIONS = ["Structure", "Reactivity"].map((section) => ({
  section,
  units: UNITS.filter((u) => u.section === section).map((u) => ({
    ...u,
    subtopics: TOPICS.filter((t) => t.unit === u.unit).map((t) => ({
      code: `${t.section[0]}${t.subtopic}`, // "S1.1", "R2.2" — matches getCurriculumCode()
      label: t.topicTitle,
      subtopic: t.subtopic,
    })),
  })),
}));

// Cool family for Structure, warm family for Reactivity — one consistent
// identity per section rather than a different colour per topic.
const SECTION_ACCENT = {
  Structure: { text: "text-[var(--color-indigo)]", bg: "bg-[var(--color-indigo)]", ring: "ring-[var(--color-indigo)]" },
  Reactivity: { text: "text-[var(--color-amber)]", bg: "bg-[var(--color-amber)]", ring: "ring-[var(--color-amber)]" },
};

function tri(selected, codes) {
  const selectedCount = codes.filter((c) => selected.includes(c)).length;
  if (selectedCount === 0) return "none";
  if (selectedCount === codes.length) return "all";
  return "some";
}

function Checkbox({ state, onClick, accentBg }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-checked={state === "all" ? "true" : state === "some" ? "mixed" : "false"}
      role="checkbox"
      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-indigo)] focus-visible:ring-offset-1 ${
        state === "none"
          ? "border-[var(--color-line)] bg-transparent"
          : `border-transparent ${accentBg}`
      }`}
    >
      {state === "all" && <span className="block h-1.5 w-2 -translate-y-px rotate-[-45deg] border-b-2 border-l-2 border-white" />}
      {state === "some" && <span className="block h-0.5 w-2 rounded-full bg-white" />}
    </button>
  );
}

export default function CurriculumFilterTree({ selectedCodes, onChange, counts = {} }) {
  const [expandedUnits, setExpandedUnits] = useState(() => new Set());

  function toggleUnitExpanded(unitCode) {
    setExpandedUnits((prev) => {
      const next = new Set(prev);
      if (next.has(unitCode)) next.delete(unitCode);
      else next.add(unitCode);
      return next;
    });
  }

  function setCodes(codes, shouldSelect) {
    if (shouldSelect) {
      onChange([...new Set([...selectedCodes, ...codes])]);
    } else {
      onChange(selectedCodes.filter((c) => !codes.includes(c)));
    }
  }

  return (
    <div className="space-y-3">
      {SECTIONS.map(({ section, units }) => {
        const allCodes = units.flatMap((u) => u.subtopics.map((s) => s.code));
        const sectionState = tri(selectedCodes, allCodes);
        const accent = SECTION_ACCENT[section];
        return (
          <div key={section}>
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <Checkbox state={sectionState} accentBg={accent.bg} onClick={() => setCodes(allCodes, sectionState !== "all")} />
              <span className={`text-sm font-semibold ${accent.text}`}>{section}</span>
            </label>

            <div className="ml-1 mt-0.5 space-y-0.5 border-l border-[var(--color-line)] pl-3">
              {units.map((unit) => {
                const unitCodes = unit.subtopics.map((s) => s.code);
                const unitState = tri(selectedCodes, unitCodes);
                const expanded = expandedUnits.has(unit.unitCode);
                return (
                  <div key={unit.unit}>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => toggleUnitExpanded(unit.unitCode)}
                        aria-label={expanded ? `Collapse ${unit.unit}` : `Expand ${unit.unit}`}
                        className="flex h-5 w-5 shrink-0 items-center justify-center text-[var(--color-ink-faint)]"
                      >
                        <ChevronRight size={13} className={`transition-transform ${expanded ? "rotate-90" : ""}`} />
                      </button>
                      <label className="flex flex-1 cursor-pointer items-center gap-2 py-1">
                        <Checkbox state={unitState} accentBg={accent.bg} onClick={() => setCodes(unitCodes, unitState !== "all")} />
                        <span className="text-sm text-[var(--color-ink)]">{unit.unit}</span>
                      </label>
                    </div>

                    {expanded && (
                      <div className="ml-6 space-y-0.5 border-l border-[var(--color-line)] pl-3">
                        {unit.subtopics.map((sub) => {
                          const checked = selectedCodes.includes(sub.code);
                          const count = counts[sub.code];
                          return (
                            <label key={sub.code} className="flex cursor-pointer items-center gap-2 py-1">
                              <Checkbox state={checked ? "all" : "none"} accentBg={accent.bg} onClick={() => setCodes([sub.code], !checked)} />
                              <span className="flex-1 truncate text-[13px] text-[var(--color-ink-soft)]">
                                <span className="font-medium text-[var(--color-ink)]">{sub.subtopic}</span> {sub.label}
                              </span>
                              {count != null && <span className="text-[11px] text-[var(--color-ink-faint)]">{count}</span>}
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
