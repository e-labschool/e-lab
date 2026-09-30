import { useState } from "react";
import { Plus, Trash2, Columns2, Rows3, ClipboardPaste } from "lucide-react";
import { pasteEquationFriendly } from "../EquationFriendlyField.jsx";
import { parseTabularPaste, createEmptyTable } from "../../../lib/tableParsing.js";
import TableView from "../../learn/TableView.jsx";

const inputCls = "w-full rounded border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-1.5 text-xs text-[var(--color-ink)] focus:border-[var(--color-indigo)] focus:outline-none";

/** One editable table cell — a plain single-line input (not a full
 * EquationFriendlyField with its own toolbar/preview per cell, which
 * would turn a compact table into a spreadsheet-like wall of controls).
 * Paste still goes through the same math-annotation-resolving path as
 * every other short scientific-text field in Admin Learn (title, term,
 * caption, …), and typed content still supports the compact
 * ⟦math:...⟧ / \( \) markers — the SAME shared scientific pipeline,
 * just without the inline symbol toolbar for space reasons. */
function TableCellInput({ value, onChange, placeholder, bold = false }) {
  return (
    <input
      className={`${inputCls} ${bold ? "font-semibold" : ""}`}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      onPaste={(e) => pasteEquationFriendly(e, value ?? "", onChange)}
    />
  );
}

function PasteTablePanel({ onApply, onCancel }) {
  const [raw, setRaw] = useState("");
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState("");

  function handlePaste(e) {
    const clipboard = e.clipboardData;
    if (!clipboard) return;
    e.preventDefault();
    const parsed = parseTabularPaste({ html: clipboard.getData("text/html"), text: clipboard.getData("text/plain") });
    if (!parsed) {
      setPreview(null);
      setError("Could not detect a table. Paste at least 2 columns and 2 rows (tab-, comma- or pipe-separated, or a copied Word/Excel/Markdown table).");
      return;
    }
    setError("");
    setPreview(parsed);
    setRaw(clipboard.getData("text/plain") || "");
  }

  return (
    <div className="rounded-md border border-dashed border-[var(--color-indigo)]/40 bg-[var(--color-indigo-soft)]/35 p-3">
      <p className="text-xs font-semibold text-[var(--color-ink)]">Paste table data</p>
      <p className="mt-0.5 text-[11px] text-[var(--color-ink-faint)]">Paste tab-separated data from a spreadsheet, or a Markdown/HTML table. The first row becomes the header.</p>
      <textarea
        className={`${inputCls} mt-2 min-h-16 font-mono`}
        value={raw}
        onChange={(e) => setRaw(e.target.value)}
        onPaste={handlePaste}
        placeholder="Click here, then Ctrl+V / Cmd+V to paste…"
        aria-label="Paste tabular data"
      />
      {error && <p className="mt-1.5 text-xs text-[var(--color-coral)]">{error}</p>}
      {preview && (
        <div className="mt-2 space-y-2">
          <TableView table={{ ...preview, hasHeaderRow: true }} />
          <div className="flex gap-2">
            <button type="button" onClick={() => onApply(preview)} className="rounded-md bg-[var(--color-ink)] px-3 py-1.5 text-xs font-semibold text-white">Use this table</button>
            <button type="button" onClick={onCancel} className="rounded-md border border-[var(--color-line)] px-3 py-1.5 text-xs font-medium text-[var(--color-ink-soft)]">Cancel</button>
          </div>
        </div>
      )}
      {!preview && (
        <div className="mt-2">
          <button type="button" onClick={onCancel} className="text-[11px] font-medium text-[var(--color-ink-faint)]">Cancel</button>
        </div>
      )}
    </div>
  );
}

/** Compact, reusable table-editing UI for the shared Table content
 * element: { headers, rows, hasHeaderRow, hasHeaderColumn }. Used inside
 * any block that can contain a table (Worked Example's content-item
 * sequence, and the optional table on Key Idea / Real-Life / Reveal /
 * Common Mistakes) — one editor, everywhere a table can appear, so
 * behaviour and appearance never drift between blocks. Deliberately
 * stays a grid of plain inputs rather than a spreadsheet app: add/remove
 * row, add/remove column, toggle header row/column, delete table. */
