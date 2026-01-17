import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
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
  Star,
  Play,
  Phone,
  Mail,
  User,
  Bot,
  Calendar,
  BarChart3,
  Users,
  Target,
  Rocket
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
      title: "AI che Conosce i Tuoi Clienti",
      description: "Non un chatbot generico. Un'intelligenza artificiale che ricorda ogni conversazione, ogni preferenza, ogni obiettivo. Genera contenuti personalizzati e insights finanziari in tempo reale.",
      color: "bg-violet-100",
      iconColor: "text-violet-600",
      borderColor: "hover:border-violet-300",
      items: ["Memoria contestuale completa", "Insights finanziari personalizzati", "Generazione contenuti automatica"]
    },
    {
      icon: Bot,
      title: "Dipendenti AI 24/7",
      description: "I tuoi dipendenti virtuali lavorano mentre dormi. Qualificano lead, prenotano appuntamenti, gestiscono obiezioni. Tu ricevi solo i contatti pronti a comprare.",
      color: "bg-emerald-100",
      iconColor: "text-emerald-600",
      borderColor: "hover:border-emerald-300",
      items: ["Risposte istantanee 24/7", "Qualificazione automatica lead", "Prenotazione appuntamenti"]
    },
    {
      icon: GraduationCap,
      title: "La Tua Universita Digitale",
      description: "Crea corsi da video YouTube in 10 minuti. L'AI estrae trascrizioni, genera moduli, crea quiz. I tuoi clienti imparano autonomamente, tu smetti di ripetere le stesse cose.",
      color: "bg-amber-100",
      iconColor: "text-amber-600",
      borderColor: "hover:border-amber-300",
      items: ["Generazione corsi da YouTube", "Quiz automatici", "Tracciamento progressi"]
    },
  ];

  const stats = [
    { number: "3h+", label: "Risparmiate ogni giorno", icon: Clock, color: "text-violet-600", bg: "bg-violet-50" },
    { number: "24/7", label: "Assistenza AI sempre attiva", icon: MessageSquare, color: "text-emerald-600", bg: "bg-emerald-50" },
    { number: "98%", label: "Consulenti soddisfatti", icon: Star, color: "text-amber-600", bg: "bg-amber-50" },
    { number: "10x", label: "Piu lead convertiti", icon: TrendingUp, color: "text-rose-600", bg: "bg-rose-50" }
  ];

  const caseStudies = [
    {
      name: "Marco",
      role: "Business Coach",
      result: "Da 15 a 45 clienti",
      time: "in 3 mesi",
      quote: "Prima passavo 3 ore al giorno a rispondere messaggi. Ora l'AI fa tutto e io mi concentro sulle consulenze ad alto valore.",
      avatar: "M",
      color: "bg-violet-500"
    },
    {
      name: "Giulia",
      role: "Consulente Finanziaria",
      result: "ROI del 2.5%",
      time: "su ogni campagna",
      quote: "200 lead contattati automaticamente, 15 appuntamenti prenotati, 5 nuovi clienti. Tutto senza toccare il telefono.",
      avatar: "G",
      color: "bg-emerald-500"
    },
    {
      name: "Paolo",
      role: "Coach Aziendale",
      result: "Zero ripetizioni",
      time: "formazione automatica",
      quote: "Ho creato 12 corsi dai miei video YouTube. I clienti studiano da soli, io faccio solo le sessioni strategiche.",
      avatar: "P",
      color: "bg-amber-500"
    }
  ];

  const capabilities = [
    { icon: Target, text: "Lead Scoring intelligente" },
    { icon: Calendar, text: "Prenotazione automatica" },
    { icon: BarChart3, text: "Dashboard analytics" },
    { icon: Users, text: "Gestione multi-cliente" },
    { icon: Zap, text: "Automazioni email" },
    { icon: Sparkles, text: "AI Knowledge Base" }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-50 overflow-x-hidden">
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
                <Sparkles className="text-white" size={20} />
              </div>
              <span className="text-xl font-bold text-slate-800">
                Consulente AI
              </span>
            </div>
            <Button 
              onClick={() => setLocation("/login")}
              className="bg-slate-900 hover:bg-slate-800 text-white font-medium rounded-full px-6 shadow-lg shadow-slate-200"
            >
              Accedi
              <ArrowRight className="ml-2" size={16} />
            </Button>
          </div>
        </div>
      </nav>

      <section className="pt-32 pb-24 px-4 sm:px-6 lg:px-8 relative">
        <div className="absolute top-20 left-10 w-72 h-72 bg-violet-200/40 rounded-full blur-3xl"></div>
        <div className="absolute top-40 right-20 w-96 h-96 bg-emerald-200/30 rounded-full blur-3xl"></div>
        <div className="absolute bottom-20 left-1/3 w-64 h-64 bg-amber-200/40 rounded-full blur-3xl"></div>
        
        <div className="max-w-6xl mx-auto relative">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-violet-50 border border-violet-200 mb-8 shadow-sm">
              <Rocket size={16} className="text-violet-600" />
              <span className="text-sm font-medium text-violet-700">La piattaforma AI per consulenti che vogliono scalare</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-slate-900 mb-8 leading-[1.1] tracking-tight">
              Trasforma la tua
              <span className="block bg-gradient-to-r from-violet-600 via-fuchsia-500 to-indigo-600 bg-clip-text text-transparent mt-3">
                Attività in un business
              </span>
              <span className="block text-slate-900 mt-3">che scala da solo</span>
            </h1>
            
            <p className="text-xl sm:text-2xl text-slate-600 mb-12 leading-relaxed max-w-3xl mx-auto font-normal">
              AI che conosce i tuoi clienti, WhatsApp che lavora 24/7, 
              formazione che si crea da sola. <span className="text-slate-900 font-semibold">Tutto in un'unica piattaforma.</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-20">
              <Button 
                size="lg"
                onClick={() => document.getElementById('contact-form')?.scrollIntoView({ behavior: 'smooth' })}
                className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white px-10 py-7 text-lg rounded-full shadow-xl shadow-violet-200 group font-semibold"
              >
                <Play className="mr-2" size={20} />
                Richiedi una Demo Gratuita
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={18} />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation("/login")}
                className="px-10 py-7 text-lg border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 rounded-full font-medium"
              >
                Sono gia cliente
              </Button>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 max-w-4xl mx-auto">
              {stats.map((stat, index) => (
                <div 
                  key={index} 
                  className={`p-6 rounded-3xl ${stat.bg} border border-slate-200/50 hover:shadow-lg hover:shadow-slate-200/50 transition-all duration-300 group`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`w-12 h-12 rounded-2xl bg-white flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                      <stat.icon className={stat.color} size={24} />
                    </div>
                    <div className={`text-3xl font-bold ${stat.color} mb-1`}>{stat.number}</div>
                    <div className="text-sm text-slate-600 font-medium">{stat.label}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              Tre superpoteri per la tua consulenza
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Non software, ma un partner AI che lavora per te giorno e notte
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <div 
                key={index} 
                className={`group relative p-8 rounded-3xl bg-white border-2 border-slate-200 ${feature.borderColor} transition-all duration-300 hover:shadow-xl hover:shadow-slate-200/50`}
              >
                <div className={`w-16 h-16 rounded-2xl ${feature.color} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className={feature.iconColor} size={32} />
                </div>
                
                <h3 className="text-2xl font-bold text-slate-900 mb-4">{feature.title}</h3>
                
                <p className="text-slate-600 mb-6 leading-relaxed text-lg">
                  {feature.description}
                </p>
                
                <ul className="space-y-3">
                  {feature.items.map((item, i) => (
                    <li key={i} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full ${feature.color} flex items-center justify-center`}>
                        <CheckCircle size={14} className={feature.iconColor} />
                      </div>
                      <span className="text-slate-700 font-medium">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              Risultati reali da consulenti reali
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Scopri come altri professionisti hanno trasformato la loro attivita
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8">
            {caseStudies.map((study, index) => (
              <div 
                key={index}
                className="p-8 rounded-3xl bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className={`w-14 h-14 rounded-2xl ${study.color} flex items-center justify-center text-white font-bold text-xl shadow-lg`}>
                    {study.avatar}
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-lg">{study.name}</h4>
                    <p className="text-slate-500">{study.role}</p>
                  </div>
                </div>
                
                <div className="mb-6 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-2xl font-bold text-slate-900">{study.result}</div>
                  <div className="text-slate-600">{study.time}</div>
                </div>
                
                <blockquote className="text-slate-600 leading-relaxed italic">
                  "{study.quote}"
                </blockquote>
                
                <div className="flex items-center gap-1 mt-6">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} size={18} className="text-amber-400 fill-amber-400" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 px-4 sm:px-6 lg:px-8 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-8">
                Tutto quello che ti serve
                <span className="block text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text mt-2">
                  in un'unica piattaforma
                </span>
              </h2>
              <p className="text-xl text-slate-600 mb-10 leading-relaxed">
                Basta passare da un tool all'altro. Gestisci clienti, lead, formazione e comunicazione 
                da un solo posto. L'AI si occupa del resto.
              </p>
              
              <div className="grid grid-cols-2 gap-4">
                {capabilities.map((cap, index) => (
                  <div 
                    key={index}
                    className="flex items-center gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 hover:border-violet-300 hover:bg-violet-50 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center">
                      <cap.icon size={20} className="text-violet-600" />
                    </div>
                    <span className="font-medium text-slate-700">{cap.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-violet-100 to-indigo-100 rounded-3xl blur-2xl opacity-60"></div>
              <div className="relative p-8 rounded-3xl bg-white border border-slate-200 shadow-xl">
                <div className="space-y-4">
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center">
                      <Bot size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Marco - Setter AI</div>
                      <div className="text-sm text-emerald-600">3 appuntamenti prenotati oggi</div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-violet-50 border border-violet-200">
                    <div className="w-10 h-10 rounded-xl bg-violet-500 flex items-center justify-center">
                      <MessageSquare size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">WhatsApp Automation</div>
                      <div className="text-sm text-violet-600">45 conversazioni gestite</div>
                    </div>
                    <div className="w-3 h-3 rounded-full bg-violet-500 animate-pulse"></div>
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-amber-50 border border-amber-200">
                    <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center">
                      <GraduationCap size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Corso Finanza Base</div>
                      <div className="text-sm text-amber-600">12 clienti hanno completato</div>
                    </div>
                    <CheckCircle size={20} className="text-amber-500" />
                  </div>
                  
                  <div className="flex items-center gap-3 p-4 rounded-2xl bg-rose-50 border border-rose-200">
                    <div className="w-10 h-10 rounded-xl bg-rose-500 flex items-center justify-center">
                      <TrendingUp size={20} className="text-white" />
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-slate-900">Lead Scoring</div>
                      <div className="text-sm text-rose-600">8 lead caldi da contattare</div>
                    </div>
                    <div className="px-2 py-1 rounded-full bg-rose-500 text-white text-xs font-bold">HOT</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="contact-form" className="py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-slate-50 to-white">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-4xl sm:text-5xl font-bold text-slate-900 mb-6">
              Pronto a trasformare
              <span className="block text-transparent bg-gradient-to-r from-violet-600 to-indigo-600 bg-clip-text mt-2">
                la tua consulenza?
              </span>
            </h2>
            <p className="text-xl text-slate-600 max-w-xl mx-auto">
              Lascia i tuoi dati e ti mostreremo come la piattaforma puo 
              rivoluzionare il tuo business
            </p>
          </div>

          <div className="p-8 sm:p-10 rounded-3xl bg-white border border-slate-200 shadow-xl">
            {isSubmitted ? (
              <div className="text-center py-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-200">
                  <CheckCircle size={40} className="text-white" />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 mb-4">Perfetto!</h3>
                <p className="text-xl text-slate-600 mb-8">
                  Ti contatteremo entro 24 ore per organizzare una demo personalizzata.
                </p>
                <Button 
                  onClick={() => setLocation("/login")}
                  className="bg-slate-900 hover:bg-slate-800 text-white rounded-full px-8 py-6 font-medium"
                >
                  Vai al Login
                  <ArrowRight className="ml-2" size={16} />
                </Button>
              </div>
            ) : (
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid sm:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-slate-700 font-medium flex items-center gap-2">
                      <User size={16} className="text-violet-600" />
                      Nome
                    </Label>
                    <Input
                      id="firstName"
                      {...form.register("firstName")}
                      placeholder="Il tuo nome"
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 h-12 text-lg focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                    />
                    {form.formState.errors.firstName && (
                      <p className="text-rose-500 text-sm">{form.formState.errors.firstName.message}</p>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-slate-700 font-medium flex items-center gap-2">
                      <User size={16} className="text-violet-600" />
                      Cognome
                    </Label>
                    <Input
                      id="lastName"
                      {...form.register("lastName")}
                      placeholder="Il tuo cognome"
                      className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 h-12 text-lg focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                    />
                    {form.formState.errors.lastName && (
                      <p className="text-rose-500 text-sm">{form.formState.errors.lastName.message}</p>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-slate-700 font-medium flex items-center gap-2">
                    <Mail size={16} className="text-violet-600" />
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...form.register("email")}
                    placeholder="la.tua@email.com"
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 h-12 text-lg focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                  />
                  {form.formState.errors.email && (
                    <p className="text-rose-500 text-sm">{form.formState.errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-slate-700 font-medium flex items-center gap-2">
                    <Phone size={16} className="text-violet-600" />
                    Telefono
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    {...form.register("phone")}
                    placeholder="+39 333 123 4567"
                    className="bg-slate-50 border-slate-300 text-slate-900 placeholder:text-slate-400 h-12 text-lg focus:border-violet-500 focus:ring-violet-500 rounded-xl"
                  />
                  {form.formState.errors.phone && (
                    <p className="text-rose-500 text-sm">{form.formState.errors.phone.message}</p>
                  )}
                </div>

                <Button 
                  type="submit"
                  size="lg"
                  disabled={submitMutation.isPending}
                  className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white py-7 text-lg font-semibold shadow-xl shadow-violet-200 rounded-xl"
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

                <p className="text-center text-sm text-slate-500">
                  Niente spam. Ti contatteremo solo per la demo.
                </p>
              </form>
            )}
          </div>
        </div>
      </section>

      <section className="py-16 px-4 sm:px-6 lg:px-8 bg-white border-t border-slate-200">
        <div className="max-w-4xl mx-auto text-center">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">Sei gia un utente?</h3>
          <p className="text-slate-600 mb-8">Accedi alla piattaforma per continuare a lavorare con i tuoi clienti</p>
          <Button 
            size="lg"
            onClick={() => setLocation("/login")}
            variant="outline"
            className="border-2 border-slate-300 text-slate-700 hover:bg-slate-100 hover:border-slate-400 px-10 py-6 text-lg rounded-full font-medium"
          >
            Vai al Login
            <ArrowRight className="ml-2" size={18} />
          </Button>
        </div>
      </section>

      <footer className="bg-slate-50 text-slate-600 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-200">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-violet-200">
                <Sparkles className="text-white" size={20} />
              </div>
              <span className="text-lg font-bold text-slate-800">Consulente AI</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm text-slate-500">© 2025 Consulente AI. Tutti i diritti riservati.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
