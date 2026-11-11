import { Plus, X } from "lucide-react";
import { MAX_ROWS } from "../state/structureState.js";

/** A compact table the student fills in. columns: [{ field, label, placeholder, width }]; rows are objects. Controlled by the store. */
export default function RowsTable({ table, columns, rows, onCell, onAdd, onRemove, caption, testId, numbered = false }) {
  const tpl = `${numbered ? "2.9rem " : ""}${columns.map((c) => `${c.width ?? 1}fr`).join(" ")} 1.7rem`;
  return (
    <div className="st-table" role="group" aria-label={caption} data-testid={testId}>
      <div className="st-trow st-trow--head" style={{ gridTemplateColumns: tpl }} role="row">
        {numbered && <span className="st-th" role="columnheader">Signal</span>}
        {columns.map((c) => <span key={c.field} className="st-th" role="columnheader">{c.label}</span>)}
        <span className="st-th" aria-hidden="true" />
      </div>
      {rows.map((r, i) => (
        <div key={i} className="st-trow" style={{ gridTemplateColumns: tpl }} role="row" data-testid={`${testId}-row-${i}`}>
          {numbered && <span className="st-rownum">{i + 1}</span>}
          {columns.map((c) => (
            <input key={c.field} type="text" className="st-cell" value={r[c.field] ?? ""} placeholder={c.placeholder ?? ""} aria-label={`${c.label}, row ${i + 1}`}
              onChange={(e) => onCell(i, c.field, e.target.value)} data-testid={`${testId}-${c.field}-${i}`} autoComplete="off" spellCheck="false" />
          ))}
          <button type="button" className="sim-btn st-xbtn" onClick={() => onRemove(i)} disabled={rows.length <= 1} aria-label={`Remove row ${i + 1}`} title="Remove this row" data-testid={`${testId}-remove-${i}`}><X size={13} aria-hidden="true" /></button>
        </div>
      ))}
      <button type="button" className="sim-btn st-tbtn st-addrow" onClick={onAdd} disabled={rows.length >= MAX_ROWS} data-testid={`${testId}-add`}><Plus size={14} aria-hidden="true" /> <span>Add row</span></button>
    </div>
  );
}
