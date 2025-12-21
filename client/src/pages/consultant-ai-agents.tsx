import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Bot,
  MessageSquare,
  Plus,
  Loader2,
  TrendingUp,
  Users,
  Mail,
  ClipboardCheck,
  Sparkles,
  Star,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";

interface AIAgentMetrics {
  conversationsManaged: number;
  appointmentsBooked: number;
}

export default function ConsultantAIAgentsPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();

  // Fetch AI Receptionist metrics from real database
  const { data: receptionistMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ["/api/ai-agents/receptionist-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/ai-agents/receptionist-metrics", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch receptionist metrics");
      }
      const data = await response.json();
      return data as AIAgentMetrics;
    },
  });

  // Fetch email drafts for Millie card
  const { data: drafts = [] } = useQuery({
    queryKey: ["/api/consultant/email-drafts", "pending"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/email-drafts?status=pending", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch email drafts");
      }
      const result = await response.json();
      return result.data || [];
    },
  });

  // Fetch email stats for Millie card
  const { data: stats } = useQuery({
    queryKey: ["/api/consultant/ai-email-stats"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/ai-email-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch email stats");
      }
      return response.json();
    },
  });

  // Fetch Echo stats for special agent card
  const { data: echoStats } = useQuery({
    queryKey: ["/api/echo/stats"],
    queryFn: async () => {
      const response = await fetch("/api/echo/stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return { emailCount: 0, taskCount: 0, pendingApprovals: 0 };
      }
      return response.json();
    },
  });

  const handleCreateNewAgent = () => {
    toast({
      title: "🚀 Funzionalità in arrivo",
      description: "La creazione di nuovi AI Agents sarà presto disponibile!",
    });
  };

  if (metricsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
          <Sidebar
            role="consultant"
            isOpen={sidebarOpen}
            onClose={() => setSidebarOpen(false)}
          />
          <div className="flex-1 p-8 overflow-y-auto">
            <div className="flex items-center justify-center h-[60vh]">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? 'h-[calc(100vh-80px)]' : 'h-screen'}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  AI Agents
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Gestisci e monitora i tuoi assistenti AI
              </p>
            </div>

            {/* AGENTE SPECIALE - Echo Section */}
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-4">
                <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                <h2 className="text-lg font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
                  Agente Speciale
                </h2>
              </div>
              <Card className="relative overflow-hidden border-2 border-purple-300 dark:border-purple-700 bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-100 dark:from-purple-950/40 dark:via-indigo-950/40 dark:to-violet-950/40 hover:shadow-2xl hover:shadow-purple-300/50 dark:hover:shadow-purple-800/50 hover:-translate-y-1 hover:border-purple-500 dark:hover:border-purple-500 transition-all duration-300 rounded-2xl">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-indigo-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-violet-400/20 to-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>
                <CardContent className="relative p-6">
                  <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
                    <div className="flex items-center gap-4">
                      <div className="relative">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-xl ring-4 ring-purple-200 dark:ring-purple-800">
                          <Sparkles className="h-10 w-10 text-white" />
                        </div>
                        <Badge className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs px-2 py-0.5 font-bold shadow-lg">
                          <Star className="h-3 w-3 mr-1 fill-current" />
                          SPECIALE
                        </Badge>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 bg-clip-text text-transparent">
                          Echo - Riepilogo Consulenze
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 max-w-lg">
                          Genera automaticamente email di riepilogo dalle tue consulenze, estrae task e gestisce l'approvazione.
                        </p>
                      </div>
                    </div>
                    <div className="flex-1"></div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 w-full md:w-auto">
                      <div className="flex gap-4 flex-wrap">
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl px-4 py-3 shadow-sm border border-purple-200/50 dark:border-purple-700/50">
                          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                            {echoStats?.emailCount ?? 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Email
                          </div>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl px-4 py-3 shadow-sm border border-indigo-200/50 dark:border-indigo-700/50">
                          <div className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
                            {echoStats?.taskCount ?? 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            Task
                          </div>
                        </div>
                        <div className="bg-white/80 dark:bg-gray-800/80 rounded-xl px-4 py-3 shadow-sm border border-violet-200/50 dark:border-violet-700/50">
                          <div className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                            {echoStats?.pendingApprovals ?? 0}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                            In Attesa
                          </div>
                        </div>
                      </div>
                      <Button
                        className="bg-gradient-to-r from-purple-600 via-indigo-600 to-violet-600 hover:from-purple-700 hover:via-indigo-700 hover:to-violet-700 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200 px-6"
                        onClick={() => window.location.href = '/consultant/echo-dashboard'}
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Apri Dashboard Echo
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* AI Agents Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Card 1 - AI Receptionist (WhatsApp) */}
              <Card className="relative overflow-hidden border-2 border-green-200 dark:border-green-800 bg-gradient-to-br from-green-50 via-emerald-50 to-white dark:from-green-950/30 dark:via-emerald-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-green-200/50 dark:hover:shadow-green-900/50 hover:-translate-y-2 hover:border-green-400 dark:hover:border-green-600 transition-all duration-300 cursor-pointer rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent mb-2">
                    Dot
                  </CardTitle>
                  <p className="text-base font-bold text-green-700 dark:text-green-400 mb-4">
                    AI Receptionist
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/30 dark:to-emerald-900/30 flex items-center justify-center shadow-lg">
                        <MessageSquare className="h-16 w-16 text-green-600 dark:text-green-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-green-500 text-white text-xs px-2 py-0.5">
                        Attivo
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-green-50/80 to-emerald-50/80 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-5 mb-5 border border-green-100 dark:border-green-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-green-500"></div>
                      <p className="text-sm font-bold text-green-800 dark:text-green-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-green-200/50 dark:border-green-700/30 shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Gestisci WhatsApp 24/7
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-green-200/50 dark:border-green-700/30 shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Qualifica Lead
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-green-200/50 dark:border-green-700/30 shadow-sm hover:shadow-md hover:border-green-300 dark:hover:border-green-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Prenota Appuntamenti
                        </p>
                      </div>
                      <div className="text-xs text-center text-green-700 dark:text-green-400 font-medium italic mt-3 pt-3 border-t border-green-200/50 dark:border-green-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/whatsapp-conversations'}
                  >
                    Gestisci
                  </Button>
                </CardContent>
              </Card>

              {/* Card 2 - AI Email Agent */}
              <Card className="relative overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 via-pink-50 to-white dark:from-purple-950/30 dark:via-pink-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-purple-200/50 dark:hover:shadow-purple-900/50 hover:-translate-y-2 hover:border-purple-400 dark:hover:border-purple-600 transition-all duration-300 cursor-pointer rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent mb-2">
                    Millie
                  </CardTitle>
                  <p className="text-base font-bold text-purple-700 dark:text-purple-400 mb-4">
                    AI Email Writer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30 flex items-center justify-center shadow-lg">
                        <Mail className="h-16 w-16 text-purple-600 dark:text-purple-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-purple-500 text-white text-xs px-2 py-0.5">
                        Attivo
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-purple-50/80 to-pink-50/80 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl p-5 mb-5 border border-purple-100 dark:border-purple-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-purple-500"></div>
                      <p className="text-sm font-bold text-purple-800 dark:text-purple-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Giornaliere AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Personalizzate per Cliente
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-purple-200/50 dark:border-purple-700/30 shadow-sm hover:shadow-md hover:border-purple-300 dark:hover:border-purple-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Journey Automatico
                        </p>
                      </div>
                      <div className="text-xs text-center text-purple-700 dark:text-purple-400 font-medium italic mt-3 pt-3 border-t border-purple-200/50 dark:border-purple-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/ai-config'}
                  >
                    Configura
                  </Button>
                </CardContent>
              </Card>

              {/* Card 3 - AI Consultation Summary */}
              <Card className="relative overflow-hidden border-2 border-orange-200 dark:border-orange-800 bg-gradient-to-br from-orange-50 via-amber-50 to-white dark:from-orange-950/30 dark:via-amber-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-orange-200/50 dark:hover:shadow-orange-900/50 hover:-translate-y-2 hover:border-orange-400 dark:hover:border-orange-600 transition-all duration-300 cursor-pointer rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent mb-2">
                    Echo
                  </CardTitle>
                  <p className="text-base font-bold text-orange-700 dark:text-orange-400 mb-4">
                    AI Consultation Summarizer
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center shadow-lg">
                        <ClipboardCheck className="h-16 w-16 text-orange-600 dark:text-orange-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-2 py-0.5">
                        Attivo
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-orange-50/80 to-amber-50/80 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl p-5 mb-5 border border-orange-100 dark:border-orange-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-orange-500"></div>
                      <p className="text-sm font-bold text-orange-800 dark:text-orange-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Riepiloghi Consulenze AI
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Email Personalizzate
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-orange-200/50 dark:border-orange-700/30 shadow-sm hover:shadow-md hover:border-orange-300 dark:hover:border-orange-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Da Trascrizioni Fathom
                        </p>
                      </div>
                      <div className="text-xs text-center text-orange-700 dark:text-orange-400 font-medium italic mt-3 pt-3 border-t border-orange-200/50 dark:border-orange-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/consultant/echo-dashboard'}
                  >
                    Gestisci
                  </Button>
                </CardContent>
              </Card>

              {/* Card 4 - AI Assistant (Clienti) */}
              <Card className="relative overflow-hidden border-2 border-cyan-200 dark:border-cyan-800 bg-gradient-to-br from-cyan-50 via-blue-50 to-white dark:from-cyan-950/30 dark:via-blue-950/30 dark:to-gray-900 hover:shadow-2xl hover:shadow-cyan-200/50 dark:hover:shadow-cyan-900/50 hover:-translate-y-2 hover:border-cyan-400 dark:hover:border-cyan-600 transition-all duration-300 cursor-pointer rounded-2xl">
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent mb-2">
                    Spec
                  </CardTitle>
                  <p className="text-base font-bold text-cyan-700 dark:text-cyan-400 mb-4">
                    AI Researcher
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-cyan-100 to-blue-100 dark:from-cyan-900/30 dark:to-blue-900/30 flex items-center justify-center shadow-lg">
                        <Bot className="h-16 w-16 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <Badge className="absolute -top-1 -right-1 bg-cyan-500 text-white text-xs px-2 py-0.5">
                        Attivo
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-cyan-50/80 to-blue-50/80 dark:from-cyan-900/20 dark:to-blue-900/20 rounded-xl p-5 mb-5 border border-cyan-100 dark:border-cyan-800/30 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-cyan-500"></div>
                      <p className="text-sm font-bold text-cyan-800 dark:text-cyan-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Supporto Clienti 24/7
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Risposte su Esercizi
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/80 rounded-lg px-4 py-3 border border-cyan-200/50 dark:border-cyan-700/30 shadow-sm hover:shadow-md hover:border-cyan-300 dark:hover:border-cyan-600 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                          ✓ Guida ai Materiali
                        </p>
                      </div>
                      <div className="text-xs text-center text-cyan-700 dark:text-cyan-400 font-medium italic mt-3 pt-3 border-t border-cyan-200/50 dark:border-cyan-700/30">
                        e centinaia di altre funzioni.
                      </div>
                    </div>
                  </div>
                  <Button
                    className="w-full bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-600 hover:to-blue-600 text-white border-0 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={() => window.location.href = '/client/ai-assistant'}
                  >
                    Vai all'Area Clienti
                  </Button>
                </CardContent>
              </Card>

              {/* Card 5 - Crea Nuovo Agent */}
              <Card className="relative overflow-hidden border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gradient-to-br from-gray-50 via-slate-50 to-white dark:from-gray-800/50 dark:via-slate-900/50 dark:to-gray-900 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-2xl hover:shadow-blue-200/30 dark:hover:shadow-blue-900/30 hover:-translate-y-2 hover:bg-gradient-to-br hover:from-blue-50 hover:via-indigo-50 hover:to-white dark:hover:from-blue-950/30 dark:hover:via-indigo-950/30 dark:hover:to-gray-900 transition-all duration-300 cursor-pointer rounded-2xl"
                onClick={handleCreateNewAgent}
              >
                <CardHeader className="text-center pt-6 pb-3">
                  <CardTitle className="text-2xl font-bold text-gray-700 dark:text-gray-300 mb-2">
                    Crea il tuo
                  </CardTitle>
                  <p className="text-base font-bold text-gray-600 dark:text-gray-400 mb-4">
                    AI Employee personalizzato
                  </p>
                  <div className="flex justify-center mb-4">
                    <div className="relative">
                      <div className="w-32 h-32 rounded-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-700/30 dark:to-gray-600/30 flex items-center justify-center shadow-lg border-2 border-dashed border-gray-300 dark:border-gray-600">
                        <Plus className="h-16 w-16 text-gray-400 dark:text-gray-500" />
                      </div>
                      <Badge variant="secondary" className="absolute -top-1 -right-1 bg-gray-400 text-white text-xs px-2 py-0.5">
                        Presto
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pb-6 px-6">
                  <div className="bg-gradient-to-br from-gray-50/80 to-slate-50/80 dark:from-gray-800/50 dark:to-slate-900/50 rounded-xl p-5 mb-5 border-2 border-dashed border-gray-300 dark:border-gray-600 shadow-sm">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="h-1 w-1 rounded-full bg-gray-400"></div>
                      <p className="text-sm font-bold text-gray-700 dark:text-gray-300 tracking-wide uppercase">
                        Cosa posso fare
                      </p>
                    </div>
                    <div className="space-y-2.5">
                      <div className="group bg-white dark:bg-gray-800/50 rounded-lg px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          ✓ Descrivi cosa vuoi!
                        </p>
                      </div>
                      <div className="group bg-white dark:bg-gray-800/50 rounded-lg px-4 py-3 border border-dashed border-gray-300 dark:border-gray-600 shadow-sm hover:shadow-md hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200">
                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                          ✓ Scegli template personalizzati
                        </p>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full border-2 border-dashed border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 shadow-lg hover:shadow-xl transition-all duration-200"
                    onClick={handleCreateNewAgent}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Richiedi Accesso
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Info Section */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <Bot className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Cosa sono gli AI Agents?
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                    Gli AI Agents sono assistenti intelligenti che automatizzano attività ripetitive,
                    permettendoti di concentrarti su ciò che conta davvero: i tuoi clienti.
                  </p>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span>Risposte automatiche 24/7 su WhatsApp</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span>Qualificazione lead e prenotazione appuntamenti</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span>Riepiloghi consulenze automatici da trascrizioni Fathom</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span>Supporto clienti su esercizi e materiali didattici</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
      <ConsultantAIAssistant />
    </div>
  );
}