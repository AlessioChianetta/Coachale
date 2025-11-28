import { useState, useEffect, useCallback } from 'react';
import { 
  X, 
  Target, 
  CheckSquare, 
  MessageSquare,
  Zap,
  Layers,
  Cookie,
  AlertOctagon,
  Save,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Shield,
  FileText
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import type { 
  Phase, 
  Step, 
  Question, 
  EnergySettings,
  Checkpoint,
  Ladder,
  LadderLevel,
  Biscottino,
  ResistanceHandling,
  ResistanceStep
} from '@shared/script-blocks';

interface BlockInspectorProps {
  selectedBlock: {
    block: Phase | Step | Question;
    type: 'phase' | 'step' | 'question';
    parentPhase?: Phase;
    parentStep?: Step;
  } | null;
  onUpdate: (blockId: string, updates: any) => void;
  onClose: () => void;
}

interface ArrayEditorProps {
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  label?: string;
}

function ArrayEditor({ items, onChange, placeholder = "Aggiungi elemento...", label }: ArrayEditorProps) {
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      onChange([...items, newItem.trim()]);
      setNewItem('');
    }
  };

  const removeItem = (index: number) => {
    const updated = items.filter((_, i) => i !== index);
    onChange(updated);
  };

  const updateItem = (index: number, value: string) => {
    const updated = [...items];
    updated[index] = value;
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {label && <Label className="text-xs font-medium">{label}</Label>}
      <div className="space-y-1">
        {items.map((item, index) => (
          <div key={index} className="flex gap-1">
            <Input
              value={item}
              onChange={(e) => updateItem(index, e.target.value)}
              className="flex-1 h-8 text-sm"
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={() => removeItem(index)}
            >
              <Trash2 className="h-3 w-3 text-red-500" />
            </Button>
          </div>
        ))}
      </div>
      <div className="flex gap-1">
        <Input
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          placeholder={placeholder}
          className="flex-1 h-8 text-sm"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addItem();
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={addItem}
        >
          <Plus className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

interface ResistanceHandlingEditorProps {
  value: ResistanceHandling | undefined;
  onChange: (value: ResistanceHandling | undefined) => void;
  showSteps?: boolean;
}

function ResistanceHandlingEditor({ value, onChange, showSteps = false }: ResistanceHandlingEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateField = (field: keyof ResistanceHandling, val: any) => {
    onChange({
      trigger: value?.trigger || '',
      response: value?.response || '',
      steps: value?.steps || [],
      ...value,
      [field]: val
    });
  };

  const addStep = () => {
    const newSteps = [...(value?.steps || []), { action: '', script: '' }];
    updateField('steps', newSteps);
  };

  const updateStep = (index: number, field: keyof ResistanceStep, val: string) => {
    const newSteps = [...(value?.steps || [])];
    newSteps[index] = { ...newSteps[index], [field]: val };
    updateField('steps', newSteps);
  };

  const removeStep = (index: number) => {
    const newSteps = (value?.steps || []).filter((_, i) => i !== index);
    updateField('steps', newSteps);
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between p-2 h-auto">
          <div className="flex items-center gap-2">
            <Shield className="h-3 w-3 text-rose-500" />
            <span className="text-xs">Gestione Resistenze</span>
          </div>
          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="space-y-2">
          <Label className="text-xs">Trigger</Label>
          <Input
            value={value?.trigger || ''}
            onChange={(e) => updateField('trigger', e.target.value)}
            placeholder="Quando scatta la resistenza..."
            className="h-8 text-sm"
          />
        </div>
        <div className="space-y-2">
          <Label className="text-xs">Risposta</Label>
          <Textarea
            value={value?.response || ''}
            onChange={(e) => updateField('response', e.target.value)}
            placeholder="Come rispondere..."
            rows={2}
            className="text-sm"
          />
        </div>
        {showSteps && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Steps</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={addStep}
              >
                <Plus className="h-3 w-3 mr-1" />
                Aggiungi Step
              </Button>
            </div>
            {(value?.steps || []).map((step, index) => (
              <Card key={index} className="p-2">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs">Step {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => removeStep(index)}
                    >
                      <Trash2 className="h-3 w-3 text-red-500" />
                    </Button>
                  </div>
                  <Input
                    value={step.action}
                    onChange={(e) => updateStep(index, 'action', e.target.value)}
                    placeholder="Azione..."
                    className="h-7 text-xs"
                  />
                  <Textarea
                    value={step.script}
                    onChange={(e) => updateStep(index, 'script', e.target.value)}
                    placeholder="Script..."
                    rows={2}
                    className="text-xs"
                  />
                </div>
              </Card>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

interface EnergyEditorProps {
  energy: EnergySettings | undefined;
  onChange: (energy: EnergySettings | undefined) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

function EnergyEditor({ energy, onChange, enabled, onEnabledChange }: EnergyEditorProps) {
  const updateField = (field: keyof EnergySettings, value: any) => {
    onChange({
      level: energy?.level || 'MEDIO',
      tone: energy?.tone || '',
      volume: energy?.volume || '',
      rhythm: energy?.rhythm || '',
      vocabulary: energy?.vocabulary || [],
      ...energy,
      [field]: value
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Abilita Energy</Label>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      
      {enabled && (
        <div className="space-y-3 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Livello</Label>
              <Select 
                value={energy?.level || 'MEDIO'} 
                onValueChange={(val) => updateField('level', val)}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BASSO">Basso</SelectItem>
                  <SelectItem value="MEDIO">Medio</SelectItem>
                  <SelectItem value="ALTO">Alto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tono</Label>
              <Input
                value={energy?.tone || ''}
                onChange={(e) => updateField('tone', e.target.value)}
                placeholder="Es: SICURO"
                className="h-8 text-sm"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Volume</Label>
              <Input
                value={energy?.volume || ''}
                onChange={(e) => updateField('volume', e.target.value)}
                placeholder="Es: NORMAL"
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Ritmo</Label>
              <Input
                value={energy?.rhythm || ''}
                onChange={(e) => updateField('rhythm', e.target.value)}
                placeholder="Es: MODERATO"
                className="h-8 text-sm"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Inflessioni</Label>
            <Input
              value={energy?.inflections || ''}
              onChange={(e) => updateField('inflections', e.target.value)}
              placeholder="Es: enfasi su parole chiave"
              className="h-8 text-sm"
            />
          </div>
          
          <ArrayEditor
            label="Vocabolario"
            items={energy?.vocabulary || []}
            onChange={(items) => updateField('vocabulary', items)}
            placeholder="Aggiungi parola..."
          />
          
          <ArrayEditor
            label="Vocabolario Negativo (evitare)"
            items={energy?.negativeVocabulary || []}
            onChange={(items) => updateField('negativeVocabulary', items)}
            placeholder="Parola da evitare..."
          />
          
          <div className="space-y-1">
            <Label className="text-xs">Mindset</Label>
            <Textarea
              value={energy?.mindset || ''}
              onChange={(e) => updateField('mindset', e.target.value)}
              placeholder="L'approccio mentale per questa sezione..."
              rows={2}
              className="text-sm"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Esempio</Label>
            <Textarea
              value={energy?.example || ''}
              onChange={(e) => updateField('example', e.target.value)}
              placeholder="Esempio pratico di come parlare..."
              rows={2}
              className="text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

interface LadderLevelEditorProps {
  level: LadderLevel;
  index: number;
  onChange: (level: LadderLevel) => void;
  onRemove: () => void;
}

function LadderLevelEditor({ level, index, onChange, onRemove }: LadderLevelEditorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const updateField = (field: keyof LadderLevel, value: any) => {
    onChange({ ...level, [field]: value });
  };

  const addExample = () => {
    const newExamples = [...(level.examples || []), { clientSays: '', youSay: '' }];
    updateField('examples', newExamples);
  };

  const updateExample = (exIndex: number, field: 'clientSays' | 'youSay', value: string) => {
    const newExamples = [...(level.examples || [])];
    newExamples[exIndex] = { ...newExamples[exIndex], [field]: value };
    updateField('examples', newExamples);
  };

  const removeExample = (exIndex: number) => {
    const newExamples = (level.examples || []).filter((_, i) => i !== exIndex);
    updateField('examples', newExamples);
  };

  return (
    <Card className="p-2">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <div className="flex items-center justify-between cursor-pointer p-1 hover:bg-muted/50 rounded">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">{level.number}</Badge>
              <span className="text-sm font-medium">{level.name || `Livello ${level.number}`}</span>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => {
                  e.stopPropagation();
                  onRemove();
                }}
              >
                <Trash2 className="h-3 w-3 text-red-500" />
              </Button>
              {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Numero</Label>
              <Input
                type="number"
                value={level.number}
                onChange={(e) => updateField('number', parseInt(e.target.value) || 1)}
                className="h-7 text-xs"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Nome</Label>
              <Input
                value={level.name}
                onChange={(e) => updateField('name', e.target.value)}
                placeholder="Nome livello"
                className="h-7 text-xs"
              />
            </div>
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Obiettivo</Label>
            <Input
              value={level.objective || ''}
              onChange={(e) => updateField('objective', e.target.value)}
              placeholder="Obiettivo di questo livello..."
              className="h-7 text-xs"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Domanda</Label>
            <Textarea
              value={level.question}
              onChange={(e) => updateField('question', e.target.value)}
              placeholder="La domanda da fare..."
              rows={2}
              className="text-xs"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Tono</Label>
            <Input
              value={level.tone || ''}
              onChange={(e) => updateField('tone', e.target.value)}
              placeholder="Tono da usare..."
              className="h-7 text-xs"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Note</Label>
            <Textarea
              value={level.notes || ''}
              onChange={(e) => updateField('notes', e.target.value)}
              placeholder="Note aggiuntive..."
              rows={2}
              className="text-xs"
            />
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Esempi (Cliente dice / Tu dici)</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-5 text-xs px-2"
                onClick={addExample}
              >
                <Plus className="h-2 w-2 mr-1" />
                Esempio
              </Button>
            </div>
            {(level.examples || []).map((ex, exIndex) => (
              <div key={exIndex} className="border rounded p-2 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">Esempio {exIndex + 1}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={() => removeExample(exIndex)}
                  >
                    <Trash2 className="h-2 w-2 text-red-500" />
                  </Button>
                </div>
                <Input
                  value={ex.clientSays}
                  onChange={(e) => updateExample(exIndex, 'clientSays', e.target.value)}
                  placeholder="Cliente dice..."
                  className="h-6 text-xs"
                />
                <Input
                  value={ex.youSay}
                  onChange={(e) => updateExample(exIndex, 'youSay', e.target.value)}
                  placeholder="Tu dici..."
                  className="h-6 text-xs"
                />
              </div>
            ))}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

interface LadderEditorProps {
  ladder: Ladder | undefined;
  onChange: (ladder: Ladder | undefined) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

function LadderEditor({ ladder, onChange, enabled, onEnabledChange }: LadderEditorProps) {
  const updateField = (field: keyof Ladder, value: any) => {
    onChange({
      title: ladder?.title || 'Ladder dei Perché',
      levels: ladder?.levels || [],
      ...ladder,
      [field]: value
    });
  };

  const addLevel = () => {
    const newNumber = (ladder?.levels?.length || 0) + 1;
    const newLevels = [...(ladder?.levels || []), {
      number: newNumber,
      name: `Livello ${newNumber}`,
      question: '',
      objective: '',
      tone: '',
      examples: [],
      notes: ''
    }];
    updateField('levels', newLevels);
  };

  const updateLevel = (index: number, level: LadderLevel) => {
    const newLevels = [...(ladder?.levels || [])];
    newLevels[index] = level;
    updateField('levels', newLevels);
  };

  const removeLevel = (index: number) => {
    const newLevels = (ladder?.levels || []).filter((_, i) => i !== index);
    updateField('levels', newLevels);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Abilita Ladder</Label>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      
      {enabled && (
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Titolo</Label>
            <Input
              value={ladder?.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Titolo della ladder..."
              className="h-8 text-sm"
            />
          </div>
          
          <ArrayEditor
            label="Quando usare"
            items={ladder?.whenToUse || []}
            onChange={(items) => updateField('whenToUse', items)}
            placeholder="Situazione in cui usare..."
          />
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs">Livelli</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 text-xs"
                onClick={addLevel}
              >
                <Plus className="h-3 w-3 mr-1" />
                Livello
              </Button>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {(ladder?.levels || []).map((level, index) => (
                <LadderLevelEditor
                  key={index}
                  level={level}
                  index={index}
                  onChange={(l) => updateLevel(index, l)}
                  onRemove={() => removeLevel(index)}
                />
              ))}
            </div>
          </div>
          
          <ArrayEditor
            label="Fermati quando"
            items={ladder?.stopWhen || []}
            onChange={(items) => updateField('stopWhen', items)}
            placeholder="Condizione per fermarsi..."
          />
          
          <ArrayEditor
            label="NON fermarti quando"
            items={ladder?.dontStopWhen || []}
            onChange={(items) => updateField('dontStopWhen', items)}
            placeholder="Quando continuare..."
          />
          
          <ArrayEditor
            label="Frasi utili"
            items={ladder?.helpfulPhrases || []}
            onChange={(items) => updateField('helpfulPhrases', items)}
            placeholder="Frase utile..."
          />
          
          <ArrayEditor
            label="Gold Signals"
            items={ladder?.goldSignals || []}
            onChange={(items) => updateField('goldSignals', items)}
            placeholder="Segnale d'oro..."
          />
          
          <ResistanceHandlingEditor
            value={ladder?.resistanceHandling}
            onChange={(val) => updateField('resistanceHandling', val)}
            showSteps={false}
          />
        </div>
      )}
    </div>
  );
}

interface CheckpointEditorProps {
  checkpoint: Checkpoint | undefined;
  onChange: (checkpoint: Checkpoint | undefined) => void;
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}

function CheckpointEditor({ checkpoint, onChange, enabled, onEnabledChange }: CheckpointEditorProps) {
  const updateField = (field: keyof Checkpoint, value: any) => {
    onChange({
      title: checkpoint?.title || 'Checkpoint',
      checks: checkpoint?.checks || [],
      ...checkpoint,
      [field]: value
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Abilita Checkpoint</Label>
        <Switch checked={enabled} onCheckedChange={onEnabledChange} />
      </div>
      
      {enabled && (
        <div className="space-y-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Titolo</Label>
            <Input
              value={checkpoint?.title || ''}
              onChange={(e) => updateField('title', e.target.value)}
              placeholder="Titolo del checkpoint..."
              className="h-8 text-sm"
            />
          </div>
          
          <ArrayEditor
            label="Checks da verificare"
            items={checkpoint?.checks || []}
            onChange={(items) => updateField('checks', items)}
            placeholder="Aggiungi check..."
          />
          
          <ResistanceHandlingEditor
            value={checkpoint?.resistanceHandling}
            onChange={(val) => updateField('resistanceHandling', val)}
            showSteps={true}
          />
          
          <div className="space-y-1">
            <Label className="text-xs">Reminder</Label>
            <Textarea
              value={checkpoint?.reminder || ''}
              onChange={(e) => updateField('reminder', e.target.value)}
              placeholder="Promemoria per il venditore..."
              rows={2}
              className="text-sm"
            />
          </div>
          
          <div className="space-y-1">
            <Label className="text-xs">Test Finale</Label>
            <Input
              value={checkpoint?.testFinale || ''}
              onChange={(e) => updateField('testFinale', e.target.value)}
              placeholder="Domanda di test finale..."
              className="h-8 text-sm"
            />
          </div>
          
          <ArrayEditor
            label="Esempi Test Finale"
            items={checkpoint?.testFinaleExamples || []}
            onChange={(items) => updateField('testFinaleExamples', items)}
            placeholder="Esempio di risposta..."
          />
        </div>
      )}
    </div>
  );
}

export function BlockInspector({ selectedBlock, onUpdate, onClose }: BlockInspectorProps) {
  if (!selectedBlock) {
    return (
      <div className="h-full flex flex-col bg-muted/30">
        <div className="p-4 border-b">
          <h2 className="font-semibold text-sm">Proprietà</h2>
        </div>
        <div className="flex-1 flex items-center justify-center p-8 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 mx-auto rounded-full bg-muted flex items-center justify-center">
              <Target className="h-8 w-8 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Seleziona un blocco dal canvas per modificarne le proprietà
            </p>
          </div>
        </div>
      </div>
    );
  }

  const { block, type } = selectedBlock;

  return (
    <div className="h-full flex flex-col bg-muted/30">
      <div className="p-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          {type === 'phase' && <Target className="h-4 w-4 text-blue-500" />}
          {type === 'step' && <CheckSquare className="h-4 w-4 text-green-500" />}
          {type === 'question' && <MessageSquare className="h-4 w-4 text-purple-500" />}
          <h2 className="font-semibold text-sm">
            {type === 'phase' ? 'Fase' : type === 'step' ? 'Step' : 'Domanda'}
          </h2>
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {type === 'phase' && (
            <PhaseInspectorContent
              phase={block as Phase}
              onUpdate={(updates) => onUpdate(block.id, updates)}
            />
          )}
          {type === 'step' && (
            <StepInspectorContent
              step={block as Step}
              onUpdate={(updates) => onUpdate(block.id, updates)}
            />
          )}
          {type === 'question' && (
            <QuestionInspectorContent
              question={block as Question}
              onUpdate={(updates) => onUpdate(block.id, updates)}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

interface PhaseInspectorContentProps {
  phase: Phase;
  onUpdate: (updates: Partial<Phase>) => void;
}

function PhaseInspectorContent({ phase, onUpdate }: PhaseInspectorContentProps) {
  const [name, setName] = useState(phase.name);
  const [description, setDescription] = useState(phase.description || '');
  const [transition, setTransition] = useState(phase.transition || '');
  const [hasEnergy, setHasEnergy] = useState(!!phase.energy);
  const [energy, setEnergy] = useState<EnergySettings | undefined>(phase.energy);
  const [hasCheckpoint, setHasCheckpoint] = useState(!!phase.checkpoint);
  const [checkpoint, setCheckpoint] = useState<Checkpoint | undefined>(phase.checkpoint);

  useEffect(() => {
    setName(phase.name);
    setDescription(phase.description || '');
    setTransition(phase.transition || '');
    setHasEnergy(!!phase.energy);
    setEnergy(phase.energy);
    setHasCheckpoint(!!phase.checkpoint);
    setCheckpoint(phase.checkpoint);
  }, [phase]);

  const handleSave = () => {
    onUpdate({
      name,
      description,
      transition,
      energy: hasEnergy ? energy : undefined,
      checkpoint: hasCheckpoint ? checkpoint : undefined
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="phase-name">Nome Fase</Label>
        <Input
          id="phase-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es: Apertura"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phase-desc">Descrizione</Label>
        <Textarea
          id="phase-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descrivi l'obiettivo di questa fase..."
          rows={3}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phase-transition">Transizione</Label>
        <Input
          id="phase-transition"
          value={transition}
          onChange={(e) => setTransition(e.target.value)}
          placeholder="Come passare alla fase successiva..."
        />
      </div>
      
      <Separator />
      
      <Accordion type="multiple" className="w-full" defaultValue={['energy', 'checkpoint']}>
        <AccordionItem value="energy">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Energia & Tonalità
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <EnergyEditor
              energy={energy}
              onChange={setEnergy}
              enabled={hasEnergy}
              onEnabledChange={setHasEnergy}
            />
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="checkpoint">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-orange-500" />
              Checkpoint
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <CheckpointEditor
              checkpoint={checkpoint}
              onChange={setCheckpoint}
              enabled={hasCheckpoint}
              onEnabledChange={setHasCheckpoint}
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4 mr-2" />
        Salva Modifiche
      </Button>
    </div>
  );
}

interface StepInspectorContentProps {
  step: Step;
  onUpdate: (updates: Partial<Step>) => void;
}

function StepInspectorContent({ step, onUpdate }: StepInspectorContentProps) {
  const [name, setName] = useState(step.name);
  const [objective, setObjective] = useState(step.objective || '');
  const [transition, setTransition] = useState(step.transition || '');
  const [notes, setNotes] = useState(step.notes || '');
  const [hasEnergy, setHasEnergy] = useState(!!step.energy);
  const [energy, setEnergy] = useState<EnergySettings | undefined>(step.energy);
  const [hasLadder, setHasLadder] = useState(!!step.ladder);
  const [ladder, setLadder] = useState<Ladder | undefined>(step.ladder);
  const [hasBiscottino, setHasBiscottino] = useState(!!step.biscottino);
  const [biscottino, setBiscottino] = useState<Biscottino | undefined>(step.biscottino);
  const [resistanceHandling, setResistanceHandling] = useState<ResistanceHandling | undefined>(step.resistanceHandling);

  useEffect(() => {
    setName(step.name);
    setObjective(step.objective || '');
    setTransition(step.transition || '');
    setNotes(step.notes || '');
    setHasEnergy(!!step.energy);
    setEnergy(step.energy);
    setHasLadder(!!step.ladder);
    setLadder(step.ladder);
    setHasBiscottino(!!step.biscottino);
    setBiscottino(step.biscottino);
    setResistanceHandling(step.resistanceHandling);
  }, [step]);

  const handleSave = () => {
    onUpdate({
      name,
      objective,
      transition,
      notes,
      energy: hasEnergy ? energy : undefined,
      ladder: hasLadder ? ladder : undefined,
      biscottino: hasBiscottino ? biscottino : undefined,
      resistanceHandling
    });
  };

  const updateBiscottino = (field: keyof Biscottino, value: string) => {
    setBiscottino({
      trigger: biscottino?.trigger || '',
      phrase: biscottino?.phrase || '',
      ...biscottino,
      [field]: value
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="step-name">Nome Step</Label>
        <Input
          id="step-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Es: Apertura Entusiasta"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="step-obj">Obiettivo</Label>
        <Textarea
          id="step-obj"
          value={objective}
          onChange={(e) => setObjective(e.target.value)}
          placeholder="Cosa deve raggiungere questo step..."
          rows={2}
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="step-transition">Transizione</Label>
        <Input
          id="step-transition"
          value={transition}
          onChange={(e) => setTransition(e.target.value)}
          placeholder="Come passare allo step successivo..."
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="step-notes">Note</Label>
        <Textarea
          id="step-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Note aggiuntive per questo step..."
          rows={3}
        />
      </div>
      
      <Separator />
      
      <Accordion type="multiple" className="w-full" defaultValue={['energy', 'ladder', 'biscottino', 'resistance']}>
        <AccordionItem value="energy">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Energia & Tonalità
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <EnergyEditor
              energy={energy}
              onChange={setEnergy}
              enabled={hasEnergy}
              onEnabledChange={setHasEnergy}
            />
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="ladder">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Ladder dei Perché
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <LadderEditor
              ladder={ladder}
              onChange={setLadder}
              enabled={hasLadder}
              onEnabledChange={setHasLadder}
            />
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="biscottino">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Cookie className="h-4 w-4 text-amber-500" />
              Biscottino
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Abilita Biscottino</Label>
              <Switch checked={hasBiscottino} onCheckedChange={setHasBiscottino} />
            </div>
            {hasBiscottino && (
              <div className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label className="text-xs">Trigger</Label>
                  <Input
                    value={biscottino?.trigger || ''}
                    onChange={(e) => updateBiscottino('trigger', e.target.value)}
                    placeholder="Es: divagazione"
                    className="h-8 text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Frase di richiamo</Label>
                  <Textarea
                    value={biscottino?.phrase || ''}
                    onChange={(e) => updateBiscottino('phrase', e.target.value)}
                    placeholder="Es: Ok, tornando a noi..."
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="resistance">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-rose-500" />
              Gestione Resistenze
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Trigger</Label>
              <Input
                value={resistanceHandling?.trigger || ''}
                onChange={(e) => setResistanceHandling({
                  ...resistanceHandling,
                  trigger: e.target.value,
                  response: resistanceHandling?.response || ''
                })}
                placeholder="Quando scatta la resistenza..."
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Risposta</Label>
              <Textarea
                value={resistanceHandling?.response || ''}
                onChange={(e) => setResistanceHandling({
                  ...resistanceHandling,
                  trigger: resistanceHandling?.trigger || '',
                  response: e.target.value
                })}
                placeholder="Come rispondere..."
                rows={2}
                className="text-sm"
              />
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4 mr-2" />
        Salva Modifiche
      </Button>
    </div>
  );
}

interface QuestionInspectorContentProps {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
}

function QuestionInspectorContent({ question, onUpdate }: QuestionInspectorContentProps) {
  const [text, setText] = useState(question.text);
  const [marker, setMarker] = useState(question.marker || '');
  const [condition, setCondition] = useState(question.condition || '');
  const [isKey, setIsKey] = useState(question.isKey || false);
  const [waitForAnswer, setWaitForAnswer] = useState(question.instructions?.wait ?? true);
  const [waitDetails, setWaitDetails] = useState(question.instructions?.waitDetails || '');
  const [listen, setListen] = useState(question.instructions?.listen || '');
  const [react, setReact] = useState<string[]>(question.instructions?.react || []);
  const [reactContext, setReactContext] = useState(question.instructions?.reactContext || '');
  const [additionalInstructions, setAdditionalInstructions] = useState<string[]>(
    question.instructions?.additionalInstructions || []
  );

  useEffect(() => {
    setText(question.text);
    setMarker(question.marker || '');
    setCondition(question.condition || '');
    setIsKey(question.isKey || false);
    setWaitForAnswer(question.instructions?.wait ?? true);
    setWaitDetails(question.instructions?.waitDetails || '');
    setListen(question.instructions?.listen || '');
    setReact(question.instructions?.react || []);
    setReactContext(question.instructions?.reactContext || '');
    setAdditionalInstructions(question.instructions?.additionalInstructions || []);
  }, [question]);

  const handleSave = () => {
    onUpdate({
      text,
      marker: marker || undefined,
      condition: condition || undefined,
      isKey,
      instructions: {
        wait: waitForAnswer,
        waitDetails: waitDetails || undefined,
        listen: listen || undefined,
        react: react.length > 0 ? react : undefined,
        reactContext: reactContext || undefined,
        additionalInstructions: additionalInstructions.length > 0 ? additionalInstructions : undefined
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="question-text">Testo Domanda</Label>
        <Textarea
          id="question-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Scrivi la domanda..."
          rows={4}
        />
      </div>
      
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-2">
          <Label htmlFor="question-marker">Marker</Label>
          <Input
            id="question-marker"
            value={marker}
            onChange={(e) => setMarker(e.target.value)}
            placeholder="Es: 📌"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="question-condition">Condizione</Label>
          <Input
            id="question-condition"
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            placeholder="Quando mostrare..."
          />
        </div>
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Domanda Chiave</Label>
          <p className="text-xs text-muted-foreground">
            Questa domanda è fondamentale per la call
          </p>
        </div>
        <Switch checked={isKey} onCheckedChange={setIsKey} />
      </div>
      
      <Separator />
      
      <Accordion type="multiple" className="w-full" defaultValue={['wait', 'instructions']}>
        <AccordionItem value="wait">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-blue-500" />
              Attesa Risposta
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>Attendi Risposta</Label>
                <p className="text-xs text-muted-foreground">
                  Non procedere senza risposta
                </p>
              </div>
              <Switch checked={waitForAnswer} onCheckedChange={setWaitForAnswer} />
            </div>
            
            {waitForAnswer && (
              <div className="space-y-2 pt-2">
                <Label className="text-xs">Dettagli Attesa</Label>
                <Input
                  value={waitDetails}
                  onChange={(e) => setWaitDetails(e.target.value)}
                  placeholder="Quanto tempo attendere, come gestire il silenzio..."
                  className="h-8 text-sm"
                />
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="instructions">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-green-500" />
              Istruzioni Avanzate
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="space-y-2">
              <Label className="text-xs">Listen (cosa ascoltare)</Label>
              <Input
                value={listen}
                onChange={(e) => setListen(e.target.value)}
                placeholder="Cosa cercare nella risposta..."
                className="h-8 text-sm"
              />
            </div>
            
            <ArrayEditor
              label="React (come reagire)"
              items={react}
              onChange={setReact}
              placeholder="Aggiungi reazione..."
            />
            
            <div className="space-y-2">
              <Label className="text-xs">Contesto Reazioni</Label>
              <Input
                value={reactContext}
                onChange={(e) => setReactContext(e.target.value)}
                placeholder="Contesto per le reazioni..."
                className="h-8 text-sm"
              />
            </div>
            
            <ArrayEditor
              label="Istruzioni Aggiuntive"
              items={additionalInstructions}
              onChange={setAdditionalInstructions}
              placeholder="Aggiungi istruzione..."
            />
          </AccordionContent>
        </AccordionItem>
      </Accordion>
      
      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4 mr-2" />
        Salva Modifiche
      </Button>
    </div>
  );
}
