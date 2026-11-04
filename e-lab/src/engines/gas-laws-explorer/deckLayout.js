// Gas Laws Explorer -- placement of the instrument deck (pure geometry; no DOM, no physics).
// The deck is a plinth that continues the cylinder's base drum downwards, so it is positioned
// from the renderer's own layout (computeLayout) and the drum's drawn bottom edge (BASE_H - 3).
import { BASE_H, computeLayout } from "./render.js";

export const DECK_H = 50; // px: plinth height (two instruments)
export const DECK_RESERVE = 34; // px: minimum space taken from the canvas box under the cylinder
export const FOOT_H = 18; // px: caption line at the bottom edge of the chamber
const FOOT_CLEAR_X = 224; // deck whose left edge is further right than this cannot touch the caption

/**
 * chamberW / chamberH: inner size of the chamber box (px). Returns the deck rectangle
 * (left, top, width, height) inside that box plus `reserve`, the bottom inset (px) that the
 * canvas box must leave free so the cylinder is drawn clear of the deck.
 */
export function computeDeckLayout(chamberW, chamberH) {
  const cssW = Math.max(60, Math.floor(chamberW));
  let out = null;
  for (let reserve = DECK_RESERVE; reserve <= DECK_RESERVE + 120; reserve += 2) {
    const cssH = Math.max(60, Math.floor(chamberH - reserve));
    const L = computeLayout(cssW, cssH);
    const left = L.x0 - 7 * L.s;
    const width = L.x1 + 7 * L.s - left;
    const top = L.floorY + (BASE_H - 3) * L.s; // straight lower edge of the drawn base drum
    out = { left: Math.round(left), top: Math.round(top), width: Math.round(width), height: DECK_H, reserve };
    const clearance = left > FOOT_CLEAR_X ? 2 : FOOT_H + 2;
    if (top + DECK_H <= chamberH - clearance) break;
  }
  return out;
}
