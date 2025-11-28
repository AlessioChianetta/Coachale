import React, { useState } from 'react';
import { useBuilder } from './BuilderContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { Phase, Step, Question, EnergySettings, Checkpoint, Ladder, LadderLevel, ResistanceHandling, Biscottino } from '@shared/script-blocks';
import { cn } from '@/lib/utils';
import { CheckSquare, Info, MessageSquare, Target, Zap, Plus, Trash2, ChevronDown, ChevronRight } from 'lucide-react';

function ArrayEditor({ 
  label, 
  values, 
  onChange,
  placeholder = "Aggiungi elemento..."
}: { 
  label: string; 
  values: string[]; 
  onChange: (values: string[]) => void;
  placeholder?: string;
}) {
  const [newItem, setNewItem] = useState('');
  
  const addItem = () => {
    if (newItem.trim()) {
      onChange([...values, newItem.trim()]);
      setNewItem('');
    }
  };
  
  const removeItem = (index: number) => {
    onChange(values.filter((_, i) => i !== index));
  };
  
  return (
    <div className="space-y-2">
      <Label className="text-xs">{label}</Label>
      <div className="flex gap-2">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="h-8 text-xs"
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addItem())}
        />
        <Button type="button" size="sm" variant="outline" onClick={addItem} className="h-8">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {values.map((item, idx) => (
            <Badge key={idx} variant="secondary" className="text-xs pr-1">
              {item}
              <button
                onClick={() => removeItem(idx)}
                className="ml-1 hover:text-destructive"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

function EnergyEditor({
  energy,
  onChange
}: {
  energy: EnergySettings | undefined;
  onChange: (energy: EnergySettings) => void;
}) {
  const defaultEnergy: EnergySettings = {
    level: 'MEDIO',
    tone: '',
    volume: '',
    rhythm: '',
    vocabulary: []
  };
  const current = energy || defaultEnergy;

  const update = (partial: Partial<EnergySettings>) => {
    onChange({ ...current, ...partial });
  };

  return (
    <Card className="bg-muted/50">
      <CardContent className="p-3 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Livello</Label>
            <Select value={current.level} onValueChange={(v) => update({ level: v })}>
              <SelectTrigger className="mt-1 h-8">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BASSO">Basso - Calmo</SelectItem>
                <SelectItem value="MEDIO">Medio - Professionale</SelectItem>
                <SelectItem value="ALTO">Alto - Energico</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Tono</Label>
            <Input
              value={current.tone}
              onChange={(e) => update({ tone: e.target.value })}
              className="mt-1 h-8"
              placeholder="Curioso, empatico..."
            />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Volume</Label>
            <Input
              value={current.volume}
              onChange={(e) => update({ volume: e.target.value })}
              className="mt-1 h-8"
              placeholder="Moderato, forte..."
            />
          </div>
          <div>
            <Label className="text-xs">Ritmo</Label>
            <Input
              value={current.rhythm}
              onChange={(e) => update({ rhythm: e.target.value })}
              className="mt-1 h-8"
              placeholder="Calmo, dinamico..."
            />
          </div>
        </div>

        <div>
          <Label className="text-xs">Inflessioni</Label>
          <Input
            value={current.inflections || ''}
            onChange={(e) => update({ inflections: e.target.value })}
            className="mt-1 h-8"
            placeholder="Varie, costanti..."
          />
        </div>

        <div>
          <Label className="text-xs">Mindset</Label>
          <Textarea
            value={current.mindset || ''}
            onChange={(e) => update({ mindset: e.target.value })}
            className="mt-1 min-h-[50px]"
            placeholder="Mentalità da adottare..."
          />
        </div>

        <ArrayEditor
          label="Vocabolario Positivo"
          values={current.vocabulary || []}
          onChange={(v) => update({ vocabulary: v })}
          placeholder="Aggiungi parola..."
        />

        <ArrayEditor
          label="Vocabolario Negativo"
          values={current.negativeVocabulary || []}
          onChange={(v) => update({ negativeVocabulary: v })}
          placeholder="Parola da evitare..."
        />

        <div>
          <Label className="text-xs">Esempio</Label>
          <Textarea
            value={current.example || ''}
            onChange={(e) => update({ example: e.target.value })}
            className="mt-1 min-h-[50px]"
            placeholder="Esempio di tono da usare..."
          />
        </div>
      </CardContent>
    </Card>
  );
}

function ResistanceHandlingEditor({
  resistance,
  onChange
}: {
  resistance: ResistanceHandling | undefined;
  onChange: (r: ResistanceHandling | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(!!resistance);

  if (!resistance && !isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          onChange({ trigger: '', response: '' });
          setIsOpen(true);
        }}
        className="w-full"
      >
        <Plus className="h-3 w-3 mr-2" />
        Aggiungi Gestione Resistenza
      </Button>
    );
  }

  const addStep = () => {
    onChange({
      ...resistance!,
      steps: [...(resistance?.steps || []), { action: '', script: '' }]
    });
  };

  const updateStep = (idx: number, field: 'action' | 'script', value: string) => {
    if (!resistance?.steps) return;
    const newSteps = [...resistance.steps];
    newSteps[idx] = { ...newSteps[idx], [field]: value };
    onChange({ ...resistance, steps: newSteps });
  };

  const removeStep = (idx: number) => {
    if (!resistance?.steps) return;
    onChange({
      ...resistance,
      steps: resistance.steps.filter((_, i) => i !== idx)
    });
  };

  return (
    <Card className="bg-rose-50/50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800">
      <CardContent className="p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">🛡️ Gestione Resistenza</Label>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              onChange(undefined);
              setIsOpen(false);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
        <div>
          <Label className="text-xs">Trigger</Label>
          <Input
            value={resistance?.trigger || ''}
            onChange={(e) => onChange({ ...resistance!, trigger: e.target.value })}
            className="mt-1 h-8"
            placeholder="Quando il prospect resiste..."
          />
        </div>
        <div>
          <Label className="text-xs">Risposta</Label>
          <Textarea
            value={resistance?.response || ''}
            onChange={(e) => onChange({ ...resistance!, response: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Come rispondere..."
          />
        </div>
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Step di Escalation</Label>
            <Button type="button" size="sm" variant="outline" onClick={addStep} className="h-6 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Step
            </Button>
          </div>
          {resistance?.steps && resistance.steps.length > 0 && (
            <div className="space-y-2">
              {resistance.steps.map((step, idx) => (
                <div key={idx} className="border rounded p-2 bg-background space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">Step {idx + 1}</span>
                    <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div>
                    <Label className="text-xs">Azione</Label>
                    <Input
                      value={step.action}
                      onChange={(e) => updateStep(idx, 'action', e.target.value)}
                      className="mt-1 h-7 text-xs"
                      placeholder="Es: Isola l'obiezione..."
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Script</Label>
                    <Input
                      value={step.script}
                      onChange={(e) => updateStep(idx, 'script', e.target.value)}
                      className="mt-1 h-7 text-xs"
                      placeholder="Cosa dire..."
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function CheckpointEditor({
  checkpoint,
  onChange
}: {
  checkpoint: Checkpoint | undefined;
  onChange: (c: Checkpoint | undefined) => void;
}) {
  const [isOpen, setIsOpen] = useState(!!checkpoint);
  const [newCheck, setNewCheck] = useState('');

  if (!checkpoint && !isOpen) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => {
          onChange({ title: 'Checkpoint', checks: [] });
          setIsOpen(true);
        }}
        className="w-full"
      >
        <Plus className="h-3 w-3 mr-2" />
        Aggiungi Checkpoint
      </Button>
    );
  }

  const addCheck = () => {
    if (newCheck.trim() && checkpoint) {
      onChange({ ...checkpoint, checks: [...checkpoint.checks, newCheck.trim()] });
      setNewCheck('');
    }
  };

  const removeCheck = (idx: number) => {
    if (checkpoint) {
      onChange({ ...checkpoint, checks: checkpoint.checks.filter((_, i) => i !== idx) });
    }
  };

  return (
    <Card className="bg-orange-50/50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">⛔ Checkpoint</Label>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => {
              onChange(undefined);
              setIsOpen(false);
            }}
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <div>
          <Label className="text-xs">Titolo</Label>
          <Input
            value={checkpoint?.title || ''}
            onChange={(e) => onChange({ ...checkpoint!, title: e.target.value })}
            className="mt-1 h-8"
          />
        </div>

        <div>
          <Label className="text-xs">Checks di Verifica</Label>
          <div className="flex gap-2 mt-1">
            <Input
              value={newCheck}
              onChange={(e) => setNewCheck(e.target.value)}
              placeholder="Aggiungi check..."
              className="h-8 text-xs"
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addCheck())}
            />
            <Button type="button" size="sm" variant="outline" onClick={addCheck} className="h-8">
              <Plus className="h-3 w-3" />
            </Button>
          </div>
          {checkpoint?.checks && checkpoint.checks.length > 0 && (
            <div className="space-y-1 mt-2">
              {checkpoint.checks.map((check, idx) => (
                <div key={idx} className="flex items-center gap-2 text-xs bg-background p-2 rounded">
                  <span className="text-green-600">✓</span>
                  <span className="flex-1">{check}</span>
                  <button onClick={() => removeCheck(idx)} className="text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <Label className="text-xs">Test Finale</Label>
          <Input
            value={checkpoint?.testFinale || ''}
            onChange={(e) => onChange({ ...checkpoint!, testFinale: e.target.value })}
            className="mt-1 h-8"
            placeholder="Test per verificare comprensione..."
          />
        </div>

        <ArrayEditor
          label="Esempi Test Finale"
          values={checkpoint?.testFinaleExamples || []}
          onChange={(v) => onChange({ ...checkpoint!, testFinaleExamples: v })}
          placeholder="Esempio risposta..."
        />

        <div>
          <Label className="text-xs">Reminder</Label>
          <Textarea
            value={checkpoint?.reminder || ''}
            onChange={(e) => onChange({ ...checkpoint!, reminder: e.target.value })}
            className="mt-1 min-h-[50px]"
            placeholder="Promemoria importante..."
          />
        </div>

        <ResistanceHandlingEditor
          resistance={checkpoint?.resistanceHandling}
          onChange={(r) => onChange({ ...checkpoint!, resistanceHandling: r })}
        />
      </CardContent>
    </Card>
  );
}

function LadderEditor({
  ladder,
  onChange
}: {
  ladder: Ladder | undefined;
  onChange: (l: Ladder | undefined) => void;
}) {
  const [expandedLevel, setExpandedLevel] = useState<number | null>(null);

  if (!ladder) {
    return (
      <Button 
        variant="outline" 
        size="sm" 
        onClick={() => onChange({
          title: 'Ladder dei Perché',
          levels: [{ number: 1, name: 'Livello 1', question: '' }]
        })}
        className="w-full"
      >
        <Plus className="h-3 w-3 mr-2" />
        Aggiungi Ladder
      </Button>
    );
  }

  const addLevel = () => {
    const newNum = (ladder.levels?.length || 0) + 1;
    onChange({
      ...ladder,
      levels: [...(ladder.levels || []), { number: newNum, name: `Livello ${newNum}`, question: '' }]
    });
  };

  const removeLevel = (idx: number) => {
    onChange({
      ...ladder,
      levels: ladder.levels.filter((_, i) => i !== idx).map((l, i) => ({ ...l, number: i + 1 }))
    });
  };

  const updateLevel = (idx: number, updates: Partial<LadderLevel>) => {
    onChange({
      ...ladder,
      levels: ladder.levels.map((l, i) => i === idx ? { ...l, ...updates } : l)
    });
  };

  return (
    <Card className="bg-indigo-50/50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium">🪜 Ladder dei Perché</Label>
          <Button variant="ghost" size="sm" onClick={() => onChange(undefined)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>

        <div>
          <Label className="text-xs">Titolo</Label>
          <Input
            value={ladder.title}
            onChange={(e) => onChange({ ...ladder, title: e.target.value })}
            className="mt-1 h-8"
          />
        </div>

        <ArrayEditor
          label="Quando Attivarla"
          values={ladder.whenToUse || []}
          onChange={(v) => onChange({ ...ladder, whenToUse: v })}
          placeholder="Condizione attivazione..."
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <Label className="text-xs">Livelli</Label>
            <Button type="button" size="sm" variant="outline" onClick={addLevel} className="h-6 text-xs">
              <Plus className="h-3 w-3 mr-1" /> Livello
            </Button>
          </div>
          <div className="space-y-2">
            {ladder.levels?.map((level, idx) => (
              <Collapsible 
                key={idx} 
                open={expandedLevel === idx}
                onOpenChange={(open) => setExpandedLevel(open ? idx : null)}
              >
                <div className="border rounded p-2 bg-background">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {expandedLevel === idx ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                        <span className="text-xs font-medium">Livello {level.number}: {level.name}</span>
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); removeLevel(idx); }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">Nome</Label>
                        <Input
                          value={level.name}
                          onChange={(e) => updateLevel(idx, { name: e.target.value })}
                          className="mt-1 h-7 text-xs"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Tono</Label>
                        <Input
                          value={level.tone || ''}
                          onChange={(e) => updateLevel(idx, { tone: e.target.value })}
                          className="mt-1 h-7 text-xs"
                          placeholder="Tono per questo livello..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label className="text-xs">Obiettivo</Label>
                      <Input
                        value={level.objective || ''}
                        onChange={(e) => updateLevel(idx, { objective: e.target.value })}
                        className="mt-1 h-7 text-xs"
                        placeholder="Obiettivo di questo livello..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Domanda</Label>
                      <Textarea
                        value={level.question}
                        onChange={(e) => updateLevel(idx, { question: e.target.value })}
                        className="mt-1 min-h-[50px] text-xs"
                        placeholder="Domanda da porre..."
                      />
                    </div>
                    <div>
                      <Label className="text-xs">Note</Label>
                      <Textarea
                        value={level.notes || ''}
                        onChange={(e) => updateLevel(idx, { notes: e.target.value })}
                        className="mt-1 min-h-[40px] text-xs"
                        placeholder="Note aggiuntive..."
                      />
                    </div>
                    
                    <div className="pt-2 border-t">
                      <div className="flex items-center justify-between mb-2">
                        <Label className="text-xs">Esempi Dialogo</Label>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const newExamples = [...(level.examples || []), { clientSays: '', youSay: '' }];
                            updateLevel(idx, { examples: newExamples });
                          }}
                          className="h-6 text-xs"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Esempio
                        </Button>
                      </div>
                      {level.examples && level.examples.length > 0 && (
                        <div className="space-y-2">
                          {level.examples.map((ex, exIdx) => (
                            <div key={exIdx} className="border rounded p-2 bg-muted/30 space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">Esempio {exIdx + 1}</span>
                                <button
                                  onClick={() => {
                                    const newExamples = level.examples!.filter((_, i) => i !== exIdx);
                                    updateLevel(idx, { examples: newExamples.length > 0 ? newExamples : undefined });
                                  }}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                              <div>
                                <Label className="text-[10px]">Cliente dice:</Label>
                                <Input
                                  value={ex.clientSays}
                                  onChange={(e) => {
                                    const newExamples = [...level.examples!];
                                    newExamples[exIdx] = { ...newExamples[exIdx], clientSays: e.target.value };
                                    updateLevel(idx, { examples: newExamples });
                                  }}
                                  className="mt-0.5 h-6 text-xs"
                                  placeholder="Cosa dice il cliente..."
                                />
                              </div>
                              <div>
                                <Label className="text-[10px]">Tu rispondi:</Label>
                                <Input
                                  value={ex.youSay}
                                  onChange={(e) => {
                                    const newExamples = [...level.examples!];
                                    newExamples[exIdx] = { ...newExamples[exIdx], youSay: e.target.value };
                                    updateLevel(idx, { examples: newExamples });
                                  }}
                                  className="mt-0.5 h-6 text-xs"
                                  placeholder="Come rispondi..."
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </div>

        <ArrayEditor
          label="Stop Quando"
          values={ladder.stopWhen || []}
          onChange={(v) => onChange({ ...ladder, stopWhen: v })}
          placeholder="Fermarsi quando..."
        />

        <ArrayEditor
          label="NON Fermarti Quando"
          values={ladder.dontStopWhen || []}
          onChange={(v) => onChange({ ...ladder, dontStopWhen: v })}
          placeholder="NON fermarti se..."
        />

        <ArrayEditor
          label="Frasi Utili"
          values={ladder.helpfulPhrases || []}
          onChange={(v) => onChange({ ...ladder, helpfulPhrases: v })}
          placeholder="Frase utile..."
        />

        <ArrayEditor
          label="Segnali Gold"
          values={ladder.goldSignals || []}
          onChange={(v) => onChange({ ...ladder, goldSignals: v })}
          placeholder="Segnale positivo..."
        />

        <ResistanceHandlingEditor
          resistance={ladder.resistanceHandling}
          onChange={(r) => onChange({ ...ladder, resistanceHandling: r })}
        />
      </CardContent>
    </Card>
  );
}

function EmptyInspector() {
  return (
    <div className="flex flex-col items-center justify-center h-full p-8 text-center">
      <Info className="h-12 w-12 text-muted-foreground/30 mb-4" />
      <h3 className="font-medium mb-2">Nessun blocco selezionato</h3>
      <p className="text-sm text-muted-foreground">
        Seleziona un blocco nel canvas per vederne e modificarne le proprietà
      </p>
    </div>
  );
}

function PhaseInspectorPanel({ phase }: { phase: Phase }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Phase>) => {
    builder.updatePhase(phase.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-primary">
        <Target className="h-5 w-5" />
        <span className="font-semibold">Fase {phase.number}</span>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="phase-name" className="text-xs">Nome Fase</Label>
          <Input
            id="phase-name"
            value={phase.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="phase-description" className="text-xs">Descrizione</Label>
          <Textarea
            id="phase-description"
            value={phase.description || ''}
            onChange={(e) => handleUpdate({ description: e.target.value })}
            className="mt-1 min-h-[80px]"
            placeholder="Obiettivo di questa fase..."
          />
        </div>

        <div>
          <Label htmlFor="phase-transition" className="text-xs">Frase di Transizione</Label>
          <Textarea
            id="phase-transition"
            value={phase.transition || ''}
            onChange={(e) => handleUpdate({ transition: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Come passare alla fase successiva..."
          />
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Impostazioni Energia
        </h4>
        <EnergyEditor
          energy={phase.energy}
          onChange={(energy) => handleUpdate({ energy })}
        />
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">⛔ Checkpoint Fase</h4>
        <CheckpointEditor
          checkpoint={phase.checkpoint}
          onChange={(checkpoint) => handleUpdate({ checkpoint })}
        />
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Step contenuti: {phase.steps?.length || 0}</p>
        <p>Domande totali: {phase.steps?.reduce((acc, s) => acc + (s.questions?.length || 0), 0) || 0}</p>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">📄 Anteprima Testo</h4>
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2 text-sm">
            <div>
              <span className="font-semibold">Fase {phase.number}: {phase.name}</span>
            </div>
            {phase.description && (
              <div className="text-muted-foreground italic">
                {phase.description}
              </div>
            )}
            {phase.transition && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-xs font-medium">Transizione:</span>
                <p className="text-muted-foreground">{phase.transition}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">⚙️ Riepilogo Completo Impostazioni</h4>
        <Card className="bg-gradient-to-br from-muted/30 to-muted/50">
          <CardContent className="p-4 space-y-3 text-xs">
            {/* Phase Settings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-primary font-semibold">
                <Target className="h-4 w-4" />
                <span>Fase {phase.number}</span>
              </div>
              <div className="pl-6 space-y-1.5 text-muted-foreground">
                <div><span className="font-medium text-foreground">Nome:</span> {phase.name}</div>
                {phase.description && (
                  <div><span className="font-medium text-foreground">Descrizione:</span> {phase.description}</div>
                )}
                {phase.transition && (
                  <div><span className="font-medium text-foreground">Transizione:</span> {phase.transition}</div>
                )}
              </div>
            </div>

            {/* Energy Settings */}
            {phase.energy && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 font-semibold">
                  <Zap className="h-4 w-4" />
                  <span>Energia</span>
                </div>
                <div className="pl-6 space-y-1.5 text-muted-foreground">
                  <div><span className="font-medium text-foreground">Livello:</span> {phase.energy.level}</div>
                  {phase.energy.tone && (
                    <div><span className="font-medium text-foreground">Tono:</span> {phase.energy.tone}</div>
                  )}
                  {phase.energy.volume && (
                    <div><span className="font-medium text-foreground">Volume:</span> {phase.energy.volume}</div>
                  )}
                  {phase.energy.rhythm && (
                    <div><span className="font-medium text-foreground">Ritmo:</span> {phase.energy.rhythm}</div>
                  )}
                  {phase.energy.vocabulary && phase.energy.vocabulary.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">Vocabolario:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {phase.energy.vocabulary.map((word, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">{word}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Steps Summary */}
            {phase.steps && phase.steps.length > 0 && (
              <div className="pt-2 border-t">
                <div className="font-medium text-foreground mb-1">
                  Step contenuti: {phase.steps.length}
                </div>
                <div className="font-medium text-foreground">
                  Domande totali: {phase.steps.reduce((acc, s) => acc + (s.questions?.length || 0), 0)}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StepInspectorPanel({ step, phaseId }: { step: Step; phaseId: string }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Step>) => {
    builder.updateStep(phaseId, step.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
        <CheckSquare className="h-5 w-5" />
        <span className="font-semibold">Step {step.number}</span>
      </div>

      <div className="space-y-3">
        <div>
          <Label htmlFor="step-name" className="text-xs">Nome Step</Label>
          <Input
            id="step-name"
            value={step.name}
            onChange={(e) => handleUpdate({ name: e.target.value })}
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="step-objective" className="text-xs">Obiettivo</Label>
          <Textarea
            id="step-objective"
            value={step.objective || ''}
            onChange={(e) => handleUpdate({ objective: e.target.value })}
            className="mt-1 min-h-[80px]"
            placeholder="Cosa vuoi ottenere in questo step..."
          />
        </div>

        <div>
          <Label htmlFor="step-notes" className="text-xs">Note per l'AI</Label>
          <Textarea
            id="step-notes"
            value={step.notes || ''}
            onChange={(e) => handleUpdate({ notes: e.target.value })}
            className="mt-1 min-h-[60px]"
            placeholder="Istruzioni comportamentali specifiche..."
          />
        </div>

        <div>
          <Label htmlFor="step-transition" className="text-xs">Transizione</Label>
          <Textarea
            id="step-transition"
            value={step.transition || ''}
            onChange={(e) => handleUpdate({ transition: e.target.value })}
            className="mt-1 min-h-[50px]"
            placeholder="Come passare allo step successivo..."
          />
        </div>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4" />
          Impostazioni Energia Step
        </h4>
        <EnergyEditor
          energy={step.energy}
          onChange={(energy) => handleUpdate({ energy })}
        />
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">🪜 Ladder dei Perché</h4>
        <LadderEditor
          ladder={step.ladder}
          onChange={(ladder) => handleUpdate({ ladder })}
        />
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">🛡️ Gestione Resistenza Step</h4>
        <ResistanceHandlingEditor
          resistance={step.resistanceHandling}
          onChange={(resistanceHandling) => handleUpdate({ resistanceHandling })}
        />
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">🍪 Biscottino</h4>
        {step.biscottino ? (
          <Card className="bg-amber-50/50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">🍪 Biscottino</Label>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => handleUpdate({ biscottino: undefined })}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
              <div>
                <Label className="text-xs">Trigger</Label>
                <Input
                  value={step.biscottino.trigger}
                  onChange={(e) => handleUpdate({ biscottino: { ...step.biscottino!, trigger: e.target.value }})}
                  className="mt-1 h-8"
                  placeholder="Quando attivare..."
                />
              </div>
              <div>
                <Label className="text-xs">Frase</Label>
                <Textarea
                  value={step.biscottino.phrase}
                  onChange={(e) => handleUpdate({ biscottino: { ...step.biscottino!, phrase: e.target.value }})}
                  className="mt-1 min-h-[50px]"
                  placeholder="Frase di rinforzo..."
                />
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => handleUpdate({
              biscottino: {
                trigger: 'Quando il prospect condivide qualcosa di personale',
                phrase: 'Grazie per aver condiviso questo con me.'
              }
            })}
            className="w-full"
          >
            <Plus className="h-3 w-3 mr-2" />
            Aggiungi Biscottino
          </Button>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        <p>Domande: {step.questions?.length || 0}</p>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">📄 Anteprima Testo</h4>
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2 text-sm">
            <div>
              <span className="font-semibold">Step {step.number}: {step.name}</span>
            </div>
            {step.objective && (
              <div className="text-muted-foreground">
                <span className="text-xs font-medium">Obiettivo:</span>
                <p>{step.objective}</p>
              </div>
            )}
            {step.notes && (
              <div className="mt-2 pt-2 border-t text-muted-foreground italic text-xs">
                <span className="font-medium not-italic">Note AI:</span>
                <p>{step.notes}</p>
              </div>
            )}
            {step.ladder && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-xs font-medium">🪜 Ladder attivo</span>
              </div>
            )}
            {step.biscottino && (
              <div className="mt-2 pt-2 border-t">
                <span className="text-xs font-medium">🍪 Biscottino: {step.biscottino.phrase}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">⚙️ Riepilogo Completo Impostazioni</h4>
        <Card className="bg-gradient-to-br from-muted/30 to-muted/50">
          <CardContent className="p-4 space-y-3 text-xs">
            {/* Step Settings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                <CheckSquare className="h-4 w-4" />
                <span>Step {step.number}</span>
              </div>
              <div className="pl-6 space-y-1.5 text-muted-foreground">
                <div><span className="font-medium text-foreground">Nome:</span> {step.name}</div>
                {step.objective && (
                  <div><span className="font-medium text-foreground">Obiettivo:</span> {step.objective}</div>
                )}
                {step.notes && (
                  <div><span className="font-medium text-foreground">Note AI:</span> {step.notes}</div>
                )}
              </div>
            </div>

            {/* Ladder Settings */}
            {step.ladder && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 font-semibold">
                  <span>🪜 Ladder dei Perché</span>
                </div>
                <div className="pl-6 space-y-1.5 text-muted-foreground">
                  <div><span className="font-medium text-foreground">Livelli:</span> {step.ladder.levels?.length || 0}</div>
                  {step.ladder.levels && step.ladder.levels.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {step.ladder.levels.map((level) => (
                        <div key={level.number} className="pl-2 border-l-2 border-indigo-200 dark:border-indigo-800">
                          <div className="font-medium text-foreground">Livello {level.number}: {level.name}</div>
                          <div className="text-xs italic">{level.question}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Biscottino Settings */}
            {step.biscottino && (
              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400 font-semibold">
                  <span>🍪 Biscottino</span>
                </div>
                <div className="pl-6 space-y-1.5 text-muted-foreground">
                  {step.biscottino.trigger && (
                    <div><span className="font-medium text-foreground">Trigger:</span> {step.biscottino.trigger}</div>
                  )}
                  {step.biscottino.phrase && (
                    <div><span className="font-medium text-foreground">Frase:</span> {step.biscottino.phrase}</div>
                  )}
                </div>
              </div>
            )}

            {/* Questions Summary */}
            {step.questions && step.questions.length > 0 && (
              <div className="pt-2 border-t">
                <div className="font-medium text-foreground">
                  Domande contenute: {step.questions.length}
                </div>
                {step.questions.filter(q => q.isKey).length > 0 && (
                  <div className="text-muted-foreground mt-1">
                    Di cui chiave: {step.questions.filter(q => q.isKey).length}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuestionInspectorPanel({ question, phaseId, stepId }: { question: Question; phaseId: string; stepId: string }) {
  const builder = useBuilder();

  const handleUpdate = (data: Partial<Question>) => {
    builder.updateQuestion(phaseId, stepId, question.id, data);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <MessageSquare className="h-5 w-5 text-purple-600 dark:text-purple-400" />
        <span className="font-semibold text-purple-600 dark:text-purple-400">Domanda</span>
        {question.isKey && (
          <Badge variant="default" className="bg-purple-600 text-xs">
            <Key className="h-3 w-3 mr-1" />
            Chiave
          </Badge>
        )}
        {question.marker && (
          <Badge variant="outline" className="text-xs">
            {question.marker}
          </Badge>
        )}
      </div>

      <Card className="transition-all hover:shadow-sm">
        <CardContent className="p-3 space-y-3">
          <div>
            <Label htmlFor="question-text" className="text-xs font-medium">Testo Domanda</Label>
            <Textarea
              id="question-text"
              value={question.text}
              onChange={(e) => handleUpdate({ text: e.target.value })}
              className="mt-1.5 min-h-[100px]"
              placeholder="Scrivi la domanda..."
            />
          </div>

          <div>
            <Label htmlFor="question-marker" className="text-xs font-medium">Marker (opzionale)</Label>
            <Input
              id="question-marker"
              value={question.marker || ''}
              onChange={(e) => handleUpdate({ marker: e.target.value })}
              className="mt-1.5 h-9"
              placeholder="Es: [BUDGET], [TIMELINE]..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              I marker aiutano a categorizzare le risposte
            </p>
          </div>

          <div className="flex items-center justify-between p-2 rounded-md bg-muted/30">
            <div>
              <Label className="text-xs font-medium">Domanda Chiave</Label>
              <p className="text-[10px] text-muted-foreground">Essenziale per qualificare</p>
            </div>
            <Switch
              checked={question.isKey || false}
              onCheckedChange={(checked) => handleUpdate({ isKey: checked })}
            />
          </div>

          <div>
            <Label htmlFor="question-condition" className="text-xs font-medium">Condizione (opzionale)</Label>
            <Input
              id="question-condition"
              value={question.condition || ''}
              onChange={(e) => handleUpdate({ condition: e.target.value })}
              className="mt-1.5 h-9"
              placeholder="Es: SE prospect ha detto X..."
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Quando porre questa domanda
            </p>
          </div>
        </CardContent>
      </Card>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
          <Zap className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          Istruzioni per l'AI
        </h4>
        <Card className="bg-gradient-to-br from-blue-50/50 to-purple-50/50 dark:from-blue-950/30 dark:to-purple-950/30 border-blue-200 dark:border-blue-800">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between p-2 rounded-md bg-background/60">
              <Label className="text-xs font-medium">Aspetta risposta completa</Label>
              <Switch
                checked={question.instructions?.wait || false}
                onCheckedChange={(checked) => handleUpdate({
                  instructions: { ...question.instructions, wait: checked }
                })}
              />
            </div>
            {question.instructions?.wait && (
              <div>
                <Label className="text-xs font-medium">Dettagli attesa</Label>
                <Input
                  value={question.instructions?.waitDetails || ''}
                  onChange={(e) => handleUpdate({
                    instructions: { ...question.instructions, wait: true, waitDetails: e.target.value }
                  })}
                  className="mt-1.5 h-9"
                  placeholder="Es: Lascia 3 secondi di silenzio..."
                />
              </div>
            )}
            <div>
              <Label className="text-xs font-medium">Come ascoltare</Label>
              <Input
                value={question.instructions?.listen || ''}
                onChange={(e) => handleUpdate({
                  instructions: { ...question.instructions, wait: question.instructions?.wait || false, listen: e.target.value }
                })}
                className="mt-1.5 h-9"
                placeholder="Es: Cerca menzioni di budget, timeline..."
              />
            </div>
            
            <div>
              <Label className="text-xs font-medium">Contesto Reazione</Label>
              <Textarea
                value={question.instructions?.reactContext || ''}
                onChange={(e) => handleUpdate({
                  instructions: { ...question.instructions, wait: question.instructions?.wait || false, reactContext: e.target.value }
                })}
                className="mt-1.5 min-h-[50px] text-xs"
                placeholder="Contesto per le reazioni..."
              />
            </div>

            <ArrayEditor
              label="Reazioni Specifiche"
              values={question.instructions?.react || []}
              onChange={(react) => handleUpdate({
                instructions: { ...question.instructions, wait: question.instructions?.wait || false, react }
              })}
              placeholder="Aggiungi reazione..."
            />

            <ArrayEditor
              label="Istruzioni Aggiuntive"
              values={question.instructions?.additionalInstructions || []}
              onChange={(additionalInstructions) => handleUpdate({
                instructions: { ...question.instructions, wait: question.instructions?.wait || false, additionalInstructions }
              })}
              placeholder="Istruzione aggiuntiva..."
            />
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">📄 Anteprima Testo</h4>
        <Card className="bg-muted/50">
          <CardContent className="p-3 space-y-2 text-sm">
            <div className="font-medium">
              {question.text}
            </div>
            {question.marker && (
              <div className="text-xs">
                <Badge variant="outline" className="text-xs">{question.marker}</Badge>
              </div>
            )}
            {question.condition && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                <span className="font-medium">Condizione:</span> {question.condition}
              </div>
            )}
            {question.instructions?.listen && (
              <div className="mt-2 pt-2 border-t text-xs text-muted-foreground">
                <span className="font-medium">Ascolta:</span> {question.instructions.listen}
              </div>
            )}
            {question.instructions?.waitDetails && (
              <div className="mt-1 text-xs text-muted-foreground italic">
                ⏱️ {question.instructions.waitDetails}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Separator />

      <div>
        <h4 className="font-medium text-sm mb-2">⚙️ Riepilogo Completo Impostazioni</h4>
        <Card className="bg-gradient-to-br from-muted/30 to-muted/50">
          <CardContent className="p-4 space-y-3 text-xs">
            {/* Question Settings */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 font-semibold">
                <MessageSquare className="h-4 w-4" />
                <span>Domanda</span>
                {question.isKey && (
                  <Badge variant="default" className="text-xs ml-2">Chiave</Badge>
                )}
              </div>
              <div className="pl-6 space-y-1.5 text-muted-foreground">
                <div><span className="font-medium text-foreground">Testo:</span> {question.text}</div>
                {question.marker && (
                  <div>
                    <span className="font-medium text-foreground">Marker:</span>
                    <Badge variant="outline" className="text-xs ml-2">{question.marker}</Badge>
                  </div>
                )}
                <div><span className="font-medium text-foreground">Domanda Chiave:</span> {question.isKey ? 'Sì' : 'No'}</div>
                {question.condition && (
                  <div><span className="font-medium text-foreground">Condizione:</span> {question.condition}</div>
                )}
              </div>
            </div>

            {/* AI Instructions */}
            {(question.instructions?.wait || question.instructions?.listen || question.instructions?.waitDetails) && (
              <div className="pt-2 border-t space-y-2">
                <div className="font-semibold text-foreground">
                  Istruzioni AI
                </div>
                <div className="pl-6 space-y-1.5 text-muted-foreground">
                  {question.instructions.wait !== undefined && (
                    <div>
                      <span className="font-medium text-foreground">Aspetta risposta completa:</span> {question.instructions.wait ? 'Sì' : 'No'}
                    </div>
                  )}
                  {question.instructions.waitDetails && (
                    <div><span className="font-medium text-foreground">Dettagli attesa:</span> {question.instructions.waitDetails}</div>
                  )}
                  {question.instructions.listen && (
                    <div><span className="font-medium text-foreground">Come ascoltare:</span> {question.instructions.listen}</div>
                  )}
                </div>
              </div>
            )}

            {/* Summary Stats */}
            <div className="pt-2 border-t">
              <div className="grid grid-cols-2 gap-2 text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Tipo:</span> {question.isKey ? 'Chiave' : 'Standard'}
                </div>
                <div>
                  <span className="font-medium text-foreground">Condizionale:</span> {question.condition ? 'Sì' : 'No'}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function BlockInspector() {
  const builder = useBuilder();
  const selectedBlock = builder.getSelectedBlock();

  if (!selectedBlock || !builder.selectedBlockType) {
    return (
      <ScrollArea className="h-full">
        <EmptyInspector />
      </ScrollArea>
    );
  }

  const findPhaseIdForStep = (stepId: string): string | null => {
    for (const phase of builder.phases) {
      if (phase.steps?.some(s => s.id === stepId)) {
        return phase.id;
      }
    }
    return null;
  };

  const findIdsForQuestion = (questionId: string): { phaseId: string; stepId: string } | null => {
    for (const phase of builder.phases) {
      for (const step of phase.steps || []) {
        if (step.questions?.some(q => q.id === questionId)) {
          return { phaseId: phase.id, stepId: step.id };
        }
      }
    }
    return null;
  };

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        {builder.selectedBlockType === 'phase' && (
          <PhaseInspectorPanel phase={selectedBlock as Phase} />
        )}
        {builder.selectedBlockType === 'step' && (() => {
          const phaseId = findPhaseIdForStep(selectedBlock.id);
          return phaseId ? (
            <StepInspectorPanel step={selectedBlock as Step} phaseId={phaseId} />
          ) : null;
        })()}
        {builder.selectedBlockType === 'question' && (() => {
          const ids = findIdsForQuestion(selectedBlock.id);
          return ids ? (
            <QuestionInspectorPanel
              question={selectedBlock as Question}
              phaseId={ids.phaseId}
              stepId={ids.stepId}
            />
          ) : null;
        })()}
      </div>
    </ScrollArea>
  );
}
