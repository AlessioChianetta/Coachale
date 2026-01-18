import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  Sparkles,
  AlertCircle,
  ArrowRight,
  Crown,
  ExternalLink,
  Tag,
  Clock,
  Shield,
  Star,
  Loader2,
  Diamond,
  MessageSquare,
  Users,
  Briefcase,
  Quote,
  Phone,
  Mail,
  Building,
  Zap,
  Bot,
  Brain,
  Database,
  Headphones,
  Award,
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
  consultantId?: string;
  pricing: {
    heroTitle: string | null;
    heroSubtitle: string | null;
    heroBadgeText: string | null;
    
    level1Name: string;
    level1Description: string;
    level1Features: string[];
    
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
    
    level4Name?: string;
    level4Description?: string;
    level4Features?: string[];
    level4Badge?: string;
    level4CtaText?: string;
    
    level5Name?: string;
    level5Description?: string;
    level5Features?: string[];
    
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
    deluxe?: {
      monthly: PaymentLink | undefined;
      yearly: PaymentLink | undefined;
    };
  };
}

interface RegistrationForm {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
  confirmPassword: string;
  phone: string;
}

interface ContactForm {
  name: string;
  email: string;
  phone: string;
  company: string;
  message: string;
}

interface Testimonial {
  name: string;
  role: string;
  content: string;
  rating: number;
}

interface FAQ {
  question: string;
  answer: string;
}

const DEFAULT_TESTIMONIALS: Testimonial[] = [
  {
    name: "Marco Bianchi",
    role: "Imprenditore",
    content: "Grazie a questo servizio ho automatizzato gran parte del mio lavoro quotidiano. L'assistente AI è incredibilmente preciso e mi fa risparmiare ore ogni settimana.",
    rating: 5,
  },
  {
    name: "Laura Rossini",
    role: "Consulente Marketing",
    content: "Il piano Gold è perfetto per le mie esigenze. Il supporto è eccezionale e le funzionalità sono esattamente ciò di cui avevo bisogno per far crescere il mio business.",
    rating: 5,
  },
  {
    name: "Alessandro Verdi",
    role: "Libero Professionista",
    content: "Ho iniziato con il piano Bronze gratuito e sono rimasto così colpito che sono passato al Silver in una settimana. Consigliatissimo!",
    rating: 5,
  },
];

const DEFAULT_FAQS: FAQ[] = [
  {
    question: "Posso provare il servizio gratuitamente?",
    answer: "Sì! Il piano Bronze è completamente gratuito e ti permette di iniziare subito. Puoi sempre passare a un piano superiore quando le tue esigenze crescono.",
  },
  {
    question: "Come funzionano i pagamenti?",
    answer: "I pagamenti sono gestiti in modo sicuro tramite Stripe. Puoi pagare mensilmente o annualmente (con uno sconto del 15%) con carta di credito o debito.",
  },
  {
    question: "Posso cambiare piano in qualsiasi momento?",
    answer: "Assolutamente sì. Puoi fare upgrade o downgrade del tuo piano in qualsiasi momento. La differenza verrà calcolata automaticamente.",
  },
  {
    question: "Cosa include il piano Deluxe?",
    answer: "Il piano Deluxe ti dà accesso sia come Cliente che come Consulente. È perfetto per chi vuole utilizzare la piattaforma per sé e per i propri clienti.",
  },
  {
    question: "Come posso ottenere un preventivo personalizzato?",
    answer: "Per esigenze enterprise o personalizzate, scegli il piano Exclusive e compila il form di contatto. Ti risponderemo entro 24 ore con una proposta su misura.",
  },
  {
    question: "Quali metodi di pagamento accettate?",
    answer: "Accettiamo tutte le principali carte di credito e debito (Visa, Mastercard, American Express) tramite Stripe, garantendo transazioni sicure e protette.",
  },
];

const COMPARISON_ROWS = [
  { feature: "Messaggi AI giornalieri", bronze: "15", silver: "Illimitati", gold: "Illimitati", deluxe: "Illimitati", exclusive: "Illimitati" },
  { feature: "Assistente AI personale", bronze: true, silver: true, gold: true, deluxe: true, exclusive: true },
  { feature: "Disponibilità 24/7", bronze: true, silver: true, gold: true, deluxe: true, exclusive: true },
  { feature: "Knowledge Base", bronze: false, silver: true, gold: true, deluxe: true, exclusive: true },
  { feature: "Storico conversazioni", bronze: false, silver: true, gold: true, deluxe: true, exclusive: true },
  { feature: "Dashboard personale", bronze: false, silver: false, gold: true, deluxe: true, exclusive: true },
  { feature: "Supporto prioritario", bronze: false, silver: false, gold: true, deluxe: true, exclusive: true },
  { feature: "Accesso Consulente", bronze: false, silver: false, gold: false, deluxe: true, exclusive: true },
  { feature: "API & Integrazioni", bronze: false, silver: false, gold: false, deluxe: true, exclusive: true },
  { feature: "Account Manager dedicato", bronze: false, silver: false, gold: false, deluxe: false, exclusive: true },
];

