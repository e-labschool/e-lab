import Container from "../../components/ui/Container.jsx";
import ProfileCard from "../../components/profile/ProfileCard.jsx";

export default function StudentProfilePage() {
  return (
    <Container className="py-14">
      <ProfileCard role="student" levelLabel="Level" levelOptions={["SL", "HL"]} showClassGrade />
    </Container>
  );
}
