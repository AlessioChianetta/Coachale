import React, { useState, useEffect } from 'react';
import { useBuilder } from './BuilderContext';
import { Button } from '@/components/ui/button';
import { getAuthHeaders } from '@/lib/auth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, ChevronDown, ChevronLeft, ChevronRight, FileText, Hand, Sparkles, Wand2, Building2, Target, Lightbulb } from 'lucide-react';
import type { BuilderMode, ScriptType } from './types';

interface AgentForBuilder {
  id: string;
  agentName: string;
  displayName: string | null;
  businessName: string | null;
  businessDescription: string | null;
  targetClient: string | null;
  usp: string | null;
  values: string[] | null;
  mission: string | null;
}

const MODE_CONFIG = {
  manual: {
    icon: Hand,
    label: 'Manuale',
    description: 'Costruisci da zero trascinando i blocchi',
    color: 'text-blue-600',
  },
  template: {
    icon: FileText,
    label: 'Da Template',
    description: 'Parti da un template base e personalizzalo',
    color: 'text-green-600',
  },
  ai: {
    icon: Sparkles,
    label: 'AI-Assisted',
    description: 'Genera script personalizzato con Gemini',
    color: 'text-purple-600',
  },
} as const;

const SCRIPT_TYPE_LABELS: Record<ScriptType, string> = {
  discovery: 'Discovery Call',
  demo: 'Demo Call',
  objections: 'Gestione Obiezioni',
};

