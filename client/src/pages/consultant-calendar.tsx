import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import Navbar from '@/components/navbar';
import Sidebar from '@/components/sidebar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, CalendarDays, ExternalLink, Info, AlertTriangle, Maximize2, Minimize2 } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useLocation } from 'wouter';

export default function ConsultantCalendarPage() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const calendarContainerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: settings } = useQuery({
    queryKey: ['/api/calendar-settings/connection-status'],
    queryFn: async () => {
      const response = await fetch('/api/calendar-settings/connection-status', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch settings');
      return response.json();
    },
  });

  const calendarEmail = settings?.googleCalendarEmail;
  const isCalendarConnected = !!calendarEmail;
  const calendarSrc = calendarEmail ? encodeURIComponent(calendarEmail) : '';

  const toggleFullscreen = async () => {
    if (!calendarContainerRef.current) return;

    try {
      if (!document.fullscreenElement) {
        await calendarContainerRef.current.requestFullscreen();
        setIsFullscreen(true);
      } else {
        await document.exitFullscreen();
        setIsFullscreen(false);
      }
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile attivare la modalità schermo intero",
        variant: "destructive"
      });
    }
  };

  // Listen for fullscreen changes (e.g., user presses ESC)
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-800">
      <Navbar onMenuClick={() => setSidebarOpen(true)} />
      <div className="flex">
        <Sidebar
          role="consultant"
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="flex-1 p-8">
          <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                  <CalendarDays className="h-6 w-6 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  Calendario Google
                </h1>
              </div>
              <p className="text-gray-600 dark:text-gray-400">
                Il tuo calendario Google integrato - Gli appuntamenti WhatsApp vengono creati automaticamente qui
              </p>
            </div>

            {!isCalendarConnected ? (
              <Card className="p-8 text-center">
                <Calendar className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Calendario non connesso</h3>
                <p className="text-muted-foreground mb-4">
                  Connetti il tuo Google Calendar nella sezione Impostazioni per visualizzare i tuoi appuntamenti qui.
                </p>
                <Button onClick={() => setLocation('/consultant/api-keys-unified?tab=calendar&subtab=oauth')}>
                  Connetti Google Calendar
                </Button>
              </Card>
            ) : (
              <>
                {/* Info Alert */}
                <Alert className="mb-6 bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-300">
                    Questo calendario è sincronizzato in tempo reale con Google Calendar. Quando un lead prenota un appuntamento via WhatsApp, 
                    l'evento viene automaticamente creato qui dall'AI bot.
                  </AlertDescription>
                </Alert>

                {/* Security Warning */}
                <Alert className="mb-6 bg-yellow-50 border-yellow-200 dark:bg-yellow-950 dark:border-yellow-800">
                  <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
                  <AlertDescription className="text-yellow-800 dark:text-yellow-300">
                    <strong>Attenzione Privacy:</strong> Per visualizzare il calendario qui, deve essere impostato come pubblico su Google Calendar. 
                    Questo significa che chiunque con il link può vedere i dettagli degli eventi. Assicurati che sia appropriato per il tuo caso d'uso.
                  </AlertDescription>
                </Alert>

                {/* Calendar Card */}
                <Card ref={calendarContainerRef} className={isFullscreen ? 'fixed inset-0 z-50 rounded-none' : ''}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <CalendarDays className="h-5 w-5" />
                          Google Calendar
                        </CardTitle>
                        <CardDescription>
                          Visualizzazione diretta del tuo calendario Google
                        </CardDescription>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={toggleFullscreen}
                          title={isFullscreen ? "Esci da schermo intero" : "Schermo intero"}
                        >
                          {isFullscreen ? (
                            <Minimize2 className="h-4 w-4" />
                          ) : (
                            <Maximize2 className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => window.open('https://calendar.google.com', '_blank')}
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          Apri in Google
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1">
                    <div className="w-full overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700" style={{ height: isFullscreen ? 'calc(100vh - 120px)' : '1080px' }}>
                      <iframe 
                        src={`https://calendar.google.com/calendar/embed?src=${calendarSrc}&ctz=Europe%2FRome&hl=it&mode=week&showCalendars=0&showTz=0&showPrint=0&showTitle=0`}
                        style={{ border: 0 }} 
                        width="100%" 
                        height="100%"
                        frameBorder="0" 
                        scrolling="no"
                        className="w-full h-full"
                      />
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
