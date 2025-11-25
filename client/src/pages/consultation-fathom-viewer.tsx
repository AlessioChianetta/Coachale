import { useQuery } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Video, AlertCircle, ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";

type Consultation = {
  id: string;
  consultantId: string;
  clientId: string;
  scheduledAt: string;
  duration: number;
  notes: string | null;
  status: "scheduled" | "completed" | "cancelled";
  googleMeetLink: string | null;
  fathomShareLink: string | null;
  googleCalendarEventId: string | null;
  createdAt: string;
};

export default function ConsultationFathomViewer() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();

  const { data: consultation, isLoading, error } = useQuery<Consultation>({
    queryKey: [`/api/consultations/${id}`],
    retry: 1,
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mx-auto mb-4"></div>
          <p className="text-lg text-muted-foreground font-medium">Caricamento consulenza...</p>
        </div>
      </div>
    );
  }

  if (error || !consultation) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 h-16 bg-white dark:bg-gray-950 border-b shadow-sm">
          <div className="container mx-auto h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-foreground">TurboCoach</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setLocation("/client/consultations")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna alle Consulenze
            </Button>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="max-w-lg w-full border-red-200 dark:border-red-800">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Consulenza non trovata</h2>
              <p className="text-muted-foreground mb-6">
                Non è stato possibile trovare la consulenza richiesta o non hai i permessi per accedervi.
              </p>
              <Button
                onClick={() => setLocation("/client/consultations")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna alle Consulenze
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!consultation.fathomShareLink) {
    return (
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-50 h-16 bg-white dark:bg-gray-950 border-b shadow-sm">
          <div className="container mx-auto h-full px-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Video className="w-6 h-6 text-primary" />
              <span className="text-xl font-bold text-foreground">TurboCoach</span>
            </div>
            <Button
              variant="ghost"
              onClick={() => setLocation("/client/consultations")}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Torna alle Consulenze
            </Button>
          </div>
        </header>

        <div className="container mx-auto px-4 py-12 flex items-center justify-center min-h-[calc(100vh-4rem)]">
          <Card className="max-w-lg w-full border-yellow-200 dark:border-yellow-800">
            <CardContent className="p-8 text-center">
              <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-8 h-8 text-yellow-600 dark:text-yellow-400" />
              </div>
              <h2 className="text-2xl font-bold text-foreground mb-2">Link Fathom non disponibile</h2>
              <p className="text-muted-foreground mb-6">
                Il link per la videochiamata Fathom non è ancora stato configurato per questa consulenza.
                Contatta il tuo consulente per maggiori informazioni.
              </p>
              <Button
                onClick={() => setLocation("/client/consultations")}
                className="w-full"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Torna alle Consulenze
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-50 h-16 bg-white dark:bg-gray-950 border-b shadow-sm">
        <div className="container mx-auto h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Video className="w-6 h-6 text-primary" />
            <span className="text-xl font-bold text-foreground">TurboCoach</span>
          </div>
          <Button
            variant="ghost"
            onClick={() => setLocation("/client/consultations")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Torna alle Consulenze</span>
            <span className="sm:hidden">Indietro</span>
          </Button>
        </div>
      </header>

      <div className="flex-1 relative">
        <Alert className="absolute top-4 left-1/2 -translate-x-1/2 max-w-2xl w-[calc(100%-2rem)] z-10 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800 hidden" id="iframe-blocked-alert">
          <AlertCircle className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <p className="font-medium mb-2">Il browser ha bloccato l'iframe</p>
            <p className="text-sm mb-3">
              Se la videochiamata non si carica, il tuo browser potrebbe aver bloccato il contenuto.
            </p>
            <a
              href={consultation.fathomShareLink}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium text-sm underline"
            >
              <ExternalLink className="w-4 h-4" />
              Apri il link in una nuova scheda
            </a>
          </AlertDescription>
        </Alert>

        <iframe
          src={consultation.fathomShareLink}
          allow="camera; microphone; fullscreen; display-capture"
          allowFullScreen
          className="w-full h-[calc(100vh-4rem)] border-0"
          title="Fathom Video Call"
          onError={() => {
            const alert = document.getElementById("iframe-blocked-alert");
            if (alert) {
              alert.classList.remove("hidden");
            }
          }}
        />
      </div>
    </div>
  );
}
