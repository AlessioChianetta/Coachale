import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { videoMeetings, videoMeetingTranscripts, videoMeetingParticipants, humanSellers, salesScripts } from '@shared/schema';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { getAIProvider } from '../ai/provider-factory';
import { convertWebMToPCM, base64ToBuffer, bufferToBase64 } from '../ai/audio-converter';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'prospect';
  isSpeaking?: boolean;
}

interface Playbook {
  id: string;
  name: string;
  phases: Array<{
    name: string;
    objectives: string[];
    keyPoints: string[];
    questions: string[];
  }>;
  objections: Array<{
    trigger: string;
    response: string;
    category: string;
  }>;
}

interface SessionState {
  meetingId: string;
  clientId: string;
  consultantId: string | null;
  sellerId: string | null;
  participants: Map<string, Participant>;
  playbook: Playbook | null;
  currentPhaseIndex: number;
  transcriptBuffer: Array<{
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  lastAnalysisTime: number;
  totalTranscriptText: string;
}

interface IncomingMessage {
  type: 'audio_chunk' | 'set_playbook' | 'participant_update' | 'participant_join' | 'participant_leave' | 'end_session' | 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate';
  data?: string;
  speakerId?: string;
  speakerName?: string;
  playbook?: Playbook;
  playbookId?: string;
  participants?: Participant[];
  participant?: {
    id?: string;
    name: string;
    role: 'host' | 'guest' | 'prospect';
  };
  participantId?: string;
  targetParticipantId?: string;
  fromParticipantId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
}

interface RTCSessionDescriptionInit {
  type: 'offer' | 'answer';
  sdp: string;
}

interface RTCIceCandidateInit {
  candidate: string;
  sdpMid?: string | null;
  sdpMLineIndex?: number | null;
  usernameFragment?: string | null;
}

interface OutgoingMessage {
  type: 'transcript' | 'sentiment' | 'suggestion' | 'battle_card' | 'script_progress' | 'error' | 'connected' | 'session_ended' | 'participant_joined' | 'participant_left' | 'participants_list' | 'join_confirmed' | 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate' | 'participant_socket_ready';
  data: any;
  timestamp: number;
}

const activeSessions = new Map<string, SessionState>();
const meetingClients = new Map<string, Set<WebSocket>>();
const participantSockets = new Map<string, Map<string, WebSocket>>();
const socketToParticipants = new Map<WebSocket, Set<{ meetingId: string; participantId: string }>>();
const ANALYSIS_THROTTLE_MS = 3000;

// Buffer per messaggi WebRTC quando il target non è ancora connesso
interface PendingWebRTCMessage {
  type: 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate';
  data: any;
  timestamp: number;
}
const pendingWebRTCMessages = new Map<string, PendingWebRTCMessage[]>();
const MESSAGE_BUFFER_TIMEOUT_MS = 30000; // 30 secondi

async function authenticateConnection(req: any): Promise<{
  meetingId: string;
  clientId: string;
  consultantId: string | null;
  sellerId: string | null;
  playbookId: string | null;
  isGuest: boolean;
} | null> {
  try {
    const url = new URL(req.url || '', `http://${req.headers.host}`);
    const token = url.searchParams.get('token');
    const meetingToken = url.searchParams.get('meetingToken');

    if (!meetingToken) {
      console.error('❌ [VideoCopilot] Missing meetingToken');
      return null;
    }

    const [meeting] = await db
      .select()
      .from(videoMeetings)
      .where(eq(videoMeetings.meetingToken, meetingToken))
      .limit(1);

    if (!meeting) {
      console.error(`❌ [VideoCopilot] Meeting not found: ${meetingToken}`);
      return null;
    }

    if (meeting.status === 'cancelled' || meeting.status === 'completed') {
      console.error(`❌ [VideoCopilot] Meeting not accessible: ${meeting.status}`);
      return null;
    }

    let clientId: string = 'guest';
    let isGuest = true;

    if (token && token !== 'null') {
      try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        if (decoded.userId) {
          clientId = decoded.userId;
          isGuest = false;
        }
      } catch (jwtError) {
        console.warn('⚠️ [VideoCopilot] Invalid JWT, connecting as guest');
      }
    }

    let consultantId: string | null = null;
    if (meeting.sellerId) {
      const [seller] = await db
        .select()
        .from(humanSellers)
        .where(eq(humanSellers.id, meeting.sellerId))
        .limit(1);
      
      if (seller?.clientId) {
        consultantId = seller.clientId;
      }
    }

    let playbookId = meeting.playbookId || null;
    
    if (!playbookId && consultantId) {
      const [activeScript] = await db
        .select({ id: salesScripts.id })
        .from(salesScripts)
        .where(and(
          eq(salesScripts.clientId, consultantId),
          eq(salesScripts.scriptType, 'discovery'),
          eq(salesScripts.isActive, true)
        ))
        .limit(1);
      
      if (activeScript) {
        playbookId = activeScript.id;
        console.log(`📘 [VideoCopilot] Using active discovery script as fallback: ${playbookId}`);
      }
    }

    console.log(`✅ [VideoCopilot] Connection authenticated - Meeting: ${meeting.id}, Guest: ${isGuest}`);

    return {
      meetingId: meeting.id,
      clientId,
      consultantId,
      sellerId: meeting.sellerId,
      playbookId,
      isGuest,
    };
  } catch (error: any) {
    console.error('❌ [VideoCopilot] Auth error:', error.message);
    return null;
  }
}

