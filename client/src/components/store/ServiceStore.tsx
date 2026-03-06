import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ShoppingBag,
  Sparkles,
  Bot,
  Megaphone,
  Zap,
  MessageSquare,
  BarChart3,
  Package,
  CheckCircle,
  Star,
  ArrowRight,
  Filter,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken } from "@/lib/auth";

interface CatalogItem {
  id: string;
  consultantId: string;
  name: string;
  description: string | null;
  shortDescription: string | null;
  icon: string | null;
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

const CATEGORIES = [
  { key: "all", label: "Tutti", icon: Filter },
  { key: "ai", label: "AI", icon: Bot },
  { key: "marketing", label: "Marketing", icon: Megaphone },
  { key: "automation", label: "Automazione", icon: Zap },
  { key: "communication", label: "Comunicazione", icon: MessageSquare },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "other", label: "Altro", icon: Package },
];

const CATEGORY_GRADIENTS: Record<string, string> = {
  ai: "from-violet-500 to-purple-600",
  marketing: "from-pink-500 to-rose-600",
  automation: "from-amber-500 to-orange-600",
  communication: "from-emerald-500 to-teal-600",
  analytics: "from-blue-500 to-indigo-600",
  other: "from-slate-500 to-gray-600",
};

const BILLING_LABELS: Record<string, string> = {
  one_time: "una tantum",
  monthly: "/mese",
  yearly: "/anno",
};

interface ServiceStoreProps {
  role: "consultant" | "client";
}

