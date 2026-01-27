import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Rocket,
  Calendar,
  CalendarDays,
  Clock,
  CheckCircle,
  Settings,
  Instagram,
  Twitter,
  Linkedin,
  Loader2,
  AlertCircle,
  CalendarOff,
  Zap,
  Sparkles,
  BookOpen,
  Megaphone,
  Camera,
  Users,
  Play,
  Eye,
  FileText,
  Video,
  Image,
  Layers,
  XCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";

const ITALIAN_HOLIDAYS = [
  "2024-01-01", "2024-01-06", "2024-03-31", "2024-04-01", "2024-04-25", "2024-05-01", "2024-06-02", "2024-08-15", "2024-11-01", "2024-12-08", "2024-12-25", "2024-12-26",
  "2025-01-01", "2025-01-06", "2025-04-20", "2025-04-21", "2025-04-25", "2025-05-01", "2025-06-02", "2025-08-15", "2025-11-01", "2025-12-08", "2025-12-25", "2025-12-26",
  "2026-01-01", "2026-01-06", "2026-04-05", "2026-04-06", "2026-04-25", "2026-05-01", "2026-06-02", "2026-08-15", "2026-11-01", "2026-12-08", "2026-12-25", "2026-12-26",
];

const OPTIMAL_TIMES = {
  instagram: ["11:00", "14:00", "19:00"],
  x: ["09:00", "12:00", "17:00"],
  linkedin: ["08:00", "12:00", "17:30"],
};

const CONTENT_TYPES = [
  { id: "educativo", label: "Educativo", icon: BookOpen, description: "Contenuti formativi e informativi" },
  { id: "promozionale", label: "Promozionale", icon: Megaphone, description: "Offerte e promozioni" },
  { id: "storytelling", label: "Storytelling", icon: Camera, description: "Storie e narrazioni" },
  { id: "behind-the-scenes", label: "Behind the Scenes", icon: Users, description: "Dietro le quinte" },
];

const PLATFORM_CONFIG = {
  instagram: { label: "Instagram", icon: Instagram, color: "text-pink-500", bgColor: "bg-pink-500/10" },
  x: { label: "X (Twitter)", icon: Twitter, color: "text-sky-500", bgColor: "bg-sky-500/10" },
  linkedin: { label: "LinkedIn", icon: Linkedin, color: "text-blue-600", bgColor: "bg-blue-600/10" },
};

const WRITING_STYLES = [
  { value: "default", label: "Predefinito", description: "Professionale e bilanciato", icon: "📝" },
  { value: "conversational", label: "Conversazionale", description: "Frasi brevi, storytelling", icon: "💬" },
  { value: "direct", label: "Diretto", description: "Conciso, va dritto al punto", icon: "🎯" },
  { value: "persuasive", label: "Copy Persuasivo", description: "Trigger emotivi, urgenza", icon: "🔥" },
  { value: "custom", label: "Personalizzato", description: "Definisci le tue istruzioni", icon: "✏️" },
];

const MEDIA_TYPES = [
  { value: "image", label: "Immagine", icon: "🖼️" },
  { value: "video", label: "Video", icon: "🎬" },
  { value: "carousel", label: "Carosello", icon: "📚" },
  { value: "text", label: "Solo Testo", icon: "📝" },
];

const COPY_TYPES = [
  { value: "short", label: "Short Copy", description: "Breve e d'impatto" },
  { value: "long", label: "Long Copy", description: "Dettagliato e approfondito" },
];

const POST_CATEGORIES = [
  { value: "ads", label: "Ads/Promozionale", icon: "📢" },
  { value: "valore", label: "Valore/Educativo", icon: "📚" },
  { value: "altri", label: "Altri", icon: "✨" },
];

