import { supabase } from "./supabaseClient.js";

const BUCKET = "resources";
const SIGNED_URL_TTL_SECONDS = 60 * 10; // 10 minutes — short-lived, generated on demand, never a permanent link
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
];

// Centralizes every resources DB/Storage call — nothing elsewhere in the
// app talks to supabase.from("resources") or supabase.storage directly,
// per the brief's architecture requirement. Admin UI, Student Resources,
// and Teacher Resources all go through these functions.

export function validateResourceFile(file) {
  if (file.size > MAX_FILE_SIZE) return `File is too large (max ${MAX_FILE_SIZE / (1024 * 1024)}MB).`;
  if (!ALLOWED_MIME_TYPES.includes(file.type)) return "Unsupported file type — use PDF, DOCX, PPTX, or XLSX.";
  return null;
}

function safeStoragePath({ audience, category, file }) {
  // Never trust the uploaded filename directly as a storage path (path
  // traversal, collisions, unsafe characters) — generate a fresh unique
  // name, keep the original only as metadata (original_file_name column).
  const ext = file.name.includes(".") ? file.name.slice(file.name.lastIndexOf(".")) : "";
  const safeBase = crypto.randomUUID();
  return `${audience}/${category}/${safeBase}${ext}`;
}

export async function uploadResourceFile(file, { audience, category }) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const validationError = validateResourceFile(file);
  if (validationError) throw new Error(validationError);

  const path = safeStoragePath({ audience, category, file });
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (error) throw error;

  return {
    filePath: path,
    originalFileName: file.name,
    mimeType: file.type,
    fileSize: file.size,
  };
}

export async function deleteResourceFile(filePath) {
  if (!supabase || !filePath) return;
  const { error } = await supabase.storage.from(BUCKET).remove([filePath]);
  // A storage delete failure shouldn't block the caller from also trying
  // to delete/continue the DB row — surfaced to the caller to decide, not
  // thrown, so a partial failure (e.g. file already gone) doesn't crash
  // the whole delete flow.
  return error ?? null;
}

export async function getResourceSignedUrl(filePath) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, SIGNED_URL_TTL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
}

// ---- Resource rows ----

export async function listAllResourcesForAdmin() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

// Used by Student/Teacher Resources pages — RLS already restricts rows to
// published + audience-matching for the caller's role, so no extra
// filtering by status/audience is needed client-side; this just fetches
// what the caller is allowed to see.
export async function listVisibleResources() {
  if (!supabase) return [];
  const { data, error } = await supabase.from("resources").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createResource(fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("resources")
    .insert({ ...fields, created_by: userData?.user?.id })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateResource(id, fields) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  const { data, error } = await supabase.from("resources").update(fields).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

export async function deleteResource(resource) {
  if (!supabase) throw new Error("Not connected to Supabase.");
  if (resource.file_path) {
    await deleteResourceFile(resource.file_path);
  }
  const { error } = await supabase.from("resources").delete().eq("id", resource.id);
  if (error) throw error;
}

export const RESOURCE_TYPES = [
  "Notes", "Worksheet", "Revision Material", "Formula / Reference",
  "Practice Material", "Guide", "Presentation", "Data", "Other",
];

export const LEVEL_OPTIONS = ["SL", "HL", "SL & HL"];

export const STUDENT_CATEGORIES = [
  { id: "ib-documents", label: "IB Documents" },
  { id: "study-materials", label: "Study Materials" },
];
// Teacher Resources now has two categories (IB Resources / Worksheets &
// Other) rather than the single flat "teacher" bucket used previously —
// extending the existing category list, not building a second CMS.
export const TEACHER_CATEGORIES = [
  { id: "ib-resources", label: "IB Resources" },
  { id: "worksheets-other", label: "Worksheets & Other Resources" },
];

// A resource stores exactly ONE category value, chosen from whichever
// scheme the Admin form offered at save time — but Student and Teacher
// use entirely different category id schemes. For an audience="both"
// resource, THIS was the actual root cause of it disappearing from
// Teacher Resources: it was saved with a student-scheme category
// (e.g. "ib-documents"), and Teacher's tab filtering checked for an
// exact match against its own scheme ("ib-resources"/"worksheets-other"),
// which could never match. Rather than duplicating the resource row or
// forcing Admin to pick two categories, this mapping lets each side
// translate the OTHER scheme's category into its own equivalent tab.
const STUDENT_TO_TEACHER_CATEGORY = { "ib-documents": "ib-resources", "study-materials": "worksheets-other" };
const TEACHER_TO_STUDENT_CATEGORY = { "ib-resources": "ib-documents", "worksheets-other": "study-materials" };

/** The category id to match against THIS role's own tab list — maps
 * across schemes only when the stored category belongs to the other
 * scheme; otherwise returns it unchanged. */
export function getCategoryForAudience(resource, forRole) {
  if (forRole === "teacher" && resource.category in STUDENT_TO_TEACHER_CATEGORY) {
    return STUDENT_TO_TEACHER_CATEGORY[resource.category];
  }
  if (forRole === "student" && resource.category in TEACHER_TO_STUDENT_CATEGORY) {
    return TEACHER_TO_STUDENT_CATEGORY[resource.category];
  }
  return resource.category;
}

/** Single shared audience check — "both" always means visible to both
 * roles, never just whichever role happened to be checked first. */
export function isResourceVisibleToAudience(resource, role) {
  return resource.audience === role || resource.audience === "both";
}
