import { Presentation, CalendarDays, FileEdit, Library, FlaskConical } from "lucide-react";
import { getSubject } from "../../data/programmes.js";
import AppSidebarLayout from "../../components/layout/AppSidebarLayout.jsx";
import { useTrackLastRoute } from "../../lib/lastRoute.jsx";

const PROGRAMME_ID = "ibdp";
const SUBJECT_ID = "chemistry";

// Tabs: Teach | Class Planner | Simulations | Question Builder | Resources. Profile is reached via the account menu.
export const TEACHER_TABS = [
  { to: "/teacher/teach", label: "Teach", icon: Presentation },
  { to: "/teacher/class-planner", label: "Class Planner", icon: CalendarDays },
  { to: "/teacher/simulations", label: "Simulations", icon: FlaskConical },
  { to: "/teacher/question-builder", label: "Question Builder", icon: FileEdit },
  { to: "/teacher/resources", label: "Resources", icon: Library },
];

export default function TeacherLayout() {
  useTrackLastRoute("teacher");
  const subject = getSubject(PROGRAMME_ID, SUBJECT_ID);
  return (
    <AppSidebarLayout
      role="teacher"
      tabs={TEACHER_TABS}
      accentHex="#C96A21"
      subject={subject}
      programmeId={PROGRAMME_ID}
      subjectId={SUBJECT_ID}
    />
  );
}
