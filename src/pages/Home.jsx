import Hero from "../components/homepage/Hero.jsx";
import LearnByInteracting from "../components/homepage/LearnByInteracting.jsx";
import FeaturedInteractives from "../components/homepage/FeaturedInteractives.jsx";
import AudienceSplit from "../components/homepage/AudienceSplit.jsx";
import CurriculumShowcase from "../components/homepage/CurriculumShowcase.jsx";

export default function Home() {
  return (
    <>
      <Hero />
      <LearnByInteracting />
      <FeaturedInteractives />
      <AudienceSplit />
      <CurriculumShowcase />
    </>
  );
}
