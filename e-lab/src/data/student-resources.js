// The Student Resources registry — deliberately separate from
// resources-registry.js, which catalogues INTERACTIVE tools (simulations,
// explorers). This file catalogues downloadable/linkable DOCUMENTS
// (PDFs, worksheets, official IB material). Different content, different
// registry, same "data separate from UI" principle as the rest of e-Lab.
//
// COPYRIGHT: only add an entry here for a file you have explicit
// permission to distribute (place it under /public/resources/<category>/
// first), or a legitimate official external link. Never add scraped or
// redistributed copyrighted IB material.
//
// To add a new resource:
//   1. Place the file in /public/resources/ib-documents/ or
//      /public/resources/study-materials/ (or set an externalUrl instead
//      of filePath for an external link).
//   2. Add one entry below. Nothing else needs to change — the Resources
//      page, filters, and search all read from this array.
//
// Entry shape:
// {
//   id: "unique-kebab-id",
//   title: "Display title",
//   description: "One short sentence.",
//   category: "ib-documents" | "study-materials",
//   curriculum: "dp-chemistry",
//   topic: "Structure 1" | null,        // section/topic label, optional
//   resourceType: "Reference" | "Notes" | "Worksheet" | "Revision" | "Guidance" | "Data",
//   fileType: "PDF" | "DOCX" | "XLSX" | ...,
//   filePath: "/resources/ib-documents/example.pdf" | null,
//   externalUrl: "https://..." | null,  // set exactly one of filePath/externalUrl
//   fileSizeLabel: "1.2 MB" | null,     // optional, purely informational
//   downloadable: true | false,         // false for "open" (e.g. external link)
// }

const studentResources = [
  // Intentionally empty for this release — no placeholder/fake resources.
  // Real entries will be added here once files are supplied and permitted
  // for distribution. See the shape documented above.
];

export default studentResources;
