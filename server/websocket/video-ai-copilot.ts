import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { db } from '../db';
import { videoMeetings, videoMeetingTranscripts, videoMeetingParticipants, humanSellers, salesScripts, humanSellerCoachingEvents, humanSellerSessionMetrics, users, humanSellerScriptAssignments } from '@shared/schema';
import { eq, and, isNull, isNotNull, desc } from 'drizzle-orm';
import { getAIProvider } from '../ai/provider-factory';
import { addWAVHeaders, base64ToBuffer, bufferToBase64 } from '../ai/audio-converter';
import { SalesManagerAgent, type SalesManagerAnalysis, type ArchetypeState, type ConversationMessage, type BusinessContext } from '../ai/sales-manager-agent';
import { parseScriptContentToStructure } from '../ai/sales-script-structure-parser';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

interface Participant {
  id: string;
  name: string;
  role: 'host' | 'guest' | 'prospect';
  isSpeaking?: boolean;
  transcriptions?: Array<{ text: string; timestamp: number }>; // Added for message history
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

interface CoachingMetrics {
  totalBuySignals: number;
  totalObjections: number;
  objectionsHandled: number;
  scriptAdherenceScores: number[];
  prospectArchetype: string | null;
  sessionStartTime: number;
}

interface CachedAiProvider {
  client: any;
  metadata: any;
  source: string;
  cleanup?: () => Promise<void>;
  cachedAt: number;
}

interface CompletedCheckpoint {
  checkpointId: string;
  status: 'completed';
  completedAt: string;
}

interface ValidatedCheckpointItem {
  check: string;
  status: 'validated';
  infoCollected: string;
  evidenceQuote: string;
}

interface SessionState {
  meetingId: string;
  clientId: string;
  consultantId: string | null;
  sellerId: string | null;
  participants: Map<string, Participant>;
  playbook: Playbook | null;
  currentPhaseIndex: number;
  currentStepIndex: number;
  transcriptBuffer: Array<{
    speakerId: string;
    speakerName: string;
    text: string;
    timestamp: number;
    sentiment: 'positive' | 'neutral' | 'negative';
  }>;
  lastAnalysisTime: number;
  lastSalesManagerAnalysisTime: number;
  totalTranscriptText: string;
  conversationMessages: ConversationMessage[];
  archetypeState: ArchetypeState | null;
  scriptStructure: any | null;
  coachingMetrics: CoachingMetrics;
  businessContext: BusinessContext | null;
  cachedAiProvider: CachedAiProvider | null;
  aiProviderFailed: boolean;
  aiProviderErrorMessage: string | null;
  completedCheckpoints: CompletedCheckpoint[];
  validatedCheckpointItems: Record<string, ValidatedCheckpointItem[]>;
}

interface IncomingMessage {
  type: 'audio_chunk' | 'set_playbook' | 'participant_update' | 'participant_join' | 'participant_leave' | 'end_session' | 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate' | 'lobby_join' | 'lobby_leave' | 'speaking_state' | 'speech_start' | 'speech_end';
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
  lobbyParticipant?: {
    name: string;
    isHost: boolean;
  };
  speakingState?: {
    participantId: string;
    isSpeaking: boolean;
  };
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
  type: 'transcript' | 'sentiment' | 'suggestion' | 'battle_card' | 'script_progress' | 'error' | 'connected' | 'session_ended' | 'participant_joined' | 'participant_left' | 'participants_list' | 'join_confirmed' | 'webrtc_offer' | 'webrtc_answer' | 'ice_candidate' | 'participant_socket_ready' | 'lobby_participant_joined' | 'lobby_participant_left' | 'lobby_participants_list' | 'speaking_state' | 'sales_coaching' | 'buy_signal' | 'objection_detected' | 'checkpoint_status' | 'prospect_profile' | 'tone_warning';
  data: any;
  timestamp: number;
}

interface LobbyParticipant {
  id: string;
  name: string;
  isHost: boolean;
  joinedAt: number;
}

interface AudioChunk {
  data: string;
  timestamp: number;
  durationMs: number;
}

interface SpeakerTurnBuffer {
  speakerId: string;
  speakerName: string;
  chunks: AudioChunk[];
  startTime: number;
  lastChunkTime: number;
  transcriptParts: string[];
  fullTranscript: string;
  role: 'host' | 'guest' | 'prospect';
}

interface TurnState {
  meetingId: string;
  speakerBuffers: Map<string, SpeakerTurnBuffer>;
  previousSpeaker: SpeakerTurnBuffer | null;
  silenceTimers: Map<string, NodeJS.Timeout>;
  analysisDebounceTimer: NodeJS.Timeout | null;
  lastAnalysisTime: number;
  pendingAnalysis: boolean;
}

const TURN_TAKING_CONFIG = {
  SILENCE_THRESHOLD_MS: 700,
  SPEAKER_CHANGE_THRESHOLD_MS: 300,
  LONG_PAUSE_THRESHOLD_MS: 2000,
  ANALYSIS_DEBOUNCE_MS: 2000,
  MIN_AUDIO_CHUNKS: 1,
  MIN_AUDIO_DURATION_MS: 300,
  MAX_TIME_WITHOUT_ANALYSIS_MS: 30000,
};

interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
};

const activeSessions = new Map<string, SessionState>();
const meetingClients = new Map<string, Set<WebSocket>>();
const participantSockets = new Map<string, Map<string, WebSocket>>();
const socketToParticipants = new Map<WebSocket, Set<{ meetingId: string; participantId: string }>>();
const turnStates = new Map<string, TurnState>();
const ANALYSIS_THROTTLE_MS = 3000;

