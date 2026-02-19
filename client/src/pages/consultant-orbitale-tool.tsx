import { useState } from "react";
import { useRoute } from "wouter";
import { ExternalLink, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";

const TOOL_MAP: Record<string, { name: string; url: string }> = {
  finanza: { name: "Orbitale Finanza", url: "https://orbitalefinanza.it/" },
  crm: { name: "Orbitale CRM", url: "https://orbitalecrm.it/" },
  contract: { name: "Orbitale Contract", url: "https://orbitalecontract.it/" },
  locale: { name: "Orbitale Locale", url: "https://orbitalelocale.it/" },
};

export default function ConsultantOrbitaleTool() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const [, params] = useRoute("/consultant/tools/:toolId");
  const toolId = params?.toolId || "";
  const tool = TOOL_MAP[toolId];

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          showRoleSwitch={showRoleSwitch}
          currentRole={currentRole}
          onRoleSwitch={handleRoleSwitch}
        />

        <div className="flex-1 flex flex-col overflow-hidden">
          {tool ? (
            <>
              <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-background/95 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <Link href="/consultant">
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </Link>
                  <h1 className="text-sm font-semibold">{tool.name}</h1>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs"
                  onClick={() => window.open(tool.url, '_blank')}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Apri in nuova tab
                </Button>
              </div>
              <iframe
                src={tool.url}
                className="flex-1 w-full border-0"
                style={{ height: 'calc(100vh - 49px)' }}
                allow="clipboard-read; clipboard-write"
                title={tool.name}
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center space-y-4">
                <h2 className="text-xl font-semibold">Strumento non trovato</h2>
                <p className="text-muted-foreground text-sm">Lo strumento richiesto non esiste.</p>
                <Link href="/consultant">
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Torna alla Dashboard
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
