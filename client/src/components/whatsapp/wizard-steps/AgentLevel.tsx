import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { MultiLevelSelector, LevelBadges } from "@/components/whatsapp/LevelBadge";
import { 
  Users, 
  AlertCircle, 
  Globe, 
  Lock, 
  BookOpen,
  MessageSquare,
  Link as LinkIcon,
  Info,
  ArrowUpCircle,
  Crown,
  Layers,
  Sparkles,
  Zap,
  Copy,
  Check,
  Brain,
  ChevronRight,
  Shield
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AgentLevelProps {
  formData: any;
  onChange: (field: string, value: any) => void;
  errors: Record<string, string>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug: string): boolean {
  return /^[a-z0-9-]*$/.test(slug);
}

export default function AgentLevel({ formData, onChange, errors }: AgentLevelProps) {
  const [slugError, setSlugError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  const levels: ("1" | "2" | "3")[] = formData.levels || [];
  const hasLevel1 = levels.includes("1");
  const hasLevel2 = levels.includes("2");
  const hasLevel3 = levels.includes("3");
  const hasBothLevels = hasLevel1 && hasLevel2;
  const hasMultipleLevels = levels.length >= 2;
  
  const handleLevelsChange = (newLevels: ("1" | "2" | "3")[]) => {
    onChange("levels", newLevels);
    if (!newLevels.includes("1")) {
      onChange("publicSlug", "");
    }
  };

  const handleSlugChange = (value: string) => {
    const sanitized = slugify(value);
    onChange("publicSlug", sanitized);
    
    if (value !== sanitized && value.length > 0) {
      setSlugError("Lo slug è stato convertito in formato URL-safe");
    } else {
      setSlugError(null);
    }
  };

  const handleDailyLimitChange = (value: string) => {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 1) {
      onChange("dailyMessageLimit", num);
    }
  };

  const currentDomain = typeof window !== 'undefined' ? window.location.origin : '';
  const publicUrl = formData.publicSlug ? `${currentDomain}/agent/${formData.publicSlug}/chat` : '';

  const handleCopyUrl = () => {
    if (publicUrl) {
      navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Layers className="h-6 w-6 text-primary" />
          Sistema Livelli di Accesso
        </h2>
        <p className="text-muted-foreground">
          Configura i livelli di accesso e le istruzioni AI personalizzate per ogni tipo di utente.
          Nella sezione successiva configurerai il template di risposta dell'agente.
        </p>
      </div>

      <Card className="border border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white shadow-sm">
        <CardContent className="pt-5 pb-4">
          <div className="flex gap-3 items-start">
            <div className="p-2 rounded-lg bg-indigo-100 shrink-0 mt-0.5">
              <Brain className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-indigo-900 text-sm">Come funziona il sistema a livelli</p>
              <div className="text-sm text-indigo-800/80 space-y-1.5">
                <p>Ogni livello ha delle <strong>istruzioni AI personalizzate</strong> che modificano il comportamento dell'agente:</p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                  <div className="flex items-center gap-2 bg-white/60 rounded-md px-3 py-2 border border-indigo-100">
                    <div className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                    <span className="text-xs"><strong>Bronzo</strong> riceve istruzioni base</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 rounded-md px-3 py-2 border border-indigo-100">
                    <div className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                    <span className="text-xs"><strong>Argento</strong> = Bronzo + sue istruzioni</span>
                  </div>
                  <div className="flex items-center gap-2 bg-white/60 rounded-md px-3 py-2 border border-indigo-100">
                    <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                    <span className="text-xs"><strong>Gold</strong> = Bronzo + Argento + sue</span>
                  </div>
                </div>
                <p className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Le istruzioni si accumulano: i livelli superiori ricevono tutto ciò che ricevono quelli inferiori, più le loro istruzioni aggiuntive.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 pb-4">
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5 text-primary" />
            Selezione Livelli
          </CardTitle>
          <CardDescription>
            Seleziona i livelli di accesso per questo agente. Puoi selezionarne più di uno per permettere agli utenti di fare upgrade.
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <MultiLevelSelector
            values={levels}
            onChange={handleLevelsChange}
          />
        </CardContent>
      </Card>

      {hasLevel1 && (
        <Card className="border-2 border-amber-500/30 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-amber-500/10 to-orange-400/10 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-amber-500/20">
                  <LinkIcon className="h-4 w-4 text-amber-600" />
                </div>
                Livello 1 — Bronzo
              </CardTitle>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                Accesso Gratuito
              </span>
            </div>
            <CardDescription>
              Utenti che accedono tramite link pubblico con registrazione gratuita
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="space-y-3">
                <Label htmlFor="publicSlug" className="text-sm font-semibold flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-amber-600" />
                  Slug URL Pubblico <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="publicSlug"
                  value={formData.publicSlug || ""}
                  onChange={(e) => handleSlugChange(e.target.value)}
                  placeholder="es: silvia, marco-ai, assistente"
                  className={cn(
                    "text-base",
                    (errors.publicSlug || slugError) && "border-amber-500 focus-visible:ring-amber-500"
                  )}
                />
                {slugError && (
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {slugError}
                  </p>
                )}
                {errors.publicSlug && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.publicSlug}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="dailyMessageLimit" className="text-sm font-semibold flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-600" />
                  Limite Messaggi Mensili
                </Label>
                <Input
                  id="dailyMessageLimit"
                  type="number"
                  min={1}
                  max={100}
                  value={formData.dailyMessageLimit || 15}
                  onChange={(e) => handleDailyLimitChange(e.target.value)}
                  className="text-base w-32"
                />
                <p className="text-xs text-muted-foreground">
                  Massimo 100 messaggi/mese per utente
                </p>
              </div>
            </div>
            
            {publicUrl && (
              <div className="p-3 bg-amber-50 rounded-lg border border-amber-200 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs text-amber-600 font-medium mb-0.5">Link pubblico agente:</p>
                  <p className="text-sm font-mono text-amber-800 break-all">{publicUrl}</p>
                </div>
                <button
                  onClick={handleCopyUrl}
                  className="shrink-0 p-2 rounded-md hover:bg-amber-100 transition-colors"
                  title="Copia URL"
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-600" />
                  ) : (
                    <Copy className="h-4 w-4 text-amber-600" />
                  )}
                </button>
              </div>
            )}

            <div className="border-t border-amber-200/50 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-amber-600" />
                <Label htmlFor="levelPromptOverlay1" className="text-sm font-semibold">
                  Istruzioni AI — Livello Bronzo
                </Label>
              </div>
              <Textarea
                id="levelPromptOverlay1"
                value={formData.levelPromptOverlay1 || ""}
                onChange={(e) => onChange("levelPromptOverlay1", e.target.value)}
                placeholder={"Esempio:\n• Rispondi in modo generico e sintetico\n• Non fornire analisi dettagliate, suggerisci di fare upgrade\n• Mantieni un tono accogliente ma breve"}
                rows={4}
                className="resize-y font-mono text-sm"
              />
              <div className="mt-2 p-2.5 rounded-md bg-amber-50/70 border border-amber-100">
                <p className="text-xs text-amber-700 flex items-start gap-1.5">
                  <Zap className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    Queste istruzioni vengono aggiunte al <strong>template dell'agente</strong> (che configuri nella sezione successiva) 
                    per tutti gli utenti Bronzo. Servono a differenziare il comportamento dell'AI in base al livello.
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLevel2 && (
        <Card className="border-2 border-slate-300/50 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-slate-100/80 to-slate-50 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-slate-200">
                  <Shield className="h-4 w-4 text-slate-600" />
                </div>
                Livello 2 — Argento
              </CardTitle>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                Abbonamento Richiesto
              </span>
            </div>
            <CardDescription>
              Utenti con abbonamento attivo — accesso avanzato all'agente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <Lock className="h-5 w-5 text-slate-500 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Login Richiesto</p>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <BookOpen className="h-5 w-5 text-slate-500 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Knowledge Base</p>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-slate-50 rounded-lg border border-slate-100">
                <MessageSquare className="h-5 w-5 text-slate-500 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Messaggi Illimitati</p>
              </div>
            </div>

            <div className="border-t border-slate-200/50 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-slate-600" />
                <Label htmlFor="levelPromptOverlay2" className="text-sm font-semibold">
                  Istruzioni AI Aggiuntive — Livello Argento
                </Label>
              </div>
              <Textarea
                id="levelPromptOverlay2"
                value={formData.levelPromptOverlay2 || ""}
                onChange={(e) => onChange("levelPromptOverlay2", e.target.value)}
                placeholder={"Esempio:\n• Fornisci risposte più dettagliate e personalizzate\n• Puoi accedere alla knowledge base per arricchire le risposte\n• Offri consigli pratici e specifici"}
                rows={4}
                className="resize-y font-mono text-sm"
              />
              <div className="mt-2 p-2.5 rounded-md bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-600 flex items-start gap-1.5">
                  <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Modello additivo:</strong> gli utenti Argento ricevono le istruzioni Bronzo 
                    <strong> + </strong> queste istruzioni aggiuntive. Scrivi solo ciò che vuoi aggiungere rispetto al Bronzo.
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasLevel3 && (
        <Card className="border-2 border-yellow-400/40 shadow-lg overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-yellow-50 to-amber-50/70 pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 rounded-md bg-yellow-200/70">
                  <Crown className="h-4 w-4 text-yellow-600" />
                </div>
                Livello 3 — Gold
              </CardTitle>
              <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 border border-yellow-200">
                Accesso Premium
              </span>
            </div>
            <CardDescription>
              Clienti Gold con accesso completo a tutte le funzionalità dell'agente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-5">
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center text-center p-3 bg-yellow-50/70 rounded-lg border border-yellow-100">
                <Crown className="h-5 w-5 text-yellow-600 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Accesso Sidebar</p>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-yellow-50/70 rounded-lg border border-yellow-100">
                <BookOpen className="h-5 w-5 text-yellow-600 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Accesso Completo</p>
              </div>
              <div className="flex flex-col items-center text-center p-3 bg-yellow-50/70 rounded-lg border border-yellow-100">
                <Users className="h-5 w-5 text-yellow-600 mb-1.5" />
                <p className="text-xs font-medium text-slate-700">Gestione Individuale</p>
              </div>
            </div>

            <div className="border-t border-yellow-200/50 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="h-4 w-4 text-yellow-600" />
                <Label htmlFor="levelPromptOverlay3" className="text-sm font-semibold">
                  Istruzioni AI Aggiuntive — Livello Gold
                </Label>
              </div>
              <Textarea
                id="levelPromptOverlay3"
                value={formData.levelPromptOverlay3 || ""}
                onChange={(e) => onChange("levelPromptOverlay3", e.target.value)}
                placeholder={"Esempio:\n• Offri consulenza completa e analisi approfondite\n• Accesso esclusivo a strategie avanzate\n• Tratta l'utente come un cliente VIP con massima attenzione"}
                rows={4}
                className="resize-y font-mono text-sm"
              />
              <div className="mt-2 p-2.5 rounded-md bg-yellow-50 border border-yellow-200">
                <p className="text-xs text-yellow-700 flex items-start gap-1.5">
                  <Layers className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>
                    <strong>Modello additivo:</strong> gli utenti Gold ricevono Bronzo + Argento 
                    <strong> + </strong> queste istruzioni. Scrivi solo le istruzioni esclusive per il livello Gold.
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {hasMultipleLevels && (
        <Card className="border border-emerald-200 shadow-md overflow-hidden">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-2 mb-4">
              <ArrowUpCircle className="h-5 w-5 text-emerald-600" />
              <p className="font-semibold text-sm text-emerald-800">Percorso di Upgrade</p>
            </div>
            <div className="flex items-center gap-2 justify-center p-4 bg-gradient-to-r from-amber-50 via-slate-50 to-yellow-50 rounded-lg flex-wrap">
              {hasLevel1 && (
                <>
                  <div className="text-center">
                    <LevelBadges levels={["1"]} />
                    <p className="text-xs text-muted-foreground mt-1">Bronzo</p>
                    <p className="text-[10px] text-amber-600 font-medium">Istruzioni L1</p>
                  </div>
                  {(hasLevel2 || hasLevel3) && <ChevronRight className="h-5 w-5 text-emerald-400" />}
                </>
              )}
              {hasLevel2 && (
                <>
                  <div className="text-center">
                    <LevelBadges levels={["2"]} />
                    <p className="text-xs text-muted-foreground mt-1">Argento</p>
                    <p className="text-[10px] text-slate-500 font-medium">L1 + L2</p>
                  </div>
                  {hasLevel3 && <ChevronRight className="h-5 w-5 text-emerald-400" />}
                </>
              )}
              {hasLevel3 && (
                <div className="text-center">
                  <LevelBadges levels={["3"]} />
                  <p className="text-xs text-muted-foreground mt-1">Gold</p>
                  <p className="text-[10px] text-yellow-600 font-medium">L1 + L2 + L3</p>
                </div>
              )}
            </div>
            <p className="text-xs text-center text-muted-foreground mt-3">
              Gli utenti che fanno upgrade mantengono le credenziali e la cronologia delle conversazioni. 
              Le istruzioni AI si accumulano ad ogni livello superiore.
            </p>
          </CardContent>
        </Card>
      )}

      {levels.length === 0 && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
              <Info className="h-5 w-5" />
              Nessun Livello Selezionato — Agente Standard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-blue-700">
              Senza livelli, l'agente funziona come un <strong>agente WhatsApp standard</strong>:
            </p>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex items-center gap-2 p-2.5 bg-blue-100/50 rounded-lg border border-blue-200">
                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs text-blue-700"><strong>Nessuna pagina pubblica</strong> nel sistema Dipendenti AI</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-blue-100/50 rounded-lg border border-blue-200">
                <MessageSquare className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs text-blue-700"><strong>Solo WhatsApp diretto</strong> tramite numero configurato</span>
              </div>
              <div className="flex items-center gap-2 p-2.5 bg-blue-100/50 rounded-lg border border-blue-200">
                <Zap className="h-4 w-4 text-blue-500 shrink-0" />
                <span className="text-xs text-blue-700"><strong>Nessun limite</strong> messaggi per gli utenti</span>
              </div>
            </div>
            <p className="text-xs text-blue-600 bg-blue-100/30 p-2 rounded border border-blue-100">
              <strong>Quando usare:</strong> Se vuoi l'agente solo per WhatsApp diretto, senza sistema di abbonamenti o istruzioni differenziate per livello.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
