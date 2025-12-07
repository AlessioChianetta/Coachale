import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantVideo, { SentimentType } from './ParticipantVideo';
import VideoControls from './VideoControls';
import AICopilotHUD from './AICopilotHUD';
import { useVideoMeeting } from '@/hooks/useVideoMeeting';
import { useVideoCopilot } from '@/hooks/useVideoCopilot';
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
  } = useVideoCopilot(meeting?.meetingToken ?? null);

  // Track if we've joined this session (to avoid duplicate joins)
  const [hasJoined, setHasJoined] = useState(false);
  const myParticipantIdRef = useRef<string | null>(null);

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

  const handleEndCall = async () => {
    if (meeting) {
      await updateMeetingStatus('completed');
    }
    endSession();
    onEndCall();
  };

  const gridClass = useMemo(() => {
    const count = displayParticipants.length;
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-3';
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
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-medium">In diretta</span>
            <span className="text-gray-400 text-sm">
              {meeting?.prospectName || `ID: ${meetingId}`}
            </span>
            {isConnected && (
              <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                AI Copilot attivo
              </span>
            )}
            {isConnecting && (
              <span className="px-2 py-0.5 bg-yellow-500/20 text-yellow-400 text-xs rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" />
                Connessione...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-gray-800 rounded-full text-gray-300 text-sm">
              {displayParticipants.length} partecipanti
            </span>
            {seller?.name && (
              <span className="px-3 py-1 bg-purple-800/50 rounded-full text-purple-300 text-sm">
                {seller.name}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pt-16 pb-24 px-4 md:px-8">
        <div className={`grid ${gridClass} gap-4 h-full max-w-6xl mx-auto place-content-center`}>
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
              />
            ))}
          </AnimatePresence>
        </div>
      </div>

      <VideoControls
        isMuted={isMuted}
        isVideoOff={isVideoOff}
        isScreenSharing={isScreenSharing}
        showHUD={showHUD}
        isHost={isHost}
        onToggleMute={() => setIsMuted(!isMuted)}
        onToggleVideo={() => setIsVideoOff(!isVideoOff)}
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