function sendMessage(ws: WebSocket, message: OutgoingMessage) {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(message));
  }
}

async function transcribeAudio(
  session: SessionState,
  audioBase64: string,
  speakerId: string,
  speakerName: string
): Promise<string | null> {
  try {
    const audioBuffer = base64ToBuffer(audioBase64);
    let pcmBuffer: Buffer;
    
    try {
      pcmBuffer = await convertWebMToPCM(audioBuffer);
    } catch (conversionError) {
      pcmBuffer = audioBuffer;
    }

    const aiProvider = await getAIProvider(
      session.clientId,
      session.consultantId || undefined
    );

    const prompt = `Transcribe the following audio to Italian text. Return ONLY the transcribed text, nothing else. If you cannot understand the audio or it's silent, return an empty string.

Context: This is from a sales video call. The speaker is ${speakerName}.`;

    const audioForAI = bufferToBase64(pcmBuffer);

    const response = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            { text: `[Audio data: ${audioForAI.substring(0, 100)}... (${audioForAI.length} chars)]` }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 500,
      }
    });

    const transcript = response.response.text().trim();
    
    if (transcript && transcript.length > 0) {
      await db.insert(videoMeetingTranscripts).values({
        meetingId: session.meetingId,
        speakerId,
        speakerName,
        text: transcript,
        timestampMs: Date.now(),
        sentiment: 'neutral',
      });
    }

    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

    return transcript || null;
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Transcription error:`, error.message);
    return null;
  }
}

async function analyzeSentiment(
  session: SessionState,
  text: string,
  speakerId: string
): Promise<'positive' | 'neutral' | 'negative'> {
  try {
    const aiProvider = await getAIProvider(
      session.clientId,
      session.consultantId || undefined
    );

    const response = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: `Analyze the sentiment of this sales conversation text and respond with ONLY one word: "positive", "neutral", or "negative".

Text: "${text}"

Consider:
- Positive: enthusiasm, agreement, interest, excitement
- Negative: skepticism, objections, frustration, disinterest
- Neutral: factual statements, questions, acknowledgments

Response (one word only):`
            }
          ]
        }
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 10,
      }
    });

    const result = response.response.text().toLowerCase().trim();
    
    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

    if (result.includes('positive')) return 'positive';
    if (result.includes('negative')) return 'negative';
    return 'neutral';
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Sentiment analysis error:`, error.message);
    return 'neutral';
  }
}

async function generateSuggestion(
  session: SessionState,
  recentTranscript: string
): Promise<string | null> {
  if (!session.playbook) return null;

  try {
    const currentPhase = session.playbook.phases[session.currentPhaseIndex];
    
    const aiProvider = await getAIProvider(
      session.clientId,
      session.consultantId || undefined
    );

    const prompt = `You are an AI sales copilot helping a salesperson during a live video call.

CURRENT PLAYBOOK PHASE: ${currentPhase?.name || 'General'}
PHASE OBJECTIVES: ${currentPhase?.objectives?.join(', ') || 'Build rapport'}
KEY POINTS TO COVER: ${currentPhase?.keyPoints?.join(', ') || 'N/A'}
SUGGESTED QUESTIONS: ${currentPhase?.questions?.join(', ') || 'N/A'}

RECENT CONVERSATION:
${recentTranscript}

Based on the conversation, provide ONE brief, actionable suggestion for the salesperson.
Keep it under 50 words. Be specific and practical.
Format: Just the suggestion text, no prefixes.`;

    const response = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });

    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

    return response.response.text().trim();
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Suggestion generation error:`, error.message);
    return null;
  }
}

async function detectObjectionAndGenerateBattleCard(
  session: SessionState,
  text: string
): Promise<{ detected: boolean; objection?: string; response?: string; category?: string } | null> {
  if (!session.playbook?.objections?.length) return null;

  try {
    const objectionsList = session.playbook.objections
      .map((o, i) => `${i + 1}. Trigger: "${o.trigger}" | Category: ${o.category}`)
      .join('\n');

    const aiProvider = await getAIProvider(
      session.clientId,
      session.consultantId || undefined
    );

    const prompt = `Analyze if the following prospect statement contains an objection from our list.

