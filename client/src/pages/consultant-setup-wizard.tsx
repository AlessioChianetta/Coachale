import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { getAuthHeaders } from "@/lib/auth";
import Sidebar from "@/components/sidebar";
import Navbar from "@/components/navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useRoleSwitch } from "@/hooks/use-role-switch";
import { cn } from "@/lib/utils";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { ChatPanel } from "@/components/ai-assistant/ChatPanel";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import {
  Check,
  Circle,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  Sparkles,
  Mail,
  Calendar,
  Video,
  UserPlus,
  MessageSquare,
  FileText,
  Settings,
  ExternalLink,
  Loader2,
  RefreshCw,
  Rocket,
  Bot,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowDownToLine,
  ArrowUpFromLine,
  Briefcase,
  Link as LinkIcon,
  Lightbulb,
  BookOpen,
  ClipboardList,
  MailCheck,
  MailPlus,
  Phone,
  Instagram,
  CreditCard,
  Inbox,
  Copy,
  ArrowUpDown,
  Users,
} from "lucide-react";

type StepStatus = "pending" | "configured" | "verified" | "error" | "skipped";

interface InlineConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "toggle" | "select" | "textarea";
  placeholder?: string;
  hint?: string;
  options?: { value: string; label: string }[];
  sensitive?: boolean;
  required?: boolean;
}

interface InlineConfig {
  getEndpoint: string;
  saveEndpoint: string;
  saveMethod?: "POST" | "PUT";
  fields: InlineConfigField[];
  dataMapper?: (apiResponse: any) => Record<string, any>;
  payloadMapper?: (formState: Record<string, any>) => any;
  oauthStart?: string;
  oauthStatusField?: string;
  oauthLabel?: string;
  usedBySteps?: string[];
}

interface OnboardingStep {
  id: string;
  stepNumber: number;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: StepStatus;
  testedAt?: string;
  errorMessage?: string;
  configLink: string;
  testEndpoint?: string;
  count?: number;
  countLabel?: string;
  optional?: boolean;
  inlineConfig?: InlineConfig;
  priority: 1 | 2 | 3 | 4 | 5;
  sectionId?: string;
}

interface Section {
  id: string;
  emoji: string;
  title: string;
  tagline: string;
  color: string;
  gradient: string;
  steps: OnboardingStep[];
}

interface OnboardingStatus {
  id: string;
  consultantId: string;
  vertexAiStatus: StepStatus;
  vertexAiTestedAt?: string;
  vertexAiErrorMessage?: string;
  smtpStatus: StepStatus;
  smtpTestedAt?: string;
  smtpErrorMessage?: string;
  googleCalendarStatus: StepStatus;
  googleCalendarTestedAt?: string;
  googleCalendarErrorMessage?: string;
  videoMeetingStatus: StepStatus;
  videoMeetingTestedAt?: string;
  videoMeetingErrorMessage?: string;
  leadImportStatus: StepStatus;
  leadImportTestedAt?: string;
  leadImportErrorMessage?: string;
  whatsappAiStatus: StepStatus;
  whatsappAiTestedAt?: string;
  whatsappAiErrorMessage?: string;
  knowledgeBaseStatus: StepStatus;
  knowledgeBaseDocumentsCount: number;
  clientAiStrategy: string;
  onboardingCompleted: boolean;
  hasVertexConfig?: boolean;
  hasSmtpConfig?: boolean;
  hasTurnConfig?: boolean;
  documentsCount?: number;
  hasInboundAgent: boolean;
  hasOutboundAgent: boolean;
  hasConsultativeAgent: boolean;
  hasTwilioConfiguredAgent: boolean;
  twilioAgentStatus?: StepStatus;
  twilioAgentTestedAt?: string;
  twilioAgentErrorMessage?: string;
  hasPublicAgentLink: boolean;
  publicLinksCount: number;
  hasGeneratedIdeas: boolean;
  generatedIdeasCount: number;
  hasCustomTemplate: boolean;
  customTemplatesCount: number;
  hasApprovedTemplate: boolean;
  approvedTemplatesCount: number;
  hasFirstCampaign: boolean;
  campaignsCount: number;
  hasCreatedCourse: boolean;
  coursesCount: number;
  hasCreatedExercise: boolean;
  exercisesCount: number;
  hasFirstSummaryEmail: boolean;
  summaryEmailsCount: number;
  hasNurturingEmails: boolean;
  nurturingEmailsCount: number;
  hasEmailHubAccount: boolean;
  emailHubAccountsCount: number;
  instagramStatus: StepStatus;
  instagramTestedAt?: string;
  instagramErrorMessage?: string;
  hasInstagramConfigured: boolean;
  hasStripeAccount?: boolean;
  stripeAccountStatus?: string | null;
  hasEmailJourneyConfigured?: boolean;
}

