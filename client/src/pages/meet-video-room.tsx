import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'wouter';
import { VideoRoom } from '@/components/video-room';
import { useToast } from '@/hooks/use-toast';

interface MeetingInfo {
  id: string;
  token: string;
  sellerName: string;
  prospectName: string;
  scriptName?: string;
  isHost: boolean;
}

export default function MeetVideoRoom() {
  const { token } = useParams<{ token: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [meetingInfo, setMeetingInfo] = useState<MeetingInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMeetingInfo = async () => {
      setIsLoading(true);
      
      try {
        await new Promise(resolve => setTimeout(resolve, 500));
        
        const guestName = sessionStorage.getItem(`meet_guest_${token}`);
        
        if (!guestName) {
          setLocation(`/meet/${token}`);
          return;
        }

        const mockMeetingInfo: MeetingInfo = {
          id: 'meeting-' + token,
          token: token || '',
          sellerName: 'Marco Rossi',
          prospectName: guestName,
          scriptName: 'Discovery Call B2B',
          isHost: guestName.toLowerCase().includes('host') || guestName.toLowerCase().includes('seller'),
        };

        setMeetingInfo(mockMeetingInfo);
      } catch (err) {
        setError('Impossibile caricare le informazioni del meeting');
      } finally {
        setIsLoading(false);
      }
    };

    loadMeetingInfo();
  }, [token, setLocation]);

  const handleEndCall = () => {
    toast({
      title: '📞 Chiamata terminata',
      description: 'La video call è stata terminata',
    });
    
    sessionStorage.removeItem(`meet_guest_${token}`);
    
    setLocation('/');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Connessione al meeting in corso...</p>
        </div>
      </div>
    );
  }

  if (error || !meetingInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900/20 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-2xl">❌</span>
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Errore</h1>
          <p className="text-gray-400">{error || 'Meeting non trovato'}</p>
        </div>
      </div>
    );
  }

  return (
    <VideoRoom
      meetingId={meetingInfo.id}
      isHost={meetingInfo.isHost}
      participantName={meetingInfo.prospectName}
      onEndCall={handleEndCall}
    />
  );
}
