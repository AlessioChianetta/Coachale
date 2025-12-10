import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Copy,
  ExternalLink,
  Calendar,
  User,
  Mail,
  Phone,
  MessageSquare,
  Eye,
  Link2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
import { useLocation } from 'wouter';
import { ConversationViewDialog } from '@/components/ConversationViewDialog';

interface ConsultationInvite {
  inviteToken: string;
  agentId: string;
  consultantName: string;
  prospectName: string | null;
  prospectEmail: string | null;
  prospectPhone: string | null;
  conversationId: string | null;
  status: 'pending' | 'active' | 'completed';
  accessCount: number;
  lastAccessedAt: string | null;
  createdAt: string;
  updatedAt: string;
  inviteUrl: string;
}

interface InvitesListTableProps {
  agentId: string;
  entityType?: 'ai_agent' | 'human_seller';
}

export function InvitesListTable({ agentId, entityType = 'ai_agent' }: InvitesListTableProps) {
  const baseUrl = entityType === 'human_seller' 
    ? `/api/human-sellers/${agentId}` 
    : `/api/client/sales-agent/config/${agentId}`;
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteAllDialogOpen, setDeleteAllDialogOpen] = useState(false);
  const [inviteToDelete, setInviteToDelete] = useState<string | null>(null);
  const [conversationDialogOpen, setConversationDialogOpen] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  const { data: invites = [], isLoading, refetch } = useQuery<ConsultationInvite[]>({
    queryKey: [`${baseUrl}/invites`],
    queryFn: async () => {
      const response = await fetch(`${baseUrl}/invites`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Failed to fetch invites');
      return response.json();
    },
  });

  // Mutation for deleting single invite
  const deleteMutation = useMutation({
    mutationFn: async (inviteToken: string) => {
      const response = await fetch(
        `${baseUrl}/invites/${inviteToken}`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete invite');
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`${baseUrl}/invites`] });
      toast({
        title: '✅ Eliminato!',
        description: 'Invito e conversazione eliminati con successo',
      });
      setDeleteDialogOpen(false);
      setInviteToDelete(null);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Mutation for deleting all invites
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${baseUrl}/invites`,
        {
          method: 'DELETE',
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to delete invites');
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`${baseUrl}/invites`] });
      toast({
        title: '✅ Eliminato!',
        description: `Eliminati ${data.deletedCount} inviti e conversazioni`,
      });
      setDeleteAllDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({
        title: '❌ Errore',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const handleDeleteClick = (inviteToken: string) => {
    setInviteToDelete(inviteToken);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (inviteToDelete) {
      deleteMutation.mutate(inviteToDelete);
    }
  };

  const handleDeleteAllClick = () => {
    setDeleteAllDialogOpen(true);
  };

  const handleDeleteAllConfirm = () => {
    deleteAllMutation.mutate();
  };

  const handleViewConversation = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setConversationDialogOpen(true);
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: '📋 Copiato!',
      description: `${label} copiato negli appunti`,
    });
  };

  const truncateUrl = (url: string, maxLength = 40) => {
    if (url.length <= maxLength) return url;
    const start = url.substring(0, maxLength - 10);
    const end = url.substring(url.length - 7);
    return `${start}...${end}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300">In Attesa</Badge>;
      case 'active':
        return <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300">Attivo</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 border-gray-300 dark:border-gray-700">Completato</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (invites.length === 0) {
    return (
      <Card>
        <CardContent className="p-12 text-center">
          <div className="w-16 h-16 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center mx-auto mb-4">
            <Link2 className="h-8 w-8 text-purple-600 dark:text-purple-400" />
          </div>
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Nessun invito generato
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6">
            Genera il primo link invito per condividerlo con i tuoi prospect
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5 text-purple-600" />
              Inviti Generati
            </CardTitle>
            <CardDescription>
              {invites.length} {invites.length === 1 ? 'link invito' : 'link inviti'} generati
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {invites.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleDeleteAllClick}
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Elimina Tutte
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Aggiorna
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-gray-50 dark:bg-gray-900">
                <TableHead className="w-[300px]">Link Invito</TableHead>
                <TableHead>Prospect</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-center">Accessi</TableHead>
                <TableHead>Creato</TableHead>
                <TableHead className="text-right">Azioni</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invites.map((invite, index) => (
                <motion.tr
                  key={invite.inviteToken}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="border-b hover:bg-gray-50 dark:hover:bg-gray-900/50"
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <ExternalLink className="h-4 w-4 text-purple-600 flex-shrink-0" />
                      <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded flex-1 truncate">
                        {truncateUrl(invite.inviteUrl)}
                      </code>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(invite.inviteUrl, 'Link invito')}
                        className="h-7 w-7 p-0 flex-shrink-0"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      {invite.prospectName ? (
                        <div className="flex items-center gap-1.5 text-sm">
                          <User className="h-3 w-3 text-gray-500" />
                          <span className="font-medium">{invite.prospectName}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Non specificato</span>
                      )}
                      {invite.prospectEmail && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <Mail className="h-3 w-3" />
                          {invite.prospectEmail}
                        </div>
                      )}
                      {invite.prospectPhone && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
                          <Phone className="h-3 w-3" />
                          {invite.prospectPhone}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(invite.status)}
                  </TableCell>
                  <TableCell className="text-center">
                    <div className="flex items-center justify-center gap-1">
                      <Eye className="h-3 w-3 text-gray-500" />
                      <span className="font-medium">{invite.accessCount}</span>
                    </div>
                    {invite.lastAccessedAt && (
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(invite.lastAccessedAt).toLocaleDateString('it-IT', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                      <Calendar className="h-3 w-3" />
                      {new Date(invite.createdAt).toLocaleDateString('it-IT')}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {invite.conversationId && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleViewConversation(invite.conversationId!)}
                          className="h-8 px-2"
                          title="Vedi conversazione"
                        >
                          <MessageSquare className="h-3 w-3 mr-1" />
                          <span className="text-xs">Chat</span>
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => window.open(invite.inviteUrl, '_blank')}
                        className="h-8 px-2"
                        title="Apri link"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteClick(invite.inviteToken)}
                        className="h-8 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        title="Elimina invito e conversazione"
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      {/* Delete Single Invite Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Conferma Eliminazione
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare questo invito e la conversazione associata?
              <br />
              <strong className="text-red-600">Questa azione è irreversibile.</strong>
              <br />
              Tutti i messaggi e i dati della conversazione verranno persi definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Eliminazione...' : 'Elimina'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Invites Dialog */}
      <AlertDialog open={deleteAllDialogOpen} onOpenChange={setDeleteAllDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              Elimina Tutte le Conversazioni
            </AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare <strong>tutti i {invites.length} inviti</strong> e le relative conversazioni?
              <br />
              <strong className="text-red-600">Questa azione è irreversibile.</strong>
              <br />
              Tutti i messaggi e i dati di tutte le conversazioni verranno persi definitivamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAllConfirm}
              className="bg-red-600 hover:bg-red-700"
              disabled={deleteAllMutation.isPending}
            >
              {deleteAllMutation.isPending ? 'Eliminazione...' : `Elimina Tutti (${invites.length})`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Conversation View Dialog */}
      <ConversationViewDialog
        agentId={agentId}
        conversationId={selectedConversationId}
        open={conversationDialogOpen}
        onOpenChange={setConversationDialogOpen}
      />
    </Card>
  );
}
