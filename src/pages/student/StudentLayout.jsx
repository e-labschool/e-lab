import { BookOpen, PenLine, Library, TrendingUp, User } from "lucide-react";
import { getSubject } from "../../data/programmes.js";
import AppSidebarLayout from "../../components/layout/AppSidebarLayout.jsx";

// The subject is resolved internally (there is currently exactly one:
// IB DP Chemistry) rather than taken from the URL — so /student/learn is a
// stable, flat, bookmarkable route today, while the underlying
// programmes.js data layer that WOULD support a subject picker if a
// second subject is added later is left completely intact underneath.
const PROGRAMME_ID = "ibdp";
const SUBJECT_ID = "chemistry";

const TABS = [
  { to: "/student", end: true, label: "Home", icon: BookOpen },
  { to: "/student/learn", label: "Learn", icon: BookOpen },
  { to: "/student/solve", label: "Solve", icon: PenLine },
  { to: "/student/resources", label: "Resources", icon: Library },
  { to: "/student/progress", label: "Progress", icon: TrendingUp },
  { to: "/student/profile", label: "Profile", icon: User },
];

export default function StudentLayout() {
  const subject = getSubject(PROGRAMME_ID, SUBJECT_ID);
  return (
    <AppSidebarLayout
      role="student"
      tabs={TABS}
      accentHex="#3654D6"
      subject={subject}
      programmeId={PROGRAMME_ID}
      subjectId={SUBJECT_ID}
    />
  );
}
