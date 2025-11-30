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
  analysisTimeMs: number;
}

type ResponseSpeed = 'fast' | 'normal' | 'slow' | 'disabled';

const RESPONSE_SPEED_OPTIONS: { value: ResponseSpeed; label: string; description: string; icon: string }[] = [
  { value: 'fast', label: 'Veloce', description: '~1 sec', icon: '⚡' },
  { value: 'normal', label: 'Normale', description: '2-3 sec', icon: '🎯' },
  { value: 'slow', label: 'Lento', description: '4-6 sec', icon: '🐢' },
  { value: 'disabled', label: 'Disabilitato', description: 'Manuale', icon: '⏸️' },
];

export function AITrainerTab({ agentId }: AITrainerTabProps) {
  const [selectedPersona, setSelectedPersona] = useState<ProspectPersona | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [scriptSelectionTab, setScriptSelectionTab] = useState<'active' | 'all'>('active');
  const [observeSessionId, setObserveSessionId] = useState<string | null>(null);
  const [responseSpeed, setResponseSpeed] = useState<ResponseSpeed>('normal');
  const queryClient = useQueryClient();

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

  const selectedScript = selectedScriptId 
    ? (activeScripts.find(s => s.id === selectedScriptId) || allScripts.find(s => s.id === selectedScriptId))
    : null;

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

  const { data: managerAnalysis, isLoading: managerAnalysisLoading, isError: managerAnalysisError } = useQuery<SalesManagerAnalysisData | null>({
    queryKey: [`/api/ai-trainer/session/${observeSessionId}/manager-analysis`],
    queryFn: async () => {
      if (!observeSessionId) return null;
      const response = await fetch(`/api/ai-trainer/session/${observeSessionId}/manager-analysis`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return data;
    },
    enabled: !!observeSessionId,
    refetchInterval: observeSessionId ? 3000 : false,
  });

  const startSessionMutation = useMutation({
    mutationFn: async ({ scriptId, personaId, responseSpeed }: { scriptId: string; personaId: string; responseSpeed: ResponseSpeed }) => {
      const response = await fetch('/api/ai-trainer/start-session', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, scriptId, personaId, responseSpeed }),
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

  const handleStartTraining = () => {
    if (!selectedPersona || !selectedScriptId) return;
    startSessionMutation.mutate({
      scriptId: selectedScriptId,
      personaId: selectedPersona.id,
      responseSpeed,
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
                1. Seleziona lo Script da testare
              </label>
              
              <Tabs value={scriptSelectionTab} onValueChange={(v) => {
                setScriptSelectionTab(v as 'active' | 'all');
                setSelectedScriptId('');
              }}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="active" className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    Script Attivi ({activeScripts.length})
                  </TabsTrigger>
                  <TabsTrigger value="all" className="flex items-center gap-2">
                    <Library className="h-4 w-4" />
                    Tutti gli Script ({allScripts.length})
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="active" className="mt-3">
                  {agentsLoading ? (
                    <div className="text-center py-4 text-gray-500">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2" />
                      Caricamento...
                    </div>
                  ) : activeScripts.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nessuno script attivato per questo agente</p>
                      <p className="text-xs mt-1">Attiva uno script dallo Script Manager</p>
                    </div>
                  ) : (
                    <div className="grid gap-2">
                      {activeScripts.map((script) => (
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
                  ) : allScripts.length === 0 ? (
                    <div className="text-center py-6 text-gray-500 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nessuno script disponibile</p>
                      <p className="text-xs mt-1">Crea uno script dallo Script Manager</p>
                    </div>
                  ) : (
                    <ScrollArea className="h-[200px]">
                      <div className="grid gap-2 pr-4">
                        {allScripts.map((script) => {
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
                    <span className="text-gray-600 dark:text-gray-400">Script selezionato:</span>
                    <span className="font-semibold text-purple-700 dark:text-purple-300">{selectedScript.name}</span>
                    <Badge variant="outline" className="text-xs">{selectedScript.scriptType}</Badge>
                  </div>
                </div>
              )}
            </div>

            {/* Persona Grid */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                2. Scegli l'Avversario (Personalità Prospect)
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
                3. Velocità Risposta Prospect
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
              disabled={!selectedPersona || !selectedScriptId || startSessionMutation.isPending}
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
              <ScrollArea className="h-[60vh] pr-4">
                {managerAnalysisLoading ? (
                  <div className="text-center py-12 text-gray-500">
                    <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                    <p>Caricamento analisi Manager...</p>
                  </div>
                ) : managerAnalysisError ? (
                  <div className="text-center py-12">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-500" />
                    <p className="text-red-600 dark:text-red-400">Impossibile caricare l'analisi del Manager</p>
                  </div>
                ) : !managerAnalysis ? (
                  <div className="text-center py-12 text-gray-500">
                    <Brain className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nessuna analisi disponibile ancora</p>
                    <p className="text-sm mt-2">L'analisi apparirà dopo il primo scambio di messaggi</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Current State - Always Visible */}
                    <Card className="border-2 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Target className="h-4 w-4 text-purple-600" />
                          Stato Corrente
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Fase / Step:</span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{managerAnalysis.currentPhase?.name || 'N/A'}</Badge>
                            <ChevronRight className="h-3 w-3 text-gray-400" />
                            <Badge variant="secondary">{managerAnalysis.currentPhase?.stepName || 'N/A'}</Badge>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Confidence:</span>
                          <div className="flex items-center gap-2">
                            <Progress value={(managerAnalysis.stepAdvancement?.confidence || 0) * 100} className="w-24 h-2" />
                            <span className="text-sm font-medium">{Math.round((managerAnalysis.stepAdvancement?.confidence || 0) * 100)}%</span>
                          </div>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-600 dark:text-gray-400">Avanzamento:</span>
                          <Badge className={managerAnalysis.stepAdvancement?.shouldAdvance 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                            : 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300'
                          }>
                            {managerAnalysis.stepAdvancement?.shouldAdvance ? '✓ Pronto' : '✗ Non Pronto'}
                          </Badge>
                        </div>
                        <div className="text-xs text-gray-500 text-right">
                          Analisi in {managerAnalysis.analysisTimeMs}ms
                        </div>
                      </CardContent>
                    </Card>

                    {/* Reasoning Section */}
                    <Collapsible defaultOpen>
                      <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                        <div className="flex items-center gap-2">
                          <Brain className="h-4 w-4 text-blue-600" />
                          <span className="font-medium text-sm">Reasoning</span>
                        </div>
                        <ChevronDown className="h-4 w-4 text-gray-500 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2">
                        <Card className="bg-blue-50/50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800">
                          <CardContent className="pt-4">
                            <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                              {managerAnalysis.stepAdvancement?.reasoning || 'Nessun reasoning disponibile'}
                            </p>
                          </CardContent>
                        </Card>
                      </CollapsibleContent>
                    </Collapsible>

                    {/* Checkpoint Status */}
                    {managerAnalysis.checkpointStatus && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="h-4 w-4 text-orange-600" />
                            <span className="font-medium text-sm">Checkpoint: {managerAnalysis.checkpointStatus.checkpointName}</span>
                          </div>
                          <Badge className={managerAnalysis.checkpointStatus.isComplete 
                            ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' 
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300'
                          }>
                            {managerAnalysis.checkpointStatus.isComplete ? 'Completo' : 'Incompleto'}
                          </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <Card className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                            <CardContent className="pt-4 space-y-3">
                              {managerAnalysis.checkpointStatus.completedItems?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2">Completati:</p>
                                  <div className="space-y-1">
                                    {managerAnalysis.checkpointStatus.completedItems.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-sm">
                                        <CheckCircle className="h-3 w-3 text-green-500" />
                                        <span className="text-gray-700 dark:text-gray-300">{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {managerAnalysis.checkpointStatus.missingItems?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2">Mancanti:</p>
                                  <div className="space-y-1">
                                    {managerAnalysis.checkpointStatus.missingItems.map((item, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-sm">
                                        <XCircle className="h-3 w-3 text-red-500" />
                                        <span className="text-gray-700 dark:text-gray-300">{item}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Feedback for Agent */}
                    {managerAnalysis.feedbackForAgent?.shouldInject && (
                      <Collapsible defaultOpen>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            <span className="font-medium text-sm">Feedback per Agent</span>
                          </div>
                          <Badge className={
                            managerAnalysis.feedbackForAgent.priority === 'critical' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                            managerAnalysis.feedbackForAgent.priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300' :
                            managerAnalysis.feedbackForAgent.priority === 'medium' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                            'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                          }>
                            {managerAnalysis.feedbackForAgent.priority}
                          </Badge>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <Card className="bg-amber-50/50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800">
                            <CardContent className="pt-4 space-y-3">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Tipo:</span>
                                <Badge variant="outline">{managerAnalysis.feedbackForAgent.type}</Badge>
                              </div>
                              <p className="text-sm text-gray-700 dark:text-gray-300">
                                {managerAnalysis.feedbackForAgent.message}
                              </p>
                              {managerAnalysis.feedbackForAgent.toneReminder && (
                                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded text-xs text-amber-800 dark:text-amber-200">
                                  <Volume2 className="h-3 w-3 inline mr-1" />
                                  {managerAnalysis.feedbackForAgent.toneReminder}
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                    )}

                    {/* Detected Signals */}
                    {(managerAnalysis.buySignals?.detected || managerAnalysis.objections?.detected || managerAnalysis.toneAnalysis?.issues?.length > 0) && (
                      <Collapsible>
                        <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                          <div className="flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-teal-600" />
                            <span className="font-medium text-sm">Segnali Rilevati</span>
                          </div>
                          <div className="flex items-center gap-1">
                            {managerAnalysis.buySignals?.detected && (
                              <Badge className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300 text-xs">
                                {managerAnalysis.buySignals.signals?.length || 0} buy
                              </Badge>
                            )}
                            {managerAnalysis.objections?.detected && (
                              <Badge className="bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300 text-xs">
                                {managerAnalysis.objections.objections?.length || 0} obiezioni
                              </Badge>
                            )}
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-2">
                          <Card className="bg-teal-50/50 dark:bg-teal-950/20 border-teal-200 dark:border-teal-800">
                            <CardContent className="pt-4 space-y-4">
                              {/* Buy Signals */}
                              {managerAnalysis.buySignals?.signals?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-2 flex items-center gap-1">
                                    <ShoppingCart className="h-3 w-3" /> Buy Signals:
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    {managerAnalysis.buySignals.signals.map((signal, idx) => (
                                      <Badge key={idx} className="bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" title={signal.phrase}>
                                        {signal.type} ({Math.round(signal.confidence * 100)}%)
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Objections */}
                              {managerAnalysis.objections?.objections?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-2 flex items-center gap-1">
                                    <AlertTriangle className="h-3 w-3" /> Obiezioni:
                                  </p>
                                  <div className="space-y-1">
                                    {managerAnalysis.objections.objections.map((obj, idx) => (
                                      <div key={idx} className="flex items-start gap-2 text-sm">
                                        <Badge variant="destructive" className="text-xs">{obj.type}</Badge>
                                        <span className="text-gray-600 dark:text-gray-400 text-xs italic">"{obj.phrase}"</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {/* Tone Issues */}
                              {managerAnalysis.toneAnalysis?.issues?.length > 0 && (
                                <div>
                                  <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-2 flex items-center gap-1">
                                    <Volume2 className="h-3 w-3" /> Problemi di Tono:
                                  </p>
                                  <div className="space-y-1">
                                    {managerAnalysis.toneAnalysis.issues.map((issue, idx) => (
                                      <div key={idx} className="flex items-center gap-2 text-sm">
                                        <AlertCircle className="h-3 w-3 text-amber-500" />
                                        <span className="text-gray-700 dark:text-gray-300">{issue}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        </CollapsibleContent>
                      </Collapsible>
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </div>
  );
}
