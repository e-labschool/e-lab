import { useState } from "react";

const TABS = [
  { id: "about", label: "About" },
  { id: "keyIdea", label: "Key idea" },
  { id: "result", label: "Result" },
  { id: "examTip", label: "Exam tip" },
];

// Compact tabbed info panel, driven entirely by the method's `info`
// data -- never hardcoded per method, so adding a new method's content
// is a data change in methods.js, not a UI change here.
export default function InfoPanel({ method }) {
  const [tab, setTab] = useState("about");
  if (!method) {
    return <p className="text-xs text-[var(--color-ink-faint)]">Choose a mixture and a separation method to see how it works.</p>;
  }

  return (
    <div>
      <p className="text-sm font-semibold text-[var(--color-ink)]">{method.label}</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">Physical property used: {method.principle}</p>

      <div role="tablist" className="mt-3 flex gap-1 border-b border-[var(--color-line)]">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`px-2 py-1.5 text-[11px] font-medium ${tab === t.id ? "border-b-2 border-[var(--color-indigo)] text-[var(--color-indigo)]" : "text-[var(--color-ink-faint)] hover:text-[var(--color-ink)]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-2 text-xs text-[var(--color-ink-soft)]">
        {tab === "about" && <p>{method.info.about}</p>}
        {tab === "keyIdea" && <p>{method.info.keyIdea}</p>}
        {tab === "result" && (
          <dl className="grid grid-cols-2 gap-2">
            {method.info.result.map((r) => (
              <div key={r.label}>
                <dt className="font-semibold text-[var(--color-ink)]">{r.label}</dt>
                <dd>{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {tab === "examTip" && <p>{method.info.examTip}</p>}
      </div>
    </div>
  );
}