const statusConfig = {
  pending: { icon: Circle, color: "text-slate-400", bg: "bg-slate-100", badgeBg: "bg-slate-100", label: "Non configurato" },
  configured: { icon: Clock, color: "text-indigo-500", bg: "bg-indigo-50", badgeBg: "bg-indigo-100", label: "In corso" },
  verified: { icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50", badgeBg: "bg-emerald-100", label: "Verificato" },
  error: { icon: XCircle, color: "text-red-500", bg: "bg-red-50", badgeBg: "bg-red-100", label: "Errore" },
  skipped: { icon: Circle, color: "text-slate-400", bg: "bg-slate-100", badgeBg: "bg-slate-100", label: "Saltato" },
};

function StatusBadge({ status }: { status: StepStatus }) {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <Badge 
        variant="outline" 
        className={`${config.badgeBg} ${config.color} border-0 text-xs font-normal`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    </motion.div>
  );
}

function StepNumberBadge({ number, status }: { number: number; status: StepStatus }) {
  const bgColor = status === "verified" ? "bg-emerald-500" : status === "configured" ? "bg-indigo-500" : "bg-slate-300";
  const textColor = status === "pending" ? "text-slate-600" : "text-white";
  
  return (
    <div 
      className={`w-7 h-7 rounded-full ${bgColor} ${textColor} flex items-center justify-center text-xs font-bold flex-shrink-0`}
    >
      {status === "verified" ? (
        <Check className="h-3.5 w-3.5" />
      ) : (
        <span>{number}</span>
      )}
    </div>
  );
}

function StepCard({
  step,
  isActive,
  onClick,
}: {
  step: OnboardingStep;
  isActive: boolean;
  onClick: () => void;
}) {
  const config = statusConfig[step.status];

  return (
    <motion.div
      className={`cursor-pointer px-3 py-2.5 rounded-xl transition-all overflow-hidden ${
        isActive
          ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800"
          : "hover:bg-slate-50 dark:hover:bg-slate-800/50"
      }`}
      onClick={onClick}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center gap-2.5">
        <StepNumberBadge number={step.stepNumber} status={step.status} />
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm truncate text-slate-700 dark:text-slate-300">{step.title}</h3>
        </div>
        {step.count !== undefined && step.count > 0 && (
          <span className="text-xs text-slate-500 font-medium bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full">
            {step.count}
          </span>
        )}
      </div>
    </motion.div>
  );
}


const triggerConfetti = () => {
  const count = 200;
  const defaults = {
    origin: { y: 0.7 }
  };

  function fire(particleRatio: number, opts: confetti.Options) {
    confetti({
      ...defaults,
      ...opts,
      particleCount: Math.floor(count * particleRatio),
      spread: 90,
      startVelocity: 30,
    });
  }

  fire(0.25, { spread: 26, startVelocity: 55 });
  fire(0.2, { spread: 60 });
  fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
  fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
  fire(0.1, { spread: 120, startVelocity: 45 });
};

const triggerMiniConfetti = () => {
  confetti({
    particleCount: 50,
    spread: 60,
    origin: { y: 0.6 },
    colors: ['#6C5CE7', '#8B7CF7', '#A78BFA', '#3B82F6'],
    ticks: 100,
    gravity: 1.2,
    scalar: 0.8,
  });
};

// ─── INLINE CONFIG SUB-COMPONENTS ──────────────────────────────────────────

function UsedByBadge({ stepIds, nameMap }: { stepIds: string[]; nameMap: Record<string, string> }) {
  if (!stepIds.length) return null;
  return (
    <div className="flex items-start gap-2 text-xs p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800">
      <LinkIcon className="h-3 w-3 text-blue-500 mt-0.5 flex-shrink-0" />
      <span>
        <span className="font-medium text-blue-700 dark:text-blue-300">Usato anche da: </span>
        <span className="text-blue-600 dark:text-blue-400">{stepIds.map(id => nameMap[id] || id).join(", ")}</span>
      </span>
    </div>
  );
}

function InlineField({
  field,
  value,
  onChange,
  isConfigured,
  isSensitiveEditing,
  onStartSensitiveEdit,
}: {
  field: InlineConfigField;
  value: any;
  onChange: (v: any) => void;
  isConfigured: boolean;
  isSensitiveEditing: boolean;
  onStartSensitiveEdit: () => void;
}) {
  return (
    <div className="space-y-1.5">
      {field.type !== "toggle" && (
        <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</Label>
      )}

      {field.type === "text" && (
        <Input
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-8 text-sm font-mono"
        />
      )}

      {field.type === "number" && (
        <Input
          type="number"
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="h-8 text-sm font-mono"
        />
      )}

      {field.type === "textarea" && (
        <Textarea
          value={value || ""}
          onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="text-xs font-mono min-h-[80px]"
        />
      )}

      {field.type === "password" && field.sensitive && isConfigured && !isSensitiveEditing ? (
        <div className="flex items-center gap-2">
          <div className="flex-1 h-8 px-3 rounded-md border bg-slate-50 dark:bg-slate-800 flex items-center text-slate-400 text-sm font-mono">
            ••••••••
          </div>
          <button
            onClick={onStartSensitiveEdit}
            className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 whitespace-nowrap"
          >
            Modifica
          </button>
        </div>
      ) : field.type === "password" ? (
        <div className="space-y-1">
          <Input
            type="password"
            value={value || ""}
            onChange={e => onChange(e.target.value)}
            placeholder={field.placeholder || "••••••••"}
            className="h-8 text-sm font-mono"
          />
          {field.sensitive && isConfigured && (
            <p className="text-xs text-muted-foreground">Lascia vuoto per mantenere il valore salvato</p>
          )}
        </div>
      ) : null}

      {field.type === "toggle" && (
        <div className="flex items-center justify-between py-1">
          <Label className="text-xs font-medium text-slate-700 dark:text-slate-300">{field.label}</Label>
          <Switch
            checked={value ?? false}
            onCheckedChange={onChange}
          />
        </div>
      )}

      {field.type === "select" && field.options && (
        <Select value={value || ""} onValueChange={onChange}>
          <SelectTrigger className="h-8 text-sm">
            <SelectValue placeholder={field.placeholder} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map(opt => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {field.hint && (
        <p className="text-xs text-muted-foreground">{field.hint}</p>
      )}
    </div>
  );
}

function InlineConfigPanel({
  config,
  stepId,
  onSaveSuccess,
  testEndpoint,
  testingStep,
  onTest,
  nameMap,
}: {
  config: InlineConfig;
  stepId: string;
  onSaveSuccess: () => void;
  testEndpoint?: string;
  testingStep: string | null;
  onTest: (stepId: string, endpoint?: string) => void;
  nameMap: Record<string, string>;
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [formState, setFormState] = useState<Record<string, any>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [isAlreadyConfigured, setIsAlreadyConfigured] = useState(false);
  const [sensitiveEditing, setSensitiveEditing] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  // Query per dati esistenti (form fields) — abilitata solo per config non-OAuth
  const { data: existingData, isLoading: isLoadingData } = useQuery({
    queryKey: [`inline-config-${config.getEndpoint}`],
    queryFn: async () => {
      const res = await fetch(config.getEndpoint, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    enabled: !!config.getEndpoint && !config.oauthStart,
  });

  // Query per stato OAuth — abilitata solo per config OAuth (sempre in cima, mai condizionale)
  const { data: oauthData } = useQuery({
    queryKey: [`oauth-status-${config.getEndpoint}`],
    queryFn: async () => {
      const res = await fetch(config.getEndpoint, { headers: getAuthHeaders() });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!config.getEndpoint && !!config.oauthStart,
  });

  useEffect(() => {
    if (existingData && config.dataMapper) {
      const mapped = config.dataMapper(existingData);
      setFormState(mapped);
      const hasValues = Object.entries(mapped).some(([, v]) => {
        if (typeof v === "boolean") return true;
        return v !== "" && v !== undefined && v !== null;
      });
      setIsAlreadyConfigured(hasValues);
      if (hasValues) setIsExpanded(false);
      else setIsExpanded(true);
    }
  }, [existingData]);

  const handleSave = async () => {
    if (!config.payloadMapper) return;
    setIsSaving(true);
    try {
      const payload = config.payloadMapper(formState);
      // Rimuovi campi password vuoti (mantenere valore salvato)
      config.fields.forEach(f => {
        if (f.sensitive && f.type === "password" && !sensitiveEditing.has(f.key)) {
          if (!formState[f.key]) delete payload[f.key];
        }
      });
      const res = await fetch(config.saveEndpoint, {
        method: config.saveMethod || "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Errore nel salvataggio");
      }
      setSaveSuccess(true);
      setIsAlreadyConfigured(true);
      onSaveSuccess();
      setTimeout(() => setSaveSuccess(false), 3000);
      toast({ title: "Salvato!", description: "Configurazione aggiornata correttamente." });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message || "Impossibile salvare", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Pannello OAuth — usa oauthData già caricata in cima (rules of hooks rispettate)
  if (config.oauthStart) {
    const isConnected = oauthData && config.oauthStatusField ? !!oauthData[config.oauthStatusField] : false;
    return (
      <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
            <div>
              <p className="text-sm font-medium">{isConnected ? "Connesso" : "Non connesso"}</p>
              {isConnected && oauthData?.email && (
                <p className="text-xs text-muted-foreground">{oauthData.email}</p>
              )}
            </div>
          </div>
          <Button size="sm" onClick={() => window.location.href = config.oauthStart!} className="gap-1.5">
            <ExternalLink className="h-3 w-3" />
            {isConnected ? "Riconnetti" : config.oauthLabel || "Connetti"}
          </Button>
        </div>
        {config.usedBySteps && config.usedBySteps.length > 0 && (
          <div className="mt-3">
            <UsedByBadge stepIds={config.usedBySteps} nameMap={nameMap} />
          </div>
        )}
      </div>
    );
  }

  // Form inline collassabile
  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full flex-shrink-0 ${isAlreadyConfigured ? "bg-emerald-500" : "bg-slate-300"}`} />
          <span className="text-sm font-medium">
            {isAlreadyConfigured ? "Già configurato — modifica" : "Configura direttamente qui"}
          </span>
          {isLoadingData && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            key="form"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            style={{ overflow: "hidden" }}
          >
            <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-800">
              {config.fields.map(field => (
                <InlineField
                  key={field.key}
                  field={field}
                  value={formState[field.key]}
                  onChange={v => setFormState(s => ({ ...s, [field.key]: v }))}
                  isConfigured={isAlreadyConfigured}
                  isSensitiveEditing={sensitiveEditing.has(field.key)}
                  onStartSensitiveEdit={() => setSensitiveEditing(prev => new Set([...prev, field.key]))}
                />
              ))}

              {config.usedBySteps && config.usedBySteps.length > 0 && (
                <UsedByBadge stepIds={config.usedBySteps} nameMap={nameMap} />
              )}

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={isSaving}
                  className={`flex-1 transition-colors ${saveSuccess ? "bg-emerald-500 hover:bg-emerald-600" : ""}`}
                >
                  {isSaving ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />Salvataggio...</>
                  ) : saveSuccess ? (
                    <><Check className="h-3.5 w-3.5 mr-2" />Salvato</>
                  ) : (
                    "Salva credenziali"
                  )}
                </Button>
                {testEndpoint && saveSuccess && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onTest(stepId, testEndpoint)}
                    disabled={testingStep === stepId}
                    className="gap-1.5"
                  >
                    {testingStep === stepId
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />
                    }
                    Testa
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── SECTION CARD ──────────────────────────────────────────────────────────

function SectionCard({
  section,
  onClick,
  isUrgent,
}: {
  section: Section;
  onClick: () => void;
  isUrgent: boolean;
}) {
  const completed = section.steps.filter(s => s.status === "verified").length;
  const total = section.steps.length;
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isComplete = pct === 100;
  const barColor = pct < 30 ? "bg-red-500" : pct < 80 ? "bg-amber-500" : "bg-emerald-500";
  const badgeColor = pct < 30 ? "text-red-600 border-red-200 bg-red-50" : pct < 80 ? "text-amber-600 border-amber-200 bg-amber-50" : "text-emerald-600 border-emerald-200 bg-emerald-50";

  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -3, boxShadow: "0 8px 25px rgba(0,0,0,0.10)" }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
      className="relative cursor-pointer rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col gap-3 overflow-hidden select-none"
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${section.gradient} opacity-[0.035] pointer-events-none`} />

      <div className="relative flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className="text-3xl leading-none">{section.emoji}</span>
          <div>
            <h2 className="font-bold text-base text-slate-800 dark:text-slate-100 leading-tight">{section.title}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{section.tagline}</p>
          </div>
        </div>
        {isUrgent && !isComplete && (
          <Badge className="text-xs bg-orange-500 text-white border-0 animate-pulse shrink-0">⚡ Inizia</Badge>
        )}
      </div>

      <Separator className="opacity-50" />

      {isComplete ? (
        <div className="flex items-center justify-center gap-2 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-700 dark:text-emerald-300 text-sm font-medium">
          <Check className="h-4 w-4" /> Sezione completata
        </div>
      ) : (
        <>
          <div className="w-full h-2 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${barColor}`}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{completed}/{total} completati</span>
            <Badge variant="outline" className={`font-mono text-xs ${badgeColor}`}>{pct}%</Badge>
          </div>
        </>
      )}

      <Button
        size="sm"
        className={`w-full mt-1 bg-gradient-to-r ${section.gradient} text-white border-0 hover:opacity-90`}
      >
        {isComplete ? "Rivedi →" : pct === 0 ? "Inizia →" : "Continua →"}
      </Button>
    </motion.div>
  );
}

// ─── CONTEXTUAL BANNER ──────────────────────────────────────────────────────

function ContextualBanner({
  sections,
  completedSteps,
  totalSteps,
  onGoToSection,
}: {
  sections: Section[];
  completedSteps: number;
  totalSteps: number;
  onGoToSection: (id: string) => void;
}) {
  const section1 = sections[0];
  const s1Completed = section1?.steps.filter(s => s.status === "verified").length ?? 0;
  const s1Total = section1?.steps.length ?? 1;
  const s1Pct = Math.round((s1Completed / s1Total) * 100);
  const allComplete = completedSteps === totalSteps;

  if (allComplete) {
    return (
      <div className="rounded-2xl p-4 border bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 flex items-center gap-4">
        <span className="text-3xl">🎉</span>
        <div>
          <p className="font-semibold text-emerald-900 dark:text-emerald-100">Sistema completamente attivato!</p>
          <p className="text-sm text-emerald-700 dark:text-emerald-300 mt-0.5">La piattaforma lavora per te 24/7. Concentrati sui clienti.</p>
        </div>
      </div>
    );
  }

  if (s1Pct < 50) {
    return (
      <div className="rounded-2xl p-4 border bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 flex items-center gap-4">
        <span className="text-3xl">⚡</span>
        <div className="flex-1">
          <p className="font-semibold text-blue-900 dark:text-blue-100">Inizia da qui per generare i primi lead</p>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-0.5">Attiva il sistema di acquisizione — ti bastano ~10 minuti. Poi i lead arrivano in automatico.</p>
        </div>
        <Button size="sm" onClick={() => onGoToSection("acquisition")} className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white border-0">
          Vai →
        </Button>
      </div>
    );
  }

  const globalPct = Math.round((completedSteps / totalSteps) * 100);
  if (globalPct >= 70) {
    return (
      <div className="rounded-2xl p-4 border bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800 flex items-center gap-4">
        <span className="text-3xl">🔥</span>
        <div>
          <p className="font-semibold text-violet-900 dark:text-violet-100">Ottimo lavoro! Sei quasi al 100%</p>
          <p className="text-sm text-violet-700 dark:text-violet-300 mt-0.5">Mancano solo {totalSteps - completedSteps} step per la piena automazione.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl p-4 border bg-indigo-50 dark:bg-indigo-900/20 border-indigo-200 dark:border-indigo-800 flex items-center gap-4">
      <span className="text-3xl">🚀</span>
      <div>
        <p className="font-semibold text-indigo-900 dark:text-indigo-100">La macchina sta girando!</p>
        <p className="text-sm text-indigo-700 dark:text-indigo-300 mt-0.5">Continua a completare le sezioni per sbloccare tutta l'automazione.</p>
      </div>
    </div>
  );
}

const CREDENTIAL_NOTES_STEPS = ["vertex_ai", "smtp", "google_calendar_consultant", "twilio_config"];

// ─── NURTURING GENERATE BUTTON ──────────────────────────────────────────────

function NurturingGenerateButton() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);
  const { toast } = useToast();

  const { data: countData, refetch: refetchCount } = useQuery<{ success: boolean; count: number; total: number }>({
    queryKey: ["/api/lead-nurturing/templates/count"],
    queryFn: async () => {
      const res = await fetch("/api/lead-nurturing/templates/count", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const count = countData?.count ?? 0;
  const total = countData?.total ?? 365;
  const remaining = total - count;

  const handleGenerate = async () => {
    if (remaining <= 0) return;
    setIsGenerating(true);
    try {
      const res = await fetch("/api/lead-nurturing/generate-remaining", {
        method: "POST",
        headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error("Generazione fallita");
      setGenerated(true);
      toast({ title: "Generazione avviata!", description: "Le email vengono generate in background. Torna tra qualche minuto." });
      setTimeout(() => refetchCount(), 3000);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="mt-3 p-4 rounded-xl border border-orange-200 dark:border-orange-800 bg-orange-50 dark:bg-orange-900/20 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-orange-800 dark:text-orange-200">Email generate con AI</p>
          <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">{count} / {total} email pronte</p>
        </div>
        <div className="w-24 h-2 bg-orange-200 dark:bg-orange-800 rounded-full overflow-hidden">
          <div className="h-full bg-orange-500 rounded-full" style={{ width: `${Math.round((count / total) * 100)}%` }} />
        </div>
      </div>
      {remaining > 0 ? (
        <Button
          size="sm"
          className="w-full bg-orange-500 hover:bg-orange-600 text-white border-0 gap-2"
          onClick={handleGenerate}
          disabled={isGenerating || generated}
        >
          {isGenerating ? (
            <><Loader2 className="h-3.5 w-3.5 animate-spin" />Generazione in corso...</>
          ) : generated ? (
            <><Check className="h-3.5 w-3.5" />Generazione avviata!</>
          ) : (
            <><Sparkles className="h-3.5 w-3.5" />Genera le rimanenti {remaining} email con AI</>
          )}
        </Button>
      ) : (
        <div className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          Tutte le 365 email sono state generate!
        </div>
      )}
    </div>
  );
}

// ─── AGENT CALENDAR STATUS PANEL ────────────────────────────────────────────

function AgentCalendarStatusPanel() {
  type AgentCalItem = { id: string; agentName: string; agentType: string; isActive?: boolean; calendarConnected: boolean; calendarEmail?: string; googleCalendarEmail?: string };
  const { data, isLoading } = useQuery<AgentCalItem[] | { success: boolean; agents: AgentCalItem[] }>({
    queryKey: ["/api/whatsapp/agents/calendar-status"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agents/calendar-status", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const agentTypeLabel: Record<string, string> = {
    reactive_lead: "Inbound",
    proactive_setter: "Outbound",
    informative_advisor: "Consulenziale",
    round_robin: "Round Robin",
    default: "Standard",
  };

  if (isLoading) {
    return (
      <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />Caricamento agenti...
      </div>
    );
  }

  const agents: AgentCalItem[] = Array.isArray(data) ? data : (data as any)?.agents ?? [];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <Users className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium">Stato calendario per agente</span>
      </div>
      {agents.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          Nessun agente trovato. Crea prima un agente WhatsApp.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {agents.map(agent => (
            <div key={agent.id} className="px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${agent.calendarConnected ? "bg-emerald-500" : "bg-slate-300"}`} />
                <div>
                  <p className="text-sm font-medium">{agent.agentName}</p>
                  <p className="text-xs text-muted-foreground">
                    {agentTypeLabel[agent.agentType] || agent.agentType}
                    {agent.calendarConnected && (agent.calendarEmail || agent.googleCalendarEmail) && ` · ${agent.calendarEmail || agent.googleCalendarEmail}`}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className={`text-xs ${agent.calendarConnected ? "text-emerald-600 border-emerald-200 bg-emerald-50" : "text-slate-500 border-slate-200 bg-slate-50"}`}>
                {agent.calendarConnected ? "Connesso" : "Non connesso"}
              </Badge>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800">
        <p className="text-xs text-muted-foreground">Per collegare Google Calendar ad un agente, vai alla pagina Agenti WhatsApp e seleziona l'agente.</p>
      </div>
    </div>
  );
}

// ─── LEAD IMPORT WEBHOOK PANEL ───────────────────────────────────────────────

function LeadImportWebhookPanel({ consultantId }: { consultantId?: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const baseUrl = window.location.origin;
  const webhookUrl = consultantId
    ? `${baseUrl}/api/webhooks/lead-import/${consultantId}`
    : "";

  const handleCopy = async () => {
    if (!webhookUrl) return;
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setCopied(true);
      toast({ title: "URL copiato!", description: "Webhook URL copiato negli appunti." });
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast({ title: "Copia manuale", description: webhookUrl, variant: "destructive" });
    }
  };

  return (
    <div className="mt-3 rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/20 overflow-hidden">
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-start gap-2">
          <LinkIcon className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-200">URL di ricezione lead</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
              Questo è il tuo endpoint personale. Configuralo su <strong>Zapier</strong>, <strong>Make.com</strong>, <strong>n8n</strong> o il tuo CRM — ogni volta che un contatto compila un form o viene registrato nel tuo CRM, il lead arriva automaticamente qui.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Input
            readOnly
            value={webhookUrl || "Caricamento..."}
            className="h-8 text-xs font-mono bg-white dark:bg-slate-900 border-blue-200 dark:border-blue-700"
          />
          <Button size="sm" variant="outline" onClick={handleCopy} className="shrink-0 gap-1.5 border-blue-200 text-blue-700 hover:bg-blue-100">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Copiato" : "Copia"}
          </Button>
        </div>
      </div>
      <div className="px-4 py-3 bg-white/60 dark:bg-slate-800/40 border-t border-blue-100 dark:border-blue-900 space-y-1.5">
        <p className="text-xs font-medium text-slate-600 dark:text-slate-400">Import Lead Automatico</p>
        <p className="text-xs text-slate-500 dark:text-slate-500">
          Usa il tuo Webhook URL (mostrato sopra) per inviare lead automaticamente da:
        </p>
        <ul className="text-xs text-slate-500 space-y-0.5 list-disc list-inside ml-1">
          <li><strong>Zapier</strong> — collega qualsiasi app (Facebook Lead Ads, Google Sheets, ecc.)</li>
          <li><strong>Make.com</strong> — automazioni avanzate con logica condizionale</li>
          <li><strong>n8n</strong> — self-hosted, per chi preferisce privacy totale</li>
          <li>Qualsiasi CRM/form con supporto webhook HTTP POST</li>
        </ul>
        <p className="text-xs text-slate-400 dark:text-slate-600 italic mt-1">
          Il body della richiesta deve contenere almeno <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">phone</code> o <code className="bg-slate-100 dark:bg-slate-700 px-1 rounded">name</code>.
        </p>
      </div>
    </div>
  );
}

// ─── PUBLIC LINKS PANEL ──────────────────────────────────────────────────────

function PublicLinksPanel() {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ success: boolean; shares: Array<{ id: string; slug: string; agentName: string; isActive: boolean; publicUrl: string; agent?: { agentType?: string } }> }>({
    queryKey: ["/api/whatsapp/agent-share"],
    queryFn: async () => {
      const res = await fetch("/api/whatsapp/agent-share", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const agentTypeLabel: Record<string, string> = {
    reactive_lead: "Inbound",
    proactive_setter: "Outbound",
    informative_advisor: "Consulenziale",
  };

  const handleCopy = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast({ title: "Link copiato!", description: "URL pubblico copiato negli appunti." });
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      toast({ title: "Copia manuale", description: url });
    }
  };

  if (isLoading) {
    return (
      <div className="mt-3 p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />Caricamento link...
      </div>
    );
  }

  const shares = data?.shares?.filter(s => s.isActive) ?? [];

  return (
    <div className="mt-3 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
      <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2">
        <LinkIcon className="h-4 w-4 text-slate-500" />
        <span className="text-sm font-medium">Link pubblici attivi</span>
      </div>
      {shares.length === 0 ? (
        <div className="p-4 text-sm text-muted-foreground">
          Nessun link pubblico trovato. Vai su Agenti WhatsApp → Condivisione per crearne uno.
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {shares.map(share => (
            <div key={share.id} className="px-4 py-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium">{share.agentName}</p>
                  {share.agent?.agentType && (
                    <Badge variant="outline" className="text-xs">{agentTypeLabel[share.agent.agentType] || share.agent.agentType}</Badge>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={share.publicUrl}
                  className="h-7 text-xs font-mono bg-white dark:bg-slate-900"
                />
                <Button size="sm" variant="outline" onClick={() => handleCopy(share.publicUrl, share.id)} className="shrink-0 gap-1.5">
                  {copiedId === share.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === share.id ? "Copiato" : "Copia"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CredentialNotesCard({ stepId }: { stepId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [accountReference, setAccountReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const { data, isLoading } = useQuery<{ accountReference: string | null; notes: string | null }>({
    queryKey: ["/api/consultant/credential-notes", stepId],
    queryFn: async () => {
      const res = await fetch(`/api/consultant/credential-notes/${stepId}`, {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch credential notes");
      return res.json();
    },
    enabled: CREDENTIAL_NOTES_STEPS.includes(stepId),
  });

  useEffect(() => {
    if (data) {
      setAccountReference(data.accountReference || "");
      setNotes(data.notes || "");
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (payload: { accountReference: string; notes: string }) => {
      const res = await fetch(`/api/consultant/credential-notes/${stepId}`, {
        method: "PUT",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save");
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Note salvate",
        description: "Le note sono state salvate correttamente",
      });
      setIsSaving(false);
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Impossibile salvare le note",
        variant: "destructive",
      });
      setIsSaving(false);
    },
  });

  const handleChange = useCallback((field: "accountReference" | "notes", value: string) => {
    if (field === "accountReference") {
      setAccountReference(value);
    } else {
      setNotes(value);
    }

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    setIsSaving(true);
    debounceRef.current = setTimeout(() => {
      const payload = {
        accountReference: field === "accountReference" ? value : accountReference,
        notes: field === "notes" ? value : notes,
      };
      saveMutation.mutate(payload);
    }, 1000);
  }, [accountReference, notes, saveMutation]);

  if (!CREDENTIAL_NOTES_STEPS.includes(stepId)) return null;

  return (
    <div className="mt-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger className="w-full">
          <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 border border-amber-200 dark:border-amber-800 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2">
              <span className="text-lg">📝</span>
              <span className="font-medium text-sm">Note e Riferimento Account</span>
              {(accountReference || notes) && (
                <Badge variant="secondary" className="text-xs bg-amber-100 dark:bg-amber-900/30">
                  Compilato
                </Badge>
              )}
            </div>
            <motion.div
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown className="h-4 w-4 text-amber-600" />
            </motion.div>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-2 p-4 rounded-lg border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 space-y-4"
          >
            {isLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-5 w-5 animate-spin text-amber-500" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor={`account-ref-${stepId}`} className="text-sm font-medium">
                    Riferimento Account
                  </Label>
                  <Input
                    id={`account-ref-${stepId}`}
                    placeholder="Es: Account principale Google Cloud - console.cloud.google.com"
                    value={accountReference}
                    onChange={(e) => handleChange("accountReference", e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    A quale account/progetto sono riferite queste credenziali?
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor={`notes-${stepId}`} className="text-sm font-medium">
                    Note Aggiuntive
                  </Label>
                  <Textarea
                    id={`notes-${stepId}`}
                    placeholder="Aggiungi note, promemoria o dettagli importanti..."
                    value={notes}
                    onChange={(e) => handleChange("notes", e.target.value)}
                    className="text-sm min-h-[80px]"
                  />
                </div>
                <div className="flex items-center justify-end">
                  {isSaving && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-3 w-3 animate-spin" />
                      Salvataggio...
                    </div>
                  )}
                </div>
              </>
            )}
          </motion.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

export default function ConsultantSetupWizard() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();

  const [activeStep, setActiveStep] = useState<string>("twilio_config");
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [testingStep, setTestingStep] = useState<string | null>(null);
  const [isOnboardingMode, setIsOnboardingMode] = useState<boolean>(false);
  const [chatKey, setChatKey] = useState(0);
  const [chatStarted, setChatStarted] = useState(false);
  const [pendingAutoMessage, setPendingAutoMessage] = useState<string | null>(null);

  const openOnboardingMode = () => {
    setChatStarted(false);
    setPendingAutoMessage(null);
    setIsOnboardingMode(true);
  };
  const previousCompletedRef = useRef<number>(0);

  const ONBOARDING_SUGGESTIONS = [
    "Da dove inizio? Quali sono i primi step critici?",
    "Cosa fa esattamente l'agente inbound e quando conviene usarlo?",
    "Qual è la differenza tra agente outbound e campagna WhatsApp?",
    "Come funziona l'AI Autonomo e cosa può fare per me ogni giorno?",
    "Come configuro Twilio per WhatsApp Business?",
    "Cosa devo caricare nella Knowledge Base per far funzionare bene gli agenti?",
    "Come funziona l'Email Journey dopo una consulenza?",
    "Quando ha senso usare le chiamate vocali AI?",
    "Come collego Stripe per incassare automaticamente?",
    "Ho un problema con uno step, mi aiuti a risolverlo?",
  ];
  const { toast } = useToast();

  const { data: onboardingData, isLoading, refetch } = useQuery<{ success: boolean; data: OnboardingStatus }>({
    queryKey: ["/api/consultant/onboarding/status"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/status", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch onboarding status");
      return res.json();
    },
  });

  // Query for AI onboarding statuses (used by the AI assistant to know what's configured)
  interface OnboardingStepStatusForAI {
    stepId: string;
    status: 'pending' | 'configured' | 'verified' | 'error' | 'skipped';
  }
  
  const { data: onboardingStatusesForAI } = useQuery<{ success: boolean; data: OnboardingStepStatusForAI[] }>({
    queryKey: ["/api/consultant/onboarding/status/for-ai"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/onboarding/status/for-ai", {
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch onboarding status for AI");
      return res.json();
    },
    enabled: isOnboardingMode, // Only fetch when onboarding mode is active (uses specific system prompt)
  });

  const testMutation = useMutation({
    mutationFn: async ({ endpoint, stepName }: { endpoint: string; stepName: string }) => {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || "Test failed");
      return { ...data, stepName };
    },
    onSuccess: (data) => {
      triggerMiniConfetti();
      toast({
        title: `${data.stepName} Verificato`,
        description: data.message,
      });
      refetch();
    },
    onError: (error: Error) => {
      toast({
        title: "Configurazione Incompleta",
        description: error.message,
        variant: "destructive",
      });
      refetch();
    },
    onSettled: () => {
      setTestingStep(null);
    },
  });

  const status = onboardingData?.data;

  const getStripeStatus = (stripeStatus: string | null | undefined, hasAccount: boolean | undefined): StepStatus => {
    if (!hasAccount) return "pending";
    if (stripeStatus === "active") return "verified";
    if (stripeStatus === "restricted" || stripeStatus === "pending") return "configured";
    return "pending";
  };

  const sections: Section[] = [
    {
      id: "acquisition",
      emoji: "🚀",
      title: "Acquisisci Clienti",
      tagline: "Ricevi lead e gestisci le conversazioni in automatico",
      color: "blue",
      gradient: "from-blue-500 to-cyan-500",
      steps: [
        {
          id: "twilio_config",
          stepNumber: 1,
          priority: 1,
          title: "Configurazione Twilio + WhatsApp",
          description: "Collega il tuo numero WhatsApp Business tramite Twilio per ricevere e inviare messaggi automatici",
          icon: <Phone className="h-4 w-4" />,
          status: status?.hasTwilioConfiguredAgent ? "verified" : (status?.whatsappAiStatus || "pending"),
          testedAt: status?.twilioAgentTestedAt || status?.whatsappAiTestedAt,
          errorMessage: status?.twilioAgentErrorMessage || status?.whatsappAiErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=twilio",
          testEndpoint: "/api/consultant/onboarding/test/twilio-agent",
          inlineConfig: {
            getEndpoint: "/api/consultant/twilio-settings",
            saveEndpoint: "/api/consultant/twilio-settings",
            saveMethod: "POST",
            dataMapper: (d) => ({
              accountSid: d.settings?.accountSid || d.accountSid || "",
              authToken: "",
              whatsappNumber: d.settings?.whatsappNumber || d.whatsappNumber || "",
            }),
            payloadMapper: (s) => ({ accountSid: s.accountSid, authToken: s.authToken, whatsappNumber: s.whatsappNumber }),
            fields: [
              { key: "accountSid", label: "Account SID", type: "text", placeholder: "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx", hint: "Trovalo su console.twilio.com → Dashboard" },
              { key: "authToken", label: "Auth Token", type: "password", sensitive: true, hint: "Copia da Twilio Console — non viene mai rimostrato" },
              { key: "whatsappNumber", label: "Numero WhatsApp", type: "text", placeholder: "whatsapp:+39XXXXXXXXXX", hint: "Formato: whatsapp:+39... (con prefisso paese)" },
            ],
            usedBySteps: ["approved_template", "inbound_agent", "outbound_agent", "consultative_agent", "first_campaign"],
          },
        },
        {
          id: "approved_template",
          stepNumber: 2,
          priority: 2,
          title: "Template WhatsApp Approvato",
          description: "Crea e fatti approvare almeno un template da Twilio per inviare messaggi proattivi",
          icon: <MessageSquare className="h-4 w-4" />,
          status: status?.hasApprovedTemplate ? "verified" : (status?.hasCustomTemplate ? "configured" : "pending"),
          configLink: "/consultant/whatsapp-templates",
          count: status?.approvedTemplatesCount,
          countLabel: "approvati",
        },
        {
          id: "inbound_agent",
          stepNumber: 3,
          priority: 2,
          title: "Agente Inbound",
          description: "Crea un agente per gestire automaticamente le richieste in entrata dei clienti",
          icon: <ArrowDownToLine className="h-4 w-4" />,
          status: status?.hasInboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "public_agent_link",
          stepNumber: 4,
          priority: 4,
          title: "Link Pubblico Agente",
          description: "Genera un link pubblico per permettere ai clienti di contattare i tuoi agenti",
          icon: <LinkIcon className="h-4 w-4" />,
          status: status?.hasPublicAgentLink ? "verified" : "pending",
          configLink: "/consultant/whatsapp-agents-chat",
          count: status?.publicLinksCount,
          countLabel: "link",
        },
        {
          id: "instagram_dm",
          stepNumber: 5,
          priority: 4,
          title: "Instagram Direct Messaging",
          description: "Collega il tuo account Instagram Business per gestire i DM con AI",
          icon: <Instagram className="h-4 w-4" />,
          status: status?.hasInstagramConfigured ? "verified" : (status?.instagramStatus || "pending"),
          testedAt: status?.instagramTestedAt,
          errorMessage: status?.instagramErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=instagram",
          testEndpoint: "/api/consultant/onboarding/test/instagram",
          inlineConfig: {
            getEndpoint: "/api/consultant/instagram-status",
            saveEndpoint: "",
            fields: [],
            oauthStart: "/consultant/api-keys-unified?tab=instagram",
            oauthLabel: "Vai alla configurazione Instagram →",
            oauthStatusField: "configured",
          },
        },
        {
          id: "lead_import",
          stepNumber: 6,
          priority: 1,
          title: "Import Lead",
          description: "Configura API esterne per importare lead automaticamente nel sistema",
          icon: <UserPlus className="h-4 w-4" />,
          status: status?.leadImportStatus || "pending",
          testedAt: status?.leadImportTestedAt,
          errorMessage: status?.leadImportErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=lead-import",
          testEndpoint: "/api/consultant/onboarding/test/lead-import",
        },
        {
          id: "first_campaign",
          stepNumber: 7,
          priority: 2,
          title: "Prima Campagna Marketing",
          description: "Configura la tua prima campagna per contattare i lead automaticamente",
          icon: <Rocket className="h-4 w-4" />,
          status: status?.hasFirstCampaign ? "verified" : "pending",
          configLink: "/consultant/campaigns",
          count: status?.campaignsCount,
          countLabel: "campagne",
        },
      ],
    },
    {
      id: "sales",
      emoji: "💰",
      title: "Chiudi e Incassa",
      tagline: "Converti i lead in clienti paganti",
      color: "violet",
      gradient: "from-violet-500 to-purple-500",
      steps: [
        {
          id: "stripe_connect",
          stepNumber: 8,
          priority: 2,
          title: "Stripe — API Keys",
          description: "Collega il tuo account Stripe per gestire pagamenti e abbonamenti dei clienti",
          icon: <CreditCard className="h-4 w-4" />,
          status: getStripeStatus(status?.stripeAccountStatus, status?.hasStripeAccount),
          configLink: "/consultant/whatsapp?tab=licenses",
          inlineConfig: {
            getEndpoint: "/api/consultant/stripe-settings",
            saveEndpoint: "/api/consultant/stripe-settings",
            saveMethod: "POST",
            dataMapper: (d) => ({
              stripeSecretKey: d.settings?.hasSecretKey ? "••••" : "",
              stripeWebhookSecret: d.settings?.hasWebhookSecret ? "••••" : "",
            }),
            payloadMapper: (s) => ({ stripeSecretKey: s.stripeSecretKey, stripeWebhookSecret: s.stripeWebhookSecret }),
            fields: [
              { key: "stripeSecretKey", label: "Secret Key Stripe", type: "password", sensitive: true, placeholder: "sk_live_... o sk_test_...", hint: "Trovala su dashboard.stripe.com → Sviluppatori → Chiavi API" },
              { key: "stripeWebhookSecret", label: "Webhook Secret", type: "password", sensitive: true, placeholder: "whsec_...", hint: "Generalo su dashboard.stripe.com → Sviluppatori → Webhook → Aggiungi endpoint" },
            ],
            usedBySteps: ["first_campaign"],
          },
        },
        {
          id: "outbound_agent",
          stepNumber: 9,
          priority: 2,
          title: "Agente Outbound",
          description: "Crea un agente per le campagne di contatto proattivo verso i lead",
          icon: <ArrowUpFromLine className="h-4 w-4" />,
          status: status?.hasOutboundAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "consultative_agent",
          stepNumber: 10,
          priority: 3,
          title: "Agente Consulenziale",
          description: "Crea un agente specializzato per consulenze e supporto avanzato",
          icon: <Briefcase className="h-4 w-4" />,
          status: status?.hasConsultativeAgent ? "verified" : "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "first_summary_email",
          stepNumber: 11,
          priority: 4,
          title: "Prima Email Riassuntiva",
          description: "Invia la tua prima email riassuntiva dopo una consulenza",
          icon: <MailCheck className="h-4 w-4" />,
          status: status?.hasFirstSummaryEmail ? "verified" : "pending",
          configLink: "/consultant/appointments",
          count: status?.summaryEmailsCount,
          countLabel: "email",
        },
        {
          id: "video_meeting",
          stepNumber: 12,
          priority: 5,
          title: "Video Meeting (TURN)",
          description: "Configura Metered.ca per videochiamate WebRTC affidabili con i tuoi clienti",
          icon: <Video className="h-4 w-4" />,
          status: status?.videoMeetingStatus || "pending",
          testedAt: status?.videoMeetingTestedAt,
          errorMessage: status?.videoMeetingErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=video-meeting",
          testEndpoint: "/api/consultant/onboarding/test/video-meeting",
          inlineConfig: {
            getEndpoint: "/api/consultant/turn-config",
            saveEndpoint: "/api/consultant/turn-config",
            saveMethod: "POST",
            dataMapper: (d) => ({
              username: d.config?.username || d.username || "",
              password: "",
              enabled: d.config?.enabled ?? d.enabled ?? true,
            }),
            payloadMapper: (s) => ({ username: s.username, password: s.password, enabled: s.enabled }),
            fields: [
              { key: "username", label: "API Key Metered.ca", type: "text", placeholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx", hint: "Trovala su dashboard.metered.ca → API Keys" },
              { key: "password", label: "Secret Key", type: "password", sensitive: true },
              { key: "enabled", label: "Attiva TURN server", type: "toggle" },
            ],
          },
        },
      ],
    },
    {
      id: "ai_ops",
      emoji: "🤖",
      title: "AI Operativa",
      tagline: "La piattaforma lavora per te in autonomia 24/7",
      color: "indigo",
      gradient: "from-indigo-500 to-blue-600",
      steps: [
        {
          id: "ai_autonomo",
          stepNumber: 13,
          priority: 4,
          title: "AI Autonomo",
          description: "Attiva il sistema AI autonomo e completa almeno un task automatico generato dall'AI",
          icon: <Bot className="h-4 w-4" />,
          status: status?.hasCompletedAiTask ? "verified" : "pending",
          configLink: "/consultant/ai-autonomy",
          count: status?.completedAiTasksCount,
          countLabel: "task completati",
        },
        {
          id: "email_journey",
          stepNumber: 14,
          priority: 3,
          title: "Email Journey",
          description: "Configura l'automazione email: scegli tra bozze o invio automatico e personalizza i template con l'AI",
          icon: <MailPlus className="h-4 w-4" />,
          status: status?.hasEmailJourneyConfigured ? "verified" : "pending",
          configLink: "/consultant/ai-config?tab=ai-email",
        },
        {
          id: "nurturing_emails",
          stepNumber: 15,
          priority: 3,
          title: "Email Nurturing 365",
          description: "Genera 365 email automatiche per nutrire i tuoi lead nel tempo",
          icon: <MailPlus className="h-4 w-4" />,
          status: status?.hasNurturingEmails ? "verified" : "pending",
          configLink: "/consultant/ai-config?tab=lead-nurturing",
          count: status?.nurturingEmailsCount,
          countLabel: "email",
          inlineConfig: {
            getEndpoint: "/api/lead-nurturing/config",
            saveEndpoint: "/api/lead-nurturing/config",
            saveMethod: "PUT",
            dataMapper: (d) => ({
              isEnabled: d.config?.isEnabled ?? d.config?.isActive ?? false,
              sendHour: d.config?.sendHour ?? 9,
            }),
            payloadMapper: (s) => ({ isEnabled: s.isEnabled, sendHour: Number(s.sendHour) }),
            fields: [
              { key: "isEnabled", label: "Abilita invio automatico", type: "toggle" },
              { key: "sendHour", label: "Ora di invio (0-23)", type: "number", placeholder: "9", hint: "Ora del giorno in cui vengono inviate le email (fuso Europe/Rome)" },
            ],
            usedBySteps: ["smtp", "email_hub"],
          },
        },
        {
          id: "email_hub",
          stepNumber: 16,
          priority: 2,
          title: "Email Hub",
          description: "Collega il tuo account email per gestire inbox, invii automatici e risposte AI",
          icon: <Inbox className="h-4 w-4" />,
          status: status?.hasEmailHubAccount ? "verified" : "pending",
          configLink: "/consultant/email-hub",
          count: status?.emailHubAccountsCount,
          countLabel: "account",
          inlineConfig: {
            getEndpoint: "/api/email-hub/accounts",
            saveEndpoint: "/api/email-hub/accounts",
            saveMethod: "POST",
            dataMapper: (d) => {
              const acc = Array.isArray(d.data) ? d.data[0] : null;
              return {
                displayName: acc?.displayName || "",
                emailAddress: acc?.emailAddress || "",
                imapHost: acc?.imapHost || "imap.gmail.com",
                imapPort: acc?.imapPort || 993,
                imapUser: acc?.imapUser || "",
                imapPassword: "",
                smtpHost: acc?.smtpHost || "smtp.gmail.com",
                smtpPort: acc?.smtpPort || 587,
                smtpUser: acc?.smtpUser || "",
                smtpPassword: "",
              };
            },
            payloadMapper: (s) => ({
              displayName: s.displayName,
              emailAddress: s.emailAddress,
              imapHost: s.imapHost,
              imapPort: Number(s.imapPort),
              imapUser: s.imapUser,
              imapPassword: s.imapPassword,
              smtpHost: s.smtpHost,
              smtpPort: Number(s.smtpPort),
              smtpUser: s.smtpUser,
              smtpPassword: s.smtpPassword,
              accountType: "full",
            }),
            fields: [
              { key: "displayName", label: "Nome account", type: "text", placeholder: "Email principale" },
              { key: "emailAddress", label: "Indirizzo email", type: "text", placeholder: "tuo@gmail.com" },
              { key: "imapHost", label: "Server IMAP", type: "text", placeholder: "imap.gmail.com", hint: "Gmail: imap.gmail.com · Outlook: outlook.office365.com" },
              { key: "imapPort", label: "Porta IMAP", type: "number", placeholder: "993" },
              { key: "imapUser", label: "Utente IMAP", type: "text", placeholder: "tuo@gmail.com" },
              { key: "imapPassword", label: "Password IMAP", type: "password", sensitive: true, hint: "Gmail: usa App Password (account.google.com/apppasswords)" },
              { key: "smtpHost", label: "Server SMTP", type: "text", placeholder: "smtp.gmail.com" },
              { key: "smtpPort", label: "Porta SMTP", type: "number", placeholder: "587" },
              { key: "smtpUser", label: "Utente SMTP", type: "text", placeholder: "tuo@gmail.com" },
              { key: "smtpPassword", label: "Password SMTP", type: "password", sensitive: true },
            ],
            usedBySteps: ["email_journey", "nurturing_emails", "first_summary_email"],
          },
        },
        {
          id: "voice_calls",
          stepNumber: 17,
          priority: 2,
          title: "Chiamate Voice (Alessia AI)",
          description: "Completa almeno una chiamata vocale con esito positivo tramite il sistema Alessia AI Phone",
          icon: <Phone className="h-4 w-4" />,
          status: status?.hasCompletedVoiceCall ? "verified" : "pending",
          configLink: "/consultant/voice-calls",
          count: status?.completedVoiceCallsCount,
          countLabel: "chiamate completate",
        },
      ],
    },
    {
      id: "content",
      emoji: "📚",
      title: "Contenuti & Autorità",
      tagline: "Educa i clienti e posizionati come esperto",
      color: "amber",
      gradient: "from-amber-500 to-orange-500",
      steps: [
        {
          id: "first_course",
          stepNumber: 18,
          priority: 5,
          title: "Primo Corso",
          description: "Crea il tuo primo corso formativo per i clienti",
          icon: <BookOpen className="h-4 w-4" />,
          status: status?.hasCreatedCourse ? "verified" : "pending",
          configLink: "/consultant/university",
          count: status?.coursesCount,
          countLabel: "corsi",
        },
        {
          id: "first_exercise",
          stepNumber: 19,
          priority: 5,
          title: "Primo Esercizio",
          description: "Crea il tuo primo esercizio pratico per i clienti",
          icon: <ClipboardList className="h-4 w-4" />,
          status: status?.hasCreatedExercise ? "verified" : "pending",
          configLink: "/consultant/exercises",
          count: status?.exercisesCount,
          countLabel: "esercizi",
        },
        {
          id: "knowledge_base",
          stepNumber: 20,
          priority: 2,
          title: "Base di Conoscenza",
          description: "Carica documenti per permettere all'AI di rispondere con informazioni specifiche",
          icon: <FileText className="h-4 w-4" />,
          status: status?.knowledgeBaseStatus || "pending",
          configLink: "/consultant/knowledge-documents",
          testEndpoint: "/api/consultant/onboarding/test/knowledge-base",
          count: status?.knowledgeBaseDocumentsCount,
          countLabel: "documenti",
        },
        {
          id: "ai_ideas",
          stepNumber: 21,
          priority: 5,
          title: "Idee AI Generate",
          description: "Genera idee creative per gli agenti usando l'intelligenza artificiale",
          icon: <Lightbulb className="h-4 w-4" />,
          status: status?.hasGeneratedIdeas ? "verified" : "pending",
          configLink: "/consultant/whatsapp?tab=ideas",
          count: status?.generatedIdeasCount,
          countLabel: "idee",
        },
        {
          id: "whatsapp_template",
          stepNumber: 22,
          priority: 5,
          title: "Altri Template WhatsApp",
          description: "Crea altri template WhatsApp per diversi tipi di messaggi automatici",
          icon: <MessageSquare className="h-4 w-4" />,
          status: status?.hasCustomTemplate ? "verified" : "pending",
          configLink: "/consultant/whatsapp-templates",
          count: status?.customTemplatesCount,
          countLabel: "template",
        },
      ],
    },
    {
      id: "integrations",
      emoji: "⚙️",
      title: "Integrazioni & Sistema",
      tagline: "Collega gli strumenti di base della piattaforma",
      color: "slate",
      gradient: "from-slate-500 to-gray-600",
      steps: [
        {
          id: "smtp",
          stepNumber: 23,
          priority: 1,
          title: "Email SMTP",
          description: "Configura il server SMTP per inviare email automatiche ai tuoi clienti e lead",
          icon: <Mail className="h-4 w-4" />,
          status: status?.smtpStatus || "pending",
          testedAt: status?.smtpTestedAt,
          errorMessage: status?.smtpErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=email",
          testEndpoint: "/api/consultant/onboarding/test/smtp",
          inlineConfig: {
            getEndpoint: "/api/consultant/smtp-settings",
            saveEndpoint: "/api/consultant/smtp-settings",
            saveMethod: "POST",
            dataMapper: (d) => ({
              host: d.smtpHost || d.host || "",
              port: d.smtpPort || d.port || 587,
              secure: d.smtpSecure ?? d.secure ?? true,
              username: d.smtpUser || d.username || "",
              password: "",
              fromEmail: d.smtpFromEmail || d.fromEmail || "",
              fromName: d.smtpFromName || d.fromName || "",
            }),
            payloadMapper: (s) => ({ host: s.host, port: Number(s.port), secure: s.secure, username: s.username, password: s.password, fromEmail: s.fromEmail, fromName: s.fromName }),
            fields: [
              { key: "host", label: "Server SMTP", type: "text", placeholder: "smtp.gmail.com", hint: "Gmail: smtp.gmail.com · Outlook: smtp.office365.com" },
              { key: "port", label: "Porta", type: "number", placeholder: "587", hint: "587 per TLS · 465 per SSL" },
              { key: "secure", label: "Usa SSL/TLS", type: "toggle" },
              { key: "username", label: "Email / Username", type: "text", placeholder: "tuo@email.com" },
              { key: "password", label: "Password / App Password", type: "password", sensitive: true, hint: "Gmail: genera App Password su account.google.com/apppasswords" },
              { key: "fromEmail", label: "Email mittente", type: "text", placeholder: "noreply@tuodominio.com" },
              { key: "fromName", label: "Nome mittente", type: "text", placeholder: "Il tuo nome o azienda" },
            ],
            usedBySteps: ["email_journey", "nurturing_emails", "first_summary_email"],
          },
        },
        {
          id: "google_calendar_consultant",
          stepNumber: 24,
          priority: 2,
          title: "Google Calendar Consulente",
          description: "Collega il tuo Google Calendar personale per sincronizzare appuntamenti e prenotazioni con i clienti",
          icon: <Calendar className="h-4 w-4" />,
          status: status?.googleCalendarStatus || "pending",
          testedAt: status?.googleCalendarTestedAt,
          errorMessage: status?.googleCalendarErrorMessage,
          configLink: "/consultant/appointments",
          inlineConfig: {
            getEndpoint: "/api/consultant/calendar/status",
            saveEndpoint: "",
            fields: [],
            oauthStart: "/api/consultant/calendar/oauth/start",
            oauthLabel: "Connetti Google Calendar →",
            oauthStatusField: "connected",
            usedBySteps: ["first_summary_email"],
          },
        },
        {
          id: "google_calendar_agents",
          stepNumber: 25,
          priority: 2,
          title: "Google Calendar Agenti WhatsApp",
          description: "Collega Google Calendar a ciascun agente WhatsApp per la prenotazione automatica degli appuntamenti",
          icon: <Calendar className="h-4 w-4" />,
          status: "pending",
          configLink: "/consultant/whatsapp",
        },
        {
          id: "vertex_ai",
          stepNumber: 26,
          priority: 1,
          title: "AI Engine (Gemini)",
          description: "Pre-configurato dal sistema via Google AI Studio. Aggiungi una tua API Key Gemini personale per usare un account dedicato.",
          icon: <Sparkles className="h-4 w-4" />,
          optional: true,
          status: (status?.vertexAiStatus && status.vertexAiStatus !== "pending") ? status.vertexAiStatus : "verified",
          testedAt: status?.vertexAiTestedAt,
          errorMessage: status?.vertexAiErrorMessage,
          configLink: "/consultant/api-keys-unified?tab=ai",
          testEndpoint: "/api/consultant/onboarding/test/vertex-ai",
          inlineConfig: {
            getEndpoint: "/api/vertex-ai/settings",
            saveEndpoint: "/api/vertex-ai/settings",
            saveMethod: "POST",
            dataMapper: (d) => ({
              apiKey: d.settings?.[0]?.apiKey || "",
              projectId: d.settings?.[0]?.projectId || "",
            }),
            payloadMapper: (s) => ({ apiKey: s.apiKey, projectId: s.projectId }),
            fields: [
              { key: "apiKey", label: "API Key Google AI Studio", type: "password", sensitive: true, hint: "Generala su aistudio.google.com → API Keys. NON obbligatoria se usi il provider condiviso." },
              { key: "projectId", label: "Project ID (opzionale)", type: "text", placeholder: "my-gcp-project-id", hint: "Lascia vuoto se usi Google AI Studio (consigliato)" },
            ],
            usedBySteps: ["ai_autonomo", "email_journey", "nurturing_emails", "voice_calls"],
          },
        },
      ],
    },
  ];

  const allSteps = sections.flatMap(s => s.steps);
  const completedSteps = allSteps.filter(s => s.status === "verified").length;
  const totalSteps = allSteps.length;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  const activeStepData = allSteps.find(s => s.id === activeStep);

  useEffect(() => {
    if (completedSteps > previousCompletedRef.current && previousCompletedRef.current > 0) {
      triggerMiniConfetti();
    }
    if (completedSteps === totalSteps && previousCompletedRef.current < totalSteps) {
      setTimeout(() => triggerConfetti(), 300);
    }
    previousCompletedRef.current = completedSteps;
  }, [completedSteps, totalSteps]);

  const [sortByPriority, setSortByPriority] = useState(false);

  const stepNameMap: Record<string, string> = {
    vertex_ai: "AI Engine (Gemini)",
    smtp: "Email SMTP",
    google_calendar_consultant: "Google Calendar Consulente",
    google_calendar_agents: "Google Calendar Agenti",
    twilio_config: "Configurazione Twilio + WhatsApp",
    approved_template: "Template WhatsApp Approvato",
    first_campaign: "Prima Campagna",
    stripe_connect: "Stripe — API Keys",
    email_journey: "Email Journey",
    inbound_agent: "Agente Inbound",
    outbound_agent: "Agente Outbound",
    consultative_agent: "Agente Consulenziale",
    public_agent_link: "Link Pubblico Agente",
    ai_ideas: "Idee AI Generate",
    whatsapp_template: "Altri Template WhatsApp",
    first_course: "Primo Corso",
    first_exercise: "Primo Esercizio",
    knowledge_base: "Knowledge Base",
    first_summary_email: "Prima Email Riassuntiva",
    nurturing_emails: "Email Nurturing 365",
    email_hub: "Email Hub",
    video_meeting: "Video Meeting",
    lead_import: "Import Lead",
    voice_calls: "Chiamate Voice",
    ai_autonomo: "AI Autonomo",
    instagram_dm: "Instagram DM",
  };

  const PRIORITY_LABELS: Record<number, { label: string; sublabel: string; dot: string; leftBorder: string; progressColor: string }> = {
    1: { label: "Critica", sublabel: "Twilio · SMTP · AI Engine · Import Lead", dot: "bg-rose-500", leftBorder: "border-l-rose-500", progressColor: "bg-rose-500" },
    2: { label: "Alta", sublabel: "Agenti · Campagne · Voce · Calendario · Pagamenti · Conoscenza", dot: "bg-orange-400", leftBorder: "border-l-orange-400", progressColor: "bg-orange-400" },
    3: { label: "Media", sublabel: "Automazione email & agenti secondari", dot: "bg-amber-400", leftBorder: "border-l-amber-400", progressColor: "bg-amber-400" },
    4: { label: "Normale", sublabel: "Canali aggiuntivi & features avanzate", dot: "bg-emerald-500", leftBorder: "border-l-emerald-500", progressColor: "bg-emerald-500" },
    5: { label: "Opzionale", sublabel: "Contenuti, video meeting & ottimizzazione", dot: "bg-slate-400", leftBorder: "border-l-slate-400", progressColor: "bg-slate-400" },
  };

  const handleTest = async (stepId: string, endpoint?: string) => {
    if (!endpoint) return;
    setTestingStep(stepId);
    testMutation.mutate({ endpoint, stepName: stepNameMap[stepId] || stepId });
  };

  const autoSelectStep = (section: Section) => {
    const firstPending = section.steps.find(s => s.status !== "verified");
    setActiveStep(firstPending?.id ?? section.steps[0].id);
    setActiveSection(section.id);
  };

  const currentSection = activeSection ? sections.find(s => s.id === activeSection) ?? null : null;
  const currentSectionIndex = currentSection ? sections.findIndex(s => s.id === currentSection.id) : -1;
  const prevSection = currentSectionIndex > 0 ? sections[currentSectionIndex - 1] : null;
  const nextSection = currentSectionIndex >= 0 && currentSectionIndex < sections.length - 1 ? sections[currentSectionIndex + 1] : null;

  const urgentSectionId = sections
    .filter(s => {
      const pct = s.steps.length > 0
        ? Math.round((s.steps.filter(x => x.status === "verified").length / s.steps.length) * 100)
        : 100;
      return pct < 50;
    })
    .sort((a, b) => {
      const pa = a.steps.filter(x => x.status === "verified").length / a.steps.length;
      const pb = b.steps.filter(x => x.status === "verified").length / b.steps.length;
      return pa - pb;
    })[0]?.id ?? null;

  const subtitleText =
    completedSteps === 0 ? "Inizia dall'acquisizione lead — ci vogliono 10 minuti"
    : completedSteps < totalSteps * 0.3 ? "Stai costruendo la macchina — ottimo inizio!"
    : completedSteps < totalSteps * 0.7 ? "Sei a metà — la piattaforma sta prendendo forma"
    : completedSteps < totalSteps ? "Quasi pronto — ancora pochi step e sei al 100%"
    : "Sistema completamente attivato 🎉";

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className={cn("min-h-screen flex flex-col bg-background", !isMobile && "h-screen")}>
      {isMobile && (
        <Navbar onMenuClick={() => setSidebarOpen(true)} />
      )}
      <div className={cn("flex flex-1", isMobile ? "min-h-0" : "min-h-0 overflow-hidden")}>
      <Sidebar
        role="consultant"
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        showRoleSwitch={showRoleSwitch}
        currentRole={currentRole}
        onRoleSwitch={handleRoleSwitch}
      />
      
      <main
        className={cn("flex-1 min-h-0", isMobile ? "overflow-auto" : "overflow-hidden")}
        style={{
          paddingRight: !isMobile && isOnboardingMode ? "24rem" : "0",
          transition: "padding-right 0.3s ease",
        }}
      >
        <div className={cn("flex flex-col min-h-0", isMobile ? "" : "h-full")}>
          {/* ── HEADER ── */}
          <motion.header
            className="relative overflow-hidden border-b px-4 sm:px-6 py-3 sm:py-4 bg-background"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500/8 via-violet-500/4 to-transparent dark:from-indigo-500/15 dark:via-violet-500/8 dark:to-transparent pointer-events-none" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl shadow-md">
                  <Rocket className="h-5 w-5 text-white" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {currentSection && (
                      <button
                        onClick={() => setActiveSection(null)}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mr-1"
                      >
                        ← Panoramica
                      </button>
                    )}
                    <h1 className="text-xl font-bold bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
                      {currentSection ? (
                        <span className="flex items-center gap-1.5">
                          Centro di Attivazione
                          <span className="text-slate-400 font-normal">/</span>
                          <span>{currentSection.emoji} {currentSection.title}</span>
                        </span>
                      ) : "Centro di Attivazione"}
                    </h1>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">{subtitleText}</p>
                </div>
                <Button
                  size="sm"
                  variant={isOnboardingMode ? "default" : "outline"}
                  onClick={() => isOnboardingMode ? setIsOnboardingMode(false) : openOnboardingMode()}
                  className="ml-3 gap-2"
                >
                  <Bot className="h-4 w-4" />
                  {isOnboardingMode ? "Onboarding Attivo" : "Assistente AI"}
                </Button>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <motion.div
                    className="text-2xl font-bold bg-gradient-to-r from-indigo-500 to-violet-500 bg-clip-text text-transparent"
                    key={progressPercent}
                    initial={{ scale: 1.2 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                  >
                    {progressPercent}%
                  </motion.div>
                  <div className="text-xs text-muted-foreground">
                    <span className="text-indigo-600 dark:text-indigo-400 font-medium">{completedSteps}/{totalSteps}</span> step
                  </div>
                </div>
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90">
                    <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="3" fill="none" className="text-gray-200 dark:text-gray-700" />
                    <motion.circle
                      cx="24" cy="24" r="20"
                      stroke="url(#pg2)"
                      strokeWidth="3" fill="none" strokeLinecap="round"
                      initial={{ strokeDasharray: "0 125.6" }}
                      animate={{ strokeDasharray: `${(progressPercent / 100) * 125.6} 125.6` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                    />
                    <defs>
                      <linearGradient id="pg2" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="#6C5CE7" />
                        <stop offset="100%" stopColor="#A78BFA" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-semibold">{completedSteps}</span>
                  </div>
                </div>
              </div>
            </div>
          </motion.header>

          {/* ── VISTA GRIGLIA (panoramica sezioni) ── */}
          {!currentSection && (
            <div className="flex-1 flex overflow-hidden min-h-0">
            <div className="flex-1 overflow-auto p-6">
              <div className="flex items-center justify-between mb-4">
                <ContextualBanner
                  sections={sections}
                  completedSteps={completedSteps}
                  totalSteps={totalSteps}
                  onGoToSection={(id) => {
                    const s = sections.find(x => x.id === id);
                    if (s) autoSelectStep(s);
                  }}
                />
                <Button
                  variant={sortByPriority ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSortByPriority(!sortByPriority)}
                  className="ml-4 shrink-0 gap-2"
                >
                  <ArrowUpDown className="h-4 w-4" />
                  {sortByPriority ? "Sezioni" : "Per Priorità"}
                </Button>
              </div>

              {!sortByPriority ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
                  {sections.map((section, i) => (
                    <motion.div
                      key={section.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.07 }}
                    >
                      <SectionCard
                        section={section}
                        onClick={() => autoSelectStep(section)}
                        isUrgent={urgentSectionId === section.id}
                      />
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {[1, 2, 3, 4, 5].map(priority => {
                    const stepsInPriority = sections.flatMap(section =>
                      section.steps
                        .filter(step => step.priority === priority)
                        .map(step => ({ ...step, sectionId: section.id, sectionEmoji: section.emoji, sectionTitle: section.title }))
                    );
                    if (stepsInPriority.length === 0) return null;
                    const pl = PRIORITY_LABELS[priority];
                    const completedCount = stepsInPriority.filter(s => s.status === "verified").length;
                    const progressPct = stepsInPriority.length > 0 ? Math.round((completedCount / stepsInPriority.length) * 100) : 0;
                    return (
                      <div
                        key={priority}
                        className={`rounded-xl border border-slate-100 dark:border-slate-800 border-l-4 ${pl.leftBorder} bg-white dark:bg-slate-900 overflow-hidden`}
                      >
                        {/* Header gruppo */}
                        <div className="px-4 pt-3 pb-2">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full shrink-0 ${pl.dot}`} />
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{pl.label}</span>
                            <span className="text-xs text-muted-foreground truncate">{pl.sublabel}</span>
                            <div className="ml-auto flex items-center gap-2 shrink-0">
                              <span className="text-xs text-muted-foreground">{completedCount}/{stepsInPriority.length}</span>
                            </div>
                          </div>
                          {/* Barra progresso sottile */}
                          <div className="mt-2 h-0.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                            <motion.div
                              className={`h-full rounded-full ${pl.progressColor}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${progressPct}%` }}
                              transition={{ duration: 0.6, ease: "easeOut" }}
                            />
                          </div>
                        </div>

                        {/* Griglia step */}
                        <div className="px-3 pb-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
                          {stepsInPriority.map(step => {
                            const s = sections.find(sec => sec.id === (step as any).sectionId)!;
                            const isDone = step.status === "verified";
                            const isRequired = priority === 1 && !isDone;
                            return (
                              <motion.div
                                key={step.id}
                                whileHover={{ scale: isDone ? 1 : 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => { autoSelectStep(s); setActiveStep(step.id); }}
                                className={`cursor-pointer flex items-center gap-2.5 px-3 rounded-lg transition-all border ${
                                  isDone
                                    ? "py-1.5 border-transparent bg-slate-50 dark:bg-slate-800/40 opacity-60 hover:opacity-80"
                                    : "py-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-sm hover:border-slate-300"
                                }`}
                              >
                                {isDone ? (
                                  <div className="w-5 h-5 shrink-0 rounded-full border border-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                                    <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                                  </div>
                                ) : (
                                  <StepNumberBadge number={step.stepNumber} status={step.status} />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium truncate ${isDone ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-300"}`}>
                                    {step.title}
                                  </p>
                                  <p className="text-xs text-muted-foreground truncate">
                                    {(step as any).sectionEmoji} {(step as any).sectionTitle}
                                  </p>
                                </div>
                                {isRequired && (
                                  <span className="shrink-0 text-xs px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800 font-medium">
                                    ⚡
                                  </span>
                                )}
                              </motion.div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            </div>
          )}

          {/* ── VISTA DETTAGLIO SEZIONE ── */}
          {currentSection && (
          <div className="flex-1 grid grid-cols-12 gap-0 overflow-hidden min-h-0">
            {/* Sidebar sinistra sezione */}
            <aside
              className="col-span-4 border-r bg-white dark:bg-slate-900 overflow-hidden flex flex-col transition-all duration-300"
              style={{ borderTop: `3px solid` }}
            >
              {/* Header sezione */}
              <div className="p-4 border-b bg-white dark:bg-slate-900" style={{ borderTop: `3px solid transparent`, backgroundImage: `linear-gradient(white, white), linear-gradient(to right, var(--section-color-start, #6366f1), var(--section-color-end, #8b5cf6))`, backgroundOrigin: "border-box", backgroundClip: "padding-box, border-box" }}>
                <button
                  onClick={() => setActiveSection(null)}
                  className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3"
                >
                  ← Tutte le sezioni
                </button>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-2xl">{currentSection.emoji}</span>
                  <div>
                    <h2 className="font-bold text-sm text-slate-800 dark:text-slate-100">{currentSection.title}</h2>
                    <p className="text-xs text-muted-foreground">{currentSection.tagline}</p>
                  </div>
                </div>
                {(() => {
                  const sc = currentSection.steps.filter(s => s.status === "verified").length;
                  const st = currentSection.steps.length;
                  const sp = st > 0 ? Math.round((sc / st) * 100) : 0;
                  return (
                    <>
                      <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                        <motion.div className={`h-full rounded-full bg-gradient-to-r ${currentSection.gradient}`} initial={{ width: 0 }} animate={{ width: `${sp}%` }} transition={{ duration: 0.5 }} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">{sc}/{st} completati · {sp}%</p>
                    </>
                  );
                })()}
              </div>

              {/* Lista step */}
              <ScrollArea className="flex-1 p-3">
                {currentSection.steps.map((step, index) => (
                  <motion.div
                    key={step.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="mb-0.5"
                  >
                    <StepCard
                      step={step}
                      isActive={activeStep === step.id}
                      onClick={() => setActiveStep(step.id)}
                    />
                    {step.optional && (
                      <div className="ml-10 -mt-1 mb-1">
                        <Badge variant="outline" className="text-xs text-slate-400 border-slate-200 bg-slate-50 dark:bg-slate-800">Opzionale</Badge>
                      </div>
                    )}
                  </motion.div>
                ))}
              </ScrollArea>

              {/* Nav tra sezioni */}
              <div className="border-t p-3 flex items-center justify-between bg-white dark:bg-slate-900">
                {prevSection ? (
                  <button onClick={() => autoSelectStep(prevSection)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                    ‹ {prevSection.emoji} {prevSection.title}
                  </button>
                ) : <span />}
                {nextSection && (
                  <button onClick={() => autoSelectStep(nextSection)} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 ml-auto">
                    {nextSection.emoji} {nextSection.title} ›
                  </button>
                )}
              </div>
            </aside>

            <section className="col-span-8 overflow-auto bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-800/50 dark:via-slate-900 dark:to-slate-800/50 transition-all duration-300">
              <div className="p-8">
                <AnimatePresence mode="wait">
                  {activeStepData && (
                    <motion.div
                      key={activeStepData.id}
                      initial={{ opacity: 0, y: 20, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -20, scale: 0.98 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Card className="shadow-sm border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
                        <CardHeader className="pb-4 relative">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3">
                              <StepNumberBadge number={activeStepData.stepNumber} status={activeStepData.status} />
                              <div 
                                className={`p-3 rounded-xl ${statusConfig[activeStepData.status].bg} shadow-sm`}
                              >
                                <div className={statusConfig[activeStepData.status].color}>
                                  {activeStepData.icon}
                                </div>
                              </div>
                              <div>
                                <CardTitle className="text-xl">{activeStepData.title}</CardTitle>
                                <CardDescription>{activeStepData.description}</CardDescription>
                              </div>
                            </div>
                            <StatusBadge status={activeStepData.status} />
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <AnimatePresence>
                            {activeStepData.status === "error" && activeStepData.errorMessage && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                              >
                                <Alert variant="destructive">
                                  <AlertCircle className="h-4 w-4" />
                                  <AlertDescription>{activeStepData.errorMessage}</AlertDescription>
                                </Alert>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <AnimatePresence>
                            {activeStepData.status === "verified" && (
                              <motion.div
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.9 }}
                              >
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                                    <div>
                                      <p className="text-xs text-slate-500">Stato</p>
                                      <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Attivo</p>
                                    </div>
                                  </div>
                                  {activeStepData.testedAt && (
                                    <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                      <Clock className="h-4 w-4 text-slate-400" />
                                      <div>
                                        <p className="text-xs text-slate-500">Ultimo test</p>
                                        <p className="text-sm font-medium">{new Date(activeStepData.testedAt).toLocaleDateString('it-IT')}</p>
                                      </div>
                                    </div>
                                  )}
                                  <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                                    <Sparkles className="h-4 w-4 text-indigo-400" />
                                    <div>
                                      <p className="text-xs text-slate-500">Performance</p>
                                      <p className="text-sm font-medium">OK</p>
                                    </div>
                                  </div>
                                </div>
                                {activeStepData.count !== undefined && activeStepData.count > 0 && (
                                  <p className="text-xs text-slate-500 mt-2">
                                    Hai {activeStepData.count} {activeStepData.countLabel}
                                  </p>
                                )}
                              </motion.div>
                            )}
                          </AnimatePresence>

                      {/* ── CONFIGURAZIONE INLINE ── */}
                      {activeStepData.inlineConfig && (
                        <div className="space-y-2 mb-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Settings className="h-4 w-4 text-indigo-500" />
                            Configurazione Diretta
                            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                              🔗 Inline
                            </Badge>
                          </h4>
                          <InlineConfigPanel
                            config={activeStepData.inlineConfig}
                            stepId={activeStepData.id}
                            onSaveSuccess={() => refetch()}
                            testEndpoint={activeStepData.testEndpoint}
                            testingStep={testingStep}
                            onTest={handleTest}
                            nameMap={stepNameMap}
                          />
                        </div>
                      )}

                      {/* ── google_calendar_agents — pannello speciale senza form ── */}
                      {activeStepData.id === "google_calendar_agents" && (
                        <div className="space-y-2 mb-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-indigo-500" />
                            Stato Calendari per Agente
                          </h4>
                          <AgentCalendarStatusPanel />
                        </div>
                      )}

                      {/* ── nurturing_emails — bottone genera 365 email ── */}
                      {activeStepData.id === "nurturing_emails" && (
                        <NurturingGenerateButton />
                      )}

                      {/* ── public_agent_link — lista link copiabili ── */}
                      {activeStepData.id === "public_agent_link" && (
                        <div className="space-y-2 mb-2">
                          <h4 className="font-medium text-sm flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-indigo-500" />
                            Link Pubblici
                          </h4>
                          <PublicLinksPanel />
                        </div>
                      )}

                      {/* ── lead_import — webhook URL copiabile ── */}
                      {activeStepData.id === "lead_import" && (
                        <LeadImportWebhookPanel consultantId={status?.consultantId} />
                      )}

                      {/* ── vertex_ai — banner "già attivo" ── */}
                      {activeStepData.id === "vertex_ai" && (
                        <Alert className="bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200 dark:border-emerald-800 mb-2">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <AlertDescription className="text-emerald-700 dark:text-emerald-300 text-sm">
                            <strong>✅ AI già attiva</strong> sul tuo account tramite Google AI Studio pre-configurato dal sistema. Aggiungi una chiave personale solo se vuoi un account AI dedicato.
                          </AlertDescription>
                        </Alert>
                      )}

                      <div className="space-y-3">
                        <h4 className="font-medium text-sm">Azioni Disponibili</h4>
                        
                        <div className="flex flex-col gap-2">
                          <Link href={activeStepData.configLink}>
                            <Button className="w-full justify-between" variant="outline">
                              <span className="flex items-center gap-2">
                                <Key className="h-4 w-4" />
                                {activeStepData.inlineConfig
                                  ? "Apri impostazioni complete →"
                                  : activeStepData.status === "pending" ? "Configura" : "Modifica Configurazione"}
                              </span>
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </Link>

                          {activeStepData.testEndpoint && (
                            <Button
                              onClick={() => handleTest(activeStepData.id, activeStepData.testEndpoint)}
                              disabled={testingStep === activeStepData.id}
                              variant="outline"
                              className="w-full border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-800 dark:text-indigo-400 dark:hover:bg-indigo-900/20"
                            >
                              {testingStep === activeStepData.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Test in corso...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="h-4 w-4 mr-2" />
                                  {activeStepData.status === "pending" ? "Verifica Configurazione" : "Testa Connessione"}
                                </>
                              )}
                            </Button>
                          )}

                          <Button 
                            variant="ghost"
                            className="w-full border-slate-200 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const stepMessages: Record<string, string> = {
                                vertex_ai: "Aiutami a configurare Vertex AI per la mia piattaforma. Come ottengo le credenziali Google Cloud?",
                                smtp: "Come configuro il server SMTP per inviare email automatiche ai clienti?",
                                google_calendar_consultant: "Aiutami a collegare il mio Google Calendar personale per sincronizzare gli appuntamenti con i clienti.",
                                google_calendar_agents: "Come collego Google Calendar ai miei agenti WhatsApp per le prenotazioni automatiche?",
                                twilio_config: "Come configuro Twilio per WhatsApp Business?",
                                instagram_dm: "Come collego Instagram per ricevere e rispondere ai messaggi diretti con l'AI?",
                                whatsapp_template: "Come creo template WhatsApp personalizzati per i messaggi automatici?",
                                first_campaign: "Come creo la mia prima campagna marketing collegando fonti lead, template e agente AI?",
                                stripe_connect: "Come collego Stripe per ricevere pagamenti e gestire le licenze dei clienti?",
                                email_journey: "Come configuro l'automazione email journey per i miei clienti? Quali sono i template disponibili?",
                                nurturing_emails: "Come funziona Email Nurturing 365? Come genero le 365 email automatiche per nutrire i lead?",
                                email_hub: "Come configuro l'Email Hub per gestire inbox, invii automatici e risposte AI?",
                                voice_calls: "Come funzionano le chiamate vocali con Alessia AI Phone? Come faccio a completare la prima chiamata?",
                                ai_autonomo: "Come funziona il sistema AI Autonomo? Come attivo i dipendenti AI e completo il primo task automatico?",
                                whatsapp_ai: "Spiegami come configurare credenziali AI separate per gli agenti WhatsApp.",
                                inbound_agent: "Come creo un agente Inbound efficace per gestire le richieste dei clienti?",
                                outbound_agent: "Come configuro un agente Outbound per le campagne proattive?",
                                consultative_agent: "Come funziona l'agente Consulenziale e come posso configurarlo?",
                                public_agent_link: "Come genero e condivido un link pubblico per i miei agenti WhatsApp?",
                                ai_ideas: "Come posso usare l'AI per generare idee creative per i miei agenti?",
                                first_course: "Aiutami a creare il mio primo corso formativo per i clienti.",
                                first_exercise: "Come creo un esercizio pratico efficace per i miei clienti?",
                                knowledge_base: "Come carico documenti nella Knowledge Base per migliorare le risposte dell'AI?",
                                first_summary_email: "Come invio email riassuntive dopo le consulenze?",
                                video_meeting: "Come configuro le credenziali TURN di Metered.ca per le videochiamate?",
                                lead_import: "Come posso importare lead automaticamente da API esterne?",
                              };
                              const message = stepMessages[activeStep] || "Aiutami con la configurazione della piattaforma.";
                              window.dispatchEvent(new CustomEvent('ai:open-and-ask', { 
                                detail: { 
                                  document: { id: activeStep, title: activeStepData?.title || 'Setup Wizard' },
                                  autoMessage: message 
                                } 
                              }));
                            }}
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Chiedimi qualcosa
                          </Button>
                        </div>
                      </div>

                      {activeStep === "vertex_ai" && (
                        <>
                          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 space-y-3">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-indigo-500" />
                              Quando aggiungere una chiave personale?
                            </h4>
                            <ul className="text-sm text-muted-foreground space-y-1.5 list-disc list-inside">
                              <li>Vuoi un limite di utilizzo AI dedicato al tuo account</li>
                              <li>Vuoi usare un modello Gemini specifico non disponibile nel piano condiviso</li>
                              <li>Il SuperAdmin ti ha chiesto di configurare chiavi proprie</li>
                            </ul>
                            <p className="text-xs text-muted-foreground mt-2 italic">
                              Per ottenere una chiave API personale: vai su <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener" className="text-blue-600 underline">aistudio.google.com</a> → crea chiave API → incollala nel form sopra.
                            </p>
                          </div>
                          <CredentialNotesCard stepId="vertex_ai" />
                        </>
                      )}

                      {activeStep === "smtp" && (
                        <>
                          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Mail className="h-4 w-4 text-blue-600" />
                              Configurazione SMTP Comune
                            </h4>
                            <div className="text-sm text-muted-foreground space-y-2">
                              <p><strong>Gmail:</strong> smtp.gmail.com, porta 587, usa App Password</p>
                              <p><strong>Outlook:</strong> smtp.office365.com, porta 587</p>
                              <p><strong>Custom:</strong> Usa i dati del tuo provider email</p>
                            </div>
                          </div>
                          <CredentialNotesCard stepId="smtp" />
                        </>
                      )}

                      {activeStep === "google_calendar_consultant" && (
                        <>
                          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Calendar className="h-4 w-4 text-blue-600" />
                              Google Calendar Personale del Consulente
                            </h4>
                            <p className="text-sm text-muted-foreground mb-2">
                              Questo calendario viene usato per sincronizzare i tuoi appuntamenti personali con i clienti — prenotazioni, consulenze e follow-up.
                            </p>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                              <li>Clicca "Connetti Google Calendar" qui sopra</li>
                              <li>Accedi con il tuo account Google personale</li>
                              <li>Autorizza l'accesso al calendario</li>
                              <li>Il sistema sincronizzerà automaticamente gli appuntamenti</li>
                            </ol>
                          </div>
                          <CredentialNotesCard stepId="google_calendar_consultant" />
                        </>
                      )}

                      {activeStep === "google_calendar_agents" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-blue-600" />
                            Google Calendar degli Agenti WhatsApp
                          </h4>
                          <p className="text-sm text-muted-foreground mb-2">
                            Ogni agente WhatsApp può avere un proprio Google Calendar per gestire le prenotazioni automatiche degli appuntamenti. Questo è <strong>separato</strong> dal calendario del consulente.
                          </p>
                          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>Vai alla pagina <strong>Agenti WhatsApp</strong></li>
                            <li>Seleziona un agente dalla lista</li>
                            <li>Nel pannello laterale trova la sezione "Google Calendar"</li>
                            <li>Clicca "Collega Google Calendar" per quell'agente</li>
                            <li>Autorizza l'account Google che vuoi usare per le prenotazioni</li>
                          </ol>
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            Ogni agente può usare un account Google diverso per calendari separati.
                          </p>
                        </div>
                      )}

                      {activeStep === "twilio_config" && (
                        <>
                          <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                              <Phone className="h-4 w-4 text-blue-600" />
                              Configurazione Twilio + WhatsApp
                            </h4>
                            <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                              <li>Registrati su <a href="https://www.twilio.com/console" target="_blank" rel="noopener" className="text-blue-600 underline">Twilio Console</a></li>
                              <li>Acquista un numero italiano con capacità WhatsApp</li>
                              <li>Vai su Messaging → WhatsApp Senders e configura il numero</li>
                              <li>Copia Account SID e Auth Token dalla Dashboard</li>
                              <li>Incolla le credenziali nella configurazione</li>
                            </ol>
                            <p className="text-xs text-muted-foreground mt-3 italic">
                              Twilio permette di inviare e ricevere messaggi WhatsApp dal tuo numero italiano.
                            </p>
                          </div>
                          <CredentialNotesCard stepId="twilio_config" />
                        </>
                      )}

                      {activeStep === "instagram_dm" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Instagram className="h-4 w-4 text-pink-600" />
                            Come Collegare Instagram Business
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📱 Cosa ti serve prima di iniziare:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Un account Instagram <strong>Business</strong> (non personale)</li>
                              <li>Una Pagina Facebook collegata all'account Instagram</li>
                              <li>Essere amministratore della Pagina Facebook</li>
                            </ul>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Passaggi per configurare:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Impostazioni → API Esterne → Instagram</strong></li>
                              <li>Clicca su <strong>"Collega Instagram"</strong></li>
                              <li>Accedi con il tuo account Facebook</li>
                              <li>Seleziona la Pagina collegata a Instagram</li>
                              <li>Autorizza l'accesso ai messaggi</li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                              💡 <strong>Suggerimento:</strong> Se non vedi il tuo account Instagram, verifica che sia convertito in account Business e collegato alla Pagina Facebook.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "approved_template" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-green-600" />
                            Come Creare e Far Approvare un Template WhatsApp
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📋 Cos'è un Template WhatsApp?</p>
                            <p>I template sono messaggi pre-approvati da Meta/WhatsApp che puoi usare per contattare i clienti per primi. Senza template approvati, non puoi iniziare conversazioni!</p>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Come crearne uno:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Template WhatsApp</strong> nel menu</li>
                              <li>Clicca <strong>"Nuovo Template"</strong></li>
                              <li>Scegli un nome descrittivo (es: "benvenuto_lead")</li>
                              <li>Scrivi il messaggio - puoi usare variabili come {"{nome}"}</li>
                              <li>Clicca <strong>"Invia per Approvazione"</strong></li>
                              <li>Attendi 1-2 giorni lavorativi per l'approvazione</li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-green-50 dark:bg-green-900/20 p-2 rounded">
                              ✅ <strong>Consiglio:</strong> Crea template professionali, senza spam o contenuti promozionali aggressivi per aumentare le probabilità di approvazione.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_campaign" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Rocket className="h-4 w-4 text-purple-600" />
                            Come Creare la Tua Prima Campagna Marketing
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">🎯 Cos'è una Campagna Marketing?</p>
                            <p>Una campagna collega insieme: i tuoi lead, un template WhatsApp approvato, e un agente AI che gestisce le conversazioni automaticamente.</p>
                            
                            <p className="font-medium text-foreground mt-4">📋 Cosa ti serve prima:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Almeno un template WhatsApp approvato (Step 6)</li>
                              <li>Almeno un agente configurato</li>
                              <li>Una lista di lead (puoi importarla dopo)</li>
                            </ul>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Come creare la campagna:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Lead & Campagne → Campagne Marketing</strong></li>
                              <li>Clicca <strong>"Nuova Campagna"</strong></li>
                              <li>Dai un nome alla campagna (es: "Lead Gennaio 2026")</li>
                              <li>Scrivi un <strong>"Uncino"</strong> - la frase che cattura l'attenzione</li>
                              <li>Seleziona il template WhatsApp da usare</li>
                              <li>Seleziona l'agente AI che gestirà le risposte</li>
                              <li>Salva e attiva la campagna!</li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                              🚀 <strong>Pronto!</strong> Ora puoi importare lead nella campagna e l'agente AI li contatterà automaticamente.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "stripe_connect" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <CreditCard className="h-4 w-4 text-indigo-600" />
                            Due modi per configurare Stripe
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-medium text-foreground mb-1">🔑 Opzione 1 — API Keys (qui sopra)</p>
                              <p>Inserisci la Secret Key e il Webhook Secret per abilitare i pagamenti via API. È il metodo più rapido per iniziare.</p>
                            </div>
                            <div className="p-3 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                              <p className="font-medium text-foreground mb-1">🏦 Opzione 2 — Stripe Connect (pagina Licenze)</p>
                              <p>Per ricevere pagamenti direttamente sul tuo conto bancario dai clienti finali, usa "Apri impostazioni complete" → Collega Stripe.</p>
                            </div>
                            <p className="font-medium text-foreground mt-2">📊 Stati account Stripe Connect:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li><strong>Pending</strong>: In attesa di verifica</li>
                              <li><strong>Restricted</strong>: Servono altri documenti</li>
                              <li><strong>Active</strong>: Tutto ok, puoi ricevere pagamenti! ✅</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "email_journey" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MailPlus className="h-4 w-4 text-cyan-600" />
                            Come Configurare l'Email Journey per i Clienti
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📧 Cos'è l'Email Journey?</p>
                            <p>È un sistema che invia email automatiche ai tuoi clienti in momenti specifici del loro percorso (benvenuto, promemoria, follow-up, etc.).</p>
                            
                            <p className="font-medium text-foreground mt-4">📋 Cosa ti serve prima:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>SMTP configurato (Step 2)</li>
                            </ul>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Come configurarlo:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Configurazione AI → tab AI Email</strong></li>
                              <li>Attiva l'automazione email</li>
                              <li>Scegli la modalità: <strong>Bozze</strong> (le rivedi prima) o <strong>Automatico</strong> (invio diretto)</li>
                              <li>Personalizza i template per ogni giorno del journey</li>
                              <li>L'AI genererà il contenuto basandosi sul profilo del cliente</li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-cyan-50 dark:bg-cyan-900/20 p-2 rounded">
                              💡 <strong>Consiglio:</strong> Inizia con la modalità "Bozze" per controllare cosa viene inviato, poi passa ad "Automatico" quando ti fidi del sistema.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "nurturing_emails" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MailPlus className="h-4 w-4 text-orange-600" />
                            Email Nurturing 365: Un Anno di Email Automatiche
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📆 Cos'è l'Email Nurturing 365?</p>
                            <p>È un sistema che genera automaticamente 365 email - una per ogni giorno dell'anno - per "nutrire" i tuoi lead nel tempo e mantenerli interessati.</p>
                            
                            <p className="font-medium text-foreground mt-4">🎯 A chi serve?</p>
                            <p>Serve per i <strong>lead</strong> (potenziali clienti), non per i clienti già attivi. Mantiene vivo l'interesse mentre decidono se acquistare.</p>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Come attivarlo:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Configurazione AI → tab Lead Nurturing</strong></li>
                              <li>Clicca <strong>"Genera Email con AI"</strong></li>
                              <li>L'AI creerà 365 email personalizzate per il tuo business</li>
                              <li>Puoi rivedere e modificare ogni email</li>
                              <li>Attiva il sistema e le email partiranno automaticamente!</li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-orange-50 dark:bg-orange-900/20 p-2 rounded">
                              ⏰ <strong>Nota:</strong> Le email vengono inviate con fuso orario Europe/Rome e rispettano le normative GDPR (opt-out incluso).
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "email_hub" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Inbox className="h-4 w-4 text-teal-600" />
                            Email Hub: La Tua Casella Email Intelligente
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📬 Cos'è l'Email Hub?</p>
                            <p>È un sistema che collega la tua casella email (Gmail, Outlook, etc.) alla piattaforma. Puoi vedere, rispondere e far generare risposte dall'AI direttamente da qui.</p>
                            
                            <p className="font-medium text-foreground mt-4">✨ Cosa puoi fare:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Vedere tutte le email ricevute in un unico posto</li>
                              <li>Far generare risposte intelligenti dall'AI</li>
                              <li>Usare la Knowledge Base per risposte accurate</li>
                              <li>Gestire più account email contemporaneamente</li>
                            </ul>
                            
                            <p className="font-medium text-foreground mt-4">🔧 Come collegare un account:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Email Hub</strong> nel menu</li>
                              <li>Clicca <strong>"Aggiungi Account"</strong></li>
                              <li>Inserisci i dati del tuo server IMAP (vedi sotto)</li>
                              <li>Inserisci email e password (o App Password per Gmail)</li>
                              <li>Salva e l'account sarà collegato!</li>
                            </ol>
                            
                            <p className="font-medium text-foreground mt-4">📧 Dati IMAP comuni:</p>
                            <div className="bg-white dark:bg-slate-800 p-2 rounded text-xs">
                              <p><strong>Gmail:</strong> imap.gmail.com, porta 993</p>
                              <p><strong>Outlook:</strong> outlook.office365.com, porta 993</p>
                            </div>
                          </div>
                        </div>
                      )}

                      {activeStep === "voice_calls" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Phone className="h-4 w-4 text-emerald-600" />
                            Chiamate Voice con Alessia AI
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">📞 Cos'è Alessia AI Phone?</p>
                            <p>È il sistema di telefonia vocale AI che gestisce chiamate in entrata e in uscita con intelligenza artificiale in tempo reale.</p>
                            
                            <p className="font-medium text-foreground mt-4">✅ Come completare questo step:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>Chiamate Voice</strong> nel menu</li>
                              <li>Configura i template vocali per inbound/outbound</li>
                              <li>Ricevi o effettua almeno <strong>una chiamata</strong></li>
                              <li>La chiamata deve avere esito <strong>"completata"</strong></li>
                            </ol>
                            
                            <p className="text-xs mt-3 italic bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded">
                              💡 <strong>Nota:</strong> Alessia AI riconosce automaticamente i chiamanti, gestisce la conversazione e genera un transcript completo.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "ai_autonomo" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Bot className="h-4 w-4 text-purple-600" />
                            AI Autonomo: I Tuoi Dipendenti AI
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-3">
                            <p className="font-medium text-foreground">🤖 Cos'è l'AI Autonomo?</p>
                            <p>È un sistema con 8 dipendenti AI specializzati (Alessia, Millie, Echo, Nova, Stella, Iris, Marco, Personalizza) che analizzano i tuoi clienti e creano task automaticamente.</p>
                            
                            <p className="font-medium text-foreground mt-4">✅ Come completare questo step:</p>
                            <ol className="list-decimal list-inside ml-2 space-y-2">
                              <li>Vai su <strong>AI Autonomo</strong> nel menu</li>
                              <li>Attiva il sistema dalla <strong>tab Impostazioni</strong></li>
                              <li>Abilita almeno un dipendente AI</li>
                              <li>Attendi che venga generato e <strong>completato almeno un task</strong></li>
                            </ol>
                            
                            <p className="font-medium text-foreground mt-4">👥 I dipendenti AI:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li><strong>Alessia:</strong> Primo contatto e outreach</li>
                              <li><strong>Millie:</strong> Follow-up e relazioni</li>
                              <li><strong>Echo:</strong> Analisi dati e performance</li>
                              <li><strong>Nova:</strong> Report settimanali</li>
                              <li><strong>Stella:</strong> Check-in periodici</li>
                              <li><strong>Iris:</strong> Email intelligenti</li>
                              <li><strong>Marco:</strong> Coach strategico del consulente</li>
                            </ul>
                            
                            <p className="text-xs mt-3 italic bg-purple-50 dark:bg-purple-900/20 p-2 rounded">
                              🚀 <strong>Suggerimento:</strong> Inizia con il livello di autonomia 1 (supervisione totale) e aumenta gradualmente man mano che ti fidi del sistema.
                            </p>
                          </div>
                        </div>
                      )}

                      {activeStep === "whatsapp_ai" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Credenziali AI per WhatsApp
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Gli agenti WhatsApp possono usare credenziali AI separate per:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Non consumare il tuo budget AI principale</li>
                              <li>Avere limiti di utilizzo dedicati</li>
                              <li>Monitorare i costi separatamente</li>
                            </ul>
                            <p className="mt-2">Configura come per Vertex AI principale, ma con un progetto dedicato.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "inbound_agent" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ArrowDownToLine className="h-4 w-4 text-blue-600" />
                            Agente Inbound
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Inbound gestisce i messaggi in arrivo dai clienti:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Risponde automaticamente alle domande frequenti</li>
                              <li>Qualifica i lead in entrata</li>
                              <li>Prenota appuntamenti quando richiesto</li>
                              <li>Escalada al consulente per casi complessi</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "outbound_agent" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ArrowUpFromLine className="h-4 w-4 text-blue-600" />
                            Agente Outbound
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Outbound è ideale per campagne proattive:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Invia messaggi promozionali ai lead</li>
                              <li>Segue i clienti inattivi</li>
                              <li>Ricorda appuntamenti e scadenze</li>
                              <li>Propone offerte personalizzate</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "consultative_agent" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Briefcase className="h-4 w-4 text-blue-600" />
                            Agente Consulenziale
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'agente Consulenziale offre supporto avanzato:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Fornisce consulenze preliminari automatiche</li>
                              <li>Analizza le esigenze del cliente</li>
                              <li>Propone soluzioni basate sul knowledge base</li>
                              <li>Prepara il terreno per la consulenza umana</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "public_agent_link" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <LinkIcon className="h-4 w-4 text-blue-600" />
                            Link Pubblico Agente
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I link pubblici permettono ai clienti di contattarti facilmente:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Condividi il link sul tuo sito web</li>
                              <li>Usalo nei social media e nelle email</li>
                              <li>I clienti possono chattare senza login</li>
                              <li>Traccia le conversioni da ogni link</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "ai_ideas" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-blue-600" />
                            Idee AI Generate
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>L'AI può generare idee creative per i tuoi agenti:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Script di conversazione ottimizzati</li>
                              <li>Risposte a obiezioni comuni</li>
                              <li>Messaggi di follow-up efficaci</li>
                              <li>Template per campagne stagionali</li>
                            </ul>
                            <p className="mt-2">Vai alla sezione Idee per generare contenuti personalizzati.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "whatsapp_template" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MessageSquare className="h-4 w-4 text-blue-600" />
                            Template WhatsApp
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I template WhatsApp personalizzano i tuoi messaggi automatici:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>I template personalizzano i messaggi automatici</li>
                              <li>Puoi creare template per diversi scenari (apertura, follow-up, etc.)</li>
                              <li>I template supportano variabili dinamiche come {"{nome_lead}"}</li>
                            </ul>
                            <p className="mt-2">Vai alla sezione Template per creare i tuoi messaggi personalizzati.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_course" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <BookOpen className="h-4 w-4 text-blue-600" />
                            Crea il Tuo Primo Corso
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>I corsi formativi aiutano i tuoi clienti a crescere:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Organizza contenuti in moduli e lezioni</li>
                              <li>Carica video, PDF e materiali didattici</li>
                              <li>Monitora i progressi dei clienti</li>
                              <li>Assegna certificati al completamento</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_exercise" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <ClipboardList className="h-4 w-4 text-blue-600" />
                            Crea il Tuo Primo Esercizio
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Gli esercizi pratici consolidano l'apprendimento:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Crea quiz e test di verifica</li>
                              <li>Assegna compiti pratici</li>
                              <li>Valuta le risposte con l'AI</li>
                              <li>Fornisci feedback personalizzato</li>
                            </ul>
                          </div>
                        </div>
                      )}

                      {activeStep === "knowledge_base" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-blue-600" />
                            Base di Conoscenza AI
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Carica documenti per permettere all'AI di rispondere con informazioni specifiche:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>PDF, Word, Excel e file di testo</li>
                              <li>Manuali e guide dei tuoi prodotti</li>
                              <li>FAQ e risposte standard</li>
                              <li>Politiche aziendali e procedure</li>
                            </ul>
                            <p className="text-xs mt-2 italic">L'AI userà questi documenti per dare risposte più accurate e personalizzate.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "first_summary_email" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <MailCheck className="h-4 w-4 text-blue-600" />
                            Email Riassuntiva Post-Consulenza
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Le email riassuntive migliorano la retention:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li>Riepiloga i punti discussi nella consulenza</li>
                              <li>Elenca le azioni da intraprendere</li>
                              <li>Include link a risorse utili</li>
                              <li>Pianifica i prossimi passi</li>
                            </ul>
                            <p className="mt-2">Vai agli appuntamenti completati per inviare la prima email riassuntiva.</p>
                          </div>
                        </div>
                      )}

                      {activeStep === "video_meeting" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <Video className="h-4 w-4 text-blue-600" />
                            Server TURN con Metered.ca
                          </h4>
                          <ol className="text-sm text-muted-foreground space-y-2 list-decimal list-inside">
                            <li>Registrati su <a href="https://www.metered.ca" target="_blank" rel="noopener" className="text-blue-600 underline">Metered.ca</a></li>
                            <li>Crea una nuova applicazione TURN</li>
                            <li>Copia Username e Password</li>
                            <li>Incollali nella configurazione</li>
                          </ol>
                          <p className="text-xs text-muted-foreground mt-3 italic">
                            I server TURN permettono videochiamate stabili anche quando i partecipanti sono dietro firewall restrittivi.
                          </p>
                        </div>
                      )}

                      {activeStep === "lead_import" && (
                        <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                          <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                            <UserPlus className="h-4 w-4 text-blue-600" />
                            Import Lead Automatico
                          </h4>
                          <div className="text-sm text-muted-foreground space-y-2">
                            <p>Usa il tuo Webhook URL (mostrato sopra) per inviare lead automaticamente da:</p>
                            <ul className="list-disc list-inside ml-2 space-y-1">
                              <li><strong>Zapier</strong> — collega migliaia di app</li>
                              <li><strong>Make.com</strong> — automazioni avanzate</li>
                              <li><strong>n8n</strong> — automazioni self-hosted</li>
                              <li><strong>CRM esterni</strong> — HubSpot, Salesforce, ecc.</li>
                              <li><strong>Landing page e form</strong> — Typeform, HubSpot Form, ecc.</li>
                            </ul>
                            <p className="text-xs italic mt-2">Il webhook accetta POST con campi: name, phone, email, source (opzionali).</p>
                          </div>
                        </div>
                      )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </section>

          </div>
          )} {/* fine currentSection && */}
        </div>
      </main>
      {!isOnboardingMode && <ConsultantAIAssistant isOnboardingMode={false} />}

      {/* ── PANNELLO AI ONBOARDING — always mounted, slide in/out via CSS ── */}
      <motion.aside
        animate={{ x: isOnboardingMode ? 0 : "100%" }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
        style={{
          position: "fixed",
          right: 0,
          top: 0,
          bottom: 0,
          width: "24rem",
          zIndex: 40,
          display: "flex",
          flexDirection: "column",
          pointerEvents: isOnboardingMode ? "auto" : "none",
        }}
        className="border-l bg-white dark:bg-slate-900 shadow-2xl"
      >
        {/* Header */}
        <div
          className="shrink-0 px-4 py-3 flex items-center justify-between"
          style={{
            background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          }}
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/20 flex items-center justify-center shadow-inner">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <div>
              <p className="text-white font-semibold text-sm leading-tight">Assistente Onboarding</p>
              <p className="text-indigo-200 text-xs leading-tight">Sono qui per guidarti</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white/80 hover:text-white hover:bg-white/10"
            onClick={() => setIsOnboardingMode(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Suggestions */}
        {!chatStarted && (
          <div className="shrink-0 border-b border-indigo-100 dark:border-indigo-900/40 bg-gradient-to-b from-indigo-50/80 to-white dark:from-indigo-950/30 dark:to-slate-900 overflow-y-auto" style={{ maxHeight: "18rem" }}>
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
              <p className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wide">Inizia da qui</p>
              <button
                onClick={() => setChatStarted(true)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                Nascondi
              </button>
            </div>
            <div className="px-3 pb-3 space-y-1.5">
              {ONBOARDING_SUGGESTIONS.map((q, i) => (
                <button
                  key={i}
                  onClick={() => { setPendingAutoMessage(q); setChatStarted(true); setChatKey(k => k + 1); }}
                  className="w-full text-left text-xs p-2.5 rounded-xl bg-white dark:bg-slate-800/80 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all duration-150 leading-relaxed flex items-start gap-2.5 group shadow-sm"
                >
                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-[10px] font-bold flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-800 transition-colors">
                    {i + 1}
                  </span>
                  <span>{q}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ChatPanel */}
        <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          <ChatPanel
            key={chatKey}
            isOpen={true}
            onClose={() => setIsOnboardingMode(false)}
            mode="assistenza"
            setMode={() => {}}
            consultantType="finanziario"
            setConsultantType={() => {}}
            isConsultantMode={true}
            isOnboardingMode={true}
            embedded={true}
            onboardingStatuses={onboardingStatusesForAI?.data}
            autoMessage={pendingAutoMessage}
            onAutoMessageSent={() => setPendingAutoMessage(null)}
          />
        </div>
      </motion.aside>
      </div>
    </div>
  );
}
