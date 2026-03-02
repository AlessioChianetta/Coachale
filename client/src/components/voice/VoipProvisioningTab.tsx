import { useState, useRef } from "react";
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
  ArrowLeft, Loader2, AlertCircle, Trash2,
  Shield, RefreshCw, AlertTriangle, Timer, Package, FileText,
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

type FlowMode = "choose" | "inventory" | "kyc-classic";

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
  const [selectedPrefix, setSelectedPrefix] = useState("");
  const [searchedNumbers, setSearchedNumbers] = useState<AvailableNumber[]>([]);
  const [telnyxNumbers, setTelnyxNumbers] = useState<TelnyxNumber[]>([]);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const searchInventoryMutation = useMutation({
    mutationFn: async (prefix: string) => {
      const res = await fetch(`/api/voice/voip-provisioning/available-numbers?prefix=${encodeURIComponent(prefix)}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore nel caricamento dei numeri disponibili");
      return res.json();
    },
    onSuccess: (data) => {
      setSearchedNumbers(data.numbers || []);
      setSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

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
      setSelectedNumber(null);
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
        body: JSON.stringify({ phone_number: phoneNumber, prefix: selectedPrefix }),
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
      setSearchedNumbers([]);
      setSelectedNumber(null);
    },
    onError: (err: Error) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

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

  const classicKycMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/voice/voip-provisioning/submit-kyc", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          phone_number: selectedNumber,
          provider: "telnyx",
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Errore invio richiesta KYC");
      }
      return data;
    },
    onSuccess: () => {
      toast({ title: "Richiesta Inviata", description: "La tua richiesta KYC e il numero selezionato sono in fase di approvazione." });
      queryClient.invalidateQueries({ queryKey: ["/api/voice/voip-provisioning/my-number"] });
      setFlowMode("choose");
      setSelectedNumber(null);
      setTelnyxNumbers([]);
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

  const handleClassicKycSubmit = () => {
    if (!validateForm()) {
      toast({ title: "Dati non validi", description: "Controlla i campi evidenziati in rosso", variant: "destructive" });
      return;
    }
    if (!selectedNumber) {
      toast({ title: "Errore", description: "Seleziona prima un numero", variant: "destructive" });
      return;
    }
    classicKycMutation.mutate();
  };

  const hasNumber = myNumberData?.hasNumber;
  const number: ConsultantNumber | null = myNumberData?.number || null;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

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
            onClick={() => setFlowMode("inventory")}
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
            onClick={() => setFlowMode("kyc-classic")}
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

  if (flowMode === "inventory") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setFlowMode("choose"); setSearchedNumbers([]); setSelectedNumber(null); }}>
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
            <div className="flex gap-3 items-end flex-wrap">
              <div className="flex-1 min-w-[200px]">
                <Label>Filtra per prefisso</Label>
                <Select value={selectedPrefix} onValueChange={setSelectedPrefix}>
                  <SelectTrigger>
                    <SelectValue placeholder="Tutti i prefissi" />
                  </SelectTrigger>
                  <SelectContent>
                    {ITALIAN_PREFIXES.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => searchInventoryMutation.mutate(selectedPrefix)}
                disabled={searchInventoryMutation.isPending}
              >
                {searchInventoryMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Mostra Numeri
              </Button>
            </div>

            {searchedNumbers.length > 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">{searchedNumbers.length} numeri disponibili</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto">
                  {searchedNumbers.map((num) => {
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
            )}

            {searchInventoryMutation.isSuccess && searchedNumbers.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <AlertCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="font-medium">Nessun numero disponibile per questo prefisso</p>
                <p className="text-sm mt-1">Contatta l'amministratore per richiederne uno, oppure prova il percorso "Richiedi Nuovo Numero".</p>
                <Button variant="outline" className="mt-3" onClick={() => setFlowMode("kyc-classic")}>
                  <FileText className="h-4 w-4 mr-2" />
                  Richiedi con KYC
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (flowMode === "kyc-classic") {
    return (
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => { setFlowMode("choose"); setTelnyxNumbers([]); setSelectedNumber(null); setFormErrors({}); }}>
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
            <div>
              <h3 className="font-medium mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                1. Cerca Numero
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
            </div>

            {selectedNumber && (
              <>
                <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-lg">
                  <Phone className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <p className="font-medium">Numero selezionato: <span className="font-mono">{selectedNumber}</span></p>
                    <p className="text-xs text-muted-foreground">Compila i dati sotto e invia la richiesta KYC per attivare questo numero.</p>
                  </div>
                </div>

                <div>
                  <h3 className="font-medium mb-3 flex items-center gap-2">
                    <Shield className="h-4 w-4" />
                    2. Dati Aziendali
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
                  <Button
                    onClick={handleClassicKycSubmit}
                    disabled={classicKycMutation.isPending}
                    className="flex-1 sm:flex-none"
                  >
                    {classicKycMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Shield className="h-4 w-4 mr-2" />}
                    Invia Richiesta KYC
                  </Button>
                  <p className="text-xs text-muted-foreground self-center">
                    Il numero sara attivato dopo l'approvazione (1-5 giorni lavorativi)
                  </p>
                </div>
              </>
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
