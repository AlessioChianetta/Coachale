import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { 
  Settings, 
  MessageSquare, 
  Trash2, 
  Bot,
  TrendingUp,
  TrendingDown,
  Minus,
  Calendar,
  Target,
  Zap,
  Brain,
  Clock,
  CheckCircle,
  AlertCircle,
  Users
} from "lucide-react";
import { getAuthHeaders } from "@/lib/auth";
import { cn } from "@/lib/utils";

interface Agent {
  id: string;
  name: string;
  agentType: string;
  status: "active" | "paused" | "test";
  performanceScore: number;
  trend: "up" | "down" | "stable";
}

interface AgentAnalytics {
  agent: {
    id: string;
    name: string;
    agentType: string;
    status: string;
    createdAt: string;
    businessName?: string;
    consultantDisplayName?: string;
  };
  performance: {
    score: number;
    trend: "up" | "down" | "stable";
    conversationsTotal: number;
    conversationsToday: number;
    avgResponseTime: string;
    successRate: number;
  };
  trendData: Array<{
    date: string;
    conversations: number;
    successRate: number;
  }>;
  skills: Array<{
    name: string;
    level: number;
    description: string;
  }>;
}

interface AgentProfilePanelProps {
  selectedAgent: Agent | null;
  onDeleteAgent?: (agentId: string) => void;
}

function PerformanceGauge({ score, trend }: { score: number; trend: string }) {
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500" : "text-slate-400";
  
  const scoreColor = score >= 80 ? "text-green-600" : score >= 60 ? "text-amber-600" : "text-red-600";
  const strokeColor = score >= 80 ? "#22c55e" : score >= 60 ? "#f59e0b" : "#ef4444";
  
  const circumference = 2 * Math.PI * 45;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-32 h-32">
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke="#e2e8f0"
            strokeWidth="8"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r="45"
            stroke={strokeColor}
            strokeWidth="8"
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn("text-3xl font-bold", scoreColor)}>{score}</span>
          <span className="text-xs text-slate-500">Performance</span>
        </div>
      </div>
      <div className="flex items-center gap-1 mt-2">
        <TrendIcon className={cn("h-4 w-4", trendColor)} />
        <span className={cn("text-sm font-medium", trendColor)}>
          {trend === "up" ? "In crescita" : trend === "down" ? "In calo" : "Stabile"}
        </span>
      </div>
    </div>
  );
}

function SkillBar({ name, level, description }: { name: string; level: number; description: string }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-700">{name}</span>
        <span className="text-xs text-slate-500">{level}%</span>
      </div>
      <Progress value={level} className="h-2" />
      <p className="text-xs text-slate-400">{description}</p>
    </div>
  );
}

function PlaceholderPanel() {
  return (
    <Card className="bg-white border border-slate-200 h-full flex items-center justify-center">
      <CardContent className="text-center py-16">
        <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-4">
          <Bot className="h-8 w-8 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-700 mb-2">Seleziona un agente</h3>
        <p className="text-sm text-slate-500 max-w-xs">
          Clicca su un agente nella lista per visualizzare i dettagli e le statistiche
        </p>
      </CardContent>
    </Card>
  );
}

function LoadingSkeleton() {
  return (
    <Card className="bg-white border border-slate-200 h-full">
      <CardContent className="p-6 space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="w-16 h-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-32 w-32 mx-auto rounded-full" />
        <Skeleton className="h-48 w-full" />
        <div className="space-y-3">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      </CardContent>
    </Card>
  );
}

