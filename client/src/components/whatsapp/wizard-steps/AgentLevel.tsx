import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  ArrowUpCircle
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
  
  const levels: ("1" | "2")[] = formData.levels || [];
  const hasLevel1 = levels.includes("1");
  const hasLevel2 = levels.includes("2");
  const hasBothLevels = hasLevel1 && hasLevel2;
  
  const handleLevelsChange = (newLevels: ("1" | "2")[]) => {
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
  const publicUrl = formData.publicSlug ? `${currentDomain}/ai/${formData.publicSlug}` : '';

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Users className="h-6 w-6 text-primary" />
          Dipendente AI - Livello Accesso
        </h2>
        <p className="text-muted-foreground">
          Configura il livello di accesso pubblico per questo agente AI
        </p>
      </div>

      <Card className="border-2 border-primary/20 shadow-lg">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10">
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
        <Card className="border-2 border-amber-500/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-amber-500/5 to-amber-500/10">
            <CardTitle className="flex items-center gap-2">
              <LinkIcon className="h-5 w-5 text-amber-600" />
              Configurazione Livello 1 - Bronzo
            </CardTitle>
            <CardDescription>
              Configura l'accesso pubblico per utenti non registrati
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-6">
            <div className="space-y-3">
              <Label htmlFor="publicSlug" className="text-base font-medium">
                Slug URL Pubblico <span className="text-destructive">*</span>
              </Label>
              <div className="space-y-2">
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
                  <p className="text-sm text-amber-600 flex items-center gap-1">
                    <Info className="h-3 w-3" />
                    {slugError}
                  </p>
                )}
                {errors.publicSlug && (
                  <p className="text-sm text-destructive flex items-center gap-1">
                    <AlertCircle className="h-3 w-3" />
                    {errors.publicSlug}
                  </p>
                )}
              </div>
              
              {publicUrl && (
                <div className="p-3 bg-slate-50 rounded-lg border">
                  <p className="text-xs text-muted-foreground mb-1">Anteprima URL pubblico:</p>
                  <p className="text-sm font-mono text-primary break-all">{publicUrl}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <Label htmlFor="dailyMessageLimit" className="text-base font-medium">
                Limite Messaggi Giornalieri
              </Label>
              <div className="space-y-2">
                <Input
                  id="dailyMessageLimit"
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.dailyMessageLimit || 15}
                  onChange={(e) => handleDailyLimitChange(e.target.value)}
                  className="text-base w-32"
                />
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Limite messaggi al giorno per utenti non registrati
                </p>
              </div>
            </div>

            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Livello 1 - Bronzo:</strong> Gli utenti possono accedere all'agente 
                tramite link pubblico senza registrazione. Il limite giornaliero di messaggi 
                previene abusi.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {hasLevel2 && (
        <Card className="border-2 border-slate-400/20 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-slate-400/5 to-slate-400/10">
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-slate-600" />
              Informazioni Livello 2 - Argento
            </CardTitle>
            <CardDescription>
              Accesso riservato ai clienti con knowledge base
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <Lock className="h-5 w-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Login Cliente Richiesto</p>
                  <p className="text-sm text-slate-600">
                    Solo i clienti autenticati possono accedere a questo agente
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <BookOpen className="h-5 w-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Accesso Knowledge Base</p>
                  <p className="text-sm text-slate-600">
                    L'agente ha accesso completo alla knowledge base del consulente
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-slate-600 mt-0.5" />
                <div>
                  <p className="font-medium text-slate-900">Nessun Limite Messaggi</p>
                  <p className="text-sm text-slate-600">
                    I clienti possono inviare messaggi illimitati all'agente
                  </p>
                </div>
              </div>
            </div>

            <Alert className="border-slate-300 bg-slate-50">
              <Info className="h-4 w-4 text-slate-600" />
              <AlertDescription className="text-slate-700">
                <strong>Nota:</strong> I clienti devono acquistare un abbonamento Livello 2 
                per accedere a questo agente. Puoi configurare i prezzi nelle impostazioni 
                del tuo account.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {hasBothLevels && (
        <Card className="border-2 border-green-400/30 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-green-400/10 to-emerald-400/10">
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-green-600" />
              Percorso di Upgrade
            </CardTitle>
            <CardDescription>
              Gli utenti possono fare upgrade mantenendo lo stesso agente
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="flex items-center gap-4 justify-center p-4 bg-gradient-to-r from-amber-50 to-slate-50 rounded-lg">
              <div className="text-center">
                <LevelBadges levels={["1"]} />
                <p className="text-xs text-muted-foreground mt-1">Bronze</p>
              </div>
              <ArrowUpCircle className="h-6 w-6 text-green-500" />
              <div className="text-center">
                <LevelBadges levels={["2"]} />
                <p className="text-xs text-muted-foreground mt-1">Silver</p>
              </div>
            </div>
            <p className="text-sm text-center text-muted-foreground">
              Gli utenti Bronze che fanno upgrade a Silver mantengono le stesse credenziali 
              e la cronologia delle conversazioni.
            </p>
          </CardContent>
        </Card>
      )}

      {levels.length === 0 && (
        <Card className="border-2 border-blue-200 bg-blue-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-blue-800 text-base">
              <Info className="h-5 w-5" />
              Nessun Livello Selezionato - Agente Standard
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0 space-y-3">
            <p className="text-sm text-blue-700">
              Quando non selezioni alcun livello, l'agente funziona come un <strong>agente WhatsApp standard</strong>:
            </p>
            <ul className="text-sm text-blue-700 space-y-2 ml-4">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Non accessibile pubblicamente:</strong> L'agente non avrà una pagina pubblica nel sistema Dipendenti AI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Solo WhatsApp diretto:</strong> Gli utenti potranno contattare l'agente solo tramite il numero WhatsApp configurato</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                <span><strong>Nessun limite messaggi:</strong> Non ci sono limiti giornalieri per gli utenti</span>
              </li>
            </ul>
            <div className="p-3 bg-blue-100/50 rounded-lg border border-blue-200">
              <p className="text-xs text-blue-800">
                <strong>Quando usare questa opzione:</strong> Scegli di non selezionare alcun livello se vuoi 
                utilizzare l'agente solo per gestire conversazioni WhatsApp dirette senza il sistema di 
                abbonamenti Dipendenti AI.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
