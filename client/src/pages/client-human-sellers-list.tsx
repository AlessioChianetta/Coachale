import { useState, useMemo, lazy, Suspense } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventInput, EventClickArg } from '@fullcalendar/core';
import {
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';
import {
  Users,
  Plus,
  Trash2,
  Edit,
  BarChart3,
  Power,
  PowerOff,
  Video,
  Menu,
  Calendar,
  Clock,
  FileText,
  Link2,
  Copy,
  Play,
  Check,
  Loader2,
  List,
  CalendarDays,
  TrendingUp,
  ThumbsUp,
  AlertTriangle,
  PieChart,
  User,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { getAuthHeaders } from '@/lib/auth';

interface HumanSeller {
  id: string;
  sellerName: string;
  displayName: string;
  description: string | null;
  isActive: boolean;
  clientId: string;
  createdAt: string;
  updatedAt: string;
  meetingsCount?: number;
}

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

interface SellerOverview {
  sellerId: string;
  sellerName: string;
  displayName: string;
  totalMeetings: number;
  avgBuySignals: number;
  avgScriptAdherence: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
}

interface OverviewData {
  totalMeetings: number;
  totalBuySignals: number;
  totalObjections: number;
  avgScriptAdherence: number;
  wonDeals: number;
  lostDeals: number;
  conversionRate: number;
  sellers: SellerOverview[];
}

export default function ClientHumanSellersList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<HumanSeller | null>(null);
  const [activeTab, setActiveTab] = useState('sellers');
  
  const [createMeetingDialogOpen, setCreateMeetingDialogOpen] = useState(false);
  const [deleteMeetingDialogOpen, setDeleteMeetingDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<VideoMeeting | null>(null);
  const [generatedMeetingLink, setGeneratedMeetingLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [meetingViewMode, setMeetingViewMode] = useState<'list' | 'calendar'>('list');
  const [meetingFormData, setMeetingFormData] = useState({
    prospectName: '',
    prospectEmail: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    scriptId: '',
  });

  const { data: sellers = [], isLoading, refetch } = useQuery<HumanSeller[]>({
    queryKey: ['/api/client/human-sellers'],
    queryFn: async () => {
      const res = await fetch('/api/client/human-sellers', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Errore nel caricamento');
      return res.json();
    },
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
    },
    enabled: activeTab === 'meetings',
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
    },
    enabled: activeTab === 'meetings',
  });

  const { data: overviewData, isLoading: overviewLoading } = useQuery<OverviewData>({
    queryKey: ['/api/client/human-sellers/analytics/overview'],
    queryFn: async () => {
      const response = await fetch('/api/client/human-sellers/analytics/overview', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch overview');
      return response.json();
    },
    enabled: activeTab === 'analytics',
  });

  const handleDelete = (seller: HumanSeller) => {
    setSelectedSeller(seller);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (selectedSeller) {
      try {
        const res = await fetch(`/api/client/human-sellers/${selectedSeller.id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
          },
        });
        if (!res.ok) throw new Error('Errore eliminazione');
        toast({
          title: 'Venditore eliminato',
          description: `Il venditore "${selectedSeller.sellerName}" è stato eliminato con successo`,
        });
        refetch();
      } catch (error) {
        toast({
          title: 'Errore',
          description: 'Impossibile eliminare il venditore',
          variant: 'destructive',
        });
      }
      setDeleteDialogOpen(false);
      setSelectedSeller(null);
    }
  };

  const handleToggleActive = async (seller: HumanSeller) => {
    try {
      const res = await fetch(`/api/client/human-sellers/${seller.id}/toggle`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
        },
      });
      if (!res.ok) throw new Error('Errore toggle');
      toast({
        title: 'Stato aggiornato',
        description: `Lo stato del venditore è stato ${seller.isActive ? 'disattivato' : 'attivato'}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: 'Errore',
        description: 'Impossibile aggiornare lo stato',
        variant: 'destructive',
      });
    }
  };

  const createMeetingMutation = useMutation({
    mutationFn: async (data: { prospectName: string; prospectEmail?: string; scheduledAt: string; scriptId?: string }) => {
      const token = localStorage.getItem('token');
      const sellersRes = await fetch('/api/client/human-sellers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const sellersData = await sellersRes.json();
      if (!sellersData || sellersData.length === 0) {
        throw new Error('Nessun venditore configurato. Crea prima un venditore.');
      }
      const sellerId = sellersData[0].id;
      
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
      setGeneratedMeetingLink(getMeetingUrl(newMeeting.meetingToken));
      toast({
        title: 'Meeting creato!',
        description: 'Il meeting è stato creato con successo',
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
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
        title: 'Meeting eliminato',
        description: 'Il meeting è stato eliminato con successo',
      });
      setDeleteMeetingDialogOpen(false);
      setSelectedMeeting(null);
    },
    onError: (error: Error) => {
      toast({
        title: 'Errore',
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
      title: 'Copiato!',
      description: 'Link meeting copiato negli appunti',
    });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDeleteMeeting = (meeting: VideoMeeting) => {
    setSelectedMeeting(meeting);
    setDeleteMeetingDialogOpen(true);
  };

  const handleCreateMeeting = () => {
    if (!meetingFormData.prospectName || !meetingFormData.scheduledDate || !meetingFormData.startTime) {
      toast({
        title: 'Errore',
        description: 'Compila i campi obbligatori: Nome prospect, Data e Ora inizio',
        variant: 'destructive',
      });
      return;
    }
    
    createMeetingMutation.mutate({
      prospectName: meetingFormData.prospectName,
      prospectEmail: meetingFormData.prospectEmail || undefined,
      scheduledAt: new Date(`${meetingFormData.scheduledDate}T${meetingFormData.startTime}`).toISOString(),
      scriptId: meetingFormData.scriptId || undefined
    });
  };

  const resetMeetingForm = () => {
    setMeetingFormData({
      prospectName: '',
      prospectEmail: '',
      scheduledDate: '',
      startTime: '',
      endTime: '',
      scriptId: '',
    });
    setGeneratedMeetingLink(null);
  };

  const getStatusBadge = (status: VideoMeeting['status']) => {
    switch (status) {
      case 'scheduled':
        return <Badge className="bg-blue-500 hover:bg-blue-600"><Calendar className="h-3 w-3 mr-1" />Programmato</Badge>;
      case 'active':
      case 'in_progress':
        return <Badge className="bg-green-500 hover:bg-green-600 animate-pulse"><Play className="h-3 w-3 mr-1" />In Corso</Badge>;
      case 'completed':
        return <Badge variant="secondary" className="bg-gray-500 text-white"><Check className="h-3 w-3 mr-1" />Completato</Badge>;
      case 'cancelled':
        return <Badge variant="secondary" className="bg-red-500 text-white">Cancellato</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
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
      case 'scheduled': return '#3b82f6';
      case 'active':
      case 'in_progress': return '#22c55e';
      case 'completed': return '#6b7280';
      case 'cancelled': return '#ef4444';
      default: return '#8b5cf6';
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
        extendedProps: { meeting },
      };
    });
  }, [meetings]);

  const handleEventClick = (clickInfo: EventClickArg) => {
    const meeting = clickInfo.event.extendedProps.meeting as VideoMeeting;
    if (meeting.status === 'completed') {
      toast({ title: 'Analytics', description: 'Funzionalità analytics in arrivo...' });
    } else if (meeting.status === 'cancelled') {
      toast({ title: 'Meeting cancellato', description: 'Questo meeting è stato cancellato' });
    } else {
      window.open(getMeetingUrl(meeting.meetingToken), '_blank');
    }
  };

  const outcomeChartData = useMemo(() => {
    if (!overviewData) return [];
    return [
      { name: 'Vinti', value: overviewData.wonDeals, color: '#22c55e' },
      { name: 'Persi', value: overviewData.lostDeals, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [overviewData]);

  const sellerComparisonData = useMemo(() => {
    if (!overviewData?.sellers) return [];
    return overviewData.sellers.map(seller => ({
      name: seller.displayName || seller.sellerName,
      conversione: Math.round(seller.conversionRate),
      script: Math.round(seller.avgScriptAdherence),
      meetings: seller.totalMeetings,
    }));
  }, [overviewData]);

  const statsCards = [
    { title: 'Meeting Totali', value: overviewData?.totalMeetings ?? 0, icon: <Video className="h-5 w-5" />, gradient: 'from-purple-500 to-violet-600' },
    { title: 'Tasso Conversione', value: `${(overviewData?.conversionRate ?? 0).toFixed(1)}%`, icon: <TrendingUp className="h-5 w-5" />, gradient: 'from-violet-500 to-purple-600' },
    { title: 'Aderenza Script', value: `${(overviewData?.avgScriptAdherence ?? 0).toFixed(1)}%`, icon: <FileText className="h-5 w-5" />, gradient: 'from-fuchsia-500 to-pink-600' },
    { title: 'Buy Signals', value: overviewData?.totalBuySignals ?? 0, icon: <ThumbsUp className="h-5 w-5" />, gradient: 'from-purple-600 to-violet-700' },
  ];

  const SellersListContent = () => (
    <>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg text-gray-600 dark:text-gray-400">Gestisci i tuoi venditori per le video consulenze</p>
          <Button
            size="lg"
            className="bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white shadow-lg"
            onClick={() => setLocation('/client/human-sellers/new')}
          >
            <Plus className="h-5 w-5 mr-2" />
            Nuovo Venditore
          </Button>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="bg-white dark:bg-gray-800 animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : sellers.length === 0 ? (
        <Card className="bg-white dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-violet-500/20 flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
              <Users className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Nessun venditore creato</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
              Aggiungi il tuo primo venditore per iniziare a gestire le video consulenze
            </p>
            <Button
              size="lg"
              className="bg-gradient-to-br from-purple-600 to-violet-600 hover:from-purple-700 hover:to-violet-700 text-white"
              onClick={() => setLocation('/client/human-sellers/new')}
            >
              <Plus className="h-5 w-5 mr-2" />
              Crea Primo Venditore
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sellers.map((seller, index) => (
            <motion.div key={seller.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
              <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 h-full group">
                <CardContent className="p-6 flex flex-col h-full">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                      <Users className="h-7 w-7 text-white" />
                    </div>
                    <Badge variant={seller.isActive ? 'default' : 'secondary'} className={seller.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'}>
                      {seller.isActive ? <><Power className="h-3 w-3 mr-1" />Attivo</> : <><PowerOff className="h-3 w-3 mr-1" />Inattivo</>}
                    </Badge>
                  </div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">{seller.sellerName}</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{seller.displayName}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">Creato il {new Date(seller.createdAt).toLocaleDateString('it-IT')}</p>
                  <div className="flex-grow" />
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/client/human-sellers/${seller.id}`)} className="text-xs">
                      <Edit className="h-3 w-3 mr-1" />Modifica
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/client/human-sellers/${seller.id}/analytics`)} className="text-xs">
                      <BarChart3 className="h-3 w-3 mr-1" />Analytics
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => handleToggleActive(seller)} className="text-xs" title={seller.isActive ? 'Disattiva' : 'Attiva'}>
                      {seller.isActive ? <PowerOff className="h-3 w-3 mr-1" /> : <Power className="h-3 w-3 mr-1" />}
                      {seller.isActive ? 'Disattiva' : 'Attiva'}
                    </Button>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(seller)} className="w-full text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="h-3 w-3 mr-1" />Elimina Venditore
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </>
  );

  const MeetingsContent = () => (
    <>
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <p className="text-lg text-gray-600 dark:text-gray-400">Gestisci i tuoi incontri video con i prospect</p>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
              <Button size="sm" variant={meetingViewMode === 'list' ? 'default' : 'ghost'} onClick={() => setMeetingViewMode('list')} className={`gap-1.5 ${meetingViewMode === 'list' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                <List className="h-4 w-4" />Lista
              </Button>
              <Button size="sm" variant={meetingViewMode === 'calendar' ? 'default' : 'ghost'} onClick={() => setMeetingViewMode('calendar')} className={`gap-1.5 ${meetingViewMode === 'calendar' ? 'bg-white dark:bg-gray-700 shadow-sm' : ''}`}>
                <CalendarDays className="h-4 w-4" />Calendario
              </Button>
            </div>
            <Button size="lg" className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg" onClick={() => { resetMeetingForm(); setCreateMeetingDialogOpen(true); }}>
              <Plus className="h-5 w-5 mr-2" />Nuovo Meeting
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
        <Card className="bg-white dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
          <CardContent className="p-12 text-center">
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-purple-500/20 to-pink-500/20 flex items-center justify-center mx-auto mb-6 border border-purple-500/30">
              <Video className="h-12 w-12 text-purple-600 dark:text-purple-400" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Nessun meeting programmato</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">Crea il tuo primo video meeting per iniziare a vendere con il supporto AI in tempo reale</p>
            <Button size="lg" className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white" onClick={() => { resetMeetingForm(); setCreateMeetingDialogOpen(true); }}>
              <Plus className="h-5 w-5 mr-2" />Crea Primo Meeting
            </Button>
          </CardContent>
        </Card>
      ) : meetingViewMode === 'calendar' ? (
        <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          <CardContent className="p-4 sm:p-6">
            <div className="mb-4 flex flex-wrap gap-3 text-sm">
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-blue-500" /><span className="text-gray-600 dark:text-gray-400">Programmato</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-green-500" /><span className="text-gray-600 dark:text-gray-400">In Corso</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-gray-500" /><span className="text-gray-600 dark:text-gray-400">Completato</span></div>
              <div className="flex items-center gap-2"><div className="w-3 h-3 rounded-full bg-red-500" /><span className="text-gray-600 dark:text-gray-400">Cancellato</span></div>
            </div>
            <FullCalendar plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]} initialView="timeGridWeek" headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,timeGridDay' }} locale="it" events={calendarEvents} eventClick={handleEventClick} height="auto" slotMinTime="07:00:00" slotMaxTime="21:00:00" allDaySlot={false} nowIndicator={true} eventDisplay="block" eventTimeFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }} slotLabelFormat={{ hour: '2-digit', minute: '2-digit', meridiem: false, hour12: false }} buttonText={{ today: 'Oggi', month: 'Mese', week: 'Settimana', day: 'Giorno' }} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {meetings.map((meeting, index) => {
            const { date, time } = formatDateTime(meeting.scheduledAt);
            return (
              <motion.div key={meeting.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1 }}>
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 h-full group">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className={`w-14 h-14 rounded-xl flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform ${meeting.status === 'active' || meeting.status === 'in_progress' ? 'bg-gradient-to-br from-green-500 to-emerald-500' : meeting.status === 'completed' ? 'bg-gradient-to-br from-gray-400 to-gray-500' : 'bg-gradient-to-br from-purple-500 to-pink-500'}`}>
                        <Video className="h-7 w-7 text-white" />
                      </div>
                      {getStatusBadge(meeting.status)}
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2"><Users className="h-4 w-4 text-gray-500" />{meeting.prospectName}</h3>
                    {meeting.prospectEmail && <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">{meeting.prospectEmail}</p>}
                    <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
                      <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{date}</span>
                      {time && <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{time}</span>}
                    </div>
                    {meeting.scriptName && <Badge variant="outline" className="bg-amber-50 dark:bg-amber-900/20 border-amber-300 dark:border-amber-700 mb-4"><FileText className="h-3 w-3 mr-1" />{meeting.scriptName}</Badge>}
                    <div className="flex-grow" />
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <Link2 className="h-4 w-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                        <input type="text" value={getMeetingUrl(meeting.meetingToken)} readOnly className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none truncate" />
                        <Button size="sm" variant="ghost" onClick={() => copyToClipboard(getMeetingUrl(meeting.meetingToken), meeting.id)} className="h-7 w-7 p-0">
                          {copiedId === meeting.id ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </Button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <Button size="sm" variant={meeting.status === 'active' || meeting.status === 'in_progress' ? 'default' : 'outline'} onClick={() => { if (meeting.status !== 'completed') window.open(getMeetingUrl(meeting.meetingToken), '_blank'); }} className={`text-xs ${meeting.status === 'active' || meeting.status === 'in_progress' ? 'bg-green-600 hover:bg-green-700' : ''}`} disabled={meeting.status === 'completed' || meeting.status === 'cancelled'}>
                        <Play className="h-3 w-3 mr-1" />{meeting.status === 'active' || meeting.status === 'in_progress' ? 'Entra' : 'Avvia'}
                      </Button>
                      <Button size="sm" variant="outline" className="text-xs" disabled={meeting.status !== 'completed'} onClick={() => toast({ title: 'Analytics', description: 'Funzionalità in arrivo...' })}>
                        <BarChart3 className="h-3 w-3 mr-1" />Analytics
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => handleDeleteMeeting(meeting)} className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="h-3 w-3 mr-1" />Elimina
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </>
  );

  const AnalyticsContent = () => (
    <>
      {overviewLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <BarChart3 className="h-12 w-12 mx-auto mb-4 text-purple-600 animate-pulse" />
            <p className="text-gray-600 dark:text-gray-400">Caricamento analytics...</p>
          </div>
        </div>
      ) : (
        <>
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {statsCards.map((stat, index) => (
              <motion.div key={stat.title} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + index * 0.05 }}>
                <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50 shadow-lg hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">{stat.title}</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                      </div>
                      <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${stat.gradient} flex items-center justify-center text-white`}>{stat.icon}</div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><PieChart className="h-5 w-5 text-purple-600" />Distribuzione Esiti</CardTitle>
              </CardHeader>
              <CardContent>
                {outcomeChartData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        <Pie data={outcomeChartData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {outcomeChartData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                        </Pie>
                        <Tooltip />
                        <Legend />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center"><p className="text-gray-500 dark:text-gray-400">Nessun dato disponibile</p></div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-white dark:bg-gray-800 border-purple-200/50 dark:border-purple-800/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="h-5 w-5 text-purple-600" />Confronto Venditori</CardTitle>
              </CardHeader>
              <CardContent>
                {sellerComparisonData.length > 0 ? (
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sellerComparisonData} layout="vertical">
                        <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                        <YAxis type="category" dataKey="name" width={100} tick={{ fontSize: 12 }} />
                        <Tooltip formatter={(value: number) => `${value}%`} />
                        <Legend />
                        <Bar dataKey="conversione" name="Conversione" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                        <Bar dataKey="script" name="Script" fill="#a855f7" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[250px] flex items-center justify-center"><p className="text-gray-500 dark:text-gray-400">Nessun venditore disponibile</p></div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          <div className="sticky top-0 z-30 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md border-b border-gray-200 dark:border-gray-700">
            <div className="px-4 md:px-8 py-3 flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => setSidebarOpen(true)} className="hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden">
                <Menu className="h-5 w-5" />
              </Button>
              <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Users className="h-6 w-6 text-purple-600" />
                Venditori Umani
              </h1>
            </div>
            
            <div className="px-4 md:px-8 pb-2">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="sellers" className="flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    <span className="hidden sm:inline">Gestione Team</span>
                    <span className="sm:hidden">Team</span>
                  </TabsTrigger>
                  <TabsTrigger value="meetings" className="flex items-center gap-2">
                    <Video className="h-4 w-4" />
                    <span className="hidden sm:inline">Video Meetings</span>
                    <span className="sm:hidden">Meetings</span>
                  </TabsTrigger>
                  <TabsTrigger value="analytics" className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    <span className="hidden sm:inline">Analytics</span>
                    <span className="sm:hidden">Stats</span>
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="p-4 sm:p-8">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsContent value="sellers" className="mt-0"><SellersListContent /></TabsContent>
              <TabsContent value="meetings" className="mt-0"><MeetingsContent /></TabsContent>
              <TabsContent value="analytics" className="mt-0"><AnalyticsContent /></TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il venditore "{selectedSeller?.sellerName}". Questa azione è irreversibile e eliminerà anche tutti i dati e le statistiche associate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Elimina</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deleteMeetingDialogOpen} onOpenChange={setDeleteMeetingDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminare questo meeting?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare il meeting con <strong>{selectedMeeting?.prospectName}</strong>. Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction onClick={() => selectedMeeting && deleteMeetingMutation.mutate(selectedMeeting.id)} className="bg-red-600 hover:bg-red-700" disabled={deleteMeetingMutation.isPending}>
              {deleteMeetingMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={createMeetingDialogOpen} onOpenChange={setCreateMeetingDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Video className="h-5 w-5 text-purple-600" />Nuovo Video Meeting</DialogTitle>
            <DialogDescription>Programma un nuovo incontro video con un prospect</DialogDescription>
          </DialogHeader>
          {generatedMeetingLink ? (
            <div className="space-y-4 py-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">Meeting creato con successo!</p>
                <p className="text-xs text-green-600 dark:text-green-400 mb-3">Condividi questo link con il prospect:</p>
                <div className="flex items-center gap-2 p-2 bg-white dark:bg-gray-800 rounded border">
                  <input type="text" value={generatedMeetingLink} readOnly className="flex-1 bg-transparent text-sm outline-none" />
                  <Button size="sm" onClick={() => { navigator.clipboard.writeText(generatedMeetingLink); toast({ title: 'Copiato!', description: 'Link meeting copiato negli appunti' }); }}>
                    <Copy className="h-4 w-4 mr-1" />Copia
                  </Button>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateMeetingDialogOpen(false)}>Chiudi</Button>
                <Button onClick={resetMeetingForm}><Plus className="h-4 w-4 mr-1" />Crea Altro</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="prospectName">Nome Prospect *</Label>
                  <Input id="prospectName" placeholder="es. Marco Rossi" value={meetingFormData.prospectName} onChange={(e) => setMeetingFormData({ ...meetingFormData, prospectName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="prospectEmail">Email Prospect (opzionale)</Label>
                  <Input id="prospectEmail" type="email" placeholder="es. marco.rossi@example.com" value={meetingFormData.prospectEmail} onChange={(e) => setMeetingFormData({ ...meetingFormData, prospectEmail: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="scheduledDate">Data *</Label>
                    <Input id="scheduledDate" type="date" value={meetingFormData.scheduledDate} onChange={(e) => setMeetingFormData({ ...meetingFormData, scheduledDate: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Ora Inizio *</Label>
                    <Input id="startTime" type="time" value={meetingFormData.startTime} onChange={(e) => setMeetingFormData({ ...meetingFormData, startTime: e.target.value })} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="script">Script/Playbook</Label>
                  <Select value={meetingFormData.scriptId} onValueChange={(value) => setMeetingFormData({ ...meetingFormData, scriptId: value })}>
                    <SelectTrigger><SelectValue placeholder="Seleziona uno script..." /></SelectTrigger>
                    <SelectContent>{scripts.map((script) => <SelectItem key={script.id} value={script.id}>{script.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateMeetingDialogOpen(false)}>Annulla</Button>
                <Button onClick={handleCreateMeeting} disabled={createMeetingMutation.isPending} className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  {createMeetingMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Plus className="h-4 w-4 mr-1" />}
                  Crea Meeting
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