export function ModeSelector() {
  const builder = useBuilder();
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showAIDialog, setShowAIDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<ScriptType>('discovery');
  
  const [aiStep, setAiStep] = useState(1);
  const [aiTemplate, setAiTemplate] = useState<ScriptType>('discovery');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [userComment, setUserComment] = useState('');
  const [agents, setAgents] = useState<AgentForBuilder[]>([]);
  const [isLoadingAgents, setIsLoadingAgents] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const currentMode = MODE_CONFIG[builder.mode];
  const CurrentIcon = currentMode.icon;

  useEffect(() => {
    if (showAIDialog && agents.length === 0) {
      setIsLoadingAgents(true);
      fetch('/api/script-builder/agents', {
        headers: getAuthHeaders(),
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to load agents');
          return res.json();
        })
        .then(data => {
          if (Array.isArray(data)) {
            setAgents(data);
            if (data.length > 0 && !selectedAgentId) {
              setSelectedAgentId(data[0].id);
            }
          }
        })
        .catch(err => {
          console.error('Error loading agents:', err);
          builder.setError('Errore nel caricamento degli agenti');
        })
        .finally(() => setIsLoadingAgents(false));
    }
  }, [showAIDialog]);

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleAIGenerate = async () => {
    if (!selectedAgentId) return;
    
    setIsGenerating(true);
    builder.setIsLoading(true);
    
    try {
      const templateId = `${aiTemplate}-base`;
      const scriptName = `${SCRIPT_TYPE_LABELS[aiTemplate]} - ${selectedAgent?.businessName || 'AI'}`;
      
      const response = await fetch('/api/script-builder/ai-generate', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId,
          agentId: selectedAgentId,
          userComment,
          scriptType: aiTemplate,
          scriptName,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.structure) {
          builder.setMode('ai');
          builder.setScriptType(aiTemplate);
          builder.setScriptName(scriptName);
          builder.loadFromStructure(data.structure);
        }
      } else {
        const error = await response.json();
        builder.setError(error.error || 'Errore nella generazione AI');
      }
    } catch (error) {
      console.error('AI generation error:', error);
      builder.setError('Errore di rete nella generazione AI');
    } finally {
      setIsGenerating(false);
      builder.setIsLoading(false);
      setShowAIDialog(false);
      setAiStep(1);
      setUserComment('');
    }
  };

  const resetAIDialog = () => {
    setAiStep(1);
    setAiTemplate('discovery');
    setUserComment('');
    setShowAIDialog(false);
  };

  const handleModeChange = (mode: BuilderMode) => {
    if (builder.isDirty) {
      if (!confirm('Hai modifiche non salvate. Cambiando modalità perderai le modifiche attuali. Continuare?')) {
        return;
      }
    }

    if (mode === 'manual') {
      builder.reset();
      builder.setMode('manual');
    } else if (mode === 'template') {
      setShowTemplateDialog(true);
    } else if (mode === 'ai') {
      setShowAIDialog(true);
    }
  };

  const handleTemplateSelect = async () => {
    builder.setIsLoading(true);
    builder.setMode('template');
    builder.setScriptType(selectedTemplate);
    builder.setScriptName(`${SCRIPT_TYPE_LABELS[selectedTemplate]} - Nuovo`);
    
    try {
      const templateId = `${selectedTemplate}-base`;
      const response = await fetch(`/api/script-builder/templates/${templateId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.structure) {
          builder.loadFromStructure(data.structure);
        }
      } else {
        builder.addPhase({ name: 'Prima Fase', description: 'Modifica questa fase o aggiungine altre' });
      }
    } catch (error) {
      console.error('Error loading template:', error);
      builder.addPhase({ name: 'Prima Fase', description: 'Modifica questa fase o aggiungine altre' });
    } finally {
      builder.setIsLoading(false);
      setShowTemplateDialog(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2">
            <CurrentIcon className={`h-4 w-4 ${currentMode.color}`} />
            {currentMode.label}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Modalità di Creazione</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(Object.entries(MODE_CONFIG) as [BuilderMode, typeof MODE_CONFIG.manual][]).map(([mode, config]) => {
            const Icon = config.icon;
            const isActive = builder.mode === mode;
            return (
              <DropdownMenuItem
                key={mode}
                onClick={() => handleModeChange(mode)}
                className="flex items-start gap-3 p-3"
              >
                <Icon className={`h-5 w-5 mt-0.5 ${config.color}`} />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{config.label}</span>
                    {isActive && <Badge variant="secondary" className="text-[10px]">Attivo</Badge>}
                  </div>
                  <p className="text-xs text-muted-foreground">{config.description}</p>
                </div>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-green-600" />
              Scegli Template Base
            </DialogTitle>
            <DialogDescription>
              Seleziona il tipo di script da cui partire. Potrai personalizzarlo completamente.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label>Tipo di Script</Label>
            <Select value={selectedTemplate} onValueChange={(v) => setSelectedTemplate(v as ScriptType)}>
              <SelectTrigger className="mt-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">
                  <div className="flex items-center gap-2">
                    <span>🔍</span>
                    <span>Discovery Call - Qualifica iniziale</span>
                  </div>
                </SelectItem>
                <SelectItem value="demo">
                  <div className="flex items-center gap-2">
                    <span>🎬</span>
                    <span>Demo Call - Presentazione offerta</span>
                  </div>
                </SelectItem>
                <SelectItem value="objections">
                  <div className="flex items-center gap-2">
                    <span>💬</span>
                    <span>Gestione Obiezioni - Risposte comuni</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>
              Annulla
            </Button>
            <Button onClick={handleTemplateSelect}>
              <FileText className="h-4 w-4 mr-2" />
              Carica Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showAIDialog} onOpenChange={(open) => { if (!open) resetAIDialog(); else setShowAIDialog(true); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generazione AI con Gemini 3.0 Pro
            </DialogTitle>
            <DialogDescription>
              {aiStep === 1 && 'Step 1/3: Scegli il tipo di script da generare'}
              {aiStep === 2 && 'Step 2/3: Seleziona l\'agente per personalizzare lo script'}
              {aiStep === 3 && 'Step 3/3: Aggiungi istruzioni aggiuntive (opzionale)'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-center gap-2 py-2">
            {[1, 2, 3].map((step) => (
              <div
                key={step}
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                  step === aiStep
                    ? 'bg-purple-600 text-white'
                    : step < aiStep
                    ? 'bg-purple-200 text-purple-700'
                    : 'bg-muted text-muted-foreground'
                }`}
              >
                {step}
              </div>
            ))}
          </div>

          {aiStep === 1 && (
            <div className="py-4 space-y-4">
              <Label>Tipo di Script</Label>
              <Select value={aiTemplate} onValueChange={(v) => setAiTemplate(v as ScriptType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="discovery">
                    <div className="flex items-center gap-2">
                      <span>🔍</span>
                      <span>Discovery Call - Qualifica iniziale</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="demo">
                    <div className="flex items-center gap-2">
                      <span>🎬</span>
                      <span>Demo Call - Presentazione offerta</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="objections">
                    <div className="flex items-center gap-2">
                      <span>💬</span>
                      <span>Gestione Obiezioni - Risposte comuni</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {aiStep === 2 && (
            <div className="py-4 space-y-4">
              {isLoadingAgents ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-purple-600" />
                  <span className="ml-2 text-muted-foreground">Caricamento agenti...</span>
                </div>
              ) : agents.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">Nessun agente configurato.</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    Crea prima un AI Sales Agent per usare la generazione AI.
                  </p>
                </div>
              ) : (
                <>
                  <Label>Seleziona Agente</Label>
                  <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Scegli un agente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {agents.map((agent) => (
                        <SelectItem key={agent.id} value={agent.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4 text-muted-foreground" />
                            <span>{agent.displayName || agent.agentName}</span>
                            {agent.businessName && (
                              <span className="text-xs text-muted-foreground">({agent.businessName})</span>
                            )}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {selectedAgent && (
                    <div className="mt-4 p-4 bg-muted/50 rounded-lg space-y-3">
                      <h4 className="font-medium text-sm flex items-center gap-2">
                        <Target className="h-4 w-4 text-purple-600" />
                        Configurazione Agente
                      </h4>
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground w-24 shrink-0">Business:</span>
                          <span>{selectedAgent.businessName || 'Non specificato'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground w-24 shrink-0">Target:</span>
                          <span>{selectedAgent.targetClient || 'Non specificato'}</span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground w-24 shrink-0">USP:</span>
                          <span className="line-clamp-2">{selectedAgent.usp || 'Non specificato'}</span>
                        </div>
                        {selectedAgent.values && selectedAgent.values.length > 0 && (
                          <div className="flex items-start gap-2">
                            <span className="text-muted-foreground w-24 shrink-0">Valori:</span>
                            <span>{selectedAgent.values.slice(0, 3).join(', ')}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {aiStep === 3 && (
            <div className="py-4 space-y-4">
              <div className="flex items-start gap-2 text-sm text-muted-foreground bg-purple-50 dark:bg-purple-950/30 p-3 rounded-lg">
                <Lightbulb className="h-4 w-4 mt-0.5 text-purple-600" />
                <p>
                  L'AI utilizzerà le informazioni dell'agente per personalizzare le domande.
                  Puoi aggiungere istruzioni specifiche qui sotto.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Istruzioni aggiuntive (opzionale)</Label>
                <Textarea
                  value={userComment}
                  onChange={(e) => setUserComment(e.target.value)}
                  placeholder="Es: Focalizzati sui pain point legati ai costi, usa un tono più informale..."
                  className="min-h-[100px]"
                />
              </div>
              <div className="p-3 bg-muted rounded-lg">
                <h4 className="font-medium text-sm mb-2">Riepilogo generazione:</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Tipo: {SCRIPT_TYPE_LABELS[aiTemplate]}</li>
                  <li>• Agente: {selectedAgent?.displayName || selectedAgent?.agentName}</li>
                  <li>• Business: {selectedAgent?.businessName}</li>
                  <li>• Modello AI: Gemini 3.0 Pro (Vertex AI)</li>
                </ul>
              </div>
            </div>
          )}

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div>
              {aiStep > 1 && (
                <Button variant="outline" onClick={() => setAiStep(aiStep - 1)} disabled={isGenerating}>
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Indietro
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetAIDialog} disabled={isGenerating}>
                Annulla
              </Button>
              {aiStep < 3 ? (
                <Button
                  onClick={() => setAiStep(aiStep + 1)}
                  disabled={aiStep === 2 && (!selectedAgentId || agents.length === 0)}
                >
                  Avanti
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleAIGenerate} disabled={isGenerating || !selectedAgentId}>
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Genera Script
                    </>
                  )}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