export function AgentProfilePanel({ selectedAgent, onDeleteAgent }: AgentProfilePanelProps) {
  const [, navigate] = useLocation();

  const { data, isLoading, isError } = useQuery<AgentAnalytics>({
    queryKey: ["/api/whatsapp/agents", selectedAgent?.id, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/whatsapp/agents/${selectedAgent?.id}/analytics`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        throw new Error("Failed to fetch agent analytics");
      }
      return response.json();
    },
    enabled: !!selectedAgent?.id,
    staleTime: 30000,
  });

  if (!selectedAgent) {
    return <PlaceholderPanel />;
  }

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  if (isError) {
    return (
      <Card className="bg-white border border-slate-200 h-full">
        <CardContent className="p-6">
          <div className="flex flex-col items-center justify-center text-center py-8">
            <AlertCircle className="h-8 w-8 text-red-500 mb-2" />
            <p className="text-sm text-red-600">Errore nel caricamento analytics</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const defaultPerformance = {
    score: selectedAgent.performanceScore || 0,
    trend: selectedAgent.trend || "stable",
    conversationsTotal: 0,
    conversationsToday: 0,
    avgResponseTime: "0s",
    successRate: 0,
  };

  const defaultSkills = [
    { name: "Qualificazione Lead", level: 85, description: "Capacita di identificare lead qualificati" },
    { name: "Gestione Obiezioni", level: 72, description: "Risposta efficace alle obiezioni" },
    { name: "Conversione", level: 68, description: "Tasso di conversione in appuntamenti" },
    { name: "Engagement", level: 90, description: "Mantenimento della conversazione" },
  ];

  const analytics = {
    agent: data?.agent || selectedAgent,
    performance: data?.performance || data?.metrics || defaultPerformance,
    trendData: data?.trendData || data?.trend || [],
    skills: data?.skills || defaultSkills,
  };

  const agentTypeLabels: Record<string, string> = {
    reactive_lead: "Lead Reattivo",
    proactive_setter: "Setter Proattivo",
    informative_advisor: "Advisor Informativo",
    customer_success: "Customer Success",
    intake_coordinator: "Coordinatore Intake",
  };

  const statusConfig = {
    active: { label: "Attivo", color: "bg-green-100 text-green-700" },
    paused: { label: "In Pausa", color: "bg-amber-100 text-amber-700" },
    test: { label: "Test", color: "bg-blue-100 text-blue-700" },
  };

  const status = statusConfig[selectedAgent.status as keyof typeof statusConfig] || statusConfig.active;

  return (
    <Card className="bg-white border border-slate-200 h-full flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-6 space-y-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white text-2xl font-bold">
                {selectedAgent.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{selectedAgent.name}</h2>
                <p className="text-sm text-slate-500">
                  {agentTypeLabels[selectedAgent.agentType] || selectedAgent.agentType}
                </p>
                <Badge variant="outline" className={cn("mt-1", status.color)}>
                  {status.label}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex justify-center py-4">
            <PerformanceGauge 
              score={analytics.performance.score} 
              trend={analytics.performance.trend}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Conversazioni</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.conversationsTotal}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Clock className="h-4 w-4" />
                <span className="text-xs">Tempo Risposta</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.avgResponseTime}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Target className="h-4 w-4" />
                <span className="text-xs">Successo</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.successRate}%
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg">
              <div className="flex items-center gap-2 text-slate-500 mb-1">
                <Calendar className="h-4 w-4" />
                <span className="text-xs">Oggi</span>
              </div>
              <p className="text-lg font-semibold text-slate-900">
                {analytics.performance.conversationsToday}
              </p>
            </div>
          </div>

          {analytics.trendData && analytics.trendData.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                Trend Ultimi 7 Giorni
              </h3>
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.trendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis 
                      dataKey="date" 
                      tick={{ fontSize: 10 }} 
                      stroke="#94a3b8"
                    />
                    <YAxis 
                      tick={{ fontSize: 10 }} 
                      stroke="#94a3b8"
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "white",
                        border: "1px solid #e2e8f0",
                        borderRadius: "8px",
                        fontSize: "12px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="conversations"
                      stroke="#3b82f6"
                      strokeWidth={2}
                      dot={{ fill: "#3b82f6", strokeWidth: 2 }}
                      name="Conversazioni"
                    />
                    <Line
                      type="monotone"
                      dataKey="successRate"
                      stroke="#22c55e"
                      strokeWidth={2}
                      dot={{ fill: "#22c55e", strokeWidth: 2 }}
                      name="Successo %"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Brain className="h-4 w-4 text-purple-500" />
              Competenze
            </h3>
            <div className="space-y-4">
              {analytics.skills.map((skill, index) => (
                <SkillBar
                  key={index}
                  name={skill.name}
                  level={skill.level}
                  description={skill.description}
                />
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-200">
            <h3 className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-500" />
              Azioni Rapide
            </h3>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1"
                onClick={() => navigate(`/consultant/whatsapp/agent/${selectedAgent.id}`)}
              >
                <Settings className="h-4 w-4" />
                <span className="text-xs">Configura</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1"
                onClick={() => navigate(`/consultant/whatsapp-agents-chat?agentId=${selectedAgent.id}`)}
              >
                <MessageSquare className="h-4 w-4" />
                <span className="text-xs">Chat</span>
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="flex-col h-auto py-3 gap-1 text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => onDeleteAgent?.(selectedAgent.id)}
              >
                <Trash2 className="h-4 w-4" />
                <span className="text-xs">Elimina</span>
              </Button>
            </div>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
}
