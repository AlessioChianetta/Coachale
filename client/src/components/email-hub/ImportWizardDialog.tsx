import { useState, useMemo, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Mail,
  Send,
  Inbox,
  ArrowRightLeft,
  AlertTriangle,
  CheckCircle,
  Loader2,
  ChevronRight,
  ChevronLeft,
  Server,
  Cloud,
} from "lucide-react";

type AccountType = "smtp_only" | "imap_only" | "full" | "hybrid";

interface ProviderInfo {
  providerType: string;
  providerName: string;
  requiresManualImap: boolean;
  suggestedImapHost: string | null;
  suggestedImapPort: number | null;
  warningText: string | null;
  description: string;
}

interface SmtpSetting {
  id: string;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  provider: ProviderInfo;
}

interface ImportPreview {
  available: boolean;
  total: number;
  importable: number;
  alreadyImported: number;
  settings: SmtpSetting[];
  italianProviders: Record<string, { name: string; imapHost: string; imapPort: number }>;
}

interface ImportWizardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importPreview: ImportPreview;
  onImportComplete: () => void;
}

interface AccountConfig {
  smtpSettingId: string;
  accountType: AccountType;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  selectedPreset: string;
}

const ACCOUNT_TYPE_LABELS: Record<AccountType, { label: string; description: string; icon: React.ReactNode }> = {
  smtp_only: {
    label: "Solo invio",
    description: "Usa questo account solo per inviare email (es. Amazon SES)",
    icon: <Send className="h-4 w-4" />,
  },
  imap_only: {
    label: "Solo ricezione",
    description: "Usa questo account solo per leggere email",
    icon: <Inbox className="h-4 w-4" />,
  },
  full: {
    label: "Completo",
    description: "Stesso provider per invio e ricezione",
    icon: <Mail className="h-4 w-4" />,
  },
  hybrid: {
    label: "Ibrido",
    description: "Provider diversi per SMTP e IMAP",
    icon: <ArrowRightLeft className="h-4 w-4" />,
  },
};

function getAvailableAccountTypes(providerType: string): AccountType[] {
  if (providerType === "send_only") {
    return ["smtp_only", "hybrid"];
  }
  return ["full", "smtp_only", "imap_only", "hybrid"];
}

const getProviderIcon = (providerType: string) => {
  switch (providerType) {
    case "send_only":
      return <Send className="h-4 w-4 text-amber-500" />;
    case "standard":
      return <Mail className="h-4 w-4 text-blue-500" />;
    case "cloud":
      return <Cloud className="h-4 w-4 text-cyan-500" />;
    default:
      return <Server className="h-4 w-4 text-gray-500" />;
  }
};