export default function TableEditor({ table, onChange, onRemove }) {
  const [pasting, setPasting] = useState(false);
  const safeTable = table ?? createEmptyTable();
  const headers = safeTable.headers ?? [];
  const rows = safeTable.rows ?? [];
  const hasHeaderRow = safeTable.hasHeaderRow !== false;
  const hasHeaderColumn = Boolean(safeTable.hasHeaderColumn);
  const columnCount = Math.max(headers.length, 1);

  function update(patch) {
    onChange({ ...safeTable, ...patch });
  }

  function setHeader(i, value) {
    const next = [...headers];
    next[i] = value;
    update({ headers: next });
  }

  function setCell(r, c, value) {
    const next = rows.map((row, i) => (i === r ? (() => { const nr = [...row]; nr[c] = value; return nr; })() : row));
    update({ rows: next });
  }

  function addColumn() {
    update({
      headers: [...headers, ""],
      rows: rows.map((row) => [...row, ""]),
    });
  }

  function removeColumn(i) {
    if (columnCount <= 1) return;
    update({
      headers: headers.filter((_, idx) => idx !== i),
      rows: rows.map((row) => row.filter((_, idx) => idx !== i)),
    });
  }

  function addRow() {
    update({ rows: [...rows, Array.from({ length: columnCount }, () => "")] });
  }

  function removeRow(r) {
    update({ rows: rows.filter((_, idx) => idx !== r) });
  }

  function applyPastedTable(parsed) {
    onChange({ headers: parsed.headers, rows: parsed.rows, hasHeaderRow: true, hasHeaderColumn: false });
    setPasting(false);
  }

  return (
    <div className="space-y-2 rounded-md border border-[var(--color-line)] bg-[var(--color-paper)]/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-semibold text-[var(--color-ink)]">Table</p>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setPasting((v) => !v)} className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-indigo)]">
            <ClipboardPaste size={12} /> Paste data
          </button>
          {onRemove && (
            <button type="button" onClick={onRemove} className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-coral)]">
              <Trash2 size={12} /> Delete table
            </button>
          )}
        </div>
      </div>

      {pasting && <PasteTablePanel onApply={applyPastedTable} onCancel={() => setPasting(false)} />}

      <div className="flex flex-wrap items-center gap-3 text-[11px] text-[var(--color-ink-soft)]">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={hasHeaderRow} onChange={(e) => update({ hasHeaderRow: e.target.checked })} />
          Header row
        </label>
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={hasHeaderColumn} onChange={(e) => update({ hasHeaderColumn: e.target.checked })} />
          First column is a row header
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="border-separate border-spacing-1">
          <thead>
            <tr>
              {headers.map((h, i) => (
                <th key={i} className="min-w-[7rem] p-0">
                  <div className="flex items-center gap-1">
                    <TableCellInput value={h} placeholder={`Column ${i + 1}`} bold onChange={(v) => setHeader(i, v)} />
                    {columnCount > 1 && (
                      <button type="button" title="Remove column" onClick={() => removeColumn(i)} className="shrink-0 text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]">
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>
                </th>
              ))}
              <th className="p-0 align-middle">
                <button type="button" title="Add column" onClick={addColumn} className="flex items-center gap-1 rounded border border-dashed border-[var(--color-line)] px-2 py-1.5 text-[11px] font-medium text-[var(--color-indigo)]">
                  <Columns2 size={12} /> <Plus size={11} />
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {Array.from({ length: columnCount }, (_, c) => row[c] ?? "").map((cell, c) => (
                  <td key={c} className="p-0">
                    <TableCellInput value={cell} onChange={(v) => setCell(r, c, v)} bold={hasHeaderColumn && c === 0} />
                  </td>
                ))}
                <td className="p-0 align-middle">
                  <button type="button" title="Remove row" onClick={() => removeRow(r)} className="text-[var(--color-ink-faint)] hover:text-[var(--color-coral)]">
                    <Trash2 size={13} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button type="button" onClick={addRow} className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-indigo)]">
        <Rows3 size={12} /> <Plus size={11} /> Add row
      </button>

      <div>
        <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[var(--color-ink-faint)]">Live preview</p>
        <TableView table={safeTable} />
      </div>
    </div>
  );
}
