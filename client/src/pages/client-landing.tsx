import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useLocation } from "wouter";
import { 
  GraduationCap, 
  Target, 
  Sparkles, 
  Calendar, 
  CheckSquare, 
  BookOpen, 
  Zap, 
  TrendingUp,
  Award,
  MessageCircle,
  BarChart3,
  Clock,
  ArrowRight,
  Check,
  Star,
  Play,
  ChevronRight,
  Shield,
  Users,
  Brain,
  Activity,
  FileText
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function ClientLanding() {
  const [, setLocation] = useLocation();

  const features = [
    {
      icon: GraduationCap,
      title: "Università Personale",
      description: "Un percorso formativo strutturato su misura per te, con lezioni video e materiali sempre disponibili.",
      highlight: "Impari al tuo ritmo, senza stress"
    },
    {
      icon: CheckSquare,
      title: "Esercizi Pratici",
      description: "Compiti personalizzati sulla tua situazione reale con feedback dettagliato dal consulente.",
      highlight: "Non teoria astratta: applichi subito"
    },
    {
      icon: Brain,
      title: "AI Assistant 24/7",
      description: "Un assistente intelligente che ti risponde sempre, con supporto contestuale sul tuo percorso.",
      highlight: "Risposte immediate quando serve"
    },
    {
      icon: BarChart3,
      title: "Dashboard Personale",
      description: "Il tuo hub centrale con panoramica completa dei progressi, consulenze e task giornaliere.",
      highlight: "Vedi sempre dove sei e cosa fare"
    },
    {
      icon: Target,
      title: "Roadmap Personalizzata",
      description: "Piano d'azione creato dal consulente con obiettivi chiari divisi per fasi e milestone.",
      highlight: "Sai esattamente dove stai andando"
    },
    {
      icon: BookOpen,
      title: "Libreria Risorse",
      description: "Tutti i materiali formativi in un unico posto: video, PDF, guide pratiche sempre accessibili.",
      highlight: "Tutto quando ti serve, dove ti serve"
    },
    {
      icon: Activity,
      title: "Momentum Tracker",
      description: "Sistema per costruire abitudini produttive con check-in giornalieri e tracciamento progressi.",
      highlight: "Costruisci costanza giorno dopo giorno"
    },
    {
      icon: FileText,
      title: "Storico Consulenze",
      description: "Archivio completo con note, registrazioni video e feedback del consulente sempre disponibili.",
      highlight: "Non dimentichi mai cosa è stato detto"
    }
  ];

  const stats = [
    { value: "15.000+", label: "Lezioni Completate" },
    { value: "95%", label: "Tasso Completamento" },
    { value: "2 sec", label: "Tempo Risposta AI" },
    { value: "1.200+", label: "Certificazioni Rilasciate" }
  ];

  const testimonials = [
    {
      text: "In 3 mesi ho capito più di finanza che in 10 anni da solo. La roadmap personalizzata mi ha dato una direzione chiara.",
      author: "Marco R.",
      role: "Imprenditore",
      rating: 5
    },
    {
      text: "L'AI Assistant mi ha fatto risparmiare ore di ricerche confuse. Quando studiavo alle 23:00 avevo risposte immediate.",
      author: "Laura S.",
      role: "Libera Professionista",
      rating: 5
    },
    {
      text: "Finalmente vedo i progressi: 15 lezioni completate, 8 esercizi valutati, certificato del primo trimestre.",
      author: "Andrea B.",
      role: "Dirigente",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-white">
      {/* Navbar Minimal */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-gray-100">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-lg flex items-center justify-center">
                <GraduationCap className="text-white" size={20} />
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Consulente Pro
              </span>
            </div>
            <Button 
              onClick={() => setLocation("/login")}
              variant="ghost"
              className="text-gray-700 hover:text-gray-900 font-medium"
            >
              Accedi
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - Stile Motion */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-sm font-medium bg-blue-50 text-blue-700 border-0">
              🚀 La tua crescita finanziaria inizia qui
            </Badge>

            <h1 className="text-5xl md:text-7xl font-bold mb-6 text-gray-900 leading-tight tracking-tight">
              Il Tuo Percorso Personale
              <br />
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                verso la Libertà Finanziaria
              </span>
            </h1>

            <p className="text-xl text-gray-600 mb-10 leading-relaxed max-w-3xl mx-auto">
              Una piattaforma completa che ti accompagna passo-passo verso i tuoi obiettivi finanziari, 
              con il supporto del tuo consulente e dell'intelligenza artificiale.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              <Button 
                size="lg"
                onClick={() => setLocation("/register")}
                className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-base px-8 h-12 rounded-lg shadow-lg shadow-blue-600/20 hover:shadow-xl hover:shadow-blue-600/30 transition-all"
              >
                Inizia Ora Gratuitamente
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                variant="outline"
                className="border-2 border-gray-200 text-gray-700 hover:border-gray-300 hover:bg-gray-50 font-semibold text-base px-8 h-12 rounded-lg"
              >
                <Play className="mr-2 h-5 w-5" />
                Guarda Demo
              </Button>
            </div>

            {/* Stats Bar */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mt-16 pt-12 border-t border-gray-100">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="text-3xl md:text-4xl font-bold text-gray-900 mb-1">{stat.value}</div>
                  <div className="text-sm text-gray-600">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-6">
                Gestire le finanze personali non deve essere complicato
              </h2>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  </div>
                  <p className="text-gray-700">Non sai da dove iniziare per investire</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  </div>
                  <p className="text-gray-700">Hai paura di fare errori costosi</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  </div>
                  <p className="text-gray-700">Ti senti perso tra mille informazioni contrastanti</p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <div className="w-2 h-2 rounded-full bg-red-500"></div>
                  </div>
                  <p className="text-gray-700">Non hai tempo per seguire tutto autonomamente</p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
              <div className="w-12 h-12 bg-gradient-to-br from-green-500 to-emerald-600 rounded-xl flex items-center justify-center mb-4">
                <Check className="text-white" size={24} />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">La Soluzione</h3>
              <p className="text-gray-700 leading-relaxed">
                Un sistema guidato dove ogni passo è chiaro, ogni dubbio ha risposta immediata 
                e i tuoi progressi sono sempre sotto controllo. Non sei solo un numero: sei una 
                persona con obiettivi unici.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Tutto ciò di cui hai bisogno
              <br />
              <span className="text-blue-600">in un solo posto</span>
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Strumenti professionali per accelerare la tua crescita finanziaria
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="border border-gray-200 hover:border-blue-200 hover:shadow-lg transition-all duration-300 group"
              >
                <CardContent className="p-6">
                  <div className="w-12 h-12 bg-blue-50 group-hover:bg-blue-100 rounded-xl flex items-center justify-center mb-4 transition-colors">
                    <feature.icon className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{feature.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 leading-relaxed">{feature.description}</p>
                  <p className="text-xs font-medium text-blue-600">{feature.highlight}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 px-6 bg-gradient-to-b from-gray-50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Come funziona
            </h2>
            <p className="text-xl text-gray-600">
              Inizia il tuo percorso in 5 semplici step
            </p>
          </div>

          <div className="grid md:grid-cols-5 gap-6">
            {[
              { step: "1", title: "Accesso", desc: "Il tuo consulente crea l'account e trovi tutto pronto" },
              { step: "2", title: "Scopri", desc: "Visualizzi la roadmap e inizi le prime lezioni" },
              { step: "3", title: "Lavora", desc: "Completi esercizi e ottieni feedback personalizzato" },
              { step: "4", title: "Consulenze", desc: "Incontri regolari per approfondire e correggere rotta" },
              { step: "5", title: "Cresci", desc: "Accumuli competenze e raggiungi obiettivi reali" }
            ].map((item, index) => (
              <div key={index} className="relative">
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 h-full hover:shadow-md transition-shadow">
                  <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-lg mb-4">
                    {item.step}
                  </div>
                  <h3 className="font-semibold text-gray-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-gray-600">{item.desc}</p>
                </div>
                {index < 4 && (
                  <div className="hidden md:block absolute top-1/2 -right-3 transform -translate-y-1/2 z-10">
                    <ChevronRight className="h-6 w-6 text-gray-300" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-4">
              Storie di successo
            </h2>
            <p className="text-xl text-gray-600">
              Cosa dicono i nostri clienti
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border border-gray-200 hover:shadow-lg transition-shadow">
                <CardContent className="p-8">
                  <div className="flex gap-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                    ))}
                  </div>
                  <p className="text-gray-700 mb-6 leading-relaxed italic">
                    "{testimonial.text}"
                  </p>
                  <div className="border-t border-gray-100 pt-4">
                    <p className="font-semibold text-gray-900">{testimonial.author}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Why Different */}
      <section className="py-20 px-6 bg-gray-50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Perché è diverso
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Non Sei Solo: Consulente + AI Assistant sempre disponibili",
              "Percorso Personalizzato: Non contenuti generici ma su misura",
              "Applicazione Pratica: Teoria + Esercizi sulla TUA situazione",
              "Tracciamento Progressi: Vedi i risultati nero su bianco",
              "Tutto Integrato: Non 10 app separate, una piattaforma",
              "Supporto Continuo: Feedback personalizzato su ogni lavoro"
            ].map((item, index) => (
              <div key={index} className="flex items-start gap-3 bg-white rounded-lg p-4 border border-gray-100">
                <Check className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                <p className="text-gray-700 font-medium">{item}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Final */}
      <section className="py-20 px-6 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-700">
        <div className="max-w-4xl mx-auto text-center text-white">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Inizia Oggi il Tuo Percorso di Crescita
          </h2>
          <p className="text-xl mb-8 text-blue-100 max-w-2xl mx-auto leading-relaxed">
            Smetti di navigare a vista. Inizia un percorso strutturato, personalizzato, 
            con supporto continuo. I tuoi obiettivi finanziari non sono mai stati così raggiungibili.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-8">
            <Button 
              size="lg"
              onClick={() => setLocation("/register")}
              className="bg-white text-blue-700 hover:bg-gray-100 font-bold text-lg px-10 h-14 rounded-lg shadow-xl hover:shadow-2xl transition-all"
            >
              Richiedi Accesso
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg"
              variant="outline"
              onClick={() => setLocation("/login")}
              className="border-2 border-white text-white hover:bg-white/10 font-semibold text-lg px-10 h-14 rounded-lg backdrop-blur-sm"
            >
              Hai già un account?
            </Button>
          </div>
          <div className="flex items-center justify-center gap-2 text-sm text-blue-100">
            <Shield className="h-4 w-4" />
            <span>Garanzia 30 giorni - Zero rischi</span>
          </div>
        </div>
      </section>

      {/* Footer Minimal */}
      <footer className="py-8 px-6 bg-gray-900 text-gray-400 text-center border-t border-gray-800">
        <div className="max-w-7xl mx-auto">
          <p className="text-sm">© 2025 Consulente Pro - La tua piattaforma per la crescita finanziaria</p>
        </div>
      </footer>
    </div>
  );
}