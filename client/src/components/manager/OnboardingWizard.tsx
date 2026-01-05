import { useState, useEffect } from "react";
import { Loader2, ArrowRight, ArrowLeft, Check, Sparkles, MessageSquare, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import confetti from "canvas-confetti";

interface OnboardingWizardProps {
  slug: string;
  clientEmail: string;
  agentName?: string;
  tier: "bronze" | "silver" | "gold";
  onComplete: () => void;
  onSkip?: () => void;
}

const WRITING_STYLES = [
  { value: "default", label: "Predefinito", description: "Stile e tono predefiniti" },
  { value: "professional", label: "Professionale", description: "Cortese e preciso" },
  { value: "friendly", label: "Amichevole", description: "Espansivo e loquace" },
  { value: "direct", label: "Schietto", description: "Diretto e incoraggiante" },
  { value: "eccentric", label: "Eccentrico", description: "Vivace e fantasioso" },
  { value: "efficient", label: "Efficiente", description: "Essenziale e semplice" },
  { value: "nerd", label: "Nerd", description: "Curioso e appassionato" },
  { value: "cynical", label: "Cinico", description: "Critico e sarcastico" },
  { value: "custom", label: "Personalizzato", description: "Usa istruzioni personalizzate" },
];

const RESPONSE_LENGTHS = [
  { value: "short", label: "Breve", description: "1-2 paragrafi" },
  { value: "balanced", label: "Bilanciata", description: "Lunghezza moderata" },
  { value: "comprehensive", label: "Completa", description: "Dettagliata e completa" },
];

export function OnboardingWizard({
  slug,
  clientEmail,
  agentName = "Assistente AI",
  tier,
  onComplete,
  onSkip,
}: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [explanation, setExplanation] = useState<string>("");
  const [preferences, setPreferences] = useState({
    writingStyle: "default" as "default" | "professional" | "friendly" | "direct" | "eccentric" | "efficient" | "nerd" | "cynical" | "custom",
    responseLength: "balanced" as "short" | "balanced" | "comprehensive",
    customInstructions: "",
  });

  const getToken = () => {
    return localStorage.getItem("manager_token") || localStorage.getItem("token");
  };

  useEffect(() => {
    if (currentStep === 1) {
      fetchExplanation();
    }
  }, [currentStep]);

  useEffect(() => {
    if (currentStep === 3) {
      const tierColors = {
        bronze: ["#cd7f32", "#b87333", "#a0522d", "#8b4513"],
        silver: ["#94a3b8", "#64748b", "#475569", "#6366f1"],
        gold: ["#fbbf24", "#f59e0b", "#d97706", "#eab308"],
      };
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: tierColors[tier] || tierColors.bronze,
      });
    }
  }, [currentStep, tier]);

  const fetchExplanation = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/public/agent/${slug}/onboarding-explanation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({ clientEmail }),
      });

      if (response.ok) {
        const data = await response.json();
        setExplanation(data.explanation || "");
      }
    } catch (error) {
      console.error("Failed to fetch onboarding explanation:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async () => {
    setIsSaving(true);
    try {
      const response = await fetch(`/api/public/agent/${slug}/onboarding-preferences`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
        body: JSON.stringify({
          writingStyle: preferences.writingStyle,
          responseLength: preferences.responseLength,
          customInstructions: preferences.customInstructions || null,
        }),
      });

      if (response.ok) {
        setCurrentStep(3);
      }
    } catch (error) {
      console.error("Failed to save preferences:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleNext = () => {
    if (currentStep === 1) {
      setCurrentStep(2);
    } else if (currentStep === 2) {
      savePreferences();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const tierConfig = {
    bronze: {
      gradient: "from-amber-600 to-amber-800",
      bgGradient: "from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20",
      borderColor: "border-amber-200 dark:border-amber-700",
      name: "Bronze",
    },
    silver: {
      gradient: "from-slate-400 to-slate-600",
      bgGradient: "from-slate-50 to-slate-100 dark:from-slate-800/50 dark:to-slate-900/50",
      borderColor: "border-slate-200 dark:border-slate-700",
      name: "Silver",
    },
    gold: {
      gradient: "from-yellow-400 to-amber-500",
      bgGradient: "from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20",
      borderColor: "border-yellow-200 dark:border-yellow-700",
      name: "Gold",
    },
  };

  const config = tierConfig[tier];
  const progressPercent = (currentStep / 3) * 100;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                {currentStep === 1 && <Sparkles className="h-5 w-5 text-white" />}
                {currentStep === 2 && <Settings2 className="h-5 w-5 text-white" />}
                {currentStep === 3 && <Check className="h-5 w-5 text-white" />}
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                  {currentStep === 1 && "Benvenuto!"}
                  {currentStep === 2 && "Le tue Preferenze"}
                  {currentStep === 3 && "Tutto Pronto!"}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Passo {currentStep} di 3
                </p>
              </div>
            </div>
            {onSkip && currentStep < 3 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onSkip}
                className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Salta
              </Button>
            )}
          </div>
          <Progress value={progressPercent} className="h-1.5" />
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {currentStep === 1 && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-slate-400 mb-4" />
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Preparo il tuo benvenuto personalizzato...
                  </p>
                </div>
              ) : (
                <>
                  <div className={`p-4 rounded-xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor}`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center`}>
                        <MessageSquare className="h-4 w-4 text-white" />
                      </div>
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {agentName}
                      </span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {explanation || `Benvenuto nel piano ${config.name}! Sono ${agentName}, il tuo assistente AI personale. Sono qui per aiutarti in ogni momento, con risposte intelligenti e personalizzate. Nelle prossime schermate potrai configurare come preferisci che io risponda.`}
                    </p>
                  </div>

                  <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
                    <h3 className="font-medium text-slate-900 dark:text-white mb-2">
                      Cosa puoi fare con il piano {config.name}:
                    </h3>
                    <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Messaggi illimitati
                      </li>
                      <li className="flex items-center gap-2">
                        <Check className="h-4 w-4 text-green-500" />
                        Personalizza le risposte AI
                      </li>
                      {tier === "gold" && (
                        <li className="flex items-center gap-2">
                          <Check className="h-4 w-4 text-green-500" />
                          Accesso prioritario alle novità
                        </li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {currentStep === 2 && (
            <div className="space-y-6">
              <div className="space-y-3">
                <Label className="text-base font-medium">Stile di Scrittura</Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Come preferisci che l'AI comunichi con te?
                </p>
                <Select
                  value={preferences.writingStyle}
                  onValueChange={(value) => setPreferences({ ...preferences, writingStyle: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona uno stile" />
                  </SelectTrigger>
                  <SelectContent>
                    {WRITING_STYLES.map((style) => (
                      <SelectItem key={style.value} value={style.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{style.label}</span>
                          <span className="text-xs text-slate-500">{style.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Lunghezza Risposte</Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Quanto dettagliate vuoi che siano le risposte?
                </p>
                <Select
                  value={preferences.responseLength}
                  onValueChange={(value) => setPreferences({ ...preferences, responseLength: value as any })}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Seleziona una lunghezza" />
                  </SelectTrigger>
                  <SelectContent>
                    {RESPONSE_LENGTHS.map((length) => (
                      <SelectItem key={length.value} value={length.value}>
                        <div className="flex flex-col">
                          <span className="font-medium">{length.label}</span>
                          <span className="text-xs text-slate-500">{length.description}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-medium">Istruzioni Personalizzate</Label>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Aggiungi istruzioni specifiche per personalizzare le risposte (opzionale)
                </p>
                <Textarea
                  value={preferences.customInstructions}
                  onChange={(e) => setPreferences({ ...preferences, customInstructions: e.target.value })}
                  placeholder="Es: Rispondi sempre in modo empatico, usa esempi pratici, evita termini troppo tecnici..."
                  className="min-h-[100px] resize-none"
                  maxLength={500}
                />
                <p className="text-xs text-slate-400 text-right">
                  {preferences.customInstructions.length}/500 caratteri
                </p>
              </div>
            </div>
          )}

          {currentStep === 3 && (
            <div className="text-center py-8 space-y-6">
              <div className={`w-20 h-20 mx-auto rounded-full bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-lg`}>
                <Check className="h-10 w-10 text-white" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">
                  Configurazione Completata!
                </h3>
                <p className="text-slate-600 dark:text-slate-400">
                  Le tue preferenze sono state salvate. Ora {agentName} è pronto a rispondere alle tue domande nel modo che preferisci.
                </p>
              </div>

              <div className={`p-4 rounded-xl bg-gradient-to-br ${config.bgGradient} border ${config.borderColor}`}>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Puoi modificare le tue preferenze in qualsiasi momento dalle impostazioni.
                </p>
              </div>
            </div>
          )}
        </div>

        <div className="p-4 sm:p-6 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          {currentStep > 1 && currentStep < 3 ? (
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={isSaving}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Indietro
            </Button>
          ) : (
            <div />
          )}

          {currentStep < 3 ? (
            <Button
              onClick={handleNext}
              disabled={isLoading || isSaving}
              className={`bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Salvataggio...
                </>
              ) : (
                <>
                  {currentStep === 2 ? "Salva Preferenze" : "Avanti"}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={onComplete}
              className={`w-full bg-gradient-to-r ${config.gradient} hover:opacity-90 text-white text-lg py-6`}
            >
              <Sparkles className="h-5 w-5 mr-2" />
              Inizia a Chattare
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
