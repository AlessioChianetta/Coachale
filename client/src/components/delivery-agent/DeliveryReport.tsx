import { useState, useEffect, useRef, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft,
  Download,
  Share2,
  User,
  Stethoscope,
  Package,
  Calendar,
  Zap,
  BarChart3,
  Loader2,
  CheckCircle2,
  Clock,
  Target,
  TrendingUp,
  ExternalLink,
  Star,
  ChevronDown,
  ChevronUp,
  Layers,
  ArrowRight,
  AlertTriangle,
  Globe,
  MapPin,
  FileText,
  Lightbulb,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface PackageModule {
  name: string;
  complexity: string;
  setup_time: string;
  config_link?: string;
}

interface RecommendedPackage {
  package_name: string;
  subtitle: string;
  priority: "fondamenta" | "core" | "avanzato";
  reason: string;
  modules: PackageModule[];
  timeline: string;
  connection: string;
  score?: number;
  score_label?: string;
  whats_good?: string;
  whats_wrong?: string;
  how_to_fix?: string[];
  critical_diagnosis?: string;
}

interface DiagnosticTableRow {
  area: string;
  stato: string;
  impatto: "alto" | "medio" | "basso" | "urgente";
  nota: string;
}

interface RoadmapWeek {
  titolo: string;
  pacchetti_coinvolti: string[];
  azioni_prioritarie: string[];
  obiettivo: string;
  kpi_target: string;
}

interface PriorityAction {
  titolo: string;
  descrizione: string;
  tempo: string;
  impatto: string;
}

interface RecommendedModule {
  name: string;
  priority: "fondamenta" | "core" | "avanzato";
  complexity: "bassa" | "media" | "alta";
  reason: string;
  config_link?: string;
}

interface ReportData {
  personal_letter?: string;
  client_profile?: {
    name?: string;
    business_type?: string;
    sector?: string;
    niche?: string;
    years?: number;
    scale?: string;
    team_size?: string;
    main_pain_point?: string;
    goals?: string[];
    digital_maturity?: string;
    current_tools?: string[];
    budget?: string;
    communication_channels?: string[];
    sales_method?: string;
    has_training?: boolean;
    website?: string;
    city?: string;
  };
  diagnosis?: {
    current_state?: string;
    desired_state?: string;
    gap_analysis?: string;
    key_challenges?: string[];
    diagnostic_table?: DiagnosticTableRow[];
    key_insight?: string;
  };
  recommended_packages?: RecommendedPackage[];
  recommended_modules?: RecommendedModule[];
  roadmap?: {
    week1?: RoadmapWeek | any;
    week2?: RoadmapWeek;
    week3?: RoadmapWeek;
    week4?: RoadmapWeek;
    weeks2_4?: any;
    month2_plus?: any;
  };
  quick_wins?: Array<{
    title: string;
    steps: string[];
    estimated_time: string;
    impact?: string;
    link?: string;
  }>;
  priority_actions?: PriorityAction[];
  success_metrics?: Array<{
    kpi: string;
    target: string;
    measurement: string;
    timeframe: string;
  }>;
  closing_message?: string;
}

function normalizeReport(raw: any): ReportData {
  if (!raw) return {};
  const p = raw.profilo_cliente || raw.client_profile;
  const d = raw.diagnosi || raw.diagnosis;
  const pkg = raw.pacchetti_consigliati || raw.recommended_packages;
  const m = raw.moduli_consigliati || raw.recommended_modules;
  const r = raw.roadmap;
  const q = raw.quick_wins;
  const s = raw.metriche_successo || raw.success_metrics;

  const result: ReportData = {};

  result.personal_letter = raw.lettera_personale || raw.personal_letter || undefined;
  result.closing_message = raw.chiusura_personale || raw.closing_message || undefined;

  const pa = raw.azioni_questa_settimana || raw.priority_actions;
  if (pa && Array.isArray(pa)) {
    result.priority_actions = pa.map((a: any) => ({
      titolo: a.titolo || a.title || '',
      descrizione: a.descrizione || a.description || '',
      tempo: a.tempo || a.time || '',
      impatto: a.impatto || a.impact || '',
    }));
  }

  if (p) {
    result.client_profile = {
      name: p.nome || p.name || undefined,
      business_type: p.tipo_business || p.business_type,
      sector: p.settore || p.sector,
      niche: p.nicchia || p.niche,
      years: p.anni_attivita || p.years,
      scale: p.scala_descrizione || p.scale || (p.scala ? `${p.scala.clienti_attivi || 0} clienti` : undefined),
      team_size: String(p.team_size || ''),
      main_pain_point: p.pain_point_badge || p.main_pain_point || p.pain_point_principale,
      goals: p.obiettivi_chiave || p.obiettivi_3_6_mesi || p.goals || [],
      digital_maturity: p.maturita_digitale || p.digital_maturity,
      current_tools: p.strumenti_attuali || p.current_tools || [],
      budget: p.budget,
      communication_channels: p.canali_comunicazione || p.communication_channels || [],
      sales_method: p.metodo_vendita || p.sales_method,
      has_training: p.ha_formazione ?? p.has_training,
      website: p.sito_web || p.website || undefined,
      city: p.citta || p.city || undefined,
    };
  }

  if (d) {
    result.diagnosis = {
      current_state: d.dove_sei_ora || d.current_state,
      desired_state: d.dove_vuoi_arrivare || d.desired_state,
      gap_analysis: d.gap_analysis || d.analisi_gap,
      key_challenges: d.sfide_principali || d.key_challenges || [],
      key_insight: d.insight_chiave || d.key_insight || undefined,
    };
    const dt = d.tabella_diagnostica || d.diagnostic_table;
    if (dt && Array.isArray(dt)) {
      result.diagnosis.diagnostic_table = dt.map((row: any) => ({
        area: row.area || '',
        stato: row.stato || row.status || '',
        impatto: row.impatto || row.impact || 'medio',
        nota: row.nota || row.note || '',
      }));
    }
  }

  if (pkg && Array.isArray(pkg) && pkg.length > 0) {
    result.recommended_packages = pkg.map((pk: any) => ({
      package_name: pk.nome_pacchetto || pk.package_name,
      subtitle: pk.sottotitolo || pk.subtitle || '',
      priority: pk.priorita || pk.priority || 'core',
      reason: pk.perche_per_te || pk.reason || '',
      modules: Array.isArray(pk.moduli_inclusi || pk.modules) ? (pk.moduli_inclusi || pk.modules).map((mod: any) => ({
        name: mod.nome || mod.name || '',
        complexity: mod.complessita_setup || mod.complexity || 'media',
        setup_time: mod.tempo_setup || mod.setup_time || '',
        config_link: mod.config_link,
      })) : [],
      timeline: pk.timeline_setup || pk.timeline || '',
      connection: pk.connessione_altri_pacchetti || pk.connection || '',
      score: pk.punteggio || pk.score || undefined,
      score_label: pk.punteggio_label || pk.score_label || undefined,
      whats_good: pk.cosa_va_bene || pk.whats_good || undefined,
      whats_wrong: pk.cosa_non_funziona || pk.whats_wrong || undefined,
      how_to_fix: Array.isArray(pk.come_correggere || pk.how_to_fix) ? (pk.come_correggere || pk.how_to_fix) : undefined,
      critical_diagnosis: pk.diagnosi_critica || pk.critical_diagnosis || undefined,
    }));
  }

  if (m && Array.isArray(m) && !result.recommended_packages) {
    result.recommended_modules = m.map((mod: any) => ({
      name: mod.nome || mod.name,
      priority: mod.priorita || mod.priority || 'core',
      complexity: mod.complessita_setup || mod.complexity || 'media',
      reason: mod.perche_per_te || mod.reason || '',
      config_link: mod.config_link,
    }));
  }

  if (r) {
    const mapWeek = (w: any): RoadmapWeek | undefined => {
      if (!w) return undefined;
      return {
        titolo: w.titolo || w.title || '',
        pacchetti_coinvolti: w.pacchetti_coinvolti || w.pacchetti || w.packages || [],
        azioni_prioritarie: w.azioni_prioritarie || w.azioni || w.actions || [],
        obiettivo: w.obiettivo || w.objective || '',
        kpi_target: w.kpi_target || w.kpi || '',
      };
    };

    const mapLegacyPhase = (phase: any) => {
      if (!phase) return undefined;
      if (Array.isArray(phase)) return phase;
      if (phase.azioni && Array.isArray(phase.azioni)) {
        return phase.azioni.map((a: string) => ({
          module: a,
          action: phase.obiettivo || '',
          packages: phase.pacchetti || [],
        }));
      }
      if (phase.moduli && Array.isArray(phase.moduli)) {
        return phase.moduli.map((m: string) => ({ module: m, action: phase.obiettivo || '' }));
      }
      return undefined;
    };

    result.roadmap = {
      week1: mapWeek(r.settimana_1 || r.week1) || mapLegacyPhase(r.settimana_1 || r.week1),
      week2: mapWeek(r.settimana_2 || r.week2),
      week3: mapWeek(r.settimana_3 || r.week3),
      week4: mapWeek(r.settimana_4 || r.week4),
      weeks2_4: mapLegacyPhase(r.settimane_2_4 || r.weeks2_4),
      month2_plus: mapLegacyPhase(r.mese_2_plus || r.month2_plus),
    };
  }

  if (q && Array.isArray(q)) {
    result.quick_wins = q.map((qw: any) => ({
      title: qw.titolo || qw.title || '',
      steps: Array.isArray(qw.passi || qw.steps) ? (qw.passi || qw.steps) : [],
      estimated_time: qw.tempo_stimato || qw.estimated_time || '',
      impact: qw.impatto || qw.impact || '',
      link: qw.link,
    }));
  }

  if (s && Array.isArray(s)) {
    result.success_metrics = s.map((sm: any) => ({
      kpi: sm.kpi,
      target: sm.valore_target || sm.target || '',
      measurement: sm.come_misurare || sm.measurement || '',
      timeframe: sm.timeframe || '',
    }));
  }

  return result;
}

interface DeliveryReportProps {
  sessionId: string;
  onBackToChat: () => void;
}

const COMPLEXITY_BARS: Record<string, number> = {
  bassa: 1,
  media: 2,
  alta: 3,
};

const IMPATTO_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  urgente: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-400", border: "border-red-300 dark:border-red-700" },
  alto: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400", border: "border-amber-300 dark:border-amber-700" },
  medio: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-400", border: "border-blue-300 dark:border-blue-700" },
  basso: { bg: "bg-slate-100 dark:bg-slate-800/50", text: "text-slate-600 dark:text-slate-400", border: "border-slate-300 dark:border-slate-700" },
};