const lobbyParticipants = new Map<string, Map<string, LobbyParticipant>>();
const lobbySocketToId = new Map<WebSocket, { meetingId: string; lobbyId: string }>();

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
  businessContext: BusinessContext | null;
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
    let businessContext: BusinessContext | null = null;

    if (meeting.sellerId) {
      const [seller] = await db
        .select()
        .from(humanSellers)
        .where(eq(humanSellers.id, meeting.sellerId))
        .limit(1);

      if (seller) {
        // Build BusinessContext from seller data (COMPLETO - allineato a SalesAgentConfig)
        // Parse servicesOffered safely - mantiene oggetti completi {name, description, price}
        let parsedServices: Array<{name: string; description: string; price: string}> = [];
        try {
          const rawServices = seller.servicesOffered;
          if (rawServices) {
            const servicesArray = typeof rawServices === 'string' 
              ? JSON.parse(rawServices) 
              : rawServices;
            if (Array.isArray(servicesArray)) {
              parsedServices = servicesArray.map((s: any) => {
                if (typeof s === 'string') {
                  return { name: s, description: '', price: '' };
                }
                return {
                  name: s?.name || String(s),
                  description: s?.description || '',
                  price: s?.price || ''
                };
              }).filter((s: any) => s.name);
            }
          }
        } catch (parseError) {
          console.warn(`⚠️ [VideoCopilot] Failed to parse servicesOffered:`, parseError);
        }

        // Parse values safely (could be JSON string or already parsed array)
        let parsedValues: string[] = [];
        try {
          const rawValues = (seller as any).values;
          if (rawValues) {
            parsedValues = typeof rawValues === 'string' 
              ? JSON.parse(rawValues) 
              : (Array.isArray(rawValues) ? rawValues : []);
          }
        } catch (parseError) {
          console.warn(`⚠️ [VideoCopilot] Failed to parse values:`, parseError);
        }

        businessContext = {
          // Base
          displayName: seller.displayName || seller.sellerName || 'Consulente',
          businessName: seller.businessName || seller.sellerName || 'Azienda',
          businessDescription: seller.businessDescription || null,

          // Bio & Credenziali
          consultantBio: seller.consultantBio || null,
          yearsExperience: seller.yearsExperience || 0,
          clientsHelped: seller.clientsHelped || 0,
          resultsGenerated: seller.resultsGenerated || null,
          guarantees: seller.guarantees || null,

          // Posizionamento
          vision: seller.vision || null,
          mission: seller.mission || null,
          values: parsedValues,
          usp: seller.usp || null,
          targetClient: seller.targetClient || null,
          nonTargetClient: seller.nonTargetClient || null,

          // Operativo
          whatWeDo: seller.whatWeDo || null,
          howWeDoIt: seller.howWeDoIt || null,

          // Servizi completi
          servicesOffered: parsedServices,

          // Fasi
          enableDiscovery: seller.enableDiscovery ?? true,
          enableDemo: seller.enableDemo ?? false,
        };

        // 📊 LOG DETTAGLIATO CONTESTO VENDITORE
        console.log(`\n👤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`👤 [VideoCopilot] SELLER CONTEXT LOADED`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   👤 Seller ID: ${seller.id}`);
        console.log(`   👤 Display Name: ${businessContext.displayName}`);
        console.log(`   👤 Business Name: ${businessContext.businessName}`);
        console.log(`   👤 USP: ${businessContext.usp ? 'SET' : 'NULL'}`);
        console.log(`   👤 Target Client: ${businessContext.targetClient ? 'SET' : 'NULL'}`);
        console.log(`   👤 Services: ${parsedServices.length} (with details)`);
        console.log(`   👤 Years Experience: ${businessContext.yearsExperience}`);
        console.log(`   👤 Clients Helped: ${businessContext.clientsHelped}`);
        console.log(`   👤 Enable Discovery: ${businessContext.enableDiscovery}`);
        console.log(`   👤 Enable Demo: ${businessContext.enableDemo}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // CRITICAL: Consultant hierarchy traversal for Vertex AI credentials
        // Priority: seller.consultantId → client.consultantId → clientId (self-managed)
        if (seller.consultantId) {
          consultantId = seller.consultantId;
        } else if (seller.clientId) {
          // Look up client's consultant if seller doesn't have one configured
          const [client] = await db
            .select({ consultantId: users.consultantId })
            .from(users)
            .where(eq(users.id, seller.clientId))
            .limit(1);

          consultantId = client?.consultantId || seller.clientId;
        }
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

    console.log(`✅ [VideoCopilot] Connection authenticated - Meeting: ${meeting.id}, Guest: ${isGuest}, BusinessContext: ${businessContext ? 'loaded' : 'none'}`);

    return {
      meetingId: meeting.id,
      clientId,
      consultantId,
      sellerId: meeting.sellerId,
      playbookId,
      isGuest,
      businessContext,
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

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  operationName: string = 'API call'
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;

      const is429 = error.status === 429 || 
                    error.message?.includes('429') ||
                    error.message?.includes('Too Many Requests') ||
                    error.message?.includes('RESOURCE_EXHAUSTED');

      if (!is429 || attempt === config.maxRetries) {
        throw error;
      }

      const delay = Math.min(
        config.baseDelayMs * Math.pow(2, attempt) + Math.random() * 1000,
        config.maxDelayMs
      );

      console.log(`⚠️ [RETRY] ${operationName} - 429 error, attempt ${attempt + 1}/${config.maxRetries}, waiting ${Math.round(delay)}ms`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

function createTurnState(meetingId: string): TurnState {
  return {
    meetingId,
    speakerBuffers: new Map<string, SpeakerTurnBuffer>(),
    previousSpeaker: null,
    silenceTimers: new Map<string, NodeJS.Timeout>(),
    analysisDebounceTimer: null,
    lastAnalysisTime: 0,
    pendingAnalysis: false,
  };
}

function createSpeakerBuffer(
  speakerId: string, 
  speakerName: string, 
  session: SessionState
): SpeakerTurnBuffer {
  const participant = session.participants.get(speakerId);
  return {
    speakerId,
    speakerName,
    chunks: [],
    startTime: Date.now(),
    lastChunkTime: Date.now(),
    transcriptParts: [],
    fullTranscript: '',
    role: participant?.role || 'guest',
  };
}

function combineAudioChunks(chunks: AudioChunk[]): string {
  const buffers = chunks.map(c => Buffer.from(c.data, 'base64'));
  const combined = Buffer.concat(buffers);
  return combined.toString('base64');
}

function estimateChunkDuration(base64Audio: string): number {
  const bytes = Buffer.from(base64Audio, 'base64').length;
  return (bytes / 32000) * 1000;
}

const AI_PROVIDER_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes cache TTL

async function getOrCreateCachedAiProvider(session: SessionState): Promise<CachedAiProvider | null> {
  // If provider already failed, don't retry (prevents loop)
  if (session.aiProviderFailed) {
    return null;
  }

  // Check if we have a valid cached provider
  if (session.cachedAiProvider) {
    const age = Date.now() - session.cachedAiProvider.cachedAt;
    if (age < AI_PROVIDER_CACHE_TTL_MS) {
      return session.cachedAiProvider;
    }
    // Cache expired, cleanup old provider
    if (session.cachedAiProvider.cleanup) {
      try {
        await session.cachedAiProvider.cleanup();
      } catch (e) {
        // Ignore cleanup errors
      }
    }
    session.cachedAiProvider = null;
  }

  // Try to get a new provider
  try {
    console.log(`🔍 [VideoCopilot] Getting AI provider (first time or cache expired)...`);
    const aiProvider = await getAIProvider(
      session.clientId,
      session.consultantId || undefined
    );

    session.cachedAiProvider = {
      client: aiProvider.client,
      metadata: aiProvider.metadata,
      source: aiProvider.source,
      cleanup: aiProvider.cleanup,
      cachedAt: Date.now(),
    };

    console.log(`✅ [VideoCopilot] AI provider cached (source: ${aiProvider.source})`);
    return session.cachedAiProvider;
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Failed to get AI provider:`, error.message);
    session.aiProviderFailed = true;
    session.aiProviderErrorMessage = error.message;
    return null;
  }
}

