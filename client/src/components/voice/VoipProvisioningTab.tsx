import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import {
  Phone, Upload, FileCheck, Search, CheckCircle, Clock,
  ArrowLeft, ArrowRight, Loader2, AlertCircle, Trash2,
  Shield, AlertTriangle, Timer, Package, FileText, RefreshCw,
} from "lucide-react";

interface ConsultantNumber {
  id: number;
  phone_number: string;
  country_code: string;
  prefix: string | null;
  status: string;
  kyc_status: string;
  kyc_deadline: string | null;
  kyc_submitted_at: string | null;
  kyc_request_id: number | null;
  days_remaining: number | null;
  created_at: string;
  documents: Array<{
    id: number;
    document_type: string;
    file_name: string;
    status: string;
    rejection_reason: string | null;
    uploaded_at: string;
  }>;
}

interface AvailableNumber {
  phone_number: string;
  country_code: string;
  prefix: string | null;
  monthly_cost: string | null;
  inventory_id: number;
}

interface TelnyxNumber {
  phoneNumber: string;
  features?: any;
}

interface ClassicDocument {
  id: number;
  document_type: string;
  file_name: string;
  status: string;
  rejection_reason: string | null;
}

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

type FlowMode = "choose" | "inventory" | "kyc-classic";

const STATUS_STEPS = [
  { key: "pending",            label: "Richiesta" },
  { key: "documents_uploaded", label: "Documenti" },
  { key: "kyc_submitted",      label: "KYC Inviato" },
  { key: "kyc_approved",       label: "KYC Approvato" },
  { key: "number_ordered",     label: "Numero Ordinato" },
  { key: "number_active",      label: "Numero Attivo" },
  { key: "sip_configured",     label: "SIP Configurato" },
  { key: "completed",          label: "Completato" },
];

type KycClassicStep = "search" | "form" | "documents" | "done";

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

const DOC_STATUS_COLORS: Record<string, string> = {
  uploaded: "bg-blue-500",
  submitted_to_provider: "bg-amber-500",
  verified: "bg-green-500",
  rejected: "bg-red-500",
};

function DeadlineBadge({ daysRemaining }: { daysRemaining: number | null }) {
  if (daysRemaining === null) return null;
  const color = daysRemaining > 3 ? "bg-green-100 text-green-800 border-green-300" :
    daysRemaining >= 1 ? "bg-amber-100 text-amber-800 border-amber-300" :
    "bg-red-100 text-red-800 border-red-300";
  return (
    <Badge variant="outline" className={`${color} font-medium`}>
      <Timer className="h-3 w-3 mr-1" />
      {daysRemaining > 0 ? `${daysRemaining} giorni rimanenti` : "Scaduto"}
    </Badge>
  );
}

