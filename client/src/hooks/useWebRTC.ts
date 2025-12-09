import { useState, useEffect, useCallback, useRef } from 'react';

export interface RemoteStream {
  participantId: string;
  stream: MediaStream;
}

interface PeerConnectionState {
  connection: RTCPeerConnection;
  participantId: string;
}

interface UseWebRTCProps {
  meetingId: string;
  myParticipantId: string | null;
  participants: Array<{ id: string; name: string; role: string }>;
  isConnected: boolean;
  isJoinConfirmed: boolean;
  sendWebRTCMessage: (message: any) => void;
  onWebRTCMessage?: (message: any) => void;
}

export interface AudioDiagnostics {
  localAudioTrackExists: boolean;
  localAudioEnabled: boolean;
  remoteAudioTracks: number;
  iceConnectionStates: Map<string, string>;
  lastAudioEvent: string;
}

interface UseWebRTCResult {
  localStream: MediaStream | null;
  remoteStreams: Map<string, MediaStream>;
  isLocalStreamReady: boolean;
  startLocalStream: (video: boolean, audio: boolean) => Promise<void>;
  stopLocalStream: () => void;
  handleWebRTCMessage: (message: any) => void;
  toggleVideo: (enabled: boolean) => void;
  toggleAudio: (enabled: boolean) => void;
  audioDiagnostics: AudioDiagnostics;
}

