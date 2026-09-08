// Data-driven curriculum → subject configuration for the student landing
// page. Adding a new curriculum or subject later means adding an entry
// here — never touching the page component's JSX.
export const CURRICULA = [
  {
    id: "ib-dp",
    name: "IB Diploma Programme",
    available: true,
    logo: "/branding/ib-dp-logo.png",
    subjects: [
      {
        id: "chemistry",
        name: "Chemistry",
        available: true,
        path: "/student/learn",
      },
      // Future subjects (Physics, Biology, ...) are added here, each
      // with `available: false` until genuinely ready — never shown as
      // a "Coming Soon" card in the meantime, per the current release.
    ],
  },
  // Future curricula (IB MYP, IGCSE, ...) are added here the same way.
];
