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
  Users,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
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
}

export function AITrainerTab({ agentId }: AITrainerTabProps) {
  const [selectedPersona, setSelectedPersona] = useState<ProspectPersona | null>(null);
  const [selectedScriptId, setSelectedScriptId] = useState<string>('');
  const [observeSessionId, setObserveSessionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data: scripts = [], isLoading: scriptsLoading } = useQuery<SalesScript[]>({
    queryKey: [`/api/sales-scripts/${agentId}`],
    queryFn: async () => {
      const response = await fetch(`/api/sales-scripts/${agentId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch scripts');
      return response.json();
    },
  });

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

  const startSessionMutation = useMutation({
    mutationFn: async ({ scriptId, personaId }: { scriptId: string; personaId: string }) => {
      const response = await fetch('/api/ai-trainer/start-session', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ agentId, scriptId, personaId }),
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

  const selectedScript = scripts.find(s => s.id === selectedScriptId);

  const handleStartTraining = () => {
    if (!selectedPersona || !selectedScriptId) return;
    startSessionMutation.mutate({
      scriptId: selectedScriptId,
      personaId: selectedPersona.id,
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
            {/* Script Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                1. Seleziona lo Script da testare
              </label>
              <Select value={selectedScriptId} onValueChange={setSelectedScriptId}>
                <SelectTrigger>
                  <SelectValue placeholder="Scegli uno script..." />
                </SelectTrigger>
                <SelectContent>
                  {scriptsLoading ? (
                    <SelectItem value="loading" disabled>Caricamento...</SelectItem>
                  ) : scripts.length === 0 ? (
                    <SelectItem value="none" disabled>Nessuno script disponibile</SelectItem>
                  ) : (
                    scripts.map((script) => (
                      <SelectItem key={script.id} value={script.id}>
                        <div className="flex items-center gap-2">
                          <span>{script.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {script.scriptType}
                          </Badge>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
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
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              Osserva Conversazione
            </DialogTitle>
            <DialogDescription>
              Transcript in tempo reale della conversazione tra AI Prospect e Sales Agent
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[60vh] pr-4">
            <div className="space-y-4">
              {transcript.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Loader2 className="h-8 w-8 mx-auto animate-spin mb-2" />
                  <p>In attesa di messaggi...</p>
                </div>
              ) : (
                transcript.map((msg, i) => (
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
                      <div className="text-xs font-semibold mb-1">
                        {msg.role === 'user' ? '🧑 Prospect AI' : '🤖 Sales Agent'}
                      </div>
                      <p className="text-sm">{msg.content}</p>
                      <div className="text-xs opacity-60 mt-1">
                        {new Date(msg.timestamp).toLocaleTimeString('it-IT')}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
