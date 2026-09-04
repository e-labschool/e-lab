import Container from "../../components/ui/Container.jsx";
import ProfileCard from "../../components/profile/ProfileCard.jsx";

export default function TeacherProfilePage() {
  return (
    <Container className="py-14">
      <ProfileCard role="teacher" levelLabel="Teaching Level" levelOptions={["SL", "HL", "SL & HL"]} showClassGrade={false} />
    </Container>
  );
}
