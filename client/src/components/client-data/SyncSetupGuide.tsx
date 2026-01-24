import { 
  CheckCircle2, 
  Circle, 
  Key, 
  Calendar, 
  TestTube, 
  Send, 
  FileText,
  Copy,
  ExternalLink,
  AlertTriangle,
  Info
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useDatasetSyncSources, useSyncStats } from "@/hooks/useDatasetSync";
import { useToast } from "@/hooks/use-toast";

interface StepProps {
  number: number;
  title: string;
  description: string;
  isCompleted: boolean;
  children: React.ReactNode;
}

function SetupStep({ number, title, description, isCompleted, children }: StepProps) {
  return (
    <div className="relative pl-8 pb-8 last:pb-0">
      <div className="absolute left-0 top-0 flex h-6 w-6 items-center justify-center rounded-full border-2 border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-700">
        {isCompleted ? (
          <CheckCircle2 className="h-5 w-5 text-emerald-500" />
        ) : (
          <span className="text-xs font-bold text-slate-500">{number}</span>
        )}
      </div>
      <div className="absolute left-[11px] top-6 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-700 last:hidden" />
      
      <div className="ml-4">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-lg">{title}</h3>
          {isCompleted && (
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
              Completato
            </Badge>
          )}
        </div>
        <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{description}</p>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-4 border border-slate-200 dark:border-slate-700">
          {children}
        </div>
      </div>
    </div>
  );
}