PROSPECT STATEMENT: "${text}"

KNOWN OBJECTIONS:
${objectionsList}

If an objection is detected, respond with JSON:
{"detected": true, "objectionIndex": <number>}

If no objection detected, respond with:
{"detected": false}

Response (JSON only):`;

    const response = await aiProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 50,
      }
    });

    const result = response.response.text().trim();
    
    if (aiProvider.cleanup) {
      await aiProvider.cleanup();
    }

    try {
      const parsed = JSON.parse(result.replace(/```json\n?|\n?```/g, ''));
      if (parsed.detected && typeof parsed.objectionIndex === 'number') {
        const objection = session.playbook.objections[parsed.objectionIndex - 1];
        if (objection) {
          return {
            detected: true,
            objection: objection.trigger,
            response: objection.response,
            category: objection.category,
          };
        }
      }
      return { detected: false };
    } catch {
      return { detected: false };
    }
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Battle card detection error:`, error.message);
    return null;
  }
}

function calculateScriptProgress(session: SessionState): {
  currentPhase: number;
  totalPhases: number;
  phaseName: string;
  completionPercentage: number;
} {
  if (!session.playbook) {
    return {
      currentPhase: 0,
      totalPhases: 0,
      phaseName: 'No playbook loaded',
      completionPercentage: 0,
    };
  }

  const totalPhases = session.playbook.phases.length;
  const currentPhase = session.currentPhaseIndex + 1;
  const phaseName = session.playbook.phases[session.currentPhaseIndex]?.name || 'Unknown';
  const completionPercentage = Math.round((currentPhase / totalPhases) * 100);

  return {
    currentPhase,
    totalPhases,
    phaseName,
    completionPercentage,
  };
}

async function handleAudioChunk(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (!message.data || !message.speakerId) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing audio data or speakerId' },
      timestamp: Date.now(),
    });
    return;
  }

  const speakerName = message.speakerName || 
    session.participants.get(message.speakerId)?.name || 
    'Unknown Speaker';

  const transcript = await transcribeAudio(
    session,
    message.data,
    message.speakerId,
    speakerName
  );

  if (transcript) {
    session.totalTranscriptText += ` ${transcript}`;
    
    sendMessage(ws, {
      type: 'transcript',
      data: {
        speakerId: message.speakerId,
        speakerName,
        text: transcript,
      },
      timestamp: Date.now(),
    });

    const sentiment = await analyzeSentiment(session, transcript, message.speakerId);
    
    session.transcriptBuffer.push({
      speakerId: message.speakerId,
      speakerName,
      text: transcript,
      timestamp: Date.now(),
      sentiment,
    });

    sendMessage(ws, {
      type: 'sentiment',
      data: {
        speakerId: message.speakerId,
        speakerName,
        sentiment,
      },
      timestamp: Date.now(),
    });

    const participant = session.participants.get(message.speakerId);
    if (participant?.role === 'prospect') {
      const battleCard = await detectObjectionAndGenerateBattleCard(session, transcript);
      if (battleCard?.detected) {
        sendMessage(ws, {
          type: 'battle_card',
          data: battleCard,
          timestamp: Date.now(),
        });
      }
    }

    const now = Date.now();
    if (now - session.lastAnalysisTime > ANALYSIS_THROTTLE_MS) {
      session.lastAnalysisTime = now;
      
      const recentTranscripts = session.transcriptBuffer
        .slice(-10)
        .map(t => `${t.speakerName}: ${t.text}`)
        .join('\n');
      
      const suggestion = await generateSuggestion(session, recentTranscripts);
      if (suggestion) {
        sendMessage(ws, {
          type: 'suggestion',
          data: { text: suggestion },
          timestamp: Date.now(),
        });
      }

      sendMessage(ws, {
        type: 'script_progress',
        data: calculateScriptProgress(session),
        timestamp: Date.now(),
      });
    }
  }
}

