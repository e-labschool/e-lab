// getResourcesByCategory/getResourceCounts now take the resource array as
// a parameter (static entries + Supabase-backed ones merged by the
// caller — see ResourcesLanding.jsx/CategoryPage.jsx) rather than only
// ever reading the static student-resources.js import directly. This is
// the smallest change that lets Supabase-published resources appear
// alongside existing static ones without altering CATEGORIES, the filter
// UI, or ResourceCard.

export const CATEGORIES = {
  "ib-documents": {
    id: "ib-documents",
    label: "IB Documents",
    description: "Official and school-provided IB Diploma documents \u2014 subject guide, data booklet, assessment information and more.",
  },
  "study-materials": {
    id: "study-materials",
    label: "Study Materials",
    description: "e-Lab and teacher-created notes, revision sheets, worksheets and summaries.",
  },
};

export const RESOURCE_TYPE_FILTERS = ["All", "Structure", "Reactivity", "PDF", "Worksheet", "Notes", "Revision"];

export function getResourcesByCategory(categoryId, resources) {
  return resources.filter((r) => r.category === categoryId);
}

export function getResourceCounts(resources) {
  return {
    "ib-documents": getResourcesByCategory("ib-documents", resources).length,
    "study-materials": getResourcesByCategory("study-materials", resources).length,
  };
}

export function filterResources(resources, { search, filter }) {
  const q = search.trim().toLowerCase();
  return resources.filter((r) => {
    if (filter && filter !== "All") {
      const matchesTopic = r.topic?.startsWith(filter);
      const matchesFileType = r.fileType === filter;
      const matchesResourceType = r.resourceType === filter;
      if (!matchesTopic && !matchesFileType && !matchesResourceType) return false;
    }
    if (q) {
      const haystack = `${r.title} ${r.description} ${r.topic ?? ""} ${r.resourceType}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}
