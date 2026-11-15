import Container from "../../components/ui/Container.jsx";
import ProfileCard from "../../components/profile/ProfileCard.jsx";
import PlanCard from "../../components/profile/PlanCard.jsx";

export default function TeacherProfilePage() {
  return (
    <Container className="py-14">
      <ProfileCard role="teacher" />
      <PlanCard role="teacher" />
    </Container>
  );
}
