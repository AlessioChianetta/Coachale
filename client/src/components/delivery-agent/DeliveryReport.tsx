import { useState, useEffect, useRef, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

import {
  ArrowLeft, Download, Share2, User, Stethoscope, Package,
  Calendar, Zap, BarChart3, Loader2, CheckCircle2, Clock,
  Target, TrendingUp, ExternalLink, ChevronDown, ChevronUp,
  Layers, ArrowRight, AlertTriangle, Globe, MapPin, FileText,
  Lightbulb, BookOpen, Play, CheckSquare, AlertCircle, ArrowDown,
  RefreshCw, MessageSquare, Rocket,
} from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PackageModule {
  name: string;
  hook?: string;
  complexity: string;
  setup_time: string;
  config_link?: string;
  first_step?: string;
  success_signal?: string;
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
  honest_warning?: string;
}

interface DiagnosticTableRow {
  area: string;
  stato: string;
  impatto: "alto" | "medio" | "basso" | "urgente";
  nota: string;
}

interface ScorecardItem {
  area: string;
  voto: number;
  punti_forza: string[];
  criticita: string[];
  azione_prioritaria: string;
  consigli_pratici?: string[];
  esempi_concreti?: string[];
  cosa_fare_domani?: string;
}

interface TestiPronti {
  messaggio_whatsapp?: string | null;
  email_template?: string | null;
  script_chiamata?: string | null;
}

interface CampagnaAd {
  nome_campagna: string;
  formato: string;
  piattaforma: string;
  obiettivo_campagna: string;
  target_pubblico?: {
    eta?: string;
    genere?: string;
    interessi?: string[];
    comportamenti?: string;
    localita?: string;
  };
  headline: string;
  copy_completo: string;
  cta_button: string;
  budget_giornaliero: string;
  durata_test: string;
  brief_visivo: string;
  kpi_attesi: string;
}

interface RoadmapPhase {
  titolo: string;
  pacchetti_coinvolti: string[];
  azioni_prioritarie: string[];
  obiettivo: string;
  vita_dopo: string;
  kpi_target: string;
}

interface QuickWin {
  title: string;
  steps: string[];
  copy_paste?: string;
  estimated_time: string;
  impact: string;
  link?: string;
}

interface SuccessSignal {
  timeframe: string;
  where_to_look: string;
  what_to_find: string;
  what_it_means: string;
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
    gap_name?: string;
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
    scorecard?: ScorecardItem[];
    key_insight?: string;
  };
  recommended_packages?: RecommendedPackage[];
  roadmap?: {
    week1?: RoadmapPhase | any;
    week2?: RoadmapPhase;
    week3?: RoadmapPhase;
    week4?: RoadmapPhase;
    weeks2_4?: any;
    month2_plus?: any;
  };
  flow_description?: string;
  quick_wins?: QuickWin[];
  success_signals?: SuccessSignal[];
  success_metrics?: Array<{
    kpi: string;
    target: string;
    measurement: string;
    timeframe: string;
  }>;
  priority_actions?: Array<{
    titolo: string;
    descrizione: string;
    tempo: string;
    impatto: string;
    testi_pronti?: TestiPronti;
  }>;
  campagne_ads?: CampagnaAd[];
  honest_warning?: string;
  closing_message?: string;
}

// ─── Normalizer ───────────────────────────────────────────────────────────────

