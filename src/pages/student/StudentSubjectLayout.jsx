import { useEffect } from "react";
import { Outlet, useParams, Navigate } from "react-router-dom";
import { getSubject } from "../../data/programmes.js";
import { useRole } from "../../context/RoleContext.jsx";

// Validates the :programmeId/:subjectId in the URL against the programme
// registry and sets the role. The actual Learn/Practice/Assess navigation
// tabs live in Header.jsx (a single source of nav truth), not here — this
// component only guards the route and renders its children.
export default function StudentSubjectLayout() {
  const { programmeId, subjectId } = useParams();
  const { setRole } = useRole();
  const subject = getSubject(programmeId, subjectId);

  useEffect(() => {
    setRole("student");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!subject) return <Navigate to="/student" replace />;

  return <Outlet context={{ programmeId, subjectId, subject }} />;
}
