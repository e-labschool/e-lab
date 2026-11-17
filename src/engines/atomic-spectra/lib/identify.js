// "Identify the unknown sample" task (AS-05): a seeded draw of one of the lamp elements. Pure.
import { SPECTRA } from "../data/spectra.js";
export const IDENTIFY_ELEMENTS = ["H", "Na", "He", "Ne", "Hg"];
export function makeUnknownSample(seed) { let a = ((seed * 2654435761) >>> 0) || 1; a = (a + 0x6d2b79f5) >>> 0; let t = Math.imul(a ^ (a >>> 15), a | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296; return IDENTIFY_ELEMENTS[Math.floor(r * IDENTIFY_ELEMENTS.length)]; }
export function checkGuess(sample, guess) { return { ok: sample === guess, name: SPECTRA[sample].name }; }
/** Clue text built from the real lines, never from the element name. */
export function clueFor(sample) { const l = SPECTRA[sample].lines; return `${l.length} line${l.length === 1 ? "" : "s"} between ${Math.min(...l.map((x) => x.wavelengthNm)).toFixed(0)} and ${Math.max(...l.map((x) => x.wavelengthNm)).toFixed(0)} nm.`; }
