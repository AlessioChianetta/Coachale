import React, { useState, useEffect } from 'react';
import type { Step } from '@shared/script-blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { CheckSquare, Zap, Save, Loader2, Plus, Trash2, GripVertical, MessageSquare } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';

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

interface StepInspectorProps {
  step: Step;
  onUpdate: (updatedStep: Step) => void;
  isEditing: boolean;
  energySettings?: EnergySettingsData;
  ladderData?: LadderData;
  questionsData?: QuestionData[];
  onSaveEnergy?: (settings: EnergySettingsData) => void;
  onSaveLadder?: (hasLadder: boolean, levels: LadderLevel[]) => void;
  onSaveQuestions?: (questions: QuestionData[]) => void;
  isSavingEnergy?: boolean;
  isSavingLadder?: boolean;
  isSavingQuestions?: boolean;
}

const defaultEnergy: EnergySettingsData = {
  level: 'MEDIO',
  tone: 'SICURO',
  volume: 'NORMAL',
  pace: 'MODERATO',
  vocabulary: 'COLLOQUIALE',
};

const defaultLadderLevels: LadderLevel[] = [
  { level: 1, text: '', purpose: 'Domanda superficiale iniziale' },
  { level: 2, text: '', purpose: 'Approfondimento primo livello' },
  { level: 3, text: '', purpose: 'Ricerca della causa' },
  { level: 4, text: '', purpose: 'Connessione emotiva' },
  { level: 5, text: '', purpose: 'Pain point profondo' },
];

