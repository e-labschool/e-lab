// View / Download behaviour for resource files.  Pure logic + two browser actions; no React.
//
//   VIEW     open the document in a NEW browser tab (eye button).  Only for types a browser can display itself
//            (PDF, common images, plain text).  Anything else (PPT/DOC/XLS...) cannot be rendered by a browser, and the
//            private signed URL must NOT be handed to a third-party viewer (Google / Microsoft Office Online), so those
//            report "can't be previewed" and the UI points to Download instead.
//   DOWNLOAD force a save (download button): signed URL created with a download file name, which makes the storage
//            server answer `Content-Disposition: attachment`.
//
// Popup-blocker safety: a tab opened AFTER an await (the signed URL request) is usually blocked, so the tab is opened
// synchronously inside the click, then pointed at the URL when it arrives.  `window.open(..., "noopener")` would return
// null (no handle to navigate), so the opener link is cut by hand (`tab.opener = null`) and the navigation is done from a
// `rel="noopener noreferrer"` anchor inside the new tab (no Referer is sent to the storage host).
//
// These are UI behaviours, not security: see docs/RESOURCE_VIEW_DOWNLOAD.md.
import { getResourceSignedUrl } from "./resourceService.js";

export const PREVIEWABLE_MIME = Object.freeze(["application/pdf", "image/png", "image/jpeg", "image/gif", "image/webp", "text/plain"]);
const MIME_BY_EXT = Object.freeze({ pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", txt: "text/plain" });

export const MSG = Object.freeze({
  notPreviewable: "This file type can't be previewed in the browser — download it instead.",
  notPreviewableNoDownload: "This file type can't be previewed in the browser.",
  popupBlocked: "Your browser blocked the new tab. Allow pop-ups for this site and try again, or use Download.",
  locked: "This resource is locked.",
  badLink: "This link isn't valid, so it can't be opened.",
  noFile: "There is no file attached to this resource.",
  noDownloadForLink: "This is a link to another website, so there is no file to download.",
});

/** Only http(s) links are ever opened (a stored `javascript:` / `data:` URL must never reach an href or window.open). */
export function safeExternalUrl(url) {
  try {
    const u = new URL(String(url ?? "").trim());
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch { return null; }
}

export const isExternalLink = (r) => Boolean(r?.externalUrl) && !r?.needsSignedUrl;
const storagePath = (r) => (r?.needsSignedUrl && r?.supabaseFilePath ? r.supabaseFilePath : null);
const staticPath = (r) => (!r?.needsSignedUrl && !r?.externalUrl && r?.filePath ? r.filePath : null);
export const hasFile = (r) => Boolean(storagePath(r) || staticPath(r));

export function resourceExtension(r) {
  for (const name of [r?.originalFileName, r?.supabaseFilePath, r?.filePath]) {
    const m = /\.([a-z0-9]{1,8})$/i.exec(String(name ?? "").split(/[?#]/)[0]);
    if (m) return m[1].toLowerCase();
  }
  return "";
}

export function resourceMime(r) {
  const m = String(r?.mimeType ?? "").split(";")[0].trim().toLowerCase();
  return m || MIME_BY_EXT[resourceExtension(r)] || "";
}

/** Short type label for messages: "PPTX", "DOCX"... (falls back to "this") */
export const fileTypeLabel = (r) => (r?.fileType && r.fileType !== "File" ? String(r.fileType) : resourceExtension(r).toUpperCase());

/** 'external' | 'inline' (browser can show it) | 'download-only' (cannot be previewed) | 'none' (no file) */
export function previewKind(r) {
  if (isExternalLink(r)) return "external";
  if (!hasFile(r)) return "none";
  return PREVIEWABLE_MIME.includes(resourceMime(r)) ? "inline" : "download-only";
}

/** Can a copy be saved?  Links to other sites: no. */
export function isDownloadable(r) {
  if (!hasFile(r)) return false;
  return storagePath(r) ? true : r.downloadable !== false;
}

/** Safe download file name: the uploaded original name, else the title plus the extension. */
export function downloadFileName(r) {
  // eslint-disable-next-line no-control-regex -- stripping control characters from file names is the point
  const clean = (s) => String(s ?? "").replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").replace(/^[.\s-]+|[\s]+$/g, "").slice(0, 120);
  const ext = resourceExtension(r);
  const original = clean(r?.originalFileName);
  if (original) return original;
  const base = clean(r?.title) || "download";
  return ext && !base.toLowerCase().endsWith(`.${ext}`) ? `${base}.${ext}` : base;
}

/** Plain-language message for a storage / network error; never the raw error text. */
export function friendlyResourceError(err, verb = "open") {
  const text = `${err?.message ?? ""} ${err?.error ?? ""}`;
  const status = Number(err?.statusCode ?? err?.status);
  if (/not connected/i.test(text)) return "File storage isn't available right now. Please try again later.";
  if (status === 404 || /not.?found|no such object/i.test(text)) return "This file couldn't be found. It may have been moved or removed — please tell your teacher.";
  if ([401, 403].includes(status) || /permission|unauthori[sz]ed|forbidden|row-level|jwt|not allowed/i.test(text)) return `You don't have permission to ${verb} this file. Try signing in again.`;
  if (err instanceof TypeError || /network|fetch|timeout|offline/i.test(text)) return "Couldn't reach the file server. Check your connection and try again.";
  return `Couldn't ${verb} this file right now. Please try again in a moment.`;
}

const ok = (extra = {}) => ({ ok: true, code: "ok", message: "", ...extra });
const fail = (code, message) => ({ ok: false, code, message });

function loadingPlaceholder(tab) {
  try {
    const d = tab.document;
    d.title = "Opening…";
    d.body.style.cssText = "font:16px system-ui,sans-serif;padding:2rem;color:#555";
    d.body.textContent = "Opening document…";
  } catch { /* cross-origin or exotic browser: the blank tab is fine */ }
}

function navigateTab(tab, url) {
  try {
    const d = tab.document;
    const a = d.createElement("a");
    a.href = url; a.rel = "noopener noreferrer";
    d.body.appendChild(a);
    a.click();
    return;
  } catch { /* fall through */ }
  tab.location.replace(url);
}

/**
 * VIEW: open the resource in a new tab.  MUST be called synchronously from the click handler (the tab is opened
 * before the first `await`).  Resolves to { ok, code, message }.  Never throws.
 * deps (tests): { win, getUrl }
 */
export async function viewResource(resource, deps = {}) {
  const w = deps.win ?? globalThis.window;
  const getUrl = deps.getUrl ?? getResourceSignedUrl;
  if (resource?.isLocked) return fail("locked", MSG.locked);
  const kind = previewKind(resource);
  if (kind === "none") return fail("no-file", MSG.noFile);
  if (kind === "external") {
    const href = safeExternalUrl(resource.externalUrl);
    if (!href) return fail("bad-link", MSG.badLink);
    w.open(href, "_blank", "noopener,noreferrer");
    return ok();
  }
  if (kind === "download-only") return fail("not-previewable", MSG.notPreviewable);
  const direct = staticPath(resource);
  if (direct) { w.open(direct, "_blank", "noopener,noreferrer"); return ok(); } // same-origin public file: no signing needed

  const tab = w.open("", "_blank"); // synchronous, still inside the user's click
  if (!tab) return fail("popup-blocked", MSG.popupBlocked);
  try { tab.opener = null; } catch { /* ignore */ }
  loadingPlaceholder(tab);
  let url;
  try {
    url = await getUrl(storagePath(resource));
  } catch (err) {
    try { tab.close(); } catch { /* ignore */ }
    return fail("error", friendlyResourceError(err, "open"));
  }
  if (tab.closed) return ok({ code: "tab-closed" }); // the user closed the tab while we waited
  try { navigateTab(tab, url); } catch (err) {
    try { tab.close(); } catch { /* ignore */ }
    return fail("error", friendlyResourceError(err, "open"));
  }
  return ok();
}

/** Save a copy from a URL via a throw-away anchor.  Cross-origin `download=` is ignored by browsers, so for storage URLs the
 *  forced download comes from the `Content-Disposition: attachment` the storage server sends for `?download=`. */
function triggerDownload(url, name, doc) {
  const a = doc.createElement("a");
  a.href = url; a.rel = "noopener noreferrer"; a.download = name; a.style.display = "none";
  doc.body.appendChild(a);
  try { a.click(); } finally { a.remove(); }
}

/** DOWNLOAD: force a download.  Resolves to { ok, code, message }.  Never throws.  deps (tests): { doc, getUrl } */
export async function downloadResource(resource, deps = {}) {
  const doc = deps.doc ?? globalThis.document;
  const getUrl = deps.getUrl ?? getResourceSignedUrl;
  if (resource?.isLocked) return fail("locked", MSG.locked);
  if (isExternalLink(resource)) return fail("no-download", MSG.noDownloadForLink);
  if (!hasFile(resource)) return fail("no-file", MSG.noFile);
  const name = downloadFileName(resource);
  const direct = staticPath(resource);
  try {
    if (direct) { triggerDownload(direct, name, doc); return ok({ name }); }
    const url = await getUrl(storagePath(resource), { download: name });
    triggerDownload(url, name, doc);
    return ok({ name });
  } catch (err) {
    return fail("error", friendlyResourceError(err, "download"));
  }
}

/** Adapts an admin `resources` table row (snake_case) to the shape the actions use.  Never locked for the admin. */
export function resourceFromRow(row) {
  return {
    title: row.title,
    isLocked: false,
    externalUrl: row.external_url ?? null,
    needsSignedUrl: Boolean(row.file_path),
    supabaseFilePath: row.file_path ?? null,
    filePath: null,
    mimeType: row.mime_type ?? null,
    originalFileName: row.original_file_name ?? null,
    fileType: null,
    downloadable: Boolean(row.file_path),
  };
}
