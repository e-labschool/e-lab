// Single source of truth for e-Lab's copyright wording/year — every
// footer, simulation frame, and exported document reads from here, so
// the text only ever needs to change in one place.
export const COPYRIGHT_YEAR = 2026;
export const COPYRIGHT_HOLDER = "e-Lab";

export const COPYRIGHT_TEXT = `\u00A9 ${COPYRIGHT_YEAR} ${COPYRIGHT_HOLDER}. All rights reserved.`;
// A slightly shorter form for tight spaces (simulation frames, PDF/Word
// footers) — same wording, middle-dot separator instead of a period.
export const COPYRIGHT_TEXT_COMPACT = `\u00A9 ${COPYRIGHT_YEAR} ${COPYRIGHT_HOLDER} \u00B7 All rights reserved`;

/** For content e-Lab GENERATED (exported PDFs/Word docs) rather than the
 * live site itself -- deliberately does not claim ownership over
 * teacher-authored question content, only states the tool used. */
export const GENERATED_DOCUMENT_FOOTER = `Generated using ${COPYRIGHT_HOLDER} \u00B7 ${COPYRIGHT_TEXT}`;
