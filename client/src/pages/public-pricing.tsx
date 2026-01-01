import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, 
  X,
  Star, 
  Zap, 
  MessageSquare, 
  Shield, 
  Clock,
  Sparkles,
  AlertCircle,
  ArrowRight,
  Loader2,
  Bot,
  Brain,
  Headphones,
  Database,
  History,
  UserCheck,
  Crown,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";

interface Agent {
  agentId: string;
  agentName: string;
  level: "1" | "2" | "3" | null;
  publicSlug: string | null;
  dailyMessageLimit: number | null;
  businessName: string | null;
  businessDescription: string | null;
}

interface PricingData {
  consultantName: string;
  consultantSlug: string;
  agents: Agent[];
  pricing: {
    level2MonthlyPrice: number;
    level2YearlyPrice: number;
    level2Name: string;
    level2Description: string;
    level3MonthlyPrice?: number;
    level3YearlyPrice?: number;
    level3Name?: string;
    level3Description?: string;
    accentColor: string | null;
    logoUrl: string | null;
  };
}

const COMPARISON_FEATURES = [
  { name: "Messaggi al giorno", bronze: "15", silver: "Illimitati", gold: "Illimitati", icon: MessageSquare },
  { name: "Risposte AI intelligenti", bronze: true, silver: true, gold: true, icon: Brain },
  { name: "Disponibilità 24/7", bronze: true, silver: true, gold: true, icon: Clock },
  { name: "Accesso Knowledge Base", bronze: false, silver: true, gold: true, icon: Database },
  { name: "Storico conversazioni", bronze: false, silver: true, gold: true, icon: History },
  { name: "Risposte personalizzate", bronze: false, silver: true, gold: true, icon: Bot },
  { name: "Dashboard personale", bronze: false, silver: false, gold: true, icon: Settings },
  { name: "AI Manager dedicato", bronze: false, silver: false, gold: true, icon: UserCheck },
  { name: "Supporto VIP prioritario", bronze: false, silver: false, gold: true, icon: Headphones },
  { name: "Accesso completo software", bronze: false, silver: false, gold: true, icon: Crown },
];

function FeatureItem({ children, included = true }: { children: React.ReactNode; included?: boolean }) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
      ) : (
        <X className="h-5 w-5 text-slate-300 shrink-0 mt-0.5" />
      )}
      <span className={cn("text-sm", included ? "text-slate-700" : "text-slate-400")}>
        {children}
      </span>
    </li>
  );
}

function PricingCardSkeleton() {
  return (
    <Card className="relative flex flex-col">
      <CardHeader className="text-center pb-4">
        <Skeleton className="h-6 w-24 mx-auto mb-4" />
        <Skeleton className="h-10 w-20 mx-auto" />
        <Skeleton className="h-4 w-32 mx-auto mt-2" />
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
        <Skeleton className="h-10 w-full mt-6" />
      </CardContent>
    </Card>
  );
}

function ComparisonTableCell({ value }: { value: boolean | string }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="h-5 w-5 text-emerald-500 mx-auto" />
    ) : (
      <X className="h-5 w-5 text-slate-300 mx-auto" />
    );
  }
  return <span className="font-medium text-slate-900">{value}</span>;
}