async function handleSetPlaybook(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (message.playbook) {
    session.playbook = message.playbook;
    session.currentPhaseIndex = 0;
    
    sendMessage(ws, {
      type: 'script_progress',
      data: calculateScriptProgress(session),
      timestamp: Date.now(),
    });
    
    console.log(`📘 [VideoCopilot] Playbook set: ${message.playbook.name}`);
  } else if (message.playbookId) {
    try {
      const [script] = await db
        .select()
        .from(salesScripts)
        .where(eq(salesScripts.id, message.playbookId))
        .limit(1);

      if (script) {
        const content = script.content as any;
        session.playbook = {
          id: script.id,
          name: script.name,
          phases: content?.phases || [],
          objections: content?.objections || [],
        };
        session.currentPhaseIndex = 0;
        
        sendMessage(ws, {
          type: 'script_progress',
          data: calculateScriptProgress(session),
          timestamp: Date.now(),
        });
        
        console.log(`📘 [VideoCopilot] Playbook loaded from DB: ${script.name}`);
      } else {
        sendMessage(ws, {
          type: 'error',
          data: { message: 'Playbook not found' },
          timestamp: Date.now(),
        });
      }
    } catch (error: any) {
      console.error(`❌ [VideoCopilot] Error loading playbook:`, error.message);
      sendMessage(ws, {
        type: 'error',
        data: { message: 'Failed to load playbook' },
        timestamp: Date.now(),
      });
    }
  }
}

function handleParticipantUpdate(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (message.participants) {
    session.participants.clear();
    for (const p of message.participants) {
      session.participants.set(p.id, p);
    }
    console.log(`👥 [VideoCopilot] Participants updated: ${message.participants.length} participants`);
  }
}

async function handleParticipantJoin(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage,
  broadcast: (msg: OutgoingMessage) => void
) {
  if (!message.participant) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing participant data' },
      timestamp: Date.now(),
    });
    return;
  }

  const { name, role } = message.participant;
  
  try {
    // Check if participant with same name AND role already left this meeting (can be recycled)
    // Only reuse participants who have leftAt set (not currently active)
    const [inactiveExisting] = await db.select()
      .from(videoMeetingParticipants)
      .where(and(
        eq(videoMeetingParticipants.meetingId, session.meetingId),
        eq(videoMeetingParticipants.name, name),
        eq(videoMeetingParticipants.role, role),
        isNotNull(videoMeetingParticipants.leftAt) // Only recycle inactive participants
      ))
      .orderBy(desc(videoMeetingParticipants.leftAt)) // Get the most recently left
      .limit(1);
    
    let participantRecord;
    
    if (inactiveExisting) {
      // Clean up any stale socket bound to this participant ID (shouldn't exist but just in case)
      unregisterParticipantSocket(session.meetingId, inactiveExisting.id);
      session.participants.delete(inactiveExisting.id);
      
      // Reuse inactive participant - update joinedAt and clear leftAt
      await db.update(videoMeetingParticipants)
        .set({ joinedAt: new Date(), leftAt: null })
        .where(eq(videoMeetingParticipants.id, inactiveExisting.id));
      participantRecord = { ...inactiveExisting, joinedAt: new Date(), leftAt: null };
      console.log(`🔄 [VideoCopilot] Recycling inactive participant: ${name} (${role}) - ID: ${inactiveExisting.id}`);
    } else {
      // Create new participant
      const [inserted] = await db.insert(videoMeetingParticipants).values({
        meetingId: session.meetingId,
        name,
        role,
        joinedAt: new Date(),
      }).returning();
      participantRecord = inserted;
      console.log(`✅ [VideoCopilot] New participant joined: ${name} (${role}) - ID: ${inserted.id}`);
    }

    const participant: Participant = {
      id: participantRecord.id,
      name: participantRecord.name,
      role: participantRecord.role as 'host' | 'guest' | 'prospect',
    };
    
    session.participants.set(participantRecord.id, participant);
    
    registerParticipantSocket(session.meetingId, participantRecord.id, ws);

    // Send confirmation directly to the requesting client with their ID
    sendMessage(ws, {
      type: 'join_confirmed',
      data: {
        id: participantRecord.id,
        name: participantRecord.name,
        role: participantRecord.role,
        joinedAt: participantRecord.joinedAt?.toISOString(),
      },
      timestamp: Date.now(),
    });

    // Broadcast to all clients (including the requester)
    const outMessage: OutgoingMessage = {
      type: 'participant_joined',
      data: {
        id: participantRecord.id,
        name: participantRecord.name,
        role: participantRecord.role,
        joinedAt: participantRecord.joinedAt?.toISOString(),
      },
      timestamp: Date.now(),
    };
    
    broadcast(outMessage);
    
    // Broadcast participant_socket_ready to notify that this participant's socket is now registered
    const socketReadyMessage: OutgoingMessage = {
      type: 'participant_socket_ready',
      data: {
        participantId: participantRecord.id,
        name: participantRecord.name,
        role: participantRecord.role,
      },
      timestamp: Date.now(),
    };
    broadcast(socketReadyMessage);
    console.log(`📡 [VideoCopilot] Broadcast participant_socket_ready for ${participantRecord.name} (${participantRecord.id})`);
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Error adding participant:`, error.message);
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Failed to add participant' },
      timestamp: Date.now(),
    });
  }
}

async function handleParticipantLeave(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage,
  broadcast: (msg: OutgoingMessage) => void
) {
  if (!message.participantId) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing participantId' },
      timestamp: Date.now(),
    });
    return;
  }

  const participantId = message.participantId;
  
  try {
    await db.update(videoMeetingParticipants)
      .set({ leftAt: new Date() })
      .where(eq(videoMeetingParticipants.id, participantId));

    const participant = session.participants.get(participantId);
    session.participants.delete(participantId);
    
    unregisterParticipantSocket(session.meetingId, participantId);
    
    console.log(`👋 [VideoCopilot] Participant left: ${participant?.name || participantId}`);

    const outMessage: OutgoingMessage = {
      type: 'participant_left',
      data: {
        id: participantId,
        name: participant?.name,
        leftAt: new Date().toISOString(),
      },
      timestamp: Date.now(),
    };
    
    broadcast(outMessage);
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Error removing participant:`, error.message);
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Failed to remove participant' },
      timestamp: Date.now(),
    });
  }
}

