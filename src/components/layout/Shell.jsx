import { Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import Footer from "./Footer.jsx";
import PendingProfileSync from "../auth/PendingProfileSync.jsx";

export default function Shell() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
      <PendingProfileSync />
    </div>
  );
}
