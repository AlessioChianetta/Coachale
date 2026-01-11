import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Lightbulb,
  FileText,
  Megaphone,
  Users,
  Plus,
  TrendingUp,
  Clock,
  ArrowRight,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";

interface KPICard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}

interface ActivityItem {
  id: string;
  type: "idea" | "post" | "campaign";
  title: string;
  timestamp: string;
  status: string;
}

export default function ContentStudioDashboard() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();

  const kpiCards: KPICard[] = [
    {
      title: "[DEMO] Idee Generate",
      value: 47,
      icon: Lightbulb,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "[DEMO] Post Pubblicati",
      value: 23,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "[DEMO] Campagne Attive",
      value: 3,
      icon: Megaphone,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "[DEMO] Lead Generati",
      value: 156,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: "1",
      type: "idea",
      title: "[DEMO] 5 Modi per Aumentare le Vendite",
      timestamp: "2 ore fa",
      status: "Nuova",
    },
    {
      id: "2",
      type: "post",
      title: "[DEMO] Carosello Instagram - Fitness Tips",
      timestamp: "5 ore fa",
      status: "Programmato",
    },
    {
      id: "3",
      type: "campaign",
      title: "[DEMO] Campagna Lead Gen Gennaio",
      timestamp: "1 giorno fa",
      status: "Attiva",
    },
    {
      id: "4",
      type: "post",
      title: "[DEMO] Reel TikTok - Behind the Scenes",
      timestamp: "2 giorni fa",
      status: "Pubblicato",
    },
    {
      id: "5",
      type: "idea",
      title: "[DEMO] Tutorial Video Prodotto X",
      timestamp: "3 giorni fa",
      status: "In Lavorazione",
    },
  ];

  const quickActions = [
    {
      label: "Genera Nuova Idea",
      icon: Lightbulb,
      onClick: () => setLocation("/content-studio/ideas"),
      gradient: "from-amber-500 to-orange-600",
    },
    {
      label: "Crea Post",
      icon: FileText,
      onClick: () => setLocation("/content-studio/posts"),
      gradient: "from-blue-500 to-cyan-600",
    },
    {
      label: "Avvia Campagna",
      icon: Megaphone,
      onClick: () => setLocation("/content-studio/campaigns"),
      gradient: "from-purple-500 to-pink-600",
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "idea":
        return Lightbulb;
      case "post":
        return FileText;
      case "campaign":
        return Megaphone;
      default:
        return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Nuova":
        return "bg-blue-500/10 text-blue-600";
      case "Programmato":
        return "bg-amber-500/10 text-amber-600";
      case "Attiva":
        return "bg-green-500/10 text-green-600";
      case "Pubblicato":
        return "bg-emerald-500/10 text-emerald-600";
      case "In Lavorazione":
        return "bg-purple-500/10 text-purple-600";
      default:
        return "bg-gray-500/10 text-gray-600";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold">
                  Content Marketing Studio
                </h1>
                <p className="text-muted-foreground">
                  Gestisci i tuoi contenuti e campagne marketing
                </p>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                [DEMO] Dati di Esempio
              </Badge>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((kpi, index) => (
                <Card key={index} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <p className="text-xs sm:text-sm font-medium text-muted-foreground">
                          {kpi.title}
                        </p>
                        <p className="text-2xl sm:text-3xl font-bold">
                          {kpi.value}
                        </p>
                      </div>
                      <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                        <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                Azioni Rapide
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div
                      className={`absolute inset-0 bg-gradient-to-br ${action.gradient} opacity-90 group-hover:opacity-100 transition-opacity`}
                    />
                    <div className="relative z-10 text-white flex items-center gap-3">
                      <action.icon className="h-6 w-6" />
                      <span className="font-medium">{action.label}</span>
                      <ArrowRight className="h-4 w-4 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  Attività Recente
                </CardTitle>
                <Badge variant="secondary">[DEMO]</Badge>
              </CardHeader>
              <CardContent className="space-y-3">
                {recentActivity.map((item) => {
                  const IconComponent = getTypeIcon(item.type);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    >
                      <div className="p-2 rounded-lg bg-muted">
                        <IconComponent className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.timestamp}
                        </p>
                      </div>
                      <Badge className={getStatusColor(item.status)} variant="secondary">
                        {item.status}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    [DEMO] Performance Settimanale
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Engagement Rate
                      </span>
                      <span className="font-semibold text-green-600">+12.5%</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Reach Totale
                      </span>
                      <span className="font-semibold">45.2K</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Conversioni
                      </span>
                      <span className="font-semibold text-blue-600">89</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Megaphone className="h-5 w-5 text-purple-500" />
                    [DEMO] Campagna Top
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="font-medium">Lead Gen Gennaio 2025</p>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground">Spesa</p>
                        <p className="font-semibold">€1,250</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Lead</p>
                        <p className="font-semibold text-green-600">47</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CPL</p>
                        <p className="font-semibold">€26.60</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">CTR</p>
                        <p className="font-semibold">3.2%</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
