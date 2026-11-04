import { getLearnTree, getConceptIdsForTopic, summarizeProgress } from "./learn-tree.js";

// Milestones are pure derived data — computed fresh from progress + the
// curriculum tree every time, never separately stored. This means they
// can never drift out of sync with actual progress, and adding a new
// milestone later needs no migration.
export function computeMilestones(progress) {
  const tree = getLearnTree();
  if (!tree) return [];

  const allConceptIds = tree.flatOrder;
  const totalCompleted = allConceptIds.filter((id) => progress[id]?.status === "completed").length;
  const totalStarted = allConceptIds.filter((id) => progress[id]?.status && progress[id].status !== "not_started").length;

  const milestones = [
    { id: "first-started", label: "First Concept Started", achieved: totalStarted >= 1 },
    { id: "first-completed", label: "First Concept Completed", achieved: totalCompleted >= 1 },
    { id: "5-completed", label: "5 Concepts Completed", achieved: totalCompleted >= 5 },
    { id: "10-completed", label: "10 Concepts Completed", achieved: totalCompleted >= 10 },
  ];

  const structureSection = tree.sections.find((s) => s.label === "Structure");
  const reactivitySection = tree.sections.find((s) => s.label === "Reactivity");

  for (const section of [structureSection, reactivitySection]) {
    if (!section) continue;
    for (const topic of section.topics) {
      const conceptIds = getConceptIdsForTopic(topic.id);
      const { completed, total } = summarizeProgress(progress, conceptIds);
      milestones.push({
        id: `topic-${topic.id}`,
        label: `${topic.code} Completed`,
        detail: topic.label,
        achieved: total > 0 && completed === total,
      });
    }
  }

  if (structureSection) {
    const ids = structureSection.topics.flatMap((t) => getConceptIdsForTopic(t.id));
    const { completed, total } = summarizeProgress(progress, ids);
    milestones.push({ id: "structure-journey", label: "Structure Journey Completed", achieved: total > 0 && completed === total });
  }
  if (reactivitySection) {
    const ids = reactivitySection.topics.flatMap((t) => getConceptIdsForTopic(t.id));
    const { completed, total } = summarizeProgress(progress, ids);
    milestones.push({ id: "reactivity-journey", label: "Reactivity Journey Completed", achieved: total > 0 && completed === total });
  }

  milestones.push({
    id: "full-journey",
    label: "IB DP Chemistry Journey Completed",
    achieved: allConceptIds.length > 0 && totalCompleted === allConceptIds.length,
  });

  return milestones;
}

export function getOverallProgress(progress) {
  const tree = getLearnTree();
  if (!tree) return { completed: 0, total: 0, percent: 0 };
  const { completed, total } = summarizeProgress(progress, tree.flatOrder);
  return { completed, total, percent: total > 0 ? Math.round((completed / total) * 100) : 0 };
}
