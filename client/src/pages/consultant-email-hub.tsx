import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
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
  ThumbsUp,
  ThumbsDown,
  Filter,
  RefreshCw,
  Settings,
  Trash2,
  Eye,
  EyeOff,
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
  urgency?: string;
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

type FilterType = "all" | "unread" | "starred" | "needs_review" | "new" | "processing" | "classified" | "draft_generated";

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
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [editingResponse, setEditingResponse] = useState<AIResponse | null>(null);
  const [editedContent, setEditedContent] = useState("");
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData);
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

  const buildInboxQuery = () => {
    const params = new URLSearchParams();
    if (selectedAccountId) params.set("accountId", selectedAccountId);
    if (filter === "unread") params.set("unread", "true");
    if (filter === "starred") params.set("starred", "true");
    if (filter === "needs_review") params.set("needsReview", "true");
    if (["new", "processing", "classified", "draft_generated"].includes(filter)) {
      params.set("status", filter);
    }
    return params.toString();
  };

  const { data: inboxData, isLoading: isLoadingInbox, refetch: refetchInbox } = useQuery({
    queryKey: ["/api/email-hub/inbox", selectedAccountId, filter],
    queryFn: async () => {
      const queryString = buildInboxQuery();
      const response = await fetch(`/api/email-hub/inbox?${queryString}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch inbox");
      return response.json();
    },
  });

  const emails: Email[] = inboxData?.data || [];

  const { data: emailDetailData, isLoading: isLoadingEmailDetail } = useQuery({
    queryKey: ["/api/email-hub/emails", selectedEmailId],
    queryFn: async () => {
      if (!selectedEmailId) return null;
      const response = await fetch(`/api/email-hub/emails/${selectedEmailId}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch email");
      return response.json();
    },
    enabled: !!selectedEmailId,
  });

  const selectedEmail: Email | null = emailDetailData?.data || null;

  const { data: aiResponsesData } = useQuery({
    queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"],
    queryFn: async () => {
      if (!selectedEmailId) return null;
      const response = await fetch(`/api/email-hub/emails/${selectedEmailId}/ai-responses`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI responses");
      return response.json();
    },
    enabled: !!selectedEmailId,
  });

  const aiResponses: AIResponse[] = aiResponsesData?.data || [];

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
      setShowAccountModal(false);
      setFormData(defaultFormData);
      toast({ title: "Successo", description: "Account email aggiunto con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
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
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId] });
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
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId] });
    },
  });

  const approveResponseMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/approve`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to approve response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"] });
      toast({ title: "Approvato", description: "Risposta AI approvata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const editResponseMutation = useMutation({
    mutationFn: async ({ responseId, content }: { responseId: string; content: string }) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/edit`, {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ draftBodyHtml: content, draftBodyText: content }),
      });
      if (!response.ok) throw new Error("Failed to edit response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"] });
      setEditingResponse(null);
      setEditedContent("");
      toast({ title: "Salvato", description: "Modifiche salvate" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const rejectResponseMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/reject`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to reject response");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"] });
      toast({ title: "Rifiutato", description: "Risposta AI rifiutata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (data: AccountFormData) => {
      const response = await fetch("/api/email-hub/accounts/test-connection", {
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

  const generateAIResponseMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/generate-response`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to generate response");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      toast({ title: "Risposta generata", description: "La bozza AI è pronta per la revisione" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const sendResponseMutation = useMutation({
    mutationFn: async (responseId: string) => {
      const response = await fetch(`/api/email-hub/ai-responses/${responseId}/send`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to send response");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId, "ai-responses"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      toast({ title: "Email inviata", description: "La risposta è stata inviata con successo" });
    },
    onError: (error: any) => {
      toast({ title: "Errore invio", description: error.message, variant: "destructive" });
    },
  });

  const toggleReadMutation = useMutation({
    mutationFn: async ({ emailId, isRead }: { emailId: string; isRead: boolean }) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/${isRead ? 'unread' : 'read'}`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle read status");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/emails", selectedEmailId] });
    },
  });

  const archiveEmailMutation = useMutation({
    mutationFn: async (emailId: string) => {
      const response = await fetch(`/api/email-hub/emails/${emailId}/archive`, {
        method: "PUT",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to archive email");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      setSelectedEmailId(null);
      toast({ title: "Archiviato", description: "Email archiviata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  useEffect(() => {
    if (selectedEmailId && selectedEmail && !selectedEmail.isRead) {
      markAsReadMutation.mutate(selectedEmailId);
    }
  }, [selectedEmailId, selectedEmail]);

  const handleInputChange = (field: keyof AccountFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateAccount = () => {
    createAccountMutation.mutate(formData);
  };

  const getStatusBadge = (status: Email["processingStatus"]) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      new: { color: "bg-blue-100 text-blue-700", label: "Nuovo" },
      processing: { color: "bg-yellow-100 text-yellow-700", label: "In elaborazione" },
      classified: { color: "bg-purple-100 text-purple-700", label: "Classificato" },
      draft_generated: { color: "bg-green-100 text-green-700", label: "Bozza pronta" },
      sent: { color: "bg-gray-100 text-gray-700", label: "Inviato" },
    };
    const config = statusConfig[status] || statusConfig.new;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const getAIResponseStatusBadge = (status: AIResponse["status"]) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      draft: { color: "bg-gray-100 text-gray-700", label: "Bozza" },
      approved: { color: "bg-green-100 text-green-700", label: "Approvato" },
      edited: { color: "bg-blue-100 text-blue-700", label: "Modificato" },
      rejected: { color: "bg-red-100 text-red-700", label: "Rifiutato" },
      sent: { color: "bg-emerald-100 text-emerald-700", label: "Inviato" },
    };
    const config = statusConfig[status] || statusConfig.draft;
    return <Badge className={config.color}>{config.label}</Badge>;
  };

  const renderLeftSidebar = () => (
    <div className="w-64 border-r bg-muted/30 flex flex-col h-full">
      <div className="p-4 border-b">
        <Button onClick={() => setShowAccountModal(true)} className="w-full gap-2">
          <Plus className="h-4 w-4" />
          Aggiungi Account
        </Button>
      </div>

      <div className="p-4 border-b">
        <h3 className="font-semibold text-sm mb-3 text-muted-foreground">ACCOUNT</h3>
        <ScrollArea className="h-40">
          <div className="space-y-1">
            <Button
              variant={selectedAccountId === null ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setSelectedAccountId(null)}
            >
              <Inbox className="h-4 w-4" />
              Tutti gli account
            </Button>
            {accounts.map((account) => (
              <Button
                key={account.id}
                variant={selectedAccountId === account.id ? "secondary" : "ghost"}
                className="w-full justify-start gap-2"
                onClick={() => setSelectedAccountId(account.id)}
              >
                <Mail className="h-4 w-4" />
                <span className="truncate flex-1 text-left">{account.displayName}</span>
                {account.unreadCount && account.unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-auto">
                    {account.unreadCount}
                  </Badge>
                )}
              </Button>
            ))}
          </div>
        </ScrollArea>
      </div>

      <div className="p-4 flex-1">
        <h3 className="font-semibold text-sm mb-3 text-muted-foreground">FILTRI</h3>
        <div className="space-y-1">
          {[
            { value: "all", label: "Tutti", icon: Inbox },
            { value: "unread", label: "Non letti", icon: Eye },
            { value: "starred", label: "Con stella", icon: Star },
            { value: "needs_review", label: "Da revisionare", icon: AlertCircle },
            { value: "new", label: "Nuovi", icon: Clock },
            { value: "processing", label: "In elaborazione", icon: Loader2 },
            { value: "classified", label: "Classificati", icon: CheckCircle },
            { value: "draft_generated", label: "Bozza pronta", icon: Sparkles },
          ].map(({ value, label, icon: Icon }) => (
            <Button
              key={value}
              variant={filter === value ? "secondary" : "ghost"}
              className="w-full justify-start gap-2"
              onClick={() => setFilter(value as FilterType)}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );

  const renderEmailList = () => (
    <ScrollArea className="h-full">
      {isLoadingInbox ? (
        <div className="flex items-center justify-center h-full p-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : emails.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
          <Mail className="h-12 w-12 mb-4" />
          <p className="text-lg font-medium">Nessuna email</p>
          <p className="text-sm">Le email appariranno qui una volta sincronizzate</p>
        </div>
      ) : (
        <div className="divide-y">
          {emails.map((email) => (
            <div
              key={email.id}
              className={`p-4 cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedEmailId === email.id ? "bg-muted" : ""
              } ${!email.isRead ? "bg-blue-50/50 dark:bg-blue-950/20" : ""}`}
              onClick={() => setSelectedEmailId(email.id)}
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
                      {format(new Date(email.receivedAt), "dd/MM HH:mm")}
                    </span>
                  </div>
                  <p className={`text-sm truncate mb-1 ${!email.isRead ? "font-semibold" : ""}`}>
                    {email.subject || "(Nessun oggetto)"}
                  </p>
                  <p className="text-xs text-muted-foreground truncate mb-2">
                    {email.snippet}
                  </p>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(email.processingStatus)}
                    {email.processingStatus === "draft_generated" && (
                      <Sparkles className="h-4 w-4 text-purple-500" title="Bozza AI disponibile" />
                    )}
                    {email.urgency && (
                      <Badge variant="outline" className="text-xs">
                        {email.urgency}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </ScrollArea>
  );

  const renderEmailDetail = () => {
    if (!selectedEmail) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-8 text-muted-foreground">
          <Mail className="h-16 w-16 mb-4" />
          <p className="text-lg font-medium">Seleziona un'email</p>
          <p className="text-sm">Clicca su un'email per visualizzarne i dettagli</p>
        </div>
      );
    }

    if (isLoadingEmailDetail) {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }

    return (
      <ScrollArea className="h-full">
        <div className="p-6">
          <div className="mb-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-xl font-bold mb-2">{selectedEmail.subject || "(Nessun oggetto)"}</h2>
                <div className="flex items-center gap-2">
                  {getStatusBadge(selectedEmail.processingStatus)}
                  {selectedEmail.urgency && (
                    <Badge variant="outline">{selectedEmail.urgency}</Badge>
                  )}
                  {selectedEmail.classification && (
                    <Badge variant="secondary">{selectedEmail.classification}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleStarMutation.mutate(selectedEmail.id)}
                  title={selectedEmail.isStarred ? "Rimuovi stella" : "Aggiungi stella"}
                >
                  {selectedEmail.isStarred ? (
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                  ) : (
                    <StarOff className="h-5 w-5 text-muted-foreground" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => toggleReadMutation.mutate({ emailId: selectedEmail.id, isRead: selectedEmail.isRead })}
                  title={selectedEmail.isRead ? "Segna come non letto" : "Segna come letto"}
                >
                  {selectedEmail.isRead ? (
                    <EyeOff className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <Eye className="h-5 w-5 text-blue-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => archiveEmailMutation.mutate(selectedEmail.id)}
                  title="Archivia"
                  disabled={archiveEmailMutation.isPending}
                >
                  <Trash2 className="h-5 w-5 text-muted-foreground" />
                </Button>
              </div>
            </div>

            <div className="space-y-2 text-sm mb-4 p-4 bg-muted/30 rounded-lg">
              <div className="flex">
                <span className="font-medium w-16">Da:</span>
                <span>{selectedEmail.fromName ? `${selectedEmail.fromName} <${selectedEmail.fromEmail}>` : selectedEmail.fromEmail}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-16">A:</span>
                <span>{selectedEmail.toEmail}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-16">Data:</span>
                <span>{format(new Date(selectedEmail.receivedAt), "dd MMMM yyyy, HH:mm")}</span>
              </div>
            </div>
          </div>

          <Separator className="my-6" />

          <div className="mb-6">
            <h3 className="font-semibold mb-3">Contenuto Email</h3>
            <div className="prose prose-sm max-w-none dark:prose-invert bg-white dark:bg-slate-900 p-4 rounded-lg border">
              {selectedEmail.bodyHtml ? (
                <div dangerouslySetInnerHTML={{ __html: selectedEmail.bodyHtml }} />
              ) : (
                <pre className="whitespace-pre-wrap font-sans">{selectedEmail.bodyText}</pre>
              )}
            </div>
          </div>

          <Separator className="my-6" />

          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-purple-500" />
                Risposta AI
              </h3>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={() => generateAIResponseMutation.mutate(selectedEmail.id)}
                disabled={generateAIResponseMutation.isPending}
              >
                {generateAIResponseMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Genera Risposta AI
              </Button>
            </div>
          </div>

          {aiResponses.length > 0 && (
            <>
              <Separator className="my-6" />
              <div>
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Risposte AI
                </h3>
                <div className="space-y-4">
                  {aiResponses.map((response) => (
                    <Card key={response.id}>
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <CardTitle className="text-sm">{response.draftSubject}</CardTitle>
                            {getAIResponseStatusBadge(response.status)}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Confidenza: {Math.round(response.confidence * 100)}%
                          </span>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {editingResponse?.id === response.id ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editedContent}
                              onChange={(e) => setEditedContent(e.target.value)}
                              rows={6}
                              className="font-mono text-sm"
                            />
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => editResponseMutation.mutate({ responseId: response.id, content: editedContent })}
                                disabled={editResponseMutation.isPending}
                              >
                                {editResponseMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salva"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  setEditingResponse(null);
                                  setEditedContent("");
                                }}
                              >
                                Annulla
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="bg-muted/30 p-3 rounded-lg mb-4 text-sm">
                              {response.draftBodyHtml ? (
                                <div dangerouslySetInnerHTML={{ __html: response.draftBodyHtml }} />
                              ) : (
                                <pre className="whitespace-pre-wrap font-sans">{response.draftBodyText}</pre>
                              )}
                            </div>
                            {response.status === "draft" && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1"
                                  onClick={() => approveResponseMutation.mutate(response.id)}
                                  disabled={approveResponseMutation.isPending}
                                >
                                  <ThumbsUp className="h-4 w-4" />
                                  Approva
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setEditingResponse(response);
                                    setEditedContent(response.draftBodyText || response.draftBodyHtml || "");
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                  Modifica
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  className="gap-1"
                                  onClick={() => rejectResponseMutation.mutate(response.id)}
                                  disabled={rejectResponseMutation.isPending}
                                >
                                  <ThumbsDown className="h-4 w-4" />
                                  Rifiuta
                                </Button>
                              </div>
                            )}
                            {(response.status === "approved" || response.status === "edited") && (
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="default"
                                  className="gap-1 bg-green-600 hover:bg-green-700"
                                  onClick={() => sendResponseMutation.mutate(response.id)}
                                  disabled={sendResponseMutation.isPending}
                                >
                                  {sendResponseMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                  Invia Risposta
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => {
                                    setEditingResponse(response);
                                    setEditedContent(response.draftBodyText || response.draftBodyHtml || "");
                                  }}
                                >
                                  <Edit className="h-4 w-4" />
                                  Modifica
                                </Button>
                              </div>
                            )}
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </ScrollArea>
    );
  };

  const renderAccountModal = () => (
    <Dialog open={showAccountModal} onOpenChange={setShowAccountModal}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Aggiungi Account Email
          </DialogTitle>
          <DialogDescription>
            Configura le impostazioni IMAP e SMTP per connettere il tuo account email
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-4">
            <h4 className="font-medium">Informazioni Account</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">Nome visualizzato</Label>
                <Input
                  id="displayName"
                  placeholder="Account Lavoro"
                  value={formData.displayName}
                  onChange={(e) => handleInputChange("displayName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emailAddress">Indirizzo Email</Label>
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
                    size="sm"
                    className="absolute right-1 top-1/2 -translate-y-1/2"
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
                  onValueChange={(value: any) => handleInputChange("autoReplyMode", value)}
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
                  onValueChange={(value) => handleInputChange("confidenceThreshold", value[0] / 100)}
                  min={50}
                  max={100}
                  step={5}
                />
                <p className="text-xs text-muted-foreground">
                  Le risposte con confidenza inferiore richiederanno sempre revisione manuale
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="aiTone">Tono delle risposte</Label>
                <Select
                  value={formData.aiTone}
                  onValueChange={(value: any) => handleInputChange("aiTone", value)}
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
          <Button variant="outline" onClick={() => setShowAccountModal(false)}>
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
          <Button onClick={handleCreateAccount} disabled={createAccountMutation.isPending}>
            {createAccountMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Creazione...
              </>
            ) : (
              <>
                <Plus className="h-4 w-4 mr-2" />
                Aggiungi Account
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
          <div className="p-4 border-b bg-background/95 backdrop-blur">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-gradient-to-r from-blue-500 to-indigo-500 rounded-xl">
                  <Inbox className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Email Hub</h1>
                  <p className="text-sm text-muted-foreground">Gestisci tutte le tue email con assistenza AI</p>
                </div>
              </div>
              <Button variant="outline" size="sm" onClick={() => refetchInbox()} className="gap-2">
                <RefreshCw className="h-4 w-4" />
                Aggiorna
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {!isMobile && renderLeftSidebar()}
            
            <div className="flex-1 overflow-hidden">
              {isMobile ? (
                selectedEmailId ? (
                  <div className="h-full flex flex-col">
                    <div className="p-2 border-b">
                      <Button variant="ghost" onClick={() => setSelectedEmailId(null)}>
                        ← Torna alla lista
                      </Button>
                    </div>
                    <div className="flex-1 overflow-hidden">
                      {renderEmailDetail()}
                    </div>
                  </div>
                ) : (
                  renderEmailList()
                )
              ) : (
                <ResizablePanelGroup direction="horizontal">
                  <ResizablePanel defaultSize={40} minSize={25}>
                    {renderEmailList()}
                  </ResizablePanel>
                  <ResizableHandle withHandle />
                  <ResizablePanel defaultSize={60} minSize={30}>
                    {renderEmailDetail()}
                  </ResizablePanel>
                </ResizablePanelGroup>
              )}
            </div>
          </div>
        </div>
      </div>

      {renderAccountModal()}
      <ConsultantAIAssistant />
    </div>
  );
}
