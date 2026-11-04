import { BookOpen, PenLine, Library, TrendingUp } from "lucide-react";
import { getSubject } from "../../data/programmes.js";
import AppSidebarLayout from "../../components/layout/AppSidebarLayout.jsx";
import { ImageLightboxProvider } from "../../components/image-viewer/ImageLightbox.jsx";
import { useTrackLastRoute } from "../../lib/lastRoute.jsx";

const PROGRAMME_ID = "ibdp";
const SUBJECT_ID = "chemistry";

// Exactly the four tabs specified: Learn | Assess | Resources | Progress.
// Profile is reachable from the account menu in the header row instead of
// being a fifth top tab.
const TABS = [
  { to: "/student/learn", label: "Learn", icon: BookOpen },
  { to: "/student/solve", label: "Assess", icon: PenLine },
  { to: "/student/resources", label: "Resources", icon: Library },
  { to: "/student/progress", label: "Progress", icon: TrendingUp },
];

export default function StudentLayout() {
  useTrackLastRoute("student");
  const subject = getSubject(PROGRAMME_ID, SUBJECT_ID);
  // The image viewer lives at the student-platform level so every student
  // page (Learn, Assess/Check-your-understanding, Resources, Progress) shares
  // ONE lightbox that portals above the nav bar and lesson sidebar.
  return (
    <ImageLightboxProvider>
    <AppSidebarLayout
      role="student"
      tabs={TABS}
      accentHex="#3654D6"
      subject={subject}
      programmeId={PROGRAMME_ID}
      subjectId={SUBJECT_ID}
    />
    </ImageLightboxProvider>
  );
}
