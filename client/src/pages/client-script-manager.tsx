import { useState, useEffect, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'wouter';
import {
  FileText,
  Save,
  Plus,
  X,
  Loader2,
  Menu,
  Play,
  Edit3,
  BookOpen,
  Info,
  Package,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  HelpCircle,
  Lightbulb,
  Trash2,
  Blocks,
  Code,
  Users,
  Bot,
  ArrowRightLeft,
  Zap
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { 
  parseTextToBlocks, 
  blocksToText,
  type ScriptBlockStructure 
} from '@shared/script-parser';
import type { Phase, Step, Question, ScriptBlock } from '@shared/script-blocks';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { PhaseInspector } from '@/components/script-manager/PhaseInspector';
import { StepInspector } from '@/components/script-manager/StepInspector';
import { QuestionInspector } from '@/components/script-manager/QuestionInspector';
import { BlockEditor } from '@/components/script-manager/BlockEditor';
import { ScriptBuilderTab } from '@/components/script-manager/builder';
import { Wand2 } from 'lucide-react';

// Types and Constants
interface EnergySettingsData {
  level: 'BASSO' | 'MEDIO' | 'ALTO';
  tone: 'CALMO' | 'SICURO' | 'CONFIDENZIALE' | 'ENTUSIASTA';
  volume: 'SOFT' | 'NORMAL' | 'LOUD';
  pace: 'LENTO' | 'MODERATO' | 'VELOCE';
  vocabulary: 'FORMALE' | 'COLLOQUIALE' | 'TECNICO';
  reason?: string;
}

interface LadderLevel {
  level: number;
  text: string;
  purpose: string;
}

interface LadderData {
  hasLadder: boolean;
  levels: LadderLevel[];
}

interface QuestionData {
  id: string;
  text: string;
  order: number;
  type?: string;
}

interface SalesScript {
  id: string;
  name: string;
  scriptType: 'discovery' | 'demo' | 'objections';
  version: string;
  content: string;
  structure: {
    version: string;
    phases: Array<Phase>;
  };
  isActive: boolean;
  updatedAt: string;
  energySettings?: Record<string, EnergySettingsData>;
  ladderOverrides?: Record<string, LadderData>;
  stepQuestions?: Record<string, QuestionData[]>;
  stepBiscottini?: Record<string, Array<{ text: string; type: string }>>;
}

const scriptTypeLabels: Record<SalesScript['scriptType'], string> = {
  discovery: 'Discovery Call',
  demo: 'Demo Call',
  objections: 'Gestione Obiezioni',
};

const scriptTypeColors: Record<SalesScript['scriptType'], string> = {
  discovery: 'border-blue-500/50 bg-blue-500/5',
  demo: 'border-green-500/50 bg-green-500/5',
  objections: 'border-orange-500/50 bg-orange-500/5',
};

// Main Component
export default function ClientScriptManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // State Management
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<SalesScript['scriptType']>('discovery');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedName, setEditedName] = useState('');
  const [blockStructure, setBlockStructure] = useState<ScriptBlockStructure | null>(null);
  const [editorMode, setEditorMode] = useState<'blocks' | 'text'>('blocks');
  const [parsingFailed, setParsingFailed] = useState(false);
  const [selectedBlock, setSelectedBlock] = useState<ScriptBlock | null>(null);
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptType, setNewScriptType] = useState<'discovery' | 'demo' | 'objections'>('discovery');
  const [newScriptName, setNewScriptName] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [showGuideDialog, setShowGuideDialog] = useState(false);
  const [showAgentSelectDialog, setShowAgentSelectDialog] = useState(false);
  const [scriptToActivate, setScriptToActivate] = useState<string | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [isSavingBuilder, setIsSavingBuilder] = useState(false);
  
  // State for script replacement confirmation dialog
  const [showReplaceConfirmDialog, setShowReplaceConfirmDialog] = useState(false);
  const [pendingActivation, setPendingActivation] = useState<{
    scriptId: string;
    agentId: string;
    currentScriptName: string;
  } | null>(null);

  // Types for agents with script assignments
  interface AgentWithAssignments {
    id: string;
    agentName: string;
    displayName: string;
    businessName: string;
    isActive: boolean;
    scriptAssignments: {
      discovery: { scriptId: string; scriptName: string } | null;
      demo: { scriptId: string; scriptName: string } | null;
      objections: { scriptId: string; scriptName: string } | null;
    };
  }

  // Types for human sellers with script assignments
  interface HumanSellerWithAssignments {
    id: string;
    sellerName: string;
    displayName: string;
    businessName: string | null;
    isActive: boolean;
    assignments: Array<{
      scriptId: string;
      scriptType: string;
      scriptName: string;
    }>;
  }

  // State for dialog tab (AI Agents vs Human Sellers)
  const [agentDialogTab, setAgentDialogTab] = useState<'agents' | 'sellers'>('agents');

  // API Calls
  const { data: scripts = [], isLoading: isLoadingScripts } = useQuery<SalesScript[]>({
    queryKey: ['sales-scripts'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch scripts');
      return res.json();
    },
  });

  const { data: agents = [] } = useQuery<AgentWithAssignments[]>({
    queryKey: ['sales-scripts-agents'],
    queryFn: async () => {
      const res = await fetch('/api/sales-scripts/agents', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch agents');
      return res.json();
    },
  });

  const { data: humanSellers = [], isLoading: isLoadingHumanSellers, error: humanSellersError } = useQuery<HumanSellerWithAssignments[]>({
    queryKey: ['human-sellers-with-assignments'],
    queryFn: async () => {
      console.log('[ScriptManager] 🔍 Fetching human sellers...');
      const res = await fetch('/api/client/human-sellers/with-script-assignments', { headers: getAuthHeaders() });
      console.log('[ScriptManager] 📡 Response status:', res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[ScriptManager] ❌ Error response:', errorText);
        throw new Error('Failed to fetch human sellers');
      }
      
      // Get the raw text first to debug
      const rawText = await res.text();
      console.log('[ScriptManager] 📄 Raw response (first 500 chars):', rawText.substring(0, 500));
      
      // Try to parse JSON
      let data;
      try {
        data = JSON.parse(rawText);
        console.log('[ScriptManager] ✅ Human sellers loaded:', {
          count: data.length,
          sellers: data.map((s: any) => ({ id: s.id, name: s.sellerName, assignments: s.assignments?.length || 0 }))
        });
      } catch (parseError) {
        console.error('[ScriptManager] ❌ JSON parse error:', parseError);
        console.error('[ScriptManager] ❌ Response was:', rawText);
        throw new Error('Invalid JSON response from server');
      }
      
      return data;
    },
  });

  const { data: selectedScript, isLoading: isLoadingScript, isError } = useQuery<SalesScript>({
    queryKey: ['sales-scripts', selectedScriptId],
    queryFn: async ({ queryKey }) => {
      const [, id] = queryKey;
      const res = await fetch(`/api/sales-scripts/${id}`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error('Failed to fetch script details');
      return res.json();
    },
    enabled: !!selectedScriptId,
  });

  // 🔧 FIX: Accept structure in mutation to preserve block IDs
  const updateScriptMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; content?: string; structure?: ScriptBlockStructure }) => {
      const res = await fetch(`/api/sales-scripts/${data.id}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to save script');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setIsEditing(false);
      toast({ title: 'Script salvato', description: 'Le modifiche sono state salvate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const activateScriptMutation = useMutation({
    mutationFn: async ({ scriptId, agentId }: { scriptId: string; agentId: string }) => {
      const res = await fetch(`/api/sales-scripts/${scriptId}/activate`, { 
        method: 'POST', 
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore nell\'attivazione');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['sales-scripts-agents'] });
      setShowAgentSelectDialog(false);
      setScriptToActivate(null);
      toast({ 
        title: 'Script attivato', 
        description: `Lo script è ora attivo per l'agente "${data.agent?.name || 'selezionato'}".` 
      });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const assignScriptToSellerMutation = useMutation({
    mutationFn: async ({ scriptId, sellerId }: { scriptId: string; sellerId: string }) => {
      const res = await fetch(`/api/client/human-sellers/${sellerId}/assign-script`, { 
        method: 'POST', 
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore nell\'assegnazione');
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      queryClient.invalidateQueries({ queryKey: ['human-sellers-with-assignments'] });
      setShowAgentSelectDialog(false);
      setScriptToActivate(null);
      toast({ 
        title: 'Script assegnato', 
        description: `Lo script è ora attivo per "${data.seller?.name || 'il venditore selezionato'}".` 
      });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; scriptType: string }) => {
      const res = await fetch('/api/sales-scripts/create-from-template', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nella creazione');
      return res.json();
    },
    onSuccess: (newScript) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setSelectedScriptId(newScript.id);
      setShowNewScriptDialog(false);
      setNewScriptName('');
      setUseTemplate(true);
      toast({ title: 'Script creato', description: 'Lo script è stato creato dal template di base' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const res = await fetch(`/api/sales-scripts/${scriptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nell\'eliminazione');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setSelectedScriptId(null);
      if (data.archived) {
        toast({ 
          title: 'Script archiviato', 
          description: 'Lo script è stato archiviato perché ha sessioni di training associate e non può essere eliminato.' 
        });
      } else {
        toast({ 
          title: 'Script eliminato', 
          description: 'Lo script è stato eliminato permanentemente.' 
        });
      }
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateEnergyMutation = useMutation({
    mutationFn: async (data: { scriptId: string; phaseOrStepId: string; settings: EnergySettingsData }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/energy`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ phaseOrStepId: data.phaseOrStepId, settings: data.settings }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio energy');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Energy salvato', description: 'Le impostazioni energia sono state aggiornate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateLadderMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; hasLadder: boolean; levels: LadderLevel[] }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/ladder`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, hasLadder: data.hasLadder, levels: data.levels }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio ladder');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Ladder salvato', description: 'I livelli ladder sono stati aggiornati.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateQuestionsMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; questions: QuestionData[] }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/questions`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, questions: data.questions }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio domande');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Domande salvate', description: 'Le domande sono state aggiornate.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  const updateBiscottiniMutation = useMutation({
    mutationFn: async (data: { scriptId: string; stepId: string; biscottini: Array<{ text: string; type: string }> }) => {
      const res = await fetch(`/api/sales-scripts/${data.scriptId}/biscottini`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ stepId: data.stepId, biscottini: data.biscottini }),
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Errore nel salvataggio biscottini');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      toast({ title: 'Biscottini salvati', description: 'I biscottini sono stati aggiornati.' });
    },
    onError: (error: Error) => toast({ title: 'Errore', description: error.message, variant: 'destructive' }),
  });

  // Handlers
  const handleBuilderSave = async (structure: ScriptBlockStructure, scriptType: string, scriptName: string) => {
    setIsSavingBuilder(true);
    try {
      const res = await fetch('/api/sales-scripts', {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: scriptName,
          scriptType,
          content: blocksToText(structure),
          structure,
          isActive: false,
        }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Errore nella creazione dello script');
      }
      const newScript = await res.json();
      queryClient.invalidateQueries({ queryKey: ['sales-scripts'] });
      setShowBuilder(false);
      setSelectedScriptId(newScript.id);
      setActiveTab(scriptType as SalesScript['scriptType']);
      toast({ title: 'Script creato', description: 'Il nuovo script è stato salvato con successo.' });
    } catch (error: any) {
      toast({ title: 'Errore', description: error.message, variant: 'destructive' });
    } finally {
      setIsSavingBuilder(false);
    }
  };

  // 🔧 FIX: Save both content AND structure to preserve IDs
  const handleSave = () => {
    if (!selectedScriptId) return;
    const contentToSave = editorMode === 'blocks' && blockStructure ? blocksToText(blockStructure) : editedContent;
    
    // ✅ Send structure along with content to preserve IDs in DB
    const dataToSave: { id: string; name?: string; content?: string; structure?: ScriptBlockStructure } = { 
      id: selectedScriptId, 
      name: editedName, 
      content: contentToSave 
    };
    
    // Include structure if in blocks mode (this is the source of truth for IDs)
    if (editorMode === 'blocks' && blockStructure) {
      dataToSave.structure = blockStructure;
      console.log('💾 [ScriptManager] Saving with structure (IDs preserved):', 
        blockStructure.phases?.map(p => `${p.id}:${p.name}`).join(', '));
    }
    
    updateScriptMutation.mutate(dataToSave);
  };

  const handleSelectScript = (id: string) => {
    if (isEditing) {
      if (confirm('Hai modifiche non salvate. Sei sicuro di voler cambiare script?')) {
        setIsEditing(false);
      } else {
        return;
      }
    }
    
    // Se siamo in modalità builder, carica lo script nel builder
    if (showBuilder) {
      const scriptToLoad = scripts.find(s => s.id === id);
      if (scriptToLoad) {
        // Il caricamento effettivo avverrà tramite l'effect che monitora selectedScriptId
        setSelectedScriptId(id);
        setSelectedBlock(null);
      }
      return;
    }
    
    setSelectedScriptId(id);
    setSelectedBlock(null);
  };

  const handleBlockUpdate = useCallback((updatedBlock: ScriptBlock) => {
    if (!blockStructure) return;

    const newPhases = blockStructure.phases.map(phase => {
        if (phase.id === updatedBlock.id && updatedBlock.type === 'phase') return updatedBlock as Phase;
        
        const newSteps = (phase.steps || []).map(step => {
            if (step.id === updatedBlock.id && updatedBlock.type === 'step') return updatedBlock as Step;
            
            const newQuestions = (step.questions || []).map(q => 
                q.id === updatedBlock.id && updatedBlock.type === 'question' ? updatedBlock as Question : q
            );
            return { ...step, questions: newQuestions };
        });
        return { ...phase, steps: newSteps };
    });

    setBlockStructure({ ...blockStructure, phases: newPhases });
    setSelectedBlock(updatedBlock);
  }, [blockStructure]);

  const handleBlockAdd = useCallback((type: 'phase' | 'step' | 'question', parentId?: string) => {
    if (!blockStructure) return;
    
    let newBlock: ScriptBlock | null = null;
    let newPhases = [...blockStructure.phases];

    if (type === 'phase') {
      const maxPhaseNum = Math.max(0, ...newPhases.map(p => parseInt(p.number) || 0));
      newBlock = { id: `phase_${crypto.randomUUID()}`, type: 'phase', number: String(maxPhaseNum + 1), name: 'Nuova Fase', description: '', steps: [] };
      newPhases.push(newBlock as Phase);
    } else if (type === 'step' && parentId) {
      newPhases = newPhases.map(p => {
        if (p.id === parentId) {
          const maxStepNum = Math.max(0, ...(p.steps || []).map(s => s.number || 0));
          newBlock = { id: `step_${crypto.randomUUID()}`, type: 'step', number: maxStepNum + 1, name: 'Nuovo Step', objective: '', questions: [] };
          return { ...p, steps: [...(p.steps || []), newBlock as Step] };
        }
        return p;
      });
    } else if (type === 'question' && parentId) {
       newPhases = newPhases.map(p => ({
         ...p,
         steps: (p.steps || []).map(s => {
           if (s.id === parentId) {
             newBlock = { id: `question_${crypto.randomUUID()}`, type: 'question', text: 'Nuova domanda...' };
             return { ...s, questions: [...(s.questions || []), newBlock as Question] };
           }
           return s;
         })
       }));
    }

    setBlockStructure({ ...blockStructure, phases: newPhases });
    if(newBlock) setSelectedBlock(newBlock); // Select the new block
    toast({ title: 'Blocco Aggiunto', description: `Un nuovo blocco di tipo "${type}" è stato creato.`});

  }, [blockStructure, toast]);

  const handleBlockDelete = useCallback((blockId: string) => {
    if(!blockStructure) return;

    let newPhases = blockStructure.phases.filter(p => p.id !== blockId);
    newPhases = newPhases.map(p => {
        const newSteps = (p.steps || []).filter(s => s.id !== blockId);
        const stepsWithFilteredQuestions = newSteps.map(s => ({
            ...s,
            questions: (s.questions || []).filter(q => q.id !== blockId),
        }));
        return { ...p, steps: stepsWithFilteredQuestions };
    });

    setBlockStructure({ ...blockStructure, phases: newPhases });
    setSelectedBlock(null); // Deselect after deletion
    toast({ title: 'Blocco Eliminato', variant: 'destructive' });
  }, [blockStructure, toast]);


  // Effects
  // 🔧 FIX: Use structure from DB as source of truth (preserves IDs)
  // Only fall back to parseTextToBlocks for legacy scripts without structure
  useEffect(() => {
    if (selectedScript) {
      try {
        let parsed: ScriptBlockStructure | null = null;
        
        // ✅ OPTION A: Use saved structure if available (preserves IDs!)
        if (selectedScript.structure && 
            typeof selectedScript.structure === 'object' && 
            Array.isArray((selectedScript.structure as any).phases) &&
            (selectedScript.structure as any).phases.length > 0) {
          console.log('📦 [ScriptManager] Using saved structure from DB (IDs preserved)');
          parsed = selectedScript.structure as unknown as ScriptBlockStructure;
        } else if (selectedScript.content) {
          // Fallback: Parse from content for legacy scripts
          console.log('⚠️ [ScriptManager] No structure in DB, parsing from content (new IDs generated)');
          parsed = parseTextToBlocks(selectedScript.content, selectedScript.scriptType);
        }
        
        // Ensure all blocks have type property for editor
        if (parsed && parsed.phases) {
            parsed.phases.forEach(phase => {
                phase.type = 'phase';
                if (phase.steps) {
                    phase.steps.forEach(step => {
                        step.type = 'step';
                        if (step.questions) {
                            step.questions.forEach(question => {
                                question.type = 'question';
                            });
                        }
                    });
                }
            });
        }
        
        if (parsed && !parsed.metadata) {
          console.log('📦 [ScriptManager] Creating metadata from script info (was missing)');
          parsed.metadata = {
            name: selectedScript.name || 'Script',
            type: (selectedScript.scriptType as 'discovery' | 'demo' | 'objections') || 'discovery',
            version: '1.0.0',
          };
        }
        
        if (parsed && !parsed.globalRules) {
          parsed.globalRules = [];
        }
        
        setBlockStructure(parsed);
        setParsingFailed(!parsed || !parsed.phases?.length);
        setEditorMode((!parsed || !parsed.phases?.length) ? 'text' : 'blocks');
      } catch (err) {
        console.error('❌ [ScriptManager] Error loading script structure:', err);
        setBlockStructure(null);
        setParsingFailed(true);
        setEditorMode('text');
      }
      setEditedContent(selectedScript.content);
      setEditedName(selectedScript.name);
      setSelectedBlock(null);
    }
  }, [selectedScript]);

  // Carica lo script selezionato nel Builder quando è aperto
  useEffect(() => {
    if (showBuilder && selectedScript && blockStructure) {
      console.log('🔧 [Builder] Caricamento script esistente nel Builder:', selectedScript.name);
      // Il Builder Context espone un metodo loadFromStructure tramite BuilderContext
      // Questo verrà gestito passando la structure come prop al Builder
    }
  }, [showBuilder, selectedScript, blockStructure]);

  // Handlers for enhanced mutations
  const handleSaveEnergy = useCallback((phaseOrStepId: string, settings: EnergySettingsData) => {
    if (!selectedScriptId) return;
    updateEnergyMutation.mutate({ scriptId: selectedScriptId, phaseOrStepId, settings });
  }, [selectedScriptId, updateEnergyMutation]);

  const handleSaveLadder = useCallback((stepId: string, hasLadder: boolean, levels: LadderLevel[]) => {
    if (!selectedScriptId) return;
    updateLadderMutation.mutate({ scriptId: selectedScriptId, stepId, hasLadder, levels });
  }, [selectedScriptId, updateLadderMutation]);

  const handleSaveQuestions = useCallback((stepId: string, questions: QuestionData[]) => {
    if (!selectedScriptId) return;
    updateQuestionsMutation.mutate({ scriptId: selectedScriptId, stepId, questions });
  }, [selectedScriptId, updateQuestionsMutation]);

  // RENDER: Inspector Panel
  const renderInspector = () => {
    if (!selectedScriptId || !selectedScript) return <InspectorWelcomeMessage />;

    if (isEditing && selectedBlock) {
        switch (selectedBlock.type) {
            case 'phase': return (
              <PhaseInspector 
                phase={selectedBlock as Phase} 
                onUpdate={handleBlockUpdate} 
                isEditing 
                energySettings={selectedScript.energySettings?.[selectedBlock.id]}
                onSaveEnergy={(settings) => handleSaveEnergy(selectedBlock.id, settings)}
                isSavingEnergy={updateEnergyMutation.isPending}
              />
            );
            case 'step': return (
              <StepInspector 
                step={selectedBlock as Step} 
                onUpdate={handleBlockUpdate} 
                isEditing 
                energySettings={selectedScript.energySettings?.[selectedBlock.id]}
                ladderData={selectedScript.ladderOverrides?.[selectedBlock.id]}
                questionsData={selectedScript.stepQuestions?.[selectedBlock.id]}
                onSaveEnergy={(settings) => handleSaveEnergy(selectedBlock.id, settings)}
                onSaveLadder={(hasLadder, levels) => handleSaveLadder(selectedBlock.id, hasLadder, levels)}
                onSaveQuestions={(questions) => handleSaveQuestions(selectedBlock.id, questions)}
                isSavingEnergy={updateEnergyMutation.isPending}
                isSavingLadder={updateLadderMutation.isPending}
                isSavingQuestions={updateQuestionsMutation.isPending}
              />
            );
            case 'question': return <QuestionInspector question={selectedBlock as Question} onUpdate={handleBlockUpdate} isEditing />;
            default: return <div className="p-4 text-sm text-muted-foreground">Seleziona un blocco per visualizzarne i dettagli e modificarlo.</div>;
        }
    }
    
    return <ScriptDetailPanel script={selectedScript} />;
  };

  return (
    <div className="flex h-screen bg-muted/20">
      <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-4 py-2 bg-background z-10">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-semibold flex items-center gap-2">
                  <Package className="h-5 w-5 text-primary" /> Script Manager
              </h1>
              <Button 
                variant={showBuilder ? "secondary" : "default"} 
                size="sm"
                onClick={() => setShowBuilder(!showBuilder)}
              >
                <Wand2 className="h-4 w-4 mr-2" /> 
                {showBuilder ? 'Chiudi Builder' : 'Script Builder'}
              </Button>
              <Dialog open={showNewScriptDialog} onOpenChange={setShowNewScriptDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" /> Nuovo Script
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Crea Nuovo Script</DialogTitle>
                    <DialogDescription>
                      Crea un nuovo script di vendita per il tuo AI Sales Agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Tipo</Label>
                      <Select value={newScriptType} onValueChange={(v) => setNewScriptType(v as any)}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discovery">Discovery Call</SelectItem>
                          <SelectItem value="demo">Demo Call</SelectItem>
                          <SelectItem value="objections">Gestione Obiezioni</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/50">
                      <div className="space-y-0.5">
                        <Label htmlFor="use-template-header" className="text-sm font-medium">
                          Usa Template Base
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Inizia con lo script base completo già configurato
                        </p>
                      </div>
                      <Switch
                        id="use-template-header"
                        checked={useTemplate}
                        onCheckedChange={setUseTemplate}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Nome Script {!useTemplate && <span className="text-destructive">*</span>}</Label>
                      <Input
                        placeholder={useTemplate ? "(opzionale - usa nome default)" : "Es. Discovery Call v2.0"}
                        value={newScriptName}
                        onChange={(e) => setNewScriptName(e.target.value)}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setShowNewScriptDialog(false)}>
                      Annulla
                    </Button>
                    <Button 
                      onClick={() => createFromTemplateMutation.mutate({ name: newScriptName.trim() || '', scriptType: newScriptType })}
                      disabled={createFromTemplateMutation.isPending}
                    >
                      {createFromTemplateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Crea da Template
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              <Dialog open={showGuideDialog} onOpenChange={setShowGuideDialog}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground hover:text-foreground">
                    <HelpCircle className="h-4 w-4" />
                    <span className="hidden sm:inline">Guida</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      Guida Completa allo Script Manager
                    </DialogTitle>
                    <DialogDescription>
                      Tutto quello che devi sapere per creare script di vendita efficaci per il tuo AI Sales Agent
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-6 py-4">
                    
                    <div className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20">
                      <h3 className="font-semibold text-lg mb-3">Struttura dello Script: FASI → STEP → DOMANDE</h3>
                      <div className="space-y-3 text-sm">
                        <div className="flex items-start gap-3">
                          <div className="bg-primary text-primary-foreground rounded px-2 py-1 font-mono text-xs">FASE</div>
                          <p className="text-muted-foreground">
                            Macro-sezione della conversazione (es. "Apertura", "Qualifica", "Presentazione"). 
                            Ogni fase raggruppa step correlati e ha i suoi obiettivi specifici.
                          </p>
                        </div>
                        <div className="flex items-start gap-3 pl-6">
                          <div className="bg-blue-500 text-white rounded px-2 py-1 font-mono text-xs">STEP</div>
                          <p className="text-muted-foreground">
                            Sotto-fase con un obiettivo preciso. Contiene le domande da fare e le istruzioni comportamentali.
                            L'AI completa tutti gli step di una fase prima di passare alla successiva.
                          </p>
                        </div>
                        <div className="flex items-start gap-3 pl-12">
                          <div className="bg-green-500 text-white rounded px-2 py-1 font-mono text-xs">DOMANDA</div>
                          <p className="text-muted-foreground">
                            Domanda specifica da porre al prospect. L'AI le usa come guida ma le adatta al contesto della conversazione.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        🤖 Come l'AI Usa lo Script
                      </h3>
                      <div className="space-y-2 text-sm text-muted-foreground">
                        <p>L'AI Sales Agent riceve lo script completo nel suo contesto e lo usa per:</p>
                        <ul className="space-y-2 pl-4">
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Navigare la conversazione</strong>: Segue l'ordine FASE → STEP → DOMANDE senza saltare passaggi</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Adattare l'energia</strong>: Modifica tono, ritmo e volume in base alle impostazioni di ogni fase/step</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Attivare il Ladder</strong>: Quando il prospect dà risposte vaghe, l'AI scava più a fondo con i "Perché"</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="text-primary font-bold">→</span>
                            <span><strong>Rispettare i Checkpoint</strong>: Verifica di avere le informazioni critiche prima di cambiare fase</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-900">
                      <h3 className="font-semibold flex items-center gap-2 mb-3">
                        📋 Legenda Simboli nello Script
                      </h3>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⏸️</span>
                          <span className="text-muted-foreground"><strong>PAUSA</strong> - Fermati e aspetta risposta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🎧</span>
                          <span className="text-muted-foreground"><strong>ASCOLTA</strong> - Attenzione alla risposta</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">💬</span>
                          <span className="text-muted-foreground"><strong>REAGISCI</strong> - Mostra empatia</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🍪</span>
                          <span className="text-muted-foreground"><strong>BISCOTTINO</strong> - Complimento breve</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⛔</span>
                          <span className="text-muted-foreground"><strong>CHECKPOINT</strong> - Verifica info critiche</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg">🔥</span>
                          <span className="text-muted-foreground"><strong>LADDER</strong> - Scava con i "Perché"</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="border-t pt-6">
                      <h3 className="font-semibold text-lg mb-4">Come Usare lo Script Manager</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">1</span>
                          <div>
                            <p className="font-medium">Seleziona uno Script</p>
                            <p className="text-sm text-muted-foreground">
                              Scegli tra <strong>Discovery</strong>, <strong>Demo</strong> o <strong>Obiezioni</strong> nella sidebar, poi seleziona lo script.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">2</span>
                          <div>
                            <p className="font-medium">Modifica Energia, Tono, Ladder</p>
                            <p className="text-sm text-muted-foreground">
                              Clicca "Modifica", poi seleziona una Fase o Step. Nel pannello destro potrai configurare:
                              energia, tono, volume, ritmo, lessico e il Ladder dei Perché.
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-start gap-3">
                          <span className="bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center text-sm shrink-0">3</span>
                          <div>
                            <p className="font-medium">Attiva per un Agente</p>
                            <p className="text-sm text-muted-foreground">
                              Clicca "Attiva" e scegli per quale AI Sales Agent usare questo script. 
                              <strong className="text-primary"> Ogni agente può avere un solo script per tipo</strong> (Discovery, Demo, Obiezioni).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    <div className="p-4 bg-muted/50 rounded-lg border">
                      <h4 className="font-medium flex items-center gap-2 mb-2">
                        <Lightbulb className="h-4 w-4 text-yellow-500" />
                        Suggerimenti
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• I badge colorati (<span className="text-red-500">🔴 ALTO</span>, <span className="text-yellow-500">🟡 MEDIO</span>, <span className="text-blue-500">🔵 BASSO</span>) indicano il livello di energia</li>
                        <li>• L'icona 🪜 indica che lo step ha un Ladder dei Perché attivo</li>
                        <li>• Puoi creare più script dello stesso tipo e attivarli per agenti diversi</li>
                        <li>• Le modifiche vengono salvate automaticamente nel database</li>
                      </ul>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={() => setShowGuideDialog(false)}>Ho capito!</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex items-center gap-2">
                {isEditing ? (
                    <>
                        <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Annulla</Button>
                        <Button size="sm" onClick={handleSave} disabled={updateScriptMutation.isPending}>
                            {updateScriptMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                            <Save className="h-4 w-4 mr-2" /> Salva
                        </Button>
                    </>
                ) : selectedScriptId && (
                    <>
                        <div className="flex items-center gap-1">
                            <Button variant={editorMode === 'blocks' ? 'default' : 'outline'} size="sm" onClick={() => setEditorMode('blocks')} disabled={parsingFailed}>
                                <Blocks className="h-4 w-4 mr-1" />
                                Blocchi
                            </Button>
                            <Button variant={editorMode === 'text' ? 'default' : 'outline'} size="sm" onClick={() => setEditorMode('text')}>
                                <Code className="h-4 w-4 mr-1" />
                                Testo
                            </Button>
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                            <Edit3 className="h-4 w-4 mr-2" /> Modifica
                        </Button>
                        <Button 
                          size="sm" 
                          onClick={() => {
                            setScriptToActivate(selectedScript.id);
                            setShowAgentSelectDialog(true);
                          }} 
                          disabled={activateScriptMutation.isPending}
                        >
                          <Play className="h-4 w-4 mr-2" />
                          {selectedScript?.isActive ? 'Cambia Agente' : 'Attiva'}
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => {
                          if (confirm('Sei sicuro di voler eliminare questo script?')) {
                            deleteScriptMutation.mutate(selectedScriptId);
                          }
                        }} disabled={deleteScriptMutation.isPending}>
                            <Trash2 className="h-4 w-4 mr-2" /> Elimina
                        </Button>
                    </>
                )}
            </div>
        </header>

        <ResizablePanelGroup direction="horizontal" className="flex-1">
          {/* COLONNA 1: LISTA SCRIPT */}
          <ResizablePanel defaultSize={20} minSize={15} maxSize={30}>
            <div className="h-full flex flex-col bg-background">
              <div className="p-2 border-b">
                <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                  <TabsList className="grid w-full grid-cols-3 h-8">
                    <TabsTrigger value="discovery" className="text-xs">Discovery</TabsTrigger>
                    <TabsTrigger value="demo" className="text-xs">Demo</TabsTrigger>
                    <TabsTrigger value="objections" className="text-xs">Obiezioni</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
              <ScrollArea className="flex-1">
                <div className="p-2 space-y-2">
                  {isLoadingScripts ? <Loader2 className="h-6 w-6 animate-spin mx-auto mt-4" /> :
                   scripts.filter(s => s.scriptType === activeTab).map((script) => (
                     <ScriptListItem key={script.id} script={script} isSelected={selectedScriptId === script.id} onSelect={handleSelectScript} />
                  ))}
                </div>
              </ScrollArea>

              {/* Dialog Selezione Agente/Venditore per Attivazione Script */}
                <Dialog open={showAgentSelectDialog} onOpenChange={(open) => {
                  setShowAgentSelectDialog(open);
                  if (!open) {
                    setScriptToActivate(null);
                    setAgentDialogTab('agents');
                  }
                }}>
                  <DialogContent className="max-w-lg">
                    {(() => {
                      const scriptToActivateData = scripts.find(s => s.id === scriptToActivate);
                      const scriptTypeName = scriptToActivateData ? scriptTypeLabels[scriptToActivateData.scriptType] : '';
                      
                      const agentsWithThisScript = agents.filter(agent => {
                        const assignments = agent.scriptAssignments || { discovery: null, demo: null, objections: null };
                        const currentAssignment = scriptToActivateData 
                          ? assignments[scriptToActivateData.scriptType as keyof typeof assignments]
                          : null;
                        return currentAssignment?.scriptId === scriptToActivate;
                      });
                      
                      const sellersWithThisScript = humanSellers.filter(seller => {
                        if (!scriptToActivateData) return false;
                        const currentAssignment = seller.assignments?.find(
                          a => a.scriptType === scriptToActivateData.scriptType
                        );
                        return currentAssignment?.scriptId === scriptToActivate;
                      });
                      
                      const totalActiveCount = agentsWithThisScript.length + sellersWithThisScript.length;
                      
                      return (
                        <>
                          <DialogHeader className="pb-2">
                            <DialogTitle className="flex items-center gap-2 text-lg">
                              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center">
                                <Zap className="h-5 w-5 text-primary" />
                              </div>
                              Assegna Script
                            </DialogTitle>
                            <DialogDescription className="sr-only">
                              Seleziona a chi assegnare lo script
                            </DialogDescription>
                          </DialogHeader>
                          
                          {scriptToActivateData && (
                            <div className="bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 rounded-xl p-4 border border-primary/20">
                              <div className="flex items-start gap-3">
                                <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
                                  <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-sm truncate">{scriptToActivateData.name}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="secondary" className="text-xs">
                                      {scriptTypeName}
                                    </Badge>
                                    <span className="text-xs text-muted-foreground">v{scriptToActivateData.version}</span>
                                  </div>
                                </div>
                                {totalActiveCount > 0 && (
                                  <Badge variant="default" className="text-xs flex-shrink-0">
                                    <CheckCircle className="h-3 w-3 mr-1" />
                                    {totalActiveCount} attivo
                                  </Badge>
                                )}
                              </div>
                            </div>
                          )}
                    
                          <Tabs value={agentDialogTab} onValueChange={(v) => setAgentDialogTab(v as 'agents' | 'sellers')} className="w-full">
                            <TabsList className="grid w-full grid-cols-2 h-11">
                              <TabsTrigger value="agents" className="flex items-center gap-2 data-[state=active]:bg-violet-500/10 data-[state=active]:text-violet-700">
                                <Bot className="h-4 w-4" />
                                <span>AI Agents</span>
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                  {agents.length}
                                </Badge>
                              </TabsTrigger>
                              <TabsTrigger value="sellers" className="flex items-center gap-2 data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-700">
                                <Users className="h-4 w-4" />
                                <span>Venditori</span>
                                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
                                  {humanSellers.length}
                                </Badge>
                              </TabsTrigger>
                            </TabsList>
                          </Tabs>

                          <ScrollArea className="max-h-[340px] -mx-1 px-1">
                            <div className="space-y-2 py-1">
                              {agentDialogTab === 'agents' && (
                                <>
                                  {agents.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground">
                                      <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                                        <Bot className="h-8 w-8 opacity-40" />
                                      </div>
                                      <p className="font-medium">Nessun AI Agent</p>
                                      <p className="text-sm mt-1">Crea prima un AI Sales Agent.</p>
                                    </div>
                                  ) : (
                                    <>
                                      {(() => {
                                        const activeAgents = agents.filter(agent => {
                                          const assignments = agent.scriptAssignments || { discovery: null, demo: null, objections: null };
                                          const currentAssignment = scriptToActivateData 
                                            ? assignments[scriptToActivateData.scriptType as keyof typeof assignments]
                                            : null;
                                          return currentAssignment?.scriptId === scriptToActivate;
                                        });
                                        
                                        const otherAgents = agents.filter(agent => {
                                          const assignments = agent.scriptAssignments || { discovery: null, demo: null, objections: null };
                                          const currentAssignment = scriptToActivateData 
                                            ? assignments[scriptToActivateData.scriptType as keyof typeof assignments]
                                            : null;
                                          return currentAssignment?.scriptId !== scriptToActivate;
                                        });
                                        
                                        return (
                                          <>
                                            {activeAgents.length > 0 && (
                                              <div className="mb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <div className="h-5 w-5 rounded-full bg-primary/20 flex items-center justify-center">
                                                    <CheckCircle className="h-3 w-3 text-primary" />
                                                  </div>
                                                  <span className="text-xs font-medium text-primary uppercase tracking-wide">Attivo su</span>
                                                </div>
                                                <div className="space-y-2">
                                                  {activeAgents.map((agent) => (
                                                    <div
                                                      key={agent.id}
                                                      className="flex items-center gap-3 p-3 rounded-lg border-2 border-primary bg-primary/5"
                                                    >
                                                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-md">
                                                        <Bot className="h-5 w-5 text-white" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{agent.agentName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{agent.businessName}</p>
                                                      </div>
                                                      <Badge variant="default" className="text-xs bg-primary">
                                                        <CheckCircle className="h-3 w-3 mr-1" /> Attivo
                                                      </Badge>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {otherAgents.length > 0 && (
                                              <div>
                                                {activeAgents.length > 0 && (
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Altri agenti</span>
                                                    <div className="flex-1 h-px bg-border" />
                                                  </div>
                                                )}
                                                <div className="space-y-2">
                                                  {otherAgents.map((agent) => {
                                                    const assignments = agent.scriptAssignments || { discovery: null, demo: null, objections: null };
                                                    const currentAssignment = scriptToActivateData 
                                                      ? assignments[scriptToActivateData.scriptType as keyof typeof assignments]
                                                      : null;
                                                    const hasActiveScriptOfSameType = currentAssignment && currentAssignment.scriptId !== scriptToActivate;
                                                    
                                                    return (
                                                      <button
                                                        key={agent.id}
                                                        className={cn(
                                                          "w-full text-left p-3 rounded-lg border-2 transition-all",
                                                          "hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm",
                                                          hasActiveScriptOfSameType 
                                                            ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20" 
                                                            : "border-border bg-card"
                                                        )}
                                                        onClick={() => {
                                                          if (scriptToActivate) {
                                                            if (hasActiveScriptOfSameType && currentAssignment) {
                                                              setPendingActivation({
                                                                scriptId: scriptToActivate,
                                                                agentId: agent.id,
                                                                currentScriptName: currentAssignment.scriptName
                                                              });
                                                              setShowReplaceConfirmDialog(true);
                                                              setShowAgentSelectDialog(false);
                                                            } else {
                                                              activateScriptMutation.mutate({ 
                                                                scriptId: scriptToActivate, 
                                                                agentId: agent.id 
                                                              });
                                                            }
                                                          }
                                                        }}
                                                        disabled={activateScriptMutation.isPending}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                          <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center shadow-sm",
                                                            hasActiveScriptOfSameType 
                                                              ? "bg-gradient-to-br from-amber-400 to-orange-500" 
                                                              : "bg-gradient-to-br from-slate-400 to-slate-500"
                                                          )}>
                                                            <Bot className="h-5 w-5 text-white" />
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">{agent.agentName}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{agent.businessName}</p>
                                                          </div>
                                                          {hasActiveScriptOfSameType && (
                                                            <div className="flex flex-col items-end gap-1">
                                                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50">
                                                                <ArrowRightLeft className="h-2.5 w-2.5 mr-1" /> Sostituisci
                                                              </Badge>
                                                              <span className="text-[10px] text-amber-600 truncate max-w-[100px]">
                                                                {currentAssignment?.scriptName}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </>
                                  )}
                                </>
                              )}

                              {agentDialogTab === 'sellers' && (
                                <>
                                  {isLoadingHumanSellers ? (
                                    <div className="text-center py-10 text-muted-foreground">
                                      <Loader2 className="h-8 w-8 mx-auto mb-3 animate-spin text-primary" />
                                      <p className="text-sm">Caricamento venditori...</p>
                                    </div>
                                  ) : humanSellersError ? (
                                    <div className="text-center py-10">
                                      <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-destructive/10 flex items-center justify-center">
                                        <AlertCircle className="h-8 w-8 text-destructive" />
                                      </div>
                                      <p className="font-medium text-destructive">Errore nel caricamento</p>
                                      <p className="text-sm text-muted-foreground mt-1">{(humanSellersError as Error).message}</p>
                                    </div>
                                  ) : humanSellers.length === 0 ? (
                                    <div className="text-center py-10 text-muted-foreground">
                                      <div className="h-16 w-16 mx-auto mb-3 rounded-full bg-muted/50 flex items-center justify-center">
                                        <Users className="h-8 w-8 opacity-40" />
                                      </div>
                                      <p className="font-medium">Nessun Venditore</p>
                                      <p className="text-sm mt-1">Crea prima un Venditore Umano.</p>
                                    </div>
                                  ) : (
                                    <>
                                      {(() => {
                                        const activeSellers = humanSellers.filter(seller => {
                                          if (!scriptToActivateData) return false;
                                          const currentAssignment = seller.assignments?.find(
                                            a => a.scriptType === scriptToActivateData.scriptType
                                          );
                                          return currentAssignment?.scriptId === scriptToActivate;
                                        });
                                        
                                        const otherSellers = humanSellers.filter(seller => {
                                          if (!scriptToActivateData) return true;
                                          const currentAssignment = seller.assignments?.find(
                                            a => a.scriptType === scriptToActivateData.scriptType
                                          );
                                          return currentAssignment?.scriptId !== scriptToActivate;
                                        });
                                        
                                        return (
                                          <>
                                            {activeSellers.length > 0 && (
                                              <div className="mb-3">
                                                <div className="flex items-center gap-2 mb-2">
                                                  <div className="h-5 w-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                                    <CheckCircle className="h-3 w-3 text-emerald-600" />
                                                  </div>
                                                  <span className="text-xs font-medium text-emerald-600 uppercase tracking-wide">Attivo su</span>
                                                </div>
                                                <div className="space-y-2">
                                                  {activeSellers.map((seller) => (
                                                    <div
                                                      key={seller.id}
                                                      className="flex items-center gap-3 p-3 rounded-lg border-2 border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20"
                                                    >
                                                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-md">
                                                        <Users className="h-5 w-5 text-white" />
                                                      </div>
                                                      <div className="flex-1 min-w-0">
                                                        <p className="font-medium text-sm truncate">{seller.sellerName}</p>
                                                        <p className="text-xs text-muted-foreground truncate">{seller.businessName || seller.displayName}</p>
                                                      </div>
                                                      <Badge variant="default" className="text-xs bg-emerald-600">
                                                        <CheckCircle className="h-3 w-3 mr-1" /> Attivo
                                                      </Badge>
                                                    </div>
                                                  ))}
                                                </div>
                                              </div>
                                            )}
                                            
                                            {otherSellers.length > 0 && (
                                              <div>
                                                {activeSellers.length > 0 && (
                                                  <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Altri venditori</span>
                                                    <div className="flex-1 h-px bg-border" />
                                                  </div>
                                                )}
                                                <div className="space-y-2">
                                                  {otherSellers.map((seller) => {
                                                    if (!scriptToActivateData) return null;
                                                    const currentAssignment = seller.assignments?.find(
                                                      a => a.scriptType === scriptToActivateData.scriptType
                                                    );
                                                    const hasActiveScriptOfSameType = currentAssignment && currentAssignment.scriptId !== scriptToActivate;
                                                    
                                                    return (
                                                      <button
                                                        key={seller.id}
                                                        className={cn(
                                                          "w-full text-left p-3 rounded-lg border-2 transition-all",
                                                          "hover:border-emerald-500/50 hover:bg-emerald-50/50 hover:shadow-sm",
                                                          hasActiveScriptOfSameType 
                                                            ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20" 
                                                            : "border-border bg-card"
                                                        )}
                                                        onClick={() => {
                                                          if (scriptToActivate) {
                                                            assignScriptToSellerMutation.mutate({ 
                                                              scriptId: scriptToActivate, 
                                                              sellerId: seller.id 
                                                            });
                                                          }
                                                        }}
                                                        disabled={assignScriptToSellerMutation.isPending}
                                                      >
                                                        <div className="flex items-center gap-3">
                                                          <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center shadow-sm",
                                                            hasActiveScriptOfSameType 
                                                              ? "bg-gradient-to-br from-amber-400 to-orange-500" 
                                                              : "bg-gradient-to-br from-slate-400 to-slate-500"
                                                          )}>
                                                            <Users className="h-5 w-5 text-white" />
                                                          </div>
                                                          <div className="flex-1 min-w-0">
                                                            <p className="font-medium text-sm truncate">{seller.sellerName}</p>
                                                            <p className="text-xs text-muted-foreground truncate">{seller.businessName || seller.displayName}</p>
                                                          </div>
                                                          {hasActiveScriptOfSameType && (
                                                            <div className="flex flex-col items-end gap-1">
                                                              <Badge variant="outline" className="text-[10px] border-amber-500 text-amber-600 bg-amber-50">
                                                                <ArrowRightLeft className="h-2.5 w-2.5 mr-1" /> Sostituisci
                                                              </Badge>
                                                              <span className="text-[10px] text-amber-600 truncate max-w-[100px]">
                                                                {currentAssignment?.scriptName}
                                                              </span>
                                                            </div>
                                                          )}
                                                        </div>
                                                      </button>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </>
                                        );
                                      })()}
                                    </>
                                  )}
                                </>
                              )}
                            </div>
                          </ScrollArea>
                          
                          <div className="flex items-center justify-between pt-2 border-t">
                            <p className="text-xs text-muted-foreground">
                              Solo 1 script attivo per tipo
                            </p>
                            <Button variant="outline" size="sm" onClick={() => setShowAgentSelectDialog(false)}>
                              Chiudi
                            </Button>
                          </div>
                        </>
                      );
                    })()}
                  </DialogContent>
                </Dialog>

                {/* Dialog di Conferma Sostituzione Script */}
                <Dialog open={showReplaceConfirmDialog} onOpenChange={(open) => {
                  setShowReplaceConfirmDialog(open);
                  if (!open) setPendingActivation(null);
                }}>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle className="flex items-center gap-2">
                        <ArrowRightLeft className="h-5 w-5 text-amber-500" />
                        Sostituire Script Attivo?
                      </DialogTitle>
                      <DialogDescription>
                        Questo agente ha già uno script attivo dello stesso tipo.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                      <Alert className="border-amber-500 bg-amber-500/10">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        <AlertTitle className="text-amber-600">Script Attualmente Attivo</AlertTitle>
                        <AlertDescription className="text-amber-600/80">
                          <span className="font-medium">"{pendingActivation?.currentScriptName}"</span> verrà sostituito con il nuovo script.
                        </AlertDescription>
                      </Alert>
                      <p className="text-sm text-muted-foreground mt-4">
                        Vuoi procedere con la sostituzione? L'agente utilizzerà il nuovo script per le prossime conversazioni.
                      </p>
                    </div>
                    <DialogFooter className="gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowReplaceConfirmDialog(false);
                          setPendingActivation(null);
                          setShowAgentSelectDialog(true);
                        }}
                      >
                        Annulla
                      </Button>
                      <Button 
                        variant="default"
                        className="bg-amber-500 hover:bg-amber-600"
                        onClick={() => {
                          if (pendingActivation) {
                            activateScriptMutation.mutate({ 
                              scriptId: pendingActivation.scriptId, 
                              agentId: pendingActivation.agentId 
                            });
                            setShowReplaceConfirmDialog(false);
                            setPendingActivation(null);
                          }
                        }}
                        disabled={activateScriptMutation.isPending}
                      >
                        {activateScriptMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <ArrowRightLeft className="h-4 w-4 mr-2" />
                        )}
                        Sostituisci Script
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
            </div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          
          {showBuilder ? (
            /* SCRIPT BUILDER VIEW - Full width when active */
            <ResizablePanel defaultSize={80} minSize={60}>
              <ScriptBuilderTab 
                onSave={handleBuilderSave} 
                isSaving={isSavingBuilder}
                initialStructure={selectedScript ? blockStructure : undefined}
                initialScriptType={selectedScript?.scriptType}
                initialScriptName={selectedScript?.name}
              />
            </ResizablePanel>
          ) : (
            <>
              {/* COLONNA 2: EDITOR */}
              <ResizablePanel defaultSize={50} minSize={30}>
                <div className="h-full flex flex-col bg-background">
                    {!selectedScriptId ? <EditorWelcomeMessage /> :
                     isLoadingScript ? <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div> :
                     isError ? <EditorErrorMessage /> :
                     selectedScript && (
                        <div className="flex-1 flex flex-col overflow-hidden">
                           <div className="p-3 border-b flex items-center justify-between">
                             <EditableScriptName isEditing={isEditing} value={editedName} onChange={setEditedName} />
                           </div>
                           <ScrollArea className="flex-1">
                             <div className="p-4">
                               {isEditing && !parsingFailed && (
                                   blockStructure ? 
                                   <BlockEditor 
                                     structure={blockStructure} 
                                     selectedBlock={selectedBlock} 
                                     onSelectBlock={setSelectedBlock} 
                                     onAddBlock={handleBlockAdd}
                                     onDeleteBlock={handleBlockDelete}
                                     isEditing
                                     energySettings={selectedScript?.energySettings}
                                     ladderOverrides={selectedScript?.ladderOverrides}
                                     stepQuestions={selectedScript?.stepQuestions}
                                   /> 
                                   : <Loader2 className="h-6 w-6 animate-spin mx-auto mt-10" />
                               )}
                               {isEditing && parsingFailed && (
                                   <ParsingFailedEditor value={editedContent} onChange={setEditedContent} />
                               )}
                               {!isEditing && editorMode === 'blocks' && !parsingFailed && blockStructure && (
                                   <BlockEditor 
                                     structure={blockStructure} 
                                     selectedBlock={selectedBlock} 
                                     onSelectBlock={setSelectedBlock} 
                                     onAddBlock={handleBlockAdd}
                                     onDeleteBlock={handleBlockDelete}
                                     isEditing={false}
                                     energySettings={selectedScript?.energySettings}
                                     ladderOverrides={selectedScript?.ladderOverrides}
                                     stepQuestions={selectedScript?.stepQuestions}
                                   />
                               )}
                               {!isEditing && editorMode === 'text' && (
                                   <pre className="whitespace-pre-wrap text-sm font-mono">{selectedScript.content}</pre>
                               )}
                               {!isEditing && parsingFailed && editorMode === 'blocks' && (
                                   <Alert variant="destructive">
                                       <AlertCircle className="h-4 w-4" />
                                       <AlertTitle>Parsing Non Valido</AlertTitle>
                                       <AlertDescription>
                                           Visualizzazione blocchi non disponibile. Clicca "Testo" per vedere il contenuto.
                                       </AlertDescription>
                                   </Alert>
                               )}
                             </div>
                           </ScrollArea>
                        </div>
                    )}
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />

              {/* COLONNA 3: ISPETTORE/DETTAGLI */}
              <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
                  <div className="h-full flex flex-col bg-background border-l">
                      <ScrollArea className="flex-1 p-4">
                          {renderInspector()}
                      </ScrollArea>
                  </div>
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// Sub-components for cleaner main component
const ScriptListItem = ({ script, isSelected, onSelect }: { script: SalesScript, isSelected: boolean, onSelect: (id: string) => void }) => (
    <button
        className={cn(
            'w-full text-left p-3 rounded-lg border-l-4 transition-all hover:bg-muted/50',
            scriptTypeColors[script.scriptType],
            isSelected ? 'bg-primary/15 border-l-4 border-primary font-semibold shadow-sm ring-1 ring-primary/30' : 'bg-transparent'
        )}
        onClick={() => onSelect(script.id)}
    >
        <div className="flex items-start justify-between mb-1">
            <span className="font-semibold text-sm truncate pr-2 flex-1">{script.name}</span>
            {script.isActive && <Badge variant="default" className="text-xs h-5"><CheckCircle className="h-3 w-3 mr-1" /> Attivo</Badge>}
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>v{script.version}</span>
            <span className="text-xs">•</span>
            <span>{script.structure?.phases?.length || 0} fasi</span>
        </div>
    </button>
);

const InspectorWelcomeMessage = () => (
    <div className="flex-1 flex items-center justify-center text-center p-8 h-full">
        <div className="text-muted-foreground">
            <Info className="h-12 w-12 mx-auto text-muted-foreground/20 mb-4" />
            <p>Seleziona uno script per vedere i dettagli.</p>
        </div>
    </div>
);

const ScriptDetailPanel = ({ script }: { script: SalesScript }) => (
     <div className="space-y-4">
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Dettagli Script</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-3">
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Stato</span>
                    {script.isActive 
                      ? <Badge variant="default"><CheckCircle className="h-3 w-3 mr-1" /> Attivo</Badge> 
                      : <Badge variant="secondary"><X className="h-3 w-3 mr-1" /> Inattivo</Badge>
                    }
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Versione</span><span className="font-medium">v{script.version}</span>
                </div>
                 <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Tipo</span><span className="font-medium">{scriptTypeLabels[script.scriptType]}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Ultima Modifica</span>
                    <span className="font-medium">{new Date(script.updatedAt).toLocaleDateString('it-IT')}</span>
                </div>
            </CardContent>
        </Card>
        <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Struttura</CardTitle></CardHeader>
            <CardContent className="space-y-2">
                {script.structure?.phases?.map(phase => (
                    <div key={phase.id} className="text-sm p-2 rounded-md bg-muted/50">
                        <p className="font-medium">Fase {phase.number}: {phase.name}</p>
                        <p className="text-xs text-muted-foreground">{phase.steps?.length || 0} step</p>
                    </div>
                ))}
            </CardContent>
        </Card>
    </div>
);

const EditorWelcomeMessage = () => (
    <div className="flex-1 flex items-center justify-center text-center p-8">
        <div>
            <FileText className="h-16 w-16 mx-auto text-muted-foreground/20 mb-4" />
            <h2 className="text-xl font-semibold mb-2">Seleziona uno Script</h2>
            <p className="text-muted-foreground max-w-md">Scegli uno script dalla lista per visualizzarlo e modificarlo.</p>
        </div>
    </div>
);

const EditorErrorMessage = () => (
     <div className="flex-1 flex items-center justify-center p-8">
        <Alert variant="destructive" className="max-w-md">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Caricamento Fallito</AlertTitle>
            <AlertDescription>
                Impossibile caricare lo script. Potrebbe essere stato eliminato o esserci un problema di rete.
            </AlertDescription>
        </Alert>
    </div>
);

const EditableScriptName = ({ isEditing, value, onChange }: { isEditing: boolean, value: string, onChange: (val: string) => void }) => (
    isEditing ?
    <Input value={value} onChange={(e) => onChange(e.target.value)} className="h-8 text-base font-semibold" /> :
    <h2 className="text-base font-semibold truncate py-1">{value}</h2>
);

const ParsingFailedEditor = ({ value, onChange }: { value: string, onChange: (val: string) => void }) => (
    <>
        <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Modalità Testo Forzata</AlertTitle>
            <AlertDescription>
                La struttura dello script non è valida. Puoi modificarlo solo come testo.
                Correggi la formattazione per riattivare l'editor a blocchi.
            </AlertDescription>
        </Alert>
        <Textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="min-h-[60vh] font-mono text-sm border-dashed"
        />
    </>
);
