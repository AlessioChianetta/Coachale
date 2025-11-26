import { useState } from "react";
import { Bot, Wand2, Sparkles, Target, AlertCircle, UserCircle2, Save, Loader2 } from "lucide-react";
import AgentInstructionsPanel from "../AgentInstructionsPanel";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

interface AgentInstructionsProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
  mode: "create" | "edit";
  agentId: string | null;
  onInstructionsSaved?: () => void;
}

const aiPersonalities = [
  { value: "amico_fidato", label: "Amico Fidato", description: "Caldo, empatico, rassicurante" },
  { value: "coach_motivazionale", label: "Coach Motivazionale", description: "Energico, incoraggiante, positivo" },
  { value: "consulente_professionale", label: "Consulente Professionale", description: "Formale, competente, autorevole" },
  { value: "mentore_paziente", label: "Mentore Paziente", description: "Paziente, educativo, guida" },
  { value: "venditore_energico", label: "Venditore Energico", description: "Entusiasta, persuasivo, dinamico" },
  { value: "consigliere_empatico", label: "Consigliere Empatico", description: "Comprensivo, attento, supportivo" },
  { value: "stratega_diretto", label: "Stratega Diretto", description: "Chiaro, pragmatico, orientato ai risultati" },
  { value: "educatore_socratico", label: "Educatore Socratico", description: "Interrogativo, riflessivo, maieutico" },
  { value: "esperto_tecnico", label: "Esperto Tecnico", description: "Preciso, dettagliato, specializzato" },
  { value: "compagno_entusiasta", label: "Compagno Entusiasta", description: "Amichevole, giocoso, coinvolgente" },
];

