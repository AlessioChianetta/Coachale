import { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Video,
  Plus,
  Trash2,
  BarChart3,
  Copy,
  Play,
  Calendar,
  Clock,
  Users,
  FileText,
  Check,
  Link2,
  Menu,
  Loader2,
  List,
  CalendarDays,
} from 'lucide-react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import '@fullcalendar/core/index.css';
import '@fullcalendar/daygrid/index.css';
import '@fullcalendar/timegrid/index.css';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';

interface VideoMeeting {
  id: string;
  sellerId: string;
  meetingToken: string;
  prospectName: string;
  prospectEmail?: string | null;
  playbookId?: string | null;
  scriptName?: string | null;
  scheduledAt: string;
  status: 'scheduled' | 'active' | 'completed' | 'in_progress' | 'cancelled';
  createdAt: string;
}

interface Script {
  id: string;
  name: string;
}

export default function ClientHumanSellerMeetings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<VideoMeeting | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');

  const [formData, setFormData] = useState({
    prospectName: '',
    prospectEmail: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    scriptId: '',
  });

  const { data: meetings = [], isLoading: meetingsLoading } = useQuery<VideoMeeting[]>({
    queryKey: ['/api/client/human-sellers/meetings'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/client/human-sellers/meetings', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch meetings');
      return res.json();
    }
  });

  const { data: scripts = [] } = useQuery<Script[]>({
    queryKey: ['/api/client/human-sellers/scripts'],
    queryFn: async () => {
      const token = localStorage.getItem('token');
      const res = await fetch('/api/client/human-sellers/scripts', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to fetch scripts');
      return res.json();
    }
  });

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { prospectName: string; prospectEmail?: string; scheduledAt: string; scriptId?: string }) => {
      const token = localStorage.getItem('token');
      const sellersRes = await fetch('/api/client/human-sellers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sellers = await sellersRes.json();
      if (!sellers || sellers.length === 0) {
        throw new Error('Nessun venditore configurato. Crea prima un venditore.');
      }
      const sellerId = sellers[0].id;
      
      const res = await fetch(`/api/client/human-sellers/${sellerId}/meetings`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          prospectName: data.prospectName,
          prospectEmail: data.prospectEmail,
          scheduledAt: data.scheduledAt,
          playbookId: data.scriptId || null
        })
      });
      if (!res.ok) throw new Error('Failed to create meeting');
      return res.json();
    },
    onSuccess: (newMeeting) => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/human-sellers/meetings'] });
      setGeneratedLink(getMeetingUrl(newMeeting.meetingToken));
      toast({
        title: '✅ Meeting creato!',
        description: 'Il meeting è stato creato con successo',
      });
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const deleteMeetingMutation = useMutation({
    mutationFn: async (meetingId: string) => {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/client/human-sellers/meetings/${meetingId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to delete meeting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/human-sellers/meetings'] });
      toast({
        title: '✅ Meeting eliminato',
        description: 'Il meeting è stato eliminato con successo',
      });
      setDeleteDialogOpen(false);
      setSelectedMeeting(null);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Errore',
        description: error.message,
        variant: 'destructive',
      });
    }
  });

  const getMeetingUrl = (meetingToken: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/meet/${meetingToken}`;
  };

  const copyToClipboard = (text: string, meetingId: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(meetingId);
    toast({
      title: '📋 Copiato!',
      description: 'Link meeting copiato negli appunti',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = (meeting: VideoMeeting) => {
    setSelectedMeeting(meeting);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (selectedMeeting) {
      deleteMeetingMutation.mutate(selectedMeeting.id);
    }
  };

  const handleCreateMeeting = () => {
    if (!formData.prospectName || !formData.scheduledDate || !formData.startTime) {
      toast({
        title: '❌ Errore',
        description: 'Compila i campi obbligatori: Nome prospect, Data e Ora inizio',
        variant: 'destructive',
      });
      return;
    }
    
    createMeetingMutation.mutate({
      prospectName: formData.prospectName,
      prospectEmail: formData.prospectEmail || undefined,
      scheduledAt: new Date(`${formData.scheduledDate}T${formData.startTime}`).toISOString(),
      scriptId: formData.scriptId || undefined
    });
  };

  const resetForm = () => {
    setFormData({
      prospectName: '',
      prospectEmail: '',
      scheduledDate: '',
      startTime: '',
      endTime: '',
      scriptId: '',
    });
    setGeneratedLink(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setCreateDialogOpen(true);
  };

  const getStatusBadge = (status: VideoMeeting['status']) => {
    switch (status) {
      case 'scheduled':
        return (
          <Badge className="bg-blue-500 hover:bg-blue-600">
            <Calendar className="h-3 w-3 mr-1" />
            Programmato
          </Badge>
        );
      case 'active':
      case 'in_progress':
        return (
          <Badge className="bg-green-500 hover:bg-green-600 animate-pulse">
            <Play className="h-3 w-3 mr-1" />
            In Corso
          </Badge>
        );
      case 'completed':
        return (
          <Badge variant="secondary" className="bg-gray-500 text-white">
            <Check className="h-3 w-3 mr-1" />
            Completato
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge variant="secondary" className="bg-red-500 text-white">
            Cancellato
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary">
            {status}
          </Badge>
        );
    }
  };

  const formatDateTime = (isoString: string | null) => {
    if (!isoString) return { date: 'N/A', time: '' };
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  const getStatusColor = (status: VideoMeeting['status']) => {
    switch (status) {
      case 'scheduled':
        return '#3b82f6';
      case 'active':
      case 'in_progress':
        return '#22c55e';
      case 'completed':
        return '#6b7280';
      case 'cancelled':
        return '#ef4444';
      default:
        return '#8b5cf6';
    }
  };

  const calendarEvents: EventInput[] = useMemo(() => {
    return meetings.map((meeting) => {
      const startDate = new Date(meeting.scheduledAt);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000);
      return {
        id: meeting.id,
        title: meeting.prospectName,
        start: startDate,
        end: endDate,
        backgroundColor: getStatusColor(meeting.status),
        borderColor: getStatusColor(meeting.status),
        extendedProps: {
          meeting,
        },
      };
    });
  }, [meetings]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const meeting = clickInfo.event.extendedProps.meeting as VideoMeeting;
    if (meeting.status === 'completed') {
      toast({
        title: '📊 Analytics',
        description: 'Funzionalità analytics in arrivo...',
      });
    } else if (meeting.status === 'cancelled') {
      toast({
        title: 'Meeting cancellato',
        description: 'Questo meeting è stato cancellato',
      });
    } else {
      window.open(getMeetingUrl(meeting.meetingToken), '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(true)}
                className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Video className="h-6 w-6 text-purple-600" />
                Video Meetings
              </h1>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    Gestisci i tuoi incontri video con i prospect
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                    <Button
                      size="sm"
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('list')}
                      className={`gap-1.5 ${viewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                    >
                      <List className="h-4 w-4" />
                      Lista
                    </Button>
                    <Button
                      size="sm"
                      variant={viewMode === 'calendar' ? 'default' : 'ghost'}
                      onClick={() => setViewMode('calendar')}
                      className={`gap-1.5 ${viewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}
                    >
                      <CalendarDays className="h-4 w-4" />
                      Calendario
                    </Button>
                  </div>
                  <Button
                    size="lg"
                    className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                    onClick={openCreateDialog}
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Nuovo Meeting
                  </Button>
                </div>
              </div>
            </motion.div>

            {meetingsLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
                <span className="ml-3 text-gray-600 dark:text-gray-400">Caricamento meetings...</span>
              </div>
            ) : meetings.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
                  <CardContent className="p-12 text-center">
                    <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
                      <Video className="h-12 w-12 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                      Nessun meeting programmato
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                      Crea il tuo primo video meeting per iniziare a vendere con il supporto AI in tempo reale
                    </p>
                    <Button
                      size="lg"
                      className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                      onClick={openCreateDialog}
                    >
                      <Plus className="h-5 w-5 mr-2" />
                      Crea Primo Meeting
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ) : viewMode === 'calendar' ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                  <CardContent className="p-4 sm:p-6">
                    <div className="mb-4 flex flex-wrap gap-3 text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-blue-500" />
                        <span className="text-gray-600 dark:text-gray-400">Programmato</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-gray-600 dark:text-gray-400">In Corso</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-gray-500" />
                        <span className="text-gray-600 dark:text-gray-400">Completato</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-gray-600 dark:text-gray-400">Cancellato</span>
                      </div>
                    </div>
                    <div className="fc-custom-styles">
                      <FullCalendar
                        plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                        initialView="timeGridWeek"
                        headerToolbar={{
                          left: 'prev,next today',
                          center: 'title',
                          right: 'dayGridMonth,timeGridWeek,timeGridDay',
                        }}
                        locale="it"
                        events={calendarEvents}
                        eventClick={handleEventClick}
                        height="auto"
                        slotMinTime="07:00:00"
                        slotMaxTime="21:00:00"
                        allDaySlot={false}
                        nowIndicator={true}
                        eventDisplay="block"
                        eventTimeFormat={{
                          hour: '2-digit',
                          minute: '2-digit',
                          meridiem: false,
                          hour12: false,
                        }}
                        slotLabelFormat={{
                          hour: '2-digit',
                          minute: '2-digit',
                          meridiem: false,
                          hour12: false,
                        }}
                        buttonText={{
                          today: 'Oggi',
                          month: 'Mese',
                          week: 'Settimana',
                          day: 'Giorno',
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {meetings.map((meeting, index) => {
                  const { date, time } = formatDateTime(meeting.scheduledAt);
                  return (
                    <motion.div
                      key={meeting.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                    >
                      <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 h-full group">
                        <CardContent className="p-6 flex flex-col h-full">
                          <div className="flex items-start justify-between mb-4">
                            <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${
                              meeting.status === 'active' || meeting.status === 'in_progress'
                                ? 'bg-gradient-to-br from-green-500 to-emerald-500' 
                                : meeting.status === 'completed'
                                ? 'bg-gradient-to-br from-gray-400 to-gray-500'
                                : 'bg-gradient-to-br from-purple-500 to-pink-500'
                            }`}>
                              <Video className="h-7 w-7 text-white" />
                            </div>
                            {getStatusBadge(meeting.status)}
                          </div>

                          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            {meeting.prospectName}
                          </h3>
                          
                          {meeting.prospectEmail && (
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                              {meeting.prospectEmail}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              {date}
                            </span>
                            {time && (
                              <span className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                {time}
                              </span>
                            )}
                          </div>

                          {meeting.scriptName && (
                            <div className="flex items-center gap-2 mb-4">
                              <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700">
                                <FileText className="h-3 w-3 mr-1" />
                                {meeting.scriptName}
                              </Badge>
                            </div>
                          )}

                          <div className="flex-grow" />

                          <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                              <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                              <input
                                type="text"
                                value={getMeetingUrl(meeting.meetingToken)}
                                readOnly
                                className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none truncate"
                              />
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => copyToClipboard(getMeetingUrl(meeting.meetingToken), meeting.id)}
                                className="h-7 w-7 p-0"
                              >
                                {copiedId === meeting.id ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3" />
                                )}
                              </Button>
                            </div>
                          </div>

                          <div className="grid grid-cols-3 gap-2">
                            <Button
                              size="sm"
                              variant={meeting.status === 'active' || meeting.status === 'in_progress' ? 'default' : 'outline'}
                              onClick={() => {
                                if (meeting.status === 'completed') {
                                  toast({
                                    title: 'Meeting completato',
                                    description: 'Questo meeting è già terminato',
                                  });
                                } else {
                                  window.open(getMeetingUrl(meeting.meetingToken), '_blank');
                                }
                              }}
                              className={`text-xs ${meeting.status === 'active' || meeting.status === 'in_progress' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                              disabled={meeting.status === 'completed' || meeting.status === 'cancelled'}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {meeting.status === 'active' || meeting.status === 'in_progress' ? 'Entra' : 'Avvia'}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                toast({
                                  title: '📊 Analytics',
                                  description: 'Funzionalità analytics in arrivo...',
                                });
                              }}
                              className="text-xs"
                              disabled={meeting.status !== 'completed'}
                            >
                              <BarChart3 className="h-3 w-3 mr-1" />
                              Analytics
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDelete(meeting)}
                              className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="h-3 w-3 mr-1" />
                              Elimina
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Video className="h-5 w-5 text-purple-600" />
              Nuovo Video Meeting
            </DialogTitle>
            <DialogDescription>
              Programma un nuovo incontro video con un prospect
            </DialogDescription>
          </DialogHeader>

          {generatedLink ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                  ✅ Meeting creato con successo!
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">
                  Condividi questo link con il prospect:
                </p>
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border">
                  <input
                    type="text"
                    value={generatedLink}
                    readOnly
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      navigator.clipboard.writeText(generatedLink);
                      toast({
                        title: '📋 Copiato!',
                        description: 'Link meeting copiato negli appunti',
                      });
                    }}
                  >
                    <Copy className="h-4 w-4 mr-1" />
                    Copia
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Chiudi
                </Button>
                <Button onClick={() => {
                  resetForm();
                }}>
                  <Plus className="h-4 w-4 mr-1" />
                  Crea Altro
                </Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="prospectName">Nome Prospect *</Label>
                  <Input
                    id="prospectName"
                    placeholder="es. Marco Rossi"
                    value={formData.prospectName}
                    onChange={(e) => setFormData({ ...formData, prospectName: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="prospectEmail">Email Prospect (opzionale)</Label>
                  <Input
                    id="prospectEmail"
                    type="email"
                    placeholder="es. marco.rossi@example.com"
                    value={formData.prospectEmail}
                    onChange={(e) => setFormData({ ...formData, prospectEmail: e.target.value })}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Data *</Label>
                    <Input
                      id="scheduledDate"
                      type="date"
                      value={formData.scheduledDate}
                      onChange={(e) => setFormData({ ...formData, scheduledDate: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Ora Inizio *</Label>
                    <Input
                      id="startTime"
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="endTime">Ora Fine (opzionale)</Label>
                  <Input
                    id="endTime"
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="script">Script/Playbook</Label>
                  <Select
                    value={formData.scriptId}
                    onValueChange={(value) => setFormData({ ...formData, scriptId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Seleziona uno script..." />
                    </SelectTrigger>
                    <SelectContent>
                      {scripts.map((script) => (
                        <SelectItem key={script.id} value={script.id}>
                          {script.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={handleCreateMeeting}
                  disabled={createMeetingMutation.isPending}
                  className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {createMeetingMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-1" />
                  )}
                  Crea Meeting
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il meeting con <strong>{selectedMeeting?.prospectName}</strong>.
              Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMeetingMutation.isPending}
            >
              {deleteMeetingMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
