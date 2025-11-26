import React, { useState, useEffect } from 'react';
import type { Phase } from '@shared/script-blocks';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Target, Zap, Save, Loader2 } from 'lucide-react';
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

interface PhaseInspectorProps {
  phase: Phase;
  onUpdate: (updatedPhase: Phase) => void;
  isEditing: boolean;
  energySettings?: EnergySettingsData;
  onSaveEnergy?: (settings: EnergySettingsData) => void;
  isSavingEnergy?: boolean;
}

const defaultEnergy: EnergySettingsData = {
  level: 'MEDIO',
  tone: 'SICURO',
  volume: 'NORMAL',
  pace: 'MODERATO',
  vocabulary: 'COLLOQUIALE',
};

export function PhaseInspector({ 
  phase, 
  onUpdate, 
  isEditing, 
  energySettings, 
  onSaveEnergy,
  isSavingEnergy 
}: PhaseInspectorProps) {
  const [localEnergy, setLocalEnergy] = useState<EnergySettingsData>(energySettings || defaultEnergy);

  useEffect(() => {
    if (energySettings) {
      setLocalEnergy(energySettings);
    } else {
      setLocalEnergy(defaultEnergy);
    }
  }, [energySettings, phase.id]);

  const handleChange = (field: keyof Phase, value: string | number) => {
    if (!isEditing) return;
    onUpdate({ ...phase, [field]: value });
  };

  const handleEnergyChange = (field: keyof EnergySettingsData, value: string) => {
    setLocalEnergy(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveEnergy = () => {
    if (onSaveEnergy) {
      onSaveEnergy(localEnergy);
    }
  };

  return (
    <div className="space-y-4">
      <Card className="bg-muted/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <span>Dettagli Fase</span>
          </CardTitle>
          <CardDescription>
            Modifica le proprietà della fase selezionata.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phase-number">Numero Fase</Label>
            <Input
              id="phase-number"
              value={phase.number}
              onChange={(e) => handleChange('number', e.target.value)}
              readOnly={!isEditing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-name">Nome Fase</Label>
            <Input
              id="phase-name"
              value={phase.name}
              onChange={(e) => handleChange('name', e.target.value)}
              readOnly={!isEditing}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phase-description">Descrizione</Label>
            <Textarea
              id="phase-description"
              value={phase.description}
              onChange={(e) => handleChange('description', e.target.value)}
              rows={4}
              readOnly={!isEditing}
              placeholder="Obiettivo principale di questa fase..."
            />
          </div>
        </CardContent>
      </Card>

      {isEditing && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <span>Impostazioni Energia</span>
            </CardTitle>
            <CardDescription>
              Configura il livello di energia e il tono per questa fase.
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
      )}
    </div>
  );
}
