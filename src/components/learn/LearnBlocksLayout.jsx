import { segmentBlocks } from "../../lib/blockLayout.js";
import { isCanvas, canvasGrid } from "../../lib/blockCanvas.js";

/** Lays out already-filtered, already-paginated lesson blocks.
 *
 * No block has layout data (every existing lesson)  ->  the exact legacy markup:
 *   <div class="mt-6 space-y-5"> ...blocks... </div>
 * Otherwise: plain blocks keep flowing exactly as before inside their own
 * `space-y-5` group, and blocks with a layout are placed on 12-column rows that
 * collapse to one column on narrow containers (CSS in styles/index.css).
 *
 * renderBlock(block, { inCell }) lets the caller keep its own block switch
 * (e.g. Check Your Understanding vs LearnBlockRenderer). */
export default function LearnBlocksLayout({ blocks, renderBlock, className = "mt-6" }) {
  // Canvas lessons (blocks with content.layout.col/gr): one 12-column grid, natural heights, reading order on narrow screens.
  if (isCanvas(blocks)) {
    const cells = canvasGrid(blocks);
    return (
      <div className={`lb-root ${className}`} data-testid="lesson-layout" data-layout="canvas">
        <div className="lb-grid">
          {cells.map((cell) => (
            <div key={cell.block.id} className="lb-gcell" data-block-id={cell.block.id} style={{ "--lb-col": cell.col, "--lb-span": cell.span, "--lb-r": cell.r, "--lb-rs": cell.rs }}>
              {renderBlock(cell.block, { inCell: true })}
            </div>
          ))}
        </div>
      </div>
    );
  }
  const segments = segmentBlocks(blocks);
  if (segments.length === 1 && segments[0].kind === "flow") {
    return <div className={`${className} space-y-5`}>{segments[0].blocks.map((block) => renderBlock(block, { inCell: false }))}</div>;
  }
  return (
    <div className={`lb-root ${className} flex flex-col gap-5`} data-testid="lesson-layout">
      {segments.map((segment, si) =>
        segment.kind === "flow" ? (
          <div key={`f-${segment.blocks[0].id}-${si}`} className="space-y-5">{segment.blocks.map((block) => renderBlock(block, { inCell: false }))}</div>
        ) : (
          <div key={segment.row.id} className="lb-row" data-row={segment.row.id}>
            {segment.row.cells.map((cell) => (
              <div
                key={cell.block.id}
                className="lb-cell"
                data-block-id={cell.block.id}
                data-align={cell.align}
                data-mobile={cell.mobile}
                style={{ "--lb-span": cell.span, ...(cell.start ? { "--lb-start": cell.start } : {}) }}
              >
                {renderBlock(cell.block, { inCell: true })}
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
