import { Link } from "react-router-dom";
import { Play } from "lucide-react";
import Container from "../ui/Container.jsx";

export default function ClosingCta({ onTryDemo }) {
  return (
    <section aria-labelledby="cta-title" className="bg-[#12172A] py-14 text-center md:py-16">
      <Container>
        <h2 id="cta-title" className="font-[var(--font-display)] text-3xl font-semibold tracking-tight text-white">Ready to explore chemistry?</h2>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <button type="button" onClick={onTryDemo} className="inline-flex items-center gap-2 rounded-md bg-white px-5 py-3 text-[15px] font-semibold text-[#12172A] hover:bg-[#EEF1FB] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12172A]">
            <Play size={15} aria-hidden="true" /> Try a simulation
          </button>
          <Link to="/auth?tab=create-account" className="inline-flex items-center rounded-md border border-white/60 px-5 py-3 text-[15px] font-semibold text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#12172A]">Create free account</Link>
        </div>
      </Container>
    </section>
  );
}
