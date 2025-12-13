import { useState } from "react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UserPlus, Megaphone, Zap, KanbanSquare, Settings, FileText, BarChart } from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { PipelineKanban } from "@/components/automations/PipelineKanban";
import { AutomationRulesList } from "@/components/automations/AutomationRulesList";
import { TemplatesGrid } from "@/components/automations/TemplatesGrid";
import { AnalyticsDashboard } from "@/components/automations/AnalyticsDashboard";

export default function ConsultantAutomationsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />}
      <div className="flex">
        {isMobile ? (
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
        ) : (
          <Sidebar role="consultant" />
        )}

        <main className="flex-1 p-4 md:p-6 lg:p-8 overflow-auto">
          <div className="max-w-7xl mx-auto">
            <NavigationTabs
              tabs={[
                { label: "Lead Proattivi", href: "/consultant/proactive-leads", icon: UserPlus },
                { label: "Campagne", href: "/consultant/campaigns", icon: Megaphone },
                { label: "Automazioni", href: "/consultant/automations", icon: Zap },
              ]}
            />

            <div className="mb-6">
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                Sistema Automazioni Follow-up
              </h1>
              <p className="text-muted-foreground mt-2">
                Gestisci le regole di follow-up automatico e monitora la pipeline lead
              </p>
            </div>

            <Tabs defaultValue="pipeline" className="w-full">
              <TabsList className="grid w-full grid-cols-4 mb-6">
                <TabsTrigger value="pipeline" className="flex items-center gap-2">
                  <KanbanSquare className="h-4 w-4" />
                  <span className="hidden sm:inline">Pipeline</span>
                </TabsTrigger>
                <TabsTrigger value="regole" className="flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  <span className="hidden sm:inline">Regole</span>
                </TabsTrigger>
                <TabsTrigger value="template" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Template</span>
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <BarChart className="h-4 w-4" />
                  <span className="hidden sm:inline">Analytics</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="pipeline">
                <PipelineKanban />
              </TabsContent>

              <TabsContent value="regole">
                <AutomationRulesList />
              </TabsContent>

              <TabsContent value="template">
                <TemplatesGrid />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsDashboard />
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>

      <ConsultantAIAssistant />
    </div>
  );
}
