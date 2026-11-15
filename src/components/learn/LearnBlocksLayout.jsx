import { segmentBlocks } from "../../lib/blockLayout.js";

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
