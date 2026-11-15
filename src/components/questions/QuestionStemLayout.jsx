import { normalizePlacement, stemColumns } from "../../lib/questionLayout.js";

/** Places a question's visual (`media`) next to / above / below its stem text, using the same responsive
 * 12-column rows as lessons (styles/index.css: side-by-side only when the column is >= 480px wide, otherwise stacked
 * with the visual first). Only called when the question HAS a placement; callers keep their legacy markup otherwise. */
export default function QuestionStemLayout({ placement, media, stem, gap }) {
  const p = normalizePlacement(placement);
  const cols = stemColumns(p);
  if (!cols) return <>{media}{stem}</>;
  const mediaCell = (
    <div key="media" className="lb-cell" data-stem-media data-mobile={cols.phoneMediaFirst ? "first" : "default"} style={{ "--lb-span": cols.mediaSpan }}>{media}</div>
  );
  const stemCell = <div key="stem" className="lb-cell" data-stem-text style={{ "--lb-span": cols.stemSpan }}>{stem}</div>;
  const ordered = cols.mediaFirst ? [mediaCell, stemCell] : [stemCell, mediaCell];
  return (
    <div className="lb-stem" data-testid="stem-layout" data-side={p.side} data-width={p.width}>
      <div className="lb-row" style={gap ? { "--lb-gap": gap } : undefined}>{ordered}</div>
    </div>
  );
}
