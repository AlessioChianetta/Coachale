import { useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Bot,
  BarChart3,
  Link2,
  MessageSquare,
  TrendingUp,
  Users,
  Menu,
  Brain,
  Activity,
  CheckCircle,
  Clock,
  ChevronRight,
  Eye,
  BookOpen,
  FileText,
  Info,
  Database,
  Code,
  GitBranch,
  RefreshCw,
  Sparkles,
  Map,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { AlertTriangle, Filter } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAuthHeaders } from '@/lib/auth';
import { InvitesListTable } from '@/components/InvitesListTable';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';
import { TrainingMapLayout } from '@/components/training/TrainingMapLayout';
import { TrainingFileUpload } from '@/components/training/TrainingFileUpload';
import { PhaseFlowTab } from '@/components/training/PhaseFlowTab';
import { LadderAnalyticsTab } from '@/components/training/LadderAnalyticsTab';
import { ObjectionHandlingTab } from '@/components/training/ObjectionHandlingTab';
import { AIReasoningTab } from '@/components/training/AIReasoningTab';
import { AITrainerTab } from '@/components/ai-trainer';

interface SalesAgent {
  id: string;
  agentName: string;
  displayName: string;
  businessName: string;
  isActive: boolean;
  shareToken: string;
}

interface TrainingConversation {
  id: string;
  prospectName: string | null;
  currentPhase: string;
  completionRate: number;
  totalDuration: number;
  ladderActivationCount: number;
  createdAt: string;
  usedScriptId: string | null;
  usedScriptName: string | null;
  usedScriptType: 'discovery' | 'demo' | 'objections' | null;
  usedScriptSource: 'database' | 'hardcoded_default' | null;
}

interface TrainingStats {
  totalConversations: number;
  averageCompletionRate: number;
  totalLadderActivations: number;
  averageDuration: number;
}

interface TrainingSummary {
  agentId: string;
  totalConversations: number;
  avgConversionRate: number;
  scriptOutdated: boolean;
  [key: string]: any;
}

interface TrainingConversationDetail {
  conversationId: string;
  agentId: string;
  prospectName: string | null;
  currentPhase: string;
  phasesReached: string[];
  checkpointsCompleted: Array<{
    checkpointId: string;
    completedAt: string;
    verifications: string[];
  }>;
  semanticTypes: string[];
  aiReasoning: Array<{
    timestamp: string;
    phase: string;
    decision: string;
    reasoning: string;
  }>;
  fullTranscript: Array<{
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    phase: string;
  }>;
  ladderActivations: Array<{
    timestamp: string;
    phase: string;
    level: number;
    question: string;
    userResponse: string;
    wasVague: boolean;
  }>;
  questionsAsked: Array<{
    timestamp: string;
    phase: string;
    question: string;
    questionType: string;
  }>;
  completionRate: number;
  totalDuration: number;
  createdAt: string;
}

