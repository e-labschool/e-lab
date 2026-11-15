import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Plus, Minus, Copy, Trash2, Eye, EyeOff, Pencil } from "lucide-react";
import { getLayout, getWrap, minSpanFor, isFullOnly } from "../../../../lib/blockLayout.js";
import { blockLabel } from "../../../../lib/blockLayoutOps.js";
import { WIDTH_LABELS, WIDTH_PRESETS } from "./editorUtils.js";

const seg = (on) => `min-h-9 flex-1 rounded-md border px-2 py-1.5 text-xs font-semibold transition-colors ${on ? "border-[var(--color-indigo)] bg-[var(--color-indigo)] text-white" : "border-[var(--color-line)] bg-[var(--color-paper-raised)] text-[var(--color-ink-soft)] hover:border-[var(--color-ink)]/40"} disabled:opacity-40`;
const btn = "inline-flex min-h-9 items-center justify-center gap-1 rounded-md border border-[var(--color-line)] bg-[var(--color-paper-raised)] px-2.5 py-1.5 text-xs font-medium text-[var(--color-ink)] hover:border-[var(--color-ink)]/40 disabled:opacity-40";
const h = "mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)] first:mt-0";

/** Right-hand settings for the selected block. Every control is a real button/select (no drag needed). */
export default function LayoutSettingsPanel({ blocks, block, onOp, onEdit, onDuplicate, onDelete, onToggleVisible }) {
  if (!block) {
    return (
      <aside aria-label="Block settings" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Selected block</p>
        <p className="mt-2 text-sm text-[var(--color-ink-soft)]">Select a block on the page to change its width, position and how it behaves on phones. Keyboard: Tab to a block, then Alt+Arrow keys to move it and Alt+Shift+Left/Right to resize.</p>
      </aside>
    );
  }
  const id = block.id;
  const layout = getLayout(block);
  const span = layout?.span ?? 12;
  const min = minSpanFor(block.block_type);
  const full = isFullOnly(block.block_type);
  const wrap = getWrap(blocks, id);
  const align = layout?.align ?? "start";
  const position = layout?.position ?? "left";
  const mobile = layout?.mobile ?? "default";
  return (
    <aside aria-label="Block settings" data-testid="settings-panel" className="rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-ink-faint)]">Selected: {blockLabel(block)}</p>

      {full ? (
        <p className="mt-2 rounded-md bg-[var(--color-paper)] p-2 text-xs text-[var(--color-ink-soft)]">This block type is always full width and cannot sit beside other blocks. You can still move it up or down.</p>
      ) : (
        <>
          <p className={h}>Width on the page <span className="font-normal normal-case">({span} of 12 columns)</span></p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Width on the page">
            {WIDTH_PRESETS.map((p) => (
              <button key={p} type="button" aria-pressed={span === p} aria-label={`Width ${p} of 12 columns`} disabled={p < min} onClick={() => onOp("span", id, { span: p })} className={`${seg(span === p)} min-w-11 flex-none`}>{WIDTH_LABELS[p]}</button>
            ))}
          </div>
          <div className="mt-2 flex gap-1.5">
            <button type="button" className={`${btn} flex-1`} onClick={() => onOp("narrower", id)}><Minus size={13} /> Narrower</button>
            <button type="button" className={`${btn} flex-1`} onClick={() => onOp("wider", id)}><Plus size={13} /> Wider</button>
          </div>

          <p className={h}>Position</p>
          <div className="flex gap-1.5" role="group" aria-label="Position">
            {[["left", "Left"], ["center", "Centre"], ["right", "Right"]].map(([v, l]) => <button key={v} type="button" aria-pressed={position === v} onClick={() => onOp("position", id, { value: v })} className={seg(position === v)}>{l}</button>)}
          </div>
          {wrap === "beside" && span === 12 && <p className="mt-1 text-[11px] text-[var(--color-ink-faint)]">Position only matters when the row is narrower than the full page.</p>}

          <p className={h}>Text wrapping</p>
          <div className="flex gap-1.5" role="group" aria-label="Text wrapping">
            <button type="button" aria-pressed={wrap === "beside"} onClick={() => onOp("wrapBeside", id)} className={seg(wrap === "beside")}>Beside</button>
            <button type="button" aria-pressed={wrap === "stack"} onClick={() => onOp("wrapStack", id)} className={seg(wrap === "stack")}>Above/below</button>
          </div>

          <p className={h}>Vertical alignment</p>
          <div className="flex gap-1.5" role="group" aria-label="Vertical alignment">
            {[["start", "Top"], ["center", "Middle"], ["end", "Bottom"]].map(([v, l]) => <button key={v} type="button" aria-pressed={align === v} onClick={() => onOp("align", id, { value: v })} className={seg(align === v)}>{l}</button>)}
          </div>

          <p className={h}><label htmlFor="mobile-order">On phones</label></p>
          <select id="mobile-order" value={mobile} onChange={(e) => onOp("mobile", id, { value: e.target.value })} className="w-full rounded-md border border-[var(--color-line)] bg-[var(--color-paper)] px-2 py-2 text-sm text-[var(--color-ink)]">
            <option value="default">Stack in page order</option>
            <option value="first">Show this block first in its row</option>
            <option value="last">Show this block last in its row</option>
          </select>
        </>
      )}

      <p className={h}>Move</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button type="button" className={btn} onClick={() => onOp("up", id)}><ArrowUp size={13} /> Move up</button>
        <button type="button" className={btn} onClick={() => onOp("down", id)}><ArrowDown size={13} /> Move down</button>
        {!full && <button type="button" className={btn} onClick={() => onOp("left", id)}><ArrowLeft size={13} /> Move left</button>}
        {!full && <button type="button" className={btn} onClick={() => onOp("right", id)}><ArrowRight size={13} /> Move right</button>}
        {!full && <button type="button" className={btn} onClick={() => onOp("besidePrev", id)}>Beside previous</button>}
        {!full && <button type="button" className={btn} onClick={() => onOp("besideNext", id)}>Beside next</button>}
        {!full && <button type="button" className={`${btn} col-span-2`} onClick={() => onOp("separate", id)} disabled={wrap !== "beside"}>Put on its own row</button>}
      </div>

      <div className="mt-4 flex flex-wrap gap-1.5 border-t border-[var(--color-line)] pt-3">
        <button type="button" className={btn} onClick={() => onEdit(id)}><Pencil size={13} /> Edit content</button>
        <button type="button" className={btn} onClick={() => onDuplicate(id)}><Copy size={13} /> Duplicate</button>
        <button type="button" className={btn} onClick={() => onToggleVisible(id)}>{block.visible ? <EyeOff size={13} /> : <Eye size={13} />} {block.visible ? "Hide" : "Show"}</button>
        <button type="button" className={`${btn} text-[var(--color-coral)]`} onClick={() => onDelete(id)}><Trash2 size={13} /> Delete</button>
      </div>
    </aside>
  );
}
