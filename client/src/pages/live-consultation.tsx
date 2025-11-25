import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { SessionTypeSelector, SessionType } from '@/components/ai-assistant/live-mode/SessionTypeSelector';
import { LiveModeScreen } from '@/components/ai-assistant/live-mode/LiveModeScreen';
import { CustomPromptEditor } from '@/components/ai-assistant/live-mode/CustomPromptEditor';
import { getAuthUser, getToken } from '@/lib/auth';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent } from '@/components/ui/card';
import { Bot, Loader2, Menu } from 'lucide-react';
import Sidebar from '@/components/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';

type ConsultantType = 'finanziario' | 'vendita' | 'business';

interface NormalModeWrapperProps {
  children: React.ReactNode;
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

function NormalModeWrapper({ children, sidebarOpen, setSidebarOpen }: NormalModeWrapperProps) {
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
                <Bot className="h-5 w-5 text-purple-600" />
                Live Consultation
              </h1>
            </div>
          </div>
          
          <div className="w-full h-[calc(100vh-60px)]">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LiveConsultation() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const user = getAuthUser();
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [sessionType, setSessionType] = useState<SessionType | null>(null);
  const [customPrompt, setCustomPrompt] = useState<string | null>(null);
  const [useFullPrompt, setUseFullPrompt] = useState(false);
  const [voiceName, setVoiceName] = useState('achernar');
  const [isTestMode, setIsTestMode] = useState(false);
  const [consultationId, setConsultationId] = useState<string | null>(null);

  // Mode detection
  const searchParams = new URLSearchParams(window.location.search);
  const mode = searchParams.get('mode');
  
  // Check for direct session parameters (from consultation lobby)
  const urlSessionType = searchParams.get('sessionType') as SessionType | null;
  const urlVoice = searchParams.get('voice');
  const urlFullPrompt = searchParams.get('fullPrompt');
  const isSalesAgentMode = mode === 'sales_agent';
  const isConsultationInviteMode = mode === 'consultation_invite';
  const shareToken = searchParams.get('shareToken');
  const inviteToken = searchParams.get('inviteToken');

  // Public modes (sales_agent, consultation_invite): NON richiedono autenticazione utente
  // Normal mode: richiede autenticazione client
  const isPublicMode = isSalesAgentMode || isConsultationInviteMode;
  
  if (!isPublicMode && (!user || user.role !== 'client')) {
    toast({
      variant: 'destructive',
      title: 'Accesso Negato',
      description: 'Solo i clienti possono accedere alla modalità Live.',
    });
    setLocation('/');
    return null;
  }

  // Sales Agent mode: verifica che shareToken sia presente
  if (isSalesAgentMode && !shareToken) {
    toast({
      variant: 'destructive',
      title: 'Errore',
      description: 'Token di sessione mancante',
    });
    setLocation('/');
    return null;
  }

  // Consultation Invite mode: verifica che inviteToken sia presente
  if (isConsultationInviteMode && !inviteToken) {
    toast({
      variant: 'destructive',
      title: 'Errore',
      description: 'Token di invito mancante',
    });
    setLocation('/');
    return null;
  }

  // Initialize session from URL parameters (from consultation lobby)
  useEffect(() => {
    if (urlSessionType && !sessionType) {
      console.log('🔵 [LOBBY PARAMS] Initializing session from URL:', {
        sessionType: urlSessionType,
        voice: urlVoice,
        fullPrompt: urlFullPrompt,
      });
      
      setSessionType(urlSessionType);
      
      if (urlVoice) {
        setVoiceName(urlVoice);
      }
      
      if (urlFullPrompt !== null) {
        setUseFullPrompt(urlFullPrompt === 'true');
      }
      
      // For consultation type, fetch test mode and consultation ID
      if (urlSessionType === 'consultation') {
        const fetchConsultationInfo = async () => {
          try {
            const token = getToken();
            const response = await fetch('/api/consultations/ai/check-access', {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            
            if (response.ok) {
              const data = await response.json();
              setIsTestMode(data.reason === 'test_mode');
              if (data.consultationId) {
                setConsultationId(data.consultationId);
                console.log('🔵 [CONSULTATION MODE] ConsultationId set:', data.consultationId);
              }
            }
          } catch (error) {
            console.error('Error fetching consultation info:', error);
          }
        };
        
        fetchConsultationInfo();
      }
      
      // Clear URL params after hydration to prevent re-triggering on session close
      window.history.replaceState({}, '', '/live-consultation');
      console.log('🔵 [LOBBY PARAMS] Cleared URL params to prevent re-hydration loop');
    }
  }, [urlSessionType, urlVoice, urlFullPrompt, sessionType]);

  // Determina mode e consultantType in base al sessionType
  const getSessionConfig = () => {
    if (sessionType === 'consultation') {
      // Sessione Consulenza: STESSO mode di normale + prefix speciale
      return {
        mode: 'assistenza' as const,
        consultantType: null,
        sessionType: 'weekly_consultation' as const,
      };
    }
    
    // Sessione Normale o Custom: mode assistenza, nessun prefix
    return {
      mode: 'assistenza' as const,
      consultantType: null,
      sessionType: undefined,
    };
  };

  const handleSelectSessionType = async (type: SessionType, fullPrompt: boolean, voice: string) => {
    setSessionType(type);
    setUseFullPrompt(fullPrompt);
    setVoiceName(voice);
    
    // Se è una consulenza, fetch isTestMode
    if (type === 'consultation') {
      try {
        const token = getToken();
        const response = await fetch('/api/consultations/ai/check-access', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          // Se il motivo è test_mode, significa che isTestMode = true
          setIsTestMode(data.reason === 'test_mode');
          // Salva il consultationId per l'autosave
          if (data.consultationId) {
            setConsultationId(data.consultationId);
            console.log('🔵 [CONSULTATION MODE] ConsultationId set:', data.consultationId);
          }
        }
      } catch (error) {
        console.error('Error fetching test mode status:', error);
      }
    } else {
      // 🔴 CRITICO: Reset consultationId per sessioni normali/custom
      setIsTestMode(false);
      setConsultationId(null);
      console.log('🟢 [NORMAL/CUSTOM MODE] ConsultationId reset to null');
    }
  };

  const handleStartCustomSession = (customPromptText: string) => {
    setCustomPrompt(customPromptText);
    // Session type is already set to 'custom' at this point
  };

  const handleCloseSession = () => {
    console.log('🔵 [CLOSE SESSION] Closing session and resetting state');
    setSessionType(null);
    setCustomPrompt(null);
    setIsTestMode(false);
    setConsultationId(null);
    
    // Navigate to clean URL to prevent re-hydration
    window.history.replaceState({}, '', '/live-consultation');
  };

  const handleConversationSaved = (conversationId: string) => {
    console.log('✅ Conversation saved:', conversationId);
    toast({
      title: '💾 Conversazione salvata',
      description: 'La tua sessione è stata salvata con successo',
    });
  };

  // Sales Agent mode: renderizza direttamente LiveModeScreen
  if (isSalesAgentMode && shareToken) {
    // Verifica che sessionToken esista in sessionStorage
    const sessionToken = sessionStorage.getItem('salesAgent_sessionToken');
    const salesAgentConversationId = sessionStorage.getItem('salesAgent_conversationId');

    if (!sessionToken) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
          <Card className="bg-white/10 border-white/20 max-w-md">
            <CardContent className="p-12 text-center">
              <Bot className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sessione Non Valida</h2>
              <p className="text-white/70">
                La tua sessione è scaduta. Torna alla pagina precedente e riprova.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    console.log('🔵 [SALES AGENT MODE] Rendering LiveModeScreen with:', {
      mode: 'sales_agent',
      shareToken: shareToken.substring(0, 10) + '...',
      hasSessionToken: !!sessionToken,
      conversationId: salesAgentConversationId,
    });

    return (
      <LiveModeScreen
        key={`sales_agent-${shareToken}`}
        mode="sales_agent"
        useFullPrompt={false}
        voiceName={voiceName}
        shareToken={shareToken}
        salesAgentConversationId={salesAgentConversationId || undefined}
        onClose={() => {
          // Cleanup sessionStorage
          sessionStorage.removeItem('salesAgent_sessionToken');
          sessionStorage.removeItem('salesAgent_conversationId');
          sessionStorage.removeItem('salesAgent_shareToken');
          // Redirect to landing or home
          window.location.href = `/public/sales-agent/${shareToken}`;
        }}
        onConversationSaved={handleConversationSaved}
      />
    );
  }

  // Consultation Invite mode: renderizza direttamente LiveModeScreen
  if (isConsultationInviteMode && inviteToken) {
    // Verifica che sessionToken esista in sessionStorage
    const sessionToken = sessionStorage.getItem('consultationInvite_sessionToken');
    const inviteConversationId = sessionStorage.getItem('consultationInvite_conversationId');

    if (!sessionToken) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex items-center justify-center">
          <Card className="bg-white/10 border-white/20 max-w-md">
            <CardContent className="p-12 text-center">
              <Bot className="h-16 w-16 text-red-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">Sessione Non Valida</h2>
              <p className="text-white/70">
                La tua sessione è scaduta. Torna alla lobby e riprova.
              </p>
              <Button 
                className="mt-4" 
                onClick={() => window.location.href = `/invite/${inviteToken}`}
              >
                Torna alla Lobby
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }

    console.log('🔵 [CONSULTATION INVITE MODE] Rendering LiveModeScreen with:', {
      mode: 'consultation_invite',
      inviteToken: inviteToken.substring(0, 10) + '...',
      hasSessionToken: !!sessionToken,
      conversationId: inviteConversationId,
    });

    return (
      <LiveModeScreen
        key={`consultation_invite-${inviteToken}`}
        mode="consultation_invite"
        useFullPrompt={false}
        voiceName={voiceName}
        inviteToken={inviteToken}
        consultationInviteConversationId={inviteConversationId || undefined}
        onClose={() => {
          // Cleanup sessionStorage
          sessionStorage.removeItem('consultationInvite_sessionToken');
          sessionStorage.removeItem('consultationInvite_conversationId');
          sessionStorage.removeItem('consultationInvite_token');
          // Redirect back to lobby
          window.location.href = `/invite/${inviteToken}`;
        }}
        onConversationSaved={handleConversationSaved}
      />
    );
  }

  // Normal mode: richiede selezione tipo sessione
  // Se non è stato selezionato un tipo di sessione, mostra il selettore
  if (!sessionType) {
    return (
      <NormalModeWrapper sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
        <SessionTypeSelector
          onSelectType={handleSelectSessionType}
          onBack={() => setLocation('/client/ai-assistant')}
        />
      </NormalModeWrapper>
    );
  }

  // Se è stato selezionato custom ma non ancora avviata la sessione, mostra l'editor
  if (sessionType === 'custom' && !customPrompt) {
    return (
      <NormalModeWrapper sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
        <CustomPromptEditor
          onBack={() => setSessionType(null)}
          onStartSession={handleStartCustomSession}
        />
      </NormalModeWrapper>
    );
  }

  // Altrimenti mostra la schermata Live Mode
  const config = getSessionConfig();

  // Debug logging per verificare la configurazione
  console.log('📊 [SESSION CONFIG]', {
    sessionType: config.sessionType,
    consultationId: consultationId,
    isTestMode: isTestMode,
    mode: config.mode,
  });

  return (
    <NormalModeWrapper sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen}>
      <LiveModeScreen
        key={`${sessionType}-${consultationId || 'normal'}`}
        mode={config.mode}
        consultantType={config.consultantType || undefined}
        customPrompt={customPrompt || undefined}
        useFullPrompt={useFullPrompt}
        voiceName={voiceName}
        sessionType={config.sessionType}
        isTestMode={isTestMode}
        consultationId={consultationId || undefined}
        onClose={handleCloseSession}
        onConversationSaved={handleConversationSaved}
      />
    </NormalModeWrapper>
  );
}
