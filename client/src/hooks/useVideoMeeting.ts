import { useState, useEffect, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';

interface Seller {
  id: string;
  name: string;
  email?: string;
  defaultScriptId?: string;
}

interface Meeting {
  id: string;
  sellerId: string;
  meetingToken: string;
  prospectName: string;
  prospectEmail?: string;
  playbookId?: string;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
}

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'prospect';
  joinedAt?: string;
  leftAt?: string;
}

interface ScriptPhase {
  id: string;
  number: string;
  name: string;
  description?: string;
  semanticType?: string;
  steps?: Array<{
    id: string;
    number: number;
    text: string;
    completed?: boolean;
  }>;
}

interface ScriptObjection {
  trigger: string;
  response: string;
  category: string;
}

interface Script {
  id: string;
  name: string;
  scriptType: string;
  version: string;
  content?: string;
  structure?: {
    version?: string;
    phases?: ScriptPhase[];
  };
}

interface UseVideoMeetingResult {
  meeting: Meeting | null;
  seller: Seller | null;
  script: Script | null;
  participants: Participant[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  addParticipant: (participant: Omit<Participant, 'joinedAt'>) => void;
  removeParticipant: (participantId: string) => void;
  updateMeetingStatus: (status: Meeting['status']) => Promise<void>;
}

async function fetchMeetingData(meetingIdOrToken: string): Promise<{
  meeting: Meeting;
  seller: Seller;
  script: Script | null;
  participants: Participant[];
}> {
  const authToken = localStorage.getItem('token');
  if (!authToken) {
    throw new Error('Non autenticato');
  }

  let meetingDetailsResponse = await fetch(`/api/human-sellers/meetings/${meetingIdOrToken}`, {
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!meetingDetailsResponse.ok) {
    const meetingsResponse = await fetch('/api/human-sellers/meetings', {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!meetingsResponse.ok) {
      throw new Error('Errore nel caricamento dei meeting');
    }

    const meetings = await meetingsResponse.json();
    const foundMeeting = meetings.find((m: any) => m.meetingToken === meetingIdOrToken);

    if (!foundMeeting) {
      throw new Error('Meeting non trovato');
    }

    meetingDetailsResponse = await fetch(`/api/human-sellers/meetings/${foundMeeting.id}`, {
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!meetingDetailsResponse.ok) {
      throw new Error('Errore nel caricamento dei dettagli del meeting');
    }
  }

  const details = await meetingDetailsResponse.json();
  
  let script: Script | null = null;
  const scriptId = details.meeting?.playbookId || details.seller?.defaultScriptId;
  
  if (scriptId) {
    try {
      const scriptResponse = await fetch(`/api/sales-scripts/${scriptId}`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (scriptResponse.ok) {
        script = await scriptResponse.json();
      }
    } catch (e) {
      console.warn('Script non trovato:', scriptId);
    }
  }

  // Use participants from database if available
  const dbParticipants: Participant[] = (details.participants || []).map((p: any) => ({
    id: p.id,
    name: p.name,
    role: p.role as 'host' | 'guest' | 'prospect',
    joinedAt: p.joinedAt,
    leftAt: p.leftAt,
  }));

  // Filter out participants who have left
  const activeParticipants = dbParticipants.filter(p => !p.leftAt);

  return {
    meeting: details.meeting,
    seller: details.seller,
    script,
    participants: activeParticipants,
  };
}

export function useVideoMeeting(meetingToken: string | null): UseVideoMeetingResult {
  const queryClient = useQueryClient();
  const [localParticipants, setLocalParticipants] = useState<Participant[]>([]);

  const {
    data,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ['videoMeeting', meetingToken],
    queryFn: () => fetchMeetingData(meetingToken!),
    enabled: !!meetingToken,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (data?.participants) {
      setLocalParticipants(data.participants);
    }
  }, [data?.participants]);

  const addParticipant = useCallback((participant: Omit<Participant, 'joinedAt'>) => {
    setLocalParticipants(prev => {
      if (prev.find(p => p.id === participant.id)) {
        return prev;
      }
      return [...prev, { ...participant, joinedAt: new Date().toISOString() }];
    });
  }, []);

  const removeParticipant = useCallback((participantId: string) => {
    setLocalParticipants(prev => 
      prev.map(p => 
        p.id === participantId 
          ? { ...p, leftAt: new Date().toISOString() }
          : p
      )
    );
  }, []);

  const updateMeetingStatus = useCallback(async (status: Meeting['status']) => {
    if (!data?.meeting?.id) return;

    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      await fetch(`/api/human-sellers/meetings/${data.meeting.id}/status`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      });

      queryClient.invalidateQueries({ queryKey: ['videoMeeting', meetingToken] });
    } catch (e) {
      console.error('Errore aggiornamento status:', e);
    }
  }, [data?.meeting?.id, meetingToken, queryClient]);

  return {
    meeting: data?.meeting || null,
    seller: data?.seller || null,
    script: data?.script || null,
    participants: localParticipants,
    isLoading,
    error: error ? (error as Error).message : null,
    refetch,
    addParticipant,
    removeParticipant,
    updateMeetingStatus,
  };
}
