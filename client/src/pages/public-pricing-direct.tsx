import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { 
  Check, 
  Sparkles,
  AlertCircle,
  ArrowRight,
  Crown,
  ExternalLink,
  Tag,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface PaymentLink {
  tier: string;
  billingInterval: string;
  priceCents: number;
  originalPriceCents: number | null;
  discountPercent: number | null;
  discountExpiresAt: string | null;
  paymentLinkUrl: string | null;
}

interface PricingData {
  consultantName: string;
  consultantSlug: string;
  pricing: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroBadgeText: string | null;
    
    level2Name: string;
    level2Description: string;
    level2Features: string[];
    level2Badge: string;
    level2CtaText: string;
    
    level3Name: string;
    level3Description: string;
    level3Features: string[];
    level3Badge: string;
    level3CtaText: string;
    
    accentColor: string | null;
    logoUrl: string | null;
  };
  paymentLinks: {
    silver: {
      monthly: PaymentLink | undefined;
      yearly: PaymentLink | undefined;
    };
    gold: {
      monthly: PaymentLink | undefined;
      yearly: PaymentLink | undefined;
    };
  };
}

function FeatureItem({ children, accentColor }: { children: React.ReactNode; accentColor?: string | null }) {
  return (
    <li className="flex items-start gap-3">
      <Check 
        className="h-5 w-5 shrink-0 mt-0.5" 
        style={{ color: accentColor || "rgb(16 185 129)" }}
      />
      <span className="text-sm text-slate-700">{children}</span>
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

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4 }
};

const staggerContainer = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1
    }
  }
};

const pricingCardVariants = {
  initial: { opacity: 0, y: 30 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { duration: 0.5, ease: "easeOut" }
  }
};

