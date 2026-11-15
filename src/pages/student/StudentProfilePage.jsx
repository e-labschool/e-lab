import Container from "../../components/ui/Container.jsx";
import ProfileCard from "../../components/profile/ProfileCard.jsx";
import PlanCard from "../../components/profile/PlanCard.jsx";

export default function StudentProfilePage() {
  return (
    <Container className="py-14">
      <ProfileCard role="student" />
      <PlanCard role="student" />
    </Container>
  );
}
