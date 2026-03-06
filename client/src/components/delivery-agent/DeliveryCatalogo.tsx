import { useState, useEffect, useRef, useCallback } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  ArrowLeft, Share2, Loader2, BookOpen,
  CheckCircle2, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface CatalogPackage {
  package_name: string;
  icon: string;
  subtitle: string;
  score: number;
  score_label: string;
  whats_good: string;
  whats_wrong: string;
  critical_diagnosis?: string | null;
  how_to_fix: string[];
  description: string;
  examples: string[];
  modules: string[];
  already_recommended: boolean;
}

function normalizeCatalog(raw: any[]): CatalogPackage[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((p: any) => ({
    package_name: p.nome_pacchetto || p.package_name || "",
    icon: p.icona || p.icon || "",
    subtitle: p.sottotitolo || p.subtitle || "",
    score: p.punteggio ?? p.score ?? 5,
    score_label: p.punteggio_label || p.score_label || "",
    whats_good: p.cosa_va_bene || p.whats_good || "",
    whats_wrong: p.cosa_non_funziona || p.whats_wrong || "",
    critical_diagnosis: p.diagnosi_critica || p.critical_diagnosis || null,
    how_to_fix: Array.isArray(p.come_correggere || p.how_to_fix)
      ? (p.come_correggere || p.how_to_fix)
      : [],
    description: p.descrizione_personalizzata || p.description || "",
    examples: Array.isArray(p.esempi_concreti || p.examples)
      ? (p.esempi_concreti || p.examples)
      : [],
    modules: Array.isArray(p.moduli || p.modules)
      ? (p.moduli || p.modules)
      : [],
    already_recommended: p.gia_consigliato ?? p.already_recommended ?? false,
  }));
}