function normalizeReport(raw: any): ReportData {
  if (!raw) return {};
  const p = raw.profilo_cliente || raw.client_profile;
  const d = raw.diagnosi || raw.diagnosis;
  const pkg = raw.pacchetti_consigliati || raw.recommended_packages;
  const r = raw.roadmap;
  const q = raw.quick_wins;
  const s = raw.metriche_successo || raw.success_metrics;
  const ss = raw.segnali_successo || raw.success_signals;

  const result: ReportData = {};

  result.personal_letter = raw.lettera_personale || raw.personal_letter;
  result.closing_message = raw.chiusura_personale || raw.closing_message;
  result.flow_description = raw.flusso_completo || raw.flow_description;
  result.honest_warning = raw.avvertimento_onesto || raw.honest_warning;

  const pa = raw.azioni_questa_settimana || raw.priority_actions;
  if (pa && Array.isArray(pa)) {
    result.priority_actions = pa.map((a: any) => ({
      titolo: a.titolo || a.title || '',
      descrizione: a.descrizione || a.description || '',
      tempo: a.tempo || a.time || '',
      impatto: a.impatto || a.impact || '',
      testi_pronti: a.testi_pronti ? {
        messaggio_whatsapp: a.testi_pronti.messaggio_whatsapp || null,
        email_template: a.testi_pronti.email_template || null,
        script_chiamata: a.testi_pronti.script_chiamata || null,
      } : undefined,
    }));
  }

  const ads = raw.campagne_ads_pronte || raw.campagne_ads;
  if (ads && Array.isArray(ads)) {
    result.campagne_ads = ads.map((ad: any) => {
      const tp = ad.target_pubblico;
      const normalizedTarget = tp && typeof tp === 'object' ? {
        eta: tp.eta || tp.età || '',
        genere: tp.genere || '',
        interessi: Array.isArray(tp.interessi) ? tp.interessi : (typeof tp.interessi === 'string' ? [tp.interessi] : []),
        comportamenti: tp.comportamenti || '',
        localita: tp.localita || tp.località || '',
      } : undefined;
      return {
        nome_campagna: ad.nome_campagna || ad.nome || '',
        formato: ad.formato || '',
        piattaforma: ad.piattaforma || '',
        obiettivo_campagna: ad.obiettivo_campagna || ad.obiettivo || '',
        target_pubblico: normalizedTarget,
        headline: ad.headline || '',
        copy_completo: ad.copy_completo || ad.copy || '',
        cta_button: ad.cta_button || ad.cta || '',
        budget_giornaliero: ad.budget_giornaliero || ad.budget || '',
        durata_test: ad.durata_test || '',
        brief_visivo: ad.brief_visivo || '',
        kpi_attesi: ad.kpi_attesi || '',
      };
    });
  }

  if (p) {
    result.client_profile = {
      name: p.nome || p.name,
      business_type: p.tipo_business || p.business_type,
      sector: p.settore || p.sector,
      niche: p.nicchia || p.niche,
      years: p.anni_attivita || p.years,
      scale: p.scala_descrizione || p.scale || (p.scala ? `${p.scala.clienti_attivi || 0} clienti` : undefined),
      team_size: String(p.team_size || ''),
      main_pain_point: p.pain_point_badge || p.main_pain_point || p.pain_point_principale,
      gap_name: p.gap_principale || p.gap_name,
      goals: p.obiettivi_chiave || p.obiettivi_3_6_mesi || p.goals || [],
      digital_maturity: p.maturita_digitale || p.digital_maturity,
      current_tools: p.strumenti_attuali || p.current_tools || [],
      budget: p.budget,
      communication_channels: p.canali_comunicazione || p.communication_channels || [],
      sales_method: p.metodo_vendita || p.sales_method,
      has_training: p.ha_formazione ?? p.has_training,
      website: p.sito_web || p.website,
      city: p.citta || p.city,
    };
  }

  if (d) {
    result.diagnosis = {
      current_state: d.dove_sei_ora || d.current_state,
      desired_state: d.dove_vuoi_arrivare || d.desired_state,
      gap_analysis: d.gap_analysis || d.analisi_gap,
      key_challenges: d.sfide_principali || d.key_challenges || [],
      key_insight: d.insight_chiave || d.key_insight,
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
    const sc = d.scorecard;
    if (sc && Array.isArray(sc)) {
      result.diagnosis.scorecard = sc.map((item: any) => ({
        area: item.area || '',
        voto: typeof item.voto === 'number' ? item.voto : (typeof item.score === 'number' ? item.score : Number(item.voto || item.score) || 0),
        punti_forza: Array.isArray(item.punti_forza) ? item.punti_forza : (typeof item.punti_forza === 'string' ? [item.punti_forza] : []),
        criticita: Array.isArray(item.criticita) ? item.criticita : (typeof item.criticita === 'string' ? [item.criticita] : []),
        azione_prioritaria: item.azione_prioritaria || item.azione || '',
        consigli_pratici: Array.isArray(item.consigli_pratici) ? item.consigli_pratici : (typeof item.consigli_pratici === 'string' ? [item.consigli_pratici] : undefined),
        esempi_concreti: Array.isArray(item.esempi_concreti) ? item.esempi_concreti : (typeof item.esempi_concreti === 'string' ? [item.esempi_concreti] : undefined),
        cosa_fare_domani: item.cosa_fare_domani || undefined,
      }));
    }
  }

  if (pkg && Array.isArray(pkg) && pkg.length > 0) {
    result.recommended_packages = pkg.map((pk: any) => ({
      package_name: pk.nome_pacchetto || pk.package_name,
      subtitle: pk.sottotitolo || pk.subtitle || '',
      priority: pk.priorita || pk.priority || 'core',
      reason: pk.perche_per_te || pk.reason || '',
      modules: Array.isArray(pk.moduli_inclusi || pk.modules)
        ? (pk.moduli_inclusi || pk.modules).map((mod: any) => ({
            name: mod.nome || mod.name || '',
            hook: mod.hook || '',
            complexity: mod.complessita_setup || mod.complexity || 'media',
            setup_time: mod.tempo_setup || mod.setup_time || '',
            config_link: mod.config_link,
            first_step: mod.primo_passo || mod.first_step,
            success_signal: mod.come_misuri || mod.success_signal,
          }))
        : [],
      timeline: pk.timeline_setup || pk.timeline || '',
      connection: pk.connessione_altri_pacchetti || pk.connection || '',
      score: pk.punteggio || pk.score,
      score_label: pk.punteggio_label || pk.score_label,
      whats_good: pk.cosa_va_bene || pk.whats_good,
      whats_wrong: pk.cosa_non_funziona || pk.whats_wrong,
      how_to_fix: Array.isArray(pk.come_correggere || pk.how_to_fix) ? (pk.come_correggere || pk.how_to_fix) : undefined,
      critical_diagnosis: pk.diagnosi_critica || pk.critical_diagnosis,
      honest_warning: pk.cosa_non_fa || pk.honest_warning,
    }));
  }

  if (r) {
    const mapPhase = (w: any): RoadmapPhase | undefined => {
      if (!w) return undefined;
      if (Array.isArray(w)) return undefined;
      return {
        titolo: w.titolo || w.title || '',
        pacchetti_coinvolti: w.pacchetti_coinvolti || w.pacchetti || w.packages || [],
        azioni_prioritarie: w.azioni_prioritarie || w.cosa_fai || w.azioni || w.actions || [],
        obiettivo: w.obiettivo || w.objective || '',
        vita_dopo: w.vita_dopo || w.dopo_questa_fase || w.after || '',
        kpi_target: w.kpi_target || w.kpi || '',
      };
    };
    result.roadmap = {
      week1: mapPhase(r.settimana_1 || r.week1) || r.settimana_1 || r.week1,
      week2: mapPhase(r.settimana_2 || r.week2),
      week3: mapPhase(r.settimana_3 || r.week3),
      week4: mapPhase(r.settimana_4 || r.week4),
      weeks2_4: r.settimane_2_4 || r.weeks2_4,
      month2_plus: r.mese_2_plus || r.month2_plus,
    };
  }

  if (q && Array.isArray(q)) {
    result.quick_wins = q.map((qw: any) => ({
      title: qw.titolo || qw.title || '',
      steps: Array.isArray(qw.passi || qw.istruzioni || qw.steps) ? (qw.passi || qw.istruzioni || qw.steps) : [],
      copy_paste: qw.testo_da_copiare || qw.copy_paste,
      estimated_time: qw.tempo_stimato || qw.tempo || qw.estimated_time || '',
      impact: qw.cosa_cambia || qw.impatto || qw.impact || '',
      link: qw.link,
    }));
  }

  if (ss && Array.isArray(ss)) {
    result.success_signals = ss.map((sig: any) => ({
      timeframe: sig.timeframe || sig.periodo || '',
      where_to_look: sig.dove_guardare || sig.where_to_look || '',
      what_to_find: sig.cosa_cerchi || sig.what_to_find || '',
      what_it_means: sig.cosa_significa || sig.what_it_means || '',
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

// ─── Sub-components ───────────────────────────────────────────────────────────

function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  if (!text.includes('**')) return <span className={className}>{text}</span>;
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

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-4 my-2">
      <div className="flex-1 h-px bg-border/50" />
      <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/50">{label}</span>
      <div className="flex-1 h-px bg-border/50" />
    </div>
  );
}

function SectionTitle({ number, title, subtitle }: { number?: string; title: string; subtitle?: string }) {
  return (
    <div className="mb-5 sm:mb-8 pb-4 sm:pb-5 border-b border-border/40">
      <div className="flex items-baseline gap-2 sm:gap-3">
        {number && (
          <span className="text-2xl sm:text-4xl font-thin text-muted-foreground/20 leading-none tracking-tight select-none shrink-0">
            {number}
          </span>
        )}
        <div className="min-w-0">
          <h2 className="text-lg sm:text-[22px] font-bold text-foreground tracking-tight leading-tight">{title}</h2>
          {subtitle && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{subtitle}</p>}
        </div>
      </div>
    </div>
  );
}

function FieldRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 sm:py-2.5 border-b border-border/30 last:border-0">
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sm:w-28 flex-shrink-0 pt-0.5">{label}</span>
      <span className="text-sm text-foreground leading-relaxed">{value}</span>
    </div>
  );
}

function Callout({ text, variant = "default" }: { text: string; variant?: "default" | "warning" | "critical" }) {
  const styles = {
    default: "border-l-slate-400 bg-slate-50/60 dark:bg-slate-800/30",
    warning: "border-l-amber-400 bg-amber-50/40 dark:bg-amber-900/10",
    critical: "border-l-red-500 bg-red-50/40 dark:bg-red-900/10",
  };
  return (
    <div className={cn("border-l-[3px] pl-4 py-3 rounded-r-lg", styles[variant])}>
      <p className="text-sm leading-relaxed text-foreground/85">
        <RichText text={text} />
      </p>
    </div>
  );
}

const PRIORITY_CONFIG = {
  fondamenta: { label: "Fondamenta", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400", desc: "Obbligatorio" },
  core: { label: "Core", dot: "bg-blue-500", text: "text-blue-700 dark:text-blue-400", desc: "Prioritario" },
  avanzato: { label: "Avanzato", dot: "bg-violet-500", text: "text-violet-700 dark:text-violet-400", desc: "Espansione" },
};

function PriorityPill({ priority }: { priority: "fondamenta" | "core" | "avanzato" }) {
  const cfg = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.core;
  return (
    <div className="flex items-center gap-1.5">
      <div className={cn("w-1.5 h-1.5 rounded-full", cfg.dot)} />
      <span className={cn("text-[11px] font-semibold", cfg.text)}>{cfg.label}</span>
    </div>
  );
}

function ComplexityMeter({ level }: { level: string }) {
  const n = level === "bassa" ? 1 : level === "media" ? 2 : 3;
  const color = n === 1 ? "bg-emerald-400" : n === 2 ? "bg-amber-400" : "bg-red-400";
  const label = n === 1 ? "Semplice" : n === 2 ? "Medio" : "Complesso";
  return (
    <div className="flex items-center gap-1.5">
      <div className="flex gap-0.5">
        {[1, 2, 3].map(i => (
          <div key={i} className={cn("w-2.5 h-1.5 rounded-sm", i <= n ? color : "bg-border/60")} />
        ))}
      </div>
      <span className="text-[10px] text-muted-foreground">{label}</span>
    </div>
  );
}

function ExpandableModule({ mod, index }: { mod: PackageModule; index: number }) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!(mod.hook || mod.first_step || mod.success_signal);
  return (
    <div className="border-b border-border/30 last:border-0">
      <div
        className={cn("flex items-center justify-between py-2.5 px-1", hasExtra && "cursor-pointer hover:bg-muted/30 rounded-lg transition-colors")}
        onClick={hasExtra ? () => setOpen(v => !v) : undefined}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <CheckCircle2 className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
          <div className="min-w-0">
            <span className="text-sm font-medium text-foreground">{mod.name}</span>
            {mod.hook && !open && (
              <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-1">{mod.hook}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <ComplexityMeter level={mod.complexity} />
          {mod.setup_time && (
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <Clock className="w-3 h-3" />{mod.setup_time}
            </span>
          )}
          {mod.config_link && (
            <a href={mod.config_link} onClick={e => e.stopPropagation()}
              className="text-[10px] text-blue-500 hover:text-blue-700 flex items-center gap-0.5">
              Configura <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {hasExtra && (
            open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
          )}
        </div>
      </div>
      <AnimatePresence>
        {open && hasExtra && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-6 pb-3 space-y-2">
              {mod.hook && (
                <div className="flex items-start gap-2">
                  <Lightbulb className="w-3 h-3 text-amber-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground/90 italic">{mod.hook}</p>
                </div>
              )}
              {mod.first_step && (
                <div className="flex items-start gap-2">
                  <Play className="w-3 h-3 text-blue-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground/80">{mod.first_step}</p>
                </div>
              )}
              {mod.success_signal && (
                <div className="flex items-start gap-2">
                  <CheckSquare className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{mod.success_signal}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ExpandableScorecardCard({ item }: { item: ScorecardItem }) {
  const [open, setOpen] = useState(false);
  const hasExtra = !!(
    (item.consigli_pratici && item.consigli_pratici.length > 0) ||
    (item.esempi_concreti && item.esempi_concreti.length > 0) ||
    item.cosa_fare_domani
  );
  const votoColor = item.voto >= 7 ? "text-emerald-600 border-emerald-400" : item.voto >= 4 ? "text-amber-600 border-amber-400" : "text-red-600 border-red-400";
  const bgColor = item.voto >= 7 ? "bg-emerald-50/50 dark:bg-emerald-950/20" : item.voto >= 4 ? "bg-amber-50/50 dark:bg-amber-950/20" : "bg-red-50/50 dark:bg-red-950/20";

  return (
    <div className={cn("rounded-lg border border-border/50 overflow-hidden", bgColor)}>
      <div
        className={cn("p-4", hasExtra && "cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors")}
        onClick={hasExtra ? () => setOpen(v => !v) : undefined}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <h4 className="font-semibold text-sm text-foreground">{item.area}</h4>
            {hasExtra && (
              open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            )}
          </div>
          <div className={cn("w-9 h-9 rounded-full border-2 flex flex-col items-center justify-center flex-shrink-0", votoColor)}>
            <span className="text-sm font-bold leading-none">{item.voto}</span>
            <span className="text-[7px] text-muted-foreground">/10</span>
          </div>
        </div>
        <div className="grid md:grid-cols-2 gap-3 mb-3">
          {item.punti_forza.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 mb-1.5">Punti di forza</p>
              <ul className="space-y-1">
                {item.punti_forza.map((pf, j) => (
                  <li key={j} className="text-xs text-foreground/75 leading-relaxed flex items-start gap-1.5">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{pf}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.criticita.length > 0 && (
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70 dark:text-red-400/70 mb-1.5">Criticità</p>
              <ul className="space-y-1">
                {item.criticita.map((cr, j) => (
                  <li key={j} className="text-xs text-foreground/75 leading-relaxed flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{cr}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        {item.azione_prioritaria && (
          <div className="flex items-start gap-2 pt-2 border-t border-border/30">
            <Zap className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
            <p className="text-xs text-foreground/80 leading-relaxed">{item.azione_prioritaria}</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {open && hasExtra && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-border/30 pt-4">
              {item.consigli_pratici && item.consigli_pratici.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600/70 dark:text-blue-400/70 mb-2">Consigli pratici</p>
                  <div className="space-y-2.5">
                    {item.consigli_pratici.map((consiglio, j) => (
                      <div key={j} className="flex items-start gap-2.5">
                        <Lightbulb className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-foreground/80 leading-relaxed"><RichText text={consiglio} /></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.esempi_concreti && item.esempi_concreti.length > 0 && (
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-violet-600/70 dark:text-violet-400/70 mb-2">Esempi concreti</p>
                  <div className="space-y-2.5">
                    {item.esempi_concreti.map((esempio, j) => (
                      <div key={j} className="rounded-md bg-background/60 border border-border/30 p-3">
                        <div className="flex items-start gap-2">
                          <MessageSquare className="w-3.5 h-3.5 text-violet-500 mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-foreground/75 leading-relaxed"><RichText text={esempio} /></p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {item.cosa_fare_domani && (
                <div className="rounded-md bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/50 dark:border-emerald-800/30 p-3">
                  <div className="flex items-start gap-2">
                    <Rocket className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 dark:text-emerald-400/80 mb-1">Cosa fare domani</p>
                      <p className="text-xs text-foreground/80 leading-relaxed"><RichText text={item.cosa_fare_domani} /></p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function RoadmapCard({ phase, index, total }: { phase: RoadmapPhase; index: number; total: number }) {
  const labels = ["Settimana 1", "Settimane 2–4", "Mese 2+"];
  const label = labels[index] || `Fase ${index + 1}`;
  const isFirst = index === 0;
  return (
    <div className="relative">
      {index < total - 1 && (
        <div className="absolute left-[18px] top-full w-px h-6 bg-border/40" />
      )}
      <div className="flex gap-4">
        <div className="flex-shrink-0 flex flex-col items-center">
          <div className={cn(
            "w-9 h-9 rounded-full border-2 flex items-center justify-center text-xs font-bold",
            isFirst
              ? "border-foreground bg-foreground text-background"
              : "border-border bg-background text-muted-foreground"
          )}>
            {index + 1}
          </div>
        </div>
        <div className="flex-1 pb-8">
          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">{label}</span>
            {phase.pacchetti_coinvolti?.length > 0 && (
              <span className="text-[10px] text-muted-foreground/60">— {phase.pacchetti_coinvolti.join(', ')}</span>
            )}
          </div>
          <h4 className="font-bold text-base text-foreground mb-3">{phase.titolo}</h4>
          <div className="space-y-2 mb-4">
            {phase.azioni_prioritarie?.map((azione, j) => (
              <div key={j} className="flex items-start gap-2.5">
                <div className="w-1 h-1 rounded-full bg-foreground/40 mt-2 flex-shrink-0" />
                <p className="text-sm text-foreground/80 leading-relaxed">{azione}</p>
              </div>
            ))}
          </div>
          {(phase.obiettivo || phase.vita_dopo) && (
            <div className="space-y-2">
              {phase.obiettivo && (
                <div className="flex items-start gap-2">
                  <Target className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-muted-foreground">{phase.obiettivo}</p>
                </div>
              )}
              {phase.vita_dopo && (
                <div className="flex items-start gap-2">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-foreground/70 italic">{phase.vita_dopo}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DeliveryReportProps {
  sessionId: string;
  onBackToChat: () => void;
  publicToken?: string;
}

interface Chapter {
  id: string;
  number?: string;
  title: string;
  subtitle?: string;
}

export function DeliveryReport({ sessionId, onBackToChat, publicToken }: DeliveryReportProps) {
  const isPublic = !!publicToken;
  const { toast } = useToast();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const contentRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [funnelId, setFunnelId] = useState<string | null>(null);
  const [funnelLoading, setFunnelLoading] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const handleRegenerate = useCallback(async () => {
    setRegenerating(true);
    try {
      const res = await fetch(`/api/consultant/delivery-agent/generate-report/${sessionId}`, {
        method: "POST",
        headers: getAuthHeaders(),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Errore nella rigenerazione");
      }
      const url = `/api/consultant/delivery-agent/reports/${sessionId}`;
      const reportRes = await fetch(url, { headers: getAuthHeaders() });
      if (reportRes.ok) {
        const data = await reportRes.json();
        const reportData = data.data || data.report || data;
        const rawReport = reportData.report_json || reportData;
        if (rawReport) {
          setReport(normalizeReport(rawReport));
        }
      }
      toast({ title: "Report rigenerato!", description: "Il report è stato rigenerato con successo." });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message || "Impossibile rigenerare il report", variant: "destructive" });
    } finally {
      setRegenerating(false);
    }
  }, [sessionId, toast]);

  useEffect(() => {
    const loadReport = async () => {
      try {
        const url = isPublic
          ? `/api/public/lead-magnet/${publicToken}/session`
          : `/api/consultant/delivery-agent/reports/${sessionId}`;
        const headers = isPublic ? {} : getAuthHeaders();
        const res = await fetch(url, { headers });
        if (res.ok) {
          const data = await res.json();
          let rawReport;
          if (isPublic) {
            rawReport = data.data?.report?.report_json || data.data?.report;
          } else {
            const reportData = data.data || data.report || data;
            rawReport = reportData.report_json || reportData;
          }
          if (rawReport) {
            setReport(normalizeReport(rawReport));
          }
        }
      } catch (err) {
        console.error("Failed to load report:", err);
        toast({ title: "Errore", description: "Impossibile caricare il report", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadReport();
  }, [sessionId, toast, isPublic, publicToken]);

  const [publicFunnelData, setPublicFunnelData] = useState<any>(null);

  useEffect(() => {
    setFunnelId(null);
    setFunnelLoading(false);
    setPublicFunnelData(null);
  }, [sessionId]);

  useEffect(() => {
    if (isPublic) {
      if (!publicToken || publicFunnelData) return;
      const checkPublicFunnel = async () => {
        try {
          const res = await fetch(`/api/public/lead-magnet/${publicToken}/funnel`);
          if (res.ok) {
            const data = await res.json();
            if (data.data) {
              setFunnelId(data.data.id);
              setPublicFunnelData(data.data);
            }
          }
        } catch {}
      };
      checkPublicFunnel();
      const interval = setInterval(checkPublicFunnel, 10000);
      return () => clearInterval(interval);
    } else {
      if (funnelId) return;
      const checkFunnel = async () => {
        try {
          const res = await fetch(`/api/funnels/by-session/${sessionId}`, { headers: getAuthHeaders() });
          if (res.ok) {
            const data = await res.json();
            if (data.id) setFunnelId(data.id);
          }
        } catch {}
      };
      checkFunnel();
      const interval = setInterval(checkFunnel, 10000);
      return () => clearInterval(interval);
    }
  }, [sessionId, isPublic, funnelId, publicFunnelData, publicToken]);

  const handleGenerateFunnel = async () => {
    setFunnelLoading(true);
    try {
      let res;
      if (isPublic && publicToken) {
        res = await fetch(`/api/public/lead-magnet/${publicToken}/generate-funnel`, { method: 'POST' });
      } else {
        res = await fetch('/api/funnels/generate-from-report', {
          method: 'POST',
          headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionId }),
        });
      }
      if (res.ok) {
        const data = await res.json();
        const newFunnelId = data.funnelId || data.data?.funnelId;
        if (newFunnelId) {
          setFunnelId(newFunnelId);
          if (isPublic && publicToken) {
            const fr = await fetch(`/api/public/lead-magnet/${publicToken}/funnel`);
            if (fr.ok) {
              const fd = await fr.json();
              if (fd.data) setPublicFunnelData(fd.data);
            }
          }
          toast({ title: "Funnel generato!", description: "Il funnel personalizzato è stato creato" });
        }
      } else {
        toast({ title: "Errore", description: "Impossibile generare il funnel", variant: "destructive" });
      }
    } catch {
      toast({ title: "Errore", description: "Errore di connessione", variant: "destructive" });
    } finally {
      setFunnelLoading(false);
    }
  };

  const chapters: Chapter[] = [];
  if (report) {
    if (report.personal_letter) chapters.push({ id: "lettera", title: "Lettera" });
    if (report.client_profile) chapters.push({ id: "profilo", number: "01", title: "Il tuo profilo", subtitle: report.client_profile.business_type });
    if (report.diagnosis) chapters.push({ id: "diagnosi", number: "02", title: "La diagnosi", subtitle: "Dove sei vs dove vai" });
    if (report.recommended_packages) {
      report.recommended_packages.forEach((pkg, i) => {
        chapters.push({ id: `pkg-${i}`, number: String(i + 3).padStart(2, '0'), title: pkg.package_name, subtitle: pkg.subtitle });
      });
    }
    let n = (report.recommended_packages?.length || 0) + 3;
    if (report.roadmap) { chapters.push({ id: "roadmap", number: String(n).padStart(2, '0'), title: "Roadmap", subtitle: "Fase per fase" }); n++; }
    if (report.flow_description) { chapters.push({ id: "flusso", number: String(n).padStart(2, '0'), title: "Come gira il sistema", subtitle: "Il quadro completo" }); n++; }
    if (report.campagne_ads?.length) { chapters.push({ id: "campagne", number: String(n).padStart(2, '0'), title: "Campagne Ads Pronte", subtitle: `${report.campagne_ads.length} inserzioni` }); n++; }
    if (report.quick_wins?.length) { chapters.push({ id: "quickwins", number: String(n).padStart(2, '0'), title: "Quick Wins", subtitle: `${report.quick_wins.length} azioni rapide` }); n++; }
    if (report.success_signals?.length || report.success_metrics?.length) { chapters.push({ id: "segnali", number: String(n).padStart(2, '0'), title: "Come sai che funziona", subtitle: "Segnali concreti" }); n++; }
    if (report.honest_warning || report.priority_actions?.length) { chapters.push({ id: "avvertimento", number: String(n).padStart(2, '0'), title: "Cosa devi sapere", subtitle: "Avvertimento onesto" }); n++; }
    if (report.closing_message) chapters.push({ id: "chiusura", title: "Chiusura" });
    if ((isPublic && publicFunnelData?.nodes) || (!isPublic && funnelId)) {
      chapters.push({ id: "funnel", number: String(n).padStart(2, '0'), title: "Il Tuo Funnel", subtitle: "Percorso strategico" });
    }
  }

  const setChapterRef = useCallback((id: string) => (el: HTMLDivElement | null) => {
    chapterRefs.current[id] = el;
  }, []);

  const scrollToChapter = useCallback((id: string) => {
    const el = chapterRefs.current[id];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'start' }); setActiveChapter(id); }
  }, []);

  useEffect(() => {
    if (!report || chapters.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => { for (const entry of entries) { if (entry.isIntersecting) { setActiveChapter(entry.target.id); break; } } },
      { rootMargin: '-80px 0px -60% 0px', threshold: 0.05 }
    );
    Object.values(chapterRefs.current).forEach(el => { if (el) observer.observe(el); });
    return () => observer.disconnect();
  }, [report, chapters.length]);

  const handleDownloadPdf = async () => {
    if (isPublic) return;
    try {
      const res = await fetch(`/api/consultant/delivery-agent/reports/${sessionId}/pdf`, { headers: getAuthHeaders() });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `piano-${sessionId.slice(0, 8)}.pdf`; a.click();
        URL.revokeObjectURL(url);
      } else { window.print(); }
    } catch { window.print(); }
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiato" });
    } catch { toast({ title: "Errore", variant: "destructive" }); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground text-sm">Report non ancora disponibile</p>
          <Button variant="outline" size="sm" onClick={onBackToChat} className="gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Torna alla chat
          </Button>
        </div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('it-IT', { day: 'numeric', month: 'long', year: 'numeric' });

  // Build roadmap phases in order
  const roadmapPhases: RoadmapPhase[] = [];
  if (report.roadmap) {
    const r = report.roadmap;
    const tryPhase = (w: any) => {
      if (!w) return;
      if (w && typeof w === 'object' && !Array.isArray(w) && w.azioni_prioritarie) roadmapPhases.push(w as RoadmapPhase);
      else if (w && typeof w === 'object' && !Array.isArray(w) && w.cosa_fai) roadmapPhases.push(w as RoadmapPhase);
    };
    tryPhase(r.week1); tryPhase(r.week2); tryPhase(r.week3); tryPhase(r.week4);
    if (roadmapPhases.length === 0) {
      // legacy: try weeks2_4 and month2_plus
      const legacyPhases = [r.week1, r.weeks2_4, r.month2_plus].filter(Boolean);
      legacyPhases.forEach((p: any) => {
        if (p && typeof p === 'object' && !Array.isArray(p)) {
          const azioni = p.azioni || p.azioni_prioritarie || [];
          if (azioni.length > 0) roadmapPhases.push({ titolo: p.titolo || '', pacchetti_coinvolti: p.pacchetti || [], azioni_prioritarie: azioni, obiettivo: p.obiettivo || '', vita_dopo: '', kpi_target: p.kpi_target || '' });
        }
      });
    }
  }

  return (
    <div className="flex h-full print:block bg-background overflow-hidden">

      {/* ── Sidebar indice ── */}
      <AnimatePresence>
        {sidebarOpen && chapters.length > 0 && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 220, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="hidden sm:block flex-shrink-0 border-r border-border/50 bg-card overflow-hidden print:hidden"
          >
            <div className="p-4 border-b border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Indice</p>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto h-[calc(100%-49px)]">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => scrollToChapter(ch.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors group",
                    activeChapter === ch.id ? "bg-foreground/5" : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    {ch.number ? (
                      <span className={cn(
                        "text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0",
                        activeChapter === ch.id ? "bg-foreground text-background" : "text-muted-foreground/50"
                      )}>{ch.number}</span>
                    ) : (
                      <span className="w-4 h-4 flex-shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className={cn(
                        "text-xs truncate leading-tight",
                        activeChapter === ch.id ? "font-semibold text-foreground" : "text-foreground/70"
                      )}>{ch.title}</p>
                      {ch.subtitle && (
                        <p className="text-[10px] text-muted-foreground/50 truncate">{ch.subtitle}</p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">

        {/* Toolbar — hidden on mobile */}
        <div className="hidden sm:flex items-center justify-between px-2 sm:px-4 py-1.5 sm:py-2 border-b border-border/40 bg-card flex-shrink-0 print:hidden gap-1">
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <Button variant="ghost" size="sm" onClick={onBackToChat} className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-1.5 sm:px-3">
              <ArrowLeft className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Chat</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(v => !v)} className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-1.5 sm:px-3">
              <BookOpen className="w-3.5 h-3.5" />
              {sidebarOpen ? "Nascondi indice" : "Indice"}
            </Button>
          </div>
          <div className="flex items-center gap-1 sm:gap-2 overflow-x-auto">
            {funnelId ? (
              !isPublic ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-2 sm:px-3 border-indigo-300 text-indigo-600 hover:bg-indigo-50 shrink-0"
                  onClick={() => window.location.href = `/consultant/content-studio/ideas?tab=funnel&funnel=${funnelId}`}
                >
                  <Layers className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Vedi Funnel</span>
                </Button>
              ) : null
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="gap-1 sm:gap-1.5 text-xs h-7 sm:h-8 px-2 sm:px-3 shrink-0"
                onClick={handleGenerateFunnel}
                disabled={funnelLoading}
              >
                {funnelLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Layers className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{funnelLoading ? "Generando..." : "Genera Funnel"}</span>
              </Button>
            )}
            {!isPublic && (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="sm" disabled={regenerating} className="gap-1 text-xs h-7 sm:h-8 px-1.5 sm:px-3 shrink-0">
                      {regenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{regenerating ? "Rigenerando..." : "Rigenera"}</span>
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Rigenerare il report?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Il report attuale verrà sostituito con uno nuovo generato dall'AI. Questa operazione può richiedere qualche minuto.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Annulla</AlertDialogCancel>
                      <AlertDialogAction onClick={handleRegenerate}>Rigenera</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button variant="ghost" size="sm" onClick={handleShare} className="gap-1 text-xs h-7 sm:h-8 px-1.5 sm:px-3 shrink-0">
                  <Share2 className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Condividi</span>
                </Button>
                <Button size="sm" onClick={handleDownloadPdf} className="gap-1 text-xs h-7 sm:h-8 px-2 sm:px-3 bg-foreground text-background hover:bg-foreground/90 shrink-0">
                  <Download className="w-3.5 h-3.5" /> <span className="hidden sm:inline">Scarica PDF</span>
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden" ref={contentRef}>
          <div className="w-full max-w-[720px] mx-auto px-5 sm:px-8 py-6 sm:py-10 print:max-w-none print:px-12" style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}>

            {/* ── Cover ── */}
            <div className="pt-4 sm:pt-8 pb-8 sm:pb-14 print:py-20 print:break-after-page">
              <div className="space-y-1 mb-6 sm:mb-10">
                <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">Piano Strategico Personalizzato</p>
                <h1 className="text-2xl sm:text-4xl font-bold text-foreground tracking-tight leading-tight">
                  {report.client_profile?.name
                    ? <>Il piano di<br />{report.client_profile.name}</>
                    : "Il tuo piano operativo"
                  }
                </h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{today}</span>
                <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                <span>Documento riservato</span>
              </div>
              {report.client_profile?.gap_name && (
                <div className="mt-8 pt-6 border-t border-border/40">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Il gap da colmare</p>
                  <p className="text-base font-semibold text-foreground">{report.client_profile.gap_name}</p>
                </div>
              )}
            </div>

            {/* ── Lettera personale ── */}
            {report.personal_letter && (
              <section id="lettera" ref={setChapterRef("lettera")} className="mb-10 sm:mb-14 print:break-before-page">
                <div className="space-y-4 border-l-2 border-border/40 pl-3 sm:pl-5">
                  {report.personal_letter.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm sm:text-[15px] leading-7 sm:leading-8 text-foreground/80 break-words">
                      <RichText text={para} />
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* ── 01 Profilo ── */}
            {report.client_profile && (
              <section id="profilo" ref={setChapterRef("profilo")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle number="01" title="Il tuo profilo" subtitle="Come ti vedo — lo specchio del tuo business" />
                <div className="divide-y divide-border/30">
                  {report.client_profile.business_type && <FieldRow label="Attività" value={report.client_profile.business_type} />}
                  {report.client_profile.sector && <FieldRow label="Settore" value={report.client_profile.sector} />}
                  {report.client_profile.niche && <FieldRow label="Nicchia" value={report.client_profile.niche} />}
                  {report.client_profile.scale && <FieldRow label="Scala" value={report.client_profile.scale} />}
                  {report.client_profile.team_size && <FieldRow label="Team" value={report.client_profile.team_size} />}
                  {report.client_profile.sales_method && <FieldRow label="Come trovi clienti" value={report.client_profile.sales_method} />}
                  {report.client_profile.digital_maturity && <FieldRow label="Maturità digitale" value={report.client_profile.digital_maturity} />}
                  {report.client_profile.current_tools && report.client_profile.current_tools.length > 0 && (
                    <FieldRow label="Strumenti oggi" value={report.client_profile.current_tools.join(', ')} />
                  )}
                  {report.client_profile.communication_channels && report.client_profile.communication_channels.length > 0 && (
                    <FieldRow label="Canali" value={report.client_profile.communication_channels.join(', ')} />
                  )}
                  {report.client_profile.budget && <FieldRow label="Budget" value={report.client_profile.budget} />}
                  {report.client_profile.website && (
                    <div className="flex flex-col sm:flex-row sm:items-start gap-0.5 sm:gap-3 py-2 sm:py-2.5 border-b border-border/30">
                      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider sm:w-28 flex-shrink-0 pt-0.5">Sito web</span>
                      <a href={report.client_profile.website} target="_blank" rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1">
                        <Globe className="w-3 h-3" />{report.client_profile.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
                {report.client_profile.main_pain_point && (
                  <div className="mt-6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Il problema principale</p>
                    <Callout text={report.client_profile.main_pain_point} variant="warning" />
                  </div>
                )}
                {report.client_profile.goals && report.client_profile.goals.length > 0 && (
                  <div className="mt-6">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Obiettivi dichiarati</p>
                    <div className="space-y-2">
                      {report.client_profile.goals.map((goal, i) => (
                        <div key={i} className="flex items-start gap-2.5">
                          <Target className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-foreground/80">{goal}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── 02 Diagnosi ── */}
            {report.diagnosis && (
              <section id="diagnosi" ref={setChapterRef("diagnosi")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle number="02" title="La diagnosi" subtitle="Dove sei ora — dove puoi arrivare — cosa ti separa" />
                <div className="space-y-8">

                  {/* Today vs target */}
                  {(report.diagnosis.current_state || report.diagnosis.desired_state) && (
                    <div className="grid md:grid-cols-2 gap-6">
                      {report.diagnosis.current_state && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Oggi</p>
                          <p className="text-sm leading-7 text-foreground/80">
                            <RichText text={report.diagnosis.current_state} />
                          </p>
                        </div>
                      )}
                      {report.diagnosis.desired_state && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Tra 60 giorni</p>
                          <p className="text-sm leading-7 text-foreground/80">
                            <RichText text={report.diagnosis.desired_state} />
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {report.diagnosis.gap_analysis && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Il gap</p>
                      <Callout text={report.diagnosis.gap_analysis} />
                    </div>
                  )}

                  {/* Diagnostic table */}
                  {report.diagnosis.diagnostic_table && report.diagnosis.diagnostic_table.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Stato per area</p>
                      <div className="overflow-x-auto rounded-lg border border-border/50">
                        <table className="w-full text-sm min-w-[400px]">
                          <thead>
                            <tr className="border-b border-border/50 bg-muted/30">
                              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Area</th>
                              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Stato</th>
                              <th className="text-left px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hidden md:table-cell">Nota</th>
                              <th className="text-center px-4 py-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground w-20">Priorità</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {report.diagnosis.diagnostic_table.map((row, i) => {
                              const urgColor = {
                                urgente: "text-red-600 dark:text-red-400",
                                alto: "text-amber-600 dark:text-amber-400",
                                medio: "text-blue-600 dark:text-blue-400",
                                basso: "text-muted-foreground",
                              };
                              const dot = {
                                urgente: "bg-red-500",
                                alto: "bg-amber-500",
                                medio: "bg-blue-500",
                                basso: "bg-slate-400",
                              };
                              return (
                                <tr key={i} className="hover:bg-muted/20 transition-colors">
                                  <td className="px-4 py-3 font-semibold text-foreground text-sm">{row.area}</td>
                                  <td className="px-4 py-3 text-sm text-foreground/75">{row.stato}</td>
                                  <td className="px-4 py-3 text-xs text-muted-foreground hidden md:table-cell leading-relaxed">{row.nota}</td>
                                  <td className="px-4 py-3 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <div className={cn("w-1.5 h-1.5 rounded-full", dot[row.impatto] || "bg-slate-400")} />
                                      <span className={cn("text-[10px] font-semibold capitalize", urgColor[row.impatto] || "text-muted-foreground")}>{row.impatto}</span>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {report.diagnosis.scorecard && report.diagnosis.scorecard.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-4">Scorecard per area</p>
                      <div className="grid gap-4">
                        {report.diagnosis.scorecard.map((item, i) => (
                          <ExpandableScorecardCard key={i} item={item} />
                        ))}
                      </div>
                    </div>
                  )}

                  {report.diagnosis.key_challenges && report.diagnosis.key_challenges.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Le sfide concrete</p>
                      <div className="space-y-2">
                        {report.diagnosis.key_challenges.map((ch, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground/80 leading-relaxed">{ch}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {report.diagnosis.key_insight && (
                    <Callout text={report.diagnosis.key_insight} variant="warning" />
                  )}
                </div>
              </section>
            )}

            {/* ── Pacchetti consigliati ── */}
            {report.recommended_packages && report.recommended_packages.map((pkg, i) => (
              <section key={i} id={`pkg-${i}`} ref={setChapterRef(`pkg-${i}`)} className="mb-10 sm:mb-14 print:break-before-page">
                <div className="mb-5 sm:mb-8 pb-4 sm:pb-5 border-b border-border/40">
                  <div className="flex items-baseline justify-between gap-2 sm:gap-3">
                    <div className="flex items-baseline gap-2 sm:gap-3 min-w-0">
                      <span className="text-2xl sm:text-4xl font-thin text-muted-foreground/20 leading-none tracking-tight select-none shrink-0">
                        {String(i + 3).padStart(2, '0')}
                      </span>
                      <div className="min-w-0">
                        <h2 className="text-lg sm:text-[22px] font-bold text-foreground tracking-tight leading-tight">{pkg.package_name}</h2>
                        {pkg.subtitle && <p className="text-sm text-muted-foreground mt-0.5">{pkg.subtitle}</p>}
                      </div>
                    </div>
                    <div className="flex-shrink-0 flex items-center gap-3">
                      <PriorityPill priority={pkg.priority} />
                      {pkg.score !== undefined && (
                        <div className={cn(
                          "w-10 h-10 rounded-full border-2 flex flex-col items-center justify-center flex-shrink-0",
                          pkg.score >= 7 ? "border-emerald-400 text-emerald-600" : pkg.score >= 4 ? "border-amber-400 text-amber-600" : "border-red-400 text-red-600"
                        )}>
                          <span className="text-sm font-bold leading-none">{pkg.score}</span>
                          <span className="text-[7px] text-muted-foreground">/10</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-7">

                  {/* Perché per te */}
                  {pkg.reason && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Perché è rilevante per te</p>
                      <div className="space-y-4">
                        {pkg.reason.split('\n\n').map((para, j) => (
                          <p key={j} className="text-sm sm:text-[15px] leading-7 sm:leading-8 text-foreground/85 break-words">
                            <RichText text={para} />
                          </p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Cosa non fa — avvertimento onesto */}
                  {pkg.honest_warning && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Cosa non fa</p>
                      <p className="text-sm text-foreground/70 leading-relaxed">{pkg.honest_warning}</p>
                    </div>
                  )}

                  {/* Cosa va bene / non funziona */}
                  {(pkg.whats_good || pkg.whats_wrong) && (
                    <div className="grid md:grid-cols-2 gap-5">
                      {pkg.whats_good && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 mb-3">Cosa funziona già</p>
                          <div className="space-y-3">
                            {pkg.whats_good.split('\n\n').map((p, j) => (
                              <p key={j} className="text-sm leading-relaxed text-foreground/80"><RichText text={p} /></p>
                            ))}
                          </div>
                        </div>
                      )}
                      {pkg.whats_wrong && (
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 mb-3">Cosa non funziona</p>
                          <div className="space-y-3">
                            {pkg.whats_wrong.split('\n\n').map((p, j) => (
                              <p key={j} className="text-sm leading-relaxed text-foreground/80"><RichText text={p} /></p>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Come correggere */}
                  {pkg.how_to_fix && pkg.how_to_fix.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Azioni concrete</p>
                      <div className="space-y-2">
                        {pkg.how_to_fix.map((action, j) => (
                          <div key={j} className="flex items-start gap-3">
                            <span className="text-[10px] font-bold text-muted-foreground/40 w-4 mt-1 flex-shrink-0">{j + 1}</span>
                            <p className="text-sm text-foreground/80 leading-relaxed">
                              <RichText text={action.replace(/^→\s*/, '')} />
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Diagnosi critica */}
                  {pkg.critical_diagnosis && (
                    <Callout text={pkg.critical_diagnosis} variant="critical" />
                  )}

                  {/* Moduli inclusi */}
                  {pkg.modules && pkg.modules.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Moduli inclusi</p>
                        <span className="text-[10px] text-muted-foreground/50">{pkg.modules.length} moduli</span>
                      </div>
                      <div className="border border-border/40 rounded-lg overflow-hidden">
                        {pkg.modules.map((mod, j) => (
                          <ExpandableModule key={j} mod={mod} index={j} />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Timeline + connessione */}
                  {(pkg.timeline || pkg.connection) && (
                    <div className="flex items-center gap-4 text-sm pt-2">
                      {pkg.timeline && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Setup: <strong className="text-foreground font-semibold">{pkg.timeline}</strong></span>
                        </div>
                      )}
                      {pkg.timeline && pkg.connection && <div className="w-px h-4 bg-border/50" />}
                      {pkg.connection && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <ArrowRight className="w-3.5 h-3.5" />
                          <span className="text-foreground/75">{pkg.connection}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>
            ))}

            {/* ── Roadmap ── */}
            {roadmapPhases.length > 0 && (
              <section id="roadmap" ref={setChapterRef("roadmap")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'roadmap')?.number}
                  title="Roadmap operativa"
                  subtitle="Cosa fai, in che ordine, e cosa cambia dopo ogni fase"
                />
                <div className="pl-2">
                  {roadmapPhases.map((phase, i) => (
                    <RoadmapCard key={i} phase={phase} index={i} total={roadmapPhases.length} />
                  ))}
                </div>
              </section>
            )}

            {/* ── Flusso completo del sistema ── */}
            {report.flow_description && (
              <section id="flusso" ref={setChapterRef("flusso")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'flusso')?.number}
                  title="Come gira il sistema"
                  subtitle="Il quadro completo — come i pezzi si parlano nel tuo caso"
                />
                <div className="space-y-4">
                  {report.flow_description.split('\n\n').map((para, i) => (
                    <p key={i} className="text-sm sm:text-[15px] leading-7 sm:leading-8 text-foreground/80 break-words">
                      <RichText text={para} />
                    </p>
                  ))}
                </div>
              </section>
            )}

            {/* ── Campagne Ads Pronte ── */}
            {report.campagne_ads && report.campagne_ads.length > 0 && (
              <section id="campagne" ref={setChapterRef("campagne")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'campagne')?.number}
                  title="Campagne Ads Pronte"
                  subtitle="Inserzioni complete — copia e pubblica"
                />
                <div className="space-y-8">
                  {report.campagne_ads.map((ad, i) => (
                    <div key={i} className="rounded-lg border border-border/50 overflow-hidden print:break-inside-avoid">
                      <div className="bg-muted/30 px-5 py-3 border-b border-border/40">
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold text-sm text-foreground">{ad.nome_campagna}</h4>
                            <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                              <span>{ad.piattaforma}</span>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                              <span>{ad.formato}</span>
                              <span className="w-1 h-1 rounded-full bg-muted-foreground/40" />
                              <span>{ad.obiettivo_campagna}</span>
                            </div>
                          </div>
                          <div className="text-right text-[11px] text-muted-foreground">
                            <div className="font-semibold text-foreground">{ad.budget_giornaliero}</div>
                            <div>{ad.durata_test}</div>
                          </div>
                        </div>
                      </div>
                      <div className="p-5 space-y-4">
                        {ad.target_pubblico && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Target</p>
                            <div className="flex flex-wrap gap-2 text-xs text-foreground/75">
                              {ad.target_pubblico.eta && <span className="bg-muted/50 px-2 py-1 rounded">Età: {ad.target_pubblico.eta}</span>}
                              {ad.target_pubblico.genere && <span className="bg-muted/50 px-2 py-1 rounded">{ad.target_pubblico.genere}</span>}
                              {ad.target_pubblico.localita && <span className="bg-muted/50 px-2 py-1 rounded">{ad.target_pubblico.localita}</span>}
                              {ad.target_pubblico.interessi?.map((int, j) => (
                                <span key={j} className="bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded">{int}</span>
                              ))}
                            </div>
                            {ad.target_pubblico.comportamenti && (
                              <p className="text-xs text-muted-foreground mt-1.5">{ad.target_pubblico.comportamenti}</p>
                            )}
                          </div>
                        )}

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Headline</p>
                          <p className="text-sm font-semibold text-foreground">{ad.headline}</p>
                        </div>

                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Copy completo</p>
                          <div className="bg-muted/30 border border-border/40 rounded-lg px-4 py-3">
                            <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{ad.copy_completo}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4">
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">CTA</p>
                            <span className="inline-block bg-foreground text-background text-xs font-semibold px-3 py-1.5 rounded">{ad.cta_button}</span>
                          </div>
                          {ad.kpi_attesi && (
                            <div className="flex-1">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">KPI attesi</p>
                              <p className="text-xs text-foreground/75">{ad.kpi_attesi}</p>
                            </div>
                          )}
                        </div>

                        {ad.brief_visivo && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Brief visivo</p>
                            <p className="text-xs text-muted-foreground leading-relaxed italic">{ad.brief_visivo}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Quick Wins ── */}
            {report.quick_wins && report.quick_wins.length > 0 && (
              <section id="quickwins" ref={setChapterRef("quickwins")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'quickwins')?.number}
                  title="Quick Wins"
                  subtitle="Tre cose che fai oggi, effetto domani — ognuna sotto 30 minuti"
                />
                <div className="space-y-10">
                  {report.quick_wins.map((qw, i) => (
                    <div key={i} className="print:break-inside-avoid">
                      <div className="flex items-baseline gap-3 mb-4">
                        <span className="text-2xl font-thin text-muted-foreground/30 leading-none">{i + 1}</span>
                        <div>
                          <h4 className="font-bold text-base text-foreground">{qw.title}</h4>
                          {qw.estimated_time && (
                            <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-0.5">
                              <Clock className="w-3 h-3" />{qw.estimated_time}
                            </p>
                          )}
                        </div>
                      </div>

                      {qw.steps.length > 0 && (
                        <div className="mb-4 space-y-2.5 pl-4 sm:pl-9">
                          {qw.steps.map((step, j) => (
                            <div key={j} className="flex items-start gap-2.5">
                              <span className="text-[10px] font-bold text-muted-foreground/40 mt-0.5 w-3 flex-shrink-0">{j + 1}.</span>
                              <p className="text-sm text-foreground/80 leading-relaxed">{step}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {qw.copy_paste && (
                        <div className="ml-4 sm:ml-9 mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-2">Testo da copiare</p>
                          <div className="bg-muted/40 border border-border/50 rounded-lg px-4 py-3">
                            <p className="text-sm text-foreground/80 italic leading-relaxed whitespace-pre-wrap">{qw.copy_paste}</p>
                          </div>
                        </div>
                      )}

                      {qw.impact && (
                        <div className="ml-4 sm:ml-9 flex items-start gap-2">
                          <TrendingUp className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-foreground/70">{qw.impact}</p>
                        </div>
                      )}

                      {qw.link && (
                        <div className="ml-4 sm:ml-9 mt-2">
                          <a href={qw.link} className="text-xs text-blue-500 hover:underline flex items-center gap-1">
                            Vai alla configurazione <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Segnali di successo ── */}
            {(report.success_signals?.length || report.success_metrics?.length) && (
              <section id="segnali" ref={setChapterRef("segnali")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'segnali')?.number}
                  title="Come sai che funziona"
                  subtitle="Segnali concreti nella piattaforma — non KPI astratti"
                />

                {report.success_signals && report.success_signals.length > 0 && (
                  <div className="space-y-4 mb-8">
                    {report.success_signals.map((sig, i) => (
                      <div key={i} className="grid grid-cols-1 sm:grid-cols-[120px_1fr] gap-2 sm:gap-4 py-4 border-b border-border/30 last:border-0 print:break-inside-avoid">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-1">Entro</p>
                          <p className="text-sm font-semibold text-foreground">{sig.timeframe}</p>
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground/80"><span className="font-medium">Dove guardare:</span> {sig.where_to_look}</p>
                          </div>
                          <div className="flex items-start gap-2">
                            <CheckSquare className="w-3.5 h-3.5 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <p className="text-sm text-foreground/80"><span className="font-medium">Cosa cerchi:</span> {sig.what_to_find}</p>
                          </div>
                          {sig.what_it_means && (
                            <p className="text-xs text-muted-foreground pl-5 italic">{sig.what_it_means}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {report.success_metrics && report.success_metrics.length > 0 && (
                  <>
                    {report.success_signals?.length && <SectionDivider label="KPI da monitorare" />}
                    <div className="grid md:grid-cols-2 gap-4 mt-6">
                      {report.success_metrics.map((metric, i) => (
                        <div key={i} className="py-3 print:break-inside-avoid">
                          <h4 className="font-semibold text-sm text-foreground mb-2">{metric.kpi}</h4>
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-2 text-xs text-foreground/70">
                              <Target className="w-3 h-3 text-muted-foreground/60" />
                              <span className="text-muted-foreground">Target:</span> {metric.target}
                            </div>
                            <div className="flex items-start gap-2 text-xs text-foreground/70">
                              <BarChart3 className="w-3 h-3 text-muted-foreground/60 mt-0.5 flex-shrink-0" />
                              <span><span className="text-muted-foreground">Come misurare:</span> {metric.measurement}</span>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-foreground/70">
                              <Clock className="w-3 h-3 text-muted-foreground/60" />
                              <span className="text-muted-foreground">Quando:</span> {metric.timeframe}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}

            {/* ── Avvertimento onesto + azioni immediate ── */}
            {(report.honest_warning || report.priority_actions?.length) && (
              <section id="avvertimento" ref={setChapterRef("avvertimento")} className="mb-10 sm:mb-14 print:break-before-page">
                <SectionTitle
                  number={chapters.find(c => c.id === 'avvertimento')?.number}
                  title="Quello che devi sapere"
                  subtitle="Senza questi, il resto non gira"
                />

                {report.honest_warning && (
                  <div className="mb-8">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">Avvertimento onesto</p>
                    <div className="space-y-3">
                      {report.honest_warning.split('\n\n').map((para, i) => (
                        <p key={i} className="text-sm sm:text-[15px] leading-7 sm:leading-8 text-foreground/80 break-words">
                          <RichText text={para} />
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {report.priority_actions && report.priority_actions.length > 0 && (
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-4">Le 3 azioni di questa settimana</p>
                    <div className="space-y-5">
                      {report.priority_actions.map((action, i) => (
                        <div key={i} className="print:break-inside-avoid">
                          <div className="flex gap-4">
                            <span className="text-[10px] font-bold text-muted-foreground/30 mt-1 w-4 flex-shrink-0">{i + 1}</span>
                            <div className="flex-1">
                              <h4 className="font-semibold text-sm text-foreground mb-1">{action.titolo}</h4>
                              <p className="text-sm text-foreground/75 leading-relaxed mb-2">
                                <RichText text={action.descrizione} />
                              </p>
                              <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                                {action.tempo && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{action.tempo}</span>}
                                {action.impatto && <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3 text-emerald-500" />{action.impatto}</span>}
                              </div>
                              {action.testi_pronti && (action.testi_pronti.messaggio_whatsapp || action.testi_pronti.email_template || action.testi_pronti.script_chiamata) && (
                                <div className="space-y-3 mt-3 pt-3 border-t border-border/30">
                                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Testi pronti da copiare</p>
                                  {action.testi_pronti.messaggio_whatsapp && (
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">WhatsApp</span>
                                      </div>
                                      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30 rounded-lg px-4 py-3">
                                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{action.testi_pronti.messaggio_whatsapp}</p>
                                      </div>
                                    </div>
                                  )}
                                  {action.testi_pronti.email_template && (
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Email</span>
                                      </div>
                                      <div className="bg-blue-50/50 dark:bg-blue-950/20 border border-blue-200/50 dark:border-blue-800/30 rounded-lg px-4 py-3">
                                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{action.testi_pronti.email_template}</p>
                                      </div>
                                    </div>
                                  )}
                                  {action.testi_pronti.script_chiamata && (
                                    <div>
                                      <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-[10px] font-semibold text-violet-600 dark:text-violet-400">Script Chiamata</span>
                                      </div>
                                      <div className="bg-violet-50/50 dark:bg-violet-950/20 border border-violet-200/50 dark:border-violet-800/30 rounded-lg px-4 py-3">
                                        <p className="text-sm text-foreground/85 leading-relaxed whitespace-pre-wrap">{action.testi_pronti.script_chiamata}</p>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── Chiusura ── */}
            {report.closing_message && (
              <section id="chiusura" ref={setChapterRef("chiusura")} className="mb-10 sm:mb-14 print:break-before-page">
                <div className="border-t border-border/40 pt-10 max-w-lg">
                  <div className="space-y-4">
                    {report.closing_message.split('\n\n').map((para, i) => (
                      <p key={i} className="text-sm sm:text-[15px] leading-7 sm:leading-8 text-foreground/70 italic break-words">
                        <RichText text={para} />
                      </p>
                    ))}
                  </div>
                </div>
              </section>
            )}

            {!isPublic && funnelId && (
              <section id="funnel" ref={setChapterRef("funnel")} className="mb-10 sm:mb-14 print:hidden">
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-violet-50 dark:from-indigo-950/30 dark:to-violet-950/30 p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-foreground mb-1">Funnel Personalizzato Generato</h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        Leonardo ha creato un funnel di vendita personalizzato basato su questo report. Visualizzalo nel Funnel Builder per personalizzarlo ulteriormente.
                      </p>
                      <Button
                        size="sm"
                        className="gap-1.5 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                        onClick={() => window.location.href = `/consultant/content-studio/ideas?tab=funnel&funnel=${funnelId}`}
                      >
                        <Layers className="w-3.5 h-3.5" /> Apri nel Funnel Builder
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {isPublic && !publicFunnelData && !funnelId && (
              <section className="mb-10 sm:mb-14">
                <div className="rounded-xl border border-indigo-200/30 bg-indigo-50/30 dark:bg-indigo-950/10 p-4 sm:p-6 text-center">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center mx-auto mb-4">
                    <Layers className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-base font-bold text-foreground mb-2">Genera il Tuo Percorso Strategico</h3>
                  <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto leading-relaxed">
                    Crea un funnel personalizzato basato sulla tua analisi per visualizzare il percorso passo dopo passo
                  </p>
                  <Button
                    onClick={handleGenerateFunnel}
                    disabled={funnelLoading}
                    className="gap-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white hover:from-indigo-600 hover:to-purple-600"
                  >
                    {funnelLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
                    {funnelLoading ? "Generazione in corso..." : "Genera Funnel Personalizzato"}
                  </Button>
                </div>
              </section>
            )}

            {isPublic && publicFunnelData && publicFunnelData.nodes && (
              <section id="funnel" ref={setChapterRef("funnel")} className="mb-10 sm:mb-14 print:break-before-page">
                <div className="mb-6">
                  <h2 className="text-lg font-bold text-foreground mb-1">Il Tuo Percorso Strategico</h2>
                  <p className="text-xs text-muted-foreground">Ecco il funnel personalizzato creato per te basato sulla nostra analisi</p>
                </div>
                <div className="space-y-3">
                  {(publicFunnelData.nodes as any[])
                    .filter((n: any) => n.data?.label)
                    .sort((a: any, b: any) => (a.position?.y || 0) - (b.position?.y || 0))
                    .map((node: any, idx: number, arr: any[]) => {
                      const isLast = idx === arr.length - 1;
                      const nodeType = node.data?.nodeType || node.type || "";
                      const phaseColors: Record<string, string> = {
                        awareness: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
                        interesse: "border-l-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20",
                        considerazione: "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
                        conversione: "border-l-green-400 bg-green-50/50 dark:bg-green-950/20",
                        fidelizzazione: "border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/20",
                      };
                      const phase = node.data?.phase || "";
                      const colorClass = phaseColors[phase] || "border-l-gray-300 bg-gray-50/50 dark:bg-gray-800/20";
                      return (
                        <div key={node.id}>
                          <div className={cn("rounded-lg border border-border/50 border-l-4 p-4", colorClass)}>
                            <div className="flex items-start gap-3">
                              <div className="w-7 h-7 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 text-xs font-bold text-foreground/60">
                                {idx + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1">
                                  <h3 className="text-sm font-semibold text-foreground">{node.data.label}</h3>
                                  {phase && (
                                    <span className="text-[9px] uppercase tracking-wider font-medium text-muted-foreground/60 bg-foreground/5 px-1.5 py-0.5 rounded">
                                      {phase}
                                    </span>
                                  )}
                                </div>
                                {node.data.description && (
                                  <p className="text-xs text-muted-foreground leading-relaxed">{node.data.description}</p>
                                )}
                                {nodeType && (
                                  <span className="inline-block mt-1.5 text-[10px] text-muted-foreground/50 capitalize">{nodeType.replace(/_/g, ' ')}</span>
                                )}
                              </div>
                            </div>
                          </div>
                          {!isLast && (
                            <div className="flex justify-center py-1">
                              <ArrowDown className="w-4 h-4 text-muted-foreground/30" />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </section>
            )}

            {/* Footer */}
            <div className="border-t border-border/30 py-6 text-xs text-muted-foreground/40 text-center">
              Documento riservato — uso esclusivo del destinatario
            </div>
            <div className="h-8 print:hidden" />
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          .print\\:max-w-none { max-width: none !important; }
          .print\\:px-12 { padding-left: 3rem !important; padding-right: 3rem !important; }
          .print\\:py-20 { padding-top: 5rem !important; padding-bottom: 5rem !important; }
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
