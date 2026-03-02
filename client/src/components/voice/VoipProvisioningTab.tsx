import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Phone, Upload, FileCheck, Search, CheckCircle, Clock,
  ArrowRight, ArrowLeft, Loader2, AlertCircle, Trash2,
  Globe, Building2, Shield, Zap, Info, RefreshCw, X,
} from "lucide-react";

interface ProvisioningRequest {
  id: number;
  provider: string;
  status: string;
  assigned_number: string | null;
  business_name: string | null;
  desired_prefix: string | null;
  created_at: string;
  activated_at: string | null;
  error_log: string | null;
}

interface ProvisioningDocument {
  id: number;
  document_type: string;
  file_name: string;
  status: string;
  rejection_reason: string | null;
  uploaded_at: string;
}

interface AvailableNumber {
  phone_number: string;
  locality?: string;
  region?: string;
  cost?: { amount: string; currency: string };
}

const ITALIAN_PREFIXES = [
  { value: "02", label: "02 - Milano" },
  { value: "06", label: "06 - Roma" },
  { value: "010", label: "010 - Genova" },
  { value: "011", label: "011 - Torino" },
  { value: "040", label: "040 - Trieste" },
  { value: "041", label: "041 - Venezia" },
  { value: "045", label: "045 - Verona" },
  { value: "049", label: "049 - Padova" },
  { value: "050", label: "050 - Pisa" },
  { value: "051", label: "051 - Bologna" },
  { value: "055", label: "055 - Firenze" },
  { value: "070", label: "070 - Cagliari" },
  { value: "080", label: "080 - Bari" },
  { value: "081", label: "081 - Napoli" },
  { value: "085", label: "085 - Pescara" },
  { value: "089", label: "089 - Salerno" },
  { value: "090", label: "090 - Messina" },
  { value: "091", label: "091 - Palermo" },
  { value: "095", label: "095 - Catania" },
  { value: "099", label: "099 - Taranto" },
];

const DOCUMENT_TYPES = [
  { type: "identity_front", label: "Documento Identita - Fronte", required: true },
  { type: "identity_back", label: "Documento Identita - Retro", required: true },
  { type: "codice_fiscale", label: "Codice Fiscale / Tessera Sanitaria", required: true },
  { type: "proof_of_address", label: "Prova di Residenza/Sede (<3 mesi)", required: true },
  { type: "vat_certificate", label: "Certificato P.IVA (se applicabile)", required: false },
  { type: "visura_camerale", label: "Visura Camerale (se societa)", required: false },
];

const STATUS_STEPS = [
  { key: "pending", label: "Richiesta" },
  { key: "documents_uploaded", label: "Documenti" },
  { key: "kyc_submitted", label: "KYC Inviato" },
  { key: "kyc_approved", label: "KYC Approvato" },
  { key: "number_ordered", label: "Numero Ordinato" },
  { key: "number_active", label: "Numero Attivo" },
  { key: "sip_configured", label: "SIP Configurato" },
  { key: "completed", label: "Completato" },
];

const DOC_STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500",
  submitted_to_provider: "bg-amber-500",
  verified: "bg-green-500",
  rejected: "bg-red-500",
};

