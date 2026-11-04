// Dry-run validation of a Complete Disaster Recovery .zip package —
// spec §20's required workflow: SELECT -> READ MANIFEST -> VERIFY PACKAGE
// -> VERIFY CHECKSUMS -> VALIDATE SCHEMA COMPATIBILITY -> VALIDATE
// RELATIONSHIPS -> SHOW RESTORE PLAN -> ADMIN CONFIRMATION -> RESTORE ->
// POST-RESTORE VERIFICATION. This module covers everything up to (not
// including) the actual RESTORE step — nothing here writes to the
// database. See disasterRestore.js for the write path.
import JSZip from "jszip";
import { DISASTER_FORMAT, DISASTER_VERSION } from "./constants.js";
import { validateBackup } from "./validateBackup.js";
import { sha256Hex } from "./checksums.js";

function check(list, id, label, pass, detail) {
  list.push({ id, label, pass: Boolean(pass), detail: detail || "" });
}

/**
 * Parses and validates a disaster backup .zip File/Blob. Returns
 * { valid, checks, manifest, integrity, contentBackup, contentValidation,
 *   zip } — `zip` is kept so the restore step can re-read media files
 * from it without re-uploading the original file.
 */
export async function validateDisasterBackup(file) {
  const checks = [];
  let zip;
  try {
    zip = await JSZip.loadAsync(file);
  } catch (err) {
    check(checks, "zip", "File opens as a valid .zip archive", false, err.message || "Could not read this as a zip file.");
    return { valid: false, checks };
  }
  check(checks, "zip", "File opens as a valid .zip archive", true);

  const manifestFile = zip.file("manifest.json");
  check(checks, "manifestPresent", "manifest.json present in package", Boolean(manifestFile));
  if (!manifestFile) return { valid: false, checks, zip };

  let manifest;
  try {
    manifest = JSON.parse(await manifestFile.async("string"));
  } catch {
    check(checks, "manifestJson", "manifest.json parses as JSON", false);
    return { valid: false, checks, zip };
  }
  check(checks, "manifestJson", "manifest.json parses as JSON", true);

  check(checks, "format", "Recognized e-Lab disaster backup format", manifest.format === DISASTER_FORMAT, `format: ${manifest.format ?? "(missing)"}`);
  const versionOk = Number.isInteger(manifest.disasterBackupVersion) && manifest.disasterBackupVersion >= 1 && manifest.disasterBackupVersion <= DISASTER_VERSION;
  check(checks, "version", "Supported disaster backup version", versionOk, `disasterBackupVersion: ${manifest.disasterBackupVersion ?? "(missing)"} (this app supports 1–${DISASTER_VERSION})`);
  check(checks, "createdAt", "Creation timestamp present and valid", typeof manifest.createdAt === "string" && !Number.isNaN(Date.parse(manifest.createdAt)));

  if (manifest.verificationFailed) {
    check(checks, "verifiedAtCreation", "Package reported successful verification at creation time", false, "This package's own creator recorded a verification FAILURE (media checksum mismatch or download failure) — see its integrity/checksums.json.");
  }

  // ---- integrity/checksums.json ----
  const integrityFile = zip.file("integrity/checksums.json");
  check(checks, "integrityPresent", "integrity/checksums.json present", Boolean(integrityFile));
  let integrity = null;
  if (integrityFile) {
    try {
      integrity = JSON.parse(await integrityFile.async("string"));
      check(checks, "integrityJson", "integrity/checksums.json parses as JSON", true);
    } catch {
      check(checks, "integrityJson", "integrity/checksums.json parses as JSON", false);
    }
  }

  // ---- data/content.json — reuse the EXISTING content validator verbatim ----
  const contentFile = zip.file("data/content.json");
  check(checks, "contentPresent", "data/content.json present", Boolean(contentFile));
  let contentBackup = null;
  let contentValidation = null;
  if (contentFile) {
    try {
      contentBackup = JSON.parse(await contentFile.async("string"));
      contentValidation = validateBackup(contentBackup);
      check(checks, "contentValid", "Educational content passes the existing Content Backup validator", contentValidation.valid);
      for (const c of contentValidation.checks) {
        check(checks, `content.${c.id}`, `Content: ${c.label}`, c.pass, c.detail);
      }
    } catch {
      check(checks, "contentJson", "data/content.json parses as JSON", false);
    }
  }

  // ---- data file checksums (dataFileChecksums vs actual zip contents) ----
  if (integrity?.dataFileChecksums) {
    let allOk = true;
    for (const [path, expectedHash] of Object.entries(integrity.dataFileChecksums)) {
      const f = zip.file(path);
      if (!f) {
        allOk = false;
        continue;
      }
      const text = await f.async("string");
      const actual = await sha256Hex(new TextEncoder().encode(text));
      if (actual !== expectedHash) allOk = false;
    }
    check(checks, "dataChecksums", "Data file checksums match integrity/checksums.json", allOk);
  }

  // ---- media checksums (spot: verify every packaged media file's hash) ----
  let mediaMismatchCount = 0;
  let mediaCheckedCount = 0;
  if (integrity?.mediaChecksums?.length) {
    for (const entry of integrity.mediaChecksums) {
      const f = zip.file(`media/${entry.bucket}/${entry.path}`);
      if (!f) {
        mediaMismatchCount++;
        continue;
      }
      const bytes = await f.async("arraybuffer");
      const actual = await sha256Hex(bytes);
      mediaCheckedCount++;
      if (actual !== entry.sha256) mediaMismatchCount++;
    }
  }
  check(checks, "mediaChecksums", "Packaged media files match their recorded SHA-256 checksums", mediaMismatchCount === 0, `${mediaMismatchCount} mismatch(es)/missing file(s) out of ${mediaCheckedCount} checked`);

  // ---- Question Bank / Question Paper integrity (Phase 6) — may be
  // absent entirely in a package produced before the 2026-10 gap closure;
  // absence is reported as a pass (nothing to check), never a failure. ----
  const qbFile = zip.file("data/question-bank.json");
  const qpFile = zip.file("data/question-papers.json");
  let questionBankData = null;
  let questionPapersData = null;
  if (qbFile) {
    try {
      questionBankData = JSON.parse(await qbFile.async("string"));
      check(checks, "questionBankJson", "data/question-bank.json parses as JSON", true);
    } catch {
      check(checks, "questionBankJson", "data/question-bank.json parses as JSON", false);
    }
  }
  if (qpFile) {
    try {
      questionPapersData = JSON.parse(await qpFile.async("string"));
      check(checks, "questionPapersJson", "data/question-papers.json parses as JSON", true);
    } catch {
      check(checks, "questionPapersJson", "data/question-papers.json parses as JSON", false);
    }
  }
  if (questionBankData) {
    const questionIds = new Set((questionBankData.questions || []).map((q) => q.id));
    const versionIds = new Set((questionBankData.question_versions || []).map((v) => v.id));
    const badVersions = (questionBankData.question_versions || []).filter((v) => !questionIds.has(v.question_id));
    check(checks, "questionVersionsResolve", "Every question_versions row points to a question present in this package", badVersions.length === 0, badVersions.length ? `${badVersions.length} orphaned version(s)` : "");
    const badSecrets = (questionBankData.question_secrets || []).filter((s) => !questionIds.has(s.question_id));
    check(checks, "questionSecretsResolve", "Every question_secrets row points to a question present in this package", badSecrets.length === 0, badSecrets.length ? `${badSecrets.length} orphaned secret(s)` : "");
    const badVersionSecrets = (questionBankData.question_version_secrets || []).filter((s) => !versionIds.has(s.question_version_id));
    check(checks, "questionVersionSecretsResolve", "Every question_version_secrets row points to a question_versions row present in this package", badVersionSecrets.length === 0, badVersionSecrets.length ? `${badVersionSecrets.length} orphaned version secret(s)` : "");

    if (questionPapersData) {
      const paperIds = new Set((questionPapersData.question_papers || []).map((p) => p.id));
      const items = questionPapersData.question_paper_items || [];
      const badPaperRef = items.filter((i) => !paperIds.has(i.paper_id));
      check(checks, "paperItemsResolveToPapers", "Every question_paper_items row points to a question_papers row present in this package", badPaperRef.length === 0, badPaperRef.length ? `${badPaperRef.length} orphaned item(s)` : "");
      const badVersionRef = items.filter((i) => i.question_version_id && !versionIds.has(i.question_version_id));
      check(checks, "paperItemsResolveToVersions", "Every question_paper_items row's question_version_id (when set) resolves to a question_versions row present in this package", badVersionRef.length === 0, badVersionRef.length ? `${badVersionRef.length} unresolved reference(s)` : "");
      const positionsOk = items.every((i) => Number.isInteger(i.position));
      check(checks, "paperItemOrderingPreserved", "Every question_paper_items row carries an integer `position` (ordering preserved)", positionsOk);
    }
  }

  // ---- Resources: uploaded-file metadata resolves to a packaged media
  // object; an external_url row is NEVER flagged as a missing file (spec:
  // "external URL resources are not incorrectly flagged as missing
  // files"). ----
  const libraryFile = zip.file("data/library.json");
  if (libraryFile) {
    try {
      const library = JSON.parse(await libraryFile.async("string"));
      const resources = library.resources || [];
      const packagedResourcePaths = new Set((integrity?.mediaChecksums || []).filter((m) => m.bucket === "resources").map((m) => m.path));
      const uploadedFileRows = resources.filter((r) => r.file_path && !r.external_url);
      const unresolvedUploads = uploadedFileRows.filter((r) => !packagedResourcePaths.has(r.file_path));
      check(
        checks,
        "resourceUploadsResolve",
        "Every uploaded Resource file resolves to a packaged media object",
        unresolvedUploads.length === 0,
        unresolvedUploads.length ? `${unresolvedUploads.length} resource(s) with file_path not found under media/resources/` : ""
      );
      // External URL resources are never checked against packagedResourcePaths
      // at all (see uploadedFileRows' `&& !r.external_url` filter above) —
      // that omission IS the guarantee spec asks for: an external_url row
      // can never appear in unresolvedUploads, so it can never be reported
      // as a missing Storage file.
      const externalUrlCount = resources.filter((r) => r.external_url).length;
      check(checks, "externalUrlResourcesNotFlagged", "External URL resources are recorded as metadata-only, never as a missing Storage file", true, `${externalUrlCount} external URL resource(s) in this package`);
    } catch {
      check(checks, "libraryJson", "data/library.json parses as JSON", false);
    }
  }

  // ---- schema compatibility (best-effort: version number only — this
  // sandbox cannot introspect a live target database's actual schema) ----
  check(checks, "schemaCompatibility", "Disaster backup version is understood by this app build", versionOk);

  const valid = checks.every((c) => c.pass);
  return { valid, checks, manifest, integrity, contentBackup, contentValidation, zip };
}