const TRUST_BADGES = [
  { icon: Shield, text: "Pagamenti sicuri con Stripe" },
  { icon: Clock, text: "Attivazione immediata" },
  { icon: Award, text: "30 giorni soddisfatti o rimborsati" },
  { icon: Headphones, text: "Supporto in italiano" },
];

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
  return <span className="font-medium text-slate-900 text-sm">{value}</span>;
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

const cardHover = {
  scale: 1.02,
  transition: { duration: 0.2 }
};

export default function PublicPricingDirect() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isAnnual, setIsAnnual] = useState(false);

  const [bronzeDialogOpen, setBronzeDialogOpen] = useState(false);
  const [exclusiveDialogOpen, setExclusiveDialogOpen] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isSubmittingContact, setIsSubmittingContact] = useState(false);

  const [registrationForm, setRegistrationForm] = useState<RegistrationForm>({
    email: "",
    firstName: "",
    lastName: "",
    password: "",
    confirmPassword: "",
    phone: "",
  });
  const [formErrors, setFormErrors] = useState<Partial<Record<keyof RegistrationForm, string>>>({});

  const [contactForm, setContactForm] = useState<ContactForm>({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: "",
  });
  const [contactFormErrors, setContactFormErrors] = useState<Partial<Record<keyof ContactForm, string>>>({});

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

  const registerMutation = useMutation({
    mutationFn: async (formData: RegistrationForm) => {
      const response = await fetch(`/api/public/consultant/${slug}/register-bronze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          paymentSource: "direct_link",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nella registrazione");
      }
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Registrazione completata!",
        description: "Il tuo account Bronze è stato creato. Ora puoi accedere.",
      });
      setBronzeDialogOpen(false);
      // Store token and user data for manager/select-agent page
      if (data.token && data.user) {
        localStorage.setItem("bronzeAuthToken", data.token);
        localStorage.setItem("bronzeUserTier", "1"); // Bronze = level 1
        localStorage.setItem("bronzeUserName", `${data.user.firstName} ${data.user.lastName}`);
        localStorage.setItem("bronzePublicSlug", slug || "");
        localStorage.setItem("bronzeUserId", data.user.id);
        localStorage.setItem("bronzeConsultantId", data.user.consultantId);
      }
      navigate(`/c/${slug}/select-agent`);
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setIsRegistering(false);
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (formData: ContactForm) => {
      const response = await fetch("/api/leads/contact-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          consultantSlug: slug,
          consultantId: data?.consultantId,
          source: "exclusive_pricing_page",
        }),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Errore nell'invio della richiesta");
      }
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Richiesta inviata!",
        description: "Ti contatteremo presto con un preventivo personalizzato.",
      });
      setExclusiveDialogOpen(false);
      setContactForm({ name: "", email: "", phone: "", company: "", message: "" });
    },
    onError: (error: Error) => {
      toast({
        title: "Errore",
        description: error.message,
        variant: "destructive",
      });
      setIsSubmittingContact(false);
    },
  });

  const hasPaymentLinks = data?.paymentLinks && (
    data.paymentLinks.silver?.monthly?.paymentLinkUrl ||
    data.paymentLinks.silver?.yearly?.paymentLinkUrl ||
    data.paymentLinks.gold?.monthly?.paymentLinkUrl ||
    data.paymentLinks.gold?.yearly?.paymentLinkUrl
  );

  const handlePurchase = (tier: "silver" | "gold" | "deluxe") => {
    const interval = isAnnual ? "yearly" : "monthly";
    const paymentLink = data?.paymentLinks?.[tier]?.[interval];
    
    if (paymentLink?.paymentLinkUrl) {
      window.location.href = paymentLink.paymentLinkUrl;
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2).replace(".", ",");
  };

  const getDiscountInfo = (tier: "silver" | "gold" | "deluxe") => {
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

  const validateRegistrationForm = (): boolean => {
    const errors: Partial<Record<keyof RegistrationForm, string>> = {};
    
    if (!registrationForm.email) {
      errors.email = "Email obbligatoria";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(registrationForm.email)) {
      errors.email = "Email non valida";
    }
    
    if (!registrationForm.firstName) {
      errors.firstName = "Nome obbligatorio";
    }
    
    if (!registrationForm.lastName) {
      errors.lastName = "Cognome obbligatorio";
    }
    
    if (!registrationForm.phone) {
      errors.phone = "Telefono obbligatorio";
    } else if (registrationForm.phone.length < 6) {
      errors.phone = "Numero di telefono non valido";
    }
    
    if (!registrationForm.password) {
      errors.password = "Password obbligatoria";
    } else if (registrationForm.password.length < 6) {
      errors.password = "La password deve avere almeno 6 caratteri";
    }
    
    if (!registrationForm.confirmPassword) {
      errors.confirmPassword = "Conferma password obbligatoria";
    } else if (registrationForm.password !== registrationForm.confirmPassword) {
      errors.confirmPassword = "Le password non corrispondono";
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateContactForm = (): boolean => {
    const errors: Partial<Record<keyof ContactForm, string>> = {};
    
    if (!contactForm.name) {
      errors.name = "Nome obbligatorio";
    }
    
    if (!contactForm.email) {
      errors.email = "Email obbligatoria";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactForm.email)) {
      errors.email = "Email non valida";
    }
    
    if (!contactForm.phone) {
      errors.phone = "Telefono obbligatorio";
    }
    
    if (!contactForm.message) {
      errors.message = "Messaggio obbligatorio";
    }
    
    setContactFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleBronzeSubmit = () => {
    if (!validateRegistrationForm()) return;
    setIsRegistering(true);
    registerMutation.mutate(registrationForm);
  };

  const handleExclusiveSubmit = () => {
    if (!validateContactForm()) return;
    setIsSubmittingContact(true);
    contactMutation.mutate(contactForm);
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

  // Bronze (free) and Exclusive (contact form) are always available
  // Silver, Gold, Deluxe show only when payment links are configured

  const silverInfo = getDiscountInfo("silver");
  const goldInfo = getDiscountInfo("gold");
  const deluxeInfo = getDiscountInfo("deluxe");

  const tierNames = {
    bronze: data?.pricing.level1Name || "Bronze",
    silver: data?.pricing.level2Name || "Silver",
    gold: data?.pricing.level3Name || "Gold",
    deluxe: data?.pricing.level4Name || "Deluxe",
    exclusive: data?.pricing.level5Name || "Exclusive",
  };

  const bronzeFeatures = data?.pricing.level1Features || [
    "15 messaggi AI al giorno",
    "Assistente AI base",
    "Accesso web 24/7",
    "Nessuna carta richiesta",
  ];

  const silverFeatures = data?.pricing.level2Features || [
    "Messaggi illimitati",
    "Knowledge Base personale",
    "Storico conversazioni",
    "Supporto email",
  ];

  const goldFeatures = data?.pricing.level3Features || [
    "Tutto di Silver",
    "Dashboard personale",
    "Supporto prioritario",
    "Funzionalità avanzate",
  ];

  const deluxeFeatures = data?.pricing.level4Features || [
    "Tutto di Gold",
    "Accesso Consulente",
    "Gestione clienti",
    "API & Integrazioni",
    "Report avanzati",
  ];

  const exclusiveFeatures = data?.pricing.level5Features || [
    "Tutto di Deluxe",
    "Account Manager dedicato",
    "SLA garantito",
    "Personalizzazioni illimitate",
    "Formazione on-site",
    "Supporto telefonico 24/7",
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50">
      <div className="absolute top-0 left-0 right-0 h-[800px] bg-gradient-to-br from-violet-50/60 via-transparent to-emerald-50/40 pointer-events-none" />
      
      <div className="relative max-w-7xl mx-auto px-4 py-12 sm:py-20">
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
                {data?.pricing.heroBadgeText || "Scegli il Piano Perfetto"}
              </motion.div>
              
              <motion.h1 
                className="text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900 mb-6 tracking-tight"
                variants={fadeInUp}
              >
                {data?.pricing.heroTitle || "Piani e Prezzi"}
              </motion.h1>
              
              <motion.p 
                className="text-lg text-slate-600 max-w-2xl mx-auto mb-4"
                variants={fadeInUp}
              >
                {data?.pricing.heroSubtitle || "Scegli il piano più adatto alle tue esigenze e inizia subito"}
              </motion.p>
              
              {data?.consultantName && (
                <motion.p 
                  className="text-sm text-muted-foreground"
                  variants={fadeInUp}
                >
                  con <span className="font-semibold text-slate-700">{data.consultantName}</span>
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
              -15%
            </Badge>
          </span>
        </motion.div>

        <motion.div 
          className="flex items-center justify-center flex-wrap gap-4 mb-12"
          variants={fadeInUp}
          initial="initial"
          animate="animate"
        >
          {TRUST_BADGES.map((badge, index) => (
            <div 
              key={index}
              className="flex items-center gap-2 px-4 py-2 rounded-full bg-white border border-slate-200 shadow-sm"
            >
              <badge.icon className="h-4 w-4 text-emerald-600" />
              <span className="text-sm text-slate-600">{badge.text}</span>
            </div>
          ))}
        </motion.div>

        <motion.div 
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 max-w-7xl mx-auto mb-20"
          initial="initial"
          animate="animate"
          variants={staggerContainer}
        >
          {isLoading ? (
            <>
              {[1, 2, 3, 4, 5].map((i) => (
                <PricingCardSkeleton key={i} />
              ))}
            </>
          ) : (
            <>
              <motion.div variants={pricingCardVariants} whileHover={cardHover}>
                <Card className={cn(
                  "relative flex flex-col h-full border-2 transition-all duration-300",
                  "hover:shadow-xl border-amber-200 bg-gradient-to-b from-amber-50/30 to-white"
                )}>
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-amber-400 to-amber-600" />
                  
                  <CardHeader className="text-center pb-4 pt-6">
                    <Badge className="w-fit mx-auto mb-3 bg-amber-100 text-amber-700 border-amber-200">
                      Gratuito
                    </Badge>
                    
                    <h3 className="text-xl font-bold text-slate-900">{tierNames.bronze}</h3>
                    
                    <div className="mt-3">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-4xl font-bold text-slate-900">€0</span>
                        <span className="text-slate-500">/mese</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 mt-3">
                      {data?.pricing.level1Description || "Inizia gratuitamente"}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1 mb-6">
                      {bronzeFeatures.map((feature, idx) => (
                        <FeatureItem key={idx} accentColor="rgb(217 119 6)">
                          {feature}
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button
                      className="w-full gap-2 bg-amber-500 hover:bg-amber-600 text-white"
                      size="lg"
                      onClick={() => setBronzeDialogOpen(true)}
                    >
                      Inizia Gratis
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              {silverInfo && (
                <motion.div variants={pricingCardVariants} whileHover={cardHover}>
                  <Card className={cn(
                    "relative flex flex-col h-full border-2 transition-all duration-300",
                    "hover:shadow-xl border-slate-200 bg-white"
                  )}>
                    <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-slate-400 to-slate-500" />
                    
                    <CardHeader className="text-center pb-4 pt-6">
                      <Badge className="w-fit mx-auto mb-3 bg-slate-100 text-slate-700 border-slate-200">
                        {data?.pricing.level2Badge || "Starter"}
                      </Badge>
                      
                      <h3 className="text-xl font-bold text-slate-900">{tierNames.silver}</h3>
                      
                      <div className="mt-3">
                        {silverInfo.hasDiscount && silverInfo.originalPrice && (
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-sm text-slate-400 line-through">
                              €{formatPrice(silverInfo.originalPrice)}
                            </span>
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              -{silverInfo.discountPercent}%
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">
                            €{formatPrice(silverInfo.price)}
                          </span>
                          <span className="text-slate-500">/{isAnnual ? "anno" : "mese"}</span>
                        </div>
                        {silverInfo.discountExpiresAt && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-xs text-amber-600">
                            <Clock className="h-3 w-3" />
                            Offerta valida fino al {new Date(silverInfo.discountExpiresAt).toLocaleDateString("it-IT")}
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-600 mt-3">
                        {data?.pricing.level2Description || "Per uso personale"}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-2 flex-1 mb-6">
                        {silverFeatures.map((feature, idx) => (
                          <FeatureItem key={idx} accentColor="rgb(100 116 139)">
                            {feature}
                          </FeatureItem>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full gap-2 bg-slate-600 hover:bg-slate-700 text-white"
                        size="lg"
                        onClick={() => handlePurchase("silver")}
                        disabled={!data?.paymentLinks?.silver?.[isAnnual ? "yearly" : "monthly"]?.paymentLinkUrl}
                      >
                        {data?.pricing.level2CtaText || "Acquista"}
                        <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {goldInfo && (
                <motion.div variants={pricingCardVariants} whileHover={cardHover}>
                  <Card className={cn(
                    "relative flex flex-col h-full border-2 transition-all duration-300",
                    "hover:shadow-xl border-amber-300 bg-gradient-to-b from-amber-50/50 to-white ring-2 ring-amber-200"
                  )}>
                    <div className="absolute top-0 left-0 right-0 h-1.5 rounded-t-lg bg-gradient-to-r from-amber-400 via-yellow-500 to-orange-500" />
                    
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                      <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 shadow-lg px-3 py-1">
                        <Crown className="h-3 w-3 mr-1" />
                        Più Popolare
                      </Badge>
                    </div>
                    
                    <CardHeader className="text-center pb-4 pt-8">
                      <Badge className="w-fit mx-auto mb-3 bg-amber-100 text-amber-700 border-amber-200">
                        {data?.pricing.level3Badge || "Pro"}
                      </Badge>
                      
                      <h3 className="text-xl font-bold text-slate-900">{tierNames.gold}</h3>
                      
                      <div className="mt-3">
                        {goldInfo.hasDiscount && goldInfo.originalPrice && (
                          <div className="flex items-center justify-center gap-2 mb-1">
                            <span className="text-sm text-slate-400 line-through">
                              €{formatPrice(goldInfo.originalPrice)}
                            </span>
                            <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              -{goldInfo.discountPercent}%
                            </Badge>
                          </div>
                        )}
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">
                            €{formatPrice(goldInfo.price)}
                          </span>
                          <span className="text-slate-500">/{isAnnual ? "anno" : "mese"}</span>
                        </div>
                        {goldInfo.discountExpiresAt && (
                          <div className="flex items-center justify-center gap-1 mt-2 text-xs text-amber-600">
                            <Clock className="h-3 w-3" />
                            Offerta valida fino al {new Date(goldInfo.discountExpiresAt).toLocaleDateString("it-IT")}
                          </div>
                        )}
                      </div>
                      
                      <p className="text-sm text-slate-600 mt-3">
                        {data?.pricing.level3Description || "Per professionisti"}
                      </p>
                    </CardHeader>
                    
                    <CardContent className="flex-1 flex flex-col">
                      <ul className="space-y-2 flex-1 mb-6">
                        {goldFeatures.map((feature, idx) => (
                          <FeatureItem key={idx} accentColor="rgb(245 158 11)">
                            {feature}
                          </FeatureItem>
                        ))}
                      </ul>
                      
                      <Button
                        className="w-full gap-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-lg"
                        size="lg"
                        onClick={() => handlePurchase("gold")}
                        disabled={!data?.paymentLinks?.gold?.[isAnnual ? "yearly" : "monthly"]?.paymentLinkUrl}
                      >
                        <Crown className="h-4 w-4" />
                        {data?.pricing.level3CtaText || "Acquista Gold"}
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              <motion.div variants={pricingCardVariants} whileHover={cardHover}>
                <Card className={cn(
                  "relative flex flex-col h-full border-2 transition-all duration-300",
                  "hover:shadow-xl border-purple-200 bg-gradient-to-b from-purple-50/50 to-white"
                )}>
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-purple-500 to-violet-600" />
                  
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-purple-600 text-white border-0 shadow-lg px-3 py-1">
                      <Briefcase className="h-3 w-3 mr-1" />
                      Business
                    </Badge>
                  </div>
                  
                  <CardHeader className="text-center pb-4 pt-8">
                    <Badge className="w-fit mx-auto mb-3 bg-purple-100 text-purple-700 border-purple-200">
                      {data?.pricing.level4Badge || "Cliente + Consulente"}
                    </Badge>
                    
                    <h3 className="text-xl font-bold text-slate-900">{tierNames.deluxe}</h3>
                    
                    <div className="mt-3">
                      {deluxeInfo ? (
                        <>
                          {deluxeInfo.hasDiscount && deluxeInfo.originalPrice && (
                            <div className="flex items-center justify-center gap-2 mb-1">
                              <span className="text-sm text-slate-400 line-through">
                                €{formatPrice(deluxeInfo.originalPrice)}
                              </span>
                              <Badge className="bg-red-100 text-red-700 border-0 text-xs">
                                <Tag className="h-3 w-3 mr-1" />
                                -{deluxeInfo.discountPercent}%
                              </Badge>
                            </div>
                          )}
                          <div className="flex items-baseline justify-center gap-1">
                            <span className="text-4xl font-bold text-slate-900">
                              €{formatPrice(deluxeInfo.price)}
                            </span>
                            <span className="text-slate-500">/{isAnnual ? "anno" : "mese"}</span>
                          </div>
                          {deluxeInfo.discountExpiresAt && (
                            <div className="flex items-center justify-center gap-1 mt-2 text-xs text-amber-600">
                              <Clock className="h-3 w-3" />
                              Offerta valida fino al {new Date(deluxeInfo.discountExpiresAt).toLocaleDateString("it-IT")}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-baseline justify-center gap-1">
                          <span className="text-4xl font-bold text-slate-900">€99</span>
                          <span className="text-slate-500">/mese</span>
                        </div>
                      )}
                    </div>
                    
                    <p className="text-sm text-slate-600 mt-3">
                      {data?.pricing.level4Description || "Accesso completo come cliente e consulente"}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1 mb-6">
                      {deluxeFeatures.map((feature, idx) => (
                        <FeatureItem key={idx} accentColor="rgb(147 51 234)">
                          {feature}
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button
                      className="w-full gap-2 bg-gradient-to-r from-purple-500 to-violet-600 hover:from-purple-600 hover:to-violet-700 text-white"
                      size="lg"
                      onClick={() => handlePurchase("deluxe")}
                      disabled={!deluxeInfo?.price}
                    >
                      {data?.pricing.level4CtaText || "Acquista Deluxe"}
                      <Briefcase className="h-4 w-4" />
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={pricingCardVariants} whileHover={cardHover}>
                <Card className={cn(
                  "relative flex flex-col h-full border-2 transition-all duration-300",
                  "hover:shadow-xl border-slate-300 bg-gradient-to-b from-slate-900 to-slate-800 text-white"
                )}>
                  <div className="absolute top-0 left-0 right-0 h-1 rounded-t-lg bg-gradient-to-r from-slate-400 via-white to-slate-400" />
                  
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-10">
                    <Badge className="bg-gradient-to-r from-slate-200 to-white text-slate-900 border-0 shadow-lg px-3 py-1">
                      <Diamond className="h-3 w-3 mr-1" />
                      Enterprise
                    </Badge>
                  </div>
                  
                  <CardHeader className="text-center pb-4 pt-8">
                    <Badge className="w-fit mx-auto mb-3 bg-white/10 text-white border-white/20">
                      Su Misura
                    </Badge>
                    
                    <h3 className="text-xl font-bold text-white">{tierNames.exclusive}</h3>
                    
                    <div className="mt-3">
                      <div className="flex items-baseline justify-center gap-1">
                        <span className="text-3xl font-bold text-white">Personalizzato</span>
                      </div>
                      <p className="text-sm text-slate-300 mt-1">Preventivo su richiesta</p>
                    </div>
                    
                    <p className="text-sm text-slate-300 mt-3">
                      {data?.pricing.level5Description || "Soluzioni enterprise personalizzate"}
                    </p>
                  </CardHeader>
                  
                  <CardContent className="flex-1 flex flex-col">
                    <ul className="space-y-2 flex-1 mb-6">
                      {exclusiveFeatures.map((feature, idx) => (
                        <FeatureItem key={idx} accentColor="rgb(226 232 240)">
                          <span className="text-slate-200">{feature}</span>
                        </FeatureItem>
                      ))}
                    </ul>
                    
                    <Button
                      className="w-full gap-2 bg-white text-slate-900 hover:bg-slate-100"
                      size="lg"
                      onClick={() => setExclusiveDialogOpen(true)}
                    >
                      <Star className="h-4 w-4" />
                      Richiedi Preventivo
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </>
          )}
        </motion.div>

        {!isLoading && (
          <motion.div 
            className="max-w-6xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                Confronta i Piani
              </h2>
              <p className="text-slate-600">
                Scopri tutte le funzionalità incluse in ogni piano
              </p>
            </div>
            
            <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200">
                      <th className="text-left py-4 px-4 font-semibold text-slate-900">
                        Funzionalità
                      </th>
                      <th className="text-center py-4 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{tierNames.bronze}</Badge>
                          <span className="text-xs text-slate-500">Gratuito</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-slate-100 text-slate-700 border-slate-200 text-xs">{tierNames.silver}</Badge>
                          <span className="text-xs text-slate-500">€{silverInfo ? formatPrice(silverInfo.price) : "29"}/m</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-3 bg-amber-50/50">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">{tierNames.gold}</Badge>
                          <span className="text-xs text-slate-500">€{goldInfo ? formatPrice(goldInfo.price) : "59"}/m</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-xs">{tierNames.deluxe}</Badge>
                          <span className="text-xs text-slate-500">€{deluxeInfo ? formatPrice(deluxeInfo.price) : "99"}/m</span>
                        </div>
                      </th>
                      <th className="text-center py-4 px-3">
                        <div className="flex flex-col items-center gap-1">
                          <Badge className="bg-slate-800 text-white border-slate-700 text-xs">{tierNames.exclusive}</Badge>
                          <span className="text-xs text-slate-500">Custom</span>
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
                        <td className="py-3 px-4">
                          <span className="text-sm text-slate-700">{row.feature}</span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <ComparisonTableCell value={row.bronze} />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <ComparisonTableCell value={row.silver} />
                        </td>
                        <td className="py-3 px-3 text-center bg-amber-50/30">
                          <ComparisonTableCell value={row.gold} />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <ComparisonTableCell value={row.deluxe} />
                        </td>
                        <td className="py-3 px-3 text-center">
                          <ComparisonTableCell value={row.exclusive} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {!isLoading && (
          <motion.div 
            className="max-w-6xl mx-auto mb-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                Cosa Dicono i Nostri Clienti
              </h2>
              <p className="text-slate-600">
                Scopri le esperienze di chi ha già scelto i nostri piani
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {DEFAULT_TESTIMONIALS.map((testimonial, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.1 }}
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
                          <AvatarFallback 
                            style={accentColor ? { backgroundColor: `${accentColor}20`, color: accentColor } : { backgroundColor: "rgb(237 233 254)", color: "rgb(109 40 217)" }}
                          >
                            {testimonial.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <p className="font-semibold text-slate-900">{testimonial.name}</p>
                          <p className="text-sm text-slate-500">{testimonial.role}</p>
                        </div>
                        <StarRating rating={testimonial.rating} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {!isLoading && (
          <motion.div 
            className="max-w-3xl mx-auto mb-20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <div className="text-center mb-10">
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-3">
                Domande Frequenti
              </h2>
              <p className="text-slate-600">
                Trova le risposte alle domande più comuni
              </p>
            </div>
            
            <Card className="shadow-lg">
              <CardContent className="pt-6">
                <Accordion type="single" collapsible className="w-full">
                  {DEFAULT_FAQS.map((faq, index) => (
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

        {!isLoading && (
          <motion.div 
            className="max-w-4xl mx-auto mb-12"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div 
              className="rounded-2xl p-8 md:p-12 text-center shadow-xl"
              style={accentColor ? {
                background: `linear-gradient(135deg, ${accentColor}, ${accentColor}dd)`,
              } : {
                background: "linear-gradient(135deg, rgb(124 58 237), rgb(79 70 229))",
              }}
            >
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">
                Pronto a iniziare?
              </h2>
              <p className="text-white/80 mb-8 text-lg max-w-xl mx-auto">
                Registrati gratis e scopri il potere dell'AI per il tuo business
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button 
                  size="lg"
                  className="bg-white hover:bg-slate-100 text-slate-900 px-8 py-6 text-lg shadow-lg"
                  onClick={() => setBronzeDialogOpen(true)}
                >
                  Inizia Gratis Ora
                  <ArrowRight className="h-5 w-5 ml-2" />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className="border-white/30 text-white hover:bg-white/10 px-8 py-6 text-lg"
                  onClick={() => setExclusiveDialogOpen(true)}
                >
                  Contattaci
                  <MessageSquare className="h-5 w-5 ml-2" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        <motion.div 
          className="text-center"
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

      <footer className="border-t bg-white/80 backdrop-blur-sm py-8 mt-8">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex flex-col items-center gap-4">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <a href="/privacy" className="hover:text-slate-900 transition-colors">
                Privacy Policy
              </a>
              <a href="#" className="hover:text-slate-900 transition-colors">
                Termini di Servizio
              </a>
            </div>
            <p className="text-sm text-slate-500">
              © {new Date().getFullYear()} {data?.consultantName || "Orbitale"}. Tutti i diritti riservati.
            </p>
          </div>
        </div>
      </footer>

      <Dialog open={bronzeDialogOpen} onOpenChange={setBronzeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500" />
              Registrati Gratis - Piano Bronze
            </DialogTitle>
            <DialogDescription>
              Crea il tuo account gratuito per iniziare subito con l'assistente AI.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nome *</Label>
                <Input
                  id="firstName"
                  placeholder="Mario"
                  value={registrationForm.firstName}
                  onChange={(e) => setRegistrationForm(prev => ({ ...prev, firstName: e.target.value }))}
                  className={formErrors.firstName ? "border-red-500" : ""}
                />
                {formErrors.firstName && (
                  <p className="text-xs text-red-500">{formErrors.firstName}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Cognome *</Label>
                <Input
                  id="lastName"
                  placeholder="Rossi"
                  value={registrationForm.lastName}
                  onChange={(e) => setRegistrationForm(prev => ({ ...prev, lastName: e.target.value }))}
                  className={formErrors.lastName ? "border-red-500" : ""}
                />
                {formErrors.lastName && (
                  <p className="text-xs text-red-500">{formErrors.lastName}</p>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                type="email"
                placeholder="mario.rossi@email.com"
                value={registrationForm.email}
                onChange={(e) => setRegistrationForm(prev => ({ ...prev, email: e.target.value }))}
                className={formErrors.email ? "border-red-500" : ""}
              />
              {formErrors.email && (
                <p className="text-xs text-red-500">{formErrors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone">Telefono *</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="+39 333 1234567"
                value={registrationForm.phone}
                onChange={(e) => setRegistrationForm(prev => ({ ...prev, phone: e.target.value }))}
                className={formErrors.phone ? "border-red-500" : ""}
              />
              {formErrors.phone && (
                <p className="text-xs text-red-500">{formErrors.phone}</p>
              )}
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="password">Password *</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Min. 6 caratteri"
                  value={registrationForm.password}
                  onChange={(e) => setRegistrationForm(prev => ({ ...prev, password: e.target.value }))}
                  className={formErrors.password ? "border-red-500" : ""}
                />
                {formErrors.password && (
                  <p className="text-xs text-red-500">{formErrors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Conferma Password *</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Ripeti password"
                  value={registrationForm.confirmPassword}
                  onChange={(e) => setRegistrationForm(prev => ({ ...prev, confirmPassword: e.target.value }))}
                  className={formErrors.confirmPassword ? "border-red-500" : ""}
                />
                {formErrors.confirmPassword && (
                  <p className="text-xs text-red-500">{formErrors.confirmPassword}</p>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setBronzeDialogOpen(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={handleBronzeSubmit}
              disabled={isRegistering}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white"
            >
              {isRegistering ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Registrazione...
                </>
              ) : (
                <>
                  Inizia Gratis
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={exclusiveDialogOpen} onOpenChange={setExclusiveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Diamond className="h-5 w-5 text-slate-700" />
              Richiedi Preventivo - Piano Exclusive
            </DialogTitle>
            <DialogDescription>
              Compila il form e ti contatteremo con una proposta personalizzata.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="contact-name">Nome e Cognome *</Label>
              <Input
                id="contact-name"
                placeholder="Mario Rossi"
                value={contactForm.name}
                onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                className={contactFormErrors.name ? "border-red-500" : ""}
              />
              {contactFormErrors.name && (
                <p className="text-xs text-red-500">{contactFormErrors.name}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-email">Email *</Label>
              <Input
                id="contact-email"
                type="email"
                placeholder="mario.rossi@azienda.com"
                value={contactForm.email}
                onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                className={contactFormErrors.email ? "border-red-500" : ""}
              />
              {contactFormErrors.email && (
                <p className="text-xs text-red-500">{contactFormErrors.email}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-phone">Telefono *</Label>
              <Input
                id="contact-phone"
                type="tel"
                placeholder="+39 333 1234567"
                value={contactForm.phone}
                onChange={(e) => setContactForm(prev => ({ ...prev, phone: e.target.value }))}
                className={contactFormErrors.phone ? "border-red-500" : ""}
              />
              {contactFormErrors.phone && (
                <p className="text-xs text-red-500">{contactFormErrors.phone}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-company">Azienda (opzionale)</Label>
              <Input
                id="contact-company"
                placeholder="Nome Azienda S.r.l."
                value={contactForm.company}
                onChange={(e) => setContactForm(prev => ({ ...prev, company: e.target.value }))}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="contact-message">Messaggio *</Label>
              <Textarea
                id="contact-message"
                placeholder="Descrivi le tue esigenze e cosa stai cercando..."
                rows={4}
                value={contactForm.message}
                onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                className={contactFormErrors.message ? "border-red-500" : ""}
              />
              {contactFormErrors.message && (
                <p className="text-xs text-red-500">{contactFormErrors.message}</p>
              )}
            </div>
          </div>
          
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setExclusiveDialogOpen(false)}
              className="flex-1"
            >
              Annulla
            </Button>
            <Button
              onClick={handleExclusiveSubmit}
              disabled={isSubmittingContact}
              className="flex-1 bg-slate-800 hover:bg-slate-900 text-white"
            >
              {isSubmittingContact ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Invio...
                </>
              ) : (
                <>
                  Invia Richiesta
                  <Mail className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
