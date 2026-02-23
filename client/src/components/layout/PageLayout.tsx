import { useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  return (
    <div className="min-h-screen bg-background">
      {isMobile && (
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
      )}
      <div className={cn("flex", isMobile ? "h-[calc(100vh-56px)]" : "h-screen")}>
        <Sidebar
          role={role}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showRoleSwitch={showRoleSwitch}
          currentRole={currentRole}
          onRoleSwitch={handleRoleSwitch}
        />
        <main className="flex-1 overflow-y-auto">
          <div
            className={cn(
              !noPadding && "page-container",
              "pb-safe",
              className
            )}
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
