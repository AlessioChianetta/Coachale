import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLocation } from "wouter";
import { 
  GraduationCap, 
  Target, 
  Sparkles, 
  Brain,
  Activity,
  BarChart3,
  CheckCircle,
  ArrowRight,
  Zap,
  Trophy,
  Clock,
  Lightbulb,
  TrendingUp,
  Shield,
  Star
} from "lucide-react";
import { getAuthUser } from "@/lib/auth";
import { useEffect } from "react";

export default function Home() {
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
      icon: GraduationCap,
      title: "Università Personale",
      description: "Percorso formativo strutturato con lezioni video, materiali e certificazioni. Impari al tuo ritmo.",
      gradient: "from-blue-500 to-indigo-600"
    },
    {
      icon: Brain,
      title: "AI Assistant 24/7",
      description: "Assistente intelligente sempre disponibile. Risposte contestuali sul tuo percorso in tempo reale.",
      gradient: "from-purple-500 to-pink-600"
    },
    {
      icon: Activity,
      title: "Momentum Tracker",
      description: "Sistema di tracking quotidiano. Costruisci abitudini produttive e mantieni la costanza.",
      gradient: "from-orange-500 to-red-600"
    },
    {
      icon: Target,
      title: "Roadmap Personalizzata",
      description: "Piano d'azione creato dal consulente. Obiettivi chiari divisi per fasi e milestone.",
      gradient: "from-green-500 to-emerald-600"
    },
    {
      icon: BarChart3,
      title: "Dashboard Avanzata",
      description: "Monitora progressi, consulenze e task in un'unica vista. Tutto sotto controllo.",
      gradient: "from-cyan-500 to-blue-600"
    },
    {
      icon: Sparkles,
      title: "Esercizi Pratici",
      description: "Compiti personalizzati con feedback dettagliato. Applichi subito quello che impari.",
      gradient: "from-yellow-500 to-orange-600"
    }
  ];

  const stats = [
    { number: "2.4k+", label: "AI Attive", icon: Trophy },
    { number: "98%", label: "Soddisfazione", icon: Star },
    { number: "<2s", label: "Risposta AI", icon: Zap },
    { number: "24/7", label: "Disponibilità", icon: Clock }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-gray-900/80 backdrop-blur-lg border-b border-gray-700/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl blur-sm opacity-60"></div>
                <div className="relative w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                  <GraduationCap className="text-white" size={22} />
                </div>
              </div>
              <span className="text-xl font-bold text-white">
                Consulente Pro
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                onClick={() => setLocation("/login")}
                className="hidden sm:inline-flex bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-600 hover:to-purple-600 text-white font-semibold shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 transition-all"
              >
                Accedi
              </Button>
              <Button 
                onClick={() => setLocation("/register")}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/30"
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
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-900/30 border border-blue-700/50 mb-6 animate-fade-in">
              <Sparkles size={16} className="text-blue-400" />
              <span className="text-sm font-medium text-blue-300">La tua crescita personale, potenziata dall'AI</span>
            </div>
            
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold text-white mb-6 leading-tight">
              Il Tuo Percorso di
              <span className="block bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 bg-clip-text text-transparent mt-2">
                Crescita Personale
              </span>
            </h1>
            
            <p className="text-xl text-gray-300 mb-10 leading-relaxed max-w-3xl mx-auto">
              Una piattaforma completa che integra formazione strutturata, AI coaching, 
              tracking quotidiano e supporto personalizzato. Tutto in un unico posto.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                size="lg"
                onClick={() => setLocation("/login")}
                className="bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white px-8 py-6 text-lg shadow-xl shadow-blue-500/30 group"
              >
                Accedi
                <ArrowRight className="ml-2 group-hover:translate-x-1 transition-transform" size={20} />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                onClick={() => setLocation("/consulenti")}
                className="px-8 py-6 text-lg border-2 hover:bg-slate-50"
              >
                Sei un Consulente?
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-20 max-w-5xl mx-auto">
            {stats.map((stat, index) => (
              <Card key={index} className="p-6 bg-gray-800/50 border-gray-700 hover:border-blue-500 hover:shadow-lg transition-all duration-300">
                <div className="flex flex-col items-center text-center">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-900/50 to-indigo-900/50 flex items-center justify-center mb-3">
                    <stat.icon className="text-blue-400" size={24} />
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                  <div className="text-sm text-gray-400">{stat.label}</div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-800/30">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Tutto Quello Che Ti Serve
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Un ecosistema integrato di strumenti progettato per massimizzare il tuo progresso
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group p-8 bg-gray-800/50 border-gray-700 hover:border-blue-500/50 hover:shadow-2xl hover:shadow-blue-500/20 transition-all duration-300 relative overflow-hidden"
              >
                <div 
                  className={`absolute inset-0 bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}>
                </div>
                
                <div className="relative">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300`}>
                    <feature.icon className="text-white" size={28} />
                  </div>
                  
                  <h3 className="text-xl font-bold text-white mb-3">
                    {feature.title}
                  </h3>
                  
                  <p className="text-gray-300 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold text-white mb-4">
              Come Funziona
            </h2>
            <p className="text-xl text-gray-300 max-w-2xl mx-auto">
              Tre semplici passi per iniziare il tuo percorso di crescita
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Registrati e Configura",
                description: "Crea il tuo account in pochi secondi. Il tuo consulente preparerà un percorso su misura per te.",
                icon: Lightbulb
              },
              {
                step: "02",
                title: "Segui il Percorso",
                description: "Accedi a lezioni, esercizi e materiali. L'AI ti supporta 24/7 quando hai dubbi.",
                icon: TrendingUp
              },
              {
                step: "03",
                title: "Monitora i Progressi",
                description: "Dashboard completa per vedere i risultati. Certificazioni e milestone confermano i tuoi traguardi.",
                icon: Trophy
              }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="flex flex-col items-center text-center">
                  <div className="relative mb-6">
                    <div className="text-7xl font-bold text-gray-800">{item.step}</div>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center">
                        <item.icon className="text-white" size={32} />
                      </div>
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-3">
                    {item.title}
                  </h3>
                  <p className="text-gray-300 leading-relaxed">
                    {item.description}
                  </p>
                </div>
                {index < 2 && (
                  <div className="hidden md:block absolute top-1/4 -right-4 w-8 h-0.5 bg-gradient-to-r from-blue-300 to-transparent"></div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 p-12 text-center">
            <div className="absolute inset-0 bg-grid-white/[0.05] bg-[size:20px_20px]"></div>
            <div className="relative">
              <Shield className="w-16 h-16 text-white/90 mx-auto mb-6" />
              <h2 className="text-4xl font-bold text-white mb-4">
                Pronto a Iniziare?
              </h2>
              <p className="text-xl text-white/90 mb-8 max-w-2xl mx-auto">
                Unisciti a migliaia di persone che stanno già trasformando la loro crescita personale con Consulente Pro
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
      <footer className="bg-gray-950 text-gray-400 py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center">
                <GraduationCap className="text-white" size={22} />
              </div>
              <span className="text-lg font-bold text-white">Consulente Pro</span>
            </div>
            <div className="text-center md:text-right">
              <p className="text-sm">© 2025 Consulente Pro. Tutti i diritti riservati.</p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
