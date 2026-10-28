// Shared 2D Bohr-diagram geometry (pure functions; world units, not pixels).
export const NUCLEUS_R = 13;
export const ELECTRON_R = 4.3;
/** Electron dot radius (world units) for an atom drawn at `scale`; grows slowly so big atoms stay readable. */
export const dotRadius = (scale) => Math.max(3.2, Math.min(5.8, 3.6 + scale));
export const ringRadius = (k) => 15 + 13 * k; // shell k = 1..n
const ORDER8 = [0, 4, 2, 6, 1, 5, 3, 7]; // electrons spread around an octet ring before pairing up

export const easeInOut = (t) => { const x = Math.min(1, Math.max(0, t)); return x * x * (3 - 2 * x); };
export const clamp01 = (t) => Math.min(1, Math.max(0, t));
export const lerp = (a, b, t) => a + (b - a) * t;

/** Slot count of shell k (1-based): outer valence shells use a full duet/octet of slots so vacancies are visible. */
export function slotCount(k, count, isOuter) {
  if (!isOuter) return count;
  if (k === 1) return Math.max(2, count);
  return Math.max(8, count);
}
export function slotIndexFor(i, S) { return S === 8 ? ORDER8[i] : i; }

/** Angle of a slot on shell k at time `time` (shells counter-rotate slowly; `time` = 0 when paused/reduced motion). */
export function slotAngle(k, slot, S, time = 0) {
  const base = -Math.PI / 2 + 0.55 * k;
  const spin = (k % 2 ? 1 : -1) * time * (0.55 / Math.sqrt(k));
  return base + (2 * Math.PI * slot) / S + spin;
}

export function polar(cx, cy, r, ang) { return { x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) }; }

/** Electron list of an atom from its shell counts: [{ k, i, slot, S, core }] (core = not in the outer shell). */
export function electronsOfShells(shells) {
  const out = [];
  const n = shells.length;
  shells.forEach((count, idx) => {
    const k = idx + 1;
    const isOuter = k === n;
    const S = slotCount(k, count, isOuter);
    for (let i = 0; i < count; i += 1) out.push({ k, i, slot: slotIndexFor(i, S), S, core: !isOuter });
  });
  return out;
}

/** Pretty shell arrangement text from counts of non-empty shells. */
export const arrangementText = (counts) => counts.filter((c) => c > 0).join(",");
