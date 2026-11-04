import { Plus } from "lucide-react";

const TABS = [
  { id: "bank", label: "Question Bank" },
  { id: "my-questions", label: "My Questions" },
  { id: "my-papers", label: "My Papers" },
];

export default function TopTabs({ activeTab, onChangeTab, onCreateQuestion }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--color-line)] pb-4">
      <div className="inline-flex items-center rounded-full border border-[var(--color-line)] p-0.5 text-sm">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            className={`rounded-full px-4 py-1.5 transition-colors ${
              activeTab === tab.id
                ? "bg-[var(--color-ink)] text-[var(--color-paper)]"
                : "text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onCreateQuestion}
        className="inline-flex items-center gap-1.5 rounded-md bg-[var(--color-ink)] px-4 py-2 text-sm text-[var(--color-paper)] hover:bg-[var(--color-indigo)]"
      >
        <Plus size={15} /> Create Question
      </button>
    </div>
  );
}
