import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { 
  Check, 
  Star, 
  Zap, 
  MessageSquare, 
  Shield, 
  Clock,
  Sparkles,
  AlertCircle,
  ArrowRight
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

function FeatureItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <Check className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
      <span className="text-sm text-muted-foreground">{children}</span>
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

export default function PublicPricing() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["/api/public/consultant", slug, "pricing"],
    queryFn: async () => {
      const response = await fetch(`/api/public/consultant/${slug}/pricing`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Consulente non trovato");
        }
        throw new Error("Errore nel caricamento");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const handleLevel2Purchase = async (agentId: string) => {
    toast({
      title: "Presto disponibile!",
      description: "L'integrazione con Stripe è in arrivo. Presto potrai acquistare questo piano.",
    });
  };

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Errore</h2>
            <p className="text-muted-foreground mb-6">
              {error instanceof Error ? error.message : "Si è verificato un errore"}
            </p>
            <Button onClick={() => navigate("/")} variant="outline">
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[500px] bg-gradient-to-br from-violet-100/40 via-transparent to-emerald-100/30 pointer-events-none" />
      
      <div className="relative max-w-6xl mx-auto px-4 py-16 sm:py-24">
        <div className="text-center mb-16">
          {isLoading ? (
            <>
              <Skeleton className="h-10 w-96 mx-auto mb-4" />
              <Skeleton className="h-6 w-80 mx-auto" />
            </>
          ) : (
            <>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-100 text-violet-700 text-sm font-medium mb-6">
                <Sparkles className="h-4 w-4" />
                Dipendenti AI
              </div>
              <h1 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-4">
                Scegli il piano perfetto per te
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Accedi al tuo Dipendente AI personale con il livello che fa per te
              </p>
              {data?.consultantName && (
                <p className="text-sm text-muted-foreground mt-4">
                  Powered by <span className="font-medium text-foreground">{data.consultantName}</span>
                </p>
              )}
            </>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-6xl mx-auto">
          {isLoading ? (
            <>
              <PricingCardSkeleton />
              <PricingCardSkeleton />
              <PricingCardSkeleton />
            </>
          ) : (
            <>
              {/* Level 1 - Bronzo (Free) */}
              <Card className="relative flex flex-col border-2 border-slate-200 bg-white/80 backdrop-blur-sm hover:shadow-lg transition-shadow">
                <CardHeader className="text-center pb-6">
                  <Badge className="w-fit mx-auto mb-4 bg-amber-100 text-amber-700 hover:bg-amber-100">
                    Gratuito
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">Livello Bronzo</h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-slate-900">€0</span>
                      <span className="text-muted-foreground">/mese</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Per iniziare a scoprire il tuo assistente AI
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>
                      {level1Agent?.dailyMessageLimit || 15} messaggi al giorno
                    </FeatureItem>
                    <FeatureItem>Accesso senza registrazione</FeatureItem>
                    <FeatureItem>Risposte AI immediate</FeatureItem>
                    <FeatureItem>Disponibile 24/7</FeatureItem>
                  </ul>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      if (level1Agent?.publicSlug) {
                        navigate(`/ai/${level1Agent.publicSlug}`);
                      } else {
                        toast({
                          title: "Agente non disponibile",
                          description: "Nessun agente pubblico configurato",
                          variant: "destructive",
                        });
                      }
                    }}
                  >
                    Inizia Gratis
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              {/* Level 2 - Argento (Paid) */}
              <Card className="relative flex flex-col border-2 border-violet-300 bg-white shadow-xl shadow-violet-100/50">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-violet-600 to-indigo-600 text-white hover:from-violet-600 hover:to-indigo-600 px-4 py-1">
                    <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
                    Più Popolare
                  </Badge>
                </div>
                
                <CardHeader className="text-center pb-6 pt-8">
                  <Badge className="w-fit mx-auto mb-4 bg-gradient-to-r from-violet-100 to-indigo-100 text-violet-700 hover:from-violet-100 hover:to-indigo-100">
                    Consigliato
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {data?.pricing.level2Name || "Livello Argento"}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-slate-900">
                        €{data?.pricing.level2MonthlyPrice || 29}
                      </span>
                      <span className="text-muted-foreground">/mese</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data?.pricing.level2Description || "Per chi vuole il massimo dal proprio assistente"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>Tutto del piano Bronzo</FeatureItem>
                    <FeatureItem>
                      <span className="flex items-center gap-1.5">
                        <Zap className="h-4 w-4 text-amber-500" />
                        Messaggi illimitati
                      </span>
                    </FeatureItem>
                    <FeatureItem>Accesso alla Knowledge Base</FeatureItem>
                    <FeatureItem>Risposte personalizzate avanzate</FeatureItem>
                    <FeatureItem>Storico conversazioni salvato</FeatureItem>
                  </ul>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700"
                    onClick={() => level2Agent && handleLevel2Purchase(level2Agent.agentId)}
                  >
                    Acquista Ora
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>

              {/* Level 3 - Deluxe (Premium) */}
              <Card className="relative flex flex-col border-2 border-amber-400 bg-gradient-to-b from-amber-50 to-white shadow-xl shadow-amber-100/50">
                <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-yellow-500 via-amber-500 to-orange-500 text-white hover:from-yellow-500 hover:to-orange-500 px-4 py-1 shadow-lg">
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Premium
                  </Badge>
                </div>
                
                <CardHeader className="text-center pb-6 pt-8">
                  <Badge className="w-fit mx-auto mb-4 bg-gradient-to-r from-amber-100 to-orange-100 text-amber-700 hover:from-amber-100 hover:to-orange-100">
                    Accesso Completo
                  </Badge>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-slate-900">
                      {data?.pricing.level3Name || "Livello Deluxe"}
                    </h3>
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold text-slate-900">
                        €{data?.pricing.level3MonthlyPrice || 59}
                      </span>
                      <span className="text-muted-foreground">/mese</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {data?.pricing.level3Description || "Per professionisti che vogliono tutto"}
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col">
                  <ul className="space-y-3 mb-8 flex-1">
                    <FeatureItem>Tutto del piano Argento</FeatureItem>
                    <FeatureItem>
                      <span className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        Accesso completo al software
                      </span>
                    </FeatureItem>
                    <FeatureItem>AI Manager dedicato</FeatureItem>
                    <FeatureItem>Dashboard personale</FeatureItem>
                    <FeatureItem>
                      <span className="flex items-center gap-1.5">
                        <Shield className="h-4 w-4 text-emerald-500" />
                        Supporto VIP prioritario
                      </span>
                    </FeatureItem>
                  </ul>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600"
                    onClick={() => toast({
                      title: "Presto disponibile!",
                      description: "L'integrazione con Stripe è in arrivo. Presto potrai acquistare questo piano.",
                    })}
                  >
                    Acquista Deluxe
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <div className="mt-16 text-center">
          <div className="inline-flex items-center gap-6 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-500" />
              <span>Pagamenti sicuri</span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-500" />
              <span>Attivazione immediata</span>
            </div>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-violet-500" />
              <span>Cancella quando vuoi</span>
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t bg-white/50 backdrop-blur-sm py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              © {new Date().getFullYear()} Orbitale di Chianetta Trovato Alessio
            </p>
            <div className="flex items-center gap-6">
              <a 
                href="/privacy" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Privacy Policy
              </a>
              <a 
                href="#" 
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
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
