import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Loader2, Pencil, Package, Sparkles, Wand2,
  ToggleLeft, ToggleRight, Star, ShoppingCart, Eye, EyeOff,
  GripVertical, Link2, CreditCard, AlertTriangle, Info, ExternalLink,
} from "lucide-react";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface CatalogItem {
  id: string;
  consultantId: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  icon: string;
  category: string;
  itemType: string;
  bundleItems: string[] | null;
  priceCents: number;
  originalPriceCents: number | null;
  currency: string;
  billingType: string;
  paymentMode: string;
  stripePriceId: string | null;
  stripeDirectLink: string | null;
  featuresUnlocked: string[];
  isActive: boolean;
  isFeatured: boolean;
  sortOrder: number;
  badgeText: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SaleRecord {
  id: string;
  buyerUserId: string;
  catalogItemId: string;
  amountCents: number;
  status: string;
  purchasedAt: string;
}

const CATEGORIES = [
  { value: "ai", label: "AI" },
  { value: "marketing", label: "Marketing" },
  { value: "automation", label: "Automazione" },
  { value: "communication", label: "Comunicazione" },
  { value: "analytics", label: "Analytics" },
  { value: "other", label: "Altro" },
];

const BILLING_TYPES = [
  { value: "one_time", label: "Una tantum" },
  { value: "monthly", label: "Mensile" },
  { value: "yearly", label: "Annuale" },
];

const PAYMENT_MODES = [
  { value: "connect", label: "Stripe Connect (50%)", description: "Pagamento tramite piattaforma, 50% revenue share" },
  { value: "direct", label: "Diretto (100%)", description: "Il tuo link Stripe, 100% a te" },
];

const DEFAULT_FORM: Partial<CatalogItem> = {
  name: "",
  description: "",
  shortDescription: "",
  icon: "📦",
  category: "other",
  itemType: "single",
  bundleItems: null,
  priceCents: 0,
  originalPriceCents: null,
  currency: "eur",
  billingType: "monthly",
  paymentMode: "connect",
  stripePriceId: null,
  stripeDirectLink: null,
  featuresUnlocked: [],
  isActive: true,
  isFeatured: false,
  sortOrder: 0,
  badgeText: null,
};

function formatPrice(cents: number) {
  return `€${(cents / 100).toFixed(2)}`;
}

function billingLabel(bt: string) {
  return BILLING_TYPES.find(b => b.value === bt)?.label || bt;
}

function categoryLabel(cat: string) {
  return CATEGORIES.find(c => c.value === cat)?.label || cat;
}

export default function ConsultantCatalogSettings() {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CatalogItem | null>(null);
  const [form, setForm] = useState<Partial<CatalogItem>>(DEFAULT_FORM);
  const [creationMode, setCreationMode] = useState<"ai-prompt" | "manual-ai" | "manual">("manual");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  const { data: catalogData, isLoading } = useQuery({
    queryKey: ["/api/consultant/catalog"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/catalog", { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      const data = await res.json();
      return data.data as CatalogItem[];
    },
  });

  const { data: salesData } = useQuery({
    queryKey: ["/api/consultant/catalog/sales"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/catalog/sales", { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []) as SaleRecord[];
    },
  });

  const { data: stripeConnectStatus } = useQuery({
    queryKey: ["/api/consultant/stripe-connect/status"],
    queryFn: async () => {
      const res = await fetch("/api/consultant/stripe-connect/status", { headers: getAuthHeaders() });
      if (!res.ok) return { connected: false, onboarded: false };
      return await res.json();
    },
  });

  const hasStripeConnect = !!(stripeConnectStatus?.onboarded);
  const defaultPaymentMode = hasStripeConnect ? "connect" : "direct";

  const items = catalogData || [];
  const sales = salesData || [];

  const singleItems = useMemo(() => items.filter(i => i.itemType === "single"), [items]);

  const saveMutation = useMutation({
    mutationFn: async (payload: Partial<CatalogItem>) => {
      const isEdit = !!editingItem;
      const url = isEdit
        ? `/api/consultant/catalog/${editingItem!.id}`
        : "/api/consultant/catalog";
      const method = isEdit ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Errore nel salvataggio");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/catalog"] });
      toast({ title: editingItem ? "Prodotto aggiornato" : "Prodotto creato" });
      closeModal();
    },
    onError: (err: any) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/catalog/${id}/toggle`, {
        method: "PATCH",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore toggle");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/catalog"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/consultant/catalog/${id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Errore eliminazione");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/consultant/catalog"] });
      toast({ title: "Prodotto disattivato" });
    },
  });

  function openCreateModal() {
    setEditingItem(null);
    setForm({ ...DEFAULT_FORM, paymentMode: defaultPaymentMode });
    setPriceInput("");
    setCreationMode("manual");
    setAiPrompt("");
    setModalOpen(true);
  }

  function openEditModal(item: CatalogItem) {
    setEditingItem(item);
    setForm({ ...item });
    setPriceInput((item.priceCents / 100).toFixed(2));
    setCreationMode("manual");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingItem(null);
    setForm({ ...DEFAULT_FORM });
    setPriceInput("");
    setAiPrompt("");
    setAiLoading(false);
  }

  function handlePriceChange(val: string) {
    setPriceInput(val);
    const num = parseFloat(val);
    if (!isNaN(num)) {
      setForm(prev => ({ ...prev, priceCents: Math.round(num * 100) }));
    }
  }

  async function handleAiGenerate() {
    if (!aiPrompt.trim()) return;
    setAiLoading(true);
    try {
      const res = await fetch("/api/consultant/catalog/ai-generate", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ prompt: aiPrompt }),
      });
      if (!res.ok) throw new Error("Errore AI");
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({
          ...prev,
          name: data.data.name || prev.name,
          description: data.data.description || prev.description,
          shortDescription: data.data.shortDescription || prev.shortDescription,
          icon: data.data.icon || prev.icon,
          category: data.data.category || prev.category,
          priceCents: data.data.priceCents || prev.priceCents,
          billingType: data.data.billingType || prev.billingType,
        }));
        setPriceInput(((data.data.priceCents || 0) / 100).toFixed(2));
        toast({ title: "AI ha generato il prodotto", description: "Rivedi e modifica prima di salvare" });
      }
    } catch (err: any) {
      toast({ title: "Errore AI", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  async function handleAiDescribe() {
    if (!form.name?.trim()) {
      toast({ title: "Inserisci il nome", description: "Il nome è necessario per generare la descrizione", variant: "destructive" });
      return;
    }
    setAiLoading(true);
    try {
      const res = await fetch("/api/consultant/catalog/ai-describe", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...getAuthHeaders() },
        body: JSON.stringify({ name: form.name, category: form.category, priceCents: form.priceCents }),
      });
      if (!res.ok) throw new Error("Errore AI");
      const data = await res.json();
      if (data.success && data.data) {
        setForm(prev => ({
          ...prev,
          description: data.data.description || prev.description,
          shortDescription: data.data.shortDescription || prev.shortDescription,
        }));
        toast({ title: "Descrizione generata dall'AI" });
      }
    } catch (err: any) {
      toast({ title: "Errore AI", description: err.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  }

  function handleSave() {
    if (!form.name?.trim()) {
      toast({ title: "Nome richiesto", variant: "destructive" });
      return;
    }
    if (form.paymentMode === "connect" && !hasStripeConnect) {
      toast({ title: "Stripe Connect non configurato", description: "Configura Stripe Connect nelle impostazioni oppure usa la modalità Link Diretto", variant: "destructive" });
      return;
    }
    if (form.paymentMode === "direct" && !form.stripeDirectLink?.trim()) {
      toast({ title: "Link Stripe mancante", description: "Inserisci il tuo Stripe Payment Link per la modalità diretta", variant: "destructive" });
      return;
    }
    saveMutation.mutate(form);
  }

  function handleBundleToggle(itemId: string) {
    setForm(prev => {
      const current = prev.bundleItems || [];
      const next = current.includes(itemId)
        ? current.filter(id => id !== itemId)
        : [...current, itemId];

      const totalOriginal = singleItems
        .filter(i => next.includes(i.id))
        .reduce((sum, i) => sum + i.priceCents, 0);

      return {
        ...prev,
        bundleItems: next,
        originalPriceCents: totalOriginal > 0 ? totalOriginal : null,
      };
    });
  }

  const activeCount = items.filter(i => i.isActive).length;
  const draftCount = items.filter(i => !i.isActive).length;
  const totalRevenue = sales.reduce((sum, s) => sum + s.amountCents, 0);

  const CATEGORY_COLORS: Record<string, { bg: string; text: string; gradient: string; border: string }> = {
    ai: { bg: "bg-violet-100 dark:bg-violet-900/30", text: "text-violet-700 dark:text-violet-300", gradient: "from-violet-500 to-purple-600", border: "border-violet-200 dark:border-violet-800" },
    marketing: { bg: "bg-pink-100 dark:bg-pink-900/30", text: "text-pink-700 dark:text-pink-300", gradient: "from-pink-500 to-rose-600", border: "border-pink-200 dark:border-pink-800" },
    automation: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-300", gradient: "from-amber-500 to-orange-600", border: "border-amber-200 dark:border-amber-800" },
    communication: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-300", gradient: "from-emerald-500 to-teal-600", border: "border-emerald-200 dark:border-emerald-800" },
    analytics: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300", gradient: "from-blue-500 to-indigo-600", border: "border-blue-200 dark:border-blue-800" },
    other: { bg: "bg-slate-100 dark:bg-slate-900/30", text: "text-slate-700 dark:text-slate-300", gradient: "from-slate-500 to-gray-600", border: "border-slate-200 dark:border-slate-800" },
  };

  const getCatColor = (cat: string) => CATEGORY_COLORS[cat] || CATEGORY_COLORS.other;

  return (
    <div className="flex h-screen bg-background">
      <Sidebar role="consultant" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">

          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-6 md:p-8">
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/4" />
            <div className="absolute bottom-0 left-0 w-40 h-40 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/4" />
            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                    <ShoppingCart className="w-5 h-5 text-white" />
                  </div>
                  <h1 className="text-2xl md:text-3xl font-bold text-white">Catalogo Servizi</h1>
                </div>
                <p className="text-white/70 text-sm md:text-base">
                  Gestisci i prodotti e servizi che vendi ai tuoi clienti
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-6 mr-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold text-white">{items.length}</p>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">Prodotti</p>
                  </div>
                  <div className="w-px h-10 bg-white/20" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-emerald-300">{activeCount}</p>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">Attivi</p>
                  </div>
                  <div className="w-px h-10 bg-white/20" />
                  <div className="text-center">
                    <p className="text-2xl font-bold text-amber-300">{draftCount}</p>
                    <p className="text-[10px] text-white/60 uppercase tracking-wider">Bozze</p>
                  </div>
                  {sales.length > 0 && (
                    <>
                      <div className="w-px h-10 bg-white/20" />
                      <div className="text-center">
                        <p className="text-2xl font-bold text-white">{formatPrice(totalRevenue)}</p>
                        <p className="text-[10px] text-white/60 uppercase tracking-wider">Ricavi</p>
                      </div>
                    </>
                  )}
                </div>
                <Button onClick={openCreateModal} className="bg-white text-violet-700 hover:bg-white/90 font-semibold gap-2 shadow-lg">
                  <Plus className="w-4 h-4" />
                  {isMobile ? "Nuovo" : "Nuovo Prodotto"}
                </Button>
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {[1,2,3,4,5,6,7,8].map(i => (
                <div key={i} className="rounded-xl border border-border/50 p-4 space-y-3 animate-pulse">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-muted" />
                    <div className="space-y-1.5 flex-1">
                      <div className="h-4 w-24 bg-muted rounded" />
                      <div className="h-3 w-16 bg-muted/60 rounded" />
                    </div>
                  </div>
                  <div className="h-3 w-full bg-muted/40 rounded" />
                  <div className="h-3 w-3/4 bg-muted/30 rounded" />
                  <div className="h-8 w-full bg-muted/20 rounded-lg mt-2" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="flex flex-col items-center justify-center py-20 text-center">
                <div className="relative mb-6">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-3xl rotate-6 opacity-20 blur-sm scale-110" />
                  <div className="relative w-20 h-20 rounded-3xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-xl">
                    <Package className="w-9 h-9 text-white" />
                  </div>
                </div>
                <h3 className="text-xl font-bold mb-2">Nessun prodotto nel catalogo</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-8">
                  Crea il tuo primo prodotto o servizio. Puoi farlo manualmente, con l'aiuto dell'AI,
                  o lasciare che l'AI generi tutto da un semplice prompt.
                </p>
                <Button onClick={openCreateModal} size="lg" className="gap-2 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-lg shadow-violet-500/25">
                  <Sparkles className="w-4 h-4" />
                  Crea il tuo primo prodotto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {items.map(item => {
                const catColor = getCatColor(item.category);
                return (
                  <div
                    key={item.id}
                    className={cn(
                      "group relative rounded-xl border overflow-hidden transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 bg-card",
                      item.isActive
                        ? "border-border/60 hover:border-violet-300 dark:hover:border-violet-700"
                        : "border-dashed border-border/40 opacity-65"
                    )}
                  >
                    <div className={cn("h-1.5 bg-gradient-to-r", catColor.gradient)} />

                    <div className="absolute top-3.5 right-3 flex items-center gap-1 z-10">
                      {item.isFeatured && (
                        <div className="w-6 h-6 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center">
                          <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                        </div>
                      )}
                      <div className={cn(
                        "px-2 py-0.5 rounded-full text-[9px] font-semibold",
                        item.isActive
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      )}>
                        {item.isActive ? "Attivo" : "Bozza"}
                      </div>
                    </div>

                    <div className="p-4 pt-3">
                      <div className="flex items-start gap-3 mb-3">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center text-xl shrink-0",
                          catColor.bg, catColor.border, "border"
                        )}>
                          {item.icon}
                        </div>
                        <div className="flex-1 min-w-0 pr-14">
                          <h3 className="font-semibold text-sm leading-tight truncate">{item.name}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={cn("text-[10px] font-medium", catColor.text)}>
                              {categoryLabel(item.category)}
                            </span>
                            {item.itemType === "bundle" && (
                              <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-amber-300 text-amber-600 dark:border-amber-700 dark:text-amber-400">
                                Bundle
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {item.shortDescription && (
                        <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2 leading-relaxed min-h-[2rem]">
                          {item.shortDescription}
                        </p>
                      )}

                      {item.badgeText && (
                        <Badge className="mb-2.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[9px] font-semibold shadow-sm">
                          {item.badgeText}
                        </Badge>
                      )}

                      <div className="flex items-end justify-between mb-3">
                        <div>
                          {item.originalPriceCents && item.originalPriceCents > item.priceCents && (
                            <span className="text-[11px] text-muted-foreground/60 line-through block">
                              {formatPrice(item.originalPriceCents)}
                            </span>
                          )}
                          <div className="flex items-baseline gap-1">
                            <span className="text-xl font-bold">{formatPrice(item.priceCents)}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {item.billingType !== "one_time" ? `/${billingLabel(item.billingType)}` : ""}
                            </span>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={cn(
                            "text-[8px] font-semibold",
                            item.paymentMode === "connect"
                              ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          )}
                        >
                          {item.paymentMode === "connect" ? "Connect 50%" : "Diretto 100%"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1 pt-2.5 border-t border-border/40">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 flex-1 text-xs gap-1.5 hover:bg-violet-50 dark:hover:bg-violet-950/30"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="w-3 h-3" />
                          Modifica
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            "h-8 flex-1 text-xs gap-1.5",
                            item.isActive
                              ? "hover:bg-amber-50 dark:hover:bg-amber-950/30 text-amber-600"
                              : "hover:bg-emerald-50 dark:hover:bg-emerald-950/30 text-emerald-600"
                          )}
                          onClick={() => toggleMutation.mutate(item.id)}
                        >
                          {item.isActive ? (
                            <><EyeOff className="w-3 h-3" /> Nascondi</>
                          ) : (
                            <><Eye className="w-3 h-3" /> Pubblica</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                          onClick={() => {
                            if (window.confirm("Disattivare questo prodotto?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={openCreateModal}
                className="rounded-xl border-2 border-dashed border-border/50 hover:border-violet-300 dark:hover:border-violet-700 flex flex-col items-center justify-center p-8 transition-all hover:bg-violet-50/50 dark:hover:bg-violet-950/20 group min-h-[240px]"
              >
                <div className="w-12 h-12 rounded-xl bg-muted/60 group-hover:bg-violet-100 dark:group-hover:bg-violet-900/30 flex items-center justify-center transition-colors mb-3">
                  <Plus className="w-6 h-6 text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors" />
                </div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-violet-600 dark:group-hover:text-violet-400 transition-colors">
                  Aggiungi prodotto
                </span>
              </button>
            </div>
          )}

          {sales.length > 0 && (
            <div className="space-y-3">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <ShoppingCart className="w-5 h-5" />
                Vendite Recenti
              </h2>
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Acquirente</TableHead>
                        <TableHead>Prodotto</TableHead>
                        <TableHead>Importo</TableHead>
                        <TableHead>Stato</TableHead>
                        <TableHead>Data</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map(sale => {
                        const item = items.find(i => i.id === sale.catalogItemId);
                        return (
                          <TableRow key={sale.id}>
                            <TableCell className="text-sm">{sale.buyerUserId}</TableCell>
                            <TableCell className="text-sm">{item?.name || sale.catalogItemId}</TableCell>
                            <TableCell className="text-sm font-medium">{formatPrice(sale.amountCents)}</TableCell>
                            <TableCell>
                              <Badge variant={sale.status === "active" ? "default" : "secondary"} className="text-[10px]">
                                {sale.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(sale.purchasedAt).toLocaleDateString("it-IT")}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </main>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Modifica Prodotto" : "Nuovo Prodotto"}
            </DialogTitle>
          </DialogHeader>

          {!editingItem && (
            <Tabs value={creationMode} onValueChange={(v) => setCreationMode(v as any)} className="mb-4">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="ai-prompt" className="gap-1.5 text-xs">
                  <Wand2 className="w-3.5 h-3.5" />
                  AI da Prompt
                </TabsTrigger>
                <TabsTrigger value="manual-ai" className="gap-1.5 text-xs">
                  <Sparkles className="w-3.5 h-3.5" />
                  Manuale + AI
                </TabsTrigger>
                <TabsTrigger value="manual" className="gap-1.5 text-xs">
                  <Pencil className="w-3.5 h-3.5" />
                  Manuale
                </TabsTrigger>
              </TabsList>

              <TabsContent value="ai-prompt" className="space-y-4 mt-4">
                <div className="space-y-2">
                  <Label>Descrivi il prodotto che vuoi creare</Label>
                  <Textarea
                    placeholder="Es: Pacchetto WhatsApp AI per ristoranti con gestione prenotazioni e menu digitale..."
                    value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    rows={4}
                  />
                  <Button
                    onClick={handleAiGenerate}
                    disabled={aiLoading || !aiPrompt.trim()}
                    className="w-full gap-2"
                  >
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                    Genera con AI
                  </Button>
                </div>
                {form.name && (
                  <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 text-sm">
                    <p className="font-medium text-emerald-700 dark:text-emerald-400 mb-1">
                      ✓ Prodotto generato — rivedi i campi sotto e salva
                    </p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="manual-ai" className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Compila nome, categoria e prezzo, poi clicca "Genera Descrizione AI" per generare automaticamente le descrizioni.
                </p>
              </TabsContent>

              <TabsContent value="manual" className="mt-4">
                <p className="text-xs text-muted-foreground mb-2">
                  Compila tutti i campi manualmente.
                </p>
              </TabsContent>
            </Tabs>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Nome *</Label>
                <Input
                  value={form.name || ""}
                  onChange={e => setForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Nome del prodotto"
                />
              </div>
              <div className="space-y-2">
                <Label>Icona (emoji)</Label>
                <Input
                  value={form.icon || ""}
                  onChange={e => setForm(prev => ({ ...prev, icon: e.target.value }))}
                  placeholder="📦"
                  className="w-20"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Categoria</Label>
                <Select
                  value={form.category || "other"}
                  onValueChange={v => setForm(prev => ({ ...prev, category: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prezzo (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={priceInput}
                  onChange={e => handlePriceChange(e.target.value)}
                  placeholder="99.00"
                />
              </div>
              <div className="space-y-2">
                <Label>Fatturazione</Label>
                <Select
                  value={form.billingType || "monthly"}
                  onValueChange={v => setForm(prev => ({ ...prev, billingType: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_TYPES.map(b => (
                      <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {creationMode === "manual-ai" && !editingItem && (
              <Button
                variant="outline"
                onClick={handleAiDescribe}
                disabled={aiLoading || !form.name?.trim()}
                className="gap-2"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Genera Descrizione AI
              </Button>
            )}

            <div className="space-y-2">
              <Label>Descrizione breve</Label>
              <Input
                value={form.shortDescription || ""}
                onChange={e => setForm(prev => ({ ...prev, shortDescription: e.target.value }))}
                placeholder="Breve descrizione (max 100 caratteri)"
                maxLength={500}
              />
            </div>

            <div className="space-y-2">
              <Label>Descrizione completa</Label>
              <Textarea
                value={form.description || ""}
                onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Descrizione dettagliata del prodotto..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo Prodotto</Label>
              <Select
                value={form.itemType || "single"}
                onValueChange={v => setForm(prev => ({ ...prev, itemType: v, bundleItems: v === "bundle" ? [] : null }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="single">Singolo</SelectItem>
                  <SelectItem value="bundle">Bundle</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label>Modalità Pagamento</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <button
                  type="button"
                  disabled={!hasStripeConnect}
                  onClick={() => hasStripeConnect && setForm(prev => ({ ...prev, paymentMode: "connect" }))}
                  className={cn(
                    "relative text-left p-4 rounded-xl border-2 transition-all",
                    form.paymentMode === "connect"
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-950/30 ring-1 ring-violet-500/30"
                      : hasStripeConnect
                        ? "border-border hover:border-violet-300 dark:hover:border-violet-700 bg-card"
                        : "border-border/50 bg-muted/30 opacity-60 cursor-not-allowed"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      form.paymentMode === "connect"
                        ? "bg-violet-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <CreditCard className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Stripe Connect</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0">50%</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Il cliente paga tramite la piattaforma. Tu ricevi il 50% automaticamente sul tuo conto Stripe.
                      </p>
                      {!hasStripeConnect && (
                        <div className="flex items-center gap-1.5 mt-2 text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span className="text-[10px] font-medium">Stripe Connect non configurato</span>
                        </div>
                      )}
                    </div>
                  </div>
                  {form.paymentMode === "connect" && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setForm(prev => ({ ...prev, paymentMode: "direct" }))}
                  className={cn(
                    "relative text-left p-4 rounded-xl border-2 transition-all",
                    form.paymentMode === "direct"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/30 ring-1 ring-emerald-500/30"
                      : "border-border hover:border-emerald-300 dark:hover:border-emerald-700 bg-card"
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                      form.paymentMode === "direct"
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground"
                    )}>
                      <Link2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Link Diretto</span>
                        <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-emerald-300 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400">100%</Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Usa il tuo link Stripe personale. Il 100% del pagamento va direttamente a te.
                      </p>
                    </div>
                  </div>
                  {form.paymentMode === "direct" && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              </div>

              <div className="rounded-lg bg-muted/40 border border-border/50 p-3 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-500 mt-0.5 shrink-0" />
                <div className="text-[11px] text-muted-foreground leading-relaxed">
                  {form.paymentMode === "connect" ? (
                    <>
                      <strong className="text-foreground">Stripe Connect:</strong> La piattaforma gestisce il pagamento. Quando un cliente acquista, il 50% viene trasferito automaticamente al tuo conto Stripe collegato. Non devi creare nessun link — tutto è automatico.
                    </>
                  ) : (
                    <>
                      <strong className="text-foreground">Link Diretto:</strong> Crei un Payment Link dal tuo account Stripe e lo incolli qui sotto. Il cliente viene reindirizzato al tuo link per pagare. Il 100% va a te, la piattaforma non trattiene nulla.
                    </>
                  )}
                </div>
              </div>
            </div>

            {form.paymentMode === "direct" && (
              <div className="space-y-2">
                <Label>Stripe Payment Link URL</Label>
                <div className="relative">
                  <Input
                    value={form.stripeDirectLink || ""}
                    onChange={e => setForm(prev => ({ ...prev, stripeDirectLink: e.target.value }))}
                    placeholder="https://buy.stripe.com/..."
                    className="pr-10"
                  />
                  {form.stripeDirectLink && (
                    <a
                      href={form.stripeDirectLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground">
                  Vai su Stripe → Payments → Payment Links → crea un link e incollalo qui
                </p>
              </div>
            )}

            {form.itemType === "bundle" && singleItems.length > 0 && (
              <div className="space-y-2">
                <Label>Prodotti inclusi nel bundle</Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 p-3 rounded-lg border bg-muted/30">
                  {singleItems
                    .filter(si => si.id !== editingItem?.id)
                    .map(si => {
                      const isSelected = (form.bundleItems || []).includes(si.id);
                      return (
                        <button
                          key={si.id}
                          type="button"
                          onClick={() => handleBundleToggle(si.id)}
                          className={cn(
                            "flex items-center gap-2 p-2 rounded-lg text-left text-sm transition-all",
                            isSelected
                              ? "bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-300 dark:border-indigo-700"
                              : "bg-card border border-border hover:border-muted-foreground/30"
                          )}
                        >
                          <span>{si.icon}</span>
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-xs">{si.name}</span>
                            <span className="text-[10px] text-muted-foreground ml-1">{formatPrice(si.priceCents)}</span>
                          </div>
                        </button>
                      );
                    })}
                </div>
                {form.originalPriceCents && form.originalPriceCents > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Prezzo originale totale: {formatPrice(form.originalPriceCents)}
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isFeatured || false}
                  onCheckedChange={v => setForm(prev => ({ ...prev, isFeatured: v }))}
                />
                <Label className="text-sm">In evidenza</Label>
              </div>
              <div className="space-y-2">
                <Label>Badge (opzionale)</Label>
                <Input
                  value={form.badgeText || ""}
                  onChange={e => setForm(prev => ({ ...prev, badgeText: e.target.value || null }))}
                  placeholder="Es: Più venduto"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={closeModal}>Annulla</Button>
            <Button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="gap-2"
            >
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {editingItem ? "Aggiorna" : "Salva"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
