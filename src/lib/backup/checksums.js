// SHA-256 checksums for disaster-package integrity (spec §18/§29).
// Uses the standard Web Crypto API (`crypto.subtle`), available in every
// modern browser context this app runs in — no extra dependency needed.

/** SHA-256 of an ArrayBuffer/Uint8Array, as a lowercase hex string. */
export async function sha256Hex(bytes) {
  const buf = bytes instanceof ArrayBuffer ? bytes : bytes.buffer ? bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) : bytes;
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 of a UTF-8 string (used for JSON data-file checksums). */
export async function sha256HexOfString(str) {
  return sha256Hex(new TextEncoder().encode(str));
}
