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
  participantId?: string;
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
        const guestName = sessionStorage.getItem(`meet_guest_${token}`);
        const participantDataStr = sessionStorage.getItem(`meet_participant_${token}`);
        
        if (!guestName || !participantDataStr) {
          setLocation(`/meet/${token}`);
          return;
        }

        const participantData = JSON.parse(participantDataStr);

        const res = await fetch(`/api/meet/${token}`);
        if (!res.ok) {
          throw new Error('Meeting non trovato');
        }

        const meetingData = await res.json();

        const realMeetingInfo: MeetingInfo = {
          id: participantData.meetingId,
          token: token || '',
          sellerName: meetingData.seller?.displayName || 'Host',
          prospectName: guestName,
          scriptName: undefined,
          isHost: participantData.role === 'host',
          participantId: participantData.participantId,
        };

        setMeetingInfo(realMeetingInfo);
      } catch (err: any) {
        console.error('[MeetVideoRoom] Load error:', err);
        setError(err.message || 'Impossibile caricare le informazioni del meeting');
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