async function transcribeAudio(
  session: SessionState,
  audioBase64: string,
  speakerId: string,
  speakerName: string
): Promise<string | null> {
  try {
    // GUARD: If AI provider already failed, skip transcription to prevent loop
    if (session.aiProviderFailed) {
      console.log(`⏭️ [VideoCopilot] Skipping transcription - AI provider not available: ${session.aiProviderErrorMessage}`);
      return null;
    }

    console.log(`🎤 [VideoCopilot] Transcribing audio from ${speakerName} (${audioBase64.length} chars base64)`);

    const pcmBuffer = base64ToBuffer(audioBase64);

    // Minimum 800ms of audio at 16kHz, 16-bit = 25600 bytes
    const MIN_AUDIO_BYTES = 8000;
    if (pcmBuffer.length < MIN_AUDIO_BYTES) {
      console.log(`⚠️ [VideoCopilot] Audio too short: ${pcmBuffer.length} bytes = ${Math.round(pcmBuffer.length / 32)}ms (min: 800ms), skipping transcription`);
      return null;
    }

    // GUARD: Limit buffer size to prevent memory issues (max 2MB WAV)
    const MAX_AUDIO_SIZE = 2 * 1024 * 1024;
    if (pcmBuffer.length > MAX_AUDIO_SIZE) {
      console.log(`⚠️ [VideoCopilot] Audio too large (${pcmBuffer.length} bytes), truncating to ${MAX_AUDIO_SIZE} bytes`);
      // Take the last 2MB (most recent audio)
      const truncatedBuffer = pcmBuffer.slice(-MAX_AUDIO_SIZE);
      const wavBuffer = addWAVHeaders(truncatedBuffer, 16000, 1, 16);
      const wavBase64 = bufferToBase64(wavBuffer);

      console.log(`🔄 [VideoCopilot] Truncated PCM ${truncatedBuffer.length} bytes → WAV ${wavBuffer.length} bytes`);

      return await performTranscription(session, wavBase64, speakerId, speakerName);
    }

    const wavBuffer = addWAVHeaders(pcmBuffer, 16000, 1, 16);
    const wavBase64 = bufferToBase64(wavBuffer);

    console.log(`🔄 [VideoCopilot] PCM ${pcmBuffer.length} bytes → WAV ${wavBuffer.length} bytes`);

    // 💾 Salva il file WAV su disco per debug/analisi
    try {
      const { uploadAudio } = await import('../storage/audio-storage');
      const messageId = `meeting-${session.meetingId}-speaker-${speakerId}-${Date.now()}`;
      const result = await uploadAudio(wavBuffer, session.clientId, session.meetingId, messageId);
      console.log(`💾 [VideoCopilot] WAV saved: ${result.publicUrl}`);
    } catch (saveError: any) {
      console.warn(`⚠️ [VideoCopilot] Failed to save WAV file: ${saveError.message}`);
    }

    return await performTranscription(session, wavBase64, speakerId, speakerName);
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Transcription error:`, error.message);

    // If this is a provider error, mark it as failed to prevent loop
    if (error.message.includes('API key') || error.message.includes('credentials') || error.message.includes('provider')) {
      session.aiProviderFailed = true;
      session.aiProviderErrorMessage = error.message;
    }

    return null;
  }
}

async function performTranscription(
  session: SessionState,
  wavBase64: string,
  speakerId: string,
  speakerName: string
): Promise<string | null> {
  const cachedProvider = await getOrCreateCachedAiProvider(session);

  if (!cachedProvider) {
    console.log(`⚠️ [VideoCopilot] No AI provider available, skipping transcription`);
    return null;
  }

  const prompt = `Trascrivi questo audio in italiano. Scrivi SOLO le parole pronunciate, senza aggiungere nulla.`;

  console.log(`🎯 [Trascrizione] Inviando richiesta a Gemini con prompt italiano...`);

  const response = await cachedProvider.client.generateContent({
    model: 'gemini-2.5-flash',
    contents: [
      {
        role: 'user',
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'audio/wav', data: wavBase64 } }
        ]
      }
    ],
    generationConfig: {
      temperature: 0,  // Temperatura 0 per trascrizione precisa
      maxOutputTokens: 2000,
      topP: 1,
      topK: 1,  // Forza il modello a scegliere sempre la parola più probabile
    }
  });

  console.log(`📊 [Trascrizione] Risposta ricevuta, estrazione testo...`);

  const rawTranscript = response.response.text().trim();

  console.log(`📝 [VideoCopilot] Raw transcription: "${rawTranscript.substring(0, 100)}${rawTranscript.length > 100 ? '...' : ''}"`);

  // Detect hallucinated/repetitive output
  const transcript = detectAndFilterHallucination(rawTranscript);

  if (transcript === null) {
    console.log(`⚠️ [VideoCopilot] Hallucination detected, discarding transcript`);
    return null;
  }

  console.log(`📝 [VideoCopilot] Final transcription: "${transcript.substring(0, 100)}${transcript.length > 100 ? '...' : ''}"`);

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

  return transcript || null;
}

function detectAndFilterHallucination(text: string): string | null {
  if (!text || text.length === 0) {
    return null;
  }

  const lowerText = text.toLowerCase();

  // Check if model echoed back the prompt (prompt leakage hallucination)
  const promptKeywords = [
    'trascrivi questo audio',
    'scrivi solo le parole pronunciate',
    'senza aggiungere nulla',
    'transcribe this audio',
    'write only the spoken words',
  ];

  for (const keyword of promptKeywords) {
    if (lowerText.includes(keyword)) {
      console.log(`⚠️ [Hallucination] Prompt leakage detected: "${keyword}"`);
      return null;
    }
  }

  // Split into words
  const words = lowerText.split(/\s+/).filter(w => w.length > 0);

  if (words.length === 0) {
    return null;
  }

  // Check for excessive repetition (same word repeated 4+ times in a row)
  let consecutiveCount = 1;
  for (let i = 1; i < words.length; i++) {
    if (words[i] === words[i - 1]) {
      consecutiveCount++;
      if (consecutiveCount >= 4) {
        console.log(`⚠️ [Hallucination] Detected ${consecutiveCount}x repeated word: "${words[i]}"`);
        return null;
      }
    } else {
      consecutiveCount = 1;
    }
  }

  // Check if more than 50% of words are the same (e.g., "allora allora allora allora allora")
  const wordCounts = new Map<string, number>();
  for (const word of words) {
    wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
  }

  for (const [word, count] of wordCounts) {
    const ratio = count / words.length;
    if (ratio > 0.5 && count >= 4) {
      console.log(`⚠️ [Hallucination] Word "${word}" appears ${count}/${words.length} times (${(ratio * 100).toFixed(0)}%)`);
      return null;
    }
  }

  return text;
}

async function analyzeSentiment(
  session: SessionState,
  text: string,
  speakerId: string
): Promise<'positive' | 'neutral' | 'negative'> {
  try {
    if (session.aiProviderFailed) {
      return 'neutral';
    }

    const cachedProvider = await getOrCreateCachedAiProvider(session);
    if (!cachedProvider) {
      return 'neutral';
    }

    const response = await cachedProvider.client.generateContent({
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
    if (session.aiProviderFailed) {
      return null;
    }

    const cachedProvider = await getOrCreateCachedAiProvider(session);
    if (!cachedProvider) {
      return null;
    }

    const currentPhase = session.playbook.phases[session.currentPhaseIndex];

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

    const response = await cachedProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 100,
      }
    });

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
    if (session.aiProviderFailed) {
      return null;
    }

    const cachedProvider = await getOrCreateCachedAiProvider(session);
    if (!cachedProvider) {
      return null;
    }

    const objectionsList = session.playbook.objections
      .map((o, i) => `${i + 1}. Trigger: "${o.trigger}" | Category: ${o.category}`)
      .join('\n');

    const prompt = `Analyze if the following prospect statement contains an objection from our list.

PROSPECT STATEMENT: "${text}"

KNOWN OBJECTIONS:
${objectionsList}

If an objection is detected, respond with JSON:
{"detected": true, "objectionIndex": <number>}

If no objection detected, respond with:
{"detected": false}

Response (JSON only):`;

    const response = await cachedProvider.client.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 150,
      }
    });

    const result = response.response.text().trim();

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
  phaseNames: string[];
  completionPercentage: number;
  currentStep?: number;
  totalSteps?: number;
  stepName?: string;
  currentPhaseId?: string;
  currentStepId?: string;
} {
  // BUG #4 FIX: Use scriptStructure (parsed script) instead of playbook
  const phases = session.scriptStructure?.phases || session.playbook?.phases;

  if (!phases || phases.length === 0) {
    return {
      currentPhase: 0,
      totalPhases: 0,
      phaseName: 'No playbook loaded',
      phaseNames: [],
      completionPercentage: 0,
    };
  }

  const totalPhases = phases.length;
  const currentPhase = session.currentPhaseIndex + 1;
  const currentPhaseData = phases[session.currentPhaseIndex];
  const phaseName = currentPhaseData?.name || currentPhaseData?.title || 'Unknown';
  const phaseNames = phases.map((p: any) => p.name || p.title || 'Fase');

  // Add step information
  const steps = currentPhaseData?.steps || [];
  const totalSteps = steps.length;
  const currentStep = session.currentStepIndex + 1;
  const currentStepData = steps[session.currentStepIndex];
  const stepName = currentStepData?.name || currentStepData?.title || '';

  const completionPercentage = Math.round((currentPhase / totalPhases) * 100);

  return {
    currentPhase,
    totalPhases,
    phaseName,
    phaseNames,
    completionPercentage,
    currentStep,
    totalSteps,
    stepName,
    currentPhaseId: currentPhaseData?.id || `phase_${currentPhase}`,
    currentStepId: currentStepData?.id || `step_${currentStep}`,
  };
}

async function transcribeBufferedAudio(
  ws: WebSocket,
  session: SessionState,
  buffer: SpeakerTurnBuffer,
  isPartial: boolean = true
): Promise<string | null> {
  if (buffer.chunks.length < TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    console.log(`⏭️ [TurnTaking] Too few chunks (${buffer.chunks.length}), skipping transcription`);
    return null;
  }

  // GUARD: If AI provider already failed, skip transcription and notify client once
  if (session.aiProviderFailed) {
    // Only send error message once (check if we haven't already)
    if (session.aiProviderErrorMessage && !session.aiProviderErrorMessage.includes('[NOTIFIED]')) {
      console.log(`⚠️ [TurnTaking] AI provider not available, skipping transcription`);
      sendMessage(ws, {
        type: 'error',
        data: { 
          message: 'Trascrizione non disponibile: provider AI non configurato. Contatta il supporto.',
          code: 'AI_PROVIDER_UNAVAILABLE',
          details: session.aiProviderErrorMessage,
        },
        timestamp: Date.now(),
      });
      session.aiProviderErrorMessage = `[NOTIFIED] ${session.aiProviderErrorMessage}`;
    }
    // Clear buffer to prevent memory accumulation
    buffer.chunks = [];
    return null;
  }

  const combinedAudio = combineAudioChunks(buffer.chunks);

  // Don't use retry if we know the provider might fail - try once directly
  const transcript = await transcribeAudio(session, combinedAudio, buffer.speakerId, buffer.speakerName);

  // Always clear buffer after attempting transcription (prevents infinite accumulation)
  buffer.chunks = [];

  if (transcript) {
    buffer.transcriptParts.push(transcript);
    buffer.fullTranscript = buffer.transcriptParts.join(' ');

    session.totalTranscriptText += ` ${transcript}`;

    console.log(`📤 [STEP 5] Sending transcript to client - Speaker: ${buffer.speakerName}, Text: "${transcript.substring(0, 60)}..."`);
    sendMessage(ws, {
      type: 'transcript',
      data: {
        speakerId: buffer.speakerId,
        speakerName: buffer.speakerName,
        text: transcript,
        isPartial,
        turnComplete: !isPartial,
      },
      timestamp: Date.now(),
    });

    session.transcriptBuffer.push({
      speakerId: buffer.speakerId,
      speakerName: buffer.speakerName,
      text: transcript,
      timestamp: Date.now(),
      sentiment: 'neutral',
    });

    console.log(`📝 [STEP 5 DONE] Transcribed ${buffer.speakerName}: "${transcript.substring(0, 60)}..." (partial: ${isPartial})`);
  } else if (session.aiProviderFailed) {
    // Provider failed during this call - notify client
    sendMessage(ws, {
      type: 'error',
      data: { 
        message: 'Trascrizione non disponibile: problema con il provider AI.',
        code: 'AI_PROVIDER_ERROR',
        details: session.aiProviderErrorMessage,
      },
      timestamp: Date.now(),
    });
  }

  return transcript;
}

async function handleSilenceDetectedForSpeaker(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState,
  speakerId: string
) {
  const buffer = turnState.speakerBuffers.get(speakerId);
  if (!buffer) return;

  console.log(`🔇 [STEP 4] Silence detected for ${buffer.speakerName} (${buffer.chunks.length} chunks buffered) - Starting transcription...`);

  const transcript = await transcribeBufferedAudio(ws, session, buffer, true);

  if (transcript) {
    const participant = session.participants.get(buffer.speakerId);
    if (participant?.role === 'prospect') {
      try {
        const battleCard = await withRetry(
          () => detectObjectionAndGenerateBattleCard(session, transcript),
          DEFAULT_RETRY_CONFIG,
          'Battle card detection'
        );
        if (battleCard?.detected) {
          sendMessage(ws, {
            type: 'battle_card',
            data: battleCard,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error(`❌ [TurnTaking] Battle card detection error:`, error);
      }
    }
  }
}

function handleSpeechStart(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  const { meetingId } = session;
  const speakerId = message.speakerId;
  const speakerName = message.speakerName || 'Unknown Speaker';

  if (!speakerId) {
    console.log(`⚠️ [VAD-SPEECH-START] Missing speakerId, ignoring`);
    return;
  }

  console.log(`🎤 [VAD-SPEECH-START] ${speakerName} started speaking (client VAD)`);

  let turnState = turnStates.get(meetingId);
  if (!turnState) {
    turnState = createTurnState(meetingId);
    turnStates.set(meetingId, turnState);
  }

  const existingSilenceTimer = turnState.silenceTimers.get(speakerId);
  if (existingSilenceTimer) {
    clearTimeout(existingSilenceTimer);
    turnState.silenceTimers.delete(speakerId);
  }

  let buffer = turnState.speakerBuffers.get(speakerId);
  if (!buffer) {
    buffer = createSpeakerBuffer(speakerId, speakerName, session);
    turnState.speakerBuffers.set(speakerId, buffer);
    console.log(`🆕 [VAD-SPEECH-START] Created new buffer for ${speakerName} (${speakerId})`);
  } else {
    console.log(`♻️ [VAD-SPEECH-START] Reusing existing buffer for ${speakerName} (${buffer.chunks.length} chunks)`);
  }
}

async function handleSpeechEndFromClient(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage
) {
  const { meetingId } = session;
  const speakerId = message.speakerId;
  const speakerName = message.speakerName || 'Unknown Speaker';

  if (!speakerId) {
    console.log(`⚠️ [VAD-SPEECH-END] Missing speakerId, ignoring`);
    return;
  }

  console.log(`🔇 [VAD-SPEECH-END] ${speakerName} stopped speaking (client VAD) - TRANSCRIBING IMMEDIATELY!`);

  const turnState = turnStates.get(meetingId);
  if (!turnState) {
    console.log(`⚠️ [VAD-SPEECH-END] No turn state for meeting ${meetingId}`);
    return;
  }

  const silenceTimer = turnState.silenceTimers.get(speakerId);
  if (silenceTimer) {
    clearTimeout(silenceTimer);
    turnState.silenceTimers.delete(speakerId);
  }

  const buffer = turnState.speakerBuffers.get(speakerId);

  if (!buffer) {
    console.log(`⚠️ [VAD-SPEECH-END] No buffer found for speaker ${speakerName} (${speakerId})`);
    return;
  }

  if (buffer.chunks.length < TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    console.log(`⏭️ [VAD-SPEECH-END] Too little audio (${buffer.chunks.length} chunks) for ${speakerName}, skipping`);
    turnState.speakerBuffers.delete(speakerId);
    return;
  }

  console.log(`⚡ [TRUST-THE-CLIENT] Transcribing ${buffer.chunks.length} chunks for ${speakerName} immediately`);

  const transcript = await transcribeBufferedAudio(ws, session, buffer, false);

  if (transcript) {
    // 🔧 FIX: Aggiungi messaggio a conversationMessages PRIMA dell'analisi
    const speakerRole = buffer.role === 'host' ? 'assistant' : 'user';
    const messageContent = buffer.fullTranscript || transcript;
    
    session.conversationMessages.push({
      role: speakerRole,
      content: messageContent,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [VAD-SPEECH-END] Turn finalized: ${buffer.speakerName} - "${messageContent.substring(0, 80)}..."`);
    console.log(`📋 [VAD-SPEECH-END] Added to conversationMessages (${speakerRole}): "${messageContent.substring(0, 60)}..."`);

    const participant = session.participants.get(buffer.speakerId);
    if (participant?.role === 'prospect') {
      try {
        const battleCard = await withRetry(
          () => detectObjectionAndGenerateBattleCard(session, transcript),
          DEFAULT_RETRY_CONFIG,
          'Battle card detection'
        );
        if (battleCard?.detected) {
          sendMessage(ws, {
            type: 'battle_card',
            data: battleCard,
            timestamp: Date.now(),
          });
        }
      } catch (error) {
        console.error(`❌ [VAD-SPEECH-END] Battle card detection error:`, error);
      }
    }
  }

  turnState.previousSpeaker = buffer;
  turnState.speakerBuffers.delete(speakerId);

  scheduleAnalysis(ws, session, turnState);
}