export function ImportWizardDialog({
  open,
  onOpenChange,
  importPreview,
  onImportComplete,
}: ImportWizardDialogProps) {
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [accountConfigs, setAccountConfigs] = useState<Map<string, AccountConfig>>(new Map());

  const initializeConfigs = () => {
    const configs = new Map<string, AccountConfig>();
    importPreview.settings.forEach((setting) => {
      const defaultType: AccountType = setting.provider.requiresManualImap ? "smtp_only" : "full";
      configs.set(setting.id, {
        smtpSettingId: setting.id,
        accountType: defaultType,
        imapHost: setting.provider.suggestedImapHost || "",
        imapPort: setting.provider.suggestedImapPort || 993,
        imapUser: setting.fromEmail,
        imapPassword: "",
        selectedPreset: "",
      });
    });
    setAccountConfigs(configs);
  };

  useEffect(() => {
    if (open && importPreview.settings.length > 0) {
      initializeConfigs();
      setCurrentStep(1);
    }
  }, [open, importPreview.settings]);

  const updateAccountConfig = (settingId: string, updates: Partial<AccountConfig>) => {
    setAccountConfigs((prev) => {
      const newMap = new Map(prev);
      const current = newMap.get(settingId);
      if (current) {
        newMap.set(settingId, { ...current, ...updates });
      }
      return newMap;
    });
  };

  const handlePresetChange = (settingId: string, presetKey: string) => {
    const preset = importPreview.italianProviders[presetKey];
    if (preset) {
      updateAccountConfig(settingId, {
        selectedPreset: presetKey,
        imapHost: preset.imapHost,
        imapPort: preset.imapPort,
      });
    }
  };

  const needsImapConfig = (setting: SmtpSetting, config: AccountConfig): boolean => {
    if (config.accountType === "smtp_only") return false;
    if (config.accountType === "imap_only" || config.accountType === "hybrid") return true;
    if (config.accountType === "full" && setting.provider.requiresManualImap) return true;
    return false;
  };

  const isConfigValid = useMemo(() => {
    for (const setting of importPreview.settings) {
      const config = accountConfigs.get(setting.id);
      if (!config) return false;
      
      if (needsImapConfig(setting, config)) {
        if (!config.imapHost || !config.imapPort || !config.imapUser || !config.imapPassword) {
          return false;
        }
      }
    }
    return true;
  }, [accountConfigs, importPreview.settings]);

  const importMutation = useMutation({
    mutationFn: async () => {
      const accounts = Array.from(accountConfigs.values()).map((config) => {
        const setting = importPreview.settings.find((s) => s.id === config.smtpSettingId);
        const needsImap = setting ? needsImapConfig(setting, config) : false;
        
        return {
          smtpSettingId: config.smtpSettingId,
          accountType: config.accountType,
          ...(needsImap && {
            imapHost: config.imapHost,
            imapPort: config.imapPort,
            imapUser: config.imapUser,
            imapPassword: config.imapPassword,
          }),
        };
      });

      const response = await fetch("/api/email-hub/accounts/import-wizard", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ accounts }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Errore durante l'importazione");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Importazione completata",
        description: data.message || `${data.imported || 0} account importati con successo`,
      });
      onImportComplete();
      onOpenChange(false);
      setCurrentStep(1);
      setAccountConfigs(new Map());
    },
    onError: (error: any) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (currentStep === 1) {
      if (accountConfigs.size === 0) {
        initializeConfigs();
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      setCurrentStep(3);
    } else if (currentStep === 3) {
      importMutation.mutate();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {[1, 2, 3].map((step) => (
        <div key={step} className="flex items-center">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors ${
              step === currentStep
                ? "bg-primary text-primary-foreground"
                : step < currentStep
                ? "bg-green-600 text-white"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {step < currentStep ? <CheckCircle className="h-4 w-4" /> : step}
          </div>
          {step < 3 && (
            <div
              className={`w-12 h-0.5 mx-1 ${
                step < currentStep ? "bg-green-600" : "bg-muted"
              }`}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <p className="text-muted-foreground">
          Abbiamo rilevato {importPreview.importable} account dalle tue impostazioni SMTP.
          Rivedi i provider identificati prima di procedere.
        </p>
      </div>

      <ScrollArea className="h-[300px] pr-4">
        <div className="space-y-3">
          {importPreview.settings.map((setting) => (
            <div
              key={setting.id}
              className="p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  {getProviderIcon(setting.provider.providerType)}
                  <div>
                    <p className="font-medium">{setting.fromEmail}</p>
                    {setting.fromName && (
                      <p className="text-sm text-muted-foreground">{setting.fromName}</p>
                    )}
                  </div>
                </div>
                <Badge variant="outline" className="text-xs">
                  {setting.provider.providerName}
                </Badge>
              </div>

              <div className="mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Server className="h-3 w-3" />
                  {setting.smtpHost}:{setting.smtpPort}
                </span>
              </div>

              {setting.provider.requiresManualImap && (
                <Alert className="mt-3 border-amber-500/50 bg-amber-500/10">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  <AlertDescription className="text-sm text-amber-200">
                    {setting.provider.warningText || "Questo servizio è solo per l'invio. Dovrai configurare IMAP separatamente."}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>

      {importPreview.alreadyImported > 0 && (
        <p className="text-sm text-muted-foreground text-center">
          {importPreview.alreadyImported} account già importati
        </p>
      )}
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-4">
      <Alert className="border-blue-500/50 bg-blue-500/10 mb-2">
        <Cloud className="h-4 w-4 text-blue-500" />
        <AlertDescription className="text-sm">
          <strong>Come funziona:</strong> Amazon SES invia email ma non le riceve. 
          Scegli <strong>Ibrido</strong> per usare Register.it (o altro) per la ricezione, 
          oppure <strong>Solo invio</strong> se vuoi solo inviare.
        </AlertDescription>
      </Alert>

      <ScrollArea className="h-[400px] pr-4">
        <div className="space-y-6">
          {importPreview.settings.map((setting) => {
            const config = accountConfigs.get(setting.id);
            if (!config) return null;

            const showImapConfig = needsImapConfig(setting, config);

            return (
              <div key={setting.id} className="p-4 rounded-lg border bg-card">
                <div className="flex items-center gap-3 mb-4">
                  <Mail className="h-5 w-5 text-primary" />
                  <div>
                    <p className="font-medium">{setting.fromEmail}</p>
                    <p className="text-sm text-muted-foreground">
                      Provider rilevato: {setting.provider.providerName}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium mb-2 block">Tipo di account</Label>
                    <p className="text-xs text-muted-foreground mb-3">
                      Ogni indirizzo email puo avere un solo account. Se vuoi usare lo stesso indirizzo per inviare (es. Amazon SES) e ricevere (es. Register.it), scegli <strong>Ibrido</strong>.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {getAvailableAccountTypes(setting.provider.providerType).map((type) => {
                        const { label, description, icon } = ACCOUNT_TYPE_LABELS[type];
                        return (
                          <button
                            key={type}
                            type="button"
                            onClick={() => updateAccountConfig(setting.id, { accountType: type })}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              config.accountType === type
                                ? "border-primary bg-primary/10 ring-1 ring-primary"
                                : "border-muted hover:border-primary/50"
                            }`}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              {icon}
                              <span className="font-medium text-sm">{label}</span>
                            </div>
                            <p className="text-xs text-muted-foreground">{description}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {showImapConfig && (
                    <>
                      <Separator />
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Inbox className="h-4 w-4 text-blue-500" />
                          <Label className="text-sm font-medium">Configura credenziali IMAP</Label>
                        </div>

                        {Object.keys(importPreview.italianProviders).length > 0 && (
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">
                              Seleziona provider IMAP (preset)
                            </Label>
                            <Select
                              value={config.selectedPreset}
                              onValueChange={(value) => handlePresetChange(setting.id, value)}
                            >
                              <SelectTrigger className="bg-background">
                                <SelectValue placeholder="Scegli un provider italiano..." />
                              </SelectTrigger>
                              <SelectContent>
                                {Object.entries(importPreview.italianProviders).map(([key, provider]) => (
                                  <SelectItem key={key} value={key}>
                                    {provider.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">
                              Host IMAP
                            </Label>
                            <Input
                              value={config.imapHost}
                              onChange={(e) =>
                                updateAccountConfig(setting.id, { imapHost: e.target.value })
                              }
                              placeholder="imap.provider.it"
                              className="bg-background"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1.5 block">
                              Porta
                            </Label>
                            <Input
                              type="number"
                              value={config.imapPort}
                              onChange={(e) =>
                                updateAccountConfig(setting.id, { imapPort: parseInt(e.target.value) || 993 })
                              }
                              placeholder="993"
                              className="bg-background"
                            />
                          </div>
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">
                            Username
                          </Label>
                          <Input
                            value={config.imapUser}
                            onChange={(e) =>
                              updateAccountConfig(setting.id, { imapUser: e.target.value })
                            }
                            placeholder={setting.fromEmail}
                            className="bg-background"
                          />
                        </div>

                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">
                            Password
                          </Label>
                          <Input
                            type="password"
                            value={config.imapPassword}
                            onChange={(e) =>
                              updateAccountConfig(setting.id, { imapPassword: e.target.value })
                            }
                            placeholder="Password IMAP"
                            className="bg-background"
                          />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );

  const renderStep3 = () => {
    const summary = importPreview.settings.map((setting) => {
      const config = accountConfigs.get(setting.id);
      return { setting, config };
    });

    return (
      <div className="space-y-4">
        <div className="text-center mb-4">
          <p className="text-muted-foreground">
            Conferma le configurazioni e procedi con l'importazione.
          </p>
        </div>

        <ScrollArea className="h-[300px] pr-4">
          <div className="space-y-3">
            {summary.map(({ setting, config }) => {
              if (!config) return null;
              const typeInfo = ACCOUNT_TYPE_LABELS[config.accountType];

              return (
                <div key={setting.id} className="p-4 rounded-lg border bg-card">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {typeInfo.icon}
                      <div>
                        <p className="font-medium">{setting.fromEmail}</p>
                        <p className="text-sm text-muted-foreground">
                          {setting.provider.providerName}
                        </p>
                      </div>
                    </div>
                    <Badge variant="secondary">{typeInfo.label}</Badge>
                  </div>

                  {needsImapConfig(setting, config) && config.imapHost && (
                    <div className="mt-2 pt-2 border-t text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Inbox className="h-3 w-3" />
                        IMAP: {config.imapHost}:{config.imapPort}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>

        <Alert className="border-blue-500/50 bg-blue-500/10">
          <CheckCircle className="h-4 w-4 text-blue-500" />
          <AlertTitle className="text-blue-200">Pronto per l'importazione</AlertTitle>
          <AlertDescription className="text-blue-300/80">
            Verranno importati {importPreview.importable} account email.
            Le credenziali verranno verificate durante l'importazione.
          </AlertDescription>
        </Alert>
      </div>
    );
  };

  const stepTitles = [
    "Rivedi Account Rilevati",
    "Configura Account",
    "Conferma e Importa",
  ];

  const canProceed = currentStep === 1 || (currentStep === 2 && isConfigValid) || currentStep === 3;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] bg-background border-border">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5 text-primary" />
            Importa Account Email
          </DialogTitle>
          <DialogDescription>
            {stepTitles[currentStep - 1]}
          </DialogDescription>
        </DialogHeader>

        {renderStepIndicator()}

        <div className="py-2">
          {currentStep === 1 && renderStep1()}
          {currentStep === 2 && renderStep2()}
          {currentStep === 3 && renderStep3()}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || importMutation.isPending}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Indietro
          </Button>

          <Button
            onClick={handleNext}
            disabled={!canProceed || importMutation.isPending}
          >
            {importMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Importazione...
              </>
            ) : currentStep === 3 ? (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Importa
              </>
            ) : (
              <>
                Avanti
                <ChevronRight className="h-4 w-4 ml-1" />
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
