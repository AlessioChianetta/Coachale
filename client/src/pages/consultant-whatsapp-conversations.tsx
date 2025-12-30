import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  MessageSquare,
  Send,
  User,
  Users,
  Circle,
  Bot,
  UserCircle,
  PhoneCall,
  Loader2,
  Filter,
  Check,
  Settings,
  Beaker,
  Mic,
  X,
  XCircle,
  Instagram,
} from "lucide-react";
import WhatsAppLayout from "@/components/whatsapp/WhatsAppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInstagramConversations, useInstagramMessages } from "@/hooks/useInstagram";
import { InstagramMessageBubble } from "@/components/instagram/InstagramMessageBubble";
import { WindowStatusBadge } from "@/components/instagram/WindowStatusBadge";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
import { WhatsAppThreadHeader } from "@/components/whatsapp/WhatsAppThreadHeader";
import { ConsultantAIAssistant } from "@/components/ai-assistant/ConsultantAIAssistant";
import { getAuthHeaders } from "@/lib/auth";
import { formatDistanceToNow } from "date-fns";
import it from "date-fns/locale/it";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft } from "lucide-react";

interface Conversation {
  id: string;
  phoneNumber: string;
  userId: string | null;
  agentConfigId: string | null;
  agentName: string;
  isLead: boolean;
  aiEnabled: boolean;
  lastMessageAt: Date;
  lastMessageFrom: string;
  messageCount: number;
  unreadByConsultant: number;
  metadata: any;
  testModeOverride: "client" | "lead" | "consulente" | null;
  testModeUserId: string | null;
  lastMessage: {
    text: string;
    sender: string;
    createdAt: Date;
  } | null;
}

interface Message {
  id: string;
  text: string;
  direction: "inbound" | "outbound";
  sender: "client" | "consultant" | "ai";
  mediaType: string;
  mediaUrl: string | null;
  twilioStatus: string | null;
  createdAt: Date;
  sentAt: Date | null;
  deliveredAt: Date | null;
  readAt: Date | null;
  metadata?: {
    simulated?: boolean;
    simulatedAt?: string;
    simulatedBy?: string;
  } | null;
  media: {
    fileName: string;
    mimeType: string;
    fileSize: number;
    localPath: string;
    aiAnalysis: string | null;
    extractedText: string | null;
  } | null;
}

type FilterType = "all" | "leads" | "clients" | "unread";

const POLLING_INTERVAL = 5000; // 5 seconds

