import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import ProfileSetupGate from "../auth/ProfileSetupGate.jsx";

export default function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <ProfileSetupGate />
    </div>
  );
}
