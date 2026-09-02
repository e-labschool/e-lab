import Hero from "../components/homepage/Hero.jsx";
import RoleCards from "../components/homepage/RoleCards.jsx";

// The homepage is identity + role selection only, deliberately — no
// featured simulations, topic grids, or resource categories here. Existing
// homepage sections (LearnByInteracting, FeaturedInteractives,
// CurriculumShowcase) are preserved as files but no longer rendered on the
// landing page per the navigation refactor.
export default function Home() {
  return (
    <>
      <Hero />
      <RoleCards />
    </>
  );
}
