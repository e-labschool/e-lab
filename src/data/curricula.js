// Data-driven curriculum → subject configuration for the student landing
// page. Adding a new curriculum or subject later means adding an entry
// here — never touching the page component's JSX.
export const CURRICULA = [
  {
    id: "ib-dp",
    name: "IB Diploma Programme",
    available: true,
    subjects: [
      {
        id: "chemistry",
        name: "Chemistry",
        available: true,
        path: "/student/learn",
      },
      // Future subjects (Physics, Biology, ...) are added here, each
      // with `available: false` until genuinely ready — never shown as
      // a "Coming Soon" card in the meantime, per the current release.
    ],
  },
  // Future curricula (IB MYP, IGCSE, ...) are added here the same way.
];

// ---------------------------------------------------------------------------
// PLATFORM_CURRICULA -- the curricula the PLATFORM supports (sign-up, profile chips, simulation filter).
// This is separate from CURRICULA above, which drives the student landing page's curriculum -> subject picker
// and is intentionally left untouched.  One list, one place: add a curriculum here and every consumer follows.
//
// `status` is honest about content, not ambition:
//   'available' -> e-Lab has lessons / simulations for it today (verified: ONLY the IB Diploma Programme; every lesson,
//                  question set and simulation syllabus code in the repo is IB DP Chemistry 2025).
//   'planned'   -> people can say they are interested (so we know who to build for), but there is no content yet.
// Flip a status to 'available' only when real content exists -- nothing else needs to change.
//
// `profileName` is the exact text stored in profiles.curriculum (set by the existing sign-up trigger from
// user_metadata.curriculum).  IB DP keeps its historical string so existing rows and admin screens stay consistent.
// ---------------------------------------------------------------------------
export const CURRICULUM_STATUS = Object.freeze({ AVAILABLE: "available", PLANNED: "planned" });
export const DEFAULT_CURRICULUM_ID = "ib-dp";
export const OTHER_CURRICULUM_ID = "other";
export const OTHER_NAME_MAX = 60;

export const PLATFORM_CURRICULA = Object.freeze([
  Object.freeze({ id: "ib-dp", label: "IB Diploma (DP)", shortLabel: "IB DP", profileName: "IB Diploma Programme", status: CURRICULUM_STATUS.AVAILABLE }),
  Object.freeze({ id: "cambridge-igcse", label: "Cambridge IGCSE", shortLabel: "IGCSE", profileName: "Cambridge IGCSE", status: CURRICULUM_STATUS.PLANNED }),
  Object.freeze({ id: "cambridge-as-a-level", label: "Cambridge AS & A Level", shortLabel: "AS & A Level", profileName: "Cambridge AS & A Level", status: CURRICULUM_STATUS.PLANNED }),
  Object.freeze({ id: "other", label: "Other", shortLabel: "Other", profileName: "Other", status: CURRICULUM_STATUS.PLANNED, allowsFreeText: true }),
]);

const BY_ID = new Map(PLATFORM_CURRICULA.map((c) => [c.id, c]));
export const getPlatformCurriculum = (id) => BY_ID.get(id) ?? null;
export const isCurriculumAvailable = (id) => BY_ID.get(id)?.status === CURRICULUM_STATUS.AVAILABLE;

/** Keep only known ids, de-duplicated, in the order of PLATFORM_CURRICULA. */
export function normaliseCurriculumIds(ids) {
  const wanted = new Set(Array.isArray(ids) ? ids : []);
  return PLATFORM_CURRICULA.filter((c) => wanted.has(c.id)).map((c) => c.id);
}

export const cleanOtherName = (text) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, OTHER_NAME_MAX);

/** Students choose exactly one curriculum, teachers one or more.  Never empty: falls back to IB DP. */
export function curriculaForRole(role, ids) {
  const clean = normaliseCurriculumIds(ids);
  const list = clean.length ? clean : [DEFAULT_CURRICULUM_ID];
  return role === "teacher" ? list : list.slice(0, 1);
}

/** Display text for one curriculum id ("Other (Swiss Matura)" when a name was given). */
export function curriculumDisplay(id, otherName = "", { short = false } = {}) {
  const c = BY_ID.get(id);
  if (!c) return "";
  const base = short ? c.shortLabel : c.label;
  const name = id === OTHER_CURRICULUM_ID ? cleanOtherName(otherName) : "";
  return name ? `${base} (${name})` : base;
}

/**
 * The user_metadata written at sign-up (Supabase options.data) -- NO database migration needed:
 *   curricula          string[]  stable ids                       (read back from user.user_metadata)
 *   curriculum_other   string    free-text name, only with 'other'
 *   curriculum         string    ", "-joined profileNames          (the EXISTING key the profiles trigger copies into
 *                                profiles.curriculum; "IB Diploma Programme" for the default, exactly as before)
 */
export function buildCurriculumMetadata(role, ids, otherName = "") {
  const list = curriculaForRole(role, ids);
  const meta = { curricula: list, curriculum: list.map((id) => BY_ID.get(id).profileName).join(", ") };
  const other = list.includes(OTHER_CURRICULUM_ID) ? cleanOtherName(otherName) : "";
  if (other) { meta.curriculum_other = other; meta.curriculum = meta.curriculum.replace("Other", `Other (${other})`); }
  return meta;
}

/**
 * Read the chosen curricula back for display.  Prefers user_metadata.curricula; for older accounts falls back to parsing
 * profiles.curriculum text.  Returns { ids, other, legacyText }: `legacyText` is set only when the stored text matches no
 * known curriculum, so the UI can still show what is on file instead of hiding it.
 */
export function readCurricula({ userMetadata = null, profileCurriculum = "" } = {}) {
  const fromMeta = normaliseCurriculumIds(userMetadata?.curricula);
  if (fromMeta.length) return { ids: fromMeta, other: cleanOtherName(userMetadata?.curriculum_other), legacyText: "" };
  const text = String(profileCurriculum ?? "").trim();
  if (!text) return { ids: [], other: "", legacyText: "" };
  const ids = []; let other = ""; let unknown = false;
  for (const part of text.split(/,\s*(?![^()]*\))/).map((p) => p.trim()).filter(Boolean)) {
    const m = /^Other(?:\s*\((.*)\))?$/.exec(part);
    const hit = m ? BY_ID.get(OTHER_CURRICULUM_ID) : PLATFORM_CURRICULA.find((c) => c.profileName === part || c.label === part || c.shortLabel === part);
    if (hit) { ids.push(hit.id); if (m?.[1]) other = cleanOtherName(m[1]); } else unknown = true;
  }
  return { ids: normaliseCurriculumIds(ids), other, legacyText: unknown && !ids.length ? text : "" };
}