interface Chapter {
  id: string;
  number: string;
  title: string;
  subtitle?: string;
  icon: any;
}

function RichText({ text, className }: { text: string; className?: string }) {
  if (!text || !text.includes('**')) return <span className={className}>{text}</span>;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>
      )}
    </span>
  );
}

export function DeliveryReport({ sessionId, onBackToChat }: DeliveryReportProps) {
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const loadReport = async () => {
      try {
        const res = await fetch(
          `/api/consultant/delivery-agent/reports/${sessionId}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          const reportData = data.data || data.report || data;
          const rawReport = reportData.report_json || reportData;
          setReport(normalizeReport(rawReport));
        }
      } catch (err) {
        console.error("Failed to load report:", err);
        toast({
          title: "Errore",
          description: "Impossibile caricare il report",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [sessionId, toast]);

  const chapters: Chapter[] = [];
  if (report) {
    if (report.personal_letter) chapters.push({ id: "lettera", number: "", title: "Lettera Personale", subtitle: "Introduzione personalizzata", icon: FileText });
    if (report.client_profile) chapters.push({ id: "profilo", number: "01", title: "Profilo Cliente", subtitle: report.client_profile.business_type || "Dati e contesto", icon: User });
    if (report.diagnosis) {
      const diagCount = report.diagnosis?.diagnostic_table?.length;
      chapters.push({ id: "diagnosi", number: "02", title: "La Diagnosi", subtitle: diagCount ? `${diagCount} aree analizzate` : "Analisi completa", icon: Stethoscope });
    }
    if (report.recommended_packages) {
      report.recommended_packages.forEach((pkg, i) => {
        const modCount = pkg.modules?.length;
        const sub = pkg.subtitle || [modCount ? `${modCount} moduli` : null, pkg.priority].filter(Boolean).join(' · ') || undefined;
        chapters.push({
          id: `pkg-${i}`,
          number: String(i + 3).padStart(2, '0'),
          title: pkg.package_name,
          subtitle: sub,
          icon: Package,
        });
      });
    }
    const nextNum = (report.recommended_packages?.length || 0) + 3;
    if (report.roadmap) chapters.push({ id: "roadmap", number: String(nextNum).padStart(2, '0'), title: "Roadmap Operativa", subtitle: "Piano settimana per settimana", icon: Calendar });
    if (report.quick_wins?.length) chapters.push({ id: "quickwins", number: String(nextNum + 1).padStart(2, '0'), title: "Quick Wins", subtitle: `${report.quick_wins.length} azioni rapide`, icon: Zap });
    if (report.success_metrics?.length) chapters.push({ id: "metriche", number: String(nextNum + 2).padStart(2, '0'), title: "Metriche di Successo", subtitle: `${report.success_metrics.length} KPI da monitorare`, icon: BarChart3 });
    if (report.priority_actions?.length) chapters.push({ id: "azioni", number: String(nextNum + 3).padStart(2, '0'), title: "Azioni Immediate", subtitle: "Cosa fare nei prossimi 5 giorni", icon: Lightbulb });
    if (report.closing_message) chapters.push({ id: "chiusura", number: "", title: "Chiusura", icon: BookOpen });
  }

  const scrollToChapter = useCallback((id: string) => {
    const el = chapterRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveChapter(id);
    }
  }, []);

  useEffect(() => {
    if (!report || chapters.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: '-100px 0px -60% 0px', threshold: 0.1 }
    );
    Object.values(chapterRefs.current).forEach(el => {
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, [report, chapters.length]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    try {
      const res = await fetch(
        `/api/consultant/delivery-agent/reports/${sessionId}/pdf`,
        { headers: getAuthHeaders() }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `piano-strategico-${sessionId.slice(0, 8)}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        window.print();
      }
    } catch {
      window.print();
    }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiato", description: "Link alla sessione copiato negli appunti" });
    } catch {
      toast({ title: "Errore", description: "Impossibile copiare il link", variant: "destructive" });
    }
  };

  const setChapterRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    chapterRefs.current[id] = el;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Report non ancora disponibile</p>
          <Button variant="outline" onClick={onBackToChat} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Torna alla Chat
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });
  const hasNewFormat = !!(report.personal_letter || report.priority_actions || report.closing_message);

  return (
    <div className="flex h-full print:block">
      {chapters.length > 0 && (
        <div className={cn(
          "flex-shrink-0 border-r border-border/60 bg-card transition-all duration-300 print:hidden",
          sidebarOpen ? "w-64" : "w-0 overflow-hidden"
        )}>
          <div className="p-4 border-b border-border/40">
            <h3 className="font-bold text-sm text-foreground">Indice</h3>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {chapters.length} capitoli
            </p>
          </div>
          <ScrollArea className="h-[calc(100%-60px)]">
            <div className="p-2 space-y-0.5">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => scrollToChapter(ch.id)}
                  className={cn(
                    "w-full text-left px-3 py-2.5 rounded-lg transition-colors group",
                    activeChapter === ch.id
                      ? "bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200/60 dark:border-indigo-800/40"
                      : "hover:bg-muted/50 border border-transparent"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {ch.number && (
                      <span className={cn(
                        "text-[10px] font-bold w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
                        activeChapter === ch.id
                          ? "bg-indigo-500 text-white"
                          : "bg-muted/80 text-muted-foreground"
                      )}>{ch.number}</span>
                    )}
                    {!ch.number && (
                      <span className={cn(
                        "w-5 h-5 rounded flex items-center justify-center flex-shrink-0",
                        activeChapter === ch.id ? "bg-indigo-500 text-white" : "bg-muted/80 text-muted-foreground"
                      )}>
                        <ch.icon className="w-3 h-3" />
                      </span>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className={cn(
                        "text-xs truncate leading-tight",
                        activeChapter === ch.id
                          ? "font-semibold text-indigo-700 dark:text-indigo-400"
                          : "text-foreground/80 group-hover:text-foreground"
                      )}>{ch.title}</p>
                      {ch.subtitle && (
                        <p className={cn(
                          "text-[10px] truncate leading-tight mt-0.5",
                          activeChapter === ch.id
                            ? "text-indigo-500/70 dark:text-indigo-400/60"
                            : "text-muted-foreground/60"
                        )}>{ch.subtitle}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card flex-shrink-0 print:hidden">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onBackToChat} className="gap-1.5">
              <ArrowLeft className="w-3.5 h-3.5" />
              Chat
            </Button>
            {chapters.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="gap-1.5">
                <BookOpen className="w-3.5 h-3.5" />
                {sidebarOpen ? "Nascondi indice" : "Mostra indice"}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-1.5">
              <Share2 className="w-3.5 h-3.5" />
              Condividi
            </Button>
            <Button
              size="sm"
              onClick={handleDownloadPdf}
              className="gap-1.5 bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
            >
              <Download className="w-3.5 h-3.5" />
              Scarica PDF
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1" ref={contentRef}>
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-10 print:max-w-none print:px-12 print:py-0">

            <div className="text-center py-12 print:py-16 print:break-after-page">
              <div className="w-16 h-1 bg-gradient-to-r from-indigo-500 to-violet-600 mx-auto mb-8 rounded-full" />
              <h1 className="text-3xl font-bold text-foreground tracking-tight print:text-4xl">
                PIANO STRATEGICO
              </h1>
              <h2 className="text-2xl font-light text-foreground/60 mt-1 print:text-3xl">
                PERSONALIZZATO
              </h2>
              <div className="mt-6 space-y-1">
                <p className="text-sm text-muted-foreground">{today}</p>
                <p className="text-sm text-muted-foreground">Documento riservato</p>
              </div>
              {report.client_profile?.name && (
                <div className="mt-8 pt-6 border-t border-border/40 inline-block px-8">
                  <p className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Preparato per</p>
                  <p className="text-lg font-semibold text-foreground">{report.client_profile.name}</p>
                  {report.client_profile.business_type && (
                    <p className="text-sm text-muted-foreground mt-0.5">{report.client_profile.business_type}</p>
                  )}
                </div>
              )}
            </div>

            {report.personal_letter && (
              <div id="lettera" ref={setChapterRef("lettera")} className="print:break-before-page">
                <ChapterHeader icon={FileText} title="Lettera Personale" />
                <div className="mt-6 space-y-4">
                  {report.personal_letter.split('\n\n').map((paragraph, i) => (
                    <p key={i} className="text-[15px] leading-7 text-foreground/90"><RichText text={paragraph} /></p>
                  ))}
                </div>
              </div>
            )}

            {report.client_profile && (
              <div id="profilo" ref={setChapterRef("profilo")} className="print:break-before-page">
                <ChapterHeader number="01" title="Profilo Cliente" icon={User} />
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {report.client_profile.business_type && <InfoField label="Tipo Attività" value={report.client_profile.business_type} />}
                  {report.client_profile.sector && <InfoField label="Settore" value={report.client_profile.sector} />}
                  {report.client_profile.niche && <InfoField label="Nicchia" value={report.client_profile.niche} />}
                  {report.client_profile.scale && <InfoField label="Scala" value={report.client_profile.scale} />}
                  {report.client_profile.team_size && <InfoField label="Team" value={report.client_profile.team_size} />}
                  {report.client_profile.digital_maturity && <InfoField label="Maturità Digitale" value={report.client_profile.digital_maturity} />}
                  {report.client_profile.sales_method && <InfoField label="Metodo Vendita" value={report.client_profile.sales_method} />}
                  {report.client_profile.budget && <InfoField label="Budget" value={report.client_profile.budget} />}
                  {report.client_profile.website && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Sito Web</p>
                      <a href={report.client_profile.website} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" />{report.client_profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  {report.client_profile.city && (
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">Città</p>
                      <p className="text-sm font-medium text-foreground flex items-center gap-1"><MapPin className="w-3 h-3 text-muted-foreground" />{report.client_profile.city}</p>
                    </div>
                  )}
                </div>
                {report.client_profile.communication_channels && report.client_profile.communication_channels.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 self-center">Canali:</span>
                    {report.client_profile.communication_channels.map((ch, i) => (
                      <Badge key={i} variant="outline" className="text-[10px]">{ch}</Badge>
                    ))}
                  </div>
                )}
                {report.client_profile.main_pain_point && (
                  <div className="mt-5 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Pain Point Principale</p>
                    <p className="text-sm text-amber-800 dark:text-amber-200">{report.client_profile.main_pain_point}</p>
                  </div>
                )}
                {report.client_profile.goals && report.client_profile.goals.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {report.client_profile.goals.map((goal, i) => (
                      <Badge key={i} variant="secondary" className="text-xs"><Target className="w-3 h-3 mr-1" />{goal}</Badge>
                    ))}
                  </div>
                )}
              </div>
            )}

            {report.diagnosis && (
              <div id="diagnosi" ref={setChapterRef("diagnosi")} className="print:break-before-page">
                <ChapterHeader number="02" title="La Diagnosi" icon={Stethoscope} />
                <div className="mt-6 space-y-6">
                  <div className="grid md:grid-cols-2 gap-5">
                    {report.diagnosis.current_state && (
                      <div className="p-5 rounded-xl bg-red-50/60 dark:bg-red-900/10 border border-red-200/60 dark:border-red-800/30">
                        <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-3">Dove Sei Ora</p>
                        <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">{report.diagnosis.current_state}</p>
                      </div>
                    )}
                    {report.diagnosis.desired_state && (
                      <div className="p-5 rounded-xl bg-emerald-50/60 dark:bg-emerald-900/10 border border-emerald-200/60 dark:border-emerald-800/30">
                        <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-3">Dove Vuoi Arrivare</p>
                        <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">{report.diagnosis.desired_state}</p>
                      </div>
                    )}
                  </div>
                  {report.diagnosis.gap_analysis && (
                    <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-border/60">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Analisi Gap</p>
                      <p className="text-sm text-foreground leading-relaxed">{report.diagnosis.gap_analysis}</p>
                    </div>
                  )}
                  {report.diagnosis.key_challenges && report.diagnosis.key_challenges.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sfide Principali</p>
                      {report.diagnosis.key_challenges.map((ch, i) => (
                        <div key={i} className="flex items-start gap-2.5 text-sm">
                          <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                          <span className="text-foreground leading-relaxed">{ch}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {report.diagnosis.diagnostic_table && report.diagnosis.diagnostic_table.length > 0 && (
                    <div className="print:break-inside-avoid">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Diagnosi per Area</p>
                      <div className="border border-border/60 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-slate-50 dark:bg-slate-800/80">
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Area</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stato Attuale</th>
                              <th className="text-center px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Impatto</th>
                              <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider hidden md:table-cell">Nota</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.diagnosis.diagnostic_table.map((row, i) => {
                              const imp = IMPATTO_COLORS[row.impatto] || IMPATTO_COLORS.medio;
                              return (
                                <tr key={i} className="border-t border-border/40">
                                  <td className="px-4 py-3 font-medium text-foreground">{row.area}</td>
                                  <td className="px-4 py-3 text-foreground/80">{row.stato}</td>
                                  <td className="px-4 py-3 text-center">
                                    <Badge variant="outline" className={cn("text-[10px] capitalize", imp.text, imp.border, imp.bg)}>
                                      {row.impatto}
                                    </Badge>
                                  </td>
                                  <td className="px-4 py-3 text-muted-foreground text-xs hidden md:table-cell">{row.nota}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {report.diagnosis.key_insight && (
                    <InsightBox text={report.diagnosis.key_insight} />
                  )}
                </div>
              </div>
            )}

            {report.recommended_packages && report.recommended_packages.length > 0 && (
              report.recommended_packages.map((pkg, i) => (
                <div key={i} id={`pkg-${i}`} ref={setChapterRef(`pkg-${i}`)} className="print:break-before-page">
                  <ChapterHeader
                    number={String(i + 3).padStart(2, '0')}
                    title={pkg.package_name}
                    subtitle={pkg.subtitle}
                    icon={Package}
                    score={pkg.score}
                    scoreLabel={pkg.score_label}
                    priority={pkg.priority}
                  />
                  <div className="mt-6 space-y-6">
                    {pkg.reason && (
                      <div className="p-5 rounded-xl bg-gradient-to-br from-slate-50 to-indigo-50/30 dark:from-slate-800/40 dark:to-indigo-900/10 border border-slate-200/80 dark:border-slate-700/50 print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-1 h-6 rounded-full bg-indigo-500" />
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Perché per te</p>
                        </div>
                        <div className="space-y-3">
                          {pkg.reason.split('\n\n').map((p, j) => (
                            <p key={j} className="text-[15px] leading-7 text-foreground/90">
                              <RichText text={p} />
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.whats_good && (
                      <div className="p-5 rounded-xl bg-emerald-50/80 dark:bg-emerald-900/10 border border-emerald-200/80 dark:border-emerald-800/30 shadow-sm print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <p className="text-xs font-bold text-emerald-700 dark:text-emerald-400 uppercase tracking-wider">Cosa Hai Fatto Bene</p>
                        </div>
                        <div className="space-y-3 pl-1">
                          {pkg.whats_good.split('\n\n').map((p, j) => (
                            <p key={j} className="text-sm text-emerald-900 dark:text-emerald-200 leading-relaxed">
                              <RichText text={p} />
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.whats_wrong && (
                      <div className="p-5 rounded-xl bg-amber-50/80 dark:bg-amber-900/10 border border-amber-200/80 dark:border-amber-800/30 shadow-sm print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-3">
                          <div className="w-7 h-7 rounded-lg bg-amber-500/10 dark:bg-amber-500/20 flex items-center justify-center">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <p className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Cosa Non Funziona</p>
                        </div>
                        <div className="space-y-3 pl-1">
                          {pkg.whats_wrong.split('\n\n').map((p, j) => (
                            <p key={j} className="text-sm text-amber-900 dark:text-amber-200 leading-relaxed">
                              <RichText text={p} />
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.how_to_fix && pkg.how_to_fix.length > 0 && (
                      <div className="print:break-inside-avoid">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center">
                            <Lightbulb className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                          </div>
                          <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider">Come Correggere — Azioni Concrete</p>
                        </div>
                        <div className="space-y-2.5">
                          {pkg.how_to_fix.map((action, j) => (
                            <div key={j} className="flex items-start gap-3 p-4 rounded-xl bg-white dark:bg-slate-800/60 border border-indigo-100 dark:border-indigo-800/30 shadow-sm hover:shadow-md transition-shadow">
                              <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[10px] font-bold text-white">{j + 1}</span>
                              </div>
                              <p className="text-sm text-foreground leading-relaxed flex-1">
                                <RichText text={action.replace(/^→\s*/, '')} />
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.critical_diagnosis && (
                      <InsightBox text={pkg.critical_diagnosis} variant="critical" />
                    )}

                    {pkg.modules && pkg.modules.length > 0 && (
                      <div className="print:break-inside-avoid">
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                              <Layers className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                            </div>
                            <p className="text-xs font-bold text-foreground uppercase tracking-wider">
                              Moduli Inclusi
                            </p>
                          </div>
                          <Badge variant="outline" className="text-[10px] font-semibold">{pkg.modules.length} moduli</Badge>
                        </div>
                        <div className="space-y-2">
                          {pkg.modules.map((mod, j) => {
                            const cl = COMPLEXITY_BARS[mod.complexity] || 1;
                            const complexityLabel = cl === 1 ? "Semplice" : cl === 2 ? "Medio" : "Avanzato";
                            const complexityColor = cl === 1 ? "text-emerald-600 dark:text-emerald-400" : cl === 2 ? "text-amber-600 dark:text-amber-400" : "text-red-600 dark:text-red-400";
                            return (
                              <div key={j} className="flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-800/50 border border-border/60 shadow-sm">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500/10 to-violet-500/10 dark:from-indigo-500/20 dark:to-violet-500/20 flex items-center justify-center flex-shrink-0">
                                    <CheckCircle2 className="w-4 h-4 text-indigo-500" />
                                  </div>
                                  <span className="text-sm font-semibold text-foreground truncate">{mod.name}</span>
                                </div>
                                <div className="flex items-center gap-3 flex-shrink-0">
                                  <div className="flex items-center gap-1.5">
                                    <div className="flex gap-0.5">
                                      {[1, 2, 3].map((level) => (
                                        <div key={level} className={cn("w-3 h-1.5 rounded-full", level <= cl ? "bg-current opacity-70" : "bg-slate-200 dark:bg-slate-700")}
                                          style={{ color: cl === 1 ? "#22c55e" : cl === 2 ? "#f59e0b" : "#ef4444" }}
                                        />
                                      ))}
                                    </div>
                                    <span className={cn("text-[10px] font-medium", complexityColor)}>{complexityLabel}</span>
                                  </div>
                                  {mod.setup_time && (
                                    <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                                      <Clock className="w-2.5 h-2.5" />{mod.setup_time}
                                    </span>
                                  )}
                                  {mod.config_link && (
                                    <a href={mod.config_link} onClick={(e) => e.stopPropagation()} className="text-[10px] text-indigo-500 hover:text-indigo-700 hover:underline flex items-center gap-0.5">
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {(pkg.timeline || pkg.connection) && (
                      <div className="flex flex-wrap gap-3 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/30 border border-border/40">
                        {pkg.timeline && (
                          <div className="flex items-center gap-2 text-sm">
                            <Clock className="w-4 h-4 text-indigo-500" />
                            <span className="text-muted-foreground">Setup:</span>
                            <span className="font-semibold text-foreground">{pkg.timeline}</span>
                          </div>
                        )}
                        {pkg.timeline && pkg.connection && <div className="w-px h-5 bg-border/60 self-center" />}
                        {pkg.connection && (
                          <div className="flex items-center gap-2 text-sm">
                            <ArrowRight className="w-4 h-4 text-violet-500" />
                            <span className="font-medium text-foreground">{pkg.connection}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {report.roadmap && (
              <div id="roadmap" ref={setChapterRef("roadmap")} className="print:break-before-page">
                <ChapterHeader number={String((report.recommended_packages?.length || 0) + 3).padStart(2, '0')} title="Roadmap Operativa" subtitle="Piano settimana per settimana" icon={Calendar} />
                <div className="mt-6">
                  {(report.roadmap.week1 as RoadmapWeek)?.azioni_prioritarie ? (
                    <div className="space-y-5">
                      {[report.roadmap.week1 as RoadmapWeek, report.roadmap.week2, report.roadmap.week3, report.roadmap.week4].filter(Boolean).map((week, i) => (
                        week && (
                          <div key={i} className="p-5 rounded-xl border border-border/60 bg-card print:break-inside-avoid">
                            <div className="flex items-start justify-between mb-3">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">Settimana {i + 1}</h4>
                                <p className="text-xs text-muted-foreground">{week.titolo}</p>
                              </div>
                              {week.pacchetti_coinvolti && week.pacchetti_coinvolti.length > 0 && (
                                <div className="flex gap-1">
                                  {week.pacchetti_coinvolti.map((p, j) => (
                                    <Badge key={j} variant="outline" className="text-[9px]">{p}</Badge>
                                  ))}
                                </div>
                              )}
                            </div>
                            <div className="space-y-2 mb-3">
                              {week.azioni_prioritarie.map((azione, j) => (
                                <div key={j} className="flex items-start gap-2 text-sm">
                                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-2 flex-shrink-0" />
                                  <span className="text-foreground/80 leading-relaxed">{azione}</span>
                                </div>
                              ))}
                            </div>
                            <div className="flex flex-wrap gap-4 text-xs pt-2 border-t border-border/40">
                              <div><span className="font-semibold text-muted-foreground">Obiettivo:</span> <span className="text-foreground">{week.obiettivo}</span></div>
                              {week.kpi_target && <div><span className="font-semibold text-muted-foreground">KPI:</span> <span className="text-foreground">{week.kpi_target}</span></div>}
                            </div>
                          </div>
                        )
                      ))}
                    </div>
                  ) : (
                    <div className="grid md:grid-cols-3 gap-4">
                      {report.roadmap.week1 && Array.isArray(report.roadmap.week1) && (
                        <LegacyRoadmapColumn title="Settimana 1" subtitle="Fondamenta" items={report.roadmap.week1} color="emerald" />
                      )}
                      {report.roadmap.weeks2_4 && Array.isArray(report.roadmap.weeks2_4) && (
                        <LegacyRoadmapColumn title="Settimane 2-4" subtitle="Sviluppo" items={report.roadmap.weeks2_4} color="blue" />
                      )}
                      {report.roadmap.month2_plus && Array.isArray(report.roadmap.month2_plus) && (
                        <LegacyRoadmapColumn title="Mese 2+" subtitle="Espansione" items={report.roadmap.month2_plus} color="violet" />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {report.quick_wins && report.quick_wins.length > 0 && (
              <div id="quickwins" ref={setChapterRef("quickwins")} className="print:break-before-page">
                <ChapterHeader number={String((report.recommended_packages?.length || 0) + 4).padStart(2, '0')} title="Quick Wins" subtitle="Azioni rapide ad alto impatto" icon={Zap} />
                <div className="mt-6 space-y-4">
                  {report.quick_wins.map((qw, i) => (
                    <div key={i} className="p-5 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30 print:break-inside-avoid">
                      <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">{i + 1}</div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className="font-semibold text-sm text-foreground">{qw.title}</h4>
                            {qw.estimated_time && <Badge variant="outline" className="text-[10px]"><Clock className="w-2.5 h-2.5 mr-1" />{qw.estimated_time}</Badge>}
                          </div>
                          <ol className="space-y-1 mt-2">
                            {qw.steps.map((step, j) => (
                              <li key={j} className="text-xs text-foreground/80 flex items-start gap-2">
                                <span className="text-emerald-500 font-semibold mt-0.5">{j + 1}.</span>{step}
                              </li>
                            ))}
                          </ol>
                          {qw.link && (
                            <a href={qw.link} className="text-xs text-indigo-500 hover:underline mt-2 inline-flex items-center gap-1">
                              Vai alla configurazione <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.success_metrics && report.success_metrics.length > 0 && (
              <div id="metriche" ref={setChapterRef("metriche")} className="print:break-before-page">
                <ChapterHeader number={String((report.recommended_packages?.length || 0) + 5).padStart(2, '0')} title="Metriche di Successo" icon={BarChart3} />
                <div className="mt-6 grid md:grid-cols-2 gap-4">
                  {report.success_metrics.map((metric, i) => (
                    <div key={i} className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/50 dark:border-indigo-800/30 print:break-inside-avoid">
                      <div className="flex items-start gap-3">
                        <TrendingUp className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-sm text-foreground">{metric.kpi}</h4>
                          <div className="mt-2 space-y-1">
                            <div className="flex items-center gap-2 text-xs"><Target className="w-3 h-3 text-emerald-500" /><span className="text-muted-foreground">Target:</span><span className="font-medium text-foreground">{metric.target}</span></div>
                            <div className="flex items-center gap-2 text-xs"><BarChart3 className="w-3 h-3 text-blue-500" /><span className="text-muted-foreground">Misura:</span><span className="text-foreground">{metric.measurement}</span></div>
                            <div className="flex items-center gap-2 text-xs"><Clock className="w-3 h-3 text-amber-500" /><span className="text-muted-foreground">Periodo:</span><span className="text-foreground">{metric.timeframe}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.priority_actions && report.priority_actions.length > 0 && (
              <div id="azioni" ref={setChapterRef("azioni")} className="print:break-before-page">
                <ChapterHeader
                  number={String((report.recommended_packages?.length || 0) + 6).padStart(2, '0')}
                  title="Le Azioni di Questa Settimana"
                  subtitle="Quello che fai nei prossimi 5 giorni decide il risultato"
                  icon={Lightbulb}
                />
                <div className="mt-6 space-y-6">
                  {report.priority_actions.map((action, i) => (
                    <div key={i} className="p-6 rounded-xl border-2 border-indigo-200 dark:border-indigo-800/50 bg-indigo-50/30 dark:bg-indigo-900/10 print:break-inside-avoid">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-xl">
                          {i + 1}
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-base text-foreground mb-2">{action.titolo}</h4>
                          <p className="text-sm text-foreground/80 leading-relaxed mb-3"><RichText text={action.descrizione} /></p>
                          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {action.tempo}</span>
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" /> {action.impatto}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {report.closing_message && (
              <div id="chiusura" ref={setChapterRef("chiusura")} className="print:break-before-page">
                <div className="py-8 border-t border-border/40">
                  <div className="max-w-2xl mx-auto text-center">
                    <div className="space-y-4">
                      {report.closing_message.split('\n\n').map((p, i) => (
                        <p key={i} className="text-[15px] leading-7 text-foreground/80 italic"><RichText text={p} /></p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-center py-6 border-t border-border/40 text-xs text-muted-foreground print:fixed print:bottom-0 print:left-0 print:right-0 print:py-4">
              Documento riservato — uso esclusivo del destinatario
            </div>

            <div className="h-8 print:hidden" />
          </div>
        </ScrollArea>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-12 { padding-left: 3rem !important; padding-right: 3rem !important; }
          .print\\:py-0 { padding-top: 0 !important; padding-bottom: 0 !important; }
          .print\\:py-16 { padding-top: 4rem !important; padding-bottom: 4rem !important; }
          .print\\:text-4xl { font-size: 2.25rem !important; }
          .print\\:text-3xl { font-size: 1.875rem !important; }
          .print\\:break-before-page { break-before: page !important; }
          .print\\:break-after-page { break-after: page !important; }
          .print\\:break-inside-avoid { break-inside: avoid !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 2cm 2.5cm; }
        }
      `}</style>
    </div>
  );
}

function ChapterHeader({
  number,
  title,
  subtitle,
  icon: Icon,
  score,
  scoreLabel,
  priority,
}: {
  number?: string;
  title: string;
  subtitle?: string;
  icon: any;
  score?: number;
  scoreLabel?: string;
  priority?: string;
}) {
  const scoreColor = score !== undefined
    ? score >= 7 ? "text-emerald-600 border-emerald-400" : score >= 4 ? "text-amber-600 border-amber-400" : "text-red-600 border-red-400"
    : "";

  const priorityColors: Record<string, string> = {
    fondamenta: "bg-emerald-100 text-emerald-700 border-emerald-300",
    core: "bg-blue-100 text-blue-700 border-blue-300",
    avanzato: "bg-violet-100 text-violet-700 border-violet-300",
  };

  return (
    <div className="flex items-start gap-4 pb-4 border-b-2 border-border/40">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {number && (
          <span className="text-3xl font-extralight text-muted-foreground/40 tracking-tighter leading-none">{number}</span>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold text-foreground tracking-tight">{title}</h2>
            {priority && priorityColors[priority] && (
              <Badge variant="outline" className={cn("text-[10px] capitalize", priorityColors[priority])}>{priority}</Badge>
            )}
          </div>
          {subtitle && <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>}
          {scoreLabel && <p className="text-[10px] text-muted-foreground mt-0.5">{scoreLabel}</p>}
        </div>
      </div>
      {score !== undefined && (
        <div className={cn("w-14 h-14 rounded-full border-[3px] flex items-center justify-center flex-shrink-0", scoreColor)}>
          <div className="text-center">
            <span className="text-lg font-bold leading-none">{score}</span>
            <span className="text-[8px] text-muted-foreground block">/10</span>
          </div>
        </div>
      )}
    </div>
  );
}

function InsightBox({ text, variant = "insight" }: { text: string; variant?: "insight" | "critical" }) {
  const isC = variant === "critical";
  return (
    <div className={cn(
      "p-5 rounded-xl border-l-4 print:break-inside-avoid",
      isC ? "bg-red-50/60 dark:bg-red-900/10 border-red-500 dark:border-red-600" : "bg-amber-50/60 dark:bg-amber-900/10 border-amber-500 dark:border-amber-600"
    )}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn("w-5 h-5 flex-shrink-0 mt-0.5", isC ? "text-red-500" : "text-amber-500")} />
        <div>
          <p className={cn("text-xs font-bold uppercase tracking-wider mb-1.5", isC ? "text-red-700 dark:text-red-400" : "text-amber-700 dark:text-amber-400")}>
            {isC ? "Diagnosi Critica" : "Insight Chiave"}
          </p>
          <p className={cn("text-sm leading-relaxed", isC ? "text-red-800 dark:text-red-200" : "text-amber-800 dark:text-amber-200")}><RichText text={text} /></p>
        </div>
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function LegacyRoadmapColumn({
  title,
  subtitle,
  items,
  color,
}: {
  title: string;
  subtitle: string;
  items: Array<{ module: string; action: string; packages?: string[] }>;
  color: "emerald" | "blue" | "violet";
}) {
  const colorMap = {
    emerald: { bg: "bg-emerald-50/50 dark:bg-emerald-900/10", border: "border-emerald-200/50 dark:border-emerald-800/30", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
    blue: { bg: "bg-blue-50/50 dark:bg-blue-900/10", border: "border-blue-200/50 dark:border-blue-800/30", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-400" },
    violet: { bg: "bg-violet-50/50 dark:bg-violet-900/10", border: "border-violet-200/50 dark:border-violet-800/30", dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-400" },
  };
  const c = colorMap[color];
  return (
    <div className={cn("p-4 rounded-xl border", c.border, c.bg)}>
      <div className="mb-3">
        <h4 className={cn("font-semibold text-sm", c.text)}>{title}</h4>
        <p className="text-[10px] text-muted-foreground">{subtitle}</p>
      </div>
      <div className="space-y-2.5">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2">
            <div className={cn("w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0", c.dot)} />
            <div>
              <p className="text-xs font-medium text-foreground">{item.module}</p>
              <p className="text-[10px] text-muted-foreground">{item.action}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