export function SyncSetupGuide() {
  const { toast } = useToast();
  const { data: sourcesData } = useDatasetSyncSources();
  const { data: statsData } = useSyncStats();
  
  const sources = sourcesData?.data || [];
  const stats = statsData?.data;
  
  const hasSource = sources.length > 0;
  const hasActiveSource = sources.some(s => s.is_active);
  const hasSuccessfulSync = (stats?.syncsLast24h || 0) > 0;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copiato!",
      description: `${label} copiato negli appunti`,
    });
  };

  return (
    <div className="space-y-6">
      <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-800 dark:text-blue-200">
          Questa guida ti accompagna nella configurazione del sistema di sincronizzazione dati da sistemi esterni (POS, gestionali, e-commerce).
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-cyan-600" />
            Guida alla Configurazione
          </CardTitle>
          <CardDescription>
            Segui questi passaggi per configurare la sincronizzazione automatica dei tuoi dataset
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <SetupStep
            number={1}
            title="Crea una Sorgente Dati"
            description="La sorgente rappresenta il sistema esterno che invierà i dati (es. POS ristorante, gestionale)."
            isCompleted={hasSource}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Key className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <p className="font-medium">Come fare:</p>
                  <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-1">
                    <li>Vai al tab <strong>"Sorgenti"</strong></li>
                    <li>Clicca <strong>"Aggiungi Sorgente"</strong></li>
                    <li>Inserisci un nome descrittivo (es. "POS Ristorante Milano")</li>
                    <li>Salva e <strong>copia immediatamente le chiavi API</strong></li>
                  </ol>
                </div>
              </div>
              
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  <strong>Importante:</strong> La Secret Key viene mostrata solo una volta. Copiala e conservala in un luogo sicuro prima di chiudere il dialog.
                </AlertDescription>
              </Alert>

              {hasSource && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Hai {sources.length} sorgente/i configurata/e
                </div>
              )}
            </div>
          </SetupStep>

          <SetupStep
            number={2}
            title="Condividi le Credenziali con il Partner"
            description="Il partner (fornitore POS, sviluppatore) avrà bisogno delle credenziali per inviare i dati."
            isCompleted={hasActiveSource}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Send className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <p className="font-medium">Cosa condividere con il partner:</p>
                  <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-1">
                    <li><strong>API Key</strong> - Identificativo della sorgente</li>
                    <li><strong>Secret Key</strong> - Per firmare le richieste (HMAC-SHA256)</li>
                    <li><strong>URL Webhook</strong> - Endpoint dove inviare i file</li>
                    <li><strong>Documentazione Schema</strong> - Nel tab "Schema API"</li>
                  </ol>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">URL Webhook da comunicare:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-slate-100 dark:bg-slate-800 px-3 py-2 rounded text-sm font-mono break-all">
                    POST /api/dataset-sync/webhook/&#123;API_KEY&#125;
                  </code>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => copyToClipboard("/api/dataset-sync/webhook/{API_KEY}", "URL pattern")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-1">Headers richiesti nelle chiamate:</p>
                <ul className="list-disc list-inside space-y-1">
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">Content-Type: multipart/form-data</code></li>
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">X-Dataset-Signature: sha256=...</code></li>
                  <li><code className="bg-slate-100 dark:bg-slate-800 px-1 rounded">X-Dataset-Timestamp: ...</code></li>
                </ul>
              </div>
            </div>
          </SetupStep>

          <SetupStep
            number={3}
            title="Configura la Pianificazione (Opzionale)"
            description="Se il partner non supporta webhook, puoi configurare una sincronizzazione schedulata."
            isCompleted={false}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <Calendar className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <p className="font-medium">Opzioni di schedulazione:</p>
                  <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-1">
                    <li><strong>Solo Webhook</strong> - Il partner invia quando vuole</li>
                    <li><strong>Giornaliero</strong> - Ogni giorno a un orario specifico</li>
                    <li><strong>Settimanale</strong> - Un giorno specifico della settimana</li>
                    <li><strong>Mensile</strong> - Un giorno specifico del mese</li>
                    <li><strong>Personalizzato</strong> - Ogni X giorni</li>
                  </ul>
                </div>
              </div>

              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  La maggior parte dei partner usa il webhook in tempo reale. La schedulazione serve solo se il partner ha limitazioni tecniche.
                </AlertDescription>
              </Alert>
            </div>
          </SetupStep>

          <SetupStep
            number={4}
            title="Testa la Connessione"
            description="Prima di andare in produzione, verifica che tutto funzioni correttamente."
            isCompleted={hasSuccessfulSync}
          >
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <TestTube className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <p className="font-medium">Come testare:</p>
                  <ol className="list-decimal list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1 mt-1">
                    <li>Vai al tab <strong>"Test Webhook"</strong></li>
                    <li>Carica un file CSV/XLSX di esempio</li>
                    <li>Verifica che le colonne vengano mappate correttamente</li>
                    <li>Controlla il risultato nel tab "Cronologia"</li>
                  </ol>
                </div>
              </div>

              <div className="text-sm text-slate-600 dark:text-slate-400">
                <p className="font-medium mb-1">Formati file supportati:</p>
                <div className="flex gap-2">
                  <Badge variant="outline">.csv</Badge>
                  <Badge variant="outline">.xlsx</Badge>
                  <Badge variant="outline">.xls</Badge>
                </div>
              </div>

              {hasSuccessfulSync && (
                <div className="flex items-center gap-2 text-sm text-emerald-600">
                  <CheckCircle2 className="h-4 w-4" />
                  Hai sincronizzazioni riuscite nelle ultime 24 ore
                </div>
              )}
            </div>
          </SetupStep>

          <SetupStep
            number={5}
            title="Monitora e Gestisci"
            description="Una volta configurato, monitora le sincronizzazioni e gestisci eventuali errori."
            isCompleted={false}
          >
            <div className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <Circle className="h-4 w-4 text-cyan-500 mt-1" />
                  <div>
                    <p className="font-medium text-sm">Tab Panoramica</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Metriche generali: successi, errori, attività recente
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Circle className="h-4 w-4 text-cyan-500 mt-1" />
                  <div>
                    <p className="font-medium text-sm">Tab Cronologia</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Log dettagliato di ogni sincronizzazione
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Circle className="h-4 w-4 text-cyan-500 mt-1" />
                  <div>
                    <p className="font-medium text-sm">Tab Schema API</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Documentazione tecnica per i partner
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Circle className="h-4 w-4 text-cyan-500 mt-1" />
                  <div>
                    <p className="font-medium text-sm">Rigenera Chiavi</p>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      Se sospetti compromissione, rigenera le credenziali
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </SetupStep>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Domande Frequenti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-medium">Quali colonne vengono riconosciute automaticamente?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Il sistema riconosce 19 tipi di colonne: ID ordine, data, prezzo, quantità, nome prodotto, categoria, cliente, sconti, e altri. Consulta il tab "Schema API" per la lista completa.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium">Cosa succede se una colonna non viene riconosciuta?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Le colonne non mappate vengono comunque importate con il nome originale. Potrai usarle nelle analisi ma senza le ottimizzazioni semantiche.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium">Posso avere più sorgenti per lo stesso partner?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Sì, puoi creare sorgenti separate per diversi punti vendita o tipologie di dati dello stesso partner.
            </p>
          </div>
          <Separator />
          <div>
            <p className="font-medium">Come gestisco gli errori di sincronizzazione?</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Nel tab "Cronologia" puoi vedere i dettagli di ogni errore. Gli errori comuni includono: formato file non valido, firma HMAC errata, colonne mancanti obbligatorie.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
