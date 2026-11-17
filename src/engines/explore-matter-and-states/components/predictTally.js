import { createContext, useContext } from "react";

// Session tally of the student's predictions (GS-27). The orchestrator provides { right, total, record(correct) };
// outside it (tests, a scene on its own) the default does nothing.
export const PredictTallyContext = createContext({ right: 0, total: 0, record: () => {} });
export const usePredictTally = () => useContext(PredictTallyContext);
