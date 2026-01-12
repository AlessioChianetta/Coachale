import { ReactNode, useState } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const Z = {
  base: 'z-0',
  sidebar: 'z-30',
  dialog: 'z-40',
  overlay: 'z-50'
} as const;

export const WHATSAPP_Z_INDEX = Z;

interface WhatsAppLayoutProps {
  title?: string;
  description?: string;
  actions?: ReactNode;
  headerContent?: ReactNode;
  children: ReactNode;
  showHeader?: boolean;
  fullWidth?: boolean;
  sidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
}

export default function WhatsAppLayout({
  title,
  description,
  actions,
  headerContent,
  children,
  showHeader = true,
  fullWidth = false,
  sidebarOpen: controlledSidebarOpen,
  onSidebarOpenChange,
}: WhatsAppLayoutProps) {
  const isMobile = useIsMobile();
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);

  const sidebarOpen = controlledSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = onSidebarOpenChange ?? setInternalSidebarOpen;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-950">
      <div className={`flex ${isMobile ? 'h-auto' : 'h-screen'}`}>
        {/* Sidebar - Standard flex positioning */}
        {isMobile ? (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar role="consultant" />
            </SheetContent>
          </Sheet>
        ) : (
          <Sidebar role="consultant" isOpen={true} onClose={() => {}} />
        )}

        {/* Main Content Area */}
        <main className={`flex-1 relative ${Z.base} overflow-y-auto`}>
        {/* Header */}
        {showHeader && (
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="flex items-center justify-between px-4 py-4">
              {/* Left side - Mobile menu + Title */}
              <div className="flex items-center gap-4">
                {isMobile && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                )}
                {(title || description) && (
                  <div>
                    {title && (
                      <h1 className="text-2xl font-bold text-foreground">
                        {title}
                      </h1>
                    )}
                    {description && (
                      <p className="text-sm text-muted-foreground">
                        {description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Right side - Actions */}
              {actions && <div className="flex items-center gap-2">{actions}</div>}
            </div>

            {/* Additional header content */}
            {headerContent && (
              <div className="px-4 pb-4">
                {headerContent}
              </div>
            )}
          </div>
        )}

        {/* Page Content */}
        <div className={fullWidth ? "" : "p-4 lg:p-8"}>
          {children}
        </div>
        </main>
      </div>
    </div>
  );
}
