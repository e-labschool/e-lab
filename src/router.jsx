import { lazy, Suspense } from "react";
import ELabLoader from "./components/ui/ELabLoader.jsx";
import { createBrowserRouter, Navigate } from "react-router-dom";
import Shell from "./components/layout/Shell.jsx";
import ProtectedRoute from "./components/auth/ProtectedRoute.jsx";
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
import CurriculumSubjectSelect from "./pages/student/CurriculumSubjectSelect.jsx";
import LearnLayout from "./components/learn/LearnLayout.jsx";
import LearnCmsHome from "./components/learn/LearnCmsHome.jsx";
import LearnLessonPage from "./components/learn/LearnLessonPage.jsx";
import SolveHome from "./pages/student/solve/SolveHome.jsx";
import StudentProgressPage from "./pages/student/StudentProgressPage.jsx";
import StudentProfilePage from "./pages/student/StudentProfilePage.jsx";
import ResourcesLanding from "./pages/student/resources/ResourcesLanding.jsx";
import ResourcesCategoryPage from "./pages/student/resources/CategoryPage.jsx";

import TeacherLayout from "./pages/teacher/TeacherLayout.jsx";
import TeacherTeach from "./pages/teacher/Teach.jsx";
import ClassPlanner from "./pages/teacher/ClassPlanner.jsx";
import ClassPlanWorkspace from "./pages/teacher/ClassPlanWorkspace.jsx";
import PresentClass from "./pages/teacher/PresentClass.jsx";
import TeacherResources from "./pages/teacher/Resources.jsx";
import TeacherProfilePage from "./pages/teacher/TeacherProfilePage.jsx";

import AdminLayout from "./pages/admin/AdminLayout.jsx";
import AdminDashboard from "./pages/admin/AdminDashboard.jsx";
import AdminResources from "./pages/admin/resources/AdminResources.jsx";
import AdminLearnContent from "./pages/admin/learn/AdminLearnContent.jsx";
import LessonEditor from "./pages/admin/learn/LessonEditor.jsx";
import AdminQuestionBank from "./pages/admin/questions/AdminQuestionBank.jsx";
import QuestionEditor from "./pages/admin/questions/QuestionEditor.jsx";
import ImportQuestions from "./pages/admin/questions/ImportQuestions.jsx";
import AdminUsers from "./pages/admin/users/AdminUsers.jsx";
import AdminAccess from "./pages/admin/access/AdminAccess.jsx";
import AdminSettings from "./pages/admin/settings/AdminSettings.jsx";

// Q Builder pulls in PDF/Word export libraries (jsPDF, docx) that are only
// needed once a teacher actually opens it — lazy-loaded so those libraries
// never load on the rest of the site, same pattern already used for the
// interactive engines' component loaders in resources-registry.js.
const TeacherQBuilder = lazy(() => import("./pages/teacher/QBuilder.jsx"));

// Challenge Builder/Session/Report pull in QuestionRenderer ->
// StimulusRenderer, which drags in every question-visual component the Q
// Builder uses (VSEPR diagrams, spectra, etc.) — lazy-loaded so that
// weight only loads when a student actually starts/resumes a challenge,
// not on every page view. SolveHome itself stays eager (it's the direct
// child of the main Solve route and has no such heavy dependency).
const ChallengeBuilder = lazy(() => import("./pages/student/solve/ChallengeBuilder.jsx"));
const ChallengeSession = lazy(() => import("./pages/student/solve/ChallengeSession.jsx"));
const ChallengeReport = lazy(() => import("./pages/student/solve/ChallengeReport.jsx"));

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
      { index: true, element: <CurriculumSubjectSelect /> },
      {
        path: "learn",
        element: <LearnLayout />,
        children: [
          { index: true, element: <LearnCmsHome /> },
          { path: ":conceptId", element: <LearnLessonPage /> },
        ],
      },
      { path: "solve", element: <SolveHome /> },
      { path: "solve/new", element: <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><ELabLoader /></div>}><ChallengeBuilder /></Suspense> },
      { path: "solve/:challengeId/report", element: <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><ELabLoader /></div>}><ChallengeReport /></Suspense> },
      { path: "resources", element: <ResourcesLanding /> },
      { path: "resources/:categoryId", element: <ResourcesCategoryPage /> },
      { path: "progress", element: <StudentProgressPage /> },
      { path: "profile", element: <StudentProfilePage /> },
    ],
  },
  {
    // Deliberately OUTSIDE StudentLayout — a fresh top-level route with no
    // header, no nav tabs, no account menu, rather than StudentLayout's
    // chrome conditionally hidden. This is what actually makes "no normal
    // e-Lab navigation during an active challenge" true architecturally,
    // not just visually: there is no nav here to accidentally leave
    // reachable via a missed condition. Still protected the same way as
    // every other student route.
    path: "/student/solve/:challengeId",
    element: (
      <ProtectedRoute role="student">
        <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><ELabLoader /></div>}>
          <ChallengeSession />
        </Suspense>
      </ProtectedRoute>
    ),
  },
  {
    // Same reasoning as the Challenge session above — Present Class hides
    // the Teacher sidebar entirely, which only works architecturally by
    // living outside TeacherLayout, not via a conditionally-hidden nav.
    path: "/teacher/class-planner/:planId/present",
    element: (
      <ProtectedRoute role="teacher">
        <PresentClass />
      </ProtectedRoute>
    ),
  },
  {
    path: "/teacher",
    element: <TeacherLayout />,
    children: [
      { index: true, element: <Navigate to="/teacher/teach" replace /> },
      { path: "teach", element: <TeacherTeach /> },
      { path: "class-planner", element: <ClassPlanner /> },
      { path: "class-planner/:planId", element: <ClassPlanWorkspace /> },
      { path: "question-builder", element: <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center"><ELabLoader /></div>}><TeacherQBuilder /></Suspense> },
      { path: "resources", element: <TeacherResources /> },
      { path: "profile", element: <TeacherProfilePage /> },
    ],
  },
  {
    path: "/admin",
    element: <AdminLayout />,
    children: [
      { index: true, element: <AdminDashboard /> },
      { path: "learn-content", element: <AdminLearnContent /> },
      { path: "learn-content/new", element: <LessonEditor /> },
      { path: "learn-content/:pageId", element: <LessonEditor /> },
      { path: "resources", element: <AdminResources /> },
      { path: "question-bank", element: <AdminQuestionBank /> },
      { path: "question-bank/new", element: <QuestionEditor /> },
      { path: "question-bank/import", element: <ImportQuestions /> },
      { path: "question-bank/:questionId", element: <QuestionEditor /> },
      { path: "users", element: <AdminUsers /> },
      { path: "access", element: <AdminAccess /> },
      { path: "settings", element: <AdminSettings /> },
    ],
  },
]);

export default router;
