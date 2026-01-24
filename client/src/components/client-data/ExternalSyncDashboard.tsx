import { useState } from "react";
import { Cloud } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { SyncOverviewCards } from "./SyncOverviewCards";
import { SyncSourcesManager } from "./SyncSourcesManager";
import { SyncScheduleConfig } from "./SyncScheduleConfig";
import { SyncHistoryLog } from "./SyncHistoryLog";
import { WebhookTestTool } from "./WebhookTestTool";
import { SchemaReferencePanel } from "./SchemaReferencePanel";
import { SyncSetupGuide } from "./SyncSetupGuide";

export function ExternalSyncDashboard() {
  const [activeTab, setActiveTab] = useState("panoramica");

  const handleViewHistory = () => {
    setActiveTab("cronologia");
  };

  return (
    <Card className="border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-6">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-2xl">
            <Cloud className="h-6 w-6 text-cyan-600" />
            Integrazioni Esterne
          </CardTitle>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Gestisci sincronizzazioni automatiche da sistemi partner
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-7 mb-4">
            <TabsTrigger value="guida">Guida</TabsTrigger>
            <TabsTrigger value="panoramica">Panoramica</TabsTrigger>
            <TabsTrigger value="sorgenti">Sorgenti</TabsTrigger>
            <TabsTrigger value="pianificazione">Pianificazione</TabsTrigger>
            <TabsTrigger value="cronologia">Cronologia</TabsTrigger>
            <TabsTrigger value="webhook">Test</TabsTrigger>
            <TabsTrigger value="schema">Schema</TabsTrigger>
          </TabsList>

          <TabsContent value="guida">
            <SyncSetupGuide />
          </TabsContent>

          <TabsContent value="panoramica">
            <SyncOverviewCards onViewHistory={handleViewHistory} />
          </TabsContent>

          <TabsContent value="sorgenti">
            <SyncSourcesManager />
          </TabsContent>

          <TabsContent value="pianificazione">
            <SyncScheduleConfig />
          </TabsContent>

          <TabsContent value="cronologia">
            <SyncHistoryLog />
          </TabsContent>

          <TabsContent value="webhook">
            <WebhookTestTool />
          </TabsContent>

          <TabsContent value="schema">
            <SchemaReferencePanel />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