export default function PublicPricingDirect() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const [isAnnual, setIsAnnual] = useState(false);

  const { data, isLoading, error } = useQuery<PricingData>({
    queryKey: ["/api/public/consultant", slug, "pricing"],
    queryFn: async () => {
      const response = await fetch(`/api/public/consultant/${slug}/pricing`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("NOT_FOUND");
        }
        throw new Error("GENERIC_ERROR");
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });

  const hasPaymentLinks = data?.paymentLinks && (
    data.paymentLinks.silver?.monthly?.paymentLinkUrl ||
    data.paymentLinks.silver?.yearly?.paymentLinkUrl ||
    data.paymentLinks.gold?.monthly?.paymentLinkUrl ||
    data.paymentLinks.gold?.yearly?.paymentLinkUrl
  );

  const handlePurchase = (tier: "silver" | "gold") => {
    const interval = isAnnual ? "yearly" : "monthly";
    const paymentLink = data?.paymentLinks?.[tier]?.[interval];
    
    if (paymentLink?.paymentLinkUrl) {
      window.location.href = paymentLink.paymentLinkUrl;
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2).replace(".", ",");
  };

  const getDiscountInfo = (tier: "silver" | "gold") => {
    const interval = isAnnual ? "yearly" : "monthly";
    const paymentLink = data?.paymentLinks?.[tier]?.[interval];
    
    if (!paymentLink) return null;
    
    return {
      price: paymentLink.priceCents,
      originalPrice: paymentLink.originalPriceCents,
      discountPercent: paymentLink.discountPercent,
      discountExpiresAt: paymentLink.discountExpiresAt,
      hasDiscount: paymentLink.discountPercent && paymentLink.discountPercent > 0,
    };
  };

  if (error) {
    const errorMessage = error instanceof Error ? error.message : "GENERIC_ERROR";
    
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mb-6 flex justify-center">
              <AlertCircle className="h-16 w-16 text-destructive" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-slate-900">
              {errorMessage === "NOT_FOUND" ? "Consulente non trovato" : "Errore"}
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              {errorMessage === "NOT_FOUND" 
                ? "Il consulente che stai cercando non esiste o non ha una pagina prezzi pubblica configurata."
                : "Si è verificato un errore imprevisto. Riprova più tardi."}
            </p>
            <Button onClick={() => navigate("/")} variant="outline" size="lg">
              Torna alla home
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const accentColor = data?.pricing.accentColor;

  if (!isLoading && !hasPaymentLinks) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="mb-6 flex justify-center">
              <ExternalLink className="h-16 w-16 text-amber-500" />
            </div>
            <h2 className="text-2xl font-bold mb-3 text-slate-900">
              Link di pagamento non configurati
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              I link di pagamento diretti non sono ancora configurati per questo consulente.
            </p>
            <Button 
              onClick={() => navigate(`/c/${slug}/pricing`)} 
              size="lg"
              className="gap-2"
              style={accentColor ? {
                backgroundColor: accentColor,
                color: "white",
              } : undefined}
            >
              Vai alla pagina prezzi standard
              <ArrowRight className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const silverInfo = getDiscountInfo("silver");
  const goldInfo = getDiscountInfo("gold");

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-br from-violet-50/60 via-transparent to-emerald-50/40 pointer-events-none" />
      
      <div className="relative max-w-5xl mx-auto px-4 py-12 sm:py-20">
        <motion.div 
          className="text-center mb-12"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {isLoading ? (
            <>
              <Skeleton className="h-20 w-20 rounded-full mx-auto mb-6" />
              <Skeleton className="h-12 w-[400px] max-w-full mx-auto mb-4" />
              <Skeleton className="h-6 w-[300px] max-w-full mx-auto" />
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
                Pagamento Diretto
              </motion.div>
              
              <motion.h1 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight"
                variants={fadeInUp}
              >
                Scegli il tuo piano
              </motion.h1>
              
              {data?.consultantName && (
                <motion.p 
                  className="text-lg text-slate-600"
                  variants={fadeInUp}
                >
                  con <span className="font-semibold">{data.consultantName}</span>
                </motion.p>
              )}
            </>
          )}
        </motion.div>

        <motion.div 
          className="flex items-center justify-center gap-4 mb-12"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          <span className={cn(
            "text-sm font-medium transition-colors",
            !isAnnual ? "text-slate-900" : "text-slate-400"
          )}>
            Mensile
          </span>
          <Switch
            checked={isAnnual}
            onCheckedChange={setIsAnnual}
            className="data-[state=checked]:bg-emerald-500"
          />
          <span className={cn(
            "text-sm font-medium transition-colors flex items-center gap-2",
            isAnnual ? "text-slate-900" : "text-slate-400"
          )}>
            Annuale
            <Badge 
              variant="secondary" 
              className="bg-emerald-100 text-emerald-700 border-0"
            >
              Risparmia
            </Badge>
          </span>
        </motion.div>

        <motion.div 
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {isLoading ? (
            <>
              <PricingCardSkeleton />
              <PricingCardSkeleton />
            </>
          ) : (
            <>
              {silverInfo && (
                <motion.div variants={pricingCardVariants}>
                  <Card className={cn(
                    "relative flex flex-col h-full border-2 transition-all duration-300",
                    "hover:shadow-xl hover:border-violet-200"
                  )}>
                    <div 
                      className="absolute top-0 left-0 right-0 h-1 rounded-t-lg"
                      style={{ backgroundColor: accentColor || "rgb(124 58 237)" }}
                    />
                    
                    <CardHeader className="text-center pb-4 pt-8">
                      <Badge 
                        className="w-fit mx-auto mb-4"
                        style={accentColor ? {
                          backgroundColor: `${accentColor}20`,
                          color: accentColor,
                        } : undefined}
                      >
                        {data?.pricing.level2Badge || "Popolare"}
                      </Badge>
                      
                      <h3 className="text-2xl font-bold text-slate-900">
                        {data?.pricing.level2Name || "Argento"}
                      </h3>
                      
                      <div className="mt-4">
                        {silverInfo.hasDiscount && silverInfo.originalPrice && (
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-lg text-slate-400 line-through">
                              €{formatPrice(silverInfo.originalPrice)}
                            </span>
                            <Badge className="bg-red-100 text-red-700 border-0">
                              <Tag className="h-3 w-3 mr-1" />
                              -{silverInfo.discountPercent}%
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">
                            €{formatPrice(silverInfo.price)}
                          </span>
                          <span className="text-slate-500">
                            /{isAnnual ? "anno" : "mese"}
                          </span>
                        </div>
                        {silverInfo.discountExpiresAt && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-sm text-amber-600">
                            <Clock className="h-4 w-4" />
                            Offerta valida fino al {new Date(silverInfo.discountExpiresAt).toLocaleDateString("it-IT")}
                          </div>
                        )}
                      </div>
                      
                      <p className="text-slate-600 mt-4">
                        {data?.pricing.level2Description}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-3 flex-1">
                        {data?.pricing.level2Features?.map((feature, idx) => (
                          <FeatureItem key={idx} accentColor={accentColor}>
                            {feature}
                          </FeatureItem>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full mt-6 gap-2"
                        size="lg"
                        onClick={() => handlePurchase("silver")}
                        disabled={!data?.paymentLinks?.silver?.[isAnnual ? "yearly" : "monthly"]?.paymentLinkUrl}
                        style={accentColor ? {
                          backgroundColor: accentColor,
                          color: "white",
                        } : undefined}
                      >
                        {data?.pricing.level2CtaText || "Acquista Ora"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {goldInfo && (
                <motion.div variants={pricingCardVariants}>
                  <Card className={cn(
                    "relative flex flex-col h-full border-2 transition-all duration-300",
                    "hover:shadow-xl hover:border-amber-200 border-amber-100 bg-gradient-to-b from-amber-50/50 to-white"
                  )}>
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-amber-400 to-amber-500" />
                    
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-amber-500 text-white border-0 shadow-lg px-4 py-1">
                        <Crown className="h-3 w-3 mr-1" />
                        {data?.pricing.level3Badge || "Premium"}
                      </Badge>
                    </div>
                    
                    <CardHeader className="text-center pb-4 pt-10">
                      <h3 className="text-2xl font-bold text-slate-900">
                        {data?.pricing.level3Name || "Oro"}
                      </h3>
                      
                      <div className="mt-4">
                        {goldInfo.hasDiscount && goldInfo.originalPrice && (
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-lg text-slate-400 line-through">
                              €{formatPrice(goldInfo.originalPrice)}
                            </span>
                            <Badge className="bg-red-100 text-red-700 border-0">
                              <Tag className="h-3 w-3 mr-1" />
                              -{goldInfo.discountPercent}%
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">
                            €{formatPrice(goldInfo.price)}
                          </span>
                          <span className="text-slate-500">
                            /{isAnnual ? "anno" : "mese"}
                          </span>
                        </div>
                        {goldInfo.discountExpiresAt && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-sm text-amber-600">
                            <Clock className="h-4 w-4" />
                            Offerta valida fino al {new Date(goldInfo.discountExpiresAt).toLocaleDateString("it-IT")}
                          </div>
                        )}
                      </div>
                      
                      <p className="text-slate-600 mt-4">
                        {data?.pricing.level3Description}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-3 flex-1">
                        {data?.pricing.level3Features?.map((feature, idx) => (
                          <FeatureItem key={idx} accentColor="rgb(245 158 11)">
                            {feature}
                          </FeatureItem>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full mt-6 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white"
                        size="lg"
                        onClick={() => handlePurchase("gold")}
                        disabled={!data?.paymentLinks?.gold?.[isAnnual ? "yearly" : "monthly"]?.paymentLinkUrl}
                      >
                        {data?.pricing.level3CtaText || "Acquista Premium"}
                        <Crown className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
        </motion.div>

        <motion.div 
          className="text-center mt-12"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          <Button
            variant="ghost"
            onClick={() => navigate(`/c/${slug}/pricing`)}
            className="text-slate-500 hover:text-slate-700"
          >
            Oppure vai alla pagina prezzi completa
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
