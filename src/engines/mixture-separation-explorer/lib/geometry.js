// Shared geometry utilities so that moving material (streams, drops,
// vapour) is ALWAYS positioned from the same anchor points the
// apparatus itself is drawn from -- never a separately-guessed
// coordinate. This is what prevents the class of bug where a pour
// stream visibly misses the funnel it's supposed to enter.

/** Rotates `point` by `angleDeg` around `pivot`, matching SVG's own
 * rotate(angle, cx, cy) transform convention exactly -- verified
 * numerically (including that rotating back by -angleDeg returns the
 * original point) before use, so an apparatus's rendered rotation and
 * its computed anchor points can never disagree. */
export function rotatePoint(point, pivot, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const dx = point.x - pivot.x;
  const dy = point.y - pivot.y;
  return { x: pivot.x + dx * cos - dy * sin, y: pivot.y + dx * sin + dy * cos };
}

/** A beaker's key anchor points in SCENE coordinates, accounting for
 * any applied rotation/pivot -- computed with the exact same geometry
 * the Beaker component itself draws from, so `lip` always matches
 * where the drawn rim actually is on screen. */
export function getBeakerAnchors({ x, y, width, height, rotation = 0, pivotX, pivotY }) {
  const pivot = { x: pivotX ?? x + width / 2, y: pivotY ?? y + height };
  const lipLocal = { x: x + width * 0.92, y: y + 1 };
  const baseLocal = { x: x + width / 2, y: y + height };
  return {
    lip: rotation ? rotatePoint(lipLocal, pivot, rotation) : lipLocal,
    base: rotation ? rotatePoint(baseLocal, pivot, rotation) : baseLocal,
  };
}

/** A funnel's key anchor points -- `opening` (top rim centre, where a
 * stream should aim) and `stemEnd` (bottom of the stem, where filtrate
 * drips out into whatever sits below it). */
export function getFunnelAnchors({ x, y, topWidth, coneHeight, stemHeight }) {
  const cx = x + topWidth / 2;
  return {
    opening: { x: cx, y: y + 1 },
    stemEnd: { x: cx, y: y + coneHeight + stemHeight },
  };
}