const POST_SCHEMAS: Record<string, Record<string, Array<{ value: string; label: string; structure: string; description: string }>>> = {
  instagram: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico a 6 sezioni" },
      { value: "hook_problema_nuovo", label: "Hook → Problema → Nuovo modo → Prova → CTA", structure: "Hook|Problema|Nuovo modo|Prova sociale|Offerta|CTA", description: "Per Reels/Stories" },
      { value: "before_after_bridge", label: "Before → After → Bridge → CTA", structure: "Prima|Dopo|Ponte (processo)|CTA", description: "Ottimo per creativi visual" },
      { value: "pain_benefit_offer", label: "3 Pain → 3 Benefit → Offer → Urgenza → CTA", structure: "Pain 1|Pain 2|Pain 3|Benefit 1|Benefit 2|Benefit 3|Offerta|Urgenza|CTA", description: "Perfetto per performance" },
      { value: "obiezione_confutazione", label: "Obiezione → Confutazione → Demo → CTA", structure: "Obiezione forte|Confutazione|Mini-dimostrazione|CTA", description: "Per mercato scettico" },
      { value: "ugc_founder", label: "UGC/Founder Script (15-30s)", structure: "Chi sono|Cosa odiavo|Cosa ho cambiato|Risultato|Come farlo|CTA", description: "Nativo, credibile" },
    ],
    valore: [
      { value: "carousel_errore", label: "Carousel Errore → Perché → Cosa fare → Esempio", structure: "Errore #1|Perché succede|Cosa fare|Esempio|Checklist|CTA soft", description: "Altissima retention" },
      { value: "framework_5step", label: "Framework in 5 Step", structure: "Hook|Contesto|Step 1|Step 2|Step 3|Step 4|Step 5|Caso reale|CTA", description: "Trasferisce metodo" },
      { value: "teardown_analisi", label: "Teardown / Analisi", structure: "Hook|Cosa analizziamo|3 cose fatte bene|3 da migliorare|Template|CTA", description: "Autorità immediata" },
      { value: "myth_busting", label: "Myth Busting", structure: "Mito|Perché è falso|La regola vera|Come applicarla|CTA", description: "Ottimo per differenziarti" },
      { value: "case_study", label: "Case Study", structure: "Risultato|Punto di partenza|Azioni|Ostacolo|Soluzione|Lezione|CTA", description: "Prova sociale" },
    ],
    altri: [
      { value: "pov_domanda", label: "POV + Domanda", structure: "Opinione forte|Motivo 1|Motivo 2|Domanda", description: "Genera discussione" },
      { value: "behind_scenes", label: "Behind the Scenes", structure: "Cosa stai facendo|Perché|Cosa hai imparato|CTA", description: "Umano, fidelizza" },
      { value: "story_fallimento", label: "Story: Fallimento → Lezione → Regola", structure: "Errore|Costo|Cosa hai cambiato|Regola", description: "Connessione + autorevolezza" },
    ],
  },
  x: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico" },
      { value: "oneliner_proof", label: "One-liner Value → Proof → CTA", structure: "Promessa (1 riga)|Prova (numero/risultato)|CTA", description: "Chiarezza + credibilità" },
      { value: "pas_ultracompatto", label: "PAS Ultracompatto", structure: "Problema|Agitazione (1 riga)|Soluzione|CTA", description: "Per awareness" },
      { value: "contrarian_payoff", label: "Contrarian + Payoff", structure: "Hot take|Perché|Cosa fare invece|CTA", description: "Alta attenzione" },
      { value: "offer_first", label: "Offer-first", structure: "Offerta|Chi è per|Cosa ottieni|Vincolo/urgenza|CTA", description: "Conversioni dirette" },
    ],
    valore: [
      { value: "thread_manuale", label: "Thread Manuale Operativo", structure: "Hook tweet|Step 1|Step 2|Step 3|Step 4|Step 5|Esempio|Recap|CTA", description: "Thread salva follower" },
      { value: "checklist", label: "Checklist", structure: "Titolo|Punto 1|Punto 2|Punto 3|Punto 4|Punto 5|Punto 6|Punto 7|CTA", description: "Facile da consumare" },
      { value: "principio_caso_regola", label: "Principio → Caso → Regola", structure: "Principio|Mini-storia|Regola applicabile", description: "Authority senza lunghezza" },
      { value: "mini_playbook", label: "Mini-playbook", structure: "Obiettivo|Leva 1|Leva 2|Leva 3|Errore 1|Errore 2|Errore 3|Template", description: "Altissimo valore" },
      { value: "swipe_template", label: "Swipe/Template Tweet", structure: "Copia-incolla:|Template|Quando usarlo", description: "Condivisioni elevate" },
    ],
    altri: [
      { value: "build_public", label: "Build in Public", structure: "Cosa hai fatto oggi|Cosa hai imparato|Prossima mossa", description: "Community e consistenza" },
      { value: "qa_prompt", label: "Q&A Prompt", structure: "Rispondo a domande su X...", description: "Genera conversazioni" },
    ],
  },
  linkedin: {
    ads: [
      { value: "originale", label: "Originale (Universale)", structure: "Hook|Chi-Cosa-Come|Errore|Soluzione|Riprova Sociale|CTA", description: "Schema classico" },
      { value: "problema_ruolo", label: "Problema di Ruolo → Costo → Soluzione → Prova → CTA", structure: "Se sei [ruolo]...|Problema|Costo|Soluzione|Proof|CTA", description: "Targeting per job" },
      { value: "case_study_ad", label: "Case Study Ad", structure: "Risultato|In quanto tempo|Cosa abbiamo cambiato|1 grafico/numero|CTA", description: "Best performer B2B" },
      { value: "lead_magnet_ad", label: "Lead Magnet Ad", structure: "Titolo asset|Bullet 1|Bullet 2|Bullet 3|Per chi|CTA", description: "Ottimo CPL" },
      { value: "obiezione_demo", label: "Obiezione → Risposta → Demo-invito", structure: "Non funziona se...|Condizione vera|Come lo rendiamo vero|CTA demo", description: "Riduce attrito" },
    ],
    valore: [
      { value: "story_professionale", label: "Story Professionale", structure: "Situazione|Tensione|Decisione|Risultato|Lezione|CTA", description: "Narrazione + insight" },
      { value: "carosello_pdf", label: "Carosello Documento (PDF)", structure: "Titolo|Problema|Framework|Esempi|Checklist|CTA", description: "Altissima permanenza" },
      { value: "post_insegnamento", label: "Post Insegnamento", structure: "Claim|Perché|Esempio 1|Esempio 2|Esempio 3|Azione 1|Azione 2|Azione 3|CTA", description: "Autorità + praticità" },
      { value: "teardown_b2b", label: "Teardown B2B", structure: "Cosa analizziamo|3 punti forti|3 errori|Come rifarlo|CTA", description: "Posizionamento" },
      { value: "opinion_dati", label: "Opinion + Dati", structure: "Tesi|Dato/prova|Implicazione|Cosa fare|CTA", description: "Per consulenza" },
    ],
    altri: [],
  },
};

interface AutopilotPanelProps {
  targetPlatform?: "instagram" | "x" | "linkedin";
  postCategory?: "ads" | "valore" | "altri";
  postSchema?: string;
  writingStyle?: string;
  customInstructions?: string;
  mediaType?: string;
  copyType?: string;
}

interface Template {
  id: string;
  name: string;
  description: string;
}

interface BrandAssets {
  id: string;
  postingSchedule?: {
    instagram?: { postsPerDay: number; times: string[]; writingStyle: string };
    x?: { postsPerDay: number; times: string[]; writingStyle: string };
    linkedin?: { postsPerDay: number; times: string[]; writingStyle: string };
  };
}

interface GenerationProgress {
  total: number;
  completed: number;
  currentDate: string;
  currentPlatform: string;
  status: string;
}

interface GenerationResult {
  success: boolean;
  generated: number;
  errors: string[];
}

interface DayConfig {
  date: string;
  platform: "instagram" | "x" | "linkedin";
  category: "ads" | "valore" | "altri";
  schema: string;
  writingStyle: string;
  mediaType: string;
  copyType: string;
  contentTheme: string;
  status: "pending" | "generating" | "generated" | "error";
}

