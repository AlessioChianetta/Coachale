/**
 * Training File Upload Component
 * Drag-and-drop upload for training documents (PDF, DOCX, TXT)
 * AI-powered analysis with Gemini 2.5 Pro
 * Displays prioritized improvement suggestions
 */

import { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useMutation, useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Upload,
  FileText,
  CheckCircle,
  XCircle,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Loader2,
  File,
  X,
  ArrowRight,
  Brain,
  Zap,
  Target,
  Map,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { getAuthHeaders } from '@/lib/auth';
import { formatDistanceToNow } from 'date-fns';
import { it } from 'date-fns/locale';

interface TrainingFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  error?: string;
}

interface TrainingImprovement {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
  title: string;
  problem: string;
  evidence: string[];
  currentScript: string | null;
  suggestedScript: string;
  reasoning: string;
  estimatedImpact: number;
  effort: 'low' | 'medium' | 'high';
  sourceFile: string;
}

// All Conversations Analysis Result
interface AllConversationsAnalysisResult {
  mode: 'all_conversations';
  improvements: TrainingImprovement[];
  analyzedFiles: Array<{
    filename: string;
    status: 'success' | 'error';
    error?: string;
  }>;
  conversationsAnalyzed: number;
  totalImprovements: number;
  criticalImprovements: number;
  highImprovements: number;
  analyzedAt: string;
}

// Single Conversation Analysis Result
interface SingleConversationAnalysisResult {
  mode: 'single_conversation';
  conversationId: string;
  insights: Array<{ category: string; text: string; priority: string }>;
  problems: Array<{
    severity: string;
    title?: string;
    category?: string;
    description?: string;
    text?: string;
    evidence?: string;
  }>;
  suggestions: Array<{ category: string; text: string; impact: string }>;
  strengths: Array<{ category: string; text: string }>;
  score: {
    overall: number;
    phaseProgression?: number;
    questionQuality?: number;
    ladderEffectiveness?: number;
    checkpointCompletion?: number;
  };
  analyzedAt: string;
  analyzedFiles: string[];
}

// Union type for both analysis modes
type TrainingAnalysisResult = AllConversationsAnalysisResult | SingleConversationAnalysisResult;

interface TrainingFileUploadProps {
  agentId: string;
  preselectedConversationId?: string;
  onConversationPreselected?: () => void;
}