async function finalizeTurnForSpeaker(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState,
  speakerId: string
) {
  const buffer = turnState.speakerBuffers.get(speakerId);
  if (!buffer) return;

  console.log(`🏁 [TurnTaking] Finalizing turn for ${buffer.speakerName}`);

  if (buffer.chunks.length >= TURN_TAKING_CONFIG.MIN_AUDIO_CHUNKS) {
    await transcribeBufferedAudio(ws, session, buffer, false);
  }

  if (buffer.fullTranscript) {
    sendMessage(ws, {
      type: 'transcript',
      data: {
        speakerId: buffer.speakerId,
        speakerName: buffer.speakerName,
        text: buffer.fullTranscript,
        isPartial: false,
        turnComplete: true,
      },
      timestamp: Date.now(),
    });

    const speakerRole = buffer.role === 'host' ? 'assistant' : 'user';
    session.conversationMessages.push({
      role: speakerRole,
      content: buffer.fullTranscript,
      timestamp: new Date().toISOString(),
    });

    console.log(`✅ [TurnTaking] Turn complete: ${buffer.speakerName} - "${buffer.fullTranscript.substring(0, 80)}..."`);
  }

  turnState.previousSpeaker = buffer;
  turnState.speakerBuffers.delete(speakerId);
}

function scheduleAnalysis(
  ws: WebSocket,
  session: SessionState,
  turnState: TurnState
) {
  if (turnState.analysisDebounceTimer) {
    clearTimeout(turnState.analysisDebounceTimer);
  }

  turnState.pendingAnalysis = true;

  turnState.analysisDebounceTimer = setTimeout(async () => {
    if (!turnState.pendingAnalysis) return;

    const hasPreviousTurn = turnState.previousSpeaker?.fullTranscript && turnState.previousSpeaker.fullTranscript.length > 10;
    const hasActiveBuffers = Array.from(turnState.speakerBuffers.values()).some(
      b => b.fullTranscript && b.fullTranscript.length > 10
    );

    if (!hasPreviousTurn && !hasActiveBuffers) {
      console.log(`⏭️ [TurnTaking] No complete turns for analysis, skipping`);
      return;
    }

    console.log(`\n🎯 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`🎯 [TURN-EXCHANGE] Analysis after turn exchange`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    if (turnState.previousSpeaker?.fullTranscript) {
      console.log(`   Previous: ${turnState.previousSpeaker.speakerName}`);
      console.log(`   → "${turnState.previousSpeaker.fullTranscript.substring(0, 80)}..."`);
    }
    if (hasActiveBuffers) {
      const activeBuffers = Array.from(turnState.speakerBuffers.values())
        .filter(b => b.fullTranscript && b.fullTranscript.length > 10);
      for (const buffer of activeBuffers) {
        console.log(`   Active: ${buffer.speakerName}`);
        console.log(`   → "${buffer.fullTranscript.substring(0, 80)}..."`);
      }
    }
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    try {
      await runSalesManagerAnalysis(ws, session);

      const recentTranscripts = session.transcriptBuffer
        .slice(-10)
        .map(t => `${t.speakerName}: ${t.text}`)
        .join('\n');

      const suggestion = await withRetry(
        () => generateSuggestion(session, recentTranscripts),
        DEFAULT_RETRY_CONFIG,
        'Suggestion generation'
      );

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
    } catch (error) {
      console.error(`❌ [TurnTaking] Analysis error:`, error);
    }

    turnState.lastAnalysisTime = Date.now();
    turnState.pendingAnalysis = false;

  }, TURN_TAKING_CONFIG.ANALYSIS_DEBOUNCE_MS);
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

  const { meetingId } = session;
  const speakerId = message.speakerId;
  const speakerName = message.speakerName || 
    session.participants.get(speakerId)?.name || 
    'Unknown Speaker';

  let turnState = turnStates.get(meetingId);
  if (!turnState) {
    turnState = createTurnState(meetingId);
    turnStates.set(meetingId, turnState);
    console.log(`🆕 [TurnTaking] Created turn state for meeting ${meetingId}`);
  }

  const existingSilenceTimer = turnState.silenceTimers.get(speakerId);
  if (existingSilenceTimer) {
    clearTimeout(existingSilenceTimer);
    turnState.silenceTimers.delete(speakerId);
  }

  let buffer = turnState.speakerBuffers.get(speakerId);
  if (!buffer) {
    buffer = createSpeakerBuffer(speakerId, speakerName, session);
    turnState.speakerBuffers.set(speakerId, buffer);
    console.log(`🎤 [TurnTaking] Started buffering for ${speakerName} (${speakerId})`);
  }

  const chunkSize = message.data?.length || 0;
  buffer.chunks.push({
    data: message.data,
    timestamp: Date.now(),
    durationMs: estimateChunkDuration(message.data),
  });
  buffer.lastChunkTime = Date.now();

  // Store transcription timestamp for sorting later
  const participant = session.participants.get(speakerId);
  if (participant) {
    if (!participant.transcriptions) {
      participant.transcriptions = [];
    }
    participant.transcriptions.push({ text: '', timestamp: buffer.lastChunkTime }); // Placeholder text, actual text added after transcription
  }

  if (buffer.chunks.length % 20 === 1) {
    console.log(`📦 [STEP 3] Received audio chunk from ${speakerName} - Chunks: ${buffer.chunks.length}, Size: ${chunkSize} chars`);
  }

  const timeSinceLastAnalysis = Date.now() - turnState.lastAnalysisTime;
  if (timeSinceLastAnalysis > TURN_TAKING_CONFIG.MAX_TIME_WITHOUT_ANALYSIS_MS && !turnState.pendingAnalysis) {
    console.log(`⏰ [TurnTaking] Forcing analysis after ${Math.round(timeSinceLastAnalysis)}ms (${Math.round(timeSinceLastAnalysis / 1000)}s) inactivity)`);
    scheduleAnalysis(ws, session, turnState);
  }
}

async function runSalesManagerAnalysis(
  ws: WebSocket,
  session: SessionState
) {
  console.log(`🤖 [STEP 7] Starting Sales Manager Analysis...`);
  if (!session.scriptStructure || !session.consultantId) {
    console.log(`⚠️ [STEP 7] Skipping Sales Manager: missing script structure (${session.scriptStructure ? 'OK' : 'NULL'}) or consultantId (${session.consultantId || 'NULL'})`);
    return;
  }

  try {
    const currentPhase = session.scriptStructure.phases?.[session.currentPhaseIndex];
    const currentStep = currentPhase?.steps?.[session.currentStepIndex];

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📥 SALES MANAGER INPUT LOG
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // Build messages for Sales Manager (ALL messages, with role mapping)
    // CRITICAL: Include ALL messages, not just turns, to capture every host question
    const messagesForManager: Array<{ role: 'user' | 'assistant'; content: string }> = [];

    // Add all transcriptions in chronological order
    // Need to get the host participant to correctly map 'assistant' role
    const hostParticipant = Array.from(session.participants.values()).find(p => p.role === 'host');

    for (const participant of session.participants.values()) {
      if (participant.transcriptions) {
        for (const transcript of participant.transcriptions) {
          messagesForManager.push({
            role: participant.role === 'host' ? 'assistant' : 'user',
            content: transcript.text
          });
        }
      }
    }

    // Sort by timestamp to maintain conversation order
    messagesForManager.sort((a, b) => {
      // Find the original transcription objects to get timestamps
      let transcriptA, transcriptB;

      // Find participant for 'a'
      let participantA = session.participants.get(a.role === 'assistant' ? hostParticipant?.id || '' : '');
      if (!participantA) {
         // Fallback if host not found or role mapping is tricky
         participantA = Array.from(session.participants.values()).find(p => p.role !== 'assistant' && p.transcriptions?.some(t => t.text === a.content));
      }
      if(participantA) {
        transcriptA = participantA.transcriptions?.find(t => t.text === a.content);
      }
      
      // Find participant for 'b'
      let participantB = session.participants.get(b.role === 'assistant' ? hostParticipant?.id || '' : '');
       if (!participantB) {
         // Fallback if host not found or role mapping is tricky
         participantB = Array.from(session.participants.values()).find(p => p.role !== 'assistant' && p.transcriptions?.some(t => t.text === b.content));
       }
      if(participantB) {
        transcriptB = participantB.transcriptions?.find(t => t.text === b.content);
      }

      return (transcriptA?.timestamp || 0) - (transcriptB?.timestamp || 0);
    });


    const scriptJson = JSON.stringify(session.scriptStructure || {});
    const transcriptText = messagesForManager.map(m => `${m.role}: ${m.content}`).join('\n');

    console.log(`\n📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📥 [SALES-MANAGER] INPUT ANALYSIS`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📜 SCRIPT INPUT: ${scriptJson.length} chars (~${Math.round(scriptJson.length / 4)} tokens)`);
    console.log(`      └─ Phases: ${session.scriptStructure?.phases?.length || 0}`);
    console.log(`      └─ Current Phase: ${currentPhase?.name || 'N/A'} (${session.currentPhaseIndex + 1}/${session.scriptStructure?.phases?.length || 0})`);
    console.log(`      └─ Current Step: ${currentStep?.name || 'N/A'} (${session.currentStepIndex + 1}/${currentPhase?.steps?.length || 0})`);
    console.log(`      └─ Phase ID: ${currentPhase?.id || 'N/A'}`);
    console.log(`      └─ Step ID: ${currentStep?.id || 'N/A'}`);
    console.log(`   💬 FRESH TEXT (Full Conversation History): ${transcriptText.length} chars (~${Math.round(transcriptText.length / 4)} tokens)`);
    console.log(`      └─ Messages: ${messagesForManager.length}`);
    if (messagesForManager.length > 0) {
      console.log(`      └─ Last 3 messages:`);
      messagesForManager.slice(-3).forEach((m, i) => {
        const preview = m.content.length > 60 ? m.content.substring(0, 60) + '...' : m.content;
        console.log(`         ${i + 1}. [${m.role.toUpperCase()}] "${preview}"`);
      });
    }
    console.log(`   🔗 CONNECTION:`);
    console.log(`      └─ Meeting ID: ${session.meetingId}`);
    console.log(`      └─ Consultant ID: ${session.consultantId}`);
    console.log(`      └─ Participants: ${session.participants.size}`);
    console.log(`      └─ Archetype State: ${session.archetypeState?.current || 'neutral'} (${Math.round((session.archetypeState?.confidence || 0) * 100)}%)`);
    console.log(`📥 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🆕 CHECKPOINT MAPPING: Da checkpoints[] (parser) a checkpoint (singolo)
    // Stesso processo usato in gemini-live-ws-service.ts (linee 4133-4172)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    const scriptForAgent = {
      phases: session.scriptStructure.phases?.map((p: any) => {
        const firstCheckpoint = p.checkpoints?.[0] || null;

        const allVerifications: string[] = [];
        if (p.checkpoints) {
          p.checkpoints.forEach((cp: any) => {
            if (cp.verifications && Array.isArray(cp.verifications)) {
              allVerifications.push(...cp.verifications);
            }
          });
        }

        return {
          id: p.id,
          number: p.number,
          name: p.name,
          description: p.description,
          steps: p.steps?.map((s: any) => ({
            id: s.id,
            number: s.number,
            name: s.name,
            objective: s.objective,
            questions: s.questions || []
          })) || [],
          checkpoint: firstCheckpoint ? {
            id: firstCheckpoint.id || `checkpoint_${p.id}`,
            title: firstCheckpoint.description || `Checkpoint Fase ${p.number}`,
            checks: allVerifications.length > 0 ? allVerifications : (firstCheckpoint.verifications || [])
          } : undefined
        };
      }) || []
    };

    // 🆕 DEBUG: Log checkpoint trovati dopo mapping
    const phasesWithCheckpoints = scriptForAgent.phases.filter((p: any) => p.checkpoint);
    if (phasesWithCheckpoints.length > 0) {
      console.log(`   ⛔ Checkpoints trovati: ${phasesWithCheckpoints.length} fasi con checkpoint`);
      phasesWithCheckpoints.forEach((p: any) => {
        console.log(`      - Fase ${p.number}: "${p.checkpoint?.title?.substring(0, 50)}..." (${p.checkpoint?.checks?.length || 0} checks)`);
      });
    } else {
      console.log(`   ⚠️ ATTENZIONE: Nessun checkpoint definito nello script (checkpoints[] vuoto)`);
    }

    const analysis = await SalesManagerAgent.analyze({
      recentMessages: messagesForManager,
      script: scriptForAgent,
      currentPhaseId: currentPhase?.id || 'phase_1',
      currentStepId: currentStep?.id,
      currentPhaseIndex: session.currentPhaseIndex,
      currentStepIndex: session.currentStepIndex,
      clientId: session.clientId,
      consultantId: session.consultantId,
      archetypeState: session.archetypeState || undefined,
      currentTurn: session.conversationMessages.length,
      businessContext: session.businessContext || undefined,
      completedCheckpoints: session.completedCheckpoints,
      validatedCheckpointItems: session.validatedCheckpointItems,
    });

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 📤 SALES MANAGER OUTPUT LOG
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    console.log(`\n📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📤 [SALES-MANAGER] OUTPUT`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   ⏱️ TOTAL TIME: ${analysis.analysisTimeMs}ms`);
    console.log(`   📊 MODEL: ${analysis.modelUsed || 'gemini-2.0-flash'}`);

    console.log(`\n   📊 STEP ADVANCEMENT:`);
    console.log(`      └─ Should Advance: ${analysis.stepAdvancement.shouldAdvance ? '✅ YES' : '❌ NO'}`);
    console.log(`      └─ Next Phase: ${analysis.stepAdvancement.nextPhaseId || 'same'}`);
    console.log(`      └─ Next Step: ${analysis.stepAdvancement.nextStepId || 'same'}`);
    console.log(`      └─ Confidence: ${Math.round((analysis.stepAdvancement.confidence || 0) * 100)}%`);
    if (analysis.stepAdvancement.reasoning) {
      console.log(`      └─ Reasoning: "${analysis.stepAdvancement.reasoning}"`);
    }

    if (analysis.feedbackForAgent?.shouldInject) {
      console.log(`\n   💬 COACHING FEEDBACK:`);
      console.log(`      └─ Priority: ${analysis.feedbackForAgent.priority?.toUpperCase()}`);
      console.log(`      └─ Type: ${analysis.feedbackForAgent.type}`);
      console.log(`      └─ Message: "${analysis.feedbackForAgent.message || 'N/A'}"`);
      if (analysis.feedbackForAgent.toneReminder) {
        console.log(`      └─ Tone Reminder: "${analysis.feedbackForAgent.toneReminder}"`);
      }
    }

    if (analysis.buySignals?.detected && analysis.buySignals.signals?.length > 0) {
      console.log(`\n   💰 BUY SIGNALS: ${analysis.buySignals.signals.length} detected`);
      analysis.buySignals.signals.forEach((s: any, i: number) => {
        console.log(`      ${i + 1}. [${s.type}] "${s.phrase}" (${Math.round((s.confidence || 0) * 100)}%)`);
        if (s.suggestedAction) {
          console.log(`         └─ Action: ${s.suggestedAction}`);
        }
      });
    }

    if (analysis.objections?.detected && analysis.objections.objections?.length > 0) {
      console.log(`\n   🛡️ OBJECTIONS: ${analysis.objections.objections.length} detected`);
      analysis.objections.objections.forEach((o: any, i: number) => {
        console.log(`      ${i + 1}. [${o.type}] "${o.phrase}"`);
        if (o.suggestedResponse) {
          console.log(`         └─ Response: ${o.suggestedResponse}`);
        }
      });
    }

    if (analysis.checkpointStatus) {
      console.log(`\n   ✅ CHECKPOINT STATUS:`);
      console.log(`      └─ Name: ${analysis.checkpointStatus.checkpointName || 'N/A'}`);
      console.log(`      └─ Can Advance: ${analysis.checkpointStatus.canAdvance ? '✅ YES' : '❌ NO'}`);
      if (analysis.checkpointStatus.itemDetails?.length > 0) {
        console.log(`      └─ Items:`);
        analysis.checkpointStatus.itemDetails.forEach((item: any, i: number) => {
          const statusIcon = item.status === 'validated' ? '✅' : item.status === 'vague' ? '🟡' : '❌';
          console.log(`         ${i + 1}. ${statusIcon} ${item.check}`);
        });
      }
    }

    console.log(`\n   🎭 ARCHETYPE STATE:`);
    console.log(`      └─ Current: ${analysis.archetypeState?.current || 'neutral'}`);
    console.log(`      └─ Confidence: ${Math.round((analysis.archetypeState?.confidence || 0) * 100)}%`);
    if (analysis.archetypeState?.reasoning) {
      console.log(`      └─ Reasoning: "${analysis.archetypeState.reasoning}"`);
    }
    console.log(`📤 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    if (analysis.archetypeState) {
      session.archetypeState = analysis.archetypeState;
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // 🆕 CHECKPOINT PERSISTENCE: Salva validated items (verde = resta verde)
    // Stesso processo usato in gemini-live-ws-service.ts (linee 4288-4310)
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    if (analysis.checkpointStatus?.itemDetails && analysis.checkpointStatus?.checkpointId) {
      const checkpointId = analysis.checkpointStatus.checkpointId;
      const newValidatedItems = analysis.checkpointStatus.itemDetails.filter(
        (item: any) => item.status === 'validated'
      );

      if (!session.validatedCheckpointItems[checkpointId]) {
        session.validatedCheckpointItems[checkpointId] = [];
      }

      newValidatedItems.forEach((item: any) => {
        const exists = session.validatedCheckpointItems[checkpointId].some(
          (v) => v.check === item.check
        );
        if (!exists) {
          session.validatedCheckpointItems[checkpointId].push({
            check: item.check,
            status: 'validated',
            infoCollected: item.infoCollected || '',
            evidenceQuote: item.evidenceQuote || ''
          });
          console.log(`   🔒 [STICKY] Saved validated item: "${item.check.substring(0, 40)}..."`);
        }
      });

      if (analysis.checkpointStatus.canAdvance) {
        const alreadyCompleted = session.completedCheckpoints.find(
          cp => cp.checkpointId === checkpointId
        );
        if (!alreadyCompleted) {
          session.completedCheckpoints.push({
            checkpointId,
            status: 'completed',
            completedAt: new Date().toISOString()
          });
          console.log(`   ✅ [CHECKPOINT] Marked as completed: ${checkpointId}`);
        }

        // BUG #1 FIX: Force phase advancement when canAdvance=true but stepAdvancement didn't trigger
        if (!analysis.stepAdvancement.shouldAdvance) {
          const currentPhaseForAdvance = session.scriptStructure?.phases?.[session.currentPhaseIndex];
          const isLastStepOfPhase = session.currentStepIndex >= ((currentPhaseForAdvance?.steps?.length || 1) - 1);
          if (isLastStepOfPhase) {
            const nextPhaseIndex = session.currentPhaseIndex + 1;
            if (nextPhaseIndex < (session.scriptStructure?.phases?.length || 0)) {
              console.log(`   🚀 [FORCE-ADVANCE] Checkpoint canAdvance=true, forcing phase ${session.currentPhaseIndex + 1} → ${nextPhaseIndex + 1}`);
              session.currentPhaseIndex = nextPhaseIndex;
              session.currentStepIndex = 0;
            }
          }
        }
      }
    }

    if (analysis.stepAdvancement.shouldAdvance) {
      if (analysis.stepAdvancement.nextStepId) {
        const nextStepIdx = currentPhase?.steps?.findIndex(
          (s: any) => s.id === analysis.stepAdvancement.nextStepId
        );
        if (nextStepIdx !== undefined && nextStepIdx >= 0) {
          session.currentStepIndex = nextStepIdx;
        }
      }
      if (analysis.stepAdvancement.nextPhaseId) {
        const nextPhaseIdx = session.scriptStructure.phases?.findIndex(
          (p: any) => p.id === analysis.stepAdvancement.nextPhaseId
        );
        if (nextPhaseIdx !== undefined && nextPhaseIdx >= 0) {
          session.currentPhaseIndex = nextPhaseIdx;
          session.currentStepIndex = 0;
        }
      }
    }

    // BUG #2 FIX: Notify frontend of phase/step progress after any advancement
    if (analysis.stepAdvancement.shouldAdvance || analysis.checkpointStatus?.canAdvance) {
      const progressUpdate = calculateScriptProgress(session);
      const currentPhaseData = session.scriptStructure?.phases?.[session.currentPhaseIndex];
      const currentStepData = currentPhaseData?.steps?.[session.currentStepIndex];

      sendMessage(ws, {
        type: 'script_progress_update',
        data: {
          ...progressUpdate,
          currentPhaseId: currentPhaseData?.id || `phase_${session.currentPhaseIndex + 1}`,
          currentStepId: currentStepData?.id || `step_${session.currentStepIndex + 1}`,
          currentPhaseIndex: session.currentPhaseIndex,
          currentStepIndex: session.currentStepIndex,
        },
        timestamp: Date.now(),
      });
      console.log(`   📤 [PROGRESS] Sent script_progress_update: phase=${session.currentPhaseIndex + 1}, step=${session.currentStepIndex + 1}`);
    }

    const timestampMs = Date.now() - session.coachingMetrics.sessionStartTime;

    if (analysis.feedbackForAgent?.shouldInject) {
      sendMessage(ws, {
        type: 'sales_coaching',
        data: {
          priority: analysis.feedbackForAgent.priority,
          type: analysis.feedbackForAgent.type,
          message: analysis.feedbackForAgent.message,
          toneReminder: analysis.feedbackForAgent.toneReminder,
        },
        timestamp: Date.now(),
      });

      if (session.sellerId) {
        await persistCoachingEvent(session.meetingId, session.sellerId, 'coaching', {
          priority: analysis.feedbackForAgent.priority,
          type: analysis.feedbackForAgent.type,
          message: analysis.feedbackForAgent.message,
        }, session.coachingMetrics.prospectArchetype, timestampMs);
      }
    }

    if (analysis.buySignals.detected && analysis.buySignals.signals.length > 0) {
      sendMessage(ws, {
        type: 'buy_signal',
        data: {
          signals: analysis.buySignals.signals,
        },
        timestamp: Date.now(),
      });

      session.coachingMetrics.totalBuySignals += analysis.buySignals.signals.length;

      if (session.sellerId) {
        await persistCoachingEvent(session.meetingId, session.sellerId, 'buy_signal', {
          signals: analysis.buySignals.signals,
        }, session.coachingMetrics.prospectArchetype, timestampMs);
      }
    }

    if (analysis.objections.detected && analysis.objections.objections.length > 0) {
      sendMessage(ws, {
        type: 'objection_detected',
        data: {
          objections: analysis.objections.objections,
        },
        timestamp: Date.now(),
      });

      session.coachingMetrics.totalObjections += analysis.objections.objections.length;

      if (session.sellerId) {
        await persistCoachingEvent(session.meetingId, session.sellerId, 'objection', {
          objections: analysis.objections.objections,
        }, session.coachingMetrics.prospectArchetype, timestampMs);
      }
    }

    if (analysis.checkpointStatus) {
      sendMessage(ws, {
        type: 'checkpoint_status',
        data: analysis.checkpointStatus,
        timestamp: Date.now(),
      });

      if (analysis.checkpointStatus.completedPercentage) {
        session.coachingMetrics.scriptAdherenceScores.push(analysis.checkpointStatus.completedPercentage);
      }
    }

    if (analysis.profilingResult) {
      sendMessage(ws, {
        type: 'prospect_profile',
        data: {
          archetype: analysis.profilingResult.archetype,
          confidence: analysis.profilingResult.confidence,
          instruction: analysis.profilingResult.instruction,
        },
        timestamp: Date.now(),
      });

      if (analysis.profilingResult.confidence > 0.6) {
        session.coachingMetrics.prospectArchetype = analysis.profilingResult.archetype;
      }

      if (session.sellerId) {
        await persistCoachingEvent(session.meetingId, session.sellerId, 'profiling', {
          archetype: analysis.profilingResult.archetype,
          confidence: analysis.profilingResult.confidence,
        }, analysis.profilingResult.archetype, timestampMs);
      }
    }

    if (analysis.toneAnalysis.issues.length > 0) {
      sendMessage(ws, {
        type: 'tone_warning',
        data: {
          issues: analysis.toneAnalysis.issues,
          isRobotic: analysis.toneAnalysis.isRobotic,
          consecutiveQuestions: analysis.toneAnalysis.consecutiveQuestions,
        },
        timestamp: Date.now(),
      });

      if (session.sellerId) {
        await persistCoachingEvent(session.meetingId, session.sellerId, 'tone_warning', {
          issues: analysis.toneAnalysis.issues,
          isRobotic: analysis.toneAnalysis.isRobotic,
        }, session.coachingMetrics.prospectArchetype, timestampMs);
      }
    }

  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Sales Manager analysis error:`, error.message);
  }
}

