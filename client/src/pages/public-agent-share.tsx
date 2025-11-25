import { useState, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { WhatsAppMessageBubble } from "@/components/whatsapp/WhatsAppMessageBubble";
import { TypingIndicator } from "@/components/whatsapp/TypingIndicator";
import { useToast } from "@/hooks/use-toast";
import { Bot, Send, Loader2, Lock, AlertCircle, MessageCircle, Info, Building2, User, Mic, Camera, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ShareMetadata {
  agentName: string;
  accessType: 'public' | 'password' | 'token';
  requiresPassword: boolean;
  isActive: boolean;
  isExpired: boolean;
  hasDomainsWhitelist: boolean;
  businessInfo?: {
    businessName?: string | null;
    businessDescription?: string | null;
    consultantName?: string | null;
    consultantBio?: string | null;
  } | null;
}

interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  createdAt: Date;
  audioUrl?: string | null;
  audioDuration?: number | null;
  transcription?: string | null;
}

interface StreamingMessage {
  id: string;
  content: string;
  role: 'agent';
  createdAt: Date;
  status: 'streaming';
}

export default function PublicAgentShare() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Parse embed mode from URL
  const searchParams = new URLSearchParams(window.location.search);
  const embedMode = searchParams.get('embed') === 'true';
  
  // State management
  const [visitorId, setVisitorId] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [showPasswordGate, setShowPasswordGate] = useState(false);
  const [messageInput, setMessageInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState<StreamingMessage | null>(null);
  const [optimisticMessage, setOptimisticMessage] = useState<Message | null>(null);
  const [showInfoSheet, setShowInfoSheet] = useState(false);
  
  // Audio recording states
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [audioChunks, setAudioChunks] = useState<Blob[]>([]);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [uploadingAudioPreview, setUploadingAudioPreview] = useState<string | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const recordingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load visitorId from localStorage on mount
  useEffect(() => {
    if (!slug) return;
    const storedVisitorId = localStorage.getItem(`visitor_session_${slug}`);
    if (storedVisitorId) {
      setVisitorId(storedVisitorId);
    }
  }, [slug]);
  
  // Fetch share metadata
  const { data: metadataResponse, isLoading: metadataLoading, error: metadataError } = useQuery({
    queryKey: ['/public/whatsapp/shares', slug, 'metadata'],
    queryFn: async () => {
      const response = await fetch(`/public/whatsapp/shares/${slug}/metadata`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Condivisione non trovata');
        }
        throw new Error('Errore nel caricamento dei dati');
      }
      return response.json();
    },
    enabled: !!slug,
    retry: false,
  });
  
  const metadata: ShareMetadata | null = metadataResponse?.metadata || null;
  
  // Determine if we should show password gate
  useEffect(() => {
    if (metadata) {
      const needsPassword = metadata.requiresPassword && !visitorId;
      setShowPasswordGate(needsPassword);
    }
  }, [metadata, visitorId]);
  
  // Password validation mutation
  const validateMutation = useMutation({
    mutationFn: async (passwordToValidate: string) => {
      const response = await fetch(`/public/whatsapp/shares/${slug}/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          password: metadata?.requiresPassword ? passwordToValidate : undefined 
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validazione fallita');
      }
      
      return response.json();
    },
    onSuccess: (data) => {
      const newVisitorId = data.visitorId;
      setVisitorId(newVisitorId);
      localStorage.setItem(`visitor_session_${slug}`, newVisitorId);
      setShowPasswordGate(false);
      setPassword("");
      
      toast({
        title: "✅ Accesso consentito",
        description: `Benvenuto nella chat con ${data.agentName}`,
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
  
  // Fetch conversation history
  const { data: conversationResponse, isLoading: conversationLoading } = useQuery({
    queryKey: ['/public/whatsapp/shares', slug, 'conversation', visitorId],
    queryFn: async () => {
      const response = await fetch(
        `/public/whatsapp/shares/${slug}/conversation?visitorId=${visitorId}`
      );
      
      if (!response.ok) {
        throw new Error('Errore nel caricamento della conversazione');
      }
      
      return response.json();
    },
    enabled: !!slug && !!visitorId && !showPasswordGate,
    refetchInterval: isStreaming ? false : 10000, // Poll every 10s when not streaming
  });
  
  const messages: Message[] = conversationResponse?.messages || [];
  
  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      // Send visitorId as query param for security validation
      const response = await fetch(`/public/whatsapp/shares/${slug}/message?visitorId=${encodeURIComponent(visitorId || '')}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: content,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'invio del messaggio');
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('Streaming non supportato');
      }
      
      setIsStreaming(true);
      const streamId = `stream_${Date.now()}`;
      setStreamingMessage({
        id: streamId,
        content: '',
        role: 'agent',
        createdAt: new Date(),
        status: 'streaming',
      });
      
      let accumulatedContent = '';
      
      while (true) {
        const { done, value } = await reader.read();
        
        if (done) {
          break;
        }
        
        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'chunk') {
                accumulatedContent += data.content;
                setStreamingMessage(prev => prev ? {
                  ...prev,
                  content: accumulatedContent,
                } : null);
              } else if (data.type === 'done') {
                setIsStreaming(false);
                setStreamingMessage(null);
                // Refetch conversation to get final message
                queryClient.invalidateQueries({
                  queryKey: ['/public/whatsapp/shares', slug, 'conversation', visitorId],
                });
              } else if (data.type === 'error') {
                throw new Error(data.error);
              }
            } catch (e) {
              // Ignore JSON parse errors for incomplete chunks
            }
          }
        }
      }
    },
    onMutate: async (content) => {
      // Optimistic update
      const optimistic: Message = {
        id: `optimistic_${Date.now()}`,
        role: 'user',
        content,
        createdAt: new Date(),
      };
      setOptimisticMessage(optimistic);
      setMessageInput("");
    },
    onError: (error: Error) => {
      setIsStreaming(false);
      setStreamingMessage(null);
      setOptimisticMessage(null);
      
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    },
    onSuccess: () => {
      setOptimisticMessage(null);
    },
  });
  
  // Handle password submit
  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast({
        title: "⚠️ Attenzione",
        description: "Inserisci la password",
        variant: "destructive",
      });
      return;
    }
    validateMutation.mutate(password);
  };
  
  // Handle public access (no password)
  const handlePublicAccess = () => {
    validateMutation.mutate("");
  };
  
  // Handle send message
  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!messageInput.trim() || isStreaming) {
      return;
    }
    
    sendMessageMutation.mutate(messageInput.trim());
  };
  
  // Audio recording functions
  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const startRecording = async () => {
    // Check if mediaDevices is available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: "❌ Non supportato",
        description: "Il tuo browser non supporta la registrazione audio.",
        variant: "destructive",
      });
      return;
    }
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = async () => {
        // Process audio in onstop to ensure chunks are available
        if (chunks.length > 0) {
          const audioBlob = new Blob(chunks, { type: 'audio/webm' });
          await sendAudioMessage(audioBlob);
        }
        
        // Reset state after processing
        setAudioChunks([]);
        setMediaRecorder(null);
        setRecordingTime(0);
      };
      
      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingTime(0);
      
      // Start timer
      recordingIntervalRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      console.error('Error starting recording:', error);
      toast({
        title: "❌ Errore",
        description: "Impossibile accedere al microfono. Controlla i permessi del browser.",
        variant: "destructive",
      });
    }
  };
  
  const stopRecording = () => {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') return;
    
    // Stop recording - onstop callback will handle the rest
    mediaRecorder.stop();
    mediaRecorder.stream.getTracks().forEach(track => track.stop());
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setIsRecording(false);
  };
  
  const cancelRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop();
      mediaRecorder.stream.getTracks().forEach(track => track.stop());
    }
    
    if (recordingIntervalRef.current) {
      clearInterval(recordingIntervalRef.current);
      recordingIntervalRef.current = null;
    }
    
    setIsRecording(false);
    setAudioChunks([]);
    setMediaRecorder(null);
    setRecordingTime(0);
  };
  
  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!visitorId) return;
    
    try {
      // Create preview URL for the audio
      const audioUrl = URL.createObjectURL(audioBlob);
      setUploadingAudioPreview(audioUrl);
      setIsUploadingAudio(true);
      setIsStreaming(true);
      
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      
      // Send visitorId as query param for security validation
      const response = await fetch(`/public/whatsapp/shares/${slug}/send-audio?visitorId=${encodeURIComponent(visitorId)}`, {
        method: 'POST',
        body: formData,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nell\'invio dell\'audio');
      }
      
      const data = await response.json();
      
      toast({
        title: "✅ Audio inviato",
        description: data.audioUrl ? "Risposta audio generata" : "Messaggio ricevuto",
      });
      
      // Clean up preview URL
      URL.revokeObjectURL(audioUrl);
      
      // Refetch conversation
      queryClient.invalidateQueries({
        queryKey: ['/public/whatsapp/shares', slug, 'conversation', visitorId],
      });
      
    } catch (error: any) {
      toast({
        title: "❌ Errore",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsUploadingAudio(false);
      setUploadingAudioPreview(null);
      setIsStreaming(false);
    }
  };
  
  const handlePhotoCapture = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // For now, just show a toast - photo endpoint will be implemented in Task 3
    toast({
      title: "📸 Foto selezionata",
      description: "Funzionalità in arrivo...",
    });
    
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };
  
  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollAreaRef.current) {
      const viewport = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (viewport) {
        const isUserScrolledToBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 50;
        
        if (optimisticMessage) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'smooth' });
        } else if (isUserScrolledToBottom) {
          viewport.scrollTo({ top: viewport.scrollHeight, behavior: 'instant' });
        }
      }
    }
  }, [messages, streamingMessage, optimisticMessage]);
  
  // Auto-trigger public access if no password required
  useEffect(() => {
    if (metadata && !metadata.requiresPassword && !visitorId && !validateMutation.isPending) {
      handlePublicAccess();
    }
  }, [metadata, visitorId]);
  
  // Loading state
  if (metadataLoading) {
    return (
      <div className={cn(
        "flex items-center justify-center",
        embedMode ? "h-screen min-h-[100dvh] bg-background" : "min-h-screen bg-background"
      )}>
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="text-muted-foreground">Caricamento in corso...</p>
        </div>
      </div>
    );
  }
  
  // Error states
  if (metadataError) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4",
        embedMode ? "h-screen min-h-[100dvh] bg-background" : "min-h-screen bg-background"
      )}>
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Errore</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">
              {metadataError instanceof Error ? metadataError.message : 'Condivisione non trovata'}
            </p>
            {!embedMode && (
              <Button onClick={() => navigate('/')} variant="outline" className="w-full">
                Torna alla home
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
  
  if (!metadata) {
    return null;
  }
  
  // Check if share is accessible
  if (!metadata.isActive) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4",
        embedMode ? "h-screen min-h-[100dvh] bg-background" : "min-h-screen bg-background"
      )}>
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Condivisione non disponibile</CardTitle>
            <CardDescription>
              Questa condivisione è stata disabilitata
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  if (metadata.isExpired) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4",
        embedMode ? "h-screen min-h-[100dvh] bg-background" : "min-h-screen bg-background"
      )}>
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Condivisione scaduta</CardTitle>
            <CardDescription>
              Questa condivisione non è più valida
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }
  
  // Password gate
  if (showPasswordGate) {
    return (
      <div className={cn(
        "flex items-center justify-center p-4",
        embedMode ? "h-screen min-h-[100dvh] bg-background" : "min-h-screen bg-background"
      )}>
        <Card className="max-w-md w-full">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              <CardTitle>Accesso richiesto</CardTitle>
            </div>
            <CardDescription>
              Inserisci la password per chattare con {metadata.agentName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={validateMutation.isPending}
                  autoFocus
                />
              </div>
              
              <Button 
                type="submit" 
                className="w-full" 
                disabled={validateMutation.isPending || !password.trim()}
              >
                {validateMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Verifica in corso...
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4 mr-2" />
                    Accedi
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  // Main chat interface
  return (
    <div className={cn(
      "flex flex-col bg-background",
      embedMode ? "h-screen min-h-[100dvh]" : "min-h-screen min-h-[100dvh]"
    )}>
      {/* Header - minimal WhatsApp style */}
      {!embedMode && (
        <div className="border-b bg-card">
          <div className="px-4 py-3 flex items-center gap-3">
            <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-2 rounded-full">
              <Bot className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="font-semibold text-base">{metadata.agentName}</h1>
              <p className="text-xs text-muted-foreground">Assistente AI</p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowInfoSheet(true)}
              className="h-9 w-9 rounded-full"
            >
              <Info className="h-5 w-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      )}
      
      {/* Chat area */}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        {/* Messages */}
        <ScrollArea ref={scrollAreaRef} className="flex-1 min-h-0 p-4">
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Welcome message */}
            {messages.length === 0 && !optimisticMessage && !streamingMessage && (
              <div className="text-center py-8 space-y-2">
                <MessageCircle className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <h3 className="font-medium text-muted-foreground">
                  Inizia una conversazione
                </h3>
                <p className="text-sm text-muted-foreground">
                  Scrivi un messaggio per parlare con {metadata.agentName}
                </p>
              </div>
            )}
            
            {/* Message list */}
            {messages.map((message) => {
              const direction = message.role === 'user' ? 'outbound' : 'inbound';
              
              return (
                <div key={message.id} className="flex flex-col gap-1">
                  <WhatsAppMessageBubble
                    message={{
                      id: message.id,
                      text: message.content,
                      sender: message.role === 'user' ? 'client' : 'ai',
                      direction,
                      createdAt: new Date(message.createdAt),
                    }}
                  />
                  {message.audioUrl && (
                    <div className={direction === 'inbound' ? 'flex justify-start ml-12' : 'flex justify-end mr-12'}>
                      <audio
                        controls
                        className="w-64 h-10"
                        preload="metadata"
                      >
                        <source src={message.audioUrl} type={message.role === 'user' ? 'audio/webm' : 'audio/wav'} />
                        Il tuo browser non supporta l'elemento audio.
                      </audio>
                    </div>
                  )}
                </div>
              );
            })}
            
            {/* Optimistic message */}
            {optimisticMessage && (
              <WhatsAppMessageBubble
                message={{
                  id: optimisticMessage.id,
                  text: optimisticMessage.content,
                  sender: 'client',
                  direction: 'outbound',
                  createdAt: optimisticMessage.createdAt,
                }}
              />
            )}
            
            {/* Uploading audio preview */}
            {isUploadingAudio && uploadingAudioPreview && (
              <div className="flex justify-end">
                <div className="bg-[#DCF8C6] rounded-lg px-3 py-2 max-w-xs shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-gray-600" />
                    <span className="text-sm text-gray-600">Invio audio in corso...</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Typing indicator - shown when waiting for agent response */}
            {(sendMessageMutation.isPending || isStreaming) && !streamingMessage?.content && !isUploadingAudio && (
              <TypingIndicator />
            )}
            
            {/* Streaming message */}
            {streamingMessage?.content && (
              <WhatsAppMessageBubble
                message={{
                  id: streamingMessage.id,
                  text: streamingMessage.content,
                  sender: 'ai',
                  direction: 'inbound',
                  createdAt: streamingMessage.createdAt,
                }}
              />
            )}
          </div>
        </ScrollArea>
        
        {/* Input area - WhatsApp style */}
        <div className="border-t bg-card p-3 shadow-lg">
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
                  disabled={isStreaming || isRecording}
                  className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 text-base placeholder:text-gray-500 p-0 h-auto min-h-[28px]"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !isRecording) {
                      e.preventDefault();
                      handleSendMessage(e);
                    }
                  }}
                />
              </div>
              
              {messageInput.trim() ? (
                <Button
                  onClick={handleSendMessage}
                  disabled={isStreaming || isRecording}
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
                  disabled={isStreaming}
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
      
      {/* Info Sheet - WhatsApp style profile */}
      <Sheet open={showInfoSheet} onOpenChange={setShowInfoSheet}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader className="text-left pb-6">
            <div className="flex flex-col items-center gap-4 pb-4">
              <div className="bg-gradient-to-br from-blue-500 to-purple-500 p-6 rounded-full">
                <Bot className="h-12 w-12 text-white" />
              </div>
              <div className="text-center">
                <SheetTitle className="text-xl">{metadata.agentName}</SheetTitle>
                <SheetDescription>Assistente AI</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          
          <ScrollArea className="h-full pb-6">
            <div className="space-y-6">
              {/* What I can do */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Bot className="h-4 w-4" />
                  <span className="font-medium">Cosa posso fare</span>
                </div>
                <p className="text-sm text-muted-foreground pl-6 leading-relaxed">
                  {metadata.businessInfo?.businessDescription || 
                    "Sono un assistente AI sempre disponibile per rispondere alle tue domande e aiutarti. Scrivimi un messaggio per iniziare!"}
                </p>
              </div>
              
              {/* Business Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  <span className="font-medium">Business</span>
                </div>
                <p className="text-base font-medium pl-6">
                  {metadata.businessInfo?.businessName || "Nessuna informazione disponibile"}
                </p>
              </div>
              
              {/* Consultant Info */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="h-4 w-4" />
                  <span className="font-medium">Consulente</span>
                </div>
                <p className="text-base pl-6">
                  {metadata.businessInfo?.consultantName || "Nessuna informazione disponibile"}
                </p>
                {metadata.businessInfo?.consultantBio && (
                  <p className="text-sm text-muted-foreground pl-6 leading-relaxed">
                    {metadata.businessInfo.consultantBio}
                  </p>
                )}
              </div>
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
