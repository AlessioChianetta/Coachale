import { useState, useEffect } from "react";
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
}

interface RecommendedModule {
  name: string;
  priority: "fondamenta" | "core" | "avanzato";
  complexity: "bassa" | "media" | "alta";
  reason: string;
  config_link?: string;
}

interface ReportData {
  client_profile?: {
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
  };
  diagnosis?: {
    current_state?: string;
    desired_state?: string;
    gap_analysis?: string;
    key_challenges?: string[];
  };
  recommended_packages?: RecommendedPackage[];
  recommended_modules?: RecommendedModule[];
  roadmap?: {
    week1?: any;
    weeks2_4?: any;
    month2_plus?: any;
  };
  quick_wins?: Array<{
    title: string;
    steps: string[];
    estimated_time: string;
    link?: string;
  }>;
  success_metrics?: Array<{
    kpi: string;
    target: string;
    measurement: string;
    timeframe: string;
  }>;
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

  if (p) {
    result.client_profile = {
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
    };
  }

  if (d) {
    result.diagnosis = {
      current_state: d.dove_sei_ora || d.current_state,
      desired_state: d.dove_vuoi_arrivare || d.desired_state,
      gap_analysis: d.gap_analysis || d.analisi_gap,
      key_challenges: d.sfide_principali || d.key_challenges || [],
    };
  }

