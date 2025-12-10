import { useState, useEffect, useCallback, useRef } from 'react';

export type SentimentType = 'positive' | 'neutral' | 'negative';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'prospect';
  isSpeaking?: boolean;
}

interface ScriptItem {
  id: string;
  text: string;
  completed: boolean;
}

interface BattleCard {
  objection: string;
  response: string;
  category?: string;
}

interface ScriptProgress {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  phaseNames?: string[];
  completionPercentage: number;
}

interface TranscriptEntry {
  speakerId: string;
  speakerName: string;
  text: string;
  timestamp: number;
  isPartial?: boolean;
  turnComplete?: boolean;
}

interface SentimentUpdate {
  speakerId: string;
  speakerName: string;
  sentiment: SentimentType;
}

interface CopilotParticipant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'prospect';
  joinedAt?: string;
  leftAt?: string;
}

interface CopilotState {
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  scriptItems: ScriptItem[];
  currentSuggestion: string;
  battleCard: BattleCard | null;
  scriptProgress: ScriptProgress | null;
  transcripts: TranscriptEntry[];
  participantSentiments: Map<string, SentimentType>;
  participantSpeakingStates: Map<string, boolean>;
  participants: CopilotParticipant[];
  myParticipantId: string | null;
  isJoinConfirmed: boolean;
}

type WebRTCMessageHandler = (message: any) => void;

type CoachingMessageHandler = (message: any) => void;

interface UseVideoCopilotResult extends CopilotState {
  connect: () => void;
  disconnect: () => void;
  sendAudioChunk: (audioBase64: string, speakerId: string, speakerName: string) => void;
  updateParticipants: (participants: Participant[]) => void;
  joinParticipant: (name: string, role: 'host' | 'guest' | 'prospect') => void;
  leaveParticipant: (participantId: string) => void;
  toggleScriptItem: (id: string) => void;
  dismissBattleCard: () => void;
  endSession: () => void;
  sendWebRTCMessage: (message: any) => void;
  setWebRTCMessageHandler: (handler: WebRTCMessageHandler) => void;
  setCoachingMessageHandler: (handler: CoachingMessageHandler) => void;
  sendSpeakingState: (isSpeaking: boolean) => void;
}

const HEARTBEAT_INTERVAL_MS = 25000;
const HEARTBEAT_TIMEOUT_MS = 5000;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 30000;
const JITTER_FACTOR = 0.2;

function getWebSocketUrl(meetingToken: string): string {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = window.location.host;
  const token = localStorage.getItem('token');
  if (token) {
    return `${protocol}//${host}/ws/video-copilot?token=${token}&meetingToken=${meetingToken}`;
  }
  return `${protocol}//${host}/ws/video-copilot?meetingToken=${meetingToken}`;
}

function calculateBackoff(attempt: number): number {
  const exponentialDelay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, attempt),
    MAX_RECONNECT_DELAY_MS
  );
  const jitter = exponentialDelay * JITTER_FACTOR * (Math.random() * 2 - 1);
  return Math.round(exponentialDelay + jitter);
}

