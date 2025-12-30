import { useState, useCallback } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useDropzone } from "react-dropzone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Stepper } from "@/components/ui/stepper";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import { useCampaigns } from "@/hooks/useCampaigns";
import {
  Upload,
  FileSpreadsheet,
  Link2,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface LeadImportWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  agents: Array<{ id: string; agentName: string }>;
  selectedAgentId?: string;
}

interface PreviewData {
  columns: string[];
  previewRows: Record<string, any>[];
  totalRows: number;
  suggestedMappings: Record<string, string>;
  uploadedFilePath?: string;
  googleSheetUrl?: string;
  originalFilename?: string;
}

interface ColumnMapping {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  email: string;
  company: string;
  notes: string;
  tags: string;
}

interface ImportSettings {
  skipDuplicates: boolean;
  leadCategory: string;
  campaignId: string;
  defaultContactFrequency: number;
}

interface ImportResult {
  imported: number;
  skipped: number;
  duplicates: number;
  errors: number;
  errorDetails: Array<{ row: number; field?: string; message: string }>;
}

const WIZARD_STEPS = [
  { id: "source", label: "Sorgente" },
  { id: "mapping", label: "Mappatura" },
  { id: "settings", label: "Impostazioni" },
  { id: "results", label: "Risultati" },
];

const SYSTEM_FIELDS = [
  { key: "firstName", label: "Nome", required: false },
  { key: "lastName", label: "Cognome", required: false },
  { key: "phoneNumber", label: "Telefono", required: true },
  { key: "email", label: "Email", required: false },
  { key: "company", label: "Azienda", required: false },
  { key: "notes", label: "Note", required: false },
  { key: "tags", label: "Tag", required: false },
];

const LEAD_CATEGORIES = [
  { value: "freddo", label: "Freddo" },
  { value: "tiepido", label: "Tiepido" },
  { value: "caldo", label: "Caldo" },
  { value: "recupero", label: "Recupero" },
  { value: "referral", label: "Referral" },
];

