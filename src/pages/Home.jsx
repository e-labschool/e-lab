import Hero from "../components/homepage/Hero.jsx";
import FeatureStrip from "../components/homepage/FeatureStrip.jsx";
import RoleCards from "../components/homepage/RoleCards.jsx";
import ExploreGrid from "../components/homepage/ExploreGrid.jsx";
import CurriculumNote from "../components/homepage/CurriculumNote.jsx";

// The homepage stays identity + role selection first, with a lightweight
// feature strip and a real-route preview grid to reduce the "too empty"
// feel without turning it into a dashboard. LearnByInteracting,
// FeaturedInteractives, and CurriculumShowcase remain unused-but-preserved
// files, per the earlier navigation refactor.
export default function Home() {
  return (
    <>
      <Hero />
      <FeatureStrip />
      <RoleCards />
      <ExploreGrid />
      <CurriculumNote />
    </>
  );
}