export function ServiceStore({ role }: ServiceStoreProps) {
  const [selectedCategory, setSelectedCategory] = useState("all");

  const { data: catalogItems = [], isLoading } = useQuery<CatalogItem[]>({
    queryKey: ["/api/store/catalog"],
    queryFn: async () => {
      const token = getToken();
      const res = await fetch("/api/store/catalog", {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error("Failed to fetch catalog");
      const data = await res.json();
      return data.data || [];
    },
  });

  const filteredItems = useMemo(() => {
    if (selectedCategory === "all") return catalogItems;
    return catalogItems.filter((item) => item.category === selectedCategory);
  }, [catalogItems, selectedCategory]);

  const featuredItems = useMemo(
    () => catalogItems.filter((item) => item.isFeatured),
    [catalogItems]
  );

  const formatPrice = (cents: number, billingType: string) => {
    const price = (cents / 100).toFixed(2).replace(".", ",");
    return `€${price}${BILLING_LABELS[billingType] || ""}`;
  };

  const handlePurchase = (item: CatalogItem) => {
    if (item.paymentMode === "direct" && item.stripeDirectLink) {
      window.open(item.stripeDirectLink, "_blank");
    } else {
      fetch(`/api/store/checkout/${item.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${getToken()}`,
        },
      })
        .then((res) => res.json())
        .then((data) => {
          if (data.url) window.location.href = data.url;
        })
        .catch(console.error);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-8">
        <div className="text-center space-y-4">
          <Skeleton className="h-10 w-64 mx-auto" />
          <Skeleton className="h-5 w-96 mx-auto" />
        </div>
        <div className="flex gap-2 justify-center">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-9 w-28 rounded-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-72 rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  if (catalogItems.length === 0) {
    const placeholderCards = [
      { icon: "🤖", name: "Assistente AI", cat: "ai", gradient: "from-violet-500 to-purple-600" },
      { icon: "📱", name: "WhatsApp AI", cat: "communication", gradient: "from-emerald-500 to-teal-600" },
      { icon: "📊", name: "Analytics Pro", cat: "analytics", gradient: "from-blue-500 to-indigo-600" },
      { icon: "⚡", name: "Automazione", cat: "automation", gradient: "from-amber-500 to-orange-600" },
      { icon: "📣", name: "Marketing Suite", cat: "marketing", gradient: "from-pink-500 to-rose-600" },
      { icon: "🎯", name: "Lead Manager", cat: "ai", gradient: "from-violet-500 to-purple-600" },
    ];

    return (
      <div className="space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
            <Sparkles className="w-4 h-4 text-violet-500" />
            <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
              Servizi Premium
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 dark:from-violet-300 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
            Catalogo Servizi
          </h1>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Scopri i servizi e le soluzioni AI pensate per far crescere la tua attività
          </p>
        </div>

        <div className="flex flex-wrap gap-2 justify-center">
          {CATEGORIES.map((cat) => {
            const Icon = cat.icon;
            return (
              <div
                key={cat.key}
                className={cn(
                  "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium",
                  cat.key === "all"
                    ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/25"
                    : "bg-muted/60 text-muted-foreground"
                )}
              >
                <Icon className="w-4 h-4" />
                {cat.label}
              </div>
            );
          })}
        </div>

        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {placeholderCards.map((card, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.08 }}
                className="group relative"
              >
                <div className="relative overflow-hidden rounded-2xl border border-border/40 bg-card/50">
                  <div className={cn("h-2 bg-gradient-to-r opacity-40", card.gradient)} />
                  <div className="p-5">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-12 h-12 rounded-xl bg-muted/60 flex items-center justify-center text-2xl">
                        {card.icon}
                      </div>
                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="h-4 w-28 rounded-md bg-muted/80" />
                        <div className="h-3 w-16 rounded-md bg-muted/50" />
                      </div>
                    </div>
                    <div className="space-y-1.5 mb-4">
                      <div className="h-3 w-full rounded bg-muted/40" />
                      <div className="h-3 w-3/4 rounded bg-muted/30" />
                    </div>
                    <div className="space-y-1.5 mb-4">
                      {[1, 2, 3].map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <div className="w-3.5 h-3.5 rounded-full bg-muted/40" />
                          <div className="h-2.5 rounded bg-muted/30" style={{ width: `${50 + f * 12}%` }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-end justify-between pt-3 border-t border-border/30">
                      <div className="h-5 w-20 rounded bg-muted/50" />
                      <div className="h-8 w-24 rounded-md bg-muted/40" />
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-t from-background via-background/80 to-transparent rounded-2xl">
            <div className="text-center space-y-4 -mt-8">
              <div className="relative mx-auto w-fit">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl rotate-6 opacity-20 blur-sm scale-110" />
                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-violet-500/25">
                  <ShoppingBag className="w-7 h-7 text-white" />
                </div>
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground mb-1.5">
                  Il catalogo è in preparazione
                </h3>
                <p className="text-muted-foreground text-sm max-w-sm mx-auto">
                  I servizi saranno disponibili non appena il tuo consulente pubblicherà il suo catalogo personalizzato.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-500/10 to-purple-500/10 border border-violet-500/20">
          <Sparkles className="w-4 h-4 text-violet-500" />
          <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
            Servizi Premium
          </span>
        </div>
        <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-violet-700 via-purple-700 to-indigo-700 dark:from-violet-300 dark:via-purple-300 dark:to-indigo-300 bg-clip-text text-transparent">
          Catalogo Servizi
        </h1>
        <p className="text-muted-foreground max-w-xl mx-auto">
          Scopri i servizi e le soluzioni AI pensate per far crescere la tua
          attività
        </p>
      </div>

      {featuredItems.length > 0 && (
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 p-[1px]">
          <div className="rounded-2xl bg-gradient-to-br from-violet-600/90 via-purple-600/90 to-indigo-700/90 backdrop-blur-xl p-6 md:p-8">
            <div className="flex items-center gap-2 mb-4">
              <Crown className="w-5 h-5 text-amber-300" />
              <span className="text-sm font-semibold text-white/90">
                In Evidenza
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {featuredItems.slice(0, 2).map((item) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl bg-white/10 backdrop-blur-sm border border-white/20 p-5 hover:bg-white/15 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{item.icon || "📦"}</span>
                      <div>
                        <h3 className="font-bold text-white text-lg">
                          {item.name}
                        </h3>
                        <p className="text-white/70 text-sm">
                          {item.shortDescription}
                        </p>
                      </div>
                    </div>
                    {item.badgeText && (
                      <Badge className="bg-amber-400/20 text-amber-200 border-amber-400/30 text-xs">
                        {item.badgeText}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-end justify-between mt-4">
                    <div>
                      {item.originalPriceCents && (
                        <span className="text-white/50 line-through text-sm mr-2">
                          {formatPrice(item.originalPriceCents, item.billingType)}
                        </span>
                      )}
                      <span className="text-2xl font-bold text-white">
                        {formatPrice(item.priceCents, item.billingType)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handlePurchase(item)}
                      className="bg-white text-violet-700 hover:bg-white/90 font-semibold gap-1.5"
                      size="sm"
                    >
                      Acquista
                      <ArrowRight className="w-4 h-4" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 justify-center">
        {CATEGORIES.map((cat) => {
          const Icon = cat.icon;
          const isActive = selectedCategory === cat.key;
          const count =
            cat.key === "all"
              ? catalogItems.length
              : catalogItems.filter((i) => i.category === cat.key).length;
          if (cat.key !== "all" && count === 0) return null;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              className={cn(
                "inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-gradient-to-r from-violet-600 to-purple-600 text-white shadow-md shadow-violet-500/25"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="w-4 h-4" />
              {cat.label}
              {count > 0 && (
                <span
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-muted-foreground/10 text-muted-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={selectedCategory}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredItems.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="group relative"
            >
              <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-card hover:border-violet-300 dark:hover:border-violet-700 hover:shadow-lg hover:shadow-violet-500/5 transition-all duration-300">
                <div
                  className={cn(
                    "h-2 bg-gradient-to-r",
                    CATEGORY_GRADIENTS[item.category] || CATEGORY_GRADIENTS.other
                  )}
                />

                <div className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center text-2xl shadow-sm",
                          CATEGORY_GRADIENTS[item.category] ||
                            CATEGORY_GRADIENTS.other,
                          "bg-opacity-10"
                        )}
                        style={{
                          background: `linear-gradient(135deg, var(--tw-gradient-from, #8b5cf6) 0%, var(--tw-gradient-to, #7c3aed) 100%)`,
                          opacity: 0.1,
                        }}
                      >
                        <span className="opacity-100 relative z-10">
                          {item.icon || "📦"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-foreground text-base truncate">
                          {item.name}
                        </h3>
                        <p className="text-xs text-muted-foreground capitalize">
                          {item.category}
                        </p>
                      </div>
                    </div>
                    {item.badgeText && (
                      <Badge
                        variant="outline"
                        className="text-[10px] border-violet-300 text-violet-600 dark:border-violet-700 dark:text-violet-400 shrink-0"
                      >
                        {item.badgeText}
                      </Badge>
                    )}
                  </div>

                  {item.itemType === "bundle" && (
                    <Badge
                      variant="secondary"
                      className="mb-2 text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    >
                      <Package className="w-3 h-3 mr-1" />
                      Bundle
                    </Badge>
                  )}

                  <p className="text-sm text-muted-foreground line-clamp-2 mb-4 min-h-[2.5rem]">
                    {item.shortDescription || item.description || ""}
                  </p>

                  {item.featuresUnlocked &&
                    item.featuresUnlocked.length > 0 && (
                      <div className="space-y-1.5 mb-4">
                        {(item.featuresUnlocked as string[])
                          .slice(0, 3)
                          .map((feature, i) => (
                            <div
                              key={i}
                              className="flex items-center gap-2 text-xs text-muted-foreground"
                            >
                              <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                              <span className="truncate">{feature}</span>
                            </div>
                          ))}
                        {item.featuresUnlocked.length > 3 && (
                          <span className="text-[10px] text-muted-foreground/60 pl-5">
                            +{item.featuresUnlocked.length - 3} altri
                          </span>
                        )}
                      </div>
                    )}

                  <div className="flex items-end justify-between pt-3 border-t border-border/40">
                    <div>
                      {item.originalPriceCents && (
                        <span className="text-muted-foreground/60 line-through text-xs mr-1.5">
                          {formatPrice(
                            item.originalPriceCents,
                            item.billingType
                          )}
                        </span>
                      )}
                      <span className="text-xl font-bold text-foreground">
                        {formatPrice(item.priceCents, item.billingType)}
                      </span>
                    </div>
                    <Button
                      onClick={() => handlePurchase(item)}
                      size="sm"
                      className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white shadow-sm gap-1.5"
                    >
                      Acquista
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </AnimatePresence>

      {filteredItems.length === 0 && catalogItems.length > 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">
            Nessun servizio in questa categoria
          </p>
          <Button
            variant="link"
            className="text-violet-600 mt-2"
            onClick={() => setSelectedCategory("all")}
          >
            Mostra tutti i servizi
          </Button>
        </div>
      )}
    </div>
  );
}

export default ServiceStore;
