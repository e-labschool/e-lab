// Restore dependency order — derived from the actual foreign-key edges
// audited across supabase/schema.sql and every supabase/*.sql /
// supabase/migrations/*.sql migration (see docs/DISASTER_RECOVERY.md for
// the citation of every edge below). This is a genuine topological sort
// over a declared edge list, not a hand-typed sequence the spec's example
// order was blindly copied into (spec §22: "DO NOT blindly use this
// order — derive the correct dependency graph from the actual schema").
//
// A node here is either a real table name, or one of two non-table
// prerequisites that must conceptually happen first: "schema" (the SQL
// migrations must already be applied to the target database) and
// "storage_buckets" (the buckets themselves — learn-media/resources/
// question-media — must exist before any object can be uploaded into
// them). `auth_users` is a placeholder node representing "the restored
// target already has, or this restore session has just created/relinked,
// the auth.users row each profiles.id will reference" — see
// disasterRestore.js and docs/DISASTER_RECOVERY.md for why this can't be
// automated from the browser.

// [from, to] meaning "from must be restored before to" (to depends on from).
const EDGES = [
  ["schema", "storage_buckets"],
  ["storage_buckets", "media_files"],

  // Educational content (matches the existing restore_elab_content order).
  ["schema", "learn_pages"],
  ["learn_pages", "learn_blocks"],
  ["learn_pages", "learn_check_questions"],
  ["learn_pages", "learn_manual_questions"],
  ["learn_manual_questions", "learn_manual_question_secrets"],
  // Media referenced from block/question JSONB content should exist
  // before the content that points at it is considered fully restored
  // (content rows can be inserted first — Postgres does not enforce
  // this — but verification/link-rewriting depends on media being in place).
  ["media_files", "learn_blocks"],
  ["media_files", "learn_manual_questions"],

  // Identity: a profile requires its auth user to already exist (either
  // preserved, or freshly created/relinked — see docs/DISASTER_RECOVERY.md).
  ["auth_users", "profiles"],

  // Everything else with a user_id FK requires profiles first.
  ["profiles", "user_access"],
  ["profiles", "user_preferences"],
  ["profiles", "learning_progress"],
  ["profiles", "concept_attempts"],
  ["profiles", "prediction_cycles"],
  ["prediction_cycles", "prediction_snapshots"],
  ["profiles", "student_streaks"],
  ["profiles", "student_challenges"],
  ["student_challenges", "challenge_questions"],
  ["profiles", "class_plans"],
  ["class_plans", "lesson_blocks"],

  // Singleton settings has no FK dependency at all but is listed for
  // completeness of the graph.
  ["schema", "platform_settings"],

  // resources.created_by is a NULLABLE FK to auth.users — a resource row
  // restores fine with no mappable creator (attribution is simply null),
  // so it only depends on the schema existing, not on profiles/auth_users.
  ["schema", "resources"],
];

/** Kahn's algorithm topological sort over the declared EDGES above. */
export function computeRestoreOrder(nodes) {
  const nodeSet = new Set(nodes);
  const inDegree = new Map(nodes.map((n) => [n, 0]));
  const adj = new Map(nodes.map((n) => [n, []]));

  for (const [from, to] of EDGES) {
    if (!nodeSet.has(from) || !nodeSet.has(to)) continue;
    adj.get(from).push(to);
    inDegree.set(to, (inDegree.get(to) || 0) + 1);
  }

  const queue = nodes.filter((n) => (inDegree.get(n) || 0) === 0);
  const order = [];
  while (queue.length) {
    // Stable order: always take the earliest-declared ready node, not an
    // arbitrary one, so results are deterministic across runs.
    queue.sort((a, b) => nodes.indexOf(a) - nodes.indexOf(b));
    const n = queue.shift();
    order.push(n);
    for (const m of adj.get(n) || []) {
      inDegree.set(m, inDegree.get(m) - 1);
      if (inDegree.get(m) === 0) queue.push(m);
    }
  }

  if (order.length !== nodes.length) {
    const remaining = nodes.filter((n) => !order.includes(n));
    throw new Error(`Dependency cycle detected among: ${remaining.join(", ")}`);
  }
  return order;
}

export const DISASTER_RESTORE_NODES = [
  "schema",
  "storage_buckets",
  "auth_users",
  "learn_pages",
  "learn_blocks",
  "learn_check_questions",
  "learn_manual_questions",
  "learn_manual_question_secrets",
  "media_files",
  "profiles",
  "user_access",
  "user_preferences",
  "learning_progress",
  "concept_attempts",
  "prediction_cycles",
  "prediction_snapshots",
  "student_streaks",
  "student_challenges",
  "challenge_questions",
  "class_plans",
  "lesson_blocks",
  "platform_settings",
  "resources",
];
