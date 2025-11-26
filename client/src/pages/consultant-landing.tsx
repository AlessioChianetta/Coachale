import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { 
  Users, 
  Sparkles, 
  BarChart3,
  Calendar,
  MessageSquare,
  Zap,
  Target,
  ArrowRight,
  CheckCircle,
  GraduationCap,
  Mail,
  Bot,
  FileText,
  TrendingUp,
  Shield,
  Clock,
  Award,
  Lightbulb,
  Rocket
} from "lucide-react";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthUser } from "@/lib/auth";
import { useEffect } from "react";

export default function ConsultantLanding() {
  const [, setLocation] = useLocation();
  const user = getAuthUser();

  useEffect(() => {
    if (user) {
      if (user.role === "consultant") {
        setLocation("/consultant");
      } else {
        setLocation("/client");
      }
    }
  }, [user, setLocation]);

  const features = [
    {
      icon: Users,
      title: "Gestione Clienti Completa",
      description: "Dashboard centralizzata per monitorare progressi, assegnare task e gestire l'intero percorso di ogni cliente.",
      gradient: "from-blue-500 to-indigo-600"
    },
    {
      icon: MessageSquare,
      title: "WhatsApp Business + AI",
      description: "Integrazione WhatsApp con risposte AI automatiche. Gestisci conversazioni e converti lead 24/7.",
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: GraduationCap,
      title: "Università Personalizzabile",
      description: "Crea percorsi formativi strutturati. Organizza lezioni, moduli e trimestri per i tuoi clienti.",
      gradient: "from-purple-500 to-pink-600"
    },
    {
      icon: BarChart3,
      title: "Analytics Avanzata",
      description: "Statistiche dettagliate su engagement, completamento esercizi e performance dei clienti.",
      gradient: "from-orange-500 to-red-600"
    },
    {
      icon: Mail,
      title: "Email Automation",
      description: "Journey email automatizzate con AI. Configura SMTP e invia comunicazioni personalizzate.",
      gradient: "from-cyan-500 to-blue-600"
    },
    {
      icon: Calendar,
      title: "Calendar Sync",
      description: "Integrazione Google Calendar. Sincronizza appuntamenti e gestisci la tua disponibilità.",
      gradient: "from-yellow-500 to-orange-600"
    }
  ];

  const tools = [
    {
      icon: FileText,
      title: "Esercizi & Feedback",
      description: "Assegna esercizi personalizzati, correggi automaticamente e fornisci feedback dettagliato",
      stats: "Auto-grading + AI review"
    },
    {
      icon: Bot,
      title: "AI Agents",
      description: "Configura agenti AI per email, WhatsApp e supporto clienti con personalità personalizzabile",
      stats: "Multi-agent system"
    },
    {
      icon: Target,
      title: "Roadmap Builder",
      description: "Crea piani d'azione strutturati con fasi, milestone e obiettivi chiari per ogni cliente",
      stats: "Visual planning"
    },
    {
      icon: TrendingUp,
      title: "Client State Tracking",
      description: "Monitora lo stato attuale vs ideale di ogni cliente con analisi AI automatica",
      stats: "AI-powered insights"
    }
  ];

  const stats = [
    { number: "10x", label: "Efficienza", icon: Zap },
    { number: "24/7", label: "Automazione", icon: Clock },
    { number: "100+", label: "Clienti Gestibili", icon: Users },
    { number: "AI", label: "Powered", icon: Sparkles }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl blur-sm opacity-60"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                  <Shield className="text-white" size={22} />
                </div>
              </div>
              <span className="text-xl font-bold text-white">
                Consulente Pro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/")}
                className="text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Area Clienti
              </Button>
              <Button 
                variant="ghost" 
                onClick={() => setLocation("/login")}
                className="hidden sm:inline-flex text-slate-300 hover:text-white hover:bg-slate-800"
              >
                Accedi
              </Button>
              <Button 
                onClick={() => setLocation("/register")}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30"
              >
                Inizia Gratis
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20 mb-6 animate-fade-in">
              <Rocket size={16} className="text-blue-400" />
              <span className="text-sm font-medium text-blue-300">Piattaforma Completa per Consulenti Professionisti</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Gestisci I Tuoi Clienti
              <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mt-2">
                Con Intelligenza Artificiale
              </span>
            </h1>
            
            <p className="text-xl text-slate-300 mb-10 leading-relaxed max-w-3xl mx-auto">
              Dashboard professionale, WhatsApp Business integrato, email automation, 
              analytics avanzata e AI agents. Tutto quello che ti serve in un'unica piattaforma.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-6 text-lg shadow-xl shadow-blue-500/30 group"
              >
                Inizia Gratis Ora
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation("/")}
                className="px-8 py-6 text-lg border-2 border-slate-600 text-slate-300 hover:bg-slate-800 hover:border-slate-500"
              >
                Sei un Cliente?
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-20 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10 transition-all duration-300 backdrop-blur-sm">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500/20 to-indigo-600/20 flex items-center justify-center mb-3">
                    <stat.icon className="text-blue-400" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                  <div className="text-sm text-slate-400">{stat.label}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Strumenti Professionali
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Tutto quello che serve per gestire e scalare la tua attività di consulenza
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group p-8 bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/10 transition-all duration-300 relative overflow-hidden backdrop-blur-sm"
              >
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`}>
                </div>
                
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="text-white" size={28} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>
                  
                  <p className="text-slate-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Tools Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Funzionalità Avanzate
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Strumenti potenti per portare la tua consulenza al livello successivo
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {tools.map((tool, index) => (
              <Card key={index} className="p-8 bg-slate-800/50 border-slate-700 hover:border-blue-500/50 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 backdrop-blur-sm">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0">
                    <tool.icon className="text-white" size={24} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">
                      {tool.title}
                    </h3>
                    <p className="text-slate-300 mb-3 leading-relaxed">
                      {tool.description}
                    </p>
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
                      <CheckCircle size={14} className="text-blue-400" />
                      <span className="text-xs font-medium text-blue-300">{tool.stats}</span>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-slate-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Come Funziona
            </h2>
            <p className="text-xl text-slate-300 max-w-2xl mx-auto">
              Inizia a gestire i tuoi clienti in modo professionale in tre semplici passi
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Configura la Piattaforma",
                description: "Crea il tuo account consulente. Personalizza l'università, configura AI agents e integra i tuoi strumenti.",
                icon: Lightbulb
              },
              {
                step: "02",
                title: "Aggiungi i Clienti",
                description: "Invita i tuoi clienti, assegna percorsi formativi e crea roadmap personalizzate per ognuno.",
                icon: Users
              },
              {
                step: "03",
                title: "Automatizza & Scala",
                description: "WhatsApp AI, email automation e analytics ti permettono di gestire più clienti senza stress.",
                icon: Rocket
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="text-7xl font-bold text-slate-800">{item.step}</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-xl shadow-blue-500/30">
                        <item.icon className="text-white" size={32} />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-slate-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/4 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-500/50 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-500 via-indigo-600 to-purple-600 p-12 text-center">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
            <div className="relative">
              <Award className="w-16 h-16 text-white/90 mx-auto mb-6" />
              <h2 className="text-4xl font-bold text-white mb-4">
                Pronto a Potenziare la Tua Consulenza?
              </h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Unisciti ai consulenti che stanno già usando l'AI per gestire più clienti con meno sforzo
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button 
                  size="lg"
                  onClick={() => setLocation("/register")}
                  className="bg-white text-blue-600 hover:bg-slate-50 px-8 py-6 text-lg shadow-xl"
                >
                  Inizia Gratis Ora
                  <CheckCircle className="ml-2" size={20} />
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  onClick={() => setLocation("/login")}
                  className="border-2 border-white text-white hover:bg-white/10 px-8 py-6 text-lg"
                >
                  Ho già un account
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-950 text-slate-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-slate-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                <Shield className="text-white" size={22} />
              </div>
              <span className="text-lg font-bold text-white">Consulente Pro</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm">© 2025 Consulente Pro. Tutti i diritti riservati.</p>
            </div>
          </div>
        </div>
      </footer>
      <ConsultantAIAssistant />
    </div>
  );
}
