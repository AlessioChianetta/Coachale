import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantVideo, { SentimentType } from './ParticipantVideo';
import VideoControls from './VideoControls';
import AICopilotHUD from './AICopilotHUD';
import CoachingPanel from './CoachingPanel';
import { useVideoMeeting } from '@/hooks/useVideoMeeting';
import { useVideoCopilot } from '@/hooks/useVideoCopilot';
import { useWebRTC } from '@/hooks/useWebRTC';
import { useAudioLevelMonitor } from '@/hooks/useAudioLevelMonitor';
import { useSalesCoaching } from './hooks/useSalesCoaching';
import { useVADAudioCapture } from './hooks/useVADAudioCapture';
import { Loader2 } from 'lucide-react';

export interface VideoRoomProps {
  meetingId: string;
  isHost: boolean;
  participantName: string;
  onEndCall: () => void;
}

interface DisplayParticipant {
  id: string;
  name: string;
  sentiment: SentimentType;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isLocalUser: boolean;
}

export default function VideoRoom({
  meetingId,
  isHost,
  participantName,
  onEndCall,
}: VideoRoomProps) {
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [showHUD, setShowHUD] = useState(isHost);
  const [showCoachingPanel, setShowCoachingPanel] = useState(isHost);

  const {
    meeting,
    seller,
    script,
    participants: meetingParticipants,
    isLoading: meetingLoading,
    error: meetingError,
    updateMeetingStatus,
  } = useVideoMeeting(meetingId);

  const {
    isConnected,
    isConnecting,
    error: copilotError,
    scriptItems,
    currentSuggestion,
    battleCard,
    participantSentiments,
    participantSpeakingStates,
    participants: copilotParticipants,
    myParticipantId,
    isJoinConfirmed,
    transcripts,
    toggleScriptItem,
    dismissBattleCard,
    updateParticipants,
    joinParticipant,
    leaveParticipant,
    sendWebRTCMessage,
    setWebRTCMessageHandler,
    setCoachingMessageHandler,
    sendSpeakingState,
    sendAudioChunk,
    sendSpeechStart,
    sendSpeechEnd,
  } = useVideoCopilot(meeting?.meetingToken ?? null);

  const {
    isActive: isCoachingActive,
    scriptProgress: coachingScriptProgress,
    buySignals,
    objections,
    checkpointStatus,
    prospectProfile,
    currentFeedback,
    feedbackHistory,
    toneWarnings,
    handleCoachingMessage,
    dismissFeedback,
    dismissBuySignal,
    dismissObjection,
  } = useSalesCoaching({ isHost });

  const activeParticipantsForWebRTC = useMemo(() => {
    return copilotParticipants.filter(p => !p.leftAt).map(p => ({
      id: p.id,
      name: p.name,
      role: p.role,
    }));
  }, [copilotParticipants]);

  const {
    localStream,
    remoteStreams,
    isLocalStreamReady,
    startLocalStream,
    stopLocalStream,
    handleWebRTCMessage,
    toggleVideo: toggleWebRTCVideo,
    toggleAudio: toggleWebRTCAudio,
    audioDiagnostics,
  } = useWebRTC({
    meetingId,
    myParticipantId,
    participants: activeParticipantsForWebRTC,
    isConnected,
    isJoinConfirmed,
    sendWebRTCMessage,
  });

  const [showDebugPanel, setShowDebugPanel] = useState(false);

  // Audio level monitoring for speaking indicator
  const { audioLevel, isSpeaking, startMonitoring, stopMonitoring } = useAudioLevelMonitor();

  // Audio capture with VAD for AI transcription and coaching (only for host)
  const {
    isCapturing,
    startCapture,
    stopCapture,
    updateProspects,
    speakingProspects,
    hostIsSpeaking: vadHostIsSpeaking,
    prospectIsSpeaking: vadProspectIsSpeaking,
  } = useVADAudioCapture({
    onAudioChunk: sendAudioChunk,
    onSpeechStart: sendSpeechStart,
    onSpeechEnd: sendSpeechEnd,
    hostParticipantId: myParticipantId,
    hostName: participantName,
    enabled: isHost,
  });

  // Track if we've joined this session (to avoid duplicate joins)
  const [hasJoined, setHasJoined] = useState(false);
  const myParticipantIdRef = useRef<string | null>(null);

  useEffect(() => {
    setWebRTCMessageHandler(handleWebRTCMessage);
  }, [setWebRTCMessageHandler, handleWebRTCMessage]);

  useEffect(() => {
    setCoachingMessageHandler(handleCoachingMessage);
  }, [setCoachingMessageHandler, handleCoachingMessage]);

  useEffect(() => {
    if (isConnected && !isLocalStreamReady) {
      startLocalStream(!isVideoOff, !isMuted).catch(err => {
        console.error('Failed to start local stream:', err);
      });
    }
  }, [isConnected, isLocalStreamReady, isVideoOff, isMuted, startLocalStream]);

  // Start audio level monitoring when local stream is ready
  useEffect(() => {
    if (localStream && !isMuted) {
      startMonitoring(localStream);
    } else {
      stopMonitoring();
    }
    return () => stopMonitoring();
  }, [localStream, isMuted, startMonitoring, stopMonitoring]);

  // Send speaking state to other participants via WebSocket
  // Only send when WebSocket is connected, join is confirmed, and we have a participant ID
  useEffect(() => {
    if (isConnected && isJoinConfirmed && myParticipantId) {
      sendSpeakingState(isSpeaking);
    }
  }, [isSpeaking, isConnected, isJoinConfirmed, myParticipantId, sendSpeakingState]);

  useEffect(() => {
    if (meeting && meeting.status === 'scheduled') {
      updateMeetingStatus('in_progress');
    }
  }, [meeting, updateMeetingStatus]);

  // Reset join state when WebSocket disconnects (for reconnection)
  useEffect(() => {
    if (!isConnected && hasJoined) {
      setHasJoined(false);
      myParticipantIdRef.current = null;
    }
  }, [isConnected, hasJoined]);

  // Join participant when WebSocket connects
  useEffect(() => {
    if (isConnected && !hasJoined) {
      const role = isHost ? 'host' : 'prospect';
      joinParticipant(participantName, role);
      setHasJoined(true);
    }
  }, [isConnected, hasJoined, isHost, participantName, joinParticipant]);

  // Keep ref in sync with hook's myParticipantId (for cleanup on unmount)
  useEffect(() => {
    myParticipantIdRef.current = myParticipantId;
  }, [myParticipantId]);

  // Leave participant on unmount (use ref for cleanup to avoid stale closure)
  useEffect(() => {
    return () => {
      if (myParticipantIdRef.current) {
        leaveParticipant(myParticipantIdRef.current);
      }
    };
  }, [leaveParticipant]);

  // Track if audio capture has been started (to avoid restart loops)
  const audioCaptureStartedRef = useRef(false);
  const remoteStreamsSize = remoteStreams.size;

  // Start audio capture ONCE when conditions are met (host only)
  // This effect should NOT restart when participants change - we use updateProspects for that
  useEffect(() => {
    if (!isHost || !isConnected || !localStream || !myParticipantId) {
      return;
    }

    // Only start capture once per session
    if (audioCaptureStartedRef.current) {
      console.log('[AudioCapture] Already started, skipping re-initialization');
      return;
    }

    const activeProspects = copilotParticipants
      .filter(p => p.role === 'prospect' && !p.leftAt)
      .map(p => ({ id: p.id, name: p.name }));

    console.log(`[AudioCapture] Starting capture ONCE - Host: ${participantName}, Prospects: ${activeProspects.map(p => p.name).join(', ') || 'none'}, ParticipantId: ${myParticipantId}`);

    startCapture(
      localStream,
      remoteStreams,
      activeProspects
    );
    audioCaptureStartedRef.current = true;

    // Only stop capture when component unmounts or WebSocket disconnects
    return () => {
      console.log('[AudioCapture] Stopping capture on unmount/disconnect');
      stopCapture();
      audioCaptureStartedRef.current = false;
    };
    // CRITICAL: Only depend on connection state and host stream, NOT on participants
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, isConnected, localStream, myParticipantId, participantName, startCapture, stopCapture]);

  // Update prospect audio capture dynamically when participants join/leave (lightweight update, no restart)
  useEffect(() => {
    if (!isHost || !isCapturing || !audioCaptureStartedRef.current) {
      return;
    }

    const activeProspects = copilotParticipants
      .filter(p => p.role === 'prospect' && !p.leftAt)
      .map(p => ({ id: p.id, name: p.name }));

    console.log(`[AudioCapture] Updating prospects (no restart): ${activeProspects.map(p => p.name).join(', ') || 'none'}`);
    updateProspects(remoteStreams, activeProspects);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost, isCapturing, copilotParticipants, remoteStreamsSize, updateProspects]);

  useEffect(() => {
    if (isConnected && meetingParticipants.length > 0) {
      updateParticipants(meetingParticipants.map(p => ({
        id: p.id,
        name: p.name,
        role: p.role,
      })));
    }
  }, [isConnected, meetingParticipants, updateParticipants]);

  const displayParticipants: DisplayParticipant[] = useMemo(() => {
    // Prefer copilot participants (from WebSocket) when connected, otherwise use meeting participants (from API)
    const activeParticipants = isConnected && copilotParticipants.length > 0
      ? copilotParticipants.filter(p => !p.leftAt)
      : meetingParticipants;

    if (activeParticipants.length === 0) {
      return [{
        id: myParticipantId || 'local-user',
        name: participantName,
        sentiment: 'neutral' as SentimentType,
        isHost: isHost,
        isMuted: isMuted,
        isVideoOff: isVideoOff,
        isLocalUser: true,
      }];
    }

    return activeParticipants.map(p => ({
      id: p.id,
      name: p.name,
      sentiment: participantSentiments.get(p.id) || 'neutral' as SentimentType,
      isHost: p.role === 'host',
      isMuted: p.id === myParticipantId ? isMuted : false,
      isVideoOff: p.id === myParticipantId ? isVideoOff : false,
      isLocalUser: p.id === myParticipantId,
    }));
  }, [meetingParticipants, copilotParticipants, isConnected, participantSentiments, participantName, isMuted, isVideoOff, myParticipantId, isHost]);

  const displayScriptItems = useMemo(() => {
    if (scriptItems.length > 0) {
      return scriptItems;
    }

    if (script?.structure?.phases) {
      return script.structure.phases.map((phase, index) => ({
        id: phase.id || String(index + 1),
        text: phase.name || `Fase ${index + 1}`,
        completed: false,
      }));
    }

    return [
      { id: '1', text: 'Caricamento script...', completed: false },
    ];
  }, [scriptItems, script]);

  const displaySuggestion = currentSuggestion || 
    (isConnecting ? 'Connessione al copilot in corso...' : 
     isConnected ? 'In attesa di suggerimenti dall\'AI...' : 
     'Copilot non connesso');

  const handleToggleMute = () => {
    const newMutedState = !isMuted;
    setIsMuted(newMutedState);
    toggleWebRTCAudio(!newMutedState);
  };

  const handleToggleVideo = () => {
    const newVideoOffState = !isVideoOff;
    setIsVideoOff(newVideoOffState);
    toggleWebRTCVideo(!newVideoOffState);
  };

  const handleEndCall = async () => {
    stopLocalStream();
    if (myParticipantId) {
      leaveParticipant(myParticipantId);
    }
    onEndCall();
  };

  // Get main participant (remote user) and local participant for Google Meet layout
  const { mainParticipant, localParticipant } = useMemo(() => {
    const local = displayParticipants.find(p => p.isLocalUser);
    const remote = displayParticipants.find(p => !p.isLocalUser);

    // If there's a remote participant, they are the main focus
    // Otherwise, local user is the main (solo mode)
    return {
      mainParticipant: remote || local || displayParticipants[0],
      localParticipant: remote ? local : null, // Only show PIP if there's someone else
    };
  }, [displayParticipants]);

  if (meetingLoading) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-500 animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Caricamento meeting...</p>
        </div>
      </div>
    );
  }

  if (meetingError) {
    return (
      <div className="w-full h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">Errore: {meetingError}</p>
          <button
            onClick={onEndCall}
            className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
          >
            Torna indietro
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden flex flex-col">
      <header className="flex-shrink-0 px-3 py-2 sm:px-4 sm:py-3 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800/50 z-10">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
              <span className="text-white font-medium text-sm sm:text-base hidden sm:inline">In diretta</span>
            </div>
            <span className="text-gray-400 text-xs sm:text-sm truncate max-w-[120px] sm:max-w-[200px]">
              {meeting?.prospectName || `ID: ${meetingId}`}
            </span>
            {isConnected && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full hidden sm:flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                AI Copilot
              </span>
            )}
            {isConnecting && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span className="hidden sm:inline">Connessione...</span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-1 sm:px-3 bg-gray-800/80 rounded-full text-gray-300 text-xs sm:text-sm">
              {displayParticipants.length} {displayParticipants.length === 1 ? 'utente' : 'utenti'}
            </span>
            {seller?.name && (
              <span className="px-2 py-1 sm:px-3 bg-purple-800/50 rounded-full text-purple-300 text-xs sm:text-sm hidden md:block truncate max-w-[150px]">
                {seller.name}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-hidden relative">
        {/* Main participant (full screen Google Meet style) */}
        <AnimatePresence mode="wait">
          {mainParticipant && (
            <ParticipantVideo
              key={mainParticipant.id}
              participantName={mainParticipant.name}
              sentiment={mainParticipant.sentiment}
              isHost={mainParticipant.isHost}
              isMuted={mainParticipant.isMuted}
              isVideoOff={mainParticipant.isVideoOff}
              isLocalUser={mainParticipant.isLocalUser}
              localStream={mainParticipant.isLocalUser ? localStream : null}
              remoteStream={!mainParticipant.isLocalUser ? remoteStreams.get(mainParticipant.id) : null}
              variant="main"
              isSpeaking={mainParticipant.isLocalUser ? isSpeaking : (participantSpeakingStates.get(mainParticipant.id) || false)}
              audioLevel={mainParticipant.isLocalUser ? audioLevel : 0}
            />
          )}
        </AnimatePresence>

        {/* Local user PIP (picture-in-picture) when there are other participants */}
        <AnimatePresence>
          {localParticipant && (
            <ParticipantVideo
              key={`pip-${localParticipant.id}`}
              participantName={localParticipant.name}
              sentiment={localParticipant.sentiment}
              isHost={localParticipant.isHost}
              isMuted={localParticipant.isMuted}
              isVideoOff={localParticipant.isVideoOff}
              isLocalUser={true}
              localStream={localStream}
              remoteStream={null}
              variant="pip"
              isSpeaking={isSpeaking}
              audioLevel={audioLevel}
            />
          )}
        </AnimatePresence>
      </main>

      <VideoControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        showHUD={showHUD}
        isHost={isHost}
        onToggleMute={handleToggleMute}
        onToggleVideo={handleToggleVideo}
        onToggleScreenShare={() => setIsScreenSharing(!isScreenSharing)}
        onToggleHUD={() => setShowHUD(!showHUD)}
        onEndCall={handleEndCall}
      />


      <AnimatePresence>
        {isHost && showHUD && (
          <AICopilotHUD
            scriptItems={displayScriptItems}
            onToggleItem={toggleScriptItem}
            currentSuggestion={displaySuggestion}
            battleCard={battleCard}
            onPresentBattleCard={dismissBattleCard}
            onClose={() => setShowHUD(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isHost && showCoachingPanel && (
          <CoachingPanel
            coaching={{
              isActive: isCoachingActive,
              scriptProgress: coachingScriptProgress,
              buySignals,
              objections,
              checkpointStatus,
              prospectProfile,
              currentFeedback,
              feedbackHistory,
              toneWarnings,
            }}
            transcript={transcripts}
            myParticipantId={myParticipantId}
            onDismissFeedback={dismissFeedback}
            onDismissBuySignal={dismissBuySignal}
            onDismissObjection={dismissObjection}
            onClose={() => setShowCoachingPanel(false)}
          />
        )}
      </AnimatePresence>

      {copilotError && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-900/90 text-red-200 px-4 py-2 rounded-lg text-sm">
            Copilot: {copilotError}
          </div>
        </div>
      )}

      {/* Pulsante Debug Audio */}
      <button
        onClick={() => setShowDebugPanel(!showDebugPanel)}
        className="fixed bottom-4 left-4 z-50 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-white text-xs rounded-lg border border-gray-600"
      >
        🔊 Debug Audio
      </button>

      {/* Pannello Debug Audio */}
      {showDebugPanel && (
        <div className="fixed bottom-16 left-4 z-50 w-80 bg-gray-900/95 border border-gray-700 rounded-lg p-4 text-xs font-mono">
          <h3 className="text-white font-bold mb-3 text-sm">🔊 Audio Diagnostics</h3>

          <div className="space-y-2">
            <div className={`p-2 rounded ${audioDiagnostics.localAudioTrackExists ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <span className="text-gray-300">Mic locale: </span>
              <span className={audioDiagnostics.localAudioTrackExists ? 'text-green-400' : 'text-red-400'}>
                {audioDiagnostics.localAudioTrackExists ? '✅ RILEVATO' : '❌ NON TROVATO'}
              </span>
            </div>

            <div className={`p-2 rounded ${audioDiagnostics.localAudioEnabled ? 'bg-green-900/50' : 'bg-yellow-900/50'}`}>
              <span className="text-gray-300">Mic attivo: </span>
              <span className={audioDiagnostics.localAudioEnabled ? 'text-green-400' : 'text-yellow-400'}>
                {audioDiagnostics.localAudioEnabled ? '✅ ATTIVO' : '🔇 MUTO'}
              </span>
            </div>

            <div className={`p-2 rounded ${audioDiagnostics.remoteAudioTracks > 0 ? 'bg-green-900/50' : 'bg-red-900/50'}`}>
              <span className="text-gray-300">Audio remoti ricevuti: </span>
              <span className={audioDiagnostics.remoteAudioTracks > 0 ? 'text-green-400' : 'text-red-400'}>
                {audioDiagnostics.remoteAudioTracks}
              </span>
            </div>

            <div className="p-2 rounded bg-gray-800">
              <span className="text-gray-300">Ultimo evento: </span>
              <span className="text-blue-400 block mt-1">{audioDiagnostics.lastAudioEvent}</span>
            </div>

            <div className="p-2 rounded bg-gray-800">
              <span className="text-gray-300">Connessioni ICE:</span>
              {audioDiagnostics.iceConnectionStates.size > 0 ? (
                <div className="mt-1 space-y-1">
                  {Array.from(audioDiagnostics.iceConnectionStates.entries()).map(([id, state]) => (
                    <div key={id} className="flex justify-between">
                      <span className="text-gray-500 truncate max-w-[100px]">{id.slice(0, 8)}...</span>
                      <span className={
                        state === 'connected' ? 'text-green-400' :
                        state === 'checking' ? 'text-yellow-400' :
                        state === 'failed' ? 'text-red-400' : 'text-gray-400'
                      }>
                        {state}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <span className="text-gray-500 block mt-1">Nessuna connessione</span>
              )}
            </div>

            <div className="p-2 rounded bg-gray-800">
              <span className="text-gray-300">Remote streams: </span>
              <span className="text-purple-400">{remoteStreams.size}</span>
            </div>
          </div>

          <p className="text-gray-500 mt-3 text-[10px]">Apri console (F12) per log dettagliati</p>
        </div>
      )}
    </div>
  );
}
