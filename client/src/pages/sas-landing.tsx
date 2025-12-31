import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { 
  Brain, 
  Zap, 
  GraduationCap, 
  ArrowRight, 
  CheckCircle, 
  Sparkles,
  MessageSquare,
  Clock,
  TrendingUp,
  Users,
  BarChart3,
  Target,
  Shield,
  Star,
  Play,
  ChevronRight,
  Phone,
  Mail,
  User
} from "lucide-react";

const leadFormSchema = z.object({
  firstName: z.string().min(2, "Il nome deve avere almeno 2 caratteri"),
  lastName: z.string().min(2, "Il cognome deve avere almeno 2 caratteri"),
  email: z.string().email("Inserisci un'email valida"),
  phone: z.string().min(10, "Inserisci un numero di telefono valido"),
});

type LeadFormData = z.infer<typeof leadFormSchema>;

export default function SasLanding() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [isSubmitted, setIsSubmitted] = useState(false);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
    },
  });

  const submitMutation = useMutation({
    mutationFn: async (data: LeadFormData) => {
      const response = await fetch("/api/leads/landing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...data,
          source: "sas-landing",
          capturedAt: new Date().toISOString(),
        }),
      });
      if (!response.ok) {
        throw new Error("Errore nell'invio dei dati");
      }
      return response.json();
    },
    onSuccess: () => {
      setIsSubmitted(true);
      toast({
        title: "Perfetto!",
        description: "Ti contatteremo presto per mostrarti la piattaforma.",
      });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: "Si è verificato un errore. Riprova più tardi.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: LeadFormData) => {
    submitMutation.mutate(data);
  };

  const features = [
    {
      icon: Brain,
      title: "AI Integrata",
      description: "L'intelligenza artificiale conosce i tuoi clienti, ricorda ogni conversazione e genera contenuti personalizzati. Non un chatbot, ma un vero assistente.",
      gradient: "from-purple-500 to-pink-600",
      highlight: "Risparmia 3+ ore al giorno"
    },
    {
      icon: Zap,
      title: "Automazione Intelligente",
      description: "WhatsApp, email, follow-up, promemoria: tutto automatizzato 24/7 senza perdere il tocco umano. Agenti AI che parlano con la tua voce.",
      gradient: "from-orange-500 to-red-600",
      highlight: "Lead qualificati automaticamente"
    },
    {
      icon: GraduationCap,
      title: "Formazione Strutturata",
      description: "Crea la tua università digitale: corsi, esercizi, percorsi formativi completi. I tuoi clienti imparano, tu risparmi tempo sulle basi.",
      gradient: "from-blue-500 to-cyan-600",
      highlight: "Scala il tuo business"
    },
  ];

  const stats = [
    { number: "3h+", label: "Risparmiate al giorno", icon: Clock },
    { number: "24/7", label: "Assistenza AI attiva", icon: MessageSquare },
    { number: "98%", label: "Clienti soddisfatti", icon: Star },
    { number: "10x", label: "Più lead convertiti", icon: TrendingUp }
  ];

  const benefits = [
    "L'AI conosce ogni dettaglio dei tuoi clienti",
    "Agenti WhatsApp che rispondono mentre dormi",
    "Corsi e formazione senza ripetere le stesse cose",
    "Dashboard completa per monitorare tutto",
    "Email automatiche personalizzate",
    "Lead scoring per prioritizzare i contatti"
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl blur-sm opacity-60"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Sparkles className="text-white" size={22} />
                </div>
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent">
                Consulente AI
              </span>
            </div>
            <Button 
              onClick={() => setLocation("/login")}
              className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white font-semibold shadow-lg shadow-violet-500/25"
            >
              Accedi
              <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-28 pb-20 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="max-w-7xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-900/30 border border-violet-700/50 mb-8">
              <Sparkles size={16} className="text-violet-400 animate-pulse" />
              <span className="text-sm font-medium text-violet-300">La piattaforma AI per consulenti che vogliono scalare</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
              Trasforma la tua
              <span className="block bg-gradient-to-r from-violet-400 via-fuchsia-400 to-indigo-400 bg-clip-text text-transparent mt-2">
                Consulenza in un Business
              </span>
              <span className="block text-white mt-2">Automatizzato</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-slate-300 mb-12 leading-relaxed max-w-3xl mx-auto">
              AI che conosce i tuoi clienti, automazioni WhatsApp che lavorano 24/7, 
              formazione che scala. <span className="text-white font-semibold">Tutto in un'unica piattaforma.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Button 
                size="lg"
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white px-10 py-7 text-lg shadow-2xl shadow-violet-500/30 group font-semibold"
              >
                <Play className="mr-2" size={20} />
                Richiedi una Demo
                <ChevronRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation("/login")}
                className="px-10 py-7 text-lg border-2 border-slate-700 text-white hover:bg-slate-800/50 backdrop-blur-sm"
              >
                Sono già cliente
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className="p-6 rounded-2xl bg-slate-800/40 border border-slate-700/50 backdrop-blur-sm hover:border-violet-500/50 transition-all duration-300 group"
                >
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-violet-900/50 to-indigo-900/50 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                      <stat.icon className="text-violet-400" size={22} />
                    </div>
                    <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                    <div className="text-sm text-slate-400">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-slate-900/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Tre Superpoteri per la Tua Consulenza
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Non software, ma un partner AI che lavora per te
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group relative overflow-hidden bg-slate-800/50 border-slate-700 hover:border-violet-500/50 transition-all duration-500 hover:shadow-2xl hover:shadow-violet-500/10"
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-500`}></div>
                
                <CardHeader className="pb-4">
                  <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="text-white" size={32} />
                  </div>
                  <CardTitle className="text-2xl text-white">{feature.title}</CardTitle>
                </CardHeader>
                
                <CardContent>
                  <p className="text-slate-300 mb-6 leading-relaxed text-lg">
                    {feature.description}
                  </p>
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${feature.gradient} bg-opacity-10`}>
                    <CheckCircle size={16} className="text-white" />
                    <span className="text-sm font-semibold text-white">{feature.highlight}</span>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mb-8">
                Perché i Consulenti Top
                <span className="block bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mt-2">
                  Scelgono Noi
                </span>
              </h2>
              <p className="text-xl text-slate-300 mb-10">
                Non è solo un software. È il sistema che ti permette di gestire 
                più clienti con meno stress e più risultati.
              </p>
              
              <div className="grid gap-4">
                {benefits.map((benefit, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-violet-500/30 transition-all"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-600 flex items-center justify-center flex-shrink-0">
                      <CheckCircle size={16} className="text-white" />
                    </div>
                    <span className="text-lg text-white">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-600/20 to-fuchsia-600/20 rounded-3xl blur-2xl"></div>
              <Card className="relative bg-slate-800/60 border-slate-700 p-8 backdrop-blur-xl">
                <div className="text-center mb-8">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-900/30 border border-green-700/50 mb-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <span className="text-sm font-medium text-green-400">Risultati reali</span>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-2">Marco, Business Coach</h3>
                  <p className="text-slate-400">Da 15 a 45 clienti in 3 mesi</p>
                </div>
                
                <blockquote className="text-lg text-slate-300 italic mb-6 leading-relaxed">
                  "Prima passavo 3 ore al giorno a rispondere messaggi e ripetere le stesse cose. 
                  Ora l'AI fa tutto questo e io mi concentro sulle consulenze ad alto valore."
                </blockquote>
                
                <div className="flex items-center justify-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={24} className="text-yellow-500 fill-yellow-500" />
                  ))}
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      <section id="contact-form" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-900 to-slate-950">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-6">
              Pronto a Trasformare
              <span className="block bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent mt-2">
                la Tua Consulenza?
              </span>
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Lascia i tuoi dati e ti mostreremo come la piattaforma può 
              rivoluzionare il tuo business
            </p>
          </div>

          <Card className="bg-slate-800/60 border-slate-700 backdrop-blur-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-600/5 to-fuchsia-600/5"></div>
            
            <CardContent className="p-8 sm:p-12 relative">
              {isSubmitted ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center mx-auto mb-6">
                    <CheckCircle size={40} className="text-white" />
                  </div>
                  <h3 className="text-3xl font-bold text-white mb-4">Perfetto!</h3>
                  <p className="text-xl text-slate-300 mb-8">
                    Ti contatteremo entro 24 ore per organizzare una demo personalizzata.
                  </p>
                  <Button 
                    onClick={() => setLocation("/login")}
                    className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                  >
                    Vai al Login
                    <ArrowRight className="ml-2" size={16} />
                  </Button>
                </div>
              ) : (
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <div className="grid sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="firstName" className="text-white font-medium flex items-center gap-2">
                        <User size={16} className="text-violet-400" />
                        Nome
                      </Label>
                      <Input
                        id="firstName"
                        {...form.register("firstName")}
                        placeholder="Il tuo nome"
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12 text-lg focus:border-violet-500"
                      />
                      {form.formState.errors.firstName && (
                        <p className="text-red-400 text-sm">{form.formState.errors.firstName.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="lastName" className="text-white font-medium flex items-center gap-2">
                        <User size={16} className="text-violet-400" />
                        Cognome
                      </Label>
                      <Input
                        id="lastName"
                        {...form.register("lastName")}
                        placeholder="Il tuo cognome"
                        className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12 text-lg focus:border-violet-500"
                      />
                      {form.formState.errors.lastName && (
                        <p className="text-red-400 text-sm">{form.formState.errors.lastName.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-white font-medium flex items-center gap-2">
                      <Mail size={16} className="text-violet-400" />
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      {...form.register("email")}
                      placeholder="la.tua@email.com"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12 text-lg focus:border-violet-500"
                    />
                    {form.formState.errors.email && (
                      <p className="text-red-400 text-sm">{form.formState.errors.email.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-white font-medium flex items-center gap-2">
                      <Phone size={16} className="text-violet-400" />
                      Telefono
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      {...form.register("phone")}
                      placeholder="+39 333 123 4567"
                      className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-500 h-12 text-lg focus:border-violet-500"
                    />
                    {form.formState.errors.phone && (
                      <p className="text-red-400 text-sm">{form.formState.errors.phone.message}</p>
                    )}
                  </div>

                  <Button 
                    type="submit"
                    size="lg"
                    disabled={submitMutation.isPending}
                    className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white py-7 text-lg font-semibold shadow-xl shadow-violet-500/25"
                  >
                    {submitMutation.isPending ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2"></div>
                        Invio in corso...
                      </>
                    ) : (
                      <>
                        Richiedi la Demo Gratuita
                        <ArrowRight className="ml-2" size={20} />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-sm text-slate-400">
                    Niente spam. Ti contatteremo solo per la demo.
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-slate-950">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Sei già un utente?</h3>
          <p className="text-slate-400 mb-8">Accedi alla piattaforma per continuare a lavorare con i tuoi clienti</p>
          <Button 
            size="lg"
            onClick={() => setLocation("/login")}
            variant="outline"
            className="border-2 border-violet-600 text-violet-400 hover:bg-violet-600 hover:text-white px-10 py-6 text-lg"
          >
            Vai al Login
            <ArrowRight className="ml-2" size={18} />
          </Button>
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <Sparkles className="text-white" size={22} />
              </div>
              <span className="text-lg font-bold text-white">Consulente AI</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm">© 2025 Consulente AI. Tutti i diritti riservati.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
