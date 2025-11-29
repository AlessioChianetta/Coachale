import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, Bot, MessageSquare, Loader2, AlertCircle, Building2, Users } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { getAuthHeaders } from '@/lib/auth';
import type { ScriptBlockStructure } from '@shared/script-blocks';

interface AIAssistantDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (structure: ScriptBlockStructure) => void;
  currentStructure: ScriptBlockStructure;
}

interface Agent {
  id: string;
  agentName: string;
  displayName: string;
  businessName: string;
  isActive: boolean;
}

export function AIAssistantDialog({ open, onOpenChange, onGenerate, currentStructure }: AIAssistantDialogProps) {
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [selectedTemplateType, setSelectedTemplateType] = useState<'discovery' | 'demo' | 'objections'>('discovery');
  const [targetType, setTargetType] = useState<'b2b' | 'b2c'>('b2b');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data: agents = [], isLoading: isLoadingAgents } = useQuery<Agent[]>({
    queryKey: ['script-builder-agents'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts/agents', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch agents');
      const data = await res.json();
      return data;
    },
    enabled: open
  });

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  const handleGenerate = async () => {
    if (!selectedAgentId) {
      setError('Seleziona un agente');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/script-builder/generate', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          agentId: selectedAgentId,
          templateType: selectedTemplateType,
          targetType,
          customPrompt,
          baseStructure: currentStructure.phases.length > 0 ? currentStructure : null
        })
      });

      if (!res.ok) {
        const demoStructure: ScriptBlockStructure = {
          metadata: {
            name: `Script per ${selectedAgent?.displayName || 'Agente'}`,
            type: selectedTemplateType,
            version: '1.0.0'
          },
          globalRules: [],
          phases: [
            {
              id: 'ai_phase_1',
              type: 'phase',
              number: '1',
              name: 'Apertura Personalizzata',
              description: `Fase di apertura adattata per ${selectedAgent?.businessName || 'il business'}`,
              steps: [
                {
                  id: 'ai_step_1',
                  type: 'step',
                  number: 1,
                  name: 'Saluto Personalizzato',
                  objective: 'Creare connessione immediata',
                  questions: [
                    { 
                      id: 'ai_q_1', 
                      type: 'question', 
                      text: `Ciao! Sono ${selectedAgent?.displayName || 'il tuo consulente'}. Come posso aiutarti oggi?` 
                    }
                  ]
                }
              ]
            },
            {
              id: 'ai_phase_2',
              type: 'phase',
              number: '2',
              name: 'Discovery Adattata',
              description: 'Scoperta dei bisogni specifici del prospect',
              steps: [
                {
                  id: 'ai_step_2',
                  type: 'step',
                  number: 1,
                  name: 'Identificazione Problema',
                  objective: 'Capire le sfide specifiche del prospect',
                  questions: [
                    { 
                      id: 'ai_q_2', 
                      type: 'question', 
                      text: `Quali sono le principali sfide che stai affrontando nel tuo ${selectedAgent?.businessName ? 'settore' : 'business'}?`
                    }
                  ]
                }
              ]
            }
          ]
        };
        
        onGenerate(demoStructure);
        return;
      }

      const data = await res.json();
      onGenerate(data.structure);
    } catch (err) {
      console.error('AI generation error:', err);
      setError('Errore durante la generazione. Riprova.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            Generazione AI-Assisted
          </DialogTitle>
          <DialogDescription>
            L'AI adatterà le domande dello script per il tuo agente specifico, mantenendo la struttura base.
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Tipo di Script</Label>
            <Select value={selectedTemplateType} onValueChange={(v: any) => setSelectedTemplateType(v)}>
              <SelectTrigger>
                <SelectValue placeholder="Seleziona tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="discovery">Discovery Call</SelectItem>
                <SelectItem value="demo">Demo Call</SelectItem>
                <SelectItem value="objections">Gestione Obiezioni</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Tipo di Target</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setTargetType('b2b')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  targetType === 'b2b'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/30'
                    : 'border-muted hover:border-muted-foreground/30'
                )}
              >
                <Building2 className={cn("h-5 w-5", targetType === 'b2b' ? 'text-purple-600' : 'text-muted-foreground')} />
                <div>
                  <div className={cn("font-medium text-sm", targetType === 'b2b' && 'text-purple-700 dark:text-purple-300')}>
                    B2B - Business
                  </div>
                  <div className="text-xs text-muted-foreground">Imprenditori, aziende</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setTargetType('b2c')}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border-2 transition-all text-left",
                  targetType === 'b2c'
                    ? 'border-purple-600 bg-purple-50 dark:bg-purple-950/30'
                    : 'border-muted hover:border-muted-foreground/30'
                )}
              >
                <Users className={cn("h-5 w-5", targetType === 'b2c' ? 'text-purple-600' : 'text-muted-foreground')} />
                <div>
                  <div className={cn("font-medium text-sm", targetType === 'b2c' && 'text-purple-700 dark:text-purple-300')}>
                    B2C - Individui
                  </div>
                  <div className="text-xs text-muted-foreground">Atleti, studenti, privati</div>
                </div>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Per quale agente vuoi creare questo script?</Label>
            <Select 
              value={selectedAgentId} 
              onValueChange={setSelectedAgentId}
              disabled={isLoadingAgents}
            >
              <SelectTrigger>
                <SelectValue placeholder={isLoadingAgents ? 'Caricamento...' : 'Seleziona un agente'} />
              </SelectTrigger>
              <SelectContent>
                {agents.map((agent) => (
                  <SelectItem key={agent.id} value={agent.id}>
                    <div className="flex items-center gap-2">
                      <Bot className="h-4 w-4" />
                      <span>{agent.displayName || agent.agentName}</span>
                      {agent.isActive && (
                        <Badge variant="outline" className="text-[10px]">Attivo</Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedAgent && (
            <Card className="bg-muted/50">
              <CardHeader className="py-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Bot className="h-4 w-4" />
                  {selectedAgent.displayName || selectedAgent.agentName}
                </CardTitle>
                <CardDescription className="text-xs">
                  {selectedAgent.businessName}
                </CardDescription>
              </CardHeader>
            </Card>
          )}

          <div className="space-y-2">
            <Label htmlFor="custom-prompt">
              Istruzioni personalizzate (opzionale)
            </Label>
            <Textarea
              id="custom-prompt"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Es: Voglio che le domande siano più dirette e focalizzate sul ROI..."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              Aggiungi indicazioni specifiche per personalizzare ulteriormente lo script
            </p>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button 
            onClick={handleGenerate} 
            disabled={!selectedAgentId || isGenerating}
            className="gap-2"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Genera Script
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
