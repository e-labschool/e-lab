import { Link } from "react-router-dom";
import { BookOpen, FolderOpen, HelpCircle, Users, Lock, Settings } from "lucide-react";

const CARDS = [
  { to: "/admin/learn-content", label: "Learn Content", description: "Manage learning modules and lessons", icon: BookOpen },
  { to: "/admin/resources", label: "Resources", description: "Upload and manage learning resources", icon: FolderOpen },
  { to: "/admin/question-bank", label: "Question Bank", description: "Manage e-Lab questions", icon: HelpCircle },
  { to: "/admin/users", label: "Users", description: "View and manage platform users", icon: Users },
  { to: "/admin/access", label: "Access", description: "Manage platform access and future plans", icon: Lock },
  { to: "/admin/settings", label: "Settings", description: "Platform settings", icon: Settings },
];

export default function AdminDashboard() {
  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <h1 className="font-[var(--font-display)] text-2xl font-semibold tracking-tight text-[var(--color-ink)]">e-Lab Admin</h1>
      <p className="mt-1 text-sm text-[var(--color-ink-soft)]">Manage the content and operation of e-Lab.</p>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-lg border border-[var(--color-line)] bg-[var(--color-paper-raised)] p-5 transition-colors hover:border-[var(--color-ink)]"
          >
            <card.icon size={18} className="text-[var(--color-ink-soft)]" />
            <p className="mt-3 text-sm font-medium text-[var(--color-ink)]">{card.label}</p>
            <p className="mt-1 text-xs text-[var(--color-ink-faint)]">{card.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
