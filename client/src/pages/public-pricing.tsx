import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
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
  Settings,
  Mail,
  ExternalLink,
  Award,
  Quote,
  Users,
  TrendingUp,
  ChevronDown
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

interface FAQ {
  question: string;
  answer: string;
}

interface Testimonial {
  name: string;
  role?: string;
  company?: string;
  content: string;
  avatarUrl?: string;
  rating?: number;
}

interface TrustBadge {
  icon: string;
  text: string;
}

interface ComparisonFeature {
  name: string;
  bronze: boolean | string;
  silver: boolean | string;
  gold: boolean | string;
}

interface PricingData {
  consultantName: string;
  consultantSlug: string;
  agents: Agent[];
  pricing: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroBadgeText: string | null;
    
    level1Name: string;
    level1Description: string;
    level1DailyMessageLimit: number;
    level1Features: string[];
    
    level2Name: string;
    level2Description: string;
    level2ShortDescription: string | null;
    level2MonthlyPrice: number;
    level2YearlyPrice: number;
    level2Features: string[];
    level2Badge: string;
    level2CtaText: string;
    
    level3Name: string;
    level3Description: string;
    level3ShortDescription: string | null;
    level3MonthlyPrice: number;
    level3YearlyPrice: number;
    level3Features: string[];
    level3Badge: string;
    level3CtaText: string;
    
    accentColor: string | null;
    logoUrl: string | null;
    backgroundStyle: "gradient" | "solid" | "pattern";
    
    faqs: FAQ[];
    testimonials: Testimonial[];
    trustBadges: TrustBadge[];
    
    guaranteeEnabled: boolean;
    guaranteeDays: number;
    guaranteeText: string;
    
    footerText: string | null;
    contactEmail: string | null;
    termsUrl: string | null;
    privacyUrl: string | null;
    
    showComparisonTable: boolean;
    comparisonFeatures: ComparisonFeature[];
  };
}

const FEATURES = [
  { icon: Bot, title: "Assistente AI Intelligente", description: "Risposte personalizzate basate sul tuo contesto" },
  { icon: MessageSquare, title: "Chat Illimitata", description: "Comunica senza limiti con i piani premium" },
  { icon: Brain, title: "Apprendimento Continuo", description: "L'AI migliora ad ogni interazione" },
  { icon: Database, title: "Knowledge Base", description: "Accesso a documenti e risorse personalizzate" },
  { icon: Clock, title: "Disponibile 24/7", description: "Assistenza automatica sempre attiva" },
  { icon: Shield, title: "Sicurezza Avanzata", description: "Dati protetti con crittografia end-to-end" }
];

const COMPARISON_ROWS = [
  { feature: "Messaggi giornalieri", bronze: "15/giorno", silver: "Illimitati", gold: "Illimitati" },
  { feature: "Knowledge Base", bronze: false, silver: true, gold: true },
  { feature: "Supporto prioritario", bronze: false, silver: true, gold: true },
  { feature: "Dashboard analytics", bronze: false, silver: false, gold: true },
  { feature: "API access", bronze: false, silver: false, gold: true },
  { feature: "Custom integrations", bronze: false, silver: false, gold: true },
];

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

const DEFAULT_TRUST_BADGES = [
  { icon: "Shield", text: "Pagamenti sicuri con Stripe" },
  { icon: "Clock", text: "Attivazione immediata" },
  { icon: "MessageSquare", text: "Cancella quando vuoi" },
];

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Shield,
  Clock,
  MessageSquare,
  Star,
  Check,
  Award,
  Brain,
  Bot,
  Database,
  History,
  Settings,
  UserCheck,
  Headphones,
  Crown,
  Zap,
  Sparkles,
};

function getIconComponent(iconName: string) {
  return ICON_MAP[iconName] || Shield;
}

function FeatureItem({ children, included = true, accentColor }: { children: React.ReactNode; included?: boolean; accentColor?: string | null }) {
  return (
    <li className="flex items-start gap-3">
      {included ? (
        <Check 
          className="h-5 w-5 shrink-0 mt-0.5" 
          style={{ color: accentColor || "rgb(16 185 129)" }}
        />
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

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={cn(
            "h-4 w-4",
            star <= rating ? "text-amber-400 fill-amber-400" : "text-slate-200"
          )}
        />
      ))}
    </div>
  );
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.5 }
};

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1
    }
  }
};