export function TrainingFileUpload({ 
  agentId,
  preselectedConversationId = '',
  onConversationPreselected,
}: TrainingFileUploadProps) {
  const [files, setFiles] = useState<TrainingFile[]>([]);
  const [analysisResult, setAnalysisResult] = useState<TrainingAnalysisResult | null>(null);
  
  // NEW: Configuration state
  const [includeFiles, setIncludeFiles] = useState(true);
  const [analysisMode, setAnalysisMode] = useState<'all_conversations' | 'single_conversation'>('all_conversations');
  const [selectedConversationId, setSelectedConversationId] = useState<string>('');
  
  // Reset analysis result when mode changes to prevent stale data
  useEffect(() => {
    setAnalysisResult(null);
  }, [analysisMode]);

  // Load conversations for dropdown
  const { data: conversations = [], isLoading: conversationsLoading } = useQuery({
    queryKey: [`/api/training/conversations/${agentId}`],
    enabled: analysisMode === 'single_conversation',
  });
  
  // Effect to handle preselected conversation
  useEffect(() => {
    if (preselectedConversationId) {
      setAnalysisMode('single_conversation');
      setSelectedConversationId(preselectedConversationId);
      onConversationPreselected?.();
    }
  }, [preselectedConversationId, onConversationPreselected]);

  // Upload and analyze mutation (ENHANCED)
  const analyzeMutation = useMutation({
    mutationFn: async () => {
      const formData = new FormData();
      formData.append('agentId', agentId);
      formData.append('mode', analysisMode);
      
      if (analysisMode === 'single_conversation') {
        if (!selectedConversationId) {
          throw new Error('Seleziona una conversazione');
        }
        formData.append('conversationId', selectedConversationId);
      }
      
      // Add files only if includeFiles is true
      if (includeFiles) {
        files.forEach(f => {
          formData.append('files', f.file);
        });
      }

      const response = await fetch('/api/training/analyze', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Analysis failed');
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAnalysisResult(data);
      if (includeFiles) {
        setFiles([]);
      }
    },
  });

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'application/pdf': ['.pdf'],
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
      'text/plain': ['.txt'],
    },
    maxSize: 10 * 1024 * 1024, // 10MB
    onDrop: (acceptedFiles) => {
      const newFiles = acceptedFiles.map(file => ({
        file,
        id: `${Date.now()}_${Math.random()}`,
        status: 'pending' as const,
      }));
      setFiles(prev => [...prev, ...newFiles]);
    },
  });

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const handleAnalyze = () => {
    analyzeMutation.mutate();
  };
  
  // Check if selected conversation already has AI analysis
  // FIX: Use 'id' consistently (not 'conversationId') for lookup
  const selectedConv = conversations.find((c: any) => c.id === selectedConversationId);
  const hasExistingAnalysis = selectedConv?.aiAnalysisResult;
  const existingAnalysisDate = hasExistingAnalysis 
    ? new Date(selectedConv.aiAnalysisResult.analyzedAt) 
    : null;
  
  // Validation: can analyze?
  const canAnalyze = () => {
    if (analysisMode === 'all_conversations') {
      // All conversations mode REQUIRES files
      return includeFiles && files.length > 0;
    } else {
      // Single conversation mode requires conversation selection
      // and optionally files
      if (!selectedConversationId) return false;
      if (includeFiles && files.length === 0) return false;
      return true;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'destructive';
      case 'high': return 'default';
      case 'medium': return 'secondary';
      case 'low': return 'outline';
      default: return 'outline';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'critical': return <AlertCircle className="h-4 w-4" />;
      case 'high': return <TrendingUp className="h-4 w-4" />;
      default: return <Target className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Configuration Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Gemini 2.5 Pro Training Assistant</CardTitle>
          </div>
          <CardDescription>
            Analizza conversazioni con Gemini 2.5 Pro per ricevere suggerimenti automatici
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* File Toggle */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
            <div className="space-y-0.5">
              <Label className="text-base font-medium">Includi File di Training</Label>
              <p className="text-sm text-gray-500">
                Carica documenti (PDF, DOCX, TXT) per confrontarli con le conversazioni
              </p>
            </div>
            <Switch
              checked={includeFiles}
              onCheckedChange={setIncludeFiles}
              disabled={analyzeMutation.isPending}
            />
          </div>

          {/* Analysis Scope Selector */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Scope Analisi</Label>
            <RadioGroup
              value={analysisMode}
              onValueChange={(value) => {
                setAnalysisMode(value as any);
                setSelectedConversationId('');
              }}
              disabled={analyzeMutation.isPending}
              className="space-y-3"
            >
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <RadioGroupItem value="all_conversations" id="all" />
                <Label htmlFor="all" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Tutte le Conversazioni</p>
                    <p className="text-sm text-gray-500">
                      Analizza pattern generali su tutte le conversazioni dell'agente
                    </p>
                  </div>
                </Label>
              </div>
              
              <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                <RadioGroupItem value="single_conversation" id="single" />
                <Label htmlFor="single" className="flex-1 cursor-pointer">
                  <div>
                    <p className="font-medium">Conversazione Specifica</p>
                    <p className="text-sm text-gray-500">
                      Analizza performance di una singola conversazione
                    </p>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* Conversation Selector (shown only for single conversation mode) */}
          {analysisMode === 'single_conversation' && (
            <div className="space-y-3">
              <Label className="text-base font-medium">Seleziona Conversazione</Label>
              {conversationsLoading ? (
                <div className="text-sm text-gray-500">Caricamento conversazioni...</div>
              ) : conversations.length === 0 ? (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nessuna conversazione disponibile per questo agente
                  </AlertDescription>
                </Alert>
              ) : (
                <Select
                  value={selectedConversationId}
                  onValueChange={setSelectedConversationId}
                  disabled={analyzeMutation.isPending}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una conversazione" />
                  </SelectTrigger>
                  <SelectContent>
                    {conversations.map((conv: any) => {
                      const prospectName = conv.prospectName || 'Anonimo';
                      const conversationDate = conv.createdAt 
                        ? formatDistanceToNow(new Date(conv.createdAt), { addSuffix: true, locale: it })
                        : 'Data sconosciuta';
                      
                      return (
                        <SelectItem key={conv.id} value={conv.id}>
                          <div className="flex items-center justify-between gap-4 w-full">
                            <span className="font-medium">
                              {prospectName}
                            </span>
                            <span className="text-xs text-gray-500">
                              {conv.currentPhase} • {conversationDate}
                            </span>
                            {conv.aiAnalysisResult && (
                              <Badge variant="outline" className="text-xs">
                                ✓ Analizzata
                              </Badge>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              )}
              
              {/* Show existing analysis info */}
              {hasExistingAnalysis && (
                <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800 dark:text-green-200">
                    Questa conversazione è già stata analizzata il {existingAnalysisDate?.toLocaleDateString('it-IT')}. 
                    Puoi rigenerarla per aggiornare l'analisi.
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Dropzone (shown only if includeFiles is true) */}
          {includeFiles && (
            <>
              <div className="space-y-3">
                <Label className="text-base font-medium">
                  File di Training {analysisMode === 'all_conversations' ? '(Obbligatori)' : '(Opzionali)'}
                </Label>
                <div
                  {...getRootProps()}
                  className={`
                    border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
                    ${isDragActive ? 'border-primary bg-primary/5' : 'border-gray-300 hover:border-primary'}
                  `}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  {isDragActive ? (
                    <p className="text-primary font-medium">Rilascia i file qui...</p>
                  ) : (
                    <>
                      <p className="text-gray-700 font-medium mb-2">
                        Trascina file qui o clicca per selezionare
                      </p>
                      <p className="text-sm text-gray-500">
                        PDF, DOCX, TXT (max 10MB per file)
                      </p>
                    </>
                  )}
                </div>

                {/* File List */}
                {files.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-700">File caricati ({files.length})</h4>
                    {files.map(({ file, id, status, error }) => (
                      <div
                        key={id}
                        className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border"
                      >
                        <FileText className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-xs text-gray-500">
                            {(file.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(id)}
                          disabled={analyzeMutation.isPending}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Analyze Button */}
          <Button
            onClick={handleAnalyze}
            disabled={!canAnalyze() || analyzeMutation.isPending}
            className="w-full"
            size="lg"
          >
            {analyzeMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisi in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                {hasExistingAnalysis ? 'Rigenera Analisi AI' : 'Analizza con Gemini 2.5 Pro'}
              </>
            )}
          </Button>

          {/* Error Display */}
          {analyzeMutation.isError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {analyzeMutation.error?.message || 'Errore durante l\'analisi'}
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Analysis Results */}
      {analysisResult && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4"
        >
          {/* Context Banner for Single Conversation */}
          {analysisMode === 'single_conversation' && analysisResult && selectedConv && (
            <Alert className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
              <Map className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <strong>Analisi per conversazione:</strong> {selectedConv.prospectName || 'Anonimo'}
                    <span className="ml-2 text-sm">
                      (Fase: {selectedConv.currentPhase})
                    </span>
                  </div>
                  <Badge variant="outline" className="bg-blue-100 text-blue-800">
                    Salvata nella conversazione
                  </Badge>
                </div>
              </AlertDescription>
            </Alert>
          )}
          
          {/* Summary Stats - Conditional based on analysis mode */}
          {analysisResult.mode === 'all_conversations' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Suggerimenti Totali</p>
                      <p className="text-2xl font-bold">{analysisResult.totalImprovements}</p>
                    </div>
                    <Sparkles className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Critici</p>
                      <p className="text-2xl font-bold text-red-600">
                        {analysisResult.criticalImprovements}
                      </p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Alta Priorità</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {analysisResult.highImprovements}
                      </p>
                    </div>
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Conversazioni</p>
                      <p className="text-2xl font-bold">{analysisResult.conversationsAnalyzed}</p>
                    </div>
                    <Brain className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : analysisResult.mode === 'single_conversation' ? (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Score Complessivo</p>
                      <p className="text-2xl font-bold">{analysisResult.score.overall || 0}/100</p>
                    </div>
                    <Target className="h-8 w-8 text-primary" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Insights</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {analysisResult.insights?.length || 0}
                      </p>
                    </div>
                    <CheckCircle className="h-8 w-8 text-blue-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Problemi</p>
                      <p className="text-2xl font-bold text-red-600">
                        {analysisResult.problems?.length || 0}
                      </p>
                    </div>
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500">Suggerimenti</p>
                      <p className="text-2xl font-bold text-yellow-600">
                        {analysisResult.suggestions?.length || 0}
                      </p>
                    </div>
                    <Sparkles className="h-8 w-8 text-yellow-600" />
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {/* Improvements List - ALL CONVERSATIONS MODE */}
          {analysisResult.mode === 'all_conversations' && (
            <Card>
              <CardHeader>
                <CardTitle>Suggerimenti di Miglioramento</CardTitle>
                <CardDescription>
                  Analisi AI basata su {analysisResult.analyzedFiles?.length || 0} documenti e {analysisResult.conversationsAnalyzed} conversazioni
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Accordion type="single" collapsible className="space-y-2">
                  {analysisResult.improvements.map((improvement, index) => (
                  <AccordionItem
                    key={improvement.id}
                    value={improvement.id}
                    className="border rounded-lg px-4"
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-start gap-3 flex-1 text-left">
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {getPriorityIcon(improvement.priority)}
                          <span className="font-bold text-gray-400">#{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold">{improvement.title}</h4>
                            <Badge variant={getPriorityColor(improvement.priority)}>
                              {improvement.priority.toUpperCase()}
                            </Badge>
                            <Badge variant="outline">{improvement.category}</Badge>
                          </div>
                          <p className="text-sm text-gray-600">{improvement.problem}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                            <span className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              +{improvement.estimatedImpact}% impact
                            </span>
                            <span className="flex items-center gap-1">
                              <Zap className="h-3 w-3" />
                              {improvement.effort} effort
                            </span>
                            <span>📄 {improvement.sourceFile}</span>
                          </div>
                        </div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="pt-4 space-y-4">
                      {/* Reasoning */}
                      <div>
                        <h5 className="font-medium text-sm mb-2">💡 Perché è importante:</h5>
                        <p className="text-sm text-gray-700">{improvement.reasoning}</p>
                      </div>

                      {/* Evidence */}
                      <div>
                        <h5 className="font-medium text-sm mb-2">📊 Evidenze:</h5>
                        <ul className="space-y-1">
                          {improvement.evidence.map((evidence, idx) => (
                            <li key={idx} className="text-sm text-gray-600 pl-4 border-l-2 border-gray-300">
                              {evidence}
                            </li>
                          ))}
                        </ul>
                      </div>

                      {/* Current vs Suggested Script */}
                      {improvement.currentScript && (
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <h5 className="font-medium text-sm mb-2 text-red-700">❌ Script Attuale:</h5>
                            <pre className="text-xs bg-red-50 border border-red-200 p-3 rounded overflow-x-auto">
                              {improvement.currentScript}
                            </pre>
                          </div>
                          <div>
                            <h5 className="font-medium text-sm mb-2 text-green-700">✅ Script Suggerito:</h5>
                            <pre className="text-xs bg-green-50 border border-green-200 p-3 rounded overflow-x-auto">
                              {improvement.suggestedScript}
                            </pre>
                          </div>
                        </div>
                      )}

                      {!improvement.currentScript && (
                        <div>
                          <h5 className="font-medium text-sm mb-2 text-green-700">✅ Script Suggerito:</h5>
                          <pre className="text-xs bg-green-50 border border-green-200 p-3 rounded overflow-x-auto">
                            {improvement.suggestedScript}
                          </pre>
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="default">
                          Applica
                        </Button>
                        <Button size="sm" variant="outline">
                          Modifica
                        </Button>
                        <Button size="sm" variant="ghost">
                          Ignora
                        </Button>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>
          )}

          {/* Analysis Results - SINGLE CONVERSATION MODE */}
          {analysisResult.mode === 'single_conversation' && (
            <Alert className="bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                <strong>✅ Analisi salvata con successo!</strong> I risultati sono stati salvati nella conversazione e appariranno nel tab "Gemini Analytics" quando visualizzi questa conversazione specifica.
              </AlertDescription>
            </Alert>
          )}
        </motion.div>
      )}
    </div>
  );
}
