import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import ParticipantVideo, { SentimentType } from './ParticipantVideo';
import VideoControls from './VideoControls';
import AICopilotHUD from './AICopilotHUD';

export interface VideoRoomProps {
  meetingId: string;
  isHost: boolean;
  participantName: string;
  onEndCall: () => void;
}

interface Participant {
  id: string;
  name: string;
  sentiment: SentimentType;
  isHost: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
}

const mockScript = [
  { id: '1', text: 'Presentazione iniziale', completed: true },
  { id: '2', text: 'Scopri il problema principale', completed: true },
  { id: '3', text: 'Identifica pain points', completed: false },
  { id: '4', text: 'Presenta la soluzione', completed: false },
  { id: '5', text: 'Gestisci obiezioni', completed: false },
  { id: '6', text: 'Call to action finale', completed: false },
];

const mockSuggestions = [
  "Prova a chiedere: 'Qual è la sfida più grande che stai affrontando in questo momento?'",
  "Il prospect sembra interessato. È il momento giusto per parlare dei benefici principali.",
  "Fai una domanda aperta per approfondire le sue esigenze specifiche.",
  "Ottimo engagement! Considera di proporre una demo personalizzata.",
];

const mockBattleCards = [
  {
    objection: "È troppo costoso per noi in questo momento",
    response: "Capisco la preoccupazione sul budget. Molti dei nostri clienti inizialmente pensavano lo stesso, ma hanno scoperto che il ROI si manifesta già nei primi 3 mesi. Posso mostrarti alcuni casi studio?"
  },
  {
    objection: "Stiamo già usando un'altra soluzione",
    response: "È fantastico che abbiate già investito in questo ambito. La nostra soluzione si integra perfettamente con i tool esistenti e molti clienti l'hanno affiancata inizialmente per poi migrare gradualmente."
  },
];

function getRandomSentiment(): SentimentType {
  const sentiments: SentimentType[] = ['positive', 'neutral', 'negative'];
  return sentiments[Math.floor(Math.random() * sentiments.length)];
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
  const [scriptItems, setScriptItems] = useState(mockScript);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const [battleCard, setBattleCard] = useState<{ objection: string; response: string } | null>(null);

  const [participants, setParticipants] = useState<Participant[]>([
    {
      id: 'host',
      name: participantName,
      sentiment: 'positive',
      isHost: true,
      isMuted: false,
      isVideoOff: false,
    },
    {
      id: 'prospect-1',
      name: 'Marco Rossi',
      sentiment: getRandomSentiment(),
      isHost: false,
      isMuted: false,
      isVideoOff: false,
    },
    {
      id: 'prospect-2',
      name: 'Laura Bianchi',
      sentiment: getRandomSentiment(),
      isHost: false,
      isMuted: true,
      isVideoOff: false,
    },
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      setParticipants((prev) =>
        prev.map((p) => ({
          ...p,
          sentiment: p.isHost ? p.sentiment : getRandomSentiment(),
        }))
      );
    }, 8000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentSuggestionIndex((prev) => (prev + 1) % mockSuggestions.length);
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const showBattleCard = () => {
      if (Math.random() > 0.7 && !battleCard) {
        const randomCard = mockBattleCards[Math.floor(Math.random() * mockBattleCards.length)];
        setBattleCard(randomCard);
      }
    };

    const interval = setInterval(showBattleCard, 20000);
    const initialTimeout = setTimeout(showBattleCard, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(initialTimeout);
    };
  }, [battleCard]);

  const handleToggleScriptItem = (id: string) => {
    setScriptItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, completed: !item.completed } : item
      )
    );
  };

  const handlePresentBattleCard = () => {
    setBattleCard(null);
  };

  const gridClass = useMemo(() => {
    const count = participants.length;
    if (count <= 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 md:grid-cols-2';
    if (count <= 4) return 'grid-cols-2';
    if (count <= 6) return 'grid-cols-2 md:grid-cols-3';
    return 'grid-cols-3';
  }, [participants.length]);

  return (
    <div className="relative w-full h-screen bg-gray-950 overflow-hidden">
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-white font-medium">In diretta</span>
            <span className="text-gray-400 text-sm">ID: {meetingId}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-gray-800 rounded-full text-gray-300 text-sm">
              {participants.length} partecipanti
            </span>
          </div>
        </div>
      </div>

      <div className="absolute inset-0 pt-16 pb-24 px-4 md:px-8">
        <div className={`grid ${gridClass} gap-4 h-full max-w-6xl mx-auto place-content-center`}>
          <AnimatePresence mode="popLayout">
            {participants.map((participant) => (
              <ParticipantVideo
                key={participant.id}
                participantName={participant.name}
                sentiment={participant.sentiment}
                isHost={participant.isHost}
                isMuted={participant.id === 'host' ? isMuted : participant.isMuted}
                isVideoOff={participant.id === 'host' ? isVideoOff : participant.isVideoOff}
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
        onEndCall={onEndCall}
      />

      <AnimatePresence>
        {isHost && showHUD && (
          <AICopilotHUD
            scriptItems={scriptItems}
            onToggleItem={handleToggleScriptItem}
            currentSuggestion={mockSuggestions[currentSuggestionIndex]}
            battleCard={battleCard}
            onPresentBattleCard={handlePresentBattleCard}
            onClose={() => setShowHUD(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
