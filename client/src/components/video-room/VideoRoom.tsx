import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantVideo, { SentimentType } from './ParticipantVideo';
import VideoControls from './VideoControls';
import AICopilotHUD from './AICopilotHUD';
import { useVideoMeeting } from '@/hooks/useVideoMeeting';
import { useVideoCopilot } from '@/hooks/useVideoCopilot';
import { useWebRTC } from '@/hooks/useWebRTC';
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
    participants: copilotParticipants,
    myParticipantId,
    toggleScriptItem,
    dismissBattleCard,
    updateParticipants,
    joinParticipant,
    leaveParticipant,
    endSession,
    sendWebRTCMessage,
    setWebRTCMessageHandler,
  } = useVideoCopilot(meeting?.meetingToken ?? null);

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
  } = useWebRTC({
    myParticipantId,
    participants: activeParticipantsForWebRTC,
    isConnected,
    sendWebRTCMessage,
  });

  // Track if we've joined this session (to avoid duplicate joins)
  const [hasJoined, setHasJoined] = useState(false);
  const myParticipantIdRef = useRef<string | null>(null);

  useEffect(() => {
    setWebRTCMessageHandler(handleWebRTCMessage);
  }, [setWebRTCMessageHandler, handleWebRTCMessage]);

  useEffect(() => {
    if (isConnected && !isLocalStreamReady) {
      startLocalStream(!isVideoOff, !isMuted).catch(err => {
        console.error('Failed to start local stream:', err);
      });
    }
  }, [isConnected, isLocalStreamReady, isVideoOff, isMuted, startLocalStream]);

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
        id: 'host',
        name: participantName,
        sentiment: 'neutral' as SentimentType,
        isHost: true,
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
  }, [meetingParticipants, copilotParticipants, isConnected, participantSentiments, participantName, isMuted, isVideoOff, myParticipantId]);

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
    if (meeting) {
      await updateMeetingStatus('completed');
    }
    endSession();
    onEndCall();
  };

  const gridStyles = useMemo(() => {
    const count = displayParticipants.length;
    if (count === 1) {
      return 'grid-cols-1 max-w-3xl';
    }
    if (count === 2) {
      return 'grid-cols-1 sm:grid-cols-2 max-w-5xl';
    }
    if (count <= 4) {
      return 'grid-cols-1 sm:grid-cols-2 max-w-5xl';
    }
    if (count <= 6) {
      return 'grid-cols-2 lg:grid-cols-3 max-w-6xl';
    }
    if (count <= 9) {
      return 'grid-cols-2 md:grid-cols-3 max-w-6xl';
    }
    return 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-w-7xl';
  }, [displayParticipants.length]);

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

      <main className="flex-1 overflow-hidden px-2 py-3 sm:px-4 sm:py-4 md:px-6 lg:px-8">
        <div className={`grid ${gridStyles} gap-2 sm:gap-3 md:gap-4 h-full mx-auto place-content-center auto-rows-fr`}>
          <AnimatePresence mode="popLayout">
            {displayParticipants.map((participant) => (
              <ParticipantVideo
                key={participant.id}
                participantName={participant.name}
                sentiment={participant.sentiment}
                isHost={participant.isHost}
                isMuted={participant.isMuted}
                isVideoOff={participant.isVideoOff}
                isLocalUser={participant.isLocalUser}
                remoteStream={!participant.isLocalUser ? remoteStreams.get(participant.id) : null}
              />
            ))}
          </AnimatePresence>
        </div>
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

      {copilotError && (
        <div className="absolute bottom-28 left-1/2 transform -translate-x-1/2 z-20">
          <div className="bg-red-900/90 text-red-200 px-4 py-2 rounded-lg text-sm">
            Copilot: {copilotError}
          </div>
        </div>
      )}
    </div>
  );
}
