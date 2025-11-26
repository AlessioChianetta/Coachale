import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UserPlus, Users, CheckCircle, ArrowRight, TrendingUp } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getAuthHeaders } from "@/lib/auth";
import { useLocation } from "wouter";

export function LeadPipelineView() {
  const [, setLocation] = useLocation();

  const { data: leadsResponse } = useQuery<any>({
    queryKey: ["/api/proactive-leads"],
    queryFn: async () => {
      const response = await fetch("/api/proactive-leads", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { success: false, leads: [] };
      return response.json();
    },
  });

  const leads = Array.isArray(leadsResponse?.leads) ? leadsResponse.leads : [];

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Calculate pipeline stages
  const pendingLeads = leads.filter((l: any) => l.status === "pending").length;
  const contactedLeads = leads.filter((l: any) => l.status === "contacted" || l.status === "responded").length;
  const convertedLeads = leads.filter((l: any) => l.status === "converted").length;
  const totalClients = clients.length;

  // Calculate conversion rates
  const totalLeads = leads.length;
  const contactRate = totalLeads > 0 ? ((contactedLeads + convertedLeads) / totalLeads * 100).toFixed(1) : "0";
  const conversionRate = totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(1) : "0";

  const handleManageLeads = () => {
    setLocation("/consultant/proactive-leads");
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-primary" />
            <span>Pipeline Lead → Cliente</span>
          </CardTitle>
          <Button size="sm" variant="outline" onClick={handleManageLeads}>
            Gestisci Lead
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Funnel di conversione e stato dei lead
        </p>
      </CardHeader>
      <CardContent>
        {/* Pipeline Visualization */}
        <div className="space-y-6">
          {/* Stage 1: New Leads */}
          <div className="relative">
            <div className="flex items-center justify-between p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Nuovi Lead</p>
                  <p className="text-2xl font-bold">{pendingLeads}</p>
                </div>
              </div>
              <Badge className="bg-blue-500 text-white">Pending</Badge>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-5 z-10">
              <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90" />
            </div>
          </div>

          {/* Stage 2: Contacted */}
          <div className="relative">
            <div className="flex items-center justify-between p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-yellow-500 rounded-full flex items-center justify-center">
                  <Users className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Contattati / Qualificati</p>
                  <p className="text-2xl font-bold">{contactedLeads}</p>
                </div>
              </div>
              <Badge className="bg-yellow-500 text-white">In Processo</Badge>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-5 z-10">
              <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90" />
            </div>
          </div>

          {/* Stage 3: Converted */}
          <div className="relative">
            <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-500 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Convertiti</p>
                  <p className="text-2xl font-bold">{convertedLeads}</p>
                </div>
              </div>
              <Badge className="bg-green-500 text-white">Clienti</Badge>
            </div>
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-5 z-10">
              <ArrowRight className="w-6 h-6 text-muted-foreground rotate-90" />
            </div>
          </div>

          {/* Final Stage: Total Clients */}
          <div className="flex items-center justify-between p-4 bg-primary/10 border border-primary/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Clienti Attivi Totali</p>
                <p className="text-2xl font-bold">{totalClients}</p>
              </div>
            </div>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
              Attivi
            </Badge>
          </div>
        </div>

        {/* Conversion Metrics */}
        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <p className="text-sm font-medium text-muted-foreground">Tasso Contatto</p>
            </div>
            <p className="text-3xl font-bold text-primary">{contactRate}%</p>
          </div>
          <div className="p-4 bg-muted/50 rounded-lg">
            <div className="flex items-center space-x-2 mb-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <p className="text-sm font-medium text-muted-foreground">Tasso Conversione</p>
            </div>
            <p className="text-3xl font-bold text-green-500">{conversionRate}%</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