export default function AgentInstructions({ formData, onChange, errors, mode, agentId, onInstructionsSaved }: AgentInstructionsProps) {
  const { toast } = useToast();
  const [isSavingIdentity, setIsSavingIdentity] = useState(false);

  const handleInstructionsChange = (data: {
    agentInstructions: string;
    agentInstructionsEnabled: boolean;
    selectedTemplate: "receptionist" | "marco_setter" | "custom";
    businessHeaderMode?: string;
    professionalRole?: string;
    customBusinessHeader?: string;
  }) => {
    onChange("agentInstructions", data.agentInstructions);
    onChange("agentInstructionsEnabled", data.agentInstructionsEnabled);
    onChange("selectedTemplate", data.selectedTemplate);
    if (data.businessHeaderMode !== undefined) onChange("businessHeaderMode", data.businessHeaderMode);
    if (data.professionalRole !== undefined) onChange("professionalRole", data.professionalRole);
    if (data.customBusinessHeader !== undefined) onChange("customBusinessHeader", data.customBusinessHeader);
  };

  const handleSaveIdentity = async () => {
    if (!agentId || mode !== "edit") return;

    setIsSavingIdentity(true);
    try {
      const payload = {
        businessHeaderMode: formData.businessHeaderMode,
        professionalRole: formData.professionalRole,
        customBusinessHeader: formData.customBusinessHeader,
      };

      console.log("🔵 [SAVE IDENTITY] Inizio salvataggio identità AI");
      console.log("🔵 [SAVE IDENTITY] Agent ID:", agentId);
      console.log("🔵 [SAVE IDENTITY] Payload:", JSON.stringify(payload, null, 2));

      const response = await fetch(`/api/whatsapp/config/${agentId}/instructions`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ [SAVE IDENTITY] Errore dal server:", errorData);
        throw new Error(errorData.error || "Failed to save identity");
      }

      const responseData = await response.json();
      console.log("✅ [SAVE IDENTITY] Risposta server:", JSON.stringify(responseData, null, 2));

      toast({
        title: "✅ Identità salvata",
        description: "L'identità AI è stata aggiornata con successo.",
      });
    } catch (error: any) {
      console.error("❌ [SAVE IDENTITY] Errore catch:", error);
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile salvare l'identità",
        variant: "destructive",
      });
    } finally {
      setIsSavingIdentity(false);
    }
  };

  const isProactiveAgent = formData.agentType === "proactive_setter";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Wand2 className="h-6 w-6 text-primary" />
          Istruzioni AI
        </h2>
        <p className="text-muted-foreground">
          Definisci come l'agente AI deve comportarsi durante le conversazioni
        </p>
      </div>

      <Card className="bg-gradient-to-br from-indigo-50/50 to-violet-50/50 dark:from-indigo-950/20 dark:to-violet-950/20 border-indigo-200 dark:border-indigo-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCircle2 className="h-5 w-5 text-indigo-600" />
            Identità AI
          </CardTitle>
          <CardDescription>
            Scegli come l'AI si presenta ai lead WhatsApp
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Label>Come si presenta l'AI?</Label>
            <RadioGroup 
              value={formData.businessHeaderMode || 'assistant'} 
              onValueChange={(value) => onChange('businessHeaderMode', value)}
              className="space-y-3"
            >
              <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="assistant" id="assistant" className="mt-1" />
                <div className="flex-1 space-y-1 cursor-pointer" onClick={() => onChange('businessHeaderMode', 'assistant')}>
                  <Label htmlFor="assistant" className="cursor-pointer font-medium">
                    Assistente del consulente
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    "Ciao, sono l'assistente di {formData.businessName || formData.consultantDisplayName || '[Nome]'}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'AI si presenta come assistente del business o del professionista
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="direct_professional" id="direct_professional" className="mt-1" />
                <div className="flex-1 space-y-1 cursor-pointer" onClick={() => onChange('businessHeaderMode', 'direct_professional')}>
                  <Label htmlFor="direct_professional" className="cursor-pointer font-medium">
                    Professionista diretto
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    "Ciao, sono {formData.consultantDisplayName || '[Nome]'}"
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    L'AI si presenta come il professionista stesso
                  </p>
                  {formData.businessHeaderMode === 'direct_professional' && (
                    <div className="mt-3 space-y-2">
                      <Label className="text-sm font-medium">Ruolo professionale</Label>
                      <Input
                        placeholder="Es: Insegnante di matematica, Coach finanziario..."
                        value={formData.professionalRole || ""}
                        onChange={(e) => onChange('professionalRole', e.target.value)}
                        className="text-sm"
                      />
                      <p className="text-xs text-muted-foreground">
                        💡 Inserisci solo il ruolo (es: "insegnante di matematica"). L'AI costruirà automaticamente: "Ciao, sono {formData.consultantDisplayName || 'Marco'}, insegnante di matematica"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3 rounded-lg border p-3 hover:bg-accent/50 transition-colors">
                <RadioGroupItem value="none" id="none" className="mt-1" />
                <div className="flex-1 space-y-1 cursor-pointer" onClick={() => onChange('businessHeaderMode', 'none')}>
                  <Label htmlFor="none" className="cursor-pointer font-medium">
                    Nessuna introduzione (controllo totale)
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Il tuo template custom definisce completamente come l'AI si presenta
                  </p>
                </div>
              </div>
            </RadioGroup>

            {formData.businessHeaderMode === 'none' && (
              <Alert className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm text-amber-800 dark:text-amber-200">
                  Con questa opzione, il tuo template custom ha controllo completo sull'identità. Assicurati di definire chiaramente "Chi sei" nelle istruzioni.
                </AlertDescription>
              </Alert>
            )}

            {mode === "edit" && agentId && (
              <Button
                onClick={handleSaveIdentity}
                disabled={isSavingIdentity}
                className="w-full mt-4"
                variant="secondary"
              >
                {isSavingIdentity ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Salva Identità AI
                  </>
                )}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-purple-50/50 to-pink-50/50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200 dark:border-purple-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Personalità AI
          </CardTitle>
          <CardDescription>
            Scegli il tono e lo stile di comunicazione dell'agente
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <Label htmlFor="aiPersonality">Tipo di Personalità</Label>
            <Select
              value={formData.aiPersonality || "amico_fidato"}
              onValueChange={(value) => onChange("aiPersonality", value)}
            >
              <SelectTrigger id="aiPersonality" className={errors.aiPersonality ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {aiPersonalities.map((personality) => (
                  <SelectItem key={personality.value} value={personality.value}>
                    <div>
                      <div className="font-semibold">{personality.label}</div>
                      <div className="text-xs text-muted-foreground">{personality.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.aiPersonality && (
              <p className="text-sm text-destructive flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.aiPersonality}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {isProactiveAgent && (
        <Card className="bg-gradient-to-br from-blue-50/50 to-cyan-50/50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Target className="h-5 w-5 text-blue-600" />
              Default Lead Proattivi
            </CardTitle>
            <CardDescription>
              Valori predefiniti applicati ai lead proattivi quando non specificati
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-sm text-blue-800 dark:text-blue-200">
                Questi campi saranno usati come valori di default quando crei lead proattivi senza specificare obiettivi personalizzati.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="defaultObiettivi">Obiettivi Default</Label>
                <Badge variant="secondary" className="text-xs font-mono bg-purple-100 text-purple-700">
                  {"{obiettivi}"}
                </Badge>
              </div>
              <Textarea
                id="defaultObiettivi"
                placeholder="Es: Raggiungere libertà finanziaria con 500k€ di patrimonio"
                value={formData.defaultObiettivi || ""}
                onChange={(e) => onChange("defaultObiettivi", e.target.value)}
                rows={2}
                className={errors.defaultObiettivi ? "border-destructive" : ""}
              />
              {errors.defaultObiettivi && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.defaultObiettivi}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="defaultDesideri">Desideri Default</Label>
                <Badge variant="secondary" className="text-xs font-mono bg-purple-100 text-purple-700">
                  {"{desideri}"}
                </Badge>
              </div>
              <Textarea
                id="defaultDesideri"
                placeholder="Es: Lavorare meno, guadagnare di più, avere più tempo per la famiglia"
                value={formData.defaultDesideri || ""}
                onChange={(e) => onChange("defaultDesideri", e.target.value)}
                rows={2}
                className={errors.defaultDesideri ? "border-destructive" : ""}
              />
              {errors.defaultDesideri && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.defaultDesideri}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="defaultUncino">Uncino Default (Hook)</Label>
                <Badge variant="secondary" className="text-xs font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {"{uncino}"}
                </Badge>
                <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                  {"{"}
                  {"{"}4{"}"}
                  {"}"}
                </Badge>
              </div>
              <Textarea
                id="defaultUncino"
                placeholder="Es: Stanco di lavorare 60 ore a settimana senza vedere risultati?"
                value={formData.defaultUncino || ""}
                onChange={(e) => onChange("defaultUncino", e.target.value)}
                rows={2}
                className={errors.defaultUncino ? "border-destructive" : ""}
              />
              {errors.defaultUncino && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.defaultUncino}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Label htmlFor="defaultIdealState">Stato Ideale Default</Label>
                <Badge variant="secondary" className="text-xs font-mono bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                  {"{stato_ideale}"}
                </Badge>
                <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {"{"}
                  {"{"}5{"}"}
                  {"}"}
                </Badge>
              </div>
              <Textarea
                id="defaultIdealState"
                placeholder="Es: Generare 10k€/mese di rendita passiva lavorando solo 20 ore a settimana"
                value={formData.defaultIdealState || ""}
                onChange={(e) => onChange("defaultIdealState", e.target.value)}
                rows={2}
                className={errors.defaultIdealState ? "border-destructive" : ""}
              />
              {errors.defaultIdealState && (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  {errors.defaultIdealState}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <AgentInstructionsPanel
        agentId={agentId}
        initialData={{
          agentInstructions: formData.agentInstructions,
          agentInstructionsEnabled: formData.agentInstructionsEnabled,
          selectedTemplate: formData.selectedTemplate,
          businessHeaderMode: formData.businessHeaderMode,
          professionalRole: formData.professionalRole,
          customBusinessHeader: formData.customBusinessHeader,
          agentName: formData.agentName,
        }}
        bookingEnabled={formData.bookingEnabled}
        onChange={handleInstructionsChange}
        mode={mode}
        onSaveSuccess={onInstructionsSaved}
      />
    </div>
  );
}