const DEFAULT_ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function useWebRTC({
  meetingId,
  myParticipantId,
  participants,
  isConnected,
  isJoinConfirmed,
  sendWebRTCMessage,
}: UseWebRTCProps): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false);
  const [iceConfig, setIceConfig] = useState<RTCConfiguration>(DEFAULT_ICE_SERVERS);
  const [iceConfigLoaded, setIceConfigLoaded] = useState(false);
  const [audioDiagnostics, setAudioDiagnostics] = useState<AudioDiagnostics>({
    localAudioTrackExists: false,
    localAudioEnabled: false,
    remoteAudioTracks: 0,
    iceConnectionStates: new Map(),
    lastAudioEvent: 'Nessun evento',
  });

  useEffect(() => {
    const loadIceServers = async () => {
      if (!meetingId) {
        setIceConfigLoaded(true);
        return;
      }
      
      try {
        console.log(`🌐 [WebRTC] Loading ICE servers for meeting ${meetingId}...`);
        const response = await fetch(`/api/video-meeting/ice-servers/${meetingId}`);
        
        if (response.ok) {
          const data = await response.json();
          if (data.iceServers && data.iceServers.length > 0) {
            const hasTurn = data.iceServers.some((s: RTCIceServer) => 
              Array.isArray(s.urls) 
                ? s.urls.some(u => u.startsWith('turn:'))
                : s.urls.startsWith('turn:')
            );
            console.log(`✅ [WebRTC] Loaded ${data.iceServers.length} ICE servers (TURN: ${hasTurn ? 'YES' : 'NO'})`);
            setIceConfig({ iceServers: data.iceServers });
          } else {
            console.log(`ℹ️ [WebRTC] No custom ICE servers configured, using default STUN servers`);
          }
        } else {
          console.warn(`⚠️ [WebRTC] Failed to load ICE servers (${response.status}), using defaults`);
        }
      } catch (error) {
        console.error(`❌ [WebRTC] Error loading ICE servers:`, error);
      } finally {
        setIceConfigLoaded(true);
      }
    };
    
    loadIceServers();
  }, [meetingId]);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const pendingOffersRef = useRef<Map<string, RTCSessionDescriptionInit>>(new Map());
  const pendingSocketReadyRef = useRef<Set<string>>(new Set());
  const localStreamRef = useRef<MediaStream | null>(null);
  const participantsRef = useRef<Array<{ id: string; name: string; role: string }>>(participants);
  
  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const connectionRetryRef = useRef<Map<string, number>>(new Map());
  const retryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectCallbackRef = useRef<((participantId: string) => void) | null>(null);
  const offerRetryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const offerRetryCountRef = useRef<Map<string, number>>(new Map());
  const socketReadyRetryRef = useRef<Map<string, { count: number; timeout: NodeJS.Timeout | null }>>(new Map());
  const bothTryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const bothTryActiveRef = useRef<Set<string>>(new Set());
  const OFFER_RETRY_TIMEOUT_MS = 5000;
  const MAX_OFFER_RETRIES = 3;
  const SOCKET_READY_RETRY_MAX = 5;
  const SOCKET_READY_RETRY_BASE_MS = 500;
  const BOTH_TRY_TIMEOUT_MS = 8000;

  const createPeerConnection = useCallback((remoteParticipantId: string): RTCPeerConnection => {
    console.log(`🔗 [WebRTC] Creating peer connection for ${remoteParticipantId}`);
    console.log(`🔗 [WebRTC] Using ICE config with ${iceConfig.iceServers?.length || 0} servers`);
    
    const pc = new RTCPeerConnection(iceConfig);

    pc.onicecandidate = (event) => {
      if (event.candidate && myParticipantId) {
        console.log(`🧊 [WebRTC] Sending ICE candidate to ${remoteParticipantId}`);
        sendWebRTCMessage({
          type: 'ice_candidate',
          targetParticipantId: remoteParticipantId,
          fromParticipantId: myParticipantId,
          candidate: event.candidate.toJSON(),
        });
      }
    };

    pc.ontrack = (event) => {
      const track = event.track;
      console.log(`📹 [WebRTC] Received remote track from ${remoteParticipantId} (${track.kind})`);

      track.enabled = true;

      let isNewAudioTrack = false;

      setRemoteStreams(prev => {
        const newMap = new Map(prev);

        const existingStream = newMap.get(remoteParticipantId);

        const newStream = new MediaStream(existingStream ? existingStream.getTracks() : []);

        if (!newStream.getTrackById(track.id)) {
          newStream.addTrack(track);
          console.log(`➕ [WebRTC] Added ${track.kind} track to NEW stream for ${remoteParticipantId}`);
          
          if (track.kind === 'audio') {
            isNewAudioTrack = true;
          }
        }

        if (event.streams && event.streams[0]) {
          event.streams[0].getTracks().forEach(t => {
            if (!newStream.getTrackById(t.id)) {
              newStream.addTrack(t);
              if (t.kind === 'audio') {
                isNewAudioTrack = true;
              }
            }
          });
        }

        newMap.set(remoteParticipantId, newStream);
        return newMap;
      });

      if (track.kind === 'audio') {
        console.log(`🎤 [WebRTC-AUDIO-DEBUG] Received AUDIO track from ${remoteParticipantId}`);
        console.log(`   - Track ID: ${track.id}`);
        console.log(`   - Track enabled: ${track.enabled}`);
        console.log(`   - Track readyState: ${track.readyState}`);
        
        setAudioDiagnostics(prev => ({
          ...prev,
          remoteAudioTracks: prev.remoteAudioTracks + 1,
          lastAudioEvent: `Ricevuta traccia audio da ${remoteParticipantId.slice(0,8)}...`,
        }));
      }

      if (track.kind === 'video') {
        console.log(`📹 [WebRTC-VIDEO-DEBUG] Received VIDEO track from ${remoteParticipantId}`);
        console.log(`   - Track ID: ${track.id}`);
        console.log(`   - Track enabled: ${track.enabled}`);
        console.log(`   - Track readyState: ${track.readyState}`);
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🔌 [WebRTC-AUDIO-DEBUG] ICE state per ${remoteParticipantId}: ${pc.iceConnectionState}`);
      
      // Aggiorna diagnostiche con stato ICE
      setAudioDiagnostics(prev => {
        const newStates = new Map(prev.iceConnectionStates);
        newStates.set(remoteParticipantId, pc.iceConnectionState);
        return {
          ...prev,
          iceConnectionStates: newStates,
          lastAudioEvent: `ICE ${pc.iceConnectionState} con ${remoteParticipantId}`,
        };
      });
      
      if (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed') {
        console.log(`✅ [WebRTC] Connection established with ${remoteParticipantId.slice(0,8)}..., cleaning up retry timers`);
        connectionRetryRef.current.set(remoteParticipantId, 0);
        
        const timeout = retryTimeoutRef.current.get(remoteParticipantId);
        if (timeout) {
          clearTimeout(timeout);
          retryTimeoutRef.current.delete(remoteParticipantId);
        }
        
        // Cleanup socket ready retry
        const socketReadyRetry = socketReadyRetryRef.current.get(remoteParticipantId);
        if (socketReadyRetry?.timeout) {
          clearTimeout(socketReadyRetry.timeout);
          socketReadyRetryRef.current.delete(remoteParticipantId);
        }
        
        // Cleanup both-try fallback
        const bothTryTimeout = bothTryTimeoutRef.current.get(remoteParticipantId);
        if (bothTryTimeout) {
          clearTimeout(bothTryTimeout);
          bothTryTimeoutRef.current.delete(remoteParticipantId);
        }
        bothTryActiveRef.current.delete(remoteParticipantId);
      } else if (pc.iceConnectionState === 'failed') {
        console.warn(`⚠️ [WebRTC] Connection failed with ${remoteParticipantId}, will retry`);
        const retries = connectionRetryRef.current.get(remoteParticipantId) || 0;
        if (retries < 3) {
          connectionRetryRef.current.set(remoteParticipantId, retries + 1);
          pc.close();
          peerConnectionsRef.current.delete(remoteParticipantId);
          const delay = Math.min(1000 * Math.pow(2, retries), 5000);
          console.log(`🔄 [WebRTC] Retrying connection to ${remoteParticipantId} in ${delay}ms (attempt ${retries + 1})`);
          
          const existingTimeout = retryTimeoutRef.current.get(remoteParticipantId);
          if (existingTimeout) {
            clearTimeout(existingTimeout);
          }
          
          const timeoutId = setTimeout(() => {
            retryTimeoutRef.current.delete(remoteParticipantId);
            if (reconnectCallbackRef.current) {
              reconnectCallbackRef.current(remoteParticipantId);
            }
          }, delay);
          retryTimeoutRef.current.set(remoteParticipantId, timeoutId);
        } else {
          console.error(`❌ [WebRTC] Max retries reached for ${remoteParticipantId}`);
        }
      }
    };

    pc.onnegotiationneeded = async () => {
      console.log(`🔄 [WebRTC] Negotiation needed for ${remoteParticipantId}`);
    };

    if (localStreamRef.current) {
      console.log(`📹 [WebRTC] localStreamRef.current EXISTS - adding ${localStreamRef.current.getTracks().length} tracks to peer connection`);
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`➕ [WebRTC] Adding local track ${track.kind} to connection with ${remoteParticipantId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      console.warn(`⚠️ [WebRTC] localStreamRef.current is NULL in createPeerConnection for ${remoteParticipantId} - tracks will NOT be added!`);
    }

    peerConnectionsRef.current.set(remoteParticipantId, pc);
    return pc;
  }, [myParticipantId, sendWebRTCMessage, iceConfig]);

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      console.log(`📹 [WebRTC] Starting local stream (video: ${video}, audio: ${audio})`);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { 
          facingMode: 'user',
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });
      
      if (video && stream.getVideoTracks().length > 0) {
        const videoTrack = stream.getVideoTracks()[0];
        const settings = videoTrack.getSettings();
        console.log(`📹 [WebRTC] Camera native resolution: ${settings.width}x${settings.height} @ ${settings.frameRate}fps`);
        console.log(`📹 [WebRTC] Camera device: ${videoTrack.label}`);
      }

      localStreamRef.current = stream;
      setLocalStream(stream);
      setIsLocalStreamReady(true);

      // Log dettagliato delle tracce locali
      const audioTracks = stream.getAudioTracks();
      const videoTracks = stream.getVideoTracks();
      
      console.log(`🎤 [WebRTC-AUDIO-DEBUG] ========================================`);
      console.log(`🎤 [WebRTC-AUDIO-DEBUG] STREAM LOCALE CREATO`);
      console.log(`🎤 [WebRTC-AUDIO-DEBUG] Tracce audio: ${audioTracks.length}`);
      console.log(`🎤 [WebRTC-AUDIO-DEBUG] Tracce video: ${videoTracks.length}`);
      audioTracks.forEach((track, i) => {
        console.log(`🎤 [WebRTC-AUDIO-DEBUG] Audio track ${i}:`);
        console.log(`   - ID: ${track.id}`);
        console.log(`   - Label: ${track.label}`);
        console.log(`   - Enabled: ${track.enabled}`);
        console.log(`   - Muted: ${track.muted}`);
        console.log(`   - ReadyState: ${track.readyState}`);
      });
      console.log(`🎤 [WebRTC-AUDIO-DEBUG] ========================================`);
      
      // Aggiorna diagnostiche
      setAudioDiagnostics(prev => ({
        ...prev,
        localAudioTrackExists: audioTracks.length > 0,
        localAudioEnabled: audioTracks.length > 0 && audioTracks[0].enabled,
        lastAudioEvent: audioTracks.length > 0 
          ? `Mic locale attivo: ${audioTracks[0].label}` 
          : 'NESSUN AUDIO LOCALE!',
      }));

      peerConnectionsRef.current.forEach((pc, participantId) => {
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
            console.log(`🔄 [WebRTC-AUDIO-DEBUG] Rimpiazzata traccia ${track.kind} per ${participantId}`);
          } else {
            pc.addTrack(track, stream);
            console.log(`➕ [WebRTC-AUDIO-DEBUG] Aggiunta traccia ${track.kind} per ${participantId}`);
          }
        });
      });

      console.log(`✅ [WebRTC] Local stream started with ${stream.getTracks().length} tracks`);
    } catch (error) {
      console.error('❌ [WebRTC] Failed to get local stream:', error);
      throw error;
    }
  }, []);

  const stopLocalStream = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
      setIsLocalStreamReady(false);
    }
  }, []);

  const toggleVideo = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach(track => {
        track.enabled = enabled;
      });
    }
  }, []);

  const toggleAudio = useCallback((enabled: boolean) => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach(track => {
        track.enabled = enabled;
        console.log(`🎤 [WebRTC-AUDIO-DEBUG] Toggle audio: ${enabled ? 'ATTIVO' : 'MUTO'} - track.enabled=${track.enabled}`);
      });
      
      setAudioDiagnostics(prev => ({
        ...prev,
        localAudioEnabled: enabled,
        lastAudioEvent: enabled ? 'Mic ATTIVATO' : 'Mic MUTATO',
      }));
    } else {
      console.warn(`⚠️ [WebRTC-AUDIO-DEBUG] Toggle audio chiamato ma nessuno stream locale!`);
    }
  }, []);

  const handleWebRTCOffer = useCallback(async (fromParticipantId: string, sdp: RTCSessionDescriptionInit) => {
    console.log(`📥 [WebRTC] Received offer from ${fromParticipantId}`);
    
    if (!iceConfigLoaded) {
      console.warn(`⏳ [WebRTC] ICE config not loaded yet, queuing offer from ${fromParticipantId}`);
      pendingOffersRef.current.set(fromParticipantId, sdp);
      return;
    }
    
    let pc = peerConnectionsRef.current.get(fromParticipantId);
    if (!pc) {
      pc = createPeerConnection(fromParticipantId);
    }
    
    // FIX CRITICO: Assicurarsi che le tracce locali siano aggiunte alla peer connection
    // Questo risolve il problema unidirezionale dove l'host non invia le sue tracce all'utente
    
    // Defensive sync: Se il ref è null ma lo state esiste, sincronizzalo
    let streamToUse = localStreamRef.current;
    if (!streamToUse && localStream) {
      console.warn(`🔄 [WebRTC] localStreamRef.current was NULL but localStream state exists - syncing ref!`);
      localStreamRef.current = localStream;
      streamToUse = localStream;
    }
    
    if (streamToUse) {
      const existingSenders = pc.getSenders();
      const hasAudioSender = existingSenders.some(s => s.track?.kind === 'audio');
      const hasVideoSender = existingSenders.some(s => s.track?.kind === 'video');
      
      if (!hasAudioSender || !hasVideoSender) {
        console.log(`🔧 [WebRTC] Adding missing local tracks to peer connection for ${fromParticipantId}`);
        console.log(`   - Current senders: ${existingSenders.length} (audio: ${hasAudioSender}, video: ${hasVideoSender})`);
        
        streamToUse.getTracks().forEach(track => {
          const alreadyAdded = existingSenders.some(s => s.track?.id === track.id);
          if (!alreadyAdded) {
            console.log(`➕ [WebRTC] Adding local ${track.kind} track to connection with ${fromParticipantId}`);
            pc!.addTrack(track, streamToUse!);
          }
        });
      }
    } else {
      console.warn(`⚠️ [WebRTC] Both localStreamRef.current AND localStream state are NULL when handling offer from ${fromParticipantId} - tracks cannot be added!`);
    }
    
    // MDN Perfect Negotiation Pattern
    // Polite peer: lower participant ID - will rollback on collision
    // Impolite peer: higher participant ID - ignores incoming offers during collision
    const isPolite = !myParticipantId || myParticipantId < fromParticipantId;
    const makingOffer = makingOfferRef.current.get(fromParticipantId) || false;
    
    // Offer collision occurs when we're making an offer OR when signaling state is not stable
    const offerCollision = makingOffer || pc.signalingState !== 'stable';
    const ignoreOffer = !isPolite && offerCollision;
    
    if (ignoreOffer) {
      console.log(`⏭️ [WebRTC] Ignoring offer from ${fromParticipantId} (glare - we're impolite peer)`);
      return;
    }
    
    try {
      // If we're polite and there's a collision, we need to rollback first
      if (offerCollision && isPolite) {
        console.log(`🔄 [WebRTC] Glare collision - rolling back our offer to accept ${fromParticipantId}'s offer`);
        await Promise.all([
          pc.setLocalDescription({ type: 'rollback' }),
          pc.setRemoteDescription(new RTCSessionDescription(sdp))
        ]);
      } else {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      }
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromParticipantId) || [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromParticipantId);

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      if (myParticipantId) {
        console.log(`📤 [WebRTC] Sending answer to ${fromParticipantId}`);
        sendWebRTCMessage({
          type: 'webrtc_answer',
          targetParticipantId: fromParticipantId,
          fromParticipantId: myParticipantId,
          sdp: { type: 'answer', sdp: answer.sdp },
        });
      }
    } catch (error) {
      console.error(`❌ [WebRTC] Error handling offer from ${fromParticipantId}:`, error);
    }
  }, [createPeerConnection, myParticipantId, sendWebRTCMessage, iceConfigLoaded, localStream]);

  const handleWebRTCAnswer = useCallback(async (fromParticipantId: string, sdp: RTCSessionDescriptionInit) => {
    console.log(`📥 [WebRTC] Received answer from ${fromParticipantId}`);
    
    const existingOfferTimeout = offerRetryTimeoutRef.current.get(fromParticipantId);
    if (existingOfferTimeout) {
      clearTimeout(existingOfferTimeout);
      offerRetryTimeoutRef.current.delete(fromParticipantId);
      console.log(`✅ [WebRTC] Cleared offer retry timeout for ${fromParticipantId}`);
    }
    offerRetryCountRef.current.set(fromParticipantId, 0);
    
    const pc = peerConnectionsRef.current.get(fromParticipantId);
    if (!pc) {
      console.warn(`⚠️ [WebRTC] No peer connection for ${fromParticipantId}`);
      return;
    }

    try {
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      
      const pendingCandidates = pendingCandidatesRef.current.get(fromParticipantId) || [];
      for (const candidate of pendingCandidates) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
      pendingCandidatesRef.current.delete(fromParticipantId);
    } catch (error) {
      console.error(`❌ [WebRTC] Error handling answer from ${fromParticipantId}:`, error);
    }
  }, []);

  const handleICECandidate = useCallback(async (fromParticipantId: string, candidate: RTCIceCandidateInit) => {
    console.log(`🧊 [WebRTC] Received ICE candidate from ${fromParticipantId}`);
    
    const pc = peerConnectionsRef.current.get(fromParticipantId);
    
    if (!pc || !pc.remoteDescription) {
      if (!pendingCandidatesRef.current.has(fromParticipantId)) {
        pendingCandidatesRef.current.set(fromParticipantId, []);
      }
      pendingCandidatesRef.current.get(fromParticipantId)!.push(candidate);
      return;
    }

    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error(`❌ [WebRTC] Error adding ICE candidate from ${fromParticipantId}:`, error);
    }
  }, []);

  const initiateConnection = useCallback(async (remoteParticipantId: string, forceBothTry: boolean = false) => {
    if (!myParticipantId || !isLocalStreamReady || !iceConfigLoaded) {
      console.warn(`⚠️ [WebRTC] Cannot initiate connection: myId=${myParticipantId}, streamReady=${isLocalStreamReady}, iceLoaded=${iceConfigLoaded}`);
      return;
    }

    // Check if already connected or connecting
    const existingPc = peerConnectionsRef.current.get(remoteParticipantId);
    if (existingPc) {
      const isConnected = existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed';
      if (isConnected) {
        console.log(`✅ [WebRTC] Already connected to ${remoteParticipantId.slice(0,8)}..., skipping`);
        return;
      }
    }

    // The participant with the GREATER ID initiates the connection
    // Unless forceBothTry is true (fallback mode where both participants try)
    const shouldInitiate = forceBothTry || myParticipantId > remoteParticipantId;
    const reason = forceBothTry ? 'BOTH-TRY FALLBACK' : (myParticipantId > remoteParticipantId ? 'I INITIATE (higher ID)' : 'THEY INITIATE (lower ID)');
    console.log(`🔍 [WebRTC] Connection decision: myId=${myParticipantId.slice(0,8)}... vs remoteId=${remoteParticipantId.slice(0,8)}... → ${reason}`);
    
    if (!shouldInitiate) {
      console.log(`⏭️ [WebRTC] Skipping connection initiation (waiting for ${remoteParticipantId.slice(0,8)}... to initiate)`);
      return;
    }

    const currentRetries = offerRetryCountRef.current.get(remoteParticipantId) || 0;
    if (currentRetries >= MAX_OFFER_RETRIES) {
      console.error(`❌ [WebRTC] Max offer retries (${MAX_OFFER_RETRIES}) reached for ${remoteParticipantId}, giving up`);
      offerRetryCountRef.current.delete(remoteParticipantId);
      return;
    }

    console.log(`🚀 [WebRTC] Initiating connection to ${remoteParticipantId} (attempt ${currentRetries + 1}/${MAX_OFFER_RETRIES})`);
    
    const existingTimeout = offerRetryTimeoutRef.current.get(remoteParticipantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      offerRetryTimeoutRef.current.delete(remoteParticipantId);
    }
    
    let pc = peerConnectionsRef.current.get(remoteParticipantId);
    
    // If peer connection exists but has problematic signaling state, reset it
    // This prevents "m-lines order mismatch" errors on renegotiation
    if (pc && pc.signalingState !== 'stable' && pc.signalingState !== 'closed') {
      console.log(`🔄 [WebRTC] Resetting peer connection for ${remoteParticipantId} (signalingState: ${pc.signalingState})`);
      pc.close();
      peerConnectionsRef.current.delete(remoteParticipantId);
      pc = null;
    }
    
    if (!pc) {
      pc = createPeerConnection(remoteParticipantId);
    }

    try {
      makingOfferRef.current.set(remoteParticipantId, true);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      console.log(`📤 [WebRTC] Sending offer to ${remoteParticipantId}`);
      sendWebRTCMessage({
        type: 'webrtc_offer',
        targetParticipantId: remoteParticipantId,
        fromParticipantId: myParticipantId,
        sdp: { type: 'offer', sdp: offer.sdp },
      });
      
      const timeoutId = setTimeout(() => {
        offerRetryTimeoutRef.current.delete(remoteParticipantId);
        const pc = peerConnectionsRef.current.get(remoteParticipantId);
        if (!pc || !pc.remoteDescription) {
          const nextRetry = (offerRetryCountRef.current.get(remoteParticipantId) || 0) + 1;
          offerRetryCountRef.current.set(remoteParticipantId, nextRetry);
          if (nextRetry < MAX_OFFER_RETRIES) {
            console.warn(`⏱️ [WebRTC] No answer received from ${remoteParticipantId} after ${OFFER_RETRY_TIMEOUT_MS}ms, retrying (${nextRetry}/${MAX_OFFER_RETRIES})...`);
            if (reconnectCallbackRef.current) {
              reconnectCallbackRef.current(remoteParticipantId);
            }
          } else {
            console.error(`❌ [WebRTC] Failed to connect to ${remoteParticipantId} after ${MAX_OFFER_RETRIES} attempts`);
            offerRetryCountRef.current.delete(remoteParticipantId);
          }
        }
      }, OFFER_RETRY_TIMEOUT_MS);
      offerRetryTimeoutRef.current.set(remoteParticipantId, timeoutId);
    } catch (error) {
      console.error(`❌ [WebRTC] Error creating offer for ${remoteParticipantId}:`, error);
    } finally {
      makingOfferRef.current.set(remoteParticipantId, false);
    }
  }, [myParticipantId, isLocalStreamReady, iceConfigLoaded, createPeerConnection, sendWebRTCMessage]);

  const isParticipantActive = useCallback((participantId: string): boolean => {
    return participantsRef.current.some(p => p.id === participantId);
  }, []);

  const cleanupParticipantRetries = useCallback((participantId: string) => {
    const socketRetry = socketReadyRetryRef.current.get(participantId);
    if (socketRetry?.timeout) {
      clearTimeout(socketRetry.timeout);
      socketReadyRetryRef.current.delete(participantId);
    }
    const bothTimeout = bothTryTimeoutRef.current.get(participantId);
    if (bothTimeout) {
      clearTimeout(bothTimeout);
      bothTryTimeoutRef.current.delete(participantId);
    }
    bothTryActiveRef.current.delete(participantId);
  }, []);

  const handleParticipantSocketReady = useCallback((participantId: string, retryAttempt: number = 0) => {
    if (participantId === myParticipantId) {
      console.log(`📡 [WebRTC] Received own socket_ready, ignoring`);
      return;
    }
    
    // Check if participant still exists (prevents orphaned retries)
    if (!isParticipantActive(participantId)) {
      console.log(`📡 [WebRTC] Participant ${participantId.slice(0,8)}... no longer active, aborting connection attempt`);
      cleanupParticipantRetries(participantId);
      return;
    }
    
    // If not ready, queue for later processing
    if (!myParticipantId || !isLocalStreamReady || !iceConfigLoaded) {
      console.log(`⏳ [WebRTC] Queueing socket_ready for ${participantId} (myId=${!!myParticipantId}, stream=${isLocalStreamReady}, ice=${iceConfigLoaded})`);
      pendingSocketReadyRef.current.add(participantId);
      return;
    }
    
    // Clear any existing retry timeout for this participant
    const existingRetry = socketReadyRetryRef.current.get(participantId);
    if (existingRetry?.timeout) {
      clearTimeout(existingRetry.timeout);
    }
    
    // Fresh socket_ready resets both-try state to prevent glare loops
    if (retryAttempt === 0) {
      bothTryActiveRef.current.delete(participantId);
    }
    
    const existingPc = peerConnectionsRef.current.get(participantId);
    if (existingPc) {
      const isNegotiating = existingPc.signalingState !== 'stable' && existingPc.signalingState !== 'closed';
      const isConnected = existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed';
      if (isNegotiating || isConnected) {
        console.log(`📡 [WebRTC] Participant socket ready: ${participantId.slice(0,8)}..., but negotiation in progress or already connected, skipping`);
        cleanupParticipantRetries(participantId);
        return;
      }
    }
    
    console.log(`📡 [WebRTC] Participant socket ready: ${participantId.slice(0,8)}..., initiating connection (attempt ${retryAttempt + 1})...`);
    offerRetryCountRef.current.set(participantId, 0);
    const existingOfferTimeout = offerRetryTimeoutRef.current.get(participantId);
    if (existingOfferTimeout) {
      clearTimeout(existingOfferTimeout);
      offerRetryTimeoutRef.current.delete(participantId);
    }
    
    // Try to initiate connection
    initiateConnection(participantId, bothTryActiveRef.current.has(participantId));
    
    // Setup retry with exponential backoff if connection doesn't establish
    if (retryAttempt < SOCKET_READY_RETRY_MAX) {
      const delay = SOCKET_READY_RETRY_BASE_MS * Math.pow(2, retryAttempt);
      const retryTimeout = setTimeout(() => {
        // Guard: verify participant still exists before retry
        if (!isParticipantActive(participantId)) {
          console.log(`🛑 [WebRTC] Retry cancelled - participant ${participantId.slice(0,8)}... left`);
          cleanupParticipantRetries(participantId);
          return;
        }
        
        const pc = peerConnectionsRef.current.get(participantId);
        const isConnected = pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
        
        if (!isConnected) {
          console.log(`🔄 [WebRTC] Connection not established with ${participantId.slice(0,8)}..., retrying (${retryAttempt + 1}/${SOCKET_READY_RETRY_MAX})...`);
          handleParticipantSocketReady(participantId, retryAttempt + 1);
        } else {
          console.log(`✅ [WebRTC] Connection established with ${participantId.slice(0,8)}..., no retry needed`);
          cleanupParticipantRetries(participantId);
        }
      }, delay);
      
      socketReadyRetryRef.current.set(participantId, { count: retryAttempt, timeout: retryTimeout });
    }
    
    // Setup "both try" fallback timeout (only on first attempt)
    if (retryAttempt === 0 && !bothTryTimeoutRef.current.has(participantId)) {
      console.log(`⏰ [WebRTC] Setting up both-try fallback for ${participantId.slice(0,8)}... in ${BOTH_TRY_TIMEOUT_MS}ms`);
      const bothTryTimeout = setTimeout(() => {
        bothTryTimeoutRef.current.delete(participantId);
        
        // Guard: verify participant still exists before both-try fallback
        if (!isParticipantActive(participantId)) {
          console.log(`🛑 [WebRTC] Both-try fallback cancelled - participant ${participantId.slice(0,8)}... left`);
          cleanupParticipantRetries(participantId);
          return;
        }
        
        const pc = peerConnectionsRef.current.get(participantId);
        const isConnected = pc && (pc.iceConnectionState === 'connected' || pc.iceConnectionState === 'completed');
        
        if (!isConnected) {
          console.warn(`⚡ [WebRTC] BOTH-TRY FALLBACK: Connection not established with ${participantId.slice(0,8)}... after ${BOTH_TRY_TIMEOUT_MS}ms, both participants will now try to connect`);
          bothTryActiveRef.current.add(participantId);
          
          // Reset offer retry count so forced attempt actually runs
          offerRetryCountRef.current.set(participantId, 0);
          
          // Close existing connection if any and retry
          if (pc) {
            pc.close();
            peerConnectionsRef.current.delete(participantId);
          }
          
          // Force initiate with both-try flag
          initiateConnection(participantId, true);
        }
      }, BOTH_TRY_TIMEOUT_MS);
      
      bothTryTimeoutRef.current.set(participantId, bothTryTimeout);
    }
  }, [myParticipantId, isLocalStreamReady, iceConfigLoaded, initiateConnection, isParticipantActive, cleanupParticipantRetries]);

  const handleWebRTCMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'webrtc_offer':
        handleWebRTCOffer(message.data.fromParticipantId, message.data.sdp);
        break;
      case 'webrtc_answer':
        handleWebRTCAnswer(message.data.fromParticipantId, message.data.sdp);
        break;
      case 'ice_candidate':
        handleICECandidate(message.data.fromParticipantId, message.data.candidate);
        break;
      case 'participant_socket_ready':
        handleParticipantSocketReady(message.data.participantId);
        break;
    }
  }, [handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate, handleParticipantSocketReady]);

  useEffect(() => {
    if (!iceConfigLoaded) return;
    
    const pendingOffers = pendingOffersRef.current;
    if (pendingOffers.size > 0) {
      console.log(`🔄 [WebRTC] Processing ${pendingOffers.size} queued offers after ICE config loaded`);
      pendingOffers.forEach((sdp, fromParticipantId) => {
        console.log(`📥 [WebRTC] Processing queued offer from ${fromParticipantId}`);
        handleWebRTCOffer(fromParticipantId, sdp);
      });
      pendingOffers.clear();
    }
  }, [iceConfigLoaded, handleWebRTCOffer]);

  // Process queued socket_ready events when ready
  useEffect(() => {
    if (!myParticipantId || !isLocalStreamReady || !iceConfigLoaded) return;
    
    const pendingSocketReady = pendingSocketReadyRef.current;
    if (pendingSocketReady.size > 0) {
      console.log(`🔄 [WebRTC] Processing ${pendingSocketReady.size} queued socket_ready events`);
      pendingSocketReady.forEach((participantId) => {
        if (participantId !== myParticipantId) {
          console.log(`📡 [WebRTC] Processing queued socket_ready for ${participantId}`);
          handleParticipantSocketReady(participantId);
        }
      });
      pendingSocketReady.clear();
    }
  }, [myParticipantId, isLocalStreamReady, iceConfigLoaded, handleParticipantSocketReady]);

  useEffect(() => {
    reconnectCallbackRef.current = (participantId: string) => {
      console.log(`🔄 [WebRTC] Reconnecting to ${participantId}`);
      const forceBothTry = bothTryActiveRef.current.has(participantId);
      initiateConnection(participantId, forceBothTry);
    };
    return () => {
      reconnectCallbackRef.current = null;
    };
  }, [initiateConnection]);

  useEffect(() => {
    if (!isConnected || !myParticipantId || !isLocalStreamReady || !isJoinConfirmed || !iceConfigLoaded) {
      console.log(`⏳ [WebRTC] Participants effect waiting: connected=${isConnected}, myId=${!!myParticipantId}, stream=${isLocalStreamReady}, joined=${isJoinConfirmed}, ice=${iceConfigLoaded}`);
      return;
    }

    const otherParticipants = participants.filter(p => p.id !== myParticipantId);
    console.log(`👥 [WebRTC] Checking ${otherParticipants.length} other participants for connections (my ID: ${myParticipantId})`);
    
    for (const participant of otherParticipants) {
      if (!peerConnectionsRef.current.has(participant.id)) {
        console.log(`🔗 [WebRTC] No existing connection to ${participant.id}, attempting to initiate...`);
        initiateConnection(participant.id);
      } else {
        const pc = peerConnectionsRef.current.get(participant.id);
        console.log(`✓ [WebRTC] Already have connection to ${participant.id} (state: ${pc?.iceConnectionState})`);
      }
    }
  }, [isConnected, myParticipantId, participants, isLocalStreamReady, isJoinConfirmed, iceConfigLoaded, initiateConnection]);

  useEffect(() => {
    return () => {
      retryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutRef.current.clear();
      
      offerRetryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      offerRetryTimeoutRef.current.clear();
      
      // Cleanup socket ready retry timeouts
      socketReadyRetryRef.current.forEach(({ timeout }) => {
        if (timeout) clearTimeout(timeout);
      });
      socketReadyRetryRef.current.clear();
      
      // Cleanup both-try fallback timeouts
      bothTryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      bothTryTimeoutRef.current.clear();
      bothTryActiveRef.current.clear();
      
      peerConnectionsRef.current.forEach((pc, id) => {
        console.log(`🔌 [WebRTC] Closing connection to ${id}`);
        pc.close();
      });
      peerConnectionsRef.current.clear();
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    const currentRemoteIds = new Set(remoteStreams.keys());
    const activeParticipantIds = new Set(
      participants.filter(p => p.id !== myParticipantId).map(p => p.id)
    );

    currentRemoteIds.forEach(id => {
      if (!activeParticipantIds.has(id)) {
        console.log(`🗑️ [WebRTC] Removing stream for disconnected participant ${id}`);
        
        const streamToRemove = remoteStreams.get(id);
        const audioTracksToRemove = streamToRemove ? streamToRemove.getAudioTracks().length : 0;
        
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });

        if (audioTracksToRemove > 0) {
          console.log(`🎤 [WebRTC-AUDIO-DEBUG] Removing ${audioTracksToRemove} audio track(s) from ${id}`);
          setAudioDiagnostics(prev => ({
            ...prev,
            remoteAudioTracks: Math.max(0, prev.remoteAudioTracks - audioTracksToRemove),
            lastAudioEvent: `Rimossa traccia audio da ${id.slice(0,8)}...`,
          }));
        }

        const pc = peerConnectionsRef.current.get(id);
        if (pc) {
          pc.close();
          peerConnectionsRef.current.delete(id);
        }
        
        const offerTimeout = offerRetryTimeoutRef.current.get(id);
        if (offerTimeout) {
          clearTimeout(offerTimeout);
          offerRetryTimeoutRef.current.delete(id);
        }
        offerRetryCountRef.current.delete(id);
        
        cleanupParticipantRetries(id);
      }
    });
  }, [participants, myParticipantId, remoteStreams, cleanupParticipantRetries]);

  return {
    localStream,
    remoteStreams,
    isLocalStreamReady,
    startLocalStream,
    stopLocalStream,
    handleWebRTCMessage,
    toggleVideo,
    toggleAudio,
    audioDiagnostics,
  };
}
