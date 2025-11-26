import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, useLocation } from 'wouter';
import {
  FileText,
  Save,
  Copy,
  Trash2,
  Plus,
  Check,
  X,
  Loader2,
  Menu,
  ArrowLeft,
  Play,
  History,
  Settings,
  Eye,
  Edit3,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Target,
  MessageSquare,
  AlertCircle,
  CheckCircle,
  Blocks,
  Code,
  BookOpen,
  HelpCircle,
  Lightbulb,
  Info,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { Switch } from '@/components/ui/switch';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { 
  BlockPhase, 
  BlockGlobalRule,
  BlockCheckpoint,
  BlockEnergy 
} from '@/components/script-blocks';
import { 
  parseTextToBlocks, 
  blocksToText,
  type ScriptBlockStructure 
} from '@shared/script-parser';
import type { GlobalRule, Phase } from '@shared/script-blocks';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

interface SalesScript {
  id: string;
  name: string;
  scriptType: 'discovery' | 'demo' | 'objections';
  version: string;
  content: string;
  structure: {
    version: string;
    phases: Array<{
      id: string;
      number: string;
      name: string;
      description: string;
      semanticType: string;
      steps: Array<{
        id: string;
        number: number;
        name: string;
        objective: string;
        questions: Array<{ text: string; marker?: string }>;
        hasLadder: boolean;
      }>;
      checkpoints: Array<{
        id: string;
        description: string;
        verifications: string[];
      }>;
    }>;
  };
  isActive: boolean;
  isDraft: boolean;
  description: string | null;
  tags: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  versions?: Array<{
    id: string;
    version: string;
    createdAt: string;
    changeNotes: string;
  }>;
}

const scriptTypeLabels = {
  discovery: 'Discovery Call',
  demo: 'Demo Call',
  objections: 'Gestione Obiezioni',
};

const scriptTypeColors = {
  discovery: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  demo: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  objections: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export default function ClientScriptManager() {
  const { agentId } = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'discovery' | 'demo' | 'objections'>('discovery');
  const [isEditing, setIsEditing] = useState(false);
  const [editedContent, setEditedContent] = useState('');
  const [editedName, setEditedName] = useState('');
  const [showNewScriptDialog, setShowNewScriptDialog] = useState(false);
  const [newScriptType, setNewScriptType] = useState<'discovery' | 'demo' | 'objections'>('discovery');
  const [newScriptName, setNewScriptName] = useState('');
  const [useTemplate, setUseTemplate] = useState(true);
  const [expandedPhases, setExpandedPhases] = useState<Set<string>>(new Set());
  const [blockStructure, setBlockStructure] = useState<ScriptBlockStructure | null>(null);
  const [editorMode, setEditorMode] = useState<'blocks' | 'text'>('blocks');
  const [parsingFailed, setParsingFailed] = useState(false);
  const [showGuideDialog, setShowGuideDialog] = useState(false);

  const { data: scripts = [], isLoading } = useQuery<SalesScript[]>({
    queryKey: ['/api/sales-scripts'],
    queryFn: async () => {
      const response = await fetch('/api/sales-scripts', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return [];
        throw new Error('Errore nel caricamento degli script');
      }
      return response.json();
    },
  });

  const { data: selectedScript, isLoading: loadingScript } = useQuery<SalesScript>({
    queryKey: ['/api/sales-scripts', selectedScriptId],
    queryFn: async () => {
      const response = await fetch(`/api/sales-scripts/${selectedScriptId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Errore nel caricamento dello script');
      return response.json();
    },
    enabled: !!selectedScriptId,
  });

  const seedDefaultsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/sales-scripts/seed-defaults', {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione degli script');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      toast({
        title: 'Script creati',
        description: 'Gli script di default sono stati creati con successo',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createScriptMutation = useMutation({
    mutationFn: async (data: { name: string; scriptType: string; content: string }) => {
      const response = await fetch('/api/sales-scripts', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione');
      }
      return response.json();
    },
    onSuccess: (newScript) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      setSelectedScriptId(newScript.id);
      setShowNewScriptDialog(false);
      setNewScriptName('');
      setUseTemplate(true);
      toast({
        title: 'Script creato',
        description: 'Il nuovo script è stato creato con successo',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const createFromTemplateMutation = useMutation({
    mutationFn: async (data: { name: string; scriptType: string }) => {
      const response = await fetch('/api/sales-scripts/create-from-template', {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella creazione');
      }
      return response.json();
    },
    onSuccess: (newScript) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      setSelectedScriptId(newScript.id);
      setShowNewScriptDialog(false);
      setNewScriptName('');
      setUseTemplate(true);
      toast({
        title: 'Script creato',
        description: 'Lo script è stato creato dal template di base',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const updateScriptMutation = useMutation({
    mutationFn: async (data: { id: string; name?: string; content?: string; createNewVersion?: boolean }) => {
      const response = await fetch(`/api/sales-scripts/${data.id}`, {
        method: 'PUT',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nel salvataggio');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      setIsEditing(false);
      toast({
        title: 'Script salvato',
        description: 'Le modifiche sono state salvate con successo',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const activateScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(`/api/sales-scripts/${scriptId}/activate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'attivazione');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      toast({
        title: 'Script attivato',
        description: 'Lo script è ora attivo e verrà utilizzato dall\'AI',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const duplicateScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(`/api/sales-scripts/${scriptId}/duplicate`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nella duplicazione');
      }
      return response.json();
    },
    onSuccess: (newScript) => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      setSelectedScriptId(newScript.id);
      toast({
        title: 'Script duplicato',
        description: 'La copia dello script è stata creata',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const deleteScriptMutation = useMutation({
    mutationFn: async (scriptId: string) => {
      const response = await fetch(`/api/sales-scripts/${scriptId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Errore nell\'eliminazione');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/sales-scripts'] });
      setSelectedScriptId(null);
      toast({
        title: 'Script eliminato',
        description: 'Lo script è stato eliminato',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  useEffect(() => {
    if (selectedScript?.content) {
      try {
        const parsed = parseTextToBlocks(selectedScript.content, selectedScript.scriptType);
        if (parsed && parsed.phases && parsed.phases.length > 0) {
          setBlockStructure(parsed);
          setParsingFailed(false);
        } else {
          setParsingFailed(true);
          setEditorMode('text');
          toast({
            title: 'Parsing non riuscito',
            description: 'Lo script verrà aperto in modalità testo',
            variant: 'default',
          });
        }
      } catch (error) {
        console.error('Parser error:', error);
        setParsingFailed(true);
        setEditorMode('text');
        toast({
          title: 'Errore nel parsing',
          description: 'Impossibile analizzare la struttura. Usa modalità testo.',
          variant: 'destructive',
        });
      }
      setEditedContent(selectedScript.content);
      setEditedName(selectedScript.name);
    }
  }, [selectedScript]);

  const filteredScripts = scripts.filter(s => s.scriptType === activeTab);

  const togglePhase = (phaseId: string) => {
    const newExpanded = new Set(expandedPhases);
    if (newExpanded.has(phaseId)) {
      newExpanded.delete(phaseId);
    } else {
      newExpanded.add(phaseId);
    }
    setExpandedPhases(newExpanded);
  };

  const updateGlobalRule = (id: string, updated: GlobalRule) => {
    if (!blockStructure) return;
    setBlockStructure({
      ...blockStructure,
      globalRules: blockStructure.globalRules.map(r => 
        r.id === id ? updated : r
      )
    });
  };

  const updatePhase = (id: string, updated: Phase) => {
    if (!blockStructure) return;
    setBlockStructure({
      ...blockStructure,
      phases: blockStructure.phases.map(p => 
        p.id === id ? updated : p
      )
    });
  };

  const addNewPhase = () => {
    if (!blockStructure) return;
    const maxPhaseNum = Math.max(0, ...blockStructure.phases.map(p => parseInt(p.number) || 0));
    const newPhase: Phase = {
      id: `phase_${crypto.randomUUID()}`,
      number: String(maxPhaseNum + 1),
      name: 'Nuova Fase',
      description: '',
      steps: [],
    };
    const updatedStructure = {
      ...blockStructure,
      phases: [...blockStructure.phases.map(p => ({ ...p })), newPhase]
    };
    setBlockStructure(updatedStructure);
    toast({
      title: 'Fase aggiunta',
      description: `Fase ${newPhase.number} creata. Clicca per modificarla.`,
    });
  };

  const [phaseToDelete, setPhaseToDelete] = useState<string | null>(null);
  
  const deletePhase = (phaseId: string) => {
    if (!blockStructure) return;
    const updatedStructure = {
      ...blockStructure,
      phases: blockStructure.phases.filter(p => p.id !== phaseId).map(p => ({ ...p }))
    };
    setBlockStructure(updatedStructure);
    setPhaseToDelete(null);
    toast({
      title: 'Fase eliminata',
      description: 'La fase è stata rimossa dallo script',
    });
  };

  const handleEditorModeChange = (newMode: 'blocks' | 'text') => {
    if (newMode === 'blocks' && editorMode === 'text') {
      try {
        const parsed = parseTextToBlocks(editedContent, selectedScript!.scriptType);
        if (parsed && parsed.phases?.length > 0) {
          setBlockStructure(parsed);
          setParsingFailed(false);
        } else {
          toast({
            title: 'Parsing non riuscito',
            description: 'Continua in modalità testo',
            variant: 'default',
          });
          return;
        }
      } catch {
        toast({
          title: 'Errore nel parsing',
          description: 'Continua in modalità testo',
          variant: 'destructive',
        });
        return;
      }
    } else if (newMode === 'text' && editorMode === 'blocks') {
      if (blockStructure) {
        const regenerated = blocksToText(blockStructure);
        setEditedContent(regenerated);
      }
    }
    setEditorMode(newMode);
  };

  const handleSave = (createNewVersion: boolean = false) => {
    if (!selectedScriptId) return;
    
    let contentToSave: string;
    
    if (editorMode === 'blocks' && blockStructure) {
      contentToSave = blocksToText(blockStructure);
    } else {
      contentToSave = editedContent;
    }
    
    updateScriptMutation.mutate({
      id: selectedScriptId,
      name: editedName,
      content: contentToSave,
      createNewVersion,
    });
  };

  const handleCreateScript = () => {
    if (useTemplate) {
      createFromTemplateMutation.mutate({
        name: newScriptName.trim() || undefined,
        scriptType: newScriptType,
      });
    } else {
      if (!newScriptName.trim()) {
        toast({
          title: 'Errore',
          description: 'Inserisci un nome per lo script',
          variant: 'destructive',
        });
        return;
      }
      createScriptMutation.mutate({
        name: newScriptName,
        scriptType: newScriptType,
        content: '# Nuovo Script\n\nInserisci qui il contenuto dello script...',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar
        role="client"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-4 py-3 bg-card">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            {agentId && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation(`/client/sales-agents/${agentId}/analytics`)}
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Torna ad Analytics
                </Button>
                <Separator orientation="vertical" className="h-6" />
              </>
            )}
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Script Manager
              </h1>
              <p className="text-xs text-muted-foreground">
                Gestisci gli script di vendita del tuo AI Sales Agent
              </p>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => setShowGuideDialog(true)}
            className="gap-2"
          >
            <BookOpen className="h-4 w-4" />
            Guida
          </Button>
        </header>

        <div className="flex-1 flex overflow-hidden flex-col lg:flex-row">
          <div className="w-full lg:w-80 border-b lg:border-b-0 lg:border-r bg-muted/30 flex flex-col max-h-[40vh] lg:max-h-none">
            <div className="p-4 border-b">
              <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="discovery" className="text-xs">
                    Discovery
                  </TabsTrigger>
                  <TabsTrigger value="demo" className="text-xs">
                    Demo
                  </TabsTrigger>
                  <TabsTrigger value="objections" className="text-xs">
                    Obiezioni
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {filteredScripts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 mx-auto text-muted-foreground/50 mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      Nessuno script {scriptTypeLabels[activeTab]}
                    </p>
                    {scripts.length === 0 && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => seedDefaultsMutation.mutate()}
                        disabled={seedDefaultsMutation.isPending}
                      >
                        {seedDefaultsMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4 mr-2" />
                        )}
                        Carica Script Base
                      </Button>
                    )}
                  </div>
                ) : (
                  filteredScripts.map((script) => (
                    <Card
                      key={script.id}
                      className={cn(
                        'cursor-pointer transition-all hover:shadow-md',
                        selectedScriptId === script.id && 'ring-2 ring-primary'
                      )}
                      onClick={() => setSelectedScriptId(script.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium text-sm truncate">{script.name}</h3>
                            <p className="text-xs text-muted-foreground">v{script.version}</p>
                          </div>
                          {script.isActive && (
                            <Badge variant="default" className="ml-2 text-xs">
                              <Check className="h-3 w-3 mr-1" />
                              Attivo
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{script.structure?.phases?.length || 0} fasi</span>
                          <span>•</span>
                          <span>{script.usageCount || 0} utilizzi</span>
                        </div>
                      </CardContent>
                    </Card>
                  ))
                )}
              </div>
            </ScrollArea>

            <div className="p-4 border-t">
              <Dialog open={showNewScriptDialog} onOpenChange={setShowNewScriptDialog}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full">
                    <Plus className="h-4 w-4 mr-2" />
                    Nuovo Script
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
                        <Label htmlFor="use-template" className="text-sm font-medium">
                          Usa Template Base
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          Inizia con lo script base completo già configurato
                        </p>
                      </div>
                      <Switch
                        id="use-template"
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
                      onClick={handleCreateScript} 
                      disabled={createScriptMutation.isPending || createFromTemplateMutation.isPending}
                    >
                      {(createScriptMutation.isPending || createFromTemplateMutation.isPending) && (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      )}
                      {useTemplate ? 'Crea da Template' : 'Crea Vuoto'}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          <div className="flex-1 flex flex-col overflow-hidden">
            {!selectedScriptId ? (
              <div className="flex-1 flex items-center justify-center text-center p-8">
                <div>
                  <FileText className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
                  <h2 className="text-xl font-semibold mb-2">Seleziona uno Script</h2>
                  <p className="text-muted-foreground max-w-md">
                    Scegli uno script dalla lista a sinistra per visualizzarlo e modificarlo,
                    oppure crea un nuovo script personalizzato.
                  </p>
                </div>
              </div>
            ) : loadingScript ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : selectedScript ? (
              <>
                <div className="border-b px-4 py-3 bg-card flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge className={scriptTypeColors[selectedScript.scriptType]}>
                      {scriptTypeLabels[selectedScript.scriptType]}
                    </Badge>
                    {isEditing ? (
                      <Input
                        value={editedName}
                        onChange={(e) => setEditedName(e.target.value)}
                        className="h-8 w-64"
                      />
                    ) : (
                      <h2 className="font-semibold">{selectedScript.name}</h2>
                    )}
                    <span className="text-sm text-muted-foreground">v{selectedScript.version}</span>
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    {isEditing ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setIsEditing(false);
                            setEditedContent(selectedScript.content);
                            setEditedName(selectedScript.name);
                          }}
                        >
                          <X className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Annulla</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSave(false)}
                          disabled={updateScriptMutation.isPending}
                        >
                          <Save className="h-4 w-4 mr-1" />
                          Salva
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleSave(true)}
                          disabled={updateScriptMutation.isPending}
                        >
                          {updateScriptMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                          <History className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Nuova Versione</span>
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
                          <Edit3 className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Modifica</span>
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => duplicateScriptMutation.mutate(selectedScript.id)}
                          disabled={duplicateScriptMutation.isPending}
                        >
                          <Copy className="h-4 w-4 sm:mr-1" />
                          <span className="hidden sm:inline">Duplica</span>
                        </Button>
                        {!selectedScript.isActive && (
                          <Button
                            size="sm"
                            onClick={() => activateScriptMutation.mutate(selectedScript.id)}
                            disabled={activateScriptMutation.isPending}
                          >
                            <Play className="h-4 w-4 sm:mr-1" />
                            <span className="hidden sm:inline">Attiva</span>
                          </Button>
                        )}
                        {!selectedScript.isActive && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => {
                              if (confirm('Sei sicuro di voler eliminare questo script?')) {
                                deleteScriptMutation.mutate(selectedScript.id);
                              }
                            }}
                            disabled={deleteScriptMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                <div className="flex-1 flex overflow-hidden flex-col md:flex-row">
                  <div className="w-full md:w-1/2 border-b md:border-b-0 md:border-r overflow-hidden flex flex-col max-h-[50vh] md:max-h-none">
                    <div className="p-3 border-b bg-muted/50">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Struttura Script
                      </h3>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-4 space-y-3">
                        {selectedScript.structure?.phases?.map((phase, phaseIndex) => {
                          const phaseColors = [
                            'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20',
                            'border-l-purple-500 bg-purple-50/50 dark:bg-purple-950/20',
                            'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20',
                            'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20',
                            'border-l-rose-500 bg-rose-50/50 dark:bg-rose-950/20',
                          ];
                          const phaseColor = phaseColors[phaseIndex % phaseColors.length];
                          
                          return (
                          <Collapsible
                            key={phase.id}
                            open={expandedPhases.has(phase.id)}
                            onOpenChange={() => togglePhase(phase.id)}
                          >
                            <Card className={`border-l-4 ${phaseColor}`}>
                              <CollapsibleTrigger className="w-full">
                                <CardHeader className="p-3 hover:bg-muted/50 transition-colors">
                                  <div className="flex items-center gap-2">
                                    {expandedPhases.has(phase.id) ? (
                                      <ChevronDown className="h-4 w-4 text-primary" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                    )}
                                    <Badge className="text-xs bg-primary/10 text-primary border-primary/30">
                                      Fase {phase.number}
                                    </Badge>
                                    <span className="font-medium text-sm flex-1 text-left">{phase.name}</span>
                                    <Badge variant="secondary" className="text-xs">
                                      {phase.steps?.length || 0} step
                                    </Badge>
                                  </div>
                                </CardHeader>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <CardContent className="pt-0 pb-3 px-3">
                                  <div className="space-y-2 ml-6 border-l-2 border-dashed border-muted-foreground/30 pl-3">
                                    {phase.steps?.map((step) => (
                                      <div
                                        key={step.id}
                                        className="p-3 rounded-lg bg-background border shadow-sm hover:shadow-md transition-shadow"
                                      >
                                        <div className="flex items-center gap-2 mb-2">
                                          <Badge variant="secondary" className="text-xs bg-secondary">
                                            Step {step.number}
                                          </Badge>
                                          <span className="text-sm font-medium flex-1">{step.name}</span>
                                          <div className="flex items-center gap-1">
                                            {step.hasLadder && (
                                              <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800">
                                                Ladder
                                              </Badge>
                                            )}
                                            {step.questions?.length > 0 && (
                                              <Badge variant="outline" className="text-xs">
                                                {step.questions.length} Q
                                              </Badge>
                                            )}
                                          </div>
                                        </div>
                                        {step.objective && (
                                          <p className="text-xs text-muted-foreground mb-2 italic">
                                            {step.objective}
                                          </p>
                                        )}
                                        {step.questions?.length > 0 && (
                                          <div className="space-y-1 bg-muted/30 rounded p-2">
                                            {step.questions.slice(0, 2).map((q, i) => (
                                              <div
                                                key={i}
                                                className="flex items-start gap-2 text-xs"
                                              >
                                                <MessageSquare className="h-3 w-3 mt-0.5 text-blue-500 shrink-0" />
                                                <span className="text-muted-foreground line-clamp-1">
                                                  {q.text}
                                                </span>
                                              </div>
                                            ))}
                                            {step.questions.length > 2 && (
                                              <span className="text-xs text-primary/70 ml-5 font-medium">
                                                +{step.questions.length - 2} altre domande...
                                              </span>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                    {phase.checkpoints?.map((checkpoint) => (
                                      <div
                                        key={checkpoint.id}
                                        className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 shadow-sm"
                                      >
                                        <div className="flex items-center gap-2 mb-1">
                                          <AlertCircle className="h-4 w-4 text-orange-500" />
                                          <span className="text-xs font-semibold text-orange-800 dark:text-orange-200 uppercase tracking-wide">
                                            Checkpoint
                                          </span>
                                        </div>
                                        <p className="text-xs text-orange-700 dark:text-orange-300">
                                          {checkpoint.description}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </CardContent>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        )}) || (
                          <Alert>
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription>
                              Struttura non disponibile. Modifica lo script per generarla.
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                    </ScrollArea>
                  </div>

                  <div className="w-full md:w-1/2 overflow-hidden flex flex-col min-h-[40vh] md:min-h-0">
                    <div className="p-3 border-b bg-muted/50 flex items-center justify-between flex-wrap gap-2">
                      <h3 className="font-medium text-sm flex items-center gap-2">
                        <Edit3 className="h-4 w-4" />
                        <span className="hidden sm:inline">{isEditing ? 'Editor Contenuto' : 'Anteprima Contenuto'}</span>
                        <span className="sm:hidden">{isEditing ? 'Editor' : 'Anteprima'}</span>
                      </h3>
                      {isEditing && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant={editorMode === 'blocks' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleEditorModeChange('blocks')}
                            disabled={parsingFailed}
                          >
                            <Blocks className="h-4 w-4 mr-1" />
                            Blocchi
                          </Button>
                          <Button
                            variant={editorMode === 'text' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => handleEditorModeChange('text')}
                          >
                            <Code className="h-4 w-4 mr-1" />
                            Testo
                          </Button>
                        </div>
                      )}
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-4">
                        {isEditing ? (
                          editorMode === 'blocks' ? (
                            blockStructure ? (
                              <div className="space-y-4">
                                <TooltipProvider>
                                <div className="p-3 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 border border-blue-200/50 dark:border-blue-800/50">
                                  <div className="flex items-start gap-3">
                                    <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                                    <div className="flex-1">
                                      <p className="text-sm font-medium text-foreground mb-1">Consigli per l'Editor</p>
                                      <ul className="text-xs text-muted-foreground space-y-1">
                                        <li className="flex items-center gap-2">
                                          <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                          Clicca sulla matita per modificare ogni blocco
                                        </li>
                                        <li className="flex items-center gap-2">
                                          <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                          Le Fasi contengono Step, che contengono Domande
                                        </li>
                                        <li className="flex items-center gap-2">
                                          <span className="h-1 w-1 rounded-full bg-primary shrink-0" />
                                          Usa il Ladder per scalare obiezioni con domande progressive
                                        </li>
                                      </ul>
                                    </div>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0">
                                          <HelpCircle className="h-4 w-4 text-muted-foreground" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent side="left" className="max-w-xs">
                                        <p className="text-xs">
                                          <strong>Fase</strong>: Macro-sezione dello script (es. Apertura, Qualifica)<br/>
                                          <strong>Step</strong>: Azione specifica dentro una Fase<br/>
                                          <strong>Domanda</strong>: Cosa chiedere al prospect<br/>
                                          <strong>Ladder</strong>: Scala di domande progressive<br/>
                                          <strong>Checkpoint</strong>: Verifica prima di procedere<br/>
                                          <strong>Energia</strong>: Tono e ritmo vocale da usare
                                        </p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </div>
                                </div>
                                
                                {blockStructure.globalRules?.length > 0 && (
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                      <AlertCircle className="h-4 w-4" />
                                      Regole Globali
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Info className="h-3 w-3 text-muted-foreground/50" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">Regole applicate a tutto lo script, indipendentemente dalla fase</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </h4>
                                    {blockStructure.globalRules.map((rule) => (
                                      <BlockGlobalRule
                                        key={rule.id}
                                        rule={rule}
                                        onUpdate={(updated) => updateGlobalRule(rule.id, updated)}
                                      />
                                    ))}
                                  </div>
                                )}
                                
                                {blockStructure.phases?.length > 0 && (
                                  <div className="space-y-3">
                                    <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                                      <Target className="h-4 w-4" />
                                      Fasi dello Script
                                      <Tooltip>
                                        <TooltipTrigger>
                                          <Info className="h-3 w-3 text-muted-foreground/50" />
                                        </TooltipTrigger>
                                        <TooltipContent>
                                          <p className="text-xs">Ogni fase rappresenta una macro-sezione della conversazione</p>
                                        </TooltipContent>
                                      </Tooltip>
                                    </h4>
                                    {blockStructure.phases.map((phase) => (
                                      <div key={phase.id} className="relative group">
                                        <BlockPhase
                                          phase={phase}
                                          onUpdate={(updated) => updatePhase(phase.id, updated)}
                                          onDelete={() => deletePhase(phase.id)}
                                        />
                                      </div>
                                    ))}
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full border-dashed hover:border-primary hover:bg-primary/5"
                                      onClick={addNewPhase}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Aggiungi Fase
                                    </Button>
                                  </div>
                                )}
                                
                                {(!blockStructure.globalRules?.length && !blockStructure.phases?.length) && (
                                  <Alert>
                                    <AlertCircle className="h-4 w-4" />
                                    <AlertDescription>
                                      Nessun blocco trovato. Usa l'editor di testo per inserire il contenuto.
                                    </AlertDescription>
                                  </Alert>
                                )}
                                </TooltipProvider>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                              </div>
                            )
                          ) : (
                            <Textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              className="min-h-[600px] font-mono text-sm"
                              placeholder="Inserisci il contenuto dello script..."
                            />
                          )
                        ) : (
                          <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded-lg">
                            {selectedScript.content}
                          </pre>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {selectedScript.versions && selectedScript.versions.length > 0 && (
                  <div className="border-t p-4 bg-muted/30">
                    <h4 className="font-medium text-sm mb-3 flex items-center gap-2">
                      <History className="h-4 w-4" />
                      Cronologia Versioni
                    </h4>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedScript.versions.map((version) => (
                        <Badge
                          key={version.id}
                          variant="outline"
                          className="shrink-0 cursor-pointer hover:bg-primary/10"
                        >
                          v{version.version} - {new Date(version.createdAt).toLocaleDateString('it-IT')}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        </div>

        <Dialog open={showGuideDialog} onOpenChange={setShowGuideDialog}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Guida al Block Editor
              </DialogTitle>
            </DialogHeader>
            <ScrollArea className="flex-1">
              <div className="space-y-4 pr-4">
                <div className="text-sm text-muted-foreground space-y-4">
                  <section>
                    <h3 className="font-semibold text-base mb-2">🎯 Cosa Sono i "Blocchi"?</h3>
                    <p>Il Block Editor suddivide lo script in componenti logici e indipendenti:</p>
                    <ul className="list-disc list-inside space-y-1 mt-2 text-xs">
                      <li><strong>📋 Regola Critica:</strong> Divieti assoluti all'inizio dello script</li>
                      <li><strong>📍 Fase:</strong> Contenitore con numero + nome + descrizione</li>
                      <li><strong>⚡ Energia & Tonalità:</strong> Livello energia, tono, volume, ritmo</li>
                      <li><strong>🎯 Step:</strong> Numero, nome, obiettivo specifico</li>
                      <li><strong>📌 Domanda:</strong> Testo domanda + istruzioni (Aspetta, Ascolta, Reagisci)</li>
                      <li><strong>🍪 Biscottino:</strong> Trigger + frase di recupero se il prospect divaga</li>
                      <li><strong>⛔ Checkpoint:</strong> Checklist di verifica prima di procedere</li>
                      <li><strong>🔍 Ladder dei Perché:</strong> Livelli 1-6 per scavare il vero problema</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">🚀 Come Accedere all'Editor a Blocchi</h3>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Vai a <strong>Sales Agents AI → Script Manager</strong></li>
                      <li>Seleziona uno script dalla lista (Discovery, Demo, o Obiezioni)</li>
                      <li>Clicca su <strong>Modifica</strong></li>
                      <li>Scegli tra <strong>🧩 Blocchi</strong> (default) o <strong>💻 Testo</strong></li>
                    </ol>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">📖 Come Usare l'Editor a Blocchi</h3>
                    <div className="space-y-2 text-xs">
                      <div>
                        <strong>1️⃣ Visualizzare i Blocchi</strong>
                        <p className="ml-4 mt-1">L'editor mostra una lista di blocchi colorati con icone. Ogni blocco ha un tipo specifico.</p>
                      </div>
                      <div>
                        <strong>2️⃣ Espandere/Collassare</strong>
                        <p className="ml-4 mt-1">Clicca sul triangolo ▶️ / ▼️ a sinistra per espandere/collassare i dettagli.</p>
                      </div>
                      <div>
                        <strong>3️⃣ Modificare un Blocco</strong>
                        <p className="ml-4 mt-1">Espandi il blocco e clicca <strong>Modifica</strong> per editare i campi.</p>
                      </div>
                      <div>
                        <strong>4️⃣ Salvare le Modifiche</strong>
                        <p className="ml-4 mt-1">Clicca <strong>Salva</strong> per salvare le modifiche del blocco, o <strong>Annulla</strong> per scartarle.</p>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">💡 Esempi Pratici</h3>
                    <div className="space-y-2 text-xs">
                      <div className="bg-muted p-2 rounded">
                        <strong>Modificare l'Energia di una Fase:</strong>
                        <ol className="list-decimal list-inside ml-2 mt-1">
                          <li>Espandi <strong>FASE #1</strong></li>
                          <li>Espandi <strong>⚡ ENERGIA & TONALITÀ</strong></li>
                          <li>Clicca <strong>Modifica</strong></li>
                          <li>Seleziona il livello energia dal dropdown</li>
                          <li>Clicca <strong>Salva</strong></li>
                        </ol>
                      </div>
                      <div className="bg-muted p-2 rounded">
                        <strong>Aggiungere una Domanda:</strong>
                        <ol className="list-decimal list-inside ml-2 mt-1">
                          <li>Espandi <strong>FASE #1 → STEP 1</strong></li>
                          <li>Clicca <strong>➕ Aggiungi Domanda</strong></li>
                          <li>Compila: Testo, Istruzioni, Reazioni</li>
                          <li>Clicca <strong>Salva</strong></li>
                        </ol>
                      </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">🔄 Passare tra Blocchi e Testo</h3>
                    <p className="text-xs">Mentre modifichi, puoi switchare tra:</p>
                    <ul className="list-disc list-inside text-xs ml-2 space-y-1">
                      <li><strong>🧩 Blocchi:</strong> Perfetto per modifiche strutturate e precise</li>
                      <li><strong>💻 Testo:</strong> Utile per copia/incolla veloce e riformattazioni</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">💾 Salvare gli Script</h3>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li><strong>Salva:</strong> Salva senza cronologia</li>
                      <li><strong>Salva Nuova Versione:</strong> Salva e crea checkpoint nella cronologia</li>
                    </ul>
                  </section>

                  <section>
                    <h3 className="font-semibold text-base mb-2">🎯 Best Practices</h3>
                    <p className="text-xs font-semibold mb-1">✅ Fai così:</p>
                    <ul className="list-disc list-inside text-xs space-y-1 mb-2">
                      <li>Modifica un blocco alla volta</li>
                      <li>Usa i Checkpoint - verificali prima di procedere</li>
                      <li>Prova il Testo - dopo aver modificato</li>
                      <li>Versiona Spesso - Salva Nuova Versione per i cambiamenti importanti</li>
                    </ul>
                    <p className="text-xs font-semibold mb-1">❌ Evita:</p>
                    <ul className="list-disc list-inside text-xs space-y-1">
                      <li>Non cancellare i Checkpoint - sono critici</li>
                      <li>Non saltare gli Step - l'ordine è importante</li>
                      <li>Non modificare i Divieti Assoluti</li>
                      <li>Non lasciare campi vuoti obbligatori</li>
                    </ul>
                  </section>
                </div>
              </div>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
