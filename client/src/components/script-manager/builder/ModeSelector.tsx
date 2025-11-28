import React, { useState } from 'react';
import { useBuilder } from './BuilderContext';
import { Button } from '@/components/ui/button';
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
import { ChevronDown, FileText, Hand, Sparkles, Wand2 } from 'lucide-react';
import type { BuilderMode, ScriptType } from './types';

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

  const currentMode = MODE_CONFIG[builder.mode];
  const CurrentIcon = currentMode.icon;

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
      const response = await fetch(`/api/script-builder/templates/${selectedTemplate}`);
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

      <Dialog open={showAIDialog} onOpenChange={setShowAIDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-purple-600" />
              Generazione AI
            </DialogTitle>
            <DialogDescription>
              La generazione AI sarà disponibile dopo aver configurato l'integrazione Gemini.
              Per ora, usa la modalità Template o Manuale.
            </DialogDescription>
          </DialogHeader>
          <div className="py-8 text-center">
            <Wand2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-sm text-muted-foreground">
              Presto potrai selezionare un agente e generare script personalizzati automaticamente.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAIDialog(false)}>
              Chiudi
            </Button>
            <Button onClick={() => {
              setShowAIDialog(false);
              setShowTemplateDialog(true);
            }}>
              Usa Template invece
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
