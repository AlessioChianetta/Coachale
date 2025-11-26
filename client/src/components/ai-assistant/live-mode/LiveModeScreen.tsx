import { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Phone, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LiveTranscript } from '../LiveTranscript';
import { useToast } from '@/hooks/use-toast';
import { getToken, getAuthUser } from '@/lib/auth';
import { float32ToBase64PCM16 } from './audio-worklet/audio-converter';

const AudioSphere3D = lazy(() => import('./AudioSphere3D'));
const ParticleField3D = lazy(() => import('./ParticleField3D'));

type LiveState = 'idle' | 'loading' | 'listening' | 'thinking' | 'speaking';

interface LiveModeScreenProps {
  mode: 'assistenza' | 'consulente' | 'sales_agent' | 'consultation_invite';
  consultantType?: 'finanziario' | 'vendita' | 'business';
  customPrompt?: string;
  useFullPrompt: boolean;
  voiceName: string;
  sessionType?: 'weekly_consultation';
  isTestMode?: boolean;
  consultationId?: string;
  shareToken?: string;
  salesAgentConversationId?: string;
  inviteToken?: string;
  consultationInviteConversationId?: string;
  onClose: () => void;
  onConversationSaved?: (conversationId: string) => void;
}

interface TranscriptEntry {
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}

