import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Lightbulb,
  FileText,
  Megaphone,
  Users,
  TrendingUp,
  Clock,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useLocation } from "wouter";
import { getAuthHeaders } from "@/lib/auth";

interface KPICard {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
}

interface ContentIdea {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface ContentPost {
  id: string;
  title: string;
  status: string;
  createdAt: string;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  leads?: number;
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

  const { data: ideasResponse, isLoading: ideasLoading } = useQuery({
    queryKey: ["/api/content/ideas"],
    queryFn: async () => {
      const response = await fetch("/api/content/ideas", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch ideas");
      return response.json();
    },
  });

  const { data: postsResponse, isLoading: postsLoading } = useQuery({
    queryKey: ["/api/content/posts"],
    queryFn: async () => {
      const response = await fetch("/api/content/posts", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch posts");
      return response.json();
    },
  });

  const { data: campaignsResponse, isLoading: campaignsLoading } = useQuery({
    queryKey: ["/api/content/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/content/campaigns", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      return response.json();
    },
  });

  const ideas: ContentIdea[] = ideasResponse?.data || [];
  const posts: ContentPost[] = postsResponse?.data || [];
  const campaigns: Campaign[] = campaignsResponse?.data || [];

  const isLoading = ideasLoading || postsLoading || campaignsLoading;

  const activeCampaigns = campaigns.filter((c) => c.status === "attiva" || c.status === "active");
  const publishedPosts = posts.filter((p) => p.status === "pubblicato" || p.status === "published");
  const totalLeads = campaigns.reduce((sum, c) => sum + (c.leads || 0), 0);

  const kpiCards: KPICard[] = [
    {
      title: "Idee Generate",
      value: ideas.length,
      icon: Lightbulb,
      color: "text-amber-600",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Post Pubblicati",
      value: publishedPosts.length,
      icon: FileText,
      color: "text-blue-600",
      bgColor: "bg-blue-500/10",
    },
    {
      title: "Campagne Attive",
      value: activeCampaigns.length,
      icon: Megaphone,
      color: "text-purple-600",
      bgColor: "bg-purple-500/10",
    },
    {
      title: "Lead Generati",
      value: totalLeads,
      icon: Users,
      color: "text-green-600",
      bgColor: "bg-green-500/10",
    },
  ];

  const formatRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffHours < 1) return "Meno di 1 ora fa";
    if (diffHours < 24) return `${diffHours} ore fa`;
    if (diffDays === 1) return "1 giorno fa";
    return `${diffDays} giorni fa`;
  };

  const recentActivity: ActivityItem[] = [
    ...ideas.slice(0, 3).map((idea) => ({
      id: idea.id,
      type: "idea" as const,
      title: idea.title,
      timestamp: formatRelativeTime(idea.createdAt),
      status: idea.status === "new" ? "Nuova" : idea.status === "in_progress" ? "In Lavorazione" : idea.status,
    })),
    ...posts.slice(0, 3).map((post) => ({
      id: post.id,
      type: "post" as const,
      title: post.title || "Post senza titolo",
      timestamp: formatRelativeTime(post.createdAt),
      status: post.status === "published" ? "Pubblicato" : post.status === "scheduled" ? "Programmato" : post.status === "draft" ? "Bozza" : post.status,
    })),
    ...campaigns.slice(0, 2).map((campaign) => ({
      id: campaign.id,
      type: "campaign" as const,
      title: campaign.name,
      timestamp: formatRelativeTime(campaign.createdAt),
      status: campaign.status === "active" ? "Attiva" : campaign.status === "paused" ? "In Pausa" : campaign.status,
    })),
  ].sort((a, b) => {
    return 0;
  }).slice(0, 5);

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
    const lowerStatus = status.toLowerCase();
    if (lowerStatus === "nuova" || lowerStatus === "new") return "bg-blue-500/10 text-blue-600";
    if (lowerStatus === "programmato" || lowerStatus === "scheduled") return "bg-amber-500/10 text-amber-600";
    if (lowerStatus === "attiva" || lowerStatus === "active") return "bg-green-500/10 text-green-600";
    if (lowerStatus === "pubblicato" || lowerStatus === "published") return "bg-emerald-500/10 text-emerald-600";
    if (lowerStatus === "in lavorazione" || lowerStatus === "in_progress") return "bg-purple-500/10 text-purple-600";
    return "bg-gray-500/10 text-gray-600";
  };

  const topCampaign = campaigns.find((c) => c.status === "attiva" || c.status === "active");

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
                        {isLoading ? (
                          <Skeleton className="h-8 w-16" />
                        ) : (
                          <p className="text-2xl sm:text-3xl font-bold">
                            {kpi.value}
                          </p>
                        )}
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
              </CardHeader>
              <CardContent className="space-y-3">
                {isLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-3">
                      <Skeleton className="h-10 w-10 rounded-lg" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-48 mb-2" />
                        <Skeleton className="h-3 w-24" />
                      </div>
                    </div>
                  ))
                ) : recentActivity.length > 0 ? (
                  recentActivity.map((item) => {
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
                  })
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nessuna attività recente</p>
                    <p className="text-sm">Inizia creando la tua prima idea o post!</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    Performance
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Idee Totali
                      </span>
                      <span className="font-semibold">{ideas.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Post Totali
                      </span>
                      <span className="font-semibold">{posts.length}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">
                        Campagne Totali
                      </span>
                      <span className="font-semibold">{campaigns.length}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Megaphone className="h-5 w-5 text-purple-500" />
                    Campagna Top
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {topCampaign ? (
                    <div className="space-y-2">
                      <p className="font-medium">{topCampaign.name}</p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-muted-foreground">Status</p>
                          <p className="font-semibold capitalize">{topCampaign.status}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Lead</p>
                          <p className="font-semibold text-green-600">{topCampaign.leads || 0}</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-sm">
                      Nessuna campagna attiva
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
