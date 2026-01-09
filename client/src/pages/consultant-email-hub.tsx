import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
  AlertTriangle,
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
  ChevronLeft,
  ChevronRight,
  Check,
  X,
  Users,
  FileText,
  Wifi,
  Search,
  Paperclip,
  Reply,
  Forward,
  MoreVertical,
  PenSquare,
  Archive,
  Download,
  ArrowRightLeft,
  Menu,
  Ticket,
  Webhook,
  BookOpen,
  Zap,
} from "lucide-react";
import { Link } from "wouter";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { ImportWizardDialog } from "@/components/email-hub/ImportWizardDialog";
import { EmailImportDialog } from "@/components/email-hub/EmailImportDialog";
import { EmailComposer } from "@/components/email-hub/EmailComposer";
import { EmailAISettings } from "@/components/email-hub/EmailAISettings";
import { TicketSettingsPanel } from "@/components/email-hub/TicketSettingsPanel";
import { TicketsList } from "@/components/email-hub/TicketsList";
import { AIEventsPanel } from "@/components/email-hub/AIEventsPanel";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { format } from "date-fns";

interface EmailAccount {
  id: string;
  displayName: string;
  emailAddress: string;
  provider: string;
  accountType?: "smtp_only" | "imap_only" | "full" | "hybrid";
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
  processingStatus: "new" | "processing" | "classified" | "draft_generated" | "sent" | "needs_review";
  urgency?: "low" | "medium" | "high" | "urgent";
  classification?: string;
  hasAttachments?: boolean;
}

interface AIResponse {
  id: string;
  emailId: string;
  draftSubject: string;
  draftBodyHtml?: string;
  draftBodyText?: string;
  confidence: number;
  status: "draft" | "approved" | "edited" | "rejected" | "sent" | "auto_sent" | "draft_needs_review";
  createdAt: string;
  originalEmail?: Email;
}

type AccountType = "smtp_only" | "imap_only" | "full" | "hybrid";

interface AccountFormData {
  displayName: string;
  emailAddress: string;
  accountType: AccountType;
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

type FolderType = "inbox" | "drafts" | "sent" | "trash" | "ai-drafts" | "starred";

const defaultFormData: AccountFormData = {
  displayName: "",
  emailAddress: "",
  accountType: "full",
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

const ACCOUNT_TYPE_OPTIONS = [
  { value: "full", label: "Completo", description: "Stesso provider per invio e ricezione" },
  { value: "smtp_only", label: "Solo invio", description: "Solo SMTP (es. Amazon SES)" },
  { value: "imap_only", label: "Solo ricezione", description: "Solo IMAP" },
  { value: "hybrid", label: "Ibrido", description: "Provider diversi per SMTP e IMAP" },
];

const SEND_ONLY_PROVIDERS = [
  /email-smtp\..*\.amazonaws\.com/i,
  /smtp\.sendgrid\.net/i,
  /smtp\.mailgun\.org/i,
  /smtp\.postmarkapp\.com/i,
  /in(-v\d+)?\.mailjet\.com/i,
  /(smtp(?:-relay)?\.brevo\.com|smtp(?:-relay)?\.sendinblue\.com)/i,
  /smtp\.mailersend\.(com|net)/i,
  /mail\.smtp2go\.com/i,
  /(live|sandbox)\.smtp\.mailtrap\.io/i,
  /smtp\.zeptomail\.com/i,
  /smtp\.elasticemail\.com/i,
  /smtp\.resend\.(com|dev)/i,
  /smtp\.mandrillapp\.com/i,
  /smtp\.sendpulse\.com/i,
  /smtp\.sparkpostmail\.com/i,
];

function classifyAccountType(account: EmailAccount): AccountType {
  const hasImap = !!(account.imapHost && account.imapHost.trim());
  const hasSmtp = !!(account.smtpHost && account.smtpHost.trim());

  if (hasImap && hasSmtp) {
    const imapDomain = account.imapHost?.replace(/^imap[s]?\./i, '').toLowerCase() || '';
    const smtpDomain = account.smtpHost?.replace(/^smtp[s]?\./i, '').toLowerCase() || '';
    
    const isSendOnlySmtp = SEND_ONLY_PROVIDERS.some(p => p.test(account.smtpHost || ''));
    
    if (isSendOnlySmtp || imapDomain !== smtpDomain) {
      return "hybrid";
    }
    return "full";
  }
  
  if (hasSmtp && !hasImap) return "smtp_only";
  if (hasImap && !hasSmtp) return "imap_only";
  
  return "full";
}

const ITEMS_PER_PAGE = 25;

export default function ConsultantEmailHub() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mainSidebarCollapsed, setMainSidebarCollapsed] = useState(true);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [editingAccount, setEditingAccount] = useState<EmailAccount | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<AccountFormData>(defaultFormData);
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [showEmailSheet, setShowEmailSheet] = useState(false);
  const [expandedDraftId, setExpandedDraftId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState<AIResponse | null>(null);
  const [editedDraftContent, setEditedDraftContent] = useState("");
  
  const [selectedFolder, setSelectedFolder] = useState<FolderType>("inbox");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const [selectedEmails, setSelectedEmails] = useState<Set<string>>(new Set());
  
  const [inboxFilter, setInboxFilter] = useState<InboxFilter>({
    accountId: null,
    readStatus: "all",
    starred: false,
    processingStatus: null,
  });
  
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [showEmailImportDialog, setShowEmailImportDialog] = useState(false);
  const [importAccountId, setImportAccountId] = useState<string>("");
  const [importAccountName, setImportAccountName] = useState<string>("");
  const [showFullEmailView, setShowFullEmailView] = useState(false);
  const [showComposer, setShowComposer] = useState(false);
  const [composerReplyTo, setComposerReplyTo] = useState<Email | null>(null);
  const [composerReplyAll, setComposerReplyAll] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiSettingsAccountId, setAISettingsAccountId] = useState<string>("");
  const [aiSettingsAccountName, setAISettingsAccountName] = useState<string>("");
  const [showTicketView, setShowTicketView] = useState<"list" | "settings" | null>(null);
  const [showAiEventsView, setShowAiEventsView] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

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

  useEffect(() => {
    if (accounts.length > 0 && expandedAccounts.size === 0) {
      setExpandedAccounts(new Set(accounts.map(a => a.id)));
    }
  }, [accounts]);


  const buildInboxQueryParams = () => {
    const params = new URLSearchParams();
    if (inboxFilter.accountId) params.set("accountId", inboxFilter.accountId);
    if (inboxFilter.readStatus === "unread") params.set("unread", "true");
    if (inboxFilter.readStatus === "read") params.set("read", "true");
    if (inboxFilter.starred) params.set("starred", "true");
    if (inboxFilter.processingStatus) params.set("status", inboxFilter.processingStatus);
    
    // Add folder filtering based on selectedFolder
    if (selectedFolder === "inbox") {
      params.set("folder", "inbox");
    } else if (selectedFolder === "sent") {
      params.set("folder", "sent");
    } else if (selectedFolder === "drafts") {
      params.set("folder", "drafts");
    } else if (selectedFolder === "trash") {
      params.set("folder", "trash");
    } else if (selectedFolder === "starred") {
      params.set("starred", "true");
    }
    // ai-drafts is handled separately by a different query
    
    return params.toString();
  };