async function loadExistingParticipants(session: SessionState): Promise<Participant[]> {
  try {
    const participants = await db
      .select()
      .from(videoMeetingParticipants)
      .where(and(
        eq(videoMeetingParticipants.meetingId, session.meetingId),
        isNull(videoMeetingParticipants.leftAt)
      ));

    const meetingSockets = participantSockets.get(session.meetingId);
    const activeParticipants: Participant[] = [];

    for (const p of participants) {
      // Verifica se ha socket attivo - se no, è uno zombie
      if (meetingSockets?.has(p.id)) {
        session.participants.set(p.id, {
          id: p.id,
          name: p.name,
          role: p.role as 'host' | 'guest' | 'prospect',
        });
        activeParticipants.push({
          id: p.id,
          name: p.name,
          role: p.role as 'host' | 'guest' | 'prospect',
        });
      } else {
        // Pulisce zombie - marca come left
        await db.update(videoMeetingParticipants)
          .set({ leftAt: new Date() })
          .where(eq(videoMeetingParticipants.id, p.id));
        console.log(`🧹 [VideoCopilot] Cleaned zombie participant: ${p.name} (${p.id})`);
      }
    }

    return activeParticipants;
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Error loading participants:`, error.message);
    return [];
  }
}

async function autoLoadPlaybook(
  session: SessionState,
  playbookId: string
): Promise<Playbook | null> {
  try {
    const [script] = await db
      .select()
      .from(salesScripts)
      .where(eq(salesScripts.id, playbookId))
      .limit(1);

    if (!script) {
      console.warn(`⚠️ [VideoCopilot] Script not found for playbookId: ${playbookId}`);
      return null;
    }

    const content = script.content as any;
    
    const playbook: Playbook = {
      id: script.id,
      name: script.name,
      phases: content?.phases?.map((phase: any) => ({
        name: phase.name || phase.title || 'Unnamed Phase',
        objectives: phase.objectives || phase.goals || [],
        keyPoints: phase.keyPoints || phase.key_points || phase.points || [],
        questions: phase.questions || phase.suggestedQuestions || [],
      })) || [],
      objections: content?.objections?.map((obj: any) => ({
        trigger: obj.trigger || obj.objection || obj.text || '',
        response: obj.response || obj.answer || obj.rebuttal || '',
        category: obj.category || obj.type || 'general',
      })) || content?.battlecards?.map((bc: any) => ({
        trigger: bc.trigger || bc.objection || bc.text || '',
        response: bc.response || bc.answer || bc.rebuttal || '',
        category: bc.category || bc.type || 'general',
      })) || [],
    };

    console.log(`📘 [VideoCopilot] Auto-loaded playbook: ${script.name} (${playbook.phases.length} phases, ${playbook.objections.length} objections)`);
    return playbook;
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Error auto-loading playbook:`, error.message);
    return null;
  }
}

