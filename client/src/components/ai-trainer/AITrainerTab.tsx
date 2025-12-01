import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Swords,
  Play,
  Square,
  Eye,
  Clock,
  Target,
  Zap,
  MessageSquare,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Loader2,
  ChevronRight,
  ChevronDown,
  Users,
  FileText,
  CheckCircle2,
  Library,
  Brain,
  AlertTriangle,
  XCircle,
  TrendingUp,
  Volume2,
  ShoppingCart,
  Download,
  History,
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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { getAuthHeaders } from '@/lib/auth';
import { PROSPECT_PERSONAS, type ProspectPersona } from '@shared/prospect-personas';

interface AITrainerTabProps {
  agentId: string;
}

interface SalesScript {
  id: string;
  name: string;
  scriptType: 'discovery' | 'demo' | 'objections';
  isActive: boolean;
}

interface AgentWithAssignments {
  id: string;
  agentName: string;
  displayName: string;
  assignments: {
    scriptId: string;
    scriptType: string;
    scriptName: string;
  }[];
}

interface TrainingSession {
  id: string;
  personaId: string;
  personaName: string;
  personaEmoji: string;
  scriptId: string;
  scriptName: string;
  prospectName: string;
  status: 'running' | 'completed' | 'stopped';
  startedAt: string;
  endedAt?: string;
  currentPhase: string;
  completionRate: number;
  ladderActivations: number;
  messageCount: number;
  lastMessage?: string;
}

interface TranscriptMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  phase?: string;
}

interface SalesManagerAnalysisData {
  timestamp: string;
  stepAdvancement: {
    shouldAdvance: boolean;
    nextPhaseId: string | null;
    nextStepId: string | null;
    confidence: number;
    reasoning: string;
  };
  checkpointStatus: {
    checkpointId: string;
    checkpointName: string;
    isComplete: boolean;
    completedItems: string[];
    missingItems: string[];
    canAdvance: boolean;
    itemDetails?: Array<{
      check: string;
      status: 'validated' | 'missing' | 'vague';
      infoCollected?: string;
      reason?: string;
      evidenceQuote?: string;
      suggestedNextAction?: string;
    }>;
  } | null;
  buySignals: {
    detected: boolean;
    signals: Array<{
      type: string;
      phrase: string;
      confidence: number;
    }>;
  };
  objections: {
    detected: boolean;
    objections: Array<{
      type: string;
      phrase: string;
    }>;
  };
  toneAnalysis: {
    isRobotic: boolean;
    energyMismatch: boolean;
    issues: string[];
  };
  feedbackForAgent: {
    shouldInject: boolean;
    priority: string;
    type: string;
    message: string;
    toneReminder?: string;
  } | null;
  currentPhase: {
    id: string;
    name: string;
    stepName: string;
  };
  profilingResult: {
    archetype: string;
    confidence: number;
    filler: string;
    instruction: string;
  } | null;
  archetypeState: {
    current: string;
    confidence: number;
    consecutiveSignals: number;
    turnsSinceUpdate: number;
  } | null;
  checkpointsCompleted: string[];
  analysisTimeMs: number;
}

type ResponseSpeed = 'fast' | 'normal' | 'slow' | 'disabled';
type TestMode = 'discovery' | 'demo' | 'discovery_demo';

const RESPONSE_SPEED_OPTIONS: { value: ResponseSpeed; label: string; description: string; icon: string }[] = [
  { value: 'fast', label: 'Veloce', description: '~1 sec', icon: '⚡' },
  { value: 'normal', label: 'Normale', description: '2-3 sec', icon: '🎯' },
  { value: 'slow', label: 'Lento', description: '4-6 sec', icon: '🐢' },
  { value: 'disabled', label: 'Disabilitato', description: 'Manuale', icon: '⏸️' },
];

const TEST_MODE_OPTIONS: { value: TestMode; label: string; description: string; icon: string; requiresDiscoveryRec: boolean }[] = [
  { value: 'discovery', label: 'Solo Discovery', description: 'Test fase scoperta', icon: '🔍', requiresDiscoveryRec: false },
  { value: 'demo', label: 'Solo Demo', description: 'Richiede Discovery REC', icon: '📊', requiresDiscoveryRec: true },
  { value: 'discovery_demo', label: 'Discovery + Demo', description: 'Flusso completo', icon: '🔄', requiresDiscoveryRec: false },
];

