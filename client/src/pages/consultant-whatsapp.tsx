import { useState, useEffect, useMemo } from "react";
import { useLocation, useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { 
  MessageSquare, 
  Server, 
  Key, 
  Phone,
  CheckCircle, 
  XCircle, 
  AlertCircle,
  Loader2,
  Save,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  Building2,
  FileText,
  User,
  Edit,
  Bot,
  Users,
  Copy,
  Lightbulb,
  ChevronRight,
  ChevronDown,
  Info,
  Mail,
  ClipboardCheck,
  Upload,
  Link,
  MessageCircle,
  Wand2,
  Check,
  Calendar,
  BookOpen,
  Database,
  ArrowRight,
  Settings,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  Receipt,
  Briefcase,
  Crown,
  Shield,
  MoreHorizontal,
  KeyRound,
  Ban,
  Eye,
  FileDown,
  RefreshCw,
  Target,
  Heart,
  Brain,
  Zap,
  Webhook,
  Send,
  RotateCcw,
  Instagram,
  Linkedin,
  Share2,
  Camera,
  Inbox,
  HelpCircle,
  Mic,
  UserPlus
} from "lucide-react";
import { NavigationTabs } from "@/components/ui/navigation-tabs";
import { isToday, isYesterday, isThisWeek, format } from "date-fns";
import { it } from "date-fns/locale";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import WhatsAppCalendar from "@/components/whatsapp/WhatsAppCalendar";
import WhatsAppOutbound from "@/components/whatsapp/WhatsAppOutbound";
import { getAuthHeaders } from "@/lib/auth";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { AgentInstructionsPanel } from "@/components/whatsapp/AgentInstructionsPanel";
import { whatsappAgentIdeas } from "@/data/whatsapp-agent-ideas";
import { AgentDashboardHeader } from "@/components/whatsapp/AgentDashboardHeader";
import { AgentRoster } from "@/components/whatsapp/AgentRoster";
import { EmployeeRoster } from "@/components/whatsapp/EmployeeRoster";
import { AgentProfilePanel } from "@/components/whatsapp/AgentProfilePanel";
import { AgentLeaderboard } from "@/components/whatsapp/AgentLeaderboard";
import { ActivityFeed } from "@/components/whatsapp/ActivityFeed";
import { WeeklyCheckinCard } from "@/components/whatsapp/WeeklyCheckinCard";
import { LevelBadge } from "@/components/whatsapp/LevelBadge";
import { Progress } from "@/components/ui/progress";
import millieAvatar from "@assets/generated_images/millie_ai_email_assistant_avatar.png";
import echoAvatar from "@assets/generated_images/echo_ai_summarizer_avatar.png";
import specAvatar from "@assets/generated_images/spec_ai_researcher_avatar.png";
import stellaAvatar from "@assets/generated_images/stella_ai_whatsapp_assistant_avatar.png";
import novaAvatar from "@assets/generated_images/nova_ai_social_media_avatar.png";
import archieAvatar from "@assets/generated_images/archie_ai_builder_avatar.png";
import alessiaAvatar from "@assets/generated_images/alessia_ai_voice_consultant_avatar.png";
import ceoAvatar from "@assets/generated_images/realistic_ceo_businessman_headshot.png";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface WhatsAppConfig {
  id?: string;
  agentName: string;
  twilioAccountSid: string;
  twilioAuthToken: string;
  twilioWhatsappNumber: string;
  autoResponseEnabled: boolean;
  agentType?: "reactive_lead" | "proactive_setter" | "informative_advisor" | "customer_success" | "intake_coordinator";
  integrationMode?: "whatsapp_ai" | "ai_only";
  isProactiveAgent?: boolean;
  workingHoursEnabled?: boolean;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  workingDays?: string[];
  afterHoursMessage?: string;
  businessName?: string;
  consultantDisplayName?: string;
  businessDescription?: string;
  consultantBio?: string;
  salesScript?: string;
  vision?: string;
  mission?: string;
  values?: string[];
  usp?: string;
  whoWeHelp?: string;
  whoWeDontHelp?: string;
  whatWeDo?: string;
  howWeDoIt?: string;
  softwareCreated?: Array<{ name: string; description: string }>;
  booksPublished?: Array<{ title: string; year: string }>;
  yearsExperience?: number;
  clientsHelped?: number;
  resultsGenerated?: string;
  caseStudies?: Array<{ clientName: string; result: string }>;
  servicesOffered?: Array<{ name: string; description: string; price: string }>;
  guarantees?: string;
  aiPersonality?: "amico_fidato" | "coach_motivazionale" | "consulente_professionale" | "mentore_paziente" | "venditore_energico" | "consigliere_empatico" | "stratega_diretto" | "educatore_socratico" | "esperto_tecnico" | "compagno_entusiasta";
  whatsappConciseMode?: boolean;
  defaultObiettivi?: string;
  defaultDesideri?: string;
  defaultUncino?: string;
  defaultIdealState?: string;
  isDryRun?: boolean;
  agentInstructions?: string | null;
  agentInstructionsEnabled?: boolean;
  selectedTemplate?: "receptionist" | "marco_setter" | "custom";
  instagramConfigId?: string | null;
  ownInstagramConfigId?: string | null;
  publicSlug?: string | null;
  levels?: string[] | null;
  enableInAIAssistant?: boolean;
}

interface TeamMemberCardProps {
  name: string;
  role: string;
  avatar: string;
  quote: string;
  accentColor: "purple" | "orange" | "cyan" | "emerald" | "gold" | "pink" | "indigo";
  features: Array<{ icon: React.ComponentType<{ className?: string }>; label: string }>;
  details: {
    audience: string;
    whatIDo: string;
    howIDoIt: string;
  };
  ctaLabel: string;
  ctaHref: string;
}

const accentColors = {
  purple: {
    border: "border-purple-200 dark:border-purple-800 hover:border-purple-400 dark:hover:border-purple-600",
    ring: "ring-purple-500/20",
    badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
    button: "bg-purple-600 hover:bg-purple-700 text-white",
    text: "text-purple-600 dark:text-purple-400",
    iconBg: "bg-purple-50 dark:bg-purple-900/20",
  },
  orange: {
    border: "border-orange-200 dark:border-orange-800 hover:border-orange-400 dark:hover:border-orange-600",
    ring: "ring-orange-500/20",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
    button: "bg-orange-600 hover:bg-orange-700 text-white",
    text: "text-orange-600 dark:text-orange-400",
    iconBg: "bg-orange-50 dark:bg-orange-900/20",
  },
  cyan: {
    border: "border-cyan-200 dark:border-cyan-800 hover:border-cyan-400 dark:hover:border-cyan-600",
    ring: "ring-cyan-500/20",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
    button: "bg-cyan-600 hover:bg-cyan-700 text-white",
    text: "text-cyan-600 dark:text-cyan-400",
    iconBg: "bg-cyan-50 dark:bg-cyan-900/20",
  },
  emerald: {
    border: "border-emerald-200 dark:border-emerald-800 hover:border-emerald-400 dark:hover:border-emerald-600",
    ring: "ring-emerald-500/20",
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
    button: "bg-emerald-600 hover:bg-emerald-700 text-white",
    text: "text-emerald-600 dark:text-emerald-400",
    iconBg: "bg-emerald-50 dark:bg-emerald-900/20",
  },
  pink: {
    border: "border-pink-200 dark:border-pink-800 hover:border-pink-400 dark:hover:border-pink-600",
    ring: "ring-pink-500/20",
    badge: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
    button: "bg-pink-600 hover:bg-pink-700 text-white",
    text: "text-pink-600 dark:text-pink-400",
    iconBg: "bg-pink-50 dark:bg-pink-900/20",
  },
  indigo: {
    border: "border-indigo-200 dark:border-indigo-800 hover:border-indigo-400 dark:hover:border-indigo-600",
    ring: "ring-indigo-500/20",
    badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 dark:bg-indigo-900/40 dark:text-indigo-300",
    button: "bg-indigo-600 hover:bg-indigo-700 text-white",
    text: "text-indigo-600 dark:text-indigo-400",
    iconBg: "bg-indigo-50 dark:bg-indigo-900/20",
  },
  teal: {
    border: "border-teal-200 dark:border-teal-800 hover:border-teal-400 dark:hover:border-teal-600",
    ring: "ring-teal-500/20",
    badge: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
    button: "bg-teal-600 hover:bg-teal-700 text-white",
    text: "text-teal-600 dark:text-teal-400",
    iconBg: "bg-teal-50 dark:bg-teal-900/20",
  },
  gold: {
    border: "border-amber-300 dark:border-amber-700 hover:border-amber-500 dark:hover:border-amber-500",
    ring: "ring-amber-400/30",
    badge: "bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 dark:from-amber-900/50 dark:to-yellow-900/50 dark:text-amber-200",
    button: "bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg shadow-amber-500/25",
    text: "text-amber-600 dark:text-amber-400",
    iconBg: "bg-amber-50 dark:bg-amber-900/20",
  },
};

function PartnerWebhookCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [webhookUrl, setWebhookUrl] = useState("");
  const [isEnabled, setIsEnabled] = useState(false);
  const [notifyOnGold, setNotifyOnGold] = useState(true);
  const [notifyOnSilver, setNotifyOnSilver] = useState(false);
  const [secretKey, setSecretKey] = useState("");
  const [isConfigured, setIsConfigured] = useState(false);
  const [linkedSyncSourceId, setLinkedSyncSourceId] = useState<string | undefined>(undefined);
  const [notifyViaQueue, setNotifyViaQueue] = useState(true);
  const [notifyViaWebhook, setNotifyViaWebhook] = useState(true);

  const syncSourcesQuery = useQuery({
    queryKey: ["/api/dataset-sync/sources"],
    queryFn: async () => {
      const res = await fetch("/api/dataset-sync/sources", { headers: getAuthHeaders() });
      if (!res.ok) return { success: false, data: [] };
      return res.json();
    },
  });
  
  const configQuery = useQuery({
    queryKey: ["/api/partner-webhook/config"],
    queryFn: async () => {
      const res = await fetch("/api/partner-webhook/config", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch config");
      return res.json();
    },
  });
  
  const logsQuery = useQuery({
    queryKey: ["/api/partner-webhook/logs"],
    queryFn: async () => {
      const res = await fetch("/api/partner-webhook/logs?limit=5", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
  });
  
  useEffect(() => {
    if (configQuery.data) {
      setWebhookUrl(configQuery.data.webhookUrl || "");
      setIsEnabled(configQuery.data.isEnabled || false);
      setNotifyOnGold(configQuery.data.notifyOnGold ?? true);
      setNotifyOnSilver(configQuery.data.notifyOnSilver ?? false);
      setSecretKey(configQuery.data.secretKey || "");
      setIsConfigured(configQuery.data.configured || false);
      setLinkedSyncSourceId(configQuery.data.linkedSyncSourceId ? String(configQuery.data.linkedSyncSourceId) : undefined);
      setNotifyViaQueue(configQuery.data.notifyViaQueue ?? true);
      setNotifyViaWebhook(configQuery.data.notifyViaWebhook ?? true);
    }
  }, [configQuery.data]);
  
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/partner-webhook/config", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save config");
      return res.json();
    },
    onSuccess: (data) => {
      toast({ title: "Configurazione salvata", description: "Le impostazioni webhook sono state salvate." });
      if (data.config?.secretKey) setSecretKey(data.config.secretKey);
      setIsConfigured(true);
      queryClient.invalidateQueries({ queryKey: ["/api/partner-webhook/config"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile salvare la configurazione", variant: "destructive" });
    },
  });
  
  const testMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/partner-webhook/test", {
        method: "POST",
        headers: getAuthHeaders(),
      });
      return res.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Test riuscito", description: "Il webhook di test è stato inviato con successo." });
      } else {
        toast({ title: "Test fallito", description: data.error || "Errore durante l'invio del test", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/partner-webhook/logs"] });
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile inviare il test webhook", variant: "destructive" });
    },
  });
  
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Copiato!", description: `${label} copiato negli appunti` });
  };
  
  return (
    <Card className="border-2 border-orange-200 dark:border-orange-800">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5 text-orange-600" />
          Notifiche Partner
        </CardTitle>
        <CardDescription>
          Notifica automaticamente i tuoi partner quando un cliente acquista una licenza Gold o Silver
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-orange-50 border-orange-200 dark:bg-orange-950/20 dark:border-orange-800">
          <Info className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-800 dark:text-orange-200 text-sm">
            Quando un cliente acquista tramite Stripe, il sistema notificherà il tuo partner con i dettagli dell'acquisto (email, nome, telefono, tier, data). Scegli come notificare: coda interna, webhook esterno, o entrambi.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="font-medium">Abilita Notifiche Partner</Label>
              <p className="text-xs text-muted-foreground">Attiva l'invio automatico di notifiche al partner</p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => setIsEnabled(checked)}
            />
          </div>

          <div className="space-y-3">
            <Label className="font-medium">Canali di notifica:</Label>
            <p className="text-xs text-muted-foreground">Scegli uno o entrambi i canali per notificare il partner</p>
            <div className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                <Checkbox
                  id="notifyViaQueue"
                  checked={notifyViaQueue}
                  onCheckedChange={(checked) => setNotifyViaQueue(checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyViaQueue" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Database className="h-4 w-4 text-blue-500" />
                    Coda Partner Dashboard (interna)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Aggiunge il cliente alla coda nella Partner Dashboard. Il partner potrà caricare i file direttamente dal browser.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg border bg-muted/50">
                <Checkbox
                  id="notifyViaWebhook"
                  checked={notifyViaWebhook}
                  onCheckedChange={(checked) => setNotifyViaWebhook(checked as boolean)}
                />
                <div className="space-y-1">
                  <Label htmlFor="notifyViaWebhook" className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                    <Webhook className="h-4 w-4 text-orange-500" />
                    Webhook Esterno (URL)
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Invia una richiesta POST all'URL configurato sotto. Ideale per integrazioni con sistemi esterni del partner.
                  </p>
                </div>
              </div>
            </div>
            {!notifyViaQueue && !notifyViaWebhook && isEnabled && (
              <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-800">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-800 dark:text-amber-200 text-sm">
                  Seleziona almeno un canale di notifica, altrimenti nessuna notifica verrà inviata.
                </AlertDescription>
              </Alert>
            )}
          </div>
          
          {notifyViaQueue && (
          <div className="space-y-2">
            <Label className="font-medium">Sorgente Dati Collegata</Label>
            {syncSourcesQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Caricamento sorgenti...
              </div>
            ) : (syncSourcesQuery.data?.data || []).length === 0 ? (
              <Alert className="bg-slate-50 border-slate-200 dark:bg-slate-900/50 dark:border-slate-700">
                <AlertTriangle className="h-4 w-4 text-muted-foreground" />
                <AlertDescription className="text-slate-600 dark:text-slate-400 text-sm">
                  Nessuna sorgente di sincronizzazione trovata. Creane una nella sezione "Sincronizzazione Dati" per collegare gli acquisti Stripe alla Partner Dashboard.
                </AlertDescription>
              </Alert>
            ) : (
              <>
                <Select value={linkedSyncSourceId} onValueChange={setLinkedSyncSourceId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleziona una sorgente..." />
                  </SelectTrigger>
                  <SelectContent>
                    {(syncSourcesQuery.data?.data || []).map((source: any) => (
                      <SelectItem key={source.id} value={String(source.id)}>
                        {source.name} {source.is_active ? "" : "(in pausa)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Quando un cliente acquista tramite Stripe, verrà aggiunto alla coda di questa sorgente nella Partner Dashboard
                </p>
                {linkedSyncSourceId && (() => {
                  const selectedSource = (syncSourcesQuery.data?.data || []).find((s: any) => String(s.id) === linkedSyncSourceId);
                  if (!selectedSource) return null;
                  return (
                    <div className="flex items-center gap-2 mt-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`/partner/dashboard/${selectedSource.api_key}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Apri Dashboard Partner
                      </Button>
                    </div>
                  );
                })()}
              </>
            )}
          </div>
          )}

          {notifyViaWebhook && (
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">URL Webhook Partner</Label>
            <Input
              id="webhookUrl"
              placeholder="https://partner.example.com/webhook/acquisti"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">L'URL dove verranno inviate le notifiche POST</p>
          </div>
          )}
          
          <div className="space-y-3">
            <Label className="font-medium">Notifica per:</Label>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="notifyGold"
                  checked={notifyOnGold}
                  onCheckedChange={(checked) => setNotifyOnGold(checked as boolean)}
                />
                <Label htmlFor="notifyGold" className="flex items-center gap-1 text-sm cursor-pointer">
                  <Crown className="h-4 w-4 text-yellow-500" />
                  Acquisti Gold
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="notifySilver"
                  checked={notifyOnSilver}
                  onCheckedChange={(checked) => setNotifyOnSilver(checked as boolean)}
                />
                <Label htmlFor="notifySilver" className="flex items-center gap-1 text-sm cursor-pointer">
                  <Shield className="h-4 w-4 text-muted-foreground" />
                  Acquisti Silver
                </Label>
              </div>
            </div>
          </div>
          
          {secretKey && (
            <div className="space-y-2">
              <Label>Secret Key (per firma HMAC-SHA256)</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-muted px-3 py-2 rounded text-sm font-mono truncate">
                  {secretKey}
                </code>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(secretKey, "Secret Key")}>
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => saveMutation.mutate({ regenerateSecret: true, webhookUrl, isEnabled, notifyOnGold, notifyOnSilver, notifyViaQueue, notifyViaWebhook, linkedSyncSourceId: linkedSyncSourceId ? parseInt(linkedSyncSourceId) : undefined })}
                  disabled={saveMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Il partner usa questa chiave per verificare l'autenticità delle richieste</p>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate({ webhookUrl, isEnabled, notifyOnGold, notifyOnSilver, notifyViaQueue, notifyViaWebhook, linkedSyncSourceId: linkedSyncSourceId ? parseInt(linkedSyncSourceId) : undefined })}
              disabled={saveMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salva Configurazione
            </Button>
            {isConfigured && (notifyViaWebhook && webhookUrl || notifyViaQueue) && (
              <Button
                variant="outline"
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending || !isEnabled}
              >
                {testMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
                Testa Webhook
              </Button>
            )}
          </div>
        </div>

        {isConfigured && (
          <div className="pt-4 border-t">
            <button
              className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors w-full"
              onClick={(e) => {
                const target = e.currentTarget.nextElementSibling;
                const icon = e.currentTarget.querySelector('.chevron-icon');
                if (target) {
                  target.classList.toggle('hidden');
                  icon?.classList.toggle('rotate-180');
                }
              }}
            >
              <Eye className="h-4 w-4" />
              Anteprima Payload Webhook
              <ChevronDown className="h-4 w-4 chevron-icon transition-transform duration-200 ml-auto" />
            </button>
            <div className="hidden mt-3">
              <p className="text-xs text-muted-foreground mb-2">
                Questo e' un esempio del payload JSON che il partner ricevera' quando un cliente acquista una licenza:
              </p>
              <div className="bg-slate-900 text-slate-100 rounded-lg p-4 text-xs font-mono overflow-x-auto max-h-[400px] overflow-y-auto">
                <pre className="whitespace-pre-wrap">{JSON.stringify({
                  event: "gold_purchase",
                  timestamp: new Date().toISOString(),
                  consultant_id: "il-tuo-consultant-id",
                  subscription: {
                    id: "sub_12345",
                    client_email: "cliente@example.com",
                    client_name: "Mario Rossi",
                    phone: "+39123456789",
                    tier: "gold",
                    status: "active",
                    start_date: new Date().toISOString(),
                    stripe_subscription_id: "sub_stripe_xxx"
                  },
                  dataset_sync: {
                    webhook_url: `${window.location.origin}/api/dataset-sync/webhook/dsync_xxx`,
                    partner_dashboard_url: `${window.location.origin}/partner/dashboard/dsync_xxx`,
                    source_name: "Nome Sorgente",
                    instructions: "Per inviare i dati di questo cliente, usa l'header X-Client-Email con l'email del cliente nella richiesta webhook. Oppure usa la Partner Dashboard per caricare i file direttamente dal browser."
                  }
                }, null, 2)}</pre>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Headers inviati con la richiesta:</p>
                <div className="bg-muted rounded-lg p-3 text-xs font-mono space-y-1">
                  <div><span className="text-blue-600 dark:text-blue-400">Content-Type:</span> application/json</div>
                  <div><span className="text-blue-600 dark:text-blue-400">X-Partner-Signature:</span> sha256=hmac_firma_del_payload</div>
                  <div><span className="text-blue-600 dark:text-blue-400">X-Partner-Timestamp:</span> {new Date().toISOString()}</div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Il campo <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">dataset_sync</code> viene incluso solo se hai una sorgente di sincronizzazione dati attiva collegata. Contiene le istruzioni per il partner su come inviare i dati del nuovo cliente.
                </p>
              </div>
            </div>
          </div>
        )}
        
        {logsQuery.data?.logs?.length > 0 && (
          <div className="pt-4 border-t">
            <Label className="font-medium mb-2 block">Ultime Notifiche</Label>
            <div className="space-y-2">
              {logsQuery.data.logs.map((log: any) => (
                <div key={log.id} className="flex items-center justify-between text-sm p-2 bg-muted/50 rounded">
                  <div className="flex items-center gap-2">
                    {log.success ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="font-medium">
                      {log.eventType === "gold_purchase" ? "Acquisto Gold" : 
                       log.eventType === "silver_purchase" ? "Acquisto Silver" : "Test"}
                    </span>
                    {log.responseStatus && (
                      <Badge variant="outline" className={log.success ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                        {log.responseStatus}
                      </Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {log.createdAt ? format(new Date(log.createdAt), "d MMM HH:mm", { locale: it }) : "—"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function TeamMemberCard({ name, role, avatar, quote, accentColor, features, details, ctaLabel, ctaHref }: TeamMemberCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const colors = accentColors[accentColor];

  return (
    <Card className={`relative bg-card border ${colors.border} rounded-2xl sm:hover:shadow-xl sm:hover:-translate-y-1 transition-all duration-200`}>
      <CardContent className="p-6">
        {/* Avatar */}
        <div className="flex justify-center mb-4">
          <div className={`relative w-24 h-24 rounded-full overflow-hidden ring-4 ${colors.ring} shadow-lg`}>
            <img src={avatar} alt={name} className="w-full h-full object-cover" />
          </div>
        </div>

        {/* Name & Role */}
        <div className="text-center mb-4">
          <h3 className="text-xl font-bold text-foreground">{name}</h3>
          <Badge className={`mt-1 ${colors.badge}`}>{role}</Badge>
        </div>

        {/* Quote */}
        <p className="text-sm text-muted-foreground text-center italic mb-5 leading-relaxed">
          "{quote}"
        </p>

        {/* Features */}
        <div className="space-y-2 mb-5">
          {features.map((feature, idx) => (
            <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
              <div className={`p-1.5 rounded-md ${colors.iconBg}`}>
                <feature.icon className={`h-4 w-4 ${colors.text}`} />
              </div>
              <span className="text-sm font-medium text-foreground">{feature.label}</span>
            </div>
          ))}
        </div>

        {/* Expandable Details */}
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <CollapsibleTrigger asChild>
            <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-gray-700 dark:hover:text-muted-foreground/40 py-2 transition-colors">
              <span>{isExpanded ? "Nascondi dettagli" : "Scopri di più"}</span>
              <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3 pt-3 border-t border-gray-100 dark:border-gray-800">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-gray-800 dark:text-gray-200">A chi mi rivolgo:</span> {details.audience}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Cosa faccio:</span> {details.whatIDo}
              </p>
              <p className="text-xs text-muted-foreground">
                <span className="font-semibold text-gray-800 dark:text-gray-200">Come lo faccio:</span> {details.howIDoIt}
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* CTA Button */}
        <Button
          className={`w-full mt-4 ${colors.button} shadow-md hover:shadow-lg transition-all duration-200`}
          onClick={() => window.location.href = ctaHref}
        >
          {ctaLabel}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </CardContent>
    </Card>
  );
}

const emptyConfig: WhatsAppConfig = {
  agentName: "",
  twilioAccountSid: "",
  twilioAuthToken: "",
  twilioWhatsappNumber: "",
  autoResponseEnabled: true,
  agentType: "reactive_lead" as "reactive_lead" | "proactive_setter",
  workingHoursEnabled: false,
  workingHoursStart: "09:00",
  workingHoursEnd: "18:00",
  workingDays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
  afterHoursMessage: "Ciao! Ti risponderò durante i miei orari di lavoro.",
  businessName: "",
  consultantDisplayName: "",
  businessDescription: "",
  consultantBio: "",
  salesScript: "",
  vision: "",
  mission: "",
  values: [],
  usp: "",
  whoWeHelp: "",
  whoWeDontHelp: "",
  whatWeDo: "",
  howWeDoIt: "",
  softwareCreated: [],
  booksPublished: [],
  yearsExperience: undefined,
  clientsHelped: undefined,
  resultsGenerated: "",
  caseStudies: [],
  servicesOffered: [],
  guarantees: "",
  aiPersonality: "amico_fidato",
  whatsappConciseMode: false,
  defaultObiettivi: "",
  defaultDesideri: "",
  defaultUncino: "",
  defaultIdealState: "",
  isDryRun: true,
  agentInstructions: null,
  agentInstructionsEnabled: false,
  selectedTemplate: "receptionist",
};

export default function ConsultantWhatsAppPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [configToDelete, setConfigToDelete] = useState<WhatsAppConfig | null>(null);
  const [newApiKey, setNewApiKey] = useState("");
  const [showRoutingGuide, setShowRoutingGuide] = useState(false);
  
  // Stati per gestione sottoscrizioni
  const [selectedSubscription, setSelectedSubscription] = useState<any>(null);
  const [isSubscriptionDetailOpen, setIsSubscriptionDetailOpen] = useState(false);
  const [isCancelDialogOpen, setIsCancelDialogOpen] = useState(false);
  const [subscriptionToCancel, setSubscriptionToCancel] = useState<any>(null);

  // Stati per tab Idee
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);
  const [urlInputs, setUrlInputs] = useState<string[]>([""]);
  const [textInput, setTextInput] = useState("");
  const [selectedIntegrations, setSelectedIntegrations] = useState<string[]>(["reactive_lead"]);
  const [numberOfIdeas, setNumberOfIdeas] = useState(3);
  const [generatedIdeas, setGeneratedIdeas] = useState<any[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [selectedKnowledgeDocIds, setSelectedKnowledgeDocIds] = useState<string[]>([]);
  const [businessNameInput, setBusinessNameInput] = useState("");
  const [consultantDisplayNameInput, setConsultantDisplayNameInput] = useState("");
  const [isImprovingText, setIsImprovingText] = useState(false);

  // Stato per dashboard enterprise agenti
  const [selectedAgent, setSelectedAgent] = useState<{
    id: string;
    name: string;
    agentType: string;
    status: "active" | "paused" | "test";
    performanceScore: number;
    trend: "up" | "down" | "stable";
    conversationsToday: number;
  } | null>(null);

  // Stati per gestione utenti (sezione Licenze)
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [bronzeCurrentPage, setBronzeCurrentPage] = useState(1);
  const [silverCurrentPage, setSilverCurrentPage] = useState(1);
  const [goldCurrentPage, setGoldCurrentPage] = useState(1);
  const [userManagementTab, setUserManagementTab] = useState<"bronze" | "silver" | "gold">("bronze");
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const [subscriptionSourceTab, setSubscriptionSourceTab] = useState<"stripe_connect" | "direct_link">("stripe_connect");

  // Stati per dialog reset password manuale
  const [passwordResetTarget, setPasswordResetTarget] = useState<{ type: "bronze" | "silver", id: string, email: string } | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [isPasswordResetDialogOpen, setIsPasswordResetDialogOpen] = useState(false);

  // Stati per Default Onboarding Preferences
  const [onboardingWritingStyle, setOnboardingWritingStyle] = useState("");
  const [onboardingResponseLength, setOnboardingResponseLength] = useState("");
  const [onboardingCustomInstructions, setOnboardingCustomInstructions] = useState("");
  const [isBulkApplyDialogOpen, setIsBulkApplyDialogOpen] = useState(false);
  const [bulkApplyTiers, setBulkApplyTiers] = useState<string[]>([]);

  // Query per caricare i documenti dalla knowledge base
  const knowledgeDocsQuery = useQuery({
    queryKey: ["/api/consultant/onboarding/knowledge-documents"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/knowledge-documents", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch knowledge documents");
      return res.json();
    },
  });

  const knowledgeDocs = knowledgeDocsQuery.data?.data || [];

  // Query per caricare le idee salvate dal backend
  const savedIdeasQuery = useQuery({
    queryKey: ["/api/consultant/onboarding/ai-ideas"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/ai-ideas", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch saved ideas");
      return res.json();
    },
  });

  const savedIdeas = savedIdeasQuery.data?.data || [];

  // Query per caricare le licenze del consulente
  const licensesQuery = useQuery({
    queryKey: ["/api/consultant/licenses"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/licenses", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch licenses");
      return res.json();
    },
  });

  const licenses = licensesQuery.data?.data || {
    level2Total: 0, // Illimitate - nessun limite
    level2Used: 0,
    level3Total: 0, // Illimitate - nessun limite
    level3Used: 0,
    employeeTotal: 5, // 5 licenze gratis incluse
    employeeUsed: 0,
  };

  // Query per caricare lo storico acquisti licenze
  const purchasesQuery = useQuery({
    queryKey: ["/api/consultant/licenses/purchases"],
    queryFn: async () => {
      const response = await fetch("/api/consultant/licenses/purchases", { headers: getAuthHeaders() });
      if (!response.ok) return [];
      return response.json();
    },
  });

  // Query per caricare le preferenze onboarding predefinite
  const defaultOnboardingPrefsQuery = useQuery({
    queryKey: ["/api/consultant/default-onboarding-preferences"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/default-onboarding-preferences", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Popola i campi quando i dati vengono caricati
  useEffect(() => {
    if (defaultOnboardingPrefsQuery.data?.preferences) {
      const prefs = defaultOnboardingPrefsQuery.data.preferences;
      setOnboardingWritingStyle(prefs.writingStyle || "");
      setOnboardingResponseLength(prefs.responseLength || "");
      setOnboardingCustomInstructions(prefs.customInstructions || "");
    }
  }, [defaultOnboardingPrefsQuery.data]);

  // Mutation per salvare le preferenze onboarding predefinite
  const saveOnboardingPrefsMutation = useMutation({
    mutationFn: async (data: { writingStyle: string; responseLength: string; customInstructions: string }) => {
      const res = await fetch("/api/consultant/default-onboarding-preferences", {
        method: "PUT",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to save preferences");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/default-onboarding-preferences"] });
      toast({
        title: "✅ Preferenze salvate",
        description: "Le preferenze di onboarding predefinite sono state aggiornate.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile salvare le preferenze",
        variant: "destructive",
      });
    },
  });

  // Mutation per applicare le preferenze a tutti i clienti
  const bulkApplyPrefsMutation = useMutation({
    mutationFn: async (data: { writingStyle: string; responseLength: string; customInstructions: string; targetTiers: string[] }) => {
      const res = await fetch("/api/consultant/bulk-apply-preferences", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to apply preferences");
      return res.json();
    },
    onSuccess: (data) => {
      setIsBulkApplyDialogOpen(false);
      setBulkApplyTiers([]);
      toast({
        title: "✅ Preferenze applicate",
        description: `Le preferenze sono state applicate a ${data.updatedCount || 0} clienti.`,
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile applicare le preferenze ai clienti",
        variant: "destructive",
      });
    },
  });

  // Mutation per checkout acquisto licenze
  const buyLicensesMutation = useMutation({
    mutationFn: async (quantity: number) => {
      const response = await fetch("/api/consultant/licenses/checkout", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ quantity }),
      });
      if (!response.ok) throw new Error("Checkout failed");
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile avviare il checkout",
        variant: "destructive",
      });
    },
  });

  // Query per caricare le sottoscrizioni dei clienti
  const subscriptionsQuery = useQuery({
    queryKey: ["/api/consultant/subscriptions"],
    queryFn: async () => {
      // Add cache-busting to always get fresh Stripe data
      const res = await fetch(`/api/consultant/subscriptions?_t=${Date.now()}`, {
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
        },
      });
      if (!res.ok) throw new Error("Failed to fetch subscriptions");
      return res.json();
    },
  });

  const subscriptions = Array.isArray(subscriptionsQuery.data?.data) ? subscriptionsQuery.data.data : 
                        Array.isArray(subscriptionsQuery.data) ? subscriptionsQuery.data : [];

  // Mutations per gestione sottoscrizioni
  const cancelSubscriptionMutation = useMutation({
    mutationFn: async ({ subscriptionId, cancelImmediately }: { subscriptionId: string; cancelImmediately: boolean }) => {
      const res = await fetch(`/api/consultant/subscriptions/${subscriptionId}/cancel`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ cancelImmediately }),
      });
      if (!res.ok) throw new Error("Failed to cancel subscription");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/subscriptions"] });
      setIsCancelDialogOpen(false);
      setSubscriptionToCancel(null);
      toast({
        title: "Abbonamento annullato",
        description: data.canceledImmediately 
          ? "L'abbonamento è stato annullato immediatamente" 
          : "L'abbonamento verrà annullato alla fine del periodo corrente",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile annullare l'abbonamento",
        variant: "destructive",
      });
    },
  });

  const resetBronzePasswordMutation = useMutation({
    mutationFn: async ({ userId, newPassword }: { userId: string; newPassword: string }) => {
      const res = await fetch(`/api/consultant/pricing/users/bronze/${userId}/reset-password`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password aggiornata", description: "La nuova password è stata impostata con successo" });
      setIsPasswordResetDialogOpen(false);
      setNewPasswordInput("");
      setPasswordResetTarget(null);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile reimpostare la password", variant: "destructive" });
    },
  });

  const resetSilverPasswordMutation = useMutation({
    mutationFn: async ({ subscriptionId, newPassword }: { subscriptionId: string; newPassword: string }) => {
      const res = await fetch(`/api/consultant/pricing/users/silver/${subscriptionId}/reset-password`, {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      if (!res.ok) throw new Error("Failed to reset password");
      return res.json();
    },
    onSuccess: () => {
      toast({ title: "Password aggiornata", description: "La nuova password è stata impostata con successo" });
      setIsPasswordResetDialogOpen(false);
      setNewPasswordInput("");
      setPasswordResetTarget(null);
    },
    onError: () => {
      toast({ title: "Errore", description: "Impossibile reimpostare la password", variant: "destructive" });
    },
  });

  // Queries per gestione utenti (Bronze/Silver/Gold)
  const bronzeUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/bronze", userSearchQuery, bronzeCurrentPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: bronzeCurrentPage.toString(), limit: "10" });
      if (userSearchQuery) params.set("search", userSearchQuery);
      const res = await fetch(`/api/consultant/pricing/users/bronze?${params}`, { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const silverUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/silver", silverCurrentPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: silverCurrentPage.toString(), limit: "10" });
      const res = await fetch(`/api/consultant/pricing/users/silver?${params}`, { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const goldUsersQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/gold", goldCurrentPage],
    queryFn: async () => {
      const params = new URLSearchParams({ page: goldCurrentPage.toString(), limit: "10" });
      const res = await fetch(`/api/consultant/pricing/users/gold?${params}`, { headers: getAuthHeaders() });
      return res.json();
    }
  });

  const userStatsQuery = useQuery({
    queryKey: ["/api/consultant/pricing/users/stats"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/pricing/users/stats", { headers: getAuthHeaders() });
      return res.json();
    }
  });

  // Mutation per eliminazione utente Bronze
  const deleteBronzeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await fetch(`/api/consultant/pricing/users/bronze/${userId}`, {
        method: "DELETE",
        headers: getAuthHeaders()
      });
      if (!res.ok) throw new Error("Failed to delete user");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/pricing/users/bronze"] });
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/pricing/users/stats"] });
      setUserToDelete(null);
      toast({ title: "Utente eliminato", description: "L'utente Bronze è stato eliminato con successo." });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  // Query per ottenere i dati del consulente (per pricing page)
  const consultantDataQuery = useQuery({
    queryKey: ["/api/consultant/profile"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/profile", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) return null;
      return res.json();
    },
  });

  const consultantData = consultantDataQuery.data;

  // Group saved ideas by date
  const groupedSavedIdeas = useMemo(() => {
    const groups: { [key: string]: any[] } = {
      "Oggi": [],
      "Ieri": [],
      "Questa Settimana": [],
      "Precedenti": [],
    };

    savedIdeas.forEach((idea: any) => {
      const createdAt = new Date(idea.createdAt);
      if (isToday(createdAt)) {
        groups["Oggi"].push(idea);
      } else if (isYesterday(createdAt)) {
        groups["Ieri"].push(idea);
      } else if (isThisWeek(createdAt)) {
        groups["Questa Settimana"].push(idea);
      } else {
        groups["Precedenti"].push(idea);
      }
    });

    return groups;
  }, [savedIdeas]);

  // Mutation per salvare un'idea
  const saveIdeaMutation = useMutation({
    mutationFn: async (idea: any) => {
      const res = await fetch("/api/consultant/onboarding/ai-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: idea.name,
          description: idea.description,
          targetAudience: idea.target || idea.personality,
          agentType: "whatsapp",
          integrationTypes: idea.integrations || idea.integrationTypes || [],
          sourceType: "generated",
          suggestedAgentType: idea.suggestedAgentType,
          personality: idea.personality,
          whoWeHelp: idea.whoWeHelp,
          whoWeDontHelp: idea.whoWeDontHelp,
          whatWeDo: idea.whatWeDo,
          howWeDoIt: idea.howWeDoIt,
          usp: idea.usp,
          suggestedInstructions: idea.suggestedInstructions,
          useCases: idea.useCases,
          vision: idea.vision,
          mission: idea.mission,
          businessName: idea.businessName,
          consultantDisplayName: idea.consultantDisplayName,
        }),
      });
      if (!res.ok) throw new Error("Failed to save idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      toast({
        title: "💡 Idea salvata",
        description: "L'idea è stata salvata nel database.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per salvare e creare agente subito (directly without wizard)
  const saveAndCreateAgentMutation = useMutation({
    mutationFn: async ({ idea, filesToUpload, knowledgeDocIds }: { idea: any; filesToUpload: File[]; knowledgeDocIds: number[] }) => {
      // First save the idea
      const saveRes = await fetch("/api/consultant/onboarding/ai-ideas", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: idea.name,
          description: idea.description,
          targetAudience: idea.target || idea.personality,
          agentType: "whatsapp",
          integrationTypes: idea.integrations || idea.integrationTypes || [],
          sourceType: "generated",
          suggestedAgentType: idea.suggestedAgentType,
          personality: idea.personality,
          whoWeHelp: idea.whoWeHelp,
          whoWeDontHelp: idea.whoWeDontHelp,
          whatWeDo: idea.whatWeDo,
          howWeDoIt: idea.howWeDoIt,
          usp: idea.usp,
          suggestedInstructions: idea.suggestedInstructions,
          useCases: idea.useCases,
          vision: idea.vision,
          mission: idea.mission,
          businessName: idea.businessName,
          consultantDisplayName: idea.consultantDisplayName,
        }),
      });
      if (!saveRes.ok) throw new Error("Failed to save idea");
      const savedIdea = await saveRes.json();
      const savedIdeaId = savedIdea.data?.id || savedIdea.id;

      // Then create the agent directly from the idea
      const createRes = await fetch("/api/whatsapp/config/from-idea", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ideaId: savedIdeaId }),
      });
      if (!createRes.ok) throw new Error("Failed to create agent from idea");
      const agentResult = await createRes.json();
      const agentData = agentResult.data || agentResult;
      const agentId = agentData?.id;

      // Upload files to the agent's Knowledge Base
      let uploadedDocsCount = 0;
      if (agentId && filesToUpload.length > 0) {
        for (const file of filesToUpload) {
          try {
            const formData = new FormData();
            formData.append("file", file);
            formData.append("title", file.name.replace(/\.[^/.]+$/, "")); // Remove extension for title

            // Determine file type
            let fileType = "txt";
            if (file.type === "application/pdf") {
              fileType = "pdf";
            } else if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.type === "application/msword") {
              fileType = "docx";
            } else if (file.type === "text/plain") {
              fileType = "txt";
            }
            formData.append("type", fileType);

            const uploadRes = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge`, {
              method: "POST",
              headers: getAuthHeaders(),
              body: formData,
            });

            if (uploadRes.ok) {
              uploadedDocsCount++;
            } else {
              console.warn(`Failed to upload file ${file.name} to agent KB`);
            }
          } catch (uploadError) {
            console.error(`Error uploading file ${file.name}:`, uploadError);
          }
        }
      }

      // Import Knowledge Base documents into the agent
      let importedKbDocsCount = 0;
      if (agentId && knowledgeDocIds && knowledgeDocIds.length > 0) {
        try {
          const importRes = await fetch(`/api/whatsapp/agent-config/${agentId}/knowledge/import`, {
            method: "POST",
            headers: {
              ...getAuthHeaders(),
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ documentIds: knowledgeDocIds }),
          });
          if (importRes.ok) {
            const importData = await importRes.json();
            importedKbDocsCount = importData.importedCount || knowledgeDocIds.length;
            console.log(`✅ Imported ${importedKbDocsCount} KB documents into agent`);
          } else {
            console.warn(`Failed to import KB documents into agent`);
          }
        } catch (importError) {
          console.error(`Error importing KB documents:`, importError);
        }
      }

      return { ...agentResult, uploadedDocsCount, importedKbDocsCount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      const agentData = data.data || data;
      const agentName = agentData?.agentName || agentData?.name || "Nuovo agente";
      const agentId = agentData?.id;
      const uploadedCount = data.uploadedDocsCount || 0;
      const importedCount = data.importedKbDocsCount || 0;
      const totalDocs = uploadedCount + importedCount;

      // Clear uploaded files and knowledge doc selection after successful agent creation
      setUploadedFiles([]);
      setSelectedKnowledgeDocIds([]);

      // Build description based on what was imported
      let description = `L'agente "${agentName}" è stato creato con successo.`;
      if (totalDocs > 0) {
        const parts = [];
        if (uploadedCount > 0) parts.push(`${uploadedCount} file caricati`);
        if (importedCount > 0) parts.push(`${importedCount} dalla Knowledge Base`);
        description = `Agente "${agentName}" creato! ${parts.join(' + ')} importati.`;
      }

      toast({
        title: "🤖 Agente creato!",
        description,
      });
      // Navigate to the agent edit page if we have an ID, otherwise to list
      if (agentId) {
        navigate(`/consultant/whatsapp/agent/${agentId}`);
      } else {
        navigate("/consultant/whatsapp");
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Mutation per eliminare un'idea
  const deleteIdeaMutation = useMutation({
    mutationFn: async (ideaId: string) => {
      const res = await fetch(`/api/consultant/onboarding/ai-ideas/${ideaId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to delete idea");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/onboarding/ai-ideas"] });
      toast({
        title: "🗑️ Idea rimossa",
        description: "L'idea è stata eliminata.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const searchParams = new URLSearchParams(useSearch());
  const tabParam = searchParams.get("tab");
  const initialTab = tabParam === "system" ? "system" : "custom";

  // Load existing WhatsApp configs
  const { data: existingConfigs, isLoading } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        if (response.status === 404) return { configs: [] };
        throw new Error("Failed to fetch WhatsApp config");
      }
      const data = await response.json();
      return data;
    },
  });

  const configs = existingConfigs?.configs || [];

  // Query per caricare i dati delle statistiche agenti dal backend
  const { data: agentStatsData, isLoading: isLoadingStats } = useQuery<Array<{
    id: string;
    name: string;
    type: string;
    isActive: boolean;
    score: number;
    conversations7d: number;
    rank: number;
  }>>({
    queryKey: ["/api/whatsapp/agents/leaderboard"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agents/leaderboard", { 
        headers: getAuthHeaders() 
      });
      if (!res.ok) throw new Error("Failed to fetch agent stats");
      const data = await res.json();
      return Array.isArray(data) ? data : (data.agents || []);
    },
    enabled: configs.length > 0,
    staleTime: 30000,
  });

  const agentStats = (agentStatsData || []).map((agent: any) => ({
    id: agent.id,
    name: agent.name,
    agentType: agent.type || agent.agentType || "reactive_lead",
    status: agent.isActive === false ? "paused" : "active",
    performanceScore: agent.score || 0,
    trend: "stable" as const,
    conversationsToday: agent.conversations7d || 0,
  }));

  // Check for duplicate WhatsApp numbers across agents
  const duplicateNumbersInfo = useMemo(() => {
    if (!configs || configs.length === 0) return [];
    
    const numberToAgents: Record<string, Array<{id: string, name: string}>> = {};
    
    configs.forEach((config: WhatsAppConfig) => {
      const number = config.twilioWhatsappNumber?.trim();
      if (!number) return;
      
      if (!numberToAgents[number]) {
        numberToAgents[number] = [];
      }
      numberToAgents[number].push({
        id: config.id || '',
        name: config.agentName || 'Senza nome'
      });
    });
    
    // Return only numbers that have more than one agent
    return Object.entries(numberToAgents)
      .filter(([_, agents]) => agents.length > 1)
      .map(([number, agents]) => ({ number, agents }));
  }, [configs]);

  // Delete WhatsApp config mutation
  const deleteMutation = useMutation({
    mutationFn: async (configId: string) => {
      const response = await fetch(`/api/whatsapp/config/${configId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete configuration");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/config"] });
      setIsDeleteDialogOpen(false);
      setConfigToDelete(null);
      toast({
        title: "✅ Agente eliminato",
        description: "La configurazione dell'agente è stata eliminata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Duplicate WhatsApp config mutation
  const duplicateMutation = useMutation({
    mutationFn: async (config: WhatsAppConfig) => {
      const duplicateData = {
        agentName: `${config.agentName} - Copia`,
        // Credenziali Twilio - copiate dall'agente originale
        twilioAccountSid: config.twilioAccountSid || "",
        twilioAuthToken: config.twilioAuthToken || "",
        twilioWhatsappNumber: config.twilioWhatsappNumber || "",
        integrationMode: config.integrationMode || "whatsapp_ai",
        autoResponseEnabled: config.autoResponseEnabled,
        agentType: config.agentType,
        // Working Hours
        workingHoursEnabled: config.workingHoursEnabled,
        workingHoursStart: config.workingHoursStart,
        workingHoursEnd: config.workingHoursEnd,
        workingDays: config.workingDays,
        afterHoursMessage: config.afterHoursMessage,
        // Business Profile
        businessName: config.businessName,
        consultantDisplayName: config.consultantDisplayName,
        businessDescription: config.businessDescription,
        consultantBio: config.consultantBio,
        salesScript: config.salesScript,
        // Authority & Positioning
        vision: config.vision,
        mission: config.mission,
        values: config.values,
        usp: config.usp,
        whoWeHelp: config.whoWeHelp,
        whoWeDontHelp: config.whoWeDontHelp,
        whatWeDo: config.whatWeDo,
        howWeDoIt: config.howWeDoIt,
        // Software & Books
        softwareCreated: config.softwareCreated,
        booksPublished: config.booksPublished,
        // Proof & Credibility
        yearsExperience: config.yearsExperience,
        clientsHelped: config.clientsHelped,
        resultsGenerated: config.resultsGenerated,
        caseStudies: config.caseStudies,
        // Services & Guarantees
        servicesOffered: config.servicesOffered,
        guarantees: config.guarantees,
        // AI Personality
        aiPersonality: config.aiPersonality,
        whatsappConciseMode: config.whatsappConciseMode,
        // Proactive Lead Defaults
        defaultObiettivi: config.defaultObiettivi,
        defaultDesideri: config.defaultDesideri,
        defaultUncino: config.defaultUncino,
        defaultIdealState: config.defaultIdealState,
        // Dry Run & Agent Settings
        isDryRun: config.isDryRun,
        isProactiveAgent: config.isProactiveAgent,
        // Agent Instructions
        agentInstructions: config.agentInstructions,
        agentInstructionsEnabled: config.agentInstructionsEnabled,
        selectedTemplate: config.selectedTemplate,
        // Feature Blocks
        bookingEnabled: config.bookingEnabled,
        objectionHandlingEnabled: config.objectionHandlingEnabled,
        disqualificationEnabled: config.disqualificationEnabled,
        upsellingEnabled: config.upsellingEnabled,
        // WhatsApp Templates
        whatsappTemplates: config.whatsappTemplates,
        templateBodies: config.templateBodies,
        // Business Header Configuration
        businessHeaderMode: config.businessHeaderMode,
        professionalRole: config.professionalRole,
        customBusinessHeader: config.customBusinessHeader,
        // TTS Configuration
        ttsEnabled: config.ttsEnabled,
        audioResponseMode: config.audioResponseMode,
        // Availability Settings
        availabilityTimezone: config.availabilityTimezone,
        availabilityAppointmentDuration: config.availabilityAppointmentDuration,
        availabilityBufferBefore: config.availabilityBufferBefore,
        availabilityBufferAfter: config.availabilityBufferAfter,
        availabilityMaxDaysAhead: config.availabilityMaxDaysAhead,
        availabilityMinHoursNotice: config.availabilityMinHoursNotice,
        availabilityWorkingHours: config.availabilityWorkingHours,
        // Account References & Notes
        twilioAccountReference: config.twilioAccountReference,
        twilioNotes: config.twilioNotes,
        // AI Assistant Integration
        enableInAIAssistant: config.enableInAIAssistant,
        fileSearchCategories: config.fileSearchCategories,
      };

      return duplicateData;
    },
    onSuccess: (duplicateData) => {
      // Navigate to new agent page with duplicated data (store temporarily in session)
      sessionStorage.setItem('duplicateAgentData', JSON.stringify(duplicateData));
      navigate("/consultant/whatsapp/agent/new");
      toast({
        title: "📋 Agente pronto per la duplicazione",
        description: "Completa le credenziali Twilio e salva per creare la copia.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleAddNew = () => {
    navigate("/consultant/whatsapp/agent/new");
  };

  const handleEdit = (config: WhatsAppConfig) => {
    navigate(`/consultant/whatsapp/agent/${config.id}`);
  };

  const handleDelete = (config: WhatsAppConfig) => {
    setConfigToDelete(config);
    setIsDeleteDialogOpen(true);
  };

  const handleConfirmDelete = () => {
    if (configToDelete?.id) {
      deleteMutation.mutate(configToDelete.id);
    }
  };

  const handleDuplicate = (config: WhatsAppConfig) => {
    duplicateMutation.mutate(config);
  };

  // Load API Keys
  const { data: apiKeysData, isLoading: keysLoading } = useQuery({
    queryKey: ["/api/whatsapp/api-keys"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/api-keys", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to load API keys");
      return response.json();
    },
  });

  const apiKeys = apiKeysData?.keys || [];
  const keysCount = apiKeysData?.count || 0;
  const maxKeys = apiKeysData?.maxKeys || 50;

  // Add API Key mutation
  const addKeyMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      const response = await fetch("/api/whatsapp/api-keys", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ apiKey }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message);
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      setNewApiKey("");
      toast({
        title: "✅ API Key aggiunta",
        description: "La chiave è stata aggiunta con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete API Key mutation
  const deleteKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to delete key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
      toast({
        title: "✅ API Key rimossa",
        description: "La chiave è stata rimossa con successo.",
      });
    },
  });

  // Toggle API Key mutation
  const toggleKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const response = await fetch(`/api/whatsapp/api-keys/${keyId}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to toggle key");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/api-keys"] });
    },
  });

  const handleAddKey = () => {
    if (!newApiKey.trim() || newApiKey.trim().length < 20) {
      toast({
        title: "⚠️ API Key non valida",
        description: "Inserisci una API key Gemini valida (minimo 20 caratteri).",
        variant: "destructive",
      });
      return;
    }
    addKeyMutation.mutate(newApiKey.trim());
  };

  return (
    <WhatsAppLayout 
      showHeader={false}
    >
      <div className="max-w-7xl mx-auto space-y-4 sm:space-y-6">
        {/* Unified Header with KPI */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 p-4 sm:p-6 lg:p-8 text-white shadow-2xl">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/10 via-transparent to-transparent" />
          <div className="absolute top-0 right-0 w-72 h-72 bg-blue-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="relative z-10 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-500/30">
                  <Bot className="h-7 w-7 text-white" />
                </div>
                <div>
                  <h1 className="text-2xl lg:text-3xl font-bold tracking-tight">Dipendenti AI</h1>
                  <p className="text-blue-200/70 text-sm mt-0.5">
                    Il tuo team intelligente multi-canale
                  </p>
                </div>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/10">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                  <span className="text-xs text-green-300 font-medium">Operativi 24/7</span>
                </div>
                <Button 
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm hidden sm:inline-flex"
                  onClick={() => setShowRoutingGuide(true)}
                >
                  <HelpCircle className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Guida Routing</span>
                </Button>
                <Button 
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm"
                  onClick={() => window.location.href = '/consultant/whatsapp-agents-chat'}
                >
                  <MessageCircle className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Chat Agenti</span>
                </Button>
                <Button 
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm"
                  onClick={() => window.location.href = '/live-consultation'}
                >
                  <Mic className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Live Consultation</span>
                </Button>
                <Button 
                  variant="secondary"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border border-white/10 backdrop-blur-sm"
                  onClick={() => window.location.href = '/consultant/sales-agents/new'}
                >
                  <UserPlus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nuovo Venditore AI</span>
                </Button>
                <Button 
                  size="sm"
                  onClick={handleAddNew}
                  className="bg-white text-slate-900 hover:bg-blue-50 shadow-md font-semibold"
                >
                  <Plus className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Nuovo Agente</span>
                  <span className="sm:hidden">Nuovo</span>
                </Button>
              </div>
            </div>

            {/* Channel badges */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/20">
                <MessageCircle className="h-3.5 w-3.5 text-green-400" />
                <span className="text-xs font-medium text-green-300">WhatsApp</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/20">
                <Instagram className="h-3.5 w-3.5 text-purple-400" />
                <span className="text-xs font-medium text-purple-300">Instagram</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/15 border border-blue-500/20">
                <ExternalLink className="h-3.5 w-3.5 text-blue-400" />
                <span className="text-xs font-medium text-blue-300">Sito Web</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/20">
                <Bot className="h-3.5 w-3.5 text-amber-400" />
                <span className="text-xs font-medium text-amber-300">Chat AI</span>
              </div>
            </div>

            {/* KPI Metrics */}
            <AgentDashboardHeader variant="mission-control" />
          </div>
        </div>

        {/* Duplicate WhatsApp Numbers Warning */}
        {duplicateNumbersInfo.length > 0 && (
          <Alert variant="destructive" className="bg-amber-50 border-amber-300 text-amber-900">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <AlertDescription className="ml-2">
              <div className="font-semibold mb-1">Numeri WhatsApp duplicati rilevati</div>
              <div className="text-sm">
                I seguenti numeri sono assegnati a più agenti. Ogni agente dovrebbe avere un numero univoco per funzionare correttamente:
                <ul className="list-disc ml-5 mt-2 space-y-1">
                  {duplicateNumbersInfo.map(({ number, agents }) => (
                    <li key={number}>
                      <span className="font-mono font-medium">{number}</span>
                      {" → "}
                      {agents.map((a, i) => (
                        <span key={a.id}>
                          <button
                            onClick={() => navigate(`/consultant/whatsapp/agent/${a.id}`)}
                            className="text-amber-700 hover:text-amber-900 underline font-medium"
                          >
                            {a.name}
                          </button>
                          {i < agents.length - 1 && ", "}
                        </span>
                      ))}
                    </li>
                  ))}
                </ul>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Category Tabs */}
        <Tabs defaultValue={initialTab} className="space-y-6">
          <div className="bg-card rounded-2xl border border-border shadow-sm p-1.5 overflow-x-auto no-scrollbar">
            <TabsList className="flex w-full sm:grid sm:grid-cols-6 gap-1 bg-transparent h-auto p-0 min-w-max sm:min-w-0">
              <TabsTrigger 
                value="custom" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Bot className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Agenti</span>
              </TabsTrigger>
              <TabsTrigger 
                value="system" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Users className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Sistema</span>
              </TabsTrigger>
              <TabsTrigger 
                value="ideas" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Lightbulb className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Idee AI</span>
              </TabsTrigger>
              <TabsTrigger 
                value="calendario" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Calendar className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Calendario</span>
              </TabsTrigger>
              <TabsTrigger 
                value="employees" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Crown className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Dipendenti</span>
              </TabsTrigger>
              <TabsTrigger 
                value="licenses" 
                className="flex-1 py-2.5 px-3 sm:px-4 rounded-xl text-sm font-medium data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:shadow-md transition-all flex items-center justify-center gap-1.5 min-w-[44px]"
              >
                <Key className="h-4 w-4 flex-shrink-0" />
                <span className="hidden sm:inline">Licenze</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="custom" className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center items-center p-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground/60" />
              </div>
            ) : configs.length === 0 ? (
              <Card className="border-dashed border-2 border-border">
                <CardContent className="flex flex-col items-center justify-center p-12">
                  <Bot className="h-16 w-16 text-muted-foreground/60 mb-4" />
                  <h3 className="text-xl font-semibold text-foreground mb-2">
                    Nessun agente configurato
                  </h3>
                  <p className="text-muted-foreground text-center mb-6">
                    Crea il tuo primo agente WhatsApp AI per iniziare a gestire conversazioni automatizzate.
                  </p>
                  <Button onClick={handleAddNew} className="bg-green-600 hover:bg-green-700">
                    <Plus className="h-4 w-4 mr-2" />
                    Crea Primo Agente
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Channel Summary Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="relative group bg-card rounded-2xl border border-border p-4 sm:hover:shadow-lg sm:hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-green-400 to-emerald-500" />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-xl bg-green-50 dark:bg-green-900/30">
                        <MessageCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">WhatsApp</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {configs?.length || 0}
                        </p>
                        <p className="text-xs text-muted-foreground">dipendenti attivi</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-2 border-green-500 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>
                  </div>

                  <div className="relative group bg-card rounded-2xl border border-border p-4 sm:hover:shadow-lg sm:hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-purple-400 to-pink-500" />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-900/30">
                        <Instagram className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Instagram</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {configs.filter((c: WhatsAppConfig) => c.instagramConfigId || c.ownInstagramConfigId).length}
                        </p>
                        <p className="text-xs text-muted-foreground">integrati con DM</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>
                  </div>

                  <div className="relative group bg-card rounded-2xl border border-border p-4 sm:hover:shadow-lg sm:hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-blue-400 to-cyan-500" />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/30">
                        <ExternalLink className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Sito Web</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {configs.filter((c: WhatsAppConfig) => c.publicSlug).length}
                        </p>
                        <p className="text-xs text-muted-foreground">condivisioni attive</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                        <div className="w-8 h-8 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" style={{ animationDuration: '3s' }} />
                      </div>
                    </div>
                  </div>

                  <div className="relative group bg-card rounded-2xl border border-border p-4 sm:hover:shadow-lg sm:hover:-translate-y-0.5 transition-all duration-200 overflow-hidden">
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 to-orange-500" />
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-900/30">
                        <Bot className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                      </div>
                      <span className="text-sm font-semibold text-foreground">Parla con il tuo dipendente</span>
                    </div>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-2xl font-bold text-foreground">
                          {configs.filter((c: WhatsAppConfig) => c.enableInAIAssistant).length || 1}
                        </p>
                        <p className="text-xs text-muted-foreground">assistenti con memoria</p>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                        <Brain className="h-5 w-5 text-amber-500" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Layout principale: Roster + Profile */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  <div className="lg:col-span-4">
                    <AgentRoster 
                      onSelectAgent={(agent) => setSelectedAgent(agent)}
                      selectedAgentId={selectedAgent?.id}
                    />
                  </div>
                  
                  <div className="lg:col-span-8">
                    <AgentProfilePanel 
                      selectedAgent={selectedAgent}
                      onDeleteAgent={(agentId) => {
                        const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                        if (config) handleDelete(config);
                      }}
                      onDuplicateAgent={(agentId) => {
                        const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                        if (config) handleDuplicate(config);
                      }}
                    />
                  </div>
                </div>
                
                {/* Check-in Settimanale Automatico */}
                <div className="mt-6">
                  <WeeklyCheckinCard />
                </div>
              </div>
            )}

          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            {/* Hero Header - Team Style */}
            <div className="text-center space-y-3 py-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/25">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-foreground">
                Il Mio Team AI
              </h2>
              <p className="text-muted-foreground max-w-lg mx-auto">
                Conosci i tuoi assistenti virtuali che lavorano per te 24/7
              </p>
            </div>

            {/* CEO Hero Card - Il Consulente del Consulente */}
            <div className="relative mb-8">
              <div className="absolute inset-0 bg-gradient-to-r from-amber-500/10 via-yellow-500/10 to-amber-500/10 rounded-3xl blur-xl" />
              <Card className="relative bg-gradient-to-br from-white via-amber-50/30 to-yellow-50/30 dark:from-gray-900 dark:via-amber-950/20 dark:to-yellow-950/20 border-2 border-amber-300 dark:border-amber-700 rounded-3xl shadow-xl shadow-amber-500/10 overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex flex-col lg:flex-row items-center gap-8">
                    {/* Avatar grande */}
                    <div className="flex-shrink-0">
                      <div className="relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-400 to-yellow-500 rounded-full blur-lg opacity-40" />
                        <div className="relative w-40 h-40 rounded-full overflow-hidden ring-4 ring-amber-400/40 shadow-2xl">
                          <img src={ceoAvatar} alt="Marco - CEO" className="w-full h-full object-cover" />
                        </div>
                        <div className="absolute -bottom-2 -right-2 bg-gradient-to-r from-amber-500 to-yellow-500 rounded-full p-2 shadow-lg">
                          <Crown className="h-6 w-6 text-white" />
                        </div>
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 text-center lg:text-left space-y-4">
                      <div>
                        <div className="flex items-center justify-center lg:justify-start gap-3 mb-2">
                          <h3 className="text-3xl font-bold text-foreground">Marco</h3>
                          <Badge className="bg-gradient-to-r from-amber-100 to-yellow-100 text-amber-800 dark:from-amber-900/50 dark:to-yellow-900/50 dark:text-amber-200 border border-amber-300 dark:border-amber-700">
                            CEO & Consulente Personale
                          </Badge>
                        </div>
                        <p className="text-lg text-gray-600 dark:text-muted-foreground/40 italic">
                          "Sono il tuo consulente personale. Scrivi su WhatsApp a qualsiasi dipendente AI che hai creato e ti rispondo io, proprio come se fossi nella piattaforma."
                        </p>
                      </div>

                      {/* Features in row */}
                      <div className="flex flex-wrap justify-center lg:justify-start gap-3">
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          <Brain className="h-4 w-4" />
                          <span className="text-sm font-medium">Supervisiona ogni AI</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-sm font-medium">Risponde su WhatsApp</span>
                        </div>
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200">
                          <Zap className="h-4 w-4" />
                          <span className="text-sm font-medium">Aggiorna strategie in tempo reale</span>
                        </div>
                      </div>

                      {/* CTA */}
                      <div className="flex flex-wrap justify-center lg:justify-start gap-3 pt-2">
                        <Button
                          className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-600 hover:to-yellow-600 text-white shadow-lg shadow-amber-500/25"
                          onClick={() => window.location.href = "/consultant/ai-assistant"}
                        >
                          <MessageCircle className="h-4 w-4 mr-2" />
                          Parla con Marco
                        </Button>
                        <Button
                          variant="outline"
                          className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-50 dark:hover:bg-amber-950/30"
                          onClick={() => window.location.href = "/consultant/whatsapp?tab=agents"}
                        >
                          <Users className="h-4 w-4 mr-2" />
                          Gestisci Team AI
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Team AI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Card 1 - Millie */}
              <TeamMemberCard
                name="Millie"
                role="Email Writer"
                avatar={millieAvatar}
                quote="Creo email personalizzate ogni giorno per mantenere viva la relazione con i tuoi clienti."
                accentColor="purple"
                features={[
                  { icon: Mail, label: "Email Giornaliere AI" },
                  { icon: User, label: "Personalizzate per Cliente" },
                  { icon: Target, label: "Journey Automatico" },
                ]}
                details={{
                  audience: "Consulenti, coach e professionisti che vogliono mantenere un contatto costante con i loro clienti",
                  whatIDo: "Creo e invio email personalizzate automaticamente ogni giorno, mantenendo viva la relazione con ogni cliente senza che tu debba pensarci",
                  howIDoIt: "Usando l'intelligenza artificiale, analizzo il percorso di ogni cliente e genero contenuti su misura che arrivano al momento giusto, con il tono giusto"
                }}
                ctaLabel="Gestisci Email Journey"
                ctaHref="/consultant/ai-config"
              />

              {/* Card 2 - Echo */}
              <TeamMemberCard
                name="Echo"
                role="Summarizer"
                avatar={echoAvatar}
                quote="Trasformo le tue consulenze in riepiloghi strutturati e email professionali."
                accentColor="orange"
                features={[
                  { icon: ClipboardCheck, label: "Riepiloghi Consulenze AI" },
                  { icon: Mail, label: "Email Personalizzate" },
                  { icon: FileText, label: "Da Trascrizioni Fathom" },
                ]}
                details={{
                  audience: "Consulenti e professionisti che tengono sessioni one-to-one con i clienti e vogliono documentare ogni incontro",
                  whatIDo: "Trasformo le tue consulenze in riepiloghi strutturati e personalizzati, evidenziando progressi, insight chiave e prossimi passi da seguire",
                  howIDoIt: "Analizzo le trascrizioni delle tue chiamate Fathom con l'AI, estraggo i punti salienti e creo email professionali che invio automaticamente al cliente dopo ogni sessione"
                }}
                ctaLabel="Gestisci Consulenze"
                ctaHref="/consultant/appointments"
              />

              {/* Card 3 - Spec */}
              <TeamMemberCard
                name="Spec"
                role="Researcher"
                avatar={specAvatar}
                quote="Supporto i clienti 24/7 con risposte precise su esercizi e materiali."
                accentColor="cyan"
                features={[
                  { icon: MessageCircle, label: "Supporto Clienti 24/7" },
                  { icon: BookOpen, label: "Risposte su Esercizi" },
                  { icon: Database, label: "Guida ai Materiali" },
                ]}
                details={{
                  audience: "Clienti attivi in un percorso di formazione o coaching che hanno bisogno di supporto continuo tra una sessione e l'altra",
                  whatIDo: "Fornisco risposte immediate su esercizi, dubbi e domande, guidando i clienti attraverso i materiali formativi senza che debbano aspettare la prossima consulenza",
                  howIDoIt: "Sono attivo 24/7 via chat, ho accesso completo alla biblioteca di documenti e ai corsi dell'università, e uso l'AI per dare risposte precise e contestualizzate al percorso di ogni cliente"
                }}
                ctaLabel="Area Clienti"
                ctaHref="/client/ai-assistant"
              />

              {/* Card 4 - Stella */}
              <TeamMemberCard
                name="Stella"
                role="WhatsApp Assistant"
                avatar={stellaAvatar}
                quote="Rispondo istantaneamente su WhatsApp, qualificando lead e supportando clienti."
                accentColor="emerald"
                features={[
                  { icon: MessageCircle, label: "Risposte WhatsApp" },
                  { icon: Clock, label: "Supporto 24/7" },
                  { icon: Target, label: "Qualificazione Lead" },
                ]}
                details={{
                  audience: "Clienti e lead che ti contattano su WhatsApp e hanno bisogno di risposte rapide e professionali",
                  whatIDo: "Rispondo istantaneamente alle domande dei clienti, qualifico i nuovi lead, fornisco informazioni sui tuoi servizi e prenoto appuntamenti",
                  howIDoIt: "Sono collegata direttamente al tuo WhatsApp Business, uso l'AI per capire le richieste e rispondo con il tuo tono di voce, sempre disponibile giorno e notte"
                }}
                ctaLabel="Gestisci Agenti"
                ctaHref="/consultant/whatsapp?tab=agents"
              />

              {/* Card 5 - Nova */}
              <TeamMemberCard
                name="Nova"
                role="Social Media Manager"
                avatar={novaAvatar}
                quote="Creo e pubblico contenuti sui tuoi social per costruire il tuo brand e attrarre nuovi clienti."
                accentColor="pink"
                features={[
                  { icon: Camera, label: "Contenuti Visivi Pro" },
                  { icon: Share2, label: "Multi-piattaforma" },
                  { icon: Target, label: "Target Personalizzato" },
                ]}
                details={{
                  audience: "Professionisti e aziende che vogliono crescere sui social senza perdere ore a creare contenuti",
                  whatIDo: "Creo post accattivanti, gestisco il calendario editoriale e pubblico automaticamente su LinkedIn, Instagram e X, mantenendo coerenza con il tuo brand",
                  howIDoIt: "Uso l'AI per generare testi e immagini autentiche, analizzo il tuo target per massimizzare l'engagement e pubblico nei momenti migliori usando il Content Studio"
                }}
                ctaLabel="Vai al Content Studio"
                ctaHref="/consultant/content-studio"
              />

              {/* Card 6 - Archie */}
              <TeamMemberCard
                name="Archie"
                role="AI Builder"
                avatar={archieAvatar}
                quote="Trasformo le tue idee in dipendenti AI pronti all'uso: consulenziali, formativi, per appuntamenti e molto altro."
                accentColor="indigo"
                features={[
                  { icon: Sparkles, label: "Genera Idee AI" },
                  { icon: Bot, label: "Crea Agenti Custom" },
                  { icon: Wand2, label: "Configurazione Guidata" },
                ]}
                details={{
                  audience: "Imprenditori e professionisti che vogliono creare assistenti AI personalizzati senza competenze tecniche",
                  whatIDo: "Analizzo le tue esigenze e genero proposte di dipendenti AI su misura: da agenti consulenziali a setter per appuntamenti, da formatori a customer success manager",
                  howIDoIt: "Raccogli i tuoi documenti, descrivi il tuo business e i tuoi obiettivi. Io uso l'AI per generare configurazioni complete di agenti pronti da attivare con un click"
                }}
                ctaLabel="Crea Dipendente AI"
                ctaHref="/consultant/whatsapp?tab=ideas"
              />

              {/* Card 7 - Millie Email Hub */}
              <TeamMemberCard
                name="Millie"
                role="Email Hub Manager"
                avatar={millieAvatar}
                quote="Gestisco la tua casella email, rispondo con AI e assegno ticket al team quando serve."
                accentColor="purple"
                features={[
                  { icon: Mail, label: "Risposte AI alle Email" },
                  { icon: Users, label: "Assegnazione Ticket" },
                  { icon: Inbox, label: "Inbox Unificata" },
                ]}
                details={{
                  audience: "Professionisti e team che ricevono molte email e vogliono rispondere più velocemente senza perdere messaggi importanti",
                  whatIDo: "Monitoro la tua casella email 24/7, genero risposte AI personalizzate usando la tua knowledge base, e assegno automaticamente ticket al team quando una richiesta richiede intervento umano",
                  howIDoIt: "Collego i tuoi account email via IMAP/SMTP, analizzo ogni messaggio con l'AI, suggerisco risposte pronte da inviare e creo ticket per il team con priorità e assegnazioni automatiche"
                }}
                ctaLabel="Gestisci Email Hub"
                ctaHref="/consultant/email-hub"
              />

              {/* Card 8 - Alessia */}
              <TeamMemberCard
                name="Alessia"
                role="Voice Consultant"
                avatar={alessiaAvatar}
                quote="Ti chiamo per supportarti e seguirti nel tuo percorso, proprio come farebbe una consulente umana."
                accentColor="pink"
                features={[
                  { icon: Phone, label: "Chiamate AI Personalizzate" },
                  { icon: Calendar, label: "Programmazione Flessibile" },
                  { icon: Heart, label: "Supporto Proattivo" },
                ]}
                details={{
                  audience: "Clienti che preferiscono il contatto telefonico e hanno bisogno di un supporto più personale e diretto nel loro percorso",
                  whatIDo: "Ti chiamo quando hai bisogno o quando penso che ti serva una mano. Posso programmarmi per chiamarti quando vuoi tu, oppure contattarti proattivamente per fare il punto della situazione",
                  howIDoIt: "Uso la voce AI per conversare naturalmente al telefono, mi collego al tuo calendario per programmare chiamate, e analizzo il tuo percorso per capire quando è il momento giusto per un check-in"
                }}
                ctaLabel="Gestisci Chiamate AI"
                ctaHref="/consultant/whatsapp?tab=voice"
              />
            </div>
          </TabsContent>

          <TabsContent value="ideas" className="space-y-6">
            {/* Archie - AI Builder Card */}
            <div className="max-w-md mx-auto mb-8">
              <TeamMemberCard
                name="Archie"
                role="AI Builder"
                avatar={archieAvatar}
                quote="Trasformo le tue idee in dipendenti AI pronti all'uso: consulenziali, formativi, per appuntamenti e molto altro."
                accentColor="indigo"
                features={[
                  { icon: Sparkles, label: "Genera Idee AI" },
                  { icon: Bot, label: "Crea Agenti Custom" },
                  { icon: Wand2, label: "Configurazione Guidata" },
                ]}
                details={{
                  audience: "Imprenditori e professionisti che vogliono creare assistenti AI personalizzati senza competenze tecniche",
                  whatIDo: "Analizzo le tue esigenze e genero proposte di dipendenti AI su misura: da agenti consulenziali a setter per appuntamenti, da formatori a customer success manager",
                  howIDoIt: "Raccogli i tuoi documenti, descrivi il tuo business e i tuoi obiettivi. Io uso l'AI per generare configurazioni complete di agenti pronti da attivare con un click"
                }}
                ctaLabel="Inizia a Creare"
                ctaHref="#create-agent-form"
              />
            </div>

            {/* Lovable-style Hero Section */}
            <div className="max-w-3xl mx-auto space-y-8" id="create-agent-form">
              {/* Hero Header */}
              <div className="text-center space-y-3">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 shadow-lg shadow-purple-500/25">
                  <Sparkles className="h-8 w-8 text-white" />
                </div>
                <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                  Crea il tuo Dipendente AI
                </h2>
                <p className="text-muted-foreground max-w-md mx-auto">
                  Descrivi cosa vuoi costruire e lascia che l'AI generi proposte personalizzate
                </p>
              </div>

              {/* Main Hero Input */}
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl blur-xl" />
                <div className="relative bg-card rounded-2xl border-2 border-purple-200 dark:border-purple-800 shadow-xl p-6 space-y-4">
                  <Textarea
                    placeholder="Cosa vuoi creare? Descrivi il tuo dipendente AI ideale...&#10;&#10;Es: Voglio un assistente che risponda ai clienti su WhatsApp, prenda appuntamenti e risponda alle domande frequenti sul mio studio dentistico..."
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    rows={5}
                    className="resize-none border-0 focus-visible:ring-0 text-lg placeholder:text-muted-foreground/50 dark:placeholder:text-muted-foreground bg-transparent"
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground/60">{textInput.length} caratteri</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        if (!textInput.trim()) {
                          toast({
                            title: "Testo mancante",
                            description: "Inserisci una descrizione da migliorare.",
                            variant: "destructive",
                          });
                          return;
                        }
                        setIsImprovingText(true);
                        try {
                          const res = await fetch("/api/consultant/onboarding/ai-ideas/improve-text", {
                            method: "POST",
                            headers: {
                              ...getAuthHeaders(),
                              "Content-Type": "application/json",
                            },
                            body: JSON.stringify({ text: textInput }),
                          });
                          if (!res.ok) throw new Error("Errore nel miglioramento del testo");
                          const data = await res.json();
                          if (data.improvedText) {
                            setTextInput(data.improvedText);
                            toast({
                              title: "Testo migliorato!",
                              description: "La descrizione è stata espansa dall'AI.",
                            });
                          }
                        } catch (error: any) {
                          toast({
                            title: "Errore",
                            description: error.message,
                            variant: "destructive",
                          });
                        } finally {
                          setIsImprovingText(false);
                        }
                      }}
                      disabled={isImprovingText || !textInput.trim()}
                      className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/50"
                    >
                      {isImprovingText ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4 mr-2" />
                      )}
                      Migliora con AI
                    </Button>
                  </div>
                </div>
              </div>

              {/* Context Section - Documents & Knowledge Base */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Documents Upload Card */}
                <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Upload className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Documenti</h4>
                      <p className="text-xs text-muted-foreground">PDF, DOC, TXT, immagini</p>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-gray-200 dark:border-gray-600 rounded-lg p-4 text-center hover:border-purple-400 transition-colors cursor-pointer bg-muted/30">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg"
                      className="hidden"
                      id="file-upload"
                      onChange={(e) => {
                        if (e.target.files) {
                          setUploadedFiles([...uploadedFiles, ...Array.from(e.target.files)]);
                        }
                      }}
                    />
                    <label htmlFor="file-upload" className="cursor-pointer">
                      <p className="text-sm text-muted-foreground">
                        Trascina o <span className="text-purple-600 font-medium">sfoglia</span>
                      </p>
                    </label>
                  </div>
                  {uploadedFiles.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((file, index) => (
                        <div key={index} className="inline-flex items-center gap-2 bg-purple-100 dark:bg-purple-900/30 px-3 py-1.5 rounded-full text-sm">
                          <FileText className="h-3 w-3 text-purple-600" />
                          <span className="truncate max-w-24">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))}
                            className="text-purple-600 hover:text-red-500"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Knowledge Base Card */}
                <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <Database className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-gray-100">Knowledge Base</h4>
                      <p className="text-xs text-muted-foreground">Documenti esistenti</p>
                    </div>
                  </div>
                  {knowledgeDocsQuery.isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Caricamento...
                    </div>
                  ) : knowledgeDocs.length === 0 ? (
                    <p className="text-sm text-muted-foreground/60 py-4 text-center">Nessun documento</p>
                  ) : (
                    <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
                      {knowledgeDocs.map((doc: any) => (
                        <button
                          key={doc.id}
                          type="button"
                          onClick={() => {
                            if (selectedKnowledgeDocIds.includes(doc.id)) {
                              setSelectedKnowledgeDocIds(selectedKnowledgeDocIds.filter(id => id !== doc.id));
                            } else {
                              setSelectedKnowledgeDocIds([...selectedKnowledgeDocIds, doc.id]);
                            }
                          }}
                          className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs transition-all ${
                            selectedKnowledgeDocIds.includes(doc.id)
                              ? "bg-purple-100 text-purple-700 border border-purple-400 dark:bg-purple-900/30 dark:text-purple-300"
                              : "bg-gray-50 text-muted-foreground border border-gray-200 hover:border-purple-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {selectedKnowledgeDocIds.includes(doc.id) && <Check className="h-3 w-3" />}
                          <FileText className="h-3 w-3" />
                          <span className="truncate max-w-20">{doc.fileName}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* URLs Card */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Link className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Siti Web</h4>
                    <p className="text-xs text-muted-foreground">URL da analizzare (il contenuto viene estratto automaticamente)</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {urlInputs.map((url, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        placeholder="https://esempio.com"
                        value={url}
                        onChange={(e) => {
                          const newUrls = [...urlInputs];
                          newUrls[index] = e.target.value;
                          setUrlInputs(newUrls);
                        }}
                        className="text-sm h-10 bg-muted"
                      />
                      {urlInputs.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setUrlInputs(urlInputs.filter((_, i) => i !== index))}
                          className="h-10 px-3"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground/60" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setUrlInputs([...urlInputs, ""])}
                    className="text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/30"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Aggiungi URL
                  </Button>
                </div>
              </div>

              {/* Business Info Fields */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Building2 className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Informazioni Business</h4>
                    <p className="text-xs text-muted-foreground">Opzionale - verranno estratte dal contesto se non fornite</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Nome Business</Label>
                    <Input
                      placeholder="Es: Studio Rossi & Partners"
                      value={businessNameInput}
                      onChange={(e) => setBusinessNameInput(e.target.value)}
                      className="bg-muted"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-muted-foreground">Nome Consulente</Label>
                    <Input
                      placeholder="Es: Marco Rossi"
                      value={consultantDisplayNameInput}
                      onChange={(e) => setConsultantDisplayNameInput(e.target.value)}
                      className="bg-muted"
                    />
                  </div>
                </div>
              </div>

              {/* Agent Type Pills */}
              <div className="bg-card rounded-xl border border-border p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                    <Bot className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-gray-100">Tipo di Agente</h4>
                    <p className="text-xs text-muted-foreground">Seleziona uno o più tipi di agente da generare</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: "reactive_lead", label: "Inbound", icon: Phone, selectedClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-2 border-blue-400 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-600" },
                    { id: "proactive_setter", label: "Outbound", icon: Target, selectedClass: "bg-green-100 text-green-700 border-2 border-green-400 dark:bg-green-900/30 dark:text-green-300 dark:border-green-600" },
                    { id: "informative_advisor", label: "Consulenziale", icon: MessageCircle, selectedClass: "bg-purple-100 text-purple-700 border-2 border-purple-400 dark:bg-purple-900/30 dark:text-purple-300 dark:border-purple-600" },
                    { id: "customer_success", label: "Customer Success", icon: Heart, selectedClass: "bg-pink-100 text-pink-700 border-2 border-pink-400 dark:bg-pink-900/30 dark:text-pink-300 dark:border-pink-600" },
                    { id: "intake_coordinator", label: "Intake", icon: ClipboardCheck, selectedClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-2 border-amber-400 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-600" },
                  ].map((agent) => {
                    const isSelected = selectedIntegrations.includes(agent.id);
                    const Icon = agent.icon;
                    return (
                      <button
                        key={agent.id}
                        type="button"
                        onClick={() => {
                          if (isSelected) {
                            setSelectedIntegrations(selectedIntegrations.filter(i => i !== agent.id));
                          } else {
                            setSelectedIntegrations([...selectedIntegrations, agent.id]);
                          }
                        }}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-sm font-medium transition-all ${
                          isSelected
                            ? agent.selectedClass
                            : "bg-gray-100 text-muted-foreground border-2 border-transparent hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                        }`}
                      >
                        {isSelected && <Check className="h-3.5 w-3.5" />}
                        <Icon className="h-4 w-4" />
                        {agent.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Number of Ideas + Generate Button */}
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>Genera</span>
                  <Input
                    type="number"
                    min={1}
                    max={10}
                    value={numberOfIdeas}
                    onChange={(e) => setNumberOfIdeas(Math.max(1, Math.min(10, parseInt(e.target.value) || 1)))}
                    className="w-16 h-9 text-center"
                  />
                  <span>idee</span>
                </div>
                <Button
                  className="flex-1 sm:flex-none bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-semibold py-6 px-8 rounded-xl shadow-lg shadow-purple-500/25 transition-all hover:shadow-xl hover:shadow-purple-500/30"
                  disabled={isGenerating || (!textInput && uploadedFiles.length === 0 && urlInputs.filter(u => u).length === 0 && selectedKnowledgeDocIds.length === 0) || selectedIntegrations.length === 0}
                  onClick={async () => {
                    setIsGenerating(true);
                    try {
                      let uploadedFilesText: { fileName: string; text: string }[] = [];

                      if (uploadedFiles.length > 0) {
                        toast({
                          title: "Elaborazione file...",
                          description: `Estrazione testo da ${uploadedFiles.length} file...`,
                        });

                        const formData = new FormData();
                        for (const file of uploadedFiles) {
                          formData.append("files", file);
                        }

                        const uploadRes = await fetch("/api/consultant/onboarding/ai-ideas/upload-files", {
                          method: "POST",
                          headers: getAuthHeaders(),
                          body: formData,
                        });

                        if (!uploadRes.ok) {
                          const uploadError = await uploadRes.json();
                          throw new Error(uploadError.error || "Errore durante l'upload dei file");
                        }

                        const uploadData = await uploadRes.json();
                        uploadedFilesText = uploadData.data || [];

                        const successCount = uploadedFilesText.filter(f => f.text).length;
                        if (successCount > 0) {
                          toast({
                            title: "File elaborati",
                            description: `Estratto testo da ${successCount} file`,
                          });
                        }
                      }

                      const res = await fetch("/api/consultant/onboarding/ai-ideas/generate", {
                        method: "POST",
                        headers: {
                          ...getAuthHeaders(),
                          "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                          textDescription: textInput,
                          urls: urlInputs.filter(u => u),
                          knowledgeDocIds: selectedKnowledgeDocIds,
                          integrations: selectedIntegrations,
                          numberOfIdeas: numberOfIdeas,
                          uploadedFilesText: uploadedFilesText,
                          businessName: businessNameInput || undefined,
                          consultantDisplayName: consultantDisplayNameInput || undefined,
                        }),
                      });

                      if (!res.ok) {
                        const errorData = await res.json();
                        throw new Error(errorData.message || errorData.error || "Errore nella generazione delle idee");
                      }

                      const data = await res.json();
                      setGeneratedIdeas(data.data || data.ideas || []);
                      toast({
                        title: "Idee generate!",
                        description: `Sono state generate ${(data.data || data.ideas)?.length || 0} idee per i tuoi agenti.`,
                      });
                    } catch (error: any) {
                      toast({
                        title: "Errore",
                        description: error.message || "Impossibile generare le idee. Riprova.",
                        variant: "destructive",
                      });
                    } finally {
                      setIsGenerating(false);
                    }
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                      {uploadedFiles.length > 0 ? "Elaborazione..." : "Generazione..."}
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5 mr-2" />
                      Genera Idee
                    </>
                  )}
                </Button>
              </div>

              {/* Hint */}
              {selectedIntegrations.length === 0 && (
                <p className="text-center text-sm text-amber-600 dark:text-amber-400">
                  Seleziona almeno un tipo di agente per generare idee
                </p>
              )}
            </div>

            {/* Idee Generate */}
            {generatedIdeas.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold">Idee Generate</h3>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700">
                    {generatedIdeas.length} proposte
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {generatedIdeas.map((idea, idx) => (
                    <Card key={idea.id || idx} className="border-2 border-purple-200 dark:border-purple-800 hover:shadow-lg transition-shadow">
                      <CardHeader>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            <div className="bg-purple-100 dark:bg-purple-900/30 p-2 rounded-lg">
                              <Bot className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <CardTitle className="text-base">{idea.name}</CardTitle>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {idea.suggestedAgentType && (
                                  <Badge 
                                    className={`text-xs ${
                                      idea.suggestedAgentType === 'reactive_lead' 
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300' 
                                        : idea.suggestedAgentType === 'proactive_setter'
                                        ? 'bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-300'
                                        : idea.suggestedAgentType === 'informative_advisor'
                                        ? 'bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-900/30 dark:text-purple-300'
                                        : idea.suggestedAgentType === 'customer_success'
                                        ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-300'
                                        : idea.suggestedAgentType === 'intake_coordinator'
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300'
                                        : 'bg-gray-100 text-foreground border-gray-300 dark:bg-gray-900/30 dark:text-muted-foreground/40'
                                    }`}
                                  >
                                    {idea.suggestedAgentType === 'reactive_lead' 
                                      ? '📞 Inbound' 
                                      : idea.suggestedAgentType === 'proactive_setter'
                                      ? '🎯 Outbound'
                                      : idea.suggestedAgentType === 'informative_advisor'
                                      ? '💬 Consulenziale'
                                      : idea.suggestedAgentType === 'customer_success'
                                      ? '💜 Customer Success'
                                      : idea.suggestedAgentType === 'intake_coordinator'
                                      ? '📋 Intake'
                                      : idea.suggestedAgentType}
                                  </Badge>
                                )}
                                {idea.personality && (
                                  <Badge variant="outline" className="text-xs capitalize">
                                    {idea.personality}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <p className="text-sm text-muted-foreground">
                          {idea.description}
                        </p>

                        {idea.whoWeHelp && (
                          <div className="space-y-1">
                            <p className="text-xs font-semibold text-foreground">
                              👥 Chi aiutiamo:
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {idea.whoWeHelp}
                            </p>
                          </div>
                        )}

                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-foreground">
                            Integrazioni:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {(idea.integrations || idea.integrationTypes || []).map((int: string) => (
                              <Badge key={int} variant="secondary" className="text-xs">
                                {int === 'booking' ? (
                                  <><Calendar className="h-3 w-3 mr-1" /> Appuntamenti</>
                                ) : (
                                  <><BookOpen className="h-3 w-3 mr-1" /> Consulenza</>
                                )}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {idea.useCases && idea.useCases.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-semibold text-foreground">
                              Casi d'uso:
                            </p>
                            <ul className="space-y-1">
                              {idea.useCases.slice(0, 3).map((useCase: string, idx: number) => (
                                <li key={idx} className="text-xs text-muted-foreground flex items-start gap-1">
                                  <ChevronRight className="h-3 w-3 mt-0.5 text-purple-500 flex-shrink-0" />
                                  <span>{useCase}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="space-y-2">
                          <Button
                            className="w-full bg-purple-600 hover:bg-purple-700"
                            disabled={saveIdeaMutation.isPending}
                            onClick={() => saveIdeaMutation.mutate(idea)}
                          >
                            {saveIdeaMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4 mr-2" />
                            )}
                            Salva Idea
                          </Button>
                          <Button
                            variant="outline"
                            className="w-full border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950/20"
                            disabled={saveAndCreateAgentMutation.isPending}
                            onClick={() => saveAndCreateAgentMutation.mutate({ idea, filesToUpload: uploadedFiles, knowledgeDocIds: selectedKnowledgeDocIds.map(id => parseInt(id, 10)) })}
                          >
                            {saveAndCreateAgentMutation.isPending ? (
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            ) : (
                              <ArrowRight className="h-4 w-4 mr-2" />
                            )}
                            Crea Agente Subito
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}

            {/* Idee Salvate */}
            {savedIdeas.length > 0 && (
              <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/10">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Check className="h-5 w-5 text-green-600" />
                    Idee Salvate ({savedIdeas.length})
                  </CardTitle>
                  <CardDescription>
                    Idee che hai salvato per usare in futuro
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {Object.entries(groupedSavedIdeas).map(([groupName, ideas]) => (
                    ideas.length > 0 && (
                      <div key={groupName} className="space-y-3">
                        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                          <Clock className="h-4 w-4" />
                          {groupName}
                          <Badge variant="outline" className="text-xs">
                            {ideas.length}
                          </Badge>
                        </h4>
                        <div className="space-y-2">
                          {ideas.map((idea: any) => (
                            <div key={idea.id} className="flex items-center justify-between bg-card p-3 rounded-lg border">
                              <div className="flex items-center gap-3 flex-1 min-w-0">
                                <Bot className="h-4 w-4 text-purple-600 flex-shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="font-medium text-sm truncate">{idea.name}</p>
                                    {idea.suggestedAgentType && (
                                      <Badge 
                                        className={`text-xs ${
                                          idea.suggestedAgentType === 'reactive_lead' 
                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300' 
                                            : idea.suggestedAgentType === 'proactive_setter'
                                            ? 'bg-green-100 text-green-700 border-green-300'
                                            : idea.suggestedAgentType === 'informative_advisor'
                                            ? 'bg-purple-100 text-purple-700 border-purple-300'
                                            : idea.suggestedAgentType === 'customer_success'
                                            ? 'bg-pink-100 text-pink-700 border-pink-300 dark:bg-pink-900/30 dark:text-pink-400 dark:border-pink-800'
                                            : idea.suggestedAgentType === 'intake_coordinator'
                                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300'
                                            : 'bg-muted text-foreground border-border'
                                        }`}
                                      >
                                        {idea.suggestedAgentType === 'reactive_lead' 
                                          ? 'Inbound' 
                                          : idea.suggestedAgentType === 'proactive_setter'
                                          ? 'Outbound'
                                          : idea.suggestedAgentType === 'informative_advisor'
                                          ? 'Consulenziale'
                                          : idea.suggestedAgentType === 'customer_success'
                                          ? 'Customer Success'
                                          : idea.suggestedAgentType === 'intake_coordinator'
                                          ? 'Intake'
                                          : idea.suggestedAgentType}
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground truncate">{idea.description}</p>
                                  {idea.createdAt && (
                                    <p className="text-xs text-muted-foreground/60 mt-1">
                                      {format(new Date(idea.createdAt), "d MMM yyyy, HH:mm", { locale: it })}
                                    </p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-2 flex-shrink-0 ml-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => navigate(`/consultant/whatsapp/agent/new?fromIdea=${idea.id}`)}
                                >
                                  Crea Agente
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  disabled={deleteIdeaMutation.isPending}
                                  onClick={() => deleteIdeaMutation.mutate(idea.id)}
                                >
                                  {deleteIdeaMutation.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground/60" />
                                  ) : (
                                    <Trash2 className="h-4 w-4 text-red-500" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="calendario" className="space-y-6">
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <WhatsAppCalendar />
              </div>
              <div className="xl:col-span-1">
                <WhatsAppOutbound />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="employees" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4">
                <EmployeeRoster 
                  onSelectAgent={(agent) => setSelectedAgent(agent)}
                  selectedAgentId={selectedAgent?.id}
                />
              </div>
              <div className="lg:col-span-8">
                <AgentProfilePanel 
                  selectedAgent={selectedAgent}
                  onDeleteAgent={(agentId) => {
                    const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                    if (config) handleDelete(config);
                  }}
                  onDuplicateAgent={(agentId) => {
                    const config = configs.find((c: WhatsAppConfig) => c.id === agentId);
                    if (config) handleDuplicate(config);
                  }}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="licenses" className="space-y-6">
            <Alert className="bg-violet-50 border-violet-200 dark:bg-violet-950/20 dark:border-violet-800">
              <Key className="h-5 w-5 text-violet-600" />
              <AlertDescription>
                <strong>Gestione Licenze</strong><br />
                Monitora le tue licenze Level 2 (Bronze) e Level 3 (Silver), visualizza le sottoscrizioni attive dei tuoi clienti e gestisci il tuo piano.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* License Dashboard Card */}
              <Card className="border-2 border-violet-200 dark:border-violet-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Key className="h-5 w-5 text-violet-600" />
                    Dashboard Licenze
                  </CardTitle>
                  <CardDescription>
                    Visualizza l'utilizzo delle tue licenze
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {licensesQuery.isLoading ? (
                    <div className="flex items-center justify-center p-8">
                      <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                    </div>
                  ) : (
                    <>
                      {/* Level 2 (Bronze) - Illimitate */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LevelBadge level="2" size="md" />
                            <span className="text-sm font-medium text-foreground">
                              Licenze Bronze
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-amber-600">
                            {licenses.level2Used} attive - Illimitate
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Puoi avere quante licenze Bronze desideri
                        </p>
                      </div>

                      {/* Level 3 (Silver) - Illimitate */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <LevelBadge level="3" size="md" />
                            <span className="text-sm font-medium text-foreground">
                              Licenze Silver
                            </span>
                          </div>
                          <span className="text-sm font-semibold text-muted-foreground">
                            {licenses.level3Used} attive - Illimitate
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Puoi avere quante licenze Silver desideri
                        </p>
                      </div>

                      {/* Summary */}
                      <div className="pt-4 border-t border-border">
                        <div className="grid grid-cols-2 gap-4 text-center">
                          <div className="p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg">
                            <p className="text-2xl font-bold text-amber-600">{licenses.level2Used}</p>
                            <p className="text-xs text-amber-700 dark:text-amber-400">Bronze attive</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="text-2xl font-bold text-muted-foreground">{licenses.level3Used}</p>
                            <p className="text-xs text-slate-700 dark:text-slate-400">Silver attive</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Buy Employee Licenses Card */}
              <Card className="border-2 border-violet-200 dark:border-violet-800">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-violet-600" />
                    Le tue Licenze
                  </CardTitle>
                  <CardDescription>
                    5 licenze gratis incluse + acquista licenze aggiuntive per clienti e dipendenti
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Info licenze */}
                  <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-3">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300">
                      <strong>5 licenze gratis</strong> incluse nel tuo piano! Ogni licenza copre sia clienti che dipendenti.
                    </p>
                  </div>
                  
                  {/* Current Licenses */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-violet-100 text-violet-700">Clienti + Team</Badge>
                        <span className="text-sm font-medium text-foreground">
                          Licenze Totali
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                        {licenses.employeeUsed}/{licenses.employeeTotal}
                      </span>
                    </div>
                    <Progress 
                      value={licenses.employeeTotal > 0 ? (licenses.employeeUsed / licenses.employeeTotal) * 100 : 0} 
                      className={`h-3 ${
                        licenses.employeeTotal > 0 && licenses.employeeUsed / licenses.employeeTotal >= 0.9 
                          ? "[&>div]:bg-red-500" 
                          : "[&>div]:bg-violet-500"
                      }`}
                    />
                    {licenses.employeeUsed >= licenses.employeeTotal && (
                      <p className="text-sm text-red-600 font-medium">
                        Hai raggiunto il limite! Acquista un pacchetto per aggiungere altri utenti.
                      </p>
                    )}
                  </div>

                  <div className="pt-4 border-t space-y-3">
                    {/* Package 1: 5 licenses */}
                    <div className="bg-violet-50 dark:bg-violet-950/20 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-violet-700">Pacchetto 5 Licenze</span>
                        <span className="text-2xl font-bold text-violet-700">€100</span>
                      </div>
                      <p className="text-sm text-violet-600 mb-3">
                        €20 per licenza/mese
                      </p>
                      <Button 
                        className="w-full bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                        variant="default"
                        disabled={buyLicensesMutation.isPending}
                        onClick={() => buyLicensesMutation.mutate(5)}
                      >
                        {buyLicensesMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Caricamento...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Acquista 5 Licenze
                          </>
                        )}
                      </Button>
                    </div>
                    
                    {/* Package 2: 10 licenses - best value */}
                    <div className="bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/20 dark:to-indigo-950/20 rounded-lg p-4 border-2 border-violet-300 dark:border-violet-700 relative">
                      <div className="absolute -top-2.5 left-4">
                        <Badge className="bg-emerald-500 text-white text-xs px-2 py-0.5">Risparmia €20!</Badge>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-violet-700">Pacchetto 10 Licenze</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold text-violet-700">€180</span>
                          <span className="text-sm text-muted-foreground line-through ml-2">€200</span>
                        </div>
                      </div>
                      <p className="text-sm text-violet-600 mb-3">
                        €18 per licenza/mese — il miglior rapporto qualità-prezzo
                      </p>
                      <Button 
                        className="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-700 hover:to-violet-700"
                        disabled={buyLicensesMutation.isPending}
                        onClick={() => buyLicensesMutation.mutate(10)}
                      >
                        {buyLicensesMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Caricamento...
                          </>
                        ) : (
                          <>
                            <CreditCard className="h-4 w-4 mr-2" />
                            Acquista 10 Licenze
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sottoscrizioni Attive per Origine */}
            <Card className="border-2 border-emerald-200 dark:border-emerald-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5 text-emerald-600" />
                      Sottoscrizioni Attive
                    </CardTitle>
                    <CardDescription>
                      Visualizza le sottoscrizioni Silver/Gold divise per origine pagamento
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
                      Stripe Connect: {
                        [...(silverUsersQuery.data?.users || []), ...(goldUsersQuery.data?.users || [])]
                          .filter((u: any) => u.paymentSource === "stripe_connect" || !u.paymentSource).length
                      }
                    </Badge>
                    <Badge className="bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800">
                      Link Diretto: {
                        [...(silverUsersQuery.data?.users || []), ...(goldUsersQuery.data?.users || [])]
                          .filter((u: any) => u.paymentSource === "direct_link").length
                      }
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={subscriptionSourceTab} onValueChange={(v) => setSubscriptionSourceTab(v as "stripe_connect" | "direct_link")}>
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="stripe_connect" className="data-[state=active]:bg-blue-100 data-[state=active]:text-blue-800">
                      <CreditCard className="h-4 w-4 mr-2" />
                      Stripe Connect (Revenue Share)
                    </TabsTrigger>
                    <TabsTrigger value="direct_link" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-800">
                      <Link className="h-4 w-4 mr-2" />
                      Link Diretto (100% Tuo)
                    </TabsTrigger>
                  </TabsList>

                  {/* Stripe Connect Subscriptions */}
                  <TabsContent value="stripe_connect" className="space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {[...(silverUsersQuery.data?.users || []), ...(goldUsersQuery.data?.users || [])]
                          .filter((u: any) => u.paymentSource === "stripe_connect" || !u.paymentSource).length} sottoscrizioni Stripe Connect totali
                      </span>
                    </div>
                    
                    {silverUsersQuery.isLoading || goldUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                      </div>
                    ) : (() => {
                      const stripeConnectUsers = [
                        ...(silverUsersQuery.data?.users || []).map((u: any) => ({ ...u, tier: "silver" })),
                        ...(goldUsersQuery.data?.users || []).map((u: any) => ({ ...u, tier: "gold" }))
                      ].filter((u: any) => u.paymentSource === "stripe_connect" || !u.paymentSource);
                      
                      return stripeConnectUsers.length === 0 ? (
                        <div className="text-center py-8">
                          <CreditCard className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                          <p className="text-sm font-medium text-muted-foreground">Nessuna sottoscrizione via Stripe Connect</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Le sottoscrizioni dalla pagina prezzi pubblica appariranno qui</p>
                        </div>
                      ) : (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {stripeConnectUsers.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge className={user.tier === "gold" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-muted text-foreground"}>
                                      {user.tier === "gold" ? "Oro" : "Argento"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground"}>
                                      {user.status === "active" ? "Attivo" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </TabsContent>

                  {/* Direct Link Subscriptions */}
                  <TabsContent value="direct_link" className="space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {[...(silverUsersQuery.data?.users || []), ...(goldUsersQuery.data?.users || [])]
                          .filter((u: any) => u.paymentSource === "direct_link").length} sottoscrizioni Link Diretto totali
                      </span>
                    </div>
                    
                    {silverUsersQuery.isLoading || goldUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                      </div>
                    ) : (() => {
                      const directLinkUsers = [
                        ...(silverUsersQuery.data?.users || []).map((u: any) => ({ ...u, tier: "silver" })),
                        ...(goldUsersQuery.data?.users || []).map((u: any) => ({ ...u, tier: "gold" }))
                      ].filter((u: any) => u.paymentSource === "direct_link");
                      
                      return directLinkUsers.length === 0 ? (
                        <div className="text-center py-8">
                          <Link className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                          <p className="text-sm font-medium text-muted-foreground">Nessuna sottoscrizione via Link Diretto</p>
                          <p className="text-xs text-muted-foreground/60 mt-1">Le sottoscrizioni dalle automazioni Stripe appariranno qui (100% commissione tua)</p>
                        </div>
                      ) : (
                        <div className="rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Tier</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {directLinkUsers.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge className={user.tier === "gold" ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400" : "bg-muted text-foreground"}>
                                      {user.tier === "gold" ? "Oro" : "Argento"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground"}>
                                      {user.status === "active" ? "Attivo" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                      );
                    })()}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Gestione Utenti Registrati */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-violet-600" />
                      Utenti Registrati
                    </CardTitle>
                    <CardDescription>
                      Gestisci gli utenti registrati suddivisi per tier
                    </CardDescription>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800">
                      <Shield className="h-3 w-3 mr-1" />
                      Bronze ({userStatsQuery.data?.bronze?.total || 0})
                    </Badge>
                    <Badge className="bg-muted text-foreground border-border">
                      <Shield className="h-3 w-3 mr-1" />
                      Argento ({userStatsQuery.data?.silver?.total || 0})
                    </Badge>
                    <Badge className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800">
                      <Crown className="h-3 w-3 mr-1" />
                      Oro ({userStatsQuery.data?.gold?.total || 0})
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Tabs value={userManagementTab} onValueChange={(v) => setUserManagementTab(v as "bronze" | "silver" | "gold")}>
                  <TabsList className="grid w-full grid-cols-3 mb-4">
                    <TabsTrigger value="bronze" className="data-[state=active]:bg-amber-100 data-[state=active]:text-amber-800">
                      <Shield className="h-4 w-4 mr-2" />
                      Bronze (Gratuiti)
                    </TabsTrigger>
                    <TabsTrigger value="silver" className="data-[state=active]:bg-muted data-[state=active]:text-foreground dark:data-[state=active]:bg-muted">
                      <Shield className="h-4 w-4 mr-2" />
                      Argento (Abbonati)
                    </TabsTrigger>
                    <TabsTrigger value="gold" className="data-[state=active]:bg-yellow-100 data-[state=active]:text-yellow-800">
                      <Crown className="h-4 w-4 mr-2" />
                      Oro (Premium)
                    </TabsTrigger>
                  </TabsList>

                  {/* Bronze Users Tab */}
                  <TabsContent value="bronze" className="space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {bronzeUsersQuery.data?.total || 0} utenti Bronze totali
                      </span>
                      {bronzeUsersQuery.data?.totalPages > 1 && (
                        <span>
                          Pagina {bronzeCurrentPage} di {bronzeUsersQuery.data.totalPages}
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Input
                        placeholder="Cerca per email o nome..."
                        value={userSearchQuery}
                        onChange={(e) => {
                          setUserSearchQuery(e.target.value);
                          setBronzeCurrentPage(1);
                        }}
                        className="max-w-sm"
                      />
                    </div>
                    
                    {bronzeUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
                      </div>
                    ) : !bronzeUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">Nessun utente Bronze trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Ultima attività</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {bronzeUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.email}</TableCell>
                                  <TableCell>{user.firstName} {user.lastName}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground"}>
                                      {user.isActive ? "Attivo" : "Inattivo"}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.lastLoginAt ? format(new Date(user.lastLoginAt), "d MMM yyyy HH:mm", { locale: it }) : "Mai"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex items-center justify-end gap-1">
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                        onClick={() => {
                                          setPasswordResetTarget({ type: "bronze", id: user.id, email: user.email });
                                          setNewPasswordInput("");
                                          setIsPasswordResetDialogOpen(true);
                                        }}
                                      >
                                        <KeyRound className="h-4 w-4" />
                                      </Button>
                                      <Button 
                                        variant="ghost" 
                                        size="sm"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                        onClick={() => setUserToDelete({ id: user.id, email: user.email })}
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {bronzeUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.email}</span>
                                <Badge variant={user.isActive ? "default" : "outline"} className={user.isActive ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground"}>
                                  {user.isActive ? "Attivo" : "Inattivo"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{user.firstName} {user.lastName}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {user.lastLoginAt ? format(new Date(user.lastLoginAt), "d MMM yyyy", { locale: it }) : "Mai"}
                                </span>
                                <div className="flex items-center gap-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-blue-500 hover:text-blue-700"
                                    onClick={() => {
                                      setPasswordResetTarget({ type: "bronze", id: user.id, email: user.email });
                                      setNewPasswordInput("");
                                      setIsPasswordResetDialogOpen(true);
                                    }}
                                  >
                                    <KeyRound className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-red-500 hover:text-red-700"
                                    onClick={() => setUserToDelete({ id: user.id, email: user.email })}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination */}
                        {bronzeUsersQuery.data.totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBronzeCurrentPage(p => Math.max(1, p - 1))}
                              disabled={bronzeCurrentPage === 1}
                            >
                              Precedente
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Pagina {bronzeCurrentPage} di {bronzeUsersQuery.data.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setBronzeCurrentPage(p => Math.min(bronzeUsersQuery.data.totalPages, p + 1))}
                              disabled={bronzeCurrentPage >= bronzeUsersQuery.data.totalPages}
                            >
                              Successiva
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Silver Users Tab */}
                  <TabsContent value="silver" className="space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {silverUsersQuery.data?.total || 0} utenti Argento totali
                      </span>
                      {silverUsersQuery.data?.totalPages > 1 && (
                        <span>
                          Pagina {silverCurrentPage} di {silverUsersQuery.data.totalPages}
                        </span>
                      )}
                    </div>
                    
                    {silverUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                      </div>
                    ) : !silverUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">Nessun utente Argento trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {silverUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : user.status === "canceled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-foreground"}>
                                      {user.status === "active" ? "Attivo" : user.status === "canceled" ? "Annullato" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button 
                                      variant="ghost" 
                                      size="sm"
                                      className="text-blue-500 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => {
                                        setPasswordResetTarget({ type: "silver", id: user.id, email: user.clientEmail });
                                        setNewPasswordInput("");
                                        setIsPasswordResetDialogOpen(true);
                                      }}
                                    >
                                      <KeyRound className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {silverUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.clientEmail}</span>
                                <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                                  {user.status === "active" ? "Attivo" : "Annullato"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{user.clientName || "—"}</p>
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-muted-foreground">
                                  {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                </span>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  className="text-blue-500 hover:text-blue-700"
                                  onClick={() => {
                                    setPasswordResetTarget({ type: "silver", id: user.id, email: user.clientEmail });
                                    setNewPasswordInput("");
                                    setIsPasswordResetDialogOpen(true);
                                  }}
                                >
                                  <KeyRound className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination */}
                        {silverUsersQuery.data.totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSilverCurrentPage(p => Math.max(1, p - 1))}
                              disabled={silverCurrentPage === 1}
                            >
                              Precedente
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Pagina {silverCurrentPage} di {silverUsersQuery.data.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setSilverCurrentPage(p => Math.min(silverUsersQuery.data.totalPages, p + 1))}
                              disabled={silverCurrentPage >= silverUsersQuery.data.totalPages}
                            >
                              Successiva
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>

                  {/* Gold Users Tab */}
                  <TabsContent value="gold" className="space-y-4">
                    {/* Info bar */}
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>
                        {goldUsersQuery.data?.total || 0} utenti Oro totali
                      </span>
                      {goldUsersQuery.data?.totalPages > 1 && (
                        <span>
                          Pagina {goldCurrentPage} di {goldUsersQuery.data.totalPages}
                        </span>
                      )}
                    </div>
                    
                    {goldUsersQuery.isLoading ? (
                      <div className="flex items-center justify-center p-8">
                        <Loader2 className="h-6 w-6 animate-spin text-yellow-500" />
                      </div>
                    ) : !goldUsersQuery.data?.users?.length ? (
                      <div className="text-center py-8">
                        <Crown className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                        <p className="text-sm font-medium text-muted-foreground">Nessun utente Oro trovato</p>
                      </div>
                    ) : (
                      <>
                        {/* Desktop Table */}
                        <div className="hidden md:block rounded-lg border">
                          <Table>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Email</TableHead>
                                <TableHead>Nome</TableHead>
                                <TableHead>Stato</TableHead>
                                <TableHead>Data Inizio</TableHead>
                                <TableHead className="text-right">Azioni</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {goldUsersQuery.data.users.map((user: any) => (
                                <TableRow key={user.id}>
                                  <TableCell className="font-medium">{user.clientEmail}</TableCell>
                                  <TableCell>{user.clientName || "—"}</TableCell>
                                  <TableCell>
                                    <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : user.status === "canceled" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" : "bg-muted text-foreground"}>
                                      {user.status === "active" ? "Attivo" : user.status === "canceled" ? "Annullato" : user.status}
                                    </Badge>
                                  </TableCell>
                                  <TableCell className="text-muted-foreground">
                                    {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button variant="ghost" size="sm">
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </div>
                        
                        {/* Mobile Cards */}
                        <div className="md:hidden space-y-3">
                          {goldUsersQuery.data.users.map((user: any) => (
                            <div key={user.id} className="p-4 border rounded-lg space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{user.clientEmail}</span>
                                <Badge variant={user.status === "active" ? "default" : "outline"} className={user.status === "active" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}>
                                  {user.status === "active" ? "Attivo" : "Annullato"}
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{user.clientName || "—"}</p>
                              <span className="text-xs text-muted-foreground">
                                {user.startDate ? format(new Date(user.startDate), "d MMM yyyy", { locale: it }) : "—"}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        {/* Pagination */}
                        {goldUsersQuery.data.totalPages > 1 && (
                          <div className="flex items-center justify-between pt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setGoldCurrentPage(p => Math.max(1, p - 1))}
                              disabled={goldCurrentPage === 1}
                            >
                              Precedente
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              Pagina {goldCurrentPage} di {goldUsersQuery.data.totalPages}
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setGoldCurrentPage(p => Math.min(goldUsersQuery.data.totalPages, p + 1))}
                              disabled={goldCurrentPage >= goldUsersQuery.data.totalPages}
                            >
                              Successiva
                            </Button>
                          </div>
                        )}
                      </>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            {/* Partner Webhook Notifications Card */}
            <PartnerWebhookCard />

            {/* Password Reset Dialog */}
            <Dialog open={isPasswordResetDialogOpen} onOpenChange={setIsPasswordResetDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Reimposta Password</DialogTitle>
                  <DialogDescription>
                    Imposta una nuova password per {passwordResetTarget?.email}
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword">Nuova Password</Label>
                    <Input
                      id="newPassword"
                      type="text"
                      placeholder="Inserisci la nuova password (min. 6 caratteri)"
                      value={newPasswordInput}
                      onChange={(e) => setNewPasswordInput(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsPasswordResetDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button 
                    onClick={() => {
                      if (passwordResetTarget?.type === "bronze") {
                        resetBronzePasswordMutation.mutate({ userId: passwordResetTarget.id, newPassword: newPasswordInput });
                      } else if (passwordResetTarget?.type === "silver") {
                        resetSilverPasswordMutation.mutate({ subscriptionId: passwordResetTarget.id, newPassword: newPasswordInput });
                      }
                    }}
                    disabled={newPasswordInput.length < 6 || resetBronzePasswordMutation.isPending || resetSilverPasswordMutation.isPending}
                  >
                    {(resetBronzePasswordMutation.isPending || resetSilverPasswordMutation.isPending) && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Imposta Password
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {/* AlertDialog per conferma eliminazione utente Bronze */}
            <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Conferma eliminazione</AlertDialogTitle>
                  <AlertDialogDescription>
                    Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.email}</strong>?
                    Questa azione non può essere annullata.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-red-600 hover:bg-red-700"
                    onClick={() => userToDelete && deleteBronzeUserMutation.mutate(userToDelete.id)}
                    disabled={deleteBronzeUserMutation.isPending}
                  >
                    {deleteBronzeUserMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Eliminazione...
                      </>
                    ) : (
                      <>
                        <Trash2 className="h-4 w-4 mr-2" />
                        Elimina
                      </>
                    )}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {/* Active Subscriptions List */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-violet-600" />
                  Sottoscrizioni Attive
                </CardTitle>
                <CardDescription>
                  Clienti con sottoscrizioni Level 2 o Level 3 attive
                </CardDescription>
              </CardHeader>
              <CardContent>
                {subscriptionsQuery.isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  </div>
                ) : subscriptions.length === 0 ? (
                  <div className="text-center py-12">
                    <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-lg font-medium text-muted-foreground mb-2">
                      Nessuna sottoscrizione attiva
                    </p>
                    <p className="text-sm text-muted-foreground max-w-md mx-auto">
                      Quando i tuoi clienti acquisteranno una licenza Level 2 o Level 3, 
                      appariranno qui con tutti i dettagli della loro sottoscrizione.
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Telefono</TableHead>
                          <TableHead>Livello</TableHead>
                          <TableHead>Importo</TableHead>
                          <TableHead>Stato</TableHead>
                          <TableHead>Prossimo Rinnovo</TableHead>
                          <TableHead>Totale Pagato</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subscriptions.map((sub: any) => (
                          <TableRow key={sub.id}>
                            <TableCell className="font-medium">
                              {sub.clientName || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sub.clientEmail}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sub.phone || "—"}
                            </TableCell>
                            <TableCell>
                              <LevelBadge level={sub.level} size="sm" />
                            </TableCell>
                            <TableCell className="font-medium">
                              {sub.stripe?.amount 
                                ? `€${(sub.stripe.amount / 100).toFixed(2)}/${sub.stripe.interval === 'year' ? 'anno' : 'mese'}` 
                                : "—"}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                variant={sub.status === "active" ? "default" : "outline"}
                                className={
                                  sub.status === "active" 
                                    ? "bg-green-100 text-green-700 border-green-300 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" 
                                    : sub.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800"
                                    : sub.status === "canceled"
                                    ? "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                                    : "bg-muted text-foreground border-border"
                                }
                              >
                                {sub.status === "active" ? "Attivo" 
                                  : sub.status === "pending" ? "In Attesa"
                                  : sub.status === "canceled" ? "Annullato"
                                  : sub.status === "expired" ? "Scaduto"
                                  : sub.status === "past_due" ? "Scaduto"
                                  : sub.status}
                                {sub.stripe?.cancelAtPeriodEnd && " (in scadenza)"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {sub.stripe?.currentPeriodEnd 
                                ? format(new Date(sub.stripe.currentPeriodEnd), "d MMM yyyy", { locale: it })
                                : "—"}
                            </TableCell>
                            <TableCell className="font-medium text-green-600">
                              {sub.totalPaid 
                                ? `€${(sub.totalPaid / 100).toFixed(2)}`
                                : "€0,00"}
                            </TableCell>
                            <TableCell className="text-right">
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setSelectedSubscription(sub);
                                      setIsSubscriptionDetailOpen(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-2" />
                                    Visualizza Dettagli
                                  </DropdownMenuItem>
                                  <DropdownMenuItem 
                                    onClick={() => {
                                      setPasswordResetTarget({ 
                                        type: "silver", 
                                        id: sub.id, 
                                        email: sub.clientEmail 
                                      });
                                      setNewPasswordInput("");
                                      setIsPasswordResetDialogOpen(true);
                                    }}
                                  >
                                    <KeyRound className="h-4 w-4 mr-2" />
                                    Reset Password
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  {sub.status === "active" && !sub.stripe?.cancelAtPeriodEnd && (
                                    <DropdownMenuItem 
                                      className="text-red-600"
                                      onClick={() => {
                                        setSubscriptionToCancel(sub);
                                        setIsCancelDialogOpen(true);
                                      }}
                                    >
                                      <Ban className="h-4 w-4 mr-2" />
                                      Annulla Abbonamento
                                    </DropdownMenuItem>
                                  )}
                                  {sub.invoices?.length > 0 && (
                                    <DropdownMenuItem 
                                      onClick={() => {
                                        const lastInvoice = sub.invoices[0];
                                        if (lastInvoice?.hostedInvoiceUrl) {
                                          window.open(lastInvoice.hostedInvoiceUrl, "_blank");
                                        }
                                      }}
                                    >
                                      <FileDown className="h-4 w-4 mr-2" />
                                      Ultima Fattura
                                    </DropdownMenuItem>
                                  )}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Employee License Purchases History */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-violet-600" />
                  Storico Acquisti Licenze
                </CardTitle>
                <CardDescription>
                  I tuoi acquisti di licenze dipendenti
                </CardDescription>
              </CardHeader>
              <CardContent>
                {purchasesQuery.isLoading ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-6 w-6 animate-spin text-violet-500" />
                  </div>
                ) : !purchasesQuery.data?.length ? (
                  <div className="text-center py-8">
                    <Receipt className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Nessun acquisto effettuato
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Gli acquisti di licenze dipendenti appariranno qui
                    </p>
                  </div>
                ) : (
                  <div className="rounded-lg border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Licenze</TableHead>
                          <TableHead>Importo</TableHead>
                          <TableHead>Stato</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {purchasesQuery.data.map((purchase: any) => (
                          <TableRow key={purchase.id}>
                            <TableCell>
                              {format(new Date(purchase.createdAt), "d MMM yyyy", { locale: it })}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{purchase.quantity} licenze</Badge>
                            </TableCell>
                            <TableCell className="font-medium">
                              €{(purchase.amountCents / 100).toFixed(2)}
                            </TableCell>
                            <TableCell>
                              <Badge 
                                className={
                                  purchase.status === "completed" 
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                                    : purchase.status === "pending"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 dark:bg-yellow-900/30 dark:text-yellow-400"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                }
                              >
                                {purchase.status === "completed" ? "Completato" 
                                  : purchase.status === "pending" ? "In attesa"
                                  : "Fallito"}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Monthly Invoices Section */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-violet-600" />
                  Storico Fatture
                </CardTitle>
                <CardDescription>
                  Riepilogo mensile delle tue entrate e commissioni
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    Nessuna fattura disponibile
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Quando avrai transazioni attive, qui troverai il riepilogo mensile con le tue entrate, 
                    la quota piattaforma e i costi AI.
                  </p>
                  <Badge variant="outline" className="text-xs">
                    Funzionalità in arrivo con Stripe
                  </Badge>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Page Link Section */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Link className="h-5 w-5 text-violet-600" />
                  Pagina Prezzi Pubblica
                </CardTitle>
                <CardDescription>
                  Condividi la tua pagina prezzi con i potenziali clienti
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {consultantData?.pricingPageSlug ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 bg-violet-50 dark:bg-violet-950/20 rounded-lg">
                      <Input 
                        readOnly 
                        value={`${window.location.origin}/c/${consultantData.pricingPageSlug}/pricing`}
                        className="flex-1 bg-card"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/c/${consultantData.pricingPageSlug}/pricing`);
                          toast({
                            title: "✅ Link copiato!",
                            description: "Il link alla pagina prezzi è stato copiato negli appunti.",
                          });
                        }}
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copia
                      </Button>
                    </div>
                    <div className="flex gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => window.open(`/c/${consultantData.pricingPageSlug}/pricing`, "_blank")}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visualizza Pagina
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => navigate("/consultant/settings")}
                      >
                        <Settings className="h-4 w-4 mr-2" />
                        Configura Prezzi
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Link className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />
                    <p className="text-sm font-medium text-muted-foreground mb-2">
                      Pagina prezzi non configurata
                    </p>
                    <p className="text-xs text-muted-foreground mb-4">
                      Configura la tua pagina prezzi pubblica per permettere ai clienti di acquistare sottoscrizioni.
                    </p>
                    <Button 
                      variant="outline"
                      onClick={() => navigate("/consultant/settings")}
                    >
                      <Settings className="h-4 w-4 mr-2" />
                      Configura Pagina Prezzi
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Default Onboarding Preferences Card */}
            <Card className="border-2 border-violet-200 dark:border-violet-800">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-violet-600" />
                  Preferenze Onboarding Predefinite
                </CardTitle>
                <CardDescription>
                  Imposta le preferenze predefinite che verranno applicate ai nuovi clienti durante l'onboarding
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="writingStyle">Stile di Scrittura</Label>
                    <Select
                      value={onboardingWritingStyle}
                      onValueChange={setOnboardingWritingStyle}
                    >
                      <SelectTrigger id="writingStyle">
                        <SelectValue placeholder="Seleziona stile" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Professionale">Professionale</SelectItem>
                        <SelectItem value="Amichevole">Amichevole</SelectItem>
                        <SelectItem value="Formale">Formale</SelectItem>
                        <SelectItem value="Informale">Informale</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="responseLength">Lunghezza Risposte</Label>
                    <Select
                      value={onboardingResponseLength}
                      onValueChange={setOnboardingResponseLength}
                    >
                      <SelectTrigger id="responseLength">
                        <SelectValue placeholder="Seleziona lunghezza" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Breve">Breve</SelectItem>
                        <SelectItem value="Media">Media</SelectItem>
                        <SelectItem value="Dettagliata">Dettagliata</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customInstructions">Istruzioni Personalizzate</Label>
                  <Textarea
                    id="customInstructions"
                    placeholder="Inserisci istruzioni personalizzate per l'AI durante l'onboarding dei nuovi clienti..."
                    value={onboardingCustomInstructions}
                    onChange={(e) => setOnboardingCustomInstructions(e.target.value)}
                    rows={4}
                  />
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button
                    onClick={() => saveOnboardingPrefsMutation.mutate({
                      writingStyle: onboardingWritingStyle,
                      responseLength: onboardingResponseLength,
                      customInstructions: onboardingCustomInstructions,
                    })}
                    disabled={saveOnboardingPrefsMutation.isPending}
                  >
                    {saveOnboardingPrefsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvataggio...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" />
                        Salva Preferenze
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => setIsBulkApplyDialogOpen(true)}
                  >
                    <Users className="mr-2 h-4 w-4" />
                    Applica a Tutti i Clienti
                  </Button>
                  
                  <Button
                    variant="ghost"
                    onClick={() => {
                      setOnboardingWritingStyle("");
                      setOnboardingResponseLength("");
                      setOnboardingCustomInstructions("");
                      toast({
                        title: "Preferenze resettate",
                        description: "I campi sono stati svuotati. Clicca 'Salva Preferenze' per confermare.",
                      });
                    }}
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Resetta
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Bulk Apply Preferences Dialog */}
            <Dialog open={isBulkApplyDialogOpen} onOpenChange={setIsBulkApplyDialogOpen}>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Applica Preferenze ai Clienti</DialogTitle>
                  <DialogDescription>
                    Seleziona i tier a cui applicare le preferenze di onboarding correnti
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-3">
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="tier-bronze"
                        checked={bulkApplyTiers.includes("bronze")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkApplyTiers([...bulkApplyTiers, "bronze"]);
                          } else {
                            setBulkApplyTiers(bulkApplyTiers.filter(t => t !== "bronze"));
                          }
                        }}
                      />
                      <Label htmlFor="tier-bronze" className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-600" />
                        Bronze
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="tier-silver"
                        checked={bulkApplyTiers.includes("silver")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkApplyTiers([...bulkApplyTiers, "silver"]);
                          } else {
                            setBulkApplyTiers(bulkApplyTiers.filter(t => t !== "silver"));
                          }
                        }}
                      />
                      <Label htmlFor="tier-silver" className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-muted-foreground" />
                        Silver
                      </Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="tier-gold"
                        checked={bulkApplyTiers.includes("gold")}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setBulkApplyTiers([...bulkApplyTiers, "gold"]);
                          } else {
                            setBulkApplyTiers(bulkApplyTiers.filter(t => t !== "gold"));
                          }
                        }}
                      />
                      <Label htmlFor="tier-gold" className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-yellow-600" />
                        Gold
                      </Label>
                    </div>
                  </div>
                  
                  {bulkApplyTiers.length > 0 && (
                    <Alert>
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Le preferenze verranno applicate a tutti i clienti dei tier selezionati.
                        Questa azione sovrascriverà le preferenze esistenti.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsBulkApplyDialogOpen(false)}>
                    Annulla
                  </Button>
                  <Button
                    onClick={() => bulkApplyPrefsMutation.mutate({
                      writingStyle: onboardingWritingStyle,
                      responseLength: onboardingResponseLength,
                      customInstructions: onboardingCustomInstructions,
                      targetTiers: bulkApplyTiers,
                    })}
                    disabled={bulkApplyTiers.length === 0 || bulkApplyPrefsMutation.isPending}
                  >
                    {bulkApplyPrefsMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Applicazione...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" />
                        Applica
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>
        </Tabs>
      </div>


      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Conferma Eliminazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare l'agente <strong>"{configToDelete?.agentName}"</strong>?
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Annulla
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminazione...
                </>
              ) : (
                "Elimina"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscription Detail Modal */}
      <Dialog open={isSubscriptionDetailOpen} onOpenChange={setIsSubscriptionDetailOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-violet-600" />
              Dettagli Sottoscrizione
            </DialogTitle>
            <DialogDescription>
              Informazioni complete sulla sottoscrizione del cliente
            </DialogDescription>
          </DialogHeader>
          
          {selectedSubscription && (
            <div className="space-y-6">
              {/* Client Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Nome</p>
                  <p className="font-medium">{selectedSubscription.clientName || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{selectedSubscription.clientEmail}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Telefono</p>
                  <p className="font-medium">{selectedSubscription.phone || "—"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">Livello</p>
                  <LevelBadge level={selectedSubscription.level} size="sm" />
                </div>
              </div>

              {/* Subscription Info */}
              <div className="border-t pt-4">
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  Abbonamento
                </h4>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Importo</p>
                    <p className="font-medium text-lg">
                      {selectedSubscription.stripe?.amount 
                        ? `€${(selectedSubscription.stripe.amount / 100).toFixed(2)}/${selectedSubscription.stripe.interval === 'year' ? 'anno' : 'mese'}` 
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Stato</p>
                    <Badge 
                      className={
                        selectedSubscription.status === "active" 
                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" 
                          : selectedSubscription.status === "canceled"
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : "bg-muted text-foreground"
                      }
                    >
                      {selectedSubscription.status === "active" ? "Attivo" 
                        : selectedSubscription.status === "canceled" ? "Annullato"
                        : selectedSubscription.status}
                      {selectedSubscription.stripe?.cancelAtPeriodEnd && " (in scadenza)"}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Data Inizio</p>
                    <p className="font-medium">
                      {selectedSubscription.startDate 
                        ? format(new Date(selectedSubscription.startDate), "d MMMM yyyy", { locale: it })
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Prossimo Rinnovo</p>
                    <p className="font-medium">
                      {selectedSubscription.stripe?.currentPeriodEnd 
                        ? format(new Date(selectedSubscription.stripe.currentPeriodEnd), "d MMMM yyyy", { locale: it })
                        : "—"}
                    </p>
                  </div>
                  <div className="space-y-1 col-span-2">
                    <p className="text-sm text-muted-foreground">Totale Pagato</p>
                    <p className="font-medium text-xl text-green-600">
                      €{((selectedSubscription.totalPaid || 0) / 100).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Invoice History */}
              {selectedSubscription.invoices?.length > 0 && (
                <div className="border-t pt-4">
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Receipt className="h-4 w-4" />
                    Storico Pagamenti
                  </h4>
                  <div className="space-y-2">
                    {selectedSubscription.invoices.map((invoice: any) => (
                      <div key={invoice.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium">€{(invoice.amountPaid / 100).toFixed(2)}</p>
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(invoice.created), "d MMM yyyy", { locale: it })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={invoice.status === "paid" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-muted text-foreground"}>
                            {invoice.status === "paid" ? "Pagata" : invoice.status}
                          </Badge>
                          {invoice.hostedInvoiceUrl && (
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => window.open(invoice.hostedInvoiceUrl, "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="border-t pt-4 flex gap-2">
                <Button 
                  variant="outline"
                  onClick={() => {
                    setPasswordResetTarget({ 
                      type: "silver", 
                      id: selectedSubscription.id, 
                      email: selectedSubscription.clientEmail 
                    });
                    setNewPasswordInput("");
                    setIsPasswordResetDialogOpen(true);
                  }}
                >
                  <KeyRound className="h-4 w-4 mr-2" />
                  Reset Password
                </Button>
                {selectedSubscription.status === "active" && !selectedSubscription.stripe?.cancelAtPeriodEnd && (
                  <Button 
                    variant="destructive"
                    onClick={() => {
                      setSubscriptionToCancel(selectedSubscription);
                      setIsSubscriptionDetailOpen(false);
                      setIsCancelDialogOpen(true);
                    }}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Annulla Abbonamento
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Subscription Dialog */}
      <AlertDialog open={isCancelDialogOpen} onOpenChange={setIsCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annulla Abbonamento</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per annullare l'abbonamento di <strong>{subscriptionToCancel?.clientName || subscriptionToCancel?.clientEmail}</strong>.
              <br /><br />
              Scegli come procedere:
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel disabled={cancelSubscriptionMutation.isPending}>
              Mantieni Attivo
            </AlertDialogCancel>
            <Button
              variant="outline"
              onClick={() => {
                if (subscriptionToCancel) {
                  cancelSubscriptionMutation.mutate({ 
                    subscriptionId: subscriptionToCancel.id, 
                    cancelImmediately: false 
                  });
                }
              }}
              disabled={cancelSubscriptionMutation.isPending}
            >
              {cancelSubscriptionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Annulla a Fine Periodo
            </Button>
            <AlertDialogAction
              onClick={() => {
                if (subscriptionToCancel) {
                  cancelSubscriptionMutation.mutate({ 
                    subscriptionId: subscriptionToCancel.id, 
                    cancelImmediately: true 
                  });
                }
              }}
              disabled={cancelSubscriptionMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelSubscriptionMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Annulla Subito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ConsultantAIAssistant />

      <Dialog open={showRoutingGuide} onOpenChange={setShowRoutingGuide}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <HelpCircle className="h-5 w-5 text-blue-500" />
              Guida: Come vengono riconosciuti gli utenti su WhatsApp
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-6 mt-4">
            <div className="bg-muted/50 rounded-xl p-5 border border-border">
              <h3 className="font-semibold text-foreground mb-3 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Diagramma di Flusso
              </h3>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 p-3 bg-card rounded-lg border border-border">
                  <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-blue-600 font-bold text-xs">1</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Messaggio WhatsApp in arrivo</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Il sistema identifica il numero di telefono del mittente</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-amber-600 font-bold text-xs">2</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Sei tu il consulente?</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Se sei tu → accesso pieno a tutti i dati CRM come nell'app</p>
                  </div>
                </div>
                
                <div className="flex items-start gap-3 p-3 bg-purple-50 dark:bg-purple-950/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-purple-600 font-bold text-xs">3</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">L'agente ha livelli configurati?</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Se ha livelli (Bronze/Silver/Gold) → cerca il telefono negli utenti dell'agente per determinare il livello</p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <span className="text-green-600 font-bold text-xs">4</span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Agente standard (senza livelli)</p>
                    <p className="text-muted-foreground text-xs mt-0.5">Flusso classico: clienti registrati → accesso CRM completo. Lead → prompt generico.</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <h3 className="font-semibold text-foreground p-4 pb-2 flex items-center gap-2">
                <Users className="h-4 w-4 text-indigo-600" />
                Tabella Riconoscimento per Agenti con Livelli
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/50 border-y border-border">
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground">Chi scrive</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground">Riconoscimento</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-foreground">Livello</th>
                      <th className="text-left px-4 py-2.5 font-semibold text-foreground">Prompt AI</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-foreground">CRM</th>
                      <th className="text-center px-4 py-2.5 font-semibold text-foreground">Limite msg</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    <tr className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 font-medium">Sconosciuto</td>
                      <td className="px-4 py-2.5 text-muted-foreground">Nessun match</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">Default (1)</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">Base + Overlay L1</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                    </tr>
                    <tr className="hover:bg-amber-50/50 dark:hover:bg-amber-950/10">
                      <td className="px-4 py-2.5 font-medium">Utente Bronze</td>
                      <td className="px-4 py-2.5 text-amber-600">bronze_users</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 text-xs font-medium">1 (Bronze)</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">Base + Overlay L1</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                      <td className="px-4 py-2.5 text-center text-green-600 font-medium">Si</td>
                    </tr>
                    <tr className="hover:bg-muted/50">
                      <td className="px-4 py-2.5 font-medium">Utente Silver</td>
                      <td className="px-4 py-2.5 text-muted-foreground">client_level_subscriptions</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-muted text-muted-foreground text-xs font-medium">2 (Silver)</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">Base + L1 + L2</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground/60">No</td>
                    </tr>
                    <tr className="hover:bg-yellow-50/50 dark:hover:bg-yellow-950/10">
                      <td className="px-4 py-2.5 font-medium">Utente Gold</td>
                      <td className="px-4 py-2.5 text-yellow-600">client_level_subscriptions</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 text-xs font-medium">3 (Gold)</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">Base + L1 + L2 + L3</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground/60">No</td>
                    </tr>
                    <tr className="hover:bg-blue-50/50 dark:hover:bg-blue-950/10">
                      <td className="px-4 py-2.5 font-medium">Cliente registrato</td>
                      <td className="px-4 py-2.5 text-blue-600">Cerca in utenti agente</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs font-medium">Trovato o 1</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">Per livello trovato</td>
                      <td className="px-4 py-2.5 text-center text-red-500">No</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground/60">Per piano</td>
                    </tr>
                    <tr className="hover:bg-indigo-50/50 dark:hover:bg-indigo-950/10">
                      <td className="px-4 py-2.5 font-medium">Consulente</td>
                      <td className="px-4 py-2.5 text-indigo-600">Prioritario</td>
                      <td className="px-4 py-2.5 text-center"><span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 text-xs font-medium">N/A</span></td>
                      <td className="px-4 py-2.5 text-muted-foreground">CRM completo</td>
                      <td className="px-4 py-2.5 text-center text-green-600 font-medium">Si</td>
                      <td className="px-4 py-2.5 text-center text-muted-foreground/60">N/A</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 rounded-xl p-5 border border-amber-200 dark:border-amber-800">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Crown className="h-4 w-4 text-amber-500" />
                Come funzionano gli Overlay
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><span className="font-medium text-amber-700">Livello 1 (Bronze):</span> Istruzioni base + Overlay L1</p>
                <p><span className="font-medium text-muted-foreground">Livello 2 (Silver):</span> Istruzioni base + Overlay L1 + Overlay L2 (additivo)</p>
                <p><span className="font-medium text-yellow-700">Livello 3 (Gold):</span> Istruzioni base + Overlay L1 + Overlay L2 + Overlay L3 (additivo)</p>
                <p className="mt-3 text-xs text-muted-foreground italic">Ogni livello superiore include tutti gli overlay dei livelli precedenti. Vince sempre il livello piu alto trovato.</p>
              </div>
            </div>

            <div className="bg-green-50 rounded-xl p-5 border border-green-200">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-green-600" />
                Eccezione: Assistenza Clienti (Default)
              </h3>
              <p className="text-sm text-muted-foreground">
                L'agente "Assistenza Clienti" (senza livelli) riconosce sempre i clienti registrati sulla piattaforma con accesso completo ai loro dati CRM (esercizi, appuntamenti, profilo). I lead vengono trattati con il prompt generico.
              </p>
            </div>

            <div className="bg-blue-50 rounded-xl p-5 border border-blue-200">
              <h3 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                <Bot className="h-4 w-4 text-blue-600" />
                Debug: Log in Console
              </h3>
              <p className="text-sm text-muted-foreground">
                Per ogni messaggio WhatsApp ricevuto da un agente con livelli, viene stampata una mappa decisionale completa nei log della console del server. Cerca "LEVEL AGENT - MAPPA DECISIONALE" nei log per vedere tutti i dettagli: telefono, livello assegnato, overlay applicati e stato messaggi.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </WhatsAppLayout>
  );
}
