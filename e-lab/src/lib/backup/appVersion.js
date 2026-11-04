// Real, non-invented application-version identifier for the disaster
// manifest (spec §6/§13: "Do not invent a commit hash").
//
// Preference order, every one of them genuinely available at build/
// runtime, never fabricated:
//   1. A git commit exposed at build time via VITE_GIT_COMMIT (or
//      Vercel's VERCEL_GIT_COMMIT_SHA, if a deploy pipeline re-exposes
//      it under a VITE_ prefix — Vite only inlines env vars prefixed
//      VITE_). Neither is set in this repository as shipped: there is
//      no .git directory in this project, so there is no commit hash to
//      record, and no build script currently injects one.
//   2. package.json's "version" field — always present, always real.
// If neither is available this reports that plainly rather than
// fabricating an identifier.
import pkg from "../../../package.json" with { type: "json" };

export function getApplicationVersionInfo() {
  const commit =
    (typeof import.meta !== "undefined" && import.meta.env && (import.meta.env.VITE_GIT_COMMIT || import.meta.env.VITE_VERCEL_GIT_COMMIT_SHA)) ||
    null;

  if (commit) {
    return {
      identifierType: "git-commit",
      identifier: commit,
      packageVersion: pkg.version,
    };
  }

  if (pkg?.version) {
    return {
      identifierType: "package-version",
      identifier: pkg.version,
      packageVersion: pkg.version,
      note:
        "No VCS commit identifier was available at build time (no .git directory in this project / no VITE_GIT_COMMIT build env var set). Falling back to package.json's \"version\" field — the safest real identifier actually available. Do not treat this as a git commit hash.",
    };
  }

  return {
    identifierType: "none",
    identifier: null,
    note: "No application version identifier is available in this build.",
  };
}