export function StepInspector({ 
  step, 
  onUpdate, 
  isEditing,
  energySettings,
  ladderData,
  questionsData,
  onSaveEnergy,
  onSaveLadder,
  onSaveQuestions,
  isSavingEnergy,
  isSavingLadder,
  isSavingQuestions
}: StepInspectorProps) {
  const [localEnergy, setLocalEnergy] = useState<EnergySettingsData>(energySettings || defaultEnergy);
  const [hasLadder, setHasLadder] = useState(ladderData?.hasLadder ?? false);
  const [ladderLevels, setLadderLevels] = useState<LadderLevel[]>(
    ladderData?.levels?.length ? ladderData.levels : defaultLadderLevels
  );
  const [localQuestions, setLocalQuestions] = useState<QuestionData[]>(questionsData || []);

  useEffect(() => {
    if (energySettings) {
      setLocalEnergy(energySettings);
    } else {
      setLocalEnergy(defaultEnergy);
    }
  }, [energySettings, step.id]);

  useEffect(() => {
    setHasLadder(ladderData?.hasLadder ?? false);
    setLadderLevels(ladderData?.levels?.length ? ladderData.levels : defaultLadderLevels);
  }, [ladderData, step.id]);

  useEffect(() => {
    setLocalQuestions(questionsData || []);
  }, [questionsData, step.id]);

  const handleChange = (field: keyof Step, value: string | number) => {
    if (!isEditing) return;
    onUpdate({ ...step, [field]: value });
  };

  const handleEnergyChange = (field: keyof EnergySettingsData, value: string) => {
    setLocalEnergy(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEnergy = () => {
    if (onSaveEnergy) {
      onSaveEnergy(localEnergy);
    }
  };

  const handleLadderLevelChange = (index: number, field: 'text' | 'purpose', value: string) => {
    const newLevels = [...ladderLevels];
    newLevels[index] = { ...newLevels[index], [field]: value };
    setLadderLevels(newLevels);
  };

  const handleSaveLadder = () => {
    if (onSaveLadder) {
      onSaveLadder(hasLadder, ladderLevels);
    }
  };

  const handleAddQuestion = () => {
    const newQuestion: QuestionData = {
      id: `q_${Date.now()}`,
      text: '',
      order: localQuestions.length + 1,
    };
    setLocalQuestions([...localQuestions, newQuestion]);
  };

  const handleRemoveQuestion = (index: number) => {
    const newQuestions = localQuestions.filter((_, i) => i !== index);
    setLocalQuestions(newQuestions.map((q, i) => ({ ...q, order: i + 1 })));
  };

  const handleQuestionChange = (index: number, text: string) => {
    const newQuestions = [...localQuestions];
    newQuestions[index] = { ...newQuestions[index], text };
    setLocalQuestions(newQuestions);
  };

  const handleSaveQuestions = () => {
    if (onSaveQuestions) {
      onSaveQuestions(localQuestions);
    }
  };

  const moveQuestion = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= localQuestions.length) return;
    const newQuestions = [...localQuestions];
    const [removed] = newQuestions.splice(fromIndex, 1);
    newQuestions.splice(toIndex, 0, removed);
    setLocalQuestions(newQuestions.map((q, i) => ({ ...q, order: i + 1 })));
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckSquare className="h-5 w-5 text-indigo-500" />
            <span>Dettagli Step</span>
          </CardTitle>
          <CardDescription>
            Modifica le proprietà dello step selezionato.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="step-number">Numero Step</Label>
            <Input
              id="step-number"
              value={step.number}
              onChange={(e) => handleChange('number', parseInt(e.target.value) || 0)}
              type="number"
              readOnly={!isEditing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-name">Nome Step</Label>
            <Input
              id="step-name"
              value={step.name}
              onChange={(e) => handleChange('name', e.target.value)}
              readOnly={!isEditing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="step-objective">Obiettivo</Label>
            <Textarea
              id="step-objective"
              value={step.objective}
              onChange={(e) => handleChange('objective', e.target.value)}
              rows={4}
              readOnly={!isEditing}
              placeholder="Obiettivo specifico di questo step..."
            />
          </div>
        </CardContent>
      </Card>

      {isEditing && (
        <>
          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="text-xl">🪜</span>
                <span>Ladder dei Perché</span>
              </CardTitle>
              <CardDescription>
                Configura i 5 livelli del Ladder per questo step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="has-ladder" className="text-sm font-medium">
                  Abilita Ladder
                </Label>
                <Switch
                  id="has-ladder"
                  checked={hasLadder}
                  onCheckedChange={setHasLadder}
                />
              </div>

              {hasLadder && (
                <div className="space-y-4 pt-2">
                  {ladderLevels.map((level, index) => (
                    <div key={level.level} className="p-3 border rounded-lg bg-background/50 space-y-2">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-sm">Livello {level.level}</span>
                        <span className="text-xs text-muted-foreground">- {level.purpose}</span>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Domanda</Label>
                        <Textarea
                          value={level.text}
                          onChange={(e) => handleLadderLevelChange(index, 'text', e.target.value)}
                          rows={2}
                          placeholder={`Es: "Perché è importante per te?"`}
                          className="text-sm"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Scopo</Label>
                        <Input
                          value={level.purpose}
                          onChange={(e) => handleLadderLevelChange(index, 'purpose', e.target.value)}
                          placeholder="Scopo di questa domanda..."
                          className="text-sm"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              <Button 
                onClick={handleSaveLadder} 
                disabled={isSavingLadder}
                className="w-full"
              >
                {isSavingLadder ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Ladder
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <span>Domande</span>
              </CardTitle>
              <CardDescription>
                Gestisci le domande personalizzate per questo step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {localQuestions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Nessuna domanda personalizzata. Clicca "Aggiungi Domanda" per iniziare.
                </p>
              ) : (
                <div className="space-y-2">
                  {localQuestions.map((question, index) => (
                    <div key={question.id} className="flex items-start gap-2 p-2 border rounded-lg bg-background/50">
                      <div className="flex flex-col gap-1 pt-1">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => moveQuestion(index, index - 1)}
                          disabled={index === 0}
                        >
                          <span className="text-xs">▲</span>
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-6 w-6"
                          onClick={() => moveQuestion(index, index + 1)}
                          disabled={index === localQuestions.length - 1}
                        >
                          <span className="text-xs">▼</span>
                        </Button>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                        </div>
                        <Textarea
                          value={question.text}
                          onChange={(e) => handleQuestionChange(index, e.target.value)}
                          rows={2}
                          placeholder="Scrivi la domanda..."
                          className="text-sm"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleRemoveQuestion(index)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                variant="outline" 
                onClick={handleAddQuestion}
                className="w-full border-dashed"
              >
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Domanda
              </Button>

              <Separator className="my-4" />

              <Button 
                onClick={handleSaveQuestions} 
                disabled={isSavingQuestions}
                className="w-full"
              >
                {isSavingQuestions ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Domande
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-muted/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5 text-yellow-500" />
                <span>Impostazioni Energia (Override)</span>
              </CardTitle>
              <CardDescription>
                Sovrascrive le impostazioni energia della fase per questo step.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Livello Energia</Label>
                <Select value={localEnergy.level} onValueChange={(v) => handleEnergyChange('level', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona livello" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BASSO">🔵 BASSO - Calmo e riflessivo</SelectItem>
                    <SelectItem value="MEDIO">🟡 MEDIO - Bilanciato</SelectItem>
                    <SelectItem value="ALTO">🔴 ALTO - Energico e dinamico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tono</Label>
                <Select value={localEnergy.tone} onValueChange={(v) => handleEnergyChange('tone', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona tono" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CALMO">CALMO - Tranquillo e rassicurante</SelectItem>
                    <SelectItem value="SICURO">SICURO - Fiducioso e determinato</SelectItem>
                    <SelectItem value="CONFIDENZIALE">CONFIDENZIALE - Intimo e personale</SelectItem>
                    <SelectItem value="ENTUSIASTA">ENTUSIASTA - Appassionato e coinvolgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Volume</Label>
                <Select value={localEnergy.volume} onValueChange={(v) => handleEnergyChange('volume', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona volume" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SOFT">SOFT - Voce bassa e rilassata</SelectItem>
                    <SelectItem value="NORMAL">NORMAL - Volume standard</SelectItem>
                    <SelectItem value="LOUD">LOUD - Voce proiettata e forte</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Ritmo</Label>
                <Select value={localEnergy.pace} onValueChange={(v) => handleEnergyChange('pace', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona ritmo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LENTO">LENTO - Pause frequenti, enfasi sulle parole</SelectItem>
                    <SelectItem value="MODERATO">MODERATO - Velocità naturale</SelectItem>
                    <SelectItem value="VELOCE">VELOCE - Dinamico e incalzante</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Lessico</Label>
                <Select value={localEnergy.vocabulary} onValueChange={(v) => handleEnergyChange('vocabulary', v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona lessico" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FORMALE">FORMALE - Professionale e distaccato</SelectItem>
                    <SelectItem value="COLLOQUIALE">COLLOQUIALE - Informale e amichevole</SelectItem>
                    <SelectItem value="TECNICO">TECNICO - Specifico e dettagliato</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Separator className="my-4" />

              <Button 
                onClick={handleSaveEnergy} 
                disabled={isSavingEnergy}
                className="w-full"
              >
                {isSavingEnergy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Impostazioni Energia
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
