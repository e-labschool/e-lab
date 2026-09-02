import { useEffect } from "react";
import { Outlet, useParams, Navigate } from "react-router-dom";
import { getSubject } from "../../data/programmes.js";
import { useRole } from "../../context/RoleContext.jsx";

export default function TeacherSubjectLayout() {
  const { programmeId, subjectId } = useParams();
  const { setRole } = useRole();
  const subject = getSubject(programmeId, subjectId);

  useEffect(() => {
    setRole("teacher");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!subject) return <Navigate to="/teacher" replace />;

  return <Outlet context={{ programmeId, subjectId, subject }} />;
}