function RichText({ text, className }: { text: string; className?: string }) {
  if (!text) return null;
  if (!text.includes("**")) return <span className={className}>{text}</span>;
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return (
    <span className={className}>
      {parts.map((part, i) =>
        part.startsWith("**") && part.endsWith("**") ? (
          <strong key={i} className="font-semibold text-foreground">
            {part.slice(2, -2)}
          </strong>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </span>
  );
}

interface DeliveryCatalogoProps {
  sessionId: string;
  onBackToChat: () => void;
}

interface SidebarChapter {
  id: string;
  number: string;
  title: string;
  subtitle: string;
  score: number;
  already_recommended: boolean;
}

export function DeliveryCatalogo({ sessionId, onBackToChat }: DeliveryCatalogoProps) {
  const { toast } = useToast();
  const [packages, setPackages] = useState<CatalogPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeChapter, setActiveChapter] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const chapterRefs = useRef<Record<string, HTMLDivElement | null>>({});

  useEffect(() => {
    const loadCatalog = async () => {
      try {
        const res = await fetch(
          `/api/consultant/delivery-agent/reports/${sessionId}`,
          { headers: getAuthHeaders() }
        );
        if (res.ok) {
          const data = await res.json();
          const reportData = data.data || data.report || data;
          let rawReport = reportData.report_json || reportData;
          if (typeof rawReport === "string") {
            try { rawReport = JSON.parse(rawReport); } catch { rawReport = {}; }
          }
          const catalogRaw = rawReport.catalogo_completo || rawReport.catalog || [];
          setPackages(normalizeCatalog(catalogRaw));
        }
      } catch (err) {
        console.error("Failed to load catalog:", err);
        toast({ title: "Errore", description: "Impossibile caricare il catalogo", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };
    loadCatalog();
  }, [sessionId, toast]);

  const chapters: SidebarChapter[] = packages.map((pkg, i) => ({
    id: `cat-${i}`,
    number: String(i + 1).padStart(2, "0"),
    title: pkg.package_name,
    subtitle: pkg.subtitle,
    score: pkg.score,
    already_recommended: pkg.already_recommended,
  }));


  const scrollToChapter = useCallback((id: string) => {
    const el = chapterRefs.current[id];
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveChapter(id);
    }
  }, []);

  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (packages.length === 0) return;
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveChapter(entry.target.id);
            break;
          }
        }
      },
      { rootMargin: "-80px 0px -60% 0px", threshold: 0.05 }
    );
    Object.values(chapterRefs.current).forEach((el) => {
      if (el) observerRef.current?.observe(el);
    });
    return () => observerRef.current?.disconnect();
  }, [packages]);

  const setChapterRefWithObserver = useCallback(
    (id: string) => (el: HTMLDivElement | null) => {
      chapterRefs.current[id] = el;
      if (el && observerRef.current) {
        observerRef.current.observe(el);
      }
    },
    []
  );

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast({ title: "Link copiato" });
    } catch {
      toast({ title: "Errore", variant: "destructive" });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (packages.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center space-y-3">
          <p className="text-muted-foreground text-sm">Catalogo non ancora disponibile</p>
          <Button variant="outline" size="sm" onClick={onBackToChat} className="gap-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Torna alla chat
          </Button>
        </div>
      </div>
    );
  }

  const scoreColor = (s: number) =>
    s >= 7
      ? "border-emerald-400 text-emerald-600"
      : s >= 4
        ? "border-amber-400 text-amber-600"
        : "border-red-400 text-red-600";

  const scoreBg = (s: number) =>
    s >= 7
      ? "bg-emerald-500"
      : s >= 4
        ? "bg-amber-500"
        : "bg-red-500";

  return (
    <div className="flex h-full bg-background">
      <AnimatePresence>
        {sidebarOpen && chapters.length > 0 && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 240, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex-shrink-0 border-r border-border/50 bg-card overflow-hidden"
          >
            <div className="p-4 border-b border-border/40">
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Catalogo Pacchetti
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                {packages.length} pacchetti · {packages.filter((p) => p.already_recommended).length} nel tuo piano
              </p>
            </div>
            <div className="p-2 space-y-0.5 overflow-y-auto h-[calc(100%-65px)]">
              {chapters.map((ch) => (
                <button
                  key={ch.id}
                  onClick={() => scrollToChapter(ch.id)}
                  className={cn(
                    "w-full text-left px-3 py-2 rounded-lg transition-colors group",
                    activeChapter === ch.id
                      ? "bg-foreground/5"
                      : "hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "text-[9px] font-bold w-4 h-4 rounded flex items-center justify-center flex-shrink-0",
                        activeChapter === ch.id
                          ? "bg-foreground text-background"
                          : "text-muted-foreground/50"
                      )}
                    >
                      {ch.number}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p
                          className={cn(
                            "text-xs truncate leading-tight",
                            activeChapter === ch.id
                              ? "font-semibold text-foreground"
                              : "text-foreground/70"
                          )}
                        >
                          {ch.title}
                        </p>
                        <div
                          className={cn(
                            "w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0",
                            scoreColor(ch.score)
                          )}
                        >
                          <span className="text-[8px] font-bold leading-none">
                            {ch.score}
                          </span>
                        </div>
                      </div>
                      {ch.already_recommended && (
                        <p className="text-[9px] text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5 mt-0.5">
                          <CheckCircle2 className="w-2.5 h-2.5" />
                          Nel tuo piano
                        </p>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 bg-card flex-shrink-0">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBackToChat}
              className="gap-1.5 text-xs"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Chat
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen((v) => !v)}
              className="gap-1.5 text-xs"
            >
              <BookOpen className="w-3.5 h-3.5" />
              {sidebarOpen ? "Nascondi indice" : "Indice"}
            </Button>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleShare}
              className="gap-1.5 text-xs"
            >
              <Share2 className="w-3.5 h-3.5" /> Condividi
            </Button>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="max-w-[720px] mx-auto px-8 py-10">
            <div className="pt-4 pb-10">
              <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground/60">
                Catalogo Completo
              </p>
              <h1 className="text-3xl font-bold text-foreground tracking-tight leading-tight mt-1">
                Tutti i Pacchetti Servizio
              </h1>
              <p className="text-sm text-muted-foreground mt-2">
                Analisi personalizzata di tutti i 10 pacchetti della piattaforma, basata sulla tua discovery.
              </p>
            </div>

            {packages.map((pkg, i) => {
              const chId = `cat-${i}`;
              return (
                <section
                  key={i}
                  id={chId}
                  ref={setChapterRefWithObserver(chId)}
                  className="mb-16"
                >
                  <div className="mb-8 pb-5 border-b border-border/40">
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="flex items-baseline gap-3">
                        <span className="text-4xl font-thin text-muted-foreground/20 leading-none tracking-tight select-none">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <div>
                          <h2 className="text-[22px] font-bold text-foreground tracking-tight leading-tight">
                            {pkg.package_name}
                          </h2>
                          {pkg.subtitle && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                              {pkg.subtitle}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {pkg.already_recommended && (
                          <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            Nel tuo piano
                          </span>
                        )}
                        <div
                          className={cn(
                            "w-12 h-12 rounded-full border-2 flex flex-col items-center justify-center",
                            scoreColor(pkg.score)
                          )}
                        >
                          <span className="text-base font-bold leading-none">
                            {pkg.score}
                          </span>
                          <span className="text-[7px] text-muted-foreground">
                            /10
                          </span>
                        </div>
                      </div>
                    </div>
                    {pkg.score_label && (
                      <p className="text-xs text-muted-foreground mt-2 ml-[52px]">
                        {pkg.score_label}
                      </p>
                    )}
                  </div>

                  <div className="space-y-7">
                    {(pkg.whats_good || pkg.whats_wrong) && (
                      <div className="grid md:grid-cols-2 gap-5">
                        {pkg.whats_good && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/70 dark:text-emerald-400/70 mb-3">
                              Cosa funziona già
                            </p>
                            <div className="space-y-3">
                              {pkg.whats_good.split("\n\n").map((p, j) => (
                                <p
                                  key={j}
                                  className="text-sm leading-relaxed text-foreground/80"
                                >
                                  <RichText text={p} />
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                        {pkg.whats_wrong && (
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-amber-600/70 dark:text-amber-400/70 mb-3">
                              Cosa non funziona
                            </p>
                            <div className="space-y-3">
                              {pkg.whats_wrong.split("\n\n").map((p, j) => (
                                <p
                                  key={j}
                                  className="text-sm leading-relaxed text-foreground/80"
                                >
                                  <RichText text={p} />
                                </p>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {pkg.critical_diagnosis && (
                      <div className="border-l-[3px] border-l-red-500 bg-red-50/40 dark:bg-red-900/10 pl-4 py-3 rounded-r-lg">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-red-600/70 dark:text-red-400/70 mb-1">
                              Diagnosi critica
                            </p>
                            <p className="text-sm leading-relaxed text-foreground/85">
                              <RichText text={pkg.critical_diagnosis} />
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {pkg.how_to_fix && pkg.how_to_fix.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
                          Come correggere — Azioni concrete
                        </p>
                        <div className="space-y-2.5">
                          {pkg.how_to_fix.map((action, j) => (
                            <div key={j} className="flex items-start gap-3">
                              <div className="w-5 h-5 rounded-full bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center flex-shrink-0 mt-0.5">
                                <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400">
                                  {j + 1}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/80 leading-relaxed">
                                <RichText
                                  text={action.replace(/^→\s*/, "")}
                                />
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.description && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
                          Come si applica al tuo caso
                        </p>
                        <div className="space-y-3">
                          {pkg.description.split("\n\n").map((p, j) => (
                            <p
                              key={j}
                              className="text-[15px] leading-8 text-foreground/80"
                            >
                              <RichText text={p} />
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.examples && pkg.examples.length > 0 && (
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 mb-3">
                          Esempi concreti
                        </p>
                        <div className="space-y-2">
                          {pkg.examples.map((ex, j) => (
                            <div
                              key={j}
                              className="border-l-2 border-border/40 pl-4 py-1"
                            >
                              <p className="text-sm text-foreground/70 italic leading-relaxed">
                                {ex}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {pkg.modules && pkg.modules.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">
                            Moduli inclusi
                          </p>
                          <span className="text-[10px] text-muted-foreground/50">
                            {pkg.modules.length} moduli
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {pkg.modules.map((mod, j) => (
                            <span
                              key={j}
                              className="px-2.5 py-1 text-xs rounded-full bg-muted/50 text-muted-foreground border border-border/30"
                            >
                              {typeof mod === "string" ? mod : (mod as any).name || (mod as any).nome || ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}

            <div className="border-t border-border/30 py-6 text-xs text-muted-foreground/40 text-center">
              Catalogo completo — {packages.length} pacchetti analizzati
            </div>
            <div className="h-8" />
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
