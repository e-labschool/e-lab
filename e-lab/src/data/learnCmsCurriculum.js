import { buildRoadmap } from "../lib/curriculum-resolver.js";

// The Learn CMS's curriculum tree — reuses the SAME authoritative
// registry (src/data/curricula/dp-chemistry/2025.js, via buildRoadmap())
// that everything else in e-Lab uses for Structure/Reactivity, down to
// subtopic level only (no concepts) — this is where Admin-authored
// lessons attach. "Tools for Chemistry" is NOT part of that registry
// (it isn't an official IB syllabus section) and is added here as its
// own clearly-separate top-level area, never mixed into the real
// Structure/Reactivity ids or presented as an IB code.
export function getLearnCmsCurriculumTree() {
  const roadmap = buildRoadmap("dp-chemistry", "2025");
  const sections = (roadmap?.sections ?? []).map((section) => ({
    id: section.id,
    label: section.label,
    topics: section.topics.map((topic) => ({
      id: topic.id,
      code: topic.id.replace("structure-", "S").replace("reactivity-", "R"),
      label: topic.label,
      subtopics: topic.subtopics.map((subtopic) => ({
        id: subtopic.id,
        code: subtopic.id.replace("structure-", "S").replace("reactivity-", "R"),
        label: subtopic.label,
      })),
    })),
  }));

  return [
    ...sections,
    {
      id: "tools",
      label: "Tools",
      topics: [
        {
          id: "tools-for-chemistry",
          label: "Tools for Chemistry",
          subtopics: [{ id: "tools-for-chemistry", label: "Tools for Chemistry" }],
        },
      ],
    },
  ];
}

/** Flat { id, label, sectionLabel, topicLabel } list of every subtopic —
 * this is what populates the "Parent Topic" dropdown in the lesson editor. */
export function getFlatParentTopics() {
  const tree = getLearnCmsCurriculumTree();
  return tree.flatMap((section) =>
    section.topics.flatMap((topic) =>
      topic.subtopics.map((subtopic) => ({
        id: subtopic.id,
        code: subtopic.id.replace("structure-", "S").replace("reactivity-", "R"),
        label: subtopic.label,
        sectionLabel: section.label,
        topicLabel: topic.label,
      }))
    )
  );
}
