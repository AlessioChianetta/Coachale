import { useState, useEffect } from 'react';
import { 
  X, 
  Target, 
  CheckSquare, 
  MessageSquare,
  Zap,
  Layers,
  Cookie,
  AlertOctagon,
  Save
} from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
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
import { cn } from '@/lib/utils';
import type { Phase, Step, Question, EnergySettings } from '@shared/script-blocks';

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
  const [hasEnergy, setHasEnergy] = useState(!!phase.energy);
  const [energyLevel, setEnergyLevel] = useState(phase.energy?.level || 'MEDIO');
  const [hasCheckpoint, setHasCheckpoint] = useState(!!phase.checkpoint);

  useEffect(() => {
    setName(phase.name);
    setDescription(phase.description || '');
    setHasEnergy(!!phase.energy);
    setEnergyLevel(phase.energy?.level || 'MEDIO');
    setHasCheckpoint(!!phase.checkpoint);
  }, [phase]);

  const handleSave = () => {
    onUpdate({
      name,
      description,
      energy: hasEnergy ? { 
        ...phase.energy,
        level: energyLevel,
        tone: 'SICURO',
        volume: 'NORMAL',
        rhythm: 'MODERATO',
        vocabulary: []
      } : undefined,
      checkpoint: hasCheckpoint ? phase.checkpoint || { title: 'Checkpoint', checks: [] } : undefined
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
      
      <Separator />
      
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="energy">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-yellow-500" />
              Energia & Tonalità
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Abilita Energy</Label>
              <Switch checked={hasEnergy} onCheckedChange={setHasEnergy} />
            </div>
            {hasEnergy && (
              <div className="space-y-2">
                <Label>Livello</Label>
                <Select value={energyLevel} onValueChange={setEnergyLevel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASSO">Basso - Calmo e riflessivo</SelectItem>
                    <SelectItem value="MEDIO">Medio - Equilibrato</SelectItem>
                    <SelectItem value="ALTO">Alto - Energico ed entusiasta</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </AccordionContent>
        </AccordionItem>
        
        <AccordionItem value="checkpoint">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <AlertOctagon className="h-4 w-4 text-orange-500" />
              Checkpoint
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Abilita Checkpoint</Label>
              <Switch checked={hasCheckpoint} onCheckedChange={setHasCheckpoint} />
            </div>
            {hasCheckpoint && (
              <p className="text-xs text-muted-foreground">
                Verifica obbligatoria prima di procedere alla fase successiva
              </p>
            )}
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
  const [hasLadder, setHasLadder] = useState(!!step.ladder);
  const [hasBiscottino, setHasBiscottino] = useState(!!step.biscottino);
  const [biscottinoText, setBiscottinoText] = useState(step.biscottino?.phrase || '');

  useEffect(() => {
    setName(step.name);
    setObjective(step.objective || '');
    setHasLadder(!!step.ladder);
    setHasBiscottino(!!step.biscottino);
    setBiscottinoText(step.biscottino?.phrase || '');
  }, [step]);

  const handleSave = () => {
    onUpdate({
      name,
      objective,
      ladder: hasLadder ? step.ladder || { title: 'Ladder dei Perché', levels: [] } : undefined,
      biscottino: hasBiscottino ? { trigger: 'divagazione', phrase: biscottinoText } : undefined
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
      
      <Separator />
      
      <Accordion type="multiple" className="w-full">
        <AccordionItem value="ladder">
          <AccordionTrigger className="text-sm">
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-indigo-500" />
              Ladder dei Perché
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Abilita Ladder</Label>
              <Switch checked={hasLadder} onCheckedChange={setHasLadder} />
            </div>
            {hasLadder && (
              <p className="text-xs text-muted-foreground">
                Scala di domande per approfondire il problema
              </p>
            )}
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
              <div className="space-y-2">
                <Label>Frase di richiamo</Label>
                <Textarea
                  value={biscottinoText}
                  onChange={(e) => setBiscottinoText(e.target.value)}
                  placeholder="Es: Ok, tornando a noi..."
                  rows={2}
                />
              </div>
            )}
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
  const [isKey, setIsKey] = useState(question.isKey || false);
  const [waitForAnswer, setWaitForAnswer] = useState(question.instructions?.wait ?? true);

  useEffect(() => {
    setText(question.text);
    setIsKey(question.isKey || false);
    setWaitForAnswer(question.instructions?.wait ?? true);
  }, [question]);

  const handleSave = () => {
    onUpdate({
      text,
      isKey,
      instructions: {
        ...question.instructions,
        wait: waitForAnswer
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
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Domanda Chiave</Label>
          <p className="text-xs text-muted-foreground">
            Questa domanda è fondamentale per la call
          </p>
        </div>
        <Switch checked={isKey} onCheckedChange={setIsKey} />
      </div>
      
      <div className="flex items-center justify-between">
        <div className="space-y-0.5">
          <Label>Attendi Risposta</Label>
          <p className="text-xs text-muted-foreground">
            Non procedere senza risposta
          </p>
        </div>
        <Switch checked={waitForAnswer} onCheckedChange={setWaitForAnswer} />
      </div>
      
      <Button className="w-full" onClick={handleSave}>
        <Save className="h-4 w-4 mr-2" />
        Salva Modifiche
      </Button>
    </div>
  );
}
