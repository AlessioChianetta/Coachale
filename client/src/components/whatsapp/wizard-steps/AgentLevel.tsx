import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LevelSelector } from "@/components/whatsapp/LevelBadge";
import { 
  Users, 
  AlertCircle, 
  Globe, 
  Lock, 
  BookOpen,
  MessageSquare,
  Link as LinkIcon,
  Info
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
  
  const handleLevelChange = (level: "1" | "2" | null) => {
    onChange("level", level);
    if (level !== "1") {
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
            Selezione Livello
          </CardTitle>
          <CardDescription>
            Scegli se rendere questo agente accessibile pubblicamente
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <LevelSelector
            value={formData.level}
            onChange={handleLevelChange}
          />
        </CardContent>
      </Card>

      {formData.level === "1" && (
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

      {formData.level === "2" && (
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

      {formData.level === "3" && (
        <Card className="border-2 border-yellow-400/30 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-yellow-400/10 via-amber-400/10 to-orange-400/10">
            <CardTitle className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-amber-600" />
              Informazioni Livello 3 - Deluxe
            </CardTitle>
            <CardDescription>
              Accesso completo al software per clienti premium
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="grid gap-4">
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <Lock className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Login Cliente Richiesto</p>
                  <p className="text-sm text-amber-700">
                    Solo i clienti premium autenticati possono accedere
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <BookOpen className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Accesso Completo al Software</p>
                  <p className="text-sm text-amber-700">
                    Il cliente ha accesso a tutte le funzionalità della piattaforma
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-lg">
                <MessageSquare className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">Messaggi Illimitati + AI Manager</p>
                  <p className="text-sm text-amber-700">
                    Accesso illimitato all'agente AI e alla sezione Manager
                  </p>
                </div>
              </div>
            </div>

            <Alert className="border-amber-300 bg-amber-50">
              <Info className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                <strong>Premium:</strong> Questo livello richiede l'abbonamento più alto.
                I clienti avranno accesso completo alla tua piattaforma.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      )}

      {!formData.level && (
        <Alert className="border-blue-200 bg-blue-50">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            <strong>Agente Standard:</strong> Questo agente non sarà accessibile pubblicamente. 
            Sarà disponibile solo tramite WhatsApp diretto o le altre integrazioni configurate.
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