export function AITrainerTab({ agentId }: AITrainerTabProps) {
  const [selectedPersona, setSelectedPersona] = useState<ProspectPersona | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [selectedDemoScriptId, setSelectedDemoScriptId] = useState<string>('');
  const [scriptSelectionTab, setScriptSelectionTab] = useState<'active' | 'all'>('active');
  const [demoScriptSelectionTab, setDemoScriptSelectionTab] = useState<'active' | 'all'>('active');
  const [observeSessionId, setObserveSessionId] = useState<string | null>(null);
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeed>('normal');
  const [testMode, setTestMode] = useState<TestMode>('discovery');
  const [analysisHistory, setAnalysisHistory] = useState<SalesManagerAnalysisData[]>([]);
  const queryClient = useQueryClient();
  
  const { data: discoveryRecStatus } = useQuery<{ hasDiscoveryRec: boolean; lastRecDate?: string }>({
    queryKey: [`/api/ai-trainer/discovery-rec-status/${agentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/ai-trainer/discovery-rec-status/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return { hasDiscoveryRec: false };
      return response.json();
    },
  });
  
  const hasDiscoveryRec = discoveryRecStatus?.hasDiscoveryRec ?? false;
  
  useEffect(() => {
    if (!observeSessionId) {
      setAnalysisHistory([]);
    }
  }, [observeSessionId]);

  const { data: allScripts = [], isLoading: scriptsLoading } = useQuery<SalesScript[]>({
    queryKey: ['/api/sales-scripts'],
    queryFn: async () => {
      const response = await fetch('/api/sales-scripts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch scripts');
      return response.json();
    },
  });

  const { data: agentsData = [], isLoading: agentsLoading } = useQuery<AgentWithAssignments[]>({
    queryKey: ['/api/sales-scripts/agents'],
    queryFn: async () => {
      const response = await fetch('/api/sales-scripts/agents', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    },
  });

  const currentAgentData = agentsData.find(a => a.id === agentId);
  const activeScripts = currentAgentData?.assignments?.map(a => ({
    id: a.scriptId,
    name: a.scriptName || 'Script senza nome',
    scriptType: a.scriptType as 'discovery' | 'demo' | 'objections',
    isActive: true,
  })) || [];

  const getFilteredScripts = (scripts: SalesScript[], forDemo: boolean = false): SalesScript[] => {
    if (testMode === 'discovery') {
      return scripts.filter(s => s.scriptType === 'discovery');
    }
    if (testMode === 'demo') {
      return scripts.filter(s => s.scriptType === 'demo');
    }
    if (testMode === 'discovery_demo') {
      if (forDemo) {
        return scripts.filter(s => s.scriptType === 'demo');
      }
      return scripts.filter(s => s.scriptType === 'discovery');
    }
    return scripts;
  };

  const filteredActiveScripts = getFilteredScripts(activeScripts);
  const filteredAllScripts = getFilteredScripts(allScripts);
  const filteredActiveDemoScripts = getFilteredScripts(activeScripts, true);
  const filteredAllDemoScripts = getFilteredScripts(allScripts, true);

  const selectedScript = selectedScriptId 
    ? (activeScripts.find(s => s.id === selectedScriptId) || allScripts.find(s => s.id === selectedScriptId))
    : null;
  
  const selectedDemoScript = selectedDemoScriptId 
    ? (activeScripts.find(s => s.id === selectedDemoScriptId) || allScripts.find(s => s.id === selectedDemoScriptId))
    : null;

  useEffect(() => {
    setSelectedScriptId('');
    setSelectedDemoScriptId('');
  }, [testMode]);

  const { data: activeSessions = [], isLoading: sessionsLoading, refetch: refetchSessions } = useQuery<TrainingSession[]>({
    queryKey: [`/api/ai-trainer/sessions/${agentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/ai-trainer/sessions/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Failed to fetch sessions');
      }
      return response.json();
    },
    refetchInterval: 3000,
  });

  const { data: transcript = [], refetch: refetchTranscript } = useQuery<TranscriptMessage[]>({
    queryKey: [`/api/ai-trainer/session/${observeSessionId}/transcript`],
    queryFn: async () => {
      if (!observeSessionId) return [];
      const response = await fetch(`/api/ai-trainer/session/${observeSessionId}/transcript`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      return response.json();
    },
    enabled: !!observeSessionId,
    refetchInterval: observeSessionId ? 2000 : false,
  });

  const { data: managerAnalysisArray = [], isLoading: managerAnalysisLoading, isError: managerAnalysisError } = useQuery<SalesManagerAnalysisData[]>({
    queryKey: [`/api/ai-trainer/session/${observeSessionId}/manager-analysis`],
    queryFn: async () => {
      if (!observeSessionId) return [];
      const response = await fetch(`/api/ai-trainer/session/${observeSessionId}/manager-analysis`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return [];
      const data = await response.json();
      return Array.isArray(data) ? data : (data ? [data] : []);
    },
    enabled: !!observeSessionId,
    refetchInterval: observeSessionId ? 2000 : false,
  });

  useEffect(() => {
    if (managerAnalysisArray.length > 0) {
      setAnalysisHistory(managerAnalysisArray);
    }
  }, [managerAnalysisArray]);

  const handleExportAnalysis = () => {
    if (analysisHistory.length === 0) return;
    
    const exportData = {
      sessionId: observeSessionId,
      exportedAt: new Date().toISOString(),
      analysisCount: analysisHistory.length,
      analyses: analysisHistory,
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `manager-analysis-${observeSessionId?.substring(0, 8)}-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const startSessionMutation = useMutation({
    mutationFn: async ({ 
      scriptId, 
      demoScriptId, 
      personaId, 
      responseSpeed, 
      testMode 
    }: { 
      scriptId: string; 
      demoScriptId?: string;
      personaId: string; 
      responseSpeed: ResponseSpeed; 
      testMode: TestMode 
    }) => {
      const response = await fetch('/api/ai-trainer/start-session', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          agentId, 
          scriptId, 
          demoScriptId: testMode === 'discovery_demo' ? demoScriptId : undefined,
          personaId, 
          responseSpeed, 
          testMode 
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to start session');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-trainer/sessions/${agentId}`] });
      setSelectedPersona(null);
      setSelectedScriptId('');
      setSelectedDemoScriptId('');
    },
  });

  const stopSessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const response = await fetch(`/api/ai-trainer/stop-session/${sessionId}`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to stop session');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/ai-trainer/sessions/${agentId}`] });
    },
  });

  const runningSessions = activeSessions.filter(s => s.status === 'running');
  const completedSessions = activeSessions.filter(s => s.status !== 'running').slice(0, 5);

  const isStartDisabled = (): boolean => {
    if (!selectedPersona || !selectedScriptId) return true;
    if (testMode === 'demo' && !hasDiscoveryRec) return true;
    if (testMode === 'discovery_demo' && !selectedDemoScriptId) return true;
    return false;
  };

  const handleStartTraining = () => {
    if (isStartDisabled()) return;
    startSessionMutation.mutate({
      scriptId: selectedScriptId,
      demoScriptId: selectedDemoScriptId || undefined,
      personaId: selectedPersona!.id,
      responseSpeed,
      testMode,
    });
  };

  const formatDuration = (startedAt: string) => {
    const start = new Date(startedAt);
    const now = new Date();
    const diffMs = now.getTime() - start.getTime();
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950 dark:to-indigo-950 border-purple-200 dark:border-purple-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-2xl">
              <Swords className="h-7 w-7 text-purple-600" />
              Campo di Battaglia - Test AI Automatico
            </CardTitle>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Metti alla prova il tuo script con prospect simulati dall'AI. 
              Il sistema creerà una vera conversazione con il tuo Sales Agent, come se fosse un cliente reale.
            </p>
          </CardHeader>
        </Card>
      </motion.div>

      {/* Training Setup */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Left: Setup Panel */}
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Target className="h-5 w-5 text-purple-600" />
              Configura il Test
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Script Selection with Tabs */}
            <div className="space-y-3">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                1. Seleziona lo Script {testMode === 'discovery_demo' ? 'Discovery' : 'da testare'}
                {testMode === 'discovery' && (
                  <Badge variant="outline" className="ml-2 text-xs bg-blue-50 text-blue-700 border-blue-200">
                    Solo Discovery
                  </Badge>
                )}
                {testMode === 'demo' && (
                  <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                    Solo Demo
                  </Badge>
                )}
              </label>
              
              <Tabs value={scriptSelectionTab} onValueChange={(v) => {
                setScriptSelectionTab(v as 'active' | 'all');
                setSelectedScriptId('');
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Script Attivi ({filteredActiveScripts.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex items-center gap-2">
                    <Library className="h-4 w-4" />
                    Tutti gli Script ({filteredAllScripts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-3">
                  {agentsLoading ? (
                    <div className="text-center py-4 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Caricamento...
                    </div>
                  ) : filteredActiveScripts.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {testMode === 'discovery' ? 'Nessuno script Discovery attivo' : 
                         testMode === 'demo' ? 'Nessuno script Demo attivo' : 
                         'Nessuno script Discovery attivo'}
                      </p>
                      <p className="text-xs mt-1">Attiva uno script dallo Script Manager</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {filteredActiveScripts.map((script) => (
                        <button
                          key={script.id}
                          onClick={() => setSelectedScriptId(script.id)}
                          className={`p-3 rounded-lg border-2 text-left transition-all ${
                            selectedScriptId === script.id
                              ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                              : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-green-500" />
                              <span className="font-medium">{script.name}</span>
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {script.scriptType}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="all" className="mt-3">
                  {scriptsLoading ? (
                    <div className="text-center py-4 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Caricamento...
                    </div>
                  ) : filteredAllScripts.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">
                        {testMode === 'discovery' ? 'Nessuno script Discovery disponibile' : 
                         testMode === 'demo' ? 'Nessuno script Demo disponibile' : 
                         'Nessuno script Discovery disponibile'}
                      </p>
                      <p className="text-xs mt-1">Crea uno script dallo Script Manager</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="grid gap-2 pr-4">
                        {filteredAllScripts.map((script) => {
                          const isActive = activeScripts.some(a => a.id === script.id);
                          return (
                            <button
                              key={script.id}
                              onClick={() => setSelectedScriptId(script.id)}
                              className={`p-3 rounded-lg border-2 text-left transition-all ${
                                selectedScriptId === script.id
                                  ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                                  : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isActive ? (
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                  ) : (
                                    <FileText className="h-4 w-4 text-gray-400" />
                                  )}
                                  <span className="font-medium">{script.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  {isActive && (
                                    <Badge className="bg-green-100 text-green-700 text-xs">
                                      Attivo
                                    </Badge>
                                  )}
                                  <Badge variant="outline" className="text-xs">
                                    {script.scriptType}
                                  </Badge>
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>

              {selectedScript && (
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center gap-2 text-sm">
                    <Target className="h-4 w-4 text-purple-600" />
                    <span className="text-gray-600 dark:text-gray-400">
                      {testMode === 'discovery_demo' ? 'Script Discovery:' : 'Script selezionato:'}
                    </span>
                    <span className="font-semibold text-purple-700 dark:text-purple-300">{selectedScript.name}</span>
                    <Badge variant="outline" className="text-xs">{selectedScript.scriptType}</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Second Script Selector for Discovery+Demo mode */}
            {testMode === 'discovery_demo' && (
              <div className="space-y-3">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  1b. Seleziona lo Script Demo
                  <Badge variant="outline" className="ml-2 text-xs bg-green-50 text-green-700 border-green-200">
                    Obbligatorio
                  </Badge>
                </label>
                
                <Tabs value={demoScriptSelectionTab} onValueChange={(v) => {
                  setDemoScriptSelectionTab(v as 'active' | 'all');
                  setSelectedDemoScriptId('');
                }}>
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="active" className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      Script Attivi ({filteredActiveDemoScripts.length})
                    </TabsTrigger>
                    <TabsTrigger value="all" className="flex items-center gap-2">
                      <Library className="h-4 w-4" />
                      Tutti gli Script ({filteredAllDemoScripts.length})
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="active" className="mt-3">
                    {agentsLoading ? (
                      <div className="text-center py-4 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Caricamento...
                      </div>
                    ) : filteredActiveDemoScripts.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessuno script Demo attivo</p>
                        <p className="text-xs mt-1">Attiva uno script Demo dallo Script Manager</p>
                      </div>
                    ) : (
                      <div className="grid gap-2">
                        {filteredActiveDemoScripts.map((script) => (
                          <button
                            key={script.id}
                            onClick={() => setSelectedDemoScriptId(script.id)}
                            className={`p-3 rounded-lg border-2 text-left transition-all ${
                              selectedDemoScriptId === script.id
                                ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="font-medium">{script.name}</span>
                              </div>
                              <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                {script.scriptType}
                              </Badge>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="all" className="mt-3">
                    {scriptsLoading ? (
                      <div className="text-center py-4 text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                        Caricamento...
                      </div>
                    ) : filteredAllDemoScripts.length === 0 ? (
                      <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Nessuno script Demo disponibile</p>
                        <p className="text-xs mt-1">Crea uno script Demo dallo Script Manager</p>
                      </div>
                    ) : (
                      <ScrollArea className="h-[200px]">
                        <div className="grid gap-2 pr-4">
                          {filteredAllDemoScripts.map((script) => {
                            const isActive = activeScripts.some(a => a.id === script.id);
                            return (
                              <button
                                key={script.id}
                                onClick={() => setSelectedDemoScriptId(script.id)}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  selectedDemoScriptId === script.id
                                    ? 'border-green-500 bg-green-50 dark:bg-green-950'
                                    : 'border-gray-200 dark:border-gray-700 hover:border-green-300'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    {isActive ? (
                                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    ) : (
                                      <FileText className="h-4 w-4 text-gray-400" />
                                    )}
                                    <span className="font-medium">{script.name}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {isActive && (
                                      <Badge className="bg-green-100 text-green-700 text-xs">
                                        Attivo
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-xs">
                                      {script.scriptType}
                                    </Badge>
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </ScrollArea>
                    )}
                  </TabsContent>
                </Tabs>

                {selectedDemoScript && (
                  <div className="p-3 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 text-sm">
                      <Target className="h-4 w-4 text-green-600" />
                      <span className="text-gray-600 dark:text-gray-400">Script Demo:</span>
                      <span className="font-semibold text-green-700 dark:text-green-300">{selectedDemoScript.name}</span>
                      <Badge variant="outline" className="text-xs bg-green-50 text-green-700">{selectedDemoScript.scriptType}</Badge>
                    </div>
                  </div>
                )}

                {!selectedDemoScriptId && selectedScriptId && (
                  <div className="p-2 bg-amber-50 dark:bg-amber-950 rounded-lg border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    Seleziona anche uno script Demo per la modalità Discovery + Demo
                  </div>
                )}
              </div>
            )}

            {/* Test Mode Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                2. Modalità Test
              </label>
              <div className="grid grid-cols-3 gap-2">
                {TEST_MODE_OPTIONS.map((option) => {
                  const isDisabled = option.requiresDiscoveryRec && !hasDiscoveryRec;
                  return (
                    <button
                      key={option.value}
                      onClick={() => !isDisabled && setTestMode(option.value)}
                      disabled={isDisabled}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        testMode === option.value
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                          : isDisabled
                            ? 'border-gray-200 dark:border-gray-700 opacity-50 cursor-not-allowed'
                            : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                      }`}
                    >
                      <div className="text-xl text-center mb-1">{option.icon}</div>
                      <div className="text-xs text-center font-medium">{option.label}</div>
                      <div className="text-[10px] text-center text-gray-500">{option.description}</div>
                      {isDisabled && (
                        <div className="text-[10px] text-center text-red-500 mt-1">
                          Nessun REC disponibile
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
              {testMode === 'discovery_demo' && (
                <div className="p-2 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                  <strong>Discovery + Demo:</strong> Prima completa la Discovery, poi genera automaticamente il riepilogo e passa alla Demo.
                </div>
              )}
            </div>

            {/* Persona Grid */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                3. Scegli l'Avversario (Personalità Prospect)
              </label>
              <div className="grid grid-cols-5 gap-2">
                {PROSPECT_PERSONAS.map((persona) => (
                  <button
                    key={persona.id}
                    onClick={() => setSelectedPersona(persona)}
                    className={`p-3 rounded-lg border-2 transition-all hover:scale-105 ${
                      selectedPersona?.id === persona.id
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-2xl text-center mb-1">{persona.emoji}</div>
                    <div className="text-xs text-center font-medium truncate">
                      {persona.name}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Response Speed */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                4. Velocità Risposta Prospect
              </label>
              <div className="grid grid-cols-4 gap-2">
                {RESPONSE_SPEED_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => setResponseSpeed(option.value)}
                    className={`p-2 rounded-lg border-2 transition-all ${
                      responseSpeed === option.value
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950'
                        : 'border-gray-200 dark:border-gray-700 hover:border-purple-300'
                    }`}
                  >
                    <div className="text-lg text-center">{option.icon}</div>
                    <div className="text-xs text-center font-medium">{option.label}</div>
                    <div className="text-[10px] text-center text-gray-500">{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Start Button */}
            <Button
              onClick={handleStartTraining}
              disabled={isStartDisabled() || startSessionMutation.isPending}
              className="w-full bg-purple-600 hover:bg-purple-700 text-white"
              size="lg"
            >
              {startSessionMutation.isPending ? (
                <>
                  <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                  Avvio in corso...
                </>
              ) : (
                <>
                  <Swords className="h-5 w-5 mr-2" />
                  Avvia Battaglia
                </>
              )}
            </Button>

            {startSessionMutation.isError && (
              <div className="text-red-500 text-sm flex items-center gap-2">
                <AlertCircle className="h-4 w-4" />
                {startSessionMutation.error.message}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Preview Panel */}
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Eye className="h-5 w-5 text-blue-600" />
              Anteprima
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedPersona ? (
              <div className="space-y-4">
                <div className="flex items-start gap-4">
                  <div className="text-4xl">{selectedPersona.emoji}</div>
                  <div className="flex-1">
                    <h3 className="font-bold text-lg">{selectedPersona.name}</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {selectedPersona.description}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Caratteristiche:
                  </h4>
                  <ul className="text-sm space-y-1">
                    {selectedPersona.characteristics.map((char, i) => (
                      <li key={i} className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                        <ChevronRight className="h-3 w-3" />
                        {char}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Obiezioni tipiche:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedPersona.typicalObjections.slice(0, 3).map((obj, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        "{obj}"
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                  <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                    Messaggio iniziale:
                  </h4>
                  <p className="text-sm italic text-gray-600 dark:text-gray-400">
                    "{selectedPersona.sampleOpeningMessage}"
                  </p>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Seleziona una personalità per vedere l'anteprima</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Active Sessions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="bg-white dark:bg-gray-800">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Zap className="h-5 w-5 text-green-600" />
                Battaglie in Corso
                {runningSessions.length > 0 && (
                  <Badge variant="default" className="bg-green-500 ml-2">
                    {runningSessions.length} attive
                  </Badge>
                )}
              </CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchSessions()}
                disabled={sessionsLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${sessionsLoading ? 'animate-spin' : ''}`} />
                Aggiorna
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {sessionsLoading ? (
              <div className="text-center py-8">
                <Loader2 className="h-8 w-8 mx-auto animate-spin text-purple-600" />
                <p className="mt-2 text-gray-500">Caricamento sessioni...</p>
              </div>
            ) : runningSessions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <Swords className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Nessuna battaglia in corso</p>
                <p className="text-sm">Avvia un test per vedere le sessioni attive</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <AnimatePresence>
                  {runningSessions.map((session) => (
                    <motion.div
                      key={session.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                    >
                      <Card className="border-2 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="text-2xl">{session.personaEmoji}</span>
                              <div>
                                <p className="font-semibold">{session.personaName}</p>
                                <p className="text-xs text-gray-500">{session.prospectName}</p>
                              </div>
                            </div>
                            <Badge className="bg-green-500 animate-pulse">
                              <span className="h-2 w-2 bg-white rounded-full mr-1" />
                              LIVE
                            </Badge>
                          </div>

                          <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-gray-500">Script:</span>
                              <span className="font-medium">{session.scriptName}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Durata:</span>
                              <span className="font-medium flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {formatDuration(session.startedAt)}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-gray-500">Fase:</span>
                              <Badge variant="outline">{session.currentPhase}</Badge>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-gray-500">Completamento:</span>
                              <div className="flex items-center gap-2">
                                <Progress value={session.completionRate * 100} className="w-16 h-2" />
                                <span className="font-medium">{Math.round(session.completionRate * 100)}%</span>
                              </div>
                            </div>
                          </div>

                          {session.lastMessage && (
                            <div className="mt-3 p-2 bg-white dark:bg-gray-800 rounded text-xs text-gray-600 dark:text-gray-400 italic truncate">
                              "{session.lastMessage}"
                            </div>
                          )}

                          <div className="flex gap-2 mt-4">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => setObserveSessionId(session.id)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              Osserva
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="flex-1"
                              onClick={() => stopSessionMutation.mutate(session.id)}
                              disabled={stopSessionMutation.isPending}
                            >
                              <Square className="h-4 w-4 mr-1" />
                              Stop
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Completed Sessions */}
      {completedSessions.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="bg-white dark:bg-gray-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-blue-600" />
                Battaglie Completate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="text-left p-3 text-sm font-semibold">Personalità</th>
                      <th className="text-left p-3 text-sm font-semibold">Script</th>
                      <th className="text-left p-3 text-sm font-semibold">Durata</th>
                      <th className="text-left p-3 text-sm font-semibold">Completamento</th>
                      <th className="text-left p-3 text-sm font-semibold">Ladder</th>
                      <th className="text-left p-3 text-sm font-semibold">Status</th>
                      <th className="text-right p-3 text-sm font-semibold">Azioni</th>
                    </tr>
                  </thead>
                  <tbody>
                    {completedSessions.map((session) => (
                      <tr key={session.id} className="border-b border-gray-100 dark:border-gray-800">
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <span>{session.personaEmoji}</span>
                            <span>{session.personaName}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{session.scriptName}</td>
                        <td className="p-3 text-sm">
                          {session.endedAt && formatDuration(session.startedAt)}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <Progress value={session.completionRate * 100} className="w-16 h-2" />
                            <span className="text-sm">{Math.round(session.completionRate * 100)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm">{session.ladderActivations}x</td>
                        <td className="p-3">
                          <Badge variant={session.status === 'completed' ? 'default' : 'secondary'}>
                            {session.status === 'completed' ? 'Completato' : 'Fermato'}
                          </Badge>
                        </td>
                        <td className="p-3 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setObserveSessionId(session.id)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Vedi
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Observe Modal */}
      <Dialog open={!!observeSessionId} onOpenChange={() => setObserveSessionId(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Osserva Sessione di Training
            </DialogTitle>
            <DialogDescription>
              Visualizza transcript e analisi del Sales Manager AI in tempo reale
            </DialogDescription>
          </DialogHeader>
          
          <Tabs defaultValue="conversation" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="conversation" className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Conversazione
              </TabsTrigger>
              <TabsTrigger value="manager" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                Manager AI
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="conversation" className="mt-4">
              <ScrollArea className="h-[60vh] pr-4">
                <div className="space-y-4">
                  {(() => {
                    const observedSession = activeSessions.find(s => s.id === observeSessionId);
                    const isSessionRunning = observedSession?.status === 'running';
                    
                    if (transcript.length === 0) {
                      if (isSessionRunning) {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                            <p>In attesa di messaggi...</p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="text-center py-8 text-gray-500">
                            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>Sessione terminata - nessun messaggio registrato</p>
                          </div>
                        );
                      }
                    }
                    
                    return transcript.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex ${msg.role === 'user' ? 'justify-start' : 'justify-end'}`}
                      >
                        <div
                          className={`max-w-[80%] p-3 rounded-lg ${
                            msg.role === 'user'
                              ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-100'
                              : 'bg-purple-100 dark:bg-purple-900 text-purple-900 dark:text-purple-100'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="text-xs font-semibold">
                              {msg.role === 'user' ? '🧑 Prospect AI' : '🤖 Sales Agent'}
                            </span>
                            {msg.phase && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                                {msg.phase}
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm">{msg.content}</p>
                          <div className="text-xs opacity-60 mt-1">
                            {new Date(msg.timestamp).toLocaleTimeString('it-IT')}
                          </div>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </ScrollArea>
            </TabsContent>
            
            <TabsContent value="manager" className="mt-4">
              {(() => {
                const latestAnalysis = analysisHistory[analysisHistory.length - 1];
                const observedSession = activeSessions.find(s => s.id === observeSessionId);
                
                const getArchetypeEmoji = (archetype: string | undefined) => {
                  const map: Record<string, string> = {
                    'enthusiast': '🌟', 'skeptic': '🤨', 'busy': '⚡', 
                    'price_focused': '💰', 'technical': '🔧', 'indecisive': '🤔',
                    'defensive': '🛡️', 'neutral': '😐'
                  };
                  return map[archetype || ''] || '🎭';
                };
                
                const getArchetypeLabel = (archetype: string | undefined) => {
                  const map: Record<string, string> = {
                    'enthusiast': 'Entusiasta', 'skeptic': 'Scettico', 'busy': 'Occupato',
                    'price_focused': 'Prezzo', 'technical': 'Tecnico', 'indecisive': 'Indeciso',
                    'defensive': 'Difensivo', 'neutral': 'Neutrale'
                  };
                  return map[archetype || ''] || 'In rilevamento...';
                };
                
                const getArchetypeColor = (archetype: string | undefined) => {
                  const map: Record<string, string> = {
                    'enthusiast': 'bg-green-100 text-green-700 border-green-300',
                    'skeptic': 'bg-orange-100 text-orange-700 border-orange-300',
                    'busy': 'bg-yellow-100 text-yellow-700 border-yellow-300',
                    'price_focused': 'bg-blue-100 text-blue-700 border-blue-300',
                    'technical': 'bg-purple-100 text-purple-700 border-purple-300',
                    'indecisive': 'bg-gray-100 text-gray-700 border-gray-300',
                    'defensive': 'bg-red-100 text-red-700 border-red-300',
                    'neutral': 'bg-slate-100 text-slate-700 border-slate-300'
                  };
                  return map[archetype || ''] || 'bg-gray-100 text-gray-600 border-gray-300';
                };
                
                const getSessionDuration = () => {
                  if (!observedSession?.startedAt) return '--:--';
                  const start = new Date(observedSession.startedAt).getTime();
                  const now = Date.now();
                  const diff = Math.floor((now - start) / 1000);
                  const mins = Math.floor(diff / 60);
                  const secs = diff % 60;
                  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                };
                
                const totalBuySignals = analysisHistory.reduce((acc, a) => acc + (a.buySignals?.signals?.length || 0), 0);
                const totalObjections = analysisHistory.reduce((acc, a) => acc + (a.objections?.objections?.length || 0), 0);
                const totalAdvancements = analysisHistory.filter(a => a.stepAdvancement?.shouldAdvance).length;
                const avgAnalysisTime = analysisHistory.length > 0 
                  ? Math.round(analysisHistory.reduce((acc, a) => acc + (a.analysisTimeMs || 0), 0) / analysisHistory.length)
                  : 0;
                
                return (
                  <div className="space-y-4">
                    {/* HEADER DASHBOARD */}
                    <div className="grid grid-cols-4 gap-3">
                      <div className="p-3 rounded-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/50 dark:to-purple-900/30 border border-purple-200 dark:border-purple-800">
                        <div className="text-[10px] text-purple-600 dark:text-purple-400 mb-1">🎭 ARCHETIPO</div>
                        <div className={`text-sm font-bold px-2 py-1 rounded border ${getArchetypeColor(latestAnalysis?.archetypeState?.current)}`}>
                          {getArchetypeEmoji(latestAnalysis?.archetypeState?.current)} {getArchetypeLabel(latestAnalysis?.archetypeState?.current)}
                        </div>
                        {latestAnalysis?.archetypeState?.confidence && (
                          <div className="text-[10px] text-purple-500 mt-1">
                            {Math.round(latestAnalysis.archetypeState.confidence * 100)}% confidence
                          </div>
                        )}
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border border-blue-200 dark:border-blue-800">
                        <div className="text-[10px] text-blue-600 dark:text-blue-400 mb-1">📍 FASE CORRENTE</div>
                        <div className="text-sm font-bold text-blue-700 dark:text-blue-300">
                          {latestAnalysis?.currentPhase?.name || 'Avvio...'}
                        </div>
                        <div className="text-[10px] text-blue-500 mt-1">
                          {latestAnalysis?.currentPhase?.stepName || 'In attesa'}
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border border-green-200 dark:border-green-800">
                        <div className="text-[10px] text-green-600 dark:text-green-400 mb-1">⏱️ DURATA</div>
                        <div className="text-xl font-bold text-green-700 dark:text-green-300 font-mono">
                          {getSessionDuration()}
                        </div>
                      </div>
                      
                      <div className="p-3 rounded-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/50 dark:to-amber-900/30 border border-amber-200 dark:border-amber-800">
                        <div className="text-[10px] text-amber-600 dark:text-amber-400 mb-1">💬 MESSAGGI</div>
                        <div className="text-xl font-bold text-amber-700 dark:text-amber-300">
                          {transcript.length}
                        </div>
                      </div>
                    </div>
                    
                    {/* CHECKPOINT STATUS */}
                    {latestAnalysis?.checkpointStatus && (
                      <Card className="border-l-4 border-l-orange-500">
                        <CardContent className="py-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium flex items-center gap-2">
                              ⛔ {latestAnalysis.checkpointStatus.checkpointName}
                            </span>
                            <Badge className={latestAnalysis.checkpointStatus.isComplete 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-orange-100 text-orange-700'}>
                              {latestAnalysis.checkpointStatus.isComplete 
                                ? '✓ COMPLETO' 
                                : `${latestAnalysis.checkpointStatus.missingItems?.length || 0} mancanti`}
                            </Badge>
                          </div>
                          <div className="space-y-2">
                            {latestAnalysis.checkpointStatus.itemDetails?.map((item, i) => (
                              <div key={i} className={`p-2 rounded-lg border ${
                                item.status === 'validated' 
                                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' 
                                  : item.status === 'vague'
                                    ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
                                    : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                              }`}>
                                <div className="flex items-start gap-2">
                                  <span className="text-sm">
                                    {item.status === 'validated' ? '🟢' : item.status === 'vague' ? '🟡' : '🔴'}
                                  </span>
                                  <div className="flex-1">
                                    <div className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                      {item.check}
                                    </div>
                                    {item.status !== 'validated' && item.suggestedNextAction && (
                                      <div className="mt-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 px-2 py-1 rounded">
                                        🎯 {item.suggestedNextAction}
                                      </div>
                                    )}
                                    {item.status === 'validated' && item.infoCollected && (
                                      <div className="mt-1 text-[10px] text-green-600 dark:text-green-400">
                                        ✓ {item.infoCollected}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )) || (
                              <div className="flex flex-wrap gap-2">
                                {latestAnalysis.checkpointStatus.completedItems?.map((item, i) => (
                                  <span key={`c-${i}`} className="text-xs px-2 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-full flex items-center gap-1">
                                    🟢 {item}
                                  </span>
                                ))}
                                {latestAnalysis.checkpointStatus.missingItems?.map((item, i) => (
                                  <span key={`m-${i}`} className="text-xs px-2 py-1 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 rounded-full flex items-center gap-1">
                                    🔴 {item}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* METRICHE LIVE */}
                    <div className="grid grid-cols-4 gap-2">
                      <div className="text-center p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                        <div className="text-lg font-bold text-green-600">{totalBuySignals}</div>
                        <div className="text-[10px] text-green-500">💰 Buy Signals</div>
                      </div>
                      <div className="text-center p-2 rounded bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                        <div className="text-lg font-bold text-red-600">{totalObjections}</div>
                        <div className="text-[10px] text-red-500">🛡️ Obiezioni</div>
                      </div>
                      <div className="text-center p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                        <div className="text-lg font-bold text-blue-600">{totalAdvancements}</div>
                        <div className="text-[10px] text-blue-500">🚀 Avanzamenti</div>
                      </div>
                      <div className="text-center p-2 rounded bg-gray-50 dark:bg-gray-950/30 border border-gray-200 dark:border-gray-700">
                        <div className="text-lg font-bold text-gray-600">{avgAnalysisTime}ms</div>
                        <div className="text-[10px] text-gray-500">⚡ Tempo Medio</div>
                      </div>
                    </div>
                    
                    {/* STORICO ANALISI */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <History className="h-4 w-4 text-purple-600" />
                        <span className="text-sm font-medium">Storico Analisi ({analysisHistory.length})</span>
                      </div>
                      {analysisHistory.length > 0 && (
                        <Button variant="outline" size="sm" onClick={handleExportAnalysis} className="flex items-center gap-2">
                          <Download className="h-4 w-4" />
                          Esporta
                        </Button>
                      )}
                    </div>
                    
                    <ScrollArea className="h-[35vh] pr-4">
                      {managerAnalysisLoading && analysisHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Loader2 className="h-6 w-6 mx-auto animate-spin mb-2" />
                          <p className="text-sm">Caricamento...</p>
                        </div>
                      ) : managerAnalysisError ? (
                        <div className="text-center py-8">
                          <AlertCircle className="h-8 w-8 mx-auto mb-2 text-red-500" />
                          <p className="text-sm text-red-600">Errore caricamento</p>
                        </div>
                      ) : analysisHistory.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">In attesa di analisi...</p>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {analysisHistory.map((analysis, idx) => (
                            <Card key={idx} className="border-l-4 border-l-purple-500">
                              <CardContent className="py-2 space-y-2">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-gray-500">#{idx + 1}</span>
                                    <Badge variant="outline" className="text-[10px]">
                                      {analysis.currentPhase?.name || 'N/A'}
                                    </Badge>
                                    {analysis.archetypeState?.current && (
                                      <Badge className={`text-[10px] ${getArchetypeColor(analysis.archetypeState.current)}`}>
                                        {getArchetypeEmoji(analysis.archetypeState.current)} {getArchetypeLabel(analysis.archetypeState.current)}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Badge className={analysis.stepAdvancement?.shouldAdvance 
                                      ? 'bg-green-100 text-green-700 text-[10px]' 
                                      : 'bg-red-100 text-red-700 text-[10px]'}>
                                      {analysis.stepAdvancement?.shouldAdvance ? '✓' : '✗'}
                                    </Badge>
                                    <span className="text-[10px] text-gray-400">
                                      {new Date(analysis.timestamp).toLocaleTimeString('it-IT')}
                                    </span>
                                  </div>
                                </div>
                                
                                {analysis.stepAdvancement?.reasoning && (
                                  <Collapsible>
                                    <CollapsibleTrigger className="flex items-center gap-1 text-[10px] text-blue-600 hover:text-blue-700">
                                      <Brain className="h-3 w-3" />
                                      <span>Reasoning</span>
                                    </CollapsibleTrigger>
                                    <CollapsibleContent className="mt-1">
                                      <div className="p-2 bg-blue-50 dark:bg-blue-950/30 rounded text-[10px] text-gray-600 dark:text-gray-400">
                                        {analysis.stepAdvancement.reasoning}
                                      </div>
                                    </CollapsibleContent>
                                  </Collapsible>
                                )}
                                
                                {(analysis.buySignals?.detected || analysis.objections?.detected) && (
                                  <div className="flex flex-wrap gap-1">
                                    {analysis.buySignals?.signals?.map((signal, sIdx) => (
                                      <Badge key={sIdx} className="text-[9px] bg-green-100 text-green-700">💰 {signal.type}</Badge>
                                    ))}
                                    {analysis.objections?.objections?.map((obj, oIdx) => (
                                      <Badge key={oIdx} className="text-[9px] bg-red-100 text-red-700">🛡️ {obj.type}</Badge>
                                    ))}
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                );
              })()}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
