import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import LandingHero from "../components/homepage/LandingHero.jsx";
import RoleStrip from "../components/homepage/RoleStrip.jsx";
import FeatureCards from "../components/homepage/FeatureCards.jsx";
import SimulationShowcase from "../components/homepage/SimulationShowcase.jsx";
import TeachersSection from "../components/homepage/TeachersSection.jsx";
import FaqSection from "../components/homepage/FaqSection.jsx";
import ClosingCta from "../components/homepage/ClosingCta.jsx";
import { scrollToId } from "../components/homepage/useLandingLinks.js";
import { useAccessConfig } from "../lib/access/AccessConfigContext.jsx";
import { showPremiumUi } from "../lib/access/accessPolicy.js";

// Built but only fetched / rendered while Premium is on, so it costs the initial load nothing today.
const PlansSection = lazy(() => import("../components/homepage/PlansSection.jsx"));

// Landing page (docs/mockups/00-landing-page.png).  The Plans section exists only while Premium is switched on.
export default function Home() {
  const { config } = useAccessConfig();
  const { hash } = useLocation();
  const [demoRequested, setDemoRequested] = useState(false);

  // "Try a simulation": scroll the demo into view and ask it to start (it is the only thing that loads an engine).
  const tryDemo = useCallback(() => { setDemoRequested(true); scrollToId("demo"); }, []);

  // In-page nav links (/#simulations ...) -- the router does not scroll to hashes by itself.
  useEffect(() => {
    if (!hash) return;
    const id = hash.slice(1);
    const t = setTimeout(() => scrollToId(id), 0);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <>
      <LandingHero demoRequested={demoRequested} onTryDemo={tryDemo} />
      <RoleStrip />
      <FeatureCards />
      <SimulationShowcase />
      <TeachersSection />
      {showPremiumUi(config) && <Suspense fallback={null}><PlansSection /></Suspense>}
      <FaqSection />
      <ClosingCta onTryDemo={tryDemo} />
    </>
  );
}
