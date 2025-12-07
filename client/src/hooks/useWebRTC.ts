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
  sendWebRTCMessage: (message: any) => void;
  onWebRTCMessage?: (message: any) => void;
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
  sendWebRTCMessage,
}: UseWebRTCProps): UseWebRTCResult {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<Map<string, MediaStream>>(new Map());
  const [isLocalStreamReady, setIsLocalStreamReady] = useState(false);

  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const makingOfferRef = useRef<Map<string, boolean>>(new Map());
  const connectionRetryRef = useRef<Map<string, number>>(new Map());
  const retryTimeoutRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const reconnectCallbackRef = useRef<((participantId: string) => void) | null>(null);

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
      console.log(`📹 [WebRTC] Received remote track from ${remoteParticipantId}`, event.track.kind);
      
      const [remoteStream] = event.streams;
      if (remoteStream) {
        setRemoteStreams(prev => {
          const newMap = new Map(prev);
          newMap.set(remoteParticipantId, remoteStream);
          return newMap;
        });
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log(`🔌 [WebRTC] ICE connection state for ${remoteParticipantId}: ${pc.iceConnectionState}`);
      
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

      peerConnectionsRef.current.forEach((pc, participantId) => {
        stream.getTracks().forEach(track => {
          const sender = pc.getSenders().find(s => s.track?.kind === track.kind);
          if (sender) {
            sender.replaceTrack(track);
          } else {
            pc.addTrack(track, stream);
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
      });
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
    }
  }, [handleWebRTCOffer, handleWebRTCAnswer, handleICECandidate]);

  const initiateConnection = useCallback(async (remoteParticipantId: string) => {
    if (!myParticipantId || !isLocalStreamReady) {
      console.warn(`⚠️ [WebRTC] Cannot initiate connection: myId=${myParticipantId}, streamReady=${isLocalStreamReady}`);
      return;
    }

    // Use deterministic initiator logic: participant with higher ID initiates
    if (myParticipantId <= remoteParticipantId) {
      console.log(`⏭️ [WebRTC] Skipping connection initiation (not the initiator)`);
      return;
    }

    console.log(`🚀 [WebRTC] Initiating connection to ${remoteParticipantId}`);
    
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
    } catch (error) {
      console.error(`❌ [WebRTC] Error creating offer for ${remoteParticipantId}:`, error);
    } finally {
      makingOfferRef.current.set(remoteParticipantId, false);
    }
  }, [myParticipantId, isLocalStreamReady, createPeerConnection, sendWebRTCMessage]);

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
    if (!isConnected || !myParticipantId || !isLocalStreamReady) {
      return;
    }

    const otherParticipants = participants.filter(p => p.id !== myParticipantId);
    
    for (const participant of otherParticipants) {
      if (!peerConnectionsRef.current.has(participant.id)) {
        initiateConnection(participant.id);
      }
    }
  }, [isConnected, myParticipantId, participants, isLocalStreamReady, initiateConnection]);

  useEffect(() => {
    return () => {
      retryTimeoutRef.current.forEach(timeout => clearTimeout(timeout));
      retryTimeoutRef.current.clear();
      
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
  };
}
