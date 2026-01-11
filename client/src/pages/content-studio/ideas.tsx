import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Lightbulb,
  Sparkles,
  Star,
  FileText,
  Megaphone,
  TrendingUp,
  Zap,
} from "lucide-react";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

interface Idea {
  id: string;
  title: string;
  description: string;
  score: number;
  hook: string;
  contentType: string;
  targetAudience: string;
}

export default function ContentStudioIdeas() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [topic, setTopic] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [contentType, setContentType] = useState("");

  const demoIdeas: Idea[] = [
    {
      id: "1",
      title: "[DEMO] 5 Errori Comuni nel Fitness che Rallentano i Risultati",
      description:
        "Un contenuto educativo che evidenzia gli errori più frequenti commessi da chi inizia un percorso fitness, con soluzioni pratiche.",
      score: 92,
      hook: "Stai sabotando i tuoi risultati senza saperlo?",
      contentType: "Carosello",
      targetAudience: "Principianti Fitness",
    },
    {
      id: "2",
      title: "[DEMO] La Mia Routine Mattutina in 10 Minuti",
      description:
        "Video behind-the-scenes che mostra una routine mattutina veloce ed efficace, ideale per professionisti impegnati.",
      score: 88,
      hook: "Come inizio ogni giorno con energia",
      contentType: "Reel",
      targetAudience: "Professionisti 30-45",
    },
    {
      id: "3",
      title: "[DEMO] Guida Completa all'Alimentazione Post-Workout",
      description:
        "Post educativo dettagliato su cosa mangiare dopo l'allenamento per massimizzare i risultati.",
      score: 85,
      hook: "Il 90% delle persone sbaglia questo passaggio fondamentale",
      contentType: "Post",
      targetAudience: "Atleti Intermedi",
    },
    {
      id: "4",
      title: "[DEMO] Trasformazione Cliente - Da 0 a Maratona",
      description:
        "Storia di successo di un cliente che è passato da sedentario a maratoneta in 12 mesi.",
      score: 95,
      hook: "Un anno fa non riusciva a correre 1km...",
      contentType: "Video",
      targetAudience: "Tutti",
    },
    {
      id: "5",
      title: "[DEMO] 3 Esercizi per la Schiena che Puoi Fare Ovunque",
      description:
        "Tutorial pratico con esercizi semplici per chi lavora da casa o in ufficio.",
      score: 82,
      hook: "Mal di schiena? Ecco la soluzione",
      contentType: "Carosello",
      targetAudience: "Smart Workers",
    },
  ];

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-500/10";
    if (score >= 80) return "text-amber-600 bg-amber-500/10";
    return "text-red-600 bg-red-500/10";
  };

  return (
    <div className="min-h-screen bg-background">
      {isMobile && <Navbar onMenuClick={() => setSidebarOpen(true)} />}
      <div className={`flex ${isMobile ? "h-[calc(100vh-80px)]" : "h-screen"}`}>
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />

        <div className="flex-1 overflow-y-auto">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                  <Lightbulb className="h-8 w-8 text-amber-500" />
                  Generatore Idee
                </h1>
                <p className="text-muted-foreground">
                  Genera idee creative per i tuoi contenuti con l'AI
                </p>
              </div>
              <Badge variant="outline" className="text-amber-600 border-amber-300">
                [DEMO] Dati di Esempio
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-purple-500" />
                  Genera Nuove Idee
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="topic">Topic / Argomento</Label>
                    <Input
                      id="topic"
                      placeholder="Es: Fitness, Nutrizione, Mindset..."
                      value={topic}
                      onChange={(e) => setTopic(e.target.value)}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Target Audience</Label>
                    <Select value={targetAudience} onValueChange={setTargetAudience}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona target" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="principianti">Principianti</SelectItem>
                        <SelectItem value="intermedi">Intermedi</SelectItem>
                        <SelectItem value="avanzati">Avanzati</SelectItem>
                        <SelectItem value="professionisti">Professionisti 30-45</SelectItem>
                        <SelectItem value="giovani">Giovani 18-25</SelectItem>
                        <SelectItem value="tutti">Tutti</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tipo Contenuto</Label>
                    <Select value={contentType} onValueChange={setContentType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleziona tipo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="post">Post</SelectItem>
                        <SelectItem value="carosello">Carosello</SelectItem>
                        <SelectItem value="reel">Reel</SelectItem>
                        <SelectItem value="video">Video</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button disabled className="w-full sm:w-auto">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Genera Idee con AI
                  <Badge variant="secondary" className="ml-2 text-xs">
                    Coming Soon
                  </Badge>
                </Button>
              </CardContent>
            </Card>

            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Zap className="h-5 w-5 text-amber-500" />
                Idee Generate
                <Badge variant="secondary">[DEMO]</Badge>
              </h2>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {demoIdeas.map((idea) => (
                  <Card key={idea.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-base">{idea.title}</h3>
                          <p className="text-sm text-muted-foreground mt-1">
                            {idea.description}
                          </p>
                        </div>
                        <div
                          className={`flex items-center gap-1 px-2 py-1 rounded-lg ${getScoreColor(
                            idea.score
                          )}`}
                        >
                          <Star className="h-4 w-4" />
                          <span className="font-bold">{idea.score}</span>
                        </div>
                      </div>

                      <div className="bg-muted/50 p-3 rounded-lg">
                        <p className="text-xs text-muted-foreground mb-1">
                          Hook Suggerito:
                        </p>
                        <p className="text-sm font-medium italic">"{idea.hook}"</p>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{idea.contentType}</Badge>
                        <Badge variant="secondary">{idea.targetAudience}</Badge>
                      </div>

                      <div className="flex gap-2 pt-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          <FileText className="h-4 w-4 mr-1" />
                          Usa per Post
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1">
                          <Megaphone className="h-4 w-4 mr-1" />
                          Usa per Campagna
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
