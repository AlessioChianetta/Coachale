import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, Wallet, Save, Trash2, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface FinanceSettings {
  id: string;
  percorsoCapitaleEmail: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function FinanceSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [email, setEmail] = useState("");
  const [isEnabled, setIsEnabled] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const { data: settings, isLoading, error } = useQuery<FinanceSettings | null>({
    queryKey: ["/api/finance-settings"],
    queryFn: () => apiRequest("GET", "/api/finance-settings"),
    retry: false,
  });

  useEffect(() => {
    if (settings) {
      setEmail(settings.percorsoCapitaleEmail);
      setIsEnabled(settings.isEnabled);
      setHasChanges(false);
    }
  }, [settings]);

  useEffect(() => {
    if (settings) {
      const emailChanged = email !== settings.percorsoCapitaleEmail;
      const enabledChanged = isEnabled !== settings.isEnabled;
      setHasChanges(emailChanged || enabledChanged);
    } else {
      setHasChanges(email.trim() !== "");
    }
  }, [email, isEnabled, settings]);

  const saveMutation = useMutation({
    mutationFn: async (data: { percorsoCapitaleEmail: string; isEnabled: boolean }) => {
      return apiRequest("POST", "/api/finance-settings", data);
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["/api/finance-settings"], data);
      setHasChanges(false);
      toast({
        title: "✅ Configurazione salvata",
        description: "Le impostazioni di Percorso Capitale sono state aggiornate con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile salvare le impostazioni. Riprova.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/finance-settings", undefined);
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/finance-settings"], null);
      setEmail("");
      setIsEnabled(true);
      setHasChanges(false);
      setShowDeleteDialog(false);
      toast({
        title: "🗑️ Configurazione eliminata",
        description: "L'integrazione con Percorso Capitale è stata rimossa.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message || "Impossibile eliminare la configurazione. Riprova.",
        variant: "destructive",
      });
    },
  });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email.trim()) {
      toast({
        title: "⚠️ Email richiesta",
        description: "Inserisci un'email valida per Percorso Capitale.",
        variant: "destructive",
      });
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "⚠️ Email non valida",
        description: "Inserisci un indirizzo email valido.",
        variant: "destructive",
      });
      return;
    }

    saveMutation.mutate({
      percorsoCapitaleEmail: email.trim(),
      isEnabled,
    });
  };

  const handleDelete = () => {
    deleteMutation.mutate();
  };

  const getStatusBadge = () => {
    if (!settings) {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <XCircle className="h-4 w-4" />
          <span>Non configurato</span>
        </div>
      );
    }
    
    if (!settings.isEnabled) {
      return (
        <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-500">
          <AlertCircle className="h-4 w-4" />
          <span>Disabilitato</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-500">
        <CheckCircle2 className="h-4 w-4" />
        <span>Attivo</span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="shadow-lg border-0 overflow-hidden">
        <CardHeader className="bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-emerald-950 dark:via-teal-950 dark:to-cyan-950">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-md">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-xl md:text-2xl font-heading bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
                  Integrazione Percorso Capitale
                </CardTitle>
                <CardDescription className="mt-1">
                  Collega i tuoi dati finanziari al consulente AI
                </CardDescription>
              </div>
            </div>
            {getStatusBadge()}
          </div>
        </CardHeader>

        <CardContent className="pt-6">
          <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-900 dark:text-blue-100">
                <p className="font-semibold mb-1">Cosa fa questa integrazione?</p>
                <p className="text-blue-700 dark:text-blue-300">
                  Quando attivi questa integrazione, il consulente AI finanziario avrà accesso ai tuoi dati 
                  di Percorso Capitale (budget, transazioni, investimenti, obiettivi) per fornirti consigli 
                  personalizzati basati sulla tua situazione finanziaria reale.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-semibold">
                Email Percorso Capitale
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="tua-email@esempio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="border-2 focus:border-emerald-400 transition-colors"
                disabled={saveMutation.isPending || deleteMutation.isPending}
              />
              <p className="text-xs text-muted-foreground">
                Inserisci l'email che usi per accedere a Percorso Capitale
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border">
              <div className="space-y-0.5">
                <Label htmlFor="enabled" className="text-sm font-semibold">
                  Abilita integrazione
                </Label>
                <p className="text-xs text-muted-foreground">
                  Attiva o disattiva temporaneamente l'accesso ai dati
                </p>
              </div>
              <Switch
                id="enabled"
                checked={isEnabled}
                onCheckedChange={setIsEnabled}
                disabled={saveMutation.isPending || deleteMutation.isPending}
              />
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="submit"
                disabled={!hasChanges || saveMutation.isPending || deleteMutation.isPending}
                className="flex items-center gap-2 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              >
                {saveMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Salva configurazione
                  </>
                )}
              </Button>

              {settings && (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => setShowDeleteDialog(true)}
                  disabled={saveMutation.isPending || deleteMutation.isPending}
                  className="flex items-center gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Elimina
                </Button>
              )}
            </div>

            {error && (
              <div className="p-4 bg-red-50 dark:bg-red-950 rounded-lg border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-900 dark:text-red-100">
                  {error instanceof Error ? error.message : "Errore durante il caricamento delle impostazioni"}
                </p>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare la configurazione?</AlertDialogTitle>
            <AlertDialogDescription>
              Questa azione rimuoverà permanentemente l'integrazione con Percorso Capitale. 
              Il consulente AI non avrà più accesso ai tuoi dati finanziari. 
              Potrai riconfigurare l'integrazione in qualsiasi momento.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