  const { data: inboxData, isLoading: isLoadingInbox, refetch: refetchInbox } = useQuery({
    queryKey: ["/api/email-hub/inbox", inboxFilter, selectedFolder],
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

  const { data: aiStatsData, refetch: refetchAiStats } = useQuery({
    queryKey: ["/api/email-hub/ai-stats"],
    queryFn: async () => {
      const response = await fetch("/api/email-hub/ai-stats", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch AI stats");
      return response.json();
    },
    refetchInterval: 10000,
  });

  const aiStats = aiStatsData?.data || { pendingAI: 0, processingAI: 0, draftGenerated: 0, needsReview: 0 };

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

  const filteredEmails = useMemo(() => {
    let result = emails;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(e => 
        e.subject?.toLowerCase().includes(q) ||
        e.fromEmail?.toLowerCase().includes(q) ||
        e.fromName?.toLowerCase().includes(q) ||
        e.snippet?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [emails, searchQuery]);

  const totalPages = Math.ceil(filteredEmails.length / ITEMS_PER_PAGE);
  const paginatedEmails = filteredEmails.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

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
    mutationFn: async (data: AccountFormData & { accountId?: string }) => {
      console.log("[EMAIL-HUB] Testing connection with data:", { 
        accountId: data.accountId,
        imapHost: data.imapHost, 
        imapPort: data.imapPort,
        smtpHost: data.smtpHost,
        smtpPort: data.smtpPort,
        hasImapPassword: !!data.imapPassword,
        hasSmtpPassword: !!data.smtpPassword
      });
      
      // Se stiamo modificando un account esistente e non abbiamo le password,
      // usa l'endpoint con ID che legge le credenziali dal database
      const url = data.accountId && (!data.imapPassword || !data.smtpPassword)
        ? `/api/email-hub/accounts/${data.accountId}/test`
        : "/api/email-hub/accounts/test";
      
      console.log("[EMAIL-HUB] Using endpoint:", url);
      
      const response = await fetch(url, {
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
    onSuccess: (result) => {
      console.log("[EMAIL-HUB] Test result:", result);
      const imapOk = result.data?.imap?.success;
      const smtpOk = result.data?.smtp?.success;
      const imapMsg = result.data?.imap?.message || result.data?.imap?.error || "N/A";
      const smtpMsg = result.data?.smtp?.message || result.data?.smtp?.error || "N/A";
      
      if (imapOk && smtpOk) {
        toast({ 
          title: "Connessione riuscita", 
          description: `IMAP: OK | SMTP: OK` 
        });
      } else {
        const errors = [];
        if (!imapOk) errors.push(`IMAP: ${imapMsg}`);
        if (!smtpOk) errors.push(`SMTP: ${smtpMsg}`);
        toast({ 
          title: "Test parzialmente fallito", 
          description: errors.join(" | "), 
          variant: "destructive" 
        });
      }
    },
    onError: (error: any) => {
      console.error("[EMAIL-HUB] Test error:", error);
      toast({ title: "Connessione fallita", description: error.message, variant: "destructive" });
    },
  });

  const { data: importPreviewData } = useQuery({
    queryKey: ["/api/email-hub/accounts/import-preview"],
    queryFn: async () => {
      const response = await fetch("/api/email-hub/accounts/import-preview", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to check import preview");
      return response.json();
    },
  });

  const importPreview = importPreviewData?.data;

  const importAccountsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email-hub/accounts/import", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to import accounts");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts/import-preview"] });
      toast({ 
        title: "Importazione completata", 
        description: data.data?.message || `${data.data?.imported || 0} account importati`
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore importazione", description: error.message, variant: "destructive" });
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

  const startIdleMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/idle/start`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to start IDLE");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      toast({ title: "Sync Attivata", description: "Sincronizzazione in tempo reale attivata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const stopIdleMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await fetch(`/api/email-hub/accounts/${accountId}/idle/stop`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to stop IDLE");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      toast({ title: "Sync Disattivata", description: "Sincronizzazione in tempo reale disattivata" });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    },
  });

  const syncEmailsMutation = useMutation({
    mutationFn: async (accountId: string) => {
      console.log("[EMAIL-HUB SYNC] Starting sync for account:", accountId);
      const response = await fetch(`/api/email-hub/accounts/${accountId}/sync`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 50 }),
      });
      console.log("[EMAIL-HUB SYNC] Response status:", response.status);
      if (!response.ok) {
        const err = await response.json();
        console.log("[EMAIL-HUB SYNC] Error:", err);
        throw new Error(err.error || "Failed to sync emails");
      }
      const result = await response.json();
      console.log("[EMAIL-HUB SYNC] Result:", result);
      return result;
    },
    onSuccess: (result) => {
      console.log("[EMAIL-HUB SYNC] Success:", result);
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      toast({ 
        title: "Sincronizzazione completata", 
        description: `${result.data.imported} email importate, ${result.data.duplicates} gia presenti` 
      });
    },
    onError: (error: any) => {
      console.log("[EMAIL-HUB SYNC] Error:", error);
      toast({ title: "Errore sincronizzazione", description: error.message, variant: "destructive" });
    },
  });

  const batchProcessMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/email-hub/batch-process", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 10 }),
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Failed to process");
      }
      return response.json();
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-stats"] });
      toast({ 
        title: "Elaborazione AI completata", 
        description: result.data.message || `${result.data.processed} email elaborate`
      });
    },
    onError: (error: any) => {
      toast({ title: "Errore elaborazione AI", description: error.message, variant: "destructive" });
    },
  });

  const syncAllAccountsAndRefresh = async () => {
    if (isSyncing || accounts.length === 0) {
      refetchInbox();
      refetchDrafts();
      return;
    }
    
    setIsSyncing(true);
    try {
      const imapAccounts = accounts.filter(acc => acc.imapHost && acc.accountType !== "smtp_only");
      
      if (imapAccounts.length === 0) {
        refetchInbox();
        refetchDrafts();
        setIsSyncing(false);
        return;
      }
      
      const results = await Promise.allSettled(
        imapAccounts.map(async (acc) => {
          const response = await fetch(`/api/email-hub/accounts/${acc.id}/sync`, {
            method: "POST",
            headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
            body: JSON.stringify({ limit: 50 }),
          });
          if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error || `Errore sync ${acc.displayName}`);
          }
          return { account: acc.displayName, success: true };
        })
      );
      
      const failed = results.filter(r => r.status === "rejected") as PromiseRejectedResult[];
      const succeeded = results.filter(r => r.status === "fulfilled").length;
      
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/inbox"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/email-hub/ai-drafts/pending"] });
      
      if (failed.length === 0) {
        toast({ title: "Sincronizzazione completata", description: `${succeeded} account sincronizzati` });
      } else if (succeeded > 0) {
        toast({ 
          title: "Sincronizzazione parziale", 
          description: `${succeeded} OK, ${failed.length} errori`,
          variant: "destructive"
        });
      } else {
        toast({ 
          title: "Sincronizzazione fallita", 
          description: failed[0]?.reason?.message || "Errore durante la sincronizzazione",
          variant: "destructive"
        });
      }
    } catch (error: any) {
      console.error("[SYNC] Error:", error);
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    } finally {
      setIsSyncing(false);
    }
  };

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
    const detectedAccountType = classifyAccountType(account);
    setFormData({
      displayName: account.displayName,
      emailAddress: account.emailAddress,
      accountType: detectedAccountType,
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
    setShowFullEmailView(true);
    if (isMobile) {
      setShowEmailSheet(true);
    }
    if (!email.isRead) {
      markAsReadMutation.mutate(email.id);
    }
  };

  const handleBackToList = () => {
    setShowFullEmailView(false);
    setSelectedEmail(null);
  };

  const handleFolderClick = (folder: FolderType, accountId?: string | null) => {
    setSelectedFolder(folder);
    setSelectedAccountId(accountId || null);
    setSelectedEmail(null);
    setCurrentPage(1);
    setShowTicketView(null);
    setShowAiEventsView(false);
    setShowFullEmailView(false);
    
    setInboxFilter(prev => ({ 
      ...prev, 
      readStatus: "all", 
      processingStatus: null,
      starred: folder === "starred",
      accountId: accountId || null
    }));
    
    if (folder === "ai-drafts") {
      refetchDrafts();
    }
  };

  const toggleAccountExpanded = (accountId: string) => {
    setExpandedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const getAvatarColor = (name: string) => {
    const colors = [
      "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-amber-500",
      "bg-rose-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500"
    ];
    const index = name.charCodeAt(0) % colors.length;
    return colors[index];
  };

  const getConfidenceBadge = (confidence: number) => {
    const pct = Math.round(confidence * 100);
    let color = "bg-red-100 text-red-700";
    if (pct >= 80) color = "bg-green-100 text-green-700";
    else if (pct >= 60) color = "bg-yellow-100 text-yellow-700";
    return <Badge className={color}>{pct}%</Badge>;
  };

  const getFolderTitle = () => {
    switch (selectedFolder) {
      case "inbox": return "Posta in arrivo";
      case "drafts": return "Bozze";
      case "sent": return "Inviata";
      case "trash": return "Cestino";
      case "ai-drafts": return "Bozze AI";
      case "starred": return "Importante";
      default: return "Posta in arrivo";
    }
  };

  const totalUnreadCount = accounts.reduce((sum, acc) => sum + (acc.unreadCount || 0), 0);

  const renderLeftSidebar = () => (
    <div className="w-[220px] min-w-[220px] bg-slate-900 text-white flex flex-col h-full overflow-hidden">
      <div className="p-4 space-y-3 shrink-0">
        {mainSidebarCollapsed && (
          <Button 
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-slate-300 hover:text-white hover:bg-white/10"
            onClick={() => setMainSidebarCollapsed(false)}
          >
            <Menu className="h-4 w-4" />
            Menu principale
          </Button>
        )}
        <Button 
          className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
          onClick={() => {
            setComposerReplyTo(null);
            setComposerReplyAll(false);
            setShowComposer(true);
          }}
        >
          <PenSquare className="h-4 w-4" />
          Scrivi un messaggio
        </Button>
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <ScrollArea className="h-full">
        <div className="px-2 pb-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleFolderClick("inbox", null)}
              className={`flex-1 flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                selectedFolder === "inbox" && !selectedAccountId
                  ? "bg-violet-600/20 text-violet-300" 
                  : "hover:bg-white/5 text-slate-300"
              }`}
            >
              <Inbox className="h-4 w-4" />
              <span className="text-sm flex-1 text-left">Posta in arrivo</span>
              {totalUnreadCount > 0 && (
                <Badge className="h-5 px-1.5 text-xs bg-violet-600">{totalUnreadCount}</Badge>
              )}
            </button>
            <button
              className="h-8 w-8 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              onClick={(e) => { e.stopPropagation(); syncAllAccountsAndRefresh(); }}
              disabled={isSyncing}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin" : ""}`} />
            </button>
          </div>

          <button
            onClick={() => handleFolderClick("drafts", null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              selectedFolder === "drafts" && !selectedAccountId
                ? "bg-violet-600/20 text-violet-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <FileText className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Bozze</span>
          </button>

          <button
            onClick={() => handleFolderClick("sent", null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              selectedFolder === "sent" && !selectedAccountId
                ? "bg-violet-600/20 text-violet-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Send className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Inviata</span>
          </button>

          <button
            onClick={() => handleFolderClick("trash", null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              selectedFolder === "trash" && !selectedAccountId
                ? "bg-violet-600/20 text-violet-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Trash2 className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Cestino</span>
          </button>

          <button
            onClick={() => handleFolderClick("starred", null)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              selectedFolder === "starred"
                ? "bg-violet-600/20 text-violet-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Star className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Importante</span>
          </button>

          <Separator className="my-2 bg-slate-700" />
          
          <button
            onClick={() => {
              setShowTicketView("list");
              setShowAiEventsView(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              showTicketView === "list"
                ? "bg-orange-600/20 text-orange-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Ticket className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Ticket</span>
          </button>
          
          <button
            onClick={() => {
              setShowTicketView("settings");
              setShowAiEventsView(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              showTicketView === "settings"
                ? "bg-orange-600/20 text-orange-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Webhook className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Webhook</span>
          </button>
          
          <button
            onClick={() => {
              setShowAiEventsView(true);
              setShowTicketView(null);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              showAiEventsView
                ? "bg-blue-600/20 text-blue-300" 
                : "hover:bg-white/5 text-slate-300"
            }`}
          >
            <Zap className="h-4 w-4" />
            <span className="text-sm flex-1 text-left">Cronologia AI</span>
          </button>
          
          <Link href="/consultant/knowledge-documents">
            <button
              className="w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors hover:bg-white/5 text-slate-300"
            >
              <BookOpen className="h-4 w-4" />
              <span className="text-sm flex-1 text-left">Knowledge Base</span>
            </button>
          </Link>

          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 text-sm">
                <ChevronDown className="h-3 w-3" />
                <span className="flex-1 text-left">Altro</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="ml-5 space-y-0.5">
                <button className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-400 text-sm">
                  <Archive className="h-4 w-4" />
                  <span className="flex-1 text-left">Archivio</span>
                </button>
                <button className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg hover:bg-white/5 text-slate-400 text-sm">
                  <Trash2 className="h-4 w-4" />
                  <span className="flex-1 text-left">Cestino</span>
                </button>
              </div>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-3 bg-slate-700" />

          {(aiStats.pendingAI > 0 || aiStats.processingAI > 0 || batchProcessMutation.isPending) && (
            <div className="mb-2 p-2 rounded-lg bg-violet-900/30 border border-violet-700/50">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-violet-300 flex items-center gap-1">
                  {batchProcessMutation.isPending || aiStats.processingAI > 0 ? (
                    <>
                      <Loader2 className="h-3 w-3 animate-spin shrink-0" />
                      <span className="truncate">Elaborazione...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3 w-3 shrink-0" />
                      <span className="truncate">Email in coda</span>
                    </>
                  )}
                </span>
                <Badge variant="secondary" className="h-5 px-1.5 text-xs bg-violet-600 shrink-0">
                  {aiStats.pendingAI}
                </Badge>
              </div>
              {aiStats.pendingAI > 0 && !batchProcessMutation.isPending && (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-7 text-xs border-violet-500 text-violet-300 hover:bg-violet-600/30"
                  onClick={() => batchProcessMutation.mutate()}
                  disabled={batchProcessMutation.isPending}
                >
                  <Zap className="h-3 w-3 mr-1 shrink-0" />
                  <span className="truncate">Genera bozze</span>
                </Button>
              )}
            </div>
          )}

          {pendingDrafts.length > 0 && (
            <button
              onClick={() => handleFolderClick("ai-drafts")}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg mb-2 transition-colors ${
                selectedFolder === "ai-drafts" 
                  ? "bg-violet-600/20 text-violet-300" 
                  : "hover:bg-white/5 text-slate-300"
              }`}
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-sm flex-1 text-left">Bozze AI</span>
              <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                {pendingDrafts.length}
              </Badge>
            </button>
          )}

          <Collapsible>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 text-slate-400 text-sm">
                <ChevronDown className="h-3 w-3" />
                <span className="flex-1 text-left">Newsletter</span>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <p className="text-xs text-slate-500 px-3 py-2">Nessuna newsletter</p>
            </CollapsibleContent>
          </Collapsible>

          <Separator className="my-3 bg-slate-700" />

          <div className="flex items-center justify-between px-3 py-1">
            <span className="text-xs text-slate-500 uppercase tracking-wider">Account</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 text-slate-500 hover:text-white"
              onClick={handleOpenAddAccount}
            >
              <Plus className="h-3 w-3" />
            </Button>
          </div>

          {accounts.length === 0 ? (
            <div className="px-3 py-4 text-center">
              <Mail className="h-8 w-8 mx-auto text-slate-600 mb-2" />
              <p className="text-xs text-slate-500 mb-2">Nessun account</p>
              <div className="flex flex-col gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs border-slate-600 text-slate-300 hover:bg-slate-800"
                  onClick={handleOpenAddAccount}
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Aggiungi
                </Button>
                {importPreview?.available && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs border-violet-600 text-violet-300 hover:bg-violet-800/30"
                    onClick={() => setShowImportWizard(true)}
                  >
                    <Download className="h-3 w-3 mr-1" />
                    Importa ({importPreview.importable})
                  </Button>
                )}
              </div>
            </div>
          ) : (
            accounts.map((account) => (
              <Collapsible
                key={account.id}
                open={expandedAccounts.has(account.id)}
                onOpenChange={() => toggleAccountExpanded(account.id)}
              >
                <div className="flex items-center gap-1 group">
                  <CollapsibleTrigger asChild>
                    <button className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-white/5 text-left">
                      <ChevronDown className={`h-3 w-3 transition-transform text-slate-400 ${
                        expandedAccounts.has(account.id) ? "" : "-rotate-90"
                      }`} />
                      {account.accountType === "smtp_only" ? (
                        <Send className="h-4 w-4 text-amber-400" title="Solo invio" />
                      ) : account.accountType === "imap_only" ? (
                        <Inbox className="h-4 w-4 text-blue-400" title="Solo ricezione" />
                      ) : account.accountType === "hybrid" ? (
                        <ArrowRightLeft className="h-4 w-4 text-violet-400" title="Configurazione ibrida" />
                      ) : (
                        <Mail className="h-4 w-4 text-slate-400" title="Account completo" />
                      )}
                      <span className="text-sm truncate flex-1 text-slate-200">{account.displayName}</span>
                      {account.syncStatus === "connected" && (
                        <Wifi className="h-3 w-3 text-emerald-400" />
                      )}
                    </button>
                  </CollapsibleTrigger>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-7 w-7 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-white hover:bg-white/10"
                      >
                        <Settings className="h-3.5 w-3.5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem onClick={() => handleOpenEditAccount(account)}>
                        <Edit className="h-4 w-4 mr-2" />
                        Modifica
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => {
                          setAISettingsAccountId(account.id);
                          setAISettingsAccountName(account.displayName || account.emailAddress);
                          setShowAISettings(true);
                        }}
                      >
                        <Sparkles className="h-4 w-4 mr-2 text-violet-400" />
                        Impostazioni AI
                      </DropdownMenuItem>
                      {(account.accountType === "imap_only" || account.accountType === "full" || account.accountType === "hybrid") && (
                        <>
                          <DropdownMenuItem 
                            onClick={() => {
                              console.log("[EMAIL-HUB] Sync button clicked for account:", account.id, account.accountType);
                              syncEmailsMutation.mutate(account.id);
                            }}
                            disabled={syncEmailsMutation.isPending}
                          >
                            <RefreshCw className={`h-4 w-4 mr-2 ${syncEmailsMutation.isPending ? "animate-spin" : ""}`} />
                            {syncEmailsMutation.isPending ? "Sincronizzazione..." : "Sincronizza Email"}
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => {
                              setImportAccountId(account.id);
                              setImportAccountName(account.displayName || account.emailAddress);
                              setShowEmailImportDialog(true);
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            Importa Email
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuItem 
                        onClick={() => {
                          if (account.syncStatus === "connected") {
                            stopIdleMutation.mutate(account.id);
                          } else {
                            startIdleMutation.mutate(account.id);
                          }
                        }}
                      >
                        <Wifi className="h-4 w-4 mr-2" />
                        {account.syncStatus === "connected" ? "Disattiva Sync" : "Attiva Sync Live"}
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        className="text-destructive"
                        onClick={() => {
                          if (confirm("Sei sicuro di voler eliminare questo account?")) {
                            deleteAccountMutation.mutate(account.id);
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <CollapsibleContent>
                  <div className="ml-5 space-y-0.5">
                    {account.accountType !== "smtp_only" && (
                      <button
                        onClick={() => handleFolderClick("inbox", account.id)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          selectedFolder === "inbox" && selectedAccountId === account.id
                            ? "bg-violet-600/20 text-violet-300"
                            : "hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        <Inbox className="h-4 w-4" />
                        <span className="flex-1 text-left">Inbox</span>
                        {(account.unreadCount || 0) > 0 && (
                          <Badge className="h-5 px-1.5 text-xs bg-violet-600">{account.unreadCount}</Badge>
                        )}
                      </button>
                    )}
                    {account.accountType !== "smtp_only" && (
                      <button
                        onClick={() => handleFolderClick("drafts", account.id)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          selectedFolder === "drafts" && selectedAccountId === account.id
                            ? "bg-violet-600/20 text-violet-300"
                            : "hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        <FileText className="h-4 w-4" />
                        <span className="flex-1 text-left">Bozze</span>
                      </button>
                    )}
                    {account.accountType !== "imap_only" && (
                      <button
                        onClick={() => handleFolderClick("sent", account.id)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          selectedFolder === "sent" && selectedAccountId === account.id
                            ? "bg-violet-600/20 text-violet-300"
                            : "hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        <Send className="h-4 w-4" />
                        <span className="flex-1 text-left">Inviata</span>
                      </button>
                    )}
                    {account.accountType !== "smtp_only" && (
                      <button
                        onClick={() => handleFolderClick("trash", account.id)}
                        className={`w-full flex items-center gap-3 px-3 py-1.5 rounded-lg transition-colors text-sm ${
                          selectedFolder === "trash" && selectedAccountId === account.id
                            ? "bg-violet-600/20 text-violet-300"
                            : "hover:bg-white/5 text-slate-400"
                        }`}
                      >
                        <Trash2 className="h-4 w-4" />
                        <span className="flex-1 text-left">Cestino</span>
                      </button>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))
          )}

          <Separator className="my-3 bg-slate-700" />

          <Collapsible>
            <div className="flex items-center justify-between px-3 py-1 group">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider hover:text-slate-300">
                  <ChevronDown className="h-3 w-3" />
                  Cartelle
                </button>
              </CollapsibleTrigger>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-white">
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-white">
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <CollapsibleContent>
              <p className="text-xs text-slate-500 px-3 py-2">Nessuna cartella personalizzata</p>
            </CollapsibleContent>
          </Collapsible>

          <Collapsible>
            <div className="flex items-center justify-between px-3 py-1 group">
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-xs text-slate-500 uppercase tracking-wider hover:text-slate-300">
                  <ChevronDown className="h-3 w-3" />
                  Etichette
                </button>
              </CollapsibleTrigger>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-white">
                  <Plus className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5 text-slate-500 hover:text-white">
                  <Settings className="h-3 w-3" />
                </Button>
              </div>
            </div>
            <CollapsibleContent>
              <p className="text-xs text-slate-500 px-3 py-2">Nessuna etichetta</p>
            </CollapsibleContent>
          </Collapsible>
        </div>
        </ScrollArea>
      </div>
      
      <div className="p-4 border-t border-slate-700 shrink-0">
        <button
          onClick={handleOpenAddAccount}
          className="flex items-center gap-2 text-sm text-violet-400 hover:text-violet-300 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Aggiungi Account
        </button>
      </div>
    </div>
  );

  const renderEmailList = () => (
    <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 min-w-0">
      <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{getFolderTitle()}</h2>
          <div className="flex items-center gap-2">
            <Button 
              size="sm"
              className="bg-violet-600 hover:bg-violet-700 gap-1"
              onClick={() => {
                setComposerReplyTo(null);
                setComposerReplyAll(false);
                setShowComposer(true);
              }}
            >
              <PenSquare className="h-4 w-4" />
              Nuova Email
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={syncAllAccountsAndRefresh}
              disabled={isSyncing}
              className="h-8 w-8"
            >
              <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
        
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Cerca email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant={inboxFilter.readStatus === "all" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInboxFilter(prev => ({ ...prev, readStatus: "all" }))}
          >
            Tutte
          </Button>
          <Button
            variant={inboxFilter.readStatus === "read" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInboxFilter(prev => ({ ...prev, readStatus: "read" }))}
          >
            Letta
          </Button>
          <Button
            variant={inboxFilter.readStatus === "unread" ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInboxFilter(prev => ({ ...prev, readStatus: "unread" }))}
          >
            Non letto
          </Button>
          <Button
            variant={inboxFilter.starred ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setInboxFilter(prev => ({ ...prev, starred: !prev.starred }))}
          >
            <Star className="h-3 w-3 mr-1" />
            Preferiti
          </Button>
          
          <div className="ml-auto flex items-center gap-1 text-xs text-slate-500">
            <span>{filteredEmails.length > 0 ? `${(currentPage - 1) * ITEMS_PER_PAGE + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, filteredEmails.length)}` : "0"} di {filteredEmails.length}</span>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage <= 1}
              onClick={() => setCurrentPage(p => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage(p => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
        {selectedFolder === "ai-drafts" ? (
          pendingDrafts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-slate-500">
              <Sparkles className="h-12 w-12 mb-4 text-slate-300" />
              <p className="text-sm">Nessuna bozza AI in attesa</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {pendingDrafts.map((draft) => (
                <div
                  key={draft.id}
                  className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-pointer"
                  onClick={() => setExpandedDraftId(expandedDraftId === draft.id ? null : draft.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${getAvatarColor(draft.originalEmail?.fromName || "A")}`}>
                      <Sparkles className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm truncate">
                          {draft.originalEmail?.fromName || draft.originalEmail?.fromEmail || "Sconosciuto"}
                        </span>
                        {getConfidenceBadge(draft.confidence)}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">{draft.draftSubject}</p>
                    </div>
                    <span className="text-xs text-slate-400 shrink-0">
                      {format(new Date(draft.createdAt), "HH:mm")}
                    </span>
                  </div>
                  
                  {expandedDraftId === draft.id && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-slate-900 rounded-lg space-y-3">
                      <div className="text-sm whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                        {draft.draftBodyText || draft.draftBodyHtml}
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" onClick={() => approveDraftMutation.mutate(draft.id)} disabled={approveDraftMutation.isPending}>
                          <Check className="h-4 w-4 mr-1" />
                          Approva
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setEditingDraft(draft);
                          setEditedDraftContent(draft.draftBodyText || draft.draftBodyHtml || "");
                        }}>
                          <Edit className="h-4 w-4 mr-1" />
                          Modifica
                        </Button>
                        <Button size="sm" variant="outline" className="text-destructive" onClick={() => rejectDraftMutation.mutate(draft.id)}>
                          <X className="h-4 w-4 mr-1" />
                          Rifiuta
                        </Button>
                        {draft.status === "approved" && (
                          <Button size="sm" variant="secondary" className="ml-auto" onClick={() => sendDraftMutation.mutate(draft.id)}>
                            <Send className="h-4 w-4 mr-1" />
                            Invia
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : isLoadingInbox ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : paginatedEmails.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-500">
            <Inbox className="h-12 w-12 mb-4 text-slate-300" />
            <p className="text-sm">Nessuna email trovata</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {paginatedEmails.map((email, index) => (
              <motion.div
                key={email.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ 
                  delay: index * 0.02,
                  duration: 0.15,
                  ease: [0.25, 0.46, 0.45, 0.94]
                }}
                whileHover={{ 
                  backgroundColor: "rgba(139, 92, 246, 0.08)",
                  scale: 1.005,
                  transition: { duration: 0.1 }
                }}
                whileTap={{ scale: 0.995 }}
                onClick={() => handleEmailClick(email)}
                className={`px-4 py-3 cursor-pointer flex items-center gap-3 ${
                  !email.isRead ? "bg-violet-50/50 dark:bg-violet-950/20" : ""
                } ${selectedEmail?.id === email.id ? "bg-violet-100 dark:bg-violet-900/30" : ""}`}
              >
                <Checkbox
                  checked={selectedEmails.has(email.id)}
                  onCheckedChange={(checked) => {
                    setSelectedEmails(prev => {
                      const next = new Set(prev);
                      if (checked) {
                        next.add(email.id);
                      } else {
                        next.delete(email.id);
                      }
                      return next;
                    });
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
                
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium shrink-0 ${getAvatarColor(email.fromName || email.fromEmail)}`}>
                  {(email.fromName || email.fromEmail).charAt(0).toUpperCase()}
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-sm truncate ${!email.isRead ? "font-semibold text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-300"}`}>
                      {email.fromName || email.fromEmail}
                    </span>
                    {email.processingStatus === "draft_generated" && (
                      <Badge className="h-5 px-1.5 text-xs bg-violet-100 text-violet-700 dark:bg-violet-900 dark:text-violet-300">
                        <Sparkles className="h-3 w-3 mr-0.5" />
                        AI
                      </Badge>
                    )}
                    {email.processingStatus === "needs_review" && (
                      <Badge variant="destructive" className="h-5 px-1.5 text-xs">
                        <AlertTriangle className="h-3 w-3 mr-0.5" />
                        Urgente
                      </Badge>
                    )}
                    {email.processingStatus === "sent" && (
                      <Badge className="h-5 px-1.5 text-xs bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">
                        <Check className="h-3 w-3 mr-0.5" />
                        Risposto
                      </Badge>
                    )}
                  </div>
                  <p className={`text-sm truncate ${!email.isRead ? "text-slate-800 dark:text-slate-200" : "text-slate-600 dark:text-slate-400"}`}>
                    {email.subject || "(Nessun oggetto)"}
                  </p>
                  <p className="text-xs text-slate-500 truncate">{email.snippet}</p>
                </div>
                
                <div className="flex items-center gap-2 shrink-0">
                  {email.hasAttachments && <Paperclip className="h-4 w-4 text-slate-400" />}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleStarMutation.mutate(email.id);
                    }}
                    className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded"
                  >
                    {email.isStarred ? (
                      <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                    ) : (
                      <Star className="h-4 w-4 text-slate-300" />
                    )}
                  </button>
                  <span className="text-xs text-slate-400 w-14 text-right">
                    {format(new Date(email.receivedAt), "dd/MM")}
                  </span>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );

  const renderPreviewPanel = () => (
    <div className="w-[380px] min-w-[380px] bg-white dark:bg-slate-950 flex flex-col h-full">
      {selectedEmail ? (
        <>
          <div className="p-4 border-b border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setSelectedEmail(null)}>
                  <X className="h-4 w-4" />
                </Button>
                <h3 className="font-medium text-sm truncate">{selectedEmail.subject || "(Nessun oggetto)"}</h3>
              </div>
            </div>
            
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-medium ${getAvatarColor(selectedEmail.fromName || selectedEmail.fromEmail)}`}>
                {(selectedEmail.fromName || selectedEmail.fromEmail).charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{selectedEmail.fromName || selectedEmail.fromEmail}</p>
                <p className="text-xs text-slate-500">A: {selectedEmail.toEmail}</p>
                <p className="text-xs text-slate-400">
                  {format(new Date(selectedEmail.receivedAt), "dd MMMM yyyy, HH:mm")}
                </p>
              </div>
            </div>
          </div>
          
          <ScrollArea className="flex-1 p-4">
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <div 
                className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300"
                dangerouslySetInnerHTML={{ 
                  __html: emailDetailData?.data?.bodyHtml || emailDetailData?.data?.bodyText || selectedEmail.snippet || "Caricamento contenuto..." 
                }}
              />
            </div>
            
            {emailAIResponses.length > 0 && (
              <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-violet-500" />
                  Risposte AI
                </h4>
                <div className="space-y-3">
                  {emailAIResponses.map((resp) => (
                    <div key={resp.id} className="p-3 bg-violet-50 dark:bg-violet-950/30 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-medium">{resp.draftSubject}</span>
                        {getConfidenceBadge(resp.confidence)}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400 whitespace-pre-wrap">
                        {resp.draftBodyText || resp.draftBodyHtml}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </ScrollArea>
          
          <div className="p-4 border-t border-slate-200 dark:border-slate-800 flex gap-2 flex-wrap">
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-1"
              onClick={() => {
                setComposerReplyTo(selectedEmail);
                setComposerReplyAll(false);
                setShowComposer(true);
              }}
            >
              <Reply className="h-4 w-4" />
              Rispondi
            </Button>
            <Button 
              size="sm" 
              variant="outline" 
              className="gap-1"
              onClick={() => {
                setComposerReplyTo(selectedEmail);
                setComposerReplyAll(true);
                setShowComposer(true);
              }}
            >
              <Users className="h-4 w-4" />
              Rispondi a tutti
            </Button>
            <Button 
              size="sm" 
              className="gap-1 bg-violet-600 hover:bg-violet-700"
              onClick={() => generateAIResponseMutation.mutate(selectedEmail.id)}
              disabled={generateAIResponseMutation.isPending}
            >
              {generateAIResponseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              AI Genera Bozza
            </Button>
            <Button size="sm" variant="outline" className="gap-1">
              <Forward className="h-4 w-4" />
              Inoltra
            </Button>
            <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive ml-auto">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </>
      ) : (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 p-8">
          <Mail className="h-16 w-16 mb-4 text-slate-200" />
          <p className="text-sm text-center">Seleziona un'email per visualizzarla</p>
        </div>
      )}
    </div>
  );

  const renderFullEmailView = () => (
    <div className="flex-1 bg-white dark:bg-slate-950 flex flex-col h-full">
      {selectedEmail ? (
        <>
          <motion.div 
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="p-4 border-b border-slate-200 dark:border-slate-800"
          >
            <div className="flex items-center gap-4 mb-4">
              <motion.div whileHover={{ x: -3 }} whileTap={{ scale: 0.95 }}>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="gap-2 transition-all duration-200" 
                  onClick={handleBackToList}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Indietro
                </Button>
              </motion.div>
              <div className="flex-1" />
              <div className="flex items-center gap-2">
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.05, duration: 0.12 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1"
                    onClick={() => {
                      setComposerReplyTo(selectedEmail);
                      setComposerReplyAll(false);
                      setShowComposer(true);
                    }}
                  >
                    <Reply className="h-4 w-4" />
                    Rispondi
                  </Button>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08, duration: 0.12 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="gap-1"
                    onClick={() => {
                      setComposerReplyTo(selectedEmail);
                      setComposerReplyAll(true);
                      setShowComposer(true);
                    }}
                  >
                    <Users className="h-4 w-4" />
                    Rispondi a tutti
                  </Button>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.08, duration: 0.12 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button 
                    size="sm" 
                    className="gap-1 bg-violet-600 hover:bg-violet-700 transition-all duration-150"
                    onClick={() => generateAIResponseMutation.mutate(selectedEmail.id)}
                    disabled={generateAIResponseMutation.isPending}
                  >
                    {generateAIResponseMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    AI Genera Bozza
                  </Button>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.11, duration: 0.12 }}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <Button size="sm" variant="outline" className="gap-1">
                    <Forward className="h-4 w-4" />
                    Inoltra
                  </Button>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.14, duration: 0.12 }}
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  whileTap={{ scale: 0.9 }}
                >
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => toggleStarMutation.mutate(selectedEmail.id)}
                  >
                    <motion.div
                      animate={selectedEmail.isStarred ? { scale: [1, 1.3, 1] } : {}}
                      transition={{ duration: 0.2 }}
                    >
                      {selectedEmail.isStarred ? (
                        <Star className="h-4 w-4 text-amber-500 fill-amber-500" />
                      ) : (
                        <Star className="h-4 w-4" />
                      )}
                    </motion.div>
                  </Button>
                </motion.div>
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.17, duration: 0.12 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  <Button size="sm" variant="outline" className="gap-1 text-destructive hover:text-destructive transition-colors duration-150">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05, duration: 0.2 }}
              className="text-xl font-semibold mb-4"
            >
              {selectedEmail.subject || "(Nessun oggetto)"}
            </motion.h1>
            
            <motion.div 
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.2 }}
              className="flex items-start gap-4"
            >
              <motion.div 
                initial={{ scale: 0.85 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 300, damping: 20 }}
                className={`w-12 h-12 rounded-full flex items-center justify-center text-white font-medium text-lg ${getAvatarColor(selectedEmail.fromName || selectedEmail.fromEmail)}`}
              >
                {(selectedEmail.fromName || selectedEmail.fromEmail).charAt(0).toUpperCase()}
              </motion.div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{selectedEmail.fromName || selectedEmail.fromEmail}</span>
                  <span className="text-sm text-slate-500">&lt;{selectedEmail.fromEmail}&gt;</span>
                </div>
                <div className="text-sm text-slate-500">
                  A: {selectedEmail.toEmail}
                </div>
              </div>
              <div className="text-sm text-slate-400">
                {format(new Date(selectedEmail.receivedAt), "dd MMMM yyyy, HH:mm")}
              </div>
            </motion.div>
          </motion.div>
          
          <ScrollArea className="flex-1 p-6">
            <motion.div 
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
              className="max-w-4xl mx-auto"
            >
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div 
                  className="whitespace-pre-wrap text-slate-700 dark:text-slate-300"
                  dangerouslySetInnerHTML={{ 
                    __html: emailDetailData?.data?.bodyHtml || emailDetailData?.data?.bodyText || selectedEmail.snippet || "Caricamento contenuto..." 
                  }}
                />
              </div>
              
              {emailAIResponses.length > 0 && (
                <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700">
                  <h4 className="text-lg font-medium mb-4 flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    Risposte AI Generate
                  </h4>
                  <div className="space-y-4">
                    {emailAIResponses.map((resp) => (
                      <Card key={resp.id} className="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800">
                        <CardHeader className="pb-2">
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">{resp.draftSubject}</CardTitle>
                            <div className="flex items-center gap-2">
                              {getConfidenceBadge(resp.confidence)}
                              <Badge variant={resp.status === "sent" || resp.status === "auto_sent" ? "default" : resp.status === "draft_needs_review" ? "destructive" : "outline"}>
                                {resp.status === "draft" ? "Bozza" :
                                 resp.status === "approved" ? "Approvato" :
                                 resp.status === "edited" ? "Modificato" :
                                 resp.status === "rejected" ? "Rifiutato" :
                                 resp.status === "auto_sent" ? "Inviato Auto" :
                                 resp.status === "draft_needs_review" ? "Richiede Revisione" : "Inviato"}
                              </Badge>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm whitespace-pre-wrap text-slate-600 dark:text-slate-400">
                            {resp.draftBodyText || resp.draftBodyHtml}
                          </p>
                          {resp.status === "draft" && (
                            <div className="flex gap-2 mt-4">
                              <Button size="sm" variant="default">
                                <Check className="h-4 w-4 mr-1" />
                                Approva e Invia
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => {
                                setEditingDraft(resp);
                                setEditedDraftContent(resp.draftBodyText || resp.draftBodyHtml || "");
                              }}>
                                <Edit className="h-4 w-4 mr-1" />
                                Modifica
                              </Button>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          </ScrollArea>
        </>
      ) : null}
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
            <div className="space-y-2">
              <Label>Tipo di account</Label>
              <Select
                value={formData.accountType}
                onValueChange={(val: AccountType) => handleInputChange("accountType", val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      <div className="flex flex-col">
                        <span>{opt.label}</span>
                        <span className="text-xs text-muted-foreground">{opt.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {(formData.accountType === "imap_only" || formData.accountType === "full" || formData.accountType === "hybrid") && (
            <>
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
            </>
          )}

          {(formData.accountType === "smtp_only" || formData.accountType === "full" || formData.accountType === "hybrid") && (
            <>
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
            </>
          )}

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
            onClick={() => testConnectionMutation.mutate({ ...formData, accountId: editingAccount?.id })}
            disabled={testConnectionMutation.isPending || (!formData.imapHost && !formData.smtpHost)}
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
                            <Badge variant={resp.status === "sent" || resp.status === "auto_sent" ? "default" : resp.status === "draft_needs_review" ? "destructive" : "outline"}>
                              {resp.status === "draft" ? "Bozza" :
                               resp.status === "approved" ? "Approvato" :
                               resp.status === "edited" ? "Modificato" :
                               resp.status === "rejected" ? "Rifiutato" :
                               resp.status === "auto_sent" ? "Inviato Auto" :
                               resp.status === "draft_needs_review" ? "Richiede Revisione" : "Inviato"}
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

  const renderEditDraftDialog = () => (
    <Dialog open={!!editingDraft} onOpenChange={(open) => !open && setEditingDraft(null)}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Modifica Bozza AI</DialogTitle>
          <DialogDescription>
            Modifica il contenuto della risposta prima di inviarla
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={editedDraftContent}
          onChange={(e) => setEditedDraftContent(e.target.value)}
          rows={12}
          className="font-mono text-sm"
        />
        <DialogFooter>
          <Button variant="outline" onClick={() => setEditingDraft(null)}>
            Annulla
          </Button>
          <Button 
            onClick={() => editingDraft && editDraftMutation.mutate({ responseId: editingDraft.id, content: editedDraftContent })}
            disabled={editDraftMutation.isPending}
          >
            {editDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Check className="h-4 w-4 mr-2" />}
            Salva Modifiche
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  const isInitialLoading = isLoadingAccounts || (isLoadingInbox && emails.length === 0);

  if (isInitialLoading) {
    return (
      <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
        {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
        <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
          <Sidebar 
            role="consultant" 
            isOpen={sidebarOpen} 
            onClose={() => setSidebarOpen(false)} 
            isCollapsed={mainSidebarCollapsed}
            onCollapsedChange={setMainSidebarCollapsed}
          />
          <div className="flex-1 flex overflow-hidden">
            {!isMobile && (
              <div className="w-[220px] min-w-[220px] bg-slate-900 text-white flex flex-col h-full p-4 space-y-3">
                <Skeleton className="h-10 w-full bg-slate-700" />
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Skeleton className="h-8 w-full bg-slate-800" />
                <Separator className="my-2 bg-slate-700" />
                <Skeleton className="h-6 w-20 bg-slate-800" />
                <Skeleton className="h-12 w-full bg-slate-800" />
              </div>
            )}
            <div className="flex-1 flex flex-col bg-white dark:bg-slate-950 border-x border-slate-200 dark:border-slate-800 p-4 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <Skeleton className="h-6 w-32 bg-slate-200 dark:bg-slate-800" />
                <div className="flex gap-2">
                  <Skeleton className="h-9 w-28 bg-slate-200 dark:bg-slate-800" />
                  <Skeleton className="h-9 w-9 bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
              <Skeleton className="h-10 w-full bg-slate-200 dark:bg-slate-800" />
              <div className="space-y-2 mt-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full bg-slate-200 dark:bg-slate-800" />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar 
          role="consultant" 
          isOpen={sidebarOpen} 
          onClose={() => setSidebarOpen(false)} 
          isCollapsed={mainSidebarCollapsed}
          onCollapsedChange={setMainSidebarCollapsed}
        />

        <div className="flex-1 flex overflow-hidden">
          {!isMobile && renderLeftSidebar()}
          <AnimatePresence mode="wait">
            {showAiEventsView ? (
              <motion.div
                key="ai-events-view"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 35,
                  mass: 0.6
                }}
                className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900"
              >
                <AIEventsPanel />
              </motion.div>
            ) : showTicketView ? (
              <motion.div
                key="ticket-view"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 35,
                  mass: 0.6
                }}
                className="flex-1 overflow-auto bg-slate-50 dark:bg-slate-900 p-6"
              >
                <div className="max-w-4xl mx-auto">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                        {showTicketView === "list" ? "Ticket" : "Configurazione Webhook"}
                      </h1>
                      <p className="text-sm text-muted-foreground mt-1">
                        {showTicketView === "list" 
                          ? "Gestisci i ticket creati per le email che richiedono attenzione"
                          : "Configura le integrazioni webhook per i ticket"
                        }
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant={showTicketView === "list" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowTicketView("list")}
                      >
                        <Ticket className="h-4 w-4 mr-2" />
                        Ticket
                      </Button>
                      <Button
                        variant={showTicketView === "settings" ? "default" : "outline"}
                        size="sm"
                        onClick={() => setShowTicketView("settings")}
                      >
                        <Webhook className="h-4 w-4 mr-2" />
                        Webhook
                      </Button>
                    </div>
                  </div>
                  {showTicketView === "list" ? <TicketsList /> : <TicketSettingsPanel />}
                </div>
              </motion.div>
            ) : showFullEmailView && selectedEmail ? (
              <motion.div
                key="email-view"
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 35,
                  mass: 0.6
                }}
                className="flex-1 flex"
              >
                {renderFullEmailView()}
              </motion.div>
            ) : (
              <motion.div
                key="email-list"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 30 }}
                transition={{ 
                  type: "spring", 
                  stiffness: 400, 
                  damping: 35,
                  mass: 0.6
                }}
                className="flex-1 flex"
              >
                {renderEmailList()}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {renderAccountDialog()}
      {renderEmailSheet()}
      {renderEditDraftDialog()}
      
      {importPreview && (
        <ImportWizardDialog
          open={showImportWizard}
          onOpenChange={setShowImportWizard}
          importPreview={importPreview}
          onImportComplete={() => {
            queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts"] });
            queryClient.invalidateQueries({ queryKey: ["/api/email-hub/accounts/import-preview"] });
            toast({ 
              title: "Importazione completata", 
              description: "Gli account sono stati importati con successo"
            });
          }}
        />
      )}

      {importAccountId && (
        <EmailImportDialog
          open={showEmailImportDialog}
          onOpenChange={(open) => {
            setShowEmailImportDialog(open);
            if (!open) {
              setImportAccountId("");
              setImportAccountName("");
            }
          }}
          accountId={importAccountId}
          accountName={importAccountName}
        />
      )}

      <EmailComposer
        open={showComposer}
        onOpenChange={(open) => {
          setShowComposer(open);
          if (!open) {
            setComposerReplyTo(null);
            setComposerReplyAll(false);
          }
        }}
        accounts={accounts.map(a => ({
          id: a.id,
          displayName: a.displayName || a.emailAddress,
          emailAddress: a.emailAddress,
          smtpHost: a.smtpHost,
        }))}
        defaultAccountId={selectedAccountId || accounts[0]?.id}
        replyTo={composerReplyTo ? {
          id: composerReplyTo.id,
          fromEmail: composerReplyTo.fromEmail,
          fromName: composerReplyTo.fromName,
          subject: composerReplyTo.subject,
          toRecipients: composerReplyTo.toRecipients as string[],
          ccRecipients: composerReplyTo.ccRecipients as string[],
          bodyText: composerReplyTo.bodyText,
          bodyHtml: composerReplyTo.bodyHtml,
          messageId: composerReplyTo.messageId,
        } : undefined}
        replyAll={composerReplyAll}
      />

      {aiSettingsAccountId && (
        <EmailAISettings
          open={showAISettings}
          onOpenChange={(open) => {
            setShowAISettings(open);
            if (!open) {
              setAISettingsAccountId("");
              setAISettingsAccountName("");
            }
          }}
          accountId={aiSettingsAccountId}
          accountName={aiSettingsAccountName}
        />
      )}
      
      <ConsultantAIAssistant />
    </div>
  );
}
