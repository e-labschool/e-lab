import { Presentation, CalendarDays, FileEdit, Library } from "lucide-react";
import { getSubject } from "../../data/programmes.js";
import AppSidebarLayout from "../../components/layout/AppSidebarLayout.jsx";

const PROGRAMME_ID = "ibdp";
const SUBJECT_ID = "chemistry";

// Exactly the four tabs specified: Teach | Class Planner | Question
// Builder | Resources. Profile is reached via the account menu.
const TABS = [
  { to: "/teacher/teach", label: "Teach", icon: Presentation },
  { to: "/teacher/class-planner", label: "Class Planner", icon: CalendarDays },
  { to: "/teacher/question-builder", label: "Question Builder", icon: FileEdit },
  { to: "/teacher/resources", label: "Resources", icon: Library },
];

export default function TeacherLayout() {
  const subject = getSubject(PROGRAMME_ID, SUBJECT_ID);
  return (
    <AppSidebarLayout
      role="teacher"
      tabs={TABS}
      accentHex="#C96A21"
      subject={subject}
      programmeId={PROGRAMME_ID}
      subjectId={SUBJECT_ID}
    />
  );
}
