import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
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
  Search,
  MoreVertical,
  Camera,
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
import { formatDistanceToNow, format } from "date-fns";
import it from "date-fns/locale/it";
import { useIsMobile } from "@/hooks/use-mobile";
import { ArrowLeft } from "lucide-react";
import { useLocation } from "wouter";

interface Conversation {
  id: string;
  phoneNumber: string;
  userId: string | null;
  agentConfigId: string | null;
  agentName: string;
  isLead: boolean;
  isProactiveLead: boolean;
  aiEnabled: boolean;
  lastMessageAt: Date;
  lastMessageFrom: string;
  messageCount: number;
  unreadByConsultant: number;
  metadata: any;
  testModeOverride: "client" | "lead" | "consulente" | null;
  testModeUserId: string | null;
  contactName: string | null;
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

const POLLING_INTERVAL = 5000;

export default function ConsultantWhatsAppConversationsPage() {
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [activeChannel, setActiveChannel] = useState<"whatsapp" | "instagram" | "config">("whatsapp");
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
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isMobile = useIsMobile();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const conversationParam = urlParams.get('conversation');
    if (conversationParam && !selectedConversationId) {
      setSelectedConversationId(conversationParam);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

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

  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      (conv.contactName?.toLowerCase().includes(query)) ||
      conv.phoneNumber.includes(query) ||
      (conv.lastMessage?.text?.toLowerCase().includes(query))
    );
  });

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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (selectedConversationId) {
      markAsReadMutation.mutate(selectedConversationId);
    }
  }, [selectedConversationId]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, []);

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

  const isDryRun = selectedConversation?.agentConfigId 
    ? whatsappAgents.find((a: any) => a.id === selectedConversation.agentConfigId)?.isDryRun === true
    : false;

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

  const formatMessageDate = (date: Date) => {
    const d = new Date(date);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday = d.toDateString() === yesterday.toDateString();

    if (isToday) {
      return format(d, 'HH:mm');
    } else if (isYesterday) {
      return 'Ieri';
    } else {
      return format(d, 'dd/MM/yy');
    }
  };

  const getBadgeInfo = (conv: any) => {
    if (conv.testModeOverride === "consulente") {
      return { label: "Consulente", className: "bg-cyan-500 text-white" };
    }
    if (conv.testModeOverride === "lead") {
      return { label: "Lead", className: "bg-purple-500 text-white" };
    }
    if (conv.testModeOverride === "client") {
      return { label: "Cliente", className: "bg-green-600 text-white" };
    }

    const participantType = (conv.metadata as any)?.participantType;
    if (participantType === "consultant") {
      return { label: "Consulente", className: "bg-cyan-500 text-white" };
    }
    if (participantType === "client") {
      return { label: "Cliente", className: "bg-green-600 text-white" };
    }
    if (conv.isLead || participantType === "unknown") {
      return { label: "Lead", className: "bg-purple-500 text-white" };
    }

    return { label: "Cliente", className: "bg-green-600 text-white" };
  };

  const getInitials = (conv: any) => {
    if (conv.contactName) {
      return conv.contactName.split(' ').filter((n: string) => n && n.length > 0).map((n: string) => n[0]).join('').toUpperCase().slice(0, 2);
    }
    if (conv.instagramUsername) {
      return conv.instagramUsername.slice(0, 2).toUpperCase();
    }
    if (conv.phoneNumber) {
      const digits = conv.phoneNumber.replace(/\D/g, "");
      return digits.slice(-2) || "??";
    }
    return "??";
  };

  const renderConversationsList = (conversationsList: any[], isInstagram = false) => {
    if (conversationsList.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <MessageSquare className="h-12 w-12 text-gray-400 mb-3" />
          <p className="text-gray-600 dark:text-gray-400">
            Nessuna conversazione
          </p>
        </div>
      );
    }

    return conversationsList.map((conv) => {
      const badgeInfo = getBadgeInfo(conv);
      const isSelected = isInstagram 
        ? selectedInstagramConversationId === conv.id 
        : selectedConversationId === conv.id;

      return (
        <div
          key={conv.id}
          className={`min-h-[72px] flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-gray-800 cursor-pointer transition-colors active:bg-gray-100 dark:active:bg-gray-800 ${
            isSelected
              ? "bg-blue-50 dark:bg-blue-900/20"
              : "hover:bg-gray-50 dark:hover:bg-gray-800/50"
          }`}
          onClick={() => {
            if (isInstagram) {
              setSelectedInstagramConversationId(conv.id);
            } else {
              setSelectedConversationId(conv.id);
            }
          }}
        >
          <div className="relative flex-shrink-0">
            <Avatar className="h-12 w-12">
              <AvatarFallback className={`${
                badgeInfo.label === "Lead" 
                  ? "bg-gradient-to-br from-purple-500 to-pink-500" 
                  : "bg-gradient-to-br from-green-500 to-emerald-500"
              } text-white font-semibold text-sm`}>
                {getInitials(conv)}
              </AvatarFallback>
            </Avatar>
            {conv.aiEnabled && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 bg-blue-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-gray-900">
                <Bot className="h-2.5 w-2.5 text-white" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 overflow-hidden">
            <div className="flex items-center gap-2">
              <p className={`flex-1 text-sm truncate ${
                conv.unreadByConsultant > 0 ? "font-bold text-gray-900 dark:text-white" : "font-medium text-gray-900 dark:text-white"
              }`}>
                {conv.contactName || (conv.instagramUsername ? `@${conv.instagramUsername}` : conv.phoneNumber || 'Contatto Sconosciuto')}
              </p>
              <span className="text-[11px] text-gray-500 dark:text-gray-400 flex-shrink-0 whitespace-nowrap">
                {formatMessageDate(new Date(conv.lastMessageAt))}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-0.5">
              <p className={`flex-1 text-sm truncate ${
                conv.unreadByConsultant > 0 ? "text-gray-900 dark:text-gray-200" : "text-gray-500 dark:text-gray-400"
              }`}>
                {(() => {
                  const msgText = conv.lastMessage?.text || conv.lastMessageText;
                  if (!msgText) return 'Nessun messaggio';
                  if (msgText.startsWith('TEMPLATE:')) return '📋 Template inviato';
                  return msgText;
                })()}
              </p>
              <div className="flex items-center gap-1 flex-shrink-0">
                <Badge className={`text-[10px] py-0 px-1.5 h-5 ${badgeInfo.className}`}>
                  {badgeInfo.label}
                </Badge>
                {conv.unreadByConsultant > 0 && (
                  <Badge className="h-5 min-w-[20px] px-1.5 text-xs bg-green-500 hover:bg-green-500">
                    {conv.unreadByConsultant}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      );
    });
  };

  const renderChatView = () => {
    if (!selectedConversation) {
      return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-gray-50 dark:bg-gray-900">
          <MessageSquare className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Seleziona una conversazione
          </h3>
          <p className="text-gray-500 dark:text-gray-400 text-sm">
            Scegli una chat dalla lista per iniziare
          </p>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-white dark:bg-gray-900">
        {isMobile && (
          <div className="flex items-center gap-3 px-2 py-2 bg-[#075e54] dark:bg-gray-800">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedConversationId(null)}
              className="h-10 w-10 text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-gray-300 text-gray-700 font-semibold">
                {getInitials(selectedConversation)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-white truncate">
                {selectedConversation.contactName || 'Contatto'}
              </p>
              <p className="text-xs text-white/70 truncate">
                {selectedConversation.phoneNumber}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 text-white hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </Button>
          </div>
        )}

        {!isMobile && (
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
        )}

        {isDryRun && (
          <div className="px-4 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {selectedConversation.testModeOverride ? (
                  <Badge variant="outline" className="text-xs bg-yellow-100 dark:bg-yellow-900/30">
                    <Beaker className="h-3 w-3 mr-1" />
                    Test Mode: {selectedConversation.testModeOverride === "lead" ? "Lead" : selectedConversation.testModeOverride === "consulente" ? "Consulente" : "Cliente"}
                  </Badge>
                ) : (
                  <span className="text-xs text-yellow-700 dark:text-yellow-300">Nessuna modalità test attiva</span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setTestModeDialogOpen(true)}
                className="h-7 text-xs bg-yellow-100 hover:bg-yellow-200 border-yellow-300"
              >
                <Beaker className="h-3 w-3 mr-1" />
                Cambia Modalità
              </Button>
            </div>
          </div>
        )}

        {isDryRun && (
          <div className="bg-orange-50 dark:bg-orange-900/20 border-b border-orange-300 dark:border-orange-700 px-3 py-2">
            <div className="flex items-center gap-2">
              <Beaker className="h-4 w-4 text-orange-600" />
              <span className="text-xs font-medium text-orange-700 dark:text-orange-300">
                🧪 Dry Run - Nessun messaggio reale inviato
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-3 py-4">
          {messagesLoading ? (
            <div className="flex justify-center items-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-2">
              {messages.map((msg) => (
                <WhatsAppMessageBubble
                  key={msg.id}
                  message={msg}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="bg-gray-100 dark:bg-gray-800 px-2 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center bg-white dark:bg-gray-700 rounded-full px-4 py-2 shadow-sm">
              <Input
                placeholder="Scrivi un messaggio..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                disabled={sendMessageMutation.isPending}
                className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0"
              />
            </div>
            <Button
              onClick={handleSendMessage}
              disabled={!messageText.trim() || sendMessageMutation.isPending}
              size="icon"
              className="h-10 w-10 rounded-full bg-[#075e54] hover:bg-[#064e46] dark:bg-green-600 dark:hover:bg-green-700"
            >
              {sendMessageMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>

          {isDryRun && (
            <div className="mt-2 pt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-2">
                <Beaker className="h-3 w-3 text-orange-500" />
                <span className="text-xs font-medium text-orange-600 dark:text-orange-400">Simulatore Cliente</span>
              </div>
              {isRecording ? (
                <div className="flex items-center gap-3 bg-red-50 dark:bg-red-900/20 rounded-full px-4 py-2">
                  <div className="flex items-center gap-2 flex-1">
                    <div className="h-2.5 w-2.5 bg-red-500 rounded-full animate-pulse" />
                    <span className="text-red-600 font-medium text-xs">{formatRecordingTime(recordingTime)}</span>
                  </div>
                  <Button onClick={cancelRecording} size="icon" variant="ghost" className="h-8 w-8 rounded-full">
                    <X className="h-4 w-4" />
                  </Button>
                  <Button onClick={stopRecording} size="icon" className="h-8 w-8 rounded-full bg-orange-500">
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-white dark:bg-gray-700 rounded-full px-4 py-2">
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
                      className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 p-0 text-sm"
                    />
                  </div>
                  {simulateMessageText.trim() ? (
                    <Button
                      onClick={handleSimulateMessage}
                      disabled={simulateMessageMutation.isPending}
                      size="icon"
                      className="h-10 w-10 rounded-full bg-orange-500 hover:bg-orange-600"
                    >
                      {simulateMessageMutation.isPending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </Button>
                  ) : (
                    <Button
                      onClick={startRecording}
                      size="icon"
                      className="h-10 w-10 rounded-full bg-orange-500 hover:bg-orange-600"
                    >
                      <Mic className="h-5 w-5" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderConfigPanel = () => {
    return (
      <div className="flex-1 p-4 overflow-y-auto pb-20 lg:pb-4">
        <h2 className="text-lg font-semibold mb-4">Impostazioni Conversazioni</h2>
        
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Filtri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant={filter === "all" ? "default" : "outline"}
                  onClick={() => setFilter("all")}
                >
                  Tutte
                </Button>
                <Button
                  size="sm"
                  variant={filter === "leads" ? "default" : "outline"}
                  onClick={() => setFilter("leads")}
                >
                  Lead
                </Button>
                <Button
                  size="sm"
                  variant={filter === "clients" ? "default" : "outline"}
                  onClick={() => setFilter("clients")}
                >
                  Clienti
                </Button>
                <Button
                  size="sm"
                  variant={filter === "unread" ? "default" : "outline"}
                  onClick={() => setFilter("unread")}
                >
                  Non letti
                </Button>
              </div>

              {whatsappAgents.length > 1 && (
                <div className="pt-2">
                  <Label className="text-sm mb-2 block">Agente</Label>
                  <Select
                    value={selectedAgentId || "all"}
                    onValueChange={(value) => setSelectedAgentId(value === "all" ? null : value)}
                  >
                    <SelectTrigger className="h-10">
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
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Azioni Rapide</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/consultant/whatsapp')}
              >
                <Settings className="h-4 w-4 mr-2" />
                Configura Agenti WhatsApp
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start"
                onClick={() => setLocation('/consultant/whatsapp/templates')}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Gestisci Template
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  };

  return (
    <WhatsAppLayout showHeader={false} fullWidth>
      <div className="flex flex-col h-[100dvh] w-full bg-white dark:bg-zinc-900">
        {isMobile ? (
          <>
            {(!selectedConversationId && activeChannel !== "config") && (
              <>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-zinc-900">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => window.location.href = '/consultant/whatsapp'}
                      className="h-10 w-10"
                    >
                      <ArrowLeft className="h-5 w-5" />
                    </Button>
                    <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                      {activeChannel === "whatsapp" ? "Conversazioni" : "Instagram"}
                    </h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setShowSearch(!showSearch)}
                      className="h-10 w-10"
                    >
                      <Search className="h-5 w-5" />
                    </Button>
                  </div>
                </div>

                {showSearch && (
                  <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-800">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input
                        placeholder="Cerca conversazione..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10 h-10 rounded-full bg-gray-100 dark:bg-gray-800 border-0"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="flex-1 overflow-hidden">
              {activeChannel === "config" ? (
                renderConfigPanel()
              ) : selectedConversationId ? (
                renderChatView()
              ) : (
                <ScrollArea className="h-full pb-20">
                  {activeChannel === "whatsapp" 
                    ? renderConversationsList(filteredConversations)
                    : renderConversationsList(instagramConversations as any[], true)
                  }
                </ScrollArea>
              )}
            </div>

            {!selectedConversationId && (
              <div className="fixed bottom-0 left-0 right-0 h-16 bg-white dark:bg-zinc-900 border-t border-gray-200 dark:border-gray-800 flex items-center justify-around px-4 pb-[env(safe-area-inset-bottom)]">
                <button
                  onClick={() => setActiveChannel("whatsapp")}
                  className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                    activeChannel === "whatsapp" ? "text-green-600" : "text-gray-500"
                  }`}
                >
                  <MessageSquare className="h-6 w-6" />
                  <span className="text-xs font-medium">WhatsApp</span>
                </button>
                <button
                  onClick={() => setActiveChannel("instagram")}
                  className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                    activeChannel === "instagram" ? "text-pink-600" : "text-gray-500"
                  }`}
                >
                  <Camera className="h-6 w-6" />
                  <span className="text-xs font-medium">Instagram</span>
                </button>
                <button
                  onClick={() => setActiveChannel("config")}
                  className={`flex flex-col items-center gap-1 py-2 px-4 rounded-lg transition-colors ${
                    activeChannel === "config" ? "text-blue-600" : "text-gray-500"
                  }`}
                >
                  <Settings className="h-6 w-6" />
                  <span className="text-xs font-medium">Config</span>
                </button>
              </div>
            )}
          </>
        ) : (
          <>
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-800">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
                <div className="bg-green-500 p-2 rounded-xl">
                  <MessageSquare className="h-6 w-6 text-white" />
                </div>
                Conversazioni
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 ml-[52px]">
                Gestisci le conversazioni con i tuoi clienti e lead
              </p>
            </div>

            <Tabs value={activeChannel} onValueChange={(v) => setActiveChannel(v as any)} className="flex-1 flex flex-col overflow-hidden">
              <div className="px-6 pt-4">
                <TabsList className="grid w-full max-w-md grid-cols-2">
                  <TabsTrigger value="whatsapp" className="data-[state=active]:bg-green-100 data-[state=active]:text-green-700">
                    <MessageSquare className="h-4 w-4 mr-2" />
                    WhatsApp
                  </TabsTrigger>
                  <TabsTrigger value="instagram" className="data-[state=active]:bg-pink-100 data-[state=active]:text-pink-700">
                    <Instagram className="h-4 w-4 mr-2" />
                    Instagram
                  </TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="whatsapp" className="flex-1 mt-4 px-6 pb-6 overflow-hidden">
                <div className="grid grid-cols-12 gap-6 h-full">
                  <Card className="col-span-4 overflow-hidden flex flex-col">
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-base">Conversazioni</CardTitle>
                        <Badge variant="secondary">{filteredConversations.length}</Badge>
                      </div>
                      <div className="relative mt-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input
                          placeholder="Cerca..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 h-9"
                        />
                      </div>
                      <div className="flex gap-1 mt-3 flex-wrap">
                        <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")} className="h-7 text-xs">
                          Tutte
                        </Button>
                        <Button size="sm" variant={filter === "leads" ? "default" : "outline"} onClick={() => setFilter("leads")} className="h-7 text-xs">
                          Lead
                        </Button>
                        <Button size="sm" variant={filter === "clients" ? "default" : "outline"} onClick={() => setFilter("clients")} className="h-7 text-xs">
                          Clienti
                        </Button>
                        <Button size="sm" variant={filter === "unread" ? "default" : "outline"} onClick={() => setFilter("unread")} className="h-7 text-xs">
                          Non letti
                        </Button>
                      </div>
                      {whatsappAgents.length > 1 && (
                        <Select value={selectedAgentId || "all"} onValueChange={(value) => setSelectedAgentId(value === "all" ? null : value)}>
                          <SelectTrigger className="h-8 text-xs mt-2">
                            <SelectValue placeholder="Tutti gli agenti" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">Tutti gli agenti</SelectItem>
                            {whatsappAgents.map((agent: any) => (
                              <SelectItem key={agent.id} value={agent.id}>{agent.agentName}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        {renderConversationsList(filteredConversations)}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card className="col-span-8 overflow-hidden flex flex-col">
                    {renderChatView()}
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="instagram" className="flex-1 mt-4 px-6 pb-6 overflow-hidden">
                <div className="grid grid-cols-12 gap-6 h-full">
                  <Card className="col-span-4 overflow-hidden flex flex-col">
                    <CardHeader className="pb-3 border-b">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 flex items-center justify-center">
                          <Instagram className="h-5 w-5 text-white" />
                        </div>
                        <CardTitle className="text-base">Messaggi Instagram</CardTitle>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-hidden">
                      <ScrollArea className="h-full">
                        {instagramConversationsLoading ? (
                          <div className="flex items-center justify-center p-8">
                            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                          </div>
                        ) : (
                          renderConversationsList(instagramConversations as any[], true)
                        )}
                      </ScrollArea>
                    </CardContent>
                  </Card>

                  <Card className="col-span-8 overflow-hidden flex flex-col bg-gray-50 dark:bg-gray-900">
                    <div className="flex-1 flex items-center justify-center text-center p-8">
                      <div>
                        <Instagram className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                          Seleziona una conversazione
                        </h3>
                        <p className="text-gray-500 text-sm">
                          Scegli una chat Instagram dalla lista
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      <AlertDialog open={isResetDialogOpen} onOpenChange={setIsResetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Resetta Conversazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler resettare questa conversazione? I messaggi rimarranno ma le impostazioni verranno ripristinate.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
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
                }
                setIsResetDialogOpen(false);
              }}
            >
              Resetta
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimina Conversazione</AlertDialogTitle>
            <AlertDialogDescription>
              Sei sicuro di voler eliminare definitivamente questa conversazione? Questa azione non può essere annullata.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annulla</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={() => {
                if (deleteConversationId) {
                  deleteConversationMutation.mutate(deleteConversationId);
                }
                setIsDeleteDialogOpen(false);
              }}
            >
              Elimina
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={testModeDialogOpen} onOpenChange={setTestModeDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Beaker className="h-5 w-5 text-orange-500" />
              Modalità Test
            </DialogTitle>
            <DialogDescription>
              Simula questa conversazione come se fosse un Cliente, Lead o Consulente per testare le risposte AI.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Tipo di utente</label>
              <Select
                value={testModeOverride || "none"}
                onValueChange={(value) => setTestModeOverride(value === "none" ? null : value as "client" | "lead" | "consulente")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleziona modalità" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Nessuna (usa rilevamento automatico)</SelectItem>
                  <SelectItem value="client">Cliente</SelectItem>
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="consulente">Consulente</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {testModeOverride === "client" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Cerca cliente da impersonare</label>
                <Input
                  placeholder="Cerca per email o nome..."
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                />
                {users.length > 0 && (
                  <div className="border rounded-md max-h-32 overflow-y-auto">
                    {users.map((user: any) => (
                      <div
                        key={user.id}
                        onClick={() => {
                          setTestModeUserId(user.id);
                          setUserSearchQuery(user.email || user.name || "");
                        }}
                        className={cn(
                          "p-2 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 text-sm",
                          testModeUserId === user.id && "bg-blue-50 dark:bg-blue-900/20"
                        )}
                      >
                        {user.email || user.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestModeDialogOpen(false)}>
              Annulla
            </Button>
            <Button
              onClick={() => {
                if (selectedConversationId) {
                  testModeMutation.mutate({
                    conversationId: selectedConversationId,
                    testModeOverride: testModeOverride,
                    testModeUserId: testModeOverride === "client" ? testModeUserId : undefined,
                  });
                }
              }}
              disabled={testModeMutation.isPending}
              className="bg-orange-500 hover:bg-orange-600"
            >
              {testModeMutation.isPending ? "Salvando..." : "Applica Modalità Test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </WhatsAppLayout>
  );
}
