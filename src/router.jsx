import { lazy, Suspense } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import Home from "./pages/Home.jsx";
import Explore from "./pages/Explore.jsx";
import ExploreCurriculum from "./pages/ExploreCurriculum.jsx";
import Topics from "./pages/Topics.jsx";
import ConceptPage from "./pages/ConceptPage.jsx";
import Interactives from "./pages/Interactives.jsx";
import InteractivePage from "./pages/InteractivePage.jsx";
import Teachers from "./pages/Teachers.jsx";
import About from "./pages/About.jsx";
import Profile from "./pages/Profile.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import NotFound from "./pages/NotFound.jsx";

import ChooseProgramme from "./pages/onboarding/ChooseProgramme.jsx";
import ChooseSubject from "./pages/onboarding/ChooseSubject.jsx";

import StudentSubjectLayout from "./pages/student/StudentSubjectLayout.jsx";
import LearnLayout from "./components/learn/LearnLayout.jsx";
import WelcomePage from "./components/learn/WelcomePage.jsx";
import LearnConceptPage from "./components/learn/LearnConceptPage.jsx";
import StudentPractice from "./pages/student/Practice.jsx";
import StudentAssess from "./pages/student/Assess.jsx";
import ResourcesLanding from "./pages/student/resources/ResourcesLanding.jsx";
import ResourcesCategoryPage from "./pages/student/resources/CategoryPage.jsx";

import TeacherSubjectLayout from "./pages/teacher/TeacherSubjectLayout.jsx";
import TeacherTeach from "./pages/teacher/Teach.jsx";
import TeacherQuiz from "./pages/teacher/Quiz.jsx";
import TeacherResources from "./pages/teacher/Resources.jsx";

// Q Builder pulls in PDF/Word export libraries (jsPDF, docx) that are only
// needed once a teacher actually opens it — lazy-loaded so those libraries
// never load on the rest of the site, same pattern already used for the
// interactive engines' component loaders in resources-registry.js.
const TeacherQBuilder = lazy(() => import("./pages/teacher/QBuilder.jsx"));

// No route ever encodes a curriculum-specific label like "structure" or
// "reactivity" — those live only in curriculum data. Likewise, no route
// hard-codes "chemistry" as anything other than one :subjectId value among
// others the programmes registry could list.

const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },

      // Role -> Programme -> Subject flow
      { path: "student", element: <ChooseProgramme role="student" /> },
      { path: "student/:programmeId", element: <ChooseSubject role="student" /> },
      {
        path: "student/:programmeId/:subjectId",
        element: <StudentSubjectLayout />,
        children: [
          { index: true, element: <Navigate to="learn" replace /> },
          {
            path: "learn",
            element: <LearnLayout />,
            children: [
              { index: true, element: <WelcomePage /> },
              { path: ":conceptId", element: <LearnConceptPage /> },
            ],
          },
          { path: "practice", element: <StudentPractice /> },
          { path: "assess", element: <StudentAssess /> },
          { path: "resources", element: <ResourcesLanding /> },
          { path: "resources/:categoryId", element: <ResourcesCategoryPage /> },
        ],
      },

      { path: "teacher", element: <ChooseProgramme role="teacher" /> },
      { path: "teacher/:programmeId", element: <ChooseSubject role="teacher" /> },
      {
        path: "teacher/:programmeId/:subjectId",
        element: <TeacherSubjectLayout />,
        children: [
          { index: true, element: <Navigate to="teach" replace /> },
          { path: "teach", element: <TeacherTeach /> },
          { path: "quiz", element: <TeacherQuiz /> },
          { path: "q-builder", element: <Suspense fallback={null}><TeacherQBuilder /></Suspense> },
          { path: "resources", element: <TeacherResources /> },
        ],
      },

      // Canonical content routes — unchanged, still directly reachable.
      // Learn/Teach link into these rather than duplicating their content.
      { path: "explore", element: <Explore /> },
      { path: "explore/:curriculumId", element: <ExploreCurriculum /> },
      { path: "topics", element: <Topics /> },
      { path: "topics/:conceptId", element: <ConceptPage /> },
      { path: "interactives", element: <Interactives /> },
      { path: "interactives/:interactiveId", element: <InteractivePage /> },
      { path: "teachers", element: <Teachers /> },
      { path: "about", element: <About /> },
      { path: "profile", element: <Profile /> },
      { path: "reset-password", element: <ResetPassword /> },

      { path: "*", element: <NotFound /> },
    ],
  },
]);

export default router;
