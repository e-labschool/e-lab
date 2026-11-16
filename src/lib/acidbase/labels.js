// Collision-free label placement for chart annotations (pure). Each label is tried at increasing distances around its
// anchor; the first box that stays inside the plot, avoids every earlier label and every obstacle point wins.
// A leader line is requested whenever the label ends up away from its anchor.
export const CHAR_W = 6.1; // average glyph width in px at 11 px sans-serif (conservative)
export const LINE_H = 13;

const ANGLES = [-45, 0, 45, -90, 90, -135, 180, 135]; // degrees; 0 = to the right, negative = up (screen coordinates)

const overlap = (a, b, pad = 2) => a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y;
const hitsPoint = (box, pts, pad) => pts.some((p) => p.x > box.x - pad && p.x < box.x + box.w + pad && p.y > box.y - pad && p.y < box.y + box.h + pad);

/**
 * items: [{ id, x, y, text, lines? }] anchors in px. bounds: { x, y, w, h } plot rectangle.
 * obstacles: [{x,y}] points that labels should not sit on (the sampled curves), fixed: [{x,y,w,h}] reserved boxes.
 * Returns [{ id, box, textX, textY (first baseline), leader: {x1,y1,x2,y2} | null, placed }].
 */
export function placeLabels(items, { bounds, obstacles = [], fixed = [] }) {
  const placed = [];
  const out = [];
  for (const it of items) {
    const lines = it.lines ?? [it.text];
    const w = Math.max(...lines.map((l) => l.length)) * CHAR_W + 8;
    const h = lines.length * LINE_H + 4;
    let chosen = null;
    for (let r = 10; r <= 200 && !chosen; r += 10) {
      for (const a of ANGLES) {
        const rad = (a * Math.PI) / 180;
        const cx = it.x + Math.cos(rad) * (r + (Math.cos(rad) > 0.3 ? 0 : w / 2 * Math.abs(Math.cos(rad))));
        const cy = it.y + Math.sin(rad) * (r + h / 2);
        const box = { x: Math.cos(rad) > 0.3 ? cx : Math.cos(rad) < -0.3 ? cx - w : cx - w / 2, y: cy - h / 2, w, h };
        if (box.x < bounds.x || box.y < bounds.y || box.x + box.w > bounds.x + bounds.w || box.y + box.h > bounds.y + bounds.h) continue;
        if (placed.some((p) => overlap(p, box)) || fixed.some((f) => overlap(f, box, 0))) continue;
        if (hitsPoint(box, obstacles, 2) || (box.x < it.x + 4 && box.x + box.w > it.x - 4 && box.y < it.y + 4 && box.y + box.h > it.y - 4)) continue;
        chosen = box; break;
      }
    }
    const box = chosen ?? { x: Math.min(Math.max(it.x + 8, bounds.x), bounds.x + bounds.w - w), y: Math.min(Math.max(it.y - h - 8, bounds.y), bounds.y + bounds.h - h), w, h };
    placed.push(box);
    const cx = Math.min(Math.max(it.x, box.x), box.x + box.w);
    const cy = Math.min(Math.max(it.y, box.y), box.y + box.h);
    const far = Math.hypot(cx - it.x, cy - it.y) > 14;
    out.push({ id: it.id, box, lines, textX: box.x + 4, textY: box.y + LINE_H - 1, leader: far ? { x1: it.x, y1: it.y, x2: cx, y2: cy } : null, placed: !!chosen });
  }
  return out;
}