export default function VoipProvisioningTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [wizardStep, setWizardStep] = useState(0);
  const [provider, setProvider] = useState<"telnyx" | "messagenet">("telnyx");
  const [formData, setFormData] = useState({
    business_name: "",
    business_type: "sole_proprietorship",
    vat_number: "",
    fiscal_code: "",
    legal_address: "",
    city: "",
    province: "",
    postal_code: "",
    contact_email: "",
    contact_phone: "",
    desired_prefix: "",
    notes: "",
  });
  const [searchedNumbers, setSearchedNumbers] = useState<AvailableNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [searchingNumbers, setSearchingNumbers] = useState(false);

  const { data: statusData, isLoading, refetch } = useQuery({
    queryKey: ["/api/voice/voip-provisioning/status"],
    queryFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/status", { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Errore");
      }
      return res.json();
    },
  });

  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/request", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...formData }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Errore nella creazione della richiesta");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Richiesta creata", description: "Ora puoi caricare i documenti" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
      setWizardStep(2);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentType, requestId }: { file: File; documentType: string; requestId: number }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", documentType);
      fd.append("request_id", String(requestId));
      const res = await fetch("/api/voice/voip-provisioning/documents", {
        method: "POST",
        headers: getAuthHeaders(),
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore upload");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore Upload", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/voice/voip-provisioning/documents/${docId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
    },
  });

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/submit-kyc", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!res.ok) throw new Error("Errore invio KYC");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "KYC Inviato", description: "Documenti sottomessi per la verifica" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const searchNumbersMutation = useMutation({
    mutationFn: async (prefix: string) => {
      setSearchingNumbers(true);
      const res = await fetch("/api/voice/voip-provisioning/search-numbers", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ prefix, country_code: "IT" }),
      });
      if (!res.ok) throw new Error("Errore ricerca numeri");
      return res.json();
    },
    onSuccess: (data) => {
      setSearchedNumbers((data.numbers || []).map((n: any) => ({
        phone_number: n.phoneNumber || n.phone_number,
        locality: n.locality || "",
        region: n.region || "",
      })));
      setSearchingNumbers(false);
    },
    onError: (err: Error) => {
      setSearchingNumbers(false);
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const orderNumberMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch("/api/voice/voip-provisioning/order-number", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber }),
      });
      if (!res.ok) throw new Error("Errore ordine numero");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Numero Ordinato", description: "Il numero e stato ordinato con successo" });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const provisioning = statusData?.provisioning;
  const request: ProvisioningRequest | null = provisioning || null;
  const documents: ProvisioningDocument[] = (provisioning?.documents && Array.isArray(provisioning.documents)) ? provisioning.documents : [];
  const hasActiveRequest = request && !["completed", "rejected"].includes(request.status);

  const handleFileUpload = (documentType: string, file: File) => {
    if (!request?.id) return;
    uploadDocMutation.mutate({ file, documentType, requestId: request.id });
  };

  const currentStepIndex = request ? STATUS_STEPS.findIndex(s => s.key === request.status) : -1;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (request?.status === "completed") {
    return (
      <div className="space-y-6">
        <Card className="border-green-200 dark:border-green-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-green-700 dark:text-green-400">
              <CheckCircle className="h-5 w-5" />
              Numero VoIP Attivo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="text-muted-foreground">Numero</Label>
                <p className="text-xl font-mono font-bold">{request.assigned_number || "N/D"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Provider</Label>
                <p className="font-medium capitalize">{request.provider}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Stato</Label>
                <Badge className="bg-green-600">Attivo</Badge>
              </div>
              {request.activated_at && (
                <div>
                  <Label className="text-muted-foreground">Attivato il</Label>
                  <p className="text-sm">{new Date(request.activated_at).toLocaleDateString("it-IT")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (hasActiveRequest) {
    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Richiesta Attivazione in Corso
              </CardTitle>
              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="h-4 w-4 mr-1.5" />
                Aggiorna
              </Button>
            </div>
            <CardDescription>
              Provider: {request.provider === "telnyx" ? "Telnyx" : "Messagenet"} | Creata il {new Date(request.created_at).toLocaleDateString("it-IT")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {(request.provider === "messagenet"
                ? [STATUS_STEPS[0], STATUS_STEPS[1], STATUS_STEPS[7]]
                : STATUS_STEPS
              ).map((step, i, arr) => {
                const isActive = STATUS_STEPS.findIndex(s => s.key === step.key) <= currentStepIndex;
                const isCurrent = step.key === request.status;
                return (
                  <div key={step.key} className="flex items-center gap-1 flex-shrink-0">
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap ${
                      isCurrent ? "bg-primary text-primary-foreground" :
                      isActive ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isActive && !isCurrent && <CheckCircle className="h-3 w-3" />}
                      {isCurrent && <Clock className="h-3 w-3" />}
                      {step.label}
                    </div>
                    {i < arr.length - 1 && <ArrowRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />}
                  </div>
                );
              })}
            </div>

            {request.status === "rejected" && request.error_log && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Richiesta Rifiutata</p>
                      <p className="text-sm text-muted-foreground mt-1">{request.error_log}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Documents section */}
            <div>
              <h3 className="font-medium mb-3">Documenti Caricati</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {DOCUMENT_TYPES.map((docType) => {
                  const doc = documents.find(d => d.document_type === docType.type);
                  return (
                    <Card key={docType.type} className={`${doc ? "border-green-200 dark:border-green-800" : ""}`}>
                      <CardContent className="pt-4 pb-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{docType.label}</p>
                            {doc ? (
                              <div className="flex items-center gap-2 mt-1">
                                <Badge className={`${DOC_STATUS_COLORS[doc.status] || "bg-gray-500"} text-[10px]`}>
                                  {doc.status === "uploaded" ? "Caricato" :
                                   doc.status === "submitted_to_provider" ? "Inviato" :
                                   doc.status === "verified" ? "Verificato" :
                                   doc.status === "rejected" ? "Rifiutato" : doc.status}
                                </Badge>
                                <span className="text-xs text-muted-foreground truncate">{doc.file_name}</span>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground mt-1">
                                {docType.required ? "Richiesto" : "Opzionale"}
                              </p>
                            )}
                            {doc?.rejection_reason && (
                              <p className="text-xs text-red-500 mt-1">{doc.rejection_reason}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {doc ? (
                              <Button
                                variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                onClick={() => deleteDocMutation.mutate(doc.id)}
                                disabled={deleteDocMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            ) : (
                              <label className="cursor-pointer">
                                <input
                                  type="file"
                                  className="hidden"
                                  accept="image/*,.pdf"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleFileUpload(docType.type, file);
                                    e.target.value = "";
                                  }}
                                />
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                                  <Upload className="h-3.5 w-3.5" />
                                  Carica
                                </div>
                              </label>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>

            {/* KYC Submit */}
            {request.status === "pending" || request.status === "documents_uploaded" ? (
              <div className="flex gap-3">
                <Button
                  onClick={() => submitKycMutation.mutate()}
                  disabled={submitKycMutation.isPending || documents.filter(d => DOCUMENT_TYPES.find(dt => dt.type === d.document_type && dt.required)).length < DOCUMENT_TYPES.filter(dt => dt.required).length}
                >
                  {submitKycMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <Shield className="h-4 w-4 mr-2" />
                  Invia Documenti per Verifica
                </Button>
              </div>
            ) : null}

            {/* Number search (after KYC approved, for Telnyx) */}
            {request.provider === "telnyx" && request.status === "kyc_approved" && (
              <div className="space-y-4">
                <h3 className="font-medium">Scegli il tuo Numero</h3>
                <div className="flex gap-3">
                  <Select
                    value={formData.desired_prefix}
                    onValueChange={(v) => setFormData(prev => ({ ...prev, desired_prefix: v }))}
                  >
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Prefisso..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ITALIAN_PREFIXES.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    onClick={() => searchNumbersMutation.mutate(formData.desired_prefix)}
                    disabled={!formData.desired_prefix || searchingNumbers}
                  >
                    {searchingNumbers ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Cerca Numeri
                  </Button>
                </div>

                {searchedNumbers.length > 0 && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {searchedNumbers.map((num) => (
                      <Card
                        key={num.phone_number}
                        className={`cursor-pointer transition-colors hover:border-primary ${selectedNumber === num.phone_number ? "border-primary bg-primary/5" : ""}`}
                        onClick={() => setSelectedNumber(num.phone_number)}
                      >
                        <CardContent className="py-3 flex items-center justify-between">
                          <div>
                            <p className="font-mono font-medium">{num.phone_number}</p>
                            {num.locality && <p className="text-xs text-muted-foreground">{num.locality}</p>}
                          </div>
                          {selectedNumber === num.phone_number && (
                            <CheckCircle className="h-5 w-5 text-primary" />
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}

                {selectedNumber && (
                  <Button
                    onClick={() => orderNumberMutation.mutate(selectedNumber)}
                    disabled={orderNumberMutation.isPending}
                  >
                    {orderNumberMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <Phone className="h-4 w-4 mr-2" />
                    Ordina {selectedNumber}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* Guida "Come Funziona" */}
      {wizardStep === 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Attiva il tuo Numero VoIP
              </CardTitle>
              <CardDescription>
                Per effettuare e ricevere chiamate AI, hai bisogno di un numero di telefono dedicato.
                Segui la procedura guidata per attivarne uno.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">

              {/* Step guide */}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">1</div>
                  <div>
                    <p className="font-medium">Scegli il provider</p>
                    <p className="text-sm text-muted-foreground">Telnyx (automatico) o Messagenet (manuale)</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">2</div>
                  <div>
                    <p className="font-medium">Compila i dati</p>
                    <p className="text-sm text-muted-foreground">Dati anagrafici e P.IVA per la verifica</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">3</div>
                  <div>
                    <p className="font-medium">Carica i documenti</p>
                    <p className="text-sm text-muted-foreground">Documento, C.F., prova di residenza</p>
                  </div>
                </div>
                <div className="flex gap-3 p-4 bg-muted/30 rounded-lg">
                  <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold flex-shrink-0">4</div>
                  <div>
                    <p className="font-medium">Attivazione</p>
                    <p className="text-sm text-muted-foreground">2-5 giorni (Telnyx) o 1-3 giorni (Messagenet)</p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Provider comparison */}
              <div>
                <h3 className="font-medium mb-4">Confronto Provider</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Card className="border-primary">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base flex items-center gap-2">
                          <Zap className="h-4 w-4 text-amber-500" />
                          Telnyx
                        </CardTitle>
                        <Badge>Consigliato</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Attivazione</span><span>Gratuita</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Canone</span><span>$1/mese (~12$/anno)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Fisso IT</span><span>$0.0115/min (~1 cent)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Mobile IT</span><span>$0.0365/min (~3.6 cent)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Inbound</span><span>$0.008/min (~0.8 cent)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Numeri verdi</span><span className="text-green-600 font-medium">Gratuito</span></div>
                      <Separator className="my-2" />
                      <div className="flex justify-between"><span className="text-muted-foreground">Chiamata AI 3 min</span><span>~$0.11 (~10 cent)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Provisioning</span><span className="text-green-600 font-medium">Automatico</span></div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        Messagenet
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between"><span className="text-muted-foreground">Attivazione</span><span>8,54 una tantum</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Canone</span><span>36,60/anno (base)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Fisso IT</span><span>Incluse (Pro) / a consumo</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Mobile IT</span><span>Incluse (Pro 2+) / a consumo</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Inbound</span><span>Incluso</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Numeri verdi</span><span>N/D</span></div>
                      <Separator className="my-2" />
                      <div className="flex justify-between"><span className="text-muted-foreground">Chiamata AI 3 min</span><span>Inclusa (Pro)</span></div>
                      <div className="flex justify-between"><span className="text-muted-foreground">Provisioning</span><span>Manuale (1-3 gg)</span></div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-sm">
                <Info className="h-4 w-4 text-blue-500 flex-shrink-0" />
                <span>Le tariffe Telnyx sono certificate dal supporto ufficiale. Con un DDI italiano, la tariffa mobile e di $0.0365/min per <strong>tutti</strong> gli operatori (TIM, Vodafone, Wind Tre, Iliad, ecc.).</span>
              </div>

              <Button onClick={() => setWizardStep(1)} className="w-full sm:w-auto">
                Inizia Attivazione
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </>
      )}

      {/* Step 1: Provider + Business Data */}
      {wizardStep === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setWizardStep(0)}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <CardTitle>Dati per l'Attivazione</CardTitle>
                <CardDescription>Compila i dati anagrafici e scegli il provider</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Provider selection */}
            <div>
              <Label className="text-base font-medium">Provider</Label>
              <RadioGroup
                value={provider}
                onValueChange={(v) => setProvider(v as "telnyx" | "messagenet")}
                className="mt-2 grid gap-3 sm:grid-cols-2"
              >
                <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${provider === "telnyx" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="telnyx" />
                  <div>
                    <span className="font-medium">Telnyx</span>
                    <span className="text-xs text-muted-foreground block">Automatico, $1/mese</span>
                  </div>
                </label>
                <label className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-colors ${provider === "messagenet" ? "border-primary bg-primary/5" : "border-border"}`}>
                  <RadioGroupItem value="messagenet" />
                  <div>
                    <span className="font-medium">Messagenet</span>
                    <span className="text-xs text-muted-foreground block">Manuale, da 36,60/anno</span>
                  </div>
                </label>
              </RadioGroup>
            </div>

            <Separator />

            {/* Business data form */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <Label htmlFor="business_name">Nome / Ragione Sociale *</Label>
                <Input id="business_name" value={formData.business_name} onChange={e => setFormData(p => ({ ...p, business_name: e.target.value }))} />
              </div>
              <div>
                <Label>Tipo *</Label>
                <Select value={formData.business_type} onValueChange={v => setFormData(p => ({ ...p, business_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="natural_person">Persona Fisica</SelectItem>
                    <SelectItem value="sole_proprietorship">Ditta Individuale</SelectItem>
                    <SelectItem value="legal_entity">Societa (SRL, SPA, ecc.)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="fiscal_code">Codice Fiscale *</Label>
                <Input id="fiscal_code" value={formData.fiscal_code} onChange={e => setFormData(p => ({ ...p, fiscal_code: e.target.value.toUpperCase() }))} maxLength={16} />
              </div>
              <div>
                <Label htmlFor="vat_number">Partita IVA</Label>
                <Input id="vat_number" value={formData.vat_number} onChange={e => setFormData(p => ({ ...p, vat_number: e.target.value }))} placeholder="IT..." />
              </div>
              <div>
                <Label htmlFor="contact_email">Email *</Label>
                <Input id="contact_email" type="email" value={formData.contact_email} onChange={e => setFormData(p => ({ ...p, contact_email: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="legal_address">Indirizzo Completo *</Label>
                <Input id="legal_address" value={formData.legal_address} onChange={e => setFormData(p => ({ ...p, legal_address: e.target.value }))} placeholder="Via/Piazza..." />
              </div>
              <div>
                <Label htmlFor="city">Citta *</Label>
                <Input id="city" value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="province">Provincia</Label>
                  <Input id="province" value={formData.province} onChange={e => setFormData(p => ({ ...p, province: e.target.value.toUpperCase() }))} maxLength={2} placeholder="MI" />
                </div>
                <div>
                  <Label htmlFor="postal_code">CAP *</Label>
                  <Input id="postal_code" value={formData.postal_code} onChange={e => setFormData(p => ({ ...p, postal_code: e.target.value }))} maxLength={5} />
                </div>
              </div>
              <div>
                <Label htmlFor="contact_phone">Telefono di contatto</Label>
                <Input id="contact_phone" value={formData.contact_phone} onChange={e => setFormData(p => ({ ...p, contact_phone: e.target.value }))} placeholder="+39..." />
              </div>
              <div>
                <Label>Prefisso Desiderato</Label>
                <Select value={formData.desired_prefix} onValueChange={v => setFormData(p => ({ ...p, desired_prefix: v }))}>
                  <SelectTrigger><SelectValue placeholder="Scegli prefisso..." /></SelectTrigger>
                  <SelectContent>
                    {ITALIAN_PREFIXES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="notes">Note aggiuntive</Label>
                <Textarea id="notes" value={formData.notes} onChange={e => setFormData(p => ({ ...p, notes: e.target.value }))} rows={2} />
              </div>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setWizardStep(0)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Indietro
              </Button>
              <Button
                onClick={() => createRequestMutation.mutate()}
                disabled={!formData.business_name || !formData.fiscal_code || !formData.contact_email || !formData.city || !formData.postal_code || !formData.legal_address || createRequestMutation.isPending}
              >
                {createRequestMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Crea Richiesta e Carica Documenti
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
