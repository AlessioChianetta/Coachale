import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  CheckCircle2, 
  Mail, 
  ArrowRight, 
  Loader2,
  AlertCircle,
  Sparkles,
  Crown,
  User,
  MessageSquare,
  Key,
  ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import confetti from "canvas-confetti";

interface SuccessData {
  level: "2" | "3";
  billingPeriod: "monthly" | "yearly";
  userType: "manager" | "client";
  clientEmail: string;
  clientName: string;
  subscriptionStatus: string;
  loginUrl: string;
}

export default function PricingSuccess() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);

  const searchParams = new URLSearchParams(window.location.search);
  const sessionId = searchParams.get("session_id");

  const { data, isLoading, error } = useQuery<SuccessData>({
    queryKey: ["/api/stripe/checkout-success", sessionId],
    queryFn: async () => {
      if (!sessionId) {
        throw new Error("NO_SESSION");
      }
      const response = await fetch(`/api/stripe/checkout-success/${sessionId}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "GENERIC_ERROR");
      }
      return response.json();
    },
    enabled: !!sessionId,
    retry: false,
  });

  useEffect(() => {
    if (data && !hasTriggeredConfetti) {
      setHasTriggeredConfetti(true);
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#8b5cf6', '#6366f1', '#10b981', '#f59e0b'],
      });
    }
  }, [data, hasTriggeredConfetti]);

  if (!sessionId) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-16 w-16 text-amber-500 mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-3 text-slate-900">Sessione non trovata</h2>
            <p className="text-muted-foreground mb-8">
              Non abbiamo trovato i dettagli del tuo ordine. Se hai completato un pagamento, 
              controlla la tua email per le istruzioni di accesso.
            </p>
            <Button onClick={() => navigate(`/c/${slug}/pricing`)} variant="outline" size="lg">
              Torna ai prezzi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-lg w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <Loader2 className="h-12 w-12 animate-spin text-violet-600 mx-auto mb-6" />
            <Skeleton className="h-8 w-64 mx-auto mb-4" />
            <Skeleton className="h-5 w-48 mx-auto" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <AlertCircle className="h-16 w-16 text-destructive mx-auto mb-6" />
            <h2 className="text-2xl font-bold mb-3 text-slate-900">Errore</h2>
            <p className="text-muted-foreground mb-8">
              Si è verificato un errore nel recupero dei dettagli dell'ordine. 
              Controlla la tua email per le istruzioni di accesso.
            </p>
            <Button onClick={() => navigate(`/c/${slug}/pricing`)} variant="outline" size="lg">
              Torna ai prezzi
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isLevel2 = data?.level === "2";
  const isLevel3 = data?.level === "3";
  const planName = isLevel2 ? "Argento" : "Oro";
  const planIcon = isLevel2 ? <Sparkles className="h-8 w-8" /> : <Crown className="h-8 w-8" />;
  const planColor = isLevel2 ? "from-violet-500 to-indigo-600" : "from-amber-500 to-orange-500";
  const billingText = data?.billingPeriod === "yearly" ? "annuale" : "mensile";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[400px] bg-gradient-to-br from-emerald-50/60 via-transparent to-violet-50/40 pointer-events-none" />
      
      <div className="relative max-w-2xl mx-auto px-4 py-12 sm:py-20">
        <Card className="shadow-2xl border-0 overflow-hidden">
          <div className={cn("bg-gradient-to-r p-8 text-white text-center", planColor)}>
            <div className="inline-flex items-center justify-center w-16 h-16 bg-white/20 backdrop-blur-sm rounded-full mb-4">
              {planIcon}
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold mb-2">
              Benvenuto nel Piano {planName}!
            </h1>
            <p className="text-white/90 text-lg">
              Abbonamento {billingText} attivato con successo
            </p>
          </div>
          
          <CardContent className="p-8">
            <div className="flex items-center justify-center gap-3 mb-8">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
              <span className="text-xl font-semibold text-slate-900">Pagamento completato</span>
            </div>

            <div className="bg-slate-50 rounded-xl p-6 mb-8">
              <h3 className="font-semibold text-lg mb-4 text-slate-900 flex items-center gap-2">
                <Mail className="h-5 w-5 text-violet-600" />
                Controlla la tua email
              </h3>
              <p className="text-slate-600 mb-4">
                Abbiamo inviato le tue credenziali di accesso a:
              </p>
              <div className="bg-white rounded-lg p-4 border border-slate-200 flex items-center gap-3">
                <User className="h-5 w-5 text-slate-400" />
                <span className="font-medium text-slate-900">{data?.clientEmail}</span>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <div className="flex items-start gap-4 p-4 bg-violet-50 rounded-lg border border-violet-100">
                <Key className="h-6 w-6 text-violet-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">Credenziali di accesso</h4>
                  <p className="text-sm text-slate-600">
                    Usa l'email e la password che hai scelto durante la registrazione per accedere.
                    Ti abbiamo inviato una conferma via email.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-emerald-50 rounded-lg border border-emerald-100">
                <MessageSquare className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-slate-900">
                    {isLevel2 ? "Accesso Manager Chat" : "Accesso Piattaforma Completa"}
                  </h4>
                  <p className="text-sm text-slate-600">
                    {isLevel2 
                      ? "Potrai accedere alla chat con storico conversazioni, preferenze AI personalizzate e accesso illimitato."
                      : "Avrai accesso completo alla piattaforma con dashboard personale, AI Manager dedicato e tutte le funzionalità premium."
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <h4 className="font-semibold text-slate-900 mb-4 text-center">Prossimi passi</h4>
              <div className="grid gap-3">
                <Button 
                  size="lg" 
                  className={cn("w-full bg-gradient-to-r hover:opacity-90 transition-opacity", planColor)}
                  onClick={() => {
                    if (data?.loginUrl) {
                      window.location.href = data.loginUrl;
                    } else if (isLevel2) {
                      navigate("/manager-login");
                    } else {
                      navigate("/login");
                    }
                  }}
                >
                  Accedi alla piattaforma
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                
                <Button 
                  variant="outline" 
                  size="lg"
                  className="w-full"
                  onClick={() => navigate(`/c/${slug}/pricing`)}
                >
                  Torna alla pagina prezzi
                </Button>
              </div>
            </div>

            <div className="mt-8 text-center text-sm text-muted-foreground">
              <p>
                Hai bisogno di aiuto?{" "}
                <a href="mailto:support@example.com" className="text-violet-600 hover:underline">
                  Contattaci
                </a>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-8 text-center">
          <Badge variant="outline" className="text-slate-500">
            {data?.clientName && `Grazie, ${data.clientName}!`}
          </Badge>
        </div>
      </div>
    </div>
  );
}
