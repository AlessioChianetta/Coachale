import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, FileText, ChevronLeft, ChevronDown, ChevronUp, Menu, ArrowLeft } from 'lucide-react';
import { useLocation } from 'wouter';
import { getToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface Consultation {
  id: string;
  scheduledFor: string;
  status: string;
  completedAt: string | null;
  maxDurationMinutes: number;
  fullTranscript: string | null;
  conversationId: string | null;
}

export default function AIConsultationsHistory() {
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const { toast } = useToast();

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const token = getToken();
      const response = await fetch('/api/consultations/ai/history', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setConsultations(data);
      } else {
        toast({
          title: 'Errore',
          description: 'Impossibile caricare lo storico consulenze',
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Errore di connessione',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('it-IT', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    }
    return `${mins}m`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Header with menu button */}
          <div className="sticky top-0 z-30 bg-gray-900/80 backdrop-blur-md border-b border-white/10">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="text-white/70 hover:text-white hover:bg-white/10 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocation('/client/ai-assistant')}
                className="text-white/70 hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                AI Assistant
              </Button>
              <h1 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-purple-400" />
                Storico Consulenze
              </h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto p-4 sm:p-8">

        {loading ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center text-white/70">
              Caricamento...
            </CardContent>
          </Card>
        ) : consultations.length === 0 ? (
          <Card className="bg-white/5 border-white/10">
            <CardContent className="p-8 text-center">
              <p className="text-white/70 text-lg">
                Nessuna consulenza completata al momento.
              </p>
              <p className="text-white/50 text-sm mt-2">
                Le tue consulenze settimanali appariranno qui dopo il completamento.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {consultations.map((consultation) => (
              <Card
                key={consultation.id}
                className="bg-white/5 border-white/10 hover:bg-white/10 transition-all duration-300"
              >
                <CardHeader>
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-white flex items-center gap-2 mb-2">
                          <Calendar className="h-5 w-5 text-purple-400" />
                          {formatDate(consultation.scheduledFor)}
                        </CardTitle>
                        
                        <div className="flex flex-wrap gap-3 text-sm text-white/60">
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            Durata: {formatDuration(consultation.maxDurationMinutes)}
                          </div>
                          {consultation.completedAt && (
                            <div className="text-green-400">
                              ✓ Completata
                            </div>
                          )}
                        </div>
                      </div>

                      {consultation.fullTranscript && (
                        <Button
                          onClick={() => setExpandedId(
                            expandedId === consultation.id ? null : consultation.id
                          )}
                          className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-200 border border-purple-500/40 flex-shrink-0"
                          size="sm"
                        >
                          {expandedId === consultation.id ? (
                            <>
                              <ChevronUp className="h-4 w-4 mr-1" />
                              Nascondi trascrizione
                            </>
                          ) : (
                            <>
                              <ChevronDown className="h-4 w-4 mr-1" />
                              Visualizza trascrizione
                            </>
                          )}
                        </Button>
                      )}
                    </div>

                    {!expandedId && consultation.fullTranscript && (
                      <div className="bg-white/5 rounded-lg p-3 border border-white/10 text-sm text-white/70 line-clamp-2">
                        <span className="text-white/50 text-xs">📄 Preview: </span>
                        {consultation.fullTranscript.substring(0, 150)}...
                      </div>
                    )}
                  </div>
                </CardHeader>

                {expandedId === consultation.id && consultation.fullTranscript && (
                  <CardContent className="border-t border-white/10 pt-4">
                    <div className="flex items-center gap-2 mb-3 text-white/70">
                      <FileText className="h-4 w-4" />
                      <span className="text-sm font-medium">Trascrizione Completa</span>
                    </div>
                    
                    <div className="bg-black/30 rounded-lg p-4 max-h-96 overflow-y-auto">
                      <pre className="text-sm text-white/80 whitespace-pre-wrap font-sans">
                        {consultation.fullTranscript}
                      </pre>
                    </div>

                    {consultation.conversationId && (
                      <div className="mt-4">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/client/ai-assistant?conversation=${consultation.conversationId}`)}
                          className="bg-white/5 border-white/20 text-white hover:bg-white/10"
                        >
                          Visualizza conversazione completa →
                        </Button>
                      </div>
                    )}
                  </CardContent>
                )}
              </Card>
            ))}
          </div>
        )}
          </div>
        </div>
      </div>
    </div>
  );
}