const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2 }
};

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

  const checkoutMutation = useMutation({
    mutationFn: async ({ level, isAnnual: annual }: { level: "2" | "3"; isAnnual: boolean }) => {
      const agentId = level === "2" 
        ? (data?.agents.find(a => a.level === "2")?.agentId || data?.agents.find(a => a.level === "1")?.agentId || "")
        : (data?.agents.find(a => a.level === "3")?.agentId || "");
      
      const response = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          consultantSlug: slug,
          agentId,
          level,
          billingPeriod: annual ? "yearly" : "monthly",
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

  const handlePurchase = (level: "2" | "3") => {
    setPurchaseLoading(level);
    checkoutMutation.mutate({ level, isAnnual });
  };

  const scrollToPricing = () => {
    document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth' });
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
    bronze: data?.pricing.level1Name || "Bronze",
    silver: data?.pricing.level2Name || "Argento",
    gold: data?.pricing.level3Name || "Oro",
  };

  const accentColor = data?.pricing.accentColor;

  const trustBadges = data?.pricing.trustBadges?.length 
    ? data.pricing.trustBadges 
    : DEFAULT_TRUST_BADGES;

  const comparisonFeatures = data?.pricing.comparisonFeatures?.length
    ? data.pricing.comparisonFeatures
    : COMPARISON_FEATURES;

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-br from-violet-50/60 via-transparent to-emerald-50/40 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-20">
        {/* Enhanced Hero Section with Animations */}
        <motion.div 
          className="text-center mb-16"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-6" />
              <Skeleton className="h-12 w-[500px] max-w-full mx-auto mb-4" />
              <Skeleton className="h-6 w-[400px] max-w-full mx-auto" />
            </>
          ) : (
            <>
              {data?.pricing.logoUrl && (
                <motion.img 
                  src={data.pricing.logoUrl} 
                  alt={data.consultantName}
                  className="h-20 w-20 rounded-full mx-auto mb-8 object-cover shadow-xl ring-4 ring-white"
                  variants={fadeInUp}
                />
              )}
              
              <motion.div 
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-base font-semibold mb-8 shadow-lg"
                style={accentColor ? {
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `2px solid ${accentColor}40`,
                } : {
                  background: "linear-gradient(to right, rgb(237 233 254), rgb(224 231 255))",
                  color: "rgb(109 40 217)",
                  border: "2px solid rgb(196 181 253)",
                }}
                variants={fadeInUp}
              >
                <Sparkles className="h-5 w-5" />
                {data?.pricing.heroBadgeText || "Il Tuo Assistente AI Personale"}
              </motion.div>
              
              <motion.h1 
                className="text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 mb-6 tracking-tight"
                variants={fadeInUp}
              >
                {data?.pricing.heroTitle ? (
                  data.pricing.heroTitle
                ) : (
                  <>
                    Scegli il piano perfetto
                    <span 
                      className="block text-transparent bg-clip-text mt-2"
                      style={accentColor ? {
                        backgroundImage: `linear-gradient(to right, ${accentColor}, ${accentColor}cc)`,
                      } : {
                        backgroundImage: "linear-gradient(to right, rgb(124 58 237), rgb(79 70 229))",
                      }}
                    >
                      per le tue esigenze
                    </span>
                  </>
                )}
              </motion.h1>
              
              <motion.p 
                className="text-lg sm:text-xl text-slate-600 max-w-2xl mx-auto mb-4"
                variants={fadeInUp}
              >
                {data?.pricing.heroSubtitle || "Accedi al tuo Dipendente AI personale e automatizza le tue attività quotidiane"}
              </motion.p>
              
              {data?.consultantName && (
                <motion.p 
                  className="text-sm text-muted-foreground mb-8"
                  variants={fadeInUp}
                >
                  Powered by <span className="font-semibold text-slate-700">{data.consultantName}</span>
                </motion.p>
              )}

              {/* Hero CTAs */}
              <motion.div 
                className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10"
                variants={fadeInUp}
              >
                <Button 
                  size="lg"
                  className="px-8 py-6 text-lg shadow-xl text-white"
                  style={accentColor ? {
                    background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                  } : {
                    background: "linear-gradient(to right, rgb(124 58 237), rgb(79 70 229))",
                  }}
                  onClick={() => navigate(`/c/${slug}/register`)}
                >
                  Inizia Gratis
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="px-8 py-6 text-lg"
                  onClick={scrollToPricing}
                >
                  Scopri i Piani
                  <ChevronDown className="h-5 w-5 ml-2" />
                </Button>
              </motion.div>

              {/* Optional Stats Row */}
              <motion.div 
                className="flex flex-wrap items-center justify-center gap-8 text-center"
                variants={fadeInUp}
              >
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5" style={{ color: accentColor || "rgb(124 58 237)" }} />
                  <span className="text-slate-600"><strong className="text-slate-900">1000+</strong> utenti</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5" style={{ color: accentColor || "rgb(124 58 237)" }} />
                  <span className="text-slate-600"><strong className="text-slate-900">24/7</strong> disponibile</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" style={{ color: accentColor || "rgb(124 58 237)" }} />
                  <span className="text-slate-600"><strong className="text-slate-900">99.9%</strong> uptime</span>
                </div>
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Features Section */}
        {!isLoading && (
          <motion.div 
            className="max-w-5xl mx-auto mb-20"
            initial="initial"
            whileInView="animate"
            viewport={{ once: true }}
            variants={staggerContainer}
          >
            <motion.div className="text-center mb-12" variants={fadeInUp}>
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Tutto ciò di cui hai bisogno
              </h2>
              <p className="text-slate-600">
                Funzionalità avanzate per automatizzare il tuo lavoro
              </p>
            </motion.div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <motion.div
                    key={index}
                    className="bg-white rounded-xl p-6 shadow-sm border border-slate-100 hover:shadow-lg hover:border-slate-200 transition-all duration-300"
                    variants={fadeInUp}
                    whileHover={{ y: -4 }}
                  >
                    <div 
                      className="w-12 h-12 rounded-lg flex items-center justify-center mb-4"
                      style={accentColor ? {
                        backgroundColor: `${accentColor}15`,
                      } : {
                        backgroundColor: "rgb(245 243 255)",
                      }}
                    >
                      <IconComponent 
                        className="h-6 w-6" 
                        style={{ color: accentColor || "rgb(124 58 237)" }}
                      />
                    </div>
                    <h3 className="font-bold text-slate-900 mb-2">{feature.title}</h3>
                    <p className="text-sm text-slate-500">{feature.description}</p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Trust Badges Row */}
        {!isLoading && trustBadges.length > 0 && (
          <motion.div 
            className="flex flex-wrap items-center justify-center gap-4 mb-10"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            {trustBadges.map((badge, index) => {
              const IconComponent = getIconComponent(badge.icon);
              return (
                <div 
                  key={index}
                  className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm border border-slate-100"
                >
                  <IconComponent 
                    className="h-5 w-5" 
                    style={{ color: accentColor || "rgb(16 185 129)" }}
                  />
                  <span className="text-sm text-slate-600">{badge.text}</span>
                </div>
              );
            })}
          </motion.div>
        )}

        {/* Billing Toggle */}
        <div id="pricing-section" className="flex items-center justify-center gap-4 mb-12 pt-8">
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
            style={accentColor && isAnnual ? { backgroundColor: accentColor } : undefined}
          />
          <span className={cn(
            "text-sm font-medium transition-colors",
            isAnnual ? "text-slate-900" : "text-slate-500"
          )}>
            Annuale
          </span>
          {isAnnual && (
            <Badge 
              className="ml-2"
              style={accentColor ? {
                backgroundColor: `${accentColor}20`,
                color: accentColor,
              } : {
                backgroundColor: "rgb(209 250 229)",
                color: "rgb(21 128 61)",
              }}
            >
              Risparmia 15%
            </Badge>
          )}
        </div>

        {/* Guarantee Banner */}
        {!isLoading && data?.pricing.guaranteeEnabled && (
          <div 
            className="max-w-2xl mx-auto mb-10 p-4 rounded-xl border text-center"
            style={accentColor ? {
              backgroundColor: `${accentColor}10`,
              borderColor: `${accentColor}30`,
            } : {
              backgroundColor: "rgb(236 253 245)",
              borderColor: "rgb(167 243 208)",
            }}
          >
            <div className="flex items-center justify-center gap-3">
              <Shield 
                className="h-6 w-6" 
                style={{ color: accentColor || "rgb(16 185 129)" }}
              />
              <div>
                <p 
                  className="font-semibold"
                  style={{ color: accentColor || "rgb(21 128 61)" }}
                >
                  Garanzia {data.pricing.guaranteeDays} giorni
                </p>
                <p className="text-sm text-slate-600">
                  {data.pricing.guaranteeText}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Pricing Cards */}
        <motion.div 
          className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto mb-20"
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerContainer}
        >
          {isLoading ? (
            <>
              <PricingCardSkeleton />
              <PricingCardSkeleton />
              <PricingCardSkeleton />
            </>
          ) : (
            <>
              {/* Level 1 - Bronze (Free) */}
              <motion.div variants={fadeInUp} whileHover={cardHover}>
                <Card className="relative flex flex-col h-full border border-slate-200 bg-white hover:shadow-xl hover:border-slate-300 transition-all duration-300 group">
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
                        {data?.pricing.level1Description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 mb-8 flex-1">
                      {data?.pricing.level1Features.map((feature, index) => (
                        <FeatureItem key={index} accentColor={accentColor}>
                          {feature}
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button 
                      variant="outline" 
                      size="lg"
                      className="w-full group-hover:bg-slate-50 transition-colors"
                      onClick={() => navigate(`/c/${slug}/register`)}
                    >
                      Inizia Gratis
                      <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Level 2 - Silver (Paid) */}
              <motion.div variants={fadeInUp} whileHover={cardHover}>
                <Card 
                  className="relative flex flex-col h-full border-2 bg-white shadow-xl hover:shadow-2xl transition-all duration-300"
                  style={accentColor ? {
                    borderColor: accentColor,
                    boxShadow: `0 25px 50px -12px ${accentColor}20`,
                  } : {
                    borderColor: "rgb(167 139 250)",
                    boxShadow: "0 25px 50px -12px rgb(139 92 246 / 0.25)",
                  }}
                >
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge 
                      className="text-white px-4 py-1.5 shadow-lg"
                      style={accentColor ? {
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                      } : {
                        background: "linear-gradient(to right, rgb(124 58 237), rgb(79 70 229))",
                      }}
                    >
                      <Star className="h-3.5 w-3.5 mr-1.5 fill-current" />
                      {data?.pricing.level2Badge}
                    </Badge>
                  </div>
                  
                  <CardHeader className="text-center pb-6 pt-8">
                    <Badge 
                      className="w-fit mx-auto mb-4 border"
                      style={accentColor ? {
                        backgroundColor: `${accentColor}10`,
                        color: accentColor,
                        borderColor: `${accentColor}30`,
                      } : {
                        background: "linear-gradient(to right, rgb(245 243 255), rgb(238 242 255))",
                        color: "rgb(109 40 217)",
                        borderColor: "rgb(221 214 254)",
                      }}
                    >
                      {tierNames.silver}
                    </Badge>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {data?.pricing.level2Name}
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
                        {data?.pricing.level2ShortDescription || data?.pricing.level2Description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 mb-8 flex-1">
                      {data?.pricing.level2Features.map((feature, index) => (
                        <FeatureItem key={index} accentColor={accentColor}>
                          {index === 0 ? (
                            <span className="flex items-center gap-2">
                              <Zap className="h-4 w-4 text-amber-500" />
                              {feature}
                            </span>
                          ) : feature}
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button 
                      size="lg"
                      className="w-full shadow-lg transition-all hover:shadow-xl text-white"
                      style={accentColor ? {
                        background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
                      } : {
                        background: "linear-gradient(to right, rgb(124 58 237), rgb(79 70 229))",
                      }}
                      disabled={purchaseLoading !== null}
                      onClick={() => handlePurchase("2")}
                    >
                      {purchaseLoading === "2" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Caricamento...
                        </>
                      ) : (
                        <>
                          {data?.pricing.level2CtaText}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {/* Level 3 - Gold (Premium) */}
              <motion.div variants={fadeInUp} whileHover={cardHover}>
                <Card className="relative flex flex-col h-full border border-amber-300 bg-gradient-to-b from-amber-50/50 to-white hover:shadow-xl hover:border-amber-400 transition-all duration-300 group">
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-amber-500 via-yellow-500 to-orange-500 text-white hover:from-amber-500 hover:to-orange-500 px-4 py-1.5 shadow-lg">
                      <Crown className="h-3.5 w-3.5 mr-1.5" />
                      {data?.pricing.level3Badge}
                    </Badge>
                  </div>
                  
                  <CardHeader className="text-center pb-6 pt-8">
                    <Badge className="w-fit mx-auto mb-4 bg-gradient-to-r from-amber-50 to-orange-50 text-amber-700 border border-amber-200 hover:from-amber-50 hover:to-orange-50">
                      {tierNames.gold}
                    </Badge>
                    <div className="space-y-2">
                      <h3 className="text-xl font-bold text-slate-900">
                        {data?.pricing.level3Name}
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
                        {data?.pricing.level3ShortDescription || data?.pricing.level3Description}
                      </p>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-3 mb-8 flex-1">
                      {data?.pricing.level3Features.map((feature, index) => (
                        <FeatureItem key={index} accentColor={accentColor}>
                          {index === 0 ? (
                            <span className="flex items-center gap-2">
                              <Sparkles className="h-4 w-4 text-amber-500" />
                              {feature}
                            </span>
                          ) : feature}
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button 
                      size="lg"
                      className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 shadow-lg shadow-amber-200/50 transition-all hover:shadow-xl text-white"
                      disabled={purchaseLoading !== null}
                      onClick={() => handlePurchase("3")}
                    >
                      {purchaseLoading === "3" ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Caricamento...
                        </>
                      ) : (
                        <>
                          {data?.pricing.level3CtaText}
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>

        {/* Comparison Table Section */}
        {!isLoading && (
          <motion.div 
            className="max-w-5xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
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
                      <th 
                        className="text-center py-4 px-6 font-semibold text-slate-900"
                        style={accentColor ? { backgroundColor: `${accentColor}10` } : { backgroundColor: "rgb(245 243 255 / 0.5)" }}
                      >
                        <div className="flex flex-col items-center gap-1">
                          <Badge 
                            className="border"
                            style={accentColor ? {
                              backgroundColor: `${accentColor}15`,
                              color: accentColor,
                              borderColor: `${accentColor}30`,
                            } : {
                              background: "linear-gradient(to right, rgb(238 242 255), rgb(224 231 255))",
                              color: "rgb(109 40 217)",
                              borderColor: "rgb(196 181 253)",
                            }}
                          >
                            {tierNames.silver}
                          </Badge>
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
                    {COMPARISON_ROWS.map((row, index) => (
                      <tr 
                        key={row.feature} 
                        className={cn(
                          "border-b border-slate-100 hover:bg-slate-50/50 transition-colors",
                          index === COMPARISON_ROWS.length - 1 && "border-b-0"
                        )}
                      >
                        <td className="py-4 px-6">
                          <span className="text-sm text-slate-700">{row.feature}</span>
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ComparisonTableCell value={row.bronze} />
                        </td>
                        <td 
                          className="py-4 px-6 text-center"
                          style={accentColor ? { backgroundColor: `${accentColor}05` } : { backgroundColor: "rgb(124 58 237 / 0.03)" }}
                        >
                          <ComparisonTableCell value={row.silver} />
                        </td>
                        <td className="py-4 px-6 text-center">
                          <ComparisonTableCell value={row.gold} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {/* Social Proof Section */}
        {!isLoading && (
          <motion.div 
            className="max-w-4xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div 
              className="rounded-2xl p-8 text-center"
              style={accentColor ? {
                background: `linear-gradient(135deg, ${accentColor}10, ${accentColor}05)`,
                border: `1px solid ${accentColor}20`,
              } : {
                background: "linear-gradient(135deg, rgb(245 243 255), rgb(238 242 255))",
                border: "1px solid rgb(221 214 254)",
              }}
            >
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div 
                      key={i}
                      className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-sm font-semibold text-white"
                      style={{ 
                        backgroundColor: accentColor || "rgb(124 58 237)",
                        opacity: 1 - (i * 0.1)
                      }}
                    >
                      {String.fromCharCode(64 + i)}
                    </div>
                  ))}
                </div>
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">
                Unisciti a centinaia di professionisti
              </h3>
              <p className="text-slate-600">
                che hanno già automatizzato il loro lavoro con il nostro AI assistant
              </p>
            </div>
          </motion.div>
        )}

        {/* Testimonials Section */}
        {!isLoading && data?.pricing.testimonials && data.pricing.testimonials.length > 0 && (
          <motion.div 
            className="max-w-6xl mx-auto mb-20"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Cosa dicono i nostri clienti
              </h2>
              <p className="text-slate-600">
                Scopri le esperienze di chi ha già scelto i nostri piani
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.pricing.testimonials.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <Card className="relative bg-white hover:shadow-lg transition-shadow h-full">
                    <CardContent className="pt-6">
                      <Quote 
                        className="h-8 w-8 mb-4 opacity-20" 
                        style={{ color: accentColor || "rgb(124 58 237)" }}
                      />
                      <p className="text-slate-600 mb-6 leading-relaxed">
                        "{testimonial.content}"
                      </p>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          {testimonial.avatarUrl ? (
                            <AvatarImage src={testimonial.avatarUrl} alt={testimonial.name} />
                          ) : null}
                          <AvatarFallback 
                            style={accentColor ? { backgroundColor: `${accentColor}20`, color: accentColor } : undefined}
                          >
                            {testimonial.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{testimonial.name}</p>
                          {(testimonial.role || testimonial.company) && (
                            <p className="text-sm text-slate-500">
                              {testimonial.role}{testimonial.role && testimonial.company && " @ "}{testimonial.company}
                            </p>
                          )}
                        </div>
                        {testimonial.rating && (
                          <StarRating rating={testimonial.rating} />
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* FAQ Section */}
        {!isLoading && data?.pricing.faqs && data.pricing.faqs.length > 0 && (
          <motion.div 
            className="max-w-3xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-3">
                Domande Frequenti
              </h2>
              <p className="text-slate-600">
                Trova le risposte alle domande più comuni
              </p>
            </div>
            
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  {data.pricing.faqs.map((faq, index) => (
                    <AccordionItem key={index} value={`faq-${index}`}>
                      <AccordionTrigger className="text-left hover:no-underline">
                        <span className="font-medium text-slate-900">{faq.question}</span>
                      </AccordionTrigger>
                      <AccordionContent className="text-slate-600 leading-relaxed">
                        {faq.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Final CTA Section */}
        {!isLoading && (
          <motion.div 
            className="max-w-4xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <div 
              className="rounded-2xl p-10 text-center shadow-xl"
              style={accentColor ? {
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              } : {
                background: "linear-gradient(135deg, rgb(124 58 237), rgb(79 70 229))",
              }}
            >
              <h2 className="text-3xl font-bold text-white mb-3">
                Pronto a iniziare?
              </h2>
              <p className="text-white/80 mb-8 text-lg">
                Registrati gratis e scopri il potere dell'AI
              </p>
              <Button 
                size="lg"
                className="bg-white hover:bg-slate-100 text-slate-900 px-8 py-6 text-lg shadow-lg"
                onClick={() => navigate(`/c/${slug}/register`)}
              >
                Inizia Gratis Ora
                <ArrowRight className="h-5 w-5 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* Enhanced Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm py-10 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-6">
            {data?.pricing.contactEmail && (
              <a 
                href={`mailto:${data.pricing.contactEmail}`}
                className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
              >
                <Mail className="h-5 w-5" />
                <span>{data.pricing.contactEmail}</span>
              </a>
            )}
            
            <div className="flex flex-wrap items-center justify-center gap-6">
              {data?.pricing.privacyUrl && (
                <a 
                  href={data.pricing.privacyUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Privacy Policy
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {data?.pricing.termsUrl && (
                <a 
                  href={data.pricing.termsUrl} 
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-900 transition-colors"
                >
                  Termini di Servizio
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
              {!data?.pricing.privacyUrl && !data?.pricing.termsUrl && (
                <>
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
                </>
              )}
            </div>
            
            <p className="text-sm text-slate-500">
              {data?.pricing.footerText || `© ${new Date().getFullYear()} ${data?.consultantName || "Orbitale"}. Tutti i diritti riservati.`}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
