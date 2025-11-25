
import { useState, useEffect, useRef, ElementRef, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { getAuthHeaders } from "@/lib/auth";
import Navbar from "@/components/navbar";
import Sidebar from "@/components/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
import { AgentShareManager } from "@/components/whatsapp/agent-share-manager";
import { Loader2, MessageCircle, Plus, Send, Bot, ArrowLeft, Sparkles, Menu, Camera, Mic, X, Share2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Agent {
  id: string;
  agentName: string;
  agentType: 'receptionist' | 'proactive_setter';
  businessName: string;
  isActive: boolean;
}

interface Conversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  agentConfigId: string;
}

interface PublicConversation {
  id: string;
  title: string | null;
  messageCount: number;
  lastMessageAt: Date | null;
  agentConfigId: string;
  externalVisitorId: string | null;
  visitorMetadata: Record<string, string | number | boolean | null> | null;
  customerName: string | null;
  shareInfo: {
    id: string;
    slug: string;
    agentName: string;
    accessType: 'public' | 'password' | 'whitelist';
  } | null;
  agentInfo: {
    agentName: string;
    businessName: string;
  } | null;
}

type ConversationScope = 'internal' | 'public';

interface Message {
  id: string;
  content: string;
  role: 'consultant' | 'agent';
  createdAt: Date;
  status?: 'sending' | 'sent' | 'streaming' | 'completed';
  transcription?: string;
  audioUrl?: string;
}

interface StreamingMessage {
  id: string;
  content: string;
  role: 'agent';
  createdAt: Date;
  status: 'streaming';
}

export default function ConsultantWhatsAppAgentsChat() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [conversationScope, setConversationScope] = useState<ConversationScope>('internal');

  type TimeFilter = 'all' | 'today' | 'week' | 'month';
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);

  const scrollAreaRef = useRef<ElementRef<typeof ScrollArea>>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch agents
  const { data: agentsData, isLoading: agentsLoading, error: agentsError } = useQuery({
    queryKey: ["/api/whatsapp/agent-chat/agents"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/agent-chat/agents", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Errore nel caricamento degli agenti: ${response.status}`);
      }
      return response.json();
    },
  });

  const agents: Agent[] = agentsData?.data || [];

  // Fetch conversations for selected agent
  const { data: conversationsData, isLoading: conversationsLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return { data: [] };
      const response = await fetch(
        `/api/whatsapp/agent-chat/conversations?agentConfigId=${selectedAgentId}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
    enabled: !!selectedAgentId,
    refetchInterval: 30000, // Poll every 30 seconds
  });

  const conversations: Conversation[] = conversationsData?.data || [];

  // Fetch public conversations for selected agent
  const { data: publicConversationsData, isLoading: publicConversationsLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-chat/public-conversations", selectedAgentId],
    queryFn: async () => {
      if (!selectedAgentId) return { data: [] };
      const response = await fetch(
        `/api/whatsapp/agent-chat/public-conversations?agentConfigId=${selectedAgentId}`,
        { headers: getAuthHeaders() }
      );
      if (!response.ok) throw new Error("Failed to fetch public conversations");
      return response.json();
    },
    enabled: !!selectedAgentId && conversationScope === 'public',
    refetchInterval: 30000,
  });

  const publicConversations: PublicConversation[] = publicConversationsData?.data || [];

  // Unified variables based on scope
  const activeConversations = conversationScope === 'internal' ? conversations : publicConversations;
  const activeConversationsLoading = conversationScope === 'internal' ? conversationsLoading : publicConversationsLoading;

  // Time-based filtering
  const filteredConversations = useMemo(() => {
    if (timeFilter === 'all') return activeConversations;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    return activeConversations.filter(conv => {
      if (!conv.lastMessageAt) return false;
      const msgDate = new Date(conv.lastMessageAt);

      switch (timeFilter) {
        case 'today':
          return msgDate >= startOfToday;
        case 'week':
          return msgDate >= startOfWeek;
        case 'month':
          return msgDate >= startOfMonth;
        default:
          return true;
      }
    });
  }, [activeConversations, timeFilter]);

  // Fetch messages for selected conversation
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedConversationId, "messages"],
    queryFn: async () => {
      if (!selectedConversationId) return { data: [] };
      const response = await fetch(
        `/api/whatsapp/agent-chat/conversations/${selectedConversationId}/messages`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!selectedConversationId,
    refetchInterval: selectedConversationId && !isStreaming ? 30000 : false,
  });

  const messages: Message[] = messagesData?.data || [];

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async (agentConfigId: string) => {
      const response = await fetch("/api/whatsapp/agent-chat/conversations", {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ agentConfigId }),
      });
      if (!response.ok) throw new Error("Failed to create conversation");
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ["/api/whatsapp/agent-chat/conversations", selectedAgentId],
      });
      setSelectedConversationId(data.data.id);
      toast({
        title: "✅ Nuova conversazione",
        description: "Conversazione creata con successo.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {

        // Controlla se l'utente è attualmente vicino al fondo (con una tolleranza di 50px)
        const isUserScrolledToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;

        // Caso 1: L'utente ha appena inviato un messaggio (optimisticMessage)
        if (optimisticMessage) {
          // Scorri in fondo FLUIDAMENTE
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
          return; // Fatto
        }

        // Caso 2: L'AI sta streamando (o i messaggi si stanno caricando)
        // E l'utente è GIÀ in fondo (non sta leggendo i messaggi vecchi)
        if (isUserScrolledToBottom) {
          // Scorri in fondo ISTANTANEAMENTE. 
          // 'smooth' qui causerebbe il "blocco" su desktop.
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
        }

        // Se l'utente NON è in fondo (isUserScrolledToBottom è false), 
        // non fare nulla e lascialo leggere.
      }
    }
  }, [messages, streamingMessage, optimisticMessage]);

  // Handle agent selection
  const handleAgentSelect = (agentId: string) => {
    setSelectedAgentId(agentId);
    setSelectedConversationId(null);
    setOptimisticMessage(null);
    setStreamingMessage(null);
  };

  // Handle conversation selection
  const handleConversationSelect = (conversationId: string) => {
    setSelectedConversationId(conversationId);
    setOptimisticMessage(null);
    setStreamingMessage(null);
  };

  // Handle create new conversation
  const handleCreateConversation = () => {
    if (!selectedAgentId) return;
    createConversationMutation.mutate(selectedAgentId);
  };

  // Handle scope change
  const handleScopeChange = (newScope: ConversationScope) => {
    setConversationScope(newScope);
    setSelectedConversationId(null);
  };

  // Handle photo capture
  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    toast({
      title: "Foto selezionata",
      description: `File: ${file.name} (${(file.size / 1024).toFixed(2)} KB)`,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Upload and send audio message
  const uploadAndSendAudio = async (audioBlob: Blob) => {
    if (!selectedConversationId || !selectedAgentId) {
      toast({
        title: "Errore",
        description: "Seleziona una conversazione prima di registrare",
        variant: "destructive",
      });
      return;
    }

    // Show optimistic loading message
    const tempAudioMessage: Message = {
      id: `temp-audio-${Date.now()}`,
      content: '🎤 Trascrizione in corso...',
      role: 'consultant',
      createdAt: new Date(),
      status: 'sending',
    };
    setOptimisticMessage(tempAudioMessage);

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('conversationId', selectedConversationId);
    formData.append('agentConfigId', selectedAgentId);

    try {
      setIsStreaming(true);

      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapp/agent-chat/send-audio', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const result = await response.json();

      toast({
        title: "Nota vocale inviata",
        description: result.transcription ? `Trascritto: "${result.transcription.substring(0, 50)}..."` : "Audio inviato con successo",
      });

      // Refetch messages to show transcription and response
      queryClient.invalidateQueries([
        '/api/whatsapp/agent-chat/conversations',
        selectedConversationId,
        'messages'
      ]);

      // Clear optimistic message
      setOptimisticMessage(null);

    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Impossibile inviare l'audio",
        variant: "destructive",
      });
      // Clear optimistic message on error
      setOptimisticMessage(null);
    } finally {
      setIsStreaming(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true
        }
      });
      const recorder = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });

        // Upload audio
        await uploadAndSendAudio(blob);

        stream.getTracks().forEach(track => track.stop());
      };

      setMediaRecorder(recorder);
      setIsRecording(true);
      recorder.start();

      const timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      recordingTimerRef.current = timer;
    } catch (error) {
      toast({
        title: "Errore",
        description: "Impossibile accedere al microfono",
        variant: "destructive",
      });
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    toast({
      title: "Registrazione annullata",
    });
  };

  // Format recording time
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle send message with SSE streaming
  const handleSendMessage = async () => {
    if (!selectedConversationId || !messageInput.trim() || isStreaming) return;

    const content = messageInput.trim();
    setMessageInput("");

    // Add optimistic consultant message
    const tempConsultantMessage: Message = {
      id: `temp-${Date.now()}`,
      content,
      role: 'consultant',
      createdAt: new Date(),
      status: 'sending',
    };
    setOptimisticMessage(tempConsultantMessage);

    try {
      setIsStreaming(true);

      const response = await fetch(
        `/api/whatsapp/agent-chat/conversations/${selectedConversationId}/messages`,
        {
          method: 'POST',
          headers: {
            ...getAuthHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      // Clear optimistic message
      setOptimisticMessage(null);

      // Initialize streaming message
      const tempAgentMessage: StreamingMessage = {
        id: `streaming-${Date.now()}`,
        content: '',
        role: 'agent',
        createdAt: new Date(),
        status: 'streaming',
      };
      setStreamingMessage(tempAgentMessage);

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let fullResponse = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        buffer += text;

        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            try {
              const jsonStr = line.slice(line.indexOf('data:') + 5).trim();
              if (jsonStr) {
                const data = JSON.parse(jsonStr);

                // Handle error from server
                if (data.error) {
                  setOptimisticMessage(null);
                  setStreamingMessage(null);
                  setIsStreaming(false);

                  // Invalidate queries to show the saved consultant message (backend saved it before streaming failed)
                  queryClient.invalidateQueries({
                    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedConversationId, "messages"],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedAgentId],
                  });

                  toast({
                    title: "❌ Errore AI",
                    description: data.error,
                    variant: "destructive",
                  });
                  return; // Exit loop
                }

                if (data.text) {
                  fullResponse += data.text;
                  setStreamingMessage({
                    ...tempAgentMessage,
                    content: fullResponse,
                  });
                }

                if (data.done) {
                  setStreamingMessage(null);
                  setIsStreaming(false);

                  queryClient.invalidateQueries({
                    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedConversationId, "messages"],
                  });
                  queryClient.invalidateQueries({
                    queryKey: ["/api/whatsapp/agent-chat/conversations", selectedAgentId],
                  });
                  return;
                }
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', line, e);
            }
          }
        }
      }
    } catch (error: any) {
      setOptimisticMessage(null);
      setStreamingMessage(null);
      setIsStreaming(false);
      toast({
        title: "❌ Errore",
        description: error.message || "Errore durante l'invio del messaggio",
        variant: "destructive",
      });
    }
  };

  // Get selected agent details
  const selectedAgent = agents.find((a) => a.id === selectedAgentId);
  const selectedConversation = filteredConversations.find((c) => c.id === selectedConversationId);

  // Combine messages with optimistic and streaming messages
  const displayMessages = [
    ...messages,
    ...(optimisticMessage ? [optimisticMessage] : []),
    ...(streamingMessage ? [streamingMessage] : []),
  ];

  // Agent type label
  const getAgentTypeLabel = (type: string) => {
    switch (type) {
      case 'receptionist':
        return 'Receptionist';
      case 'proactive_setter':
        return 'Proattivo';
      default:
        return type;
    }
  };

  // Agent type color
  const getAgentTypeColor = (type: string) => {
    switch (type) {
      case 'receptionist':
        return 'bg-blue-500';
      case 'proactive_setter':
        return 'bg-purple-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100">


      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        {isMobile ? (
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-64">
              <Sidebar role="consultant" />
            </SheetContent>
          </Sheet>
        ) : (
          <Sidebar role="consultant" isOpen={true} onClose={() => {}} />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {/* Layout Container */}
          <div className="flex-1 overflow-hidden min-h-0">
            {isMobile ? (
              // Mobile: Stack vertically with proper flex structure
              <div className="h-full flex flex-col overflow-hidden">
                {/* Agent List - Stile WhatsApp */}
                {!selectedAgentId && (
                  <div className="h-full flex flex-col bg-white">
                    {/* Header */}
                    <div className="p-4 border-b">
                      <h2 className="text-xl font-semibold text-gray-900">WhatsApp</h2>
                    </div>

                    {/* Search Bar (optional, già presente) */}
                    <div className="px-3 py-2">
                      <div className="bg-gray-100 rounded-lg px-3 py-2 flex items-center gap-2">
                        <MessageCircle className="h-4 w-4 text-gray-500" />
                        <span className="text-sm text-gray-500">Seleziona un agente</span>
                      </div>
                    </div>

                    {/* Agent List */}
                    <ScrollArea className="flex-1 min-h-0">
                      {agentsLoading ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-green-600" />
                        </div>
                      ) : agentsError ? (
                        <div className="p-6 text-center">
                          <Bot className="h-12 w-12 text-red-400 mx-auto mb-3" />
                          <p className="text-red-600 font-semibold mb-2">Errore nel caricamento</p>
                          <p className="text-sm text-red-500">{(agentsError as Error).message}</p>
                        </div>
                      ) : agents.length === 0 ? (
                        <div className="p-6 text-center">
                          <Bot className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                          <p className="text-gray-600 mb-2">Nessun agente configurato</p>
                          <p className="text-sm text-gray-500">Configura i tuoi agenti WhatsApp dalla sezione Setup Agenti</p>
                        </div>
                      ) : (
                        <div>
                          {agents.map((agent) => (
                            <div
                              key={agent.id}
                              className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 cursor-pointer border-b border-gray-100 transition-colors"
                              onClick={() => handleAgentSelect(agent.id)}
                            >
                              {/* Avatar */}
                              <div className="relative flex-shrink-0">
                                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-green-400 to-green-600 flex items-center justify-center">
                                  <Bot className="h-6 w-6 text-white" />
                                </div>
                                {agent.isActive && (
                                  <div className="absolute bottom-0 right-0 h-3 w-3 bg-green-500 rounded-full border-2 border-white" />
                                )}
                              </div>

                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <h3 className="font-semibold text-gray-900 truncate">{agent.agentName}</h3>
                                  <Badge 
                                    variant="secondary" 
                                    className="text-xs ml-2 flex-shrink-0"
                                  >
                                    {getAgentTypeLabel(agent.agentType)}
                                  </Badge>
                                </div>
                                <p className="text-sm text-gray-500 truncate">{agent.businessName}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </div>
                )}

                {/* Conversation List */}
                {selectedAgentId && !selectedConversationId && (
                  <div className="p-4">
                    <div className="flex items-center justify-between mb-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSelectedAgentId(null)}
                      >
                        <ArrowLeft className="h-4 w-4 mr-1" />
                        Indietro
                      </Button>
                      <h2 className="text-lg font-bold">Conversazioni</h2>
                      <div className="w-16"></div>
                    </div>

                    <Tabs value={conversationScope} onValueChange={(v) => handleScopeChange(v as ConversationScope)}>
                      <TabsList className="grid w-full grid-cols-2 mb-3">
                        <TabsTrigger value="internal">Interne</TabsTrigger>
                        <TabsTrigger value="public">Pubbliche</TabsTrigger>
                      </TabsList>

                      {/* Time Filter - Mobile */}
                      <div className="mb-3 flex gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant={timeFilter === 'all' ? 'default' : 'outline'}
                          onClick={() => setTimeFilter('all')}
                          className="flex-1 min-w-[60px]"
                        >
                          Tutte
                        </Button>
                        <Button
                          size="sm"
                          variant={timeFilter === 'today' ? 'default' : 'outline'}
                          onClick={() => setTimeFilter('today')}
                          className="flex-1 min-w-[60px]"
                        >
                          Oggi
                        </Button>
                        <Button
                          size="sm"
                          variant={timeFilter === 'week' ? 'default' : 'outline'}
                          onClick={() => setTimeFilter('week')}
                          className="flex-1 min-w-[60px]"
                        >
                          Settimana
                        </Button>
                        <Button
                          size="sm"
                          variant={timeFilter === 'month' ? 'default' : 'outline'}
                          onClick={() => setTimeFilter('month')}
                          className="flex-1 min-w-[60px]"
                        >
                          Mese
                        </Button>
                      </div>

                      <TabsContent value={conversationScope} className="mt-0">
                        {conversationScope === 'internal' && (
                          <Button
                            size="sm"
                            onClick={handleCreateConversation}
                            disabled={createConversationMutation.isPending}
                            className="bg-gradient-to-r from-blue-600 to-purple-600 w-full mb-3"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Nuova conversazione
                          </Button>
                        )}

                        {activeConversationsLoading ? (
                          <div className="flex justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                          </div>
                        ) : filteredConversations.length === 0 ? (
                          <Card className="p-6 text-center">
                            <MessageCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                            <p className="text-gray-600 mb-3">
                              {conversationScope === 'internal' ? 'Nessuna conversazione interna' : 'Nessuna conversazione pubblica'}
                            </p>
                            {conversationScope === 'internal' && (
                              <Button
                                onClick={handleCreateConversation}
                                disabled={createConversationMutation.isPending}
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Crea la prima conversazione
                              </Button>
                            )}
                          </Card>
                        ) : (
                          <div className="space-y-2">
                            {filteredConversations.map((conv) => (
                              <Card
                                key={conv.id}
                                className="cursor-pointer hover:shadow-md transition-all duration-200"
                                onClick={() => handleConversationSelect(conv.id)}
                              >
                                <CardContent className="p-3">
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-sm text-gray-900">
                                          {conv.title || "Nuova conversazione"}
                                        </h3>
                                        {conversationScope === 'public' && (
                                          <Badge variant="outline" className="text-xs">
                                            Visitatore
                                          </Badge>
                                        )}
                                      </div>
                                      {conversationScope === 'public' && (conv as PublicConversation).shareInfo && (
                                        <div className="text-xs text-blue-600 mb-1">
                                          Link: {(conv as PublicConversation).shareInfo?.slug}
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <span>{conv.messageCount} messaggi</span>
                                        {conv.lastMessageAt && (
                                          <>
                                            <span>•</span>
                                            <span>
                                              {formatDistanceToNow(new Date(conv.lastMessageAt), {
                                                addSuffix: true,
                                                locale: it,
                                              })}
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        )}
                      </TabsContent>
                    </Tabs>
                  </div>
                )}

                {/* Chat Area */}
                {selectedConversationId && (
                  <div className="h-full flex flex-col bg-gradient-to-b from-gray-50 to-white overflow-hidden">
                    {/* Chat Header - Stile bianco */}
                    <div className="bg-white text-gray-900 p-3 shadow-md border-b border-gray-200 flex items-center gap-3 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-900 hover:bg-gray-100 -ml-2"
                        onClick={() => setSelectedConversationId(null)}
                      >
                        <ArrowLeft className="h-5 w-5" />
                      </Button>
                      <div className="flex items-center gap-3 flex-1">
                        <div className="h-10 w-10 rounded-full bg-gray-100 flex items-center justify-center">
                          <Bot className="h-6 w-6 text-gray-700" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-sm truncate text-gray-900">{selectedAgent?.agentName}</h3>
                          <p className="text-xs text-gray-500 truncate">
                            {selectedConversation?.title || "Nuova conversazione"}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Messages - Background pattern stile WhatsApp */}
                    <ScrollArea className="flex-1 px-3 py-4" ref={scrollAreaRef} style={{
                      backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%23dcf8c6\' fill-opacity=\'0.05\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
                      backgroundColor: '#f0f2f5'
                    }}>
                      {messagesLoading ? (
                        <div className="flex justify-center py-12">
                          <div className="bg-white rounded-full p-4 shadow-lg">
                            <Loader2 className="h-8 w-8 animate-spin text-green-500" />
                          </div>
                        </div>
                      ) : displayMessages.length === 0 ? (
                        <div className="text-center py-16 px-4">
                          <div className="bg-white rounded-3xl p-8 shadow-lg inline-block">
                            <Sparkles className="h-16 w-16 text-green-500 mx-auto mb-4" />
                            <p className="text-gray-600 font-medium text-base">Inizia la conversazione</p>
                            <p className="text-gray-400 text-sm mt-2">Scrivi il primo messaggio all'agente</p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {displayMessages.map((msg, idx) => (
                            <div key={msg.id || `msg-${idx}`} className="flex flex-col gap-1">
                              <WhatsAppMessageBubble
                                message={{
                                  id: msg.id,
                                  text: msg.status === 'sending' 
                                    ? msg.content 
                                    : msg.content,
                                  sender: msg.role === 'consultant' ? 'consultant' : 'ai',
                                  direction: 'outbound',
                                  createdAt: new Date(msg.createdAt),
                                  metadata: msg.status === 'streaming' || msg.status === 'sending' ? { simulated: true } : null,
                                }}
                              />
                              {msg.status === 'sending' && (
                                <div className="flex justify-end mr-12 gap-2 items-center">
                                  <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                  <span className="text-xs text-gray-400">Invio in corso...</span>
                                </div>
                              )}
                              {msg.audioUrl && (
                                <div className={msg.role === 'consultant' ? 'flex justify-end mr-12' : 'flex justify-start ml-12'}>
                                  <audio
                                    controls
                                    className="w-64 h-10"
                                    preload="metadata"
                                  >
                                    <source src={msg.audioUrl} type={msg.role === 'consultant' ? 'audio/webm' : 'audio/wav'} />
                                    Il tuo browser non supporta l'elemento audio.
                                  </audio>
                                </div>
                              )}
                            </div>
                          ))}
                          {isStreaming && !streamingMessage && (
                            <div className="flex items-start gap-2 animate-fade-in">
                              <div className="bg-white rounded-3xl rounded-tl-md shadow-md border border-gray-100 px-5 py-3.5 max-w-[75%]">
                                <div className="flex items-center gap-3 text-green-600">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  <span className="text-sm font-medium">L'agente sta scrivendo...</span>
                                </div>
                              </div>
                            </div>
                          )}

                        </div>
                      )}
                    </ScrollArea>

                    {/* Input Area - Stile WhatsApp moderno */}
                    <div className="bg-white border-t border-gray-200 p-3 shadow-lg flex-shrink-0">
                      {isRecording ? (
                        // Recording UI
                        <div className="flex items-center gap-3 bg-red-50 rounded-3xl px-4 py-3">
                          <div className="flex items-center gap-2 flex-1">
                            <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                            <span className="text-red-600 font-medium">{formatRecordingTime(recordingTime)}</span>
                            <span className="text-gray-500 text-sm ml-2">Registrazione in corso...</span>
                          </div>
                          <Button
                            onClick={cancelRecording}
                            size="icon"
                            variant="ghost"
                            className="h-10 w-10 rounded-full text-red-600 hover:bg-red-100"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                          <Button
                            onClick={stopRecording}
                            size="icon"
                            className="h-12 w-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                          >
                            <Send className="h-5 w-5" />
                          </Button>
                        </div>
                      ) : (
                        // Normal input UI
                        <div className="flex gap-2 items-end">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={handleFileSelected}
                            className="hidden"
                          />

                          <Button
                            onClick={handlePhotoCapture}
                            size="icon"
                            variant="ghost"
                            disabled={isStreaming}
                            className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
                          >
                            <Camera className="h-5 w-5" />
                          </Button>

                          <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2 flex items-center gap-2">
                            <Input
                              value={messageInput}
                              onChange={(e) => setMessageInput(e.target.value)}
                              placeholder="Messaggio..."
                              disabled={isStreaming}
                              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-gray-500 p-0 h-auto min-h-[28px]"
                              onKeyPress={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                  e.preventDefault();
                                  handleSendMessage();
                                }
                              }}
                            />
                          </div>

                          {messageInput.trim() ? (
                            <Button
                              onClick={handleSendMessage}
                              disabled={isStreaming}
                              size="icon"
                              className="rounded-full h-12 w-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                              {isStreaming ? (
                                <Loader2 className="h-5 w-5 animate-spin" />
                              ) : (
                                <Send className="h-5 w-5" />
                              )}
                            </Button>
                          ) : (
                            <Button
                              onClick={startRecording}
                              size="icon"
                              className="rounded-full h-12 w-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                            >
                              <Mic className="h-5 w-5" />
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              // Desktop: 2-column layout
              <div className="grid grid-cols-10 h-full overflow-hidden">
                {/* Left Column (30%) - Agent List + Conversations */}
                <div className="col-span-3 border-r bg-white flex flex-col overflow-hidden min-h-0">
                  {/* Agent List */}
                  <div className="border-b">
                    <div className="p-4">
                      <h2 className="text-sm font-bold text-gray-600 uppercase mb-3 flex items-center gap-2">
                        <Bot className="h-4 w-4" />
                        Agenti
                      </h2>
                      {agentsLoading ? (
                        <div className="flex justify-center py-4">
                          <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        </div>
                      ) : agentsError ? (
                        <div className="text-center py-4 px-2 bg-red-50 rounded-lg border border-red-200">
                          <p className="text-xs font-semibold text-red-600 mb-1">Errore caricamento</p>
                          <p className="text-xs text-red-500">{(agentsError as Error).message}</p>
                        </div>
                      ) : agents.length === 0 ? (
                        <div className="text-center py-4">
                          <p className="text-sm text-gray-500 mb-1">Nessun agente configurato</p>
                          <p className="text-xs text-gray-400">Vai in Setup Agenti</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {agents.map((agent) => (
                            <Card
                              key={agent.id}
                              className={`cursor-pointer transition-all duration-200 ${
                                selectedAgentId === agent.id
                                  ? 'ring-2 ring-blue-500 bg-gradient-to-br from-blue-50 to-purple-50'
                                  : 'hover:shadow-md bg-gradient-to-br from-gray-50 to-slate-50'
                              }`}
                              onClick={() => handleAgentSelect(agent.id)}
                            >
                              <CardContent className="p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <h3 className="font-bold text-sm">{agent.agentName}</h3>
                                  <div
                                    className={`h-2 w-2 rounded-full ${
                                      agent.isActive ? 'bg-green-500' : 'bg-gray-400'
                                    }`}
                                  />
                                </div>
                                <p className="text-xs text-gray-600 mb-1">{agent.businessName}</p>
                                <Badge className={`${getAgentTypeColor(agent.agentType)} text-white text-xs`}>
                                  {getAgentTypeLabel(agent.agentType)}
                                </Badge>
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Conversation List */}
                  <div className="flex-1 overflow-hidden flex flex-col">
                    <div className="p-4 border-b flex items-center justify-between">
                      <h2 className="text-sm font-bold text-gray-600 uppercase flex items-center gap-2">
                        <MessageCircle className="h-4 w-4" />
                        Conversazioni
                      </h2>
                      {selectedAgentId && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setShareDialogOpen(true)}
                          className="h-7 text-xs"
                        >
                          <Share2 className="h-3 w-3 mr-1" />
                          Condividi
                        </Button>
                      )}
                    </div>

                    <ScrollArea className="flex-1 min-h-0">
                      <div className="p-4">
                        {!selectedAgentId ? (
                          <p className="text-sm text-gray-500 text-center py-8">
                            Seleziona un agente per vedere le conversazioni
                          </p>
                        ) : (
                          <Tabs value={conversationScope} onValueChange={(v) => handleScopeChange(v as ConversationScope)}>
                            <TabsList className="grid w-full grid-cols-2 mb-3">
                              <TabsTrigger value="internal">Interne</TabsTrigger>
                              <TabsTrigger value="public">Pubbliche</TabsTrigger>
                            </TabsList>

                            {/* Time Filter - Desktop */}
                            <div className="mb-3 flex gap-2 flex-wrap">
                              <Button
                                size="sm"
                                variant={timeFilter === 'all' ? 'default' : 'outline'}
                                onClick={() => setTimeFilter('all')}
                                className="flex-1 min-w-[60px] h-7 text-xs"
                              >
                                Tutte
                              </Button>
                              <Button
                                size="sm"
                                variant={timeFilter === 'today' ? 'default' : 'outline'}
                                onClick={() => setTimeFilter('today')}
                                className="flex-1 min-w-[60px] h-7 text-xs"
                              >
                                Oggi
                              </Button>
                              <Button
                                size="sm"
                                variant={timeFilter === 'week' ? 'default' : 'outline'}
                                onClick={() => setTimeFilter('week')}
                                className="flex-1 min-w-[60px] h-7 text-xs"
                              >
                                Settimana
                              </Button>
                              <Button
                                size="sm"
                                variant={timeFilter === 'month' ? 'default' : 'outline'}
                                onClick={() => setTimeFilter('month')}
                                className="flex-1 min-w-[60px] h-7 text-xs"
                              >
                                Mese
                              </Button>
                            </div>

                            <TabsContent value={conversationScope} className="mt-0">
                              {conversationScope === 'internal' && (
                                <Button
                                  size="sm"
                                  onClick={handleCreateConversation}
                                  disabled={createConversationMutation.isPending}
                                  className="h-7 text-xs bg-gradient-to-r from-blue-600 to-purple-600 w-full mb-3"
                                >
                                  <Plus className="h-3 w-3 mr-1" />
                                  Nuova
                                </Button>
                              )}

                              {activeConversationsLoading ? (
                                <div className="flex justify-center py-8">
                                  <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                                </div>
                              ) : filteredConversations.length === 0 ? (
                                <div className="text-center py-8">
                                  <MessageCircle className="h-10 w-10 text-gray-400 mx-auto mb-2" />
                                  <p className="text-sm text-gray-600 mb-3">
                                    {conversationScope === 'internal' ? 'Nessuna conversazione interna' : 'Nessuna conversazione pubblica'}
                                  </p>
                                  {conversationScope === 'internal' && (
                                    <Button
                                      size="sm"
                                      onClick={handleCreateConversation}
                                      disabled={createConversationMutation.isPending}
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Crea conversazione
                                    </Button>
                                  )}
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  {filteredConversations.map((conv) => (
                                    <Card
                                      key={conv.id}
                                      className={`cursor-pointer transition-all duration-200 ${
                                        selectedConversationId === conv.id
                                          ? 'ring-2 ring-purple-500 bg-purple-50'
                                          : 'hover:shadow-md'
                                      }`}
                                      onClick={() => handleConversationSelect(conv.id)}
                                    >
                                      <CardContent className="p-3">
                                        <div className="flex items-center gap-2 mb-1">
                                          <h3 className="font-semibold text-sm text-gray-900">
                                            {conv.title || "Nuova conversazione"}
                                          </h3>
                                          {conversationScope === 'public' && (
                                            <Badge variant="outline" className="text-xs">
                                              Visitatore
                                            </Badge>
                                          )}
                                        </div>
                                        {conversationScope === 'public' && (conv as PublicConversation).shareInfo && (
                                          <div className="text-xs text-blue-600 mb-1">
                                            Link: {(conv as PublicConversation).shareInfo?.slug}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                          <span>{conv.messageCount} msg</span>
                                          {conv.lastMessageAt && (
                                            <>
                                              <span>•</span>
                                              <span>
                                                {formatDistanceToNow(new Date(conv.lastMessageAt), {
                                                  addSuffix: true,
                                                  locale: it,
                                                })}
                                              </span>
                                            </>
                                          )}
                                        </div>
                                      </CardContent>
                                    </Card>
                                  ))}
                                </div>
                              )}
                            </TabsContent>
                          </Tabs>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>

                {/* Right Column (70%) - Chat Area */}
                <div className="col-span-7 flex flex-col bg-gray-50 overflow-hidden min-h-0">
  {!selectedConversationId ? (
                    <div className="flex-1 flex items-center justify-center">
                      <div className="text-center">
                        <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-bold text-gray-700 mb-2">
                          Seleziona una conversazione
                        </h3>
                        <p className="text-gray-500">
                          Seleziona un agente e una conversazione per iniziare a chattare
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Chat Header */}
                      <div className="bg-white border-b p-4">
                        <div className="flex items-center gap-3">
                          <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-lg">
                            <Bot className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h3 className="font-bold">{selectedAgent?.agentName}</h3>
                            <p className="text-sm text-gray-600">
                              {selectedConversation?.title || "Nuova conversazione"}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Messages */}

                      <ScrollArea className="flex-1 min-h-0 p-6" ref={scrollAreaRef}>
                          {messagesLoading ? (
                            <div className="flex justify-center py-12">
                              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                            </div>
                          ) : displayMessages.length === 0 ? (
                            <div className="text-center py-12">
                              <Sparkles className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                              <p className="text-gray-600">Inizia la conversazione con l'agente</p>
                            </div>
                          ) : (
                            <div className="space-y-4 max-w-4xl mx-auto">
                              {displayMessages.map((msg, idx) => {
                                // Map roles based on conversation type
                                let sender: 'consultant' | 'client' | 'ai';
                                let direction: 'inbound' | 'outbound';

                                if (conversationScope === 'internal') {
                                  // Internal: consultant messages on right, agent on left
                                  sender = msg.role === 'consultant' ? 'consultant' : 'ai';
                                  direction = msg.role === 'consultant' ? 'outbound' : 'inbound';
                                } else {
                                  // Public: visitor (user) messages on right, agent on left
                                  sender = msg.role === 'user' ? 'client' : 'ai';
                                  direction = msg.role === 'user' ? 'outbound' : 'inbound';
                                }

                                return (
                                  <div key={msg.id || `msg-${idx}`} className="flex flex-col gap-1">
                                    <WhatsAppMessageBubble
                                      message={{
                                        id: msg.id,
                                        text: msg.content,
                                        sender,
                                        direction,
                                        createdAt: new Date(msg.createdAt),
                                        metadata: msg.status === 'streaming' || msg.status === 'sending' ? { simulated: true } : null,
                                      }}
                                    />
                                    {msg.status === 'sending' && (
                                      <div className={direction === 'inbound' ? 'flex justify-start ml-12 gap-2 items-center' : 'flex justify-end mr-12 gap-2 items-center'}>
                                        <Loader2 className="h-3 w-3 animate-spin text-gray-400" />
                                        <span className="text-xs text-gray-400">Invio in corso...</span>
                                      </div>
                                    )}
                                    {msg.audioUrl && (
                                      <div className={direction === 'inbound' ? 'flex justify-start ml-12' : 'flex justify-end mr-12'}>
                                        <audio
                                          controls
                                          className="w-64 h-10"
                                          preload="metadata"
                                        >
                                          <source src={msg.audioUrl} type={msg.role === 'consultant' || msg.role === 'user' ? 'audio/webm' : 'audio/wav'} />
                                          Il tuo browser non supporta l'elemento audio.
                                        </audio>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              {isStreaming && !streamingMessage && (
                                <div className="flex items-center gap-2 text-gray-500">
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                  L'agente sta pensando...
                                </div>
                              )}

                            </div>
                          )}
                        </ScrollArea>


                      {/* Input Area - Stile WhatsApp moderno */}
                      <div className="bg-white border-t border-gray-200 p-3 shadow-lg flex-shrink-0">
                        {isRecording ? (
                          // Recording UI
                          <div className="flex items-center gap-3 bg-red-50 rounded-3xl px-4 py-3 max-w-4xl mx-auto">
                            <div className="flex items-center gap-2 flex-1">
                              <div className="h-3 w-3 bg-red-500 rounded-full animate-pulse" />
                              <span className="text-red-600 font-medium">{formatRecordingTime(recordingTime)}</span>
                              <span className="text-gray-500 text-sm ml-2">Registrazione in corso...</span>
                            </div>
                            <Button
                              onClick={cancelRecording}
                              size="icon"
                              variant="ghost"
                              className="h-10 w-10 rounded-full text-red-600 hover:bg-red-100"
                            >
                              <X className="h-5 w-5" />
                            </Button>
                            <Button
                              onClick={stopRecording}
                              size="icon"
                              className="h-12 w-12 rounded-full bg-gradient-to-r from-green-500 to-emerald-500"
                            >
                              <Send className="h-5 w-5" />
                            </Button>
                          </div>
                        ) : (
                          // Normal input UI
                          <div className="flex gap-2 items-end max-w-4xl mx-auto">
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleFileSelected}
                              className="hidden"
                            />

                            <Button
                              onClick={handlePhotoCapture}
                              size="icon"
                              variant="ghost"
                              disabled={isStreaming}
                              className="h-10 w-10 rounded-full text-gray-600 hover:bg-gray-100"
                            >
                              <Camera className="h-5 w-5" />
                            </Button>

                            <div className="flex-1 bg-gray-100 rounded-3xl px-4 py-2 flex items-center gap-2">
                              <Input
                                value={messageInput}
                                onChange={(e) => setMessageInput(e.target.value)}
                                placeholder="Messaggio..."
                                disabled={isStreaming}
                                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-gray-500 p-0 h-auto min-h-[28px]"
                                onKeyPress={(e) => {
                                  if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSendMessage();
                                  }
                                }}
                              />
                            </div>

                            {messageInput.trim() ? (
                              <Button
                                onClick={handleSendMessage}
                                disabled={isStreaming}
                                size="icon"
                                className="rounded-full h-12 w-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                              >
                                {isStreaming ? (
                                  <Loader2 className="h-5 w-5 animate-spin" />
                                ) : (
                                  <Send className="h-5 w-5" />
                                )}
                              </Button>
                            ) : (
                              <Button
                                onClick={startRecording}
                                size="icon"
                                className="rounded-full h-12 w-12 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg transition-all duration-200 hover:scale-105 active:scale-95"
                              >
                                <Mic className="h-5 w-5" />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Condivisione Agente</DialogTitle>
            <DialogDescription>
              Gestisci le condivisioni pubbliche per questo agente
            </DialogDescription>
          </DialogHeader>
          {selectedAgentId && selectedAgent && (
            <AgentShareManager
              agentConfigId={selectedAgentId}
              agentName={selectedAgent.agentName}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
