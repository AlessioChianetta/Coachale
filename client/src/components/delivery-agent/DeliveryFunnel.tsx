import { useState, useEffect, useRef } from "react";
import { getAuthHeaders } from "@/lib/auth";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ArrowDown,
  Loader2,
  GitBranch,
  ExternalLink,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  StickyNote,
} from "lucide-react";

interface DeliveryFunnelProps {
  sessionId: string;
  publicToken?: string;
  onBackToChat?: () => void;
}

interface FunnelNode {
  id: string;
  type?: string;
  position?: { x: number; y: number };
  data?: {
    label?: string;
    subtitle?: string;
    description?: string;
    category?: string;
    notes?: string;
    nodeType?: string;
    phase?: string;
  };
}

interface FunnelData {
  id: string;
  name: string;
  description?: string;
  nodes: FunnelNode[];
  edges?: any[];
  theme?: string;
  leadName?: string;
  createdAt?: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  sorgenti: "border-l-blue-400 bg-blue-50/50 dark:bg-blue-950/20",
  cattura: "border-l-cyan-400 bg-cyan-50/50 dark:bg-cyan-950/20",
  gestione: "border-l-amber-400 bg-amber-50/50 dark:bg-amber-950/20",
  comunicazione: "border-l-orange-400 bg-orange-50/50 dark:bg-orange-950/20",
  conversione: "border-l-green-400 bg-green-50/50 dark:bg-green-950/20",
  delivery: "border-l-violet-400 bg-violet-50/50 dark:bg-violet-950/20",
  custom: "border-l-gray-400 bg-gray-50/50 dark:bg-gray-800/20",
};

const CATEGORY_DOT: Record<string, string> = {
  sorgenti: "bg-blue-400",
  cattura: "bg-cyan-400",
  gestione: "bg-amber-400",
  comunicazione: "bg-orange-400",
  conversione: "bg-green-400",
  delivery: "bg-violet-400",
  custom: "bg-gray-400",
};

