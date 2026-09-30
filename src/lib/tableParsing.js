// ============================================================================
// Shared tabular-paste parsing — turns clipboard data (a real HTML <table>
// from Word/Google Docs, or tab/comma-separated text from Excel/Sheets)
// into a plain { headers, rows } matrix.
//
// Extracted from the Compare & Contrast block's original paste handler so
// every block that wants "paste a table" support (Compare & Contrast, the
// generic Table content element used by Worked Example and others) shares
// exactly one parser instead of each reimplementing its own.
// ============================================================================

/** Parses clipboard data into a rectangular string matrix, or returns null
 * when nothing table-shaped could be detected. Never throws. */
export function parseTabularPaste({ html = "", text = "" }) {
  let matrix = [];

  // Word/Google Docs commonly place a real HTML <table> on the clipboard.
  // Prefer it because it preserves cell boundaries even when cell text
  // contains spaces.
  if (html && typeof DOMParser !== "undefined") {
    try {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const table = doc.querySelector("table");
      if (table) {
        matrix = Array.from(table.querySelectorAll("tr")).map((row) =>
          Array.from(row.querySelectorAll("th,td")).map((cell) => (cell.innerText || cell.textContent || "").trim())
        );
      }
    } catch {
      matrix = [];
    }
  }

  // Excel/Google Sheets copy cells as tab-separated rows. Also accept a
  // pipe-delimited Markdown table, or CSV-ish pasted text as a
  // convenience, without trying to be a full CSV importer.
  if (!matrix.length && text) {
    let lines = text.replace(/\r/g, "").split("\n").filter((line) => line.trim().length);
    // A Markdown table's separator row (e.g. |---|---|) carries no data —
    // drop it before splitting on the pipe delimiter.
    lines = lines.filter((line) => !/^\s*\|?[\s:|-]+\|?\s*$/.test(line) || !line.includes("-"));
    const delimiter = lines.some((line) => line.includes("\t"))
      ? "\t"
      : lines.some((line) => line.includes("|"))
        ? "|"
        : lines.some((line) => line.includes(","))
          ? ","
          : null;
    if (delimiter) {
      matrix = lines.map((line) => {
        let cells = line.split(delimiter).map((cell) => cell.trim());
        // A Markdown row typically has leading/trailing empty cells from
        // the outer pipes ("| a | b |" -> ["", "a", "b", ""]).
        if (delimiter === "|") {
          if (cells[0] === "") cells = cells.slice(1);
          if (cells[cells.length - 1] === "") cells = cells.slice(0, -1);
        }
        return cells;
      });
    }
  }

  matrix = matrix
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some(Boolean));

  if (matrix.length < 2) return null;
  const width = Math.max(...matrix.map((row) => row.length));
  if (width < 2) return null;
  const normalized = matrix.map((row) => Array.from({ length: width }, (_, i) => row[i] ?? ""));

  // First row is treated as the header row — the common shape for a table
  // copied from Word/Excel/Markdown: Property | A | B | ...
  return { headers: normalized[0], rows: normalized.slice(1) };
}

/** A blank table in the shared { headers, rows, hasHeaderRow,
 * hasHeaderColumn } shape used by the reusable Table content element. */
export function createEmptyTable() {
  return {
    headers: ["", ""],
    rows: [["", ""]],
    hasHeaderRow: true,
    hasHeaderColumn: false,
  };
}

/** Normalizes a parsed/pasted { headers, rows } matrix into the full
 * Table content-element shape (adds the display flags). */
export function tableFromParsed(parsed) {
  if (!parsed?.headers?.length) return null;
  return {
    headers: parsed.headers,
    rows: parsed.rows ?? [],
    hasHeaderRow: true,
    hasHeaderColumn: false,
  };
}