function bufferWebRTCMessage(
  meetingId: string,
  targetParticipantId: string,
  type: 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate',
  data: any
) {
  const key = `${meetingId}:${targetParticipantId}`;
  if (!pendingWebRTCMessages.has(key)) {
    pendingWebRTCMessages.set(key, []);
  }
  pendingWebRTCMessages.get(key)!.push({
    type,
    data,
    timestamp: Date.now()
  });
  console.log(`📦 [VideoCopilot] Buffered ${type} for ${targetParticipantId}`);
}

function handleWebRTCOffer(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (!message.targetParticipantId || !message.fromParticipantId || !message.sdp) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing targetParticipantId, fromParticipantId, or sdp for WebRTC offer' },
      timestamp: Date.now(),
    });
    return;
  }

  const meetingSockets = participantSockets.get(session.meetingId);
  const targetSocket = meetingSockets?.get(message.targetParticipantId);
  
  const messageData = {
    fromParticipantId: message.fromParticipantId,
    sdp: message.sdp,
  };

  if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
    sendMessage(targetSocket, {
      type: 'webrtc_offer',
      data: messageData,
      timestamp: Date.now(),
    });
    console.log(`📤 [VideoCopilot] Forwarded WebRTC offer from ${message.fromParticipantId} to ${message.targetParticipantId}`);
  } else {
    // Buffer il messaggio per consegna quando il target si connette
    bufferWebRTCMessage(session.meetingId, message.targetParticipantId, 'webrtc_offer', messageData);
  }
}

function handleWebRTCAnswer(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (!message.targetParticipantId || !message.fromParticipantId || !message.sdp) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing targetParticipantId, fromParticipantId, or sdp for WebRTC answer' },
      timestamp: Date.now(),
    });
    return;
  }

  const meetingSockets = participantSockets.get(session.meetingId);
  const targetSocket = meetingSockets?.get(message.targetParticipantId);
  
  const messageData = {
    fromParticipantId: message.fromParticipantId,
    sdp: message.sdp,
  };

  if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
    sendMessage(targetSocket, {
      type: 'webrtc_answer',
      data: messageData,
      timestamp: Date.now(),
    });
    console.log(`📤 [VideoCopilot] Forwarded WebRTC answer from ${message.fromParticipantId} to ${message.targetParticipantId}`);
  } else {
    // Buffer il messaggio per consegna quando il target si connette
    bufferWebRTCMessage(session.meetingId, message.targetParticipantId, 'webrtc_answer', messageData);
  }
}

function handleICECandidate(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  if (!message.targetParticipantId || !message.fromParticipantId || !message.candidate) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing targetParticipantId, fromParticipantId, or candidate for ICE candidate' },
      timestamp: Date.now(),
    });
    return;
  }

  const meetingSockets = participantSockets.get(session.meetingId);
  const targetSocket = meetingSockets?.get(message.targetParticipantId);
  
  const messageData = {
    fromParticipantId: message.fromParticipantId,
    candidate: message.candidate,
  };

  if (targetSocket && targetSocket.readyState === WebSocket.OPEN) {
    sendMessage(targetSocket, {
      type: 'ice_candidate',
      data: messageData,
      timestamp: Date.now(),
    });
    console.log(`📤 [VideoCopilot] Forwarded ICE candidate from ${message.fromParticipantId} to ${message.targetParticipantId}`);
  } else {
    // Buffer il messaggio per consegna quando il target si connette
    bufferWebRTCMessage(session.meetingId, message.targetParticipantId, 'ice_candidate', messageData);
  }
}

