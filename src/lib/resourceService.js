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
// Teacher Resources currently has no existing category subdivision (see
// src/pages/teacher/Resources.jsx before this change — just a single
// placeholder), so a single flat category is used rather than inventing
// a new hierarchy the product doesn't have yet.
export const TEACHER_CATEGORY = { id: "teacher", label: "Teacher Resources" };
