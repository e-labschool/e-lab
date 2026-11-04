import { useState } from "react";
import { FileDown, FileType, Printer } from "lucide-react";
import { exportPdf, exportDocx } from "../lib/export.js";

export default function ExportControls({ draft, totalMarks, mode }) {
  const [busy, setBusy] = useState(false);

  async function handleDocx() {
    setBusy(true);
    try {
      await exportDocx({ draft, totalMarks, mode });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="qbuilder-chrome flex flex-wrap gap-2">
      <button
        type="button"
        onClick={() => exportPdf({ draft, totalMarks, mode })}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <FileDown size={14} /> Export PDF
      </button>
      <button
        type="button"
        onClick={handleDocx}
        disabled={busy}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)] disabled:opacity-50"
      >
        <FileType size={14} /> Export Word
      </button>
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex items-center gap-1.5 rounded-md border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-ink-soft)] hover:text-[var(--color-ink)]"
      >
        <Printer size={14} /> Print
      </button>
    </div>
  );
}