export function useVideoCopilot(meetingToken: string | null): UseVideoCopilotResult {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptRef = useRef<number>(0);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isNetworkOfflineRef = useRef<boolean>(false);
  const webrtcMessageHandlerRef = useRef<WebRTCMessageHandler | null>(null);
  const coachingMessageHandlerRef = useRef<((message: any) => void) | null>(null);
  const latestSpeakingRef = useRef<boolean | null>(null);
  const [state, setState] = useState<CopilotState>({
    isConnected: false,
    isConnecting: false,
    error: null,
    scriptItems: [],
    currentSuggestion: '',
    battleCard: null,
    scriptProgress: null,
    transcripts: [],
    participantSentiments: new Map(),
    participantSpeakingStates: new Map(),
    participants: [],
    myParticipantId: null,
    isJoinConfirmed: false,
  });

  const clearHeartbeat = useCallback(() => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const message = JSON.parse(event.data);
      
      if (message.type === 'pong') {
        if (heartbeatTimeoutRef.current) {
          clearTimeout(heartbeatTimeoutRef.current);
          heartbeatTimeoutRef.current = null;
        }
        return;
      }
      
      switch (message.type) {
        case 'connected':
          console.log('✅ Video Copilot connected:', message.data);
          reconnectAttemptRef.current = 0;
          setState(prev => ({
            ...prev,
            isConnected: true,
            isConnecting: false,
            error: null,
          }));
          console.log('🔄 [STATE-SYNC] Requesting state sync from server...');
          if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.send(JSON.stringify({ type: 'request_state_sync' }));
          }
          break;

        case 'transcript':
          console.log(`📥 [STEP 6] Received transcript from server:`, message.data);
          setState(prev => {
            const { speakerId, speakerName, text, isPartial, turnComplete } = message.data;
            
            if (turnComplete) {
              const existingIndex = prev.transcripts.findIndex(
                t => t.speakerId === speakerId && t.isPartial === true
              );
              
              if (existingIndex >= 0) {
                const updated = [...prev.transcripts];
                updated[existingIndex] = {
                  speakerId,
                  speakerName,
                  text,
                  timestamp: message.timestamp,
                  isPartial: false,
                  turnComplete: true,
                };
                return { ...prev, transcripts: updated };
              }
            }
            
            return {
              ...prev,
              transcripts: [...prev.transcripts, {
                speakerId,
                speakerName,
                text,
                timestamp: message.timestamp,
                isPartial: isPartial ?? false,
                turnComplete: turnComplete ?? false,
              }],
            };
          });
          break;

        case 'sentiment':
          setState(prev => {
            const newSentiments = new Map(prev.participantSentiments);
            newSentiments.set(message.data.speakerId, message.data.sentiment);
            return { ...prev, participantSentiments: newSentiments };
          });
          break;

        case 'suggestion':
          setState(prev => ({
            ...prev,
            currentSuggestion: message.data.text,
          }));
          break;

        case 'battle_card':
          if (message.data.detected) {
            setState(prev => ({
              ...prev,
              battleCard: {
                objection: message.data.objection,
                response: message.data.response,
                category: message.data.category,
              },
            }));
          }
          break;

        case 'script_progress':
        case 'script_progress_update':
          const progress = message.data as ScriptProgress;
          console.log(`📊 [SCRIPT_PROGRESS] Received ${message.type}:`, progress);
          setState(prev => {
            const items: ScriptItem[] = [];
            const phaseNames = progress.phaseNames || [];
            for (let i = 1; i <= progress.totalPhases; i++) {
              items.push({
                id: String(i),
                text: phaseNames[i - 1] || `Fase ${i}`,
                completed: i < progress.currentPhase,
              });
            }
            return {
              ...prev,
              scriptProgress: progress,
              scriptItems: items,
            };
          });
          break;

        case 'session_ended':
          console.log('📍 Session ended:', message.data);
          setState(prev => ({
            ...prev,
            isConnected: false,
          }));
          break;

        case 'participants_list':
          setState(prev => {
            const incoming = message.data.participants || [];
            const seen = new Set<string>();
            const deduped = incoming.filter((p: CopilotParticipant) => {
              if (seen.has(p.id)) return false;
              seen.add(p.id);
              return true;
            });
            return { ...prev, participants: deduped };
          });
          break;

        case 'join_confirmed':
          console.log('✅ Join confirmed, my participant ID:', message.data.id);
          setState(prev => ({
            ...prev,
            myParticipantId: message.data.id,
            isJoinConfirmed: true,
          }));
          break;

        case 'participant_joined':
          setState(prev => {
            const existingIndex = prev.participants.findIndex(p => p.id === message.data.id);
            if (existingIndex >= 0) {
              const updated = [...prev.participants];
              updated[existingIndex] = {
                ...updated[existingIndex],
                name: message.data.name,
                role: message.data.role,
                joinedAt: message.data.joinedAt,
                leftAt: undefined,
              };
              return { ...prev, participants: updated };
            }
            return {
              ...prev,
              participants: [...prev.participants, {
                id: message.data.id,
                name: message.data.name,
                role: message.data.role,
                joinedAt: message.data.joinedAt,
              }],
            };
          });
          break;

        case 'participant_left':
          setState(prev => ({
            ...prev,
            participants: prev.participants.map(p =>
              p.id === message.data.id
                ? { ...p, leftAt: message.data.leftAt }
                : p
            ),
          }));
          break;

        case 'participant_socket_ready':
          console.log(`📡 Participant socket ready: ${message.data.name} (${message.data.participantId})`);
          if (webrtcMessageHandlerRef.current) {
            webrtcMessageHandlerRef.current(message);
          }
          break;

        case 'error':
          console.error('❌ Copilot error:', message.data);
          setState(prev => ({
            ...prev,
            error: message.data.message,
          }));
          break;

        case 'webrtc_offer':
        case 'webrtc_answer':
        case 'ice_candidate':
          if (webrtcMessageHandlerRef.current) {
            webrtcMessageHandlerRef.current(message);
          }
          break;

        case 'speaking_state':
          setState(prev => {
            const newSpeakingStates = new Map(prev.participantSpeakingStates);
            newSpeakingStates.set(message.data.participantId, message.data.isSpeaking);
            return { ...prev, participantSpeakingStates: newSpeakingStates };
          });
          break;

        case 'sales_coaching':
        case 'buy_signal':
        case 'objection_detected':
        case 'checkpoint_status':
        case 'prospect_profile':
        case 'tone_warning':
        case 'coaching_session_start':
        case 'coaching_session_end':
          if (coachingMessageHandlerRef.current) {
            coachingMessageHandlerRef.current(message);
          }
          break;
      }
    } catch (e) {
      console.error('Error parsing WebSocket message:', e);
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    clearHeartbeat();
    
    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
        
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('💔 [Heartbeat] No pong received, connection considered dead');
          if (wsRef.current) {
            wsRef.current.close(4000, 'Heartbeat timeout');
          }
        }, HEARTBEAT_TIMEOUT_MS);
      }
    }, HEARTBEAT_INTERVAL_MS);
  }, [clearHeartbeat]);

  const connect = useCallback(() => {
    if (!meetingToken || wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    if (isNetworkOfflineRef.current) {
      console.log('📵 [WebSocket] Network offline, skipping connection attempt');
      return;
    }

    if (reconnectAttemptRef.current >= MAX_RECONNECT_ATTEMPTS) {
      console.error(`❌ [WebSocket] Max reconnection attempts (${MAX_RECONNECT_ATTEMPTS}) reached`);
      setState(prev => ({
        ...prev,
        error: `Impossibile connettersi dopo ${MAX_RECONNECT_ATTEMPTS} tentativi. Ricarica la pagina.`,
        isConnecting: false,
      }));
      return;
    }

    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const url = getWebSocketUrl(meetingToken);
      const ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('🎥 WebSocket connected to Video Copilot');
        startHeartbeat();
      };

      ws.onmessage = handleMessage;

      ws.onclose = (event) => {
        console.log('🔌 WebSocket closed:', event.code, event.reason);
        clearHeartbeat();
        
        setState(prev => ({
          ...prev,
          isConnected: false,
          isConnecting: false,
        }));

        const shouldReconnect = 
          event.code !== 1000 && 
          event.code !== 4401 &&
          !isNetworkOfflineRef.current &&
          reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS;

        if (shouldReconnect) {
          const delay = calculateBackoff(reconnectAttemptRef.current);
          reconnectAttemptRef.current += 1;
          console.log(`🔄 Attempting reconnection in ${delay}ms (attempt ${reconnectAttemptRef.current}/${MAX_RECONNECT_ATTEMPTS})`);
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect();
          }, delay);
        } else if (event.code === 1006) {
          console.warn('⚠️ [WebSocket] Abnormal closure (1006)');
          const delay = calculateBackoff(reconnectAttemptRef.current);
          reconnectAttemptRef.current += 1;
          
          if (reconnectAttemptRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, delay);
          }
        }
      };

      ws.onerror = (error) => {
        console.error('❌ WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Errore di connessione al copilot',
          isConnecting: false,
        }));
      };

      wsRef.current = ws;
    } catch (e) {
      console.error('Failed to create WebSocket:', e);
      setState(prev => ({
        ...prev,
        error: 'Impossibile connettersi al copilot',
        isConnecting: false,
      }));
    }
  }, [meetingToken, handleMessage, startHeartbeat, clearHeartbeat]);

  const disconnect = useCallback(() => {
    clearHeartbeat();
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close(1000, 'User disconnected');
      wsRef.current = null;
    }

    reconnectAttemptRef.current = 0;

    setState(prev => ({
      ...prev,
      isConnected: false,
      isConnecting: false,
      isJoinConfirmed: false,
    }));
  }, [clearHeartbeat]);

  const sendMessage = useCallback((message: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message));
    }
  }, []);

  const sendAudioChunk = useCallback((audioBase64: string, speakerId: string, speakerName: string) => {
    sendMessage({
      type: 'audio_chunk',
      data: audioBase64,
      speakerId,
      speakerName,
    });
  }, [sendMessage]);

  const sendSpeechStart = useCallback((speakerId: string, speakerName: string) => {
    console.log(`🎤 [WS] Sending speech_start for ${speakerName}`);
    sendMessage({
      type: 'speech_start',
      speakerId,
      speakerName,
    });
  }, [sendMessage]);

  const sendSpeechEnd = useCallback((speakerId: string, speakerName: string) => {
    console.log(`🔇 [WS] Sending speech_end for ${speakerName}`);
    sendMessage({
      type: 'speech_end',
      speakerId,
      speakerName,
    });
  }, [sendMessage]);

  const updateParticipants = useCallback((participants: Participant[]) => {
    sendMessage({
      type: 'participant_update',
      participants,
    });
  }, [sendMessage]);

  const joinParticipant = useCallback((name: string, role: 'host' | 'guest' | 'prospect') => {
    sendMessage({
      type: 'participant_join',
      participant: { name, role },
    });
  }, [sendMessage]);

  const leaveParticipant = useCallback((participantId: string) => {
    sendMessage({
      type: 'participant_leave',
      participantId,
    });
  }, [sendMessage]);

  const toggleScriptItem = useCallback((id: string) => {
    setState(prev => ({
      ...prev,
      scriptItems: prev.scriptItems.map(item =>
        item.id === id ? { ...item, completed: !item.completed } : item
      ),
    }));
  }, []);

  const dismissBattleCard = useCallback(() => {
    setState(prev => ({ ...prev, battleCard: null }));
  }, []);

  const endSession = useCallback(() => {
    sendMessage({ type: 'end_session' });
    disconnect();
  }, [sendMessage, disconnect]);

  const sendWebRTCMessage = useCallback((message: any) => {
    sendMessage(message);
  }, [sendMessage]);

  const setWebRTCMessageHandler = useCallback((handler: WebRTCMessageHandler) => {
    webrtcMessageHandlerRef.current = handler;
  }, []);

  const setCoachingMessageHandler = useCallback((handler: CoachingMessageHandler) => {
    coachingMessageHandlerRef.current = handler;
  }, []);

  const emitSpeakingState = useCallback((value: boolean): boolean => {
    if (!state.myParticipantId || wsRef.current?.readyState !== WebSocket.OPEN) {
      return false;
    }
    wsRef.current.send(JSON.stringify({
      type: 'speaking_state',
      speakingState: {
        participantId: state.myParticipantId,
        isSpeaking: value,
      },
    }));
    return true;
  }, [state.myParticipantId]);

  const sendSpeakingState = useCallback((isSpeaking: boolean) => {
    latestSpeakingRef.current = isSpeaking;
    emitSpeakingState(isSpeaking);
  }, [emitSpeakingState]);

  const sendManualValidateCheckpoint = useCallback((checkpointId: string, checkText: string) => {
    console.log(`📤 [WS] Sending manual_validate_checkpoint: "${checkText.substring(0, 40)}..."`);
    sendMessage({
      type: 'manual_validate_checkpoint',
      checkpointId,
      checkText,
    });
  }, [sendMessage]);

  useEffect(() => {
    if (state.isConnected && state.isJoinConfirmed && state.myParticipantId && latestSpeakingRef.current !== null) {
      emitSpeakingState(latestSpeakingRef.current);
    }
  }, [state.isConnected, state.isJoinConfirmed, state.myParticipantId, emitSpeakingState]);

  useEffect(() => {
    const handleOnline = () => {
      console.log('🌐 [Network] Online event detected');
      isNetworkOfflineRef.current = false;
      
      if (!state.isConnected && !state.isConnecting && meetingToken) {
        console.log('🔄 [Network] Attempting immediate reconnection...');
        reconnectAttemptRef.current = 0;
        connect();
      }
    };

    const handleOffline = () => {
      console.log('📵 [Network] Offline event detected');
      isNetworkOfflineRef.current = true;
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.isConnected, state.isConnecting, meetingToken, connect]);

  useEffect(() => {
    if (meetingToken) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [meetingToken]);

  return {
    ...state,
    connect,
    disconnect,
    sendAudioChunk,
    sendSpeechStart,
    sendSpeechEnd,
    updateParticipants,
    joinParticipant,
    leaveParticipant,
    toggleScriptItem,
    dismissBattleCard,
    endSession,
    sendWebRTCMessage,
    setWebRTCMessageHandler,
    setCoachingMessageHandler,
    sendSpeakingState,
    sendManualValidateCheckpoint,
  };
}