export default function PublicPricing() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(false);

  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["/api/public/consultant", slug, "pricing"],
    queryFn: async () => {
      const response = await fetch(`/api/public/consultant/${slug}/pricing`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(errorData.error || "CONFIG_ERROR");
        }
        throw new Error("GENERIC_ERROR");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const [purchaseLoading, setPurchaseLoading] = useState<string | null>(null);

  const createCheckoutMutation = useMutation({
    mutationFn: async ({ level, agentId }: { level: "2" | "3"; agentId: string }) => {
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantSlug: slug,
          agentId,
          level,
          billingPeriod: isAnnual ? "yearly" : "monthly",
          clientEmail: "",
          clientName: "",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nel checkout");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      }
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setPurchaseLoading(null);
    },
  });

  const handlePurchase = (level: "2" | "3", agentId: string) => {
    setPurchaseLoading(`${level}-${agentId}`);
    createCheckoutMutation.mutate({ level, agentId });
  };

  const calculateAnnualPrice = (monthlyPrice: number) => {
    const annualTotal = monthlyPrice * 12;
    const discounted = Math.round(annualTotal * 0.85);
    return Math.round(discounted / 12);
  };

  const getDisplayPrice = (monthlyPrice: number, yearlyPrice?: number) => {
    if (isAnnual) {
      return yearlyPrice ? Math.round(yearlyPrice / 12) : calculateAnnualPrice(monthlyPrice);
    }
    return monthlyPrice;
  };

  const getSavings = (monthlyPrice: number) => {
    const annualMonthly = calculateAnnualPrice(monthlyPrice);
    const savings = (monthlyPrice - annualMonthly) * 12;
    return savings;
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "GENERIC_ERROR";
    
    let title = "Errore";
    let description = "Si è verificato un errore imprevisto. Riprova più tardi.";
    let icon = <AlertCircle className="h-16 w-16 text-destructive" />;
    
    if (errorMessage === "NOT_FOUND") {
      title = "Consulente non trovato";
      description = "Il consulente che stai cercando non esiste o non ha una pagina prezzi pubblica configurata.";
    } else if (errorMessage.includes("Stripe") || errorMessage.includes("stripe")) {
      title = "Pagamenti non configurati";
      description = "Il sistema di pagamento non è ancora stato configurato per questo consulente. Contatta il consulente per maggiori informazioni.";
      icon = <Shield className="h-16 w-16 text-amber-500" />;
    } else if (errorMessage.includes("agent") || errorMessage.includes("Agent")) {
      title = "Agenti AI non disponibili";
      description = "Non ci sono ancora agenti AI pubblici configurati per questo consulente. Torna più tardi!";
      icon = <Bot className="h-16 w-16 text-blue-500" />;
    }
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mb-6 flex justify-center">{icon}</div>
            <h2 className="text-2xl font-bold mb-3 text-slate-900">{title}</h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {description}
            </p>
            <Button onClick={() => navigate("/")} variant="outline" size="lg">
              Torna alla home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const level1Agent = data?.agents.find(a => a.level === "1");
  const level2Agent = data?.agents.find(a => a.level === "2") || level1Agent;
  const level3Agent = data?.agents.find(a => a.level === "3");

  const tierNames = {
    bronze: "Bronze",
    silver: data?.pricing.level2Name || "Argento",
    gold: data?.pricing.level3Name || "Oro",
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-to-br from-violet-50/60 via-transparent to-emerald-50/40 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-20">
        {/* Hero Section */}
        <div className="text-center mb-12">
          {isLoading ? (
            <>
              <Skeleton className="h-16 w-16 rounded-full mx-auto mb-6" />
              <Skeleton className="h-12 w-[500px] max-w-full mx-auto mb-4" />
              <Skeleton className="h-6 w-[400px] max-w-full mx-auto" />
            </>
          ) : (
            <>
              {data?.pricing.logoUrl && (
                <img 
                  src={data.pricing.logoUrl} 
                  alt={data.consultantName}
                  className="h-16 w-16 rounded-full mx-auto mb-6 object-cover shadow-lg ring-4 ring-white"
                />
              )}
              
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 text-sm font-medium mb-6">
                <Bot className="h-4 w-4" />
                Il Tuo Assistente AI Personale
              </div>
              
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-4 tracking-tight">
                Scegli il piano perfetto
                <span className="block text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">
                  per le tue esigenze
                </span>
              </h1>
              
              <p className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-2">
                Accedi al tuo Dipendente AI personale e automatizza le tue attività quotidiane
              </p>
              
              {data?.consultantName && (
                <p className="text-sm text-muted-foreground">
                  Powered by <span className="font-semibold text-slate-700">{data.consultantName}</span>
                </p>
              )}
            </>
          )}
        </div>

        {/* Billing Toggle */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <span className={cn(
            "text-sm font-medium transition-colors",
            !isAnnual ? "text-slate-900" : "text-slate-500"
          )}>
            Mensile
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            className="data-[state=checked]:bg-gradient-to-r data-[state=checked]:from-violet-600 data-[state=checked]:to-indigo-600"
          />
          <span className={cn(
            "text-sm font-medium transition-colors",
            isAnnual ? "text-slate-900" : "text-slate-500"
          )}>
            Annuale
          </span>
          {isAnnual && (
            <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 ml-2">
              Risparmia 15%
            </Badge>
          )}
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto mb-20">
          {isLoading ? (
            <>
              <PricingCardSkeleton />
              <PricingCardSkeleton />
              <PricingCardSkeleton />
            </>
          ) : (
            <>
              {/* Level 1 - Bronze (Free) */}
              <Card className="relative flex flex-col border border-slate-200 bg-white hover:shadow-xl hover:border-slate-300 transition-all duration-300 group">
                <CardHeader className="text-center pb-6">
                  <Badge className="w-fit mx-auto mb-4 bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-50">
                    {tierNames.bronze}
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">Gratuito</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-slate-900">€0</span>
                      <span className="text-slate-500">/mese</span>
                    </div>
                    <p className="text-sm text-slate-500 min-h-[40px]">
                      Per iniziare a scoprire il tuo assistente AI
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>{level1Agent?.dailyMessageLimit || 15} messaggi al giorno</FeatureItem>
                    <FeatureItem>Accesso senza registrazione</FeatureItem>
                    <FeatureItem>Risposte AI immediate</FeatureItem>
                    <FeatureItem>Disponibile 24/7</FeatureItem>
                    <FeatureItem included={false}>Knowledge Base</FeatureItem>
                    <FeatureItem included={false}>Storico conversazioni</FeatureItem>
                  </ul>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="w-full group-hover:bg-slate-50 transition-colors"
                    onClick={() => {
                      if (level1Agent?.publicSlug) {
                        navigate(`/ai/${level1Agent.publicSlug}`);
                      } else {
                        toast({
                          title: "Agente non disponibile",
                          description: "Nessun agente pubblico configurato per questo livello",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Inizia Gratis
                    <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </CardContent>
              </Card>

              {/* Level 2 - Silver (Paid) */}
              <Card className="relative flex flex-col border-2 border-violet-400 bg-white shadow-xl shadow-violet-100/50 scale-[1.02] hover:shadow-2xl transition-all duration-300">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-600 px-4 py-1.5 shadow-lg">
                    <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Più Popolare
                  </Badge>
                </div>
                
                <CardHeader className="text-center pb-6 pt-8">
                  <Badge className="w-fit mx-auto mb-4 bg-gradient-to-r from-violet-50 to-indigo-50 text-violet-700 border border-violet-200 hover:from-violet-50 hover:to-indigo-50">
                    {tierNames.silver}
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      {data?.pricing.level2Name || "Argento"}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-slate-900">
                        €{getDisplayPrice(data?.pricing.level2MonthlyPrice || 29, data?.pricing.level2YearlyPrice)}
                      </span>
                      <span className="text-slate-500">/mese</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Risparmi €{getSavings(data?.pricing.level2MonthlyPrice || 29)}/anno
                      </p>
                    )}
                    <p className="text-sm text-slate-500 min-h-[40px]">
                      {data?.pricing.level2Description || "Per chi vuole il massimo dal proprio assistente"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>
                      <span className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Messaggi illimitati
                      </span>
                    </FeatureItem>
                    <FeatureItem>Tutto del piano Bronze</FeatureItem>
                    <FeatureItem>Accesso alla Knowledge Base</FeatureItem>
                    <FeatureItem>Risposte personalizzate avanzate</FeatureItem>
                    <FeatureItem>Storico conversazioni salvato</FeatureItem>
                    <FeatureItem included={false}>Dashboard personale</FeatureItem>
                  </ul>
                  
                  <Button 
                    size="lg"
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 shadow-lg shadow-violet-200/50 transition-all hover:shadow-xl"
                    disabled={purchaseLoading !== null}
                    onClick={() => handlePurchase("2", level2Agent?.agentId || "")}
                  >
                    {purchaseLoading === `2-${level2Agent?.agentId}` ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Caricamento...
                      </>
                    ) : (
                      <>
                        Inizia Ora
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Level 3 - Gold (Premium) */}
              <Card className="relative flex flex-col border border-amber-300 bg-gradient-to-b from-amber-50/50 to-white hover:shadow-xl hover:border-amber-400 transition-all duration-300 group">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <Badge className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white hover:from-amber-500 hover:to-orange-500 px-4 py-1.5 shadow-lg">
                    <Crown className="h-3.5 w-3.5 mr-1.5" />
                    Premium
                  </Badge>
                </div>
                
                <CardHeader className="text-center pb-6 pt-8">
                  <Badge className="w-fit mx-auto mb-4 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 hover:from-amber-50 hover:to-orange-50">
                    {tierNames.gold}
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-bold text-slate-900">
                      {data?.pricing.level3Name || "Oro"}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-5xl font-bold text-slate-900">
                        €{getDisplayPrice(data?.pricing.level3MonthlyPrice || 59, data?.pricing.level3YearlyPrice)}
                      </span>
                      <span className="text-slate-500">/mese</span>
                    </div>
                    {isAnnual && (
                      <p className="text-xs text-emerald-600 font-medium">
                        Risparmi €{getSavings(data?.pricing.level3MonthlyPrice || 59)}/anno
                      </p>
                    )}
                    <p className="text-sm text-slate-500 min-h-[40px]">
                      {data?.pricing.level3Description || "Per professionisti che vogliono tutto"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>
                      <span className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Accesso completo al software
                      </span>
                    </FeatureItem>
                    <FeatureItem>Tutto del piano Argento</FeatureItem>
                    <FeatureItem>AI Manager dedicato</FeatureItem>
                    <FeatureItem>Dashboard personale completa</FeatureItem>
                    <FeatureItem>
                      <span className="flex items-center gap-2">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        Supporto VIP prioritario
                      </span>
                    </FeatureItem>
                    <FeatureItem>Integrazioni avanzate</FeatureItem>
                  </ul>
                  
                  <Button 
                    size="lg"
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-200/50 transition-all hover:shadow-xl"
                    disabled={purchaseLoading !== null}
                    onClick={() => handlePurchase("3", level3Agent?.agentId || "")}
                  >
                    {purchaseLoading === `3-${level3Agent?.agentId}` ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Caricamento...
                      </>
                    ) : (
                      <>
                        Acquista {tierNames.gold}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        {/* Feature Comparison Table */}
        {!isLoading && (
          <div className="max-w-5xl mx-auto mb-20">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Confronta i piani
              </h2>
              <p className="text-slate-600">
                Scopri tutte le funzionalità incluse in ogni piano
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-4 px-6 font-semibold text-slate-900">
                        Funzionalità
                      </th>
                      <th className="text-center py-4 px-6 font-semibold text-slate-900">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">{tierNames.bronze}</Badge>
                          <span className="text-sm font-normal text-slate-500">Gratuito</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-6 font-semibold text-slate-900 bg-violet-50/50">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 border border-violet-200">{tierNames.silver}</Badge>
                          <span className="text-sm font-normal text-slate-500">
                            €{getDisplayPrice(data?.pricing.level2MonthlyPrice || 29)}/mese
                          </span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-6 font-semibold text-slate-900">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 border border-amber-200">{tierNames.gold}</Badge>
                          <span className="text-sm font-normal text-slate-500">
                            €{getDisplayPrice(data?.pricing.level3MonthlyPrice || 59)}/mese
                          </span>
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARISON_FEATURES.map((feature, index) => (
                      <tr 
                        key={feature.name} 
                        className={cn(
                          "border-b border-slate-100 hover:bg-slate-50/50 transition-colors",
                          index === COMPARISON_FEATURES.length - 1 && "border-b-0"
                        )}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center gap-3">
                            <feature.icon className="h-4 w-4 text-slate-400" />
                            <span className="text-sm text-slate-700">{feature.name}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ComparisonTableCell value={feature.bronze} />
                        </td>
                        <td className="py-4 px-6 text-center bg-violet-50/30">
                          <ComparisonTableCell value={feature.silver} />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ComparisonTableCell value={feature.gold} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Trust Badges */}
        <div className="text-center">
          <div className="inline-flex flex-wrap items-center justify-center gap-8 text-sm text-slate-600">
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
              <Shield className="h-5 w-5 text-emerald-500" />
              <span>Pagamenti sicuri con Stripe</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
              <Clock className="h-5 w-5 text-blue-500" />
              <span>Attivazione immediata</span>
            </div>
            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100">
              <MessageSquare className="h-5 w-5 text-violet-500" />
              <span>Cancella quando vuoi</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t bg-white/80 backdrop-blur-sm py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} Orbitale di Chianetta Trovato Alessio
            </p>
            <div className="flex items-center gap-6">
              <a 
                href="/privacy" 
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="#" 
                className="text-sm text-slate-500 hover:text-slate-900 transition-colors"
              >
                Termini di Servizio
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