function registerParticipantSocket(meetingId: string, participantId: string, ws: WebSocket) {
  if (!participantSockets.has(meetingId)) {
    participantSockets.set(meetingId, new Map());
  }
  participantSockets.get(meetingId)!.set(participantId, ws);
  
  if (!socketToParticipants.has(ws)) {
    socketToParticipants.set(ws, new Set());
  }
  socketToParticipants.get(ws)!.add({ meetingId, participantId });
  console.log(`🔗 [VideoCopilot] Registered socket for participant ${participantId} in meeting ${meetingId}`);
  
  // Consegna messaggi WebRTC bufferizzati
  const key = `${meetingId}:${participantId}`;
  const pending = pendingWebRTCMessages.get(key);
  if (pending && pending.length > 0) {
    const now = Date.now();
    let deliveredCount = 0;
    for (const msg of pending) {
      // Solo messaggi non scaduti
      if (now - msg.timestamp < MESSAGE_BUFFER_TIMEOUT_MS) {
        sendMessage(ws, { type: msg.type, data: msg.data, timestamp: now });
        deliveredCount++;
      }
    }
    if (deliveredCount > 0) {
      console.log(`📤 [VideoCopilot] Delivered ${deliveredCount} buffered WebRTC messages to ${participantId}`);
    }
    pendingWebRTCMessages.delete(key);
  }
}

function unregisterParticipantSocket(meetingId: string, participantId: string) {
  const meetingSockets = participantSockets.get(meetingId);
  if (meetingSockets) {
    const ws = meetingSockets.get(participantId);
    if (ws) {
      const participantSet = socketToParticipants.get(ws);
      if (participantSet) {
        for (const entry of participantSet) {
          if (entry.meetingId === meetingId && entry.participantId === participantId) {
            participantSet.delete(entry);
            break;
          }
        }
        if (participantSet.size === 0) {
          socketToParticipants.delete(ws);
        }
      }
    }
    meetingSockets.delete(participantId);
    console.log(`🔓 [VideoCopilot] Unregistered socket for participant ${participantId} in meeting ${meetingId}`);
    if (meetingSockets.size === 0) {
      participantSockets.delete(meetingId);
    }
  }
}

async function unregisterParticipantBySocket(ws: WebSocket, broadcast: (msg: OutgoingMessage) => void): Promise<string[]> {
  const participantSet = socketToParticipants.get(ws);
  if (!participantSet || participantSet.size === 0) return [];
  
  const unregisteredIds: string[] = [];
  
  for (const { meetingId, participantId } of participantSet) {
    const meetingSockets = participantSockets.get(meetingId);
    if (meetingSockets) {
      meetingSockets.delete(participantId);
      console.log(`🔓 [VideoCopilot] Auto-unregistered socket for participant ${participantId} on disconnect`);
      if (meetingSockets.size === 0) {
        participantSockets.delete(meetingId);
      }
    }
    
    // Update database with leftAt
    try {
      await db.update(videoMeetingParticipants)
        .set({ leftAt: new Date() })
        .where(eq(videoMeetingParticipants.id, participantId));
      console.log(`📝 [VideoCopilot] Marked participant ${participantId} as left in database`);
    } catch (error: any) {
      console.error(`❌ [VideoCopilot] Failed to update leftAt for ${participantId}:`, error.message);
    }
    
    // Remove from session.participants
    const session = activeSessions.get(meetingId);
    if (session) {
      session.participants.delete(participantId);
      console.log(`🗑️ [VideoCopilot] Removed participant ${participantId} from session`);
    }
    
    broadcast({
      type: 'participant_left',
      data: {
        id: participantId,
        leftAt: new Date().toISOString(),
        reason: 'disconnected',
      },
      timestamp: Date.now(),
    });
    
    unregisteredIds.push(participantId);
  }
  
  socketToParticipants.delete(ws);
  
  return unregisteredIds;
}

async function handleEndSession(
  ws: WebSocket,
  session: SessionState
) {
  console.log(`🔚 [VideoCopilot] Session ending for meeting ${session.meetingId}`);
  
  await db
    .update(videoMeetings)
    .set({
      endedAt: new Date(),
      status: 'completed',
    })
    .where(eq(videoMeetings.id, session.meetingId));

  activeSessions.delete(session.meetingId);
  
  sendMessage(ws, {
    type: 'session_ended',
    data: {
      meetingId: session.meetingId,
      transcriptCount: session.transcriptBuffer.length,
    },
    timestamp: Date.now(),
  });
}

