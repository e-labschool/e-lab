import { ScientificText } from "../../lib/scientificContent.jsx";

// A cell "looks numeric" when, after stripping the compact math-marker
// syntax (⟦math:...⟧, \( \), \[ \]) that a cell may legitimately contain,
// what's left is just digits/./,/+/-/± and spacing — e.g. "578", "11,577",
// "-3.2", "+1" (a common chemistry ion-charge notation). This is a
// heuristic, not a schema field, per the reusable-table spec (section 7):
// keeps the table editor simple while still giving numeric columns like
// "IE / kJ mol⁻¹" or a Charge column of "+1"/"-2" sensible, consistent
// right-alignment regardless of sign.
const NUMERIC_CELL_RE = /^[\s0-9.,+\-−±]+$/;
function looksNumeric(value) {
  const stripped = String(value ?? "")
    .replace(/⟦math:[\s\S]*?⟧/g, "")
    .replace(/\\\[[\s\S]*?\\\]/g, "")
    .replace(/\\\([\s\S]*?\\\)/g, "")
    .trim();
  return stripped.length > 0 && NUMERIC_CELL_RE.test(stripped);
}

/** Shared, structural table renderer for the reusable Table content
 * element — used by every block that can contain a table (Worked
 * Example, Key Idea, Real-Life Connection, Reveal, Compare & Contrast's
 * pasted-table path) AND by the Admin editor's own inline preview, so
 * Admin preview and Student Learn always render identically (same
 * component, same props). Renders a real <table>, never divs pretending
 * to be one, with an overflow-x-auto wrapper so a wide table scrolls
 * inside its own box instead of pushing the page wider (section 8). Cell
 * content goes through the ONE shared scientific-content pipeline
 * (ScientificText / renderScientificText) — no separate math renderer for
 * table cells. */
export default function TableView({ table, className = "" }) {
  const headers = table?.headers ?? [];
  const rows = table?.rows ?? [];
  if (!headers.length && !rows.length) return null;

  const hasHeaderRow = table?.hasHeaderRow !== false && headers.length > 0 && headers.some((h) => String(h ?? "").trim());
  const hasHeaderColumn = Boolean(table?.hasHeaderColumn);
  const columnCount = Math.max(headers.length, ...rows.map((r) => r.length), 1);

  return (
    <div className={`max-w-full overflow-x-auto rounded-md border border-[var(--color-line)] ${className}`}>
      <table className="w-full min-w-max border-collapse text-left text-sm">
        {hasHeaderRow && (
          <thead className="bg-[var(--color-paper-raised)]">
            <tr>
              {Array.from({ length: columnCount }, (_, i) => headers[i] ?? "").map((h, i) => (
                <th
                  key={i}
                  scope="col"
                  className={`border-b border-r border-[var(--color-line)] px-3 py-2 font-semibold text-[var(--color-ink)] last:border-r-0 ${looksNumeric(h) ? "text-right" : "text-left"}`}
                >
                  <ScientificText text={h} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((row, r) => (
            <tr key={r} className="text-[var(--color-ink-soft)]">
              {Array.from({ length: columnCount }, (_, c) => row[c] ?? "").map((cell, c) => {
                const isRowHeader = hasHeaderColumn && c === 0;
                return (
                  <td
                    key={c}
                    className={`border-b border-r border-[var(--color-line)] px-3 py-2 align-top last:border-r-0 [&:last-child]:border-b ${
                      isRowHeader ? "font-medium text-[var(--color-ink)]" : ""
                    } ${looksNumeric(cell) && !isRowHeader ? "text-right" : "text-left"}`}
                  >
                    <ScientificText text={cell} />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