export default function ConsultantWhatsAppConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [activeChannel, setActiveChannel] = useState<"whatsapp" | "instagram">("whatsapp");
  const [selectedInstagramConversationId, setSelectedInstagramConversationId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [simulateMessageText, setSimulateMessageText] = useState("");
  const [testModeDialogOpen, setTestModeDialogOpen] = useState(false);
  const [testModeOverride, setTestModeOverride] = useState<"client" | "lead" | "consulente" | null>(null);
  const [testModeUserId, setTestModeUserId] = useState<string>("");
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false);
  const [resetConversationId, setResetConversationId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [deleteConversationId, setDeleteConversationId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();

  // Handle URL parameter for direct conversation selection
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationParam = urlParams.get('conversation');
    if (conversationParam && !selectedConversationId) {
      setSelectedConversationId(conversationParam);
      // Clean URL after setting
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Fetch conversations with polling
  const { data: conversationsData } = useQuery({
    queryKey: ["/api/whatsapp/conversations", filter, selectedAgentId],
    queryFn: async () => {
      const params = new URLSearchParams({ filter });
      if (selectedAgentId) {
        params.append('agentId', selectedAgentId);
      }
      const response = await fetch(`/api/whatsapp/conversations?${params.toString()}`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error("Failed to fetch conversations");
      return response.json();
    },
    refetchInterval: POLLING_INTERVAL,
  });

  const conversations: Conversation[] = conversationsData?.conversations || [];

  // Fetch WhatsApp configs to check concise mode and get agent list
  const { data: whatsappConfigData } = useQuery({
    queryKey: ["/api/whatsapp/config"],
    queryFn: async () => {
      const response = await fetch("/api/whatsapp/config", {
        headers: getAuthHeaders(),
      });
      if (!response.ok) return null;
      return response.json();
    },
  });

  const whatsappConfig = whatsappConfigData?.config || null;
  const whatsappAgents = whatsappConfigData?.configs || [];

  // Fetch messages for selected conversation with polling
  const { data: messagesData, isLoading: messagesLoading } = useQuery({
    queryKey: ["/api/whatsapp/conversations", selectedConversationId, "messages"],
    queryFn: async () => {
      if (!selectedConversationId) return null;
      const response = await fetch(
        `/api/whatsapp/conversations/${selectedConversationId}/messages`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to fetch messages");
      return response.json();
    },
    enabled: !!selectedConversationId,
    refetchInterval: selectedConversationId ? POLLING_INTERVAL : false,
  });

  const messages: Message[] = messagesData?.messages || [];
  const conversationInfo = messagesData?.conversation;

  // Instagram queries
  const { 
    data: instagramConversationsData, 
    isLoading: instagramConversationsLoading,
    isError: instagramConversationsError 
  } = useInstagramConversations({ refetchInterval: 5000 });
  const instagramConversations = instagramConversationsData?.conversations || [];

  const { 
    data: instagramMessagesData, 
    isLoading: instagramMessagesLoading,
    isError: instagramMessagesError 
  } = useInstagramMessages(
    selectedInstagramConversationId,
    { refetchInterval: 5000 }
  );
  const instagramMessages = instagramMessagesData?.messages || [];
  const instagramConversationInfo = instagramMessagesData?.conversation;

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark conversation as read when opened
  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  // Cleanup recording timer
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; text: string }) => {
      const response = await fetch(`/api/whatsapp/conversations/${data.conversationId}/send`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText: data.text }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to send message");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      setMessageText("");
      toast({
        title: "✅ Messaggio inviato",
        description: "Il messaggio è stato inviato con successo.",
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

  // Toggle AI mutation
  const toggleAIMutation = useMutation({
    mutationFn: async (data: { conversationId: string; aiEnabled: boolean }) => {
      const response = await fetch(
        `/api/whatsapp/conversations/${data.conversationId}/ai-toggle`,
        {
          method: "PATCH",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ aiEnabled: data.aiEnabled }),
        }
      );
      if (!response.ok) throw new Error("Failed to toggle AI");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({
        title: "✅ Impostazione aggiornata",
        description: "Le impostazioni AI sono state aggiornate.",
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

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(
        `/api/whatsapp/conversations/${conversationId}/mark-read`,
        {
          method: "PATCH",
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) throw new Error("Failed to mark as read");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
    },
  });

  // Reset conversation mutation
  const resetConversationMutation = useMutation({
    mutationFn: async (data: { conversationId: string; phoneNumber: string }) => {
      const response = await fetch(
        `/api/whatsapp/conversations/${data.conversationId}/reset`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to reset conversation");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      toast({
        title: "✅ Conversazione resettata",
        description: "La conversazione è stata resettata con successo.",
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

  // Delete conversation mutation
  const deleteConversationMutation = useMutation({
    mutationFn: async (conversationId: string) => {
      const response = await fetch(
        `/api/whatsapp/conversations/${conversationId}`,
        {
          method: "DELETE",
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Failed to delete conversation" }));
        throw new Error(errorData.message || "Failed to delete conversation");
      }
      // Check if there's a response body before parsing JSON
      const text = await response.text();
      return text ? JSON.parse(text) : {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      setSelectedConversationId(null);
      toast({
        title: "✅ Chat cancellata",
        description: "La conversazione è stata eliminata definitivamente.",
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

  // Simulate customer message mutation (dry run only)
  const simulateMessageMutation = useMutation({
    mutationFn: async (data: { conversationId: string; text: string }) => {
      const response = await fetch(`/api/whatsapp/conversations/${data.conversationId}/simulate`, {
        method: "POST",
        headers: {
          ...getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messageText: data.text }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to simulate message");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", selectedConversationId, "messages"] });
      setSimulateMessageText("");
      toast({
        title: "🧪 Messaggio simulato inviato",
        description: "Il messaggio cliente è stato simulato. L'AI dovrebbe rispondere a breve.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Errore simulazione",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Test mode mutation
  const testModeMutation = useMutation({
    mutationFn: async (data: { conversationId: string; testModeOverride: "client" | "lead" | "consulente" | null; testModeUserId?: string }) => {
      const response = await fetch(
        `/api/whatsapp/conversations/${data.conversationId}/test-mode`,
        {
          method: "POST",
          headers: {
            ...getAuthHeaders(),
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            testModeOverride: data.testModeOverride,
            testModeUserId: data.testModeUserId || null,
          }),
        }
      );
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to configure test mode");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      setTestModeDialogOpen(false);
      toast({
        title: "✅ Modalità test configurata",
        description: "La modalità test è stata configurata con successo.",
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

  // Search users query
  const { data: usersData } = useQuery({
    queryKey: ["/api/whatsapp/users/search", userSearchQuery],
    queryFn: async () => {
      if (!userSearchQuery || userSearchQuery.length < 2) return [];
      const response = await fetch(
        `/api/whatsapp/users/search?query=${encodeURIComponent(userSearchQuery)}`,
        {
          headers: getAuthHeaders(),
        }
      );
      if (!response.ok) return [];
      return response.json();
    },
    enabled: userSearchQuery.length >= 2,
  });

  const users = usersData || [];

  const handleSendMessage = () => {
    if (!selectedConversationId || !messageText.trim()) return;

    sendMessageMutation.mutate({
      conversationId: selectedConversationId,
      text: messageText.trim(),
    });
  };

  const handleSimulateMessage = () => {
    if (!selectedConversationId || !simulateMessageText.trim()) return;

    simulateMessageMutation.mutate({
      conversationId: selectedConversationId,
      text: simulateMessageText.trim(),
    });
  };

  // Upload and send audio message
  const uploadAndSendAudio = async (audioBlob: Blob) => {
    if (!selectedConversationId) {
      toast({
        title: "Errore",
        description: "Seleziona una conversazione prima di registrare",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append('audio', audioBlob, 'recording.webm');
    formData.append('conversationId', selectedConversationId);

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/whatsapp/simulate-audio', {
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
        title: "🧪 Nota vocale simulata",
        description: result.transcription ? `Trascritto: "${result.transcription.substring(0, 50)}..."` : "Audio inviato con successo",
      });

      // Refetch messages to show transcription and response
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/whatsapp/conversations", selectedConversationId, "messages"] });

    } catch (err: any) {
      toast({
        title: "Errore",
        description: err.message || "Impossibile inviare l'audio",
        variant: "destructive",
      });
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

  const handleToggleAI = (conversationId: string, currentState: boolean) => {
    toggleAIMutation.mutate({
      conversationId,
      aiEnabled: !currentState,
    });
  };

  const onAction = (phoneNumber: string, action: string) => {
    if (action === "reset" && selectedConversationId) {
      resetConversationMutation.mutate({
        conversationId: selectedConversationId,
        phoneNumber,
      });
    }
  };

  const selectedConversation = conversations.find((c) => c.id === selectedConversationId);

  // Detect if current conversation is in dry run mode
  const isDryRun = selectedConversation?.agentConfigId 
    ? whatsappAgents.find((a: any) => a.id === selectedConversation.agentConfigId)?.isDryRun === true
    : false;

  // Sync test mode state with selected conversation
  useEffect(() => {
    if (selectedConversation) {
      setTestModeOverride(selectedConversation.testModeOverride);
      setTestModeUserId(selectedConversation.testModeUserId || "");
      setUserSearchQuery("");
    } else {
      setTestModeOverride(null);
      setTestModeUserId("");
      setUserSearchQuery("");
    }
  }, [selectedConversation?.id, selectedConversation?.testModeOverride, selectedConversation?.testModeUserId]);

  return (
    <WhatsAppLayout showHeader={false}>
      <div className="w-full h-full px-4 lg:px-6">
            {/* Header */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 blur-3xl -z-10"></div>
                <h1 className="text-3xl lg:text-4xl font-bold bg-gradient-to-r from-green-600 via-emerald-600 to-teal-600 bg-clip-text text-transparent flex items-center gap-3">
                  <div className="bg-gradient-to-br from-green-500 to-emerald-600 p-2 lg:p-2.5 rounded-xl shadow-lg shadow-green-500/20">
                    <MessageSquare className="h-6 w-6 lg:h-8 lg:w-8 text-white" />
                  </div>
                  Conversazioni
                </h1>
                <p className="mt-2 text-sm lg:text-base text-gray-600 dark:text-gray-400 ml-[52px] lg:ml-[60px]">
                  Gestisci le conversazioni con i tuoi clienti e lead
                </p>
              </div>
            </div>

            {/* Channel Tabs */}
            <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as "whatsapp" | "instagram")} className="w-full">
              <TabsList className="grid w-full max-w-md grid-cols-2 mb-4">
                <TabsTrigger value="whatsapp" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                  <MessageSquare className="h-4 w-4 mr-2" />
                  WhatsApp
                </TabsTrigger>
                <TabsTrigger value="instagram" className="data-[state=active]:bg-cyan-100 data-[state=active]:text-cyan-700">
                  <Instagram className="h-4 w-4 mr-2" />
                  Instagram
                </TabsTrigger>
              </TabsList>

              <TabsContent value="whatsapp" className="mt-0">
                {/* WhatsApp Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 h-[calc(100vh-230px)] w-full overflow-hidden">
              {/* Conversations List - Hidden on mobile when chat is open */}
              {(!isMobile || !selectedConversationId) && (
              <Card className="lg:col-span-4 overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl">
                <CardHeader className="pb-4 border-b border-gray-100 dark:border-gray-800 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-900/10 dark:to-emerald-900/10">
                  <CardTitle className="flex items-center justify-between text-lg font-bold">
                    <span className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
                      Conversazioni
                    </span>
                    <Badge variant="secondary" className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 shadow-md">
                      {conversations.length}
                    </Badge>
                  </CardTitle>

                  {/* Filters */}
                  <div className="space-y-3 mt-4">
                    <div className="flex gap-1.5 sm:gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant={filter === "all" ? "default" : "outline"}
                        onClick={() => setFilter("all")}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[44px] sm:min-h-0 font-semibold transition-all duration-200 ${
                          filter === "all" 
                            ? "bg-gradient-to-r from-blue-600 to-indigo-600 shadow-lg shadow-blue-500/30" 
                            : "hover:shadow-md hover:border-blue-300 active:scale-95"
                        }`}
                      >
                        🔵 Tutte
                      </Button>
                      <Button
                        size="sm"
                        variant={filter === "leads" ? "default" : "outline"}
                        onClick={() => setFilter("leads")}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[44px] sm:min-h-0 font-semibold transition-all duration-200 ${
                          filter === "leads" 
                            ? "bg-gradient-to-r from-purple-600 to-pink-600 shadow-lg shadow-purple-500/30" 
                            : "hover:shadow-md hover:border-purple-300 active:scale-95"
                        }`}
                      >
                        🎯 Lead
                      </Button>
                      <Button
                        size="sm"
                        variant={filter === "clients" ? "default" : "outline"}
                        onClick={() => setFilter("clients")}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[44px] sm:min-h-0 font-semibold transition-all duration-200 ${
                          filter === "clients" 
                            ? "bg-gradient-to-r from-green-600 to-emerald-600 shadow-lg shadow-green-500/30" 
                            : "hover:shadow-md hover:border-green-300 active:scale-95"
                        }`}
                      >
                        ✅ Clienti
                      </Button>
                      <Button
                        size="sm"
                        variant={filter === "unread" ? "default" : "outline"}
                        onClick={() => setFilter("unread")}
                        className={`text-[10px] sm:text-xs px-2 sm:px-3 py-1.5 sm:py-2 h-auto min-h-[44px] sm:min-h-0 font-semibold transition-all duration-200 ${
                          filter === "unread" 
                            ? "bg-gradient-to-r from-orange-600 to-red-600 shadow-lg shadow-orange-500/30" 
                            : "hover:shadow-md hover:border-orange-300 active:scale-95"
                        }`}
                      >
                        🔔 Non letti
                      </Button>
                    </div>

                    {/* Agent Filter */}
                    {whatsappAgents.length > 1 && (
                      <div className="flex items-center gap-2">
                        <Bot className="h-4 w-4 text-gray-500" />
                        <Select
                          value={selectedAgentId || "all"}
                          onValueChange={(value) => setSelectedAgentId(value === "all" ? null : value)}
                        >
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue placeholder="Tutti gli agenti" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti gli agenti</SelectItem>
                            {whatsappAgents.map((agent: any) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.agentName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <ScrollArea className="h-[calc(100vh-350px)]">
                    {conversations.length === 0 ? (
                      <div className="flex flex-col items-center justify-center p-8 text-center">
                        <MessageSquare className="h-12 w-12 text-gray-400 mb-3" />
                        <p className="text-gray-600 dark:text-gray-400">
                          Nessuna conversazione
                        </p>
                      </div>
                    ) : (
                      conversations.map((conv) => {
                        const getInitials = (phoneNumber: string) => {
                          const digits = phoneNumber.replace(/\D/g, "");
                          return digits.slice(-2) || "??";
                        };

                        // Badge resolution with priority: testModeOverride > metadata.participantType > isLead
                        const getBadgeInfo = () => {
                          // Priority 1: testModeOverride
                          if (conv.testModeOverride === "consulente") {
                            return { label: "Consulente", className: "bg-cyan-500 hover:bg-cyan-500 text-white" };
                          }
                          if (conv.testModeOverride === "lead") {
                            return { label: "Lead", className: "bg-purple-500 hover:bg-purple-500 text-white" };
                          }
                          if (conv.testModeOverride === "client") {
                            return { label: "Cliente", className: "bg-green-600 hover:bg-green-600 text-white" };
                          }

                          // Priority 2: metadata.participantType
                          const participantType = (conv.metadata as any)?.participantType;
                          if (participantType === "consultant") {
                            return { label: "Consulente", className: "bg-cyan-500 hover:bg-cyan-500 text-white" };
                          }
                          if (participantType === "receptionist") {
                            return { label: "Receptionist", className: "bg-amber-500 hover:bg-amber-500 text-white" };
                          }
                          if (participantType === "client") {
                            return { label: "Cliente", className: "bg-green-600 hover:bg-green-600 text-white" };
                          }
                          if (participantType === "unknown") {
                            return { label: "Lead", className: "bg-purple-500 hover:bg-purple-500 text-white" };
                          }

                          // Priority 3: isLead fallback
                          if (conv.isLead) {
                            return { label: "Lead", className: "bg-purple-500 hover:bg-purple-500 text-white" };
                          }

                          // Default: Cliente
                          return { label: "Cliente", className: "bg-green-600 hover:bg-green-600 text-white" };
                        };

                        const badgeInfo = getBadgeInfo();

                        return (
                        <div
                          key={conv.id}
                          className={`p-3 sm:p-4 border-b cursor-pointer transition-all duration-150 ${
                            selectedConversationId === conv.id
                              ? "bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500"
                              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
                          }`}
                          onClick={() => setSelectedConversationId(conv.id)}
                        >
                          <div className="flex items-start gap-2 sm:gap-3">
                            <Avatar className="h-10 w-10 sm:h-11 sm:w-11 flex-shrink-0">
                              <AvatarFallback className={`${
                                badgeInfo.label === "Consulente" ? "bg-cyan-500" :
                                badgeInfo.label === "Receptionist" ? "bg-amber-500" :
                                badgeInfo.label === "Lead" ? "bg-purple-500" : "bg-green-600"
                              } text-white font-semibold text-sm`}>
                                {getInitials(conv.phoneNumber)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1 gap-2">
                                <p className={`text-xs sm:text-sm text-gray-900 dark:text-white truncate ${
                                  conv.unreadByConsultant > 0 ? "font-bold" : "font-medium"
                                }`}>
                                  {conv.phoneNumber}
                                </p>
                                {conv.unreadByConsultant > 0 && (
                                  <Badge className="h-5 min-w-[20px] px-1.5 sm:px-2 text-xs bg-blue-600 hover:bg-blue-600">
                                    {conv.unreadByConsultant}
                                  </Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1 sm:gap-1.5 mb-1.5 flex-wrap">
                                <Badge className={`text-[10px] sm:text-xs py-0.5 px-1.5 sm:px-2 ${badgeInfo.className}`}>
                                  {badgeInfo.label}
                                </Badge>
                                {conv.isProactiveLead && (
                                  <Badge className="text-[10px] sm:text-xs py-0.5 px-1.5 sm:px-2 bg-orange-500 hover:bg-orange-500 text-white">
                                    Proattivo
                                  </Badge>
                                )}
                                {conv.agentName && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0.5 px-1 sm:px-1.5 text-gray-600 dark:text-gray-300">
                                    {conv.agentName.split(' ')[0]}
                                  </Badge>
                                )}
                                {conv.aiEnabled && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0.5 px-1 sm:px-1.5 text-blue-600 dark:text-blue-400">
                                    AI
                                  </Badge>
                                )}
                                {conv.agentConfigId && (() => {
                                  const agent = whatsappAgents.find((a: any) => a.id === conv.agentConfigId);
                                  return agent?.isDryRun === true && (
                                    <Badge variant="outline" className="text-[10px] sm:text-xs py-0.5 px-1 sm:px-1.5 text-orange-600 dark:text-orange-400 border-orange-300">
                                      🧪 Dry Run
                                    </Badge>
                                  );
                                })()}
                                {conv.testModeOverride && (
                                  <Badge variant="outline" className="text-[10px] sm:text-xs py-0.5 px-1 sm:px-1.5 text-yellow-700 dark:text-yellow-400 border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20">
                                    Test: {conv.testModeOverride === "lead" ? "Lead" : conv.testModeOverride === "consulente" ? "Consulente" : "Cliente"}
                                  </Badge>
                                )}
                              </div>
                              {conv.lastMessage && (
                                <p className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2 leading-relaxed">
                                  {conv.lastMessage.text}
                                </p>
                              )}
                              <p className="text-[10px] sm:text-xs text-gray-500 mt-1">
                                {formatDistanceToNow(new Date(conv.lastMessageAt), {
                                  addSuffix: true,
                                  locale: it,
                                })}
                              </p>
                            </div>
                          </div>
                        </div>
                        );
                      })
                    )}
                  </ScrollArea>
                </CardContent>
              </Card>
              )}

              {/* Chat View - Hidden on mobile when no conversation selected */}
              {(!isMobile || selectedConversationId) && (
              <Card className="lg:col-span-8 flex flex-col overflow-hidden border-2 border-gray-100 dark:border-gray-800 shadow-xl bg-white/80 dark:bg-gray-900/80 backdrop-blur-md rounded-2xl">
                {selectedConversation ? (
                  <>
                    {/* Mobile Back Button */}
                    {isMobile && (
                      <div className="flex items-center gap-2 p-3 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedConversationId(null)}
                          className="flex items-center gap-2"
                        >
                          <ArrowLeft className="h-4 w-4" />
                          <span>Conversazioni</span>
                        </Button>
                      </div>
                    )}
                    
                    {/* Chat Header */}
                    <WhatsAppThreadHeader
                      conversation={{
                        phoneNumber: selectedConversation.phoneNumber,
                        isLead: selectedConversation.isLead,
                        agentName: selectedConversation.agentName,
                        aiEnabled: conversationInfo?.aiEnabled ?? selectedConversation.aiEnabled,
                        isDryRun: isDryRun,
                        testModeOverride: selectedConversation.testModeOverride,
                        metadata: selectedConversation.metadata,
                      }}
                      onToggleAI={() => handleToggleAI(selectedConversation.id, conversationInfo?.aiEnabled ?? selectedConversation.aiEnabled)}
                      onReset={() => {
                        setResetConversationId(selectedConversation.id);
                        setIsResetDialogOpen(true);
                      }}
                      onDelete={() => {
                        setDeleteConversationId(selectedConversation.id);
                        setIsDeleteDialogOpen(true);
                      }}
                    />

                    {/* Test Mode Badge & Button */}
                    {selectedConversation.testModeOverride && (
                      <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30">
                              <Beaker className="h-3 w-3 mr-1" />
                              Test Mode: {selectedConversation.testModeOverride === "lead" ? "Lead" : selectedConversation.testModeOverride === "consulente" ? "Consulente" : "Cliente"}
                            </Badge>
                            <span className="text-xs text-yellow-700 dark:text-yellow-300">
                              {selectedConversation.messageCount} messaggi
                            </span>
                          </div>
                          <Dialog open={testModeDialogOpen} onOpenChange={setTestModeDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-xs">
                                <Settings className="h-3 w-3 mr-1" />
                                Configura
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modalità Test</DialogTitle>
                                <DialogDescription>
                                  Configura come deve comportarsi l'AI con questo numero per i test
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="test-mode-select">Tipo di Test</Label>
                                  <Select value={testModeOverride || "disabled"} onValueChange={(v) => setTestModeOverride(v === "disabled" ? null : v as any)}>
                                    <SelectTrigger id="test-mode-select">
                                      <SelectValue placeholder="Seleziona modalità" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="disabled">Disattivato (Auto)</SelectItem>
                                      <SelectItem value="client">Simula Cliente Esistente</SelectItem>
                                      <SelectItem value="lead">Simula Lead</SelectItem>
                                      <SelectItem value="consulente">Simula Consulente</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {testModeOverride === "client" && (
                                  <div>
                                    <Label htmlFor="user-search">Cerca Cliente</Label>
                                    <Input
                                      id="user-search"
                                      placeholder="Cerca per email..."
                                      value={userSearchQuery}
                                      onChange={(e) => setUserSearchQuery(e.target.value)}
                                      className="mb-2"
                                    />
                                    {users.length > 0 && (
                                      <ScrollArea className="h-32 border rounded p-2">
                                        {users.map((user: any) => (
                                          <div
                                            key={user.id}
                                            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded ${
                                              testModeUserId === user.id ? "bg-blue-100 dark:bg-blue-900" : ""
                                            }`}
                                            onClick={() => {
                                              setTestModeUserId(user.id);
                                              setUserSearchQuery(user.email);
                                            }}
                                          >
                                            <div className="font-medium">{user.email}</div>
                                            <div className="text-xs text-gray-500">
                                              {user.firstName} {user.lastName}
                                            </div>
                                          </div>
                                        ))}
                                      </ScrollArea>
                                    )}
                                  </div>
                                )}
                                <Button
                                  onClick={() => {
                                    testModeMutation.mutate({
                                      conversationId: selectedConversation.id,
                                      testModeOverride,
                                      testModeUserId: testModeOverride === "client" ? testModeUserId : undefined,
                                    });
                                  }}
                                  disabled={testModeOverride === "client" && !testModeUserId}
                                  className="w-full"
                                >
                                  Salva Configurazione
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    )}

                    {/* Dry Run Banner */}
                    {isDryRun && (
                      <div className="bg-gradient-to-r from-orange-50 via-amber-50 to-orange-50 dark:from-orange-900/40 dark:via-amber-900/40 dark:to-orange-900/40 border-b border-orange-300 dark:border-orange-700 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <div className="flex-shrink-0 bg-orange-500 p-1 rounded shadow-sm">
                              <Beaker className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-xs text-orange-900 dark:text-orange-100">
                                  🧪 Dry Run
                                </span>
                                <Badge className="bg-orange-600 text-white text-[9px] px-1 py-0">TEST</Badge>
                                <span className="text-[10px] text-orange-700 dark:text-orange-300">
                                  Nessun messaggio reale inviato
                                </span>
                              </div>
                            </div>
                          </div>
                          <Dialog open={testModeDialogOpen} onOpenChange={setTestModeDialogOpen}>
                            <DialogTrigger asChild>
                              <Button variant="outline" size="sm" className="text-xs h-7">
                                <Settings className="h-3 w-3 mr-1" />
                                Test Mode
                              </Button>
                            </DialogTrigger>
                            <DialogContent>
                              <DialogHeader>
                                <DialogTitle>Modalità Test</DialogTitle>
                                <DialogDescription>
                                  Configura come deve comportarsi l'AI con questo numero per i test
                                </DialogDescription>
                              </DialogHeader>
                              <div className="space-y-4 mt-4">
                                <div>
                                  <Label htmlFor="test-mode-select-dry">Tipo di Test</Label>
                                  <Select value={testModeOverride || "disabled"} onValueChange={(v) => setTestModeOverride(v === "disabled" ? null : v as any)}>
                                    <SelectTrigger id="test-mode-select-dry">
                                      <SelectValue placeholder="Seleziona modalità" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="disabled">Disattivato (Auto)</SelectItem>
                                      <SelectItem value="client">Simula Cliente Esistente</SelectItem>
                                      <SelectItem value="lead">Simula Lead</SelectItem>
                                      <SelectItem value="consulente">Simula Consulente</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                                {testModeOverride === "client" && (
                                  <div>
                                    <Label htmlFor="user-search-dry">Cerca Cliente</Label>
                                    <Input
                                      id="user-search-dry"
                                      placeholder="Cerca per email..."
                                      value={userSearchQuery}
                                      onChange={(e) => setUserSearchQuery(e.target.value)}
                                      className="mb-2"
                                    />
                                    {users.length > 0 && (
                                      <ScrollArea className="h-32 border rounded p-2">
                                        {users.map((user: any) => (
                                          <div
                                            key={user.id}
                                            className={`p-2 hover:bg-gray-100 dark:hover:bg-gray-800 cursor-pointer rounded ${
                                              testModeUserId === user.id ? "bg-blue-100 dark:bg-blue-900" : ""
                                            }`}
                                            onClick={() => {
                                              setTestModeUserId(user.id);
                                              setUserSearchQuery(user.email);
                                            }}
                                          >
                                            <div className="font-medium">{user.email}</div>
                                            <div className="text-xs text-gray-500">
                                              {user.firstName} {user.lastName}
                                            </div>
                                          </div>
                                        ))}
                                      </ScrollArea>
                                    )}
                                  </div>
                                )}
                                <Button
                                  onClick={() => {
                                    testModeMutation.mutate({
                                      conversationId: selectedConversation.id,
                                      testModeOverride,
                                      testModeUserId: testModeOverride === "client" ? testModeUserId : undefined,
                                    });
                                  }}
                                  disabled={testModeOverride === "client" && !testModeUserId}
                                  className="w-full"
                                >
                                  Salva Configurazione
                                </Button>
                              </div>
                            </DialogContent>
                          </Dialog>
                        </div>
                      </div>
                    )}

                    {/* Messages */}
                    <CardContent className="flex-1 p-4 overflow-hidden">
                      <ScrollArea className="h-full">
                        {messagesLoading ? (
                          <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                          </div>
                        ) : (
                          <div className="space-y-3 sm:space-y-4 px-1 py-4">
                            {messages.map((msg) => (
                              <WhatsAppMessageBubble
                                key={msg.id}
                                message={msg}
                              />
                            ))}
                            <div ref={messagesEndRef} />
                          </div>
                        )}
                      </ScrollArea>
                    </CardContent>

                    {/* Message Input */}
                    <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gradient-to-r from-gray-50/50 to-blue-50/30 dark:from-gray-900/50 dark:to-blue-900/10">
                      <div className="flex gap-3">
                        <Input
                          placeholder="💬 Scrivi un messaggio..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                              e.preventDefault();
                              handleSendMessage();
                            }
                          }}
                          disabled={sendMessageMutation.isPending}
                          className="border-2 border-gray-200 dark:border-gray-700 focus:border-blue-500 dark:focus:border-blue-500 shadow-sm transition-all duration-200"
                        />
                        <Button
                          onClick={handleSendMessage}
                          disabled={!messageText.trim() || sendMessageMutation.isPending}
                          className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-500/30 transition-all duration-200 hover:scale-105"
                        >
                          {sendMessageMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Send className="h-4 w-4" />
                          )}
                        </Button>
                      </div>

                      {/* Dry Run Simulator Panel */}
                      {isDryRun && (
                        <div className="mt-3 pt-2.5 border-t border-orange-300 dark:border-orange-700 bg-gradient-to-br from-orange-50/50 via-amber-50/50 to-orange-50/50 dark:from-orange-900/20 dark:via-amber-900/20 dark:to-orange-900/20 -mx-4 -mb-4 px-2.5 pb-3 rounded-b-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="bg-gradient-to-br from-orange-500 to-amber-600 p-1 rounded shadow-sm">
                              <Beaker className="h-3 w-3 text-white" />
                            </div>
                            <div className="flex-1">
                              <h3 className="text-xs font-semibold text-orange-900 dark:text-orange-100">
                                🧪 Simulatore Cliente
                              </h3>
                            </div>
                          </div>

                          {isRecording ? (
                            <div className="flex items-center gap-3 bg-red-50 rounded-3xl px-4 py-2.5">
                              <div className="flex items-center gap-2 flex-1">
                                <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                                <span className="text-red-600 font-medium text-xs">{formatRecordingTime(recordingTime)}</span>
                                <span className="text-gray-500 text-[10px] ml-2">Registrazione in corso...</span>
                              </div>
                              <Button
                                onClick={cancelRecording}
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 rounded-full text-red-600 hover:bg-red-100"
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                onClick={stopRecording}
                                size="icon"
                                className="h-9 w-9 rounded-full bg-gradient-to-r from-orange-500 to-amber-500"
                              >
                                <Send className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div className="flex gap-2 items-end">
                                <div className="flex-1 bg-white dark:bg-gray-800 rounded-2xl px-3 py-1.5 flex items-center gap-2 border border-orange-200 dark:border-orange-700">
                                  <Input
                                    placeholder="Scrivi come cliente..."
                                    value={simulateMessageText}
                                    onChange={(e) => setSimulateMessageText(e.target.value)}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSimulateMessage();
                                      }
                                    }}
                                    disabled={simulateMessageMutation.isPending}
                                    className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-xs placeholder:text-gray-500 p-0 h-auto min-h-[20px]"
                                  />
                                </div>

                                {simulateMessageText.trim() ? (
                                  <Button
                                    onClick={handleSimulateMessage}
                                    disabled={simulateMessageMutation.isPending}
                                    size="icon"
                                    className="rounded-full h-9 w-9 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                                  >
                                    {simulateMessageMutation.isPending ? (
                                      <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                      <Send className="h-4 w-4" />
                                    )}
                                  </Button>
                                ) : (
                                  <Button
                                    onClick={startRecording}
                                    size="icon"
                                    className="rounded-full h-9 w-9 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 shadow-md transition-all duration-200 hover:scale-105 active:scale-95"
                                  >
                                    <Mic className="h-4 w-4" />
                                  </Button>
                                )}
                              </div>
                              <div className="mt-2 p-1.5 bg-orange-100/50 dark:bg-orange-900/20 rounded border border-orange-200 dark:border-orange-800">
                                <p className="text-[9px] text-orange-700 dark:text-orange-300">
                                  💡 Il messaggio viene processato dall'AI{conversationInfo?.aiEnabled && <span className="font-semibold"> che risponderà automaticamente</span>}
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                    <MessageSquare className="h-16 w-16 text-gray-400 mb-4" />
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Seleziona una conversazione
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Scegli una conversazione dalla lista per iniziare a chattare
                    </p>
                  </div>
                )}
              </Card>
              )}
                </div>
              </TabsContent>

              <TabsContent value="instagram" className="mt-0">
                {/* Instagram-style Layout */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-0 h-[calc(100vh-230px)] bg-white dark:bg-zinc-900 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800">
                  {/* Lista conversazioni Instagram - Sidebar style */}
                  <div className="lg:col-span-1 border-r border-zinc-200 dark:border-zinc-800 flex flex-col">
                    {/* Header con logo Instagram */}
                    <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                        <Instagram className="h-5 w-5 text-white" />
                      </div>
                      <span className="font-semibold text-zinc-900 dark:text-white">Messaggi</span>
                    </div>
                    
                    <ScrollArea className="flex-1">
                      {instagramConversationsLoading ? (
                        <div className="flex items-center justify-center p-8">
                          <Loader2 className="h-6 w-6 animate-spin text-pink-500" />
                        </div>
                      ) : instagramConversationsError ? (
                        <div className="p-4 text-center text-red-500">
                          <XCircle className="h-12 w-12 mx-auto mb-2 text-red-300" />
                          <p className="text-sm">Errore nel caricamento</p>
                        </div>
                      ) : instagramConversations.length === 0 ? (
                        <div className="p-8 text-center">
                          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center mx-auto mb-4">
                            <Instagram className="h-8 w-8 text-white" />
                          </div>
                          <p className="text-zinc-500 dark:text-zinc-400 text-sm">Nessun messaggio</p>
                          <p className="text-zinc-400 dark:text-zinc-500 text-xs mt-1">I nuovi messaggi appariranno qui</p>
                        </div>
                      ) : (
                        instagramConversations.map((conv) => (
                          <div
                            key={conv.id}
                            onClick={() => setSelectedInstagramConversationId(conv.id)}
                            className={`px-4 py-3 cursor-pointer transition-colors flex items-center gap-3 ${
                              selectedInstagramConversationId === conv.id 
                                ? "bg-zinc-100 dark:bg-zinc-800" 
                                : "hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                            }`}
                          >
                            {/* Avatar con bordo gradient Instagram */}
                            <div className="relative">
                              <div className="w-14 h-14 rounded-full p-[2px] bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
                                <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 p-[2px]">
                                  <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                    <User className="h-6 w-6 text-zinc-500 dark:text-zinc-400" />
                                  </div>
                                </div>
                              </div>
                              {conv.isWindowOpen && (
                                <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-zinc-900" />
                              )}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-sm text-zinc-900 dark:text-white truncate">
                                  {conv.instagramUsername ? `@${conv.instagramUsername}` : conv.instagramUserId}
                                </span>
                                {conv.lastMessageAt && (
                                  <span className="text-xs text-zinc-400">
                                    {formatDistanceToNow(new Date(conv.lastMessageAt), { addSuffix: false, locale: it }).replace("circa ", "")}
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                                {conv.lastMessageText || "Messaggio"}
                              </p>
                            </div>
                            
                            {conv.unreadByConsultant > 0 && (
                              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-600 to-pink-500 flex items-center justify-center">
                                <span className="text-[10px] font-bold text-white">{conv.unreadByConsultant}</span>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </ScrollArea>
                  </div>

                  {/* Area messaggi Instagram */}
                  <div className="lg:col-span-2 flex flex-col bg-white dark:bg-zinc-900">
                    {!selectedInstagramConversationId ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                        <div className="w-24 h-24 rounded-full border-2 border-zinc-900 dark:border-white flex items-center justify-center mb-4">
                          <svg className="w-12 h-12 text-zinc-900 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                          </svg>
                        </div>
                        <h3 className="text-xl font-medium text-zinc-900 dark:text-white mb-1">I tuoi messaggi</h3>
                        <p className="text-zinc-500 dark:text-zinc-400 text-sm">Seleziona una conversazione per iniziare</p>
                      </div>
                    ) : (
                      <>
                        {/* Header conversazione */}
                        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400">
                            <div className="w-full h-full rounded-full bg-white dark:bg-zinc-900 p-[2px]">
                              <div className="w-full h-full rounded-full bg-zinc-200 dark:bg-zinc-700 flex items-center justify-center">
                                <User className="h-5 w-5 text-zinc-500 dark:text-zinc-400" />
                              </div>
                            </div>
                          </div>
                          <div className="flex-1">
                            <span className="font-semibold text-zinc-900 dark:text-white">
                              {instagramConversationInfo?.instagramUsername ? `@${instagramConversationInfo.instagramUsername}` : "Utente"}
                            </span>
                            <div className="flex items-center gap-2">
                              <WindowStatusBadge isWindowOpen={instagramConversationInfo?.isWindowOpen || false} windowExpiresAt={instagramConversationInfo?.windowExpiresAt || null} />
                            </div>
                          </div>
                        </div>

                        {/* Area messaggi */}
                        <ScrollArea className="h-[calc(100vh-350px)] bg-white dark:bg-zinc-900">
                          <div className="p-4">
                            {instagramMessagesLoading ? (
                              <div className="flex items-center justify-center h-40">
                                <Loader2 className="h-8 w-8 animate-spin text-pink-500" />
                              </div>
                            ) : instagramMessages.length === 0 ? (
                              <div className="flex items-center justify-center h-40 text-zinc-400">
                                <p className="text-sm">Nessun messaggio in questa conversazione</p>
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {instagramMessages.map((msg: any) => (
                                  <InstagramMessageBubble key={msg.id} message={msg} />
                                ))}
                              </div>
                            )}
                          </div>
                        </ScrollArea>
                      </>
                    )}
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>

          {/* Reset Conversation Dialog */}
          <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Resettare la conversazione?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione resetterà lo storico della conversazione. L'AI ricomincerà da capo come se fosse un nuovo contatto.
                  I messaggi precedenti rimarranno visibili ma il contesto conversazionale verrà azzerato.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setResetConversationId(null)}>
                  Annulla
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (resetConversationId) {
                      const conv = conversations.find(c => c.id === resetConversationId);
                      if (conv) {
                        resetConversationMutation.mutate({
                          conversationId: resetConversationId,
                          phoneNumber: conv.phoneNumber,
                        });
                      }
                      setResetConversationId(null);
                      setIsResetDialogOpen(false);
                    }
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  Reset Conversazione
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Delete Conversation Dialog */}
          <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Eliminare definitivamente la conversazione?</AlertDialogTitle>
                <AlertDialogDescription>
                  Questa azione eliminerà permanentemente la conversazione e tutti i messaggi associati.
                  Questa operazione non può essere annullata.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setDeleteConversationId(null)}>
                  Annulla
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => {
                    if (deleteConversationId) {
                      deleteConversationMutation.mutate(deleteConversationId);
                      setDeleteConversationId(null);
                      setIsDeleteDialogOpen(false);
                    }
                  }}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Elimina Definitivamente
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <ConsultantAIAssistant />
    </WhatsAppLayout>
  );
}