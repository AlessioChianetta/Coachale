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

const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun3.l.google.com:19302' },
    { urls: 'stun:stun4.l.google.com:19302' },
  ],
};

export function useWebRTC({
  myParticipantId,
  participants,
  isConnected,
  isJoinConfirmed,
  sendWebRTCMessage,
}: UseWebRTCProps): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false);
  const [audioDiagnostics, setAudioDiagnostics] = useState<AudioDiagnostics>({
    localAudioTrackExists: false,
    localAudioEnabled: false,
    remoteAudioTracks: 0,
    iceConnectionStates: new Map(),
    lastAudioEvent: 'Nessun evento',
  });

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const connectionRetryRef = useRef<Map<string, number>>(new Map());
  const retryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectCallbackRef = useRef<((participantId: string) => void) | null>(null);
  const offerRetryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const offerRetryCountRef = useRef<Map<string, number>>(new Map());
  const OFFER_RETRY_TIMEOUT_MS = 5000;
  const MAX_OFFER_RETRIES = 3;

  const createPeerConnection = useCallback((remoteParticipantId: string): RTCPeerConnection => {
    console.log(`🔗 [WebRTC] Creating peer connection for ${remoteParticipantId}`);
    
    const pc = new RTCPeerConnection(ICE_SERVERS);

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
      const isAudio = track.kind === 'audio';
      
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] ========================================`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] RICEVUTO TRACK REMOTO da ${remoteParticipantId}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Tipo: ${track.kind}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Track ID: ${track.id}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Track enabled: ${track.enabled}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Track muted: ${track.muted}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Track readyState: ${track.readyState}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] Streams nell'evento: ${event.streams.length}`);
      console.log(`🎧 [WebRTC-AUDIO-DEBUG] ========================================`);
      
      if (isAudio) {
        setAudioDiagnostics(prev => ({
          ...prev,
          remoteAudioTracks: prev.remoteAudioTracks + 1,
          lastAudioEvent: `Audio remoto ricevuto da ${remoteParticipantId} - enabled: ${track.enabled}, muted: ${track.muted}`,
        }));
        
        // Monitor per cambiamenti di stato della traccia audio
        track.onmute = () => {
          console.log(`🔇 [WebRTC-AUDIO-DEBUG] TRACK AUDIO MUTATO da ${remoteParticipantId}`);
          setAudioDiagnostics(prev => ({
            ...prev,
            lastAudioEvent: `Audio MUTATO da ${remoteParticipantId}`,
          }));
        };
        
        track.onunmute = () => {
          console.log(`🔊 [WebRTC-AUDIO-DEBUG] TRACK AUDIO SMUTATO da ${remoteParticipantId}`);
          setAudioDiagnostics(prev => ({
            ...prev,
            lastAudioEvent: `Audio ATTIVO da ${remoteParticipantId}`,
          }));
        };
        
        track.onended = () => {
          console.log(`⏹️ [WebRTC-AUDIO-DEBUG] TRACK AUDIO TERMINATO da ${remoteParticipantId}`);
          setAudioDiagnostics(prev => ({
            ...prev,
            lastAudioEvent: `Audio TERMINATO da ${remoteParticipantId}`,
          }));
        };
      }
      
      setRemoteStreams(prev => {
        const newMap = new Map(prev);
        
        // 1. Recupera lo stream esistente O usa quello dell'evento O ne crea uno nuovo
        let stream = newMap.get(remoteParticipantId) || event.streams[0] || new MediaStream();
        
        // 2. Se abbiamo creato un nuovo MediaStream manuale, aggiungiamo la traccia
        if (!stream.getTrackById(track.id)) {
          stream.addTrack(track);
          console.log(`➕ [WebRTC-AUDIO-DEBUG] Aggiunta traccia ${track.kind} allo stream per ${remoteParticipantId}`);
        }

        // Log dettagliato dello stream
        const audioTracks = stream.getAudioTracks();
        const videoTracks = stream.getVideoTracks();
        console.log(`📊 [WebRTC-AUDIO-DEBUG] Stream per ${remoteParticipantId}: ${audioTracks.length} audio, ${videoTracks.length} video`);
        audioTracks.forEach((t, i) => {
          console.log(`   🔈 Audio track ${i}: enabled=${t.enabled}, muted=${t.muted}, state=${t.readyState}`);
        });

        // 3. Aggiorna la mappa. 
        // IMPORTANTE: Creiamo un clone del MediaStream se necessario per forzare il re-render di React
        // (A volte React non "vede" che lo stream interno è cambiato se l'oggetto riferimento è lo stesso)
        newMap.set(remoteParticipantId, stream);
        return newMap;
      });
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
      
      if (pc.iceConnectionState === 'connected') {
        connectionRetryRef.current.set(remoteParticipantId, 0);
        const timeout = retryTimeoutRef.current.get(remoteParticipantId);
        if (timeout) {
          clearTimeout(timeout);
          retryTimeoutRef.current.delete(remoteParticipantId);
        }
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
      localStreamRef.current.getTracks().forEach(track => {
        console.log(`➕ [WebRTC] Adding local track ${track.kind} to connection with ${remoteParticipantId}`);
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    peerConnectionsRef.current.set(remoteParticipantId, pc);
    return pc;
  }, [myParticipantId, sendWebRTCMessage]);

  const startLocalStream = useCallback(async (video: boolean, audio: boolean) => {
    try {
      console.log(`📹 [WebRTC] Starting local stream (video: ${video}, audio: ${audio})`);
      
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: video ? { 
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        } : false,
        audio: audio ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        } : false,
      });

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
    
    let pc = peerConnectionsRef.current.get(fromParticipantId);
    if (!pc) {
      pc = createPeerConnection(fromParticipantId);
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
  }, [createPeerConnection, myParticipantId, sendWebRTCMessage]);

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

  const initiateConnection = useCallback(async (remoteParticipantId: string) => {
    if (!myParticipantId || !isLocalStreamReady) {
      console.warn(`⚠️ [WebRTC] Cannot initiate connection: myId=${myParticipantId}, streamReady=${isLocalStreamReady}`);
      return;
    }

    if (myParticipantId <= remoteParticipantId) {
      console.log(`⏭️ [WebRTC] Skipping connection initiation (not the initiator)`);
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
  }, [myParticipantId, isLocalStreamReady, createPeerConnection, sendWebRTCMessage]);

  const handleParticipantSocketReady = useCallback((participantId: string) => {
    if (!myParticipantId || !isLocalStreamReady || participantId === myParticipantId) {
      return;
    }
    
    const existingPc = peerConnectionsRef.current.get(participantId);
    if (existingPc) {
      const isNegotiating = existingPc.signalingState !== 'stable' && existingPc.signalingState !== 'closed';
      const isConnected = existingPc.iceConnectionState === 'connected' || existingPc.iceConnectionState === 'completed';
      if (isNegotiating || isConnected) {
        console.log(`📡 [WebRTC] Participant socket ready: ${participantId}, but negotiation in progress or already connected, skipping`);
        return;
      }
    }
    
    console.log(`📡 [WebRTC] Participant socket ready: ${participantId}, initiating connection...`);
    offerRetryCountRef.current.set(participantId, 0);
    const existingTimeout = offerRetryTimeoutRef.current.get(participantId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      offerRetryTimeoutRef.current.delete(participantId);
    }
    
    initiateConnection(participantId);
  }, [myParticipantId, isLocalStreamReady, initiateConnection]);

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
    reconnectCallbackRef.current = (participantId: string) => {
      console.log(`🔄 [WebRTC] Reconnecting to ${participantId}`);
      initiateConnection(participantId);
    };
    return () => {
      reconnectCallbackRef.current = null;
    };
  }, [initiateConnection]);

  useEffect(() => {
    if (!isConnected || !myParticipantId || !isLocalStreamReady || !isJoinConfirmed) {
      return;
    }

    const otherParticipants = participants.filter(p => p.id !== myParticipantId);
    
    for (const participant of otherParticipants) {
      if (!peerConnectionsRef.current.has(participant.id)) {
        initiateConnection(participant.id);
      }
    }
  }, [isConnected, myParticipantId, participants, isLocalStreamReady, isJoinConfirmed, initiateConnection]);

  useEffect(() => {
    return () => {
      retryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutRef.current.clear();
      
      offerRetryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      offerRetryTimeoutRef.current.clear();
      
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
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.delete(id);
          return newMap;
        });

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
      }
    });
  }, [participants, myParticipantId, remoteStreams]);

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
