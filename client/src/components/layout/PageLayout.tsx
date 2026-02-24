import { useState } from "react";
import { useLocation } from "wouter";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { cn } from "@/lib/utils";
import { Link } from "wouter";
import { GraduationCap, ChevronRight, PlayCircle } from "lucide-react";

const ACADEMY_HIDDEN_ROUTES = [
  "/consultant/academy",
  "/consultant/setup-wizard",
];

function AcademyBanner() {
  return (
    <Link href="/consultant/academy">
      <div className="mx-4 sm:mx-6 mt-4 relative cursor-pointer rounded-xl overflow-hidden group hover:shadow-lg transition-shadow duration-200">
        <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-violet-600" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_50%,rgba(255,255,255,0.1),transparent_60%)]" />
        <div className="relative px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/20 group-hover:scale-105 transition-transform shrink-0">
            <GraduationCap className="h-4.5 w-4.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">Accademia di Formazione</span>
              <span className="text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-white/20 text-white/80 hidden sm:inline">27 lezioni</span>
            </div>
            <p className="text-xs text-white/60 hidden sm:block">Video tutorial per configurare la piattaforma in autonomia</p>
          </div>
          <div className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/15 border border-white/20 text-white text-xs font-medium group-hover:bg-white/25 transition-all">
            <PlayCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Guarda</span>
            <ChevronRight className="h-3 w-3 opacity-60" />
          </div>
        </div>
      </div>
    </Link>
  );
}

interface PageLayoutProps {
  role: "consultant" | "client";
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageLayout({ role, children, className, noPadding = false }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [location] = useLocation();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  const showAcademy = role === "consultant" && !ACADEMY_HIDDEN_ROUTES.some(r => location.startsWith(r));

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <div className="md:hidden sticky top-0 z-50">
        <Navbar onToggleSidebar={() => setSidebarOpen(true)} />
      </div>

      <div className="flex flex-1 min-h-0">
        <Sidebar
          role={role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showRoleSwitch={showRoleSwitch}
          currentRole={currentRole}
          onRoleSwitch={handleRoleSwitch}
        />

        <main className="flex-1 overflow-y-auto min-h-0">
          {showAcademy && <AcademyBanner />}
          <div className={cn(!noPadding && "page-container pb-safe", className)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
