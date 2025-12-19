import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Calendar,
  MessageSquare,
  Mail,
  UserPlus,
  Phone,
  Sparkles,
  Target,
  GraduationCap,
  BookOpen,
  Settings,
  Bell,
  Search,
  ArrowRight,
  AlertCircle,
  Clock,
  FileText,
  Bot,
  FileSearch,
  Flame,
  ChevronRight
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { useClientPriorityScore } from "@/hooks/useClientPriorityScore";
import { useLocation } from "wouter";
import { cn } from "@/lib/utils";

interface AttentionItem {
  id: string;
  type: "exercise" | "lead" | "appointment";
  title: string;
  description: string;
  urgency: "high" | "medium" | "low";
  actionUrl: string;
  timeAgo?: string;
}

interface NavigationSection {
  name: string;
  href: string;
  icon: React.ComponentType<any>;
  color: string;
  bgColor: string;
  count?: number;
  badge?: string;
}

export default function ConsultantDashboard() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const user = getAuthUser();

  const {
    highPriorityClients,
  } = useClientPriorityScore();

  const { data: assignments = [] } = useQuery<any[]>({
    queryKey: ["/api/exercise-assignments/consultant"],
  });

  const { data: clients = [] } = useQuery<any[]>({
    queryKey: ["/api/clients"],
    queryFn: async () => {
      const response = await fetch("/api/clients", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch clients");
      return response.json();
    },
  });

  const { data: appointments = [] } = useQuery<any[]>({
    queryKey: ["/api/appointments/upcoming"],
    queryFn: async () => {
      const response = await fetch("/api/appointments/upcoming", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
  });

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Buongiorno";
    if (hour < 18) return "Buon pomeriggio";
    return "Buonasera";
  };

  const pendingExercises = useMemo(() => {
    return assignments.filter((a: any) => a.status === "pending" || a.status === "in_progress");
  }, [assignments]);

  const attentionItems: AttentionItem[] = useMemo(() => {
    const items: AttentionItem[] = [];
    
    pendingExercises.slice(0, 3).forEach((assignment: any) => {
      items.push({
        id: `exercise-${assignment.id}`,
        type: "exercise",
        title: `Esercizio in attesa`,
        description: `${assignment.client?.firstName || 'Cliente'} - ${assignment.exercise?.title || 'Esercizio'}`,
        urgency: assignment.status === "pending" ? "high" : "medium",
        actionUrl: "/consultant/exercises",
        timeAgo: assignment.assignedAt ? new Date(assignment.assignedAt).toLocaleDateString('it-IT') : undefined
      });
    });

    highPriorityClients?.slice(0, 2).forEach((client: any) => {
      items.push({
        id: `lead-${client.id}`,
        type: "lead",
        title: "Cliente prioritario",
        description: `${client.firstName} ${client.lastName} richiede attenzione`,
        urgency: "high",
        actionUrl: `/consultant/clients`,
      });
    });

    appointments?.slice(0, 2).forEach((apt: any) => {
      items.push({
        id: `apt-${apt.id}`,
        type: "appointment",
        title: "Appuntamento in arrivo",
        description: apt.title || `Con ${apt.clientName || 'Cliente'}`,
        urgency: "medium",
        actionUrl: "/consultant/appointments",
        timeAgo: apt.startTime ? new Date(apt.startTime).toLocaleDateString('it-IT') : undefined
      });
    });

    return items.slice(0, 5);
  }, [pendingExercises, highPriorityClients, appointments]);

  const navigationSections: NavigationSection[] = [
    { 
      name: "AI Assistant", 
      href: "/consultant/ai-assistant", 
      icon: Sparkles, 
      color: "text-fuchsia-500",
      bgColor: "bg-fuchsia-500/10 hover:bg-fuchsia-500/20",
      badge: "AI"
    },
    { 
      name: "Clienti", 
      href: "/consultant/clients", 
      icon: Users, 
      color: "text-blue-500",
      bgColor: "bg-blue-500/10 hover:bg-blue-500/20",
      count: clients.length
    },
    { 
      name: "Calendario", 
      href: "/consultant/appointments", 
      icon: Calendar, 
      color: "text-orange-500",
      bgColor: "bg-orange-500/10 hover:bg-orange-500/20",
    },
    { 
      name: "Email Journey", 
      href: "/consultant/ai-config", 
      icon: Mail, 
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10 hover:bg-emerald-500/20",
    },
    { 
      name: "Lead Hub", 
      href: "/consultant/lead-hub", 
      icon: Target, 
      color: "text-red-500",
      bgColor: "bg-red-500/10 hover:bg-red-500/20",
      badge: "HUB"
    },
    { 
      name: "Agent Setup", 
      href: "/consultant/whatsapp", 
      icon: Bot, 
      color: "text-green-500",
      bgColor: "bg-green-500/10 hover:bg-green-500/20",
    },
    { 
      name: "Formazione", 
      href: "/consultant/university", 
      icon: GraduationCap, 
      color: "text-amber-500",
      bgColor: "bg-amber-500/10 hover:bg-amber-500/20",
    },
    { 
      name: "Knowledge Base", 
      href: "/consultant/knowledge-documents", 
      icon: BookOpen, 
      color: "text-indigo-500",
      bgColor: "bg-indigo-500/10 hover:bg-indigo-500/20",
    },
    { 
      name: "File Search", 
      href: "/consultant/file-search-analytics", 
      icon: FileSearch, 
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10 hover:bg-cyan-500/20",
      badge: "RAG"
    },
    { 
      name: "Impostazioni", 
      href: "/consultant/api-keys-unified", 
      icon: Settings, 
      color: "text-gray-500",
      bgColor: "bg-gray-500/10 hover:bg-gray-500/20",
    },
  ];

  const quickActions = [
    { 
      name: "Chatta con AI", 
      icon: MessageSquare, 
      onClick: () => setLocation("/consultant/ai-assistant"),
      gradient: "from-fuchsia-500 to-purple-600"
    },
    { 
      name: "Nuovo Cliente", 
      icon: UserPlus, 
      onClick: () => setLocation("/consultant/clients"),
      gradient: "from-blue-500 to-cyan-600"
    },
    { 
      name: "Chiama Lead", 
      icon: Phone, 
      onClick: () => setLocation("/consultant/lead-hub"),
      gradient: "from-green-500 to-emerald-600"
    },
    { 
      name: "Invia Email", 
      icon: Mail, 
      onClick: () => setLocation("/consultant/ai-config"),
      gradient: "from-orange-500 to-red-600"
    },
  ];

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case "high": return "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400";
      case "medium": return "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";
      default: return "bg-blue-500/10 border-blue-500/30 text-blue-600 dark:text-blue-400";
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "exercise": return FileText;
      case "lead": return Target;
      case "appointment": return Clock;
      default: return AlertCircle;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20" data-testid="consultant-dashboard">
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

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
            
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">👋</span>
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                    {getGreeting()}, {user?.firstName || 'Consulente'}
                  </h1>
                  <p className="text-muted-foreground text-sm">
                    Ecco cosa succede oggi nel tuo business
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="relative"
                  onClick={() => setLocation("/consultant/ai-config")}
                >
                  <Bell className="h-5 w-5" />
                  {attentionItems.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                      {attentionItems.length}
                    </span>
                  )}
                </Button>
                <Avatar className="h-10 w-10 ring-2 ring-primary/20">
                  <AvatarImage src={user?.avatar || undefined} />
                  <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-white font-semibold">
                    {user?.firstName?.[0]}{user?.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
              </div>
            </div>

            {/* Search/AI Bar */}
            <div className="relative group">
              <div 
                className="w-full cursor-pointer"
                onClick={() => setLocation("/consultant/ai-assistant")}
              >
                <div className="relative">
                  <div className="absolute inset-0 bg-gradient-to-r from-fuchsia-500/20 via-purple-500/20 to-blue-500/20 rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  <div className="relative bg-card border border-border/50 rounded-2xl p-4 sm:p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:border-primary/30">
                    <p className="text-lg sm:text-xl text-muted-foreground mb-3">
                      Cosa vuoi fare oggi?
                    </p>
                    <div className="flex items-center gap-3 bg-muted/50 rounded-xl px-4 py-3 border border-border/50">
                      <Search className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground flex-1">Cerca o chiedi all'AI...</span>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-background/50 px-2 py-1 rounded-lg border">
                        <Sparkles className="h-3 w-3 text-fuchsia-500" />
                        <span>AI</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Azioni Rapide
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {quickActions.map((action, index) => (
                  <button
                    key={index}
                    onClick={action.onClick}
                    className="group relative overflow-hidden rounded-xl p-4 text-left transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <div className={cn(
                      "absolute inset-0 bg-gradient-to-br opacity-90 group-hover:opacity-100 transition-opacity",
                      action.gradient
                    )} />
                    <div className="relative z-10 text-white">
                      <action.icon className="h-6 w-6 mb-2" />
                      <p className="font-medium text-sm">{action.name}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Requires Attention */}
            {attentionItems.length > 0 && (
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Flame className="h-5 w-5 text-orange-500" />
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Richiede Attenzione
                  </h2>
                  <Badge variant="secondary" className="text-xs">
                    {attentionItems.length}
                  </Badge>
                </div>
                <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/5 to-transparent">
                  <CardContent className="p-4 space-y-2">
                    {attentionItems.map((item) => {
                      const IconComponent = getTypeIcon(item.type);
                      return (
                        <button
                          key={item.id}
                          onClick={() => setLocation(item.actionUrl)}
                          className={cn(
                            "w-full flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 hover:scale-[1.01] text-left",
                            getUrgencyColor(item.urgency)
                          )}
                        >
                          <div className="p-2 rounded-lg bg-background/50">
                            <IconComponent className="h-4 w-4" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{item.title}</p>
                            <p className="text-xs opacity-80 truncate">{item.description}</p>
                          </div>
                          {item.timeAgo && (
                            <span className="text-xs opacity-60 whitespace-nowrap">{item.timeAgo}</span>
                          )}
                          <ChevronRight className="h-4 w-4 opacity-50" />
                        </button>
                      );
                    })}
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Navigation Sections Grid */}
            <div>
              <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Tutte le Sezioni
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {navigationSections.map((section, index) => (
                  <button
                    key={index}
                    onClick={() => setLocation(section.href)}
                    className={cn(
                      "group relative flex flex-col items-center justify-center p-4 sm:p-5 rounded-xl border border-border/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-lg active:scale-[0.98]",
                      section.bgColor
                    )}
                  >
                    <div className={cn(
                      "p-3 rounded-xl mb-2 transition-transform duration-300 group-hover:scale-110",
                      section.bgColor.replace("hover:", "")
                    )}>
                      <section.icon className={cn("h-6 w-6", section.color)} />
                    </div>
                    <span className="text-sm font-medium text-center">{section.name}</span>
                    {section.count !== undefined && (
                      <Badge variant="secondary" className="mt-1.5 text-xs">
                        {section.count}
                      </Badge>
                    )}
                    {section.badge && (
                      <Badge className="mt-1.5 text-xs bg-gradient-to-r from-primary to-primary/80">
                        {section.badge}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Footer spacer */}
            <div className="h-8" />
          </div>
        </div>
      </div>
    </div>
  );
}
