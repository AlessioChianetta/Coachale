import { useState, useRef, useCallback, useEffect } from "react";
import {
  useDatasetSyncSources,
  useTestWebhook,
  SyncSource,
  TestWebhookResult,
} from "@/hooks/useDatasetSync";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Upload,
  Copy,
  Eye,
  EyeOff,
  Key,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  Loader2,
  Send,
  Terminal,
  Code2,
  FileCode,
  Hash,
  Clock,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";

const DOMAIN = typeof window !== "undefined" ? window.location.host : "";

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

async function computeHmacSignature(
  fileContent: ArrayBuffer,
  secretKey: string,
  timestamp: number
): Promise<string> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const timestampBytes = encoder.encode(timestamp.toString());
  const combinedData = new Uint8Array(
    fileContent.byteLength + timestampBytes.byteLength
  );
  combinedData.set(new Uint8Array(fileContent), 0);
  combinedData.set(timestampBytes, fileContent.byteLength);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign("HMAC", cryptoKey, combinedData);
  const hashArray = Array.from(new Uint8Array(signature));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function WebhookTestTool() {
  const { toast } = useToast();
  const { data: sourcesData, isLoading: sourcesLoading } = useDatasetSyncSources();
  const testWebhookMutation = useTestWebhook();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedSourceId, setSelectedSourceId] = useState<number | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [signature, setSignature] = useState<string | null>(null);
  const [timestamp, setTimestamp] = useState<number | null>(null);
  const [isGeneratingSignature, setIsGeneratingSignature] = useState(false);
  const [testResult, setTestResult] = useState<TestWebhookResult | null>(null);
  const [simulateFullWebhook, setSimulateFullWebhook] = useState(false);

  const sources = sourcesData?.data || [];
  const selectedSource = sources.find((s) => s.id === selectedSourceId);

  const acceptedFileTypes = [".csv", ".xlsx", ".xls"];
  const acceptedMimeTypes = [
    "text/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copiato!",
        description: `${label} copiato negli appunti`,
      });
    } catch {
      toast({
        title: "Errore",
        description: "Impossibile copiare negli appunti",
        variant: "destructive",
      });
    }
  };

  const maskString = (str: string | undefined, showFirst = 8): string => {
    if (!str) return "...";
    if (str.length <= showFirst) return str;
    return str.substring(0, showFirst) + "••••••••••••";
  };

  const isValidFile = (file: File): boolean => {
    const extension = "." + file.name.split(".").pop()?.toLowerCase();
    return acceptedFileTypes.includes(extension) || acceptedMimeTypes.includes(file.type);
  };

  const handleFileSelect = (file: File) => {
    if (!isValidFile(file)) {
      toast({
        title: "Formato non supportato",
        description: "Seleziona un file CSV, XLSX o XLS",
        variant: "destructive",
      });
      return;
    }
    setSelectedFile(file);
    setSignature(null);
    setTimestamp(null);
    setTestResult(null);
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    []
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const generateSignature = async () => {
    if (!selectedFile || !selectedSource?.secret_key) {
      toast({
        title: "Errore",
        description: "Seleziona una sorgente e un file prima",
        variant: "destructive",
      });
      return;
    }

    setIsGeneratingSignature(true);
    try {
      const fileContent = await selectedFile.arrayBuffer();
      const ts = Math.floor(Date.now() / 1000);
      const sig = await computeHmacSignature(fileContent, selectedSource.secret_key, ts);
      setSignature(sig);
      setTimestamp(ts);
      toast({
        title: "Firma generata",
        description: "La firma HMAC è stata calcolata con successo",
      });
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile generare la firma",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingSignature(false);
    }
  };

  const handleTest = async () => {
    if (!selectedSourceId || !selectedFile) {
      toast({
        title: "Errore",
        description: "Seleziona una sorgente e un file",
        variant: "destructive",
      });
      return;
    }

    setTestResult(null);
    try {
      const result = await testWebhookMutation.mutateAsync({
        sourceId: selectedSourceId,
        file: selectedFile,
        simulateFullWebhook,
      });
      setTestResult(result);
      if (result.success) {
        toast({
          title: simulateFullWebhook ? "Simulazione completa!" : "Test rapido completato",
          description: simulateFullWebhook 
            ? `${result.rowsImported || 0} righe importate come webhook reale`
            : "Verifica formato e mapping completata",
        });
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || "Test webhook fallito",
      });
    }
  };

  const getCurlCommand = (): string => {
    const apiKey = selectedSource?.api_key || "YOUR_API_KEY";
    const sig = signature || "GENERATED_SIGNATURE";
    const ts = timestamp || "UNIX_TIMESTAMP";
    const fileName = selectedFile?.name || "file.csv";
    return `curl -X POST "https://${DOMAIN}/api/dataset-sync/webhook/${apiKey}" \\
  -H "X-Dataset-Signature: sha256=${sig}" \\
  -H "X-Dataset-Timestamp: ${ts}" \\
  -F "file=@${fileName}"`;
  };

  const getPythonExample = (): string => {
    const apiKey = selectedSource?.api_key || "YOUR_API_KEY";
    const secretKey = selectedSource?.secret_key || "YOUR_SECRET_KEY";
    return `import hmac
import hashlib
import time
import requests

API_KEY = "${apiKey}"
SECRET_KEY = "${secretKey}"
FILE_PATH = "data.csv"

# Leggi il file
with open(FILE_PATH, "rb") as f:
    file_content = f.read()

# Genera timestamp e firma
timestamp = str(int(time.time()))
message = file_content + timestamp.encode()
signature = hmac.new(
    SECRET_KEY.encode(),
    message,
    hashlib.sha256
).hexdigest()

# Invia richiesta
response = requests.post(
    f"https://${DOMAIN}/api/dataset-sync/webhook/{API_KEY}",
    headers={
        "X-Dataset-Signature": f"sha256={signature}",
        "X-Dataset-Timestamp": timestamp,
    },
    files={"file": open(FILE_PATH, "rb")}
)

print(response.json())`;
  };

  const getNodeExample = (): string => {
    const apiKey = selectedSource?.api_key || "YOUR_API_KEY";
    const secretKey = selectedSource?.secret_key || "YOUR_SECRET_KEY";
    return `const crypto = require('crypto');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');

const API_KEY = "${apiKey}";
const SECRET_KEY = "${secretKey}";
const FILE_PATH = "data.csv";

async function sendWebhook() {
  // Leggi il file
  const fileContent = fs.readFileSync(FILE_PATH);

  // Genera timestamp e firma
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const message = Buffer.concat([fileContent, Buffer.from(timestamp)]);
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(message)
    .digest('hex');

  // Prepara form data
  const form = new FormData();
  form.append('file', fs.createReadStream(FILE_PATH));

  // Invia richiesta
  const response = await axios.post(
    \`https://${DOMAIN}/api/dataset-sync/webhook/\${API_KEY}\`,
    form,
    {
      headers: {
        ...form.getHeaders(),
        'X-Dataset-Signature': \`sha256=\${signature}\`,
        'X-Dataset-Timestamp': timestamp,
      },
    }
  );

  console.log(response.data);
}

sendWebhook();`;
  };

  const getPhpExample = (): string => {
    const apiKey = selectedSource?.api_key || "YOUR_API_KEY";
    const secretKey = selectedSource?.secret_key || "YOUR_SECRET_KEY";
    return `<?php

$api_key = "${apiKey}";
$secret_key = "${secretKey}";
$file_path = "data.csv";

// Leggi il file
$file_content = file_get_contents($file_path);

// Genera timestamp e firma
$timestamp = time();
$message = $file_content . $timestamp;
$signature = hash_hmac('sha256', $message, $secret_key);

// Prepara richiesta cURL
$ch = curl_init();
curl_setopt($ch, CURLOPT_URL, "https://${DOMAIN}/api/dataset-sync/webhook/" . $api_key);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "X-Dataset-Signature: sha256=" . $signature,
    "X-Dataset-Timestamp: " . $timestamp,
]);

$cfile = new CURLFile($file_path);
curl_setopt($ch, CURLOPT_POSTFIELDS, ['file' => $cfile]);

$response = curl_exec($ch);
curl_close($ch);

echo $response;
?>`;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Terminal className="h-5 w-5 text-cyan-600" />
            Test Webhook
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Testa l'integrazione webhook inviando un file di esempio
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Sorgente
            </Label>
            <Select
              value={selectedSourceId?.toString() || ""}
              onValueChange={(val) => {
                setSelectedSourceId(parseInt(val));
                setTestResult(null);
                setSignature(null);
                setTimestamp(null);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Seleziona una sorgente..." />
              </SelectTrigger>
              <SelectContent>
                {sourcesLoading ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    Caricamento...
                  </div>
                ) : sources.length === 0 ? (
                  <div className="py-2 px-3 text-sm text-muted-foreground">
                    Nessuna sorgente configurata
                  </div>
                ) : (
                  sources.map((source) => (
                    <SelectItem key={source.id} value={source.id.toString()}>
                      <div className="flex items-center gap-2">
                        {source.name}
                        {source.is_active ? (
                          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                            Attivo
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                            Pausa
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {selectedSource && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">API Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded text-xs font-mono truncate border">
                    {showApiKey ? selectedSource.api_key : maskString(selectedSource.api_key)}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowApiKey(!showApiKey)}
                  >
                    {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => copyToClipboard(selectedSource.api_key, "API Key")}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-sm text-muted-foreground">Secret Key</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-background px-3 py-2 rounded text-xs font-mono truncate border">
                    {showSecretKey
                      ? selectedSource.secret_key || "N/D"
                      : "••••••••••••••••"}
                  </code>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() => setShowSecretKey(!showSecretKey)}
                  >
                    {showSecretKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={() =>
                      selectedSource.secret_key &&
                      copyToClipboard(selectedSource.secret_key, "Secret Key")
                    }
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <Upload className="h-4 w-4" />
              File da Inviare
            </Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors cursor-pointer
                ${isDragging ? "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/20" : "border-muted-foreground/25 hover:border-muted-foreground/50"}
                ${selectedFile ? "bg-muted/30" : ""}`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedFileTypes.join(",")}
                className="hidden"
                onChange={handleInputChange}
              />
              {selectedFile ? (
                <div className="space-y-2">
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-cyan-600" />
                  <div className="font-medium">{selectedFile.name}</div>
                  <div className="text-sm text-muted-foreground">
                    {formatBytes(selectedFile.size)} • {selectedFile.type || "Tipo sconosciuto"}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedFile(null);
                      setSignature(null);
                      setTimestamp(null);
                      setTestResult(null);
                    }}
                  >
                    <RefreshCw className="h-3 w-3 mr-2" />
                    Cambia File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                  <div className="text-muted-foreground">
                    Trascina qui un file CSV, XLSX o XLS
                  </div>
                  <div className="text-xs text-muted-foreground">
                    oppure clicca per selezionare
                  </div>
                </div>
              )}
            </div>
          </div>

          {selectedSource && selectedFile && (
            <Card className="border-slate-200">
              <CardHeader className="py-4">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Hash className="h-4 w-4 text-indigo-600" />
                  Firma HMAC-SHA256
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  onClick={generateSignature}
                  disabled={isGeneratingSignature || !selectedSource.secret_key}
                  className="w-full"
                  variant="outline"
                >
                  {isGeneratingSignature ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Hash className="h-4 w-4 mr-2" />
                  )}
                  Genera Firma
                </Button>

                {signature && timestamp && (
                  <div className="space-y-3 p-4 bg-muted/30 rounded-lg border">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground flex items-center gap-2">
                          <Hash className="h-3 w-3" />
                          Signature
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(`sha256=${signature}`, "Firma")}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copia
                        </Button>
                      </div>
                      <code className="block bg-background px-3 py-2 rounded text-xs font-mono break-all border">
                        sha256={signature}
                      </code>
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm text-muted-foreground flex items-center gap-2">
                          <Clock className="h-3 w-3" />
                          Timestamp
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(timestamp.toString(), "Timestamp")}
                        >
                          <Copy className="h-3 w-3 mr-1" />
                          Copia
                        </Button>
                      </div>
                      <code className="block bg-background px-3 py-2 rounded text-xs font-mono border">
                        {timestamp} ({new Date(timestamp * 1000).toLocaleString("it-IT")})
                      </code>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {selectedSource && (
            <Card className="border-slate-200">
              <CardHeader className="py-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Terminal className="h-4 w-4 text-orange-600" />
                    Esempio cURL
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(getCurlCommand(), "Comando cURL")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap">
                  {getCurlCommand()}
                </pre>
              </CardContent>
            </Card>
          )}

          <div className="flex flex-col gap-4">
            {/* Toggle modalità test */}
            <Card className={`border ${simulateFullWebhook ? 'border-orange-300 bg-orange-50 dark:bg-orange-950/20' : 'border-slate-200 dark:border-slate-700'}`}>
              <CardContent className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="full-simulation" className="text-sm font-medium cursor-pointer">
                        Simulazione completa (come API reale)
                      </Label>
                      {simulateFullWebhook && (
                        <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 text-xs">
                          Importerà i dati
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {simulateFullWebhook 
                        ? "Esegue il flusso completo: crea dataset, importa dati, salva mapping (identico alla chiamata webhook reale)"
                        : "Solo verifica formato e mapping colonne, senza importare (test rapido)"}
                    </p>
                  </div>
                  <Switch
                    id="full-simulation"
                    checked={simulateFullWebhook}
                    onCheckedChange={setSimulateFullWebhook}
                  />
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleTest}
              disabled={!selectedSourceId || !selectedFile || testWebhookMutation.isPending}
              className={`w-full ${simulateFullWebhook ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
              size="lg"
            >
              {testWebhookMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Send className="h-4 w-4 mr-2" />
              )}
              {simulateFullWebhook ? "Esegui Simulazione Completa" : "Invia Test Rapido"}
            </Button>

            {testResult && (
              <Card
                className={`border-2 ${
                  testResult.success
                    ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20 dark:border-emerald-800"
                    : "border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-800"
                }`}
              >
                <CardContent className="py-4">
                  {testResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
                        <CheckCircle className="h-5 w-5" />
                        <span className="font-medium">
                          {testResult.mode === "full_simulation" 
                            ? "Simulazione completa eseguita!" 
                            : "Test rapido completato!"}
                        </span>
                        {testResult.mode && (
                          <Badge variant="outline" className={testResult.mode === "full_simulation" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}>
                            {testResult.mode === "full_simulation" ? "Dati importati" : "Solo verifica"}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Normalizza i dati: usa data.* per quick_test, altrimenti usa campi diretti */}
                      {(() => {
                        const isQuickTest = testResult.mode === "quick_test";
                        const totalRows = isQuickTest ? testResult.data?.totalRows : testResult.rowsTotal;
                        const columnsDetected = isQuickTest ? testResult.data?.columnsDetected : testResult.columnsDetected;
                        const mappingSummary = isQuickTest ? testResult.data?.mappingSummary : testResult.mappingSummary;
                        const columns = isQuickTest ? testResult.data?.columns : null;
                        
                        // Estrai nomi colonne mappate
                        const mappedNames = mappingSummary?.mapped?.map((m: any) => 
                          typeof m === 'string' ? m : m.logical
                        ) || [];
                        const unmappedNames = mappingSummary?.unmapped || [];
                        
                        return (
                          <>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              {testResult.mode === "full_simulation" ? (
                                <>
                                  <div>
                                    <div className="text-muted-foreground">Sync ID</div>
                                    <div className="font-mono text-xs">{testResult.syncId || "N/D"}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Righe Importate</div>
                                    <div className="font-semibold">{testResult.rowsImported || 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Righe Saltate</div>
                                    <div className="font-semibold">{testResult.rowsSkipped || 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Colonne Rilevate</div>
                                    <div className="font-semibold">{columnsDetected || 0}</div>
                                  </div>
                                </>
                              ) : (
                                <>
                                  <div>
                                    <div className="text-muted-foreground">File</div>
                                    <div className="font-mono text-xs truncate">{testResult.data?.fileName || "N/D"}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Righe Totali</div>
                                    <div className="font-semibold">{totalRows || 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Colonne Rilevate</div>
                                    <div className="font-semibold">{columnsDetected || 0}</div>
                                  </div>
                                  <div>
                                    <div className="text-muted-foreground">Mappate</div>
                                    <div className="font-semibold text-emerald-600">{mappedNames.length}</div>
                                  </div>
                                </>
                              )}
                            </div>
                            
                            {/* Dettaglio colonne per quick test */}
                            {isQuickTest && columns && columns.length > 0 && (
                              <div className="space-y-2 pt-2 border-t">
                                <div className="text-sm text-muted-foreground mb-1">Dettaglio Colonne:</div>
                                <div className="grid gap-1 max-h-48 overflow-y-auto">
                                  {columns.map((col, idx) => (
                                    <div key={idx} className="flex items-center gap-2 text-xs">
                                      <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{col.physicalColumn}</span>
                                      <span className="text-muted-foreground">→</span>
                                      {col.suggestedLogicalColumn ? (
                                        <Badge variant="outline" className="bg-emerald-100 text-emerald-700 text-xs">
                                          {col.suggestedLogicalColumn}
                                        </Badge>
                                      ) : (
                                        <span className="text-muted-foreground italic">non mappata</span>
                                      )}
                                      <span className="text-muted-foreground ml-auto">({col.detectedType})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {/* Riepilogo mapping per full simulation */}
                            {testResult.mode === "full_simulation" && (mappedNames.length > 0 || unmappedNames.length > 0) && (
                              <div className="space-y-2 pt-2 border-t">
                                {mappedNames.length > 0 && (
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Colonne Mappate:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {mappedNames.map((col: string) => (
                                        <Badge key={col} variant="outline" className="text-xs bg-emerald-100 text-emerald-700 border-emerald-200">
                                          {col}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {unmappedNames.length > 0 && (
                                  <div>
                                    <div className="text-sm text-muted-foreground mb-1">Colonne Non Mappate:</div>
                                    <div className="flex flex-wrap gap-1">
                                      {unmappedNames.map((col: string) => (
                                        <Badge key={col} variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-200">
                                          {col}
                                        </Badge>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center gap-2 text-red-700 dark:text-red-400">
                        <XCircle className="h-5 w-5" />
                        <span className="font-medium">Test fallito</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Errore: </span>
                        {testResult.error || testResult.message || "Errore sconosciuto"}
                      </div>
                      <div className="flex items-start gap-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300 p-3 rounded-lg">
                        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <div className="font-medium mb-1">Suggerimenti:</div>
                          <ul className="list-disc list-inside space-y-1 text-xs">
                            <li>Verifica che il file sia in formato CSV o XLSX valido</li>
                            <li>Controlla che le colonne obbligatorie siano presenti</li>
                            <li>Assicurati che la sorgente sia attiva</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Code2 className="h-5 w-5 text-violet-600" />
            Esempi di Codice
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Codice di esempio per integrare il webhook nel tuo sistema
          </p>
        </CardHeader>
        <CardContent>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="python">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-blue-600" />
                  Python
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 z-10"
                    onClick={() => copyToClipboard(getPythonExample(), "Codice Python")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-96">
                    {getPythonExample()}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="nodejs">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-green-600" />
                  Node.js
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 z-10"
                    onClick={() => copyToClipboard(getNodeExample(), "Codice Node.js")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-96">
                    {getNodeExample()}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>

            <AccordionItem value="php">
              <AccordionTrigger className="hover:no-underline">
                <div className="flex items-center gap-2">
                  <FileCode className="h-4 w-4 text-purple-600" />
                  PHP
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 top-2 z-10"
                    onClick={() => copyToClipboard(getPhpExample(), "Codice PHP")}
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copia
                  </Button>
                  <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg text-xs font-mono overflow-x-auto whitespace-pre-wrap max-h-96">
                    {getPhpExample()}
                  </pre>
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </CardContent>
      </Card>
    </div>
  );
}
