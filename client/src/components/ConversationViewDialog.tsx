import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { User, Bot, Clock, MessageSquare, X } from 'lucide-react';
import { getAuthHeaders } from '@/lib/auth';
import { format } from 'date-fns';
import { it } from 'date-fns/locale';

interface AiMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
  status?: string;
  tokensUsed?: number;
}

interface Conversation {
  id: string;
  agentId: string;
  prospectName: string;
  prospectEmail?: string;
  prospectPhone?: string;
  currentPhase: string;
  createdAt: string;
}

interface ConversationViewDialogProps {
  agentId: string;
  conversationId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConversationViewDialog({
  agentId,
  conversationId,
  open,
  onOpenChange,
}: ConversationViewDialogProps) {
  const { data, isLoading } = useQuery<{ messages: AiMessage[]; conversation: Conversation }>({
    queryKey: [`/api/client/sales-agent/config/${agentId}/conversations/${conversationId}/messages`],
    queryFn: async () => {
      if (!conversationId) throw new Error('No conversation ID');
      const response = await fetch(
        `/api/client/sales-agent/config/${agentId}/conversations/${conversationId}/messages`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error('Failed to fetch messages');
      return response.json();
    },
    enabled: !!conversationId && open,
  });

  const messages = data?.messages || [];
  const conversation = data?.conversation;

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'assistant':
        return <Bot className="h-4 w-4" />;
      case 'system':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'user':
        return <Badge variant="outline" className="bg-blue-50 dark:bg-blue-900/20 border-blue-300 text-blue-700">Utente</Badge>;
      case 'assistant':
        return <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 border-purple-300 text-purple-700">AI Agent</Badge>;
      case 'system':
        return <Badge variant="outline" className="bg-gray-50 dark:bg-gray-900/20 border-gray-300">Sistema</Badge>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] p-0">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-xl font-semibold flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-purple-600" />
                Conversazione con {conversation?.prospectName || 'Prospect'}
              </DialogTitle>
              <DialogDescription className="mt-2">
                {conversation && (
                  <div className="flex flex-wrap gap-3 mt-2">
                    {conversation.prospectEmail && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        📧 {conversation.prospectEmail}
                      </span>
                    )}
                    {conversation.prospectPhone && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">
                        📞 {conversation.prospectPhone}
                      </span>
                    )}
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      📊 Fase: <strong className="capitalize">{conversation.currentPhase}</strong>
                    </span>
                  </div>
                )}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-6" style={{ maxHeight: 'calc(85vh - 140px)' }}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Nessun messaggio
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Questa conversazione non ha ancora messaggi registrati
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}
                  >
                    <div
                      className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                        message.role === 'user'
                          ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                          : message.role === 'assistant'
                          ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600'
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600'
                      }`}
                    >
                      {getRoleIcon(message.role)}
                    </div>
                    <div className={`flex-1 ${message.role === 'user' ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="flex items-center gap-2 mb-1">
                        {getRoleBadge(message.role)}
                        <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {format(new Date(message.createdAt), 'dd MMM yyyy, HH:mm', { locale: it })}
                        </span>
                      </div>
                      <div
                        className={`rounded-lg px-4 py-3 max-w-[85%] ${
                          message.role === 'user'
                            ? 'bg-blue-500 text-white'
                            : message.role === 'assistant'
                            ? 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100'
                            : 'bg-gray-50 dark:bg-gray-900 text-gray-600 dark:text-gray-400 text-sm'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{message.content}</p>
                      </div>
                      {message.tokensUsed && (
                        <span className="text-xs text-gray-400 mt-1">
                          {message.tokensUsed} tokens
                        </span>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t bg-gray-50 dark:bg-gray-900/50 flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            {messages.length > 0 && (
              <span>
                {messages.length} {messages.length === 1 ? 'messaggio' : 'messaggi'} in totale
              </span>
            )}
          </div>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