async function persistCoachingEvent(
  meetingId: string,
  sellerId: string,
  eventType: string,
  eventData: any,
  prospectArchetype: string | null,
  timestampMs: number
) {
  try {
    await db.insert(humanSellerCoachingEvents).values({
      meetingId,
      sellerId,
      eventType,
      eventData,
      prospectArchetype,
      timestampMs,
    });
  } catch (error: any) {
    console.error(`❌ [VideoCopilot] Failed to persist coaching event:`, error.message);
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
        // ✅ LOGICA IBRIDA: Prima JSON, poi TEXT parser (come Sales Agent AI)
        let content: any;
        let formatDetected: 'json' | 'text' = 'json';

        // 📊 LOG DETTAGLIATO SCRIPT
        const scriptPreview = script.content?.substring(0, 200) || '';
        console.log(`\n📘 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`📘 [VideoCopilot] handleSetPlaybook - SCRIPT LOADING DEBUG`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`   📋 Script ID: ${script.id}`);
        console.log(`   📋 Script Name: ${script.name}`);
        console.log(`   📋 Content Length: ${script.content?.length || 0} chars`);
        console.log(`   📋 Content Preview: "${scriptPreview}..."`);

        try {
          // Tentativo 1: JSON parsing
          content = typeof script.content === 'string' 
            ? JSON.parse(script.content) 
            : script.content;
          formatDetected = 'json';
          console.log(`   ✅ Format: JSON (parsed successfully)`);
        } catch (jsonError: any) {
          console.log(`   ⚠️ JSON parse failed: ${jsonError.message}`);
          console.log(`   🔄 Trying TEXT parser (parseScriptContentToStructure)...`);

          try {
            // Tentativo 2: Text parsing (come Sales Agent AI)
            const scriptType = script.scriptType || 'discovery';
            const structure = parseScriptContentToStructure(script.content || '', scriptType);
            content = structure;
            formatDetected = 'text';
            console.log(`   ✅ Format: TEXT (parsed with parseScriptContentToStructure)`);
            console.log(`   📊 Parsed: ${structure.metadata.totalPhases} phases, ${structure.metadata.totalSteps} steps`);
          } catch (textError: any) {
            console.error(`   ❌ Both parsers failed!`);
            console.error(`      JSON error: ${jsonError.message}`);
            console.error(`      TEXT error: ${textError.message}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
            sendMessage(ws, {
              type: 'error',
              data: { message: 'Failed to parse script content (both JSON and TEXT parsers failed)' },
              timestamp: Date.now(),
            });
            return;
          }
        }

        console.log(`   📊 Format Detected: ${formatDetected.toUpperCase()}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

        // ✅ MAPPING INTELLIGENTE: Gestisce sia formato JSON che formato TEXT parser
        session.playbook = {
          id: script.id,
          name: script.name,
          phases: content?.phases?.map((phase: any) => {
            // Estrae questions da tutti gli step se formato text parser
            const questionsFromSteps = phase.steps?.flatMap((step: any) => 
              step.questions?.map((q: any) => typeof q === 'string' ? q : q.text) || []
            ) || [];

            // Estrae objectives dagli step se formato text parser
            const objectivesFromSteps = phase.steps?.map((step: any) => step.objective).filter(Boolean) || [];

            // Estrae keyPoints (usa step names come keyPoints per formato text)
            const keyPointsFromSteps = phase.steps?.map((step: any) => step.name).filter(Boolean) || [];

            return {
              name: phase.name || phase.title || 'Unnamed Phase',
              objectives: phase.objectives || phase.goals || (phase.description ? [phase.description] : objectivesFromSteps),
              keyPoints: phase.keyPoints || phase.key_points || phase.points || keyPointsFromSteps,
              questions: phase.questions || phase.suggestedQuestions || questionsFromSteps,
            };
          }) || [],
          objections: content?.objections?.map((obj: any) => ({
            trigger: obj.trigger || obj.objection || obj.text || '',
            response: obj.response || obj.answer || obj.rebuttal || '',
            category: obj.category || obj.type || 'general',
          })) || [],
        };
        session.scriptStructure = content;
        session.currentPhaseIndex = 0;
        session.currentStepIndex = 0;

        sendMessage(ws, {
          type: 'script_progress',
          data: calculateScriptProgress(session),
          timestamp: Date.now(),
        });

        console.log(`📘 [VideoCopilot] Playbook loaded from DB: ${script.name}, scriptStructure phases: ${content?.phases?.length || 0}, format: ${formatDetected}`);
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
      transcriptions: [] // Initialize transcriptions array for the new participant
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
          transcriptions: [] // Initialize transcriptions for existing participants
        });
        activeParticipants.push({
          id: p.id,
          name: p.name,
          role: p.role as 'host' | 'guest' | 'prospect',
          transcriptions: [] // Initialize transcriptions for existing participants
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

    // 📊 LOG DETTAGLIATO SCRIPT
    const scriptPreview = script.content?.substring(0, 200) || '';
    console.log(`\n📘 ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📘 [VideoCopilot] SCRIPT LOADING DEBUG`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`   📋 Script ID: ${playbookId}`);
    console.log(`   📋 Script Name: ${script.name}`);
    console.log(`   📋 Content Length: ${script.content?.length || 0} chars`);
    console.log(`   📋 Content Preview: "${scriptPreview}..."`);

    // ✅ LOGICA IBRIDA: Prima JSON, poi TEXT parser (come Sales Agent AI)
    let content: any;
    let formatDetected: 'json' | 'text' = 'json';

    try {
      // Tentativo 1: JSON parsing
      content = typeof script.content === 'string' 
        ? JSON.parse(script.content) 
        : script.content;
      formatDetected = 'json';
      console.log(`   ✅ Format: JSON (parsed successfully)`);
    } catch (jsonError: any) {
      console.log(`   ⚠️ JSON parse failed: ${jsonError.message}`);
      console.log(`   🔄 Trying TEXT parser (parseScriptContentToStructure)...`);

      try {
        // Tentativo 2: Text parsing (come Sales Agent AI)
        const scriptType = script.scriptType || 'discovery';
        const structure = parseScriptContentToStructure(script.content || '', scriptType);
        content = structure;
        formatDetected = 'text';
        console.log(`   ✅ Format: TEXT (parsed with parseScriptContentToStructure)`);
        console.log(`   📊 Parsed: ${structure.metadata.totalPhases} phases, ${structure.metadata.totalSteps} steps`);
      } catch (textError: any) {
        console.error(`   ❌ Both parsers failed!`);
        console.error(`      JSON error: ${jsonError.message}`);
        console.error(`      TEXT error: ${textError.message}`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
        return null;
      }
    }

    console.log(`   📊 Format Detected: ${formatDetected.toUpperCase()}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

    // ✅ FIX: Popola scriptStructure per il Sales Manager coaching
    session.scriptStructure = content;

    // Validazione: verifica che scriptStructure abbia la struttura attesa
    if (!session.scriptStructure?.phases || !Array.isArray(session.scriptStructure.phases)) {
      console.warn(`⚠️ [VideoCopilot] Script content missing 'phases' array for ${playbookId}`);
    } else {
      console.log(`✅ [VideoCopilot] scriptStructure loaded with ${session.scriptStructure.phases.length} phases`);
    }

    // ✅ MAPPING INTELLIGENTE: Gestisce sia formato JSON che formato TEXT parser
    // Il text parser produce { phases: [{ name, description, steps: [{ objective, questions }] }] }
    // Il JSON produce { phases: [{ name, objectives, keyPoints, questions }] }
    const playbook: Playbook = {
      id: script.id,
      name: script.name,
      phases: content?.phases?.map((phase: any) => {
        // Estrae questions da tutti gli step se formato text parser
        const questionsFromSteps = phase.steps?.flatMap((step: any) => 
          step.questions?.map((q: any) => typeof q === 'string' ? q : q.text) || []
        ) || [];

        // Estrae objectives dagli step se formato text parser
        const objectivesFromSteps = phase.steps?.map((step: any) => step.objective).filter(Boolean) || [];

        // Estrae keyPoints (usa step names come keyPoints per formato text)
        const keyPointsFromSteps = phase.steps?.map((step: any) => step.name).filter(Boolean) || [];

        return {
          name: phase.name || phase.title || 'Unnamed Phase',
          objectives: phase.objectives || phase.goals || (phase.description ? [phase.description] : objectivesFromSteps),
          keyPoints: phase.keyPoints || phase.key_points || phase.points || keyPointsFromSteps,
          questions: phase.questions || phase.suggestedQuestions || questionsFromSteps,
        };
      }) || [],
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

    console.log(`📘 [VideoCopilot] Auto-loaded playbook: ${script.name} (${playbook.phases.length} phases, ${playbook.objections.length} objections), scriptStructure: ${session.scriptStructure ? 'LOADED' : 'NULL'}, format: ${formatDetected}`);
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

function handleLobbyJoin(
  ws: WebSocket,
  meetingId: string,
  message: IncomingMessage,
  broadcast: (msg: OutgoingMessage) => void
) {
  if (!message.lobbyParticipant) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing lobbyParticipant data' },
      timestamp: Date.now(),
    });
    return;
  }

  const { name, isHost } = message.lobbyParticipant;
  const lobbyId = `lobby_${Date.now()}_${Math.random().toString(36).substring(7)}`;

  if (!lobbyParticipants.has(meetingId)) {
    lobbyParticipants.set(meetingId, new Map());
  }

  const lobbyParticipant: LobbyParticipant = {
    id: lobbyId,
    name,
    isHost,
    joinedAt: Date.now(),
  };

  lobbyParticipants.get(meetingId)!.set(lobbyId, lobbyParticipant);
  lobbySocketToId.set(ws, { meetingId, lobbyId });

  console.log(`🚪 [VideoCopilot] Lobby join: ${name} (${isHost ? 'host' : 'guest'}) in meeting ${meetingId}`);

  sendMessage(ws, {
    type: 'lobby_participant_joined',
    data: {
      id: lobbyId,
      name,
      isHost,
      isSelf: true,
    },
    timestamp: Date.now(),
  });

  broadcast({
    type: 'lobby_participant_joined',
    data: {
      id: lobbyId,
      name,
      isHost,
      isSelf: false,
    },
    timestamp: Date.now(),
  });

  const lobbyList = Array.from(lobbyParticipants.get(meetingId)!.values());
  broadcast({
    type: 'lobby_participants_list',
    data: { participants: lobbyList },
    timestamp: Date.now(),
  });
}

