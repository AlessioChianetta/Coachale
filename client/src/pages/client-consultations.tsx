import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, User, FileText, CheckCircle, XCircle, CalendarDays, Star, MessageSquare, Users, AlertCircle, Video, ExternalLink, Timer, MessageCircle, Sparkles, BookOpen, ChevronDown, ChevronUp, Menu } from "lucide-react";
import { format, isToday, isFuture, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns";
import it from "date-fns/locale/it";
import Sidebar from "@/components/sidebar";
import { getAuthHeaders, getAuthUser } from "@/lib/auth";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, useMemo, useEffect } from "react";
import { AIAssistant } from "@/components/ai-assistant/AIAssistant";
import { usePageContext } from "@/hooks/use-page-context";
import ClientStateDashboard from "@/components/client-state-dashboard";
import ClientConsultationTasksViewer from "@/components/client-consultation-tasks-viewer";
import { useLocation } from "wouter";

function CountdownTimer({ scheduledAt }: { scheduledAt: Date }) {
  const [timeLeft, setTimeLeft] = useState<string>("");

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date();
      const target = new Date(scheduledAt);
      const diffMs = target.getTime() - now.getTime();

      if (diffMs <= 0) {
        return "In corso!";
      }

      const hours = Math.floor(diffMs / (1000 * 60 * 60));
      const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

      if (hours > 0) {
        return `Tra ${hours}h ${minutes}m`;
      } else if (minutes > 0) {
        return `Tra ${minutes}m ${seconds}s`;
      } else {
        return `Tra ${seconds}s`;
      }
    };

    setTimeLeft(calculateTimeLeft());
    const interval = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(interval);
  }, [scheduledAt]);

  const now = new Date();
  const target = new Date(scheduledAt);
  const hoursUntil = differenceInHours(target, now);
  
  if (hoursUntil > 24) return null;

  const isUrgent = hoursUntil < 1;

  return (
    <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold shadow-lg animate-pulse ${
      isUrgent 
        ? 'bg-gradient-to-r from-red-500 to-orange-500 text-white' 
        : 'bg-gradient-to-r from-blue-500 to-indigo-500 text-white'
    }`}>
      <Timer className="w-5 h-5" />
      <span className="text-lg">{timeLeft}</span>
    </div>
  );
}

export default function ClientConsultations() {
  const pageContext = usePageContext();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set());
  const [expandedNotes, setExpandedNotes] = useState<Set<string>>(new Set());
  const isMobile = useIsMobile();
  const user = getAuthUser();

  const toggleTranscript = (consultationId: string) => {
    setExpandedTranscripts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(consultationId)) {
        newSet.delete(consultationId);
      } else {
        newSet.add(consultationId);
      }
      return newSet;
    });
  };

  const toggleNotes = (consultationId: string) => {
    setExpandedNotes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(consultationId)) {
        newSet.delete(consultationId);
      } else {
        newSet.add(consultationId);
      }
      return newSet;
    });
  };

  const { data: consultations = [], isLoading } = useQuery({
    queryKey: ["/api/consultations/client"],
    retry: 1,
  });

  const consultantId = useMemo(() => {
    if (Array.isArray(consultations) && consultations.length > 0) {
      return consultations[0]?.consultant?.id || "";
    }
    return "";
  }, [consultations]);

  const getStatusBadge = (status: string) => {
    const config = {
      scheduled: {
        label: "Programmato",
        icon: CalendarDays,
        color: "bg-blue-500 text-white"
      },
      completed: {
        label: "Completato",
        icon: CheckCircle,
        color: "bg-green-500 text-white"
      },
      cancelled: {
        label: "Cancellato",
        icon: XCircle,
        color: "bg-red-500 text-white"
      },
    };

    const statusConfig = config[status as keyof typeof config] || config.scheduled;
    const IconComponent = statusConfig.icon;

    return (
      <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${statusConfig.color} shadow-sm`}>
        <IconComponent className="w-3.5 h-3.5" />
        {statusConfig.label}
      </div>
    );
  };

  const getUpcomingConsultations = () => {
    const now = new Date();
    return (consultations as any[]).filter((consultation: any) =>
      new Date(consultation.scheduledAt) > now && consultation.status === 'scheduled'
    ).sort((a: any, b: any) =>
      new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
  };

  const getPastConsultations = () => {
    const now = new Date();
    return (consultations as any[]).filter((consultation: any) =>
      new Date(consultation.scheduledAt) <= now || consultation.status !== 'scheduled'
    ).sort((a: any, b: any) =>
      new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
  };

  const getTodayConsultations = () => {
    return (consultations as any[]).filter((consultation: any) =>
      isToday(new Date(consultation.scheduledAt)) && consultation.status === 'scheduled'
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="flex h-screen">
          <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
          <div className="flex-1 p-6 overflow-y-auto flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
              <p className="mt-4 text-muted-foreground font-medium">Caricamento consulenze...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const upcomingConsultations = getUpcomingConsultations();
  const pastConsultations = getPastConsultations();
  const todayConsultations = getTodayConsultations();

  return (
    <div className="min-h-screen bg-background" data-testid="client-consultations-page">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex-1 overflow-y-auto">
          {/* Header pulito e minimale */}
          <div className="sticky top-0 z-10 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-800">
            <div className="px-6 py-4">
              <div className="flex items-center gap-3 justify-between">
                <div className="flex items-center gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setSidebarOpen(true)}
                    className="h-11 w-11 min-h-[44px] min-w-[44px] hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                  <div>
                    <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
                      Consulenze
                    </h1>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Gestisci le tue sessioni e il tuo percorso di crescita
                    </p>
                  </div>
                </div>
                
                {/* Stats compatte */}
                <div className="hidden md:flex items-center gap-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900 dark:text-white">
                      {(consultations as any[]).length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Totali</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {upcomingConsultations.length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Prossime</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                      {todayConsultations.length}
                    </div>
                    <div className="text-xs text-gray-600 dark:text-gray-400">Oggi</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-8">
            {/* Stats mobile */}
            <div className="md:hidden grid grid-cols-3 gap-4">
              <Card className="border border-gray-200 dark:border-gray-800">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {(consultations as any[]).length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Totali</div>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 dark:border-gray-800">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {upcomingConsultations.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Prossime</div>
                </CardContent>
              </Card>
              <Card className="border border-gray-200 dark:border-gray-800">
                <CardContent className="p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                    {todayConsultations.length}
                  </div>
                  <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">Oggi</div>
                </CardContent>
              </Card>
            </div>

            {/* Client State Dashboard */}
            <div>
              <ClientStateDashboard 
                clientId={user?.id || ""} 
                consultantId={consultantId || ""} 
                readonly={true} 
              />
            </div>

            {/* Consultation Tasks */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <CheckCircle className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Le Mie Task</h2>
              </div>
              <ClientConsultationTasksViewer clientId={user?.id || ""} />
            </div>

            {/* Prossime consulenze */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Prossime Consulenze</h2>
                {upcomingConsultations.length > 0 && (
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-0">
                    {upcomingConsultations.length}
                  </Badge>
                )}
              </div>

              {upcomingConsultations.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200 dark:border-gray-800">
                  <CardContent className="p-12 text-center">
                    <Calendar className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Nessuna consulenza programmata
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 max-w-md mx-auto">
                      Le tue prossime consulenze appariranno qui. Contatta il tuo consulente per programmare un appuntamento.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  {upcomingConsultations.map((consultation: any) => (
                    <Card 
                      key={consultation.id}
                      className="border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
                      data-testid={`card-upcoming-consultation-${consultation.id}`}
                    >
                      <CardHeader className="pb-4">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-4">
                              <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                                <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <CardTitle className="text-base font-semibold text-gray-900 dark:text-white">
                                  Consulenza con {consultation.consultant.firstName} {consultation.consultant.lastName}
                                </CardTitle>
                                <p className="text-sm text-gray-600 dark:text-gray-400">Sessione individuale</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <Calendar className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Data</p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {format(new Date(consultation.scheduledAt), "EEEE dd MMMM yyyy", { locale: it })}
                                  </p>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                                <Clock className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                                <div className="flex-1">
                                  <p className="text-xs text-gray-600 dark:text-gray-400">Orario</p>
                                  <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {format(new Date(consultation.scheduledAt), "HH:mm")} • {consultation.duration} min
                                  </p>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mb-4">
                              {getStatusBadge(consultation.status)}
                            </div>

                            <div className="mt-4">
                              <CountdownTimer scheduledAt={new Date(consultation.scheduledAt)} />
                            </div>

                            {isToday(new Date(consultation.scheduledAt)) && (
                              <div className="mt-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                                <div className="flex items-center gap-2">
                                  <Star className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                                  <span className="font-semibold text-orange-800 dark:text-orange-300">Consulenza di oggi!</span>
                                </div>
                              </div>
                            )}

                            {(consultation.googleMeetLink || consultation.fathomShareLink) && (
                              <div className="mt-4 flex flex-wrap gap-3">
                                {consultation.googleMeetLink && (
                                  <a 
                                    href={consultation.googleMeetLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                                  >
                                    <Video className="w-4 h-4" />
                                    <span>Unisciti su Google Meet</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                                {consultation.fathomShareLink && (
                                  <a 
                                    href={consultation.fathomShareLink} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                                  >
                                    <Video className="w-4 h-4" />
                                    <span>Rivedi Consulenza & AI</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </CardHeader>

                      {consultation.notes && (
                        <CardContent className="pt-0">
                          <button
                            onClick={() => toggleNotes(consultation.id)}
                            className="w-full flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
                          >
                            <div className="flex items-center gap-2">
                              <MessageSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              <span className="font-semibold text-sm text-blue-900 dark:text-blue-100">
                                Note della consulenza
                              </span>
                            </div>
                            {expandedNotes.has(consultation.id) ? (
                              <ChevronUp className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <ChevronDown className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            )}
                          </button>
                          
                          {expandedNotes.has(consultation.id) && (
                            <div className="mt-2 p-4 bg-white dark:bg-gray-950 rounded-lg border border-blue-200 dark:border-blue-800" data-testid={`text-notes-${consultation.id}`}>
                              <div className="text-sm text-blue-900 dark:text-blue-100 space-y-2">
                                {consultation.notes.split('\n').map((line: string, index: number) => {
                                  if (line.includes('PROMEMORIA:')) {
                                    return (
                                      <div key={index} className="flex items-start gap-1.5 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                                        <AlertCircle className="w-3.5 h-3.5 text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5" />
                                        <p className="text-yellow-800 dark:text-yellow-200 text-xs font-medium">
                                          {line.replace('PROMEMORIA:', '').trim()}
                                        </p>
                                      </div>
                                    );
                                  }
                                  return line && <p key={index} className="leading-relaxed">{line}</p>;
                                })}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Consulenze passate */}
            <div>
              <div className="flex items-center gap-3 mb-4">
                <FileText className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Storico Consulenze</h2>
                {pastConsultations.length > 0 && (
                  <Badge className="bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border-0">
                    {pastConsultations.length}
                  </Badge>
                )}
              </div>

              {pastConsultations.length === 0 ? (
                <Card className="border-2 border-dashed border-gray-200 dark:border-gray-800">
                  <CardContent className="p-12 text-center">
                    <FileText className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Nessuna consulenza passata</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Lo storico delle tue consulenze apparirà qui dopo i tuoi primi appuntamenti.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {pastConsultations.map((consultation: any) => {
                    const isCompleted = consultation.status === 'completed';
                    const isCancelled = consultation.status === 'cancelled';

                    return (
                      <Card 
                        key={consultation.id}
                        className="border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow"
                        data-testid={`card-past-consultation-${consultation.id}`}
                      >
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                              <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                {format(new Date(consultation.scheduledAt), "dd MMM yyyy", { locale: it })}
                              </span>
                            </div>
                            {getStatusBadge(consultation.status)}
                          </div>

                          <div className="flex items-center gap-2 mb-3">
                            <div className={`p-2 rounded-lg ${
                              isCompleted
                                ? 'bg-emerald-100 dark:bg-emerald-900/30'
                                : isCancelled
                                ? 'bg-red-100 dark:bg-red-900/30'
                                : 'bg-gray-100 dark:bg-gray-800'
                            }`}>
                              <User className={`w-4 h-4 ${
                                isCompleted
                                  ? 'text-emerald-600 dark:text-emerald-400'
                                  : isCancelled
                                  ? 'text-red-600 dark:text-red-400'
                                  : 'text-gray-600 dark:text-gray-400'
                              }`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-sm text-gray-900 dark:text-white truncate">
                                {consultation.consultant.firstName} {consultation.consultant.lastName}
                              </h3>
                              <p className="text-xs text-gray-600 dark:text-gray-400">Consulente</p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                            <Clock className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                            <div>
                              <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                {format(new Date(consultation.scheduledAt), "HH:mm")}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {consultation.duration} minuti
                              </p>
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="pt-0 space-y-3">
                          {(consultation.googleMeetLink || consultation.fathomShareLink) && (
                            <div className="space-y-2">
                              {consultation.fathomShareLink && (
                                <a 
                                  href={consultation.fathomShareLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors text-sm font-medium"
                                >
                                  <Video className="w-4 h-4" />
                                  <span>Rivedi Consulenza</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                              {consultation.googleMeetLink && (
                                <a 
                                  href={consultation.googleMeetLink} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm font-medium border border-gray-300 dark:border-gray-600"
                                >
                                  <Video className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  <span>Google Meet</span>
                                </a>
                              )}
                            </div>
                          )}

                          {consultation.notes && (
                            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <p className="font-semibold text-xs text-amber-900 dark:text-amber-100 mb-1">Note</p>
                                  <div className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                                    {consultation.notes.split('\n').map((line: string, index: number) => {
                                      if (line.includes('PROMEMORIA:')) {
                                        return (
                                          <div key={index} className="flex items-start gap-1.5 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded border border-yellow-300 dark:border-yellow-700">
                                            <AlertCircle className="w-3.5 h-3.5 text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5" />
                                            <p className="text-yellow-800 dark:text-yellow-200 text-xs font-medium">
                                              {line.replace('PROMEMORIA:', '').trim()}
                                            </p>
                                          </div>
                                        );
                                      }
                                      return line && <p key={index} className="leading-relaxed">{line}</p>;
                                    })}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}

                          {consultation.transcript && (
                            <div>
                              <button
                                onClick={() => toggleTranscript(consultation.id)}
                                className="w-full flex items-center justify-between p-3 bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                              >
                                <div className="flex items-center gap-2">
                                  <BookOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                  <span className="font-semibold text-sm text-purple-900 dark:text-purple-100">
                                    Trascrizione Fathom
                                  </span>
                                </div>
                                {expandedTranscripts.has(consultation.id) ? (
                                  <ChevronUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                )}
                              </button>
                              
                              {expandedTranscripts.has(consultation.id) && (
                                <div className="mt-2 p-4 bg-white dark:bg-gray-950 rounded-lg border border-purple-200 dark:border-purple-800 max-h-64 overflow-y-auto">
                                  <pre className="text-xs leading-relaxed text-purple-900 dark:text-purple-100 whitespace-pre-wrap font-mono">
                                    {consultation.transcript}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}

                          {isCompleted && (
                            <div className="flex items-center gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-lg">
                              <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                              <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100">
                                Obiettivi raggiunti e discussi
                              </p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <AIAssistant pageContext={pageContext} />
    </div>
  );
}
