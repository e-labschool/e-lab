import * as L from "../../../lib/blockLayout.js";
import * as C from "../../../lib/blockCanvas.js";
import { getLearnBlockDisplayLabel } from "../../../data/learnBlockRegistry.jsx";
import BlockTile from "./editor/BlockTile.jsx";
import { UNIT, GAP } from "./editor/editorUtils.js";

const noop = () => {};
/** Read-only compact view of a lesson (the same rectangles the editor shows). Used by Review mode. */
export default function CompactLesson({ blocks, checkCount = 0 }) {
  const visible = blocks.filter((b) => b.visible !== false);
  const props = (b, extra) => ({ block: b, label: { typeLabel: getLearnBlockDisplayLabel(b).typeLabel }, selected: false, onSelect: noop, onEdit: noop, onOp: noop, onToggleCollapsed: noop, onDuplicate: noop, onDelete: noop, onToggleVisible: noop, onSaveLibrary: noop, onResizeDown: noop, onGripDown: noop, placement: "", checkCount: b.block_type === "check_understanding" ? checkCount : 0, full: L.isFullOnly(b.block_type), ...extra });
  if (C.isCanvas(visible)) {
    const pls = C.placements(visible); const bottom = pls.reduce((m, p) => Math.max(m, p.gr + p.rs), 1);
    return (
      <div className="relative" data-testid="compact-canvas" style={{ height: bottom * UNIT }}>
        {visible.map((b) => { const p = pls.find((x) => x.id === b.id); return (
          <div key={b.id} className="absolute" style={{ left: `${((p.col - 1) / 12) * 100}%`, width: `${(p.span / 12) * 100}%`, top: (p.gr - 1) * UNIT, height: p.rs * UNIT, padding: 3 }}>
            <BlockTile {...props(b, { variant: "canvas", height: "100%", span: p.span, canvas: true })} />
          </div>); })}
      </div>
    );
  }
  return (
    <div className="flex flex-col" style={{ gap: GAP }} data-testid="compact-classic">
      {L.buildRows(visible).map((row) => (
        <div key={row.id} className="grid items-start" style={{ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", gap: GAP }}>
          {row.cells.map((cell) => <div key={cell.block.id} style={{ gridColumn: `${cell.start ?? "auto"} / span ${cell.span}`, minWidth: 0 }}><BlockTile {...props(cell.block, { variant: "classic", height: C.getUiHeight(cell.block) * UNIT, span: cell.span })} /></div>)}
        </div>
      ))}
    </div>
  );
}
