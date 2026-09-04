import { lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router-dom";
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
import AuthPage from "./pages/AuthPage.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import ResetPassword from "./pages/ResetPassword.jsx";
import NotFound from "./pages/NotFound.jsx";

import StudentLayout from "./pages/student/StudentLayout.jsx";
import StudentDashboard from "./pages/student/StudentDashboard.jsx";
import LearnLayout from "./components/learn/LearnLayout.jsx";
import WelcomePage from "./components/learn/WelcomePage.jsx";
import LearnConceptPage from "./components/learn/LearnConceptPage.jsx";
import StudentPractice from "./pages/student/Practice.jsx";
import StudentProgressPage from "./pages/student/StudentProgressPage.jsx";
import StudentProfilePage from "./pages/student/StudentProfilePage.jsx";
import ResourcesLanding from "./pages/student/resources/ResourcesLanding.jsx";
import ResourcesCategoryPage from "./pages/student/resources/CategoryPage.jsx";

import TeacherLayout from "./pages/teacher/TeacherLayout.jsx";
import TeacherDashboard from "./pages/teacher/TeacherDashboard.jsx";
import TeacherTeach from "./pages/teacher/Teach.jsx";
import TeacherResources from "./pages/teacher/Resources.jsx";
import TeacherProfilePage from "./pages/teacher/TeacherProfilePage.jsx";

// Q Builder pulls in PDF/Word export libraries (jsPDF, docx) that are only
// needed once a teacher actually opens it — lazy-loaded so those libraries
// never load on the rest of the site, same pattern already used for the
// interactive engines' component loaders in resources-registry.js.
const TeacherQBuilder = lazy(() => import("./pages/teacher/QBuilder.jsx"));

// /student and /teacher are deliberately SEPARATE top-level route trees,
// not nested under the public Shell — StudentLayout/TeacherLayout render
// their own complete chrome (header, nav, account menu) via ProtectedRoute,
// so nesting them under Shell would double up the header. Shell (with the
// public Header/Footer) covers only the public site.
const router = createBrowserRouter([
  {
    path: "/",
    element: <Shell />,
    children: [
      { index: true, element: <Home /> },

      { path: "auth", element: <AuthPage /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password", element: <ResetPassword /> },

      // Canonical content routes — unchanged, still directly reachable.
      { path: "explore", element: <Explore /> },
      { path: "explore/:curriculumId", element: <ExploreCurriculum /> },
      { path: "topics", element: <Topics /> },
      { path: "topics/:conceptId", element: <ConceptPage /> },
      { path: "interactives", element: <Interactives /> },
      { path: "interactives/:interactiveId", element: <InteractivePage /> },
      { path: "teachers", element: <Teachers /> },
      { path: "about", element: <About /> },

      { path: "*", element: <NotFound /> },
    ],
  },
  {
    path: "/student",
    element: <StudentLayout />,
    children: [
      { index: true, element: <StudentDashboard /> },
      {
        path: "learn",
        element: <LearnLayout />,
        children: [
          { index: true, element: <WelcomePage /> },
          { path: ":conceptId", element: <LearnConceptPage /> },
        ],
      },
      { path: "solve", element: <StudentPractice /> },
      { path: "resources", element: <ResourcesLanding /> },
      { path: "resources/:categoryId", element: <ResourcesCategoryPage /> },
      { path: "progress", element: <StudentProgressPage /> },
      { path: "profile", element: <StudentProfilePage /> },
    ],
  },
  {
    path: "/teacher",
    element: <TeacherLayout />,
    children: [
      { index: true, element: <TeacherDashboard /> },
      { path: "teach", element: <TeacherTeach /> },
      { path: "question-builder", element: <Suspense fallback={null}><TeacherQBuilder /></Suspense> },
      { path: "resources", element: <TeacherResources /> },
      { path: "profile", element: <TeacherProfilePage /> },
    ],
  },
]);

export default router;
