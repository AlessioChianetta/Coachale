import { useState } from 'react';
import { FileText, Phone, Presentation, MessageSquare, Check, Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import type { ScriptBlockStructure } from '@shared/script-blocks';
import type { ScriptType } from '../index';

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (template: ScriptBlockStructure, type: ScriptType) => void;
}

interface TemplateOption {
  id: string;
  type: ScriptType;
  name: string;
  description: string;
  icon: React.ReactNode;
  phases: number;
  steps: number;
  color: string;
}

const templates: TemplateOption[] = [
  {
    id: 'discovery',
    type: 'discovery',
    name: 'Discovery Call',
    description: 'Script completo per la prima call di qualificazione. Include apertura, pain discovery, ladder dei perché e chiusura.',
    icon: <Phone className="h-6 w-6" />,
    phases: 7,
    steps: 15,
    color: 'border-blue-500/50 bg-blue-500/5 hover:bg-blue-500/10'
  },
  {
    id: 'demo',
    type: 'demo',
    name: 'Demo Call',
    description: 'Script per presentare il prodotto/servizio. Focus su benefici, casi studio e gestione obiezioni live.',
    icon: <Presentation className="h-6 w-6" />,
    phases: 5,
    steps: 12,
    color: 'border-green-500/50 bg-green-500/5 hover:bg-green-500/10'
  },
  {
    id: 'objections',
    type: 'objections',
    name: 'Gestione Obiezioni',
    description: 'Script per gestire le obiezioni più comuni. Tecniche di reframe e ladder per ogni tipo di resistenza.',
    icon: <MessageSquare className="h-6 w-6" />,
    phases: 10,
    steps: 20,
    color: 'border-orange-500/50 bg-orange-500/5 hover:bg-orange-500/10'
  }
];

export function TemplatePicker({ open, onOpenChange, onSelect }: TemplatePickerProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async () => {
    if (!selectedTemplate) return;
    
    const template = templates.find(t => t.id === selectedTemplate);
    if (!template) return;
    
    setIsLoading(true);
    
    try {
      const res = await fetch(`/api/script-builder/template/${template.type}`, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      if (!res.ok) {
        const demoStructure: ScriptBlockStructure = {
          metadata: {
            name: template.name,
            type: template.type,
            version: '1.0.0'
          },
          globalRules: [],
          phases: [
            {
              id: 'phase_1',
              type: 'phase',
              number: '1',
              name: 'Apertura',
              description: 'Avvia la chiamata e imposta la direzione',
              steps: [
                {
                  id: 'step_1',
                  type: 'step',
                  number: 1,
                  name: 'Saluto Iniziale',
                  objective: 'Creare connessione e rompere il ghiaccio',
                  questions: [
                    { id: 'q_1', type: 'question', text: 'Ciao! Come stai oggi?' },
                    { id: 'q_2', type: 'question', text: 'Da dove mi chiami?' }
                  ]
                }
              ]
            },
            {
              id: 'phase_2',
              type: 'phase',
              number: '2',
              name: 'Discovery',
              description: 'Scopri i pain point del prospect',
              steps: [
                {
                  id: 'step_2',
                  type: 'step',
                  number: 1,
                  name: 'Pain Point',
                  objective: 'Identificare il problema principale',
                  questions: [
                    { id: 'q_3', type: 'question', text: 'Qual è la sfida principale che stai affrontando?' }
                  ]
                }
              ]
            }
          ]
        };
        
        onSelect(demoStructure, template.type);
      } else {
        const data = await res.json();
        onSelect(data.structure, template.type);
      }
    } catch (error) {
      console.error('Error loading template:', error);
      const demoStructure: ScriptBlockStructure = {
        metadata: {
          name: templates.find(t => t.id === selectedTemplate)?.name || 'Script',
          type: template.type,
          version: '1.0.0'
        },
        globalRules: [],
        phases: [
          {
            id: 'phase_demo_1',
            type: 'phase',
            number: '1',
            name: 'Fase Iniziale',
            description: 'Prima fase dello script',
            steps: []
          }
        ]
      };
      onSelect(demoStructure, template.type);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Scegli un Template
          </DialogTitle>
          <DialogDescription>
            Seleziona un template base da cui partire. Potrai personalizzarlo completamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 py-4">
          {templates.map((template) => (
            <Card
              key={template.id}
              onClick={() => setSelectedTemplate(template.id)}
              className={cn(
                'cursor-pointer transition-all',
                template.color,
                selectedTemplate === template.id && 'ring-2 ring-primary'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'p-2 rounded-lg',
                      template.type === 'discovery' && 'bg-blue-500/20 text-blue-600',
                      template.type === 'demo' && 'bg-green-500/20 text-green-600',
                      template.type === 'objections' && 'bg-orange-500/20 text-orange-600'
                    )}>
                      {template.icon}
                    </div>
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs">
                          {template.phases} fasi
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {template.steps} step
                        </Badge>
                      </div>
                    </div>
                  </div>
                  {selectedTemplate === template.id && (
                    <div className="p-1 rounded-full bg-primary text-primary-foreground">
                      <Check className="h-4 w-4" />
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <CardDescription>{template.description}</CardDescription>
              </CardContent>
            </Card>
          ))}
        </div>
        
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button 
            onClick={handleSelect} 
            disabled={!selectedTemplate || isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Caricamento...
              </>
            ) : (
              'Usa Template'
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
