// A thin registry layer bridging the role-based navigation (Student/Teacher
// -> Programme -> Subject) onto the EXISTING curriculum data in
// src/data/curricula/ — it never duplicates curriculum content, it just
// points at it via curriculumId. Adding IB MYP, IGCSE, or a second subject
// (Physics, Biology) later means adding entries here; no navigation,
// routing, or page code needs to change.

const PROGRAMMES = [
  {
    id: "ibdp",
    label: "IB Diploma Programme",
    shortLabel: "IB DP",
    description: "The IB Diploma Programme curriculum, as currently mapped in e-Lab.",
    subjects: [
      {
        id: "chemistry",
        label: "Chemistry",
        curriculumId: "dp-chemistry",
        available: true,
      },
      // Physics and Biology will be added here once mapped — no other
      // file needs to change for them to appear in subject selection.
    ],
  },
];

export function getAllProgrammes() {
  return PROGRAMMES;
}

export function getProgramme(programmeId) {
  return PROGRAMMES.find((p) => p.id === programmeId) ?? null;
}

export function getSubject(programmeId, subjectId) {
  const programme = getProgramme(programmeId);
  return programme?.subjects.find((s) => s.id === subjectId) ?? null;
}

export function getAvailableSubjects(programmeId) {
  const programme = getProgramme(programmeId);
  return programme?.subjects.filter((s) => s.available) ?? [];
}