export default function VoipProvisioningTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [flowMode, setFlowMode] = useState<FlowMode>("choose");

  // Inventory flow state
  const [allInventoryNumbers, setAllInventoryNumbers] = useState<AvailableNumber[]>([]);
  const [inventoryLoaded, setInventoryLoaded] = useState(false);
  const [inventoryLoading, setInventoryLoading] = useState(false);
  const [inventoryPrefix, setInventoryPrefix] = useState("all");
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);

  // KYC classic flow state
  const [kycStep, setKycStep] = useState<KycClassicStep>("search");
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [telnyxNumbers, setTelnyxNumbers] = useState<TelnyxNumber[]>([]);
  const [classicSelectedNumber, setClassicSelectedNumber] = useState<string | null>(null);
  const [classicRequestId, setClassicRequestId] = useState<number | null>(null);
  const [classicDocs, setClassicDocs] = useState<ClassicDocument[]>([]);
  const classicFileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [formData, setFormData] = useState({
    business_name: "",
    fiscal_code: "",
    vat_number: "",
    legal_address: "",
    city: "",
    province: "",
    postal_code: "",
    contact_email: "",
    contact_phone: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Refs for existing number KYC upload
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const prevProvStatusRef = useRef<string | null>(null);

  const { data: myNumberData, isLoading } = useQuery({
    queryKey: ["/api/voice/voip-provisioning/my-number"],
    queryFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/my-number", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Errore");
      return res.json();
    },
    refetchInterval: (query) => {
      const num = query.state.data?.number;
      if (num && (num.kyc_status === "submitted" || num.status === "suspended" || num.kyc_status === "pending")) return 30000;
      return false;
    },
  });

  const { data: provStatusData, refetch: refetchProvStatus } = useQuery({
    queryKey: ["/api/voice/voip-provisioning/status"],
    queryFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/status", { headers: getAuthHeaders() });
      if (!res.ok) {
        if (res.status === 404) return null;
        throw new Error("Errore");
      }
      return res.json();
    },
    refetchInterval: (query) => {
      const st = query.state.data?.provisioning?.status;
      if (st === "kyc_submitted" || st === "number_ordered") return 30000;
      return false;
    },
  });

  useEffect(() => {
    const currentStatus = provStatusData?.provisioning?.status;
    if (!currentStatus) {
      prevProvStatusRef.current = currentStatus || null;
      return;
    }
    if (prevProvStatusRef.current && currentStatus !== prevProvStatusRef.current) {
      if (currentStatus === "kyc_approved") {
        toast({ title: "KYC Approvato!", description: "Il tuo KYC e stato approvato. Ora puoi ordinare il numero." });
      } else if (currentStatus === "number_active" || currentStatus === "completed") {
        toast({ title: "Numero Attivato!", description: "Il tuo numero di telefono e stato attivato con successo." });
      } else if (currentStatus === "rejected") {
        toast({ title: "Richiesta Rifiutata", description: "La tua richiesta e stata rifiutata. Controlla i dettagli.", variant: "destructive" });
      }
    }
    prevProvStatusRef.current = currentStatus;
  }, [provStatusData?.provisioning?.status]);

  // Load all inventory numbers when entering inventory mode
  useEffect(() => {
    if (flowMode === "inventory" && !inventoryLoaded) {
      setInventoryLoading(true);
      fetch("/api/voice/voip-provisioning/available-numbers", { headers: getAuthHeaders() })
        .then(r => r.json())
        .then(data => {
          setAllInventoryNumbers(data.numbers || []);
          setInventoryLoaded(true);
          setInventoryLoading(false);
        })
        .catch(() => {
          setInventoryLoading(false);
          toast({ title: "Errore", description: "Impossibile caricare i numeri disponibili", variant: "destructive" });
        });
    }
  }, [flowMode]);

  // Derived: unique prefixes from inventory
  const inventoryPrefixes = Array.from(
    new Set(allInventoryNumbers.map(n => n.prefix).filter(Boolean) as string[])
  ).sort();

  // Derived: filtered inventory numbers
  const filteredInventoryNumbers = inventoryPrefix === "all"
    ? allInventoryNumbers
    : allInventoryNumbers.filter(n => n.prefix === inventoryPrefix);

  const searchTelnyxMutation = useMutation({
    mutationFn: async (prefix: string) => {
      const res = await fetch(`/api/voice/voip-provisioning/search-telnyx?prefix=${encodeURIComponent(prefix)}&country=IT`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nella ricerca numeri");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setTelnyxNumbers(data.numbers || []);
      setClassicSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const selectNumberMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch("/api/voice/voip-provisioning/select-number", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ phone_number: phoneNumber, prefix: inventoryPrefix === "all" ? "" : inventoryPrefix }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Errore nell'assegnazione del numero");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Numero Assegnato!", description: data.message || "Il numero e stato assegnato al tuo account." });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
      setAllInventoryNumbers([]);
      setInventoryLoaded(false);
      setSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  // KYC Classic Step 2: create provisioning request
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/request", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: "telnyx",
          ...formData,
          desired_prefix: selectedPrefix || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore nella creazione della richiesta");
      return data;
    },
    onSuccess: (data) => {
      const requestId = data.request?.id;
      setClassicRequestId(requestId);
      setClassicDocs([]);
      setKycStep("documents");
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  // KYC Classic Step 3: upload document
  const uploadClassicDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      if (!classicRequestId) throw new Error("Nessuna richiesta attiva");
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", documentType);
      fd.append("request_id", String(classicRequestId));
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
    onSuccess: (_data, variables) => {
      setClassicDocs(prev => {
        const filtered = prev.filter(d => d.document_type !== variables.documentType);
        return [...filtered, {
          id: Date.now(),
          document_type: variables.documentType,
          file_name: variables.file.name,
          status: "uploaded",
          rejection_reason: null,
        }];
      });
      toast({ title: "Documento caricato", description: "File salvato correttamente" });
    },
    onError: (err: Error) => {
      toast({ title: "Errore Upload", description: err.message, variant: "destructive" });
    },
  });

  // KYC Classic Step 4: submit KYC
  const submitClassicKycMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/submit-kyc", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore invio KYC");
      return data;
    },
    onSuccess: () => {
      toast({ title: "KYC Inviato", description: "La tua richiesta e in fase di approvazione (1-5 giorni lavorativi)." });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
      resetKycClassic();
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  // Cancel provisioning request
  const cancelProvRequestMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/cancel", {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Errore annullamento");
      return data;
    },
    onSuccess: () => {
      toast({ title: "Richiesta annullata", description: "Puoi ora richiedere un nuovo numero." });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/status"] });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  // Existing number KYC upload/delete/submit mutations
  const uploadDocMutation = useMutation({
    mutationFn: async ({ file, documentType }: { file: File; documentType: string }) => {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("document_type", documentType);
      const res = await fetch("/api/voice/voip-provisioning/upload-kyc-doc", {
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
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore Upload", description: err.message, variant: "destructive" });
    },
  });

  const deleteDocMutation = useMutation({
    mutationFn: async (docId: number) => {
      const res = await fetch(`/api/voice/voip-provisioning/kyc-doc/${docId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
    },
  });

  const submitKycMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/submit-kyc-docs", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.validationErrors) throw new Error(data.validationErrors.join("; "));
        if (data.missingDocuments) throw new Error(`Documenti mancanti: ${data.missingDocuments.join(", ")}`);
        throw new Error(data.error || "Errore invio KYC");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "KYC Inviato", description: "Documentazione inviata per verifica. Riceverai aggiornamenti automatici." });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.business_name || formData.business_name.trim().length < 2) errors.business_name = "Min 2 caratteri";
    if (!formData.fiscal_code || !/^[A-Z0-9]{16}$/i.test(formData.fiscal_code.trim())) errors.fiscal_code = "16 caratteri alfanumerici";
    if (!formData.contact_email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.contact_email.trim())) errors.contact_email = "Email non valida";
    if (!formData.legal_address || formData.legal_address.trim().length < 3) errors.legal_address = "Min 3 caratteri";
    if (!formData.city || formData.city.trim().length < 2) errors.city = "Min 2 caratteri";
    if (!formData.postal_code || !/^\d{5}$/.test(formData.postal_code.trim())) errors.postal_code = "5 cifre";
    if (formData.vat_number && !/^\d{11}$/.test(formData.vat_number.trim())) errors.vat_number = "11 cifre";
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitKyc = () => {
    if (!validateForm()) {
      toast({ title: "Dati non validi", description: "Controlla i campi evidenziati in rosso", variant: "destructive" });
      return;
    }
    submitKycMutation.mutate();
  };

  const handleClassicNext = () => {
    if (!classicSelectedNumber) {
      toast({ title: "Errore", description: "Seleziona prima un numero", variant: "destructive" });
      return;
    }
    setKycStep("form");
  };

  const handleClassicCreateRequest = () => {
    if (!validateForm()) {
      toast({ title: "Dati non validi", description: "Controlla i campi evidenziati in rosso", variant: "destructive" });
      return;
    }
    createRequestMutation.mutate();
  };

  const resetKycClassic = () => {
    setKycStep("search");
    setSelectedPrefix("");
    setTelnyxNumbers([]);
    setClassicSelectedNumber(null);
    setClassicRequestId(null);
    setClassicDocs([]);
    setFormData({
      business_name: "", fiscal_code: "", vat_number: "", legal_address: "",
      city: "", province: "", postal_code: "", contact_email: "", contact_phone: "",
    });
    setFormErrors({});
  };

  const hasNumber = myNumberData?.hasNumber;
  const number: ConsultantNumber | null = myNumberData?.number || null;

  const provRequest: ProvisioningRequest | null = provStatusData?.provisioning || null;
  const provDocs: ProvisioningDocument[] = Array.isArray(provStatusData?.provisioning?.documents) ? provStatusData.provisioning.documents : [];
  const hasActiveProvRequest = provRequest && !["completed", "rejected"].includes(provRequest.status);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // ─── Existing Number Screens ───────────────────────────────────────────────

  if (hasNumber && number) {
    if (number.kyc_status === "approved" && number.status === "active") {
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
                  <p className="text-xl font-mono font-bold">{number.phone_number}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Stato KYC</Label>
                  <Badge className="bg-green-600">Approvato</Badge>
                </div>
                <div>
                  <Label className="text-muted-foreground">Attivato il</Label>
                  <p className="text-sm">{new Date(number.created_at).toLocaleDateString("it-IT")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    if (number.status === "suspended") {
      return (
        <div className="space-y-6">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-700 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Numero Sospeso
              </CardTitle>
              <CardDescription>
                Il numero <span className="font-mono font-bold">{number.phone_number}</span> e stato sospeso per mancata documentazione KYC.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4">
                Carica i documenti richiesti e invia la documentazione per riattivare il numero.
              </p>
              {renderKycForm(number)}
            </CardContent>
          </Card>
        </div>
      );
    }

    if (number.kyc_status === "submitted") {
      return (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {number.phone_number}
              </CardTitle>
              <CardDescription>Documentazione in fase di verifica</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg">
                <Loader2 className="h-5 w-5 animate-spin text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">KYC in fase di revisione</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    I documenti sono stati inviati per la verifica. La pagina si aggiorna automaticamente.
                  </p>
                </div>
              </div>

              {number.documents.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">Documenti inviati</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {number.documents.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                        <FileCheck className="h-4 w-4 text-green-500" />
                        <span className="truncate">{doc.file_name}</span>
                        <Badge className={`${DOC_STATUS_COLORS[doc.status] || "bg-gray-500"} text-[10px] ml-auto`}>
                          {doc.status === "uploaded" ? "Caricato" :
                           doc.status === "submitted_to_provider" ? "Inviato" :
                           doc.status === "verified" ? "Verificato" :
                           doc.status === "rejected" ? "Rifiutato" : doc.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                {number.phone_number}
              </CardTitle>
              <DeadlineBadge daysRemaining={number.days_remaining} />
            </div>
            <CardDescription>
              Numero attivato il {new Date(number.created_at).toLocaleDateString("it-IT")}.
              {number.kyc_deadline && (
                <> Scadenza documenti: <strong>{new Date(number.kyc_deadline).toLocaleDateString("it-IT")}</strong></>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg mb-6">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-blue-800 dark:text-blue-200">Documentazione KYC richiesta</p>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Per legge, devi caricare la documentazione entro 7 giorni dall'attivazione del numero.
                  Se non lo fai, il numero verra sospeso automaticamente.
                </p>
              </div>
            </div>
            {renderKycForm(number)}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Provisioning Request Tracker (kyc-classic after submission) ──────────

  if (!hasNumber && provRequest && provRequest.status === "completed") {
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
                <p className="text-xl font-mono font-bold">{provRequest.assigned_number || "N/D"}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Provider</Label>
                <p className="font-medium capitalize">{provRequest.provider}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Stato</Label>
                <Badge className="bg-green-600">Attivo</Badge>
              </div>
              {provRequest.activated_at && (
                <div>
                  <Label className="text-muted-foreground">Attivato il</Label>
                  <p className="text-sm">{new Date(provRequest.activated_at).toLocaleDateString("it-IT")}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!hasNumber && hasActiveProvRequest && provRequest) {
    const currentStepIndex = STATUS_STEPS.findIndex(s => s.key === provRequest.status);
    const stepsToShow = provRequest.provider === "messagenet"
      ? [STATUS_STEPS[0], STATUS_STEPS[1], STATUS_STEPS[7]]
      : STATUS_STEPS;

    return (
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="flex items-center gap-2">
                <Phone className="h-5 w-5" />
                Richiesta Attivazione in Corso
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchProvStatus()}>
                  <RefreshCw className="h-4 w-4 mr-1.5" />
                  Aggiorna
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:border-red-300"
                  onClick={() => {
                    if (window.confirm("Sei sicuro di voler annullare questa richiesta? L'operazione non e reversibile.")) {
                      cancelProvRequestMutation.mutate();
                    }
                  }}
                  disabled={cancelProvRequestMutation.isPending}
                >
                  {cancelProvRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1.5" />}
                  Annulla Richiesta
                </Button>
              </div>
            </div>
            <CardDescription>
              Provider: {provRequest.provider === "telnyx" ? "Telnyx" : "Messagenet"} | Creata il {new Date(provRequest.created_at).toLocaleDateString("it-IT")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Progress bar */}
            <div className="flex items-center gap-1 overflow-x-auto pb-2">
              {stepsToShow.map((step, i, arr) => {
                const isActive = STATUS_STEPS.findIndex(s => s.key === step.key) <= currentStepIndex;
                const isCurrent = step.key === provRequest.status;
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

            {provRequest.status === "rejected" && provRequest.error_log && (
              <Card className="border-red-200 dark:border-red-800">
                <CardContent className="pt-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Richiesta Rifiutata</p>
                      <p className="text-sm text-muted-foreground mt-1">{provRequest.error_log}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {provDocs.length > 0 && (
              <div>
                <h4 className="text-sm font-medium mb-2">Documenti caricati</h4>
                <div className="grid gap-2 sm:grid-cols-2">
                  {provDocs.map((doc) => (
                    <div key={doc.id} className="flex items-center gap-2 p-2 bg-muted/50 rounded text-sm">
                      <FileCheck className="h-4 w-4 text-green-500 flex-shrink-0" />
                      <span className="truncate flex-1">{doc.file_name}</span>
                      <Badge className={`${DOC_STATUS_COLORS[doc.status] || "bg-gray-500"} text-[10px] ml-auto`}>
                        {doc.status === "uploaded" ? "Caricato" :
                         doc.status === "submitted_to_provider" ? "Inviato" :
                         doc.status === "verified" ? "Verificato" :
                         doc.status === "rejected" ? "Rifiutato" : doc.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex items-center gap-2 p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600 flex-shrink-0" />
              <p className="text-amber-800 dark:text-amber-200">
                La pagina si aggiorna automaticamente ogni 30 secondi. L'approvazione KYC richiede 1-5 giorni lavorativi.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Choose Screen ─────────────────────────────────────────────────────────

  if (flowMode === "choose") {
    return (
      <div className="space-y-6">
        <div className="text-center mb-2">
          <h2 className="text-xl font-bold">Attiva un Numero VoIP</h2>
          <p className="text-muted-foreground mt-1">Scegli come ottenere il tuo numero telefonico</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            onClick={() => { setFlowMode("inventory"); setInventoryLoaded(false); setInventoryPrefix("all"); setSelectedNumber(null); }}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-3 bg-green-100 dark:bg-green-900/30 rounded-full w-fit mb-2">
                <Package className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="text-lg">Numeri Disponibili</CardTitle>
              <CardDescription>
                Numeri gia acquistati e pronti all'uso
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1 text-left">
                <li className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
                  Attivazione istantanea
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  7 giorni per completare il KYC
                </li>
                <li className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  Puoi chiamare subito
                </li>
              </ul>
              <Button className="w-full mt-4" variant="default">
                <Package className="h-4 w-4 mr-2" />
                Scegli dall'inventario
              </Button>
            </CardContent>
          </Card>

          <Card
            className="cursor-pointer hover:border-primary/50 hover:shadow-md transition-all"
            onClick={() => { setFlowMode("kyc-classic"); resetKycClassic(); }}
          >
            <CardHeader className="text-center pb-2">
              <div className="mx-auto p-3 bg-blue-100 dark:bg-blue-900/30 rounded-full w-fit mb-2">
                <FileText className="h-8 w-8 text-blue-600" />
              </div>
              <CardTitle className="text-lg">Richiedi Nuovo Numero</CardTitle>
              <CardDescription>
                Cerca un numero specifico e completa il KYC
              </CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <ul className="text-sm text-muted-foreground space-y-1 text-left">
                <li className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-blue-500 flex-shrink-0" />
                  Cerca per prefisso su Telnyx
                </li>
                <li className="flex items-center gap-2">
                  <Shield className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  Compila dati e documenti KYC
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  Attesa approvazione (1-5 giorni)
                </li>
              </ul>
              <Button className="w-full mt-4" variant="outline">
                <FileText className="h-4 w-4 mr-2" />
                Richiedi con KYC
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Inventory Screen ──────────────────────────────────────────────────────

  if (flowMode === "inventory") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setFlowMode("choose"); setAllInventoryNumbers([]); setInventoryLoaded(false); setSelectedNumber(null); setInventoryPrefix("all"); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Numeri Disponibili
            </CardTitle>
            <CardDescription>
              Scegli un numero dall'inventario. Verra assegnato immediatamente al tuo account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {inventoryLoading && (
              <div className="flex items-center justify-center py-10">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                <span className="text-muted-foreground">Caricamento numeri...</span>
              </div>
            )}

            {inventoryLoaded && allInventoryNumbers.length === 0 && (
              <div className="text-center py-10">
                <AlertCircle className="h-8 w-8 mx-auto mb-3 text-muted-foreground opacity-50" />
                <p className="font-medium">Nessun numero disponibile in inventario</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Al momento non ci sono numeri preacquistati disponibili.
                </p>
                <Button variant="outline" className="mt-4" onClick={() => { setFlowMode("kyc-classic"); resetKycClassic(); }}>
                  <FileText className="h-4 w-4 mr-2" />
                  Richiedi un Nuovo Numero con KYC
                </Button>
              </div>
            )}

            {inventoryLoaded && allInventoryNumbers.length > 0 && (
              <>
                {inventoryPrefixes.length > 0 && (
                  <div className="flex gap-3 items-end flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <Label>Filtra per prefisso</Label>
                      <Select value={inventoryPrefix} onValueChange={(v) => { setInventoryPrefix(v); setSelectedNumber(null); }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Tutti i prefissi" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Tutti i prefissi</SelectItem>
                          {inventoryPrefixes.map(p => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    {filteredInventoryNumbers.length} {filteredInventoryNumbers.length === 1 ? "numero disponibile" : "numeri disponibili"}
                    {inventoryPrefix !== "all" && ` per il prefisso ${inventoryPrefix}`}
                  </p>

                  {filteredInventoryNumbers.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground">
                      <AlertCircle className="h-6 w-6 mx-auto mb-2 opacity-50" />
                      <p>Nessun numero per questo prefisso. Prova a selezionare "Tutti i prefissi".</p>
                    </div>
                  ) : (
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto">
                      {filteredInventoryNumbers.map((num) => {
                        const phoneNum = num.phone_number;
                        const isSelected = selectedNumber === phoneNum;
                        return (
                          <button
                            key={phoneNum}
                            onClick={() => setSelectedNumber(isSelected ? null : phoneNum)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-mono font-medium text-sm">{phoneNum}</p>
                            {num.prefix && (
                              <p className="text-xs text-muted-foreground mt-1">Prefisso: {num.prefix}</p>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedNumber && (
                    <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                      <Phone className="h-5 w-5 text-primary" />
                      <div className="flex-1">
                        <p className="font-medium">Numero selezionato: <span className="font-mono">{selectedNumber}</span></p>
                        <p className="text-xs text-muted-foreground">Verra assegnato immediatamente. Avrai 7 giorni per caricare la documentazione KYC.</p>
                      </div>
                      <Button
                        onClick={() => selectNumberMutation.mutate(selectedNumber)}
                        disabled={selectNumberMutation.isPending}
                      >
                        {selectNumberMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                        Attiva Numero
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── KYC Classic Screen ────────────────────────────────────────────────────

  if (flowMode === "kyc-classic") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setFlowMode("choose"); resetKycClassic(); }}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Richiedi Nuovo Numero
            </CardTitle>
            <CardDescription>
              Cerca un numero, compila i dati aziendali e carica i documenti. Il numero sara attivato dopo l'approvazione KYC.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* Step indicators */}
            <div className="flex items-center gap-2 text-sm">
              {(["search", "form", "documents"] as KycClassicStep[]).map((s, i) => {
                const labels = ["1. Cerca Numero", "2. Dati Aziendali", "3. Documenti"];
                const isDone = (
                  (s === "search" && (kycStep === "form" || kycStep === "documents")) ||
                  (s === "form" && kycStep === "documents")
                );
                const isActive = kycStep === s;
                return (
                  <div key={s} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      isDone ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                      isActive ? "bg-primary text-primary-foreground" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {isDone ? <CheckCircle className="h-3 w-3 inline mr-1" /> : null}
                      {labels[i]}
                    </span>
                    {i < 2 && <span className="text-muted-foreground">→</span>}
                  </div>
                );
              })}
            </div>

            {/* STEP 1: Search */}
            {kycStep === "search" && (
              <div>
                <h3 className="font-medium mb-3 flex items-center gap-2">
                  <Search className="h-4 w-4" />
                  Cerca un numero disponibile su Telnyx
                </h3>
                <div className="flex gap-3 items-end flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Label>Prefisso</Label>
                    <Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona prefisso..." />
                      </SelectTrigger>
                      <SelectContent>
                        {ITALIAN_PREFIXES.map(p => (
                          <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={() => searchTelnyxMutation.mutate(selectedPrefix)}
                    disabled={!selectedPrefix || searchTelnyxMutation.isPending}
                  >
                    {searchTelnyxMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                    Cerca su Telnyx
                  </Button>
                </div>

                {telnyxNumbers.length > 0 && (
                  <div className="space-y-3 mt-4">
                    <p className="text-sm text-muted-foreground">{telnyxNumbers.length} numeri trovati</p>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[300px] overflow-y-auto">
                      {telnyxNumbers.map((num) => {
                        const phoneNum = num.phoneNumber || (num as any).phone_number;
                        const isSelected = classicSelectedNumber === phoneNum;
                        return (
                          <button
                            key={phoneNum}
                            onClick={() => setClassicSelectedNumber(isSelected ? null : phoneNum)}
                            className={`p-3 rounded-lg border text-left transition-all ${
                              isSelected
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                                : "border-border hover:border-primary/50 hover:bg-muted/50"
                            }`}
                          >
                            <p className="font-mono font-medium text-sm">{phoneNum}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {searchTelnyxMutation.isSuccess && telnyxNumbers.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground mt-4">
                    <Phone className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nessun numero disponibile con questo prefisso. Prova un altro prefisso.</p>
                  </div>
                )}

                {classicSelectedNumber && (
                  <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg mt-4">
                    <Phone className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <p className="font-medium">Selezionato: <span className="font-mono">{classicSelectedNumber}</span></p>
                    </div>
                    <Button onClick={handleClassicNext}>
                      Avanti <ArrowLeft className="h-4 w-4 ml-2 rotate-180" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Form */}
            {kycStep === "form" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Numero: <span className="font-mono">{classicSelectedNumber}</span></p>
                  <Button variant="ghost" size="sm" className="ml-auto text-xs" onClick={() => setKycStep("search")}>
                    Cambia
                  </Button>
                </div>

                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    Dati Aziendali
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FormField label="Ragione Sociale *" field="business_name" placeholder="Mario Rossi / Rossi SRL" />
                    <FormField label="Codice Fiscale *" field="fiscal_code" placeholder="RSSMRA85M01H501Z" />
                    <FormField label="P.IVA (opzionale)" field="vat_number" placeholder="01234567890" />
                    <FormField label="Email *" field="contact_email" placeholder="info@azienda.it" />
                    <FormField label="Indirizzo Legale *" field="legal_address" placeholder="Via Roma 1" />
                    <FormField label="Citta *" field="city" placeholder="Roma" />
                    <FormField label="Provincia" field="province" placeholder="RM" />
                    <FormField label="CAP *" field="postal_code" placeholder="00100" />
                    <FormField label="Telefono" field="contact_phone" placeholder="+39 333 1234567" />
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" onClick={() => setKycStep("search")}>
                    <ArrowLeft className="h-4 w-4 mr-1" /> Indietro
                  </Button>
                  <Button
                    onClick={handleClassicCreateRequest}
                    disabled={createRequestMutation.isPending}
                  >
                    {createRequestMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Avanti: Carica Documenti
                  </Button>
                </div>
              </div>
            )}

            {/* STEP 3: Documents */}
            {kycStep === "documents" && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <Phone className="h-4 w-4 text-primary" />
                  <p className="text-sm font-medium">Numero: <span className="font-mono">{classicSelectedNumber}</span></p>
                </div>

                {(() => {
                  const requiredDocTypes = DOCUMENT_TYPES.filter(d => d.required);
                  const uploadedRequiredCount = requiredDocTypes.filter(dt =>
                    classicDocs.some(d => d.document_type === dt.type && d.status !== "rejected")
                  ).length;
                  const allRequiredUploaded = uploadedRequiredCount === requiredDocTypes.length;

                  return (
                    <>
                      <div>
                        <h3 className="font-medium mb-3 flex items-center gap-2">
                          <Upload className="h-4 w-4" />
                          Documenti ({uploadedRequiredCount}/{requiredDocTypes.length} obbligatori)
                        </h3>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {DOCUMENT_TYPES.map((docType) => {
                            const doc = classicDocs.find(d => d.document_type === docType.type);
                            return (
                              <Card key={docType.type} className={doc ? "border-green-200 dark:border-green-800" : ""}>
                                <CardContent className="pt-4 pb-3">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium truncate">{docType.label}</p>
                                      {doc ? (
                                        <div className="flex items-center gap-2 mt-1">
                                          <Badge className={`${DOC_STATUS_COLORS[doc.status] || "bg-gray-500"} text-[10px]`}>
                                            Caricato
                                          </Badge>
                                          <span className="text-xs text-muted-foreground truncate">{doc.file_name}</span>
                                        </div>
                                      ) : (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {docType.required ? "Richiesto" : "Opzionale"}
                                        </p>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {!doc ? (
                                        <label className="cursor-pointer">
                                          <input
                                            type="file"
                                            className="hidden"
                                            accept="image/jpeg,image/png,application/pdf"
                                            ref={(el) => { classicFileInputRefs.current[docType.type] = el; }}
                                            disabled={uploadClassicDocMutation.isPending}
                                            onChange={(e) => {
                                              const file = e.target.files?.[0];
                                              if (file) uploadClassicDocMutation.mutate({ file, documentType: docType.type });
                                              e.target.value = "";
                                            }}
                                          />
                                          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                                            {uploadClassicDocMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                                            Carica
                                          </div>
                                        </label>
                                      ) : (
                                        <Button
                                          variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                                          onClick={() => setClassicDocs(prev => prev.filter(d => d.document_type !== docType.type))}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3 pt-2 items-center">
                        <Button
                          onClick={() => submitClassicKycMutation.mutate()}
                          disabled={submitClassicKycMutation.isPending || !allRequiredUploaded}
                        >
                          {submitClassicKycMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                          Invia Richiesta KYC
                        </Button>
                        {!allRequiredUploaded && (
                          <p className="text-xs text-muted-foreground">
                            Carica tutti i documenti obbligatori per procedere
                          </p>
                        )}
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

          </CardContent>
        </Card>
      </div>
    );
  }

  return null;

  function renderKycForm(num: ConsultantNumber) {
    const documents = num.documents || [];
    const requiredDocTypes = DOCUMENT_TYPES.filter(d => d.required);
    const uploadedRequiredCount = requiredDocTypes.filter(dt =>
      documents.some(d => d.document_type === dt.type && d.status !== "rejected")
    ).length;
    const allRequiredUploaded = uploadedRequiredCount === requiredDocTypes.length;

    return (
      <div className="space-y-6">
        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Dati Aziendali
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Ragione Sociale *" field="business_name" placeholder="Mario Rossi / Rossi SRL" />
            <FormField label="Codice Fiscale *" field="fiscal_code" placeholder="RSSMRA85M01H501Z" />
            <FormField label="P.IVA (opzionale)" field="vat_number" placeholder="01234567890" />
            <FormField label="Email *" field="contact_email" placeholder="info@azienda.it" />
            <FormField label="Indirizzo Legale *" field="legal_address" placeholder="Via Roma 1" />
            <FormField label="Citta *" field="city" placeholder="Roma" />
            <FormField label="Provincia" field="province" placeholder="RM" />
            <FormField label="CAP *" field="postal_code" placeholder="00100" />
            <FormField label="Telefono" field="contact_phone" placeholder="+39 333 1234567" />
          </div>
        </div>

        <div>
          <h3 className="font-medium mb-3 flex items-center gap-2">
            <Upload className="h-4 w-4" />
            Documenti ({uploadedRequiredCount}/{requiredDocTypes.length} obbligatori)
          </h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {DOCUMENT_TYPES.map((docType) => {
              const doc = documents.find(d => d.document_type === docType.type);
              return (
                <Card key={docType.type} className={doc ? "border-green-200 dark:border-green-800" : ""}>
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
                        {doc && doc.status === "uploaded" ? (
                          <Button
                            variant="ghost" size="icon" className="h-8 w-8 text-red-500"
                            onClick={() => deleteDocMutation.mutate(doc.id)}
                            disabled={deleteDocMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : !doc ? (
                          <label className="cursor-pointer">
                            <input
                              type="file"
                              className="hidden"
                              accept="image/jpeg,image/png,application/pdf"
                              ref={(el) => { fileInputRefs.current[docType.type] = el; }}
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) uploadDocMutation.mutate({ file, documentType: docType.type });
                                e.target.value = "";
                              }}
                            />
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors">
                              <Upload className="h-3.5 w-3.5" />
                              Carica
                            </div>
                          </label>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button
            onClick={handleSubmitKyc}
            disabled={submitKycMutation.isPending || !allRequiredUploaded}
            className="flex-1 sm:flex-none"
          >
            {submitKycMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
            Invia Documentazione KYC
          </Button>
          {!allRequiredUploaded && (
            <p className="text-xs text-muted-foreground self-center">
              Carica tutti i documenti obbligatori prima di inviare
            </p>
          )}
        </div>
      </div>
    );
  }

  function FormField({ label, field, placeholder }: { label: string; field: string; placeholder: string }) {
    const value = (formData as any)[field] || "";
    const error = formErrors[field];
    return (
      <div>
        <Label className={error ? "text-red-500" : ""}>{label}</Label>
        <Input
          value={value}
          onChange={(e) => {
            setFormData(prev => ({ ...prev, [field]: e.target.value }));
            if (formErrors[field]) setFormErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
          }}
          placeholder={placeholder}
          className={error ? "border-red-500 focus-visible:ring-red-500" : ""}
        />
        {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
      </div>
    );
  }
}
