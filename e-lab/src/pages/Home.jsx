import { GraduationCap, ClipboardCheck, TrendingUp, FolderOpen, Presentation, CalendarDays, FileEdit, Library } from "lucide-react";
import Hero from "../components/homepage/Hero.jsx";
import RoleCards from "../components/homepage/RoleCards.jsx";
import FeatureSection from "../components/homepage/FeatureSection.jsx";

const STUDENT_FEATURES = [
  { icon: GraduationCap, label: "Learn", description: "Learn topic-wise Chemistry concepts in detail through explanations, visuals and interactives." },
  {
    icon: ClipboardCheck, label: "Assess",
    // Deliberately does NOT claim to be an official IB exam platform, and
    // makes no unsourced claim about IB digital exam timelines — per the
    // brief's explicit wording constraints.
    description: "Test your understanding through focused challenges and an on-screen assessment experience, designed with the IB's transition toward on-screen examinations in mind.",
  },
  { icon: TrendingUp, label: "Progress", description: "Track learning progress, assessment performance, strengths and areas to strengthen." },
  { icon: FolderOpen, label: "Resources", description: "Access IB-related resources, e-Lab study materials, worksheets and revision support." },
];

const TEACHER_FEATURES = [
  { icon: Presentation, label: "Teach", description: "Access curriculum-organised teaching content and topic support." },
  { icon: CalendarDays, label: "Class Planner", description: "Plan and organise your next class using curriculum-linked teaching tools." },
  { icon: FileEdit, label: "Question Builder", description: "Build worksheets, assessments and question papers from the e-Lab Question Bank." },
  { icon: Library, label: "Resources", description: "Access teacher resources, IB-related documents, worksheets and supporting materials." },
];

export default function Home() {
  return (
    <>
      <Hero />
      <RoleCards />
      <FeatureSection title="For Students" accentHex="#3654D6" accentSoftVar="--color-indigo-soft" items={STUDENT_FEATURES} />
      <FeatureSection title="For Teachers" accentHex="#C96A21" accentSoftVar="--color-amber-soft" items={TEACHER_FEATURES} />
    </>
  );
}