export function LeadImportWizard({
  open,
  onOpenChange,
  agents,
  selectedAgentId,
}: LeadImportWizardProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [currentStep, setCurrentStep] = useState(0);
  const [sourceType, setSourceType] = useState<"file" | "sheets">("file");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [googleSheetUrl, setGoogleSheetUrl] = useState("");
  const [agentId, setAgentId] = useState(selectedAgentId || agents[0]?.id || "");
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [allRows, setAllRows] = useState<Record<string, any>[]>([]);
  const [columnMappings, setColumnMappings] = useState<ColumnMapping>({
    firstName: "",
    lastName: "",
    phoneNumber: "",
    email: "",
    company: "",
    notes: "",
    tags: "",
  });
  const [manuallyMapped, setManuallyMapped] = useState<Set<string>>(new Set());
  const [importSettings, setImportSettings] = useState<ImportSettings>({
    skipDuplicates: true,
    leadCategory: "freddo",
    campaignId: "",
    defaultContactFrequency: 7,
  });
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [errorsExpanded, setErrorsExpanded] = useState(false);

  const { data: campaignsData } = useCampaigns(true);
  const campaigns = campaignsData?.campaigns || [];

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".xls"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  const uploadFileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !agentId) throw new Error("File o agente mancante");

      const formData = new FormData();
      formData.append("file", selectedFile);

      const response = await fetch(
        `/api/consultant/agents/${agentId}/leads/upload`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: formData,
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore upload file");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPreviewData(data.data);
        applyAutoMappings(data.data.suggestedMappings);
        setAllRows(data.data.previewRows);
        setCurrentStep(1);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore Upload",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const previewSheetMutation = useMutation({
    mutationFn: async () => {
      if (!googleSheetUrl || !agentId) throw new Error("URL o agente mancante");

      const response = await fetch(
        `/api/consultant/agents/${agentId}/leads/preview-sheet`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ sheetUrl: googleSheetUrl }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore preview Google Sheet");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setPreviewData(data.data);
        applyAutoMappings(data.data.suggestedMappings);
        setAllRows(data.data.previewRows);
        setCurrentStep(1);
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore Preview",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const importMutation = useMutation({
    mutationFn: async () => {
      if (!previewData || !agentId) throw new Error("Dati mancanti");

      const response = await fetch(
        `/api/consultant/agents/${agentId}/leads/import`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            sourceType,
            googleSheetUrl: previewData.googleSheetUrl,
            uploadedFilePath: previewData.uploadedFilePath,
            columnMappings,
            settings: {
              skipDuplicates: importSettings.skipDuplicates,
              leadCategory: importSettings.leadCategory,
              campaignId: importSettings.campaignId || null,
              defaultContactFrequency: importSettings.defaultContactFrequency,
            },
            rows: allRows.length > 0 ? allRows : previewData.previewRows,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore import");
      }

      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        setImportResult({
          imported: data.stats?.imported || 0,
          skipped: data.stats?.skipped || 0,
          duplicates: data.stats?.duplicates || 0,
          errors: data.stats?.errors || 0,
          errorDetails: data.errorDetails || [],
        });
        queryClient.invalidateQueries({ queryKey: ["/api/proactive-leads"] });
        queryClient.invalidateQueries({
          queryKey: [`/api/consultant/agents/${agentId}/proactive-leads`],
        });
      }
      setIsImporting(false);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore Import",
        description: error.message,
        variant: "destructive",
      });
      setIsImporting(false);
    },
  });

  const applyAutoMappings = (suggested: Record<string, string>) => {
    const newMappings: ColumnMapping = { ...columnMappings };
    Object.entries(suggested).forEach(([field, column]) => {
      if (field in newMappings) {
        (newMappings as any)[field] = column;
      }
    });
    setColumnMappings(newMappings);
    setManuallyMapped(new Set());
  };

  const handleMappingChange = (field: string, value: string) => {
    setColumnMappings((prev) => ({ ...prev, [field]: value }));
    setManuallyMapped((prev) => new Set([...prev, field]));
  };

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 0:
        return sourceType === "file" ? !!selectedFile : !!googleSheetUrl.trim();
      case 1:
        const hasPhone = !!columnMappings.phoneNumber;
        const hasName = !!columnMappings.firstName || !!columnMappings.lastName;
        return hasPhone && hasName;
      case 2:
        return true;
      default:
        return false;
    }
  };

  const handleAnalyze = () => {
    if (sourceType === "file") {
      uploadFileMutation.mutate();
    } else {
      previewSheetMutation.mutate();
    }
  };

  const handleImport = () => {
    setIsImporting(true);
    setCurrentStep(3);
    importMutation.mutate();
  };

  const resetWizard = () => {
    setCurrentStep(0);
    setSourceType("file");
    setSelectedFile(null);
    setGoogleSheetUrl("");
    setPreviewData(null);
    setAllRows([]);
    setColumnMappings({
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      company: "",
      notes: "",
      tags: "",
    });
    setManuallyMapped(new Set());
    setImportSettings({
      skipDuplicates: true,
      leadCategory: "freddo",
      campaignId: "",
      defaultContactFrequency: 7,
    });
    setImportResult(null);
    setIsImporting(false);
  };

  const handleClose = () => {
    onOpenChange(false);
    setTimeout(resetWizard, 300);
  };

  const renderSourceStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={() => setSourceType("file")}
          className={cn(
            "p-6 rounded-xl border-2 transition-all duration-200 text-left",
            sourceType === "file"
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border hover:border-primary/50"
          )}
        >
          <FileSpreadsheet className="h-8 w-8 mb-3 text-primary" />
          <h3 className="font-semibold text-lg">Carica File</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Excel (.xlsx, .xls) o CSV
          </p>
        </button>

        <button
          onClick={() => setSourceType("sheets")}
          className={cn(
            "p-6 rounded-xl border-2 transition-all duration-200 text-left",
            sourceType === "sheets"
              ? "border-primary bg-primary/5 shadow-md"
              : "border-border hover:border-primary/50"
          )}
        >
          <Link2 className="h-8 w-8 mb-3 text-green-600" />
          <h3 className="font-semibold text-lg">Google Sheets</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Importa da foglio Google
          </p>
        </button>
      </div>

      {agents.length > 1 && (
        <div className="space-y-2">
          <Label>Agente WhatsApp</Label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleziona agente" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.agentName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {sourceType === "file" ? (
        <div
          {...getRootProps()}
          className={cn(
            "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200",
            isDragActive
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50"
          )}
        >
          <input {...getInputProps()} />
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          {selectedFile ? (
            <div>
              <p className="font-medium text-primary">{selectedFile.name}</p>
              <p className="text-sm text-muted-foreground mt-1">
                {(selectedFile.size / 1024).toFixed(1)} KB
              </p>
            </div>
          ) : (
            <div>
              <p className="font-medium">Trascina il file qui</p>
              <p className="text-sm text-muted-foreground mt-1">
                oppure clicca per selezionare
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Label>URL Google Sheets</Label>
          <Input
            placeholder="https://docs.google.com/spreadsheets/d/..."
            value={googleSheetUrl}
            onChange={(e) => setGoogleSheetUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Il foglio deve essere condiviso pubblicamente (chiunque con il link)
          </p>
        </div>
      )}

      <Button
        onClick={handleAnalyze}
        disabled={
          !canProceedFromStep(0) ||
          uploadFileMutation.isPending ||
          previewSheetMutation.isPending
        }
        className="w-full"
      >
        {uploadFileMutation.isPending || previewSheetMutation.isPending ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <ArrowRight className="h-4 w-4 mr-2" />
        )}
        Analizza
      </Button>
    </div>
  );

  const renderMappingStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="grid gap-4">
        {SYSTEM_FIELDS.map((field) => (
          <div
            key={field.key}
            className="flex items-center gap-4 p-3 rounded-lg bg-muted/30"
          >
            <div className="w-32 flex items-center gap-2">
              <span className="font-medium">{field.label}</span>
              {field.required && (
                <span className="text-red-500 text-sm">*</span>
              )}
            </div>
            <Select
              value={(columnMappings as any)[field.key] || ""}
              onValueChange={(value) =>
                handleMappingChange(field.key, value === "__none__" ? "" : value)
              }
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Seleziona colonna..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">-- Non mappare --</SelectItem>
                {previewData?.columns.map((col) => (
                  <SelectItem key={col} value={col}>
                    {col}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge
              variant={manuallyMapped.has(field.key) ? "default" : "secondary"}
              className="w-20 justify-center"
            >
              {manuallyMapped.has(field.key) ? "Manuale" : "Auto"}
            </Badge>
          </div>
        ))}
      </div>

      <div className="bg-muted/30 rounded-lg p-4">
        <p className="text-sm text-muted-foreground mb-3">
          <AlertCircle className="h-4 w-4 inline mr-1" />
          Campi obbligatori: Telefono + (Nome o Cognome)
        </p>

        {previewData && previewData.previewRows.length > 0 && (
          <div className="overflow-x-auto">
            <p className="text-sm font-medium mb-2">
              Preview dati mappati ({previewData.totalRows} righe totali)
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  {SYSTEM_FIELDS.filter(
                    (f) => (columnMappings as any)[f.key]
                  ).map((field) => (
                    <TableHead key={field.key}>{field.label}</TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.previewRows.slice(0, 5).map((row, idx) => (
                  <TableRow key={idx}>
                    {SYSTEM_FIELDS.filter(
                      (f) => (columnMappings as any)[f.key]
                    ).map((field) => (
                      <TableCell key={field.key} className="max-w-[150px] truncate">
                        {row[(columnMappings as any)[field.key]] || "-"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setCurrentStep(0)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <Button
          onClick={() => setCurrentStep(2)}
          disabled={!canProceedFromStep(1)}
          className="flex-1"
        >
          Avanti
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderSettingsStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="flex items-center space-x-3 p-4 rounded-lg bg-muted/30">
        <Checkbox
          id="skip-duplicates"
          checked={importSettings.skipDuplicates}
          onCheckedChange={(checked) =>
            setImportSettings((prev) => ({
              ...prev,
              skipDuplicates: checked as boolean,
            }))
          }
        />
        <Label htmlFor="skip-duplicates" className="cursor-pointer">
          Salta lead duplicati (stesso telefono)
        </Label>
      </div>

      <div className="space-y-2">
        <Label>Categoria Lead</Label>
        <Select
          value={importSettings.leadCategory}
          onValueChange={(value) =>
            setImportSettings((prev) => ({ ...prev, leadCategory: value }))
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LEAD_CATEGORIES.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Campagna (opzionale)</Label>
        <Select
          value={importSettings.campaignId}
          onValueChange={(value) =>
            setImportSettings((prev) => ({
              ...prev,
              campaignId: value === "__none__" ? "" : value,
            }))
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Nessuna campagna" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__none__">Nessuna campagna</SelectItem>
            {campaigns.map((campaign: any) => (
              <SelectItem key={campaign.id} value={campaign.id}>
                {campaign.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Frequenza Follow-up (giorni)</Label>
        <Input
          type="number"
          min={1}
          max={90}
          value={importSettings.defaultContactFrequency}
          onChange={(e) =>
            setImportSettings((prev) => ({
              ...prev,
              defaultContactFrequency: parseInt(e.target.value) || 7,
            }))
          }
        />
      </div>

      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
        <p className="text-lg font-semibold text-primary">
          {previewData?.totalRows || 0} lead da importare
        </p>
        <p className="text-sm text-muted-foreground">
          Verranno assegnati all'agente selezionato
        </p>
      </div>

      <div className="flex gap-3">
        <Button variant="outline" onClick={() => setCurrentStep(1)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Indietro
        </Button>
        <Button onClick={handleImport} className="flex-1">
          Importa Lead
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );

  const renderResultsStep = () => (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      {isImporting ? (
        <div className="text-center py-12">
          <Loader2 className="h-16 w-16 mx-auto animate-spin text-primary" />
          <p className="mt-4 text-lg font-medium">Importazione in corso...</p>
          <p className="text-muted-foreground">
            Attendere il completamento dell'operazione
          </p>
          <Progress value={50} className="mt-6 w-64 mx-auto" />
        </div>
      ) : importResult ? (
        <>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-2xl font-bold text-green-700 dark:text-green-400">
                    {importResult.imported}
                  </p>
                  <p className="text-sm text-green-600 dark:text-green-500">
                    Importati
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-yellow-600" />
                <div>
                  <p className="text-2xl font-bold text-yellow-700 dark:text-yellow-400">
                    {importResult.duplicates}
                  </p>
                  <p className="text-sm text-yellow-600 dark:text-yellow-500">
                    Duplicati
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-8 w-8 text-gray-500" />
                <div>
                  <p className="text-2xl font-bold text-gray-700 dark:text-gray-300">
                    {importResult.skipped}
                  </p>
                  <p className="text-sm text-gray-500">Saltati</p>
                </div>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <XCircle className="h-8 w-8 text-red-600" />
                <div>
                  <p className="text-2xl font-bold text-red-700 dark:text-red-400">
                    {importResult.errors}
                  </p>
                  <p className="text-sm text-red-600 dark:text-red-500">
                    Errori
                  </p>
                </div>
              </div>
            </div>
          </div>

          {importResult.errorDetails.length > 0 && (
            <Collapsible open={errorsExpanded} onOpenChange={setErrorsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full">
                  <ChevronDown
                    className={cn(
                      "h-4 w-4 mr-2 transition-transform",
                      errorsExpanded && "rotate-180"
                    )}
                  />
                  Dettagli errori ({importResult.errorDetails.length})
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {importResult.errorDetails.map((err, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-sm"
                    >
                      <span className="font-medium">Riga {err.row}:</span>{" "}
                      {err.message}
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleClose} className="flex-1">
              Chiudi
            </Button>
            <Button onClick={resetWizard} className="flex-1">
              <RefreshCw className="h-4 w-4 mr-2" />
              Importa Altri
            </Button>
          </div>
        </>
      ) : (
        <div className="text-center py-12">
          <XCircle className="h-16 w-16 mx-auto text-red-500" />
          <p className="mt-4 text-lg font-medium">Errore durante l'import</p>
          <Button onClick={resetWizard} className="mt-4">
            Riprova
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            Importa Lead
          </DialogTitle>
        </DialogHeader>

        <Stepper
          steps={WIZARD_STEPS}
          currentStep={currentStep}
          className="mb-6"
        />

        {currentStep === 0 && renderSourceStep()}
        {currentStep === 1 && renderMappingStep()}
        {currentStep === 2 && renderSettingsStep()}
        {currentStep === 3 && renderResultsStep()}
      </DialogContent>
    </Dialog>
  );
}