export function setupVideoCopilotWebSocket(): WebSocketServer {
  console.log('🎥 Setting up Video AI Copilot WebSocket server...');
  
  const wss = new WebSocketServer({ noServer: true });

  wss.on('error', (error) => {
    console.error('❌ [VideoCopilot] WebSocket server error:', error);
  });

  wss.on('connection', async (ws, req) => {
    const connectionId = Math.random().toString(36).substring(7);
    console.log(`🎥 [${connectionId}] Client connected to Video AI Copilot`);

    const authResult = await authenticateConnection(req);
    if (!authResult) {
      console.error(`❌ [${connectionId}] Authentication failed`);
      ws.close(4401, 'Unauthorized');
      return;
    }

    const { meetingId, clientId, consultantId, sellerId, playbookId } = authResult;

    let session = activeSessions.get(meetingId);
    if (!session) {
      session = {
        meetingId,
        clientId,
        consultantId,
        sellerId,
        participants: new Map(),
        playbook: null,
        currentPhaseIndex: 0,
        transcriptBuffer: [],
        lastAnalysisTime: 0,
        totalTranscriptText: '',
      };
      activeSessions.set(meetingId, session);
    }

    if (playbookId && !session.playbook) {
      const loadedPlaybook = await autoLoadPlaybook(session, playbookId);
      if (loadedPlaybook) {
        session.playbook = loadedPlaybook;
        session.currentPhaseIndex = 0;
      }
    }

    // Register this client for the meeting (for broadcast)
    if (!meetingClients.has(meetingId)) {
      meetingClients.set(meetingId, new Set());
    }
    meetingClients.get(meetingId)!.add(ws);

    // Broadcast function for this meeting
    const broadcast = (msg: OutgoingMessage) => {
      const clients = meetingClients.get(meetingId);
      if (clients) {
        for (const client of clients) {
          sendMessage(client, msg);
        }
      }
    };

    // Load existing participants from database
    const existingParticipants = await loadExistingParticipants(session);

    await db
      .update(videoMeetings)
      .set({
        startedAt: new Date(),
        status: 'in_progress',
      })
      .where(eq(videoMeetings.id, meetingId));

    sendMessage(ws, {
      type: 'connected',
      data: {
        meetingId,
        message: 'Video AI Copilot connected successfully',
        playbookLoaded: session.playbook ? session.playbook.name : null,
      },
      timestamp: Date.now(),
    });

    // Send existing participants list
    if (existingParticipants.length > 0) {
      sendMessage(ws, {
        type: 'participants_list',
        data: { participants: existingParticipants },
        timestamp: Date.now(),
      });
    }

    if (session.playbook) {
      sendMessage(ws, {
        type: 'script_progress',
        data: calculateScriptProgress(session),
        timestamp: Date.now(),
      });
    }

    ws.on('message', async (rawData) => {
      try {
        const message: IncomingMessage = JSON.parse(rawData.toString());

        switch (message.type) {
          case 'audio_chunk':
            await handleAudioChunk(ws, session!, message);
            break;
          case 'set_playbook':
            await handleSetPlaybook(ws, session!, message);
            break;
          case 'participant_update':
            handleParticipantUpdate(ws, session!, message);
            break;
          case 'participant_join':
            await handleParticipantJoin(ws, session!, message, broadcast);
            break;
          case 'participant_leave':
            await handleParticipantLeave(ws, session!, message, broadcast);
            break;
          case 'end_session':
            await handleEndSession(ws, session!);
            ws.close(1000, 'Session ended');
            break;
          case 'webrtc_offer':
            handleWebRTCOffer(ws, session!, message);
            break;
          case 'webrtc_answer':
            handleWebRTCAnswer(ws, session!, message);
            break;
          case 'ice_candidate':
            handleICECandidate(ws, session!, message);
            break;
          default:
            console.warn(`⚠️ [VideoCopilot] Unknown message type: ${(message as any).type}`);
        }
      } catch (error: any) {
        console.error(`❌ [VideoCopilot] Message handling error:`, error.message);
        sendMessage(ws, {
          type: 'error',
          data: { message: 'Failed to process message' },
          timestamp: Date.now(),
        });
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`🔌 [${connectionId}] Client disconnected: ${code} - ${reason}`);
      // Remove client from meeting clients map
      const clients = meetingClients.get(meetingId);
      if (clients) {
        clients.delete(ws);
        if (clients.size === 0) {
          meetingClients.delete(meetingId);
        }
      }
      
      // Clean up participant socket on disconnect using reverse map
      unregisterParticipantBySocket(ws, broadcast);
    });

    ws.on('error', (error) => {
      console.error(`❌ [${connectionId}] WebSocket error:`, error);
    });
  });

  console.log('✅ Video AI Copilot WebSocket server ready on /ws/video-copilot');
  
  return wss;
}