export function LiveModeScreen({ mode, consultantType, customPrompt, useFullPrompt, voiceName, sessionType, isTestMode, consultationId, shareToken, salesAgentConversationId, inviteToken, consultationInviteConversationId, onClose, onConversationSaved }: LiveModeScreenProps) {
  const { toast } = useToast();
  // Refs per timer: uno per websocket session, uno per conversazione totale
  const websocketSessionTimeRef = useRef<number>(Date.now()); // Resettato al refresh
  const conversationTotalTimeRef = useRef<number>(Date.now()); // Mai resettato
  const isGracefulRestartingRef = useRef(false);
  const [liveState, setLiveState] = useState<LiveState>('loading');
  const [audioLevel, setAudioLevel] = useState(0);
  const [micLevel, setMicLevel] = useState(0);
  const [currentTranscript, setCurrentTranscript] = useState<TranscriptEntry | null>(null);
  const [userTranscript, setUserTranscript] = useState<TranscriptEntry | null>(null);
  const [loadingText, setLoadingText] = useState("Inizializzazione neurale...");
  const [transcriptHistory, setTranscriptHistory] = useState<TranscriptEntry[]>([]);
  const [isMuted, setIsMuted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const [conversationDuration, setConversationDuration] = useState(0);
  const [showDisconnectDialog, setShowDisconnectDialog] = useState(false);
  
  // 🔒 Intelligent auto-close state (backend-driven)
  const [isSessionClosing, setIsSessionClosing] = useState(false);
  
  // Autosave state and refs
  const [isAutosaving, setIsAutosaving] = useState(false);
  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveRetryCountRef = useRef<number>(0);
  const hasStartedAutosaveRef = useRef<boolean>(false);
  const isClosingRef = useRef<boolean>(false);
  const isAttemptingEndSessionRef = useRef<boolean>(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micAnimationFrameRef = useRef<number | null>(null);
  const outputAnalyserRef = useRef<AnalyserNode | null>(null);
  const outputAnimationFrameRef = useRef<number | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const isSessionActiveRef = useRef(true);
  const conversationStartTimeRef = useRef<number>(0);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioSequenceRef = useRef<number>(0);
  const isSetupRef = useRef(false);
  const accumulatedAiTextRef = useRef<string>('');
  const accumulatedUserTextRef = useRef<string>('');
  const pendingUserTranscriptResetRef = useRef<boolean>(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const isAudioStoppedRef = useRef(false);
  const isMutedRef = useRef(false);
  const sessionResumeHandleRef = useRef<string | null>(null);
  const isReconnectingRef = useRef(false);
  const reconnectAttemptsRef = useRef<number>(0);
  const maxReconnectAttempts = Infinity; // Unlimited reconnections for infinite session duration
  const hasShown75MinWarningRef = useRef<boolean>(false);
  const hasShown85MinWarningRef = useRef<boolean>(false);
  // 🔴 Ref per endSession con supporto parametro reason
  const endSessionRef = useRef<(reason?: 'manual' | 'auto_90min' | 'error') => void>(() => {});
  // 🔒 Track session closing state with ref for callback access
  const isSessionClosingRef = useRef<boolean>(false);
  // 🎤 MOBILE FIX: Track last AudioContext resume to avoid spam
  const lastAudioContextResumeRef = useRef<number>(0);
  // 💾 FLUSH CALLBACK: Track pending flush operation during reconnect
  const flushCallbackRef = useRef<((success: boolean) => void) | null>(null);
  const flushTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 🎙️ VAD DEBUG: Track Gemini VAD state for UI debugging (server-driven only)
  const [vadDebugState, setVadDebugState] = useState<'idle' | 'blocked'>('idle');
  const vadDebugTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // 📱 WAKE LOCK: Mantieni schermo sempre acceso durante chiamate
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);

  // 🔑 SESSION ISOLATION: Generate unique localStorage key for each agent/user combination
  const getResumeHandleKey = useCallback((): string => {
    if (mode === 'sales_agent') {
      // Sales agent: namespace by shareToken + conversationId
      // 🔧 FIX: Read conversationId from sessionStorage to ensure consistency during reconnect
      // If sessionStorage is empty (new device/browser), we'll start a fresh session (no resume handle)
      const storedConversationId = sessionStorage.getItem('salesAgent_conversationId');
      
      if (!shareToken) {
        console.error('🚨 [RESUME HANDLE] Missing shareToken for sales_agent mode');
        return `gemini_session_handle:sales_agent:invalid:${Date.now()}:${Math.random()}`;
      }
      
      if (!storedConversationId) {
        // No conversationId = new device/browser or fresh session
        // Return a temporary key that won't match any saved handle (intentional - start fresh)
        console.log('ℹ️ [RESUME HANDLE] No conversationId in sessionStorage - this is a new session');
        return `gemini_session_handle:sales_agent:${shareToken}:new_session`;
      }
      
      return `gemini_session_handle:sales_agent:${shareToken}:${storedConversationId}`;
    } else if (mode === 'consultation_invite') {
      // Consultation invite: namespace by inviteToken + conversationId
      // 🔧 FIX: Read conversationId from sessionStorage to ensure consistency during reconnect
      const storedConversationId = sessionStorage.getItem('consultationInvite_conversationId');
      
      if (!inviteToken) {
        console.error('🚨 [RESUME HANDLE] Missing inviteToken for consultation_invite mode');
        return `gemini_session_handle:consultation_invite:invalid:${Date.now()}:${Math.random()}`;
      }
      
      if (!storedConversationId) {
        // No conversationId = new device/browser or fresh session
        console.log('ℹ️ [RESUME HANDLE] No conversationId in sessionStorage - this is a new session');
        return `gemini_session_handle:consultation_invite:${inviteToken}:new_session`;
      }
      
      return `gemini_session_handle:consultation_invite:${inviteToken}:${storedConversationId}`;
    } else {
      // Normal/Consultant mode: namespace by userId (+ consultantType if applicable)
      const user = getAuthUser();
      
      // SECURITY: Use unique random key if userId missing to prevent accidental sharing
      if (!user?.id) {
        console.error('🚨 [RESUME HANDLE] Missing userId for authenticated mode');
        return `gemini_session_handle:${mode}:invalid:${Date.now()}:${Math.random()}`;
      }
      
      const userId = user.id;
      
      if (mode === 'consulente' && consultantType) {
        return `gemini_session_handle:consulente:${consultantType}:${userId}`;
      } else {
        return `gemini_session_handle:assistenza:${userId}`;
      }
    }
  }, [mode, shareToken, inviteToken, consultantType]);

  const startConversationTimer = useCallback(() => {
    // ⏱️  FIX CRITICO: Per consulenze settimanali, NON inizializzare i ref qui
    // Il backend invierà 'session:time_sync' con i valori corretti
    // Questo risolve il bug dove il timer si resettava a 0 dopo ogni refresh
    if (conversationStartTimeRef.current === 0 && sessionType !== 'weekly_consultation') {
      conversationStartTimeRef.current = Date.now();
      conversationTotalTimeRef.current = Date.now();
      console.log('⏱️  [TIMER] Initialized for non-consultation session');
    } else if (sessionType === 'weekly_consultation' && conversationStartTimeRef.current === 0) {
      // Per consulenze settimanali, aspettiamo session:time_sync dal backend
      console.log('⏱️  [TIMER] Waiting for session:time_sync from backend (weekly consultation)');
    }
    
    // WebSocket session time viene resettato ad ogni reconnect
    websocketSessionTimeRef.current = Date.now();

    // Reset warning flags
    hasShown75MinWarningRef.current = false;
    hasShown85MinWarningRef.current = false;

    durationIntervalRef.current = setInterval(() => {
      // Usa conversationTotalTimeRef per il tempo TOTALE mostrato e per i warning
      const elapsed = Math.floor((Date.now() - conversationTotalTimeRef.current) / 1000);
      setConversationDuration(elapsed);

      // Solo per consulenze settimanali
      if (sessionType === 'weekly_consultation') {
        // Avviso a 75 minuti (15 min dalla fine)
        if (elapsed >= 4500 && !hasShown75MinWarningRef.current) {
          hasShown75MinWarningRef.current = true;
          toast({
            title: '⏰ 15 minuti alla fine',
            description: 'La consulenza terminerà tra 15 minuti',
          });
        }

        // Avviso a 85 minuti (5 min dalla fine)
        if (elapsed >= 5100 && !hasShown85MinWarningRef.current) {
          hasShown85MinWarningRef.current = true;
          toast({
            title: '⏰ 5 minuti alla fine',
            description: 'La consulenza si avvicina alla conclusione',
            variant: 'destructive',
          });
        }

        // 🔒 Auto-chiusura gestita dal BACKEND (intelligent 90-min close con AI greeting detection)
        // Il server invia 'session:closing' e 'session:close_now' quando appropriato
      }
    }, 1000);
  }, [sessionType, toast]);

  const stopConversationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // 🎤 MOBILE FIX: Helper per resume robusto dell'AudioContext
  const ensureAudioContextRunning = useCallback(async (): Promise<boolean> => {
    if (!audioContextRef.current) {
      return false;
    }

    const now = Date.now();
    const timeSinceLastResume = now - lastAudioContextResumeRef.current;

    // Debounce: riprova resume solo se è passato almeno 1 secondo
    if (timeSinceLastResume < 1000 && audioContextRef.current.state === 'running') {
      return true; // Già running e recentemente verificato
    }

    if (audioContextRef.current.state === 'suspended') {
      console.log('🎤 [MOBILE FIX] AudioContext suspended - attempting resume...');
      try {
        await audioContextRef.current.resume();
        lastAudioContextResumeRef.current = now;
        console.log('✅ AudioContext resumed successfully, state:', audioContextRef.current.state);
        return audioContextRef.current.state === 'running';
      } catch (err) {
        console.error('❌ Failed to resume AudioContext:', err);
        return false;
      }
    }

    return audioContextRef.current.state === 'running';
  }, []);

  // Autosave function con retry e backoff lineare
  const performAutosave = useCallback(async (isManualFlush: boolean = false) => {
    // Skip se non è una consulenza settimanale o non abbiamo consultationId
    if (sessionType !== 'weekly_consultation' || !consultationId) {
      return;
    }

    // Skip se stiamo già salvando (evita chiamate sovrapposte)
    if (isAutosaving && !isManualFlush) {
      console.log('⏭️ Autosave già in corso, skip');
      return;
    }

    // Skip se la sessione si sta chiudendo (a meno che non sia il flush finale)
    if (isClosingRef.current && !isManualFlush) {
      console.log('🛑 Sessione in chiusura, skip autosave');
      return;
    }

    // Skip se non ci sono messaggi da salvare
    if (transcriptHistory.length === 0) {
      return;
    }

    setIsAutosaving(true);

    try {
      // Crea la trascrizione formattata
      const transcript = transcriptHistory
        .map(entry => {
          const timestamp = new Date(entry.timestamp).toLocaleTimeString('it-IT');
          const role = entry.role === 'user' ? 'Tu' : 'Assistente';
          return `[${timestamp}] ${role}: ${entry.text}`;
        })
        .join('\n\n');

      const token = getToken();
      if (!token) {
        throw new Error('No authentication token');
      }

      const response = await fetch(`/api/consultations/ai/${consultationId}/autosave`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          transcript,
          ...(isManualFlush && { isFinalFlush: true })
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante il salvataggio');
      }

      const data = await response.json();
      console.log(`💾 Autosave ${isManualFlush ? 'finale' : 'periodico'} completato:`, data.updatedAt);
      
      // Reset retry count on success
      autosaveRetryCountRef.current = 0;

      // Toast solo per il flush manuale finale
      if (isManualFlush) {
        toast({
          title: '💾 Trascrizione salvata',
          description: 'La consulenza è stata salvata con successo',
        });
      }
    } catch (error) {
      console.error('❌ Errore autosave:', error);

      // Incrementa retry count
      autosaveRetryCountRef.current += 1;

      // Toast non-bloccante solo se non è un flush finale
      if (!isManualFlush) {
        toast({
          title: '⚠️ Salvataggio non riuscito',
          description: `Riproverò tra ${autosaveRetryCountRef.current * 30} secondi`,
          variant: 'destructive',
        });

        // Retry con backoff lineare (30s, 60s, 90s, etc.)
        const retryDelay = autosaveRetryCountRef.current * 30000; // 30s per tentativo
        setTimeout(() => {
          performAutosave(false);
        }, retryDelay);
      } else {
        // Se è un flush finale, rilancia l'errore per bloccare la chiusura
        throw error;
      }
    } finally {
      // Sempre reset flag nel finally (viene eseguito prima del throw)
      setIsAutosaving(false);
    }
  }, [sessionType, consultationId, isAutosaving, transcriptHistory, toast]);

  // Avvia l'autosave interval
  const startAutosaveInterval = useCallback(() => {
    // Solo per consulenze settimanali
    if (sessionType !== 'weekly_consultation' || !consultationId) {
      return;
    }

    // Skip se già avviato
    if (hasStartedAutosaveRef.current) {
      return;
    }

    console.log('⏰ Autosave interval avviato (ogni 2 minuti)');
    hasStartedAutosaveRef.current = true;

    // Autosave ogni 2 minuti (120 secondi)
    autosaveIntervalRef.current = setInterval(() => {
      performAutosave(false);
    }, 120000); // 120000ms = 2 minuti
  }, [sessionType, consultationId, performAutosave]);

  // Stop autosave interval
  const stopAutosaveInterval = useCallback(() => {
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
      hasStartedAutosaveRef.current = false; // Reset flag per permettere restart
      console.log('⏹️ Autosave interval fermato');
    }
  }, []);
  // Effetto "Matrix" per cambiare le scritte di caricamento
  useEffect(() => {
    if (liveState === 'loading' || connectionStatus === 'connecting') {
      const texts = [
        "Inizializzazione neurale...",      // Parte con questo
        "Stabilisco connessione sicura...",
        "Sincronizzo memoria a breve termine...", // Più tecnico
        "Calibrazione sintesi vocale...",
        "Accesso ai protocolli di consulenza...",
        "Sistema pronto."
      ];
      let i = 0;
      const interval = setInterval(() => {
        setLoadingText(texts[i]);
        i = (i + 1) % texts.length;
      }, 1500); // Cambia scritta ogni 1.5 secondi
      return () => clearInterval(interval);
    }
  }, [liveState, connectionStatus]);
  const attemptGracefulRestart = useCallback(() => {
    // 1. Se stiamo già riavviando o non abbiamo un handle per riprendere, fermati
    if (isGracefulRestartingRef.current || !sessionResumeHandleRef.current) return;

    // 2. Calcola quanto tempo è passato SULLA SESSIONE WEBSOCKET CORRENTE
    const elapsedMinutes = (Date.now() - websocketSessionTimeRef.current) / 1000 / 60;

    // 3. Soglia di sicurezza: 7 minuti (TESTING - was 7 min)
    if (elapsedMinutes < 7) return;

    // 4. CRITICO: Fallo solo se c'è silenzio (idle o listening senza audio in coda)
    //    Non farlo se l'AI sta parlando (speaking) o pensando (thinking/loading)
    const isSilent = liveState === 'listening' || liveState === 'idle';
    const noAudioPending = audioQueueRef.current.length === 0 && !isPlayingRef.current;

    // Se siamo oltre i 2 minuti E c'è silenzio... (TESTING - was 7 min)
    if (isSilent && noAudioPending) {
        console.log(`♻️ [PROACTIVE RESET] WebSocket session age: ${elapsedMinutes.toFixed(1)}m. Safe to restart.`);
        triggerReconnect();
    } 
    // Se siamo oltre i 9 minuti (Hard Limit), forziamo anche se stanno parlando (TESTING - was 9 min)
    // per evitare che il server uccida la sessione perdendo i dati
    else if (elapsedMinutes > 9) {
        console.warn(`⚠️ [FORCE RESET] WebSocket session age: ${elapsedMinutes.toFixed(1)}m. Forcing restart to save session.`);
        triggerReconnect();
    }
  }, [liveState]);

  // Aggiungi questo useEffect
  useEffect(() => {
      const interval = setInterval(() => {
          attemptGracefulRestart();
      }, 5000); // Controlla ogni 5 secondi

      return () => clearInterval(interval);
  }, [attemptGracefulRestart]);

  // Funzione helper per eseguire la riconnessione vera e propria
  const triggerReconnect = async () => {
    isGracefulRestartingRef.current = true;

    console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log("🔄 [FLUSH-BEFORE-RECONNECT] Initiating graceful session cycling...");
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   Mode: ${mode}`);
    console.log(`   Messages in history: ${transcriptHistory.length}`);
    console.log(`   Pending AI text: ${accumulatedAiTextRef.current ? `"${accumulatedAiTextRef.current.substring(0, 50)}..."` : 'none'}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // Only flush for sales_agent and consultation_invite modes
    const shouldFlush = (mode === 'sales_agent' || mode === 'consultation_invite') && wsRef.current && wsRef.current.readyState === WebSocket.OPEN;

    let flushSuccess = false; // Track if flush succeeded

    if (!shouldFlush) {
      console.log(`⏭️  [FLUSH-BEFORE-RECONNECT] Skipping flush - mode='${mode}', ws=${wsRef.current ? 'exists' : 'null'}, readyState=${wsRef.current?.readyState || 'N/A'}`);
      
      toast({
        title: "⚡ Ottimizzazione connessione",
        description: "Micro-riconnessione per mantenere la linea stabile.",
        duration: 2000,
      });
      
      // Don't return early - proceed to socket close at end
    } else {
      // NOTE: No need to send conversation_update here!
      // The server already has conversationMessages in memory from audio transcripts.
      // The flush_messages handler will save those server-side messages directly to DB.
      // Sending conversation_update would be redundant and could cause timestamp mismatches.

      console.log(`💾 [FLUSH-BEFORE-RECONNECT] Sending flush_messages to save server's conversationMessages to database...`);
      console.log(`   Server has ${accumulatedAiTextRef.current ? 'in-flight AI text' : 'no pending AI text'} - will be captured by flush handler`);
      
      const flushStartTime = Date.now();
      let flushCompleted = false;
      
      // Create promise that resolves when flush completes OR timeout
      const flushPromise = new Promise<boolean>((resolve) => {
        // Set callback for flush_complete handler
        flushCallbackRef.current = (success) => {
          if (flushCompleted) {
            console.warn(`⚠️  [FLUSH-BEFORE-RECONNECT] Duplicate flush callback - ignoring`);
            return;
          }
          flushCompleted = true;
          
          const flushDuration = Date.now() - flushStartTime;
          console.log(`${success ? '✅' : '❌'} [FLUSH-BEFORE-RECONNECT] Flush ${success ? 'completed' : 'failed'} in ${flushDuration}ms`);
          
          // Clear refs
          flushCallbackRef.current = null;
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          
          resolve(success);
        };

        // Set timeout as safety net (10 seconds)
        flushTimeoutRef.current = setTimeout(() => {
          if (flushCompleted) return;
          flushCompleted = true;
          
          console.warn(`⚠️  [FLUSH-BEFORE-RECONNECT] Flush timeout after 10s - proceeding anyway (autosave has likely saved messages)`);
          
          // Clear refs
          flushCallbackRef.current = null;
          flushTimeoutRef.current = null;
          
          resolve(false);
        }, 10000);
      });

      try {
        if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({
            type: 'flush_messages'
          }));
          console.log(`📨 [FLUSH-BEFORE-RECONNECT] flush_messages request sent - waiting for flush_complete...`);
          
          // Wait for flush to complete (or timeout)
          flushSuccess = await flushPromise;
        } else {
          console.warn(`⚠️  [FLUSH-BEFORE-RECONNECT] WebSocket not ready - skipping flush (readyState=${wsRef.current?.readyState || 'N/A'})`);
          // Clear pending flush refs
          if (flushCallbackRef.current) {
            flushCallbackRef.current = null;
          }
          if (flushTimeoutRef.current) {
            clearTimeout(flushTimeoutRef.current);
            flushTimeoutRef.current = null;
          }
          flushSuccess = false;
        }
      } catch (error) {
        console.error(`❌ [FLUSH-BEFORE-RECONNECT] Failed to send flush_messages:`, error);
        // Clear callback and timeout
        if (flushCallbackRef.current) {
          flushCallbackRef.current = null;
        }
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        flushSuccess = false;
      }
    }

    // STEP 2: Now it's safe to close WebSocket
    const delayBeforeClose = flushSuccess ? 500 : 100; // Extra delay only if flush succeeded
    console.log(`⏰ [FLUSH-BEFORE-RECONNECT] Step 2/2: Waiting ${delayBeforeClose}ms before closing WebSocket...`);
    
    await new Promise(resolve => setTimeout(resolve, delayBeforeClose));

    console.log(`🔌 [FLUSH-BEFORE-RECONNECT] Closing WebSocket now${flushSuccess ? ' - database is up to date' : ' - relying on autosave'}`);
    
    // CRITICAL: Reset flag BEFORE closing socket to avoid race condition
    // If we reset after close(), the onclose handler might run before reset
    isGracefulRestartingRef.current = false;
    
    if (wsRef.current) {
      wsRef.current.close(1000, "Proactive Client Restart");
    }

    // UI feedback
    toast({
      title: "⚡ Ottimizzazione connessione",
      description: "Micro-riconnessione per mantenere la linea stabile.",
      duration: 2000,
    });

    console.log(`✅ [FLUSH-BEFORE-RECONNECT] Flush-before-reconnect sequence completed (flush ${flushSuccess ? 'successful' : 'skipped/failed'})`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  };

  const setupWebSocket = useCallback(async () => {
    // CRITICAL: Invalidate any pending flush callbacks from previous connection
    // This prevents stale callbacks from executing on the new connection
    if (flushCallbackRef.current) {
      console.log(`🧹 [SETUP] Clearing stale flush callback from previous connection`);
      flushCallbackRef.current = null;
    }
    if (flushTimeoutRef.current) {
      console.log(`🧹 [SETUP] Clearing stale flush timeout from previous connection`);
      clearTimeout(flushTimeoutRef.current);
      flushTimeoutRef.current = null;
    }
    
    try {
      let token: string;
      
      // Sales Agent mode: usa sessionToken pubblico da sessionStorage
      if (mode === 'sales_agent') {
        const sessionToken = sessionStorage.getItem('salesAgent_sessionToken');
        if (!sessionToken) {
          throw new Error('Sessione non valida. Ricarica la pagina.');
        }
        token = sessionToken;
        console.log('🔐 [SALES AGENT] Using public sessionToken from sessionStorage');
      } else if (mode === 'consultation_invite') {
        // Consultation Invite mode: usa sessionToken pubblico da sessionStorage
        const sessionToken = sessionStorage.getItem('consultationInvite_sessionToken');
        if (!sessionToken) {
          throw new Error('Sessione non valida. Ricarica la pagina.');
        }
        token = sessionToken;
        console.log('🔐 [CONSULTATION INVITE] Using public sessionToken from sessionStorage');
      } else {
        // Normal mode: usa token utente autenticato
        const userToken = getToken();
        if (!userToken) {
          throw new Error('No authentication token found');
        }
        token = userToken;
      }

      // Session resumption: carica handle salvato per questo specifico agente/utente
      const resumeHandleKey = getResumeHandleKey();
      const savedHandle = localStorage.getItem(resumeHandleKey);
      if (savedHandle) {
        sessionResumeHandleRef.current = savedHandle;
        console.log(`🔄 [SESSION RESUMPTION] Loaded saved handle from localStorage`);
        console.log(`   → Storage key: ${resumeHandleKey}`);
        console.log(`   → Handle preview: ${savedHandle.substring(0, 20)}...`);
        console.log(`   → Will RESUME existing session instead of creating new one`);
      } else {
        console.log(`🆕 [SESSION RESUMPTION] No saved handle found - will create NEW session`);
        console.log(`   → Storage key: ${resumeHandleKey}`);
        console.log(`   → Session resumption enabled - handle will be saved after setup`);
      }

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      let wsUrl: string;

      if (mode === 'sales_agent') {
        // Sales Agent mode: costruisci URL con mode, shareToken, sessionToken
        if (!shareToken) {
          throw new Error('ShareToken mancante per Sales Agent');
        }
        wsUrl = `${protocol}//${host}/ws/ai-voice?mode=sales_agent&shareToken=${encodeURIComponent(shareToken)}&sessionToken=${encodeURIComponent(token)}`;
        // Voice fisso per sales agent
        wsUrl += `&voice=${encodeURIComponent(voiceName)}`;
        
        console.log('🔌 [SALES AGENT] Connecting to WebSocket:', `mode=sales_agent, shareToken=${shareToken.substring(0, 10)}..., voice=${voiceName}`);
      } else if (mode === 'consultation_invite') {
        // Consultation Invite mode: costruisci URL con mode, inviteToken, sessionToken
        if (!inviteToken) {
          throw new Error('InviteToken mancante per Consultation Invite');
        }
        wsUrl = `${protocol}//${host}/ws/ai-voice?mode=consultation_invite&inviteToken=${encodeURIComponent(inviteToken)}&sessionToken=${encodeURIComponent(token)}`;
        // Voice fisso per consultation invite
        wsUrl += `&voice=${encodeURIComponent(voiceName)}`;
        
        console.log('🔌 [CONSULTATION INVITE] Connecting to WebSocket:', `mode=consultation_invite, inviteToken=${inviteToken.substring(0, 10)}..., voice=${voiceName}`);
      } else {
        // Normal mode: usa token come parametro token
        wsUrl = `${protocol}//${host}/ws/ai-voice?token=${encodeURIComponent(token)}&mode=${encodeURIComponent(mode)}`;

        if (consultantType) {
          wsUrl += `&consultantType=${encodeURIComponent(consultantType)}`;
        }

        // Passa la preferenza Full Prompt al server
        wsUrl += `&useFullPrompt=${useFullPrompt}`;

        // Passa la voce selezionata
        wsUrl += `&voice=${encodeURIComponent(voiceName)}`;

        // Passa il tipo di sessione se è una consulenza
        if (sessionType) {
          wsUrl += `&sessionType=${encodeURIComponent(sessionType)}`;
        }

        // Add session resume handle if present
        if (sessionResumeHandleRef.current) {
          wsUrl += `&resumeHandle=${encodeURIComponent(sessionResumeHandleRef.current)}`;
        }

        if (customPrompt) {
          // Enforce 10k character limit for custom prompts
          const truncatedPrompt = customPrompt.length > 10000 
            ? customPrompt.substring(0, 10000) 
            : customPrompt;

          if (customPrompt.length > 10000) {
            console.warn(`⚠️ Custom prompt truncated from ${customPrompt.length} to 10000 characters`);
          }

          wsUrl += `&customPrompt=${encodeURIComponent(truncatedPrompt)}`;
        }

        console.log('🔌 Connecting to Gemini Live WebSocket:', wsUrl.replace(token, '***'), `[Mode: ${mode}${consultantType ? `, Type: ${consultantType}` : ''}${customPrompt ? ', Custom Prompt: Yes' : ''}]`);
      }

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected');
        setConnectionStatus('connected');
        setLiveState('loading');

        // Reset reconnect attempts on successful connection
        reconnectAttemptsRef.current = 0;

        startConversationTimer();

        // Show different toast for resumed vs new session
        const isResuming = sessionResumeHandleRef.current !== null;
        toast({
          title: isResuming ? '🔄 Sessione ripresa' : '🎙️ Connessione stabilita',
          description: 'Sincronizzazione neurale in corso...', // Testo più appropriato
            duration: 2000,
        });
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          handleWebSocketMessage(message);
        } catch (error) {
          console.error('❌ Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setConnectionStatus('error');

        // Stop audio on connection error
        stopCurrentAudio();

        toast({
          variant: 'destructive',
          title: 'Errore connessione',
          description: 'Impossibile connettersi al servizio vocale',
        });
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);

        // Stop audio when connection closes
        stopCurrentAudio();

        // ===========================================================================
        // 1. GESTIONE PROACTIVE RESTART (Il riavvio tattico dei 7 minuti)
        // ===========================================================================
        // Se il motivo è il nostro riavvio volontario, riconnettiamo SUBITO ignorando errori e delay
        if (event.reason === "Proactive Client Restart") {
            console.log(`\n${'='.repeat(70)}`);
            console.log("⚡ [PROACTIVE RESTART] Riconnessione immediata per mantenere la sessione...");
            console.log(`${'='.repeat(70)}\n`);

            isReconnectingRef.current = true;
            setConnectionStatus('connecting');

            // CRITICO: Resetta il timer WEBSOCKET per il prossimo ciclo (NON il timer totale!)
            websocketSessionTimeRef.current = Date.now(); // Il timer riparte da 0 per i prossimi 7 min
            isGracefulRestartingRef.current = false;  // Sblocca il flag per il futuro

            // 💾 SAFETY NET: Minimal delay to let socket cleanup complete
            // NOTE: triggerReconnect already handles flush delays internally (500ms if flush successful)
            // This is just for socket cleanup, no extra database delay needed
            const reconnectDelay = 100;  // 100ms for socket cleanup only
            
            console.log(`⏰ [PROACTIVE RESTART] Reconnecting in ${reconnectDelay}ms (flush delays already handled by triggerReconnect)`);

            // Riconnessione con delay appropriato
            setTimeout(() => {
                setupWebSocket(); 
            }, reconnectDelay);

            return; // ESCI QUI: Non eseguire il resto della logica di errore
        }

        // ===========================================================================
        // 2. GESTIONE ERRORI STANDARD (Logica di Auto-Reconnect Esistente)
        // ===========================================================================

        // Gemini error codes handling (1xxx standard + 44xx app specific)
        const is44xxCode = event.code >= 4400 && event.code < 4500;

        const isRecoverableClose = 
          event.code === 1001 ||  // Going Away (normal timeout)
          event.code === 1006 ||  // Abnormal Closure (network)
          event.code === 1011 ||  // Internal Error
          event.code === 1012 ||  // Service Restart
          event.code === 1013 ||  // Try Again Later
          is44xxCode;             // All 44xx application errors (transient)

        const shouldReconnect = isRecoverableClose && 
                                isSessionActiveRef.current && 
                                !isReconnectingRef.current;

        if (shouldReconnect) {
          reconnectAttemptsRef.current++;
          const attemptNumber = reconnectAttemptsRef.current;

          // Exponential backoff with cap: max 30s wait
          const uncappedDelay = Math.pow(2, attemptNumber - 1) * 1000;
          const delay = Math.min(uncappedDelay, 30000); 

          console.log(`\n${'='.repeat(70)}`);
          console.log(`🔄 [AUTO-RECONNECT] Session timeout detected (code ${event.code})`);
          console.log(`${'='.repeat(70)}`);
          console.log(`   → Attempt #${attemptNumber}`);
          console.log(`   → Delay: ${delay}ms`);

          isReconnectingRef.current = true;
          setConnectionStatus('connecting');

          toast({
            title: '🔄 Ripresa sessione in corso...',
            description: `Tentativo #${attemptNumber} - La conversazione continua automaticamente...`,
            duration: 3000,
          });

          // Reconnect with delay
          setTimeout(() => {
            setupWebSocket().then(() => {
              isReconnectingRef.current = false;
              console.log(`✅ [AUTO-RECONNECT] Successfully reconnected on attempt #${attemptNumber}!`);
            }).catch((err) => {
              console.error(`❌ [AUTO-RECONNECT] Attempt #${attemptNumber} failed:`, err);
              isReconnectingRef.current = false;
              setConnectionStatus('connecting');
            });
          }, delay);
        } else {
          // Se arriviamo qui con code 1000 (e NON è proactive restart), è l'utente che ha chiuso.
          setConnectionStatus('disconnected');
          stopConversationTimer();

          if (event.code === 4401) {
            toast({
              variant: 'destructive',
              title: 'Autenticazione fallita',
              description: 'Riprova a connetterti',
            });
          }
        }
      };
    } catch (error) {
      console.error('❌ Error setting up WebSocket:', error);
      setConnectionStatus('error');
      toast({
        variant: 'destructive',
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Errore sconosciuto',
      });
    }
  }, [mode, consultantType, customPrompt, toast, startConversationTimer, stopConversationTimer, shareToken, voiceName, useFullPrompt, sessionType]);

  const playNextAudioChunk = useCallback(async () => {
    // LOG STATO INIZIALE
    console.log(`🎵 [PLAYBACK START] Tentativo playback. isPlaying: ${isPlayingRef.current}, Coda: ${audioQueueRef.current.length}, SessionActive: ${isSessionActiveRef.current}`);

    if (!isSessionActiveRef.current) {
      audioQueueRef.current = [];
      setAudioLevel(0);
      return;
    }

    if (isPlayingRef.current || audioQueueRef.current.length === 0) {
      console.log(`⏭️ [PLAYBACK SKIP] Già in riproduzione o coda vuota.`);
      return;
    }

    if (isAudioStoppedRef.current) {
      console.log(`🛑 [PLAYBACK ABORT] Audio stoppato forzatamente.`);
      return;
    }

    try {
      // SETTAGGIO FLAG "TRUE"
      isPlayingRef.current = true;
      console.log(`🔊 [STATE CHANGE] isPlayingRef settato a TRUE`);

      setLiveState('speaking');

      const audioBuffer = audioQueueRef.current.shift()!;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }

      if (!outputAnalyserRef.current) {
        const outputAnalyser = audioContextRef.current.createAnalyser();
        outputAnalyser.fftSize = 256;
        outputAnalyser.connect(audioContextRef.current.destination);
        outputAnalyserRef.current = outputAnalyser;
      }

      const decodedBuffer = await audioContextRef.current.decodeAudioData(audioBuffer.slice(0));

      if (isAudioStoppedRef.current || !isSessionActiveRef.current) {
        console.log('🛑 [PLAYBACK ABORT] Interrotto dopo decoding.');
        isPlayingRef.current = false;
        setLiveState('listening');
        return;
      }

      await ensureAudioContextRunning();

      const source = audioContextRef.current.createBufferSource();
      source.buffer = decodedBuffer;
      source.connect(outputAnalyserRef.current);

      currentSourceRef.current = source;

      // ANIMAZIONE
      const outputDataArray = new Uint8Array(outputAnalyserRef.current.frequencyBinCount);
      const updateOutputLevel = () => {
        if (!outputAnalyserRef.current || !isPlayingRef.current) return;
        outputAnalyserRef.current.getByteFrequencyData(outputDataArray);
        const average = outputDataArray.reduce((a, b) => a + b, 0) / outputDataArray.length;
        setAudioLevel(average);
        outputAnimationFrameRef.current = requestAnimationFrame(updateOutputLevel);
      };
      updateOutputLevel();

      source.onerror = (error) => {
        console.error('❌ [AUDIO ERROR]', error);
        currentSourceRef.current = null;
        isPlayingRef.current = false;
        console.log(`🔇 [STATE CHANGE] Error -> isPlayingRef settato a FALSE`);
        if (outputAnimationFrameRef.current) {
          cancelAnimationFrame(outputAnimationFrameRef.current);
          outputAnimationFrameRef.current = null;
        }
        setAudioLevel(0);
        playNextAudioChunk();
      };

      source.onended = () => {
        console.log(`🏁 [CHUNK END] Chunk finito.`);

        currentSourceRef.current = null;
        if (outputAnimationFrameRef.current) {
          cancelAnimationFrame(outputAnimationFrameRef.current);
          outputAnimationFrameRef.current = null;
        }

        // SETTAGGIO FLAG "FALSE"
        isPlayingRef.current = false;
        console.log(`🔇 [STATE CHANGE] isPlayingRef settato a FALSE. Coda rimanente: ${audioQueueRef.current.length}`);

        setAudioLevel(0);

        if (!isSessionActiveRef.current) {
          audioQueueRef.current = [];
          return;
        }

        if (audioQueueRef.current.length > 0) {
          console.log(`🔄 [CHAIN] Passo al prossimo chunk...`);
          playNextAudioChunk();
        } else {
          console.log(`💤 [IDLE] Coda vuota, torno in listening.`);
          setLiveState('listening');
        }
      };

      source.start(0);
    } catch (error) {
      console.error('❌ Error playing audio:', error);
      isPlayingRef.current = false;
      setAudioLevel(0);
      setLiveState('listening');
    }
  }, []);

  const stopCurrentAudio = useCallback(() => {
    console.log('🛑 Stopping current audio due to interruption');

    // 1. Setta abort flag per fermare playback in-flight
    isAudioStoppedRef.current = true;

    // 2. Ferma audio source corrente se sta riproducendo
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
        currentSourceRef.current.disconnect();
      } catch (e) {
        // Già fermato, ignora
      }
      currentSourceRef.current = null;
    }

    // 3. Svuota coda audio (cancella chunk vecchi)
    audioQueueRef.current = [];

    // 4. Reset playing flag
    isPlayingRef.current = false;

    // 5. Ferma animazione audio level
    if (outputAnimationFrameRef.current) {
      cancelAnimationFrame(outputAnimationFrameRef.current);
      outputAnimationFrameRef.current = null;
    }

    // 6. Reset audio level visuale
    setAudioLevel(0);
  }, []);

  const handleWebSocketMessage = useCallback((message: any) => {
    console.log('📨 WebSocket message:', message.type);

    switch (message.type) {
      case 'ready':
        console.log('✅ Gemini Live session ready');
        
        // Sales Agent & Consultation Invite mode: non aspettare chunks_complete (non arriverà mai)
        if (mode === 'sales_agent' || mode === 'consultation_invite') {
          console.log(`🔵 [${mode.toUpperCase()}] No user context - setting listening state immediately`);
          setLiveState('listening');
          setConnectionStatus('connected');
        } else {
          // Normal mode: aspetta chunks_complete
          setLiveState('loading');
        }
        
        // 🔥 FIX CRITICO Task 8: Avvia autosave durante session resume
        // Durante un resume, transcriptHistory è vuoto (non viene caricato dal backend)
        // ma la sessione esiste già, quindi dobbiamo avviare l'autosave immediatamente
        if (sessionType === 'weekly_consultation' && consultationId && sessionResumeHandleRef.current) {
          console.log('🔄 [AUTOSAVE FIX] Session resumed - avvio autosave immediatamente');
          console.log(`   → consultationId: ${consultationId}`);
          console.log(`   → resumeHandle: ${sessionResumeHandleRef.current.substring(0, 20)}...`);
          startAutosaveInterval();
        }
        break;

        case 'ai_transcript':
        if (message.text) {
          // --- FILTRO TESTO INTELLIGENTE ---
          if (isAudioStoppedRef.current) {
             // Caso A: C'è testo accumulato -> È un "Zombie" della vecchia frase -> BUTTARE
             if (accumulatedAiTextRef.current !== '') {
                console.log(`🛡️ [TEXT ZOMBIE] Testo vecchio ignorato: "${message.text.substring(0, 20)}..."`);
                return; 
             }

             // Caso B: Accumulatore vuoto -> È l'inizio della NUOVA risposta -> SBLOCCARE
             // (Significa che il turno precedente è stato pulito correttamente da turn_complete)
             console.log(`🟢 [NEW TURN START] Nuova risposta rilevata: Sblocco audio.`);
             isAudioStoppedRef.current = false;
          }
          // ---------------------------------

          const isNewTurn = accumulatedAiTextRef.current === '';

          // Se è un nuovo turno AI, prepara reset user transcript per il PROSSIMO turno utente
          if (isNewTurn) {
            pendingUserTranscriptResetRef.current = true;
          }

          // Se è un nuovo turno E c'è audio in riproduzione, STOP (barge-in server side)
          // (Questo serve se l'AI decide di interrompersi da sola o cambiare discorso)
          if (isNewTurn && (isPlayingRef.current || audioQueueRef.current.length > 0)) {
            console.log('🛑 New turn barge-in (Server Side logic) - resetting audio');
            stopCurrentAudio();
            // Importante: riapriamo subito il gate perché questo è un nuovo turno valido
            isAudioStoppedRef.current = false; 
          }

          // Accumula il testo AI
          accumulatedAiTextRef.current += message.text;

          const updatedTranscript = {
            role: 'assistant' as const,
            text: accumulatedAiTextRef.current,
            timestamp: Date.now(),
          };

          // Aggiorna currentTranscript per display in tempo reale
          setCurrentTranscript(updatedTranscript);

          // Persist IMMEDIATAMENTE nello storico
          setTranscriptHistory(prev => {
            if (isNewTurn) {
              return [...prev, updatedTranscript];
            } else {
              if (prev.length > 0 && prev[prev.length - 1].role === 'assistant') {
                const updated = [...prev];
                updated[updated.length - 1] = updatedTranscript;
                return updated;
              } else {
                return [...prev, updatedTranscript];
              }
            }
          });

          // Logica Auto-Close (solo per consulenza settimanale)
          if (sessionType === 'weekly_consultation') {
             const elapsedSeconds = Math.floor((Date.now() - conversationTotalTimeRef.current) / 1000);
             if (elapsedSeconds >= 5100) {
                 const text = accumulatedAiTextRef.current.toLowerCase();
                 const closingWords = ['arrivederci', 'addio', 'ci sentiamo', 'buona giornata', 'ciao', 'a presto'];
                 if (closingWords.some(word => text.includes(word))) {
                    setTimeout(() => { endSessionRef.current('auto_90min'); }, 4000);
                 }
             }
          }

          setLiveState('speaking');
        }
        break;

      case 'user_transcript':
        if (message.text) {
          // 1. Gestione Reset Ritardato (se c'era un turno AI precedente)
          if (pendingUserTranscriptResetRef.current) {
            console.log('🔄 [TRANSCRIPT RESET] Resetting user transcript for new turn');
            setUserTranscript(null);
            accumulatedUserTextRef.current = '';
            pendingUserTranscriptResetRef.current = false;
          }

          const isNewUserTurn = accumulatedUserTextRef.current === '';

          // 2. LOGICA BARGE-IN (Interruzione)
          if (isNewUserTurn) {
            console.log(`🗣️ [USER START] Nuovo turno rilevato: "${message.text}"`);
            console.log(`   🔍 [DEBUG STATE] isPlayingRef: ${isPlayingRef.current}`);
            console.log(`   🔍 [DEBUG STATE] Queue Length: ${audioQueueRef.current.length}`);

            // DIAGNOSTICA: Vediamo se il bug si sarebbe verificato con la vecchia logica
            if (!isPlayingRef.current && audioQueueRef.current.length === 0) {
                 console.warn(`⚠️ [RACE CONDITION DETECTED] L'utente ha parlato nel "buco" tra due chunk audio! Con la vecchia logica l'AI NON si sarebbe fermata.`);
            }

            // --- FIX CRITICO ---
            // NESSUNA CONDIZIONE EXTRA. Se l'utente inizia a parlare, zittiamo l'AI.
            // stopCurrentAudio è sicuro: se l'audio è già fermo, non fa danni.
            console.log('🛑 [BARGE-IN TRIGGER] Nuovo turno utente -> STOP AUDIO FORZATO (Unconditional)');
            stopCurrentAudio();
            setLiveState('listening');
          }

          // 3. Accumulo testo e aggiornamento UI
          accumulatedUserTextRef.current += message.text;

          const updatedUserTranscript = {
            role: 'user' as const,
            text: accumulatedUserTextRef.current,
            timestamp: Date.now(),
          };

          // Aggiorna userTranscript per display in tempo reale
          setUserTranscript(updatedUserTranscript);

          // Persist nello storico
          setTranscriptHistory(prev => {
            if (isNewUserTurn) {
              // Nuovo turno - aggiungi una nuova entry
              return [...prev, updatedUserTranscript];
            } else {
              // Stesso turno - aggiorna l'ultima entry user
              if (prev.length > 0 && prev[prev.length - 1].role === 'user') {
                const updated = [...prev];
                updated[updated.length - 1] = updatedUserTranscript;
                return updated;
              } else {
                return [...prev, updatedUserTranscript];
              }
            }
          });
        }
        break;

      case 'audio_output':
      if (message.data) {
        // --- FILTRO AUDIO INTELLIGENTE ---
        if (isAudioStoppedRef.current) {
          // Caso A: C'è testo accumulato -> È un pacchetto "Zombie" della vecchia frase -> BUTTARE
          if (accumulatedAiTextRef.current !== '') {
             // Nota: Rimuovi il console.log se vuoi meno rumore nella console
             // console.log('🛡️ [ZOMBIE KILLER] Pacchetto audio scartato (vecchio turno).');
             return; 
          } 

          // Caso B: Accumulatore vuoto -> È l'inizio del NUOVO audio -> SBLOCCARE
          // (Significa che turn_complete ha pulito il vecchio turno)
          console.log('🟢 [NEW TURN AUDIO] Nuovo audio rilevato a buffer vuoto: Sblocco.');
          isAudioStoppedRef.current = false;
        }
        // ---------------------------------

        const audioData = Uint8Array.from(atob(message.data), c => c.charCodeAt(0));
        audioQueueRef.current.push(audioData.buffer);

        playNextAudioChunk();
      }
      break;

      case 'chunks_complete':
        console.log('✅ User data chunks fully loaded - ready to listen');
        setLiveState('listening');
        break;

      case 'session:time_sync':
        console.log(`\n⏱️  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log('⏱️  [TIME SYNC] Received session time synchronization from backend');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        if (message.sessionStartTime && message.elapsedSeconds !== undefined) {
          const sessionStart = new Date(message.sessionStartTime);
          const elapsedMinutes = Math.floor(message.elapsedSeconds / 60);
          const elapsedSecondsRemainder = message.elapsedSeconds % 60;
          
          console.log(`   → Backend session start: ${sessionStart.toISOString()}`);
          console.log(`   → Elapsed time: ${elapsedMinutes}:${elapsedSecondsRemainder.toString().padStart(2, '0')}`);
          console.log(`   → Syncing frontend timer to match backend...`);
          
          // 🔑 CRITICAL FIX: Sincronizza timer frontend con backend
          // Questo garantisce che dopo un refresh il timer continui dal punto corretto
          conversationTotalTimeRef.current = message.sessionStartTime;
          conversationStartTimeRef.current = message.sessionStartTime;
          setConversationDuration(message.elapsedSeconds);
          
          console.log(`   ✅ Frontend timer synchronized with backend`);
          console.log(`   → Timer will show: ${elapsedMinutes}:${elapsedSecondsRemainder.toString().padStart(2, '0')}`);
          console.log(`   → Timer will continue counting from this point`);
          
          // Se è un resume, mostra notifica
          if (message.elapsedSeconds > 0) {
            toast({
              title: '⏱️ Timer sincronizzato',
              description: `Sessione ripresa da ${elapsedMinutes} minuti`,
              duration: 3000,
            });
          }
        } else {
          console.warn('⚠️  [TIME SYNC] Invalid sync data received:', message);
        }
        
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        break;

      case 'stop_audio':
        console.log('🛑 [STOP AUDIO] Server detected user speaking while AI was talking - stopping immediately!');
        console.log(`   → Reason: ${message.reason || 'unknown'}`);
        
        // FERMA IMMEDIATAMENTE l'audio in riproduzione
        stopCurrentAudio();
        
        // 🛡️ RESET TESTO: Forza il prossimo testo ad essere "nuovo turno" 
        // così i pacchetti audio ritardatari vengono scartati
        accumulatedAiTextRef.current = '';
        
        // CRITICO: Aggiorna liveState per riattivare microfono
        setLiveState('listening');
        
        // Log per debug
        console.log(`   → Audio playback stopped`);
        console.log(`   → Audio queue cleared: ${audioQueueRef.current.length} chunks discarded`);
        console.log(`   → AI text accumulator reset to detect new turn`);
        console.log(`   → State reset to listening - user can continue speaking`);
        break;

      case 'barge_in_detected':
        console.log('🛑 [BARGE-IN] Gemini VAD detected user interruption - stopping audio immediately!');
        
        // 🎯 VAD DEBUG: Mostra che Gemini VAD ha bloccato l'AI
        setVadDebugState('blocked');
        if (vadDebugTimeoutRef.current) {
          clearTimeout(vadDebugTimeoutRef.current);
        }
        vadDebugTimeoutRef.current = setTimeout(() => {
          setVadDebugState('idle');
        }, 2000);
        
        // FERMA IMMEDIATAMENTE l'audio in riproduzione
        stopCurrentAudio();
        
        // 🛡️ RESET TESTO: Forza il prossimo testo ad essere "nuovo turno"
        // così i pacchetti audio ritardatari vengono scartati
        accumulatedAiTextRef.current = '';
        
        // CRITICO: Aggiorna liveState per riattivare microfono
        setLiveState('listening');
        
        // Log per debug
        console.log(`   → Audio queue cleared: ${audioQueueRef.current.length} chunks discarded`);
        console.log(`   → Playback stopped: isPlayingRef = ${isPlayingRef.current}`);
        console.log(`   → AI text accumulator reset to detect new turn`);
        console.log(`   → State reset to listening - microphone re-armed`);
        break;

        case 'turn_complete':
        console.log('✅ Turn complete');

        // PULIZIA FINALE
        // Quando il turno finisce, resettiamo il flag di stop così siamo pronti
        // per la NUOVA risposta che l'AI genererà basandosi sulla tua interruzione.
        isAudioStoppedRef.current = false; 
        accumulatedAiTextRef.current = '';

        if (liveState !== 'loading') {
          setLiveState('listening');
        }
        break;

      case 'conversation_saved':
        console.log('✅ Conversation saved:', message.conversationId);
        if (onConversationSaved && message.conversationId) {
          onConversationSaved(message.conversationId);
        }
        break;

      case 'pong':
        break;

      case 'flush_complete':
        console.log(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log('💾 [FLUSH] Flush completed successfully');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   Messages saved: ${message.messagesSaved || 0}`);
        console.log(`   Total messages: ${message.totalMessages || 0}`);
        console.log(`   Duration: ${message.duration || 0}ms`);
        console.log(`   Already saved: ${message.alreadySaved ? 'Yes' : 'No'}`);
        console.log(`   Skipped: ${message.skipped ? 'Yes' : 'No'}`);
        if (message.reason) {
          console.log(`   Reason: ${message.reason}`);
        }
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Clear timeout
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        
        // Call callback if exists
        if (flushCallbackRef.current) {
          flushCallbackRef.current(true);
          flushCallbackRef.current = null;
        }
        break;

      case 'flush_error':
        console.error(`\n💾 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error('💾 [FLUSH] Flush failed');
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.error(`   Error: ${message.error}`);
        console.error(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Clear timeout
        if (flushTimeoutRef.current) {
          clearTimeout(flushTimeoutRef.current);
          flushTimeoutRef.current = null;
        }
        
        // Call callback with failure
        if (flushCallbackRef.current) {
          flushCallbackRef.current(false);
          flushCallbackRef.current = null;
        }
        break;

      case 'session_expiring':
        console.log(`\n${'⚠️'.repeat(35)}`);
        console.log(`⏰ [SESSION EXPIRING] GO AWAY received - session will close in ~60 seconds`);
        console.log(`${'⚠️'.repeat(35)}`);
        console.log(`   → Time left: ${message.timeLeft}s`);
        console.log(`   → Has handle ready: ${message.hasHandle ? 'YES ✅' : 'NO ❌'}`);

        // CRITICAL: Reset reconnect attempts counter on GO AWAY
        // GO AWAY means previous session was healthy - not a failure
        reconnectAttemptsRef.current = 0;
        console.log(`   🔄 Reset reconnect attempts counter (GO AWAY = healthy session)`);

        // PROACTIVE: Force-save current handle to ensure seamless reconnect
        if (sessionResumeHandleRef.current) {
          const currentHandle = sessionResumeHandleRef.current;
          const resumeHandleKey = getResumeHandleKey();
          localStorage.setItem(resumeHandleKey, currentHandle);
          console.log(`   🔄 PROACTIVE: Force-saved current handle to localStorage`);
          console.log(`   → Storage key: ${resumeHandleKey}`);
          console.log(`   → Handle preview: ${currentHandle.substring(0, 20)}...`);
          console.log(`   ✅ Ready for seamless auto-reconnect when connection closes`);
        } else {
          console.warn(`   ⚠️  WARNING: No session handle available - reconnect may fail!`);
        }
        console.log(`${'⚠️'.repeat(35)}\n`);

        // Don't show scary toast - session will auto-reconnect seamlessly
        // Just a subtle notification
        toast({
          title: '🔄 Transizione sessione',
          description: 'La conversazione continuerà automaticamente tra un momento...',
          duration: 5000,
        });
        break;

      case 'session_resumption_update':
        console.log(`\n${'='.repeat(70)}`);
        console.log(`🔄 [SESSION RESUMPTION UPDATE] Received new session handle from Gemini`);
        console.log(`${'='.repeat(70)}`);
        // Save the new handle for future reconnections
        if (message.handle) {
          const handlePreview = message.handle.substring(0, 20);
          console.log(`   → Handle preview: ${handlePreview}...`);
          console.log(`   → Handle length: ${message.handle.length} chars`);

          // Save to both ref and localStorage for redundancy
          sessionResumeHandleRef.current = message.handle;
          const resumeHandleKey = getResumeHandleKey();
          localStorage.setItem(resumeHandleKey, message.handle);

          console.log(`   ✅ Handle saved to sessionResumeHandleRef`);
          console.log(`   ✅ Handle saved to localStorage (key: ${resumeHandleKey})`);
          console.log(`   💡 This handle enables auto-reconnect for unlimited session duration`);
          console.log(`${'='.repeat(70)}\n`);
        } else {
          console.warn(`⚠️ [SESSION RESUMPTION] Received update but handle is null/undefined`);
        }
        break;

      case 'session:closing':
        console.log(`\n🔒 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log('🔒 [AUTO-CLOSE] Backend triggered session closing');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        // Mark session as closing (both state and ref)
        setIsSessionClosing(true);
        isSessionClosingRef.current = true;
        
        // Show UI notification
        toast({
          title: '⏱️ Sessione in chiusura',
          description: 'Attendere il saluto finale dell\'assistente...',
          duration: 30000, // 30 secondi (finché non arriva close_now)
        });
        
        console.log('   ✅ Session closing state activated');
        console.log('   🔇 Microphone sends will be blocked');
        console.log('   ⏳ Waiting for session:close_now from backend...');
        break;

      case 'session:close_now':
        console.log(`\n🔒 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log('🔒 [AUTO-CLOSE] Backend commanded graceful shutdown');
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        
        toast({
          title: '👋 Consulenza completata',
          description: 'La sessione di 90 minuti è terminata',
          duration: 3000,
        });
        
        // 🎯 FIX CRITICO: Passa reason 'auto_90min' per marcare come 'completed'
        console.log('   🛑 Calling endSession(auto_90min) for graceful teardown...');
        endSessionRef.current('auto_90min');
        break;

      case 'error':
        console.error('❌ Server error:', message.message || message.error);
        toast({
          variant: 'destructive',
          title: 'Errore',
          description: message.message || message.error || 'Si è verificato un errore',
        });
        setLiveState('idle');
        break;
    }
  }, [toast, onConversationSaved, playNextAudioChunk, startAutosaveInterval, sessionType, consultationId]);

  const setupAudioInput = useCallback(async () => {
    try {
      // Guard against double-start
      if (isSetupRef.current) {
        console.log('⚠️ Audio already setup, skipping');
        return;
      }
      isSetupRef.current = true;

      // 🎤 Verifica che l'API mediaDevices sia disponibile
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('MEDIA_DEVICES_NOT_SUPPORTED');
      }

      console.log('🎤 Richiesta permessi microfono...');
      
      // Get microphone stream
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } 
      });
      micStreamRef.current = stream;
      
      console.log('✅ Microfono rilevato e permessi concessi');

      // Create AudioContext at 16kHz sample rate
      const audioContext = new AudioContext({ sampleRate: 16000 });
      audioContextRef.current = audioContext;
      
      // 🎤 MOBILE FIX: Try to resume AudioContext if suspended (non-blocking)
      // Su mobile può essere suspended, ma verrà resumato automaticamente al bisogno
      if (audioContext.state === 'suspended') {
        console.log('🎤 AudioContext suspended - will auto-resume when needed');
        // NON blocchiamo se suspended - il resume avverrà on-demand
      } else {
        console.log('✅ AudioContext running, state:', audioContext.state);
      }

      // Create analyser for audio level visualization
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      analyser.fftSize = 256;

      // Create media stream source
      const source = audioContext.createMediaStreamSource(stream);

      // Connect to analyser for visualization
      source.connect(analyser);

      // Setup audio level monitoring
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateAudioLevel = () => {
        if (analyserRef.current && isSessionActiveRef.current) {
          analyserRef.current.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;

          // Aggiorna micLevel (livello microfono utente)
          setMicLevel(Math.min(255, average * 1.5));

          micAnimationFrameRef.current = requestAnimationFrame(updateAudioLevel);
        } else {
          setMicLevel(0);
        }
      };
      updateAudioLevel();

      // Load AudioWorklet processor with fallback
      try {
        // Try loading from file first (.js instead of .ts for production compatibility)
        const workletUrl = new URL('./audio-worklet/pcm-processor.js', import.meta.url);
        console.log('🎙️ Loading AudioWorklet from:', workletUrl.href);
        await audioContext.audioWorklet.addModule(workletUrl.href);
        console.log('✅ AudioWorklet loaded from file successfully');
      } catch (workletError: any) {
        // Fallback: Create inline worklet as Blob URL
        console.warn('⚠️ Failed to load worklet from file, using inline fallback:', workletError);
        
        const workletCode = `
// @ts-check

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.bufferSize = 0;
    this.bufferThreshold = 640;
    this.audioBuffer = [];
    console.log('🎙️ PCMProcessor initialized (inline fallback)');
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (!input || input.length === 0) return true;

    const inputChannel = input[0];
    if (!inputChannel || inputChannel.length === 0) return true;

    this.audioBuffer.push(new Float32Array(inputChannel));
    this.bufferSize += inputChannel.length;

    if (this.bufferSize >= this.bufferThreshold) {
      this.sendAudioData();
    }

    return true;
  }

  sendAudioData() {
    if (this.audioBuffer.length === 0) return;

    const totalLength = this.bufferSize;
    const concatenated = new Float32Array(totalLength);
    
    let offset = 0;
    for (const chunk of this.audioBuffer) {
      concatenated.set(chunk, offset);
      offset += chunk.length;
    }

    this.port.postMessage({
      type: 'audio',
      data: concatenated,
      timestamp: globalThis.currentTime || Date.now(),
    });

    this.audioBuffer = [];
    this.bufferSize = 0;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
`;
        
        const blob = new Blob([workletCode], { type: 'application/javascript' });
        const blobUrl = URL.createObjectURL(blob);
        
        try {
          await audioContext.audioWorklet.addModule(blobUrl);
          console.log('✅ AudioWorklet loaded from inline Blob URL successfully');
          URL.revokeObjectURL(blobUrl);
        } catch (blobError: any) {
          URL.revokeObjectURL(blobUrl);
          throw new Error(`AudioWorklet failed to load: ${blobError.message}`);
        }
      }

      // Create AudioWorkletNode
      const workletNode = new AudioWorkletNode(audioContext, 'pcm-processor');
      workletNodeRef.current = workletNode;

      // Handle audio data from worklet
      workletNode.port.onmessage = (event) => {
        // 🔒 Block microphone sends when session is closing
        if (event.data.type === 'audio' && !isMutedRef.current && !isSessionClosingRef.current) {
          const audioData = event.data.data as Float32Array;

          // Convert Float32 → PCM16 → base64
          const base64PCM = float32ToBase64PCM16(audioData);

          // Send via WebSocket with sequence number
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({
              type: 'audio',
              data: base64PCM,
              sequence: audioSequenceRef.current++,
            }));
          }
        }
      };

      // Connect source → worklet (for processing)
      source.connect(workletNode);

      // Note: worklet doesn't need to connect to destination (no playback needed)

      console.log('🎤 AudioWorklet setup complete');
    } catch (error: any) {
      console.error('❌ Error setting up audio:', error);
      isSetupRef.current = false;
      
      // Determina il tipo di errore e fornisci istruzioni specifiche
      let title = 'Errore Microfono';
      let description = 'Impossibile accedere al microfono.';
      
      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      
      if (error.message === 'MEDIA_DEVICES_NOT_SUPPORTED') {
        title = 'Browser non supportato';
        description = 'Questo browser non supporta l\'accesso al microfono. Usa Chrome, Safari o Firefox.';
      } else if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        title = '🎤 Permesso Microfono Negato';
        if (isMobile) {
          description = 'Vai nelle impostazioni del tuo telefono → Safari/Chrome → Microfono e attiva i permessi per questo sito.';
        } else {
          description = 'Clicca sull\'icona del lucchetto nella barra degli indirizzi e attiva il permesso per il microfono.';
        }
      } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
        title = '🎤 Microfono Non Trovato';
        description = isMobile 
          ? 'Assicurati che il microfono del telefono non sia bloccato o coperto.'
          : 'Nessun microfono rilevato. Verifica che sia connesso correttamente al computer.';
      } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
        title = '🎤 Microfono Occupato';
        description = 'Il microfono è già in uso da un\'altra applicazione. Chiudi le altre app che lo usano e riprova.';
      } else if (error.name === 'OverconstrainedError') {
        title = '🎤 Configurazione Non Supportata';
        description = 'Il microfono non supporta le impostazioni richieste. Prova con un altro dispositivo.';
      } else if (error.name === 'SecurityError') {
        title = '🔒 Errore di Sicurezza';
        description = 'Assicurati di usare una connessione HTTPS sicura.';
      }
      
      toast({
        variant: 'destructive',
        title,
        description,
        duration: 10000, // Più tempo per leggere le istruzioni
      });
      
      // NON chiudiamo automaticamente - l'utente può riavviare manualmente
    }
  }, [toast]);

  // 🔄 FIX CRITICO Task 12: Disconnessione temporanea senza chiudere la sessione
  const disconnectTemporarily = useCallback(async () => {
    console.log(`\n${'='.repeat(70)}`);
    console.log('🚪 [TEMPORARY DISCONNECT] User requested temporary exit');
    console.log(`${'='.repeat(70)}\n`);

    // Guard per prevenire chiamate multiple
    if (isAttemptingEndSessionRef.current) {
      console.log('⚠️ Disconnect già in corso, skip');
      return;
    }

    isAttemptingEndSessionRef.current = true;
    isClosingRef.current = true;

    // Stop autosave interval
    stopAutosaveInterval();

    // Perform final flush for weekly consultations (salva trascrizione)
    if (sessionType === 'weekly_consultation' && consultationId && transcriptHistory.length > 0) {
      console.log('💾 Eseguo flush finale della trascrizione...');
      try {
        await performAutosave(true); // true = isManualFlush
        console.log('✅ Flush finale completato con successo');
      } catch (error) {
        console.error('❌ Flush finale fallito:', error);
        
        // Reset flags per permettere retry
        isClosingRef.current = false;
        isAttemptingEndSessionRef.current = false;
        
        // Riavvia autosave interval
        startAutosaveInterval();
        
        toast({
          title: '❌ Impossibile salvare la trascrizione',
          description: 'Riprova tra qualche istante.',
          variant: 'destructive',
          duration: 5000,
        });
        
        return; // Blocca la disconnessione
      }
    }

    // 🎯 DIFFERENZA CRITICA: NON chiamiamo /end-session endpoint
    // Lo status rimane 'in_progress' e la sessione può essere ripresa
    console.log('📌 Status rimane "in_progress" - sessione può essere ripresa');
    
    // 🎯 DIFFERENZA CRITICA: NON eliminiamo il resume handle da localStorage
    // Questo permette la riconnessione automatica quando l'utente torna
    console.log(`🔄 Resume handle MANTENUTO per permettere riconnessione`);
    console.log(`   → Handle preview: ${sessionResumeHandleRef.current?.substring(0, 20)}...`);

    // Mark session as inactive to prevent playback resurrection
    isSessionActiveRef.current = false;

    // Stop audio immediately
    stopCurrentAudio();

    // Close WebSocket (code 1000 = Normal Closure)
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.close(1000, "User Temporary Disconnect");
    }

    // Stop worklet and disconnect
    if (workletNodeRef.current) {
      workletNodeRef.current.port.close();
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Stop animation loops
    if (outputAnimationFrameRef.current) {
      cancelAnimationFrame(outputAnimationFrameRef.current);
      outputAnimationFrameRef.current = null;
    }
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
      micAnimationFrameRef.current = null;
    }

    // Reset playing state
    isPlayingRef.current = false;
    setAudioLevel(0);

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset analysers
    analyserRef.current = null;
    outputAnalyserRef.current = null;

    // Reset setup flag
    isSetupRef.current = false;

    // Stop conversation timer
    stopConversationTimer();
    
    // 📱 WAKE LOCK FIX: Rilascia wake lock durante disconnessione temporanea
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        console.log('🔓 [WAKE LOCK] Rilasciato - schermo può spegnersi normalmente');
      } catch (err) {
        console.error('❌ [WAKE LOCK] Errore rilascio:', err);
      } finally {
        wakeLockRef.current = null;
      }
    }
    
    // Reset flag
    isAttemptingEndSessionRef.current = false;
    
    // Show success toast
    toast({
      title: '🚪 Disconnessione temporanea',
      description: 'Puoi tornare entro 90 minuti per riprendere la conversazione',
      duration: 4000,
    });

    console.log(`\n${'='.repeat(70)}`);
    console.log('✅ [TEMPORARY DISCONNECT] Completed successfully');
    console.log('   → Transcript saved');
    console.log('   → Status: in_progress (can be resumed)');
    console.log('   → Resume handle: preserved in localStorage');
    console.log(`${'='.repeat(70)}\n`);
    
    // Redirect to previous page
    onClose();
  }, [transcriptHistory, sessionType, consultationId, performAutosave, stopAutosaveInterval, startAutosaveInterval, stopConversationTimer, onClose, toast, stopCurrentAudio]);

  const endSession = useCallback(async (reason: 'manual' | 'auto_90min' | 'error' = 'manual') => {
    // 🛡️ FIX CRITICO Task 11: Validazione parametro reason per prevenire circular structure error
    // Se viene passato un evento React invece di una stringa, usa default 'manual'
    const finalReason = typeof reason === 'string' ? reason : 'manual';
    
    // Guard per prevenire rapid re-entry mentre il flush finale è in corso
    if (isAttemptingEndSessionRef.current) {
      console.log('⚠️ endSession già in corso, skip');
      return;
    }

    console.log(`🛑 Ending session... (reason: ${finalReason})`);
    isAttemptingEndSessionRef.current = true;

    // Mark session as closing to prevent new autosaves
    isClosingRef.current = true;

    // Stop autosave interval
    stopAutosaveInterval();

    // Perform final flush for weekly consultations
    if (sessionType === 'weekly_consultation' && consultationId && transcriptHistory.length > 0) {
      console.log('💾 Eseguo flush finale della trascrizione...');
      try {
        await performAutosave(true); // true = isManualFlush
        console.log('✅ Flush finale completato con successo');
      } catch (error) {
        console.error('❌ Flush finale fallito, sessione rimane aperta:', error);
        
        // Reset flags per permettere retry
        isClosingRef.current = false;
        isAttemptingEndSessionRef.current = false;
        
        // Riavvia autosave interval
        startAutosaveInterval();
        
        // Mostra errore critico all'utente
        toast({
          title: '❌ Impossibile salvare la trascrizione',
          description: 'La sessione rimarrà aperta. Riprova a terminare tra qualche istante.',
          variant: 'destructive',
          duration: 10000, // 10 secondi per dare tempo di leggere
        });
        
        // BLOCCA la chiusura ritornando immediatamente
        return;
      }

      // 🎯 FIX CRITICO: Chiama endpoint end-session DOPO il flush finale
      // Questo permette di salvare la trascrizione prima di cambiare lo status
      console.log(`📡 Chiamata endpoint end-session con reason: ${finalReason}`);
      try {
        const token = getToken();
        if (!token) {
          throw new Error('No authentication token');
        }

        const response = await fetch(`/api/consultations/ai/${consultationId}/end-session`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ reason: finalReason })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Errore durante la chiusura della sessione');
        }

        const data = await response.json();
        console.log(`✅ Sessione terminata con status: ${data.status} (${finalReason})`);
        
        // Toast informativo basato sul reason
        if (finalReason === 'auto_90min') {
          toast({
            title: '✅ Consulenza completata',
            description: 'La sessione di 90 minuti è stata completata con successo',
          });
        } else if (finalReason === 'manual') {
          toast({
            title: '🛑 Sessione terminata',
            description: 'La consulenza è stata interrotta manualmente',
          });
        }
      } catch (error) {
        console.error('❌ Errore chiamata end-session endpoint:', error);
        // Non bloccare la chiusura per questo errore
        // Lo status rimarrà 'in_progress' ma la sessione verrà comunque chiusa
        toast({
          title: '⚠️ Avviso',
          description: 'Sessione chiusa ma stato non aggiornato. Contatta il supporto.',
          variant: 'destructive',
        });
      }
    }

    // Mark session as inactive to prevent playback resurrection
    isSessionActiveRef.current = false;

    // Clear saved session handle (user is closing, don't resume)
    const resumeHandleKey = getResumeHandleKey();
    localStorage.removeItem(resumeHandleKey);
    console.log(`🗑️  [SESSION CLEANUP] Removed resume handle from localStorage (key: ${resumeHandleKey})`);
    sessionResumeHandleRef.current = null;

    // STOP AUDIO IMMEDIATELY quando termina la sessione
    stopCurrentAudio();

    // Send final conversation data to backend
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      const conversationData = {
        messages: transcriptHistory.map((entry, index) => ({
          role: entry.role,
          transcript: entry.text,
          duration: 0,
          timestamp: new Date(entry.timestamp).toISOString(),
        })),
        duration: conversationDuration,
        mode: 'live_voice',
      };

      wsRef.current.send(JSON.stringify({
        type: 'end_session',
        conversationData,
      }));

      await new Promise(resolve => setTimeout(resolve, 500));
      wsRef.current.close();
    }

    // Stop worklet and disconnect
    if (workletNodeRef.current) {
      workletNodeRef.current.port.close();
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }

    // Stop microphone stream
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach(track => track.stop());
      micStreamRef.current = null;
    }

    // Stop animation loops
    if (outputAnimationFrameRef.current) {
      cancelAnimationFrame(outputAnimationFrameRef.current);
      outputAnimationFrameRef.current = null;
    }
    if (micAnimationFrameRef.current) {
      cancelAnimationFrame(micAnimationFrameRef.current);
      micAnimationFrameRef.current = null;
    }

    // Reset playing state before closing
    isPlayingRef.current = false;
    setAudioLevel(0);

    // Close audio context
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      await audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Reset analysers
    analyserRef.current = null;
    outputAnalyserRef.current = null;

    // Reset setup flag
    isSetupRef.current = false;

    stopConversationTimer();
    
    // 📱 WAKE LOCK FIX: Rilascia wake lock alla chiusura della sessione
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        console.log('🔓 [WAKE LOCK] Rilasciato - schermo può spegnersi normalmente');
      } catch (err) {
        console.error('❌ [WAKE LOCK] Errore rilascio:', err);
      } finally {
        wakeLockRef.current = null;
      }
    }
    
    // Reset endSession flag (successo)
    isAttemptingEndSessionRef.current = false;
    
    onClose();
  }, [transcriptHistory, conversationDuration, onClose, stopConversationTimer, stopAutosaveInterval, sessionType, consultationId, performAutosave, startAutosaveInterval, toast]);
  // 🔴 AGGIUNGI QUESTO BLOCCO subito dopo la chiusura di endSession:
  // Questo tiene il ref aggiornato con l'ultima versione della funzione endSession
  useEffect(() => {
    endSessionRef.current = endSession;
  }, [endSession]);

  const toggleMute = useCallback(() => {
    setIsMuted(prev => {
      const newValue = !prev;
      isMutedRef.current = newValue;
      toast({
        title: newValue ? '🔇 Microfono silenziato' : '🎤 Microfono attivo',
      });
      return newValue;
    });
  }, [toast]);

  useEffect(() => {
    if (currentTranscript) {
      setTranscriptHistory(prev => {
        const filtered = prev.filter(entry => entry.role !== currentTranscript.role || entry.timestamp !== currentTranscript.timestamp);
        return [...filtered, currentTranscript];
      });
    }
  }, [currentTranscript]);

  // Start autosave interval after first message (ONLY for NEW sessions)
  // For RESUMED sessions, autosave is started in handleWebSocketMessage case 'ready'
  useEffect(() => {
    if (transcriptHistory.length > 0 && !hasStartedAutosaveRef.current) {
      console.log('📝 [AUTOSAVE] Primo messaggio ricevuto (nuova sessione), avvio autosave...');
      startAutosaveInterval();
    }
  }, [transcriptHistory, startAutosaveInterval]);

  useEffect(() => {
    setupWebSocket();
    setupAudioInput();

    return () => {
      // Mark session as inactive first
      isSessionActiveRef.current = false;

      // STOP AUDIO IMMEDIATELY on cleanup
      stopCurrentAudio();

      // Cleanup on unmount
      if (wsRef.current) {
        wsRef.current.close();
      }

      // Stop worklet
      if (workletNodeRef.current) {
        workletNodeRef.current.port.close();
        workletNodeRef.current.disconnect();
      }

      // Stop microphone stream
      if (micStreamRef.current) {
        micStreamRef.current.getTracks().forEach(track => track.stop());
      }

      // Stop animation loops
      if (outputAnimationFrameRef.current) {
        cancelAnimationFrame(outputAnimationFrameRef.current);
        outputAnimationFrameRef.current = null;
      }
      if (micAnimationFrameRef.current) {
        cancelAnimationFrame(micAnimationFrameRef.current);
        micAnimationFrameRef.current = null;
      }

      // Reset playing state before closing
      isPlayingRef.current = false;

      // Close audio context
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }

      // Reset analysers
      analyserRef.current = null;
      outputAnalyserRef.current = null;

      // Reset setup flag
      isSetupRef.current = false;

      stopConversationTimer();
      
      // Stop autosave interval
      stopAutosaveInterval();
    };
  }, [setupWebSocket, setupAudioInput, stopConversationTimer, stopAutosaveInterval]);

  // 🎤 MOBILE FIX: Resume AudioContext quando pagina torna visibile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isSessionActiveRef.current) {
        console.log('📱 [MOBILE FIX] Page became visible - ensuring AudioContext running...');
        ensureAudioContextRunning();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [ensureAudioContextRunning]);

  // 📱 WAKE LOCK: Mantieni schermo sempre acceso durante la sessione
  useEffect(() => {
    const requestWakeLock = async () => {
      // Verifica supporto Wake Lock API
      if (!('wakeLock' in navigator)) {
        console.log('📱 [WAKE LOCK] Wake Lock API non supportata su questo browser');
        return;
      }

      try {
        // FIX: Richiedi wake lock SOLO se siamo connessi E non c'è già un lock attivo
        if (connectionStatus === 'connected' && !wakeLockRef.current) {
          wakeLockRef.current = await navigator.wakeLock.request('screen');
          console.log('✅ [WAKE LOCK] Schermo bloccato - NON si spegnerà durante la chiamata');
          
          // Event listener per rilascio wake lock (es. cambio tab, browser lo rilascia automaticamente)
          wakeLockRef.current.addEventListener('release', () => {
            console.log('📱 [WAKE LOCK] Wake lock rilasciato automaticamente');
            wakeLockRef.current = null; // Pulisci ref quando viene rilasciato
          });
        }
      } catch (err: any) {
        console.error('❌ [WAKE LOCK] Errore richiesta wake lock:', err.message);
        wakeLockRef.current = null; // Pulisci ref anche in caso di errore
        // Non bloccante - la sessione continua normalmente
      }
    };

    requestWakeLock();

    // Cleanup: rilascia wake lock quando componente si smonta
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release()
          .then(() => {
            console.log('🔓 [WAKE LOCK] Rilasciato - schermo può spegnersi normalmente');
            wakeLockRef.current = null;
          })
          .catch((err) => {
            console.error('❌ [WAKE LOCK] Errore rilascio:', err);
            wakeLockRef.current = null;
          });
      }
    };
  }, [connectionStatus]);

  // 📱 WAKE LOCK: Riattiva quando utente torna al tab
  useEffect(() => {
    const handleVisibilityChange = async () => {
      // Se pagina diventa visibile E siamo connessi
      if (document.visibilityState === 'visible' && connectionStatus === 'connected' && isSessionActiveRef.current) {
        // FIX: Richiedi SOLO se wakeLockRef è null (non c'è lock attivo)
        if (!wakeLockRef.current && 'wakeLock' in navigator) {
          try {
            wakeLockRef.current = await navigator.wakeLock.request('screen');
            console.log('🔄 [WAKE LOCK] Riattivato dopo ritorno al tab');
            
            // Event listener per rilascio
            wakeLockRef.current.addEventListener('release', () => {
              console.log('📱 [WAKE LOCK] Wake lock rilasciato automaticamente');
              wakeLockRef.current = null;
            });
          } catch (err: any) {
            console.error('❌ [WAKE LOCK] Errore riattivazione:', err.message);
            wakeLockRef.current = null;
          }
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [connectionStatus]);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-between p-8"
      >
        {/* Stelle di sfondo sempre attive */}
        <div className="fixed inset-0 z-10 pointer-events-none">
          <Suspense fallback={<div />}>
            <ParticleField3D 
              isActive={true} 
              audioLevel={liveState === 'speaking' ? audioLevel : (liveState === 'listening' ? micLevel : 0)} 
              color={liveState === 'speaking' ? 'blue' : 'red'} 
            />
          </Suspense>
        </div>

        <div className="absolute top-6 right-6 flex items-center gap-4 z-20">
          {/* Badge Modalità Test */}
          {isTestMode && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="px-4 py-2 rounded-full bg-gradient-to-r from-yellow-500 to-orange-500 backdrop-blur-md border-2 border-yellow-400 shadow-lg shadow-yellow-500/50"
            >
              <div className="text-white font-bold text-sm flex items-center gap-2">
                <span className="text-base">🧪</span>
                <span>MODALITÀ TEST</span>
              </div>
            </motion.div>
          )}
          
          <motion.div 
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg"
          >
            <div className="text-white font-mono text-sm font-semibold">
              {formatDuration(conversationDuration)}
            </div>
          </motion.div>
          <motion.div
            whileHover={{ scale: 1.1, rotate: 90 }}
            whileTap={{ scale: 0.9 }}
          >
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowDisconnectDialog(true)}
              className="text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all duration-300 backdrop-blur-sm"
              title="Disconnessione temporanea - Puoi tornare entro 90 minuti"
            >
              <X className="h-6 w-6" />
            </Button>
          </motion.div>
        </div>

        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="absolute top-6 left-6 z-20"
        >
          <div className="flex items-center gap-3 px-4 py-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20 shadow-lg">
            <motion.div 
              className={`w-3 h-3 rounded-full relative ${
                connectionStatus === 'connected' ? 'bg-green-500' :
                connectionStatus === 'connecting' ? 'bg-yellow-500' :
                connectionStatus === 'error' ? 'bg-red-500' :
                'bg-gray-500'
              }`}
              animate={
                connectionStatus === 'connected' || connectionStatus === 'connecting'
                  ? {
                      scale: [1, 1.3, 1],
                      opacity: [1, 0.7, 1]
                    }
                  : {
                      scale: 1,
                      opacity: 1
                    }
              }
              transition={
                connectionStatus === 'connected' || connectionStatus === 'connecting'
                  ? {
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }
                  : {
                      duration: 0.3
                    }
              }
            >
              <AnimatePresence>
                {(connectionStatus === 'connected' || connectionStatus === 'connecting') && (
                  <motion.div
                    key="pulse"
                    className={`absolute inset-0 rounded-full ${
                      connectionStatus === 'connected' ? 'bg-green-500' : 'bg-yellow-500'
                    }`}
                    initial={{ scale: 1, opacity: 0.5 }}
                    animate={{
                      scale: [1, 2, 2],
                      opacity: [0.5, 0, 0]
                    }}
                    exit={{ scale: 1, opacity: 0 }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                )}
              </AnimatePresence>
            </motion.div>
            <span className="text-white text-sm font-medium">
              {connectionStatus === 'connected' ? 'Connesso' :
               connectionStatus === 'connecting' ? 'Connessione...' :
               connectionStatus === 'error' ? 'Errore' :
               'Disconnesso'}
            </span>
          </div>
        </motion.div>

        {/* 🎯 VAD DEBUG INDICATOR - Shows Gemini VAD state */}
        <AnimatePresence>
          {vadDebugState !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, x: -20, y: 10 }}
              animate={{ opacity: 1, x: 0, y: 0 }}
              exit={{ opacity: 0, x: -20, y: 10 }}
              className="absolute top-24 left-6 z-20"
            >
              <div className="flex items-center gap-3 px-4 py-2 rounded-full backdrop-blur-md border shadow-lg bg-red-500/20 border-red-400 shadow-red-500/50">
                <motion.div 
                  className="w-3 h-3 rounded-full bg-red-500"
                  animate={{
                    scale: [1, 1.5, 1],
                    opacity: [1, 0.7, 1]
                  }}
                  transition={{
                    duration: 0.8,
                    repeat: Infinity,
                    ease: "easeInOut"
                  }}
                />
                <span className="text-sm font-bold text-red-300">
                  🔴 GEMINI VAD BLOCCATO
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* --- OVERLAY PREMIUM "JARVIS STYLE" --- */}
        <AnimatePresence>
          {(liveState === 'loading' || connectionStatus === 'connecting') && (
            <motion.div
              initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
              animate={{ opacity: 1, backdropFilter: "blur(12px)" }}
              exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
              transition={{ duration: 0.5 }}
              className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80"
            >
              {/* Cerchio Esterno Rotante */}
              <div className="relative w-32 h-32 flex items-center justify-center">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-0 rounded-full border-t-2 border-r-2 border-blue-500/30 border-b-transparent border-l-transparent"
                />
                <motion.div
                  animate={{ rotate: -360 }}
                  transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-2 rounded-full border-b-2 border-l-2 border-purple-500/30 border-t-transparent border-r-transparent"
                />

                {/* Core Pulsante */}
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full blur-md shadow-[0_0_30px_rgba(59,130,246,0.6)]"
                />
              </div>

              {/* Testo "Typewriter" Digitale */}
              <motion.div
                key={loadingText} // Questo fa animare il testo quando cambia
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mt-8 flex flex-col items-center"
              >
                <h2 className="text-xl font-mono font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 tracking-widest uppercase">
                  {loadingText}
                </h2>
                <div className="mt-2 flex gap-1">
                   {[0, 1, 2].map((i) => (
                     <motion.div
                       key={i}
                       animate={{ opacity: [0.2, 1, 0.2] }}
                       transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                       className="w-2 h-2 bg-blue-500 rounded-full"
                     />
                   ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex items-center justify-center z-20 relative w-full max-w-3xl">
          <div className="w-full aspect-square max-h-[500px]">
            <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div></div>}>
              <AudioSphere3D 
                isActive={liveState === 'listening' || liveState === 'speaking'} 
                audioLevel={liveState === 'listening' ? micLevel : audioLevel} 
                color={liveState === 'listening' ? 'red' : 'blue'} 
              />
            </Suspense>
          </div>
        </div>

        <div className="w-full max-w-4xl space-y-6 z-20">
          <div className="min-h-[120px] max-h-[55vh] sm:max-h-[220px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent space-y-4">
            {userTranscript && (
              <LiveTranscript
                text={userTranscript.text}
                role={userTranscript.role}
                animated={true}
              />
            )}
            {currentTranscript && (
              <LiveTranscript
                text={currentTranscript.text}
                role={currentTranscript.role}
                animated={true}
              />
            )}
          </div>

          <div className="flex items-center justify-center gap-8">
            <motion.div
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <Button
                size="lg"
                variant={isMuted ? 'destructive' : 'outline'}
                onClick={toggleMute}
                className={`rounded-full w-16 h-16 transition-all duration-300 ${
                  isMuted 
                    ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50 border-red-400' 
                    : 'bg-white/10 hover:bg-white/20 backdrop-blur-md border-white/30 hover:border-white/50 shadow-lg shadow-white/10 hover:shadow-white/20'
                }`}
              >
                {isMuted ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}
              </Button>
            </motion.div>

            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              animate={{
                boxShadow: [
                  '0 0 20px rgba(239, 68, 68, 0.4)',
                  '0 0 40px rgba(239, 68, 68, 0.6)',
                  '0 0 20px rgba(239, 68, 68, 0.4)'
                ]
              }}
              transition={{
                boxShadow: {
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut"
                }
              }}
              className="rounded-full"
            >
              <Button
                size="lg"
                variant="destructive"
                onClick={() => setShowDisconnectDialog(true)}
                className="rounded-full w-20 h-20 bg-gradient-to-br from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-2xl shadow-red-500/50 border-2 border-red-400/50 relative overflow-hidden group"
                title="Disconnessione temporanea - Puoi tornare entro 90 minuti"
              >
                <motion.div
                  className="absolute inset-0 bg-white/20"
                  initial={{ scale: 0, opacity: 0 }}
                  whileHover={{ scale: 2, opacity: 0 }}
                  transition={{ duration: 0.6 }}
                />
                <Phone className="h-8 w-8 relative z-10 group-hover:rotate-12 transition-transform duration-300" />
              </Button>
            </motion.div>
          </div>

          {/* 🔒 Session Closing Indicator */}
          <AnimatePresence>
            {isSessionClosing && (
              <motion.div
                initial={{ opacity: 0, y: -20, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.9 }}
                transition={{ duration: 0.4 }}
                className="text-center mb-4"
              >
                <div className="inline-flex items-center gap-3 px-8 py-4 rounded-full bg-gradient-to-r from-orange-500/20 to-red-500/20 backdrop-blur-md border-2 border-orange-400/50 shadow-lg shadow-orange-500/30">
                  <motion.div
                    animate={{
                      rotate: [0, 360],
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                    className="w-4 h-4 border-2 border-orange-400 border-t-transparent rounded-full"
                  />
                  <span className="text-orange-200 text-base font-semibold">
                    🔒 Sessione in chiusura - Attendere saluto finale...
                  </span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div 
            key={liveState}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="text-center"
          >
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
              <motion.div
                animate={
                  liveState === 'listening' || liveState === 'speaking' || liveState === 'loading'
                    ? {
                        scale: [1, 1.2, 1],
                        opacity: [0.5, 1, 0.5]
                      }
                    : {}
                }
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeInOut"
                }}
                className={`w-2 h-2 rounded-full ${
                  liveState === 'listening' ? 'bg-red-500' :
                  liveState === 'speaking' ? 'bg-blue-500' :
                  liveState === 'thinking' ? 'bg-yellow-500' :
                  liveState === 'loading' ? 'bg-orange-500' :
                  'bg-green-500'
                }`}
              />
              <span className="text-white/70 text-sm font-medium">
                {isSessionClosing ? '🔒 Microfono bloccato - In attesa di chiusura' : 
                 liveState === 'idle' ? '✨ Pronto ad ascoltare' :
                 liveState === 'loading' ? '⏳ Caricamento dati in corso...' :
                 liveState === 'listening' ? (isMuted ? '🔇 Microfono silenziato' : '🎤 Ti sto ascoltando') :
                 liveState === 'thinking' ? '💭 Sto pensando' :
                 liveState === 'speaking' ? '🔊 Sto parlando' : ''}
              </span>
            </div>
          </motion.div>
        </div>

        {/* Dialog di Conferma Disconnessione Temporanea */}
        <Dialog open={showDisconnectDialog} onOpenChange={setShowDisconnectDialog}>
          <DialogContent className="max-w-md bg-gradient-to-br from-gray-900 via-gray-800 to-black backdrop-blur-xl border-white/10 shadow-2xl">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-white flex items-center gap-3">
                  <Clock className="h-6 w-6 text-orange-400" />
                  <span>⏸️ Disconnessione Temporanea</span>
                </DialogTitle>
                <DialogDescription className="text-gray-300 mt-4 space-y-4">
                  <p className="text-base">
                    {sessionType === 'weekly_consultation' 
                      ? 'Stai per disconnetterti temporaneamente dalla consulenza.'
                      : 'Stai per disconnetterti temporaneamente dalla sessione.'}
                  </p>

                  <div className="space-y-2 bg-white/5 rounded-lg p-4 border border-white/10">
                    <div className="flex items-start gap-2">
                      <span className="text-green-400 mt-0.5">✅</span>
                      <span className="text-sm text-gray-200">
                        La tua conversazione verrà salvata automaticamente
                      </span>
                    </div>
                    {sessionType === 'weekly_consultation' ? (
                      <>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✅</span>
                          <span className="text-sm text-gray-200">
                            Puoi tornare entro i 90 minuti per riprendere
                          </span>
                        </div>
                        <div className="flex items-start gap-2">
                          <span className="text-green-400 mt-0.5">✅</span>
                          <span className="text-sm text-gray-200">
                            Riprenderai esattamente da dove hai lasciato
                          </span>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2">
                        <span className="text-green-400 mt-0.5">✅</span>
                        <span className="text-sm text-gray-200">
                          Puoi avviare una nuova sessione in qualsiasi momento
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Calcolo tempo rimanente - SOLO per consulenze */}
                  {sessionType === 'weekly_consultation' && (
                    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-4 border border-orange-400/30">
                      <div className="flex items-center gap-2 text-orange-200">
                        <Clock className="h-5 w-5" />
                        <span className="font-semibold">
                          Tempo rimanente: {Math.max(0, 90 - Math.floor(conversationDuration / 60))} minuti
                        </span>
                      </div>
                      <p className="text-xs text-orange-300/70 mt-1">
                        Limite massimo per riprendere la sessione
                      </p>
                    </div>
                  )}

                  <p className="text-sm text-gray-400 italic">
                    {sessionType === 'weekly_consultation'
                      ? '💡 Questa è una disconnessione temporanea, non una chiusura definitiva della consulenza.'
                      : '💡 Chiudi la sessione quando hai finito. Puoi avviarne una nuova in qualsiasi momento.'}
                  </p>
                </DialogDescription>
              </DialogHeader>

              <DialogFooter className="mt-6 flex flex-col sm:flex-row gap-3">
                {/* Annulla - Chiude dialog e rimane in chiamata */}
                <Button
                  variant="outline"
                  onClick={() => setShowDisconnectDialog(false)}
                  className="bg-white/10 hover:bg-white/20 border-white/30 hover:border-white/50 text-white"
                >
                  Annulla
                </Button>
                
                {/* Esci Temporaneamente - Disconnessione temporanea */}
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowDisconnectDialog(false);
                    disconnectTemporarily();
                  }}
                  className="bg-orange-500/20 hover:bg-orange-500/30 border-orange-400/30 hover:border-orange-400/50 text-orange-200 hover:text-orange-100"
                >
                  Esci Temporaneamente
                </Button>
                
                {/* Chiudi Definitivamente - Chiusura definitiva senza riavvio */}
                <Button
                  variant="destructive"
                  onClick={() => {
                    setShowDisconnectDialog(false);
                    endSession('manual');
                  }}
                  className="bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-lg shadow-red-500/50"
                >
                  Chiudi Definitivamente
                </Button>
              </DialogFooter>
            </motion.div>
          </DialogContent>
        </Dialog>
      </motion.div>
    </AnimatePresence>
  );
}