export default function ClientSalesAgentAnalytics() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showTrainingMap, setShowTrainingMap] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [preselectedConversationId, setPreselectedConversationId] = useState<string>('');
  const [scriptTypeFilter, setScriptTypeFilter] = useState<'all' | 'discovery' | 'demo' | 'objections'>('all');
  const queryClient = useQueryClient();
  
  // Determine if we should enable real-time polling (only in training tab)
  const enablePolling = activeTab === 'training';

  const { data: agent, isLoading } = useQuery<SalesAgent>({
    queryKey: [`/api/client/sales-agent/config/${agentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/client/sales-agent/config/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agent');
      return response.json();
    },
    enabled: !!agentId,
  });

  const { data: trainingStats, isLoading: statsLoading } = useQuery<TrainingStats>({
    queryKey: [`/api/client/sales-agent/config/${agentId}/training/stats`],
    queryFn: async () => {
      console.log(`[FRONTEND] Fetching training stats for agent ${agentId}...`);
      const response = await fetch(
        `/api/client/sales-agent/config/${agentId}/training/stats`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        console.error(`[FRONTEND] Stats API failed:`, response.status, response.statusText);
        throw new Error('Failed to fetch training stats');
      }
      const data = await response.json();
      console.log(`[FRONTEND] Received training stats:`, data);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: enablePolling ? 5000 : false, // Poll every 5 seconds when in training tab
  });

  const { data: trainingSummary } = useQuery<TrainingSummary>({
    queryKey: [`/api/client/sales-agent/config/${agentId}/training/summary`],
    queryFn: async () => {
      console.log(`[FRONTEND] Fetching training summary for agent ${agentId}...`);
      const response = await fetch(
        `/api/client/sales-agent/config/${agentId}/training/summary`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        console.error(`[FRONTEND] Summary API failed:`, response.status, response.statusText);
        throw new Error('Failed to fetch training summary');
      }
      const data = await response.json();
      console.log(`[FRONTEND] Received training summary:`, data);
      return data;
    },
    enabled: !!agentId,
  });

  const { data: trainingConversations = [], isLoading: conversationsLoading } = useQuery<
    TrainingConversation[]
  >({
    queryKey: [`/api/client/sales-agent/config/${agentId}/training/conversations`],
    queryFn: async () => {
      console.log(`[FRONTEND] Fetching training conversations for agent ${agentId}...`);
      const response = await fetch(
        `/api/client/sales-agent/config/${agentId}/training/conversations`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) {
        console.error(`[FRONTEND] Conversations API failed:`, response.status, response.statusText);
        throw new Error('Failed to fetch conversations');
      }
      const data = await response.json();
      console.log(`[FRONTEND] Received ${data.length} conversations:`, data);
      return data;
    },
    enabled: !!agentId,
    refetchInterval: enablePolling ? 5000 : false, // Poll every 5 seconds when in training tab
  });

  const { data: conversationDetail, isLoading: detailLoading } = useQuery<TrainingConversationDetail | null>({
    queryKey: [`/api/client/sales-agent/config/${agentId}/training/conversation/${selectedConversationId}`],
    queryFn: async () => {
      if (!selectedConversationId) return null;
      const response = await fetch(
        `/api/client/sales-agent/config/${agentId}/training/conversation/${selectedConversationId}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error('Failed to fetch conversation detail');
      return response.json();
    },
    enabled: !!agentId && !!selectedConversationId,
    refetchInterval: selectedConversationId && enablePolling ? 3000 : false, // Poll every 3 seconds for detail modal
  });

  const { data: scriptStructure, isLoading: scriptLoading, error: scriptError } = useQuery({
    queryKey: [`/api/client/sales-agent/config/script-structure`],
    queryFn: async () => {
      try {
        console.log('[SCRIPT LOAD] Fetching script structure...');
        const response = await fetch(`/api/client/sales-agent/config/script-structure`, {
          headers: getAuthHeaders(),
        });
        if (!response.ok) {
          const errorText = await response.text();
          console.error('[SCRIPT LOAD] Failed:', response.status, errorText);
          throw new Error(`Failed to fetch script structure: ${response.status}`);
        }
        const data = await response.json();
        console.log('[SCRIPT LOAD] Success! Data received:', { hasData: !!data, version: data?.version, phases: data?.phases?.length });
        return data;
      } catch (error) {
        console.error('[SCRIPT LOAD] Exception:', error);
        throw error;
      }
    },
    enabled: true,
    staleTime: 5000,
    retry: 3,
  });

  // Force script load on mount if not already loaded
  const { refetch: refetchScript } = useQuery({
    queryKey: [`/api/client/sales-agent/config/script-structure-init`],
    queryFn: () => Promise.resolve(null),
    enabled: !scriptStructure && !scriptLoading,
  });

  useEffect(() => {
    if (!scriptStructure && !scriptLoading) {
      console.log('[SCRIPT LOAD] Force refetching on mount');
      queryClient.invalidateQueries({ queryKey: [`/api/client/sales-agent/config/script-structure`] });
    }
  }, [scriptStructure, scriptLoading, queryClient]);
  
  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/client/sales-agent/config/${agentId}/training/stats`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/client/sales-agent/config/${agentId}/training/conversations`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/client/sales-agent/config/${agentId}/training/summary`] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };
  
  // Helper to check if conversation is LIVE (updated in last 2 minutes)
  const isConversationLive = (createdAt: string) => {
    const now = new Date().getTime();
    const conversationTime = new Date(createdAt).getTime();
    const diffMinutes = (now - conversationTime) / (1000 * 60);
    return diffMinutes < 2;
  };

  console.log('[TRAINING MAP] Component state:', { showTrainingMap, selectedConversationId, detailLoading, hasDetail: !!conversationDetail, hasScript: !!scriptStructure });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-pulse" />
          <p className="text-gray-600 dark:text-gray-400">Caricamento analytics...</p>
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600">Agente non trovato</p>
        </div>
      </div>
    );
  }

  // Show training map full-screen when enabled
  if (showTrainingMap && selectedConversationId) {
    console.log('[TRAINING MAP] Rendering training map view. conversationDetail:', !!conversationDetail, 'scriptStructure:', !!scriptStructure);
    
    // Loading state while data is being fetched
    if (!conversationDetail || !scriptStructure) {
      console.log('[TRAINING MAP] Loading... waiting for data');
      return (
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-pulse" />
            <p className="text-lg font-semibold">Caricamento Training Map...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Preparazione dati conversazione...
            </p>
          </div>
        </div>
      );
    }

    console.log('[TRAINING MAP] Data loaded, rendering TrainingMapLayout');
    return (
      <TrainingMapLayout
        conversationDetail={conversationDetail}
        scriptStructure={scriptStructure}
        onBack={() => {
          console.log('[TRAINING MAP] Closing training map');
          setShowTrainingMap(false);
          setSelectedConversationId(null);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Header with menu button */}
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/sales-agents')}
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Sales Agents
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-blue-600" />
                Analytics - {agent.agentName}
              </h1>
              <div className="ml-auto flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation(`/client/sales-agents/${agentId}/scripts`)}
                className="hidden sm:flex"
              >
                <FileText className="h-4 w-4 mr-2" />
                Script Manager
              </Button>
              <Badge
                variant={agent.isActive ? 'default' : 'secondary'}
                className={agent.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'}
              >
                {agent.isActive ? 'Attivo' : 'Spento'}
              </Badge>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 sm:p-8">
            {/* Script Outdated Alert */}
            {trainingSummary?.scriptOutdated && (
              <Alert variant="destructive" className="mb-6">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Script di Vendita Modificato</AlertTitle>
                <AlertDescription>
                  Il file sorgente dello script di vendita è stato modificato dopo l'ultima estrazione JSON.
                  I dati di training potrebbero non riflettere la struttura corrente dello script.
                  <br />
                  <strong>Azione richiesta:</strong> Esegui{' '}
                  <code className="px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 font-mono text-xs">
                    tsx server/ai/sales-script-structure-parser.ts
                  </code>{' '}
                  per aggiornare la struttura.
                </AlertDescription>
              </Alert>
            )}

            <Tabs defaultValue="overview" value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="overview">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Panoramica
                </TabsTrigger>
                <TabsTrigger value="training">
                  <Brain className="h-4 w-4 mr-2" />
                  Addestramento
                  {enablePolling && (
                    <span className="ml-2 h-2 w-2 bg-green-500 rounded-full animate-pulse" title="Aggiornamento automatico attivo" />
                  )}
                </TabsTrigger>
                <TabsTrigger value="ai-training">
                  <Sparkles className="h-4 w-4 mr-2" />
                  AI Training Assistant
                </TabsTrigger>
                <TabsTrigger value="ai-trainer">
                  <Bot className="h-4 w-4 mr-2" />
                  AI Trainer
                </TabsTrigger>
                <TabsTrigger value="guide">
                  <BookOpen className="h-4 w-4 mr-2" />
                  Guida
                </TabsTrigger>
              </TabsList>

              {/* Tab 1: Panoramica (Existing Content) */}
              <TabsContent value="overview" className="space-y-8">
                {/* Stats Overview - Placeholder */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-3 gap-6"
                >
                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Conversazioni Totali
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            -
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Link Inviti Generati
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            -
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          <Link2 className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Tasso di Conversione
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            -%
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <TrendingUp className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Inviti Generati Section */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-white dark:bg-gray-800 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Link2 className="h-6 w-6 text-purple-600" />
                        Link Inviti Generati
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <InvitesListTable agentId={agentId!} />
                    </CardContent>
                  </Card>
                </motion.div>

                {/* More Analytics - Coming Soon */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-12 text-center">
                      <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                        Grafici e Metriche Avanzate
                      </h3>
                      <p className="text-gray-600 dark:text-gray-400 mb-4">
                        Statistiche dettagliate, grafici temporali e analytics avanzate in arrivo
                      </p>
                      <Badge variant="outline">Coming Soon</Badge>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Tab 2: Addestramento (ADVANCED TRAINING ANALYTICS) */}
              <TabsContent value="training" className="space-y-8">
                {/* Training Stats Summary Cards */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="grid grid-cols-1 md:grid-cols-4 gap-6"
                >
                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Conversazioni
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {statsLoading ? '...' : trainingStats?.totalConversations || 0}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <MessageSquare className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Completamento Medio
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {statsLoading
                              ? '...'
                              : `${Math.round((trainingStats?.averageCompletionRate || 0) * 100)}%`}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                          <CheckCircle className="h-6 w-6 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Attivazioni Ladder
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {statsLoading ? '...' : trainingStats?.totalLadderActivations || 0}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                          <Activity className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-white dark:bg-gray-800">
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                            Durata Media
                          </p>
                          <p className="text-3xl font-bold text-gray-900 dark:text-white">
                            {statsLoading
                              ? '...'
                              : `${Math.floor((trainingStats?.averageDuration || 0) / 60)}m`}
                          </p>
                        </div>
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Conversations Table - ESSENTIAL FOR OPENING TRAINING MAP */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                >
                  <Card className="bg-white dark:bg-gray-800 shadow-xl">
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <CardTitle className="text-2xl flex items-center gap-2">
                          <Brain className="h-6 w-6 text-blue-600" />
                          Conversazioni Tracciate
                          {enablePolling && (
                            <Badge variant="outline" className="text-xs bg-green-50 dark:bg-green-950 border-green-500 text-green-700 dark:text-green-300">
                              <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse mr-1" />
                              Aggiornamento automatico
                            </Badge>
                          )}
                        </CardTitle>
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2">
                            <Filter className="h-4 w-4 text-muted-foreground" />
                            <Select 
                              value={scriptTypeFilter} 
                              onValueChange={(value) => setScriptTypeFilter(value as 'all' | 'discovery' | 'demo' | 'objections')}
                            >
                              <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Tipo Script" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">Tutti gli script</SelectItem>
                                <SelectItem value="discovery">Discovery</SelectItem>
                                <SelectItem value="demo">Demo</SelectItem>
                                <SelectItem value="objections">Obiezioni</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <Button
                            onClick={handleRefresh}
                            variant="outline"
                            size="sm"
                            disabled={isRefreshing}
                            className="gap-2"
                          >
                            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                            Aggiorna
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {conversationsLoading ? (
                        <div className="text-center py-8">
                          <Bot className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-pulse" />
                          <p className="text-gray-600 dark:text-gray-400">Caricamento...</p>
                        </div>
                      ) : trainingConversations.length === 0 ? (
                        <div className="text-center py-12">
                          <Brain className="h-16 w-16 mx-auto mb-4 text-gray-400" />
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                            Nessuna conversazione tracciata
                          </h3>
                          <p className="text-gray-600 dark:text-gray-400">
                            Le conversazioni con il tracking attivo appariranno qui
                          </p>
                        </div>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200 dark:border-gray-700">
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Prospect
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Fase Corrente
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Completamento
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Ladder
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Durata
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Script
                                </th>
                                <th className="text-left p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Data
                                </th>
                                <th className="text-right p-3 text-sm font-semibold text-gray-700 dark:text-gray-300">
                                  Azioni
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {trainingConversations
                                .filter(conv => scriptTypeFilter === 'all' || conv.usedScriptType === scriptTypeFilter)
                                .map((conv) => {
                                const isLive = isConversationLive(conv.createdAt);
                                return (
                                <tr
                                  key={conv.id}
                                  className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                                >
                                  <td className="p-3 text-sm text-gray-900 dark:text-white">
                                    <div className="flex items-center gap-2">
                                      {isLive && (
                                        <Badge variant="destructive" className="text-xs bg-red-500 hover:bg-red-600 animate-pulse">
                                          <span className="h-2 w-2 bg-white rounded-full mr-1" />
                                          LIVE
                                        </Badge>
                                      )}
                                      <span>{conv.prospectName || 'Anonimo'}</span>
                                    </div>
                                  </td>
                                  <td className="p-3">
                                    <Badge variant="outline">{conv.currentPhase}</Badge>
                                  </td>
                                  <td className="p-3">
                                    <div className="flex items-center gap-2">
                                      <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 max-w-[100px]">
                                        <div
                                          className="bg-green-500 h-2 rounded-full"
                                          style={{ width: `${conv.completionRate * 100}%` }}
                                        />
                                      </div>
                                      <span className="text-sm text-gray-600 dark:text-gray-400">
                                        {Math.round(conv.completionRate * 100)}%
                                      </span>
                                    </div>
                                  </td>
                                  <td className="p-3 text-sm text-gray-900 dark:text-white">
                                    {conv.ladderActivationCount}x
                                  </td>
                                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                                    {Math.floor(conv.totalDuration / 60)}m
                                  </td>
                                  <td className="p-3">
                                    {conv.usedScriptName ? (
                                      <div className="flex flex-col">
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">{conv.usedScriptName}</span>
                                        <Badge variant="outline" className="text-xs w-fit">
                                          {conv.usedScriptType || 'N/A'}
                                        </Badge>
                                      </div>
                                    ) : (
                                      <Badge variant="secondary" className="text-xs">
                                        {conv.usedScriptSource === 'hardcoded_default' ? 'Default' : 'N/A'}
                                      </Badge>
                                    )}
                                  </td>
                                  <td className="p-3 text-sm text-gray-600 dark:text-gray-400">
                                    {formatDistanceToNow(new Date(conv.createdAt), {
                                      addSuffix: true,
                                      locale: it,
                                    })}
                                  </td>
                                  <td className="p-3 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          console.log('[AI TRAINING] Opening AI Training tab for conversation:', conv.id);
                                          setPreselectedConversationId(conv.id);
                                          setActiveTab('ai-training');
                                        }}
                                      >
                                        <Sparkles className="h-4 w-4 mr-1" />
                                        Analizza con AI
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="ghost"
                                        onClick={() => {
                                          console.log('[TRAINING MAP] Opening training map for conversation:', conv.id);
                                          setSelectedConversationId(conv.id);
                                          setShowTrainingMap(true);
                                        }}
                                      >
                                        <Map className="h-4 w-4 mr-1" />
                                        Mappa
                                      </Button>
                                    </div>
                                  </td>
                                </tr>
                              );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>

                {/* Advanced Training Analytics - 4 Sub-Tabs */}
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <Card className="bg-white dark:bg-gray-800 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-2xl flex items-center gap-2">
                        <Sparkles className="h-6 w-6 text-purple-600" />
                        Analisi Avanzate Training
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Tabs defaultValue="phase-flow" className="w-full">
                        <TabsList className="grid w-full grid-cols-4">
                          <TabsTrigger value="phase-flow">Phase Flow</TabsTrigger>
                          <TabsTrigger value="ladder">Ladder Analytics</TabsTrigger>
                          <TabsTrigger value="objections">Objection Handling</TabsTrigger>
                          <TabsTrigger value="ai-reasoning">AI Reasoning</TabsTrigger>
                        </TabsList>

                        <TabsContent value="phase-flow" className="mt-6">
                          <PhaseFlowTab agentId={agentId!} />
                        </TabsContent>

                        <TabsContent value="ladder" className="mt-6">
                          <LadderAnalyticsTab agentId={agentId!} />
                        </TabsContent>

                        <TabsContent value="objections" className="mt-6">
                          <ObjectionHandlingTab agentId={agentId!} />
                        </TabsContent>

                        <TabsContent value="ai-reasoning" className="mt-6">
                          <AIReasoningTab agentId={agentId!} />
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Tab 3: Guida (COMPLETE GUIDE) */}
              {/* Tab 4: AI Training Assistant */}
              <TabsContent value="ai-training" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <TrainingFileUpload 
                    agentId={agentId!} 
                    preselectedConversationId={preselectedConversationId}
                    onConversationPreselected={() => setPreselectedConversationId('')}
                  />
                </motion.div>
              </TabsContent>

              {/* Tab 5: AI Trainer - Campo di Battaglia */}
              <TabsContent value="ai-trainer" className="space-y-6">
                <AITrainerTab agentId={agentId!} />
              </TabsContent>

              {/* Tab 6: Guida */}
              <TabsContent value="guide" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  {/* Header */}
                  <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-xl">
                        <BookOpen className="h-6 w-6 text-blue-600" />
                        Guida Completa al Sistema di Training & Analytics
                      </CardTitle>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                        Tutto quello che devi sapere per comprendere, utilizzare e ottimizzare il sistema
                        di tracking avanzato del tuo agente AI di vendita.
                      </p>
                    </CardHeader>
                  </Card>

                  {/* Accordion Guide Sections */}
                  <Card>
                    <CardContent className="p-6">
                      <Accordion type="multiple" className="w-full">
                        {/* Section 1: Introduzione */}
                        <AccordionItem value="intro">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <Info className="h-5 w-5 text-blue-600" />
                              1. Cos'è il Sistema di Training?
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                              Il <strong>Sistema di Training</strong> è un framework avanzato che traccia in tempo reale
                              tutte le conversazioni del tuo agente AI di vendita, analizzando ogni interazione secondo la
                              metodologia dello script B2B italiano con la logica del <strong>3-5 PERCHÉ ladder</strong>.
                            </p>
                            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
                              <h4 className="font-semibold mb-2 text-blue-900 dark:text-blue-100">Obiettivi Principali:</h4>
                              <ul className="list-disc list-inside space-y-1 text-blue-800 dark:text-blue-200">
                                <li><strong>Monitoraggio:</strong> Traccia ogni fase della conversazione (8 fasi totali)</li>
                                <li><strong>Analisi:</strong> Cattura ragionamento AI, ladder activations, checkpoints</li>
                                <li><strong>Ottimizzazione:</strong> Identifica pattern di successo e aree di miglioramento</li>
                                <li><strong>Training:</strong> Fornisce dati strutturati per addestrare e perfezionare l'AI</li>
                              </ul>
                            </div>
                            <p>
                              Tutti i dati vengono salvati in <strong>PostgreSQL</strong> con schema dettagliato che include:
                              transcript completo, fasi raggiunte, ladder activations, checkpoints completati, semantic classification,
                              e AI reasoning per ogni decisione presa dall'agente.
                            </p>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 2: Architettura */}
                        <AccordionItem value="architecture">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <GitBranch className="h-5 w-5 text-purple-600" />
                              2. Come Funziona? (Architettura)
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <p>Il sistema è composto da 3 componenti principali che lavorano in sinergia:</p>
                            
                            <div className="space-y-3">
                              {/* Component 1: Tracker */}
                              <div className="border-l-4 border-green-500 pl-4 py-2">
                                <h4 className="font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                                  <Activity className="h-4 w-4" />
                                  1. SalesScriptTracker
                                </h4>
                                <p className="text-xs mt-1">
                                  <strong>Ruolo:</strong> Traccia lo stato corrente della conversazione in tempo reale
                                </p>
                                <ul className="list-disc list-inside text-xs mt-2 space-y-0.5 ml-2">
                                  <li>Carica struttura script da JSON (8 fasi, steps, checkpoints)</li>
                                  <li>Mantiene stato: fase corrente, fasi raggiunte, checkpoints completati</li>
                                  <li>Classificazione semantica (discovery, demo, objections, closing)</li>
                                  <li>Metodi: <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">updatePhase()</code>, <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">markCheckpoint()</code>, <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">getState()</code></li>
                                </ul>
                                <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                                  📁 <code>server/ai/sales-script-tracker.ts</code>
                                </p>
                              </div>

                              {/* Component 2: Logger */}
                              <div className="border-l-4 border-blue-500 pl-4 py-2">
                                <h4 className="font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                                  <FileText className="h-4 w-4" />
                                  2. SalesScriptLogger
                                </h4>
                                <p className="text-xs mt-1">
                                  <strong>Ruolo:</strong> Salva tutti i dati nel database PostgreSQL
                                </p>
                                <ul className="list-disc list-inside text-xs mt-2 space-y-0.5 ml-2">
                                  <li>UPSERT su tabella <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">sales_conversation_training</code></li>
                                  <li>Salva: transcript, ladder activations, AI reasoning, questions asked</li>
                                  <li>Calcola metriche: completion rate, duration, ladder count</li>
                                  <li>Metodi: <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">logConversation()</code>, <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">updateMetrics()</code></li>
                                </ul>
                                <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                                  📁 <code>server/ai/sales-script-logger.ts</code>
                                </p>
                              </div>

                              {/* Component 3: Aggregator */}
                              <div className="border-l-4 border-orange-500 pl-4 py-2">
                                <h4 className="font-bold text-orange-700 dark:text-orange-400 flex items-center gap-2">
                                  <BarChart3 className="h-4 w-4" />
                                  3. Training Summary Aggregator (Cron Job)
                                </h4>
                                <p className="text-xs mt-1">
                                  <strong>Ruolo:</strong> Pre-calcola metriche aggregate ogni giorno alle 3 AM UTC
                                </p>
                                <ul className="list-disc list-inside text-xs mt-2 space-y-0.5 ml-2">
                                  <li>Calcola 9 metriche: avg completion, ladder usage, duration, phase distribution</li>
                                  <li>Salva su tabella <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">sales_agent_training_summary</code></li>
                                  <li>Gestisce edge case: zero conversazioni, dati mancanti, normalizzazione</li>
                                  <li>Schedule configurabile con <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">CRON_TIMEZONE</code> env var (default: UTC)</li>
                                </ul>
                                <p className="text-xs mt-2 text-gray-600 dark:text-gray-400">
                                  📁 <code>server/jobs/training-summary-aggregator.ts</code>
                                </p>
                              </div>
                            </div>

                            <div className="bg-purple-50 dark:bg-purple-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800 mt-4">
                              <h4 className="font-semibold mb-2 text-purple-900 dark:text-purple-100">Flow Completo:</h4>
                              <ol className="list-decimal list-inside space-y-1 text-xs text-purple-800 dark:text-purple-200">
                                <li>Conversazione inizia → <strong>Tracker</strong> carica script structure</li>
                                <li>Ogni turno → <strong>Tracker</strong> aggiorna fase/checkpoint</li>
                                <li>Fine conversazione → <strong>Logger</strong> salva tutto in DB</li>
                                <li>Ogni giorno 3 AM UTC → <strong>Aggregator</strong> calcola summary</li>
                                <li>Dashboard → API legge dati pre-calcolati (fast response)</li>
                              </ol>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 3: Dashboard Metrics */}
                        <AccordionItem value="metrics">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <BarChart3 className="h-5 w-5 text-green-600" />
                              3. Come Leggere la Dashboard?
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <p>
                              Il tab <strong>Addestramento</strong> mostra 4 metriche principali e una tabella dettagliata
                              delle conversazioni. Ecco come interpretare ogni elemento:
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {/* Metric 1 */}
                              <div className="border rounded-lg p-3 bg-blue-50 dark:bg-blue-950">
                                <div className="flex items-center gap-2 mb-2">
                                  <MessageSquare className="h-4 w-4 text-blue-600" />
                                  <h4 className="font-semibold text-blue-900 dark:text-blue-100">Conversazioni Totali</h4>
                                </div>
                                <p className="text-xs text-blue-800 dark:text-blue-200">
                                  Numero totale di conversazioni registrate per questo agente.
                                  Più conversazioni = più dati di training disponibili.
                                </p>
                              </div>

                              {/* Metric 2 */}
                              <div className="border rounded-lg p-3 bg-green-50 dark:bg-green-950">
                                <div className="flex items-center gap-2 mb-2">
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                  <h4 className="font-semibold text-green-900 dark:text-green-100">Completamento Medio</h4>
                                </div>
                                <p className="text-xs text-green-800 dark:text-green-200">
                                  Percentuale media di fasi completate. Valori alti (80%+) indicano conversazioni
                                  ben strutturate che seguono lo script fino alla fine.
                                </p>
                              </div>

                              {/* Metric 3 */}
                              <div className="border rounded-lg p-3 bg-purple-50 dark:bg-purple-950">
                                <div className="flex items-center gap-2 mb-2">
                                  <TrendingUp className="h-4 w-4 text-purple-600" />
                                  <h4 className="font-semibold text-purple-900 dark:text-purple-100">Ladder Activations</h4>
                                </div>
                                <p className="text-xs text-purple-800 dark:text-purple-200">
                                  Numero medio di volte che l'AI ha usato la tecnica "3-5 PERCHÉ" per approfondire
                                  risposte vaghe. Valori ottimali: 2-4x per conversazione.
                                </p>
                              </div>

                              {/* Metric 4 */}
                              <div className="border rounded-lg p-3 bg-orange-50 dark:bg-orange-950">
                                <div className="flex items-center gap-2 mb-2">
                                  <Clock className="h-4 w-4 text-orange-600" />
                                  <h4 className="font-semibold text-orange-900 dark:text-orange-100">Durata Media</h4>
                                </div>
                                <p className="text-xs text-orange-800 dark:text-orange-200">
                                  Tempo medio di conversazione in minuti. Benchmark: 15-30 min per vendita B2B consultiva.
                                  Troppo breve = abbandono; troppo lungo = perdita focus.
                                </p>
                              </div>
                            </div>

                            <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700 mt-4">
                              <h4 className="font-semibold mb-2 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Tabella Conversazioni
                              </h4>
                              <p className="text-xs mb-2">Clicca <strong>Dettagli</strong> su una conversazione per vedere:</p>
                              <ul className="list-disc list-inside text-xs space-y-1 ml-2">
                                <li><strong>Timeline Fasi:</strong> Visualizzazione cronologica delle fasi raggiunte</li>
                                <li><strong>Transcript Completo:</strong> Ogni messaggio user/assistant con timestamp e fase</li>
                                <li><strong>AI Reasoning:</strong> Decisioni prese dall'AI con motivazioni dettagliate</li>
                                <li><strong>Ladder Activations:</strong> Quando e come l'AI ha usato la tecnica "perché"</li>
                                <li><strong>Checkpoints:</strong> Quali obiettivi sono stati raggiunti (es. "Budget qualificato")</li>
                              </ul>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 4: Troubleshooting */}
                        <AccordionItem value="troubleshooting">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <AlertTriangle className="h-5 w-5 text-red-600" />
                              4. Troubleshooting: Alert "Script Modificato"
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border-2 border-red-500">
                              <h4 className="font-bold text-red-900 dark:text-red-100 mb-2 flex items-center gap-2">
                                <AlertTriangle className="h-5 w-5" />
                                Quando compare questo alert?
                              </h4>
                              <p className="text-xs text-red-800 dark:text-red-200">
                                L'alert compare quando il file sorgente dello script di vendita
                                (<code className="px-1 bg-red-200 dark:bg-red-900 rounded">server/ai/sales-scripts-base.ts</code>)
                                è stato modificato <strong>dopo</strong> l'ultima estrazione della struttura JSON.
                              </p>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <h4 className="font-semibold mb-2">🔍 Perché è importante?</h4>
                                <p className="text-xs">
                                  Il sistema traccia conversazioni basandosi sulla struttura JSON che rappresenta il tuo script
                                  (fasi, steps, checkpoints). Se modifichi lo script senza rigenerare il JSON, i dati di training
                                  potrebbero essere inconsistenti o riferirsi a fasi che non esistono più.
                                </p>
                              </div>

                              <div>
                                <h4 className="font-semibold mb-2">✅ Come risolvere?</h4>
                                <ol className="list-decimal list-inside text-xs space-y-2 ml-2">
                                  <li>
                                    <strong>Apri il terminale</strong> nel progetto Replit
                                  </li>
                                  <li>
                                    <strong>Esegui il parser:</strong>
                                    <pre className="bg-gray-900 text-green-400 p-2 rounded mt-1 text-xs font-mono">
                                      tsx server/ai/sales-script-structure-parser.ts
                                    </pre>
                                  </li>
                                  <li>
                                    Il parser leggerà <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">sales-scripts-base.ts</code>,
                                    estrarrà tutte le fasi/steps/checkpoints, e aggiornerà
                                    <code className="px-1 bg-gray-200 dark:bg-gray-700 rounded">sales-script-structure.json</code> con
                                    un nuovo hash SHA-256
                                  </li>
                                  <li>
                                    <strong>Ricarica la dashboard</strong> - L'alert scomparirà automaticamente
                                  </li>
                                </ol>
                              </div>

                              <div className="bg-yellow-50 dark:bg-yellow-950 p-3 rounded border border-yellow-300 dark:border-yellow-700">
                                <h4 className="font-semibold text-yellow-900 dark:text-yellow-100 mb-1 text-xs">
                                  ⚠️ Best Practice
                                </h4>
                                <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                  Ogni volta che modifichi <code className="px-1 bg-yellow-200 dark:bg-yellow-900 rounded">sales-scripts-base.ts</code>,
                                  ricordati di eseguire il parser <strong>prima</strong> di testare nuove conversazioni.
                                  Questo garantisce che il tracking sia sempre allineato con la versione corrente dello script.
                                </p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 5: Technical Structure */}
                        <AccordionItem value="technical">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <Code className="h-5 w-5 text-indigo-600" />
                              5. Struttura Tecnica (File & Database)
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Files Section */}
                              <div className="border rounded-lg p-4">
                                <h4 className="font-bold mb-3 flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-blue-600" />
                                  File Principali
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                      server/ai/sales-scripts-base.ts
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Script sorgente con 8 fasi, steps, ladder logic (2839 righe)
                                    </p>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                      server/ai/sales-script-structure.json
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Struttura estratta dal parser con SHA-256 hash
                                    </p>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                      server/ai/sales-script-tracker.ts
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Tracker real-time con metodi updatePhase, markCheckpoint
                                    </p>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                      server/ai/sales-script-logger.ts
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Logger per salvataggio DB con UPSERT
                                    </p>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-blue-600 dark:text-blue-400 font-mono text-xs">
                                      server/jobs/training-summary-aggregator.ts
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Cron job giornaliero (3 AM UTC) per aggregazione metriche
                                    </p>
                                  </div>
                                </div>
                              </div>

                              {/* Database Section */}
                              <div className="border rounded-lg p-4">
                                <h4 className="font-bold mb-3 flex items-center gap-2">
                                  <Database className="h-4 w-4 text-green-600" />
                                  Tabelle Database
                                </h4>
                                <div className="space-y-2 text-xs">
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-green-600 dark:text-green-400 font-mono text-xs">
                                      sales_conversation_training
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Dati raw di ogni conversazione (JSONB fields)
                                    </p>
                                    <ul className="list-disc list-inside ml-2 mt-1 text-gray-500 dark:text-gray-500 text-xs">
                                      <li>conversation_id (PK)</li>
                                      <li>tracking_state (fasi, checkpoints)</li>
                                      <li>ladder_activations (array)</li>
                                      <li>ai_reasoning (array)</li>
                                      <li>full_transcript (array)</li>
                                    </ul>
                                  </div>
                                  <div className="bg-gray-100 dark:bg-gray-800 p-2 rounded">
                                    <code className="text-green-600 dark:text-green-400 font-mono text-xs">
                                      sales_agent_training_summary
                                    </code>
                                    <p className="mt-1 text-gray-600 dark:text-gray-400">
                                      Metriche aggregate pre-calcolate (performance)
                                    </p>
                                    <ul className="list-disc list-inside ml-2 mt-1 text-gray-500 dark:text-gray-500 text-xs">
                                      <li>agent_id (PK)</li>
                                      <li>total_conversations</li>
                                      <li>avg_completion_rate</li>
                                      <li>avg_ladder_activations</li>
                                      <li>phase_distribution (JSONB)</li>
                                    </ul>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="bg-indigo-50 dark:bg-indigo-950 p-4 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              <h4 className="font-semibold mb-2 text-indigo-900 dark:text-indigo-100">
                                🔧 Variabili di Configurazione
                              </h4>
                              <div className="space-y-1 text-xs text-indigo-800 dark:text-indigo-200">
                                <p>
                                  <code className="px-1.5 py-0.5 bg-indigo-200 dark:bg-indigo-900 rounded font-mono">
                                    CRON_TIMEZONE
                                  </code>{' '}
                                  - Timezone per cron job aggregator (default: "UTC")
                                </p>
                                <p className="text-xs text-indigo-700 dark:text-indigo-300 ml-4">
                                  Esempio: "Europe/Rome" per eseguire alle 3 AM ora italiana
                                </p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 6: Best Practices */}
                        <AccordionItem value="best-practices">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <CheckCircle className="h-5 w-5 text-teal-600" />
                              6. Best Practices & Consigli
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="grid grid-cols-1 gap-3">
                              <div className="bg-teal-50 dark:bg-teal-950 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                                <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">
                                  ✅ Analizza regolarmente i dati
                                </h4>
                                <p className="text-xs text-teal-800 dark:text-teal-200">
                                  Controlla la dashboard almeno 1-2 volte a settimana per identificare pattern:
                                  in quali fasi i prospect abbandonano? Quali checkpoints vengono saltati?
                                  Il ladder è usato troppo o troppo poco?
                                </p>
                              </div>

                              <div className="bg-teal-50 dark:bg-teal-950 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                                <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">
                                  ✅ Testa modifiche allo script gradualmente
                                </h4>
                                <p className="text-xs text-teal-800 dark:text-teal-200">
                                  Quando modifichi <code className="px-1 bg-teal-200 dark:bg-teal-900 rounded">sales-scripts-base.ts</code>,
                                  fai cambiamenti piccoli e misurabili. Rigenera subito il JSON e confronta metriche
                                  prima/dopo per valutare l'impatto.
                                </p>
                              </div>

                              <div className="bg-teal-50 dark:bg-teal-950 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                                <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">
                                  ✅ Usa AI Reasoning per debugging
                                </h4>
                                <p className="text-xs text-teal-800 dark:text-teal-200">
                                  Quando una conversazione va male, apri i dettagli e leggi l'<strong>AI Reasoning</strong>.
                                  Vedrai esattamente perché l'AI ha preso certe decisioni. Questo è oro puro per ottimizzare
                                  il prompt e lo script.
                                </p>
                              </div>

                              <div className="bg-teal-50 dark:bg-teal-950 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                                <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">
                                  ✅ Monitora Ladder Activations
                                </h4>
                                <p className="text-xs text-teal-800 dark:text-teal-200">
                                  Il valore ottimale di ladder activations è <strong>2-4x per conversazione</strong>.
                                  Troppo poche = risposte superficiali; troppe = conversazione diventa interrogatorio.
                                  Usa questo KPI per bilanciare.
                                </p>
                              </div>

                              <div className="bg-teal-50 dark:bg-teal-950 p-3 rounded-lg border border-teal-200 dark:border-teal-800">
                                <h4 className="font-semibold text-teal-900 dark:text-teal-100 mb-2">
                                  ✅ Backup prima di modifiche importanti
                                </h4>
                                <p className="text-xs text-teal-800 dark:text-teal-200">
                                  Prima di fare cambiamenti drastici allo script, fai backup di
                                  <code className="px-1 bg-teal-200 dark:bg-teal-900 rounded">sales-scripts-base.ts</code> e
                                  <code className="px-1 bg-teal-200 dark:bg-teal-900 rounded">sales-script-structure.json</code>.
                                  Così puoi sempre tornare indietro se necessario.
                                </p>
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* Section 7: AI Training Assistant */}
                        <AccordionItem value="ai-training">
                          <AccordionTrigger className="text-lg font-semibold">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-5 w-5 text-purple-600" />
                              7. AI Training Assistant - Gemini 2.5 Pro
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="space-y-4 text-sm text-gray-700 dark:text-gray-300">
                            <div className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
                              <h4 className="font-bold text-purple-900 dark:text-purple-100 mb-2 flex items-center gap-2">
                                <Sparkles className="h-5 w-5" />
                                Cos'è l'AI Training Assistant?
                              </h4>
                              <p className="text-xs text-purple-800 dark:text-purple-200">
                                Un assistente AI powered by <strong>Gemini 2.5 Pro</strong> che analizza automaticamente i tuoi documenti di training 
                                (manuali di vendita, best practices, script di successo) e confrontandoli con il tuo script attuale e le performance 
                                delle conversazioni, <strong>suggerisce miglioramenti concreti e prioritizzati</strong> per aumentare il conversion rate.
                              </p>
                            </div>

                            <div className="space-y-3">
                              <h4 className="font-semibold">🔍 Come Funziona?</h4>
                              <div className="space-y-2">
                                <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
                                  <div className="bg-blue-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">1</div>
                                  <div>
                                    <h5 className="font-semibold text-blue-900 dark:text-blue-100 text-sm">Upload Documenti</h5>
                                    <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                                      Carica fino a 5 file (PDF, DOCX, TXT) con materiali di training: script vincenti, best practices, 
                                      manuali di vendita, tecniche di closing, gestione obiezioni, ecc.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                                  <div className="bg-purple-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">2</div>
                                  <div>
                                    <h5 className="font-semibold text-purple-900 dark:text-purple-100 text-sm">Analisi AI Automatica</h5>
                                    <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
                                      Gemini 2.5 Pro estrae best practices dai documenti, analizza il tuo script corrente e 
                                      studia le ultime 20 conversazioni per identificare pattern di successo/fallimento.
                                    </p>
                                  </div>
                                </div>

                                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                                  <div className="bg-green-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold flex-shrink-0">3</div>
                                  <div>
                                    <h5 className="font-semibold text-green-900 dark:text-green-100 text-sm">Suggerimenti Prioritizzati</h5>
                                    <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                                      Ricevi 8-12 suggerimenti concreti con priorità (Critical/High/Medium/Low), 
                                      script "prima/dopo", impatto stimato (+X% conversion), e effort richiesto.
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 mt-4">
                              <h4 className="font-semibold">🎯 Cosa Analizza Esattamente?</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <h5 className="text-xs font-semibold mb-1">📋 Gap tra Best Practices e Script</h5>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Confronta tecniche nei documenti vs script attuale (es: manca urgency in closing?)
                                  </p>
                                </div>
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <h5 className="text-xs font-semibold mb-1">📊 Pattern Performance</h5>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Analizza dove prospect droppano (fase 3? checkpoint budget?) e suggerisce fix
                                  </p>
                                </div>
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <h5 className="text-xs font-semibold mb-1">🪜 Ladder Effectiveness</h5>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Verifica se usi troppo/poco la tecnica 3-5 PERCHÉ e suggerisce quando attivarla
                                  </p>
                                </div>
                                <div className="p-2 bg-gray-50 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                                  <h5 className="text-xs font-semibold mb-1">🛡️ Gestione Obiezioni</h5>
                                  <p className="text-xs text-gray-600 dark:text-gray-400">
                                    Confronta script obiezioni con tecniche provate nei documenti (es: reframe, social proof)
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-3 mt-4">
                              <h4 className="font-semibold">🚀 Come Può Migliorare il Tuo Script?</h4>
                              <div className="space-y-2">
                                <div className="border-l-4 border-red-500 pl-3 py-2 bg-red-50 dark:bg-red-950">
                                  <h5 className="text-xs font-bold text-red-900 dark:text-red-100">Critical (Priorità Massima)</h5>
                                  <p className="text-xs text-red-800 dark:text-red-200 mt-1">
                                    Gap che causano perdita di clienti. Es: manca scarcity/urgency nel closing, +15-20% conversion se fixato.
                                    <strong> Fix immediato consigliato.</strong>
                                  </p>
                                </div>
                                <div className="border-l-4 border-orange-500 pl-3 py-2 bg-orange-50 dark:bg-orange-950">
                                  <h5 className="text-xs font-bold text-orange-900 dark:text-orange-100">High (Alta Priorità)</h5>
                                  <p className="text-xs text-orange-800 dark:text-orange-200 mt-1">
                                    Impatto significativo (&gt;10% conversion). Es: aggiungere social proof in discovery, +12% trust.
                                    <strong> Pianifica implementazione entro 1-2 settimane.</strong>
                                  </p>
                                </div>
                                <div className="border-l-4 border-yellow-500 pl-3 py-2 bg-yellow-50 dark:bg-yellow-950">
                                  <h5 className="text-xs font-bold text-yellow-900 dark:text-yellow-100">Medium/Low</h5>
                                  <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                                    Ottimizzazioni incrementali. Es: migliorare tono in fase intro, +3-5% engagement.
                                    <strong> Implementa quando hai tempo.</strong>
                                  </p>
                                </div>
                              </div>
                            </div>

                            <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-300 dark:border-yellow-800 mt-4">
                              <h4 className="font-semibold mb-2 text-yellow-900 dark:text-yellow-100 flex items-center gap-2">
                                <AlertTriangle className="h-4 w-4" />
                                ⚠️ Importante: Accesso Consultant/Admin
                              </h4>
                              <p className="text-xs text-yellow-800 dark:text-yellow-200">
                                L'AI Training Assistant è disponibile <strong>solo per consultant e admin</strong> perché richiede:
                              </p>
                              <ul className="list-disc list-inside text-xs text-yellow-800 dark:text-yellow-200 mt-2 space-y-1 ml-2">
                                <li>Accesso configurazione Gemini 2.5 Pro (API keys gestite dal consultant)</li>
                                <li>Capacità di modificare script di vendita a livello sistema</li>
                                <li>Comprensione tecniche vendita B2B e metodologia 3-5 PERCHÉ</li>
                                <li>Responsabilità sulle performance degli agenti AI dei clienti</li>
                              </ul>
                            </div>

                            <div className="bg-teal-50 dark:bg-teal-950 p-4 rounded-lg border border-teal-200 dark:border-teal-800 mt-4">
                              <h4 className="font-semibold mb-2 text-teal-900 dark:text-teal-100">💡 Best Practice per Usare l'AI Training Assistant</h4>
                              <ol className="list-decimal list-inside text-xs text-teal-800 dark:text-teal-200 space-y-1.5 ml-2">
                                <li><strong>Carica documenti di qualità:</strong> Usa script/manuali che hanno dato risultati provati (non teoria generica)</li>
                                <li><strong>Analizza dopo 10+ conversazioni:</strong> Più dati = suggerimenti più accurati basati su pattern reali</li>
                                <li><strong>Implementa 1-2 suggerimenti alla volta:</strong> Testa impatto prima di fare cambiamenti multipli</li>
                                <li><strong>Confronta metriche prima/dopo:</strong> Usa tab "Addestramento" per misurare se completion rate migliora</li>
                                <li><strong>Ri-analizza ogni 2-3 settimane:</strong> Quando hai nuovi dati o modifichi materiali di training</li>
                              </ol>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </CardContent>
                  </Card>

                  {/* Footer Note */}
                  <Card className="bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
                    <CardContent className="p-4">
                      <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
                        💡 <strong>Suggerimento:</strong> Per domande o problemi tecnici, consulta la sezione
                        Troubleshooting o contatta il supporto tecnico con screenshot della dashboard e log rilevanti.
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>
            </Tabs>

            {/* Conversation Detail Dialog - NOW REPLACED BY TrainingMapLayout full-screen view */}
            <Dialog
              open={false}
              onOpenChange={() => {}}
            >
              <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-blue-600" />
                    Dettagli Conversazione
                  </DialogTitle>
                  <DialogDescription>
                    Analisi completa della conversazione con timeline, transcript e AI reasoning
                  </DialogDescription>
                </DialogHeader>

                {detailLoading ? (
                  <div className="text-center py-8">
                    <Bot className="h-12 w-12 mx-auto mb-4 text-blue-600 animate-pulse" />
                    <p className="text-gray-600 dark:text-gray-400">Caricamento dettagli...</p>
                  </div>
                ) : conversationDetail ? (
                  <div className="space-y-6 mt-4">
                    {/* 📊 Summary Header - Metriche Chiave */}
                    <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950 border-blue-200 dark:border-blue-800">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">👤 Prospect</p>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                              {conversationDetail.prospectName || 'Anonimo'}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">📍 Fase Attuale</p>
                            <Badge variant="outline" className="text-sm font-semibold">
                              {conversationDetail.currentPhase}
                            </Badge>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">✅ Completamento</p>
                            <div className="flex items-center gap-2">
                              <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div
                                  className="bg-green-500 h-2.5 rounded-full transition-all"
                                  style={{ width: `${conversationDetail.completionRate * 100}%` }}
                                />
                              </div>
                              <span className="font-bold text-gray-900 dark:text-white text-sm">
                                {Math.round(conversationDetail.completionRate * 100)}%
                              </span>
                            </div>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">🎯 Ladder</p>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                              {conversationDetail.ladderActivations.length}x
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {conversationDetail.ladderActivations.filter(l => l.wasVague).length} vaghe
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">📝 Messaggi</p>
                            <p className="font-semibold text-gray-900 dark:text-white text-lg">
                              {conversationDetail.fullTranscript.length}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {conversationDetail.phasesReached.length} fasi
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    {/* 🎯 Ladder Insights - Analisi Regola 3-5 PERCHÉ */}
                    {conversationDetail.ladderActivations.length > 0 && (
                      <Card className="border-orange-200 dark:border-orange-800">
                        <CardHeader className="bg-orange-50 dark:bg-orange-950/30">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg flex items-center gap-2">
                              <Activity className="h-5 w-5 text-orange-600" />
                              🎯 Ladder Insights - Regola 3-5 PERCHÉ
                            </CardTitle>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={
                                  conversationDetail.ladderActivations.length >= 3 &&
                                  conversationDetail.ladderActivations.length <= 5
                                    ? 'default'
                                    : 'destructive'
                                }
                                className="text-sm"
                              >
                                {conversationDetail.ladderActivations.length}x Attivazioni
                              </Badge>
                              {conversationDetail.ladderActivations.filter(l => l.wasVague).length > 0 && (
                                <Badge variant="destructive" className="text-sm">
                                  {conversationDetail.ladderActivations.filter(l => l.wasVague).length} Vaghe
                                </Badge>
                              )}
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="p-6">
                          {/* Compliance Check */}
                          <div className={`p-4 rounded-lg mb-4 ${
                            conversationDetail.ladderActivations.length >= 3 &&
                            conversationDetail.ladderActivations.length <= 5
                              ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                              : 'bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800'
                          }`}>
                            <div className="flex items-start gap-3">
                              <div className="text-2xl">
                                {conversationDetail.ladderActivations.length >= 3 &&
                                conversationDetail.ladderActivations.length <= 5
                                  ? '✅'
                                  : '⚠️'}
                              </div>
                              <div>
                                <p className="font-semibold text-gray-900 dark:text-white mb-1">
                                  {conversationDetail.ladderActivations.length >= 3 &&
                                  conversationDetail.ladderActivations.length <= 5
                                    ? 'Compliance Ottimale Raggiunta'
                                    : 'Fuori Range Ottimale'}
                                </p>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {conversationDetail.ladderActivations.length < 3
                                    ? `Solo ${conversationDetail.ladderActivations.length} attivazioni. Best practice: 3-5 per approfondire i bisogni del prospect.`
                                    : conversationDetail.ladderActivations.length > 5
                                    ? `Ben ${conversationDetail.ladderActivations.length} attivazioni. Rischio interrogatorio. Best practice: 3-5 per bilanciare.`
                                    : `Perfetto! ${conversationDetail.ladderActivations.length} attivazioni rientrano nel range ottimale 3-5.`}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Ladder per Livello */}
                          <div className="space-y-4">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                              Distribuzione per Livello
                            </h4>
                            {[1, 2, 3, 4, 5].map(level => {
                              const ladders = conversationDetail.ladderActivations.filter(l => l.level === level);
                              if (ladders.length === 0) return null;
                              
                              return (
                                <div key={level} className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="font-mono">
                                      Livello {level}
                                    </Badge>
                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                      {ladders.length} attivazione{ladders.length > 1 ? 'i' : ''}
                                    </span>
                                  </div>
                                  {ladders.map((ladder, idx) => (
                                    <div
                                      key={idx}
                                      className={`p-3 rounded-lg border ${
                                        ladder.wasVague
                                          ? 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800'
                                          : 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                          <div className="flex items-center gap-2 mb-2">
                                            <Badge variant="secondary" className="text-xs">
                                              {ladder.phase}
                                            </Badge>
                                            {ladder.wasVague && (
                                              <Badge variant="destructive" className="text-xs animate-pulse">
                                                ⚠️ Risposta Vaga
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="space-y-1.5">
                                            <div>
                                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                💬 Domanda AI:
                                              </p>
                                              <p className="text-sm text-gray-900 dark:text-white ml-4">
                                                "{ladder.question}"
                                              </p>
                                            </div>
                                            <div>
                                              <p className="text-xs font-semibold text-gray-700 dark:text-gray-300">
                                                👤 Risposta Prospect:
                                              </p>
                                              <p className="text-sm text-gray-900 dark:text-white ml-4">
                                                "{ladder.userResponse}"
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Timeline */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg">Timeline Fasi & Eventi</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {/* Phases Reached */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                              <ChevronRight className="h-4 w-4" />
                              Fasi Raggiunte ({conversationDetail.phasesReached.length})
                            </h4>
                            <div className="flex flex-wrap gap-2">
                              {conversationDetail.phasesReached.map((phase, idx) => (
                                <Badge key={idx} variant="secondary">
                                  {phase}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Checkpoints Completed */}
                          {conversationDetail.checkpointsCompleted.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                                <CheckCircle className="h-4 w-4 text-green-600" />
                                Checkpoint Completati ({conversationDetail.checkpointsCompleted.length})
                              </h4>
                              <div className="space-y-2">
                                {conversationDetail.checkpointsCompleted.map((cp, idx) => (
                                  <div
                                    key={idx}
                                    className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                                  >
                                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                                      {cp.checkpointId}
                                    </p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                                      Verifiche: {cp.verifications.join(', ')}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                      {formatDistanceToNow(new Date(cp.completedAt), {
                                        addSuffix: true,
                                        locale: it,
                                      })}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>

                    {/* AI Reasoning */}
                    {conversationDetail.aiReasoning.length > 0 && (
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-lg">AI Reasoning</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="space-y-3 max-h-60 overflow-y-auto">
                            {conversationDetail.aiReasoning.map((reasoning, idx) => (
                              <div
                                key={idx}
                                className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800"
                              >
                                <div className="flex items-start justify-between mb-2">
                                  <Badge variant="outline">{reasoning.phase}</Badge>
                                  <span className="text-xs text-gray-500 dark:text-gray-500">
                                    {formatDistanceToNow(new Date(reasoning.timestamp), {
                                      addSuffix: true,
                                      locale: it,
                                    })}
                                  </span>
                                </div>
                                <p className="text-sm font-medium text-gray-900 dark:text-white mb-1">
                                  {reasoning.decision}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {reasoning.reasoning}
                                </p>
                              </div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    )}

                    {/* Transcript */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center gap-2">
                          <MessageSquare className="h-5 w-5 text-blue-600" />
                          Transcript Completo
                        </CardTitle>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Conversazione completa con {conversationDetail.fullTranscript.length} messaggi
                        </p>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4 max-h-96 overflow-y-auto pr-2">
                          {conversationDetail.fullTranscript.map((msg, idx) => {
                            const isAI = msg.role === 'assistant';
                            const timestamp = new Date(msg.timestamp);
                            const timeStr = timestamp.toLocaleTimeString('it-IT', { 
                              hour: '2-digit', 
                              minute: '2-digit',
                              second: '2-digit'
                            });
                            
                            return (
                              <div
                                key={idx}
                                className={`flex ${isAI ? 'justify-start' : 'justify-end'}`}
                              >
                                <div
                                  className={`max-w-[85%] rounded-2xl p-3 shadow-sm ${
                                    isAI
                                      ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800'
                                      : 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                                  }`}
                                >
                                  {/* Header: Ruolo + Fase */}
                                  <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                                    <div className="flex items-center gap-2">
                                      <Badge 
                                        variant={isAI ? 'default' : 'secondary'}
                                        className={`text-xs font-semibold ${
                                          isAI 
                                            ? 'bg-blue-600 hover:bg-blue-700 text-white' 
                                            : 'bg-green-600 hover:bg-green-700 text-white'
                                        }`}
                                      >
                                        {isAI ? '🤖 AI Agent' : '👤 Utente'}
                                      </Badge>
                                      <Badge 
                                        variant="outline" 
                                        className="text-xs bg-white/50 dark:bg-gray-800/50"
                                      >
                                        {msg.phase}
                                      </Badge>
                                    </div>
                                    <span className="text-xs font-mono text-gray-500 dark:text-gray-400">
                                      {timeStr}
                                    </span>
                                  </div>
                                  
                                  {/* Contenuto messaggio */}
                                  <p className={`text-sm leading-relaxed ${
                                    isAI 
                                      ? 'text-gray-900 dark:text-white' 
                                      : 'text-gray-900 dark:text-white'
                                  }`}>
                                    {msg.content}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                ) : (
                  <p className="text-center text-gray-600 dark:text-gray-400 py-8">
                    Nessun dato disponibile
                  </p>
                )}
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
