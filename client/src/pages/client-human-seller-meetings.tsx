import { useState } from 'react';
import { useLocation } from 'wouter';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
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
  prospectEmail?: string;
  scriptId?: string;
  scriptName?: string;
  scheduledAt: string;
  status: 'scheduled' | 'active' | 'completed';
  createdAt: string;
}

interface Script {
  id: string;
  name: string;
}

const mockScripts: Script[] = [
  { id: '1', name: 'Discovery Call B2B' },
  { id: '2', name: 'Demo Prodotto SaaS' },
  { id: '3', name: 'Consulenza Iniziale' },
  { id: '4', name: 'Follow-up Proposta' },
  { id: '5', name: 'Chiusura Vendita' },
];

const mockMeetings: VideoMeeting[] = [
  {
    id: '1',
    sellerId: 'seller-1',
    meetingToken: 'meet-abc123',
    prospectName: 'Marco Rossi',
    prospectEmail: 'marco.rossi@example.com',
    scriptId: '1',
    scriptName: 'Discovery Call B2B',
    scheduledAt: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    status: 'scheduled',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    sellerId: 'seller-1',
    meetingToken: 'meet-def456',
    prospectName: 'Laura Bianchi',
    prospectEmail: 'laura.bianchi@company.it',
    scriptId: '2',
    scriptName: 'Demo Prodotto SaaS',
    scheduledAt: new Date().toISOString(),
    status: 'active',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    sellerId: 'seller-1',
    meetingToken: 'meet-ghi789',
    prospectName: 'Giuseppe Verdi',
    scriptId: '3',
    scriptName: 'Consulenza Iniziale',
    scheduledAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    sellerId: 'seller-1',
    meetingToken: 'meet-jkl012',
    prospectName: 'Anna Ferrari',
    prospectEmail: 'anna.ferrari@startup.io',
    scriptId: '5',
    scriptName: 'Chiusura Vendita',
    scheduledAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'completed',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function ClientHumanSellerMeetings() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [meetings, setMeetings] = useState<VideoMeeting[]>(mockMeetings);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [selectedMeeting, setSelectedMeeting] = useState<VideoMeeting | null>(null);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    prospectName: '',
    prospectEmail: '',
    scheduledDate: '',
    startTime: '',
    endTime: '',
    scriptId: '',
  });

  const getMeetingUrl = (meetingToken: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/meeting/${meetingToken}`;
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
      setMeetings(meetings.filter(m => m.id !== selectedMeeting.id));
      toast({
        title: '✅ Meeting eliminato',
        description: 'Il meeting è stato eliminato con successo',
      });
      setDeleteDialogOpen(false);
      setSelectedMeeting(null);
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

    const selectedScript = mockScripts.find(s => s.id === formData.scriptId);
    const newMeeting: VideoMeeting = {
      id: `meeting-${Date.now()}`,
      sellerId: 'seller-current',
      meetingToken: `meet-${Math.random().toString(36).substring(2, 10)}`,
      prospectName: formData.prospectName,
      prospectEmail: formData.prospectEmail || undefined,
      scriptId: formData.scriptId || undefined,
      scriptName: selectedScript?.name,
      scheduledAt: new Date(`${formData.scheduledDate}T${formData.startTime}`).toISOString(),
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    };

    setMeetings([newMeeting, ...meetings]);
    setGeneratedLink(getMeetingUrl(newMeeting.meetingToken));
    
    toast({
      title: '✅ Meeting creato!',
      description: 'Il meeting è stato creato con successo',
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
    }
  };

  const formatDateTime = (isoString: string) => {
    const date = new Date(isoString);
    return {
      date: date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }),
      time: date.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    };
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
                <Button
                  size="lg"
                  className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg"
                  onClick={openCreateDialog}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuovo Meeting
                </Button>
              </div>
            </motion.div>

            {meetings.length === 0 ? (
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
                              meeting.status === 'active' 
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
                            <span className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              {time}
                            </span>
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
                              variant={meeting.status === 'active' ? 'default' : 'outline'}
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
                              className={`text-xs ${meeting.status === 'active' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                              disabled={meeting.status === 'completed'}
                            >
                              <Play className="h-3 w-3 mr-1" />
                              {meeting.status === 'active' ? 'Entra' : 'Avvia'}
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
                      {mockScripts.map((script) => (
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
                  className="bg-gradient-to-br from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  <Plus className="h-4 w-4 mr-1" />
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
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