  if (pkg && Array.isArray(pkg) && pkg.length > 0) {
    result.recommended_packages = pkg.map((pk: any) => ({
      package_name: pk.nome_pacchetto || pk.package_name,
      subtitle: pk.sottotitolo || pk.subtitle || '',
      priority: pk.priorita || pk.priority || 'core',
      reason: pk.perche_per_te || pk.reason || '',
      modules: (pk.moduli_inclusi || pk.modules || []).map((mod: any) => ({
        name: mod.nome || mod.name,
        complexity: mod.complessita_setup || mod.complexity || 'media',
        setup_time: mod.tempo_setup || mod.setup_time || '',
        config_link: mod.config_link,
      })),
      timeline: pk.timeline_setup || pk.timeline || '',
      connection: pk.connessione_altri_pacchetti || pk.connection || '',
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
    const mapPhase = (phase: any) => {
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
      week1: mapPhase(r.settimana_1 || r.week1),
      weeks2_4: mapPhase(r.settimane_2_4 || r.weeks2_4),
      month2_plus: mapPhase(r.mese_2_plus || r.month2_plus),
    };
  }

  if (q && Array.isArray(q)) {
    result.quick_wins = q.map((qw: any) => ({
      title: qw.titolo || qw.title,
      steps: qw.passi || qw.steps || [],
      estimated_time: qw.tempo_stimato || qw.estimated_time || '',
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

const SECTION_ICONS_PACKAGES = [
  { icon: User, label: "Profilo Cliente", gradient: "from-blue-500 to-cyan-600" },
  { icon: Stethoscope, label: "La Diagnosi", gradient: "from-rose-500 to-pink-600" },
  { icon: Package, label: "Pacchetti Consigliati", gradient: "from-violet-500 to-purple-600" },
  { icon: Calendar, label: "Roadmap", gradient: "from-amber-500 to-orange-600" },
  { icon: Zap, label: "Quick Wins", gradient: "from-emerald-500 to-teal-600" },
  { icon: BarChart3, label: "Metriche di Successo", gradient: "from-indigo-500 to-blue-600" },
];

const SECTION_ICONS_MODULES = [
  { icon: User, label: "Profilo Cliente", gradient: "from-blue-500 to-cyan-600" },
  { icon: Stethoscope, label: "La Diagnosi", gradient: "from-rose-500 to-pink-600" },
  { icon: Layers, label: "Moduli Consigliati", gradient: "from-violet-500 to-purple-600" },
  { icon: Calendar, label: "Roadmap", gradient: "from-amber-500 to-orange-600" },
  { icon: Zap, label: "Quick Wins", gradient: "from-emerald-500 to-teal-600" },
  { icon: BarChart3, label: "Metriche di Successo", gradient: "from-indigo-500 to-blue-600" },
];

const PRIORITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  fondamenta: {
    bg: "bg-emerald-50 dark:bg-emerald-900/20",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-800",
  },
  core: {
    bg: "bg-blue-50 dark:bg-blue-900/20",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-800",
  },
  avanzato: {
    bg: "bg-violet-50 dark:bg-violet-900/20",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-800",
  },
};

const COMPLEXITY_BARS: Record<string, number> = {
  bassa: 1,
  media: 2,
  alta: 3,
};

export function DeliveryReport({ sessionId, onBackToChat }: DeliveryReportProps) {
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const usePackages = !!(report?.recommended_packages && report.recommended_packages.length > 0);
  const SECTION_ICONS = usePackages ? SECTION_ICONS_PACKAGES : SECTION_ICONS_MODULES;

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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiato", description: "Link alla sessione copiato negli appunti" });
    } catch {
      toast({ title: "Errore", description: "Impossibile copiare il link", variant: "destructive" });
    }
  };

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

  return (
    <ScrollArea className="h-full">
      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6 print:max-w-none print:px-8">
        <div className="flex items-center justify-between mb-6 print:hidden">
          <Button variant="ghost" onClick={onBackToChat} className="gap-2">
            <ArrowLeft className="w-4 h-4" />
            Torna alla Chat
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleShare} className="gap-2">
              <Share2 className="w-4 h-4" />
              Condividi
            </Button>
            <Button
              size="sm"
              onClick={handlePrint}
              className="gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white"
            >
              <Download className="w-4 h-4" />
              Scarica PDF
            </Button>
          </div>
        </div>

        {report.client_profile && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <SectionCard index={0} icons={SECTION_ICONS}>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {report.client_profile.business_type && (
                  <InfoField label="Tipo Attività" value={report.client_profile.business_type} />
                )}
                {report.client_profile.sector && (
                  <InfoField label="Settore" value={report.client_profile.sector} />
                )}
                {report.client_profile.niche && (
                  <InfoField label="Nicchia" value={report.client_profile.niche} />
                )}
                {report.client_profile.scale && (
                  <InfoField label="Scala" value={report.client_profile.scale} />
                )}
                {report.client_profile.team_size && (
                  <InfoField label="Team" value={report.client_profile.team_size} />
                )}
                {report.client_profile.digital_maturity && (
                  <InfoField label="Maturità Digitale" value={report.client_profile.digital_maturity} />
                )}
                {report.client_profile.sales_method && (
                  <InfoField label="Metodo Vendita" value={report.client_profile.sales_method} />
                )}
                {report.client_profile.budget && (
                  <InfoField label="Budget" value={report.client_profile.budget} />
                )}
              </div>
              {report.client_profile.communication_channels && report.client_profile.communication_channels.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mr-1 self-center">Canali:</span>
                  {report.client_profile.communication_channels.map((ch, i) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {ch}
                    </Badge>
                  ))}
                </div>
              )}
              {report.client_profile.main_pain_point && (
                <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">
                    Pain Point Principale
                  </p>
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {report.client_profile.main_pain_point}
                  </p>
                </div>
              )}
              {report.client_profile.goals && report.client_profile.goals.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {report.client_profile.goals.map((goal, i) => (
                    <Badge key={i} variant="secondary" className="text-xs">
                      <Target className="w-3 h-3 mr-1" />
                      {goal}
                    </Badge>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {report.diagnosis && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <SectionCard index={1} icons={SECTION_ICONS}>
              <div className="grid md:grid-cols-2 gap-4">
                {report.diagnosis.current_state && (
                  <div className="p-4 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/50 dark:border-red-800/30">
                    <p className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wider mb-2">
                      Dove Sei Ora
                    </p>
                    <p className="text-sm text-red-800 dark:text-red-200 leading-relaxed">
                      {report.diagnosis.current_state}
                    </p>
                  </div>
                )}
                {report.diagnosis.desired_state && (
                  <div className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30">
                    <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2">
                      Dove Vuoi Arrivare
                    </p>
                    <p className="text-sm text-emerald-800 dark:text-emerald-200 leading-relaxed">
                      {report.diagnosis.desired_state}
                    </p>
                  </div>
                )}
              </div>
              {report.diagnosis.gap_analysis && (
                <div className="mt-4 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border/60">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                    Analisi Gap
                  </p>
                  <p className="text-sm text-foreground leading-relaxed">
                    {report.diagnosis.gap_analysis}
                  </p>
                </div>
              )}
              {report.diagnosis.key_challenges && report.diagnosis.key_challenges.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {report.diagnosis.key_challenges.map((ch, i) => (
                    <div key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-red-500 mt-0.5">!</span>
                      <span className="text-foreground">{ch}</span>
                    </div>
                  ))}
                </div>
              )}
            </SectionCard>
          </motion.div>
        )}

        {report.recommended_packages && report.recommended_packages.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionCard index={2} icons={SECTION_ICONS}>
              <div className="space-y-4">
                {report.recommended_packages.map((pkg, i) => (
                  <PackageCard key={i} pkg={pkg} index={i} />
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {!report.recommended_packages && report.recommended_modules && report.recommended_modules.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <SectionCard index={2} icons={SECTION_ICONS}>
              <div className="grid md:grid-cols-2 gap-3">
                {report.recommended_modules.map((mod, i) => {
                  const prio = PRIORITY_COLORS[mod.priority] || PRIORITY_COLORS.core;
                  const complexityLevel = COMPLEXITY_BARS[mod.complexity] || 1;
                  return (
                    <div
                      key={i}
                      className={cn(
                        "p-4 rounded-xl border",
                        prio.border,
                        prio.bg
                      )}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <h4 className={cn("font-semibold text-sm", prio.text)}>
                          {mod.name}
                        </h4>
                        <Badge
                          variant="outline"
                          className={cn("text-[10px] capitalize", prio.text, prio.border)}
                        >
                          {mod.priority}
                        </Badge>
                      </div>
                      <p className="text-xs text-foreground/80 mb-3 leading-relaxed">
                        {mod.reason}
                      </p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">Complessità:</span>
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((level) => (
                              <div
                                key={level}
                                className={cn(
                                  "w-3 h-1.5 rounded-full",
                                  level <= complexityLevel
                                    ? "bg-current opacity-60"
                                    : "bg-slate-200 dark:bg-slate-700"
                                )}
                                style={{
                                  color:
                                    complexityLevel === 1
                                      ? "#22c55e"
                                      : complexityLevel === 2
                                      ? "#f59e0b"
                                      : "#ef4444",
                                }}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground capitalize">
                            {mod.complexity}
                          </span>
                        </div>
                        {mod.config_link && (
                          <a
                            href={mod.config_link}
                            className="text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5"
                          >
                            Configura <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {report.roadmap && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <SectionCard index={3} icons={SECTION_ICONS}>
              <div className="grid md:grid-cols-3 gap-4">
                {report.roadmap.week1 && report.roadmap.week1.length > 0 && (
                  <RoadmapColumn
                    title="Settimana 1"
                    subtitle="Fondamenta"
                    items={report.roadmap.week1}
                    color="emerald"
                  />
                )}
                {report.roadmap.weeks2_4 && report.roadmap.weeks2_4.length > 0 && (
                  <RoadmapColumn
                    title="Settimane 2-4"
                    subtitle="Sviluppo"
                    items={report.roadmap.weeks2_4}
                    color="blue"
                  />
                )}
                {report.roadmap.month2_plus && report.roadmap.month2_plus.length > 0 && (
                  <RoadmapColumn
                    title="Mese 2+"
                    subtitle="Espansione"
                    items={report.roadmap.month2_plus}
                    color="violet"
                  />
                )}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {report.quick_wins && report.quick_wins.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <SectionCard index={4} icons={SECTION_ICONS}>
              <div className="space-y-3">
                {report.quick_wins.map((qw, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-800/30"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center flex-shrink-0 text-white font-bold text-sm">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="font-semibold text-sm text-foreground">
                            {qw.title}
                          </h4>
                          {qw.estimated_time && (
                            <Badge variant="outline" className="text-[10px]">
                              <Clock className="w-2.5 h-2.5 mr-1" />
                              {qw.estimated_time}
                            </Badge>
                          )}
                        </div>
                        <ol className="space-y-1 mt-2">
                          {qw.steps.map((step, j) => (
                            <li
                              key={j}
                              className="text-xs text-foreground/80 flex items-start gap-2"
                            >
                              <span className="text-emerald-500 font-semibold mt-0.5">
                                {j + 1}.
                              </span>
                              {step}
                            </li>
                          ))}
                        </ol>
                        {qw.link && (
                          <a
                            href={qw.link}
                            className="text-xs text-indigo-500 hover:underline mt-2 inline-flex items-center gap-1"
                          >
                            Vai alla configurazione{" "}
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}

        {report.success_metrics && report.success_metrics.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
          >
            <SectionCard index={5} icons={SECTION_ICONS}>
              <div className="grid md:grid-cols-2 gap-3">
                {report.success_metrics.map((metric, i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/50 dark:border-indigo-800/30"
                  >
                    <div className="flex items-start gap-3">
                      <TrendingUp className="w-5 h-5 text-indigo-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <h4 className="font-semibold text-sm text-foreground">
                          {metric.kpi}
                        </h4>
                        <div className="mt-2 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <Target className="w-3 h-3 text-emerald-500" />
                            <span className="text-muted-foreground">Target:</span>
                            <span className="font-medium text-foreground">
                              {metric.target}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <BarChart3 className="w-3 h-3 text-blue-500" />
                            <span className="text-muted-foreground">Misura:</span>
                            <span className="text-foreground">{metric.measurement}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <Clock className="w-3 h-3 text-amber-500" />
                            <span className="text-muted-foreground">Periodo:</span>
                            <span className="text-foreground">{metric.timeframe}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          </motion.div>
        )}

        <div className="h-8 print:hidden" />
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-8 { padding-left: 2rem !important; padding-right: 2rem !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>
    </ScrollArea>
  );
}

function PackageCard({ pkg, index }: { pkg: RecommendedPackage; index: number }) {
  const [expanded, setExpanded] = useState(index === 0);
  const prio = PRIORITY_COLORS[pkg.priority] || PRIORITY_COLORS.core;

  return (
    <div className={cn("rounded-xl border overflow-hidden transition-all", prio.border)}>
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "w-full p-4 flex items-center gap-3 text-left transition-colors",
          prio.bg,
          "hover:opacity-90"
        )}
      >
        <div className={cn(
          "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 text-white font-bold text-sm",
          pkg.priority === 'fondamenta' ? 'from-emerald-500 to-emerald-600' :
          pkg.priority === 'avanzato' ? 'from-violet-500 to-violet-600' :
          'from-blue-500 to-blue-600'
        )}>
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className={cn("font-bold text-sm", prio.text)}>
              {pkg.package_name}
            </h4>
            <Badge
              variant="outline"
              className={cn("text-[10px] capitalize flex-shrink-0", prio.text, prio.border)}
            >
              {pkg.priority}
            </Badge>
          </div>
          {pkg.subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5">{pkg.subtitle}</p>
          )}
        </div>
        {pkg.timeline && (
          <Badge variant="outline" className="text-[10px] flex-shrink-0 hidden sm:flex">
            <Clock className="w-2.5 h-2.5 mr-1" />
            {pkg.timeline}
          </Badge>
        )}
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        )}
      </button>

      {expanded && (
        <div className="p-4 border-t border-border/40 space-y-4 bg-card">
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">
              Perché per te
            </p>
            <p className="text-sm text-foreground leading-relaxed">
              {pkg.reason}
            </p>
          </div>

          {pkg.modules && pkg.modules.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                Moduli Inclusi ({pkg.modules.length})
              </p>
              <div className="space-y-2">
                {pkg.modules.map((mod, j) => {
                  const complexityLevel = COMPLEXITY_BARS[mod.complexity] || 1;
                  return (
                    <div
                      key={j}
                      className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-border/40"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                        <span className="text-sm font-medium text-foreground truncate">
                          {mod.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <div className="flex items-center gap-1">
                          <div className="flex gap-0.5">
                            {[1, 2, 3].map((level) => (
                              <div
                                key={level}
                                className={cn(
                                  "w-2.5 h-1 rounded-full",
                                  level <= complexityLevel
                                    ? "bg-current opacity-60"
                                    : "bg-slate-200 dark:bg-slate-700"
                                )}
                                style={{
                                  color:
                                    complexityLevel === 1
                                      ? "#22c55e"
                                      : complexityLevel === 2
                                      ? "#f59e0b"
                                      : "#ef4444",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                        {mod.setup_time && (
                          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                            {mod.setup_time}
                          </span>
                        )}
                        {mod.config_link && (
                          <a
                            href={mod.config_link}
                            onClick={(e) => e.stopPropagation()}
                            className="text-[10px] text-indigo-500 hover:underline flex items-center gap-0.5"
                          >
                            <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {pkg.connection && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-indigo-50/50 dark:bg-indigo-900/10 border border-indigo-200/50 dark:border-indigo-800/30">
              <ArrowRight className="w-4 h-4 text-indigo-500 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                {pkg.connection}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionCard({
  index,
  children,
  icons,
}: {
  index: number;
  children: React.ReactNode;
  icons: typeof SECTION_ICONS_PACKAGES;
}) {
  const section = icons[index];
  const Icon = section.icon;

  return (
    <div className="rounded-2xl border border-border/60 bg-card overflow-hidden shadow-sm">
      <div className={cn("h-1 bg-gradient-to-r", section.gradient)} />
      <div className="p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <div
            className={cn(
              "w-8 h-8 rounded-lg bg-gradient-to-br flex items-center justify-center",
              section.gradient
            )}
          >
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h3 className="font-bold text-foreground">{section.label}</h3>
        </div>
        {children}
      </div>
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-0.5">
        {label}
      </p>
      <p className="text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function RoadmapColumn({
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
    emerald: {
      bg: "bg-emerald-50/50 dark:bg-emerald-900/10",
      border: "border-emerald-200/50 dark:border-emerald-800/30",
      dot: "bg-emerald-500",
      text: "text-emerald-700 dark:text-emerald-400",
    },
    blue: {
      bg: "bg-blue-50/50 dark:bg-blue-900/10",
      border: "border-blue-200/50 dark:border-blue-800/30",
      dot: "bg-blue-500",
      text: "text-blue-700 dark:text-blue-400",
    },
    violet: {
      bg: "bg-violet-50/50 dark:bg-violet-900/10",
      border: "border-violet-200/50 dark:border-violet-800/30",
      dot: "bg-violet-500",
      text: "text-violet-700 dark:text-violet-400",
    },
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