function handleLobbyLeave(
  ws: WebSocket,
  meetingId: string,
  broadcast: (msg: OutgoingMessage) => void
) {
  const lobbyInfo = lobbySocketToId.get(ws);
  if (!lobbyInfo) {
    return;
  }

  const { lobbyId } = lobbyInfo;
  const meetingLobby = lobbyParticipants.get(meetingId);

  if (meetingLobby) {
    const participant = meetingLobby.get(lobbyId);
    if (participant) {
      meetingLobby.delete(lobbyId);
      console.log(`🚪 [VideoCopilot] Lobby leave: ${participant.name} from meeting ${meetingId}`);

      broadcast({
        type: 'lobby_participant_left',
        data: {
          id: lobbyId,
          name: participant.name,
        },
        timestamp: Date.now(),
      });

      const lobbyList = Array.from(meetingLobby.values());
      broadcast({
        type: 'lobby_participants_list',
        data: { participants: lobbyList },
        timestamp: Date.now(),
      });
    }

    if (meetingLobby.size === 0) {
      lobbyParticipants.delete(meetingId);
    }
  }

  lobbySocketToId.delete(ws);
}

function unregisterLobbyParticipantBySocket(ws: WebSocket, broadcast: (msg: OutgoingMessage) => void) {
  const lobbyInfo = lobbySocketToId.get(ws);
  if (!lobbyInfo) return;

  const { meetingId, lobbyId } = lobbyInfo;
  const meetingLobby = lobbyParticipants.get(meetingId);

  if (meetingLobby) {
    const participant = meetingLobby.get(lobbyId);
    if (participant) {
      meetingLobby.delete(lobbyId);
      console.log(`🚪 [VideoCopilot] Auto-removed from lobby on disconnect: ${participant.name}`);

      broadcast({
        type: 'lobby_participant_left',
        data: {
          id: lobbyId,
          name: participant.name,
          reason: 'disconnected',
        },
        timestamp: Date.now(),
      });

      const lobbyList = Array.from(meetingLobby.values());
      broadcast({
        type: 'lobby_participants_list',
        data: { participants: lobbyList },
        timestamp: Date.now(),
      });
    }

    if (meetingLobby.size === 0) {
      lobbyParticipants.delete(meetingId);
    }
  }

  lobbySocketToId.delete(ws);
}