export function DeliveryFunnel({ sessionId, publicToken, onBackToChat }: DeliveryFunnelProps) {
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState("");
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const hasFetchedOnce = useRef(false);

  const isPublic = !!publicToken;

  const fetchFunnel = async () => {
    try {
      if (!hasFetchedOnce.current) setInitialLoading(true);
      setError("");

      let res;
      if (isPublic) {
        res = await fetch(`/api/public/lead-magnet/${publicToken}/funnel`);
      } else {
        res = await fetch(`/api/funnels/by-session/${sessionId}`, { headers: getAuthHeaders() });
      }

      if (res.ok) {
        const data = await res.json();
        if (isPublic) {
          if (data.data) {
            setFunnel(data.data);
          } else {
            setFunnel(null);
          }
        } else {
          if (data.id) {
            setFunnel({
              id: data.id,
              name: data.name,
              description: data.description,
              nodes: data.nodes_data || [],
              edges: data.edges_data || [],
              theme: data.theme,
              leadName: data.lead_name,
              createdAt: data.created_at,
            });
          } else {
            setFunnel(null);
          }
        }
      } else if (res.status === 404) {
        setFunnel(null);
      } else {
        setError("Errore nel caricamento del funnel");
      }
    } catch (err) {
      console.error("[DeliveryFunnel] Fetch error:", err);
      setError("Errore di connessione");
    } finally {
      hasFetchedOnce.current = true;
      setInitialLoading(false);
    }
  };

  useEffect(() => {
    fetchFunnel();
    const interval = setInterval(fetchFunnel, 15000);
    return () => clearInterval(interval);
  }, [sessionId, publicToken]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      let res;
      if (isPublic) {
        res = await fetch(`/api/public/lead-magnet/${publicToken}/generate-funnel`, { method: "POST" });
      } else {
        res = await fetch("/api/funnels/generate-from-report", {
          method: "POST",
          headers: { ...getAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
      }
      if (res.ok) {
        await fetchFunnel();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Errore nella generazione");
      }
    } catch (err) {
      setError("Errore di connessione");
    } finally {
      setGenerating(false);
    }
  };

  const toggleNotes = (nodeId: string) => {
    setExpandedNotes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Caricamento funnel...</p>
        </div>
      </div>
    );
  }

  if (!funnel || !funnel.nodes || funnel.nodes.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 max-w-sm text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <GitBranch className="w-7 h-7 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold mb-1">Funnel non ancora disponibile</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {generating
                ? "Leonardo sta costruendo il tuo funnel personalizzato..."
                : "Genera il funnel basato sull'analisi del report per visualizzare il percorso strategico."}
            </p>
          </div>
          <Button
            onClick={handleGenerate}
            disabled={generating}
            size="sm"
            className="gap-2"
          >
            {generating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Generazione in corso...
              </>
            ) : (
              <>
                <GitBranch className="w-4 h-4" />
                Genera Funnel
              </>
            )}
          </Button>
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>
      </div>
    );
  }

  const sortedNodes = [...funnel.nodes]
    .filter((n) => n.data?.label)
    .sort((a, b) => (a.position?.y || 0) - (b.position?.y || 0));

  return (
    <div className="flex-1 flex flex-col h-full">
      <ScrollArea className="flex-1">
        <div className="max-w-lg mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-base font-bold text-foreground">{funnel.name || "Funnel Strategico"}</h2>
              {funnel.leadName && (
                <p className="text-xs text-muted-foreground mt-0.5">Personalizzato per {funnel.leadName}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchFunnel}
                className="h-8 w-8 p-0"
                title="Aggiorna"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </Button>
              {!isPublic && funnel.id && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs h-8"
                  onClick={() => window.open(`/consultant/funnel-builder?funnel=${funnel.id}`, "_blank")}
                >
                  <ExternalLink className="w-3 h-3" />
                  Apri Builder
                </Button>
              )}
            </div>
          </div>

          {funnel.description && (
            <div className="mb-5 p-3 rounded-lg bg-muted/50 border border-border/50">
              <p className="text-xs text-muted-foreground leading-relaxed">{funnel.description}</p>
            </div>
          )}

          <div className="space-y-2">
            {sortedNodes.map((node, idx) => {
              const isLast = idx === sortedNodes.length - 1;
              const category = node.data?.category || "";
              const colorClass = CATEGORY_COLORS[category] || "border-l-gray-300 bg-gray-50/50 dark:bg-gray-800/20";
              const dotClass = CATEGORY_DOT[category] || "bg-gray-400";
              const hasNotes = !!node.data?.notes;
              const isExpanded = expandedNotes.has(node.id);

              return (
                <div key={node.id}>
                  <div className={cn("rounded-lg border border-border/50 border-l-4 p-3.5", colorClass)}>
                    <div className="flex items-start gap-3">
                      <div className="w-6 h-6 rounded-full bg-foreground/10 flex items-center justify-center shrink-0 text-xs font-bold text-foreground/60">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <h3 className="text-sm font-semibold text-foreground">{node.data?.label}</h3>
                          {category && (
                            <span className="flex items-center gap-1 text-[9px] uppercase tracking-wider font-medium text-muted-foreground/60 bg-foreground/5 px-1.5 py-0.5 rounded">
                              <span className={cn("w-1.5 h-1.5 rounded-full", dotClass)} />
                              {category}
                            </span>
                          )}
                        </div>
                        {node.data?.subtitle && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{node.data.subtitle}</p>
                        )}
                        {node.data?.description && !node.data?.subtitle && (
                          <p className="text-xs text-muted-foreground leading-relaxed">{node.data.description}</p>
                        )}
                        {node.type && (
                          <span className="inline-block mt-1 text-[10px] text-muted-foreground/50 capitalize">
                            {node.type.replace(/_/g, " ")}
                          </span>
                        )}

                        {hasNotes && (
                          <button
                            onClick={() => toggleNotes(node.id)}
                            className="mt-2 flex items-center gap-1 text-[10px] text-primary/70 hover:text-primary transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            <StickyNote className="w-3 h-3" />
                            Note strategiche
                          </button>
                        )}
                        {hasNotes && isExpanded && (
                          <div className="mt-1.5 pl-4 border-l-2 border-primary/20">
                            <p className="text-[11px] text-muted-foreground/80 leading-relaxed italic">
                              {node.data?.notes}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {!isLast && (
                    <div className="flex justify-center py-0.5">
                      <ArrowDown className="w-3.5 h-3.5 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-6 pt-4 border-t border-border/30 flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground/40">{sortedNodes.length} step nel funnel</p>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleGenerate}
              disabled={generating}
              className="gap-1.5 text-xs h-7"
            >
              {generating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Rigenera
            </Button>
          </div>
        </div>
      </ScrollArea>
    </div>
  );
}
