export const LEARN_AUTHOR_DEFAULTS = {
  imageWidth: "large",
  imageAlignment: "center",
  videoWidth: "large",
  videoAlignment: "center",
  blockSpacing: "normal",
};

function key(userId) { return `e-lab:${userId || "guest"}:admin:learn-author-defaults`; }

export function loadLearnAuthorDefaults(userId) {
  try { return { ...LEARN_AUTHOR_DEFAULTS, ...JSON.parse(localStorage.getItem(key(userId)) || "{}") }; }
  catch { return { ...LEARN_AUTHOR_DEFAULTS }; }
}

export function saveLearnAuthorDefaults(userId, value) {
  try { localStorage.setItem(key(userId), JSON.stringify({ ...LEARN_AUTHOR_DEFAULTS, ...value })); } catch { /* optional preference */ }
}
