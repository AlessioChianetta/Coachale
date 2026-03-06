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
  GripVertical,
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
    setForm({ ...DEFAULT_FORM });
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

  return (
    <div className="flex h-screen bg-background">
      <Sidebar role="consultant" />
      <main className="flex-1 overflow-auto">
        <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Catalogo Servizi</h1>
              <p className="text-sm text-muted-foreground mt-1">
                Gestisci i prodotti e servizi che vendi ai tuoi clienti
              </p>
            </div>
            <Button onClick={openCreateModal} className="gap-2">
              <Plus className="w-4 h-4" />
              {isMobile ? "Nuovo" : "Nuovo Prodotto"}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : items.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Nessun prodotto nel catalogo</h3>
                <p className="text-sm text-muted-foreground max-w-md mb-6">
                  Crea il tuo primo prodotto o servizio. Puoi farlo manualmente, con l'aiuto dell'AI,
                  o lasciare che l'AI generi tutto da un semplice prompt.
                </p>
                <Button onClick={openCreateModal} size="lg" className="gap-2">
                  <Sparkles className="w-4 h-4" />
                  Crea il tuo primo prodotto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map(item => (
                <Card
                  key={item.id}
                  className={cn(
                    "relative group transition-all hover:shadow-md",
                    !item.isActive && "opacity-60"
                  )}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <h3 className="font-semibold text-sm leading-tight">{item.name}</h3>
                          <p className="text-xs text-muted-foreground">{categoryLabel(item.category)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {item.isFeatured && (
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                        )}
                        {item.itemType === "bundle" && (
                          <Badge variant="outline" className="text-[10px] px-1.5">Bundle</Badge>
                        )}
                      </div>
                    </div>

                    {item.shortDescription && (
                      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.shortDescription}</p>
                    )}

                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-lg font-bold">{formatPrice(item.priceCents)}</span>
                        {item.originalPriceCents && item.originalPriceCents > item.priceCents && (
                          <span className="text-xs text-muted-foreground line-through">
                            {formatPrice(item.originalPriceCents)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">/{billingLabel(item.billingType)}</span>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(
                          "text-[10px]",
                          item.paymentMode === "connect"
                            ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                            : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        )}
                      >
                        {item.paymentMode === "connect" ? "Connect 50%" : "Diretto 100%"}
                      </Badge>
                    </div>

                    {item.badgeText && (
                      <Badge className="mb-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-[10px]">
                        {item.badgeText}
                      </Badge>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => toggleMutation.mutate(item.id)}
                          title={item.isActive ? "Disattiva" : "Attiva"}
                        >
                          {item.isActive ? (
                            <Eye className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          onClick={() => openEditModal(item)}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          onClick={() => {
                            if (window.confirm("Disattivare questo prodotto?")) {
                              deleteMutation.mutate(item.id);
                            }
                          }}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                      <span className={cn(
                        "text-[10px] font-medium",
                        item.isActive ? "text-emerald-600" : "text-muted-foreground"
                      )}>
                        {item.isActive ? "Attivo" : "Inattivo"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Modalità Pagamento</Label>
                <Select
                  value={form.paymentMode || "connect"}
                  onValueChange={v => setForm(prev => ({ ...prev, paymentMode: v }))}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_MODES.map(pm => (
                      <SelectItem key={pm.value} value={pm.value}>
                        {pm.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {PAYMENT_MODES.find(pm => pm.value === form.paymentMode)?.description}
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tipo</Label>
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
            </div>

            {form.paymentMode === "direct" && (
              <div className="space-y-2">
                <Label>Stripe Payment Link URL</Label>
                <Input
                  value={form.stripeDirectLink || ""}
                  onChange={e => setForm(prev => ({ ...prev, stripeDirectLink: e.target.value }))}
                  placeholder="https://buy.stripe.com/..."
                />
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
