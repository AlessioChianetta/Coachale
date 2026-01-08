import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import {
  Mail,
  Inbox,
  Star,
  StarOff,
  Plus,
  Server,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Sparkles,
  Send,
  Edit,
  Trash2,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronUp,
  Check,
  X,
  Users,
  FileText,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

interface EmailAccount {
  id: string;
  displayName: string;
  emailAddress: string;
  provider: string;
  imapHost?: string;
  imapPort?: number;
  imapTls?: boolean;
  smtpHost?: string;
  smtpPort?: number;
  smtpTls?: boolean;
  autoReplyMode: "off" | "review" | "auto";
  confidenceThreshold: number;
  aiTone: "formal" | "friendly" | "professional";
  signature?: string;
  syncStatus?: "syncing" | "synced" | "error" | "idle";
  lastSyncAt?: string;
  unreadCount?: number;
  createdAt: string;
}

interface Email {
  id: string;
  accountId: string;
  messageId: string;
  fromEmail: string;
  fromName?: string;
  toEmail: string;
  subject: string;
  snippet?: string;
  bodyHtml?: string;
  bodyText?: string;
  receivedAt: string;
  isRead: boolean;
  isStarred: boolean;
  processingStatus: "new" | "processing" | "classified" | "draft_generated" | "sent";
  urgency?: "low" | "medium" | "high" | "urgent";
  classification?: string;
}

interface AIResponse {
  id: string;
  emailId: string;
  draftSubject: string;
  draftBodyHtml?: string;
  draftBodyText?: string;
  confidence: number;
  status: "draft" | "approved" | "edited" | "rejected" | "sent";
  createdAt: string;
  originalEmail?: Email;
}

interface AccountFormData {
  displayName: string;
  emailAddress: string;
  imapHost: string;
  imapPort: number;
  imapUser: string;
  imapPassword: string;
  imapTls: boolean;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpTls: boolean;
  autoReplyMode: "off" | "review" | "auto";
  confidenceThreshold: number;
  aiTone: "formal" | "friendly" | "professional";
  signature: string;
}

type InboxFilter = {
  accountId: string | null;
  readStatus: "all" | "read" | "unread";
  starred: boolean;
  processingStatus: string | null;
};

const defaultFormData: AccountFormData = {
  displayName: "",
  emailAddress: "",
  imapHost: "",
  imapPort: 993,
  imapUser: "",
  imapPassword: "",
  imapTls: true,
  smtpHost: "",
  smtpPort: 587,
  smtpUser: "",
  smtpPassword: "",
  smtpTls: true,
  autoReplyMode: "review",
  confidenceThreshold: 0.8,
  aiTone: "professional",
  signature: "",
};

export default function ConsultantEmailHub() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("inbox");
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showEmailSheet, setShowEmailSheet] = useState(false);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<AIResponse | null>(null);
  const [editedDraftContent, setEditedDraftContent] = useState("");
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>({
    accountId: null,
    readStatus: "all",
    starred: false,
    processingStatus: null,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: accountsData, isLoading: isLoadingAccounts } = useQuery({
    queryKey: ["/api/email-hub/accounts"],
    queryFn: async () => {
      const response = await fetch("/api/email-hub/accounts", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch accounts");
      return response.json();
    },
  });

  const accounts: EmailAccount[] = accountsData?.data || [];

  const buildInboxQueryParams = () => {
    const params = new URLSearchParams();
    if (inboxFilter.accountId) params.set("accountId", inboxFilter.accountId);
    if (inboxFilter.readStatus === "unread") params.set("unread", "true");
    if (inboxFilter.readStatus === "read") params.set("read", "true");
    if (inboxFilter.starred) params.set("starred", "true");
    if (inboxFilter.processingStatus) params.set("status", inboxFilter.processingStatus);
    return params.toString();
  };

  const { data: inboxData, isLoading: isLoadingInbox, refetch: refetchInbox } = useQuery({
    queryKey: ["/api/email-hub/inbox", inboxFilter],
    queryFn: async () => {
      const queryString = buildInboxQueryParams();
      const response = await fetch(`/api/email-hub/inbox?${queryString}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch inbox");
      return response.json();
    },
  });

  const emails: Email[] = inboxData?.data || [];

  const { data: pendingDraftsData, isLoading: isLoadingDrafts, refetch: refetchDrafts } = useQuery({
    queryKey: ["/api/email-hub/ai-drafts/pending"],
    queryFn: async () => {
      const response = await fetch("/api/email-hub/ai-drafts/pending", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch pending drafts");
      return response.json();
    },
  });

  const pendingDrafts: AIResponse[] = pendingDraftsData?.data || [];

  const { data: emailDetailData } = useQuery({
    queryKey: ["/api/email-hub/emails", selectedEmail?.id],
    queryFn: async () => {
      if (!selectedEmail?.id) return null;
      const response = await fetch(`/api/email-hub/emails/${selectedEmail.id}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch email details");
      return response.json();
    },
    enabled: !!selectedEmail?.id,
  });

  const { data: emailAIResponsesData } = useQuery({
    queryKey: ["/api/email-hub/emails", selectedEmail?.id, "ai-responses"],
    queryFn: async () => {
      if (!selectedEmail?.id) return null;
      const response = await fetch(`/api/email-hub/emails/${selectedEmail.id}/ai-responses`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI responses");
      return response.json();
    },
    enabled: !!selectedEmail?.id,
  });

  const emailAIResponses: AIResponse[] = emailAIResponsesData?.data || [];

  const createAccountMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const response = await fetch("/api/email-hub/accounts", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to create account");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      setShowAccountDialog(false);
      setFormData(defaultFormData);
      toast({ title: "Successo", description: "Account email aggiunto con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const updateAccountMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: AccountFormData }) => {
      const response = await fetch(`/api/email-hub/accounts/${id}`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to update account");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      setShowAccountDialog(false);
      setEditingAccount(null);
      setFormData(defaultFormData);
      toast({ title: "Successo", description: "Account aggiornato con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/email-hub/accounts/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete account");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      toast({ title: "Eliminato", description: "Account rimosso con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const response = await fetch("/api/email-hub/accounts/test", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Connection test failed");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Connessione riuscita", description: "Le credenziali sono valide" });
    },
    onError: (error: any) => {
      toast({ title: "Connessione fallita", description: error.message, variant: "destructive" });
    },
  });

  const markAsReadMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/read`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
    },
  });

  const toggleStarMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/star`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle star");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
    },
  });

  const generateAIResponseMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/ai-responses`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate AI response");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmail?.id, "ai-responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      toast({ title: "Risposta generata", description: "La bozza AI è pronta per la revisione" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const approveDraftMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/approve`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to approve draft");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      toast({ title: "Approvato", description: "Bozza approvata con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const editDraftMutation = useMutation({
    mutationFn: async ({ responseId, content }: { responseId: string; content: string }) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/edit`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ draftBodyHtml: content, draftBodyText: content }),
      });
      if (!response.ok) throw new Error("Failed to edit draft");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      setEditingDraft(null);
      setEditedDraftContent("");
      toast({ title: "Salvato", description: "Modifiche salvate" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const rejectDraftMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/reject`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to reject draft");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      toast({ title: "Rifiutato", description: "Bozza rifiutata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const sendDraftMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/send`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      toast({ title: "Inviato", description: "Email inviata con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore invio", description: error.message, variant: "destructive" });
    },
  });

  const handleInputChange = (field: keyof AccountFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleOpenAddAccount = () => {
    setEditingAccount(null);
    setFormData(defaultFormData);
    setShowAccountDialog(true);
  };

  const handleOpenEditAccount = (account: EmailAccount) => {
    setEditingAccount(account);
    setFormData({
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      imapHost: account.imapHost || "",
      imapPort: account.imapPort || 993,
      imapUser: account.emailAddress,
      imapPassword: "",
      imapTls: account.imapTls ?? true,
      smtpHost: account.smtpHost || "",
      smtpPort: account.smtpPort || 587,
      smtpUser: account.emailAddress,
      smtpPassword: "",
      smtpTls: account.smtpTls ?? true,
      autoReplyMode: account.autoReplyMode,
      confidenceThreshold: account.confidenceThreshold,
      aiTone: account.aiTone,
      signature: account.signature || "",
    });
    setShowAccountDialog(true);
  };

  const handleSaveAccount = () => {
    if (editingAccount) {
      updateAccountMutation.mutate({ id: editingAccount.id, data: formData });
    } else {
      createAccountMutation.mutate(formData);
    }
  };

  const handleEmailClick = (email: Email) => {
    setSelectedEmail(email);
    setShowEmailSheet(true);
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const getSyncStatusBadge = (status?: string) => {
    const config: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
      syncing: { color: "bg-blue-100 text-blue-700", label: "Sincronizzazione", icon: <RefreshCw className="h-3 w-3 animate-spin" /> },
      synced: { color: "bg-green-100 text-green-700", label: "Sincronizzato", icon: <CheckCircle className="h-3 w-3" /> },
      error: { color: "bg-red-100 text-red-700", label: "Errore", icon: <XCircle className="h-3 w-3" /> },
      idle: { color: "bg-gray-100 text-gray-700", label: "In attesa", icon: <Clock className="h-3 w-3" /> },
    };
    const cfg = config[status || "idle"] || config.idle;
    return (
      <Badge className={`${cfg.color} flex items-center gap-1`}>
        {cfg.icon}
        {cfg.label}
      </Badge>
    );
  };

  const getProcessingStatusBadge = (status: Email["processingStatus"]) => {
    const config: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-100 text-blue-700", label: "Nuovo" },
      processing: { color: "bg-yellow-100 text-yellow-700", label: "Elaborazione" },
      classified: { color: "bg-purple-100 text-purple-700", label: "Classificato" },
      draft_generated: { color: "bg-green-100 text-green-700", label: "Bozza AI" },
      sent: { color: "bg-gray-100 text-gray-700", label: "Risposto" },
    };
    const cfg = config[status] || config.new;
    return <Badge className={cfg.color}>{cfg.label}</Badge>;
  };

  const getUrgencyBadge = (urgency?: string) => {
    if (!urgency) return null;
    const config: Record<string, string> = {
      low: "bg-gray-100 text-gray-600",
      medium: "bg-yellow-100 text-yellow-700",
      high: "bg-orange-100 text-orange-700",
      urgent: "bg-red-100 text-red-700",
    };
    return <Badge className={config[urgency] || config.low}>{urgency}</Badge>;
  };

  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    let color = "bg-red-100 text-red-700";
    if (pct >= 80) color = "bg-green-100 text-green-700";
    else if (pct >= 60) color = "bg-yellow-100 text-yellow-700";
    return <Badge className={color}>{pct}% confidenza</Badge>;
  };

  const renderAccountsTab = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Account Email Collegati</h2>
          <p className="text-sm text-muted-foreground">Gestisci gli account email per la posta unificata</p>
        </div>
        <Button onClick={handleOpenAddAccount} className="gap-2">
          <Plus className="h-4 w-4" />
          Aggiungi Account
        </Button>
      </div>

      {isLoadingAccounts ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : accounts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessun account collegato</h3>
            <p className="text-sm text-muted-foreground mb-4">Aggiungi il tuo primo account email per iniziare</p>
            <Button onClick={handleOpenAddAccount} className="gap-2">
              <Plus className="h-4 w-4" />
              Aggiungi Account
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {accounts.map((account) => (
            <Card key={account.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{account.displayName}</CardTitle>
                      <CardDescription className="text-xs">{account.emailAddress}</CardDescription>
                    </div>
                  </div>
                  {getSyncStatusBadge(account.syncStatus)}
                </div>
              </CardHeader>
              <CardContent className="pb-3">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Provider</span>
                    <span className="font-medium">{account.provider || "IMAP/SMTP"}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Modalità AI</span>
                    <Badge variant="outline">
                      {account.autoReplyMode === "auto" ? "Automatico" : account.autoReplyMode === "review" ? "Revisione" : "Disattivato"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">Non letti</span>
                    <Badge variant={account.unreadCount ? "destructive" : "secondary"}>
                      {account.unreadCount || 0}
                    </Badge>
                  </div>
                  {account.lastSyncAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Ultima sync</span>
                      <span className="text-xs">{format(new Date(account.lastSyncAt), "dd/MM HH:mm")}</span>
                    </div>
                  )}
                </div>
              </CardContent>
              <CardFooter className="pt-0 gap-2">
                <Button variant="outline" size="sm" className="flex-1" onClick={() => handleOpenEditAccount(account)}>
                  <Edit className="h-4 w-4 mr-1" />
                  Modifica
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => {
                    if (confirm("Sei sicuro di voler eliminare questo account?")) {
                      deleteAccountMutation.mutate(account.id);
                    }
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderInboxTab = () => (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Account:</Label>
          <Select
            value={inboxFilter.accountId || "all"}
            onValueChange={(val) => setInboxFilter((prev) => ({ ...prev, accountId: val === "all" ? null : val }))}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Tutti gli account" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli account</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.id} value={acc.id}>{acc.displayName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Stato:</Label>
          <Select
            value={inboxFilter.readStatus}
            onValueChange={(val: any) => setInboxFilter((prev) => ({ ...prev, readStatus: val }))}
          >
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="unread">Non letti</SelectItem>
              <SelectItem value="read">Letti</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            id="starred-filter"
            checked={inboxFilter.starred}
            onCheckedChange={(checked) => setInboxFilter((prev) => ({ ...prev, starred: checked }))}
          />
          <Label htmlFor="starred-filter" className="text-sm">Solo con stella</Label>
        </div>

        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Elaborazione:</Label>
          <Select
            value={inboxFilter.processingStatus || "all"}
            onValueChange={(val) => setInboxFilter((prev) => ({ ...prev, processingStatus: val === "all" ? null : val }))}
          >
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Tutti" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti</SelectItem>
              <SelectItem value="new">Nuovo</SelectItem>
              <SelectItem value="processing">In elaborazione</SelectItem>
              <SelectItem value="classified">Classificato</SelectItem>
              <SelectItem value="draft_generated">Bozza pronta</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button variant="outline" size="sm" onClick={() => refetchInbox()} className="ml-auto gap-2">
          <RefreshCw className="h-4 w-4" />
          Aggiorna
        </Button>
      </div>

      {isLoadingInbox ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : emails.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Inbox className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessuna email trovata</h3>
            <p className="text-sm text-muted-foreground">Le email appariranno qui una volta sincronizzate</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg divide-y">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                !email.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
              }`}
              onClick={() => handleEmailClick(email)}
            >
              <div className="flex items-start gap-3">
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleStarMutation.mutate(email.id);
                  }}
                >
                  {email.isStarred ? (
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </Button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-medium truncate ${!email.isRead ? "font-bold" : ""}`}>
                      {email.fromName || email.fromEmail}
                    </span>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(email.receivedAt), "dd/MM/yyyy HH:mm")}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1 ${!email.isRead ? "font-semibold" : ""}`}>
                    {email.subject || "(Nessun oggetto)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-2">{email.snippet}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    {getProcessingStatusBadge(email.processingStatus)}
                    {getUrgencyBadge(email.urgency)}
                    {email.processingStatus === "draft_generated" && (
                      <Badge variant="outline" className="gap-1">
                        <Sparkles className="h-3 w-3" />
                        Bozza AI
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderAIDraftsTab = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Bozze AI in Attesa</h2>
          <p className="text-sm text-muted-foreground">Rivedi e approva le risposte generate dall'AI</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetchDrafts()} className="gap-2">
          <RefreshCw className="h-4 w-4" />
          Aggiorna
        </Button>
      </div>

      {isLoadingDrafts ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pendingDrafts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Nessuna bozza in attesa</h3>
            <p className="text-sm text-muted-foreground">Le bozze AI da approvare appariranno qui</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingDrafts.map((draft) => (
            <Card key={draft.id}>
              <Collapsible
                open={expandedDraftId === draft.id}
                onOpenChange={(open) => setExpandedDraftId(open ? draft.id : null)}
              >
                <CollapsibleTrigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <CardTitle className="text-base">{draft.draftSubject}</CardTitle>
                          {getConfidenceBadge(draft.confidence)}
                        </div>
                        {draft.originalEmail && (
                          <CardDescription>
                            Da: {draft.originalEmail.fromName || draft.originalEmail.fromEmail} • 
                            {format(new Date(draft.createdAt), " dd/MM/yyyy HH:mm")}
                          </CardDescription>
                        )}
                      </div>
                      <Button variant="ghost" size="icon">
                        {expandedDraftId === draft.id ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </CardHeader>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <Separator className="mb-4" />
                    
                    {draft.originalEmail && (
                      <div className="mb-4 p-3 bg-muted/50 rounded-lg">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                          <Mail className="h-4 w-4" />
                          Email Originale
                        </h4>
                        <p className="text-sm font-medium">{draft.originalEmail.subject}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {draft.originalEmail.snippet}
                        </p>
                      </div>
                    )}

                    <div className="mb-4">
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <Sparkles className="h-4 w-4" />
                        Risposta AI Generata
                      </h4>
                      {editingDraft?.id === draft.id ? (
                        <Textarea
                          value={editedDraftContent}
                          onChange={(e) => setEditedDraftContent(e.target.value)}
                          rows={8}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <div className="p-3 bg-background border rounded-lg text-sm whitespace-pre-wrap">
                          {draft.draftBodyText || draft.draftBodyHtml}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {editingDraft?.id === draft.id ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => editDraftMutation.mutate({ responseId: draft.id, content: editedDraftContent })}
                            disabled={editDraftMutation.isPending}
                          >
                            {editDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            Salva
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingDraft(null);
                              setEditedDraftContent("");
                            }}
                          >
                            <X className="h-4 w-4 mr-1" />
                            Annulla
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="sm"
                            variant="default"
                            onClick={() => approveDraftMutation.mutate(draft.id)}
                            disabled={approveDraftMutation.isPending}
                          >
                            {approveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                            Approva
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingDraft(draft);
                              setEditedDraftContent(draft.draftBodyText || draft.draftBodyHtml || "");
                            }}
                          >
                            <Edit className="h-4 w-4 mr-1" />
                            Modifica
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:text-destructive"
                            onClick={() => rejectDraftMutation.mutate(draft.id)}
                            disabled={rejectDraftMutation.isPending}
                          >
                            {rejectDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <X className="h-4 w-4 mr-1" />}
                            Rifiuta
                          </Button>
                          {draft.status === "approved" && (
                            <Button
                              size="sm"
                              variant="secondary"
                              className="ml-auto"
                              onClick={() => sendDraftMutation.mutate(draft.id)}
                              disabled={sendDraftMutation.isPending}
                            >
                              {sendDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Send className="h-4 w-4 mr-1" />}
                              Invia
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          ))}
        </div>
      )}
    </div>
  );

  const renderAccountDialog = () => (
    <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {editingAccount ? "Modifica Account" : "Aggiungi Account Email"}
          </DialogTitle>
          <DialogDescription>
            Configura le impostazioni IMAP e SMTP per collegare il tuo account email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Users className="h-4 w-4" />
              Informazioni Account
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome visualizzato</Label>
                <Input
                  id="displayName"
                  placeholder="Es. Email Lavoro"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange("displayName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailAddress">Indirizzo email</Label>
                <Input
                  id="emailAddress"
                  type="email"
                  placeholder="nome@esempio.com"
                  value={formData.emailAddress}
                  onChange={(e) => handleInputChange("emailAddress", e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Server className="h-4 w-4" />
              Configurazione IMAP (Ricezione)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="imapHost">Host IMAP</Label>
                <Input
                  id="imapHost"
                  placeholder="imap.gmail.com"
                  value={formData.imapHost}
                  onChange={(e) => handleInputChange("imapHost", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapPort">Porta</Label>
                <Input
                  id="imapPort"
                  type="number"
                  value={formData.imapPort}
                  onChange={(e) => handleInputChange("imapPort", parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapUser">Username</Label>
                <Input
                  id="imapUser"
                  placeholder="username@esempio.com"
                  value={formData.imapUser}
                  onChange={(e) => handleInputChange("imapUser", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="imapPassword">Password</Label>
                <div className="relative">
                  <Input
                    id="imapPassword"
                    type={showPassword ? "text" : "password"}
                    value={formData.imapPassword}
                    onChange={(e) => handleInputChange("imapPassword", e.target.value)}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="imapTls"
                checked={formData.imapTls}
                onCheckedChange={(checked) => handleInputChange("imapTls", checked)}
              />
              <Label htmlFor="imapTls">Usa SSL/TLS</Label>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Send className="h-4 w-4" />
              Configurazione SMTP (Invio)
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="smtpHost">Host SMTP</Label>
                <Input
                  id="smtpHost"
                  placeholder="smtp.gmail.com"
                  value={formData.smtpHost}
                  onChange={(e) => handleInputChange("smtpHost", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPort">Porta</Label>
                <Input
                  id="smtpPort"
                  type="number"
                  value={formData.smtpPort}
                  onChange={(e) => handleInputChange("smtpPort", parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpUser">Username</Label>
                <Input
                  id="smtpUser"
                  placeholder="username@esempio.com"
                  value={formData.smtpUser}
                  onChange={(e) => handleInputChange("smtpUser", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="smtpPassword">Password</Label>
                <Input
                  id="smtpPassword"
                  type={showPassword ? "text" : "password"}
                  value={formData.smtpPassword}
                  onChange={(e) => handleInputChange("smtpPassword", e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="smtpTls"
                checked={formData.smtpTls}
                onCheckedChange={(checked) => handleInputChange("smtpTls", checked)}
              />
              <Label htmlFor="smtpTls">Usa SSL/TLS</Label>
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <h4 className="font-medium flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Impostazioni AI
            </h4>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="autoReplyMode">Modalità risposta automatica</Label>
                <Select
                  value={formData.autoReplyMode}
                  onValueChange={(val: any) => handleInputChange("autoReplyMode", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="off">Disattivato</SelectItem>
                    <SelectItem value="review">Solo bozze (richiede approvazione)</SelectItem>
                    <SelectItem value="auto">Completamente automatico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Soglia di confidenza: {Math.round(formData.confidenceThreshold * 100)}%</Label>
                <Slider
                  value={[formData.confidenceThreshold * 100]}
                  onValueChange={(val) => handleInputChange("confidenceThreshold", val[0] / 100)}
                  min={50}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Risposte con confidenza inferiore richiederanno revisione manuale
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiTone">Tono delle risposte</Label>
                <Select
                  value={formData.aiTone}
                  onValueChange={(val: any) => handleInputChange("aiTone", val)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="formal">Formale</SelectItem>
                    <SelectItem value="friendly">Amichevole</SelectItem>
                    <SelectItem value="professional">Professionale</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="signature">Firma email</Label>
                <Textarea
                  id="signature"
                  placeholder="La tua firma..."
                  value={formData.signature}
                  onChange={(e) => handleInputChange("signature", e.target.value)}
                  rows={3}
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => setShowAccountDialog(false)}>
            Annulla
          </Button>
          <Button
            variant="secondary"
            onClick={() => testConnectionMutation.mutate(formData)}
            disabled={testConnectionMutation.isPending || !formData.imapHost || !formData.smtpHost}
          >
            {testConnectionMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Test in corso...
              </>
            ) : (
              <>
                <CheckCircle className="h-4 w-4 mr-2" />
                Testa Connessione
              </>
            )}
          </Button>
          <Button
            onClick={handleSaveAccount}
            disabled={createAccountMutation.isPending || updateAccountMutation.isPending}
          >
            {(createAccountMutation.isPending || updateAccountMutation.isPending) ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Salvataggio...
              </>
            ) : (
              <>
                <Check className="h-4 w-4 mr-2" />
                {editingAccount ? "Salva Modifiche" : "Aggiungi Account"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const renderEmailSheet = () => (
    <Sheet open={showEmailSheet} onOpenChange={setShowEmailSheet}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="pr-8">{selectedEmail?.subject || "(Nessun oggetto)"}</SheetTitle>
          <SheetDescription>
            Da: {selectedEmail?.fromName || selectedEmail?.fromEmail}
          </SheetDescription>
        </SheetHeader>

        {selectedEmail && (
          <div className="mt-6 space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
              {getProcessingStatusBadge(selectedEmail.processingStatus)}
              {getUrgencyBadge(selectedEmail.urgency)}
              <span className="text-sm text-muted-foreground ml-auto">
                {format(new Date(selectedEmail.receivedAt), "dd MMMM yyyy, HH:mm")}
              </span>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => toggleStarMutation.mutate(selectedEmail.id)}
              >
                {selectedEmail.isStarred ? (
                  <>
                    <Star className="h-4 w-4 mr-1 text-yellow-500 fill-yellow-500" />
                    Rimuovi stella
                  </>
                ) : (
                  <>
                    <StarOff className="h-4 w-4 mr-1" />
                    Aggiungi stella
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => markAsReadMutation.mutate(selectedEmail.id)}
              >
                <Eye className="h-4 w-4 mr-1" />
                Segna come {selectedEmail.isRead ? "non letto" : "letto"}
              </Button>
            </div>

            <Separator />

            <div>
              <h4 className="text-sm font-medium mb-3">Contenuto Email</h4>
              <div className="p-4 bg-muted/50 rounded-lg text-sm whitespace-pre-wrap">
                {emailDetailData?.data?.bodyText || emailDetailData?.data?.bodyHtml || selectedEmail.snippet || "Nessun contenuto disponibile"}
              </div>
            </div>

            <Separator />

            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  Risposte AI
                </h4>
                <Button
                  size="sm"
                  onClick={() => generateAIResponseMutation.mutate(selectedEmail.id)}
                  disabled={generateAIResponseMutation.isPending}
                >
                  {generateAIResponseMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1" />
                      Genera Risposta AI
                    </>
                  )}
                </Button>
              </div>

              {emailAIResponses.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nessuna risposta AI generata per questa email
                </p>
              ) : (
                <div className="space-y-3">
                  {emailAIResponses.map((resp) => (
                    <Card key={resp.id}>
                      <CardHeader className="pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm">{resp.draftSubject}</CardTitle>
                          <div className="flex items-center gap-2">
                            {getConfidenceBadge(resp.confidence)}
                            <Badge variant={resp.status === "sent" ? "default" : "outline"}>
                              {resp.status === "draft" ? "Bozza" :
                               resp.status === "approved" ? "Approvato" :
                               resp.status === "edited" ? "Modificato" :
                               resp.status === "rejected" ? "Rifiutato" : "Inviato"}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm whitespace-pre-wrap">
                          {resp.draftBodyText || resp.draftBodyHtml}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );

  if (isLoadingAccounts) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
          <p className="text-slate-600">Caricamento Email Hub...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar role="consultant" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 border-b bg-background/95 backdrop-blur">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                <Inbox className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Email Hub</h1>
                <p className="text-sm text-muted-foreground">Gestisci tutte le tue email con assistenza AI</p>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="grid w-full max-w-md grid-cols-3">
                <TabsTrigger value="accounts" className="gap-2">
                  <Users className="h-4 w-4" />
                  Account
                </TabsTrigger>
                <TabsTrigger value="inbox" className="gap-2">
                  <Inbox className="h-4 w-4" />
                  Inbox
                </TabsTrigger>
                <TabsTrigger value="drafts" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Bozze AI
                  {pendingDrafts.length > 0 && (
                    <Badge variant="destructive" className="ml-1 h-5 px-1.5">
                      {pendingDrafts.length}
                    </Badge>
                  )}
                </TabsTrigger>
              </TabsList>

              <TabsContent value="accounts">
                {renderAccountsTab()}
              </TabsContent>

              <TabsContent value="inbox">
                {renderInboxTab()}
              </TabsContent>

              <TabsContent value="drafts">
                {renderAIDraftsTab()}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {renderAccountDialog()}
      {renderEmailSheet()}
      <ConsultantAIAssistant />
    </div>
  );
}
