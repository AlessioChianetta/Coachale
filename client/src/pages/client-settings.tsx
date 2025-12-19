import { useState } from "react";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import FinanceSettings from "@/components/FinanceSettings";
import ExternalServicesSettings from "@/components/ExternalServicesSettings";
import { Settings } from "lucide-react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";

export default function ClientSettings() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const pageContext = usePageContext({
    pageType: "settings",
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 p-4 md:p-8 overflow-y-auto bg-transparent">
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-2">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl shadow-lg">
                <Settings className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100">
                  Impostazioni
                </h1>
                <p className="text-muted-foreground text-sm md:text-base mt-1">
                  Configura le tue preferenze e integrazioni
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-4xl space-y-6">
            <FinanceSettings />
            <ExternalServicesSettings />
          </div>
        </div>
      </div>

      <AIAssistant pageContext={pageContext} />
    </div>
  );
}
