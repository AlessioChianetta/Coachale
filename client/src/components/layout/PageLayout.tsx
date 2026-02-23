import { useState } from "react";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { cn } from "@/lib/utils";

interface PageLayoutProps {
  role: "consultant" | "client";
  children: React.ReactNode;
  className?: string;
  noPadding?: boolean;
}

export function PageLayout({ role, children, className, noPadding = false }: PageLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

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
          <div className={cn(!noPadding && "page-container pb-safe", className)}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
