import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useLocation } from 'wouter';
import { motion } from 'framer-motion';
import {
  Bot,
  Plus,
  ExternalLink,
  Trash2,
  Edit,
  BarChart3,
  Copy,
  QrCode,
  Power,
  PowerOff,
  MessageSquare,
  Link2,
  Loader2,
  Check,
  Calendar,
  Clock,
  FileText,
  HelpCircle,
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { getAuthHeaders } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { useRoleSwitch } from "@/hooks/use-role-switch";
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Menu } from 'lucide-react';

interface SalesAgent {
  id: string;
  agentName: string;
  displayName: string;
  businessName: string;
  isActive: boolean;
  shareToken: string;
  createdAt: string;
  _conversationCount?: number;
}

export default function ClientSalesAgentsList() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { showRoleSwitch, currentRole, handleRoleSwitch } = useRoleSwitch();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<SalesAgent | null>(null);
  const [generatedInviteUrl, setGeneratedInviteUrl] = useState<string | null>(null);
  const [prospectName, setProspectName] = useState('');
  const [prospectEmail, setProspectEmail] = useState('');
  const [prospectPhone, setProspectPhone] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');

  const { data: agents = [], isLoading } = useQuery<SalesAgent[]>({
    queryKey: ['/api/client/sales-agent/config'],
    queryFn: async () => {
      const response = await fetch('/api/client/sales-agent/config', {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch agents');
      return response.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (agentId: string) => {
      const response = await fetch(`/api/client/sales-agent/config/${agentId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to delete agent');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/sales-agent/config'] });
      toast({
        title: '✅ Agente eliminato',
        description: 'L\'agente di vendita è stato eliminato con successo',
      });
      setDeleteDialogOpen(false);
      setSelectedAgent(null);
    },
    onError: () => {
      toast({
        title: '❌ Errore',
        description: 'Impossibile eliminare l\'agente',
        variant: 'destructive',
      });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ agentId, isActive }: { agentId: string; isActive: boolean }) => {
      const response = await fetch(`/api/client/sales-agent/config/${agentId}`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !isActive }),
      });
      if (!response.ok) throw new Error('Failed to toggle agent status');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/client/sales-agent/config'] });
      toast({
        title: '✅ Stato aggiornato',
        description: 'Lo stato dell\'agente è stato modificato con successo',
      });
    },
  });

  const getPublicUrl = (shareToken: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/s/${shareToken}`;
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '📋 Copiato!',
      description: `${label} copiato negli appunti`,
    });
  };

  const handleDelete = (agent: SalesAgent) => {
    setSelectedAgent(agent);
    setDeleteDialogOpen(true);
  };

  const handleQrCode = (agent: SalesAgent) => {
    setSelectedAgent(agent);
    setQrDialogOpen(true);
  };

  const handleGenerateInvite = (agent: SalesAgent) => {
    setSelectedAgent(agent);
    setProspectName('');
    setProspectEmail('');
    setProspectPhone('');
    setScheduledDate('');
    setStartTime('');
    setEndTime('');
    setGeneratedInviteUrl(null);
    setInviteDialogOpen(true);
  };

  const generateInviteMutation = useMutation({
    mutationFn: async ({ agentId, data }: { 
      agentId: string; 
      data: { 
        prospectName?: string; 
        prospectEmail?: string; 
        prospectPhone?: string;
        scheduledDate?: string;
        startTime?: string;
        endTime?: string;
      } 
    }) => {
      const response = await fetch(`/api/client/sales-agent/config/${agentId}/generate-invite`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to generate invite');
      return response.json();
    },
    onSuccess: (data, variables) => {
      setGeneratedInviteUrl(data.inviteUrl);
      queryClient.invalidateQueries({ queryKey: [`/api/client/sales-agent/config/${variables.agentId}/invites`] });
      toast({
        title: '✅ Link invito generato!',
        description: 'Il link è pronto per essere condiviso con il prospect',
      });
    },
    onError: () => {
      toast({
        title: '❌ Errore',
        description: 'Impossibile generare il link invito',
        variant: 'destructive',
      });
    },
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 dark:from-gray-900 dark:via-gray-800 dark:to-black">
      <div className="flex h-screen">
        <Sidebar role="client" isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} showRoleSwitch={showRoleSwitch} currentRole={currentRole} onRoleSwitch={handleRoleSwitch} />

        <div className="flex-1 overflow-y-auto bg-transparent">
          {/* Header with menu button */}
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
                <Bot className="h-6 w-6 text-blue-600" />
                Sales Agents AI
              </h1>
            </div>
          </div>

          {/* Main Content */}
          <div className="p-4 sm:p-8">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-8"
            >
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-lg text-gray-600 dark:text-gray-400">
                    I tuoi assistenti di vendita intelligenti
                  </p>
                </div>
                <Button
                  size="lg"
                  className="bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white shadow-lg"
                  onClick={() => setLocation('/client/sales-agents/new')}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Nuovo Agente
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
        ) : agents.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          >
            <Card className="bg-white dark:bg-gray-800 border-dashed border-2 border-gray-300 dark:border-gray-700">
              <CardContent className="p-12 text-center">
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-6 border border-blue-500/30">
                  <Bot className="h-12 w-12 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Nessun agente creato
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-md mx-auto">
                  Crea il tuo primo assistente di vendita AI per iniziare a convertire prospect automaticamente 24/7
                </p>
                <Button
                  size="lg"
                  className="bg-gradient-to-br from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white"
                  onClick={() => setLocation('/client/sales-agents/new')}
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Crea Primo Agente
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent, index) => (
              <motion.div
                key={agent.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-xl transition-all duration-300 h-full group">
                  <CardContent className="p-6 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                        <Bot className="h-7 w-7 text-white" />
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={agent.isActive ? 'default' : 'secondary'}
                          className={agent.isActive ? 'bg-green-500 hover:bg-green-600' : 'bg-gray-400'}
                        >
                          {agent.isActive ? (
                            <>
                              <Power className="h-3 w-3 mr-1" />
                              Attivo
                            </>
                          ) : (
                            <>
                              <PowerOff className="h-3 w-3 mr-1" />
                              Spento
                            </>
                          )}
                        </Badge>
                        {agent._conversationCount && agent._conversationCount > 0 && (
                          <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 border-purple-300 dark:border-purple-700">
                            <MessageSquare className="h-3 w-3 mr-1" />
                            {agent._conversationCount}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                      {agent.agentName}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      {agent.displayName} • {agent.businessName}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500 mb-4">
                      Creato il {new Date(agent.createdAt).toLocaleDateString('it-IT')}
                    </p>

                    <div className="flex-grow" />

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center gap-2 p-2 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
                        <ExternalLink className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <input
                          type="text"
                          value={getPublicUrl(agent.shareToken)}
                          readOnly
                          className="flex-1 bg-transparent text-xs text-gray-700 dark:text-gray-300 outline-none"
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(getPublicUrl(agent.shareToken), 'Link pubblico')}
                          className="h-7 w-7 p-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <Button
                      size="sm"
                      onClick={() => handleGenerateInvite(agent)}
                      className="w-full mb-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white"
                    >
                      <Link2 className="h-3 w-3 mr-1.5" />
                      Genera Link Invito
                    </Button>

                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/client/sales-agents/${agent.id}`)}
                        className="text-xs"
                      >
                        <Edit className="h-3 w-3 mr-1" />
                        Modifica
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/client/sales-agents/${agent.id}/analytics`)}
                        className="text-xs"
                      >
                        <BarChart3 className="h-3 w-3 mr-1" />
                        Analytics
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation(`/client/sales-agents/${agent.id}/scripts`)}
                        className="text-xs"
                      >
                        <FileText className="h-3 w-3 mr-1" />
                        Script
                      </Button>
                    </div>

                    <div className="grid grid-cols-4 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleQrCode(agent)}
                        className="text-xs"
                        title="Visualizza QR Code"
                      >
                        <QrCode className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => toggleActiveMutation.mutate({ agentId: agent.id, isActive: agent.isActive })}
                        className="text-xs"
                        title={agent.isActive ? 'Disattiva' : 'Attiva'}
                      >
                        {agent.isActive ? <PowerOff className="h-3 w-3" /> : <Power className="h-3 w-3" />}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setLocation('/client/faq')}
                        className="text-xs"
                        title="Visualizza Guida"
                      >
                        <HelpCircle className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleDelete(agent)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                        title="Elimina Agente"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sei sicuro?</AlertDialogTitle>
            <AlertDialogDescription>
              Stai per eliminare l'agente "{selectedAgent?.agentName}". Questa azione è irreversibile e
              eliminerà anche tutte le conversazioni e i dati associati.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedAgent && deleteMutation.mutate(selectedAgent.id)}
              className="bg-red-600 hover:bg-red-700"
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* QR Code Dialog - Placeholder for now */}
      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>QR Code - {selectedAgent?.agentName}</DialogTitle>
            <DialogDescription>
              Scansiona questo QR code per accedere all'agente
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-64 h-64 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300 dark:border-gray-700">
              <p className="text-gray-500 dark:text-gray-400 text-center px-4">
                QR Code Generation<br />Coming Soon
              </p>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 text-center max-w-sm">
              {selectedAgent && getPublicUrl(selectedAgent.shareToken)}
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrDialogOpen(false)}>
              Chiudi
            </Button>
            <Button onClick={() => selectedAgent && copyToClipboard(getPublicUrl(selectedAgent.shareToken), 'Link')}>
              <Copy className="h-4 w-4 mr-2" />
              Copia Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Generate Invite Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-600" />
              Genera Link Invito
            </DialogTitle>
            <DialogDescription>
              Crea un link univoco per il prospect. I dati sono opzionali e possono essere compilati anche dal prospect.
            </DialogDescription>
          </DialogHeader>

          {!generatedInviteUrl ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="prospect-name">Nome Prospect (opzionale)</Label>
                <Input
                  id="prospect-name"
                  placeholder="Es: Mario Rossi"
                  value={prospectName}
                  onChange={(e) => setProspectName(e.target.value)}
                  disabled={generateInviteMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-email">Email (opzionale)</Label>
                <Input
                  id="prospect-email"
                  type="email"
                  placeholder="Es: mario@esempio.it"
                  value={prospectEmail}
                  onChange={(e) => setProspectEmail(e.target.value)}
                  disabled={generateInviteMutation.isPending}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="prospect-phone">Telefono (opzionale)</Label>
                <Input
                  id="prospect-phone"
                  type="tel"
                  placeholder="Es: +39 123 456 7890"
                  value={prospectPhone}
                  onChange={(e) => setProspectPhone(e.target.value)}
                  disabled={generateInviteMutation.isPending}
                />
              </div>

              <div className="border-t pt-4 mt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Calendar className="h-4 w-4 text-purple-600" />
                  <Label className="text-base font-semibold">Programma Orario (opzionale)</Label>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                  Limita l'accesso a una specifica data e fascia oraria
                </p>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="scheduled-date">Data</Label>
                    <Input
                      id="scheduled-date"
                      type="date"
                      value={scheduledDate}
                      onChange={(e) => setScheduledDate(e.target.value)}
                      disabled={generateInviteMutation.isPending}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="start-time" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Dalle
                      </Label>
                      <Input
                        id="start-time"
                        type="time"
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        disabled={generateInviteMutation.isPending}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="end-time" className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Alle
                      </Label>
                      <Input
                        id="end-time"
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        disabled={generateInviteMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  💡 Tip: Se programmi un orario, il prospect potrà accedere solo nella fascia oraria specificata. Senza orario, il link non scade mai.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              <div className="flex items-center justify-center py-6">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center">
                  <Check className="w-8 h-8 text-green-600 dark:text-green-400" />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Link Invito Generato</Label>
                <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border">
                  <input
                    type="text"
                    value={generatedInviteUrl}
                    readOnly
                    className="flex-1 bg-transparent text-sm outline-none"
                  />
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => copyToClipboard(generatedInviteUrl, 'Link invito')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-purple-50 dark:bg-purple-950 border border-purple-200 dark:border-purple-800 rounded-lg p-3">
                <p className="text-sm text-purple-800 dark:text-purple-200">
                  ✅ Link pronto! Condividilo con il prospect tramite email, WhatsApp o qualsiasi altro canale.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {!generatedInviteUrl ? (
              <>
                <Button variant="outline" onClick={() => setInviteDialogOpen(false)}>
                  Annulla
                </Button>
                <Button
                  onClick={() => selectedAgent && generateInviteMutation.mutate({
                    agentId: selectedAgent.id,
                    data: {
                      prospectName: prospectName.trim() || undefined,
                      prospectEmail: prospectEmail.trim() || undefined,
                      prospectPhone: prospectPhone.trim() || undefined,
                      scheduledDate: scheduledDate.trim() || undefined,
                      startTime: startTime.trim() || undefined,
                      endTime: endTime.trim() || undefined,
                    }
                  })}
                  disabled={generateInviteMutation.isPending}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                >
                  {generateInviteMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generazione...
                    </>
                  ) : (
                    <>
                      <Link2 className="h-4 w-4 mr-2" />
                      Genera Link
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="outline"
                  onClick={() => {
                    setGeneratedInviteUrl(null);
                    setProspectName('');
                    setProspectEmail('');
                    setProspectPhone('');
                    setScheduledDate('');
                    setStartTime('');
                    setEndTime('');
                  }}
                >
                  Genera Nuovo
                </Button>
                <Button onClick={() => setInviteDialogOpen(false)}>
                  Chiudi
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
          </div>
        </div>
      </div>
    </div>
  );
}