function handleSpeakingState(
  ws: WebSocket,
  session: SessionState,
  message: IncomingMessage,
  broadcast: (msg: OutgoingMessage) => void
) {
  if (!message.speakingState) {
    sendMessage(ws, {
      type: 'error',
      data: { message: 'Missing speakingState data' },
      timestamp: Date.now(),
    });
    return;
  }

  const { participantId, isSpeaking } = message.speakingState;

  const outMessage: OutgoingMessage = {
    type: 'speaking_state',
    data: {
      participantId,
      isSpeaking,
    },
    timestamp: Date.now(),
  };

  broadcast(outMessage);
}

async function handleEndSession(
  ws: WebSocket,
  session: SessionState
) {
  console.log(`🔚 [VideoCopilot] Session ending for meeting ${session.meetingId}`);

  const turnState = turnStates.get(session.meetingId);
  if (turnState) {
    for (const timer of turnState.silenceTimers.values()) {
      clearTimeout(timer);
    }
    turnState.silenceTimers.clear();
    if (turnState.analysisDebounceTimer) {
      clearTimeout(turnState.analysisDebounceTimer);
    }
    turnStates.delete(session.meetingId);
    console.log(`🧹 [TurnTaking] Cleaned up turn state for meeting ${session.meetingId}`);
  }

  await db
    .update(videoMeetings)
    .set({
      endedAt: new Date(),
      status: 'completed',
    })
    .where(eq(videoMeetings.id, session.meetingId));

  // Persist session metrics for human seller analytics
  if (session.sellerId) {
    try {
      const durationSeconds = Math.floor((Date.now() - session.coachingMetrics.sessionStartTime) / 1000);
      const avgScriptAdherence = session.coachingMetrics.scriptAdherenceScores.length > 0
        ? session.coachingMetrics.scriptAdherenceScores.reduce((a, b) => a + b, 0) / session.coachingMetrics.scriptAdherenceScores.length
        : 0;

      await db.insert(humanSellerSessionMetrics).values({
        meetingId: session.meetingId,
        sellerId: session.sellerId,
        durationSeconds,
        totalBuySignals: session.coachingMetrics.totalBuySignals,
        totalObjections: session.coachingMetrics.totalObjections,
        objectionsHandled: session.coachingMetrics.objectionsHandled,
        scriptAdherenceScore: Math.round(avgScriptAdherence * 10) / 10,
        prospectArchetype: session.coachingMetrics.prospectArchetype,
        outcome: null, // To be updated later by the client
      });

      console.log(`📊 [VideoCopilot] Session metrics persisted for seller ${session.sellerId}`);
    } catch (error: any) {
      console.error(`❌ [VideoCopilot] Failed to persist session metrics:`, error.message);
    }
  }

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

    const { meetingId, clientId, consultantId, sellerId, playbookId, businessContext } = authResult;

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
        currentStepIndex: 0,
        transcriptBuffer: [],
        lastAnalysisTime: 0,
        lastSalesManagerAnalysisTime: 0,
        totalTranscriptText: '',
        conversationMessages: [],
        archetypeState: null,
        scriptStructure: null,
        coachingMetrics: {
          totalBuySignals: 0,
          totalObjections: 0,
          objectionsHandled: 0,
          scriptAdherenceScores: [],
          prospectArchetype: null,
          sessionStartTime: Date.now(),
        },
        businessContext: businessContext || null,
        cachedAiProvider: null,
        aiProviderFailed: false,
        aiProviderErrorMessage: null,
        completedCheckpoints: [],
        validatedCheckpointItems: {},
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

    if (!session.playbook && sellerId) {
      let [sellerAssignment] = await db.select()
        .from(humanSellerScriptAssignments)
        .where(and(
          eq(humanSellerScriptAssignments.sellerId, sellerId),
          eq(humanSellerScriptAssignments.scriptType, 'discovery')
        ))
        .limit(1);

      if (!sellerAssignment) {
        [sellerAssignment] = await db.select()
          .from(humanSellerScriptAssignments)
          .where(and(
            eq(humanSellerScriptAssignments.sellerId, sellerId),
            eq(humanSellerScriptAssignments.scriptType, 'demo')
          ))
          .limit(1);
      }

      if (sellerAssignment) {
        console.log(`📘 [VideoCopilot] Loading script from seller assignment (${sellerAssignment.scriptType}): ${sellerAssignment.scriptId}`);
        const loadedPlaybook = await autoLoadPlaybook(session, sellerAssignment.scriptId);
        if (loadedPlaybook) {
          session.playbook = loadedPlaybook;
          session.currentPhaseIndex = 0;
        }
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

    // Send existing lobby participants list
    const meetingLobby = lobbyParticipants.get(meetingId);
    if (meetingLobby && meetingLobby.size > 0) {
      const lobbyList = Array.from(meetingLobby.values());
      sendMessage(ws, {
        type: 'lobby_participants_list',
        data: { participants: lobbyList },
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
          case 'lobby_join':
            handleLobbyJoin(ws, meetingId, message, broadcast);
            break;
          case 'lobby_leave':
            handleLobbyLeave(ws, meetingId, broadcast);
            break;
          case 'speaking_state':
            handleSpeakingState(ws, session!, message, broadcast);
            break;
          case 'speech_start':
            handleSpeechStart(ws, session!, message);
            break;
          case 'speech_end':
            await handleSpeechEndFromClient(ws, session!, message);
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

      // Clean up lobby participant on disconnect
      unregisterLobbyParticipantBySocket(ws, broadcast);

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