function AutopilotPanel({
  targetPlatform,
  postCategory,
  postSchema,
  writingStyle,
  customInstructions,
  mediaType,
  copyType,
}: AutopilotPanelProps) {
  const { toast } = useToast();
  const today = new Date().toISOString().split("T")[0];

  const [localPlatforms, setLocalPlatforms] = useState<("instagram" | "x" | "linkedin")[]>([targetPlatform || "instagram"]);
  const [localCategory, setLocalCategory] = useState<"ads" | "valore" | "altri">(postCategory || "valore");
  const [localSchema, setLocalSchema] = useState(postSchema || "originale");
  const [localWritingStyle, setLocalWritingStyle] = useState(writingStyle || "default");
  const [localCustomInstructions, setLocalCustomInstructions] = useState(customInstructions || "");
  const [localMediaType, setLocalMediaType] = useState(mediaType || "image");
  const [localCopyType, setLocalCopyType] = useState(copyType || "long");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("none");
  const [excludeWeekends, setExcludeWeekends] = useState(false);
  const [excludeHolidays, setExcludeHolidays] = useState(false);
  const [postsPerDay, setPostsPerDay] = useState(1);
  const [mode, setMode] = useState<"automatica" | "controllata">("automatica");
  const [selectedContentTypes, setSelectedContentTypes] = useState<string[]>(["educativo"]);

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgress | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(null);
  const [dayConfigs, setDayConfigs] = useState<DayConfig[]>([]);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [filterPlatform, setFilterPlatform] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string | null>(null);

  const { data: templates, isLoading: templatesLoading } = useQuery<Template[]>({
    queryKey: ["autopilot-templates"],
    queryFn: async () => {
      const response = await fetch("/api/content/autopilot/templates", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return [];
      }
      const json = await response.json();
      return json.data || [];
    },
  });

  const { data: brandAssets } = useQuery<BrandAssets | null>({
    queryKey: ["brand-assets-autopilot"],
    queryFn: async () => {
      const response = await fetch("/api/content/brand-assets", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        return null;
      }
      const json = await response.json();
      return json.data || null;
    },
  });

  const primaryPlatform = localPlatforms[0] || "instagram";
  const platformSchedule = brandAssets?.postingSchedule?.[primaryPlatform];
  const configuredTimes = platformSchedule?.times || OPTIMAL_TIMES[primaryPlatform];
  const configuredPostsPerDay = platformSchedule?.postsPerDay || 1;
  const brandWritingStyle = platformSchedule?.writingStyle;

  const togglePlatform = (platform: "instagram" | "x" | "linkedin") => {
    setLocalPlatforms(prev => {
      if (prev.includes(platform)) {
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== platform);
      }
      return [...prev, platform];
    });
  };

  const availableSchemas = useMemo(() => {
    return POST_SCHEMAS[primaryPlatform]?.[localCategory] || [];
  }, [primaryPlatform, localCategory]);

  useEffect(() => {
    const schemas = POST_SCHEMAS[primaryPlatform]?.[localCategory] || [];
    if (schemas.length > 0 && !schemas.find(s => s.value === localSchema)) {
      setLocalSchema(schemas[0].value);
    }
  }, [primaryPlatform, localCategory, localSchema]);

  useEffect(() => {
    if (mode === "automatica") {
      setDayConfigs([]);
    }
  }, [mode]);

  const updateDayConfig = (index: number, updates: Partial<DayConfig>) => {
    setDayConfigs(prev => {
      const newConfigs = [...prev];
      newConfigs[index] = { ...newConfigs[index], ...updates };
      if (updates.platform || updates.category) {
        const platform = updates.platform || newConfigs[index].platform;
        const category = updates.category || newConfigs[index].category;
        const schemas = POST_SCHEMAS[platform]?.[category] || [];
        if (schemas.length > 0 && !schemas.find(s => s.value === newConfigs[index].schema)) {
          newConfigs[index].schema = schemas[0].value;
        }
      }
      return newConfigs;
    });
  };

  const getAvailableSchemasForDay = (platform: string, category: string) => {
    return POST_SCHEMAS[platform]?.[category] || [];
  };

  const formatDayLabel = (dateStr: string) => {
    const date = new Date(dateStr);
    const days = ["Dom", "Lun", "Mar", "Mer", "Gio", "Ven", "Sab"];
    const months = ["Gen", "Feb", "Mar", "Apr", "Mag", "Giu", "Lug", "Ago", "Set", "Ott", "Nov", "Dic"];
    return `${days[date.getDay()]} ${date.getDate()} ${months[date.getMonth()]}`;
  };

  const toggleContentType = (typeId: string) => {
    setSelectedContentTypes((prev) =>
      prev.includes(typeId)
        ? prev.filter((id) => id !== typeId)
        : [...prev, typeId]
    );
  };

  const getDayKey = (config: DayConfig) => `${config.date}-${config.platform}`;

  const toggleSelectDay = (key: string) => {
    setSelectedDays(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const filteredDayConfigs = useMemo(() => {
    return dayConfigs.filter(config => {
      if (filterPlatform && config.platform !== filterPlatform) return false;
      if (filterStatus && config.status !== filterStatus) return false;
      return true;
    });
  }, [dayConfigs, filterPlatform, filterStatus]);

  const toggleSelectAll = () => {
    const filteredKeys = filteredDayConfigs.map(getDayKey);
    const allSelected = filteredKeys.every(key => selectedDays.has(key));
    
    if (allSelected) {
      setSelectedDays(prev => {
        const next = new Set(prev);
        filteredKeys.forEach(key => next.delete(key));
        return next;
      });
    } else {
      setSelectedDays(prev => {
        const next = new Set(prev);
        filteredKeys.forEach(key => next.add(key));
        return next;
      });
    }
  };

  const selectAllPending = () => {
    const pendingKeys = dayConfigs
      .filter(d => d.status === "pending")
      .map(getDayKey);
    setSelectedDays(new Set(pendingKeys));
  };

  const handleGenerateSelected = async () => {
    if (selectedDays.size === 0) return;
    
    setIsGenerating(true);
    setProgress(null);
    setGenerationResult(null);
    
    const selectedConfigs = dayConfigs.filter(config => 
      selectedDays.has(getDayKey(config)) && 
      (config.status === "pending" || config.status === "error")
    );
    
    let totalGenerated = 0;
    const allErrors: string[] = [];

    for (let i = 0; i < selectedConfigs.length; i++) {
      const dayConfig = selectedConfigs[i];
      const dayIndex = dayConfigs.findIndex(d => 
        d.date === dayConfig.date && d.platform === dayConfig.platform
      );

      updateDayConfig(dayIndex, { status: "generating" });

      setProgress({
        total: selectedConfigs.length,
        completed: i,
        currentDate: dayConfig.date,
        currentPlatform: dayConfig.platform,
        status: `Generando ${formatDayLabel(dayConfig.date)}...`,
      });

      try {
        const response = await fetch("/api/content/autopilot/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            startDate: dayConfig.date,
            endDate: dayConfig.date,
            targetPlatform: dayConfig.platform,
            postCategory: dayConfig.category,
            postSchema: dayConfig.schema,
            writingStyle: dayConfig.writingStyle,
            customInstructions: dayConfig.writingStyle === "custom" ? localCustomInstructions : undefined,
            mediaType: dayConfig.mediaType,
            copyType: dayConfig.copyType,
            templateId: selectedTemplate !== "none" ? selectedTemplate : undefined,
            excludeWeekends: false,
            excludeHolidays: false,
            postsPerDay,
            mode: "controllata",
            contentTypes: [dayConfig.contentTheme],
            optimalTimes: configuredTimes,
          }),
        });

        if (!response.ok) {
          throw new Error(`Errore per ${dayConfig.date}`);
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let daySuccess = false;

        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const text = decoder.decode(value);
            const lines = text.split("\n").filter((line) => line.startsWith("data: "));

            for (const line of lines) {
              try {
                const data = JSON.parse(line.replace("data: ", ""));
                if (data.type === "complete" && data.success) {
                  daySuccess = true;
                  totalGenerated += data.generated || 1;
                } else if (data.type === "error") {
                  allErrors.push(`${dayConfig.date}: ${data.error}`);
                }
              } catch (e) {}
            }
          }
        }

        updateDayConfig(dayIndex, { status: daySuccess ? "generated" : "error" });
      } catch (err: any) {
        updateDayConfig(dayIndex, { status: "error" });
        allErrors.push(`${dayConfig.date}: ${err.message}`);
      }
    }

    setGenerationResult({
      success: allErrors.length === 0,
      generated: totalGenerated,
      errors: allErrors,
    });
    setProgress(null);
    setIsGenerating(false);
    setSelectedDays(new Set());

    toast({
      title: "Generazione completata!",
      description: `${totalGenerated} post generati${allErrors.length > 0 ? ` con ${allErrors.length} errori` : ""}.`,
    });
  };

  const calculation = useMemo(() => {
    if (!startDate || !endDate) {
      return { totalDays: 0, totalPosts: 0, excludedDays: [], validDays: 0, validDates: [] as string[] };
    }

    const start = new Date(startDate);
    const end = new Date(endDate);
    const excludedDays: { date: string; reason: string }[] = [];
    const validDates: string[] = [];
    let validDays = 0;

    const current = new Date(start);
    while (current <= end) {
      const dateStr = current.toISOString().split("T")[0];
      const dayOfWeek = current.getDay();
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const isHoliday = ITALIAN_HOLIDAYS.includes(dateStr);

      let excluded = false;
      let reasons: string[] = [];

      if (excludeWeekends && isWeekend) {
        excluded = true;
        reasons.push(dayOfWeek === 0 ? "Domenica" : "Sabato");
      }
      if (excludeHolidays && isHoliday) {
        excluded = true;
        reasons.push("Festività");
      }

      if (excluded) {
        excludedDays.push({ date: dateStr, reason: reasons.join(", ") });
      } else {
        validDays++;
        validDates.push(dateStr);
      }

      current.setDate(current.getDate() + 1);
    }

    const diffTime = end.getTime() - start.getTime();
    const totalDays = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1);
    const totalPosts = validDays * postsPerDay * localPlatforms.length;

    return { totalDays, totalPosts, excludedDays, validDays, validDates };
  }, [startDate, endDate, excludeWeekends, excludeHolidays, postsPerDay, localPlatforms.length]);

  useEffect(() => {
    if (mode === "controllata" && calculation.validDates.length > 0) {
      const existingDates = new Set(dayConfigs.map(d => d.date));
      const newDates = calculation.validDates.filter(d => !existingDates.has(d));
      const removedDates = dayConfigs.filter(d => !calculation.validDates.includes(d.date));
      
      if (newDates.length > 0 || removedDates.length > 0) {
        const contentTypesToUse = selectedContentTypes.length > 0 ? selectedContentTypes : ["educativo"];
        
        const newConfigs: DayConfig[] = [];
        let contentThemeIndex = 0;
        
        calculation.validDates.forEach((date) => {
          localPlatforms.forEach((platform) => {
            const existingKey = `${date}-${platform}`;
            const existing = dayConfigs.find(d => d.date === date && d.platform === platform);
            if (existing) {
              newConfigs.push(existing);
            } else {
              const rotatedContentTheme = contentTypesToUse[contentThemeIndex % contentTypesToUse.length];
              contentThemeIndex++;
              
              newConfigs.push({
                date,
                platform,
                category: localCategory,
                schema: localSchema,
                writingStyle: localWritingStyle,
                mediaType: localMediaType,
                copyType: localCopyType,
                contentTheme: rotatedContentTheme,
                status: "pending" as const,
              });
            }
          });
        });
        setDayConfigs(newConfigs);
      }
    }
  }, [mode, calculation.validDates, selectedContentTypes, localPlatforms]);

  const canGenerate =
    startDate &&
    endDate &&
    calculation.totalPosts > 0 &&
    selectedContentTypes.length > 0;

  const handleGenerate = async () => {
    if (!canGenerate) return;

    setIsGenerating(true);
    setProgress(null);
    setGenerationResult(null);

    let finalResult: GenerationResult | null = null;

    try {
      if (mode === "controllata" && dayConfigs.length > 0) {
        let totalGenerated = 0;
        const allErrors: string[] = [];
        const pendingConfigs = dayConfigs.filter(d => d.status === "pending" || d.status === "error");

        for (let i = 0; i < pendingConfigs.length; i++) {
          const dayConfig = pendingConfigs[i];
          const dayIndex = dayConfigs.findIndex(d => d.date === dayConfig.date);

          updateDayConfig(dayIndex, { status: "generating" });

          setProgress({
            total: pendingConfigs.length,
            completed: i,
            currentDate: dayConfig.date,
            currentPlatform: dayConfig.platform,
            status: `Generando ${formatDayLabel(dayConfig.date)}...`,
          });

          try {
            const response = await fetch("/api/content/autopilot/generate", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getAuthHeaders(),
              },
              body: JSON.stringify({
                startDate: dayConfig.date,
                endDate: dayConfig.date,
                targetPlatform: dayConfig.platform,
                postCategory: dayConfig.category,
                postSchema: dayConfig.schema,
                writingStyle: dayConfig.writingStyle,
                customInstructions: dayConfig.writingStyle === "custom" ? localCustomInstructions : undefined,
                mediaType: dayConfig.mediaType,
                copyType: dayConfig.copyType,
                templateId: selectedTemplate !== "none" ? selectedTemplate : undefined,
                excludeWeekends: false,
                excludeHolidays: false,
                postsPerDay,
                mode: "controllata",
                contentTypes: [dayConfig.contentTheme],
                optimalTimes: configuredTimes,
              }),
            });

            if (!response.ok) {
              throw new Error(`Errore per ${dayConfig.date}`);
            }

            const reader = response.body?.getReader();
            const decoder = new TextDecoder();
            let daySuccess = false;

            if (reader) {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const text = decoder.decode(value);
                const lines = text.split("\n").filter((line) => line.startsWith("data: "));

                for (const line of lines) {
                  try {
                    const data = JSON.parse(line.replace("data: ", ""));
                    if (data.type === "complete" && data.success) {
                      daySuccess = true;
                      totalGenerated += data.generated || 1;
                    } else if (data.type === "error") {
                      allErrors.push(`${dayConfig.date}: ${data.error}`);
                    }
                  } catch (e) {}
                }
              }
            }

            updateDayConfig(dayIndex, { status: daySuccess ? "generated" : "error" });
          } catch (err: any) {
            updateDayConfig(dayIndex, { status: "error" });
            allErrors.push(`${dayConfig.date}: ${err.message}`);
          }
        }

        finalResult = {
          success: allErrors.length === 0,
          generated: totalGenerated,
          errors: allErrors,
        };
        setGenerationResult(finalResult);
        setProgress(null);

        toast({
          title: "Generazione completata!",
          description: `${totalGenerated} post generati${allErrors.length > 0 ? ` con ${allErrors.length} errori` : ""}.`,
        });
      } else {
        const response = await fetch("/api/content/autopilot/generate", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders(),
          },
          body: JSON.stringify({
            startDate,
            endDate,
            targetPlatforms: localPlatforms,
            postCategory: localCategory,
            postSchema: localSchema,
            writingStyle: localWritingStyle,
            customInstructions: localWritingStyle === "custom" ? localCustomInstructions : undefined,
            mediaType: localMediaType,
            copyType: localCopyType,
            templateId: selectedTemplate !== "none" ? selectedTemplate : undefined,
            excludeWeekends,
            excludeHolidays,
            postsPerDay,
            mode,
            contentTypes: selectedContentTypes,
            optimalTimes: configuredTimes,
          }),
        });

        if (!response.ok) {
          throw new Error("Errore nell'avvio della generazione");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("Risposta non valida");
        }

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));

              if (data.type === "complete") {
                finalResult = {
                  success: data.success,
                  generated: data.generated,
                  errors: data.errors || [],
                };
                setGenerationResult(finalResult);
              } else if (data.type === "error") {
                throw new Error(data.error);
              } else {
                setProgress(data);
              }
            } catch (e) {}
          }
        }

        toast({
          title: "Generazione completata!",
          description: `${finalResult?.generated || 0} post generati con successo.`,
        });
      }
    } catch (error: any) {
      console.error("Generation error:", error);
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateSingleDay = async (dayIndex: number) => {
    const dayConfig = dayConfigs[dayIndex];
    if (!dayConfig || dayConfig.status === "generating") return;

    updateDayConfig(dayIndex, { status: "generating" });

    try {
      const response = await fetch("/api/content/autopilot/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          startDate: dayConfig.date,
          endDate: dayConfig.date,
          targetPlatform: dayConfig.platform,
          postCategory: dayConfig.category,
          postSchema: dayConfig.schema,
          writingStyle: dayConfig.writingStyle,
          customInstructions: dayConfig.writingStyle === "custom" ? localCustomInstructions : undefined,
          mediaType: dayConfig.mediaType,
          copyType: dayConfig.copyType,
          templateId: selectedTemplate !== "none" ? selectedTemplate : undefined,
          excludeWeekends: false,
          excludeHolidays: false,
          postsPerDay,
          mode: "controllata",
          contentTypes: [dayConfig.contentTheme],
          optimalTimes: configuredTimes,
        }),
      });

      if (!response.ok) {
        throw new Error("Errore nella generazione");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const text = decoder.decode(value);
          const lines = text.split("\n").filter((line) => line.startsWith("data: "));

          for (const line of lines) {
            try {
              const data = JSON.parse(line.replace("data: ", ""));
              if (data.type === "complete" && data.success) {
                updateDayConfig(dayIndex, { status: "generated" });
              } else if (data.type === "error") {
                updateDayConfig(dayIndex, { status: "error" });
              }
            } catch (e) {}
          }
        }
      }

      toast({
        title: "Giorno generato!",
        description: `Post per ${formatDayLabel(dayConfig.date)} generato con successo.`,
      });
    } catch (error: any) {
      console.error("Single day generation error:", error);
      updateDayConfig(dayIndex, { status: "error" });
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <Card className="border border-gray-200 dark:border-gray-700">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-600">
              <Rocket className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                Autopilot
                <div className="flex gap-1">
                  {localPlatforms.map(p => {
                    const cfg = PLATFORM_CONFIG[p];
                    const Icon = cfg.icon;
                    return (
                      <Badge key={p} variant="secondary" className="text-xs">
                        <Icon className={`h-3 w-3 mr-1 ${cfg.color}`} />
                        {cfg.label}
                      </Badge>
                    );
                  })}
                </div>
              </CardTitle>
              <CardDescription>
                Genera contenuti in batch per il periodo selezionato
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Sezione Configurazione Autopilot */}
          <div className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 space-y-4">
            <div className="flex items-center gap-2 mb-3">
              <Settings className="h-4 w-4 text-gray-600" />
              <span className="font-medium text-sm text-gray-700 dark:text-gray-300">Configurazione Autopilot</span>
            </div>

            {/* Piattaforma (Multi-select) */}
            <div className="space-y-2">
              <Label className="text-sm">Piattaforme (seleziona una o più)</Label>
              <div className="grid grid-cols-3 gap-2">
                {(["instagram", "x", "linkedin"] as const).map((platform) => {
                  const config = PLATFORM_CONFIG[platform];
                  const Icon = config.icon;
                  const isSelected = localPlatforms.includes(platform);
                  return (
                    <Button
                      key={platform}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`flex items-center gap-2 ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      onClick={() => togglePlatform(platform)}
                    >
                      <Icon className={`h-4 w-4 ${isSelected ? "text-white" : config.color}`} />
                      <span className="hidden sm:inline">{config.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Categoria/Obiettivo */}
            <div className="space-y-2">
              <Label className="text-sm">Categoria/Obiettivo</Label>
              <div className="grid grid-cols-3 gap-2">
                {POST_CATEGORIES.map((cat) => {
                  const isSelected = localCategory === cat.value;
                  return (
                    <Button
                      key={cat.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`flex items-center gap-2 ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      onClick={() => setLocalCategory(cat.value as "ads" | "valore" | "altri")}
                    >
                      <span>{cat.icon}</span>
                      <span className="text-xs">{cat.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Schema Post */}
            <div className="space-y-2">
              <Label className="text-sm">Schema Post</Label>
              <Select value={localSchema} onValueChange={setLocalSchema}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona uno schema" />
                </SelectTrigger>
                <SelectContent>
                  {availableSchemas.length > 0 ? (
                    availableSchemas.map((schema) => (
                      <SelectItem key={schema.value} value={schema.value}>
                        <div className="flex flex-col">
                          <span>{schema.label}</span>
                          <span className="text-xs text-muted-foreground">{schema.description}</span>
                        </div>
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="originale">Originale (Universale)</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Stile Scrittura */}
            <div className="space-y-2">
              <Label className="text-sm">Stile di Scrittura</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {WRITING_STYLES.map((style) => {
                  const isSelected = localWritingStyle === style.value;
                  return (
                    <Button
                      key={style.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`flex items-center gap-1.5 h-auto py-2 px-3 ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      onClick={() => setLocalWritingStyle(style.value)}
                    >
                      <span>{style.icon}</span>
                      <div className="text-left">
                        <div className="text-xs font-medium">{style.label}</div>
                      </div>
                    </Button>
                  );
                })}
              </div>
              {localWritingStyle === "custom" && (
                <Textarea
                  placeholder="Scrivi le tue istruzioni personalizzate per lo stile di scrittura..."
                  value={localCustomInstructions}
                  onChange={(e) => setLocalCustomInstructions(e.target.value)}
                  className="mt-2"
                  rows={3}
                />
              )}
            </div>

            {/* Tipo Media */}
            <div className="space-y-2">
              <Label className="text-sm">Tipo Media</Label>
              <div className="grid grid-cols-4 gap-2">
                {MEDIA_TYPES.map((type) => {
                  const isSelected = localMediaType === type.value;
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`flex flex-col items-center gap-1 h-auto py-2 ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      onClick={() => setLocalMediaType(type.value)}
                    >
                      <span className="text-lg">{type.icon}</span>
                      <span className="text-xs">{type.label}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Tipo Copy */}
            <div className="space-y-2">
              <Label className="text-sm">Tipo Copy</Label>
              <div className="grid grid-cols-2 gap-2">
                {COPY_TYPES.map((type) => {
                  const isSelected = localCopyType === type.value;
                  return (
                    <Button
                      key={type.value}
                      type="button"
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className={`flex flex-col items-center gap-1 h-auto py-3 ${isSelected ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                      onClick={() => setLocalCopyType(type.value)}
                    >
                      <span className="font-medium">{type.label}</span>
                      <span className="text-xs text-muted-foreground">{type.description}</span>
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* Orari Configurati */}
            <div className="pt-3 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-3.5 w-3.5 text-gray-600" />
                <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                  Orari Pubblicazione {platformSchedule ? "(da Brand Assets)" : "(default ottimali)"}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {configuredTimes.map((time, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs bg-white dark:bg-gray-900">
                    {time}
                  </Badge>
                ))}
              </div>
              {!platformSchedule && (
                <p className="text-xs text-muted-foreground mt-2">
                  Configura orari personalizzati in Brand Assets → Posting Schedule
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="autopilot-start" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data Inizio
              </Label>
              <Input
                id="autopilot-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={today}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="autopilot-end" className="flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Data Fine
              </Label>
              <Input
                id="autopilot-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate || today}
              />
            </div>
          </div>

          <div className="space-y-4">
            <Label className="flex items-center gap-2">
              <CalendarOff className="h-4 w-4" />
              Esclusioni
            </Label>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center space-x-2">
                <Switch
                  id="exclude-weekends"
                  checked={excludeWeekends}
                  onCheckedChange={setExcludeWeekends}
                />
                <Label htmlFor="exclude-weekends" className="text-sm cursor-pointer">
                  Escludi weekend
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="exclude-holidays"
                  checked={excludeHolidays}
                  onCheckedChange={setExcludeHolidays}
                />
                <Label htmlFor="exclude-holidays" className="text-sm cursor-pointer">
                  Escludi festività italiane
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Zap className="h-4 w-4" />
              Frequenza Post/Giorno
            </Label>
            <Select
              value={postsPerDay.toString()}
              onValueChange={(v) => setPostsPerDay(parseInt(v))}
            >
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4, 5].map((n) => (
                  <SelectItem key={n} value={n.toString()}>
                    {n} post/giorno
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Modalità Generazione
            </Label>
            <Select
              value={mode}
              onValueChange={(v) => setMode(v as "automatica" | "controllata")}
            >
              <SelectTrigger className="w-full sm:w-[250px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="automatica">
                  <div className="flex items-center gap-2">
                    <Play className="h-4 w-4" />
                    Automatica (genera e pubblica)
                  </div>
                </SelectItem>
                <SelectItem value="controllata">
                  <div className="flex items-center gap-2">
                    <Eye className="h-4 w-4" />
                    Controllata (genera come bozze)
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3">
            <Label className="flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              Tipi Contenuto da Ruotare
            </Label>
            <div className="grid grid-cols-2 gap-3">
              {CONTENT_TYPES.map((type) => {
                const TypeIcon = type.icon;
                const isSelected = selectedContentTypes.includes(type.id);
                return (
                  <div
                    key={type.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                      isSelected
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                        : "border-border hover:border-muted-foreground/30"
                    }`}
                    onClick={() => toggleContentType(type.id)}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleContentType(type.id)}
                    />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <TypeIcon className={`h-4 w-4 flex-shrink-0 ${isSelected ? "text-blue-600" : "text-muted-foreground"}`} />
                      <span className="text-sm font-medium truncate">{type.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Configurazione Giorno per Giorno - Solo in modalità controllata */}
          <AnimatePresence>
            {mode === "controllata" && dayConfigs.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="rounded-lg bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-5 w-5 text-blue-600" />
                    <span className="font-semibold text-sm text-gray-800 dark:text-gray-200">
                      Configurazione Giorno per Giorno
                    </span>
                    <Badge variant="secondary" className="text-xs bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                      {filteredDayConfigs.length}/{dayConfigs.length}
                    </Badge>
                  </div>
                </div>

                {/* Filtri rapidi */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex flex-wrap items-center gap-4">
                    {/* Filtro Piattaforma */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Piattaforma:</span>
                      <div className="flex gap-1">
                        {(["instagram", "x", "linkedin"] as const).map((p) => {
                          const PIcon = PLATFORM_CONFIG[p].icon;
                          const isActive = filterPlatform === p;
                          return (
                            <Button
                              key={p}
                              size="sm"
                              variant={isActive ? "default" : "outline"}
                              className={`h-7 px-2 text-xs ${isActive ? "bg-blue-600 hover:bg-blue-700" : ""}`}
                              onClick={() => setFilterPlatform(isActive ? null : p)}
                            >
                              <PIcon className={`h-3 w-3 ${isActive ? "text-white" : PLATFORM_CONFIG[p].color}`} />
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Filtro Stato */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Stato:</span>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant={filterStatus === "pending" ? "default" : "outline"}
                          className={`h-7 px-2 text-xs ${filterStatus === "pending" ? "bg-gray-600 hover:bg-gray-700" : ""}`}
                          onClick={() => setFilterStatus(filterStatus === "pending" ? null : "pending")}
                        >
                          <Clock className="h-3 w-3 mr-1" />
                          Pending
                        </Button>
                        <Button
                          size="sm"
                          variant={filterStatus === "generated" ? "default" : "outline"}
                          className={`h-7 px-2 text-xs ${filterStatus === "generated" ? "bg-emerald-600 hover:bg-emerald-700" : ""}`}
                          onClick={() => setFilterStatus(filterStatus === "generated" ? null : "generated")}
                        >
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Generato
                        </Button>
                        <Button
                          size="sm"
                          variant={filterStatus === "error" ? "default" : "outline"}
                          className={`h-7 px-2 text-xs ${filterStatus === "error" ? "bg-red-600 hover:bg-red-700" : ""}`}
                          onClick={() => setFilterStatus(filterStatus === "error" ? null : "error")}
                        >
                          <XCircle className="h-3 w-3 mr-1" />
                          Errore
                        </Button>
                      </div>
                    </div>

                    {/* Reset filtri */}
                    {(filterPlatform || filterStatus) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 px-2 text-xs text-gray-500"
                        onClick={() => { setFilterPlatform(null); setFilterStatus(null); }}
                      >
                        Reset filtri
                      </Button>
                    )}
                  </div>
                </div>

                {/* Azioni bulk */}
                <div className="p-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                        {selectedDays.size > 0 ? `${selectedDays.size} selezionati` : "Nessuna selezione"}
                      </span>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 px-2 text-xs"
                        onClick={selectAllPending}
                      >
                        Seleziona tutti pending
                      </Button>
                    </div>
                    {selectedDays.size > 0 && (
                      <Button
                        size="sm"
                        className="h-7 px-3 text-xs bg-blue-600 hover:bg-blue-700"
                        onClick={handleGenerateSelected}
                        disabled={isGenerating}
                      >
                        {isGenerating ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Sparkles className="h-3 w-3 mr-1" />
                        )}
                        Genera selezionati ({selectedDays.size})
                      </Button>
                    )}
                  </div>
                </div>

                {/* Tabella */}
                <div className="max-h-[400px] overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0 z-10">
                      <tr>
                        <th className="w-10 p-2 text-center">
                          <Checkbox
                            checked={filteredDayConfigs.length > 0 && filteredDayConfigs.every(c => selectedDays.has(getDayKey(c)))}
                            onCheckedChange={toggleSelectAll}
                          />
                        </th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Data</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Piattaforma</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Tema</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Schema</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Stile</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Stato</th>
                        <th className="p-2 text-left text-xs font-medium text-gray-600 dark:text-gray-400">Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredDayConfigs.map((config, filteredIndex) => {
                        const dayKey = getDayKey(config);
                        const index = dayConfigs.findIndex(d => d.date === config.date && d.platform === config.platform);
                        const uniqueKey = `${dayKey}-${index}`;
                        const DayPlatformIcon = PLATFORM_CONFIG[config.platform].icon;
                        const daySchemas = getAvailableSchemasForDay(config.platform, config.category);
                        const isSelected = selectedDays.has(dayKey);
                        const isDisabled = config.status === "generating" || config.status === "generated";

                        return (
                          <tr
                            key={uniqueKey}
                            className={`border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${isSelected ? "bg-blue-50 dark:bg-blue-950/30" : ""}`}
                          >
                            {/* Checkbox */}
                            <td className="p-2 text-center">
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleSelectDay(dayKey)}
                              />
                            </td>

                            {/* Data */}
                            <td className="p-2">
                              <span className="text-xs font-medium text-gray-800 dark:text-gray-200">
                                {formatDayLabel(config.date)}
                              </span>
                            </td>

                            {/* Piattaforma */}
                            <td className="p-2">
                              <Select
                                value={config.platform}
                                onValueChange={(v) => updateDayConfig(index, { platform: v as "instagram" | "x" | "linkedin" })}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className="h-7 w-24 text-xs bg-transparent border-gray-200 dark:border-gray-700">
                                  <DayPlatformIcon className={`h-3 w-3 mr-1 ${PLATFORM_CONFIG[config.platform].color}`} />
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {(["instagram", "x", "linkedin"] as const).map((p) => {
                                    const PIcon = PLATFORM_CONFIG[p].icon;
                                    return (
                                      <SelectItem key={p} value={p}>
                                        <div className="flex items-center gap-1">
                                          <PIcon className={`h-3 w-3 ${PLATFORM_CONFIG[p].color}`} />
                                          <span className="text-xs">{PLATFORM_CONFIG[p].label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Tema */}
                            <td className="p-2">
                              <Select
                                value={config.contentTheme}
                                onValueChange={(v) => updateDayConfig(index, { contentTheme: v })}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className="h-7 w-28 text-xs bg-transparent border-gray-200 dark:border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CONTENT_TYPES.map((type) => {
                                    const TypeIcon = type.icon;
                                    return (
                                      <SelectItem key={type.id} value={type.id}>
                                        <div className="flex items-center gap-1">
                                          <TypeIcon className="h-3 w-3" />
                                          <span className="text-xs">{type.label}</span>
                                        </div>
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Schema */}
                            <td className="p-2">
                              <Select
                                value={config.schema}
                                onValueChange={(v) => updateDayConfig(index, { schema: v })}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className="h-7 w-32 text-xs bg-transparent border-gray-200 dark:border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {daySchemas.length > 0 ? (
                                    daySchemas.map((schema) => (
                                      <SelectItem key={schema.value} value={schema.value}>
                                        <span className="text-xs">{schema.label}</span>
                                      </SelectItem>
                                    ))
                                  ) : (
                                    <SelectItem value="originale">Originale</SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Stile */}
                            <td className="p-2">
                              <Select
                                value={config.writingStyle}
                                onValueChange={(v) => updateDayConfig(index, { writingStyle: v })}
                                disabled={isDisabled}
                              >
                                <SelectTrigger className="h-7 w-28 text-xs bg-transparent border-gray-200 dark:border-gray-700">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {WRITING_STYLES.map((style) => (
                                    <SelectItem key={style.value} value={style.value}>
                                      <span className="text-xs">{style.icon} {style.label}</span>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </td>

                            {/* Stato */}
                            <td className="p-2">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] px-2 py-0.5 flex items-center gap-1 w-fit ${
                                  config.status === "pending"
                                    ? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                    : config.status === "generating"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                                    : config.status === "generated"
                                    ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300"
                                }`}
                              >
                                {config.status === "pending" && <><Clock className="h-3 w-3" /> Pending</>}
                                {config.status === "generating" && <><Loader2 className="h-3 w-3 animate-spin" /> Gen...</>}
                                {config.status === "generated" && <><CheckCircle className="h-3 w-3" /> OK</>}
                                {config.status === "error" && <><XCircle className="h-3 w-3" /> Err</>}
                              </Badge>
                            </td>

                            {/* Azioni */}
                            <td className="p-2">
                              <Button
                                size="sm"
                                variant={config.status === "generated" ? "outline" : "default"}
                                className={`h-7 px-2 text-xs ${
                                  config.status === "pending"
                                    ? "bg-blue-600 hover:bg-blue-700 text-white"
                                    : config.status === "generated"
                                    ? "text-emerald-600 border-emerald-300"
                                    : config.status === "error"
                                    ? "bg-red-600 hover:bg-red-700 text-white"
                                    : ""
                                }`}
                                onClick={() => handleGenerateSingleDay(index)}
                                disabled={isDisabled}
                              >
                                {config.status === "generating" ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : config.status === "generated" ? (
                                  <CheckCircle className="h-3 w-3" />
                                ) : config.status === "error" ? (
                                  <><Zap className="h-3 w-3" /></>
                                ) : (
                                  <Sparkles className="h-3 w-3" />
                                )}
                              </Button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Summary footer */}
                <div className="flex items-center justify-between p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                  <div className="flex gap-4 text-xs font-medium">
                    <span className="flex items-center gap-1.5 text-gray-600 dark:text-gray-400">
                      <Clock className="h-3.5 w-3.5 text-gray-400" />
                      Pending: {dayConfigs.filter(d => d.status === "pending").length}
                    </span>
                    <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                      <CheckCircle className="h-3.5 w-3.5" />
                      Generati: {dayConfigs.filter(d => d.status === "generated").length}
                    </span>
                    {dayConfigs.filter(d => d.status === "error").length > 0 && (
                      <span className="flex items-center gap-1.5 text-red-600 dark:text-red-400">
                        <XCircle className="h-3.5 w-3.5" />
                        Errori: {dayConfigs.filter(d => d.status === "error").length}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {calculation.totalDays > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="p-4 rounded-lg bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold">Preview Calcolo</span>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xl font-bold text-blue-600">{calculation.totalDays}</p>
                    <p className="text-xs text-muted-foreground">Giorni Totali</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xl font-bold text-green-600">{calculation.validDays}</p>
                    <p className="text-xs text-muted-foreground">Giorni Validi</p>
                  </div>
                  <div className="text-center p-3 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-xl font-bold text-blue-600">{calculation.totalPosts}</p>
                    <p className="text-xs text-muted-foreground">Post Totali</p>
                  </div>
                </div>

                {calculation.excludedDays.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Giorni esclusi ({calculation.excludedDays.length}):
                    </p>
                    <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                      {calculation.excludedDays.slice(0, 10).map((day) => (
                        <Badge key={day.date} variant="outline" className="text-xs">
                          {new Date(day.date).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                          <span className="text-muted-foreground ml-1">({day.reason})</span>
                        </Badge>
                      ))}
                      {calculation.excludedDays.length > 10 && (
                        <Badge variant="outline" className="text-xs">
                          +{calculation.excludedDays.length - 10} altri
                        </Badge>
                      )}
                    </div>
                  </div>
                )}

                <div className="mt-3 text-xs text-muted-foreground">
                  <span className="font-medium">Orari pubblicazione:</span>{" "}
                  {configuredTimes.join(", ")}
                  {platformSchedule && <span className="ml-1 text-green-600">(Brand Assets)</span>}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <Button
            onClick={handleGenerate}
            disabled={!canGenerate || isGenerating}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white"
            size="lg"
          >
            {isGenerating ? (
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
            ) : (
              <Rocket className="h-5 w-5 mr-2" />
            )}
            {isGenerating ? "Generazione in corso..." : "Genera Autopilot"}
          </Button>

          <AnimatePresence>
            {isGenerating && progress && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-4 bg-muted rounded-lg space-y-3"
              >
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">Generazione in corso...</span>
                  <span className="text-muted-foreground">
                    {progress.completed}/{progress.total}
                  </span>
                </div>
                <Progress
                  value={(progress.completed / progress.total) * 100}
                  className="h-2"
                />
                <p className="text-xs text-muted-foreground">
                  {progress.currentPlatform} - {progress.currentDate}
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {generationResult && !isGenerating && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className={`p-4 rounded-lg ${
                  generationResult.success
                    ? "bg-green-50 border border-green-200 dark:bg-green-950 dark:border-green-800"
                    : "bg-red-50 border border-red-200 dark:bg-red-950 dark:border-red-800"
                }`}
              >
                <div className="flex items-center gap-2">
                  {generationResult.success ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )}
                  <span className="font-medium">
                    {generationResult.success
                      ? `${generationResult.generated} post generati con successo!`
                      : "Generazione completata con errori"}
                  </span>
                </div>
                {generationResult.errors.length > 0 && (
                  <ul className="mt-2 text-sm text-red-600 dark:text-red-400 list-disc list-inside">
                    {generationResult.errors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default AutopilotPanel;
