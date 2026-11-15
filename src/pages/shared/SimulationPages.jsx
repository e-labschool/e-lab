import { useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { useAccessConfig, useAccessContext } from "../../lib/access/AccessConfigContext.jsx";
import SimulationLibrary from "../../components/simulation-library/SimulationLibrary.jsx";
import SimulationViewer from "../../components/simulation-library/SimulationViewer.jsx";

const BASE = { student: "/student/simulations", teacher: "/teacher/simulations" };

/** /student/simulations and /teacher/simulations -- the same library, role only changes the action label and base path. */
export function SimulationsLibraryPage({ role }) {
  const { user } = useAuth();
  const { catalogue } = useAccessConfig();
  const ctx = useAccessContext();
  return <SimulationLibrary role={role} userId={user?.id} entries={catalogue} ctx={ctx} basePath={BASE[role]} />;
}

/** /student/simulations/:simulationId and /teacher/simulations/:simulationId -- the simulation inside the role layout. */
export function SimulationViewPage({ role }) {
  const { simulationId } = useParams();
  const { user } = useAuth();
  const { catalogue } = useAccessConfig();
  const ctx = useAccessContext();
  return <SimulationViewer role={role} userId={user?.id} simulationId={simulationId} entries={catalogue} ctx={ctx} basePath={BASE[role]} />;
}
